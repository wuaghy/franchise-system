using FluentAssertions;
using Franchise.Application.DTOs.Shifts;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Franchise.Domain.Exceptions;
using Franchise.Infrastructure.Data;
using Franchise.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Franchise.UnitTests.Services;

public class ShiftServiceTests
{
    private AppDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public async Task OpenShiftAsync_WhenNoActiveShift_ShouldCreateOpenShiftWithStartingCash()
    {
        // Arrange
        await using var context = CreateInMemoryDbContext();
        var store = new Store { Name = "Store Q1", Code = "ST-Q1", Address = "123 Lê Lợi" };
        var cashier = new StoreUser { FullName = "Nguyễn Thu Ngân", Role = StoreRole.Cashier };
        context.Stores.Add(store);
        context.StoreUsers.Add(cashier);
        await context.SaveChangesAsync();

        var service = new ShiftService(context, NullLogger<ShiftService>.Instance);
        var request = new OpenShiftRequest(store.Id, StartingCash: 1000000m, Notes: "Mở ca sáng");

        // Act
        var result = await service.OpenShiftAsync(store.Id, cashier.Id, request);

        // Assert
        result.Should().NotBeNull();
        result.Status.Should().Be(ShiftStatus.Open);
        result.StartingCash.Should().Be(1000000m);
        result.ExpectedEndingCash.Should().Be(1000000m);
        result.TotalCashSales.Should().Be(0);
        result.ShiftNumber.Should().StartWith("SHIFT-");
    }

    [Fact]
    public async Task OpenShiftAsync_WhenShiftAlreadyOpenForStore_ShouldThrowBusinessRuleException()
    {
        // Arrange
        await using var context = CreateInMemoryDbContext();
        var store = new Store { Name = "Store Q1", Code = "ST-Q1", Address = "123 Lê Lợi" };
        var cashier = new StoreUser { FullName = "Nguyễn Thu Ngân", Role = StoreRole.Cashier };
        context.Stores.Add(store);
        context.StoreUsers.Add(cashier);

        // Seed an existing open shift
        var existingShift = new Shift
        {
            StoreId = store.Id,
            CashierId = cashier.Id,
            ShiftNumber = "SHIFT-20261010-01",
            Status = ShiftStatus.Open,
            StartingCash = 500000m
        };
        context.Shifts.Add(existingShift);
        await context.SaveChangesAsync();

        var service = new ShiftService(context, NullLogger<ShiftService>.Instance);
        var request = new OpenShiftRequest(store.Id, StartingCash: 1000000m);

        // Act & Assert
        var act = async () => await service.OpenShiftAsync(store.Id, cashier.Id, request);
        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*đang có một ca làm việc đang mở*");
    }

    [Fact]
    public async Task AddCashMovementAsync_CashInAndCashOut_ShouldUpdateExpectedEndingCashAccurately()
    {
        // Arrange
        await using var context = CreateInMemoryDbContext();
        var store = new Store { Name = "Store Q1", Code = "ST-Q1", Address = "123 Lê Lợi" };
        var cashier = new StoreUser { FullName = "Nguyễn Thu Ngân", Role = StoreRole.Cashier };
        context.Stores.Add(store);
        context.StoreUsers.Add(cashier);

        var shift = new Shift
        {
            StoreId = store.Id,
            CashierId = cashier.Id,
            ShiftNumber = "SHIFT-20261010-01",
            Status = ShiftStatus.Open,
            StartingCash = 1000000m,
            ExpectedEndingCash = 1000000m
        };
        context.Shifts.Add(shift);
        await context.SaveChangesAsync();

        var service = new ShiftService(context, NullLogger<ShiftService>.Instance);

        // Act: 1. Nạp thêm 200k tiền lẻ
        await service.AddCashMovementAsync(shift.Id, cashier.Id,
            new CashMovementRequest(200000m, CashMovementType.CashIn, "Nạp thêm tiền lẻ"));

        // Act: 2. Chi 50k mua đá viên khẩn cấp
        var updated = await service.AddCashMovementAsync(shift.Id, cashier.Id,
            new CashMovementRequest(50000m, CashMovementType.CashOut, "Mua đá viên khẩn cấp"));

        // Assert
        updated.TotalCashIn.Should().Be(200000m);
        updated.TotalCashOut.Should().Be(50000m);
        // Expected: 1.000.000 + 200.000 - 50.000 = 1.150.000 đ
        updated.ExpectedEndingCash.Should().Be(1150000m);
        updated.Movements.Should().HaveCount(2);
    }

