using Franchise.Domain.Enums;

namespace Franchise.Application.DTOs.Loyalty;

public record CustomerDto(
    Guid Id,
    string PhoneNumber,
    string FullName,
    string? Email,
    DateTime? DateOfBirth,
    int LoyaltyPoints,
    decimal TotalSpent,
    MemberTier MemberTier,
    DateTime CreatedAt
);

public record CustomerLookupResponse(
    bool Found,
    CustomerDto? Customer,
    decimal TierDiscountPercent,
    IReadOnlyList<VoucherDto> AvailableVouchers
);

public record RegisterCustomerRequest(
    string PhoneNumber,
    string FullName,
    string? Email = null,
    DateTime? DateOfBirth = null
);

public record VoucherDto(
    Guid Id,
    string Code,
    string Title,
    string? Description,
    DiscountType DiscountType,
    decimal DiscountValue,
    decimal MinOrderAmount,
    decimal? MaxDiscountAmount,
    DateTime ValidTo,
    bool IsApplicable
);

public record ApplyPromotionRequest(
    string? PhoneNumber,
    string? VoucherCode,
    int PointsToRedeem,
    decimal Subtotal
);

public record ApplyPromotionResponse(
    bool Success,
    string Message,
    decimal TierDiscountAmount,
    decimal VoucherDiscountAmount,
    decimal PointsDiscountAmount,
    decimal TotalDiscountAmount,
    int PointsRedeemed,
    CustomerDto? Customer,
    VoucherDto? AppliedVoucher
);

public record CreateVoucherRequest(
    string Code,
    string Title,
    string? Description,
    DiscountType DiscountType,
    decimal DiscountValue,
    decimal MinOrderAmount,
    decimal? MaxDiscountAmount,
    int UsageLimit,
    DateTime ValidFrom,
    DateTime ValidTo,
    MemberTier? MinMemberTier = null
);
