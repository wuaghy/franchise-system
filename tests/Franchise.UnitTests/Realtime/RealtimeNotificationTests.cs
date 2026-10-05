using System.Text.Json;
using FluentAssertions;
using Franchise.Api.Hubs;
using Franchise.Api.Services;
using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Orders;
using Franchise.Application.DTOs.Realtime;
using Franchise.Domain.Entities;
using Franchise.Infrastructure.BackgroundJobs;
using Franchise.Infrastructure.Data;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;

namespace Franchise.UnitTests.Realtime;

public class RealtimeNotificationTests
{
    private readonly Mock<IHubContext<FranchiseHub, IFranchiseHubClient>> _mockHubContext;
    private readonly Mock<IHubClients<IFranchiseHubClient>> _mockClients;
    private readonly Mock<IFranchiseHubClient> _mockClientProxy;
    private readonly Mock<ILogger<RealtimeNotificationService>> _mockLogger;
    private readonly RealtimeNotificationService _service;

    public RealtimeNotificationTests()
    {
        _mockHubContext = new Mock<IHubContext<FranchiseHub, IFranchiseHubClient>>();
        _mockClients = new Mock<IHubClients<IFranchiseHubClient>>();
        _mockClientProxy = new Mock<IFranchiseHubClient>();
        _mockLogger = new Mock<ILogger<RealtimeNotificationService>>();

        _mockHubContext.Setup(h => h.Clients).Returns(_mockClients.Object);
        _mockClients
            .Setup(c => c.Groups(It.IsAny<IReadOnlyList<string>>()))
            .Returns(_mockClientProxy.Object);

        _service = new RealtimeNotificationService(_mockHubContext.Object, _mockLogger.Object);
    }

    [Fact]
    public async Task NotifyOrderCompleted_ShouldSendToStoreAndHqGroups()
    {
        // Arrange
        var storeId = Guid.NewGuid();
        var notification = new OrderCompletedNotification(
            Guid.NewGuid(),
            "ORD-20261005-001",
            storeId,
            150000m,
            DateTime.UtcNow
        );

        // Act
        await _service.NotifyOrderCompletedAsync(notification);

        // Assert
        _mockClients.Verify(
            c => c.Groups(It.Is<IReadOnlyList<string>>(g => g.Contains($"store_{storeId}") && g.Contains("hq_admin"))),
            Times.Once);

        _mockClientProxy.Verify(
            p => p.ReceiveOrderCompleted(It.Is<OrderCompletedNotification>(n => n.OrderNumber == "ORD-20261005-001")),
            Times.Once);
    }

    [Fact]
    public async Task NotifyInventoryUpdated_ShouldSendUpdatesToStoreAndHq()
    {
        // Arrange
        var storeId = Guid.NewGuid();
        var updates = new List<InventoryUpdatedNotification>
        {
            new(storeId, Guid.NewGuid(), "Arabica Coffee", 20m, 1400m),
            new(storeId, Guid.NewGuid(), "Fresh Milk", 200m, 1800m)
        };

        // Act
        await _service.NotifyInventoryUpdatedAsync(storeId, updates);

        // Assert
        _mockClients.Verify(
            c => c.Groups(It.Is<IReadOnlyList<string>>(g => g.Contains($"store_{storeId}") && g.Contains("hq_admin"))),
            Times.Once);

        _mockClientProxy.Verify(
            p => p.ReceiveInventoryUpdated(It.Is<IReadOnlyList<InventoryUpdatedNotification>>(u => u.Count == 2)),
            Times.Once);
    }

    [Fact]
    public async Task NotifyLowStockAlert_ShouldSendAlertToStoreAndHq()
    {
        // Arrange
        var storeId = Guid.NewGuid();
        var alert = new LowStockAlertNotification(
            storeId,
            Guid.NewGuid(),
            "PEARL-01",
            "Black Tapioca Pearl",
            "gram",
            10m,
            50m,
            40m,
            DateTime.UtcNow
        );

        // Act
        await _service.NotifyLowStockAlertAsync(alert);

        // Assert
        _mockClients.Verify(
            c => c.Groups(It.Is<IReadOnlyList<string>>(g => g.Contains($"store_{storeId}") && g.Contains("hq_admin"))),
            Times.Once);

        _mockClientProxy.Verify(
            p => p.ReceiveLowStockAlert(It.Is<LowStockAlertNotification>(a => a.IngredientCode == "PEARL-01" && a.Shortage == 40m)),
            Times.Once);
    }

    [Fact]
    public async Task OutboxProcessor_ShouldPublishSignalRNotification_WhenOrderCompletedEventExists()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var mockNotificationService = new Mock<IRealtimeNotificationService>();

        var services = new ServiceCollection();
        services.AddDbContext<AppDbContext>(opt => opt.UseInMemoryDatabase(dbName));
        services.AddScoped(_ => mockNotificationService.Object);
        var serviceProvider = services.BuildServiceProvider();

        var storeId = Guid.NewGuid();
        var orderId = Guid.NewGuid();
        var orderEvent = new OrderCompletedDomainEvent(orderId, "ORD-20261005-999", storeId, 88000m, DateTime.UtcNow);

        using (var initScope = serviceProvider.CreateScope())
        {
            var initDbContext = initScope.ServiceProvider.GetRequiredService<AppDbContext>();
            initDbContext.OutboxMessages.Add(new OutboxMessage
            {
                Id = Guid.NewGuid(),
                EventType = nameof(OrderCompletedDomainEvent),
                AggregateType = "Order",
                AggregateId = orderId.ToString(),
                Payload = JsonSerializer.Serialize(orderEvent),
                CreatedAt = DateTime.UtcNow
            });
            await initDbContext.SaveChangesAsync();
        }

        var scopeFactory = serviceProvider.GetRequiredService<IServiceScopeFactory>();

        var processor = new OutboxProcessorBackgroundService(
            scopeFactory,
            Mock.Of<ILogger<OutboxProcessorBackgroundService>>()
        );

        // Act: Chạy 1 chu kỳ xử lý bằng CancellationTokenSource hủy sau 200ms
        using var cts = new CancellationTokenSource(TimeSpan.FromMilliseconds(200));
        await processor.StartAsync(cts.Token);
        await Task.Delay(100);
        await processor.StopAsync(CancellationToken.None);

        // Assert
        mockNotificationService.Verify(
            n => n.NotifyOrderCompletedAsync(
                It.Is<OrderCompletedNotification>(notif => notif.OrderNumber == "ORD-20261005-999" && notif.FinalAmount == 88000m),
                It.IsAny<CancellationToken>()),
            Times.Once);

        using (var verifyScope = serviceProvider.CreateScope())
        {
            var verifyDbContext = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
            var processedMessage = await verifyDbContext.OutboxMessages.FirstAsync();
            processedMessage.ProcessedAt.Should().NotBeNull();
            processedMessage.Error.Should().BeNull();
        }
    }
}
