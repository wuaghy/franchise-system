using Franchise.Domain.Common;

namespace Franchise.Domain.Entities;

public class OutboxMessage : BaseEntity
{
    public string AggregateType { get; set; } = string.Empty;
    public string AggregateId { get; set; } = string.Empty;
    public string EventType { get; set; } = string.Empty;
    public string Payload { get; set; } = string.Empty; // JSON payload
    public DateTime? ProcessedAt { get; set; }
    public string? Error { get; set; }
}
