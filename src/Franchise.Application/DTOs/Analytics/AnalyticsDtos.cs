namespace Franchise.Application.DTOs.Analytics;

public record FinancialSummaryDto(
    Guid StoreId,
    string StoreName,
    DateTime FromDate,
    DateTime ToDate,
    int TotalOrders,
    decimal GrossRevenue,
    decimal DiscountAmount,
    decimal VatAmount,
    decimal NetRevenue,
    decimal AverageOrderValue,
    decimal EstimatedCogs,
    decimal EstimatedGrossProfit,
    decimal GrossMarginPercentage
);

public record HourlySalesPointDto(
    int Hour, // 0 - 23
    int OrderCount,
    decimal Revenue,
    bool IsPeakHour
);

public record HourlySalesHeatmapDto(
    Guid StoreId,
    string StoreName,
    DateTime Date,
    int TotalOrders,
    decimal TotalRevenue,
    List<HourlySalesPointDto> HourlyDistribution
);

public record ProductSalesRankDto(
    Guid ProductId,
    string ProductName,
    string Sku,
    int UnitsSold,
    decimal Revenue,
    decimal EstimatedCogs,
    decimal EstimatedGrossProfit,
    decimal MarginPercentage,
    decimal RevenueSharePercentage
);

public record NetworkStoreComparisonDto(
    Guid StoreId,
    string StoreCode,
    string StoreName,
    int TotalOrders,
    decimal GrossRevenue,
    decimal NetRevenue,
    decimal EstimatedGrossProfit,
    decimal RoyaltyDue
);

public record NetworkOverviewDto(
    DateTime FromDate,
    DateTime ToDate,
    int TotalNetworkStores,
    int TotalNetworkOrders,
    decimal TotalNetworkRevenue,
    decimal TotalRoyaltyDue,
    List<NetworkStoreComparisonDto> StoreRankings
);
