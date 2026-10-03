using Franchise.Domain.Common;
using Franchise.Domain.Enums;

namespace Franchise.Domain.Entities;

public class StoreUser : BaseEntity
{
    public Guid StoreId { get; set; }
    public Store? Store { get; set; }

    public string FullName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public StoreRole Role { get; set; } = StoreRole.Cashier;
}
