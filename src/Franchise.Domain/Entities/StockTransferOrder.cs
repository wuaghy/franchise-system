using Franchise.Domain.Common;
using Franchise.Domain.Enums;
using Franchise.Domain.Exceptions;

namespace Franchise.Domain.Entities;

public class StockTransferOrder : BaseEntity
{
    public string TransferCode { get; set; } = string.Empty; // STO-YYYYMM-XXXX
    public Guid SourceWarehouseId { get; set; }
    public Warehouse? SourceWarehouse { get; set; }

    public Guid DestinationStoreId { get; set; }
    public Store? DestinationStore { get; set; }

    public TransferStatus Status { get; set; } = TransferStatus.Draft;
    public string? DispatchTrackingNumber { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public DateTime? DispatchedAt { get; set; }
    public DateTime? ReceivedAt { get; set; }

    public Guid CreatedByUserId { get; set; }
    public Guid? ApprovedByUserId { get; set; }
    public string? Notes { get; set; }
    public string? RejectionReason { get; set; }
    public string? DiscrepancyNotes { get; set; }

    public ICollection<StockTransferItem> Items { get; set; } = new List<StockTransferItem>();

    public void Submit()
    {
        if (Status != TransferStatus.Draft)
            throw new BusinessRuleException("INVALID_STATE_TRANSITION", $"Không thể trình duyệt đơn đang ở trạng thái '{Status}'. Chỉ đơn Draft mới có thể trình duyệt.");

        if (Items.Count == 0 || Items.All(i => i.RequestedQuantity <= 0))
            throw new BusinessRuleException("EMPTY_TRANSFER_ORDER", "Đơn điều chuyển phải có ít nhất 1 mặt hàng với số lượng yêu cầu lớn hơn 0.");

        Status = TransferStatus.Submitted;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Approve(Guid approvedByUserId)
    {
        if (Status != TransferStatus.Submitted)
            throw new BusinessRuleException("INVALID_STATE_TRANSITION", $"Không thể duyệt đơn đang ở trạng thái '{Status}'. Chỉ đơn Submitted mới có thể duyệt.");

        Status = TransferStatus.Approved;
        ApprovedByUserId = approvedByUserId;
        ApprovedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Reject(string reason)
    {
        if (Status != TransferStatus.Submitted)
            throw new BusinessRuleException("INVALID_STATE_TRANSITION", $"Không thể từ chối đơn đang ở trạng thái '{Status}'. Chỉ đơn Submitted mới có thể từ chối.");

        if (string.IsNullOrWhiteSpace(reason))
            throw new BusinessRuleException("REJECTION_REASON_REQUIRED", "Cần cung cấp lý do từ chối đơn điều chuyển.");

        Status = TransferStatus.Rejected;
        RejectionReason = reason;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Dispatch(string trackingNumber)
    {
        if (Status != TransferStatus.Approved)
            throw new BusinessRuleException("INVALID_STATE_TRANSITION", $"Không thể xuất kho đơn đang ở trạng thái '{Status}'. Chỉ đơn Approved mới có thể xuất kho.");

        Status = TransferStatus.Dispatched;
        DispatchTrackingNumber = trackingNumber;
        DispatchedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Receive(bool hasDiscrepancy, string? inspectionNotes = null)
    {
        if (Status != TransferStatus.Dispatched)
            throw new BusinessRuleException("INVALID_STATE_TRANSITION", $"Không thể nghiệm thu đơn đang ở trạng thái '{Status}'. Chỉ đơn Dispatched mới có thể nghiệm thu.");

        Status = hasDiscrepancy ? TransferStatus.DiscrepancyReported : TransferStatus.Received;
        ReceivedAt = DateTime.UtcNow;
        DiscrepancyNotes = inspectionNotes;
        UpdatedAt = DateTime.UtcNow;
    }

    public void ResolveDiscrepancy(string resolutionNotes)
    {
        if (Status != TransferStatus.DiscrepancyReported)
            throw new BusinessRuleException("INVALID_STATE_TRANSITION", $"Chỉ đơn ở trạng thái DiscrepancyReported mới có thể xử lý biên bản lệch kho.");

        Status = TransferStatus.Received;
        DiscrepancyNotes = string.IsNullOrWhiteSpace(DiscrepancyNotes)
            ? $"Đã giải quyết: {resolutionNotes}"
            : $"{DiscrepancyNotes} | Đã giải quyết: {resolutionNotes}";
        UpdatedAt = DateTime.UtcNow;
    }

    public void Cancel()
    {
        if (Status == TransferStatus.Dispatched || Status == TransferStatus.Received)
            throw new BusinessRuleException("CANNOT_CANCEL_DISPATCHED_ORDER", $"Không thể hủy đơn đã xuất kho hoặc đã nhận hàng (Trạng thái hiện tại: '{Status}').");

        Status = TransferStatus.Cancelled;
        UpdatedAt = DateTime.UtcNow;
    }
}
