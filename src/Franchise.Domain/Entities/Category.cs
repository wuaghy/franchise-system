using Franchise.Domain.Common;

namespace Franchise.Domain.Entities;

public class Category : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public int DisplayOrder { get; set; } = 0;

    // Navigation
    public ICollection<Product> Products { get; set; } = new List<Product>();
}
