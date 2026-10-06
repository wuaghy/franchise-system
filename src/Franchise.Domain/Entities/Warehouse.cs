using Franchise.Domain.Common;

namespace Franchise.Domain.Entities;

public class Warehouse : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;

    public ICollection<WarehouseInventory> Inventories { get; set; } = new List<WarehouseInventory>();
    public ICollection<StockTransferOrder> OutboundTransfers { get; set; } = new List<StockTransferOrder>();
}
