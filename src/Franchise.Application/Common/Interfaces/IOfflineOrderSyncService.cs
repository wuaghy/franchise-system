using Franchise.Application.DTOs.Pos;

namespace Franchise.Application.Common.Interfaces;

/// <summary>
/// Service handling resilient bulk synchronization of orders generated offline by POS terminals.
/// </summary>
public interface IOfflineOrderSyncService
{
    Task<BulkSyncOfflineOrdersResponse> SyncOfflineOrdersAsync(
        BulkSyncOfflineOrdersRequest request,
        CancellationToken cancellationToken = default);
}
