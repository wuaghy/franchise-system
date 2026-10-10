using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.SupplyChain;
using Franchise.Domain.Exceptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Franchise.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/transfers")]
[Produces("application/json")]
public class TransfersController : ControllerBase
{
    private readonly ISupplyChainService _supplyChainService;
    private readonly ICurrentUserService _currentUserService;

    public TransfersController(
        ISupplyChainService supplyChainService, 
        ICurrentUserService currentUserService)
    {
        _supplyChainService = supplyChainService;
        _currentUserService = currentUserService;
    }

    /// <summary>
    /// Lấy danh sách các đơn điều chuyển hàng (hỗ trợ lọc theo storeId, warehouseId, status, searchTerm)
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<StockTransferOrderDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTransferOrders([FromQuery] TransferOrderFilterDto filter, CancellationToken ct)
    {
        // Phân quyền đa chi nhánh: Nếu không phải HQ SuperAdmin hay Supply Chain Officer, chỉ xem đơn của chi nhánh mình
        if (!_currentUserService.IsSuperAdmin && _currentUserService.Role != "Supply_Chain_Officer")
        {
            if (_currentUserService.StoreId.HasValue)
            {
                filter = filter with { StoreId = _currentUserService.StoreId.Value };
            }
        }

        var result = await _supplyChainService.GetTransferOrdersAsync(filter, ct);
        return Ok(result);
    }

