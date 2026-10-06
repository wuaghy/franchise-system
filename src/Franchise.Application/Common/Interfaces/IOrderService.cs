using Franchise.Application.DTOs.Orders;

namespace Franchise.Application.Common.Interfaces;

public interface IOrderService
{
    /// <summary>
    /// Thực hiện checkout đơn hàng tại quầy POS: tính giá an toàn, trừ kho nguyên tử, ghi nhận thanh toán và phát sinh Outbox event trong 1 transaction.
    /// </summary>
    Task<CheckoutOrderResponse> CheckoutAsync(CheckoutOrderRequest request, string? idempotencyKey = null, CancellationToken ct = default);
}
