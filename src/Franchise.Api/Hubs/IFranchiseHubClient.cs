using Franchise.Application.DTOs.Realtime;

namespace Franchise.Api.Hubs;

public interface IFranchiseHubClient
{
    Task ReceiveOrderCompleted(OrderCompletedNotification notification);
    Task ReceiveInventoryUpdated(IReadOnlyList<InventoryUpdatedNotification> updates);
    Task ReceiveLowStockAlert(LowStockAlertNotification alert);
}
