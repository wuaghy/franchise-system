using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.SupplyChain;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Franchise.Domain.Exceptions;
using Franchise.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Franchise.Infrastructure.Services;

public class SupplyChainService : ISupplyChainService
{
    private readonly AppDbContext _context;

    public SupplyChainService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<StockTransferOrderDto>> GetTransferOrdersAsync(
        TransferOrderFilterDto filter, 
        CancellationToken ct = default)
    {
        var query = _context.StockTransferOrders
            .AsNoTracking()
            .Include(o => o.SourceWarehouse)
            .Include(o => o.DestinationStore)
            .Include(o => o.Items)
                .ThenInclude(i => i.Ingredient)
            .AsQueryable();

        if (filter.StoreId.HasValue)
        {
            query = query.Where(o => o.DestinationStoreId == filter.StoreId.Value);
        }

        if (filter.WarehouseId.HasValue)
        {
            query = query.Where(o => o.SourceWarehouseId == filter.WarehouseId.Value);
        }

        if (!string.IsNullOrWhiteSpace(filter.Status) && Enum.TryParse<TransferStatus>(filter.Status, true, out var statusEnum))
        {
            query = query.Where(o => o.Status == statusEnum);
        }

        if (!string.IsNullOrWhiteSpace(filter.SearchTerm))
        {
            var search = filter.SearchTerm.Trim().ToLower();
            query = query.Where(o => o.TransferCode.ToLower().Contains(search) 
                || (o.DispatchTrackingNumber != null && o.DispatchTrackingNumber.ToLower().Contains(search))
                || (o.DestinationStore != null && o.DestinationStore.Name.ToLower().Contains(search)));
        }

        if (filter.FromDate.HasValue)
        {
            query = query.Where(o => o.CreatedAt >= filter.FromDate.Value);
        }

        if (filter.ToDate.HasValue)
        {
            query = query.Where(o => o.CreatedAt <= filter.ToDate.Value);
        }

        var orders = await query
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync(ct);

        return orders.Select(MapToDto).ToList();
    }

    public async Task<StockTransferOrderDto> GetTransferOrderByIdAsync(Guid id, CancellationToken ct = default)
    {
        var order = await _context.StockTransferOrders
            .AsNoTracking()
            .Include(o => o.SourceWarehouse)
            .Include(o => o.DestinationStore)
            .Include(o => o.Items)
                .ThenInclude(i => i.Ingredient)
            .FirstOrDefaultAsync(o => o.Id == id, ct);

        if (order == null)
            throw new NotFoundException("TRANSFER_ORDER_NOT_FOUND", $"Không tìm thấy đơn điều chuyển với Id '{id}'.");

        return MapToDto(order);
    }

