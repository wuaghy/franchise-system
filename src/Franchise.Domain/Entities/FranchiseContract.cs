using Franchise.Domain.Common;

namespace Franchise.Domain.Entities;

public class FranchiseContract : BaseEntity
{
    public Guid StoreId { get; set; }
    public Store? Store { get; set; }

    public string ContractNumber { get; set; } = string.Empty;
    public string SignerName { get; set; } = string.Empty;
    public string SignerIdCard { get; set; } = string.Empty;
    public string SignerTitle { get; set; } = "Chủ chi nhánh nhượng quyền";
    public string SignatureData { get; set; } = string.Empty; // Base64 data PNG

    public decimal RoyaltyRate { get; set; } = 0.05m;
    public decimal MarketingFeeRate { get; set; } = 0.02m;
    public decimal TechFeeFixedMonthly { get; set; } = 2000000m;

    public DateTime SignedAt { get; set; } = DateTime.UtcNow;
    public string Status { get; set; } = "Signed";
}
