using Franchise.Domain.Common;
using Franchise.Domain.Enums;

namespace Franchise.Domain.Entities;

public class Customer : BaseEntity
{
    public string PhoneNumber { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public int LoyaltyPoints { get; set; } = 0;
    public decimal TotalSpent { get; set; } = 0m;
    public MemberTier MemberTier { get; set; } = MemberTier.Standard;

    // Navigation
    public ICollection<Order> Orders { get; set; } = new List<Order>();
    public ICollection<LoyaltyTransaction> LoyaltyTransactions { get; set; } = new List<LoyaltyTransaction>();
}
