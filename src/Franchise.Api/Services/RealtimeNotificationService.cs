using Franchise.Api.Hubs;
using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Realtime;
using Microsoft.AspNetCore.SignalR;

namespace Franchise.Api.Services;

public class RealtimeNotificationService : IRealtimeNotificationService
{
    private readonly IHubContext<FranchiseHub, IFranchiseHubClient> _hubContext;
    private readonly ILogger<RealtimeNotificationService> _logger;

    public RealtimeNotificationService(
        IHubContext<FranchiseHub, IFranchiseHubClient> hubContext,
        ILogger<RealtimeNotificationService> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task NotifyOrderCompletedAsync(OrderCompletedNotification notification, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("SignalR Broadcasting: OrderCompleted #{OrderNumber} Store {StoreId}", notification.OrderNumber, notification.StoreId);
        
        var storeGroup = $"store_{notification.StoreId}";
        await _hubContext.Clients.Groups(storeGroup, "hq_admin").ReceiveOrderCompleted(notification);
    }

    public async Task NotifyInventoryUpdatedAsync(Guid storeId, IReadOnlyList<InventoryUpdatedNotification> updates, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("SignalR Broadcasting: InventoryUpdated cho Store {StoreId} với {Count} nguyên liệu", storeId, updates.Count);
        
        var storeGroup = $"store_{storeId}";
        await _hubContext.Clients.Groups(storeGroup, "hq_admin").ReceiveInventoryUpdated(updates);
    }

    public async Task NotifyLowStockAlertAsync(LowStockAlertNotification alert, CancellationToken cancellationToken = default)
    {
        _logger.LogWarning("SignalR Broadcasting: LowStockAlert cho Store {StoreId}, Nguyên liệu {Code} (Tồn: {Current}, Ngưỡng: {Min})",
            alert.StoreId, alert.IngredientCode, alert.CurrentStock, alert.MinAlertThreshold);
        
        var storeGroup = $"store_{alert.StoreId}";
        await _hubContext.Clients.Groups(storeGroup, "hq_admin").ReceiveLowStockAlert(alert);
    }

    public async Task NotifyPaymentConfirmedAsync(Franchise.Application.DTOs.Payments.PaymentConfirmedNotification notification, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("SignalR Broadcasting: PaymentConfirmed Đơn #{OrderNumber} ({Amount:N0} đ) qua {Gateway}",
            notification.OrderNumber, notification.Amount, notification.Gateway);

        if (notification.StoreId.HasValue)
        {
            var storeGroup = $"store_{notification.StoreId.Value}";
            await _hubContext.Clients.Groups(storeGroup, "hq_admin").ReceivePaymentConfirmed(notification);
        }
        else
        {
            await _hubContext.Clients.All.ReceivePaymentConfirmed(notification);
        }
    }

    public async Task NotifyKitchenTicketCreatedAsync(Guid storeId, Franchise.Application.DTOs.Kds.KitchenTicketDto ticket, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("SignalR Broadcasting: KitchenTicketCreated #{TicketNumber} cho Store {StoreId}", ticket.TicketNumber, storeId);
        var storeGroup = $"store_{storeId}";
        await _hubContext.Clients.Groups(storeGroup, "hq_admin").ReceiveKitchenTicketCreated(ticket);
    }

    public async Task NotifyKitchenTicketStatusChangedAsync(Guid storeId, Franchise.Application.DTOs.Kds.KitchenTicketStatusChangedNotification notification, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("SignalR Broadcasting: KitchenTicketStatusChanged #{TicketNumber} -> {Status} Store {StoreId}", notification.TicketNumber, notification.Status, storeId);
        var storeGroup = $"store_{storeId}";
        await _hubContext.Clients.Groups(storeGroup, "hq_admin").ReceiveKitchenTicketStatusChanged(notification);
    }

    public async Task NotifyKitchenTicketItemToggledAsync(Guid storeId, Franchise.Application.DTOs.Kds.KitchenTicketItemToggledNotification notification, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("SignalR Broadcasting: KitchenTicketItemToggled Item {ItemId} Store {StoreId}", notification.ItemId, storeId);
        var storeGroup = $"store_{storeId}";
        await _hubContext.Clients.Groups(storeGroup, "hq_admin").ReceiveKitchenTicketItemToggled(notification);
    }
}
