using Franchise.Domain.Common;

namespace Franchise.Domain.Entities;

public class KitchenTicketItem : BaseEntity
{
    public Guid KitchenTicketId { get; set; }
    public KitchenTicket? KitchenTicket { get; set; }

    public Guid OrderItemId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public int Quantity { get; set; } = 1;
    public string SpecialNote { get; set; } = string.Empty;
    public bool IsPrepared { get; set; }

    public ICollection<KitchenTicketItemModifier> Modifiers { get; set; } = new List<KitchenTicketItemModifier>();

    public void TogglePrepared()
    {
        IsPrepared = !IsPrepared;
        UpdatedAt = DateTime.UtcNow;
    }
}
