using Franchise.Application.DTOs.Inventory;

namespace Franchise.Application.Common.Interfaces;

public record TelegramSendResult(
    bool IsSuccess,
    string Message,
    int? MessageId = null
);

public interface ITelegramService
{
    Task<TelegramSendResult> SendTextMessageAsync(
        string chatId, 
        string messageHtml, 
        CancellationToken ct = default);

    Task<TelegramSendResult> SendLowStockAlertAsync(
        string chatId, 
        string storeName, 
        List<LowStockAlertResponse> items, 
        CancellationToken ct = default);
}
