using System.Net;
using System.Net.Mail;
using Franchise.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Franchise.Infrastructure.Services;

public class SmtpEmailService : IEmailService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<SmtpEmailService> _logger;

    public SmtpEmailService(
        IConfiguration configuration,
        ILogger<SmtpEmailService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task SendEmailAsync(string toEmail, string subject, string htmlBody, CancellationToken ct = default)
    {
        var host = _configuration["Email:Smtp:Host"] ?? "smtp.gmail.com";
        var port = int.TryParse(_configuration["Email:Smtp:Port"], out var p) ? p : 587;
        var username = _configuration["Email:Smtp:Username"] ?? "nguyenquanghuy14022005@gmail.com";
        var password = _configuration["Email:Smtp:Password"] ?? "favkrxyptmdnzhrv";
        var fromEmail = _configuration["Email:Smtp:FromEmail"] ?? username;
        var fromName = _configuration["Email:Smtp:FromName"] ?? "Enterprise Franchise System";
        var enableSsl = !bool.TryParse(_configuration["Email:Smtp:EnableSsl"], out var ssl) || ssl;

        try
        {
            using var client = new SmtpClient(host, port)
            {
                Credentials = new NetworkCredential(username, password),
                EnableSsl = enableSsl
            };

            using var message = new MailMessage
            {
                From = new MailAddress(fromEmail, fromName),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true
            };
            message.To.Add(toEmail);

            await client.SendMailAsync(message, ct);
            _logger.LogInformation("Email '{Subject}' sent successfully to {ToEmail}.", subject, toEmail);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {ToEmail} with subject '{Subject}'.", toEmail, subject);
            // In enterprise services, log the error rather than crashing the calling transaction
        }
    }

    public async Task SendOtpEmailAsync(string toEmail, string otpCode, string recipientName, CancellationToken ct = default)
    {
        var subject = $"[Franchise POS] Mã OTP Xác Thực: {otpCode}";
        var htmlBody = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; }}
        .card {{ max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
        .header {{ background: #991b1b; padding: 24px; text-align: center; color: #ffffff; }}
        .header h1 {{ margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }}
        .content {{ padding: 32px 24px; text-align: center; }}
        .greeting {{ font-size: 15px; color: #334155; margin-bottom: 16px; text-align: left; }}
        .otp-box {{ background: #fef2f2; border: 2px dashed #dc2626; border-radius: 12px; padding: 18px; margin: 24px 0; }}
        .otp-code {{ font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; color: #991b1b; letter-spacing: 8px; margin: 0; }}
        .instruction {{ font-size: 13px; color: #64748b; line-height: 1.6; }}
        .footer {{ background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; font-size: 11px; color: #94a3b8; text-align: center; }}
    </style>
</head>
<body>
    <div class='card'>
        <div class='header'>
            <h1>HỆ THỐNG QUẢN TRỊ CHUỖI NHƯỢNG QUYỀN</h1>
        </div>
        <div class='content'>
            <div class='greeting'>Xin chào <b>{recipientName}</b>,</div>
            <p class='instruction'>Bạn hoặc ai đó vừa yêu cầu mã xác thực để đăng nhập / xác minh bảo mật vào hệ thống POS.</p>
            <div class='otp-box'>
                <div class='otp-code'>{otpCode}</div>
            </div>
            <p class='instruction'>Mã xác thực này có hiệu lực trong vòng <b>5 phút</b>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai để bảo vệ an toàn cho chi nhánh.</p>
        </div>
        <div class='footer'>
            Đây là email tự động từ máy chủ bảo mật Franchise System. Vui lòng không phản hồi lại thư này.
        </div>
    </div>
</body>
</html>";

        await SendEmailAsync(toEmail, subject, htmlBody, ct);
    }

    public async Task SendRoyaltyInvoiceEmailAsync(string toEmail, string franchiseeName, string invoiceNumber, decimal totalAmount, string billingMonth, CancellationToken ct = default)
    {
        var subject = $"[Hóa Đơn Nhượng Quyền] Thông Báo Phí Bản Quyền Tháng {billingMonth} - #{invoiceNumber}";
        var htmlBody = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; }}
        .card {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; }}
        .header {{ background: #1e293b; padding: 24px; color: #ffffff; }}
        .header h1 {{ margin: 0; font-size: 18px; font-weight: 800; }}
        .content {{ padding: 28px 24px; font-size: 14px; color: #334155; }}
        .amount-box {{ background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 20px 0; text-align: center; }}
        .amount {{ font-size: 26px; font-weight: 900; color: #166534; }}
        .bank-info {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-top: 20px; }}
        .footer {{ background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px; font-size: 11px; color: #94a3b8; text-align: center; }}
    </style>
</head>
<body>
    <div class='card'>
        <div class='header'>
            <h1>THÔNG BÁO THU PHÍ NHƯỢNG QUYỀN ĐỊNH KỲ</h1>
        </div>
        <div class='content'>
            <p>Kính gửi đối tác: <b>{franchiseeName}</b>,</p>
            <p>Hệ thống HQ đã tổng hợp đối soát doanh thu kinh doanh kỳ <b>{billingMonth}</b> cho chi nhánh của bạn. Chi tiết hóa đơn số <b>#{invoiceNumber}</b> như sau:</p>
            <div class='amount-box'>
                <div style='font-size: 12px; color: #15803d; font-weight: 700; text-transform: uppercase;'>Tổng Tiền Cần Thanh Toán</div>
                <div class='amount'>{totalAmount:N0} VNĐ</div>
            </div>
            <div class='bank-info'>
                <b>Thông tin chuyển khoản:</b><br/>
                - Ngân hàng: <b>VietinBank</b><br/>
                - Số tài khoản: <b>100878137043</b><br/>
                - Chủ tài khoản: <b>NGUYEN QUANG HUY</b><br/>
                - Nội dung: <b>ROYALTY {invoiceNumber}</b>
            </div>
        </div>
        <div class='footer'>
            Hệ thống Quản trị & Kế toán Chuỗi Nhượng quyền F&B HQ.
        </div>
    </div>
</body>
</html>";

        await SendEmailAsync(toEmail, subject, htmlBody, ct);
    }

    public async Task SendLowStockAlertEmailAsync(string toEmail, string storeName, string ingredientName, decimal currentStock, decimal threshold, string unit, CancellationToken ct = default)
    {
        var subject = $"[CẢNH BÁO TỒN KHO] {storeName}: Nguyên liệu '{ingredientName}' sắp hết!";
        var htmlBody = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 24px; }}
        .card {{ max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #fecaca; overflow: hidden; }}
        .header {{ background: #b91c1c; padding: 20px; color: #ffffff; text-align: center; }}
        .content {{ padding: 24px; font-size: 14px; color: #334155; }}
        .alert-stat {{ background: #fff1f2; border-radius: 12px; padding: 16px; margin: 16px 0; }}
    </style>
</head>
<body>
    <div class='card'>
        <div class='header'>
            <h2 style='margin:0;'>⚠️ CẢNH BÁO NGUYÊN LIỆU DƯỚI NGƯỠNG AN TOÀN</h2>
        </div>
        <div class='content'>
            <p>Chi nhánh: <b>{storeName}</b></p>
            <div class='alert-stat'>
                Nguyên liệu: <b>{ingredientName}</b><br/>
                Tồn kho hiện tại: <b style='color:#dc2626;'>{currentStock:N2} {unit}</b><br/>
                Ngưỡng cảnh báo tối thiểu: <b>{threshold:N2} {unit}</b>
            </div>
            <p>Vui lòng tạo ngay <b>Lệnh điều chuyển kho (Stock Transfer Order)</b> từ Kho tổng HQ để tránh gián đoạn bán hàng tại quầy.</p>
        </div>
    </div>
</body>
</html>";

        await SendEmailAsync(toEmail, subject, htmlBody, ct);
    }
}
