using System.Text.Json;
using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Inventory;
using Franchise.Application.DTOs.Orders;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Franchise.Domain.Exceptions;
using Franchise.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Logging;

namespace Franchise.Infrastructure.Services;

public class OrderService : IOrderService
{
    private readonly AppDbContext _context;
    private readonly IInventoryService _inventoryService;
    private readonly ILogger<OrderService> _logger;
    private readonly ICurrentUserService? _currentUserService;
    private readonly IKitchenDisplayService? _kitchenDisplayService;

    public OrderService(
        AppDbContext context,
        IInventoryService inventoryService,
        ILogger<OrderService> logger,
        ICurrentUserService? currentUserService = null,
        IKitchenDisplayService? kitchenDisplayService = null)
    {
        _context = context;
        _inventoryService = inventoryService;
        _logger = logger;
        _currentUserService = currentUserService;
        _kitchenDisplayService = kitchenDisplayService;
    }

    public async Task<CheckoutOrderResponse> CheckoutAsync(
        CheckoutOrderRequest request, 
        string? idempotencyKey = null, 
        CancellationToken ct = default)
    {
        // 0. Kiểm tra Idempotency Record (chống trùng lặp giao dịch POS)
        if (!string.IsNullOrWhiteSpace(idempotencyKey))
        {
            var existingRecord = await _context.IdempotencyRecords
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.IdempotencyKey == idempotencyKey, ct);

            if (existingRecord != null)
            {
                _logger.LogInformation("Idempotency key {Key} đã tồn tại. Trả về kết quả checkout đã lưu trước đó.", idempotencyKey);
                var cachedResponse = JsonSerializer.Deserialize<CheckoutOrderResponse>(existingRecord.ResponsePayload);
                if (cachedResponse != null)
                {
                    return cachedResponse;
                }
            }
        }

        // 1. Validation cơ bản đầu vào
        if (request.Items == null || request.Items.Count == 0)
        {
            throw new RequestValidationException("Items", "Đơn hàng phải chứa ít nhất một sản phẩm.");
        }

        foreach (var item in request.Items)
        {
            if (item.Quantity <= 0)
            {
                throw new RequestValidationException("Quantity", "Số lượng sản phẩm trong đơn hàng phải lớn hơn 0.");
            }

            if (item.Modifiers != null)
            {
                foreach (var mod in item.Modifiers)
                {
                    if (mod.ExtraPrice < 0)
                    {
                        throw new RequestValidationException("ExtraPrice", "Giá phụ thu của modifier không được là số âm.");
                    }
                    if (mod.ConsumptionQuantity < 0)
                    {
                        throw new RequestValidationException("ConsumptionQuantity", "Định lượng tiêu hao không được là số âm.");
                    }
                }
            }
        }

        // 2. Kiểm tra Store tồn tại và đang hoạt động
        var storeExists = await _context.Stores.AnyAsync(s => s.Id == request.StoreId && s.IsActive, ct);
        if (!storeExists)
        {
            throw new NotFoundException("STORE_NOT_FOUND", $"Không tìm thấy chi nhánh với ID '{request.StoreId}'.");
        }

        // 2.1 Chống gian lận chéo chi nhánh (Cross-Store Fraud Prevention)
        if (_currentUserService?.UserId.HasValue == true && !_currentUserService.IsSuperAdmin)
        {
            if (_currentUserService.StoreId.HasValue && _currentUserService.StoreId.Value != request.StoreId)
            {
                throw new ForbiddenException("STORE_ACCESS_DENIED",
                    $"Tài khoản của bạn chỉ được phép tạo đơn hàng cho chi nhánh '{_currentUserService.StoreId}', không thể tạo đơn cho chi nhánh '{request.StoreId}'.");
            }
        }

        // 3. Chống gian lận giá từ máy POS (Anti price tampering)
        // Luôn truy vấn giá gốc từ Database, tuyệt đối không tin giá gửi từ Client
        var productIds = request.Items.Select(i => i.ProductId).Distinct().ToList();
        var products = await _context.Products
            .Where(p => productIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, ct);

        foreach (var item in request.Items)
        {
            if (!products.TryGetValue(item.ProductId, out var product) || !product.IsAvailable)
            {
                throw new BusinessRuleException("PRODUCT_UNAVAILABLE", $"Sản phẩm với mã ID '{item.ProductId}' không tồn tại hoặc đã ngừng kinh doanh.");
            }
        }

        // 4. Tính toán chi phí đơn hàng
        decimal subtotal = 0m;
        var orderItems = new List<OrderItem>();

        foreach (var itemReq in request.Items)
        {
            var product = products[itemReq.ProductId];
            var unitPrice = product.BasePrice;

            decimal modifierExtraTotal = 0m;
            var modifiers = new List<OrderItemModifier>();

            if (itemReq.Modifiers != null)
            {
                foreach (var modReq in itemReq.Modifiers)
                {
                    modifierExtraTotal += modReq.ExtraPrice;
                    modifiers.Add(new OrderItemModifier
                    {
                        Name = modReq.Name,
                        ExtraPrice = modReq.ExtraPrice,
                        IngredientId = modReq.IngredientId,
                        ConsumptionQuantity = modReq.ConsumptionQuantity
                    });
                }
            }

            var itemTotalPrice = (unitPrice + modifierExtraTotal) * itemReq.Quantity;
            subtotal += itemTotalPrice;

            orderItems.Add(new OrderItem
            {
                ProductId = product.Id,
                Quantity = itemReq.Quantity,
                UnitPrice = unitPrice,
                TotalPrice = itemTotalPrice,
                SpecialNote = itemReq.SpecialNote ?? string.Empty,
                Modifiers = modifiers
            });
        }

