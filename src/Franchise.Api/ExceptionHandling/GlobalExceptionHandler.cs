using Franchise.Domain.Exceptions;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Franchise.Api.ExceptionHandling;

public sealed class GlobalExceptionHandler : IExceptionHandler
{
    private readonly IProblemDetailsService _problemDetails;
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(IProblemDetailsService problemDetails, ILogger<GlobalExceptionHandler> logger)
    {
        _problemDetails = problemDetails;
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(HttpContext ctx, Exception ex, CancellationToken ct)
    {
        // Client đã ngắt kết nối (POS mất mạng): không ghi response được nữa, không phải lỗi server
        if (ex is OperationCanceledException && ctx.RequestAborted.IsCancellationRequested)
        {
            _logger.LogInformation("Request {Path} bị client hủy.", ctx.Request.Path);
            return true;
        }

        var (status, title, errorCode, detail) = Map(ex);

        if (status >= 500)
            _logger.LogError(ex, "Unhandled exception tại {Method} {Path}", ctx.Request.Method, ctx.Request.Path);
        else
            _logger.LogWarning("{ErrorCode} ({Status}): {Message}", errorCode, status, ex.Message);

        ProblemDetails problem = ex is RequestValidationException v
            ? new ValidationProblemDetails(v.Errors)
            : new ProblemDetails();

        problem.Status = status;
        problem.Title = title;
        problem.Detail = detail;
        problem.Extensions["errorCode"] = errorCode;

        ctx.Response.StatusCode = status;
        return await _problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = ctx,
            ProblemDetails = problem,
            Exception = ex
        });
    }

    private static (int Status, string Title, string ErrorCode, string Detail) Map(Exception ex) => ex switch
    {
        RequestValidationException e => (400, "Validation Failed", e.ErrorCode, e.Message),
        UnauthorizedException e      => (401, "Unauthorized",      e.ErrorCode, e.Message),
        ForbiddenException e         => (403, "Forbidden",         e.ErrorCode, e.Message),
        NotFoundException e          => (404, "Not Found",         e.ErrorCode, e.Message),
        ConflictException e          => (409, "Conflict",          e.ErrorCode, e.Message),
        BusinessRuleException e      => (422, "Business Rule Violation", e.ErrorCode, e.Message),

        // THỨ TỰ QUAN TRỌNG: DbUpdateConcurrencyException kế thừa DbUpdateException, phải đứng trước
        DbUpdateConcurrencyException => (409, "Concurrency Conflict", "CONCURRENCY_CONFLICT",
                                         "Dữ liệu đã được người khác cập nhật. Vui lòng tải lại và thử lại."),

        // Lưới an toàn khi 2 request cùng vượt qua bước AnyAsync() rồi cùng INSERT trùng Code
        DbUpdateException { InnerException: PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } }
                                     => (409, "Duplicate Resource", "DUPLICATE_RESOURCE",
                                         "Bản ghi đã tồn tại (trùng khóa duy nhất)."),

        BadHttpRequestException      => (400, "Bad Request", "MALFORMED_REQUEST", "Request không hợp lệ."),

        // Còn lại: GIẤU message gốc, chỉ trả traceId
        _                            => (500, "Internal Server Error", "INTERNAL_ERROR",
                                         "Đã có lỗi xảy ra. Vui lòng liên hệ hỗ trợ kèm traceId.")
    };
}
