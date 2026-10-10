namespace Franchise.Application.DTOs.Inventory;

// Request thanh toán đơn hàng từ máy POS
public record CheckoutOrderInventoryRequest(
    Guid StoreId,
    string OrderCode,
    List<OrderItemInventoryRequest> Items
);

public record OrderItemInventoryRequest(
    Guid ProductId,
    int Quantity,
    List<OrderModifierInventoryRequest>? Modifiers = null
);

public record OrderModifierInventoryRequest(
    string Name,
    Guid? IngredientId,
    decimal ConsumptionQuantity // Định lượng tiêu hao cho mỗi phần topping
);

// Kết quả thực hiện trừ kho
public record InventoryDeductionResult(
    bool IsSuccess,
    string OrderCode,
    IReadOnlyList<DeductedIngredientDetail> DeductedItems,
    string? ErrorMessage = null
);

public record DeductedIngredientDetail(
    Guid IngredientId,
    string IngredientName,
    decimal QuantityDeducted,
    decimal BalanceAfter
);

// Tồn kho chi nhánh
public record StoreInventoryResponse(
    Guid StoreId,
    Guid IngredientId,
    string IngredientCode,
    string IngredientName,
    string Unit,
    decimal CurrentStock,
    decimal MinAlertThreshold,
    DateTime? LastCountedAt
);

// Cảnh báo hết hàng
public record LowStockAlertResponse(
    Guid StoreId,
    Guid IngredientId,
    string IngredientCode,
    string IngredientName,
    string Unit,
    decimal CurrentStock,
    decimal MinAlertThreshold,
    decimal Shortage
)
{
    public decimal Deficit => Shortage;
}

// Nhập kho
public record InboundStockRequest(
    Guid StoreId,
    Guid IngredientId,
    decimal Quantity,
    string? Note = null
);

// Khai báo xuất hủy hao hụt / rơi vỡ / hư hỏng nguyên liệu
public record RecordWasteRequest(
    Guid StoreId,
    Guid IngredientId,
    decimal Quantity,
    string Reason
);

public record RecordWasteResponse(
    Guid StoreId,
    Guid IngredientId,
    string IngredientName,
    decimal QuantityWasted,
    decimal RemainingStock,
    string Reason,
    DateTime RecordedAt
);

// Cấu hình thông báo cảnh báo của chi nhánh
public record UpdateStoreAlertConfigRequest(
    string? ManagerEmail,
    string? TelegramChatId
);

// Yêu cầu phát cảnh báo khẩn cấp
public record BroadcastStockAlertRequest(
    string? CustomTelegramChatId = null,
    string? CustomManagerEmail = null
);

// Kết quả phát cảnh báo
public record AlertBroadcastResultDto(
    Guid StoreId,
    string StoreName,
    int AlertCount,
    List<LowStockAlertResponse> LowStockItems,
    bool TelegramSent,
    string? TelegramStatus,
    bool EmailSent,
    string? EmailStatus,
    DateTime SentAt
);

