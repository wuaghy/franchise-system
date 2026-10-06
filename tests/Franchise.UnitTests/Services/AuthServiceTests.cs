using FluentAssertions;
using Franchise.Application.Common.Interfaces;
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
using Moq;
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

    private (AuthService authService, AppDbContext context) CreateAuthService(ICurrentUserService? currentUserService = null)
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
        var mockEmail = new Mock<IEmailService>();
        var mockCache = new Mock<ICacheService>();
        var authService = new AuthService(
            context,
            passwordHasher,
            jwtTokenGenerator,
            mockEmail.Object,
            mockCache.Object,
            configuration,
            NullLogger<AuthService>.Instance,
            currentUserService);

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

    [Fact]
    public async Task RegisterAsync_WhenDatabaseHasUsers_AndCallerUnauthenticated_ShouldThrowUnauthorizedException()
    {
        // Arrange
        var (authService, context) = CreateAuthService(currentUserService: null);
        // Đã có 1 user trong hệ thống (đã qua bootstrap)
        context.Users.Add(new User
        {
            Id = Guid.NewGuid(),
            Username = "existing_admin",
            PasswordHash = "hash",
            Role = UserRole.HQ_SuperAdmin
        });
        await context.SaveChangesAsync();

        var request = new RegisterRequest(
            Username: "new_staff",
            Email: "staff@franchise.vn",
            Password: "Password123!",
            FullName: "New Staff",
            Role: UserRole.POS_Cashier
        );

        // Act & Assert
        var act = async () => await authService.RegisterAsync(request);
        var ex = await act.Should().ThrowAsync<UnauthorizedException>();
        ex.Which.ErrorCode.Should().Be("UNAUTHORIZED");
    }

    [Fact]
    public async Task RegisterAsync_WhenCallerNotSuperAdmin_TriesToCreateSuperAdmin_ShouldThrowForbiddenException()
    {
        // Arrange
        var userManagerId = Guid.NewGuid();
        var currentUserMock = new Mock<ICurrentUserService>();
        currentUserMock.Setup(u => u.UserId).Returns(userManagerId);
        currentUserMock.Setup(u => u.Role).Returns("Store_Manager");
        currentUserMock.Setup(u => u.IsSuperAdmin).Returns(false);

        var (authService, context) = CreateAuthService(currentUserMock.Object);
        context.Users.Add(new User
        {
            Id = Guid.NewGuid(),
            Username = "root_admin",
            PasswordHash = "hash",
            Role = UserRole.HQ_SuperAdmin
        });
        await context.SaveChangesAsync();

        var request = new RegisterRequest(
            Username: "hacker_admin",
            Email: "hacker@franchise.vn",
            Password: "Password123!",
            FullName: "Hacker Admin",
            Role: UserRole.HQ_SuperAdmin
        );

        // Act & Assert
        var act = async () => await authService.RegisterAsync(request);
        var ex = await act.Should().ThrowAsync<ForbiddenException>();
        ex.Which.ErrorCode.Should().Be("FORBIDDEN");
    }

    [Fact]
    public async Task RegisterAsync_WhenStoreManagerCreatesCashierForSameStore_ShouldSucceed()
    {
        // Arrange
        var storeId = Guid.NewGuid();
        var managerId = Guid.NewGuid();
        var currentUserMock = new Mock<ICurrentUserService>();
        currentUserMock.Setup(u => u.UserId).Returns(managerId);
        currentUserMock.Setup(u => u.Role).Returns("Store_Manager");
        currentUserMock.Setup(u => u.IsSuperAdmin).Returns(false);
        currentUserMock.Setup(u => u.StoreId).Returns(storeId);

        var (authService, context) = CreateAuthService(currentUserMock.Object);
        context.Users.Add(new User
        {
            Id = managerId,
            Username = "store_mgr",
            PasswordHash = "hash",
            Role = UserRole.Store_Manager
        });
        await context.SaveChangesAsync();

        var request = new RegisterRequest(
            Username: "cashier_same_store",
            Email: "cashier@store.vn",
            Password: "Password123!",
            FullName: "Cashier",
            Role: UserRole.POS_Cashier,
            StoreId: storeId
        );

        // Act
        var res = await authService.RegisterAsync(request);

        // Assert
        res.Should().NotBeNull();
        res.User.Username.Should().Be("cashier_same_store");
        var savedUser = await context.Users.FirstAsync(u => u.Username == "cashier_same_store");
        savedUser.Role.Should().Be(UserRole.POS_Cashier);
        savedUser.StoreId.Should().Be(storeId);
    }

    [Fact]
    public async Task RegisterAsync_WhenStoreManagerCreatesCashierForDifferentStore_ShouldThrowForbiddenException()
    {
        // Arrange
        var storeIdA = Guid.NewGuid();
        var storeIdB = Guid.NewGuid();
        var managerId = Guid.NewGuid();
        var currentUserMock = new Mock<ICurrentUserService>();
        currentUserMock.Setup(u => u.UserId).Returns(managerId);
        currentUserMock.Setup(u => u.Role).Returns("Store_Manager");
        currentUserMock.Setup(u => u.IsSuperAdmin).Returns(false);
        currentUserMock.Setup(u => u.StoreId).Returns(storeIdA);

        var (authService, context) = CreateAuthService(currentUserMock.Object);
        context.Users.Add(new User
        {
            Id = managerId,
            Username = "mgr_a",
            PasswordHash = "hash",
            Role = UserRole.Store_Manager
        });
        await context.SaveChangesAsync();

        var request = new RegisterRequest(
            Username: "cashier_b",
            Email: "cashier@b.vn",
            Password: "Password123!",
            FullName: "Cashier B",
            Role: UserRole.POS_Cashier,
            StoreId: storeIdB // Khác chi nhánh
        );

        // Act & Assert
        var act = async () => await authService.RegisterAsync(request);
        var ex = await act.Should().ThrowAsync<ForbiddenException>();
        ex.Which.ErrorCode.Should().Be("FORBIDDEN");
    }

    [Fact]
    public async Task RegisterAsync_WhenCashierTriesToRegisterStaff_ShouldThrowForbiddenException()
    {
        // Arrange
        var cashierId = Guid.NewGuid();
        var currentUserMock = new Mock<ICurrentUserService>();
        currentUserMock.Setup(u => u.UserId).Returns(cashierId);
        currentUserMock.Setup(u => u.Role).Returns("POS_Cashier");
        currentUserMock.Setup(u => u.IsSuperAdmin).Returns(false);

        var (authService, context) = CreateAuthService(currentUserMock.Object);
        context.Users.Add(new User
        {
            Id = cashierId,
            Username = "cashier_x",
            PasswordHash = "hash",
            Role = UserRole.POS_Cashier
        });
        await context.SaveChangesAsync();

        var request = new RegisterRequest(
            Username: "cashier_y",
            Email: "cashier_y@store.vn",
            Password: "Password123!",
            FullName: "Cashier Y",
            Role: UserRole.POS_Cashier
        );

        // Act & Assert
        var act = async () => await authService.RegisterAsync(request);
        var ex = await act.Should().ThrowAsync<ForbiddenException>();
        ex.Which.ErrorCode.Should().Be("FORBIDDEN");
    }

    [Fact]
    public async Task SendOtpAsync_ShouldCacheCodeAndCallEmailService()
    {
        // Arrange
        var context = CreateInMemoryDbContext();
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "Jwt:Secret", "A_Very_Long_And_Secure_Secret_Key_For_Testing_1234567890" }
            })
            .Build();

        var mockEmail = new Mock<IEmailService>();
        var mockCache = new Mock<ICacheService>();

        var authService = new AuthService(
            context,
            new PasswordHasher(),
            new JwtTokenGenerator(configuration),
            mockEmail.Object,
            mockCache.Object,
            configuration,
            NullLogger<AuthService>.Instance);

        var request = new SendOtpRequest("user@franchise.vn");

        // Act
        var result = await authService.SendOtpAsync(request);

        // Assert
        result.Should().BeTrue();
        mockCache.Verify(c => c.SetAsync(
            "otp:user@franchise.vn",
            It.Is<string>(code => code.Length == 6),
            It.IsAny<TimeSpan?>(),
            It.IsAny<CancellationToken>()), Times.Once);
        mockEmail.Verify(e => e.SendOtpEmailAsync(
            "user@franchise.vn",
            It.Is<string>(code => code.Length == 6),
            It.IsAny<string>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task VerifyOtpLoginAsync_WithValidOtp_ShouldReturnTokens()
    {
        // Arrange
        var context = CreateInMemoryDbContext();
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "Jwt:Secret", "A_Very_Long_And_Secure_Secret_Key_For_Testing_1234567890" }
            })
            .Build();

        var mockEmail = new Mock<IEmailService>();
        var mockCache = new Mock<ICacheService>();
        mockCache.Setup(c => c.GetAsync<string>("otp:user@franchise.vn", It.IsAny<CancellationToken>()))
            .ReturnsAsync("123456");

        var authService = new AuthService(
            context,
            new PasswordHasher(),
            new JwtTokenGenerator(configuration),
            mockEmail.Object,
            mockCache.Object,
            configuration,
            NullLogger<AuthService>.Instance);

        var request = new VerifyOtpRequest("user@franchise.vn", "123456");

        // Act
        var result = await authService.VerifyOtpLoginAsync(request);

        // Assert
        result.Should().NotBeNull();
        result.AccessToken.Should().NotBeNullOrWhiteSpace();
        result.User.Email.Should().Be("user@franchise.vn");
        mockCache.Verify(c => c.RemoveAsync("otp:user@franchise.vn", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task VerifyOtpLoginAsync_WithInvalidOtp_ShouldThrowUnauthorizedException()
    {
        // Arrange
        var context = CreateInMemoryDbContext();
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "Jwt:Secret", "A_Very_Long_And_Secure_Secret_Key_For_Testing_1234567890" }
            })
            .Build();

        var mockEmail = new Mock<IEmailService>();
        var mockCache = new Mock<ICacheService>();
        mockCache.Setup(c => c.GetAsync<string>("otp:user@franchise.vn", It.IsAny<CancellationToken>()))
            .ReturnsAsync("999999");

        var authService = new AuthService(
            context,
            new PasswordHasher(),
            new JwtTokenGenerator(configuration),
            mockEmail.Object,
            mockCache.Object,
            configuration,
            NullLogger<AuthService>.Instance);

        var request = new VerifyOtpRequest("user@franchise.vn", "123456");

        // Act & Assert
        var act = async () => await authService.VerifyOtpLoginAsync(request);
        var ex = await act.Should().ThrowAsync<UnauthorizedException>();
        ex.Which.ErrorCode.Should().Be("INVALID_OTP");
    }
}
