using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Kds;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Franchise.Domain.Exceptions;
using Franchise.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Franchise.Infrastructure.Services;

public class KitchenDisplayService : IKitchenDisplayService
{
    private readonly AppDbContext _context;
    private readonly IRealtimeNotificationService? _notificationService;
    private readonly ILogger<KitchenDisplayService>? _logger;

    public KitchenDisplayService(
        AppDbContext context,
        IRealtimeNotificationService? notificationService = null,
        ILogger<KitchenDisplayService>? logger = null)
    {
        _context = context;
        _notificationService = notificationService;
        _logger = logger;
    }

    public async Task<List<KitchenTicketDto>> GetActiveTicketsAsync(Guid storeId, CancellationToken cancellationToken = default)
    {
        var activeStatuses = new[]
        {
            KitchenTicketStatus.New,
            KitchenTicketStatus.InPreparation,
            KitchenTicketStatus.Ready
        };

        var tickets = await _context.KitchenTickets
            .AsNoTracking()
            .Include(t => t.Items)
                .ThenInclude(i => i.Modifiers)
            .Where(t => t.StoreId == storeId && activeStatuses.Contains(t.Status))
            .OrderBy(t => t.CreatedAt)
            .ToListAsync(cancellationToken);

        return tickets.Select(MapToDto).ToList();
    }

    public async Task<KitchenTicketDto> GetTicketByIdAsync(Guid ticketId, CancellationToken cancellationToken = default)
    {
        var ticket = await _context.KitchenTickets
            .AsNoTracking()
            .Include(t => t.Items)
                .ThenInclude(i => i.Modifiers)
            .FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken);

        if (ticket == null)
        {
            throw new NotFoundException("KDS_TICKET_NOT_FOUND", $"Không tìm thấy vé chế biến KDS với ID '{ticketId}'.");
        }

