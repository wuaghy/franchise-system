namespace Franchise.Application.Common.Interfaces;

/// <summary>
/// Service sending operational and security emails via SMTP/HTML templates.
/// </summary>
public interface IEmailService
{
    Task SendEmailAsync(string toEmail, string subject, string htmlBody, CancellationToken ct = default);
    Task SendOtpEmailAsync(string toEmail, string otpCode, string recipientName, CancellationToken ct = default);
    Task SendRoyaltyInvoiceEmailAsync(string toEmail, string franchiseeName, string invoiceNumber, decimal totalAmount, string billingMonth, CancellationToken ct = default);
    Task SendLowStockAlertEmailAsync(string toEmail, string storeName, string ingredientName, decimal currentStock, decimal threshold, string unit, CancellationToken ct = default);
    Task SendBatchLowStockAlertEmailAsync(string toEmail, string storeName, List<DTOs.Inventory.LowStockAlertResponse> items, CancellationToken ct = default);
}
