using Franchise.Domain.Common;

namespace Franchise.Domain.Entities;

public class Franchisee : BaseEntity
{
    public string CompanyName { get; set; } = string.Empty;
    public string TaxCode { get; set; } = string.Empty;
    public decimal RevenueSharePercentage { get; set; } = 5.0m;
    public DateTime ContractSignedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;

    // Navigation
    public ICollection<Store> Stores { get; set; } = new List<Store>();
}
