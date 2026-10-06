using Franchise.Domain.Enums;

namespace Franchise.Application.DTOs.Pos;

public class OfflineOrderItemModifierSyncDto
{
    public string Name { get; set; } = string.Empty;
    public decimal ExtraPrice { get; set; }
    public Guid? IngredientId { get; set; }
    public decimal ConsumptionQuantity { get; set; }
}

public class OfflineOrderItemSyncDto
{
    public Guid ProductId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public string? SpecialNote { get; set; }
    public List<OfflineOrderItemModifierSyncDto>? Modifiers { get; set; }
}

public class OfflineOrderSyncItem
{
    public string OfflineOrderId { get; set; } = string.Empty;
    public string IdempotencyKey { get; set; } = string.Empty;
    public Guid StoreId { get; set; }
    public Guid? CashierId { get; set; }
    public Guid? CustomerId { get; set; }
    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.Cash;
    public OrderType OrderType { get; set; } = OrderType.DineIn;
    public decimal Subtotal { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal VatAmount { get; set; }
    public decimal FinalAmount { get; set; }
    public DateTime OfflineCreatedAt { get; set; }
    public List<OfflineOrderItemSyncDto> Items { get; set; } = new();
}

public class BulkSyncOfflineOrdersRequest
{
    public Guid StoreId { get; set; }
    public string DeviceIdentifier { get; set; } = string.Empty;
    public List<OfflineOrderSyncItem> Orders { get; set; } = new();
}

public class OfflineOrderSyncResult
{
    public string OfflineOrderId { get; set; } = string.Empty;
    public string IdempotencyKey { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty; // "Synced", "DuplicateSkipped", "Failed"
    public Guid? ServerOrderId { get; set; }
    public string? OrderNumber { get; set; }
    public string? Message { get; set; }
}

public class BulkSyncOfflineOrdersResponse
{
    public int TotalProcessed { get; set; }
    public int SuccessfulCount { get; set; }
    public int DuplicateSkippedCount { get; set; }
    public int FailedCount { get; set; }
    public List<OfflineOrderSyncResult> Results { get; set; } = new();
}
