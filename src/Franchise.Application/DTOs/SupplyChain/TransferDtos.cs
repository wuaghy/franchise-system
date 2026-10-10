namespace Franchise.Application.DTOs.SupplyChain;

public record StockTransferItemDto(
    Guid Id,
    Guid IngredientId,
    string IngredientCode,
    string IngredientName,
    string Unit,
    decimal RequestedQuantity,
    decimal ApprovedQuantity,
    decimal ActualReceivedQuantity,
    decimal DiscrepancyQuantity,
    decimal UnitCost,
    string? Notes
);

public record StockTransferOrderDto(
    Guid Id,
    string TransferCode,
    Guid SourceWarehouseId,
    string SourceWarehouseName,
    Guid DestinationStoreId,
    string DestinationStoreName,
    string DestinationStoreCode,
    string Status,
    string? DispatchTrackingNumber,
    DateTime? DispatchedAt,
    DateTime? ReceivedAt,
    DateTime CreatedAt,
    Guid CreatedByUserId,
    Guid? ApprovedByUserId,
    string? Notes,
    string? RejectionReason,
    string? DiscrepancyNotes,
    List<StockTransferItemDto> Items
);

public record CreateTransferItemRequest(
    Guid IngredientId,
    decimal RequestedQuantity,
    string? Notes = null
);

public record CreateTransferOrderRequest(
    Guid SourceWarehouseId,
    Guid DestinationStoreId,
    string? Notes,
    List<CreateTransferItemRequest> Items
);

public record UpdateTransferOrderRequest(
    string? Notes,
    List<CreateTransferItemRequest> Items
);

public record ApproveTransferItemDto(
    Guid IngredientId,
    decimal ApprovedQuantity
);

public record ApproveTransferOrderRequest(
    List<ApproveTransferItemDto> ApprovedItems,
    string? Notes = null
);

public record RejectTransferOrderRequest(
    string Reason
);

public record DispatchTransferOrderRequest(
    string DispatchTrackingNumber,
    string? Notes = null
);

public record ReceiveTransferItemDto(
    Guid IngredientId,
    decimal ActualReceivedQuantity,
    string? Notes = null
);

public record ReceiveTransferOrderRequest(
    List<ReceiveTransferItemDto> ReceivedItems,
    string? InspectionNotes = null
);

public record ResolveDiscrepancyRequest(
    string ResolutionNotes
);

public record TransferOrderFilterDto(
    Guid? StoreId = null,
    Guid? WarehouseId = null,
    string? Status = null,
    string? SearchTerm = null,
    DateTime? FromDate = null,
    DateTime? ToDate = null
);

// DTOs cho Tự Động Đề Xuất Đặt Hàng & Dự Trù Tồn Kho (Auto-Reorder & PO Suggestions)
public record AutoReorderSuggestionItemDto(
    Guid IngredientId,
    string IngredientCode,
    string IngredientName,
    string Unit,
    decimal CurrentStock,
    decimal MinAlertThreshold,
    decimal AverageDailyConsumption, // Tiêu hao trung bình hàng ngày (dựa trên 7-30 ngày qua)
    decimal RecommendedOrderQuantity, // Lượng đề xuất đặt hàng
    decimal StandardCost,
    decimal EstimatedTotalCost,
    string Priority, // "Critical", "Warning", "Normal"
    string ReorderReason
);

public record AutoReorderSuggestionResponse(
    Guid StoreId,
    string StoreName,
    Guid RecommendedWarehouseId,
    string RecommendedWarehouseName,
    int LeadTimeDays, // Số ngày dự kiến vận chuyển & giao hàng (mặc định 2-3 ngày)
    int PlanningHorizonDays, // Số ngày dự trù an toàn (mặc định 7 ngày)
    int TotalItemsEvaluated,
    int ItemsNeedingReorderCount,
    decimal TotalEstimatedCost,
    List<AutoReorderSuggestionItemDto> Suggestions
);

public record CreatePoFromSuggestionRequest(
    Guid StoreId,
    Guid WarehouseId,
    string? Notes,
    List<CreateTransferItemRequest> SelectedItems
);
