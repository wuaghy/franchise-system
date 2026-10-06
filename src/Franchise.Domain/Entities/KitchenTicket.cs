using Franchise.Domain.Common;
using Franchise.Domain.Enums;
using Franchise.Domain.Exceptions;

namespace Franchise.Domain.Entities;

public class KitchenTicket : BaseEntity
{
    public string TicketNumber { get; set; } = string.Empty; // KDS-YYYYMM-XXXX
    public Guid OrderId { get; set; }
    public Order? Order { get; set; }

    public Guid StoreId { get; set; }
    public Store? Store { get; set; }

    public string OrderNumber { get; set; } = string.Empty;
    public OrderType OrderType { get; set; } = OrderType.DineIn;
    public KitchenTicketStatus Status { get; set; } = KitchenTicketStatus.New;

    public int TargetPreparationSeconds { get; set; } = 300; // SLA chuẩn 5 phút (300 giây)
    public DateTime? PreparationStartedAt { get; set; }
    public DateTime? ReadyAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public Guid? BaristaUserId { get; set; }
    public string? CancellationReason { get; set; }

    public ICollection<KitchenTicketItem> Items { get; set; } = new List<KitchenTicketItem>();

    public void StartPreparation(Guid? baristaUserId = null)
    {
        if (Status != KitchenTicketStatus.New)
            throw new BusinessRuleException("INVALID_KDS_STATE", $"Chỉ đơn ở trạng thái 'New' mới có thể bắt đầu pha chế. Trạng thái hiện tại: '{Status}'.");

        Status = KitchenTicketStatus.InPreparation;
        PreparationStartedAt = DateTime.UtcNow;
        BaristaUserId = baristaUserId;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkReady()
    {
        if (Status != KitchenTicketStatus.InPreparation)
            throw new BusinessRuleException("INVALID_KDS_STATE", $"Chỉ đơn đang ở trạng thái 'InPreparation' mới có thể đánh dấu hoàn thành pha chế. Trạng thái hiện tại: '{Status}'.");

        Status = KitchenTicketStatus.Ready;
        ReadyAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Complete()
    {
        if (Status != KitchenTicketStatus.Ready)
            throw new BusinessRuleException("INVALID_KDS_STATE", $"Chỉ đơn đã pha chế xong 'Ready' mới có thể giao cho khách. Trạng thái hiện tại: '{Status}'.");

        Status = KitchenTicketStatus.Completed;
        CompletedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Cancel(string reason)
    {
        if (Status == KitchenTicketStatus.Completed)
            throw new BusinessRuleException("CANNOT_CANCEL_COMPLETED_TICKET", "Không thể hủy vé KDS đã giao cho khách hàng.");

        if (string.IsNullOrWhiteSpace(reason))
            throw new BusinessRuleException("CANCELLATION_REASON_REQUIRED", "Cần cung cấp lý do hủy vé pha chế.");

        Status = KitchenTicketStatus.Cancelled;
        CancellationReason = reason;
        UpdatedAt = DateTime.UtcNow;
    }
}
