using Franchise.Domain.Common;
using Franchise.Domain.Enums;

namespace Franchise.Domain.Entities;

public class Payment : BaseEntity
{
    public Guid OrderId { get; set; }
    public Order? Order { get; set; }

    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.Cash;
    public decimal Amount { get; set; }
    public string TransactionReference { get; set; } = string.Empty;
    public PaymentStatus Status { get; set; } = PaymentStatus.Success;
    public DateTime? PaidAt { get; set; }
}
