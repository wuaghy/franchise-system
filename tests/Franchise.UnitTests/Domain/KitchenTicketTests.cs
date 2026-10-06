using FluentAssertions;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Franchise.Domain.Exceptions;
using Xunit;

namespace Franchise.UnitTests.Domain;

public class KitchenTicketTests
{
    [Fact]
    public void StartPreparation_WhenNew_ShouldTransitionToInPreparation()
    {
        // Arrange
        var baristaId = Guid.NewGuid();
        var ticket = new KitchenTicket
        {
            TicketNumber = "KDS-202610-001",
            Status = KitchenTicketStatus.New
        };

        // Act
        ticket.StartPreparation(baristaId);

        // Assert
        ticket.Status.Should().Be(KitchenTicketStatus.InPreparation);
        ticket.PreparationStartedAt.Should().NotBeNull();
        ticket.BaristaUserId.Should().Be(baristaId);
        ticket.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public void StartPreparation_WhenNotNew_ShouldThrowBusinessRuleException()
    {
        // Arrange
        var ticket = new KitchenTicket
        {
            Status = KitchenTicketStatus.Ready
        };

        // Act
        var act = () => ticket.StartPreparation();

        // Assert
        act.Should().Throw<BusinessRuleException>()
            .WithMessage("*Chỉ đơn ở trạng thái 'New'*");
    }

    [Fact]
    public void MarkReady_WhenInPreparation_ShouldTransitionToReady()
    {
        // Arrange
        var ticket = new KitchenTicket
        {
            Status = KitchenTicketStatus.InPreparation,
            PreparationStartedAt = DateTime.UtcNow.AddMinutes(-3)
        };

        // Act
        ticket.MarkReady();

        // Assert
        ticket.Status.Should().Be(KitchenTicketStatus.Ready);
        ticket.ReadyAt.Should().NotBeNull();
    }

    [Fact]
    public void MarkReady_WhenNew_ShouldThrowBusinessRuleException()
    {
        // Arrange
        var ticket = new KitchenTicket
        {
            Status = KitchenTicketStatus.New
        };

        // Act
        var act = () => ticket.MarkReady();

        // Assert
        act.Should().Throw<BusinessRuleException>()
            .WithMessage("*Chỉ đơn đang ở trạng thái 'InPreparation'*");
    }

    [Fact]
    public void Complete_WhenReady_ShouldTransitionToCompleted()
    {
        // Arrange
        var ticket = new KitchenTicket
        {
            Status = KitchenTicketStatus.Ready,
            ReadyAt = DateTime.UtcNow.AddMinutes(-1)
        };

        // Act
        ticket.Complete();

        // Assert
        ticket.Status.Should().Be(KitchenTicketStatus.Completed);
        ticket.CompletedAt.Should().NotBeNull();
    }

    [Fact]
    public void Complete_WhenInPreparation_ShouldThrowBusinessRuleException()
    {
        // Arrange
        var ticket = new KitchenTicket
        {
            Status = KitchenTicketStatus.InPreparation
        };

        // Act
        var act = () => ticket.Complete();

        // Assert
        act.Should().Throw<BusinessRuleException>()
            .WithMessage("*Chỉ đơn đã pha chế xong 'Ready'*");
    }

    [Fact]
    public void Cancel_WhenValid_ShouldTransitionToCancelled()
    {
        // Arrange
        var ticket = new KitchenTicket
        {
            Status = KitchenTicketStatus.InPreparation
        };

        // Act
        ticket.Cancel("Khách đổi ý không lấy món");

        // Assert
        ticket.Status.Should().Be(KitchenTicketStatus.Cancelled);
        ticket.CancellationReason.Should().Be("Khách đổi ý không lấy món");
    }

    [Fact]
    public void Cancel_WhenAlreadyCompleted_ShouldThrowBusinessRuleException()
    {
        // Arrange
        var ticket = new KitchenTicket
        {
            Status = KitchenTicketStatus.Completed
        };

        // Act
        var act = () => ticket.Cancel("Hủy sau khi giao");

        // Assert
        act.Should().Throw<BusinessRuleException>()
            .WithMessage("*Không thể hủy vé KDS đã giao cho khách*");
    }

    [Fact]
    public void ToggleItemPrepared_ShouldInvertState()
    {
        // Arrange
        var item = new KitchenTicketItem
        {
            ProductName = "Phin Sữa Đá",
            IsPrepared = false
        };

        // Act & Assert
        item.TogglePrepared();
        item.IsPrepared.Should().BeTrue();

        item.TogglePrepared();
        item.IsPrepared.Should().BeFalse();
    }

    [Fact]
    public void ToggleModifierChecked_ShouldInvertState()
    {
        // Arrange
        var mod = new KitchenTicketItemModifier
        {
            ModifierName = "70% Đường",
            IsChecked = false
        };

        // Act & Assert
        mod.ToggleChecked();
        mod.IsChecked.Should().BeTrue();

        mod.ToggleChecked();
        mod.IsChecked.Should().BeFalse();
    }
}
