namespace Franchise.Application.DTOs.Kds;

public record KitchenTicketItemModifierDto(
    Guid Id,
    string ModifierName,
    bool IsChecked
);

public record KitchenTicketItemDto(
    Guid Id,
    Guid OrderItemId,
    string ProductName,
    int Quantity,
    string SpecialNote,
    bool IsPrepared,
    List<KitchenTicketItemModifierDto> Modifiers
);

public record KitchenTicketDto(
    Guid Id,
    string TicketNumber,
    Guid OrderId,
    Guid StoreId,
    string OrderNumber,
    string OrderType,
    string Status,
    int TargetPreparationSeconds,
    DateTime CreatedAt,
    DateTime? PreparationStartedAt,
    DateTime? ReadyAt,
    DateTime? CompletedAt,
    Guid? BaristaUserId,
    string? CancellationReason,
    int ElapsedSeconds,
    string SlaStatus, // Healthy, Warning, Critical
    List<KitchenTicketItemDto> Items
);

public record KitchenTicketStatusChangedNotification(
    Guid TicketId,
    Guid StoreId,
    string TicketNumber,
    string Status,
    DateTime Timestamp
);

public record KitchenTicketItemToggledNotification(
    Guid TicketId,
    Guid StoreId,
    Guid ItemId,
    bool IsPrepared
);

public record CancelKitchenTicketRequest(
    string Reason
);
