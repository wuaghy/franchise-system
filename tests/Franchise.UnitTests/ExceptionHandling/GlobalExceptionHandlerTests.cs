using FluentAssertions;
using Franchise.Api.ExceptionHandling;
using Franchise.Domain.Exceptions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Franchise.UnitTests.ExceptionHandling;

public class GlobalExceptionHandlerTests
{
    [Theory]
    [InlineData(typeof(NotFoundException), 404)]
    [InlineData(typeof(ConflictException), 409)]
    [InlineData(typeof(BusinessRuleException), 422)]
    [InlineData(typeof(InvalidOperationException), 500)] // Bug của framework KHÔNG bị map thành 409
    [InlineData(typeof(ArgumentException), 500)]         // Bug code KHÔNG bị map thành 400
    public async Task Map_ShouldReturnExpectedStatus(Type exType, int expected)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddProblemDetails();
        var sp = services.BuildServiceProvider();

        var ctx = new DefaultHttpContext { RequestServices = sp };
        ctx.Response.Body = new MemoryStream();

        Exception ex;
        if (exType == typeof(InvalidOperationException))
            ex = new InvalidOperationException("Sequence contains no elements");
        else if (exType == typeof(ArgumentException))
            ex = new ArgumentException("Value cannot be null");
        else
            ex = (Exception)Activator.CreateInstance(exType, "TEST_CODE", "Test message")!;

        var handler = new GlobalExceptionHandler(
            sp.GetRequiredService<IProblemDetailsService>(),
            NullLogger<GlobalExceptionHandler>.Instance);

        var handled = await handler.TryHandleAsync(ctx, ex, default);

        handled.Should().BeTrue();
        ctx.Response.StatusCode.Should().Be(expected);
    }

    [Fact]
    public async Task UnhandledException_500_ShouldHideInternalMessage()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddProblemDetails();
        var sp = services.BuildServiceProvider();

        var ctx = new DefaultHttpContext { RequestServices = sp };
        var bodyStream = new MemoryStream();
        ctx.Response.Body = bodyStream;

        var ex = new InvalidOperationException("Sensitive DB Connection String Details");

        var handler = new GlobalExceptionHandler(
            sp.GetRequiredService<IProblemDetailsService>(),
            NullLogger<GlobalExceptionHandler>.Instance);

        await handler.TryHandleAsync(ctx, ex, default);

        bodyStream.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(bodyStream);
        var responseBody = await reader.ReadToEndAsync();

        // Đảm bảo không để lộ message nhạy cảm ra ngoài client
        responseBody.Should().NotContain("Sensitive DB Connection String Details");
        responseBody.Should().Contain("INTERNAL_ERROR");
    }
}
