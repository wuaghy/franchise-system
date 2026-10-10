using Franchise.Domain.Common;
using Franchise.Domain.Enums;

namespace Franchise.Domain.Entities;

public class ShiftCashMovement : BaseEntity
{
    public Guid ShiftId { get; set; }
    public Shift? Shift { get; set; }

    public decimal Amount { get; set; }
    public CashMovementType Type { get; set; }
    public string Reason { get; set; } = string.Empty;

    public Guid CreatedByUserId { get; set; }
    public StoreUser? CreatedByUser { get; set; }
}
