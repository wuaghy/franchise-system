using Franchise.Domain.Common;

namespace Franchise.Domain.Entities;

public class ProductRecipe : BaseEntity
{
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }

    public Guid IngredientId { get; set; }
    public Ingredient? Ingredient { get; set; }

    public decimal Quantity { get; set; } // Định lượng tiêu hao (ví dụ: 25.0000 gram, 40.0000 ml)
}
