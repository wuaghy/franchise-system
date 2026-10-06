using FluentAssertions;
using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Kds;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Franchise.Domain.Exceptions;
using Franchise.Infrastructure.Data;
using Franchise.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace Franchise.UnitTests.Services;

public class KitchenDisplayServiceTests
{
    private AppDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private async Task<(Store store, Order order)> SeedOrderAsync(AppDbContext context)
    {
        var store = new Store
        {
            Id = Guid.NewGuid(),
            Code = "HL-01",
            Name = "Highlands Lê Lợi Q1",
            Address = "123 Lê Lợi, Q1",
            IsActive = true
        };
        context.Stores.Add(store);

        var product = new Product
        {
            Id = Guid.NewGuid(),
            Sku = "CF-PHIN-01",
            Name = "Phin Sữa Đá",
            BasePrice = 29000,
            IsAvailable = true
        };
        context.Products.Add(product);

        var order = new Order
        {
            Id = Guid.NewGuid(),
            OrderNumber = "ORD-202610-0042",
            StoreId = store.Id,
            OrderType = OrderType.DineIn,
            Status = OrderStatus.Paid,
            Subtotal = 39000,
            FinalAmount = 39000
        };

        var orderItem = new OrderItem
        {
            Id = Guid.NewGuid(),
            OrderId = order.Id,
            ProductId = product.Id,
            Product = product,
            Quantity = 1,
            UnitPrice = 29000,
            TotalPrice = 39000,
            SpecialNote = "Nhiều sữa đặc"
        };
        orderItem.Modifiers.Add(new OrderItemModifier
        {
            Id = Guid.NewGuid(),
            OrderItemId = orderItem.Id,
            Name = "Thêm Trân Châu Trắng",
            ExtraPrice = 10000
        });

        order.OrderItems.Add(orderItem);
        context.Orders.Add(order);
        await context.SaveChangesAsync();

        return (store, order);
    }

    [Fact]
    public async Task CreateTicketFromOrder_WhenValidOrder_ShouldCreateNewTicketAndBroadcast()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var (store, order) = await SeedOrderAsync(context);
        var mockNotification = new Mock<IRealtimeNotificationService>();
        var service = new KitchenDisplayService(context, mockNotification.Object);

        // Act
        var result = await service.CreateTicketFromOrderAsync(order.Id);

        // Assert
        result.Should().NotBeNull();
        result.TicketNumber.Should().StartWith("KDS-");
        result.Status.Should().Be("New");
        result.StoreId.Should().Be(store.Id);
        result.Items.Should().HaveCount(1);
        result.Items[0].ProductName.Should().Be("Phin Sữa Đá");
        result.Items[0].SpecialNote.Should().Be("Nhiều sữa đặc");
        result.Items[0].Modifiers.Should().HaveCount(1);
        result.Items[0].Modifiers[0].ModifierName.Should().Be("Thêm Trân Châu Trắng");

