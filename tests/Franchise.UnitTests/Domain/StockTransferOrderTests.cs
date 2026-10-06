using FluentAssertions;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Franchise.Domain.Exceptions;
using Xunit;

namespace Franchise.UnitTests.Domain;

public class StockTransferOrderTests
{
    [Fact]
    public void Submit_WhenDraftWithItems_ShouldTransitionToSubmitted()
    {
        // Arrange
        var sto = new StockTransferOrder
        {
            TransferCode = "STO-202610-0001",
            Status = TransferStatus.Draft
        };
        sto.Items.Add(new StockTransferItem
        {
            IngredientId = Guid.NewGuid(),
            RequestedQuantity = 50,
            UnitCost = 10000
        });

        // Act
        sto.Submit();

        // Assert
        sto.Status.Should().Be(TransferStatus.Submitted);
        sto.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public void Submit_WhenItemsEmptyOrZeroQuantity_ShouldThrowBusinessRuleException()
    {
        // Arrange
        var sto = new StockTransferOrder
        {
            TransferCode = "STO-202610-0002",
            Status = TransferStatus.Draft
        };

        // Act
        var act = () => sto.Submit();

        // Assert
        act.Should().Throw<BusinessRuleException>()
            .WithMessage("*phải có ít nhất 1 mặt hàng*");
    }

    [Fact]
    public void Approve_WhenSubmitted_ShouldTransitionToApproved()
    {
        // Arrange
        var approverId = Guid.NewGuid();
        var sto = new StockTransferOrder
        {
            Status = TransferStatus.Submitted
        };

        // Act
        sto.Approve(approverId);

        // Assert
        sto.Status.Should().Be(TransferStatus.Approved);
        sto.ApprovedByUserId.Should().Be(approverId);
    }

    [Fact]
    public void Approve_WhenDraft_ShouldThrowBusinessRuleException()
    {
        // Arrange
        var sto = new StockTransferOrder
        {
            Status = TransferStatus.Draft
        };

        // Act
        var act = () => sto.Approve(Guid.NewGuid());

        // Assert
        act.Should().Throw<BusinessRuleException>()
            .WithMessage("*Chỉ đơn Submitted mới có thể duyệt*");
    }

    [Fact]
    public void Reject_WhenSubmittedWithReason_ShouldTransitionToRejected()
    {
        // Arrange
        var sto = new StockTransferOrder
        {
            Status = TransferStatus.Submitted
        };

        // Act
        sto.Reject("Kho tổng tạm thời hết cà phê Robusta");

        // Assert
        sto.Status.Should().Be(TransferStatus.Rejected);
        sto.RejectionReason.Should().Be("Kho tổng tạm thời hết cà phê Robusta");
    }

    [Fact]
    public void Dispatch_WhenApproved_ShouldSetTrackingAndDispatchedStatus()
    {
        // Arrange
        var sto = new StockTransferOrder
        {
            Status = TransferStatus.Approved
        };

        // Act
        sto.Dispatch("GHTK-9923812");

        // Assert
        sto.Status.Should().Be(TransferStatus.Dispatched);
        sto.DispatchTrackingNumber.Should().Be("GHTK-9923812");
        sto.DispatchedAt.Should().NotBeNull();
    }

    [Fact]
    public void Receive_WhenDispatchedWithoutDiscrepancy_ShouldTransitionToReceived()
    {
        // Arrange
        var sto = new StockTransferOrder
        {
            Status = TransferStatus.Dispatched
        };

        // Act
        sto.Receive(hasDiscrepancy: false);

        // Assert
        sto.Status.Should().Be(TransferStatus.Received);
        sto.ReceivedAt.Should().NotBeNull();
    }

    [Fact]
    public void Receive_WhenDispatchedWithDiscrepancy_ShouldTransitionToDiscrepancyReported()
    {
        // Arrange
        var sto = new StockTransferOrder
        {
            Status = TransferStatus.Dispatched
        };

        // Act
        sto.Receive(hasDiscrepancy: true, "Bị vỡ 2 hộp sữa đặc trong thùng");

        // Assert
        sto.Status.Should().Be(TransferStatus.DiscrepancyReported);
        sto.DiscrepancyNotes.Should().Contain("Bị vỡ 2 hộp sữa đặc");
    }

    [Fact]
    public void ResolveDiscrepancy_WhenDiscrepancyReported_ShouldTransitionToReceived()
    {
        // Arrange
        var sto = new StockTransferOrder
        {
            Status = TransferStatus.DiscrepancyReported,
            DiscrepancyNotes = "Hao hụt 2kg cà phê"
        };

        // Act
        sto.ResolveDiscrepancy("HQ đồng ý bù trừ tiền và trừ hao hụt vận chuyển");

        // Assert
        sto.Status.Should().Be(TransferStatus.Received);
        sto.DiscrepancyNotes.Should().Contain("HQ đồng ý bù trừ");
    }

    [Fact]
    public void Cancel_WhenAlreadyDispatched_ShouldThrowBusinessRuleException()
    {
        // Arrange
        var sto = new StockTransferOrder
        {
            Status = TransferStatus.Dispatched
        };

        // Act
        var act = () => sto.Cancel();

        // Assert
        act.Should().Throw<BusinessRuleException>()
            .WithMessage("*Không thể hủy đơn đã xuất kho*");
    }
}
