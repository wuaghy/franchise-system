using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Analytics;
using Franchise.Domain.Enums;
using Franchise.Domain.Exceptions;
using Franchise.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Franchise.Infrastructure.Services;

public class FinancialAnalyticsService : IFinancialAnalyticsService
{
    private readonly AppDbContext _context;
    private readonly ILogger<FinancialAnalyticsService>? _logger;

    public FinancialAnalyticsService(
        AppDbContext context,
        ILogger<FinancialAnalyticsService>? logger = null)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<FinancialSummaryDto> GetStoreSummaryAsync(
        Guid storeId,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        CancellationToken ct = default)
    {
        var store = await _context.Stores
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == storeId, ct);

        if (store == null)
        {
            throw new NotFoundException("STORE_NOT_FOUND", $"Không tìm thấy chi nhánh với ID '{storeId}'.");
        }

        var start = fromDate ?? DateTime.UtcNow.Date.AddDays(-30);
        var end = toDate ?? DateTime.UtcNow;

        var orders = await _context.Orders
            .AsNoTracking()
            .Where(o => o.StoreId == storeId && o.Status == OrderStatus.Completed && o.CreatedAt >= start && o.CreatedAt <= end)
            .ToListAsync(ct);

        var totalOrders = orders.Count;
        var grossRevenue = orders.Sum(o => o.Subtotal);
        var discountAmount = orders.Sum(o => o.DiscountAmount);
        var vatAmount = orders.Sum(o => o.VatAmount);
        var netRevenue = orders.Sum(o => o.FinalAmount);

        var averageOrderValue = totalOrders > 0 ? Math.Round(netRevenue / totalOrders, 0) : 0m;
        // Ước tính COGS chuẩn F&B (khoảng 32% doanh thu gốc)
        var estimatedCogs = Math.Round(grossRevenue * 0.32m, 0);
        var estimatedGrossProfit = Math.Max(0m, netRevenue - estimatedCogs);
        var grossMarginPercentage = netRevenue > 0 ? Math.Round((estimatedGrossProfit / netRevenue) * 100m, 2) : 0m;

