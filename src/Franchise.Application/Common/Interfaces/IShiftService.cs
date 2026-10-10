using Franchise.Application.Common.Models;
using Franchise.Application.DTOs.Shifts;

namespace Franchise.Application.Common.Interfaces;

public interface IShiftService
{
    Task<ShiftDto> OpenShiftAsync(
        Guid storeId,
        Guid cashierId,
        OpenShiftRequest request,
        CancellationToken cancellationToken = default);

    Task<ShiftDto> CloseShiftAsync(
        Guid shiftId,
        Guid closedByUserId,
        CloseShiftRequest request,
        CancellationToken cancellationToken = default);

    Task<ShiftDto> AddCashMovementAsync(
        Guid shiftId,
        Guid userId,
        CashMovementRequest request,
        CancellationToken cancellationToken = default);

    Task<CurrentShiftStatusDto> GetCurrentShiftAsync(
        Guid storeId,
        Guid cashierId,
        CancellationToken cancellationToken = default);

    Task<ZReportDto> GetZReportAsync(
        Guid shiftId,
        CancellationToken cancellationToken = default);

    Task<PagedResult<ShiftDto>> GetShiftHistoryAsync(
        Guid storeId,
        int pageNumber,
        int pageSize,
        CancellationToken cancellationToken = default);
}