    [Fact]
    public async Task CloseShiftAsync_WhenActualCashCounted_ShouldCalculateAccurateDiscrepancyAndCloseShift()
    {
        // Arrange
        await using var context = CreateInMemoryDbContext();
        var store = new Store { Name = "Store Q1", Code = "ST-Q1", Address = "123 Lê Lợi" };
        var cashier = new StoreUser { FullName = "Nguyễn Thu Ngân", Role = StoreRole.Cashier };
        context.Stores.Add(store);
        context.StoreUsers.Add(cashier);

        var shift = new Shift
        {
            StoreId = store.Id,
            CashierId = cashier.Id,
            ShiftNumber = "SHIFT-20261010-01",
            Status = ShiftStatus.Open,
            StartingCash = 1000000m,
            TotalCashSales = 1500000m, // Thu 1.5tr tiền mặt
            TotalBankTransferSales = 800000m, // Thu 800k chuyển khoản VietQR
            TotalCashIn = 0,
            TotalCashOut = 50000m, // Chi vặt 50k
            ExpectedEndingCash = 2450000m // 1tr + 1.5tr - 50k = 2.450.000 đ
        };
        context.Shifts.Add(shift);
        await context.SaveChangesAsync();

        var service = new ShiftService(context, NullLogger<ShiftService>.Instance);

        // Giả sử thực tế đếm được 2.440.000đ (Thiếu 10.000đ do thối nhầm)
        var closeRequest = new CloseShiftRequest(ActualEndingCash: 2440000m, Notes: "Thiếu 10k thối nhầm khách");

        // Act
        var result = await service.CloseShiftAsync(shift.Id, cashier.Id, closeRequest);

        // Assert
        result.Status.Should().Be(ShiftStatus.Closed);
        result.ClosedAt.Should().NotBeNull();
        result.ExpectedEndingCash.Should().Be(2450000m);
        result.ActualEndingCash.Should().Be(2440000m);
        result.CashDiscrepancy.Should().Be(-10000m, because: "Thiếu 10k so với lý thuyết");
    }

    [Fact]
    public async Task GetZReportAsync_ShouldReturnCompleteBreakdownOfSalesAndMovements()
    {
        // Arrange
        await using var context = CreateInMemoryDbContext();
        var store = new Store { Name = "Flagship Q1", Code = "ST-Q1", Address = "123 Lê Lợi" };
        var cashier = new StoreUser { FullName = "Trần Thu Ngân", Role = StoreRole.Cashier };
        context.Stores.Add(store);
        context.StoreUsers.Add(cashier);

        var shift = new Shift
        {
            StoreId = store.Id,
            CashierId = cashier.Id,
            ShiftNumber = "SHIFT-20261010-01",
            Status = ShiftStatus.Closed,
            StartingCash = 1000000m,
            TotalCashSales = 2000000m,
            TotalBankTransferSales = 1500000m,
            TotalCardSales = 500000m,
            ExpectedEndingCash = 3000000m,
            ActualEndingCash = 3000000m,
            CashDiscrepancy = 0,
            TotalOrdersCount = 25,
            OpenedAt = DateTime.UtcNow.AddHours(-8),
            ClosedAt = DateTime.UtcNow
        };
        context.Shifts.Add(shift);
        await context.SaveChangesAsync();

        var service = new ShiftService(context, NullLogger<ShiftService>.Instance);

        // Act
        var zReport = await service.GetZReportAsync(shift.Id);

        // Assert
        zReport.Should().NotBeNull();
        zReport.ShiftNumber.Should().Be("SHIFT-20261010-01");
        zReport.StoreName.Should().Be("Flagship Q1");
        zReport.TotalRevenue.Should().Be(4000000m, because: "2tr tiền mặt + 1.5tr chuyển khoản + 500k quẹt thẻ");
        zReport.TotalOrdersCount.Should().Be(25);
        zReport.CashDiscrepancy.Should().Be(0, because: "Tiền đếm khớp chính xác 100%");
    }
}
