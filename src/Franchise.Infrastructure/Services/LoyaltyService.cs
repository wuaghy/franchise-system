using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Loyalty;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Franchise.Domain.Exceptions;
using Franchise.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Franchise.Infrastructure.Services;

public class LoyaltyService : ILoyaltyService
{
    private readonly AppDbContext _context;
    private readonly ILogger<LoyaltyService> _logger;

    public LoyaltyService(AppDbContext context, ILogger<LoyaltyService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<CustomerLookupResponse> LookupCustomerAsync(string phoneNumber, CancellationToken ct = default)
    {
        var normalizedPhone = NormalizePhone(phoneNumber);
        var customer = await _context.Customers
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.PhoneNumber == normalizedPhone, ct);

        if (customer == null)
        {
            var publicVouchers = await GetActiveVouchersAsync(null, ct);
            return new CustomerLookupResponse(
                Found: false,
                Customer: null,
                TierDiscountPercent: 0,
                AvailableVouchers: publicVouchers
            );
        }

        var tierDiscountPercent = GetTierDiscountPercent(customer.MemberTier);
        var availableVouchers = await GetActiveVouchersAsync(customer.PhoneNumber, ct);

        var customerDto = MapCustomerToDto(customer);
        return new CustomerLookupResponse(
            Found: true,
            Customer: customerDto,
            TierDiscountPercent: tierDiscountPercent,
            AvailableVouchers: availableVouchers
        );
    }

    public async Task<CustomerDto> RegisterCustomerAsync(RegisterCustomerRequest request, CancellationToken ct = default)
    {
        var normalizedPhone = NormalizePhone(request.PhoneNumber);
        if (string.IsNullOrWhiteSpace(normalizedPhone) || normalizedPhone.Length < 9)
        {
            throw new RequestValidationException("PhoneNumber", "Số điện thoại không hợp lệ.");
        }

        if (string.IsNullOrWhiteSpace(request.FullName))
        {
            throw new RequestValidationException("FullName", "Họ tên khách hàng không được để trống.");
        }

        var existing = await _context.Customers.FirstOrDefaultAsync(c => c.PhoneNumber == normalizedPhone, ct);
        if (existing != null)
        {
            throw new BusinessRuleException("CUSTOMER_ALREADY_EXISTS", $"Khách hàng với số điện thoại '{normalizedPhone}' đã đăng ký trước đó.");
        }

        var customer = new Customer
        {
            PhoneNumber = normalizedPhone,
            FullName = request.FullName.Trim(),
            Email = request.Email?.Trim(),
            DateOfBirth = request.DateOfBirth,
            LoyaltyPoints = 10, // Tặng ngay 10 điểm chào mừng tân thành viên
            TotalSpent = 0m,
            MemberTier = MemberTier.Standard
        };

        _context.Customers.Add(customer);

        // Ghi log giao dịch điểm chào mừng
        _context.LoyaltyTransactions.Add(new LoyaltyTransaction
        {
            Customer = customer,
            PointsChange = 10,
            PointsBalanceAfter = 10,
            Reason = "Tặng điểm chào mừng thành viên mới"
        });

        await _context.SaveChangesAsync(ct);
        _logger.LogInformation("Đã đăng ký thành viên mới thành công: {Phone} - {Name}", customer.PhoneNumber, customer.FullName);

        return MapCustomerToDto(customer);
    }

