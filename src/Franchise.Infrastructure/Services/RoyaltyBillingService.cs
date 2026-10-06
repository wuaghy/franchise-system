using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Royalty;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Franchise.Domain.Exceptions;
using Franchise.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Franchise.Infrastructure.Services;

public class RoyaltyBillingService : IRoyaltyBillingService
{
    private readonly AppDbContext _context;
    private readonly ILogger<RoyaltyBillingService>? _logger;

    public RoyaltyBillingService(
        AppDbContext context,
        ILogger<RoyaltyBillingService>? logger = null)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<List<RoyaltyInvoiceDto>> GetInvoicesAsync(
        Guid? storeId = null,
        int? year = null,
        int? month = null,
        CancellationToken ct = default)
    {
        var query = _context.RoyaltyInvoices
            .AsNoTracking()
            .Include(i => i.Store)
            .AsQueryable();

        if (storeId.HasValue)
        {
            query = query.Where(i => i.StoreId == storeId.Value);
        }

        if (year.HasValue)
        {
            query = query.Where(i => i.BillingYear == year.Value);
        }

        if (month.HasValue)
        {
            query = query.Where(i => i.BillingMonth == month.Value);
        }

        var invoices = await query
            .OrderByDescending(i => i.BillingYear)
            .ThenByDescending(i => i.BillingMonth)
            .ThenByDescending(i => i.CreatedAt)
            .ToListAsync(ct);

        return invoices.Select(MapToDto).ToList();
    }

    public async Task<RoyaltyInvoiceDto> GetInvoiceByIdAsync(Guid invoiceId, CancellationToken ct = default)
    {
        var invoice = await _context.RoyaltyInvoices
            .AsNoTracking()
            .Include(i => i.Store)
            .FirstOrDefaultAsync(i => i.Id == invoiceId, ct);

        if (invoice == null)
        {
            throw new NotFoundException("ROYALTY_INVOICE_NOT_FOUND", $"Không tìm thấy hóa đơn phí nhượng quyền với ID '{invoiceId}'.");
        }

        return MapToDto(invoice);
    }

    public async Task<RoyaltyInvoiceDto> GenerateInvoiceAsync(GenerateRoyaltyInvoiceRequest request, CancellationToken ct = default)
    {
        var store = await _context.Stores
            .FirstOrDefaultAsync(s => s.Id == request.StoreId, ct);

        if (store == null)
        {
            throw new NotFoundException("STORE_NOT_FOUND", $"Không tìm thấy chi nhánh với ID '{request.StoreId}'.");
        }

        if (request.BillingMonth < 1 || request.BillingMonth > 12)
        {
            throw new BusinessRuleException("INVALID_BILLING_MONTH", "Tháng thanh toán phải nằm trong khoảng từ 1 đến 12.");
        }

        // Kiểm tra hóa đơn đã tồn tại chưa
        var existing = await _context.RoyaltyInvoices
            .Include(i => i.Store)
            .FirstOrDefaultAsync(i => i.StoreId == request.StoreId && i.BillingYear == request.BillingYear && i.BillingMonth == request.BillingMonth, ct);

        // Tính khoảng thời gian của tháng
        var start = new DateTime(request.BillingYear, request.BillingMonth, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = start.AddMonths(1);

        var monthOrders = await _context.Orders
            .AsNoTracking()
            .Where(o => o.StoreId == request.StoreId && o.Status == OrderStatus.Completed && o.CreatedAt >= start && o.CreatedAt < end)
            .ToListAsync(ct);

        var totalOrders = monthOrders.Count;
        var grossRevenue = monthOrders.Sum(o => o.Subtotal);
        var discountAmount = monthOrders.Sum(o => o.DiscountAmount);

        // Lấy cấu hình phí nhượng quyền của cửa hàng
        var setting = await _context.StoreRoyaltySettings
            .FirstOrDefaultAsync(s => s.StoreId == request.StoreId, ct);

        var royaltyRate = setting?.RoyaltyRate ?? 0.05m;
        var marketingRate = setting?.MarketingFeeRate ?? 0.02m;
        var techFee = setting?.TechFeeFixedMonthly ?? 2000000m;

        if (existing != null)
        {
            if (existing.Status == RoyaltyInvoiceStatus.Draft)
            {
                existing.CalculateFees(grossRevenue, discountAmount, totalOrders, royaltyRate, marketingRate, techFee);
                await _context.SaveChangesAsync(ct);
            }
            return MapToDto(existing);
        }

        var invoiceNumber = $"ROY-{request.BillingYear}{request.BillingMonth:D2}-{store.Code}";

        var invoice = new RoyaltyInvoice
        {
            Id = Guid.NewGuid(),
            InvoiceNumber = invoiceNumber,
            StoreId = store.Id,
            Store = store,
            BillingYear = request.BillingYear,
            BillingMonth = request.BillingMonth,
            Status = RoyaltyInvoiceStatus.Draft,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        invoice.CalculateFees(grossRevenue, discountAmount, totalOrders, royaltyRate, marketingRate, techFee);

        _context.RoyaltyInvoices.Add(invoice);
        await _context.SaveChangesAsync(ct);

        return MapToDto(invoice);
    }

    public async Task<List<RoyaltyInvoiceDto>> GenerateMonthlyInvoicesForNetworkAsync(int billingYear, int billingMonth, CancellationToken ct = default)
    {
        var stores = await _context.Stores
            .Where(s => s.IsActive)
            .ToListAsync(ct);

        var result = new List<RoyaltyInvoiceDto>();
        foreach (var store in stores)
        {
            var req = new GenerateRoyaltyInvoiceRequest(store.Id, billingYear, billingMonth);
            var inv = await GenerateInvoiceAsync(req, ct);
            result.Add(inv);
        }

        return result;
    }

    public async Task<RoyaltyInvoiceDto> IssueInvoiceAsync(Guid invoiceId, CancellationToken ct = default)
    {
        var invoice = await _context.RoyaltyInvoices
            .Include(i => i.Store)
            .FirstOrDefaultAsync(i => i.Id == invoiceId, ct);

        if (invoice == null)
        {
            throw new NotFoundException("ROYALTY_INVOICE_NOT_FOUND", $"Không tìm thấy hóa đơn phí nhượng quyền với ID '{invoiceId}'.");
        }

        invoice.Issue();
        await _context.SaveChangesAsync(ct);

        return MapToDto(invoice);
    }

    public async Task<RoyaltyInvoiceDto> MarkInvoicePaidAsync(Guid invoiceId, PayRoyaltyInvoiceRequest request, CancellationToken ct = default)
    {
        var invoice = await _context.RoyaltyInvoices
            .Include(i => i.Store)
            .FirstOrDefaultAsync(i => i.Id == invoiceId, ct);

        if (invoice == null)
        {
            throw new NotFoundException("ROYALTY_INVOICE_NOT_FOUND", $"Không tìm thấy hóa đơn phí nhượng quyền với ID '{invoiceId}'.");
        }

        invoice.MarkPaid(request.PaymentReference);
        await _context.SaveChangesAsync(ct);

        return MapToDto(invoice);
    }

    public async Task<RoyaltyInvoiceDto> CancelInvoiceAsync(Guid invoiceId, CancelRoyaltyInvoiceRequest request, CancellationToken ct = default)
    {
        var invoice = await _context.RoyaltyInvoices
            .Include(i => i.Store)
            .FirstOrDefaultAsync(i => i.Id == invoiceId, ct);

        if (invoice == null)
        {
            throw new NotFoundException("ROYALTY_INVOICE_NOT_FOUND", $"Không tìm thấy hóa đơn phí nhượng quyền với ID '{invoiceId}'.");
        }

        invoice.Cancel(request.Reason);
        await _context.SaveChangesAsync(ct);

        return MapToDto(invoice);
    }

    public async Task<StoreRoyaltySettingDto> GetStoreRoyaltySettingAsync(Guid storeId, CancellationToken ct = default)
    {
        var store = await _context.Stores
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == storeId, ct);

        if (store == null)
        {
            throw new NotFoundException("STORE_NOT_FOUND", $"Không tìm thấy chi nhánh với ID '{storeId}'.");
        }

        var setting = await _context.StoreRoyaltySettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.StoreId == storeId, ct);

        return new StoreRoyaltySettingDto(
            store.Id,
            store.Name,
            setting?.RoyaltyRate ?? 0.05m,
            setting?.MarketingFeeRate ?? 0.02m,
            setting?.TechFeeFixedMonthly ?? 2000000m,
            setting?.IsActive ?? true
        );
    }

