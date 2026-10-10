using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Inventory;
using Franchise.Domain.Exceptions;

namespace Franchise.Api.Controllers;

[Authorize(Policy = "RequireStoreAccess")]
[ApiController]
[Route("api/stores/{storeId:guid}/inventory")]
[Produces("application/json")]
public class InventoryController : ControllerBase
{
    private readonly IInventoryService _inventoryService;

    public InventoryController(IInventoryService inventoryService)
    {
        _inventoryService = inventoryService;
    }

    /// <summary>
    /// Lấy danh sách tồn kho hiện tại của chi nhánh
    /// </summary>
    [AllowAnonymous]
    [HttpGet]
    [ProducesResponseType(typeof(List<StoreInventoryResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetStoreInventory(Guid storeId)
    {
        var result = await _inventoryService.GetStoreInventoryAsync(storeId);
        return Ok(result);
    }

    /// <summary>
    /// Lấy danh sách nguyên vật liệu chạm ngưỡng báo động đỏ (Low Stock Alert)
    /// </summary>
    [AllowAnonymous]
    [HttpGet("low-stock")]
    [ProducesResponseType(typeof(List<LowStockAlertResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetLowStockAlerts(Guid storeId)
    {
        var result = await _inventoryService.GetLowStockAlertsAsync(storeId);
        return Ok(result);
    }

    /// <summary>
    /// Nhập hàng từ Tổng công ty về kho chi nhánh (Inbound)
    /// </summary>
    [AllowAnonymous]
    [HttpPost("inbound")]
    [ProducesResponseType(typeof(StoreInventoryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> InboundStock(Guid storeId, [FromBody] InboundStockRequest request)
    {
        if (storeId != request.StoreId)
        {
            throw new RequestValidationException("storeId", "StoreId trong URL và Body không trùng khớp.");
        }

        var result = await _inventoryService.InboundStockAsync(request);
        return Ok(result);
    }

    /// <summary>
    /// Trừ tồn kho theo đơn hàng POS (Dynamic BoM + Topping Modifier + Atomic Decrement)
    /// </summary>
    [HttpPost("deduct")]
    [ProducesResponseType(typeof(InventoryDeductionResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> DeductOrderStock(Guid storeId, [FromBody] CheckoutOrderInventoryRequest request)
    {
        if (storeId != request.StoreId)
        {
            throw new RequestValidationException("storeId", "StoreId trong URL và Body không trùng khớp.");
        }

        var result = await _inventoryService.ProcessOrderInventoryDeductionAsync(request);
        if (!result.IsSuccess)
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Out Of Stock",
                detail: result.ErrorMessage
            );
        }

        return Ok(result);
    }

    /// <summary>
    /// Ghi nhận xuất hủy nguyên liệu (rơi vỡ, hư hỏng, hết hạn, hao hụt pha chế)
    /// </summary>
    [AllowAnonymous]
    [HttpPost("waste")]
    [ProducesResponseType(typeof(RecordWasteResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RecordWaste(Guid storeId, [FromBody] RecordWasteRequest request, CancellationToken ct)
    {
        if (storeId != request.StoreId)
        {
            throw new RequestValidationException("storeId", "StoreId trong URL và Body không trùng khớp.");
        }

        var result = await _inventoryService.RecordWasteAsync(request, ct);
        return Ok(result);
    }

    /// <summary>
    /// Kích hoạt phát cảnh báo tồn kho tới Telegram Bot và Email Quản lý cửa hàng
    /// </summary>
    [AllowAnonymous]
    [HttpPost("alerts/broadcast")]
    [ProducesResponseType(typeof(AlertBroadcastResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> BroadcastLowStockAlerts(
        Guid storeId, 
        [FromBody] BroadcastStockAlertRequest? request, 
        CancellationToken ct)
    {
        var result = await _inventoryService.BroadcastLowStockAlertsAsync(storeId, request, ct);
        return Ok(result);
    }

    /// <summary>
    /// Cập nhật cấu hình Telegram Chat ID và Email Quản lý của chi nhánh
    /// </summary>
    [AllowAnonymous]
    [HttpPut("alerts/config")]
    [ProducesResponseType(typeof(bool), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateAlertConfig(
        Guid storeId, 
        [FromBody] UpdateStoreAlertConfigRequest request, 
        CancellationToken ct)
    {
        var result = await _inventoryService.UpdateStoreAlertConfigAsync(storeId, request, ct);
        return Ok(result);
    }

    /// <summary>
    /// Nộp phiếu kiểm kê kho kỳ và tự động điều chỉnh cân bằng tồn kho (Stock Audit)
    /// </summary>
    [AllowAnonymous]
    [HttpPost("audit")]
    [ProducesResponseType(typeof(SubmitStockAuditResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SubmitStockAudit(
        Guid storeId,
        [FromBody] SubmitStockAuditRequest request,
        CancellationToken ct)
    {
        if (storeId != request.StoreId)
        {
            throw new RequestValidationException("storeId", "StoreId trong URL và Body không trùng khớp.");
        }

        var result = await _inventoryService.SubmitStockAuditAsync(request, ct);
        return Ok(result);
    }
}

