using Franchise.Application.DTOs.Loyalty;

namespace Franchise.Application.Common.Interfaces;

public interface ILoyaltyService
{
    Task<CustomerLookupResponse> LookupCustomerAsync(string phoneNumber, CancellationToken ct = default);
    Task<CustomerDto> RegisterCustomerAsync(RegisterCustomerRequest request, CancellationToken ct = default);
    Task<ApplyPromotionResponse> ApplyPromotionAsync(ApplyPromotionRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<VoucherDto>> GetActiveVouchersAsync(string? phoneNumber = null, CancellationToken ct = default);
    Task<VoucherDto> CreateVoucherAsync(CreateVoucherRequest request, CancellationToken ct = default);
}
