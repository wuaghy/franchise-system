using Franchise.Application.DTOs.Kds;
using Franchise.Application.DTOs.Realtime;

namespace Franchise.Application.Common.Interfaces;

public interface IRealtimeNotificationService
{
    Task NotifyOrderCompletedAsync(OrderCompletedNotification notification, CancellationToken cancellationToken = default);
    Task NotifyInventoryUpdatedAsync(Guid storeId, IReadOnlyList<InventoryUpdatedNotification> updates, CancellationToken cancellationToken = default);
    Task NotifyLowStockAlertAsync(LowStockAlertNotification alert, CancellationToken cancellationToken = default);

    // KDS Notifications
    Task NotifyKitchenTicketCreatedAsync(Guid storeId, KitchenTicketDto ticket, CancellationToken cancellationToken = default);
    Task NotifyKitchenTicketStatusChangedAsync(Guid storeId, KitchenTicketStatusChangedNotification notification, CancellationToken cancellationToken = default);
    Task NotifyKitchenTicketItemToggledAsync(Guid storeId, KitchenTicketItemToggledNotification notification, CancellationToken cancellationToken = default);
}
