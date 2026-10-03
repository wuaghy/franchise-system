using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Inventory;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Franchise.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Franchise.Infrastructure.Services;

public class InventoryService : IInventoryService
{
    private readonly AppDbContext _context;

    public InventoryService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<InventoryDeductionResult> ProcessOrderInventoryDeductionAsync(
        CheckoutOrderInventoryRequest request, 
        CancellationToken ct = default)
    {
        if (request.Items == null || !request.Items.Any())
        {
            throw new ArgumentException("Đơn hàng không có sản phẩm nào để xử lý tồn kho.");
        }

        // 1. TẬP HỢP TẤT CẢ PRODUCT ID TRONG ĐƠN HÀNG
        var productIds = request.Items.Select(i => i.ProductId).Distinct().ToList();

        // Lấy tất cả công thức nền (Base Recipes) của các món trong đơn hàng trong 1 query duy nhất
        var baseRecipes = await _context.ProductRecipes
            .AsNoTracking()
            .Include(r => r.Ingredient)
            .Where(r => productIds.Contains(r.ProductId))
            .ToListAsync(ct);

        // 2. MA TRẬN TỔNG HỢP NHU CẦU TIÊU HAO (DYNAMIC BOM AGGREGATION)
        // Key: IngredientId -> Value: (Tên nguyên liệu, Tổng số lượng cần)
        var totalDemand = new Dictionary<Guid, (string Name, decimal Quantity)>();

        foreach (var item in request.Items)
        {
            // A. Cộng định lượng công thức gốc (Base Recipe) của món
            var recipes = baseRecipes.Where(r => r.ProductId == item.ProductId);
            foreach (var r in recipes)
            {
                var needed = r.Quantity * item.Quantity;
                var ingredientName = r.Ingredient?.Name ?? r.IngredientId.ToString();

                if (totalDemand.TryGetValue(r.IngredientId, out var existing))
                {
                    totalDemand[r.IngredientId] = (existing.Name, existing.Quantity + needed);
                }
                else
                {
                    totalDemand[r.IngredientId] = (ingredientName, needed);
                }
            }

            // B. Cộng định lượng Toppings / Modifiers (nếu có)
            if (item.Modifiers != null)
            {
                foreach (var mod in item.Modifiers)
                {
                    if (mod.IngredientId.HasValue && mod.ConsumptionQuantity > 0)
                    {
                        var ingId = mod.IngredientId.Value;
                        var needed = mod.ConsumptionQuantity * item.Quantity;

                        if (totalDemand.TryGetValue(ingId, out var existing))
                        {
                            totalDemand[ingId] = (existing.Name, existing.Quantity + needed);
                        }
                        else
                        {
                            totalDemand[ingId] = (mod.Name, needed);
                        }
                    }
                }
            }
        }

        // 3. DEADLOCK-FREE SORTING: Sắp xếp các IngredientId theo thứ tự cố định (tránh circular lock)
        var sortedIngredientIds = totalDemand.Keys.OrderBy(id => id).ToList();
        var deductedList = new List<DeductedIngredientDetail>();

        // 4. THỰC THI TRONG DATABASE TRANSACTION BẢO ĐẢM TÍNH TOÀN VẸN (ACID)
        IDbContextTransaction? dbTransaction = null;
        if (_context.Database.IsRelational())
        {
            dbTransaction = await _context.Database.BeginTransactionAsync(ct);
        }

        try
        {
            // Giai đoạn 4.1: Khóa dòng cấp cơ sở dữ liệu (Pessimistic Row Lock: SELECT ... FOR UPDATE)
            List<StoreInventory> lockedRows;
            if (_context.Database.IsRelational())
            {
                var ids = sortedIngredientIds.ToArray();
                lockedRows = await _context.StoreInventories
                    .FromSqlInterpolated($@"
                        SELECT * FROM ""StoreInventories""
                        WHERE ""StoreId"" = {request.StoreId}
                          AND ""IngredientId"" = ANY({ids})
                        ORDER BY ""IngredientId""
                        FOR UPDATE")
                    .Include(si => si.Ingredient)
                    .ToListAsync(ct);
            }
            else
            {
                // Fallback cho môi trường Unit Test (EF Core InMemory)
                lockedRows = await _context.StoreInventories
                    .Where(si => si.StoreId == request.StoreId && sortedIngredientIds.Contains(si.IngredientId))
                    .Include(si => si.Ingredient)
                    .OrderBy(si => si.IngredientId)
                    .ToListAsync(ct);
            }

            var byIngredient = lockedRows.ToDictionary(r => r.IngredientId);
            var inventoriesToDeduct = new List<(StoreInventory Inventory, decimal QuantityToDeduct, string IngredientName)>();

            foreach (var ingredientId in sortedIngredientIds)
            {
                var demand = totalDemand[ingredientId];

                if (!byIngredient.TryGetValue(ingredientId, out var inventory) || inventory.CurrentStock < demand.Quantity)
                {
                    var available = inventory?.CurrentStock ?? 0;
                    var ingredientDisplayName = inventory?.Ingredient?.Name ?? demand.Name;
                    throw new InvalidOperationException(
                        $"Hết hàng! Chi nhánh không đủ nguyên liệu '{ingredientDisplayName}'. Cần: {demand.Quantity}, Tồn kho hiện có: {available}.");
                }

                var displayName = inventory.Ingredient?.Name ?? demand.Name;
                inventoriesToDeduct.Add((inventory, demand.Quantity, displayName));
            }

            // Giai đoạn 4.2: Áp dụng trừ kho nguyên tử & ghi sổ cái bất biến (Ledger Audit)
            foreach (var (inventory, quantityToDeduct, ingredientName) in inventoriesToDeduct)
            {
                inventory.CurrentStock -= quantityToDeduct;
                inventory.LastCountedAt = DateTime.UtcNow;

                var transaction = new InventoryTransaction
                {
                    StoreId = request.StoreId,
                    IngredientId = inventory.IngredientId,
                    TransactionType = InventoryTransactionType.Outbound_Sale,
                    QuantityChange = -quantityToDeduct,
                    BalanceAfter = inventory.CurrentStock,
                    Note = $"Xuất kho bán hàng POS #{request.OrderCode}"
                };
                _context.InventoryTransactions.Add(transaction);

                deductedList.Add(new DeductedIngredientDetail(
                    inventory.IngredientId,
                    ingredientName,
                    quantityToDeduct,
                    inventory.CurrentStock
                ));
            }

            await _context.SaveChangesAsync(ct);
            if (dbTransaction != null)
            {
                await dbTransaction.CommitAsync(ct);
            }

            return new InventoryDeductionResult(true, request.OrderCode, deductedList);
        }
        catch (Exception ex)
        {
            if (dbTransaction != null)
            {
                await dbTransaction.RollbackAsync(ct);
            }
            _context.ChangeTracker.Clear();
            return new InventoryDeductionResult(false, request.OrderCode, Array.Empty<DeductedIngredientDetail>(), ex.Message);
        }
        finally
        {
            if (dbTransaction != null)
            {
                await dbTransaction.DisposeAsync();
            }
        }
    }

    public async Task<List<StoreInventoryResponse>> GetStoreInventoryAsync(
        Guid storeId, 
        CancellationToken ct = default)
    {
        return await _context.StoreInventories
            .AsNoTracking()
            .Where(si => si.StoreId == storeId)
            .Include(si => si.Ingredient)
            .OrderBy(si => si.Ingredient!.Name)
            .Select(si => new StoreInventoryResponse(
                si.StoreId,
                si.IngredientId,
                si.Ingredient != null ? si.Ingredient.Code : string.Empty,
                si.Ingredient != null ? si.Ingredient.Name : string.Empty,
                si.Ingredient != null ? si.Ingredient.Unit : string.Empty,
                si.CurrentStock,
                si.MinAlertThreshold,
                si.LastCountedAt
            ))
            .ToListAsync(ct);
    }

    public async Task<List<LowStockAlertResponse>> GetLowStockAlertsAsync(
        Guid storeId, 
        CancellationToken ct = default)
    {
        return await _context.StoreInventories
            .AsNoTracking()
            .Where(si => si.StoreId == storeId && si.CurrentStock <= si.MinAlertThreshold)
            .Include(si => si.Ingredient)
            .OrderBy(si => si.CurrentStock)
            .Select(si => new LowStockAlertResponse(
                si.StoreId,
                si.IngredientId,
                si.Ingredient != null ? si.Ingredient.Code : string.Empty,
                si.Ingredient != null ? si.Ingredient.Name : string.Empty,
                si.Ingredient != null ? si.Ingredient.Unit : string.Empty,
                si.CurrentStock,
                si.MinAlertThreshold,
                si.MinAlertThreshold - si.CurrentStock
            ))
            .ToListAsync(ct);
    }

    public async Task<StoreInventoryResponse> InboundStockAsync(
        InboundStockRequest request, 
        CancellationToken ct = default)
    {
        if (request.Quantity <= 0)
        {
            throw new ArgumentException("Số lượng nhập kho phải lớn hơn 0.");
        }

        var ingredient = await _context.Ingredients.FirstOrDefaultAsync(i => i.Id == request.IngredientId, ct);
        if (ingredient == null)
        {
            throw new InvalidOperationException($"Không tìm thấy nguyên liệu có ID '{request.IngredientId}'.");
        }

        var inventory = await _context.StoreInventories
            .FirstOrDefaultAsync(si => si.StoreId == request.StoreId && si.IngredientId == request.IngredientId, ct);

        if (inventory == null)
        {
            inventory = new StoreInventory
            {
                StoreId = request.StoreId,
                IngredientId = request.IngredientId,
                CurrentStock = request.Quantity,
                MinAlertThreshold = 10,
                LastCountedAt = DateTime.UtcNow
            };
            _context.StoreInventories.Add(inventory);
        }
        else
        {
            inventory.CurrentStock += request.Quantity;
            inventory.LastCountedAt = DateTime.UtcNow;
        }

        var transaction = new InventoryTransaction
        {
            StoreId = request.StoreId,
            IngredientId = request.IngredientId,
            TransactionType = InventoryTransactionType.Inbound_HQ,
            QuantityChange = request.Quantity,
            BalanceAfter = inventory.CurrentStock,
            Note = request.Note ?? "Nhập kho chi nhánh"
        };
        _context.InventoryTransactions.Add(transaction);

        await _context.SaveChangesAsync(ct);

        return new StoreInventoryResponse(
            inventory.StoreId,
            inventory.IngredientId,
            ingredient.Code,
            ingredient.Name,
            ingredient.Unit,
            inventory.CurrentStock,
            inventory.MinAlertThreshold,
            inventory.LastCountedAt
        );
    }
}
