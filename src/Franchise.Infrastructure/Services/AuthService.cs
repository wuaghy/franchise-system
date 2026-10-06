using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Auth;
using Franchise.Domain.Entities;
using Franchise.Domain.Exceptions;
using Franchise.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Franchise.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly AppDbContext _context;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenGenerator _jwtTokenGenerator;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        AppDbContext context,
        IPasswordHasher passwordHasher,
        IJwtTokenGenerator jwtTokenGenerator,
        ILogger<AuthService> logger)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _jwtTokenGenerator = jwtTokenGenerator;
        _logger = logger;
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Username == request.Username || u.Email == request.Username, ct);

        if (user == null || !_passwordHasher.VerifyPassword(request.Password, user.PasswordHash))
        {
            throw new UnauthorizedException("INVALID_CREDENTIALS", "Tên đăng nhập hoặc mật khẩu không chính xác.");
        }

        if (!user.IsActive)
        {
            throw new UnauthorizedException("ACCOUNT_INACTIVE", "Tài khoản của bạn đã bị khóa hoặc ngừng hoạt động.");
        }

        var (accessToken, expiresAt) = _jwtTokenGenerator.GenerateAccessToken(user);
        var refreshToken = _jwtTokenGenerator.GenerateRefreshToken(user.Id);

        _context.RefreshTokens.Add(refreshToken);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Người dùng {Username} ({Role}) đăng nhập thành công.", user.Username, user.Role);

        return new AuthResponse(
            accessToken,
            refreshToken.Token,
            expiresAt,
            MapToDto(user)
        );
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken ct = default)
    {
        var usernameExists = await _context.Users.AnyAsync(u => u.Username == request.Username, ct);
        if (usernameExists)
        {
            throw new ConflictException("USERNAME_EXISTS", $"Tên đăng nhập '{request.Username}' đã tồn tại.");
        }

        var emailExists = await _context.Users.AnyAsync(u => u.Email == request.Email, ct);
        if (emailExists)
        {
            throw new ConflictException("EMAIL_EXISTS", $"Email '{request.Email}' đã được sử dụng.");
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = request.Username,
            Email = request.Email,
            FullName = request.FullName,
            PasswordHash = _passwordHasher.HashPassword(request.Password),
            Role = request.Role,
            StoreId = request.StoreId,
            FranchiseeId = request.FranchiseeId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);

        var (accessToken, expiresAt) = _jwtTokenGenerator.GenerateAccessToken(user);
        var refreshToken = _jwtTokenGenerator.GenerateRefreshToken(user.Id);

        _context.RefreshTokens.Add(refreshToken);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Người dùng mới {Username} đã được tạo với quyền {Role}.", user.Username, user.Role);

        return new AuthResponse(
            accessToken,
            refreshToken.Token,
            expiresAt,
            MapToDto(user)
        );
    }

    public async Task<AuthResponse> RefreshTokenAsync(RefreshTokenRequest request, CancellationToken ct = default)
    {
        var tokenEntity = await _context.RefreshTokens
            .Include(rt => rt.User)
            .FirstOrDefaultAsync(rt => rt.Token == request.RefreshToken, ct);

        if (tokenEntity == null || tokenEntity.IsRevoked || tokenEntity.ExpiresAt <= DateTime.UtcNow)
        {
            throw new UnauthorizedException("INVALID_REFRESH_TOKEN", "Refresh token không hợp lệ hoặc đã hết hạn.");
        }

        if (tokenEntity.User == null || !tokenEntity.User.IsActive)
        {
            throw new UnauthorizedException("ACCOUNT_INACTIVE", "Tài khoản người dùng không hợp lệ hoặc đã bị khóa.");
        }

        // Đánh dấu token cũ bị thu hồi và liên kết với token mới (Token Rotation)
        tokenEntity.IsRevoked = true;

        var (accessToken, expiresAt) = _jwtTokenGenerator.GenerateAccessToken(tokenEntity.User);
        var newRefreshToken = _jwtTokenGenerator.GenerateRefreshToken(tokenEntity.UserId);

        tokenEntity.ReplacedByToken = newRefreshToken.Token;
        _context.RefreshTokens.Add(newRefreshToken);

        await _context.SaveChangesAsync(ct);

        return new AuthResponse(
            accessToken,
            newRefreshToken.Token,
            expiresAt,
            MapToDto(tokenEntity.User)
        );
    }

    public async Task<bool> RevokeTokenAsync(RevokeTokenRequest request, CancellationToken ct = default)
    {
        var tokenEntity = await _context.RefreshTokens
            .FirstOrDefaultAsync(rt => rt.Token == request.RefreshToken, ct);

        if (tokenEntity == null || tokenEntity.IsRevoked)
        {
            return false;
        }

        tokenEntity.IsRevoked = true;
        await _context.SaveChangesAsync(ct);
        return true;
    }

    public async Task<UserDto> GetCurrentUserAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _context.Users.FindAsync(new object[] { userId }, ct);
        if (user == null)
        {
            throw new NotFoundException("USER_NOT_FOUND", $"Không tìm thấy người dùng với ID '{userId}'.");
        }

        return MapToDto(user);
    }

    private static UserDto MapToDto(User user)
    {
        return new UserDto(
            user.Id,
            user.Username,
            user.Email,
            user.FullName,
            user.Role.ToString(),
            user.StoreId,
            user.FranchiseeId,
            user.IsActive
        );
    }
}
