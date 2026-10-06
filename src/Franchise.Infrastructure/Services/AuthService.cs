using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Auth;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Franchise.Domain.Exceptions;
using Franchise.Infrastructure.Data;
using Google.Apis.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Franchise.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly AppDbContext _context;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenGenerator _jwtTokenGenerator;
    private readonly IEmailService _emailService;
    private readonly ICacheService _cacheService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthService> _logger;
    private readonly ICurrentUserService? _currentUserService;

    public AuthService(
        AppDbContext context,
        IPasswordHasher passwordHasher,
        IJwtTokenGenerator jwtTokenGenerator,
        IEmailService emailService,
        ICacheService cacheService,
        IConfiguration configuration,
        ILogger<AuthService> logger,
        ICurrentUserService? currentUserService = null)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _jwtTokenGenerator = jwtTokenGenerator;
        _emailService = emailService;
        _cacheService = cacheService;
        _configuration = configuration;
        _logger = logger;
        _currentUserService = currentUserService;
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
        var hasAnyUsers = await _context.Users.AnyAsync(ct);
        if (hasAnyUsers)
        {
            if (_currentUserService == null || !_currentUserService.UserId.HasValue)
            {
                throw new UnauthorizedException("UNAUTHORIZED", "Hệ thống yêu cầu đăng nhập tài khoản quản trị để tạo nhân sự mới.");
            }

            if (request.Role == UserRole.HQ_SuperAdmin && !_currentUserService.IsSuperAdmin)
            {
                throw new ForbiddenException("FORBIDDEN", "Chỉ có HQ SuperAdmin mới có quyền tạo thêm tài khoản quản trị hệ thống.");
            }

            if (_currentUserService.Role is "Store_Manager")
            {
                if (request.Role != UserRole.POS_Cashier || request.StoreId != _currentUserService.StoreId)
                {
                    throw new ForbiddenException("FORBIDDEN", "Quản lý cửa hàng chỉ có quyền tạo tài khoản Thu ngân cho chi nhánh của mình.");
                }
            }
            else if (_currentUserService.Role is "POS_Cashier" or "Supply_Chain_Officer")
            {
                throw new ForbiddenException("FORBIDDEN", "Bạn không có quyền tạo tài khoản nhân sự.");
            }
        }
        else
        {
            _logger.LogWarning("System Bootstrap: Khởi tạo tài khoản ban đầu '{Username}' ({Role}).", request.Username, request.Role);
        }

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
            Username = request.Username,
            Email = request.Email,
            PasswordHash = _passwordHasher.HashPassword(request.Password),
            FullName = request.FullName,
            Role = request.Role,
            StoreId = request.StoreId,
            FranchiseeId = request.FranchiseeId,
            IsActive = true
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync(ct);

        var (accessToken, expiresAt) = _jwtTokenGenerator.GenerateAccessToken(user);
        var refreshToken = _jwtTokenGenerator.GenerateRefreshToken(user.Id);

        _context.RefreshTokens.Add(refreshToken);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Tạo mới tài khoản {Username} ({Role}) thành công.", user.Username, user.Role);

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

        if (tokenEntity == null || !tokenEntity.IsActive)
        {
            throw new UnauthorizedException("INVALID_REFRESH_TOKEN", "Refresh token không hợp lệ hoặc đã hết hạn.");
        }

        if (tokenEntity.User == null || !tokenEntity.User.IsActive)
        {
            throw new UnauthorizedException("ACCOUNT_INACTIVE", "Tài khoản người dùng không hợp lệ hoặc đã bị khóa.");
        }

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

    public async Task<AuthResponse> GoogleLoginAsync(GoogleLoginRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.IdToken))
        {
            throw new RequestValidationException("IdToken", "Google IdToken không được để trống.");
        }

        var clientId = _configuration["Google:ClientId"];
        GoogleJsonWebSignature.Payload payload;

        try
        {
            var settings = new GoogleJsonWebSignature.ValidationSettings();
            if (!string.IsNullOrWhiteSpace(clientId))
            {
                settings.Audience = new[] { clientId };
            }
            payload = await GoogleJsonWebSignature.ValidateAsync(request.IdToken, settings);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Xác minh Google Token thất bại.");
            throw new UnauthorizedException("INVALID_GOOGLE_TOKEN", "Google Token không hợp lệ hoặc đã hết hạn.");
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == payload.Email, ct);
        if (user == null)
        {
            var hasAnyUsers = await _context.Users.AnyAsync(ct);
            user = new User
            {
                Username = payload.Email.Split('@')[0] + "_" + Guid.NewGuid().ToString("N")[..4],
                Email = payload.Email,
                FullName = !string.IsNullOrWhiteSpace(payload.Name) ? payload.Name : payload.Email,
                PasswordHash = _passwordHasher.HashPassword(Guid.NewGuid().ToString("N")),
                Role = hasAnyUsers ? UserRole.Store_Manager : UserRole.HQ_SuperAdmin,
                StoreId = request.StoreId,
                IsActive = true
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync(ct);
            _logger.LogInformation("Tạo mới tài khoản qua Google OAuth: {Email} ({Role})", user.Email, user.Role);
        }

        if (!user.IsActive)
        {
            throw new UnauthorizedException("ACCOUNT_INACTIVE", "Tài khoản của bạn đã bị khóa.");
        }

        var (accessToken, expiresAt) = _jwtTokenGenerator.GenerateAccessToken(user);
        var refreshToken = _jwtTokenGenerator.GenerateRefreshToken(user.Id);

        _context.RefreshTokens.Add(refreshToken);
        await _context.SaveChangesAsync(ct);

        return new AuthResponse(
            accessToken,
            refreshToken.Token,
            expiresAt,
            MapToDto(user)
        );
    }

    public async Task<bool> SendOtpAsync(SendOtpRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            throw new RequestValidationException("Email", "Địa chỉ email không được để trống.");
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email, ct);
        var recipientName = user?.FullName ?? request.Email.Split('@')[0];
        var otpCode = Random.Shared.Next(100000, 999999).ToString();

        var cacheKey = $"otp:{request.Email.Trim().ToLowerInvariant()}";
        await _cacheService.SetAsync(cacheKey, otpCode, TimeSpan.FromMinutes(5), ct);

        await _emailService.SendOtpEmailAsync(request.Email, otpCode, recipientName, ct);
        _logger.LogInformation("Đã phát mã OTP 5 phút cho email: {Email}", request.Email);
        return true;
    }

    public async Task<AuthResponse> VerifyOtpLoginAsync(VerifyOtpRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.OtpCode))
        {
            throw new RequestValidationException("Otp", "Email và mã OTP không được để trống.");
        }

        var cacheKey = $"otp:{request.Email.Trim().ToLowerInvariant()}";
        var cachedOtp = await _cacheService.GetAsync<string>(cacheKey, ct);

        if (string.IsNullOrWhiteSpace(cachedOtp) || cachedOtp != request.OtpCode.Trim())
        {
            throw new UnauthorizedException("INVALID_OTP", "Mã OTP không chính xác hoặc đã hết hạn.");
        }

        await _cacheService.RemoveAsync(cacheKey, ct);

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email, ct);
        if (user == null)
        {
            var hasAnyUsers = await _context.Users.AnyAsync(ct);
            user = new User
            {
                Username = request.Email.Split('@')[0] + "_" + Guid.NewGuid().ToString("N")[..4],
                Email = request.Email,
                FullName = request.Email.Split('@')[0],
                PasswordHash = _passwordHasher.HashPassword(Guid.NewGuid().ToString("N")),
                Role = hasAnyUsers ? UserRole.POS_Cashier : UserRole.HQ_SuperAdmin,
                IsActive = true
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync(ct);
        }

        if (!user.IsActive)
        {
            throw new UnauthorizedException("ACCOUNT_INACTIVE", "Tài khoản của bạn đã bị khóa.");
        }

        var (accessToken, expiresAt) = _jwtTokenGenerator.GenerateAccessToken(user);
        var refreshToken = _jwtTokenGenerator.GenerateRefreshToken(user.Id);

        _context.RefreshTokens.Add(refreshToken);
        await _context.SaveChangesAsync(ct);

        return new AuthResponse(
            accessToken,
            refreshToken.Token,
            expiresAt,
            MapToDto(user)
        );
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
