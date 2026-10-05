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
}
