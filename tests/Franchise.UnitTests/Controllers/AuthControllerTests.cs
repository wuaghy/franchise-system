using FluentAssertions;
using Franchise.Api.Controllers;
using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Auth;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace Franchise.UnitTests.Controllers;

public class AuthControllerTests
{
    private readonly Mock<IAuthService> _mockAuthService;
    private readonly Mock<ICurrentUserService> _mockCurrentUserService;
    private readonly AuthController _controller;

    public AuthControllerTests()
    {
        _mockAuthService = new Mock<IAuthService>();
        _mockCurrentUserService = new Mock<ICurrentUserService>();
        _controller = new AuthController(_mockAuthService.Object, _mockCurrentUserService.Object);
    }

    [Fact]
    public async Task Login_ShouldReturnOk_WithAuthResponse()
    {
        // Arrange
        var request = new LoginRequest("admin", "password");
        var expectedResponse = new AuthResponse(
            "access_token",
            "refresh_token",
            DateTime.UtcNow.AddMinutes(30),
            new UserDto(Guid.NewGuid(), "admin", "admin@franchise.vn", "Super Admin", "HQ_SuperAdmin", null, null, true)
        );

        _mockAuthService
            .Setup(s => s.LoginAsync(request, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedResponse);

        // Act
        var result = await _controller.Login(request, CancellationToken.None);

        // Assert
        var okResult = result as OkObjectResult;
        okResult.Should().NotBeNull();
        okResult!.StatusCode.Should().Be(200);
        okResult.Value.Should().BeEquivalentTo(expectedResponse);
    }

    [Fact]
    public async Task Register_ShouldReturnOk_WithAuthResponse()
    {
        // Arrange
        var request = new RegisterRequest(
            "cashier",
            "cashier@franchise.vn",
            "password",
            "Thu Ngan",
            Franchise.Domain.Enums.UserRole.POS_Cashier
        );
        var expectedResponse = new AuthResponse(
            "access_token",
            "refresh_token",
            DateTime.UtcNow.AddMinutes(30),
            new UserDto(Guid.NewGuid(), "cashier", "cashier@franchise.vn", "Thu Ngan", "POS_Cashier", null, null, true)
        );

        _mockAuthService
            .Setup(s => s.RegisterAsync(request, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedResponse);

        // Act
        var result = await _controller.Register(request, CancellationToken.None);

        // Assert
        var okResult = result as OkObjectResult;
        okResult.Should().NotBeNull();
        okResult!.StatusCode.Should().Be(200);
        okResult.Value.Should().BeEquivalentTo(expectedResponse);
    }
}
