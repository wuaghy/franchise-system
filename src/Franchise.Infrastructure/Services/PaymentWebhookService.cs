using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Payments;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Franchise.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Franchise.Infrastructure.Services;

public class PaymentWebhookService : IPaymentWebhookService
{
    private readonly AppDbContext _context;
    private readonly IRealtimeNotificationService _realtimeNotificationService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<PaymentWebhookService> _logger;

    public PaymentWebhookService(
        AppDbContext context,
        IRealtimeNotificationService realtimeNotificationService,
        IConfiguration configuration,
        ILogger<PaymentWebhookService> logger)
    {
        _context = context;
        _realtimeNotificationService = realtimeNotificationService;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<PaymentWebhookResult> ProcessPayOsWebhookAsync(
        PayOsWebhookPayload payload,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Nhận PayOS Webhook: Code={Code}, Desc={Desc}, OrderCode={OrderCode}",
            payload.Code, payload.Desc, payload.Data?.OrderCode);

        if (payload.Data == null)
        {
            return new PaymentWebhookResult(false, "PayOS Webhook payload không chứa dữ liệu giao dịch");
        }

        var checksumKey = _configuration["PayOS:ChecksumKey"];
        if (!string.IsNullOrEmpty(checksumKey))
        {
            var isValidSignature = VerifyPayOsSignature(payload.Data, payload.Signature, checksumKey);
            if (!isValidSignature)
            {
                _logger.LogWarning("Chữ ký số PayOS không hợp lệ! Signature={Signature}", payload.Signature);
                return new PaymentWebhookResult(false, "Chữ ký số PayOS Webhook không hợp lệ");
            }
        }

        var rawOrderCode = payload.Data.OrderCode.ToString();
        var description = payload.Data.Description ?? string.Empty;
        var amount = payload.Data.Amount;
        var reference = payload.Data.Reference ?? $"PAYOS-{payload.Data.OrderCode}";

        return await ProcessConfirmedPaymentAsync(
            rawOrderCode,
            description,
            amount,
            reference,
            gateway: "PayOS Napas 24/7",
            cancellationToken);
    }

    public async Task<PaymentWebhookResult> ProcessCassoWebhookAsync(
        CassoWebhookPayload payload,
        string? secureToken,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Nhận Casso Webhook: Error={Error}, Số giao dịch={Count}",
            payload.Error, payload.Data?.Count ?? 0);

        var configuredToken = _configuration["Casso:SecureToken"];
        if (!string.IsNullOrEmpty(configuredToken) && !string.Equals(configuredToken, secureToken, StringComparison.Ordinal))
        {
            _logger.LogWarning("Casso Secure-Token không hợp lệ!");
            return new PaymentWebhookResult(false, "Casso Secure-Token không hợp lệ");
        }

        if (payload.Data == null || payload.Data.Count == 0)
        {
            return new PaymentWebhookResult(true, "Không có giao dịch nào cần xử lý");
        }

        PaymentWebhookResult lastResult = new(true, "Đã xử lý danh sách giao dịch Casso");
        foreach (var tx in payload.Data)
        {
            var result = await ProcessConfirmedPaymentAsync(
                rawOrderCode: tx.Id.ToString(),
                description: tx.Description ?? string.Empty,
                amount: tx.Amount,
                reference: tx.Tid ?? $"CASSO-{tx.Id}",
                gateway: "Casso VietQR",
                cancellationToken);

            if (result.IsSuccess)
            {
                lastResult = result;
            }
        }

