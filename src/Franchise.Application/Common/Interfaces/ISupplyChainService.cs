using Franchise.Application.DTOs.SupplyChain;

namespace Franchise.Application.Common.Interfaces;

public interface ISupplyChainService
{
    // Quản lý Đơn Điều Chuyển Hàng (Stock Transfer Orders)
    Task<List<StockTransferOrderDto>> GetTransferOrdersAsync(TransferOrderFilterDto filter, CancellationToken cancellationToken = default);
    Task<StockTransferOrderDto> GetTransferOrderByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<StockTransferOrderDto> CreateTransferOrderAsync(CreateTransferOrderRequest request, Guid currentUserId, CancellationToken cancellationToken = default);
    Task<StockTransferOrderDto> UpdateTransferOrderAsync(Guid id, UpdateTransferOrderRequest request, Guid currentUserId, CancellationToken cancellationToken = default);
    Task<StockTransferOrderDto> SubmitTransferOrderAsync(Guid id, Guid currentUserId, CancellationToken cancellationToken = default);
    Task<StockTransferOrderDto> ApproveTransferOrderAsync(Guid id, ApproveTransferOrderRequest request, Guid currentUserId, CancellationToken cancellationToken = default);
    Task<StockTransferOrderDto> RejectTransferOrderAsync(Guid id, string reason, Guid currentUserId, CancellationToken cancellationToken = default);
    Task<StockTransferOrderDto> DispatchTransferOrderAsync(Guid id, DispatchTransferOrderRequest request, Guid currentUserId, CancellationToken cancellationToken = default);
    Task<StockTransferOrderDto> ReceiveTransferOrderAsync(Guid id, ReceiveTransferOrderRequest request, Guid currentUserId, CancellationToken cancellationToken = default);
    Task<StockTransferOrderDto> ResolveDiscrepancyAsync(Guid id, string resolutionNotes, Guid currentUserId, CancellationToken cancellationToken = default);
    Task<StockTransferOrderDto> CancelTransferOrderAsync(Guid id, Guid currentUserId, CancellationToken cancellationToken = default);

    // Quản lý Kho Tổng Trung Tâm (Central Warehouse)
    Task<List<WarehouseDto>> GetWarehousesAsync(CancellationToken cancellationToken = default);
    Task<List<WarehouseInventoryDto>> GetWarehouseInventoryAsync(Guid warehouseId, CancellationToken cancellationToken = default);
    Task<List<WarehouseInventoryDto>> InboundWarehouseStockAsync(WarehouseInboundRequest request, Guid currentUserId, CancellationToken cancellationToken = default);
}
