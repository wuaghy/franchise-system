using Franchise.Domain.Enums;

namespace Franchise.Application.DTOs.Auth;

public record LoginRequest(
    string Username,
    string Password
);

public record RegisterRequest(
    string Username,
    string Email,
    string Password,
    string FullName,
    UserRole Role,
    Guid? StoreId = null,
    Guid? FranchiseeId = null
);

public record AuthResponse(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAt,
    UserDto User
);

public record RefreshTokenRequest(
    string RefreshToken
);

public record RevokeTokenRequest(
    string RefreshToken
);

public record UserDto(
    Guid Id,
    string Username,
    string Email,
    string FullName,
    string Role,
    Guid? StoreId,
    Guid? FranchiseeId,
    bool IsActive
);

public record GoogleLoginRequest(
    string IdToken,
    Guid? StoreId = null
);

public record SendOtpRequest(
    string Email
);

public record VerifyOtpRequest(
    string Email,
    string OtpCode
);