    public async Task<StoreRoyaltySettingDto> UpdateStoreRoyaltySettingAsync(
        Guid storeId,
        UpdateStoreRoyaltySettingRequest request,
        CancellationToken ct = default)
    {
        var store = await _context.Stores
            .FirstOrDefaultAsync(s => s.Id == storeId, ct);

        if (store == null)
        {
            throw new NotFoundException("STORE_NOT_FOUND", $"Không tìm thấy chi nhánh với ID '{storeId}'.");
        }

        var setting = await _context.StoreRoyaltySettings
            .FirstOrDefaultAsync(s => s.StoreId == storeId, ct);

        if (setting == null)
        {
            setting = new StoreRoyaltySetting
            {
                Id = Guid.NewGuid(),
                StoreId = storeId,
                RoyaltyRate = request.RoyaltyRate,
                MarketingFeeRate = request.MarketingFeeRate,
                TechFeeFixedMonthly = request.TechFeeFixedMonthly,
                IsActive = request.IsActive,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _context.StoreRoyaltySettings.Add(setting);
        }
        else
        {
            setting.RoyaltyRate = request.RoyaltyRate;
            setting.MarketingFeeRate = request.MarketingFeeRate;
            setting.TechFeeFixedMonthly = request.TechFeeFixedMonthly;
            setting.IsActive = request.IsActive;
            setting.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(ct);

        return new StoreRoyaltySettingDto(
            store.Id,
            store.Name,
            setting.RoyaltyRate,
            setting.MarketingFeeRate,
            setting.TechFeeFixedMonthly,
            setting.IsActive
        );
    }

    private static RoyaltyInvoiceDto MapToDto(RoyaltyInvoice inv)
    {
        return new RoyaltyInvoiceDto(
            inv.Id,
            inv.InvoiceNumber,
            inv.StoreId,
            inv.Store?.Name ?? "Chi nhánh",
            inv.Store?.Code ?? "STORE",
            inv.BillingYear,
            inv.BillingMonth,
            inv.Status.ToString(),
            inv.TotalOrdersCount,
            inv.GrossRevenue,
            inv.DiscountAmount,
            inv.NetRevenue,
            inv.RoyaltyRate,
            inv.RoyaltyFee,
            inv.MarketingFeeRate,
            inv.MarketingFee,
            inv.TechFee,
            inv.TotalDue,
            inv.IssuedAt,
            inv.DueDate,
            inv.PaidAt,
            inv.PaymentReference,
            inv.CancellationReason,
            inv.CreatedAt
        );
    }
}
