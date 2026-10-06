using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Analytics;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Franchise.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/reports")]
[Produces("application/json")]
public class ReportsController : ControllerBase
{
    private readonly IFinancialAnalyticsService _analyticsService;
    private readonly ICurrentUserService _currentUserService;

    public ReportsController(
        IFinancialAnalyticsService analyticsService,
        ICurrentUserService currentUserService)
    {
        _analyticsService = analyticsService;
        _currentUserService = currentUserService;
    }

    /// <summary>
    /// Lấy báo cáo tổng hợp tài chính của chi nhánh (Doanh thu, VAT, Chiết khấu, COGS và Biên lợi nhuận gộp).
    /// </summary>
    [HttpGet("stores/{storeId:guid}/summary")]
    [ProducesResponseType(typeof(FinancialSummaryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetStoreSummary(
        [FromRoute] Guid storeId,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        CancellationToken ct)
    {
        var result = await _analyticsService.GetStoreSummaryAsync(storeId, fromDate, toDate, ct);
        return Ok(result);
    }

    /// <summary>
    /// Biểu đồ nhiệt doanh thu theo 24 giờ (Hourly Sales Heatmap) giúp nhận diện khung giờ cao điểm (Peak Hours).
    /// </summary>
    [HttpGet("stores/{storeId:guid}/hourly-heatmap")]
    [ProducesResponseType(typeof(HourlySalesHeatmapDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetHourlyHeatmap(
        [FromRoute] Guid storeId,
        [FromQuery] DateTime? date,
        CancellationToken ct)
    {
        var result = await _analyticsService.GetHourlySalesHeatmapAsync(storeId, date, ct);
        return Ok(result);
    }

    /// <summary>
    /// Xếp hạng hiệu suất bán hàng của từng món (Pareto Menu Performance), đóng góp doanh thu và lợi nhuận.
    /// </summary>
    [HttpGet("stores/{storeId:guid}/products")]
    [ProducesResponseType(typeof(List<ProductSalesRankDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetProductPerformance(
        [FromRoute] Guid storeId,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] int top = 10,
        CancellationToken ct = default)
    {
        var result = await _analyticsService.GetProductSalesPerformanceAsync(storeId, fromDate, toDate, top, ct);
        return Ok(result);
    }

    /// <summary>
    /// Báo cáo tổng quan toàn mạng lưới chuỗi nhượng quyền dành cho HQ SuperAdmin (So sánh doanh số các chi nhánh).
    /// </summary>
    [HttpGet("network/overview")]
    [ProducesResponseType(typeof(NetworkOverviewDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetNetworkOverview(
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        CancellationToken ct)
    {
        var result = await _analyticsService.GetNetworkOverviewAsync(fromDate, toDate, ct);
        return Ok(result);
    }
}
