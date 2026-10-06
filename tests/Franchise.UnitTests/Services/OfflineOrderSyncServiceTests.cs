using FluentAssertions;
using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Inventory;
using Franchise.Application.DTOs.Pos;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Franchise.Infrastructure.Data;
using Franchise.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace Franchise.UnitTests.Services;

public class OfflineOrderSyncServiceTests
{
    private AppDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public async Task SyncOfflineOrdersAsync_WithValidOrders_ShouldPersistOrdersAndDeductInventoryAndRecordOutbox()
    {
        // Arrange
        var context = CreateInMemoryDbContext();
        var mockInventory = new Mock<IInventoryService>();
        mockInventory
            .Setup(i => i.ProcessOrderInventoryDeductionAsync(It.IsAny<CheckoutOrderInventoryRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new InventoryDeductionResult(true, "OFF-MOCK", Array.Empty<DeductedIngredientDetail>(), null));

        var sut = new OfflineOrderSyncService(context, mockInventory.Object, NullLogger<OfflineOrderSyncService>.Instance);

        var storeId = Guid.NewGuid();
        var productId = Guid.NewGuid();
        var offlineId = Guid.NewGuid().ToString();
        var idempotencyKey = $"OFF-KEY-{offlineId}";

        var request = new BulkSyncOfflineOrdersRequest
        {
            StoreId = storeId,
            DeviceIdentifier = "POS-TERMINAL-01",
            Orders = new List<OfflineOrderSyncItem>
            {
                new OfflineOrderSyncItem
                {
                    OfflineOrderId = offlineId,
                    IdempotencyKey = idempotencyKey,
                    StoreId = storeId,
                    OrderType = OrderType.DineIn,
                    PaymentMethod = PaymentMethod.Cash,
                    Subtotal = 50000m,
                    DiscountAmount = 0m,
                    VatAmount = 4000m,
                    FinalAmount = 54000m,
                    OfflineCreatedAt = DateTime.UtcNow.AddMinutes(-10),
                    Items = new List<OfflineOrderItemSyncDto>
                    {
                        new OfflineOrderItemSyncDto
                        {
                            ProductId = productId,
                            Quantity = 1,
                            UnitPrice = 50000m
                        }
                    }
                }
            }
        };

        // Act
        var result = await sut.SyncOfflineOrdersAsync(request);

        // Assert
        result.TotalProcessed.Should().Be(1);
        result.SuccessfulCount.Should().Be(1);
        result.DuplicateSkippedCount.Should().Be(0);
        result.FailedCount.Should().Be(0);
        result.Results.Should().HaveCount(1);
        result.Results[0].Status.Should().Be("Synced");
        result.Results[0].ServerOrderId.Should().NotBeNull();

        // Kiểm tra database lưu Order & Outbox & Idempotency
        var savedOrder = await context.Orders.FirstOrDefaultAsync(o => o.Id == result.Results[0].ServerOrderId);
        savedOrder.Should().NotBeNull();
        savedOrder!.FinalAmount.Should().Be(54000m);
        savedOrder.Status.Should().Be(OrderStatus.Completed);

        var idempotency = await context.IdempotencyRecords.FirstOrDefaultAsync(r => r.IdempotencyKey == idempotencyKey);
        idempotency.Should().NotBeNull();

        var outbox = await context.OutboxMessages.FirstOrDefaultAsync(o => o.AggregateId == savedOrder.Id.ToString());
        outbox.Should().NotBeNull();
        outbox!.EventType.Should().Be("OrderCompleted");
    }

    [Fact]
    public async Task SyncOfflineOrdersAsync_WhenIdempotencyKeyExists_ShouldSkipDuplicateWithoutDeductingTwice()
    {
        // Arrange
        var context = CreateInMemoryDbContext();
        var existingKey = "IDEMP-DUPLICATE-001";
        context.IdempotencyRecords.Add(new IdempotencyRecord
        {
            IdempotencyKey = existingKey,
            StatusCode = 200,
            ResponsePayload = "{\"OrderId\":\"00000000-0000-0000-0000-000000000001\",\"OrderNumber\":\"OFF-EXISTING\"}"
        });
        await context.SaveChangesAsync();

        var mockInventory = new Mock<IInventoryService>();
        var sut = new OfflineOrderSyncService(context, mockInventory.Object, NullLogger<OfflineOrderSyncService>.Instance);

        var request = new BulkSyncOfflineOrdersRequest
        {
            StoreId = Guid.NewGuid(),
            DeviceIdentifier = "POS-TERMINAL-01",
            Orders = new List<OfflineOrderSyncItem>
            {
                new OfflineOrderSyncItem
                {
                    OfflineOrderId = "OFF-RETRY-01",
                    IdempotencyKey = existingKey,
                    Items = new List<OfflineOrderItemSyncDto>
                    {
                        new OfflineOrderItemSyncDto { ProductId = Guid.NewGuid(), Quantity = 2, UnitPrice = 30000m }
                    }
                }
            }
        };

        // Act
        var result = await sut.SyncOfflineOrdersAsync(request);

        // Assert
        result.TotalProcessed.Should().Be(1);
        result.SuccessfulCount.Should().Be(0);
        result.DuplicateSkippedCount.Should().Be(1);
        result.Results[0].Status.Should().Be("DuplicateSkipped");

        // Inventory KHÔNG bị gọi thêm lần nào
        mockInventory.Verify(i => i.ProcessOrderInventoryDeductionAsync(It.IsAny<CheckoutOrderInventoryRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task SyncOfflineOrdersAsync_WhenInventoryDeductionFails_ShouldMarkOrderFailed()
    {
        // Arrange
        var context = CreateInMemoryDbContext();
        var mockInventory = new Mock<IInventoryService>();
        mockInventory
            .Setup(i => i.ProcessOrderInventoryDeductionAsync(It.IsAny<CheckoutOrderInventoryRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new InventoryDeductionResult(false, "OFF-OUTOFSTOCK", Array.Empty<DeductedIngredientDetail>(), "Kho hạt cà phê không đủ số lượng tồn"));

        var sut = new OfflineOrderSyncService(context, mockInventory.Object, NullLogger<OfflineOrderSyncService>.Instance);

        var request = new BulkSyncOfflineOrdersRequest
        {
            StoreId = Guid.NewGuid(),
            DeviceIdentifier = "POS-TERMINAL-02",
            Orders = new List<OfflineOrderSyncItem>
            {
                new OfflineOrderSyncItem
                {
                    OfflineOrderId = "OFF-OUTOFSTOCK",
                    IdempotencyKey = "KEY-OUTOFSTOCK",
                    Items = new List<OfflineOrderItemSyncDto>
                    {
                        new OfflineOrderItemSyncDto { ProductId = Guid.NewGuid(), Quantity = 10, UnitPrice = 45000m }
                    }
                }
            }
        };

        // Act
        var result = await sut.SyncOfflineOrdersAsync(request);

        // Assert
        result.FailedCount.Should().Be(1);
        result.SuccessfulCount.Should().Be(0);
        result.Results[0].Status.Should().Be("Failed");
        result.Results[0].Message.Should().Contain("Kho hạt cà phê không đủ");
        (await context.Orders.CountAsync()).Should().Be(0);
    }
}
