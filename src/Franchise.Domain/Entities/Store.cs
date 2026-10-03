using Franchise.Domain.Common;

namespace Franchise.Domain.Entities;

public class Store : BaseEntity
{
    public Guid FranchiseeId { get; set; }
    public Franchisee? Franchisee { get; set; }

    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public string PhoneNumber { get; set; } = string.Empty;
    public TimeSpan? OpeningTime { get; set; }
    public TimeSpan? ClosingTime { get; set; }
    public bool IsActive { get; set; } = true;

    // Navigation properties
    public ICollection<StoreUser> StoreUsers { get; set; } = new List<StoreUser>();
    public ICollection<StoreInventory> StoreInventories { get; set; } = new List<StoreInventory>();
    public ICollection<Order> Orders { get; set; } = new List<Order>();
    public ICollection<StoreProductPrice> StoreProductPrices { get; set; } = new List<StoreProductPrice>();
}
