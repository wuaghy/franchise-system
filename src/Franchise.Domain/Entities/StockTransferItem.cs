using Franchise.Domain.Common;

namespace Franchise.Domain.Entities;

public class StockTransferItem : BaseEntity
{
    public Guid TransferOrderId { get; set; }
    public StockTransferOrder? TransferOrder { get; set; }

    public Guid IngredientId { get; set; }
    public Ingredient? Ingredient { get; set; }

    public decimal RequestedQuantity { get; set; }
    public decimal ApprovedQuantity { get; set; }
    public decimal ActualReceivedQuantity { get; set; }
    public decimal DiscrepancyQuantity => ApprovedQuantity - ActualReceivedQuantity;
    public decimal UnitCost { get; set; }
    public string? Notes { get; set; }
}
