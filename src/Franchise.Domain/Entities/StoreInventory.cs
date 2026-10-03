using Franchise.Domain.Common;

namespace Franchise.Domain.Entities;

public class StoreInventory : BaseEntity
{
    public Guid StoreId { get; set; }
    public Store? Store { get; set; }

    public Guid IngredientId { get; set; }
    public Ingredient? Ingredient { get; set; }

    public decimal CurrentStock { get; set; }
    public decimal MinAlertThreshold { get; set; }
    public DateTime? LastCountedAt { get; set; }
}
