using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Inventory;
using Franchise.Application.DTOs.Realtime;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Franchise.Domain.Exceptions;
using Franchise.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Franchise.Infrastructure.Services;

public class InventoryService : IInventoryService
{
    private readonly AppDbContext _context;
    private readonly IRealtimeNotificationService? _notificationService;
    private readonly ITelegramService? _telegramService;
    private readonly IEmailService? _emailService;
    private readonly Microsoft.Extensions.Configuration.IConfiguration? _configuration;

    public InventoryService(
        AppDbContext context, 
        IRealtimeNotificationService? notificationService = null,
        ITelegramService? telegramService = null,
        IEmailService? emailService = null,
        Microsoft.Extensions.Configuration.IConfiguration? configuration = null)
    {
        _context = context;
        _notificationService = notificationService;
        _telegramService = telegramService;
        _emailService = emailService;
        _configuration = configuration;
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
                        var modName = mod.Name;

                        if (totalDemand.TryGetValue(ingId, out var existing))
                        {
                            totalDemand[ingId] = (existing.Name, existing.Quantity + needed);
                        }
                        else
                        {
                            totalDemand[ingId] = (modName, needed);
                        }
                    }
                }
            }
        }

        if (!totalDemand.Any())
        {
            // Đơn hàng không tiêu hao nguyên liệu nào (ví dụ sản phẩm đóng gói sẵn không có BoM)
            return new InventoryDeductionResult(true, request.OrderCode, Array.Empty<DeductedIngredientDetail>());
        }

        // 3. KHÓA TẤT CẢ DÒNG TỒN KHO THEO THỨ TỰ CỐ ĐỊNH ĐỂ CHỐNG DEADLOCK (Deadlock-Free Sorting)
        // Sắp xếp các IngredientId theo GUID để mọi giao dịch đồng thời đều khóa theo đúng 1 thứ tự
        var sortedIngredientIds = totalDemand.Keys.OrderBy(id => id).ToList();

        IDbContextTransaction? dbTransaction = null;
        if (_context.Database.CurrentTransaction == null)
        {
            dbTransaction = await _context.Database.BeginTransactionAsync(ct);
        }

        try
        {
            var deductedList = new List<DeductedIngredientDetail>();
            var inventoriesToDeduct = new List<(StoreInventory Inventory, decimal QuantityToDeduct, string IngredientName)>();
            var isRelational = _context.Database.IsRelational();

            // Giai đoạn 4.1: Khóa dòng và Kiểm tra điều kiện đủ hàng (Validation Phase)
            foreach (var ingredientId in sortedIngredientIds)
            {
                StoreInventory? inventory = null;

                if (isRelational)
                {
                    // Pessimistic Locking: SELECT ... FOR UPDATE trên PostgreSQL
                    inventory = await _context.StoreInventories
                        .FromSqlInterpolated($"SELECT * FROM \"StoreInventories\" WHERE \"StoreId\" = {request.StoreId} AND \"IngredientId\" = {ingredientId} FOR UPDATE")
                        .FirstOrDefaultAsync(ct);
                }
                else
                {
                    // Fallback cho EF Core In-Memory (trong môi trường Unit Test)
                    inventory = await _context.StoreInventories
                        .FirstOrDefaultAsync(si => si.StoreId == request.StoreId && si.IngredientId == ingredientId, ct);
                }

                var demand = totalDemand[ingredientId];

                // Nếu chưa có record tồn kho tại chi nhánh hoặc số tồn < nhu cầu -> THẤT BẠI
                if (inventory == null)
                {
                    throw new InsufficientStockException(ingredientId, demand.Name, demand.Quantity, 0);
                }

                if (inventory.CurrentStock < demand.Quantity)
                {
                    throw new InsufficientStockException(ingredientId, demand.Name, demand.Quantity, inventory.CurrentStock);
                }

                inventoriesToDeduct.Add((inventory, demand.Quantity, demand.Name));
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

            // Giai đoạn 4.3: Real-time SignalR Event Broadcasts
            if (_notificationService != null)
            {
                try
                {
                    var updates = deductedList.Select(d => new InventoryUpdatedNotification(
                        request.StoreId,
                        d.IngredientId,
                        d.IngredientName,
                        d.QuantityDeducted,
                        d.BalanceAfter
                    )).ToList();

                    await _notificationService.NotifyInventoryUpdatedAsync(request.StoreId, updates, ct);

                    // Kiểm tra và phát cảnh báo nếu chạm ngưỡng an toàn
                    foreach (var (inv, _, ingName) in inventoriesToDeduct)
                    {
                        if (inv.CurrentStock <= inv.MinAlertThreshold)
                        {
                            await _notificationService.NotifyLowStockAlertAsync(new LowStockAlertNotification(
                                request.StoreId,
                                inv.IngredientId,
                                inv.Ingredient?.Code ?? string.Empty,
                                ingName,
                                inv.Ingredient?.Unit ?? string.Empty,
                                inv.CurrentStock,
                                inv.MinAlertThreshold,
                                inv.MinAlertThreshold - inv.CurrentStock,
                                DateTime.UtcNow
                            ), ct);
                        }
                    }
                }
                catch
                {
                    // Lỗi SignalR broadcast không làm hủy giao dịch đơn hàng DB
                }
            }

            return new InventoryDeductionResult(true, request.OrderCode, deductedList);
        }
        catch (InsufficientStockException ex)
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
            throw new RequestValidationException(nameof(request.Quantity), "Số lượng nhập kho phải lớn hơn 0.");
        }

        var ingredient = await _context.Ingredients.FirstOrDefaultAsync(i => i.Id == request.IngredientId, ct)
            ?? throw new NotFoundException("INGREDIENT_NOT_FOUND", $"Không tìm thấy nguyên liệu có ID '{request.IngredientId}'.");

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

        if (_notificationService != null)
        {
            try
            {
                await _notificationService.NotifyInventoryUpdatedAsync(
                    request.StoreId,
                    new[] { new InventoryUpdatedNotification(request.StoreId, request.IngredientId, ingredient.Name, -request.Quantity, inventory.CurrentStock) },
                    ct);
            }
            catch
            {
                // Ignore real-time broadcast exception
            }
        }

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

    public async Task<RecordWasteResponse> RecordWasteAsync(
        RecordWasteRequest request, 
        CancellationToken ct = default)
    {
        if (request.Quantity <= 0)
        {
            throw new RequestValidationException(nameof(request.Quantity), "Số lượng xuất hủy phải lớn hơn 0.");
        }

        var ingredient = await _context.Ingredients
            .FirstOrDefaultAsync(i => i.Id == request.IngredientId, ct)
            ?? throw new NotFoundException("INGREDIENT_NOT_FOUND", $"Không tìm thấy nguyên liệu có ID '{request.IngredientId}'.");

        var inventory = await _context.StoreInventories
            .FirstOrDefaultAsync(si => si.StoreId == request.StoreId && si.IngredientId == request.IngredientId, ct)
            ?? throw new NotFoundException("INVENTORY_NOT_FOUND", $"Chi nhánh chưa có kho cho nguyên liệu '{ingredient.Name}'.");

        inventory.CurrentStock -= request.Quantity;
        inventory.LastCountedAt = DateTime.UtcNow;

        var transaction = new InventoryTransaction
        {
            StoreId = request.StoreId,
            IngredientId = request.IngredientId,
            TransactionType = InventoryTransactionType.Waste_Spoiled,
            QuantityChange = -request.Quantity,
            BalanceAfter = inventory.CurrentStock,
            Note = string.IsNullOrWhiteSpace(request.Reason) ? "Xuất hủy nguyên liệu do rơi vỡ/hư hỏng" : request.Reason
        };
        _context.InventoryTransactions.Add(transaction);

        await _context.SaveChangesAsync(ct);

        if (_notificationService != null)
        {
            try
            {
                await _notificationService.NotifyInventoryUpdatedAsync(
                    request.StoreId,
                    new[] { new InventoryUpdatedNotification(request.StoreId, request.IngredientId, ingredient.Name, -request.Quantity, inventory.CurrentStock) },
                    ct);

                if (inventory.CurrentStock <= inventory.MinAlertThreshold)
                {
                    await _notificationService.NotifyLowStockAlertAsync(new LowStockAlertNotification(
                        request.StoreId,
                        request.IngredientId,
                        ingredient.Code,
                        ingredient.Name,
                        ingredient.Unit,
                        inventory.CurrentStock,
                        inventory.MinAlertThreshold,
                        inventory.MinAlertThreshold - inventory.CurrentStock,
                        DateTime.UtcNow), ct);
                }
            }
            catch
            {
                // Ignore real-time broadcast exception
            }
        }

        return new RecordWasteResponse(
            request.StoreId,
            request.IngredientId,
            ingredient.Name,
            request.Quantity,
            inventory.CurrentStock,
            transaction.Note,
            DateTime.UtcNow
        );
    }

    public async Task<bool> UpdateStoreAlertConfigAsync(
        Guid storeId, 
        UpdateStoreAlertConfigRequest request, 
        CancellationToken ct = default)
    {
        var store = await _context.Stores.FirstOrDefaultAsync(s => s.Id == storeId, ct)
            ?? throw new NotFoundException("STORE_NOT_FOUND", $"Không tìm thấy chi nhánh với ID '{storeId}'.");

        store.ManagerEmail = request.ManagerEmail;
        store.TelegramChatId = request.TelegramChatId;
        await _context.SaveChangesAsync(ct);
        return true;
    }

    public async Task<AlertBroadcastResultDto> BroadcastLowStockAlertsAsync(
        Guid storeId, 
        BroadcastStockAlertRequest? request = null, 
        CancellationToken ct = default)
    {
        var store = await _context.Stores
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == storeId, ct)
            ?? throw new NotFoundException("STORE_NOT_FOUND", $"Không tìm thấy chi nhánh với ID '{storeId}'.");

        var lowStockItems = await GetLowStockAlertsAsync(storeId, ct);

        var telegramChatId = !string.IsNullOrWhiteSpace(request?.CustomTelegramChatId) 
            ? request.CustomTelegramChatId 
            : (!string.IsNullOrWhiteSpace(store.TelegramChatId) ? store.TelegramChatId : _configuration?["Telegram:DefaultChatId"]);

        var managerEmail = !string.IsNullOrWhiteSpace(request?.CustomManagerEmail)
            ? request.CustomManagerEmail
            : store.ManagerEmail;

        bool telegramSent = false;
        string? telegramStatus = null;
        if (!string.IsNullOrWhiteSpace(telegramChatId) && _telegramService != null)
        {
            var teleResult = await _telegramService.SendLowStockAlertAsync(telegramChatId, store.Name, lowStockItems, ct);
            telegramSent = teleResult.IsSuccess;
            telegramStatus = teleResult.Message;
        }
        else
        {
            telegramStatus = "Chưa cấu hình Telegram Chat ID";
        }

        bool emailSent = false;
        string? emailStatus = null;
        if (!string.IsNullOrWhiteSpace(managerEmail) && _emailService != null)
        {
            try
            {
                await _emailService.SendBatchLowStockAlertEmailAsync(managerEmail, store.Name, lowStockItems, ct);
                emailSent = true;
                emailStatus = $"Đã gửi email cảnh báo tới {managerEmail}";
            }
            catch (Exception ex)
            {
                emailStatus = $"Lỗi gửi email: {ex.Message}";
            }
        }
        else
        {
            emailStatus = "Chưa cấu hình Email Quản lý chi nhánh";
        }

        return new AlertBroadcastResultDto(
            store.Id,
            store.Name,
            lowStockItems.Count,
            lowStockItems,
            telegramSent,
            telegramStatus,
            emailSent,
            emailStatus,
            DateTime.UtcNow
        );
    }

    public async Task<SubmitStockAuditResponse> SubmitStockAuditAsync(
        SubmitStockAuditRequest request,
        CancellationToken ct = default)
    {
        if (request.Items == null || request.Items.Count == 0)
        {
            throw new RequestValidationException(nameof(request.Items), "Danh sách kiểm kê không được để trống.");
        }

        var store = await _context.Stores
            .FirstOrDefaultAsync(s => s.Id == request.StoreId, ct)
            ?? throw new NotFoundException("STORE_NOT_FOUND", $"Không tìm thấy chi nhánh với ID '{request.StoreId}'.");

        var requestedIngredientIds = request.Items.Select(i => i.IngredientId).Distinct().ToList();

        var existingInventories = await _context.StoreInventories
            .Include(si => si.Ingredient)
            .Where(si => si.StoreId == request.StoreId && requestedIngredientIds.Contains(si.IngredientId))
            .ToListAsync(ct);

        var ingredientsMap = await _context.Ingredients
            .Where(i => requestedIngredientIds.Contains(i.Id))
            .ToDictionaryAsync(i => i.Id, ct);

        var discrepancyList = new List<StockAuditDiscrepancyItem>();
        decimal totalCostDiscrepancy = 0m;
        var now = DateTime.UtcNow;

        foreach (var item in request.Items)
        {
            if (!ingredientsMap.TryGetValue(item.IngredientId, out var ingredient))
            {
                continue;
            }

            var inventory = existingInventories.FirstOrDefault(si => si.IngredientId == item.IngredientId);
            if (inventory == null)
            {
                inventory = new StoreInventory
                {
                    StoreId = request.StoreId,
                    IngredientId = item.IngredientId,
                    CurrentStock = 0,
                    MinAlertThreshold = 10,
                    LastCountedAt = now
                };
                _context.StoreInventories.Add(inventory);
            }

            var systemStock = inventory.CurrentStock;
            var physicalCount = Math.Max(0, item.PhysicalCount);
            var discrepancy = physicalCount - systemStock; // + là thừa, - là thiếu
            var costLossOrGain = discrepancy * ingredient.StandardCost;

            totalCostDiscrepancy += costLossOrGain;

            // Cập nhật tồn kho theo kết quả kiểm kê thực tế
            inventory.CurrentStock = physicalCount;
            inventory.LastCountedAt = now;

            // Nếu có chênh lệch, ghi log giao dịch điều chỉnh kiểm kê
            if (discrepancy != 0)
            {
                var auditNote = string.IsNullOrWhiteSpace(item.Note)
                    ? $"Kiểm kê kho bởi {request.AuditorName}: Hệ thống ({systemStock}) -> Thực tế ({physicalCount})"
                    : $"Kiểm kê kho bởi {request.AuditorName}: {item.Note} (HT: {systemStock} -> TT: {physicalCount})";

                var transaction = new InventoryTransaction
                {
                    StoreId = request.StoreId,
                    IngredientId = item.IngredientId,
                    TransactionType = InventoryTransactionType.Audit_Adjustment,
                    QuantityChange = discrepancy,
                    BalanceAfter = physicalCount,
                    Note = auditNote
                };
                _context.InventoryTransactions.Add(transaction);
            }

            discrepancyList.Add(new StockAuditDiscrepancyItem(
                ingredient.Id,
                ingredient.Code,
                ingredient.Name,
                ingredient.Unit,
                systemStock,
                physicalCount,
                discrepancy,
                ingredient.StandardCost,
                costLossOrGain,
                item.Note
            ));
        }

        await _context.SaveChangesAsync(ct);

        // Realtime notification broadcast
        if (_notificationService != null)
        {
            try
            {
                var updateNotifs = discrepancyList
                    .Where(d => d.Discrepancy != 0)
                    .Select(d => new InventoryUpdatedNotification(request.StoreId, d.IngredientId, d.IngredientName, d.Discrepancy, d.PhysicalCount))
                    .ToList();

                if (updateNotifs.Count > 0)
                {
                    await _notificationService.NotifyInventoryUpdatedAsync(request.StoreId, updateNotifs, ct);
                }
            }
            catch
            {
                // Ignore realtime broadcast error
            }
        }

        var discrepancyItemCount = discrepancyList.Count(d => d.Discrepancy != 0);
        var msg = discrepancyItemCount > 0
            ? $"Đã hoàn tất kiểm kê kho. Phát hiện {discrepancyItemCount} mặt hàng có chênh lệch và đã tự động cân bằng tồn kho."
            : "Đã hoàn tất kiểm kê kho. Tồn kho thực tế khớp 100% với hệ thống!";

        return new SubmitStockAuditResponse(
            store.Id,
            store.Name,
            request.AuditorName,
            now,
            request.Items.Count,
            discrepancyItemCount,
            totalCostDiscrepancy,
            discrepancyList,
            msg
        );
    }
}
