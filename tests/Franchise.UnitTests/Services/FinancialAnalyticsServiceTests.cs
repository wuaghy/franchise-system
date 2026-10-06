using FluentAssertions;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Franchise.Infrastructure.Data;
using Franchise.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Franchise.UnitTests.Services;

public class FinancialAnalyticsServiceTests
{
    private AppDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private async Task<(Store store, Product product)> SeedSampleDataAsync(AppDbContext context)
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
            Sku = "CF-01",
            Name = "Phin Sữa Đá",
            BasePrice = 30000,
            IsAvailable = true
        };
        context.Products.Add(product);

        // Tạo 2 đơn hàng ở các khung giờ khác nhau vào ngày hôm qua
        var seedDate = DateTime.UtcNow.Date.AddDays(-1);
        var order1 = new Order
        {
            Id = Guid.NewGuid(),
            OrderNumber = "ORD-001",
            StoreId = store.Id,
            Status = OrderStatus.Completed,
            Subtotal = 60000,
            DiscountAmount = 0,
            VatAmount = 4800,
            FinalAmount = 64800,
            CreatedAt = new DateTime(seedDate.Year, seedDate.Month, seedDate.Day, 8, 30, 0, DateTimeKind.Utc) // Khung giờ sáng 8h
        };
        order1.OrderItems.Add(new OrderItem
        {
            Id = Guid.NewGuid(),
            OrderId = order1.Id,
            ProductId = product.Id,
            Product = product,
            Quantity = 2,
            UnitPrice = 30000,
            TotalPrice = 60000
        });

        var order2 = new Order
        {
            Id = Guid.NewGuid(),
            OrderNumber = "ORD-002",
            StoreId = store.Id,
            Status = OrderStatus.Completed,
            Subtotal = 30000,
            DiscountAmount = 5000,
            VatAmount = 2000,
            FinalAmount = 27000,
            CreatedAt = new DateTime(seedDate.Year, seedDate.Month, seedDate.Day, 12, 15, 0, DateTimeKind.Utc) // Khung giờ trưa 12h
        };
        order2.OrderItems.Add(new OrderItem
        {
            Id = Guid.NewGuid(),
            OrderId = order2.Id,
            ProductId = product.Id,
            Product = product,
            Quantity = 1,
            UnitPrice = 30000,
            TotalPrice = 30000
        });

        context.Orders.AddRange(order1, order2);
        await context.SaveChangesAsync();

        return (store, product);
    }

    [Fact]
    public async Task GetStoreSummary_ShouldAggregateGrossRevenueAndNetOrdersCorrectly()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var (store, _) = await SeedSampleDataAsync(context);
        var service = new FinancialAnalyticsService(context);

        // Act
        var fromDate = DateTime.UtcNow.AddDays(-5);
        var toDate = DateTime.UtcNow.AddDays(1);
        var result = await service.GetStoreSummaryAsync(store.Id, fromDate, toDate);

        // Assert
        result.Should().NotBeNull();
        result.StoreId.Should().Be(store.Id);
        result.TotalOrders.Should().Be(2);
        result.GrossRevenue.Should().Be(90000m); // 60000 + 30000
        result.DiscountAmount.Should().Be(5000m);
        result.NetRevenue.Should().Be(91800m); // 64800 + 27000
        result.AverageOrderValue.Should().Be(45900m);
        result.EstimatedGrossProfit.Should().BeGreaterThan(0);
        result.GrossMarginPercentage.Should().BeGreaterThan(50);
    }

    [Fact]
    public async Task GetHourlySalesHeatmap_ShouldPopulate24HoursAndMarkPeakHours()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var (store, _) = await SeedSampleDataAsync(context);
        var service = new FinancialAnalyticsService(context);
        var targetDate = DateTime.UtcNow.Date.AddDays(-1);

        // Act
        var result = await service.GetHourlySalesHeatmapAsync(store.Id, targetDate);

        // Assert
        result.Should().NotBeNull();
        result.HourlyDistribution.Should().HaveCount(24);
        result.TotalOrders.Should().Be(2);

        var hour8 = result.HourlyDistribution.First(h => h.Hour == 8);
        hour8.OrderCount.Should().Be(1);
        hour8.Revenue.Should().Be(64800m);
        hour8.IsPeakHour.Should().BeTrue();

        var hour12 = result.HourlyDistribution.First(h => h.Hour == 12);
        hour12.OrderCount.Should().Be(1);
        hour12.Revenue.Should().Be(27000m);
        hour12.IsPeakHour.Should().BeTrue();
    }

    [Fact]
    public async Task GetProductSalesPerformance_ShouldRankProductsByRevenue()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var (store, product) = await SeedSampleDataAsync(context);
        var service = new FinancialAnalyticsService(context);

        // Act
        var result = await service.GetProductSalesPerformanceAsync(store.Id);

        // Assert
        result.Should().NotBeNull();
        result.Should().HaveCount(1);
        result[0].ProductId.Should().Be(product.Id);
        result[0].UnitsSold.Should().Be(3);
        result[0].Revenue.Should().Be(90000m);
        result[0].RevenueSharePercentage.Should().Be(100m);
    }

    [Fact]
    public async Task GetNetworkOverview_ShouldReturnAllStoresRankings()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var (store, _) = await SeedSampleDataAsync(context);
        var service = new FinancialAnalyticsService(context);

        // Act
        var result = await service.GetNetworkOverviewAsync();

        // Assert
        result.Should().NotBeNull();
        result.TotalNetworkStores.Should().Be(1);
        result.TotalNetworkOrders.Should().Be(2);
        result.TotalNetworkRevenue.Should().Be(91800m);
        result.TotalRoyaltyDue.Should().Be(Math.Round(91800m * 0.05m, 0));
        result.StoreRankings.Should().HaveCount(1);
        result.StoreRankings[0].StoreId.Should().Be(store.Id);
    }
}
