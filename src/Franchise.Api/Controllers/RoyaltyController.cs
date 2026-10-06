using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Royalty;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Franchise.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/royalty")]
[Produces("application/json")]
public class RoyaltyController : ControllerBase
{
    private readonly IRoyaltyBillingService _royaltyService;

    public RoyaltyController(IRoyaltyBillingService royaltyService)
    {
        _royaltyService = royaltyService;
    }

    /// <summary>
    /// Lấy danh sách hóa đơn thu phí nhượng quyền (có thể lọc theo storeId, năm, tháng).
    /// </summary>
    [HttpGet("invoices")]
    [ProducesResponseType(typeof(List<RoyaltyInvoiceDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetInvoices(
        [FromQuery] Guid? storeId,
        [FromQuery] int? year,
        [FromQuery] int? month,
        CancellationToken ct)
    {
        var result = await _royaltyService.GetInvoicesAsync(storeId, year, month, ct);
        return Ok(result);
    }

    /// <summary>
    /// Lấy chi tiết hóa đơn phí nhượng quyền theo Id.
    /// </summary>
    [HttpGet("invoices/{invoiceId:guid}")]
    [ProducesResponseType(typeof(RoyaltyInvoiceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetInvoiceById(
        [FromRoute] Guid invoiceId,
        CancellationToken ct)
    {
        var result = await _royaltyService.GetInvoiceByIdAsync(invoiceId, ct);
        return Ok(result);
    }

    /// <summary>
    /// Tạo mới/tính toán hóa đơn phí nhượng quyền cho một chi nhánh trong kỳ chỉ định (Status: Draft).
    /// </summary>
    [HttpPost("invoices/generate")]
    [ProducesResponseType(typeof(RoyaltyInvoiceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GenerateInvoice(
        [FromBody] GenerateRoyaltyInvoiceRequest request,
        CancellationToken ct)
    {
        var result = await _royaltyService.GenerateInvoiceAsync(request, ct);
        return Ok(result);
    }

    /// <summary>
    /// Tự động sinh hàng loạt hóa đơn phí nhượng quyền cho toàn bộ mạng lưới chi nhánh trong tháng.
    /// </summary>
    [HttpPost("invoices/generate-network")]
    [ProducesResponseType(typeof(List<RoyaltyInvoiceDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GenerateNetworkInvoices(
        [FromQuery] int year,
        [FromQuery] int month,
        CancellationToken ct)
    {
        var result = await _royaltyService.GenerateMonthlyInvoicesForNetworkAsync(year, month, ct);
        return Ok(result);
    }

    /// <summary>
    /// Phát hành hóa đơn gửi tới chủ nhượng quyền chi nhánh (Draft -> Issued).
    /// </summary>
    [HttpPost("invoices/{invoiceId:guid}/issue")]
    [ProducesResponseType(typeof(RoyaltyInvoiceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> IssueInvoice(
        [FromRoute] Guid invoiceId,
        CancellationToken ct)
    {
        var result = await _royaltyService.IssueInvoiceAsync(invoiceId, ct);
        return Ok(result);
    }

    /// <summary>
    /// Xác nhận chi nhánh đã nộp phí nhượng quyền thành công (Issued -> Paid).
    /// </summary>
    [HttpPost("invoices/{invoiceId:guid}/pay")]
    [ProducesResponseType(typeof(RoyaltyInvoiceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> PayInvoice(
        [FromRoute] Guid invoiceId,
        [FromBody] PayRoyaltyInvoiceRequest request,
        CancellationToken ct)
    {
        var result = await _royaltyService.MarkInvoicePaidAsync(invoiceId, request, ct);
        return Ok(result);
    }

    /// <summary>
    /// Hủy hóa đơn phí nhượng quyền kèm lý do.
    /// </summary>
    [HttpPost("invoices/{invoiceId:guid}/cancel")]
    [ProducesResponseType(typeof(RoyaltyInvoiceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CancelInvoice(
        [FromRoute] Guid invoiceId,
        [FromBody] CancelRoyaltyInvoiceRequest request,
        CancellationToken ct)
    {
        var result = await _royaltyService.CancelInvoiceAsync(invoiceId, request, ct);
        return Ok(result);
    }

    /// <summary>
    /// Lấy cấu hình tỷ lệ phí nhượng quyền của chi nhánh.
    /// </summary>
    [HttpGet("settings/{storeId:guid}")]
    [ProducesResponseType(typeof(StoreRoyaltySettingDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetStoreSetting(
        [FromRoute] Guid storeId,
        CancellationToken ct)
    {
        var result = await _royaltyService.GetStoreRoyaltySettingAsync(storeId, ct);
        return Ok(result);
    }

    /// <summary>
    /// Cập nhật cấu hình tỷ lệ phí nhượng quyền cho chi nhánh.
    /// </summary>
    [HttpPut("settings/{storeId:guid}")]
    [ProducesResponseType(typeof(StoreRoyaltySettingDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateStoreSetting(
        [FromRoute] Guid storeId,
        [FromBody] UpdateStoreRoyaltySettingRequest request,
        CancellationToken ct)
    {
        var result = await _royaltyService.UpdateStoreRoyaltySettingAsync(storeId, request, ct);
        return Ok(result);
    }
}
