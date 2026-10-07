using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Orders;
using Franchise.Application.DTOs.Realtime;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Franchise.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/orders")]
[Produces("application/json")]
public class OrdersController : ControllerBase
{
    private readonly IOrderService _orderService;
    private readonly IRealtimeNotificationService _realtimeNotificationService;

    public OrdersController(
        IOrderService orderService,
        IRealtimeNotificationService realtimeNotificationService)
    {
        _orderService = orderService;
        _realtimeNotificationService = realtimeNotificationService;
    }

    /// <summary>
    /// Thanh toán đơn hàng tại quầy POS với cơ chế Anti-Tampering, Atomic Decrement và Transactional Outbox.
    /// </summary>
    /// <param name="request">Thông tin thanh toán giỏ hàng POS</param>
    /// <param name="idempotencyKey">Khóa chống lặp giao dịch</param>
    /// <param name="ct">CancellationToken</param>
    /// <returns>Thông tin đơn hàng đã tạo, chi tiết khấu trừ nguyên liệu và trạng thái thanh toán</returns>
    [AllowAnonymous]
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

        // Phát tín hiệu chuông báo Realtime SignalR tới Store và HQ
        await _realtimeNotificationService.NotifyOrderCompletedAsync(new OrderCompletedNotification(
            result.OrderId,
            result.OrderNumber,
            request.StoreId,
            result.FinalAmount,
            result.CreatedAt
        ), ct);

        return Ok(result);
    }

    /// <summary>
    /// Phát loa/chuông thông báo đơn hàng trực tuyến (ShopeeFood, GrabFood, Web Order) tới các quầy POS và màn hình KDS.
    /// </summary>
    [AllowAnonymous]
    [HttpPost("announce")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> AnnounceOnlineOrder(
        [FromBody] OrderCompletedNotification notification,
        CancellationToken ct)
    {
        await _realtimeNotificationService.NotifyOrderCompletedAsync(notification, ct);
        return Ok(new { success = true, message = "Đã phát tín hiệu chuông báo đơn hàng thành công qua SignalR" });
    }
}
