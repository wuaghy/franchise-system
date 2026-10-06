using Franchise.Domain.Common;

namespace Franchise.Domain.Entities;

public class StoreRoyaltySetting : BaseEntity
{
    public Guid StoreId { get; set; }
    public Store? Store { get; set; }

    public decimal RoyaltyRate { get; set; } = 0.05m; // 5% Doanh thu thuần
    public decimal MarketingFeeRate { get; set; } = 0.02m; // 2% Quỹ Marketing
    public decimal TechFeeFixedMonthly { get; set; } = 2000000m; // 2,000,000 VND / tháng
    public bool IsActive { get; set; } = true;
}