    /// <summary>
    /// Lấy chi tiết đơn điều chuyển hàng theo Id
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(StockTransferOrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetTransferOrderById(Guid id, CancellationToken ct)
    {
        var result = await _supplyChainService.GetTransferOrderByIdAsync(id, ct);
        return Ok(result);
    }

    /// <summary>
    /// Tạo mới một đơn đề xuất điều chuyển hàng (Trạng thái Draft)
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "HQ_SuperAdmin,Store_Manager,Supply_Chain_Officer")]
    [ProducesResponseType(typeof(StockTransferOrderDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateTransferOrder([FromBody] CreateTransferOrderRequest request, CancellationToken ct)
    {
        // Nếu là Store Manager thì đảm bảo DestinationStoreId là chi nhánh của mình
        if (!_currentUserService.IsSuperAdmin && _currentUserService.Role != "Supply_Chain_Officer")
        {
            if (_currentUserService.StoreId.HasValue)
            {
                request = request with { DestinationStoreId = _currentUserService.StoreId.Value };
            }
        }

        var userId = _currentUserService.UserId ?? Guid.NewGuid();
        var result = await _supplyChainService.CreateTransferOrderAsync(request, userId, ct);
        return CreatedAtAction(nameof(GetTransferOrderById), new { id = result.Id }, result);
    }

    /// <summary>
    /// Cập nhật nội dung đơn điều chuyển (chỉ áp dụng cho đơn đang ở trạng thái Draft)
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Roles = "HQ_SuperAdmin,Store_Manager,Supply_Chain_Officer")]
    [ProducesResponseType(typeof(StockTransferOrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateTransferOrder(Guid id, [FromBody] UpdateTransferOrderRequest request, CancellationToken ct)
    {
        var userId = _currentUserService.UserId ?? Guid.NewGuid();
        var result = await _supplyChainService.UpdateTransferOrderAsync(id, request, userId, ct);
        return Ok(result);
    }

    /// <summary>
    /// Trình duyệt đơn lên HQ (Draft -> Submitted)
    /// </summary>
    [HttpPost("{id:guid}/submit")]
    [Authorize(Roles = "HQ_SuperAdmin,Store_Manager,Supply_Chain_Officer")]
    [ProducesResponseType(typeof(StockTransferOrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SubmitTransferOrder(Guid id, CancellationToken ct)
    {
        var userId = _currentUserService.UserId ?? Guid.NewGuid();
        var result = await _supplyChainService.SubmitTransferOrderAsync(id, userId, ct);
        return Ok(result);
    }

    /// <summary>
    /// HQ phê duyệt số lượng cấp phát (Submitted -> Approved)
    /// </summary>
    [HttpPost("{id:guid}/approve")]
    [Authorize(Roles = "HQ_SuperAdmin,Supply_Chain_Officer")]
    [ProducesResponseType(typeof(StockTransferOrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ApproveTransferOrder(Guid id, [FromBody] ApproveTransferOrderRequest request, CancellationToken ct)
    {
        var userId = _currentUserService.UserId ?? Guid.NewGuid();
        var result = await _supplyChainService.ApproveTransferOrderAsync(id, request, userId, ct);
        return Ok(result);
    }

    /// <summary>
    /// HQ từ chối đơn điều chuyển (Submitted -> Rejected)
    /// </summary>
    [HttpPost("{id:guid}/reject")]
    [Authorize(Roles = "HQ_SuperAdmin,Supply_Chain_Officer")]
    [ProducesResponseType(typeof(StockTransferOrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RejectTransferOrder(Guid id, [FromBody] RejectTransferOrderRequest request, CancellationToken ct)
    {
        var userId = _currentUserService.UserId ?? Guid.NewGuid();
        var result = await _supplyChainService.RejectTransferOrderAsync(id, request.Reason, userId, ct);
        return Ok(result);
    }

    /// <summary>
    /// Kho tổng xuất hàng & gán mã vận đơn (Approved -> Dispatched)
    /// </summary>
    [HttpPost("{id:guid}/dispatch")]
    [Authorize(Roles = "HQ_SuperAdmin,Supply_Chain_Officer")]
    [ProducesResponseType(typeof(StockTransferOrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> DispatchTransferOrder(Guid id, [FromBody] DispatchTransferOrderRequest request, CancellationToken ct)
    {
        var userId = _currentUserService.UserId ?? Guid.NewGuid();
        var result = await _supplyChainService.DispatchTransferOrderAsync(id, request, userId, ct);
        return Ok(result);
    }

    /// <summary>
    /// Chi nhánh nghiệm thu hàng nhập tại quầy (Dispatched -> Received / DiscrepancyReported)
    /// </summary>
    [HttpPost("{id:guid}/receive")]
    [Authorize(Roles = "HQ_SuperAdmin,Store_Manager,Supply_Chain_Officer")]
    [ProducesResponseType(typeof(StockTransferOrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ReceiveTransferOrder(Guid id, [FromBody] ReceiveTransferOrderRequest request, CancellationToken ct)
    {
        var userId = _currentUserService.UserId ?? Guid.NewGuid();
        var result = await _supplyChainService.ReceiveTransferOrderAsync(id, request, userId, ct);
        return Ok(result);
    }

    /// <summary>
    /// HQ phê duyệt biên bản xử lý hao hụt / lệch kho (DiscrepancyReported -> Received)
    /// </summary>
    [HttpPost("{id:guid}/resolve-discrepancy")]
    [Authorize(Roles = "HQ_SuperAdmin,Supply_Chain_Officer")]
    [ProducesResponseType(typeof(StockTransferOrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ResolveDiscrepancy(Guid id, [FromBody] ResolveDiscrepancyRequest request, CancellationToken ct)
    {
        var userId = _currentUserService.UserId ?? Guid.NewGuid();
        var result = await _supplyChainService.ResolveDiscrepancyAsync(id, request.ResolutionNotes, userId, ct);
        return Ok(result);
    }

    /// <summary>
    /// Hủy đơn điều chuyển (trước khi xuất kho)
    /// </summary>
    [HttpPost("{id:guid}/cancel")]
    [Authorize(Roles = "HQ_SuperAdmin,Store_Manager,Supply_Chain_Officer")]
    [ProducesResponseType(typeof(StockTransferOrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CancelTransferOrder(Guid id, CancellationToken ct)
    {
        var userId = _currentUserService.UserId ?? Guid.NewGuid();
        var result = await _supplyChainService.CancelTransferOrderAsync(id, userId, ct);
        return Ok(result);
    }

    /// <summary>
    /// Lấy gợi ý tự động đặt hàng & dự trù tồn kho cho chi nhánh (Auto-Reorder & PO Suggestions)
    /// </summary>
    [HttpGet("suggestions/{storeId:guid}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AutoReorderSuggestionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetAutoReorderSuggestions(
        Guid storeId,
        [FromQuery] int planningDays = 7,
        [FromQuery] int leadTimeDays = 2,
        CancellationToken ct = default)
    {
        var result = await _supplyChainService.GetAutoReorderSuggestionsAsync(storeId, planningDays, leadTimeDays, ct);
        return Ok(result);
    }

    /// <summary>
    /// Báo cáo Phân tích Chuỗi Cung ứng & Lead-Time KPI toàn chuỗi
    /// </summary>
    [HttpGet("kpis")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(SupplyChainKpiSummaryDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSupplyChainKpis(
        [FromQuery] Guid? storeId,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        CancellationToken ct = default)
    {
        var result = await _supplyChainService.GetSupplyChainKpisAsync(storeId, fromDate, toDate, ct);
        return Ok(result);
    }
}

