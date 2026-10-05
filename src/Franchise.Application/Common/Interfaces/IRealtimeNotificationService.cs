using Franchise.Application.DTOs.Realtime;

namespace Franchise.Application.Common.Interfaces;

public interface IRealtimeNotificationService
{
    Task NotifyOrderCompletedAsync(OrderCompletedNotification notification, CancellationToken cancellationToken = default);
    Task NotifyInventoryUpdatedAsync(Guid storeId, IReadOnlyList<InventoryUpdatedNotification> updates, CancellationToken cancellationToken = default);
    Task NotifyLowStockAlertAsync(LowStockAlertNotification alert, CancellationToken cancellationToken = default);
}
