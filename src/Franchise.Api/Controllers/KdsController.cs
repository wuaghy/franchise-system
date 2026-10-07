using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Kds;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Franchise.Api.Controllers;

[Authorize(Policy = "RequireStoreAccess")]
[ApiController]
[Route("api/stores/{storeId:guid}/kds")]
[Produces("application/json")]
public class KdsController : ControllerBase
{
    private readonly IKitchenDisplayService _kdsService;
    private readonly ICurrentUserService _currentUserService;

    public KdsController(
        IKitchenDisplayService kdsService,
        ICurrentUserService currentUserService)
    {
        _kdsService = kdsService;
        _currentUserService = currentUserService;
    }

    /// <summary>
    /// Lấy danh sách toàn bộ vé pha chế đang hoạt động tại quầy bar của chi nhánh (New, InPreparation, Ready).
    /// </summary>
    [AllowAnonymous]
    [HttpGet("active")]
    [HttpGet("/api/kds/active")]
    [HttpGet("/kds/active")]
    [HttpGet("/api/kds/stores/{storeId:guid}/active")]
    [ProducesResponseType(typeof(List<KitchenTicketDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetActiveTickets(
        [FromRoute] Guid? storeId, 
        [FromQuery] Guid? queryStoreId,
        CancellationToken ct)
    {
        var effectiveStoreId = storeId ?? queryStoreId ?? Guid.Parse("22222222-2222-2222-2222-222222222222");
        var tickets = await _kdsService.GetActiveTicketsAsync(effectiveStoreId, ct);
        return Ok(tickets);
    }

    /// <summary>
    /// Lấy chi tiết vé pha chế KDS theo ID.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("tickets/{ticketId:guid}")]
    [HttpGet("/api/kds/tickets/{ticketId:guid}")]
    [HttpGet("/kds/tickets/{ticketId:guid}")]
    [ProducesResponseType(typeof(KitchenTicketDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetTicketById([FromRoute] Guid ticketId, [FromRoute] Guid? storeId, CancellationToken ct)
    {
        var ticket = await _kdsService.GetTicketByIdAsync(ticketId, ct);
        return Ok(ticket);
    }

    /// <summary>
    /// Barista bắt đầu pha chế đơn hàng (chuyển trạng thái sang InPreparation, khởi động đồng hồ SLA).
    /// </summary>
    [AllowAnonymous]
    [HttpPost("tickets/{ticketId:guid}/start")]
    [HttpPost("/api/kds/tickets/{ticketId:guid}/start")]
    [HttpPost("/kds/tickets/{ticketId:guid}/start")]
    [ProducesResponseType(typeof(KitchenTicketDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> StartPreparation([FromRoute] Guid ticketId, [FromRoute] Guid? storeId, CancellationToken ct)
    {
        var baristaId = _currentUserService.UserId;
        var ticket = await _kdsService.StartPreparationAsync(ticketId, baristaId, ct);
        return Ok(ticket);
    }

    /// <summary>
    /// Toggle trạng thái hoàn thành của từng món trong vé pha chế (chạm màn hình để tick).
    /// </summary>
    [AllowAnonymous]
    [HttpPost("tickets/{ticketId:guid}/items/{itemId:guid}/toggle")]
    [HttpPost("/api/kds/tickets/{ticketId:guid}/items/{itemId:guid}/toggle")]
    [HttpPost("/kds/tickets/{ticketId:guid}/items/{itemId:guid}/toggle")]
    [ProducesResponseType(typeof(KitchenTicketDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ToggleItemPrepared(
        [FromRoute] Guid ticketId, 
        [FromRoute] Guid itemId, 
        [FromRoute] Guid? storeId, 
        CancellationToken ct)
    {
        var ticket = await _kdsService.ToggleItemPreparedAsync(ticketId, itemId, ct);
        return Ok(ticket);
    }

    /// <summary>
    /// Toggle kiểm tra Topping/Modifier của từng món (chạm để xác nhận đúng yêu cầu khách).
    /// </summary>
    [AllowAnonymous]
    [HttpPost("tickets/{ticketId:guid}/modifiers/{modifierId:guid}/toggle")]
    [HttpPost("/api/kds/tickets/{ticketId:guid}/modifiers/{modifierId:guid}/toggle")]
    [HttpPost("/kds/tickets/{ticketId:guid}/modifiers/{modifierId:guid}/toggle")]
    [ProducesResponseType(typeof(KitchenTicketDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ToggleModifierChecked(
        [FromRoute] Guid ticketId, 
        [FromRoute] Guid modifierId, 
        [FromRoute] Guid? storeId, 
        CancellationToken ct)
    {
        var ticket = await _kdsService.ToggleModifierCheckedAsync(ticketId, modifierId, ct);
        return Ok(ticket);
    }

    /// <summary>
    /// Barista bấm hoàn thành pha chế tất cả các món (chuyển trạng thái sang Ready - chuông báo trả khách).
    /// </summary>
    [AllowAnonymous]
    [HttpPost("tickets/{ticketId:guid}/ready")]
    [HttpPost("/api/kds/tickets/{ticketId:guid}/ready")]
    [HttpPost("/kds/tickets/{ticketId:guid}/ready")]
    [ProducesResponseType(typeof(KitchenTicketDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkReady([FromRoute] Guid ticketId, [FromRoute] Guid? storeId, CancellationToken ct)
    {
        var ticket = await _kdsService.MarkTicketReadyAsync(ticketId, ct);
        return Ok(ticket);
    }

    /// <summary>
    /// Nhân viên trả đồ cho khách hàng (chuyển trạng thái sang Completed, ẩn khỏi màn hình KDS).
    /// </summary>
    [AllowAnonymous]
    [HttpPost("tickets/{ticketId:guid}/complete")]
    [HttpPost("/api/kds/tickets/{ticketId:guid}/complete")]
    [HttpPost("/kds/tickets/{ticketId:guid}/complete")]
    [ProducesResponseType(typeof(KitchenTicketDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Complete([FromRoute] Guid ticketId, [FromRoute] Guid? storeId, CancellationToken ct)
    {
        var ticket = await _kdsService.CompleteTicketAsync(ticketId, ct);
        return Ok(ticket);
    }

    /// <summary>
    /// Hủy vé pha chế KDS kèm lý do (ví dụ: Khách đổi món, lỗi order POS).
    /// </summary>
    [AllowAnonymous]
    [HttpPost("tickets/{ticketId:guid}/cancel")]
    [HttpPost("/api/kds/tickets/{ticketId:guid}/cancel")]
    [HttpPost("/kds/tickets/{ticketId:guid}/cancel")]
    [ProducesResponseType(typeof(KitchenTicketDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Cancel(
        [FromRoute] Guid ticketId, 
        [FromBody] CancelKitchenTicketRequest request, 
        [FromRoute] Guid? storeId, 
        CancellationToken ct)
    {
        var ticket = await _kdsService.CancelTicketAsync(ticketId, request.Reason, ct);
        return Ok(ticket);
    }
}
