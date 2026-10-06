using Franchise.Application.DTOs.Royalty;

namespace Franchise.Application.Common.Interfaces;

public interface IRoyaltyBillingService
{
    Task<List<RoyaltyInvoiceDto>> GetInvoicesAsync(Guid? storeId = null, int? year = null, int? month = null, CancellationToken ct = default);
    Task<RoyaltyInvoiceDto> GetInvoiceByIdAsync(Guid invoiceId, CancellationToken ct = default);
    Task<RoyaltyInvoiceDto> GenerateInvoiceAsync(GenerateRoyaltyInvoiceRequest request, CancellationToken ct = default);
    Task<List<RoyaltyInvoiceDto>> GenerateMonthlyInvoicesForNetworkAsync(int billingYear, int billingMonth, CancellationToken ct = default);
    Task<RoyaltyInvoiceDto> IssueInvoiceAsync(Guid invoiceId, CancellationToken ct = default);
    Task<RoyaltyInvoiceDto> MarkInvoicePaidAsync(Guid invoiceId, PayRoyaltyInvoiceRequest request, CancellationToken ct = default);
    Task<RoyaltyInvoiceDto> CancelInvoiceAsync(Guid invoiceId, CancelRoyaltyInvoiceRequest request, CancellationToken ct = default);
    Task<StoreRoyaltySettingDto> GetStoreRoyaltySettingAsync(Guid storeId, CancellationToken ct = default);
    Task<StoreRoyaltySettingDto> UpdateStoreRoyaltySettingAsync(Guid storeId, UpdateStoreRoyaltySettingRequest request, CancellationToken ct = default);
}
