using Franchise.Domain.Common;
using Franchise.Domain.Enums;

namespace Franchise.Domain.Entities;

public class InventoryTransaction : BaseEntity
{
    public Guid StoreId { get; set; }
    public Store? Store { get; set; }

    public Guid IngredientId { get; set; }
    public Ingredient? Ingredient { get; set; }

    public InventoryTransactionType TransactionType { get; set; }
    public decimal QuantityChange { get; set; }  // Tăng (+) hoặc giảm (-)
    public decimal BalanceAfter { get; set; }     // Số dư kho sau giao dịch (Snapshot)
    public string Note { get; set; } = string.Empty;
}
