using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.SupplyChain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Franchise.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/warehouses")]
[Produces("application/json")]
public class WarehousesController : ControllerBase
{
    private readonly ISupplyChainService _supplyChainService;
    private readonly ICurrentUserService _currentUserService;

    public WarehousesController(
        ISupplyChainService supplyChainService, 
        ICurrentUserService currentUserService)
    {
        _supplyChainService = supplyChainService;
        _currentUserService = currentUserService;
    }

    /// <summary>
    /// Lấy danh sách các Kho tổng trung tâm đang hoạt động
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<WarehouseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetWarehouses(CancellationToken ct)
    {
        var result = await _supplyChainService.GetWarehousesAsync(ct);
        return Ok(result);
    }

    /// <summary>
    /// Lấy danh sách tồn kho và mức tồn an toàn của Kho tổng
    /// </summary>
    [HttpGet("{id:guid}/inventory")]
    [ProducesResponseType(typeof(List<WarehouseInventoryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetWarehouseInventory(Guid id, CancellationToken ct)
    {
        var result = await _supplyChainService.GetWarehouseInventoryAsync(id, ct);
        return Ok(result);
    }

    /// <summary>
    /// Nhập hàng từ Nhà Cung Cấp vào Kho Tổng (Supplier Inbound)
    /// </summary>
    [HttpPost("{id:guid}/inbound")]
    [Authorize(Roles = "SuperAdmin,HQ_Admin,Supply_Chain")]
    [ProducesResponseType(typeof(List<WarehouseInventoryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> InboundWarehouseStock(Guid id, [FromBody] WarehouseInboundRequest request, CancellationToken ct)
    {
        if (id != request.WarehouseId)
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Tham số không hợp lệ",
                Detail = "Id kho trên URL và Body không trùng khớp."
            });
        }

        var userId = _currentUserService.UserId ?? Guid.NewGuid();
        var result = await _supplyChainService.InboundWarehouseStockAsync(request, userId, ct);
        return Ok(result);
    }
}