    public async Task<StockTransferOrderDto> CreateTransferOrderAsync(
        CreateTransferOrderRequest request, 
        Guid currentUserId, 
        CancellationToken ct = default)
    {
        if (request.Items == null || !request.Items.Any() || request.Items.All(i => i.RequestedQuantity <= 0))
            throw new BusinessRuleException("EMPTY_TRANSFER_ITEMS", "Đơn điều chuyển phải chứa ít nhất 1 mặt hàng với số lượng lớn hơn 0.");

        var warehouse = await _context.Warehouses.FindAsync(new object[] { request.SourceWarehouseId }, ct);
        if (warehouse == null)
            throw new NotFoundException("WAREHOUSE_NOT_FOUND", "Kho tổng nguồn không tồn tại.");

        var store = await _context.Stores.FindAsync(new object[] { request.DestinationStoreId }, ct);
        if (store == null)
            throw new NotFoundException("STORE_NOT_FOUND", "Cửa hàng đích không tồn tại.");

        var ingredientIds = request.Items.Select(i => i.IngredientId).Distinct().ToList();
        var ingredients = await _context.Ingredients
            .Where(ing => ingredientIds.Contains(ing.Id))
            .ToDictionaryAsync(ing => ing.Id, ct);

        // Sinh mã STO-YYYYMM-XXXX
        var prefix = $"STO-{DateTime.UtcNow:yyyyMM}-";
        var existingCount = await _context.StockTransferOrders
            .CountAsync(o => o.TransferCode.StartsWith(prefix), ct);
        var transferCode = $"{prefix}{(existingCount + 1):D4}";

        var order = new StockTransferOrder
        {
            TransferCode = transferCode,
            SourceWarehouseId = request.SourceWarehouseId,
            DestinationStoreId = request.DestinationStoreId,
            Status = TransferStatus.Draft,
            CreatedByUserId = currentUserId,
            Notes = request.Notes
        };

        foreach (var itemReq in request.Items.Where(i => i.RequestedQuantity > 0))
        {
            ingredients.TryGetValue(itemReq.IngredientId, out var ing);
            order.Items.Add(new StockTransferItem
            {
                IngredientId = itemReq.IngredientId,
                RequestedQuantity = itemReq.RequestedQuantity,
                ApprovedQuantity = 0,
                ActualReceivedQuantity = 0,
                UnitCost = ing?.StandardCost ?? 0,
                Notes = itemReq.Notes
            });
        }

        _context.StockTransferOrders.Add(order);
        await _context.SaveChangesAsync(ct);

        return await GetTransferOrderByIdAsync(order.Id, ct);
    }

    public async Task<StockTransferOrderDto> UpdateTransferOrderAsync(
        Guid id, 
        UpdateTransferOrderRequest request, 
        Guid currentUserId, 
        CancellationToken ct = default)
    {
        var order = await _context.StockTransferOrders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id, ct);

        if (order == null)
            throw new NotFoundException("TRANSFER_ORDER_NOT_FOUND", "Không tìm thấy đơn điều chuyển.");

        if (order.Status != TransferStatus.Draft)
            throw new BusinessRuleException("INVALID_STATUS", "Chỉ có thể chỉnh sửa đơn ở trạng thái Draft.");

        if (request.Items == null || !request.Items.Any() || request.Items.All(i => i.RequestedQuantity <= 0))
            throw new BusinessRuleException("EMPTY_TRANSFER_ITEMS", "Đơn điều chuyển phải chứa ít nhất 1 mặt hàng với số lượng lớn hơn 0.");

        var ingredientIds = request.Items.Select(i => i.IngredientId).Distinct().ToList();
        var ingredients = await _context.Ingredients
            .Where(ing => ingredientIds.Contains(ing.Id))
            .ToDictionaryAsync(ing => ing.Id, ct);

        order.Items.Clear();
        foreach (var itemReq in request.Items.Where(i => i.RequestedQuantity > 0))
        {
            ingredients.TryGetValue(itemReq.IngredientId, out var ing);
            order.Items.Add(new StockTransferItem
            {
                TransferOrderId = order.Id,
                IngredientId = itemReq.IngredientId,
                RequestedQuantity = itemReq.RequestedQuantity,
                ApprovedQuantity = 0,
                ActualReceivedQuantity = 0,
                UnitCost = ing?.StandardCost ?? 0,
                Notes = itemReq.Notes
            });
        }