    public async Task<ApplyPromotionResponse> ApplyPromotionAsync(ApplyPromotionRequest request, CancellationToken ct = default)
    {
        Customer? customer = null;
        decimal tierDiscountAmount = 0m;
        decimal voucherDiscountAmount = 0m;
        decimal pointsDiscountAmount = 0m;
        VoucherDto? appliedVoucher = null;
        int pointsRedeemed = 0;

        if (!string.IsNullOrWhiteSpace(request.PhoneNumber))
        {
            var normalizedPhone = NormalizePhone(request.PhoneNumber);
            customer = await _context.Customers.FirstOrDefaultAsync(c => c.PhoneNumber == normalizedPhone, ct);
        }

        // 1. Tính chiết khấu theo Hạng thành viên (Tier Discount)
        if (customer != null)
        {
            var tierPercent = GetTierDiscountPercent(customer.MemberTier);
            if (tierPercent > 0)
            {
                tierDiscountAmount = Math.Round(request.Subtotal * (tierPercent / 100m), 2);
            }
        }

        // 2. Kiểm tra và áp dụng Mã Voucher (nếu có)
        if (!string.IsNullOrWhiteSpace(request.VoucherCode))
        {
            var cleanCode = request.VoucherCode.Trim().ToUpperInvariant();
            var now = DateTime.UtcNow;

            var voucher = await _context.Vouchers
                .FirstOrDefaultAsync(v => v.Code == cleanCode && v.IsActive, ct);

            if (voucher == null)
            {
                throw new NotFoundException("VOUCHER_NOT_FOUND", $"Mã ưu đãi '{cleanCode}' không tồn tại hoặc đã bị khóa.");
            }

            if (voucher.ValidFrom > now || voucher.ValidTo < now)
            {
                throw new BusinessRuleException("VOUCHER_EXPIRED", $"Mã ưu đãi '{cleanCode}' đã hết hạn hoặc chưa đến ngày bắt đầu.");
            }

            if (voucher.TimesUsed >= voucher.UsageLimit)
            {
                throw new BusinessRuleException("VOUCHER_LIMIT_EXCEEDED", $"Mã ưu đãi '{cleanCode}' đã đạt giới hạn lượt sử dụng.");
            }

            if (request.Subtotal < voucher.MinOrderAmount)
            {
                throw new BusinessRuleException("VOUCHER_MIN_NOT_MET", 
                    $"Đơn hàng tối thiểu để áp dụng mã này là {voucher.MinOrderAmount:N0} đ.");
            }

            // Kiểm tra phân hạng yêu cầu
            if (voucher.MinMemberTier.HasValue)
            {
                if (customer == null || (int)customer.MemberTier < (int)voucher.MinMemberTier.Value)
                {
                    throw new BusinessRuleException("VOUCHER_TIER_RESTRICTED",
                        $"Mã ưu đãi này chỉ áp dụng cho thành viên hạng {voucher.MinMemberTier.Value} trở lên.");
                }
            }

            // Tính số tiền giảm của Voucher
            if (voucher.DiscountType == DiscountType.Percentage)
            {
                var rawVoucherDiscount = request.Subtotal * (voucher.DiscountValue / 100m);
                if (voucher.MaxDiscountAmount.HasValue && rawVoucherDiscount > voucher.MaxDiscountAmount.Value)
                {
                    voucherDiscountAmount = voucher.MaxDiscountAmount.Value;
                }
                else
                {
                    voucherDiscountAmount = rawVoucherDiscount;
                }
            }
            else
            {
                voucherDiscountAmount = voucher.DiscountValue;
            }

            voucherDiscountAmount = Math.Round(voucherDiscountAmount, 2);
            appliedVoucher = new VoucherDto(
                voucher.Id,
                voucher.Code,
                voucher.Title,
                voucher.Description,
                voucher.DiscountType,
                voucher.DiscountValue,
                voucher.MinOrderAmount,
                voucher.MaxDiscountAmount,
                voucher.ValidTo,
                true
            );
        }

        // 3. Đổi điểm tích lũy (Redeem Points): 1 điểm = 1.000 VNĐ
        if (request.PointsToRedeem > 0)
        {
            if (customer == null)
            {
                throw new BusinessRuleException("CUSTOMER_REQUIRED_FOR_POINTS", "Cần thông tin khách hàng để sử dụng điểm thưởng.");
            }

            if (request.PointsToRedeem > customer.LoyaltyPoints)
            {
                throw new BusinessRuleException("INSUFFICIENT_POINTS", 
                    $"Khách hàng chỉ có {customer.LoyaltyPoints} điểm, không đủ {request.PointsToRedeem} điểm yêu cầu.");
            }

            pointsRedeemed = request.PointsToRedeem;
            pointsDiscountAmount = pointsRedeemed * 1000m; // 1 điểm = 1.000 đ
        }

        var totalDiscount = tierDiscountAmount + voucherDiscountAmount + pointsDiscountAmount;

        // Giảm giá tối đa không vượt quá giá trị đơn hàng
        if (totalDiscount > request.Subtotal)
        {
            totalDiscount = request.Subtotal;
        }

        return new ApplyPromotionResponse(
            Success: true,
            Message: "Áp dụng chương trình ưu đãi thành công",
            TierDiscountAmount: tierDiscountAmount,
            VoucherDiscountAmount: voucherDiscountAmount,
            PointsDiscountAmount: pointsDiscountAmount,
            TotalDiscountAmount: totalDiscount,
            PointsRedeemed: pointsRedeemed,
            Customer: customer != null ? MapCustomerToDto(customer) : null,
            AppliedVoucher: appliedVoucher
        );
    }

