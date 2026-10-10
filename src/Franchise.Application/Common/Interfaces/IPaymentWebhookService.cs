using Franchise.Application.DTOs.Payments;

namespace Franchise.Application.Common.Interfaces;

public interface IPaymentWebhookService
{
    Task<PaymentWebhookResult> ProcessPayOsWebhookAsync(
        PayOsWebhookPayload payload,
        CancellationToken cancellationToken = default);

    Task<PaymentWebhookResult> ProcessCassoWebhookAsync(
        CassoWebhookPayload payload,
        string? secureToken,
        CancellationToken cancellationToken = default);

    Task<PaymentWebhookResult> SimulateWebhookPaymentAsync(
        SimulatePaymentWebhookRequest request,
        CancellationToken cancellationToken = default);
}
