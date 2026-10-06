using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Costing;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Franchise.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/costing")]
[Produces("application/json")]
public class CostingController : ControllerBase
{
    private readonly ICostingService _costingService;

    public CostingController(ICostingService costingService)
    {
        _costingService = costingService;
    }

    /// <summary>
    /// Lấy danh sách toàn bộ sản phẩm kèm COGS và tỷ suất biên lợi nhuận (Gross Margin)
    /// </summary>
    [HttpGet("products")]
    [ProducesResponseType(typeof(List<ProductCostingResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllProductsCosting([FromQuery] Guid? storeId, CancellationToken ct)
    {
        var result = await _costingService.GetAllProductsCostingAsync(storeId, ct);
        return Ok(result);
    }

    /// <summary>
    /// Phân tích chi tiết giá vốn hàng bán và cơ cấu chi phí nguyên liệu của một sản phẩm
    /// </summary>
    [HttpGet("products/{productId:guid}")]
    [ProducesResponseType(typeof(ProductCostingResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetProductCost(Guid productId, [FromQuery] Guid? storeId, CancellationToken ct)
    {
        var result = await _costingService.CalculateProductCostAsync(productId, storeId, ct);
        return Ok(result);
    }

    /// <summary>
    /// Sandbox mô phỏng công thức What-If: thử nghiệm thay đổi định lượng và giá bán để tính toán COGS và Margin tức thời (không lưu vào DB)
    /// </summary>
    [HttpPost("simulate")]
    [ProducesResponseType(typeof(SimulateRecipeCostResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SimulateRecipe([FromBody] SimulateRecipeCostRequest request, CancellationToken ct)
    {
        var result = await _costingService.SimulateRecipeCostAsync(request, ct);
        return Ok(result);
    }

    /// <summary>
    /// Báo cáo biên lợi nhuận gộp thực tế của chi nhánh dựa trên doanh số và tiêu hao nguyên liệu
    /// </summary>
    [HttpGet("stores/{storeId:guid}/margin-report")]
    [Authorize(Policy = "RequireStoreAccess")]
    [ProducesResponseType(typeof(StoreGrossMarginReportResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetStoreMarginReport(
        Guid storeId,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        CancellationToken ct)
    {
        var result = await _costingService.GetStoreGrossMarginReportAsync(storeId, fromDate, toDate, ct);
        return Ok(result);
    }
}