    public async Task<IReadOnlyList<VoucherDto>> GetActiveVouchersAsync(string? phoneNumber = null, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var query = _context.Vouchers
            .AsNoTracking()
            .Where(v => v.IsActive && v.ValidFrom <= now && v.ValidTo >= now && v.TimesUsed < v.UsageLimit);

        Customer? customer = null;
        if (!string.IsNullOrWhiteSpace(phoneNumber))
        {
            var normalizedPhone = NormalizePhone(phoneNumber);
            customer = await _context.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.PhoneNumber == normalizedPhone, ct);
        }

        var vouchers = await query.OrderBy(v => v.ValidTo).ToListAsync(ct);

        return vouchers.Select(v =>
        {
            bool isApplicable = true;
            if (v.MinMemberTier.HasValue)
            {
                if (customer == null || (int)customer.MemberTier < (int)v.MinMemberTier.Value)
                {
                    isApplicable = false;
                }
            }

            return new VoucherDto(
                v.Id,
                v.Code,
                v.Title,
                v.Description,
                v.DiscountType,
                v.DiscountValue,
                v.MinOrderAmount,
                v.MaxDiscountAmount,
                v.ValidTo,
                isApplicable
            );
        }).ToList();
    }

    public async Task<VoucherDto> CreateVoucherAsync(CreateVoucherRequest request, CancellationToken ct = default)
    {
        var code = request.Code.Trim().ToUpperInvariant();
        var exists = await _context.Vouchers.AnyAsync(v => v.Code == code, ct);
        if (exists)
        {
            throw new BusinessRuleException("VOUCHER_CODE_EXISTS", $"Mã ưu đãi '{code}' đã tồn tại trong hệ thống.");
        }

        var voucher = new Voucher
        {
            Code = code,
            Title = request.Title.Trim(),
            Description = request.Description,
            DiscountType = request.DiscountType,
            DiscountValue = request.DiscountValue,
            MinOrderAmount = request.MinOrderAmount,
            MaxDiscountAmount = request.MaxDiscountAmount,
            UsageLimit = request.UsageLimit,
            TimesUsed = 0,
            ValidFrom = request.ValidFrom,
            ValidTo = request.ValidTo,
            IsActive = true,
            MinMemberTier = request.MinMemberTier
        };

        _context.Vouchers.Add(voucher);
        await _context.SaveChangesAsync(ct);

        return new VoucherDto(
            voucher.Id,
            voucher.Code,
            voucher.Title,
            voucher.Description,
            voucher.DiscountType,
            voucher.DiscountValue,
            voucher.MinOrderAmount,
            voucher.MaxDiscountAmount,
            voucher.ValidTo,
            true
        );
    }

    public static decimal GetTierDiscountPercent(MemberTier tier) => tier switch
    {
        MemberTier.Diamond => 15m,
        MemberTier.Gold => 10m,
        MemberTier.Silver => 5m,
        _ => 0m
    };

    public static MemberTier EvaluateTierBySpent(decimal totalSpent)
    {
        if (totalSpent >= 5_000_000m) return MemberTier.Diamond;
        if (totalSpent >= 2_000_000m) return MemberTier.Gold;
        if (totalSpent >= 500_000m) return MemberTier.Silver;
        return MemberTier.Standard;
    }

    private static string NormalizePhone(string phone)
    {
        var clean = new string(phone.Where(char.IsDigit).ToArray());
        if (clean.StartsWith("84") && clean.Length > 9)
        {
            clean = "0" + clean[2..];
        }
        return clean;
    }

    private static CustomerDto MapCustomerToDto(Customer c) => new(
        c.Id,
        c.PhoneNumber,
        c.FullName,
        c.Email,
        c.DateOfBirth,
        c.LoyaltyPoints,
        c.TotalSpent,
        c.MemberTier,
        c.CreatedAt
    );
}
