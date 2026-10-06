using Franchise.Application.Common.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Franchise.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class PaymentsController : ControllerBase
{
    private readonly IVietQrService _vietQrService;

    public PaymentsController(IVietQrService vietQrService)
    {
        _vietQrService = vietQrService;
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
}
