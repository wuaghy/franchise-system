using FluentAssertions;
using Franchise.Application.DTOs.Royalty;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Franchise.Infrastructure.Data;
using Franchise.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Franchise.UnitTests.Services;

public class RoyaltyBillingServiceTests
{
    private AppDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private async Task<Store> SeedStoreWithOrdersAsync(AppDbContext context, int year, int month)
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

        var setting = new StoreRoyaltySetting
        {
            Id = Guid.NewGuid(),
            StoreId = store.Id,
            RoyaltyRate = 0.05m, // 5%
            MarketingFeeRate = 0.02m, // 2%
            TechFeeFixedMonthly = 2000000m,
            IsActive = true
        };
        context.StoreRoyaltySettings.Add(setting);

        // Tạo 2 đơn hoàn thành trong tháng chỉ định
        var orderDate = new DateTime(year, month, 15, 10, 0, 0, DateTimeKind.Utc);
        var order1 = new Order
        {
            Id = Guid.NewGuid(),
            OrderNumber = "ORD-001",
            StoreId = store.Id,
            Status = OrderStatus.Completed,
            Subtotal = 100_000_000m,
            DiscountAmount = 10_000_000m,
            FinalAmount = 90_000_000m,
            CreatedAt = orderDate
        };

        context.Orders.Add(order1);
        await context.SaveChangesAsync();

        return store;
    }

    [Fact]
    public async Task GenerateInvoice_WhenValidRequest_ShouldCreateDraftInvoiceWithComputedFees()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var store = await SeedStoreWithOrdersAsync(context, 2026, 10);
        var service = new RoyaltyBillingService(context);

        var request = new GenerateRoyaltyInvoiceRequest(store.Id, 2026, 10);

        // Act
        var invoice = await service.GenerateInvoiceAsync(request);

        // Assert
        invoice.Should().NotBeNull();
        invoice.InvoiceNumber.Should().Be("ROY-202610-HL-01");
        invoice.Status.Should().Be("Draft");
        invoice.GrossRevenue.Should().Be(100_000_000m);
        invoice.DiscountAmount.Should().Be(10_000_000m);
        invoice.NetRevenue.Should().Be(90_000_000m);
        invoice.RoyaltyFee.Should().Be(4_500_000m); // 5% of 90M
        invoice.MarketingFee.Should().Be(1_800_000m); // 2% of 90M
        invoice.TechFee.Should().Be(2_000_000m);
        invoice.TotalDue.Should().Be(8_300_000m);
    }

    [Fact]
    public async Task IssueInvoice_ShouldTransitionToIssuedStateWithDueDate()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var store = await SeedStoreWithOrdersAsync(context, 2026, 10);
        var service = new RoyaltyBillingService(context);

        var generated = await service.GenerateInvoiceAsync(new GenerateRoyaltyInvoiceRequest(store.Id, 2026, 10));

        // Act
        var issued = await service.IssueInvoiceAsync(generated.Id);

        // Assert
        issued.Status.Should().Be("Issued");
        issued.IssuedAt.Should().NotBeNull();
        issued.DueDate.Should().NotBeNull();
    }

    [Fact]
    public async Task MarkInvoicePaid_WhenIssued_ShouldTransitionToPaid()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var store = await SeedStoreWithOrdersAsync(context, 2026, 10);
        var service = new RoyaltyBillingService(context);

        var generated = await service.GenerateInvoiceAsync(new GenerateRoyaltyInvoiceRequest(store.Id, 2026, 10));
        await service.IssueInvoiceAsync(generated.Id);

        // Act
        var paid = await service.MarkInvoicePaidAsync(generated.Id, new PayRoyaltyInvoiceRequest("BIDV-TXN-123456"));

        // Assert
        paid.Status.Should().Be("Paid");
        paid.PaidAt.Should().NotBeNull();
        paid.PaymentReference.Should().Be("BIDV-TXN-123456");
    }

    [Fact]
    public async Task CancelInvoice_WhenIssued_ShouldTransitionToCancelled()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var store = await SeedStoreWithOrdersAsync(context, 2026, 10);
        var service = new RoyaltyBillingService(context);

        var generated = await service.GenerateInvoiceAsync(new GenerateRoyaltyInvoiceRequest(store.Id, 2026, 10));

        // Act
        var cancelled = await service.CancelInvoiceAsync(generated.Id, new CancelRoyaltyInvoiceRequest("Điều chỉnh hợp đồng mới"));

        // Assert
        cancelled.Status.Should().Be("Cancelled");
        cancelled.CancellationReason.Should().Be("Điều chỉnh hợp đồng mới");
    }

    [Fact]
    public async Task GetStoreRoyaltySetting_And_UpdateSetting_ShouldPersistSuccessfully()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var store = await SeedStoreWithOrdersAsync(context, 2026, 10);
        var service = new RoyaltyBillingService(context);

        // Act
        var updated = await service.UpdateStoreRoyaltySettingAsync(store.Id, new UpdateStoreRoyaltySettingRequest(
            RoyaltyRate: 0.06m,
            MarketingFeeRate: 0.025m,
            TechFeeFixedMonthly: 2500000m,
            IsActive: true
        ));

        // Assert
        updated.RoyaltyRate.Should().Be(0.06m);
        updated.MarketingFeeRate.Should().Be(0.025m);
        updated.TechFeeFixedMonthly.Should().Be(2500000m);

        var fetched = await service.GetStoreRoyaltySettingAsync(store.Id);
        fetched.RoyaltyRate.Should().Be(0.06m);
    }
}
