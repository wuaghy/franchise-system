namespace Franchise.Application.DTOs.Payments;

/// <summary>
/// DTO thông báo thanh toán thành công gửi qua SignalR Realtime tới POS và KDS
/// </summary>
public record PaymentConfirmedNotification(
    Guid OrderId,
    string OrderNumber,
    decimal Amount,
    string TransactionReference,
    string Gateway,
    DateTime PaidAt,
    Guid? StoreId
);

/// <summary>
/// Payload Webhook chuẩn từ cổng PayOS
/// </summary>
public record PayOsWebhookPayload(
    string Code,
    string Desc,
    PayOsWebhookData? Data,
    string Signature
);

public record PayOsWebhookData(
    long OrderCode,
    decimal Amount,
    string Description,
    string AccountNumber,
    string Reference,
    string TransactionDateTime,
    string? PaymentLinkId
);

/// <summary>
/// Payload Webhook chuẩn từ cổng Casso / SeAPay
/// </summary>
public record CassoWebhookPayload(
    int Error,
    List<CassoTransactionData>? Data
);

public record CassoTransactionData(
    long Id,
    string Tid,
    string Description,
    decimal Amount,
    string? When,
    string? BankSubAccId
);

/// <summary>
/// Kết quả xử lý Webhook
/// </summary>
public record PaymentWebhookResult(
    bool IsSuccess,
    string Message,
    Guid? OrderId = null,
    string? OrderNumber = null,
    decimal Amount = 0,
    string? TransactionReference = null
);

/// <summary>
/// Yêu cầu giả lập Webhook ngân hàng (cho Dev / Demo / Test tự động)
/// </summary>
public record SimulatePaymentWebhookRequest(
    string OrderCode,
    decimal Amount,
    string? Gateway = "PayOS_Sandbox",
    string? TransactionReference = null
);
