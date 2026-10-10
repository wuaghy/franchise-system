using System.Net.Http.Json;
using System.Text.Json;
using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Inventory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Franchise.Infrastructure.Services;

public class TelegramService : ITelegramService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<TelegramService> _logger;

    public TelegramService(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<TelegramService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<TelegramSendResult> SendTextMessageAsync(
        string chatId, 
        string messageHtml, 
        CancellationToken ct = default)
    {
        var token = _configuration["Telegram:BotToken"];
        if (string.IsNullOrWhiteSpace(token) || token.Contains("YOUR_TELEGRAM_BOT_TOKEN", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogInformation("[TELEGRAM SIMULATION] ChatId: {ChatId} | Message: {Message}", chatId, messageHtml);
            return new TelegramSendResult(true, "Tin nhắn Telegram đã được ghi nhận (Chế độ mô phỏng / Development)");
        }

        try
        {
            var url = $"https://api.telegram.org/bot{token}/sendMessage";
            var payload = new
            {
                chat_id = chatId,
                text = messageHtml,
                parse_mode = "HTML",
                disable_web_page_preview = true
            };

            var response = await _httpClient.PostAsJsonAsync(url, payload, ct);
            var content = await response.Content.ReadAsStringAsync(ct);

            if (response.IsSuccessStatusCode)
            {
                using var doc = JsonDocument.Parse(content);
                int? messageId = null;
                if (doc.RootElement.TryGetProperty("result", out var resultProp) &&
                    resultProp.TryGetProperty("message_id", out var idProp))
                {
                    messageId = idProp.GetInt32();
                }

                _logger.LogInformation("Telegram alert sent successfully to {ChatId}. MessageId: {MessageId}", chatId, messageId);
                return new TelegramSendResult(true, "Gửi tin nhắn Telegram thành công", messageId);
            }

            _logger.LogWarning("Telegram API error response: {StatusCode} - {Content}", response.StatusCode, content);
            return new TelegramSendResult(false, $"Lỗi Telegram API ({response.StatusCode}): {content}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send message via Telegram bot to chat {ChatId}", chatId);
            return new TelegramSendResult(false, $"Lỗi kết nối Telegram: {ex.Message}");
        }
    }

    public async Task<TelegramSendResult> SendLowStockAlertAsync(
        string chatId, 
        string storeName, 
        List<LowStockAlertResponse> items, 
        CancellationToken ct = default)
    {
        if (items == null || !items.Any())
        {
            return new TelegramSendResult(true, "Không có nguyên liệu nào chạm ngưỡng cảnh báo.");
        }

        var lines = items.Select(i => 
            $"• <b>[{i.IngredientCode}] {i.IngredientName}:</b> <code>{i.CurrentStock:N2} {i.Unit}</code> (Ngưỡng: {i.MinAlertThreshold:N2} | Thiếu: <b>+{i.Deficit:N2} {i.Unit}</b>)"
        );

        var messageText = $@"🚨 <b>[CẢNH BÁO TỒN KHO NGUY CẤP]</b>
🏬 <b>Chi nhánh:</b> {storeName}
⏰ <b>Thời gian:</b> {DateTime.UtcNow:dd/MM/yyyy HH:mm:ss} UTC

⚠️ <i>Phát hiện {items.Count} nguyên liệu chạm ngưỡng báo động đỏ:</i>
{string.Join("\n", lines)}

👉 <b>Hành động:</b> Vui lòng tạo ngay <b>Lệnh điều chuyển kho (Stock Transfer)</b> trên Cổng Chuỗi Cung Ứng F&B!";

        return await SendTextMessageAsync(chatId, messageText, ct);
    }
}
