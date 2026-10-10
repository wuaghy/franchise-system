using Franchise.Domain.Common;

namespace Franchise.Domain.Entities;

public class LoyaltyTransaction : BaseEntity
{
    public Guid CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public Guid? OrderId { get; set; }
    public Order? Order { get; set; }

    public int PointsChange { get; set; } // +10 (Earned), -50 (Redeemed)
    public int PointsBalanceAfter { get; set; }
    public string Reason { get; set; } = string.Empty;
}
