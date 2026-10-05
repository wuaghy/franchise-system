using Franchise.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Franchise.Infrastructure.BackgroundJobs;

public class OutboxProcessorBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OutboxProcessorBackgroundService> _logger;
    private readonly TimeSpan _pollInterval = TimeSpan.FromSeconds(5);

    public OutboxProcessorBackgroundService(
        IServiceScopeFactory scopeFactory,
        ILogger<OutboxProcessorBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("OutboxProcessorBackgroundService đã khởi chạy.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                var pendingMessages = await dbContext.OutboxMessages
                    .Where(m => m.ProcessedAt == null)
                    .OrderBy(m => m.CreatedAt)
                    .Take(20)
                    .ToListAsync(stoppingToken);

                if (pendingMessages.Count > 0)
                {
                    _logger.LogInformation("Tìm thấy {Count} Outbox messages cần xử lý.", pendingMessages.Count);

                    foreach (var message in pendingMessages)
                    {
                        try
                        {
                            _logger.LogInformation(
                                "Publishing event: {EventType} cho Aggregate {AggregateType} #{AggregateId}",
                                message.EventType,
                                message.AggregateType,
                                message.AggregateId);

                            // Giả lập gửi event sang Message Broker (RabbitMQ / Kafka)
                            message.ProcessedAt = DateTime.UtcNow;
                            message.Error = null;
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Xử lý Outbox message {Id} thất bại.", message.Id);
                            message.Error = ex.Message;
                        }
                    }

                    await dbContext.SaveChangesAsync(stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi xảy ra trong vòng lặp OutboxProcessorBackgroundService.");
            }

            try
            {
                await Task.Delay(_pollInterval, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }

        _logger.LogInformation("OutboxProcessorBackgroundService đã dừng.");
    }
}
