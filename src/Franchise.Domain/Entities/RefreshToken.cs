using Franchise.Domain.Common;

namespace Franchise.Domain.Entities;

public class RefreshToken : BaseEntity
{
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public bool IsRevoked { get; set; }
    public string? ReplacedByToken { get; set; }

    public Guid UserId { get; set; }
    public User? User { get; set; }

    public bool IsActive => !IsRevoked && DateTime.UtcNow < ExpiresAt;
}
