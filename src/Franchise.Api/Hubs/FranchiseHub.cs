using Microsoft.AspNetCore.SignalR;
using Franchise.Application.Common.Interfaces;
using Franchise.Domain.Entities;
using Microsoft.Extensions.Configuration;

namespace Franchise.Api.Hubs;

public class FranchiseHub : Hub<IFranchiseHubClient>
{
    private readonly ILogger<FranchiseHub> _logger;
    private readonly IAuthService _authService;
    private readonly IConfiguration _configuration;

    public FranchiseHub(
        ILogger<FranchiseHub> logger,
        IAuthService authService,
        IConfiguration configuration)
    {
        _logger = logger;
        _authService = authService;
        _configuration = configuration;
    }

    public override async Task OnConnectedAsync()
    {
        var token = Context.Headers["Authorization"].FirstOrDefault();
        if (string.IsNullOrEmpty(token))
            throw new UnauthorizedException("Missing Authorization Token");

        var isValid = _authService.ValidateToken(token, out var user);
        if (!isValid)
            throw new UnauthorizedException("Invalid Authorization Token");

        await Groups.AddToGroupAsync(Context.ConnectionId, user.StoreId?.ToString() ?? "hq");
        await Groups.AddToGroupAsync(Context.ConnectionId, "all");
        await base.OnConnectedAsync();
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
