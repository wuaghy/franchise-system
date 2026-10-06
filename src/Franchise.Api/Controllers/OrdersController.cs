using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Orders;
using Microsoft.AspNetCore.Mvc;

namespace Franchise.Api.Controllers;

[ApiController]
[Route("api/orders")]
[Produces("application/json")]
public class OrdersController : ControllerBase
{
    private readonly IOrderService _orderService;

    public OrdersController(IOrderService orderService)
    {
        _orderService = orderService;
    }

    /// <summary>
    /// Thanh toán đơn hàng tại quầy POS với cơ chế Anti-Tampering, Atomic Decrement và Transactional Outbox.
    /// </summary>
    /// <param name="request">Thông tin thanh toán giỏ hàng POS</param>
    /// <param name="ct">CancellationToken</param>
    /// <returns>Thông tin đơn hàng đã tạo, chi tiết khấu trừ nguyên liệu và trạng thái thanh toán</returns>
    [HttpPost("checkout")]
    [ProducesResponseType(typeof(CheckoutOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Checkout(
        [FromBody] CheckoutOrderRequest request,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
        CancellationToken ct)
    {
        var result = await _orderService.CheckoutAsync(request, idempotencyKey, ct);
        return Ok(result);
    }
}
