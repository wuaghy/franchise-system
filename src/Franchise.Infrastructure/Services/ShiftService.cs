using Franchise.Domain.Exceptions;
using Franchise.Application.Common.Interfaces;
using Franchise.Application.Common.Models;
using Franchise.Application.DTOs.Shifts;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Franchise.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Franchise.Infrastructure.Services;

public class ShiftService : IShiftService
{
    private readonly AppDbContext _context;
    private readonly ILogger<ShiftService> _logger;

    public ShiftService(AppDbContext context, ILogger<ShiftService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<ShiftDto> OpenShiftAsync(
        Guid storeId,
        Guid cashierId,
        OpenShiftRequest request,
        CancellationToken cancellationToken = default)
    {
        var store = await _context.Stores.FirstOrDefaultAsync(s => s.Id == storeId, cancellationToken);
        if (store == null)
        {
            throw new NotFoundException("STORE_NOT_FOUND", $"Không tìm thấy chi nhánh với ID '{storeId}'.");
        }

        // Kiểm tra xem chi nhánh hoặc thu ngân này đã có ca đang mở hay chưa
        var hasOpenShift = await _context.Shifts
            .AnyAsync(s => s.StoreId == storeId && s.Status == ShiftStatus.Open, cancellationToken);

        if (hasOpenShift)
        {
            throw new BusinessRuleException("SHIFT_ALREADY_OPEN",
                $"Chi nhánh '{store.Name}' hiện đang có một ca làm việc đang mở. Vui lòng chốt ca hiện tại trước khi mở ca mới.");
        }

        var today = DateTime.UtcNow.Date;
        var shiftsCountToday = await _context.Shifts
            .CountAsync(s => s.StoreId == storeId && s.OpenedAt >= today, cancellationToken);

        var shiftNumber = $"SHIFT-{DateTime.UtcNow:yyyyMMdd}-{(shiftsCountToday + 1):D2}";

        var shift = new Shift
        {
            StoreId = storeId,
            CashierId = cashierId,
            ShiftNumber = shiftNumber,
            OpenedAt = DateTime.UtcNow,
            Status = ShiftStatus.Open,
            StartingCash = Math.Max(0, request.StartingCash),
            ExpectedEndingCash = Math.Max(0, request.StartingCash),
            TotalCashSales = 0,
            TotalBankTransferSales = 0,
            TotalCardSales = 0,
            TotalCashIn = 0,
            TotalCashOut = 0,
            TotalOrdersCount = 0,
            Notes = request.Notes
        };

        _context.Shifts.Add(shift);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Đã mở ca làm việc mới #{ShiftNumber} cho chi nhánh {StoreId} với tiền mồi {StartingCash:N0} đ",
            shift.ShiftNumber, storeId, shift.StartingCash);

        return await MapToShiftDtoAsync(shift.Id, cancellationToken);
    }

    public async Task<ShiftDto> CloseShiftAsync(
        Guid shiftId,
        Guid closedByUserId,
        CloseShiftRequest request,
        CancellationToken cancellationToken = default)
    {
        var shift = await _context.Shifts
            .Include(s => s.Movements)
            .FirstOrDefaultAsync(s => s.Id == shiftId, cancellationToken);

        if (shift == null)
        {
            throw new NotFoundException("SHIFT_NOT_FOUND", $"Không tìm thấy ca làm việc với ID '{shiftId}'.");
        }

        if (shift.Status != ShiftStatus.Open)
        {
            throw new BusinessRuleException("SHIFT_ALREADY_CLOSED",
                $"Ca làm việc #{shift.ShiftNumber} đã được chốt trước đó vào lúc {shift.ClosedAt:HH:mm dd/MM/yyyy}.");
        }

        // Tính lại số tiền lý thuyết trước khi chốt
        shift.ExpectedEndingCash = shift.StartingCash + shift.TotalCashSales + shift.TotalCashIn - shift.TotalCashOut;
        shift.ActualEndingCash = Math.Max(0, request.ActualEndingCash);
        shift.CashDiscrepancy = shift.ActualEndingCash.Value - shift.ExpectedEndingCash;
        shift.ClosedAt = DateTime.UtcNow;
        shift.Status = ShiftStatus.Closed;

        if (!string.IsNullOrWhiteSpace(request.Notes))
        {
            shift.Notes = string.IsNullOrEmpty(shift.Notes)
                ? request.Notes
                : $"{shift.Notes} | Chốt ca: {request.Notes}";
        }

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Đã chốt ca #{ShiftNumber}. Lý thuyết: {Expected:N0} đ, Thực tế: {Actual:N0} đ, Chênh lệch: {Diff:N0} đ",
            shift.ShiftNumber, shift.ExpectedEndingCash, shift.ActualEndingCash, shift.CashDiscrepancy);