        order.Notes = request.Notes;
        order.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);
        return await GetTransferOrderByIdAsync(order.Id, ct);
    }

    public async Task<StockTransferOrderDto> SubmitTransferOrderAsync(
        Guid id, 
        Guid currentUserId, 
        CancellationToken ct = default)
    {
        var order = await _context.StockTransferOrders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id, ct);

        if (order == null)
            throw new NotFoundException("TRANSFER_ORDER_NOT_FOUND", "Không tìm thấy đơn điều chuyển.");

        order.Submit();
        await _context.SaveChangesAsync(ct);

        return await GetTransferOrderByIdAsync(order.Id, ct);
    }

    public async Task<StockTransferOrderDto> ApproveTransferOrderAsync(
        Guid id, 
        ApproveTransferOrderRequest request, 
        Guid currentUserId, 
        CancellationToken ct = default)
    {
        var order = await _context.StockTransferOrders
            .Include(o => o.Items)
                .ThenInclude(i => i.Ingredient)
            .FirstOrDefaultAsync(o => o.Id == id, ct);

        if (order == null)
            throw new NotFoundException("TRANSFER_ORDER_NOT_FOUND", "Không tìm thấy đơn điều chuyển.");

        var approvedMap = request.ApprovedItems.ToDictionary(i => i.IngredientId, i => i.ApprovedQuantity);

        // Kiểm tra tồn kho kho tổng
        var ingredientIds = order.Items.Select(i => i.IngredientId).Distinct().ToList();
        var warehouseInventories = await _context.WarehouseInventories
            .Where(wi => wi.WarehouseId == order.SourceWarehouseId && ingredientIds.Contains(wi.IngredientId))
            .ToDictionaryAsync(wi => wi.IngredientId, ct);

        foreach (var item in order.Items)
        {
            var approvedQty = approvedMap.TryGetValue(item.IngredientId, out var requestedApproved)
                ? requestedApproved
                : item.RequestedQuantity;

            if (approvedQty <= 0)
                throw new BusinessRuleException("INVALID_APPROVED_QUANTITY", $"Số lượng duyệt cho nguyên liệu '{item.Ingredient?.Name ?? item.IngredientId.ToString()}' phải lớn hơn 0.");

            warehouseInventories.TryGetValue(item.IngredientId, out var whInv);
            var available = whInv?.CurrentStock ?? 0;

            if (available < approvedQty)
            {
                var ingName = item.Ingredient?.Name ?? "Nguyên liệu";
                throw new BusinessRuleException("WAREHOUSE_INSUFFICIENT_STOCK",
                    $"Kho tổng không đủ tồn kho cho nguyên liệu '{ingName}'. Cần duyệt: {approvedQty}, tồn khả dụng: {available}.");
            }

            item.ApprovedQuantity = approvedQty;
        }

        order.Approve(currentUserId);
        if (!string.IsNullOrWhiteSpace(request.Notes))
        {
            order.Notes = string.IsNullOrWhiteSpace(order.Notes)
                ? request.Notes
                : $"{order.Notes} | Ghi chú duyệt: {request.Notes}";
        }

        await _context.SaveChangesAsync(ct);
        return await GetTransferOrderByIdAsync(order.Id, ct);
    }

    public async Task<StockTransferOrderDto> RejectTransferOrderAsync(
        Guid id, 
        string reason, 
        Guid currentUserId, 
        CancellationToken ct = default)
    {
        var order = await _context.StockTransferOrders.FindAsync(new object[] { id }, ct);
        if (order == null)
            throw new NotFoundException("TRANSFER_ORDER_NOT_FOUND", "Không tìm thấy đơn điều chuyển.");

        order.Reject(reason);
        await _context.SaveChangesAsync(ct);

        return await GetTransferOrderByIdAsync(order.Id, ct);
    }

    public async Task<StockTransferOrderDto> DispatchTransferOrderAsync(
        Guid id, 
        DispatchTransferOrderRequest request, 
        Guid currentUserId, 
        CancellationToken ct = default)
    {
        var order = await _context.StockTransferOrders
            .Include(o => o.DestinationStore)
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id, ct);

        if (order == null)
            throw new NotFoundException("TRANSFER_ORDER_NOT_FOUND", "Không tìm thấy đơn điều chuyển.");

        order.Dispatch(request.DispatchTrackingNumber);

        // Khấu trừ tồn kho kho tổng & ghi chép sổ cái giao dịch
        var ingredientIds = order.Items.Select(i => i.IngredientId).Distinct().ToList();
        var whInventories = await _context.WarehouseInventories
            .Where(wi => wi.WarehouseId == order.SourceWarehouseId && ingredientIds.Contains(wi.IngredientId))
            .ToDictionaryAsync(wi => wi.IngredientId, ct);

        foreach (var item in order.Items)
        {
            if (whInventories.TryGetValue(item.IngredientId, out var whInv))
            {
                whInv.CurrentStock -= item.ApprovedQuantity;
                _context.WarehouseInventoryTransactions.Add(new WarehouseInventoryTransaction
                {
                    WarehouseId = order.SourceWarehouseId,
                    IngredientId = item.IngredientId,
                    QuantityChange = -item.ApprovedQuantity,
                    BalanceAfter = whInv.CurrentStock,
                    TransactionType = WarehouseTransactionType.TransferDispatch,
                    ReferenceNumber = order.TransferCode,
                    Note = $"Xuất kho STO {order.TransferCode} tới {order.DestinationStore?.Name ?? "chi nhánh"} (Vận đơn: {request.DispatchTrackingNumber})"
                });
            }
        }

        await _context.SaveChangesAsync(ct);
        return await GetTransferOrderByIdAsync(order.Id, ct);
    }

    public async Task<StockTransferOrderDto> ReceiveTransferOrderAsync(
        Guid id, 
        ReceiveTransferOrderRequest request, 
        Guid currentUserId, 
        CancellationToken ct = default)
    {
        var order = await _context.StockTransferOrders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id, ct);

        if (order == null)
            throw new NotFoundException("TRANSFER_ORDER_NOT_FOUND", "Không tìm thấy đơn điều chuyển.");

        var receivedMap = request.ReceivedItems.ToDictionary(i => i.IngredientId, i => i.ActualReceivedQuantity);

        foreach (var item in order.Items)
        {
            item.ActualReceivedQuantity = receivedMap.TryGetValue(item.IngredientId, out var actualQty)
                ? actualQty
                : item.ApprovedQuantity;
        }

        bool hasDiscrepancy = order.Items.Any(i => i.ActualReceivedQuantity != i.ApprovedQuantity);
        order.Receive(hasDiscrepancy, request.InspectionNotes);

        // Cộng tồn kho chi nhánh & ghi nhật ký giao dịch
        var ingredientIds = order.Items.Select(i => i.IngredientId).Distinct().ToList();
        var storeInventories = await _context.StoreInventories
            .Where(si => si.StoreId == order.DestinationStoreId && ingredientIds.Contains(si.IngredientId))
            .ToDictionaryAsync(si => si.IngredientId, ct);

        foreach (var item in order.Items.Where(i => i.ActualReceivedQuantity > 0))
        {
            if (!storeInventories.TryGetValue(item.IngredientId, out var storeInv))
            {
                storeInv = new StoreInventory
                {
                    StoreId = order.DestinationStoreId,
                    IngredientId = item.IngredientId,
                    CurrentStock = item.ActualReceivedQuantity,
                    MinAlertThreshold = 10,
                    LastCountedAt = DateTime.UtcNow
                };
                _context.StoreInventories.Add(storeInv);
            }
            else
            {
                storeInv.CurrentStock += item.ActualReceivedQuantity;
                storeInv.LastCountedAt = DateTime.UtcNow;
            }

            _context.InventoryTransactions.Add(new InventoryTransaction
            {
                StoreId = order.DestinationStoreId,
                IngredientId = item.IngredientId,
                TransactionType = InventoryTransactionType.Inbound_HQ,
                QuantityChange = item.ActualReceivedQuantity,
                BalanceAfter = storeInv.CurrentStock,
                Note = $"Nghiệm thu điều chuyển STO {order.TransferCode}"
            });
        }

        await _context.SaveChangesAsync(ct);
        return await GetTransferOrderByIdAsync(order.Id, ct);
    }

    public async Task<StockTransferOrderDto> ResolveDiscrepancyAsync(
        Guid id, 
        string resolutionNotes, 
        Guid currentUserId, 
        CancellationToken ct = default)
    {
        var order = await _context.StockTransferOrders.FindAsync(new object[] { id }, ct);
        if (order == null)
            throw new NotFoundException("TRANSFER_ORDER_NOT_FOUND", "Không tìm thấy đơn điều chuyển.");

        order.ResolveDiscrepancy(resolutionNotes);
        await _context.SaveChangesAsync(ct);

        return await GetTransferOrderByIdAsync(order.Id, ct);
    }

    public async Task<StockTransferOrderDto> CancelTransferOrderAsync(
        Guid id, 
        Guid currentUserId, 
        CancellationToken ct = default)
    {
        var order = await _context.StockTransferOrders.FindAsync(new object[] { id }, ct);
        if (order == null)
            throw new NotFoundException("TRANSFER_ORDER_NOT_FOUND", "Không tìm thấy đơn điều chuyển.");

        order.Cancel();
        await _context.SaveChangesAsync(ct);

        return await GetTransferOrderByIdAsync(order.Id, ct);
    }

    public async Task<List<WarehouseDto>> GetWarehousesAsync(CancellationToken ct = default)
    {
        return await _context.Warehouses
            .AsNoTracking()
            .Where(w => w.IsActive)
            .Select(w => new WarehouseDto(
                w.Id,
                w.Code,
                w.Name,
                w.Address,
                w.ContactPhone,
                w.IsActive
            ))
            .ToListAsync(ct);
    }

    public async Task<List<WarehouseInventoryDto>> GetWarehouseInventoryAsync(Guid warehouseId, CancellationToken ct = default)
    {
        return await _context.WarehouseInventories
            .AsNoTracking()
            .Where(wi => wi.WarehouseId == warehouseId)
            .Include(wi => wi.Ingredient)
            .OrderBy(wi => wi.Ingredient!.Name)
            .Select(wi => new WarehouseInventoryDto(
                wi.Id,
                wi.WarehouseId,
                wi.IngredientId,
                wi.Ingredient != null ? wi.Ingredient.Code : string.Empty,
                wi.Ingredient != null ? wi.Ingredient.Name : string.Empty,
                wi.Ingredient != null ? wi.Ingredient.Unit : string.Empty,
                wi.CurrentStock,
                wi.SafetyStock,
                wi.Ingredient != null ? wi.Ingredient.StandardCost : 0,
                wi.LastRestockedAt
            ))
            .ToListAsync(ct);
    }

    public async Task<List<WarehouseInventoryDto>> InboundWarehouseStockAsync(
        WarehouseInboundRequest request, 
        Guid currentUserId, 
        CancellationToken ct = default)
    {
        var warehouse = await _context.Warehouses.FindAsync(new object[] { request.WarehouseId }, ct);
        if (warehouse == null)
            throw new NotFoundException("WAREHOUSE_NOT_FOUND", "Kho tổng không tồn tại.");

        var ingredientIds = request.Items.Select(i => i.IngredientId).Distinct().ToList();
        var ingredients = await _context.Ingredients
            .Where(ing => ingredientIds.Contains(ing.Id))
            .ToDictionaryAsync(ing => ing.Id, ct);

        var existingInventories = await _context.WarehouseInventories
            .Where(wi => wi.WarehouseId == request.WarehouseId && ingredientIds.Contains(wi.IngredientId))
            .ToDictionaryAsync(wi => wi.IngredientId, ct);

        foreach (var item in request.Items.Where(i => i.Quantity > 0))
        {
            if (ingredients.TryGetValue(item.IngredientId, out var ing))
            {
                if (item.UnitCost > 0)
                {
                    ing.StandardCost = item.UnitCost;
                }
            }

            if (!existingInventories.TryGetValue(item.IngredientId, out var whInv))
            {
                whInv = new WarehouseInventory
                {
                    WarehouseId = request.WarehouseId,
                    IngredientId = item.IngredientId,
                    CurrentStock = item.Quantity,
                    SafetyStock = 20,
                    LastRestockedAt = DateTime.UtcNow
                };
                _context.WarehouseInventories.Add(whInv);
            }
            else
            {
                whInv.CurrentStock += item.Quantity;
                whInv.LastRestockedAt = DateTime.UtcNow;
            }

            _context.WarehouseInventoryTransactions.Add(new WarehouseInventoryTransaction
            {
                WarehouseId = request.WarehouseId,
                IngredientId = item.IngredientId,
                QuantityChange = item.Quantity,
                BalanceAfter = whInv.CurrentStock,
                TransactionType = WarehouseTransactionType.SupplierInbound,
                ReferenceNumber = request.ReferenceNumber,
                Note = $"Nhập kho NCC {request.SupplierCode} ({request.ReferenceNumber}): {request.Notes}"
            });
        }

        await _context.SaveChangesAsync(ct);
        return await GetWarehouseInventoryAsync(request.WarehouseId, ct);
    }

    public async Task<AutoReorderSuggestionResponse> GetAutoReorderSuggestionsAsync(
        Guid storeId,
        int planningDays = 7,
        int leadTimeDays = 2,
        CancellationToken ct = default)
    {
        if (planningDays <= 0) planningDays = 7;
        if (leadTimeDays < 0) leadTimeDays = 2;

        var store = await _context.Stores
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == storeId, ct)
            ?? throw new NotFoundException("STORE_NOT_FOUND", $"Không tìm thấy chi nhánh với ID '{storeId}'.");

        // Chọn Kho phân phối mặc định (hoặc kho đầu tiên có sẵn)
        var defaultWarehouse = await _context.Warehouses
            .AsNoTracking()
            .FirstOrDefaultAsync(ct)
            ?? new Warehouse { Id = Guid.NewGuid(), Name = "Kho Tổng Trung Tâm (HQ Central Hub)" };

        // 1. Lấy tồn kho hiện tại của chi nhánh
        var storeInventories = await _context.StoreInventories
            .AsNoTracking()
            .Include(si => si.Ingredient)
            .Where(si => si.StoreId == storeId)
            .ToListAsync(ct);

        // 2. Tính mức tiêu hao trong 14 ngày gần nhất để tính trung bình ngày
        var lookbackDays = 14;
        var lookbackDate = DateTime.UtcNow.AddDays(-lookbackDays);

        var outboundUsageByIngredient = await _context.InventoryTransactions
            .AsNoTracking()
            .Where(t => t.StoreId == storeId 
                     && t.CreatedAt >= lookbackDate
                     && (t.TransactionType == InventoryTransactionType.Outbound_Sale || t.TransactionType == InventoryTransactionType.Waste_Spoiled))
            .GroupBy(t => t.IngredientId)
            .Select(g => new
            {
                IngredientId = g.Key,
                TotalUsed = -g.Sum(t => t.QuantityChange) // QuantityChange lưu dấu âm (-) nên đổi thành dương (+)
            })
            .ToDictionaryAsync(g => g.IngredientId, g => g.TotalUsed, ct);

        var suggestions = new List<AutoReorderSuggestionItemDto>();
        decimal totalEstimatedCost = 0m;

        foreach (var inv in storeInventories)
        {
            if (inv.Ingredient == null) continue;

            outboundUsageByIngredient.TryGetValue(inv.IngredientId, out var totalHistoricalUsage);
            
            // Tiêu hao trung bình hàng ngày (Daily Run-rate)
            var avgDaily = totalHistoricalUsage > 0 
                ? Math.Round(totalHistoricalUsage / lookbackDays, 2)
                : 0m;

            // Nhu cầu dự trù cho chu kỳ: (Số ngày vận chuyển + Số ngày dự trữ an toàn) * Mức tiêu hao/ngày
            var totalCycleDays = planningDays + leadTimeDays;
            var targetBufferStock = Math.Max(inv.MinAlertThreshold, avgDaily * totalCycleDays);

            // Thiếu hụt cần đặt: Mục tiêu - Tồn hiện tại
            var neededQuantity = targetBufferStock - inv.CurrentStock;

            string priority = "Normal";
            string reason = "Tồn kho an toàn";

            if (inv.CurrentStock <= 0)
            {
                priority = "Critical";
                reason = "ĐÃ HẾT HÀNG TRONG KHO! Nguy cơ đứt gãy pha chế.";
                if (neededQuantity <= 0) neededQuantity = Math.Max(inv.MinAlertThreshold * 2, 10);
            }
            else if (inv.CurrentStock <= inv.MinAlertThreshold)
            {
                priority = "Warning";
                var daysRemaining = avgDaily > 0 ? Math.Round(inv.CurrentStock / avgDaily, 1) : 0;
                reason = daysRemaining > 0 
                    ? $"Dưới ngưỡng cảnh báo! Dự kiến cạn kiệt trong {daysRemaining} ngày."
                    : "Dưới ngưỡng tối thiểu quy định.";
            }
            else if (neededQuantity > 0 && avgDaily > 0)
            {
                var daysRemaining = Math.Round(inv.CurrentStock / avgDaily, 1);
                if (daysRemaining <= totalCycleDays)
                {
                    priority = "Warning";
                    reason = $"Lượng tồn chỉ đủ dùng {daysRemaining} ngày tới.";
                }
            }

            var recommendedOrderQty = neededQuantity > 0 ? Math.Ceiling(neededQuantity) : 0m;

            if (recommendedOrderQty > 0 || priority != "Normal")
            {
                var itemCost = recommendedOrderQty * inv.Ingredient.StandardCost;
                totalEstimatedCost += itemCost;

                suggestions.Add(new AutoReorderSuggestionItemDto(
                    inv.IngredientId,
                    inv.Ingredient.Code,
                    inv.Ingredient.Name,
                    inv.Ingredient.Unit,
                    inv.CurrentStock,
                    inv.MinAlertThreshold,
                    avgDaily,
                    recommendedOrderQty,
                    inv.Ingredient.StandardCost,
                    itemCost,
                    priority,
                    reason
                ));
            }
        }

        // Sắp xếp: Ưu tiên Critical -> Warning -> Normal
        var orderedSuggestions = suggestions
            .OrderBy(s => s.Priority == "Critical" ? 0 : s.Priority == "Warning" ? 1 : 2)
            .ThenByDescending(s => s.RecommendedOrderQuantity)
            .ToList();

        return new AutoReorderSuggestionResponse(
            store.Id,
            store.Name,
            defaultWarehouse.Id,
            defaultWarehouse.Name,
            leadTimeDays,
            planningDays,
            storeInventories.Count,
            orderedSuggestions.Count,
            totalEstimatedCost,
            orderedSuggestions
        );
    }

    private static StockTransferOrderDto MapToDto(StockTransferOrder order)
    {
        return new StockTransferOrderDto(
            order.Id,
            order.TransferCode,
            order.SourceWarehouseId,
            order.SourceWarehouse?.Name ?? string.Empty,
            order.DestinationStoreId,
            order.DestinationStore?.Name ?? string.Empty,
            order.DestinationStore?.Code ?? string.Empty,
            order.Status.ToString(),
            order.DispatchTrackingNumber,
            order.DispatchedAt,
            order.ReceivedAt,
            order.CreatedAt,
            order.CreatedByUserId,
            order.ApprovedByUserId,
            order.Notes,
            order.RejectionReason,
            order.DiscrepancyNotes,
            order.Items.Select(i => new StockTransferItemDto(
                i.Id,
                i.IngredientId,
                i.Ingredient?.Code ?? string.Empty,
                i.Ingredient?.Name ?? string.Empty,
                i.Ingredient?.Unit ?? string.Empty,
                i.RequestedQuantity,
                i.ApprovedQuantity,
                i.ActualReceivedQuantity,
                i.DiscrepancyQuantity,
                i.UnitCost,
                i.Notes
            )).ToList()
        );
    }
}
