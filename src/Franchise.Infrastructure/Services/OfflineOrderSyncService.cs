using System.Text.Json;
using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Inventory;
using Franchise.Application.DTOs.Pos;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Franchise.Application.DTOs.Orders;
using Franchise.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Franchise.Infrastructure.Services;

public class OfflineOrderSyncService : IOfflineOrderSyncService
{
    private readonly AppDbContext _context;
    private readonly IInventoryService _inventoryService;
    private readonly ILogger<OfflineOrderSyncService> _logger;

    public OfflineOrderSyncService(
        AppDbContext _context,
        IInventoryService inventoryService,
        ILogger<OfflineOrderSyncService> logger)
    {
        this._context = _context;
        _inventoryService = inventoryService;
        _logger = logger;
    }

    public async Task<BulkSyncOfflineOrdersResponse> SyncOfflineOrdersAsync(
        BulkSyncOfflineOrdersRequest request,
        CancellationToken cancellationToken = default)
    {
        var response = new BulkSyncOfflineOrdersResponse
        {
            TotalProcessed = request.Orders?.Count ?? 0
        };

        if (request.Orders == null || request.Orders.Count == 0)
        {
            return response;
        }

        foreach (var orderItem in request.Orders)
        {
            try
            {
                // 1. Kiểm tra Idempotency - chống trùng lặp khi nạp lại
                if (!string.IsNullOrWhiteSpace(orderItem.IdempotencyKey))
                {
                    var existingRecord = await _context.IdempotencyRecords
                        .FirstOrDefaultAsync(r => r.IdempotencyKey == orderItem.IdempotencyKey, cancellationToken);

                    if (existingRecord != null)
                    {
                        Guid? serverOrderId = null;
                        string? orderNumber = null;
                        try
                        {
                            using var doc = JsonDocument.Parse(existingRecord.ResponsePayload);
                            if (doc.RootElement.TryGetProperty("OrderId", out var idElem))
                            {
                                serverOrderId = idElem.GetGuid();
                            }
                            if (doc.RootElement.TryGetProperty("OrderNumber", out var numElem))
                            {
                                orderNumber = numElem.GetString();
                            }
                        }
                        catch
                        {
                            // Ignore payload parsing errors
                        }

                        response.Results.Add(new OfflineOrderSyncResult
                        {
                            OfflineOrderId = orderItem.OfflineOrderId,
                            IdempotencyKey = orderItem.IdempotencyKey,
                            Status = "DuplicateSkipped",
                            ServerOrderId = serverOrderId,
                            OrderNumber = orderNumber,
                            Message = "Giao dịch đã được đồng bộ trước đó (Idempotency duplicate)."
                        });
                        response.DuplicateSkippedCount++;
                        continue;
                    }
                }

                // 2. Validation danh sách món
                if (orderItem.Items == null || orderItem.Items.Count == 0)
                {
                    response.Results.Add(new OfflineOrderSyncResult
                    {
                        OfflineOrderId = orderItem.OfflineOrderId,
                        IdempotencyKey = orderItem.IdempotencyKey,
                        Status = "Failed",
                        Message = "Đơn hàng rỗng, không chứa sản phẩm nào."
                    });
                    response.FailedCount++;
                    continue;
                }

                var storeId = orderItem.StoreId != Guid.Empty ? orderItem.StoreId : request.StoreId;
                var timestamp = DateTime.UtcNow.ToString("yyyyMMddHHmmss");
                var randomSuffix = Random.Shared.Next(1000, 9999);
                var generatedOrderNumber = $"OFF-{timestamp}-{randomSuffix}";

                // 3. Khấu trừ kho nguyên tử
                var inventoryRequest = new CheckoutOrderInventoryRequest(
                    storeId,
                    generatedOrderNumber,
                    orderItem.Items.Select(i => new OrderItemInventoryRequest(
                        i.ProductId,
                        i.Quantity,
                        i.Modifiers?.Select(m => new OrderModifierInventoryRequest(
                            m.Name,
                            m.IngredientId,
                            m.ConsumptionQuantity
                        )).ToList()
                    )).ToList()
                );

                var deductionResult = await _inventoryService.ProcessOrderInventoryDeductionAsync(inventoryRequest, cancellationToken);
                if (!deductionResult.IsSuccess)
                {
                    response.Results.Add(new OfflineOrderSyncResult
                    {
                        OfflineOrderId = orderItem.OfflineOrderId,
                        IdempotencyKey = orderItem.IdempotencyKey,
                        Status = "Failed",
                        Message = deductionResult.ErrorMessage ?? "Không đủ tồn kho để khấu trừ."
                    });
                    response.FailedCount++;
                    continue;
                }

                // 4. Khởi tạo Order và Payments
                var order = new Order
                {
                    OrderNumber = generatedOrderNumber,
                    StoreId = storeId,
                    CustomerId = orderItem.CustomerId,
                    CashierId = orderItem.CashierId,
                    OrderType = orderItem.OrderType,
                    Status = OrderStatus.Completed,
                    Subtotal = orderItem.Subtotal,
                    DiscountAmount = orderItem.DiscountAmount,
                    VatAmount = orderItem.VatAmount,
                    FinalAmount = orderItem.FinalAmount,
                    CreatedAt = orderItem.OfflineCreatedAt != default ? orderItem.OfflineCreatedAt : DateTime.UtcNow,
                    CompletedAt = orderItem.OfflineCreatedAt != default ? orderItem.OfflineCreatedAt : DateTime.UtcNow,
                    OrderItems = orderItem.Items.Select(i => new OrderItem
                    {
                        ProductId = i.ProductId,
                        Quantity = i.Quantity,
                        UnitPrice = i.UnitPrice,
                        TotalPrice = i.UnitPrice * i.Quantity,
                        SpecialNote = i.SpecialNote ?? string.Empty,
                        Modifiers = i.Modifiers?.Select(m => new OrderItemModifier
                        {
                            Name = m.Name,
                            ExtraPrice = m.ExtraPrice,
                            IngredientId = m.IngredientId,
                            ConsumptionQuantity = m.ConsumptionQuantity
                        }).ToList() ?? new List<OrderItemModifier>()
                    }).ToList()
                };

                var payment = new Payment
                {
                    Order = order,
                    PaymentMethod = orderItem.PaymentMethod,
                    Amount = orderItem.FinalAmount,
                    TransactionReference = $"TXN-OFF-{Guid.NewGuid().ToString()[..8].ToUpper()}",
                    Status = PaymentStatus.Success,
                    PaidAt = orderItem.OfflineCreatedAt != default ? orderItem.OfflineCreatedAt : DateTime.UtcNow
                };
                order.Payments.Add(payment);

                _context.Orders.Add(order);

                // 5. Lưu Idempotency record
                if (!string.IsNullOrWhiteSpace(orderItem.IdempotencyKey))
                {
                    var record = new IdempotencyRecord
                    {
                        IdempotencyKey = orderItem.IdempotencyKey,
                        StatusCode = 200,
                        ResponsePayload = JsonSerializer.Serialize(new
                        {
                            OrderId = order.Id,
                            order.OrderNumber,
                            order.FinalAmount
                        })
                    };
                    _context.IdempotencyRecords.Add(record);
                }

                // 6. Ghi nhận Outbox Event
                var domainEvent = new OrderCompletedDomainEvent(
                    order.Id,
                    order.OrderNumber,
                    order.StoreId,
                    order.FinalAmount,
                    order.CompletedAt ?? DateTime.UtcNow
                );

                var outboxMessage = new OutboxMessage
                {
                    AggregateType = "Order",
                    AggregateId = order.Id.ToString(),
                    EventType = "OrderCompleted",
                    Payload = JsonSerializer.Serialize(domainEvent),
                    CreatedAt = DateTime.UtcNow
                };
                _context.OutboxMessages.Add(outboxMessage);

                await _context.SaveChangesAsync(cancellationToken);

                response.Results.Add(new OfflineOrderSyncResult
                {
                    OfflineOrderId = orderItem.OfflineOrderId,
                    IdempotencyKey = orderItem.IdempotencyKey,
                    Status = "Synced",
                    ServerOrderId = order.Id,
                    OrderNumber = order.OrderNumber,
                    Message = "Đồng bộ đơn ngoại tuyến thành công."
                });
                response.SuccessfulCount++;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi đồng bộ đơn offline {OfflineId}.", orderItem.OfflineOrderId);
                response.Results.Add(new OfflineOrderSyncResult
                {
                    OfflineOrderId = orderItem.OfflineOrderId,
                    IdempotencyKey = orderItem.IdempotencyKey,
                    Status = "Failed",
                    Message = ex.Message
                });
                response.FailedCount++;
            }
        }

        return response;
    }
}
