using Franchise.Application.DTOs.Loyalty;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Franchise.Domain.Exceptions;
using Franchise.Infrastructure.Data;
using Franchise.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace Franchise.UnitTests.Services;

public class LoyaltyServiceTests
{
    private static AppDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public async Task RegisterCustomerAsync_ShouldCreateCustomerWithWelcomePoints()
    {
        // Arrange
        var context = CreateInMemoryDbContext();
        var loggerMock = new Mock<ILogger<LoyaltyService>>();
        var service = new LoyaltyService(context, loggerMock.Object);

        var request = new RegisterCustomerRequest(
            PhoneNumber: "0901234567",
            FullName: "Nguyễn Văn A",
            Email: "vana@example.com"
        );

        // Act
        var result = await service.RegisterCustomerAsync(request);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("0901234567", result.PhoneNumber);
        Assert.Equal("Nguyễn Văn A", result.FullName);
        Assert.Equal(10, result.LoyaltyPoints); // 10 điểm chào mừng
        Assert.Equal(MemberTier.Standard, result.MemberTier);

        var savedCustomer = await context.Customers.Include(c => c.LoyaltyTransactions).FirstOrDefaultAsync();
        Assert.NotNull(savedCustomer);
        Assert.Single(savedCustomer.LoyaltyTransactions);
    }

    [Fact]
    public async Task LookupCustomerAsync_ShouldReturnTierDiscountAndAvailableVouchers()
    {
        // Arrange
        var context = CreateInMemoryDbContext();
        var loggerMock = new Mock<ILogger<LoyaltyService>>();
        var service = new LoyaltyService(context, loggerMock.Object);

        var customer = new Customer
        {
            PhoneNumber = "0988888888",
            FullName = "Trần Thị VIP",
            LoyaltyPoints = 120,
            TotalSpent = 2500000m,
            MemberTier = MemberTier.Gold
        };
        context.Customers.Add(customer);

        var voucher = new Voucher
        {
            Code = "GOLDVIP10",
            Title = "Giảm 10% cho hội viên Vàng",
            DiscountType = DiscountType.Percentage,
            DiscountValue = 10m,
            MinOrderAmount = 50000m,
            ValidFrom = DateTime.UtcNow.AddDays(-1),
            ValidTo = DateTime.UtcNow.AddDays(10),
            IsActive = true,
            MinMemberTier = MemberTier.Gold
        };
        context.Vouchers.Add(voucher);
        await context.SaveChangesAsync();

        // Act
        var result = await service.LookupCustomerAsync("0988888888");

        // Assert
        Assert.True(result.Found);
        Assert.NotNull(result.Customer);
        Assert.Equal(MemberTier.Gold, result.Customer.MemberTier);
        Assert.Equal(10m, result.TierDiscountPercent); // Hạng Vàng được giảm 10%
        Assert.NotEmpty(result.AvailableVouchers);
        Assert.True(result.AvailableVouchers.First().IsApplicable);
    }

    [Fact]
    public async Task ApplyPromotionAsync_ShouldCalculateTierVoucherAndPointsDiscountsCorrectly()
    {
        // Arrange
        var context = CreateInMemoryDbContext();
        var loggerMock = new Mock<ILogger<LoyaltyService>>();
        var service = new LoyaltyService(context, loggerMock.Object);

        var customer = new Customer
        {
            PhoneNumber = "0911222333",
            FullName = "Lê Hoàng Kim Cương",
            LoyaltyPoints = 50,
            MemberTier = MemberTier.Diamond // Diamond = 15%
        };
        context.Customers.Add(customer);

        var voucher = new Voucher
        {
            Code = "GIAM20K",
            Title = "Giảm ngay 20.000 đ",
            DiscountType = DiscountType.FixedAmount,
            DiscountValue = 20000m,
            MinOrderAmount = 50000m,
            ValidFrom = DateTime.UtcNow.AddDays(-1),
            ValidTo = DateTime.UtcNow.AddDays(5),
            IsActive = true
        };
        context.Vouchers.Add(voucher);
        await context.SaveChangesAsync();

        var request = new ApplyPromotionRequest(
            PhoneNumber: "0911222333",
            VoucherCode: "GIAM20K",
            PointsToRedeem: 30, // 30 điểm = 30.000 đ
            Subtotal: 200000m
        );

        // Act
        var result = await service.ApplyPromotionAsync(request);

        // Assert
        Assert.True(result.Success);
        Assert.Equal(30000m, result.TierDiscountAmount); // 15% của 200k = 30k
        Assert.Equal(20000m, result.VoucherDiscountAmount); // Voucher 20k
        Assert.Equal(30000m, result.PointsDiscountAmount); // 30 điểm = 30k
        Assert.Equal(80000m, result.TotalDiscountAmount); // Tổng giảm 80k
        Assert.Equal(30, result.PointsRedeemed);
    }

    [Fact]
    public void EvaluateTierBySpent_ShouldPromoteTiersAppropriately()
    {
        // Assert
        Assert.Equal(MemberTier.Standard, LoyaltyService.EvaluateTierBySpent(300000m));
        Assert.Equal(MemberTier.Silver, LoyaltyService.EvaluateTierBySpent(600000m));
        Assert.Equal(MemberTier.Gold, LoyaltyService.EvaluateTierBySpent(2500000m));
        Assert.Equal(MemberTier.Diamond, LoyaltyService.EvaluateTierBySpent(5500000m));
    }
}