        // Verify SignalR broadcast
        mockNotification.Verify(n => n.NotifyKitchenTicketCreatedAsync(
            store.Id,
            It.Is<KitchenTicketDto>(t => t.Id == result.Id),
            It.IsAny<CancellationToken>()
        ), Times.Once);
    }

    [Fact]
    public async Task StartPreparation_WhenTicketIsNew_ShouldSetInPreparationAndTimer()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var (store, order) = await SeedOrderAsync(context);
        var mockNotification = new Mock<IRealtimeNotificationService>();
        var service = new KitchenDisplayService(context, mockNotification.Object);

        var ticketDto = await service.CreateTicketFromOrderAsync(order.Id);
        var baristaId = Guid.NewGuid();

        // Act
        var updated = await service.StartPreparationAsync(ticketDto.Id, baristaId);

        // Assert
        updated.Status.Should().Be("InPreparation");
        updated.BaristaUserId.Should().Be(baristaId);
        updated.PreparationStartedAt.Should().NotBeNull();

        mockNotification.Verify(n => n.NotifyKitchenTicketStatusChangedAsync(
            store.Id,
            It.Is<KitchenTicketStatusChangedNotification>(n => n.TicketId == ticketDto.Id && n.Status == "InPreparation"),
            It.IsAny<CancellationToken>()
        ), Times.Once);
    }

    [Fact]
    public async Task ToggleItemPrepared_ShouldToggleStatusAndBroadcast()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var (store, order) = await SeedOrderAsync(context);
        var mockNotification = new Mock<IRealtimeNotificationService>();
        var service = new KitchenDisplayService(context, mockNotification.Object);

        var ticketDto = await service.CreateTicketFromOrderAsync(order.Id);
        var itemId = ticketDto.Items[0].Id;

        // Act
        var updated = await service.ToggleItemPreparedAsync(ticketDto.Id, itemId);

        // Assert
        updated.Items.First(i => i.Id == itemId).IsPrepared.Should().BeTrue();

        mockNotification.Verify(n => n.NotifyKitchenTicketItemToggledAsync(
            store.Id,
            It.Is<KitchenTicketItemToggledNotification>(n => n.TicketId == ticketDto.Id && n.ItemId == itemId && n.IsPrepared),
            It.IsAny<CancellationToken>()
        ), Times.Once);
    }

    [Fact]
    public async Task ToggleModifierChecked_ShouldToggleModifierState()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var (_, order) = await SeedOrderAsync(context);
        var service = new KitchenDisplayService(context);

        var ticketDto = await service.CreateTicketFromOrderAsync(order.Id);
        var modId = ticketDto.Items[0].Modifiers[0].Id;

        // Act
        var updated = await service.ToggleModifierCheckedAsync(ticketDto.Id, modId);

        // Assert
        updated.Items[0].Modifiers[0].IsChecked.Should().BeTrue();
    }

    [Fact]
    public async Task MarkTicketReady_WhenInPreparation_ShouldTransitionToReady()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var (_, order) = await SeedOrderAsync(context);
        var service = new KitchenDisplayService(context);

        var ticketDto = await service.CreateTicketFromOrderAsync(order.Id);
        await service.StartPreparationAsync(ticketDto.Id);

        // Act
        var readyTicket = await service.MarkTicketReadyAsync(ticketDto.Id);

        // Assert
        readyTicket.Status.Should().Be("Ready");
        readyTicket.ReadyAt.Should().NotBeNull();
    }

    [Fact]
    public async Task CompleteTicket_WhenReady_ShouldTransitionToCompleted()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var (store, order) = await SeedOrderAsync(context);
        var service = new KitchenDisplayService(context);

        var ticketDto = await service.CreateTicketFromOrderAsync(order.Id);
        await service.StartPreparationAsync(ticketDto.Id);
        await service.MarkTicketReadyAsync(ticketDto.Id);

        // Act
        var completed = await service.CompleteTicketAsync(ticketDto.Id);

        // Assert
        completed.Status.Should().Be("Completed");
        completed.CompletedAt.Should().NotBeNull();

        // Active tickets should no longer return completed tickets
        var activeTickets = await service.GetActiveTicketsAsync(store.Id);
        activeTickets.Should().NotContain(t => t.Id == ticketDto.Id);
    }

    [Fact]
    public async Task CancelTicket_WhenValidReason_ShouldTransitionToCancelled()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var (_, order) = await SeedOrderAsync(context);
        var service = new KitchenDisplayService(context);

        var ticketDto = await service.CreateTicketFromOrderAsync(order.Id);

        // Act
        var cancelled = await service.CancelTicketAsync(ticketDto.Id, "Khách đổi sang mang đi và đặt món khác");

        // Assert
        cancelled.Status.Should().Be("Cancelled");
        cancelled.CancellationReason.Should().Be("Khách đổi sang mang đi và đặt món khác");
    }
}
