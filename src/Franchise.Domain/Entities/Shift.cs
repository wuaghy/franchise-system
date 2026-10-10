using Franchise.Domain.Common;
using Franchise.Domain.Enums;

namespace Franchise.Domain.Entities;

public class Shift : BaseEntity
{
    public string ShiftNumber { get; set; } = string.Empty;
    public Guid StoreId { get; set; }
    public Store? Store { get; set; }

    public Guid CashierId { get; set; }
    public StoreUser? Cashier { get; set; }

    public DateTime OpenedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ClosedAt { get; set; }
    public ShiftStatus Status { get; set; } = ShiftStatus.Open;

    // Tiền mồi mở két đầu ca
    public decimal StartingCash { get; set; }

    // Doanh số ghi nhận từ các đơn hàng trong ca
    public decimal TotalCashSales { get; set; }
    public decimal TotalBankTransferSales { get; set; }
    public decimal TotalCardSales { get; set; }

    // Biến động tiền mặt phát sinh trong ca
    public decimal TotalCashIn { get; set; }
    public decimal TotalCashOut { get; set; }

    // Tiền lý thuyết trong két = StartingCash + TotalCashSales + TotalCashIn - TotalCashOut
    public decimal ExpectedEndingCash { get; set; }

    // Tiền đếm thực tế khi chốt ca
    public decimal? ActualEndingCash { get; set; }

    // Chênh lệch = ActualEndingCash - ExpectedEndingCash (< 0: Thiếu tiền, > 0: Thừa tiền)
    public decimal? CashDiscrepancy { get; set; }

    public int TotalOrdersCount { get; set; }
    public string? Notes { get; set; }

    // Navigation
    public ICollection<ShiftCashMovement> Movements { get; set; } = new List<ShiftCashMovement>();
    public ICollection<Order> Orders { get; set; } = new List<Order>();
}
