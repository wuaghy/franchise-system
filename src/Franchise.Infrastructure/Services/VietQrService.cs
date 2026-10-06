using System.Web;
using Franchise.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;

namespace Franchise.Infrastructure.Services;

public class VietQrService : IVietQrService
{
    private readonly IConfiguration _configuration;

    public VietQrService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public VietQrBankInfoDto GetBankInfo()
    {
        var bankCode = _configuration["VietQR:BankCode"] ?? "vietinbank";
        var accountNumber = _configuration["VietQR:AccountNumber"] ?? "100878137043";
        var accountName = _configuration["VietQR:AccountName"] ?? "NGUYEN QUANG HUY";
        var template = _configuration["VietQR:Template"] ?? "compact2";

        return new VietQrBankInfoDto(bankCode, accountNumber, accountName, template);
    }

    public string GeneratePaymentQrUrl(decimal amount, string orderCode, string? customNote = null)
    {
        var bankInfo = GetBankInfo();
        var addInfo = HttpUtility.UrlEncode(!string.IsNullOrWhiteSpace(customNote) ? $"{orderCode} {customNote}" : orderCode);
        var encodedAccountName = HttpUtility.UrlEncode(bankInfo.AccountName);
        var roundedAmount = Math.Max(0, (long)Math.Round(amount));

        // VietQR Standard QuickLink format
        return $"https://img.vietqr.io/image/{bankInfo.BankCode}-{bankInfo.AccountNumber}-{bankInfo.Template}.png?amount={roundedAmount}&addInfo={addInfo}&accountName={encodedAccountName}";
    }
}
