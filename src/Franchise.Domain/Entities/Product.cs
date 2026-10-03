using Franchise.Domain.Common;

namespace Franchise.Domain.Entities;

public class Product : BaseEntity
{
    public Guid CategoryId { get; set; }
    public Category? Category { get; set; }

    public string Sku { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal BasePrice { get; set; }
    public bool IsAvailable { get; set; } = true;

    // Navigation
    public ICollection<ProductRecipe> Recipes { get; set; } = new List<ProductRecipe>();
    public ICollection<StoreProductPrice> StoreProductPrices { get; set; } = new List<StoreProductPrice>();
    public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
}
