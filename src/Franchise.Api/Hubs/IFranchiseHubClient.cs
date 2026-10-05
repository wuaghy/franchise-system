using Franchise.Application.DTOs.Realtime;

namespace Franchise.Api.Hubs;

public interface IFranchiseHubClient
{
    Task ReceiveOrderCompleted(OrderCompletedNotification notification);
    Task ReceiveInventoryUpdated(IReadOnlyList<InventoryUpdatedNotification> updates);
    Task ReceiveLowStockAlert(LowStockAlertNotification alert);
}
using Franchise.Application.DTOs.Realtime;

namespace Franchise.Api.Hubs
{
    public interface IFranchiseHubClient
    {
        Task SendOrderCompleted(OrderCompletedNotification notification);
        Task SendInventoryUpdated(IReadOnlyList<InventoryUpdatedNotification> updates);
        Task SendLowStockAlert(LowStockAlertNotification alert);
    }
}
