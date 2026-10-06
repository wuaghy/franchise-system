using Franchise.Application.DTOs.Costing;

namespace Franchise.Application.Common.Interfaces;

public interface ICostingService
{
    Task<ProductCostingResponse> CalculateProductCostAsync(Guid productId, Guid? storeId = null, CancellationToken ct = default);
    Task<List<ProductCostingResponse>> GetAllProductsCostingAsync(Guid? storeId = null, CancellationToken ct = default);
    Task<SimulateRecipeCostResponse> SimulateRecipeCostAsync(SimulateRecipeCostRequest request, CancellationToken ct = default);
    Task<StoreGrossMarginReportResponse> GetStoreGrossMarginReportAsync(Guid storeId, DateTime? fromDate = null, DateTime? toDate = null, CancellationToken ct = default);
}
