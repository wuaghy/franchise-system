using Franchise.Domain.Common;

namespace Franchise.Domain.Entities;

public class WarehouseInventory : BaseEntity
{
    public Guid WarehouseId { get; set; }
    public Warehouse? Warehouse { get; set; }

    public Guid IngredientId { get; set; }
    public Ingredient? Ingredient { get; set; }

    public decimal CurrentStock { get; set; }
    public decimal SafetyStock { get; set; }
    public DateTime? LastRestockedAt { get; set; }
}
