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
