using System.Security.Claims;
using Franchise.Application.Common.Interfaces;
using Franchise.Application.Common.Models;
using Franchise.Application.DTOs.Shifts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Franchise.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class ShiftsController : ControllerBase
{
    private readonly IShiftService _shiftService;
    private readonly ICurrentUserService _currentUserService;

    public ShiftsController(
        IShiftService shiftService,
        ICurrentUserService currentUserService)
    {
        _shiftService = shiftService;
        _currentUserService = currentUserService;
    }

    /// <summary>
    /// Mở ca làm việc mới và nhập số tiền lẻ mồi két ban đầu (Opening Cash Float)
    /// </summary>
    [HttpPost("open")]
    [ProducesResponseType(typeof(ShiftDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> OpenShift(
        [FromBody] OpenShiftRequest request,
        CancellationToken cancellationToken)
    {
        var cashierId = _currentUserService.UserId ?? Guid.NewGuid();
        var shift = await _shiftService.OpenShiftAsync(request.StoreId, cashierId, request, cancellationToken);
        return Ok(shift);
    }

    /// <summary>
    /// Chốt ca làm việc, kiểm đếm tiền mặt thực tế và tính chênh lệch két (Closing Shift & Variance)
    /// </summary>
    [HttpPost("{id:guid}/close")]
    [ProducesResponseType(typeof(ShiftDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CloseShift(
        [FromRoute] Guid id,
        [FromBody] CloseShiftRequest request,
        CancellationToken cancellationToken)
    {
        var closedByUserId = _currentUserService.UserId ?? Guid.NewGuid();
        var shift = await _shiftService.CloseShiftAsync(id, closedByUserId, request, cancellationToken);
        return Ok(shift);
    }

    /// <summary>
    /// Ghi nhận biến động tiền mặt trong két (Nạp thêm tiền lẻ hoặc Chi tiền vặt khẩn cấp)
    /// </summary>
    [HttpPost("{id:guid}/movement")]
    [ProducesResponseType(typeof(ShiftDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AddCashMovement(
        [FromRoute] Guid id,
        [FromBody] CashMovementRequest request,
        CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? Guid.NewGuid();
        var shift = await _shiftService.AddCashMovementAsync(id, userId, request, cancellationToken);
        return Ok(shift);
    }

    /// <summary>
    /// Lấy thông tin ca làm việc đang mở của chi nhánh hiện tại
    /// </summary>
    [HttpGet("current")]
    [ProducesResponseType(typeof(CurrentShiftStatusDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCurrentShift(
        [FromQuery] Guid? storeId,
        CancellationToken cancellationToken)
    {
        var targetStoreId = storeId ?? _currentUserService.StoreId ?? Guid.Empty;
        var cashierId = _currentUserService.UserId ?? Guid.Empty;

        var status = await _shiftService.GetCurrentShiftAsync(targetStoreId, cashierId, cancellationToken);
        return Ok(status);
    }

    /// <summary>
    /// Xuất dữ liệu Báo cáo Z (Z-Report) của ca làm việc phục vụ in ấn phiếu bàn giao ca
    /// </summary>
    [HttpGet("{id:guid}/z-report")]
    [ProducesResponseType(typeof(ZReportDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetZReport(
        [FromRoute] Guid id,
        CancellationToken cancellationToken)
    {
        var zReport = await _shiftService.GetZReportAsync(id, cancellationToken);
        return Ok(zReport);
    }

    /// <summary>
    /// Tra cứu lịch sử các ca làm việc của chi nhánh theo phân trang
    /// </summary>
    [HttpGet("history")]
    [ProducesResponseType(typeof(PagedResult<ShiftDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetShiftHistory(
        [FromQuery] Guid storeId,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        var history = await _shiftService.GetShiftHistoryAsync(storeId, pageNumber, pageSize, cancellationToken);
        return Ok(history);
    }
}
