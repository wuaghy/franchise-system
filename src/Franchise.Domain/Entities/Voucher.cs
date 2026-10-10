using Franchise.Domain.Common;
using Franchise.Domain.Enums;

namespace Franchise.Domain.Entities;

public class Voucher : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DiscountType DiscountType { get; set; } = DiscountType.Percentage;
    public decimal DiscountValue { get; set; } // e.g. 15 (%) or 30000 (VND)
    public decimal MinOrderAmount { get; set; } = 0m;
    public decimal? MaxDiscountAmount { get; set; } // Capped discount for percentage vouchers
    public int UsageLimit { get; set; } = 1000;
    public int TimesUsed { get; set; } = 0;
    public DateTime ValidFrom { get; set; }
    public DateTime ValidTo { get; set; }
    public bool IsActive { get; set; } = true;
    public MemberTier? MinMemberTier { get; set; } // Áp dụng cho hạng Bạc/Vàng/Kim Cương trở lên
}