        return await MapToShiftDtoAsync(shift.Id, cancellationToken);
    }

    public async Task<ShiftDto> AddCashMovementAsync(
        Guid shiftId,
        Guid userId,
        CashMovementRequest request,
        CancellationToken cancellationToken = default)
    {
        var shift = await _context.Shifts
            .FirstOrDefaultAsync(s => s.Id == shiftId, cancellationToken);

        if (shift == null)
        {
            throw new NotFoundException("SHIFT_NOT_FOUND", $"Không tìm thấy ca làm việc với ID '{shiftId}'.");
        }

        if (shift.Status != ShiftStatus.Open)
        {
            throw new BusinessRuleException("SHIFT_NOT_OPEN",
                $"Không thể thêm giao dịch tiền mặt vào ca đã đóng (#{shift.ShiftNumber}).");
        }

        if (request.Amount <= 0)
        {
            throw new BusinessRuleException("INVALID_AMOUNT", "Số tiền biến động phải lớn hơn 0 đồng.");
        }

        var movement = new ShiftCashMovement
        {
            ShiftId = shift.Id,
            Amount = request.Amount,
            Type = request.Type,
            Reason = request.Reason,
            CreatedByUserId = userId
        };

        _context.ShiftCashMovements.Add(movement);

        if (request.Type == CashMovementType.CashIn)
        {
            shift.TotalCashIn += request.Amount;
        }
        else
        {
            shift.TotalCashOut += request.Amount;
        }

        shift.ExpectedEndingCash = shift.StartingCash + shift.TotalCashSales + shift.TotalCashIn - shift.TotalCashOut;

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Ca #{ShiftNumber} biến động tiền mặt: {Type} {Amount:N0} đ. Lý do: {Reason}",
            shift.ShiftNumber, request.Type, request.Amount, request.Reason);

        return await MapToShiftDtoAsync(shift.Id, cancellationToken);
    }

    public async Task<CurrentShiftStatusDto> GetCurrentShiftAsync(
        Guid storeId,
        Guid cashierId,
        CancellationToken cancellationToken = default)
    {
        var openShift = await _context.Shifts
            .Where(s => s.StoreId == storeId && s.Status == ShiftStatus.Open)
            .OrderByDescending(s => s.OpenedAt)
            .Select(s => s.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (openShift == Guid.Empty)
        {
            return new CurrentShiftStatusDto(false, null);
        }

        var shiftDto = await MapToShiftDtoAsync(openShift, cancellationToken);
        return new CurrentShiftStatusDto(true, shiftDto);
    }

    public async Task<ZReportDto> GetZReportAsync(
        Guid shiftId,
        CancellationToken cancellationToken = default)
    {
        var shift = await _context.Shifts
            .Include(s => s.Store)
            .Include(s => s.Cashier)
            .Include(s => s.Movements)
                .ThenInclude(m => m.CreatedByUser)
            .FirstOrDefaultAsync(s => s.Id == shiftId, cancellationToken);

        if (shift == null)
        {
            throw new NotFoundException("SHIFT_NOT_FOUND", $"Không tìm thấy ca làm việc với ID '{shiftId}'.");
        }

        var storeName = shift.Store?.Name ?? "Chi nhánh F&B";
        var cashierName = shift.Cashier?.FullName ?? "Thu ngân";
        var totalRevenue = shift.TotalCashSales + shift.TotalBankTransferSales + shift.TotalCardSales;

        var movementDtos = shift.Movements
            .OrderBy(m => m.CreatedAt)
            .Select(m => new ShiftCashMovementDto(
                m.Id,
                m.ShiftId,
                m.Amount,
                m.Type,
                m.Reason,
                m.CreatedByUserId,
                m.CreatedByUser?.FullName,
                m.CreatedAt
            ))
            .ToList();

        return new ZReportDto(
            ShiftId: shift.Id,
            ShiftNumber: shift.ShiftNumber,
            StoreName: storeName,
            CashierName: cashierName,
            OpenedAt: shift.OpenedAt,
            ClosedAt: shift.ClosedAt ?? DateTime.UtcNow,
            StartingCash: shift.StartingCash,
            TotalCashSales: shift.TotalCashSales,
            TotalBankTransferSales: shift.TotalBankTransferSales,
            TotalCardSales: shift.TotalCardSales,
            TotalRevenue: totalRevenue,
            TotalCashIn: shift.TotalCashIn,
            TotalCashOut: shift.TotalCashOut,
            ExpectedEndingCash: shift.ExpectedEndingCash,
            ActualEndingCash: shift.ActualEndingCash ?? shift.ExpectedEndingCash,
            CashDiscrepancy: shift.CashDiscrepancy ?? 0,
            TotalOrdersCount: shift.TotalOrdersCount,
            Notes: shift.Notes,
            Movements: movementDtos
        );
    }

    public async Task<PagedResult<ShiftDto>> GetShiftHistoryAsync(
        Guid storeId,
        int pageNumber,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Shifts
            .Where(s => s.StoreId == storeId)
            .OrderByDescending(s => s.OpenedAt);

        var totalCount = await query.CountAsync(cancellationToken);

        var shiftIds = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(s => s.Id)
            .ToListAsync(cancellationToken);

        var dtos = new List<ShiftDto>();
        foreach (var id in shiftIds)
        {
            dtos.Add(await MapToShiftDtoAsync(id, cancellationToken));
        }

        return new PagedResult<ShiftDto>(dtos, totalCount, pageNumber, pageSize);
    }

    private async Task<ShiftDto> MapToShiftDtoAsync(Guid shiftId, CancellationToken cancellationToken)
    {
        var s = await _context.Shifts
            .Include(x => x.Store)
            .Include(x => x.Cashier)
            .Include(x => x.Movements)
                .ThenInclude(m => m.CreatedByUser)
            .FirstAsync(x => x.Id == shiftId, cancellationToken);

        var movementDtos = s.Movements
            .OrderBy(m => m.CreatedAt)
            .Select(m => new ShiftCashMovementDto(
                m.Id,
                m.ShiftId,
                m.Amount,
                m.Type,
                m.Reason,
                m.CreatedByUserId,
                m.CreatedByUser?.FullName,
                m.CreatedAt
            ))
            .ToList();

        return new ShiftDto(
            s.Id,
            s.ShiftNumber,
            s.StoreId,
            s.Store?.Name,
            s.CashierId,
            s.Cashier?.FullName,
            s.OpenedAt,
            s.ClosedAt,
            s.Status,
            s.StartingCash,
            s.TotalCashSales,
            s.TotalBankTransferSales,
            s.TotalCardSales,
            s.TotalCashIn,
            s.TotalCashOut,
            s.ExpectedEndingCash,
            s.ActualEndingCash,
            s.CashDiscrepancy,
            s.TotalOrdersCount,
            s.Notes,
            movementDtos
        );
    }
}
