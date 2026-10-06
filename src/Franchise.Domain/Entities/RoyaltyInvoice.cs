using Franchise.Domain.Common;
using Franchise.Domain.Enums;
using Franchise.Domain.Exceptions;

namespace Franchise.Domain.Entities;

public class RoyaltyInvoice : BaseEntity
{
    public string InvoiceNumber { get; set; } = string.Empty; // ROY-YYYYMM-XXXX
    public Guid StoreId { get; set; }
    public Store? Store { get; set; }

    public int BillingYear { get; set; }
    public int BillingMonth { get; set; }
    public RoyaltyInvoiceStatus Status { get; set; } = RoyaltyInvoiceStatus.Draft;

    public int TotalOrdersCount { get; set; }
    public decimal GrossRevenue { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal NetRevenue { get; set; }

    public decimal RoyaltyRate { get; set; } = 0.05m;
    public decimal RoyaltyFee { get; set; }

    public decimal MarketingFeeRate { get; set; } = 0.02m;
    public decimal MarketingFee { get; set; }

    public decimal TechFee { get; set; }
    public decimal TotalDue { get; set; }

    public DateTime? IssuedAt { get; set; }
    public DateTime? DueDate { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? PaymentReference { get; set; }
    public string? CancellationReason { get; set; }

    public void CalculateFees(
        decimal grossRevenue,
        decimal discountAmount,
        int totalOrders,
        decimal royaltyRate,
        decimal marketingFeeRate,
        decimal techFee)
    {
        if (Status != RoyaltyInvoiceStatus.Draft)
            throw new BusinessRuleException("INVALID_INVOICE_STATE", $"Chỉ hóa đơn ở trạng thái 'Draft' mới có thể tính toán lại chi phí. Trạng thái hiện tại: '{Status}'.");

        if (grossRevenue < 0 || discountAmount < 0)
            throw new BusinessRuleException("INVALID_INVOICE_AMOUNT", "Doanh thu hoặc chiết khấu không được là số âm.");

        TotalOrdersCount = totalOrders;
        GrossRevenue = grossRevenue;
        DiscountAmount = discountAmount;
        NetRevenue = Math.Max(0m, grossRevenue - discountAmount);

        RoyaltyRate = royaltyRate;
        MarketingFeeRate = marketingFeeRate;

        RoyaltyFee = Math.Round(NetRevenue * royaltyRate, 0);
        MarketingFee = Math.Round(NetRevenue * marketingFeeRate, 0);
        TechFee = Math.Max(0m, techFee);

        TotalDue = RoyaltyFee + MarketingFee + TechFee;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Issue()
    {
        if (Status != RoyaltyInvoiceStatus.Draft)
            throw new BusinessRuleException("INVALID_INVOICE_STATE", $"Chỉ hóa đơn ở trạng thái 'Draft' mới có thể phát hành. Trạng thái hiện tại: '{Status}'.");

        if (TotalDue <= 0)
            throw new BusinessRuleException("ZERO_DUE_INVOICE", "Không thể phát hành hóa đơn có số tiền cần thanh toán bằng 0.");

        Status = RoyaltyInvoiceStatus.Issued;
        IssuedAt = DateTime.UtcNow;
        DueDate = DateTime.UtcNow.AddDays(15); // Hạn thanh toán 15 ngày
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkPaid(string paymentReference)
    {
        if (Status != RoyaltyInvoiceStatus.Issued && Status != RoyaltyInvoiceStatus.Overdue)
            throw new BusinessRuleException("INVALID_INVOICE_STATE", $"Chỉ hóa đơn 'Issued' hoặc 'Overdue' mới có thể ghi nhận thanh toán. Trạng thái hiện tại: '{Status}'.");

        if (string.IsNullOrWhiteSpace(paymentReference))
            throw new BusinessRuleException("PAYMENT_REFERENCE_REQUIRED", "Cần cung cấp mã tham chiếu giao dịch thanh toán.");

        Status = RoyaltyInvoiceStatus.Paid;
        PaidAt = DateTime.UtcNow;
        PaymentReference = paymentReference;
        UpdatedAt = DateTime.UtcNow;
    }

    public void CheckOverdue()
    {
        if (Status == RoyaltyInvoiceStatus.Issued && DueDate.HasValue && DateTime.UtcNow > DueDate.Value)
        {
            Status = RoyaltyInvoiceStatus.Overdue;
            UpdatedAt = DateTime.UtcNow;
        }
    }

    public void Cancel(string reason)
    {
        if (Status == RoyaltyInvoiceStatus.Paid)
            throw new BusinessRuleException("CANNOT_CANCEL_PAID_INVOICE", "Không thể hủy hóa đơn phí nhượng quyền đã được thanh toán.");

        if (string.IsNullOrWhiteSpace(reason))
            throw new BusinessRuleException("CANCELLATION_REASON_REQUIRED", "Cần cung cấp lý do hủy hóa đơn phí nhượng quyền.");

        Status = RoyaltyInvoiceStatus.Cancelled;
        CancellationReason = reason;
        UpdatedAt = DateTime.UtcNow;
    }
}
