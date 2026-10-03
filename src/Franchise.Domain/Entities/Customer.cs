using Franchise.Domain.Common;
using Franchise.Domain.Enums;

namespace Franchise.Domain.Entities;

public class Customer : BaseEntity
{
    public string PhoneNumber { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public int LoyaltyPoints { get; set; } = 0;
    public MemberTier MemberTier { get; set; } = MemberTier.Standard;

    // Navigation
    public ICollection<Order> Orders { get; set; } = new List<Order>();
}