        return new FinancialSummaryDto(
            store.Id,
            store.Name,
            start,
            end,
            totalOrders,
            grossRevenue,
            discountAmount,
            vatAmount,
            netRevenue,
            averageOrderValue,
            estimatedCogs,
            estimatedGrossProfit,
            grossMarginPercentage
        );
    }

    public async Task<HourlySalesHeatmapDto> GetHourlySalesHeatmapAsync(
        Guid storeId,
        DateTime? date = null,
        CancellationToken ct = default)
    {
        var store = await _context.Stores
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == storeId, ct);

        if (store == null)
        {
            throw new NotFoundException("STORE_NOT_FOUND", $"Không tìm thấy chi nhánh với ID '{storeId}'.");
        }

        var targetDate = date?.Date ?? DateTime.UtcNow.Date;
        var nextDate = targetDate.AddDays(1);

        var dayOrders = await _context.Orders
            .AsNoTracking()
            .Where(o => o.StoreId == storeId && o.Status == OrderStatus.Completed && o.CreatedAt >= targetDate && o.CreatedAt < nextDate)
            .ToListAsync(ct);

        var totalOrders = dayOrders.Count;
        var totalRevenue = dayOrders.Sum(o => o.FinalAmount);

        // Khung giờ cao điểm F&B thông thường: 7-9h (sáng), 11-13h (trưa), 18-21h (tối)
        var peakHoursSet = new HashSet<int> { 7, 8, 9, 11, 12, 13, 18, 19, 20, 21 };

        var hourlyList = new List<HourlySalesPointDto>();
        for (int h = 0; h < 24; h++)
        {
            var hourOrders = dayOrders.Where(o => o.CreatedAt.Hour == h).ToList();
            var count = hourOrders.Count;
            var rev = hourOrders.Sum(o => o.FinalAmount);
            var isPeak = peakHoursSet.Contains(h) || (count >= 5);

            hourlyList.Add(new HourlySalesPointDto(h, count, rev, isPeak));
        }

        return new HourlySalesHeatmapDto(
            store.Id,
            store.Name,
            targetDate,
            totalOrders,
            totalRevenue,
            hourlyList
        );
    }

    public async Task<List<ProductSalesRankDto>> GetProductSalesPerformanceAsync(
        Guid storeId,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        int top = 10,
        CancellationToken ct = default)
    {
        var store = await _context.Stores
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == storeId, ct);

        if (store == null)
        {
            throw new NotFoundException("STORE_NOT_FOUND", $"Không tìm thấy chi nhánh với ID '{storeId}'.");
        }

        var start = fromDate ?? DateTime.UtcNow.Date.AddDays(-30);
        var end = toDate ?? DateTime.UtcNow.AddDays(1);

        var orders = await _context.Orders
            .AsNoTracking()
            .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Product)
            .Where(o => o.StoreId == storeId && o.Status == OrderStatus.Completed && o.CreatedAt >= start && o.CreatedAt <= end)
            .ToListAsync(ct);

        var items = orders.SelectMany(o => o.OrderItems).ToList();
        var totalNetworkRevenue = items.Sum(i => i.TotalPrice);

        var grouped = items
            .GroupBy(i => new { i.ProductId, ProductName = i.Product != null ? i.Product.Name : "Món", Sku = i.Product != null ? i.Product.Sku : "SKU" })
            .Select(g =>
            {
                var unitsSold = g.Sum(x => x.Quantity);
                var revenue = g.Sum(x => x.TotalPrice);
                var cogs = Math.Round(revenue * 0.32m, 0);
                var profit = Math.Max(0m, revenue - cogs);
                var margin = revenue > 0 ? Math.Round((profit / revenue) * 100m, 2) : 0m;
                var share = totalNetworkRevenue > 0 ? Math.Round((revenue / totalNetworkRevenue) * 100m, 2) : 0m;

                return new ProductSalesRankDto(
                    g.Key.ProductId,
                    g.Key.ProductName,
                    g.Key.Sku,
                    unitsSold,
                    revenue,
                    cogs,
                    profit,
                    margin,
                    share
                );
            })
            .OrderByDescending(r => r.Revenue)
            .Take(top)
            .ToList();

        return grouped;
    }

    public async Task<NetworkOverviewDto> GetNetworkOverviewAsync(
        DateTime? fromDate = null,
        DateTime? toDate = null,
        CancellationToken ct = default)
    {
        var start = fromDate ?? DateTime.UtcNow.Date.AddDays(-30);
        var end = toDate ?? DateTime.UtcNow.AddDays(1);

        var stores = await _context.Stores
            .AsNoTracking()
            .Where(s => s.IsActive)
            .ToListAsync(ct);

        var completedOrders = await _context.Orders
            .AsNoTracking()
            .Where(o => o.Status == OrderStatus.Completed && o.CreatedAt >= start && o.CreatedAt <= end)
            .ToListAsync(ct);

        var storeRankings = new List<NetworkStoreComparisonDto>();

        foreach (var s in stores)
        {
            var storeOrders = completedOrders.Where(o => o.StoreId == s.Id).ToList();
            var ordersCount = storeOrders.Count;
            var gross = storeOrders.Sum(o => o.Subtotal);
            var net = storeOrders.Sum(o => o.FinalAmount);
            var profit = Math.Round(net * 0.68m, 0); // 68% biên gộp trung bình
            var royaltyDue = Math.Round(net * 0.05m, 0); // 5% royalty

            storeRankings.Add(new NetworkStoreComparisonDto(
                s.Id,
                s.Code,
                s.Name,
                ordersCount,
                gross,
                net,
                profit,
                royaltyDue
            ));
        }

        storeRankings = storeRankings.OrderByDescending(r => r.NetRevenue).ToList();

        var totalNetworkStores = stores.Count;
        var totalNetworkOrders = completedOrders.Count;
        var totalNetworkRevenue = completedOrders.Sum(o => o.FinalAmount);
        var totalRoyaltyDue = Math.Round(totalNetworkRevenue * 0.05m, 0);

        return new NetworkOverviewDto(
            start,
            end,
            totalNetworkStores,
            totalNetworkOrders,
            totalNetworkRevenue,
            totalRoyaltyDue,
            storeRankings
        );
    }

    public async Task<AdvancedPeakHoursAnalysisDto> GetAdvancedPeakHoursAnalysisAsync(
        Guid storeId, 
        DateTime? date = null, 
        CancellationToken ct = default)
    {
        var heatmap = await GetHourlySalesHeatmapAsync(storeId, date, ct);

        var peakPoints = heatmap.HourlyDistribution.Where(h => h.IsPeakHour).ToList();
        var peakOrderCount = peakPoints.Sum(h => h.OrderCount);
        var peakRevenue = peakPoints.Sum(h => h.Revenue);

        var busiestPoint = heatmap.HourlyDistribution.OrderByDescending(h => h.Revenue).ThenByDescending(h => h.OrderCount).FirstOrDefault() 
            ?? new HourlySalesPointDto(12, 0, 0, true);
        var busiestHour = busiestPoint.Hour;
        var busiestRange = $"{busiestHour:D2}:00 - {((busiestHour + 1) % 24):D2}:00";

        var peakHoursCount = peakPoints.Count > 0 ? peakPoints.Count : 1;
        var avgPeakOrdersPerHour = (double)peakOrderCount / peakHoursCount;
        var offPeakPoints = heatmap.HourlyDistribution.Where(h => !h.IsPeakHour).ToList();
        var avgOffPeakOrdersPerHour = offPeakPoints.Count > 0 ? (double)offPeakPoints.Sum(h => h.OrderCount) / offPeakPoints.Count : 0;

        // Định biên nhân sự F&B: Peak = tối thiểu 3 người (1 thu ngân, 2 pha chế) + 1 người mỗi 10 đơn/giờ vượt mức
        var staffingPeak = Math.Max(3, (int)Math.Ceiling(avgPeakOrdersPerHour / 8.0) + 1);
        var staffingOffPeak = Math.Max(2, (int)Math.Ceiling(avgOffPeakOrdersPerHour / 10.0) + 1);

        return new AdvancedPeakHoursAnalysisDto(
            heatmap.StoreId,
            heatmap.StoreName,
            heatmap.Date,
            heatmap.TotalOrders,
            heatmap.TotalRevenue,
            peakOrderCount,
            peakRevenue,
            busiestHour,
            busiestRange,
            staffingPeak,
            staffingOffPeak,
            heatmap.HourlyDistribution
        );
    }

    public async Task<List<TopSellerItemDto>> GetTopSellersMenuEngineeringAsync(
        Guid storeId, 
        DateTime? fromDate = null, 
        DateTime? toDate = null, 
        int top = 10, 
        CancellationToken ct = default)
    {
        var rawPerformance = await GetProductSalesPerformanceAsync(storeId, fromDate, toDate, 50, ct);
        if (!rawPerformance.Any()) return new List<TopSellerItemDto>();

        var avgUnits = rawPerformance.Average(p => (double)p.UnitsSold);
        var avgMargin = rawPerformance.Average(p => (double)p.MarginPercentage);

        var results = rawPerformance.Select(p =>
        {
            var isHighPopularity = p.UnitsSold >= avgUnits;
            var isHighProfitability = (double)p.MarginPercentage >= avgMargin;

            string classification;
            if (isHighPopularity && isHighProfitability)
                classification = "Star";
            else if (isHighPopularity && !isHighProfitability)
                classification = "Plowhorse";
            else if (!isHighPopularity && isHighProfitability)
                classification = "Puzzle";
            else
                classification = "Dog";

            return new TopSellerItemDto(
                p.ProductId,
                p.ProductName,
                p.Sku,
                p.UnitsSold,
                p.Revenue,
                p.EstimatedGrossProfit,
                p.MarginPercentage,
                p.RevenueSharePercentage,
                classification
            );
        })
        .Take(top)
        .ToList();

        return results;
    }

    public async Task<WasteShrinkageReportDto> GetWasteShrinkageReportAsync(
        Guid storeId, 
        DateTime? fromDate = null, 
        DateTime? toDate = null, 
        CancellationToken ct = default)
    {
        var store = await _context.Stores
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == storeId, ct)
            ?? throw new NotFoundException("STORE_NOT_FOUND", $"Không tìm thấy chi nhánh với ID '{storeId}'.");

        var start = fromDate ?? DateTime.UtcNow.Date.AddDays(-30);
        var end = toDate ?? DateTime.UtcNow;

        var transactions = await _context.InventoryTransactions
            .AsNoTracking()
            .Include(t => t.Ingredient)
            .Where(t => t.StoreId == storeId && t.CreatedAt >= start && t.CreatedAt <= end)
            .ToListAsync(ct);

        var grouped = transactions
            .GroupBy(t => t.IngredientId)
            .Select(g =>
            {
                var ingredient = g.FirstOrDefault()?.Ingredient;
                var ingName = ingredient?.Name ?? "Nguyên liệu";
                var ingCode = ingredient?.Code ?? "ING";
                var unit = ingredient?.Unit ?? "kg";
                var unitCost = ingredient?.StandardCost ?? 0m;

                var theoreticalUsage = g.Where(t => t.TransactionType == InventoryTransactionType.Outbound_Sale)
                                        .Sum(t => Math.Abs(t.QuantityChange));

                var wastedQuantity = g.Where(t => t.TransactionType == InventoryTransactionType.Waste_Spoiled ||
                                                 (t.TransactionType == InventoryTransactionType.Audit_Adjustment && t.QuantityChange < 0))
                                      .Sum(t => Math.Abs(t.QuantityChange));

                var totalWasteCost = Math.Round(wastedQuantity * unitCost, 0);

                var totalHandled = theoreticalUsage + wastedQuantity;
                var shrinkageRate = totalHandled > 0 ? Math.Round((wastedQuantity / totalHandled) * 100m, 2) : 0m;

                string status;
                if (shrinkageRate <= 2.0m) status = "Normal";
                else if (shrinkageRate <= 5.0m) status = "Warning";
                else status = "Critical";

                return new WasteItemDetailDto(
                    g.Key,
                    ingCode,
                    ingName,
                    unit,
                    theoreticalUsage,
                    wastedQuantity,
                    unitCost,
                    totalWasteCost,
                    shrinkageRate,
                    status
                );
            })
            .Where(w => w.TheoreticalUsage > 0 || w.WastedQuantity > 0)
            .OrderByDescending(w => w.TotalWasteCost)
            .ToList();

        var totalTheoretical = grouped.Sum(g => g.TheoreticalUsage);
        var totalWasted = grouped.Sum(g => g.WastedQuantity);
        var totalCost = grouped.Sum(g => g.TotalWasteCost);

        var grandTotal = totalTheoretical + totalWasted;
        var overallRate = grandTotal > 0 ? Math.Round((totalWasted / grandTotal) * 100m, 2) : 0m;

        string healthRating;
        if (overallRate <= 2.0m) healthRating = "Tốt (Tỷ lệ hao hụt đạt chuẩn F&B < 2%)";
        else if (overallRate <= 5.0m) healthRating = "Cần lưu ý (Hao hụt ở mức 2% - 5%)";
        else healthRating = "Báo động (> 5% - Nguy cơ thất thoát / đổ vỡ nghiêm trọng)";

        return new WasteShrinkageReportDto(
            store.Id,
            store.Name,
            start,
            end,
            totalTheoretical,
            totalWasted,
            totalCost,
            overallRate,
            healthRating,
            grouped
        );
    }
}
