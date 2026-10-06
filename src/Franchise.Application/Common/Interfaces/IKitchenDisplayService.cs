using Franchise.Application.DTOs.Kds;

namespace Franchise.Application.Common.Interfaces;

public interface IKitchenDisplayService
{
    Task<List<KitchenTicketDto>> GetActiveTicketsAsync(Guid storeId, CancellationToken cancellationToken = default);
    Task<KitchenTicketDto> GetTicketByIdAsync(Guid ticketId, CancellationToken cancellationToken = default);
    Task<KitchenTicketDto> CreateTicketFromOrderAsync(Guid orderId, CancellationToken cancellationToken = default);
    Task<KitchenTicketDto> StartPreparationAsync(Guid ticketId, Guid? baristaUserId = null, CancellationToken cancellationToken = default);
    Task<KitchenTicketDto> ToggleItemPreparedAsync(Guid ticketId, Guid itemId, CancellationToken cancellationToken = default);
    Task<KitchenTicketDto> ToggleModifierCheckedAsync(Guid ticketId, Guid modifierId, CancellationToken cancellationToken = default);
    Task<KitchenTicketDto> MarkTicketReadyAsync(Guid ticketId, CancellationToken cancellationToken = default);
    Task<KitchenTicketDto> CompleteTicketAsync(Guid ticketId, CancellationToken cancellationToken = default);
    Task<KitchenTicketDto> CancelTicketAsync(Guid ticketId, string reason, CancellationToken cancellationToken = default);
}
