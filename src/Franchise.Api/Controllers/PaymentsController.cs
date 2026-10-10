using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Payments;
using Microsoft.AspNetCore.Mvc;

namespace Franchise.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class PaymentsController : ControllerBase
{
    private readonly IVietQrService _vietQrService;
    private readonly IPaymentWebhookService _paymentWebhookService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<PaymentsController> _logger;

    public PaymentsController(
        IVietQrService vietQrService,
        IPaymentWebhookService paymentWebhookService,
        IConfiguration configuration,
        ILogger<PaymentsController> logger)
    {
        _vietQrService = vietQrService;
        _paymentWebhookService = paymentWebhookService;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Lấy thông tin tài khoản ngân hàng thụ hưởng và sinh link mã QR VietQR Napas 247 động theo đơn hàng.
    /// </summary>
    [HttpGet("vietqr")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult GenerateVietQr(
        [FromQuery] decimal amount,
        [FromQuery] string orderCode,
        [FromQuery] string? note = null)
    {
        var bankInfo = _vietQrService.GetBankInfo();
        var qrUrl = _vietQrService.GeneratePaymentQrUrl(amount, orderCode, note);

        return Ok(new
        {
            QrUrl = qrUrl,
            BankCode = bankInfo.BankCode,
            AccountNumber = bankInfo.AccountNumber,
            AccountName = bankInfo.AccountName,
            Amount = amount,
            OrderCode = orderCode,
            TransferNote = !string.IsNullOrWhiteSpace(note) ? $"{orderCode} {note}" : orderCode
        });
    }

    /// <summary>
    /// Endpoint Webhook nhận biến động số dư tự động từ cổng PayOS Napas 24/7.
    /// Tự động xác thực chữ ký số HMAC-SHA256 và bắn SignalR về quầy POS.
    /// </summary>
    [HttpPost("webhook/payos")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> HandlePayOsWebhook(
        [FromBody] PayOsWebhookPayload payload,
        CancellationToken cancellationToken)
    {
        var result = await _paymentWebhookService.ProcessPayOsWebhookAsync(payload, cancellationToken);
        if (!result.IsSuccess)
        {
            return BadRequest(new { success = false, message = result.Message });
        }

        return Ok(new { success = true, message = result.Message, data = result });
    }

    /// <summary>
    /// Endpoint Webhook nhận biến động số dư tự động từ cổng Casso / SeAPay.
    /// Xác thực Secure-Token và thông báo Realtime đơn hàng đã thanh toán.
    /// </summary>
    [HttpPost("webhook/casso")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> HandleCassoWebhook(
        [FromBody] CassoWebhookPayload payload,
        [FromHeader(Name = "secure-token")] string? secureToken,
        CancellationToken cancellationToken)
    {
        var result = await _paymentWebhookService.ProcessCassoWebhookAsync(payload, secureToken, cancellationToken);
        if (!result.IsSuccess)
        {
            return Unauthorized(new { error = 1, message = result.Message });
        }

        return Ok(new { error = 0, message = "Success", data = result });
    }

    /// <summary>
    /// Giả lập Webhook biến động số dư từ phía Backend (phục vụ Testing, Demo quầy POS và Kiểm thử tự động).
    /// </summary>
    [HttpPost("simulate-webhook")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> SimulatePaymentWebhook(
        [FromBody] SimulatePaymentWebhookRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _paymentWebhookService.SimulateWebhookPaymentAsync(request, cancellationToken);
        return Ok(new
        {
            success = true,
            message = "Đã phát tín hiệu webhook thanh toán thành công",
            data = result
        });
    }

    /// <summary>
    /// Kiểm tra trạng thái cấu hình các cổng thanh toán Webhook của hệ thống.
    /// </summary>
    [HttpGet("gateway-status")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult GetGatewayStatus()
    {
        var hasPayOs = !string.IsNullOrEmpty(_configuration["PayOS:ApiKey"]) &&
                       !string.IsNullOrEmpty(_configuration["PayOS:ChecksumKey"]);

        var hasCasso = !string.IsNullOrEmpty(_configuration["Casso:SecureToken"]);

        return Ok(new
        {
            VietQrConfigured = true,
            PayOsEnabled = hasPayOs,
            CassoEnabled = hasCasso,
            WebhookEndpoints = new
            {
                PayOs = "/api/payments/webhook/payos",
                Casso = "/api/payments/webhook/casso",
                Simulator = "/api/payments/simulate-webhook"
            }
        });
    }
}