        return MapToDto(ticket);
    }

    public async Task<KitchenTicketDto> CreateTicketFromOrderAsync(Guid orderId, CancellationToken cancellationToken = default)
    {
        var order = await _context.Orders
            .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Product)
            .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Modifiers)
            .FirstOrDefaultAsync(o => o.Id == orderId, cancellationToken);

        if (order == null)
        {
            throw new NotFoundException("ORDER_NOT_FOUND", $"Không tìm thấy đơn hàng với ID '{orderId}'.");
        }

        // Check if ticket already exists for this order
        var existingTicket = await _context.KitchenTickets
            .Include(t => t.Items)
                .ThenInclude(i => i.Modifiers)
            .FirstOrDefaultAsync(t => t.OrderId == orderId, cancellationToken);

        if (existingTicket != null)
        {
            return MapToDto(existingTicket);
        }

        var timestamp = DateTime.UtcNow.ToString("yyyyMM");
        var randomSuffix = Random.Shared.Next(1000, 9999);
        var ticketNumber = $"KDS-{timestamp}-{randomSuffix}";

        var ticket = new KitchenTicket
        {
            Id = Guid.NewGuid(),
            TicketNumber = ticketNumber,
            OrderId = order.Id,
            StoreId = order.StoreId,
            OrderNumber = order.OrderNumber,
            OrderType = order.OrderType,
            Status = KitchenTicketStatus.New,
            TargetPreparationSeconds = 300,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        foreach (var orderItem in order.OrderItems)
        {
            var ticketItem = new KitchenTicketItem
            {
                Id = Guid.NewGuid(),
                KitchenTicketId = ticket.Id,
                OrderItemId = orderItem.Id,
                ProductName = orderItem.Product?.Name ?? "Sản phẩm",
                Quantity = orderItem.Quantity,
                SpecialNote = orderItem.SpecialNote ?? string.Empty,
                IsPrepared = false,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            foreach (var mod in orderItem.Modifiers)
            {
                ticketItem.Modifiers.Add(new KitchenTicketItemModifier
                {
                    Id = Guid.NewGuid(),
                    KitchenTicketItemId = ticketItem.Id,
                    ModifierName = mod.Name,
                    IsChecked = false,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });
            }

            ticket.Items.Add(ticketItem);
        }

        _context.KitchenTickets.Add(ticket);
        await _context.SaveChangesAsync(cancellationToken);

        var dto = MapToDto(ticket);

        if (_notificationService != null)
        {
            try
            {
                await _notificationService.NotifyKitchenTicketCreatedAsync(ticket.StoreId, dto, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Lỗi khi phát SignalR broadcast cho vé KDS mới {TicketNumber}", ticket.TicketNumber);
            }
        }

        return dto;
    }

    public async Task<KitchenTicketDto> StartPreparationAsync(Guid ticketId, Guid? baristaUserId = null, CancellationToken cancellationToken = default)
    {
        var ticket = await _context.KitchenTickets
            .Include(t => t.Items)
                .ThenInclude(i => i.Modifiers)
            .FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken);

        if (ticket == null)
        {
            throw new NotFoundException("KDS_TICKET_NOT_FOUND", $"Không tìm thấy vé chế biến KDS với ID '{ticketId}'.");
        }

        ticket.StartPreparation(baristaUserId);
        await _context.SaveChangesAsync(cancellationToken);

        if (_notificationService != null)
        {
            try
            {
                await _notificationService.NotifyKitchenTicketStatusChangedAsync(
                    ticket.StoreId,
                    new KitchenTicketStatusChangedNotification(
                        ticket.Id,
                        ticket.StoreId,
                        ticket.TicketNumber,
                        ticket.Status.ToString(),
                        DateTime.UtcNow
                    ),
                    cancellationToken);
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Lỗi khi phát SignalR status change cho vé {TicketNumber}", ticket.TicketNumber);
            }
        }

        return MapToDto(ticket);
    }

    public async Task<KitchenTicketDto> ToggleItemPreparedAsync(Guid ticketId, Guid itemId, CancellationToken cancellationToken = default)
    {
        var ticket = await _context.KitchenTickets
            .Include(t => t.Items)
                .ThenInclude(i => i.Modifiers)
            .FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken);

        if (ticket == null)
        {
            throw new NotFoundException("KDS_TICKET_NOT_FOUND", $"Không tìm thấy vé chế biến KDS với ID '{ticketId}'.");
        }

        var item = ticket.Items.FirstOrDefault(i => i.Id == itemId);
        if (item == null)
        {
            throw new NotFoundException("KDS_ITEM_NOT_FOUND", $"Không tìm thấy món chế biến với ID '{itemId}' trong vé '{ticket.TicketNumber}'.");
        }

        item.TogglePrepared();
        await _context.SaveChangesAsync(cancellationToken);

        if (_notificationService != null)
        {
            try
            {
                await _notificationService.NotifyKitchenTicketItemToggledAsync(
                    ticket.StoreId,
                    new KitchenTicketItemToggledNotification(
                        ticket.Id,
                        ticket.StoreId,
                        item.Id,
                        item.IsPrepared
                    ),
                    cancellationToken);
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Lỗi khi phát SignalR item toggle cho vé {TicketNumber}", ticket.TicketNumber);
            }
        }

        return MapToDto(ticket);
    }

    public async Task<KitchenTicketDto> ToggleModifierCheckedAsync(Guid ticketId, Guid modifierId, CancellationToken cancellationToken = default)
    {
        var ticket = await _context.KitchenTickets
            .Include(t => t.Items)
                .ThenInclude(i => i.Modifiers)
            .FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken);

        if (ticket == null)
        {
            throw new NotFoundException("KDS_TICKET_NOT_FOUND", $"Không tìm thấy vé chế biến KDS với ID '{ticketId}'.");
        }

        var modifier = ticket.Items
            .SelectMany(i => i.Modifiers)
            .FirstOrDefault(m => m.Id == modifierId);

        if (modifier == null)
        {
            throw new NotFoundException("KDS_MODIFIER_NOT_FOUND", $"Không tìm thấy modifier với ID '{modifierId}' trong vé '{ticket.TicketNumber}'.");
        }

        modifier.ToggleChecked();
        await _context.SaveChangesAsync(cancellationToken);

        return MapToDto(ticket);
    }

    public async Task<KitchenTicketDto> MarkTicketReadyAsync(Guid ticketId, CancellationToken cancellationToken = default)
    {
        var ticket = await _context.KitchenTickets
            .Include(t => t.Items)
                .ThenInclude(i => i.Modifiers)
            .FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken);

        if (ticket == null)
        {
            throw new NotFoundException("KDS_TICKET_NOT_FOUND", $"Không tìm thấy vé chế biến KDS với ID '{ticketId}'.");
        }

        ticket.MarkReady();
        await _context.SaveChangesAsync(cancellationToken);

        if (_notificationService != null)
        {
            try
            {
                await _notificationService.NotifyKitchenTicketStatusChangedAsync(
                    ticket.StoreId,
                    new KitchenTicketStatusChangedNotification(
                        ticket.Id,
                        ticket.StoreId,
                        ticket.TicketNumber,
                        ticket.Status.ToString(),
                        DateTime.UtcNow
                    ),
                    cancellationToken);
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Lỗi khi phát SignalR status change cho vé {TicketNumber}", ticket.TicketNumber);
            }
        }

        return MapToDto(ticket);
    }

    public async Task<KitchenTicketDto> CompleteTicketAsync(Guid ticketId, CancellationToken cancellationToken = default)
    {
        var ticket = await _context.KitchenTickets
            .Include(t => t.Items)
                .ThenInclude(i => i.Modifiers)
            .FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken);

        if (ticket == null)
        {
            throw new NotFoundException("KDS_TICKET_NOT_FOUND", $"Không tìm thấy vé chế biến KDS với ID '{ticketId}'.");
        }

        ticket.Complete();
        await _context.SaveChangesAsync(cancellationToken);

        if (_notificationService != null)
        {
            try
            {
                await _notificationService.NotifyKitchenTicketStatusChangedAsync(
                    ticket.StoreId,
                    new KitchenTicketStatusChangedNotification(
                        ticket.Id,
                        ticket.StoreId,
                        ticket.TicketNumber,
                        ticket.Status.ToString(),
                        DateTime.UtcNow
                    ),
                    cancellationToken);
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Lỗi khi phát SignalR status change cho vé {TicketNumber}", ticket.TicketNumber);
            }
        }

        return MapToDto(ticket);
    }

    public async Task<KitchenTicketDto> CancelTicketAsync(Guid ticketId, string reason, CancellationToken cancellationToken = default)
    {
        var ticket = await _context.KitchenTickets
            .Include(t => t.Items)
                .ThenInclude(i => i.Modifiers)
            .FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken);

        if (ticket == null)
        {
            throw new NotFoundException("KDS_TICKET_NOT_FOUND", $"Không tìm thấy vé chế biến KDS với ID '{ticketId}'.");
        }

        ticket.Cancel(reason);
        await _context.SaveChangesAsync(cancellationToken);

        if (_notificationService != null)
        {
            try
            {
                await _notificationService.NotifyKitchenTicketStatusChangedAsync(
                    ticket.StoreId,
                    new KitchenTicketStatusChangedNotification(
                        ticket.Id,
                        ticket.StoreId,
                        ticket.TicketNumber,
                        ticket.Status.ToString(),
                        DateTime.UtcNow
                    ),
                    cancellationToken);
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Lỗi khi phát SignalR status change cho vé {TicketNumber}", ticket.TicketNumber);
            }
        }

        return MapToDto(ticket);
    }

    private static KitchenTicketDto MapToDto(KitchenTicket ticket)
    {
        var elapsed = (int)(DateTime.UtcNow - (ticket.PreparationStartedAt ?? ticket.CreatedAt)).TotalSeconds;
        if (elapsed < 0) elapsed = 0;

        var slaStatus = elapsed <= 180 ? "Healthy" : (elapsed <= ticket.TargetPreparationSeconds ? "Warning" : "Critical");
        if (ticket.Status == KitchenTicketStatus.Completed || ticket.Status == KitchenTicketStatus.Cancelled)
        {
            slaStatus = "Completed";
        }

        return new KitchenTicketDto(
            ticket.Id,
            ticket.TicketNumber,
            ticket.OrderId,
            ticket.StoreId,
            ticket.OrderNumber,
            ticket.OrderType.ToString(),
            ticket.Status.ToString(),
            ticket.TargetPreparationSeconds,
            ticket.CreatedAt,
            ticket.PreparationStartedAt,
            ticket.ReadyAt,
            ticket.CompletedAt,
            ticket.BaristaUserId,
            ticket.CancellationReason,
            elapsed,
            slaStatus,
            ticket.Items.Select(i => new KitchenTicketItemDto(
                i.Id,
                i.OrderItemId,
                i.ProductName,
                i.Quantity,
                i.SpecialNote,
                i.IsPrepared,
                i.Modifiers.Select(m => new KitchenTicketItemModifierDto(
                    m.Id,
                    m.ModifierName,
                    m.IsChecked
                )).ToList()
            )).ToList()
        );
    }
}
