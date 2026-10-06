namespace Franchise.Application.DTOs.Royalty;

public record RoyaltyInvoiceDto(
    Guid Id,
    string InvoiceNumber,
    Guid StoreId,
    string StoreName,
    string StoreCode,
    int BillingYear,
    int BillingMonth,
    string Status,
    int TotalOrdersCount,
    decimal GrossRevenue,
    decimal DiscountAmount,
    decimal NetRevenue,
    decimal RoyaltyRate,
    decimal RoyaltyFee,
    decimal MarketingFeeRate,
    decimal MarketingFee,
    decimal TechFee,
    decimal TotalDue,
    DateTime? IssuedAt,
    DateTime? DueDate,
    DateTime? PaidAt,
    string? PaymentReference,
    string? CancellationReason,
    DateTime CreatedAt
);

public record StoreRoyaltySettingDto(
    Guid StoreId,
    string StoreName,
    decimal RoyaltyRate,
    decimal MarketingFeeRate,
    decimal TechFeeFixedMonthly,
    bool IsActive
);

public record UpdateStoreRoyaltySettingRequest(
    decimal RoyaltyRate,
    decimal MarketingFeeRate,
    decimal TechFeeFixedMonthly,
    bool IsActive
);

public record GenerateRoyaltyInvoiceRequest(
    Guid StoreId,
    int BillingYear,
    int BillingMonth
);

public record PayRoyaltyInvoiceRequest(
    string PaymentReference
);

public record CancelRoyaltyInvoiceRequest(
    string Reason
);
