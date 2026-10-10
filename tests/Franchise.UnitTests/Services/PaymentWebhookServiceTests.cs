using System.Security.Cryptography;
using System.Text;
using FluentAssertions;
using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Payments;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Franchise.Infrastructure.Data;
using Franchise.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace Franchise.UnitTests.Services;

public class PaymentWebhookServiceTests
{
    private readonly Mock<IRealtimeNotificationService> _notificationServiceMock = new();
    private readonly Mock<IConfiguration> _configMock = new();

    private AppDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public void VerifyPayOsSignature_ValidSignature_ShouldReturnTrue()
    {
        // Arrange
        var checksumKey = "secret_checksum_key_123456";
        var data = new PayOsWebhookData(
            OrderCode: 1001,
            Amount: 59000,
            Description: "Thanh toan ORD-1001",
            AccountNumber: "100878137043",
            Reference: "FT123456",
            TransactionDateTime: "2026-10-10 08:30:00",
            PaymentLinkId: "link_001"
        );

        var dataToSign = $"amount={data.Amount}&description={data.Description}&orderCode={data.OrderCode}";
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(checksumKey));
        var validSignature = Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(dataToSign))).ToLowerInvariant();

        // Act
        var result = PaymentWebhookService.VerifyPayOsSignature(data, validSignature, checksumKey);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void VerifyPayOsSignature_TamperedAmount_ShouldReturnFalse()
    {
        // Arrange
        var checksumKey = "secret_checksum_key_123456";
        var data = new PayOsWebhookData(
            OrderCode: 1001,
            Amount: 59000,
            Description: "Thanh toan ORD-1001",
            AccountNumber: "100878137043",
            Reference: "FT123456",
            TransactionDateTime: "2026-10-10 08:30:00",
            PaymentLinkId: "link_001"
        );

        var fakeSignature = "invalid_tampered_signature_hex";

        // Act
        var result = PaymentWebhookService.VerifyPayOsSignature(data, fakeSignature, checksumKey);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task ProcessPayOsWebhookAsync_MatchingOrder_ShouldRecordPayment_UpdateStatus_AndNotifySignalR()
    {
        // Arrange
        await using var context = CreateInMemoryDbContext();

        var store = new Store { Name = "Store 1", Code = "ST01", Address = "HCM" };
        context.Stores.Add(store);

        var order = new Order
        {
            StoreId = store.Id,
            OrderNumber = "ORD-20261010-001",
            FinalAmount = 65000,
            Status = OrderStatus.Pending
        };
        context.Orders.Add(order);
        await context.SaveChangesAsync();

        _configMock.Setup(c => c["PayOS:ChecksumKey"]).Returns((string?)null); // Bypass checksum check for test

        var service = new PaymentWebhookService(
            context,
            _notificationServiceMock.Object,
            _configMock.Object,
            NullLogger<PaymentWebhookService>.Instance);

        var payload = new PayOsWebhookPayload(
            Code: "00",
            Desc: "success",
            Data: new PayOsWebhookData(
                OrderCode: 20261010001,
                Amount: 65000,
                Description: "Chuyen tien don hang ORD-20261010-001",
                AccountNumber: "100878137043",
                Reference: "TX_PAYOS_9999",
                TransactionDateTime: "2026-10-10 08:30:00",
                PaymentLinkId: "link_01"
            ),
            Signature: "signature"
        );

        // Act
        var result = await service.ProcessPayOsWebhookAsync(payload);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.OrderNumber.Should().Be("ORD-20261010-001");

        // Verify Order status updated to Paid
        var updatedOrder = await context.Orders.Include(o => o.Payments).FirstAsync(o => o.Id == order.Id);
        updatedOrder.Status.Should().Be(OrderStatus.Paid);
        updatedOrder.Payments.Should().HaveCount(1);
        updatedOrder.Payments.First().Amount.Should().Be(65000);
        updatedOrder.Payments.First().Status.Should().Be(PaymentStatus.Success);

        // Verify SignalR was invoked
        _notificationServiceMock.Verify(n => n.NotifyPaymentConfirmedAsync(
            It.Is<PaymentConfirmedNotification>(p => p.OrderNumber == "ORD-20261010-001" && p.Amount == 65000),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SimulateWebhookPaymentAsync_ShouldBroadcastRealtimeNotification()
    {
        // Arrange
        await using var context = CreateInMemoryDbContext();
        var service = new PaymentWebhookService(
            context,
            _notificationServiceMock.Object,
            _configMock.Object,
            NullLogger<PaymentWebhookService>.Instance);

        var request = new SimulatePaymentWebhookRequest(
            OrderCode: "ORD-TEST-999",
            Amount: 49000,
            Gateway: "Simulated_Napas"
        );

        // Act
        var result = await service.SimulateWebhookPaymentAsync(request);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.OrderNumber.Should().Be("ORD-TEST-999");
        result.Amount.Should().Be(49000);

        _notificationServiceMock.Verify(n => n.NotifyPaymentConfirmedAsync(
            It.Is<PaymentConfirmedNotification>(p => p.OrderNumber == "ORD-TEST-999" && p.Amount == 49000),
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
