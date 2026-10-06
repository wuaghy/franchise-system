using Franchise.Domain.Common;

namespace Franchise.Domain.Entities;

public class KitchenTicketItemModifier : BaseEntity
{
    public Guid KitchenTicketItemId { get; set; }
    public KitchenTicketItem? KitchenTicketItem { get; set; }

    public string ModifierName { get; set; } = string.Empty;
    public bool IsChecked { get; set; }

    public void ToggleChecked()
    {
        IsChecked = !IsChecked;
        UpdatedAt = DateTime.UtcNow;
    }
}
