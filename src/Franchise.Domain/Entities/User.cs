using Franchise.Domain.Common;
using Franchise.Domain.Enums;

namespace Franchise.Domain.Entities;

public class User : BaseEntity
{
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.POS_Cashier;

    // Chi nhánh hoặc Chủ đầu tư được phân quyền
    public Guid? FranchiseeId { get; set; }
    public Franchisee? Franchisee { get; set; }

    public Guid? StoreId { get; set; }
    public Store? Store { get; set; }

    public bool IsActive { get; set; } = true;

    // Refresh Tokens
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}
