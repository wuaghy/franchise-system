using Franchise.Domain.Common;

namespace Franchise.Domain.Entities;

public class StoreProductPrice : BaseEntity
{
    public Guid StoreId { get; set; }
    public Store? Store { get; set; }

    public Guid ProductId { get; set; }
    public Product? Product { get; set; }

    public decimal CustomPrice { get; set; }
}
