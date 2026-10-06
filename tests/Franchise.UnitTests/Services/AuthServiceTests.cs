using FluentAssertions;
using Franchise.Application.DTOs.Auth;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Franchise.Domain.Exceptions;
using Franchise.Infrastructure.Auth;
using Franchise.Infrastructure.Data;
using Franchise.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Franchise.UnitTests.Services;

public class AuthServiceTests
{
    private AppDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private (AuthService authService, AppDbContext context) CreateAuthService()
    {
        var context = CreateInMemoryDbContext();
        var inMemorySettings = new Dictionary<string, string?>
        {
            { "Jwt:Secret", "A_Very_Long_And_Secure_Secret_Key_For_Testing_1234567890" },
            { "Jwt:Issuer", "TestIssuer" },
            { "Jwt:Audience", "TestAudience" },
            { "Jwt:AccessTokenExpirationMinutes", "30" },
            { "Jwt:RefreshTokenExpirationDays", "7" }
        };
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(inMemorySettings)
            .Build();

        var passwordHasher = new PasswordHasher();
        var jwtTokenGenerator = new JwtTokenGenerator(configuration);
        var authService = new AuthService(
            context,
            passwordHasher,
            jwtTokenGenerator,
            NullLogger<AuthService>.Instance);

        return (authService, context);
    }

    [Fact]
    public async Task RegisterAsync_ShouldCreateUser_AndReturnTokens()
    {
        // Arrange
        var (authService, context) = CreateAuthService();
        var request = new RegisterRequest(
            Username: "cashier01",
            Email: "cashier01@franchise.vn",
            Password: "Password123!",
            FullName: "Nguyễn Văn Thu Ngân",
            Role: UserRole.POS_Cashier
        );

        // Act
        var response = await authService.RegisterAsync(request);

        // Assert
        response.Should().NotBeNull();
        response.AccessToken.Should().NotBeNullOrWhiteSpace();
        response.RefreshToken.Should().NotBeNullOrWhiteSpace();
        response.User.Username.Should().Be("cashier01");
        response.User.Role.Should().Be("POS_Cashier");

        var userInDb = await context.Users.FirstOrDefaultAsync(u => u.Username == "cashier01");
        userInDb.Should().NotBeNull();
        userInDb!.PasswordHash.Should().NotBe("Password123!"); // Đã được hash
    }

    [Fact]
    public async Task LoginAsync_WithValidCredentials_ShouldReturnTokens()
    {
        // Arrange
        var (authService, _) = CreateAuthService();
        await authService.RegisterAsync(new RegisterRequest(
            Username: "manager01",
            Email: "manager01@franchise.vn",
            Password: "SecurePassword123!",
            FullName: "Quản Lý Cửa Hàng",
            Role: UserRole.Store_Manager
        ));

        // Act
        var loginResponse = await authService.LoginAsync(new LoginRequest("manager01", "SecurePassword123!"));

        // Assert
        loginResponse.Should().NotBeNull();
        loginResponse.AccessToken.Should().NotBeNullOrWhiteSpace();
        loginResponse.User.Username.Should().Be("manager01");
    }

    [Fact]
    public async Task LoginAsync_WithInvalidPassword_ShouldThrowUnauthorizedException()
    {
        // Arrange
        var (authService, _) = CreateAuthService();
        await authService.RegisterAsync(new RegisterRequest(
            Username: "user01",
            Email: "user01@franchise.vn",
            Password: "CorrectPassword123!",
            FullName: "User Test",
            Role: UserRole.POS_Cashier
        ));

        // Act
        var act = async () => await authService.LoginAsync(new LoginRequest("user01", "WrongPassword!"));

        // Assert
        await act.Should().ThrowAsync<UnauthorizedException>()
            .WithMessage("*Tên đăng nhập hoặc mật khẩu không chính xác*");
    }

    [Fact]
    public async Task RefreshTokenAsync_WithValidRefreshToken_ShouldRotateTokens()
    {
        // Arrange
        var (authService, context) = CreateAuthService();
        var registerRes = await authService.RegisterAsync(new RegisterRequest(
            Username: "user_refresh",
            Email: "user_refresh@franchise.vn",
            Password: "Password123!",
            FullName: "User Refresh",
            Role: UserRole.POS_Cashier
        ));

        var oldRefreshToken = registerRes.RefreshToken;

        // Act
        var refreshRes = await authService.RefreshTokenAsync(new RefreshTokenRequest(oldRefreshToken));

        // Assert
        refreshRes.Should().NotBeNull();
        refreshRes.AccessToken.Should().NotBeNullOrWhiteSpace();
        refreshRes.RefreshToken.Should().NotBe(oldRefreshToken); // Token đã được rotate

        // Token cũ phải bị đánh dấu Revoked
        var oldTokenEntity = await context.RefreshTokens.FirstOrDefaultAsync(rt => rt.Token == oldRefreshToken);
        oldTokenEntity.Should().NotBeNull();
        oldTokenEntity!.IsRevoked.Should().BeTrue();
    }

    [Fact]
    public async Task RevokeTokenAsync_ShouldMarkTokenAsRevoked()
    {
        // Arrange
        var (authService, context) = CreateAuthService();
        var registerRes = await authService.RegisterAsync(new RegisterRequest(
            Username: "user_revoke",
            Email: "user_revoke@franchise.vn",
            Password: "Password123!",
            FullName: "User Revoke",
            Role: UserRole.POS_Cashier
        ));

        // Act
        var result = await authService.RevokeTokenAsync(new RevokeTokenRequest(registerRes.RefreshToken));

        // Assert
        result.Should().BeTrue();
        var tokenEntity = await context.RefreshTokens.FirstOrDefaultAsync(rt => rt.Token == registerRes.RefreshToken);
        tokenEntity!.IsRevoked.Should().BeTrue();
    }
}
