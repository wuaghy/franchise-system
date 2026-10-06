using FluentAssertions;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Franchise.Domain.Exceptions;
using Xunit;

namespace Franchise.UnitTests.Domain;

public class RoyaltyInvoiceTests
{
    [Fact]
    public void CalculateFees_WhenValidAmounts_ShouldComputeCorrectFeesAndTotalDue()
    {
        // Arrange
        var invoice = new RoyaltyInvoice
        {
            Id = Guid.NewGuid(),
            InvoiceNumber = "ROY-202610-0001",
            StoreId = Guid.NewGuid(),
            BillingYear = 2026,
            BillingMonth = 10,
            Status = RoyaltyInvoiceStatus.Draft
        };

        // Act
        // Gross: 100,000,000 VND, Discount: 10,000,000 VND -> Net: 90,000,000 VND
        // Royalty 5% (4,500,000 VND), Marketing 2% (1,800,000 VND), TechFee 2,000,000 VND
        invoice.CalculateFees(
            grossRevenue: 100_000_000m,
            discountAmount: 10_000_000m,
            totalOrders: 1500,
            royaltyRate: 0.05m,
            marketingFeeRate: 0.02m,
            techFee: 2_000_000m
        );

        // Assert
        invoice.GrossRevenue.Should().Be(100_000_000m);
        invoice.DiscountAmount.Should().Be(10_000_000m);
        invoice.NetRevenue.Should().Be(90_000_000m);
        invoice.RoyaltyFee.Should().Be(4_500_000m);
        invoice.MarketingFee.Should().Be(1_800_000m);
        invoice.TechFee.Should().Be(2_000_000m);
        invoice.TotalDue.Should().Be(8_300_000m);
        invoice.TotalOrdersCount.Should().Be(1500);
    }

    [Fact]
    public void CalculateFees_WhenStatusNotDraft_ShouldThrowBusinessRuleException()
    {
        // Arrange
        var invoice = new RoyaltyInvoice
        {
            Status = RoyaltyInvoiceStatus.Issued
        };

        // Act
        var act = () => invoice.CalculateFees(100_000_000m, 0m, 100, 0.05m, 0.02m, 2_000_000m);

        // Assert
        act.Should().Throw<BusinessRuleException>()
            .Where(e => e.ErrorCode == "INVALID_INVOICE_STATE");
    }

    [Fact]
    public void Issue_WhenValidDraftWithTotalDue_ShouldTransitionToIssued()
    {
        // Arrange
        var invoice = new RoyaltyInvoice
        {
            Status = RoyaltyInvoiceStatus.Draft
        };
        invoice.CalculateFees(10_000_000m, 0m, 100, 0.05m, 0.02m, 2_000_000m);

        // Act
        invoice.Issue();

        // Assert
        invoice.Status.Should().Be(RoyaltyInvoiceStatus.Issued);
        invoice.IssuedAt.Should().NotBeNull();
        invoice.DueDate.Should().NotBeNull();
        invoice.DueDate.Value.Should().BeAfter(invoice.IssuedAt.Value);
    }

    [Fact]
    public void Issue_WhenTotalDueIsZero_ShouldThrowBusinessRuleException()
    {
        // Arrange
        var invoice = new RoyaltyInvoice
        {
            Status = RoyaltyInvoiceStatus.Draft,
            TotalDue = 0m
        };

        // Act
        var act = () => invoice.Issue();

        // Assert
        act.Should().Throw<BusinessRuleException>()
            .Where(e => e.ErrorCode == "ZERO_DUE_INVOICE");
    }

    [Fact]
    public void MarkPaid_WhenIssued_ShouldTransitionToPaidWithReference()
    {
        // Arrange
        var invoice = new RoyaltyInvoice
        {
            Status = RoyaltyInvoiceStatus.Draft
        };
        invoice.CalculateFees(10_000_000m, 0m, 100, 0.05m, 0.02m, 2_000_000m);
        invoice.Issue();

        // Act
        invoice.MarkPaid("VCB-TXN-99887766");

        // Assert
        invoice.Status.Should().Be(RoyaltyInvoiceStatus.Paid);
        invoice.PaymentReference.Should().Be("VCB-TXN-99887766");
        invoice.PaidAt.Should().NotBeNull();
    }

    [Fact]
    public void MarkPaid_WithoutReference_ShouldThrowBusinessRuleException()
    {
        // Arrange
        var invoice = new RoyaltyInvoice
        {
            Status = RoyaltyInvoiceStatus.Draft
        };
        invoice.CalculateFees(10_000_000m, 0m, 100, 0.05m, 0.02m, 2_000_000m);
        invoice.Issue();

        // Act
        var act = () => invoice.MarkPaid("");

        // Assert
        act.Should().Throw<BusinessRuleException>()
            .Where(e => e.ErrorCode == "PAYMENT_REFERENCE_REQUIRED");
    }

    [Fact]
    public void Cancel_WhenPaid_ShouldThrowBusinessRuleException()
    {
        // Arrange
        var invoice = new RoyaltyInvoice
        {
            Status = RoyaltyInvoiceStatus.Paid
        };

        // Act
        var act = () => invoice.Cancel("Lỗi tính trùng");

        // Assert
        act.Should().Throw<BusinessRuleException>()
            .Where(e => e.ErrorCode == "CANNOT_CANCEL_PAID_INVOICE");
    }

    [Fact]
    public void Cancel_WhenDraftOrIssued_ShouldTransitionToCancelled()
    {
        // Arrange
        var invoice = new RoyaltyInvoice
        {
            Status = RoyaltyInvoiceStatus.Issued
        };

        // Act
        invoice.Cancel("Chủ nhượng quyền thay đổi hợp đồng");

        // Assert
        invoice.Status.Should().Be(RoyaltyInvoiceStatus.Cancelled);
        invoice.CancellationReason.Should().Be("Chủ nhượng quyền thay đổi hợp đồng");
    }

    [Fact]
    public void CheckOverdue_WhenDueDatePassed_ShouldTransitionToOverdue()
    {
        // Arrange
        var invoice = new RoyaltyInvoice
        {
            Status = RoyaltyInvoiceStatus.Issued,
            DueDate = DateTime.UtcNow.AddDays(-1)
        };

        // Act
        invoice.CheckOverdue();

        // Assert
        invoice.Status.Should().Be(RoyaltyInvoiceStatus.Overdue);
    }
}
