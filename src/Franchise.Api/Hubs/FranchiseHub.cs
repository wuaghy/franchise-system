using Microsoft.AspNetCore.SignalR;

namespace Franchise.Api.Hubs;

public class FranchiseHub : Hub<IFranchiseHubClient>
{
    private readonly ILogger<FranchiseHub> _logger;

    public FranchiseHub(ILogger<FranchiseHub> logger)
    {
        _logger = logger;
    }

    public async Task JoinStoreGroup(string storeId)
    {
        var groupName = $"store_{storeId}";
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        _logger.LogInformation("Connection {ConnectionId} đã tham gia nhóm {GroupName}", Context.ConnectionId, groupName);
    }

    public async Task LeaveStoreGroup(string storeId)
    {
        var groupName = $"store_{storeId}";
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        _logger.LogInformation("Connection {ConnectionId} đã rời nhóm {GroupName}", Context.ConnectionId, groupName);
    }

    public async Task JoinHQGroup()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, "hq_admin");
        _logger.LogInformation("Connection {ConnectionId} đã tham gia nhóm HQ Admin", Context.ConnectionId);
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("Client SignalR đã kết nối: {ConnectionId}", Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("Client SignalR đã ngắt kết nối: {ConnectionId}", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
