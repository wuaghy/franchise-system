using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Franchise.Application.Common.Interfaces;
using Franchise.Domain.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace Franchise.Infrastructure.Auth;

public class JwtTokenGenerator : IJwtTokenGenerator
{
    private readonly IConfiguration _configuration;

    public JwtTokenGenerator(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public (string Token, DateTime ExpiresAt) GenerateAccessToken(User user)
    {
        var secret = _configuration["Jwt:Secret"] 
            ?? "EnterpriseFranchiseSystemSuperSecretKey2026!MustBeAtLeast32CharsLong";
        var issuer = _configuration["Jwt:Issuer"] ?? "FranchiseApi";
        var audience = _configuration["Jwt:Audience"] ?? "FranchiseApp";
        var expirationMinutes = int.TryParse(_configuration["Jwt:AccessTokenExpirationMinutes"], out var mins) ? mins : 60;

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, user.Role.ToString()),
            new("role", user.Role.ToString()),
            new("fullName", user.FullName)
        };

        if (user.StoreId.HasValue)
        {
            claims.Add(new Claim("store_id", user.StoreId.Value.ToString()));
        }

        if (user.FranchiseeId.HasValue)
        {
            claims.Add(new Claim("franchisee_id", user.FranchiseeId.Value.ToString()));
        }

        var expiresAt = DateTime.UtcNow.AddMinutes(expirationMinutes);

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = expiresAt,
            Issuer = issuer,
            Audience = audience,
            SigningCredentials = credentials
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var securityToken = tokenHandler.CreateToken(tokenDescriptor);
        var tokenString = tokenHandler.WriteToken(securityToken);

        return (tokenString, expiresAt);
    }

    public RefreshToken GenerateRefreshToken(Guid userId)
    {
        var expirationDays = int.TryParse(_configuration["Jwt:RefreshTokenExpirationDays"], out var days) ? days : 7;
        var randomBytes = RandomNumberGenerator.GetBytes(64);
        var token = Convert.ToBase64String(randomBytes);

        return new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Token = token,
            ExpiresAt = DateTime.UtcNow.AddDays(expirationDays),
            IsRevoked = false,
            CreatedAt = DateTime.UtcNow
        };
    }
}
