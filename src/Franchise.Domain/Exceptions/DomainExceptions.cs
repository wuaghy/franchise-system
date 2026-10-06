namespace Franchise.Domain.Exceptions;

public abstract class DomainException : Exception
{
    public string ErrorCode { get; }

    protected DomainException(string errorCode, string message) : base(message)
        => ErrorCode = errorCode;
}

public class NotFoundException : DomainException
{
    public NotFoundException(string errorCode, string message) : base(errorCode, message) { }
}

public class ConflictException : DomainException
{
    public ConflictException(string errorCode, string message) : base(errorCode, message) { }
}

public class BusinessRuleException : DomainException
{
    public BusinessRuleException(string errorCode, string message) : base(errorCode, message) { }
}

public class UnauthorizedException : DomainException
{
    public UnauthorizedException(string errorCode, string message) : base(errorCode, message) { }
}

public class ForbiddenException : DomainException
{
    public ForbiddenException(string errorCode, string message) : base(errorCode, message) { }
}

public sealed class RequestValidationException : DomainException
{
    public IDictionary<string, string[]> Errors { get; }

    public RequestValidationException(string field, string message)
        : base("VALIDATION_FAILED", message)
    {
        Errors = new Dictionary<string, string[]> { [field] = new[] { message } };
    }

    public RequestValidationException(IDictionary<string, string[]> errors)
        : base("VALIDATION_FAILED", "Một hoặc nhiều trường dữ liệu không hợp lệ.")
    {
        Errors = errors;
    }
}

// Exception nghiệp vụ cụ thể: mang theo dữ liệu có cấu trúc để POS xử lý
public sealed class InsufficientStockException : ConflictException
{
    public Guid IngredientId { get; }
    public decimal Required { get; }
    public decimal Available { get; }

    public InsufficientStockException(Guid ingredientId, string name, decimal required, decimal available)
        : base("INSUFFICIENT_STOCK",
               $"Chi nhánh không đủ nguyên liệu '{name}'. Cần: {required}, tồn kho: {available}.")
    {
        IngredientId = ingredientId;
        Required = required;
        Available = available;
    }
}
