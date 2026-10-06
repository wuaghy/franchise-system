namespace Franchise.Application.Common.Interfaces;

public interface ICurrentUserService
{
    Guid? UserId { get; }
    string? Username { get; }
    string? Role { get; }
    Guid? StoreId { get; }
    Guid? FranchiseeId { get; }
    bool IsSuperAdmin { get; }
}
