using Franchise.Application.DTOs.Kds;
using Franchise.Application.DTOs.Payments;
using Franchise.Application.DTOs.Realtime;

namespace Franchise.Api.Hubs;

public interface IFranchiseHubClient
{
    Task ReceiveOrderCompleted(OrderCompletedNotification notification);
    Task ReceiveInventoryUpdated(IReadOnlyList<InventoryUpdatedNotification> updates);
    Task ReceiveLowStockAlert(LowStockAlertNotification alert);
    Task ReceivePaymentConfirmed(PaymentConfirmedNotification notification);

    // KDS client events
    Task ReceiveKitchenTicketCreated(KitchenTicketDto ticket);
    Task ReceiveKitchenTicketStatusChanged(KitchenTicketStatusChangedNotification notification);
    Task ReceiveKitchenTicketItemToggled(KitchenTicketItemToggledNotification notification);
}
