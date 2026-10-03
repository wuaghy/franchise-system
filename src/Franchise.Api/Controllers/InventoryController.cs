using Microsoft.AspNetCore.Mvc;
using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Inventory;

namespace Franchise.Api.Controllers;

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
    [HttpPost("inbound")]
    [ProducesResponseType(typeof(StoreInventoryResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> InboundStock(Guid storeId, [FromBody] InboundStockRequest request)
    {
        if (storeId != request.StoreId)
        {
            return BadRequest("StoreId trong URL và Body không trùng khớp.");
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
    public async Task<IActionResult> DeductOrderStock(Guid storeId, [FromBody] CheckoutOrderInventoryRequest request)
    {
        if (storeId != request.StoreId)
        {
            return BadRequest("StoreId trong URL và Body không trùng khớp.");
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
}
