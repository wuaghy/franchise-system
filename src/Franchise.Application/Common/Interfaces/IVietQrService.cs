namespace Franchise.Application.Common.Interfaces;

public record VietQrBankInfoDto(
    string BankCode,
    string AccountNumber,
    string AccountName,
    string Template
);

public interface IVietQrService
{
    string GeneratePaymentQrUrl(decimal amount, string orderCode, string? customNote = null);
    VietQrBankInfoDto GetBankInfo();
}
