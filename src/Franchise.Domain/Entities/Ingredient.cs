using Franchise.Domain.Common;

namespace Franchise.Domain.Entities;

public class Ingredient : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty; // gram, ml, piece
    public decimal StandardCost { get; set; }

    // Navigation
    public ICollection<ProductRecipe> ProductRecipes { get; set; } = new List<ProductRecipe>();
    public ICollection<StoreInventory> StoreInventories { get; set; } = new List<StoreInventory>();
    public ICollection<InventoryTransaction> InventoryTransactions { get; set; } = new List<InventoryTransaction>();
}
