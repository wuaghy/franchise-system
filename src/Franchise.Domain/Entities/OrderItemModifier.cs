using Franchise.Domain.Common;

namespace Franchise.Domain.Entities;

public class OrderItemModifier : BaseEntity
{
    public Guid OrderItemId { get; set; }
    public OrderItem? OrderItem { get; set; }

    public string Name { get; set; } = string.Empty;
    public decimal ExtraPrice { get; set; }
}
