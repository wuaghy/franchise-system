using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Pos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Franchise.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/pos")]
[Produces("application/json")]
public class PosSyncController : ControllerBase
{
    private readonly IOfflineOrderSyncService _offlineOrderSyncService;

    public PosSyncController(IOfflineOrderSyncService offlineOrderSyncService)
    {
        _offlineOrderSyncService = offlineOrderSyncService;
    }

    /// <summary>
    /// Đồng bộ hàng loạt đơn hàng được thanh toán ngoại tuyến (Offline POS) khi có mạng trở lại.
    /// </summary>
    [HttpPost("offline-sync")]
    [ProducesResponseType(typeof(BulkSyncOfflineOrdersResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> BulkSyncOfflineOrders(
        [FromBody] BulkSyncOfflineOrdersRequest request,
        CancellationToken ct)
    {
        var response = await _offlineOrderSyncService.SyncOfflineOrdersAsync(request, ct);
        return Ok(response);
    }
}
