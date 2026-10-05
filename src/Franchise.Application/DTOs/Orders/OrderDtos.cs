using Franchise.Application.DTOs.Inventory;
using Franchise.Domain.Enums;

namespace Franchise.Application.DTOs.Orders;

public record CheckoutOrderRequest(
    Guid StoreId,
    Guid? CustomerId,
    Guid? CashierId,
    OrderType OrderType,
    PaymentMethod PaymentMethod,
    List<CreateOrderItemRequest> Items
);

public record CreateOrderItemRequest(
    Guid ProductId,
    int Quantity,
    string? SpecialNote = null,
    List<CreateOrderModifierRequest>? Modifiers = null
);

public record CreateOrderModifierRequest(
    string Name,
    decimal ExtraPrice = 0,
    Guid? IngredientId = null,
    decimal ConsumptionQuantity = 0
);

public record CheckoutOrderResponse(
    Guid OrderId,
    string OrderNumber,
    OrderStatus Status,
    decimal Subtotal,
    decimal DiscountAmount,
    decimal VatAmount,
    decimal FinalAmount,
    PaymentStatus PaymentStatus,
    DateTime CreatedAt,
    IReadOnlyList<DeductedIngredientDetail> DeductedIngredients
);

public record OrderCompletedDomainEvent(
    Guid OrderId,
    string OrderNumber,
    Guid StoreId,
    decimal FinalAmount,
    DateTime CompletedAt
);
