using Franchise.Domain.Entities;

namespace Franchise.Application.Common.Interfaces;

public interface IJwtTokenGenerator
{
    (string Token, DateTime ExpiresAt) GenerateAccessToken(User user);
    RefreshToken GenerateRefreshToken(Guid userId);
}
