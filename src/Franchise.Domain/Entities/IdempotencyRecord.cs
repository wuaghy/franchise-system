using Franchise.Domain.Common;

namespace Franchise.Domain.Entities;

public class IdempotencyRecord : BaseEntity
{
    public string IdempotencyKey { get; set; } = string.Empty;
    public string ResponsePayload { get; set; } = string.Empty; // Cached JSON response
    public int StatusCode { get; set; } = 200;
}
