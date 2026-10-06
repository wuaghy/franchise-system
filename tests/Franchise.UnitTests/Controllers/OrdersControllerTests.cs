using FluentAssertions;
using Franchise.Api.Controllers;
using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Orders;
using Franchise.Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace Franchise.UnitTests.Controllers;

public class OrdersControllerTests
{
    private readonly Mock<IOrderService> _mockOrderService;
    private readonly Mock<IRealtimeNotificationService> _mockRealtimeNotificationService;
    private readonly OrdersController _controller;

    public OrdersControllerTests()
    {
        _mockOrderService = new Mock<IOrderService>();
        _mockRealtimeNotificationService = new Mock<IRealtimeNotificationService>();
        _controller = new OrdersController(_mockOrderService.Object, _mockRealtimeNotificationService.Object);
    }

    [Fact]
    public async Task Checkout_ShouldReturnOk_WithCheckoutOrderResponse()
    {
        // Arrange
        var request = new CheckoutOrderRequest(
            StoreId: Guid.NewGuid(),
            CustomerId: null,
            CashierId: null,
            OrderType: OrderType.DineIn,
            PaymentMethod: PaymentMethod.Cash,
            Items: new List<CreateOrderItemRequest>
            {
                new CreateOrderItemRequest(Guid.NewGuid(), 1)
            }
        );

        var expectedResponse = new CheckoutOrderResponse(
            OrderId: Guid.NewGuid(),
            OrderNumber: "ORD-20261005-001",
            Status: OrderStatus.Completed,
            Subtotal: 30000m,
            DiscountAmount: 0m,
            VatAmount: 2400m,
            FinalAmount: 32400m,
            PaymentStatus: PaymentStatus.Success,
            CreatedAt: DateTime.UtcNow,
            DeductedIngredients: Array.Empty<Franchise.Application.DTOs.Inventory.DeductedIngredientDetail>()
        );

        _mockOrderService
            .Setup(s => s.CheckoutAsync(request, It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedResponse);

        // Act
        var actionResult = await _controller.Checkout(request, null, CancellationToken.None);

        // Assert
        var okResult = actionResult as OkObjectResult;
        okResult.Should().NotBeNull();
        okResult!.StatusCode.Should().Be(200);
        okResult.Value.Should().BeEquivalentTo(expectedResponse);

        _mockRealtimeNotificationService.Verify(
            s => s.NotifyOrderCompletedAsync(It.Is<Franchise.Application.DTOs.Realtime.OrderCompletedNotification>(
                n => n.OrderNumber == expectedResponse.OrderNumber && n.FinalAmount == expectedResponse.FinalAmount
            ), It.IsAny<CancellationToken>()),
            Times.Once
        );
    }

    [Fact]
    public async Task AnnounceOnlineOrder_ShouldBroadcastNotification_AndReturnOk()
    {
        // Arrange
        var notification = new Franchise.Application.DTOs.Realtime.OrderCompletedNotification(
            Guid.NewGuid(),
            "ORD-GRAB-001",
            Guid.NewGuid(),
            85000m,
            DateTime.UtcNow
        );

        // Act
        var result = await _controller.AnnounceOnlineOrder(notification, CancellationToken.None);

        // Assert
        var okResult = result as OkObjectResult;
        okResult.Should().NotBeNull();
        okResult!.StatusCode.Should().Be(200);

        _mockRealtimeNotificationService.Verify(
            s => s.NotifyOrderCompletedAsync(notification, It.IsAny<CancellationToken>()),
            Times.Once
        );
    }
}
