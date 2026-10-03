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
);

// Nhập kho
public record InboundStockRequest(
    Guid StoreId,
    Guid IngredientId,
    decimal Quantity,
    string? Note = null
);
