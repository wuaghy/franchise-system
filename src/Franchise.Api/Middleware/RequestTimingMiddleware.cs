using System.Diagnostics;

namespace Franchise.Api.Middleware;

public class RequestTimingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestTimingMiddleware> _logger;

    public RequestTimingMiddleware(RequestDelegate next, ILogger<RequestTimingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var stopwatch = Stopwatch.StartNew();

        context.Response.OnStarting(() =>
        {
            stopwatch.Stop();
            var elapsedMs = stopwatch.ElapsedMilliseconds;
            context.Response.Headers["X-Response-Time-Ms"] = elapsedMs.ToString();

            if (elapsedMs > 500)
            {
                _logger.LogWarning(
                    "Slow Request detected: {Method} {Path} responded in {ElapsedMs}ms",
                    context.Request.Method,
                    context.Request.Path,
                    elapsedMs);
            }
            return Task.CompletedTask;
        });

        await _next(context);
    }
}
