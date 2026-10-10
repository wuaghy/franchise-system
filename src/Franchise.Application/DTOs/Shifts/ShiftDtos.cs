using Franchise.Domain.Enums;

namespace Franchise.Application.DTOs.Shifts;

public record OpenShiftRequest(
    Guid StoreId,
    decimal StartingCash,
    string? Notes = null
);

public record CloseShiftRequest(
    decimal ActualEndingCash,
    string? Notes = null
);

public record CashMovementRequest(
    decimal Amount,
    CashMovementType Type,
    string Reason
);

public record ShiftCashMovementDto(
    Guid Id,
    Guid ShiftId,
    decimal Amount,
    CashMovementType Type,
    string Reason,
    Guid CreatedByUserId,
    string? CreatedByUserName,
    DateTime CreatedAt
);

public record ShiftDto(
    Guid Id,
    string ShiftNumber,
    Guid StoreId,
    string? StoreName,
    Guid CashierId,
    string? CashierName,
    DateTime OpenedAt,
    DateTime? ClosedAt,
    ShiftStatus Status,
    decimal StartingCash,
    decimal TotalCashSales,
    decimal TotalBankTransferSales,
    decimal TotalCardSales,
    decimal TotalCashIn,
    decimal TotalCashOut,
    decimal ExpectedEndingCash,
    decimal? ActualEndingCash,
    decimal? CashDiscrepancy,
    int TotalOrdersCount,
    string? Notes,
    IReadOnlyList<ShiftCashMovementDto> Movements
);

public record CurrentShiftStatusDto(
    bool HasOpenShift,
    ShiftDto? CurrentShift
);

public record ZReportDto(
    Guid ShiftId,
    string ShiftNumber,
    string StoreName,
    string CashierName,
    DateTime OpenedAt,
    DateTime ClosedAt,
    decimal StartingCash,
    decimal TotalCashSales,
    decimal TotalBankTransferSales,
    decimal TotalCardSales,
    decimal TotalRevenue,
    decimal TotalCashIn,
    decimal TotalCashOut,
    decimal ExpectedEndingCash,
    decimal ActualEndingCash,
    decimal CashDiscrepancy,
    int TotalOrdersCount,
    string? Notes,
    IReadOnlyList<ShiftCashMovementDto> Movements
);
