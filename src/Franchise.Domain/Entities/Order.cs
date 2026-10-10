using Franchise.Domain.Common;
using Franchise.Domain.Enums;

namespace Franchise.Domain.Entities;

public class Order : BaseEntity
{
    public string OrderNumber { get; set; } = string.Empty;
    public Guid StoreId { get; set; }
    public Store? Store { get; set; }

    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public Guid? CashierId { get; set; }
    public StoreUser? Cashier { get; set; }

    public Guid? ShiftId { get; set; }
    public Shift? Shift { get; set; }

    public OrderType OrderType { get; set; } = OrderType.DineIn;
    public OrderStatus Status { get; set; } = OrderStatus.Pending;

    public decimal Subtotal { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal VatAmount { get; set; }
    public decimal FinalAmount { get; set; }

    public DateTime? CompletedAt { get; set; }

    // Navigation
    public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
}