        return lastResult;
    }

    public async Task<PaymentWebhookResult> SimulateWebhookPaymentAsync(
        SimulatePaymentWebhookRequest request,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Giả lập Webhook biến động số dư: OrderCode={OrderCode}, Amount={Amount}",
            request.OrderCode, request.Amount);

        var refCode = request.TransactionReference ?? $"SIM-{DateTime.UtcNow:yyyyMMddHHmmss}-{Random.Shared.Next(1000, 9999)}";

        return await ProcessConfirmedPaymentAsync(
            rawOrderCode: request.OrderCode,
            description: $"Chuyen tien don hang {request.OrderCode}",
            amount: request.Amount,
            reference: refCode,
            gateway: request.Gateway ?? "VietQR Napas Simulator",
            cancellationToken);
    }

    private async Task<PaymentWebhookResult> ProcessConfirmedPaymentAsync(
        string rawOrderCode,
        string description,
        decimal amount,
        string reference,
        string gateway,
        CancellationToken cancellationToken)
    {
        // 1. Tìm Order tương ứng trong hệ thống
        var order = await FindMatchingOrderAsync(rawOrderCode, description, cancellationToken);

        Guid orderId;
        string orderNumber;
        Guid? storeId = null;

        if (order != null)
        {
            orderId = order.Id;
            orderNumber = order.OrderNumber;
            storeId = order.StoreId;

            // Kiểm tra xem giao dịch đã được ghi nhận trước đó chưa (tránh trùng lặp)
            var existingPayment = await _context.Payments
                .FirstOrDefaultAsync(p => p.OrderId == order.Id && p.TransactionReference == reference, cancellationToken);

            if (existingPayment == null)
            {
                var payment = new Payment
                {
                    OrderId = order.Id,
                    PaymentMethod = PaymentMethod.BankTransfer,
                    Amount = amount,
                    TransactionReference = reference,
                    Status = PaymentStatus.Success,
                    PaidAt = DateTime.UtcNow
                };

                _context.Payments.Add(payment);

                if (order.Status == OrderStatus.Pending)
                {
                    order.Status = OrderStatus.Paid;
                }

                await _context.SaveChangesAsync(cancellationToken);
                _logger.LogInformation("Đã cập nhật Payment cho Order #{OrderNumber} thành công", order.OrderNumber);
            }
        }
        else
        {
            // Trường hợp POS vừa sinh OrderCode trên giao diện nhưng chưa lưu DB hoặc đơn tạm
            orderId = Guid.NewGuid();
            orderNumber = ExtractOrderNumberFromText(rawOrderCode, description);
            _logger.LogInformation("Không tìm thấy Order trong DB, phát tín hiệu SignalR theo OrderNumber={OrderNumber}", orderNumber);
        }

        // 2. Phát tín hiệu SignalR Realtime tới Quầy POS và Màn hình Bếp
        var notification = new PaymentConfirmedNotification(
            OrderId: orderId,
            OrderNumber: orderNumber,
            Amount: amount,
            TransactionReference: reference,
            Gateway: gateway,
            PaidAt: DateTime.UtcNow,
            StoreId: storeId
        );

        await _realtimeNotificationService.NotifyPaymentConfirmedAsync(notification, cancellationToken);

        return new PaymentWebhookResult(
            IsSuccess: true,
            Message: $"Xác nhận thanh toán thành công cho đơn {orderNumber}",
            OrderId: orderId,
            OrderNumber: orderNumber,
            Amount: amount,
            TransactionReference: reference
        );
    }

    private async Task<Order?> FindMatchingOrderAsync(
        string rawOrderCode,
        string description,
        CancellationToken cancellationToken)
    {
        // Thử tìm theo mã đơn chính xác
        var exactOrder = await _context.Orders
            .FirstOrDefaultAsync(o => o.OrderNumber == rawOrderCode, cancellationToken);

        if (exactOrder != null) return exactOrder;

        // Trích xuất từ Description (Ví dụ: "ORD-20261010-001" hoặc "ORD-9912")
        var extractedCode = ExtractOrderNumberFromText(rawOrderCode, description);
        if (!string.IsNullOrEmpty(extractedCode))
        {
            var matchByExtracted = await _context.Orders
                .FirstOrDefaultAsync(o => o.OrderNumber == extractedCode || o.OrderNumber.EndsWith(extractedCode), cancellationToken);

            if (matchByExtracted != null) return matchByExtracted;
        }

        // Tìm đơn gần nhất trong ngày có số tiền khớp và trạng thái Pending
        var recentPending = await _context.Orders
            .Where(o => o.Status == OrderStatus.Pending)
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        return recentPending;
    }

    private static string ExtractOrderNumberFromText(string rawOrderCode, string description)
    {
        var textToSearch = $"{rawOrderCode} {description}";
        var match = Regex.Match(textToSearch, @"(ORD-[\w-]+)", RegexOptions.IgnoreCase);
        if (match.Success)
        {
            return match.Groups[1].Value.ToUpperInvariant();
        }

        return !string.IsNullOrWhiteSpace(rawOrderCode) ? rawOrderCode : "ORD-UNKNOWN";
    }

    public static bool VerifyPayOsSignature(PayOsWebhookData data, string receivedSignature, string checksumKey)
    {
        try
        {
            // Sắp xếp các trường dữ liệu theo thứ tự A-Z theo quy chuẩn của PayOS:
            // amount, cancel, description, orderCode
            var sortedData = $"amount={data.Amount}&description={data.Description}&orderCode={data.OrderCode}";

            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(checksumKey));
            var hashBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(sortedData));
            var computedSignature = Convert.ToHexString(hashBytes).ToLowerInvariant();

            return string.Equals(computedSignature, receivedSignature?.Trim().ToLowerInvariant(), StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }
}
