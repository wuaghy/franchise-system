using Franchise.Domain.Common;
using Franchise.Domain.Enums;

namespace Franchise.Domain.Entities;

public class WarehouseInventoryTransaction : BaseEntity
{
    public Guid WarehouseId { get; set; }
    public Warehouse? Warehouse { get; set; }

    public Guid IngredientId { get; set; }
    public Ingredient? Ingredient { get; set; }

    public decimal QuantityChange { get; set; } // Dương (+) khi nhập, Âm (-) khi xuất
    public decimal BalanceAfter { get; set; }    // Số dư sau giao dịch (Snapshot)
    public WarehouseTransactionType TransactionType { get; set; }
    public string ReferenceNumber { get; set; } = string.Empty; // STO Code hoặc Supplier PO Code
    public string Note { get; set; } = string.Empty;
}
