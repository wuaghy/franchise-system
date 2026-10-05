namespace Franchise.Application.DTOs.Realtime;

public record OrderCompletedNotification(
    Guid OrderId,
    string OrderNumber,
    Guid StoreId,
    decimal FinalAmount,
    DateTime CompletedAt
);

public record InventoryUpdatedNotification(
    Guid StoreId,
    Guid IngredientId,
    string IngredientName,
    decimal QuantityDeducted,
    decimal BalanceAfter
);

public record LowStockAlertNotification(
    Guid StoreId,
    Guid IngredientId,
    string IngredientCode,
    string IngredientName,
    string Unit,
    decimal CurrentStock,
    decimal MinAlertThreshold,
    decimal Shortage,
    DateTime TriggeredAt
);
