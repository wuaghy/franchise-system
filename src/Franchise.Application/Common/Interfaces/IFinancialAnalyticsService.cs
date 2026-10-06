using Franchise.Application.DTOs.Analytics;

namespace Franchise.Application.Common.Interfaces;

public interface IFinancialAnalyticsService
{
    Task<FinancialSummaryDto> GetStoreSummaryAsync(Guid storeId, DateTime? fromDate = null, DateTime? toDate = null, CancellationToken ct = default);
    Task<HourlySalesHeatmapDto> GetHourlySalesHeatmapAsync(Guid storeId, DateTime? date = null, CancellationToken ct = default);
    Task<List<ProductSalesRankDto>> GetProductSalesPerformanceAsync(Guid storeId, DateTime? fromDate = null, DateTime? toDate = null, int top = 10, CancellationToken ct = default);
    Task<NetworkOverviewDto> GetNetworkOverviewAsync(DateTime? fromDate = null, DateTime? toDate = null, CancellationToken ct = default);
}