        decimal discountAmount = 0m;
        decimal vatRate = 0.08m; // Thuế GTGT 8% cho ngành dịch vụ đồ uống F&B
        decimal vatAmount = Math.Round(subtotal * vatRate, 2);
        decimal finalAmount = subtotal + vatAmount - discountAmount;

        var timestamp = DateTime.UtcNow.ToString("yyyyMMddHHmmss");
        var randomSuffix = Random.Shared.Next(1000, 9999);
        var orderNumber = $"ORD-{timestamp}-{randomSuffix}";

        // 4.1 Tích lũy doanh số vào Ca làm việc đang mở (nếu có)
        var openShift = await _context.Shifts
            .FirstOrDefaultAsync(s => s.StoreId == request.StoreId && s.Status == ShiftStatus.Open, ct);

        if (openShift != null)
        {
            if (request.PaymentMethod == PaymentMethod.Cash)
            {
                openShift.TotalCashSales += finalAmount;
            }
            else if (request.PaymentMethod == PaymentMethod.CreditCard)
            {
                openShift.TotalCardSales += finalAmount;
            }
            else
            {
                openShift.TotalBankTransferSales += finalAmount;
            }

            openShift.TotalOrdersCount += 1;
            openShift.ExpectedEndingCash = openShift.StartingCash + openShift.TotalCashSales + openShift.TotalCashIn - openShift.TotalCashOut;
        }

        // 5. Khởi tạo Order và Payment
        var order = new Order
        {
            OrderNumber = orderNumber,
            StoreId = request.StoreId,
            CustomerId = request.CustomerId,
            CashierId = request.CashierId ?? _currentUserService?.UserId,
            ShiftId = openShift?.Id,
            OrderType = request.OrderType,
            Status = OrderStatus.Completed,
            Subtotal = subtotal,
            DiscountAmount = discountAmount,
            VatAmount = vatAmount,
            FinalAmount = finalAmount,
            CompletedAt = DateTime.UtcNow,
            OrderItems = orderItems
        };

        var payment = new Payment
        {
            Order = order,
            PaymentMethod = request.PaymentMethod,
            Amount = finalAmount,
            TransactionReference = $"TXN-{Guid.NewGuid().ToString()[..8].ToUpper()}",
            Status = PaymentStatus.Success,
            PaidAt = DateTime.UtcNow
        };
        order.Payments.Add(payment);

        // 6. Thực thi trong Transaction bảo đảm tính toàn vẹn (ACID)
        IDbContextTransaction? transaction = null;
        if (_context.Database.IsRelational() && _context.Database.CurrentTransaction == null)
        {
            transaction = await _context.Database.BeginTransactionAsync(ct);
        }

        try
        {
            // 6.1 Khấu trừ kho nguyên tử (Dynamic BoM + Topping Modifier + Pessimistic Row Lock)
            var inventoryRequest = new CheckoutOrderInventoryRequest(
                request.StoreId,
                order.OrderNumber,
                request.Items.Select(i => new OrderItemInventoryRequest(
                    i.ProductId,
                    i.Quantity,
                    i.Modifiers?.Select(m => new OrderModifierInventoryRequest(
                        m.Name,
                        m.IngredientId,
                        m.ConsumptionQuantity
                    )).ToList()
                )).ToList()
            );

            var deductionResult = await _inventoryService.ProcessOrderInventoryDeductionAsync(inventoryRequest, ct);
            if (!deductionResult.IsSuccess)
            {
                throw new ConflictException("INSUFFICIENT_STOCK", deductionResult.ErrorMessage ?? "Không đủ tồn kho để hoàn tất đơn hàng.");
            }

            // 6.2 Lưu Order & Payment
            _context.Orders.Add(order);

            // 6.3 Ghi nhận Outbox Message (Transactional Outbox Pattern)
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
            await _context.SaveChangesAsync(ct);

            var checkoutResponse = new CheckoutOrderResponse(
                order.Id,
                order.OrderNumber,
                order.Status,
                order.Subtotal,
                order.DiscountAmount,
                order.VatAmount,
                order.FinalAmount,
                payment.Status,
                order.CreatedAt,
                deductionResult.DeductedItems
            );

            // 6.4 Lưu Idempotency Record (nếu có key)
            if (!string.IsNullOrWhiteSpace(idempotencyKey))
            {
                var idempotencyRecord = new IdempotencyRecord
                {
                    IdempotencyKey = idempotencyKey,
                    StatusCode = 200,
                    ResponsePayload = JsonSerializer.Serialize(checkoutResponse),
                    CreatedAt = DateTime.UtcNow
                };
                _context.IdempotencyRecords.Add(idempotencyRecord);
                await _context.SaveChangesAsync(ct);
            }

            // 6.5 Commit Transaction
            if (transaction != null)
            {
                await transaction.CommitAsync(ct);
            }

            _logger.LogInformation("Đơn hàng {OrderNumber} thanh toán thành công với số tiền {FinalAmount:N0} VND.", order.OrderNumber, order.FinalAmount);

            // 6.6 Tự động điều phối vé chế biến KDS tới quầy Barista
            if (_kitchenDisplayService != null)
            {
                try
                {
                    await _kitchenDisplayService.CreateTicketFromOrderAsync(order.Id, ct);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi khi tự động tạo vé KDS cho đơn hàng {OrderId}. Quầy Barista có thể cần làm mới thủ công.", order.Id);
                }
            }

            return checkoutResponse;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Thanh toán thất bại cho đơn hàng {OrderNumber} tại Store {StoreId}. Đang hoàn tác transaction.", orderNumber, request.StoreId);
            if (transaction != null)
            {
                await transaction.RollbackAsync(ct);
            }
            _context.ChangeTracker.Clear();
            throw;
        }
    }
}
