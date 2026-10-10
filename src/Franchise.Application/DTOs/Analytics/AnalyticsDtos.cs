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

public record AdvancedPeakHoursAnalysisDto(
    Guid StoreId,
    string StoreName,
    DateTime Date,
    int TotalOrders,
    decimal TotalRevenue,
    int PeakHourOrderCount,
    decimal PeakHourRevenue,
    int BusiestHour,
    string BusiestHourRange,
    int RecommendedStaffingOnPeak,
    int RecommendedStaffingOffPeak,
    List<HourlySalesPointDto> HourlyDistribution
);

public record WasteItemDetailDto(
    Guid IngredientId,
    string IngredientCode,
    string IngredientName,
    string Unit,
    decimal TheoreticalUsage,
    decimal WastedQuantity,
    decimal UnitCost,
    decimal TotalWasteCost,
    decimal ShrinkageRatePercentage,
    string Status // "Normal" (<2%), "Warning" (2-5%), "Critical" (>5%)
);

public record WasteShrinkageReportDto(
    Guid StoreId,
    string StoreName,
    DateTime FromDate,
    DateTime ToDate,
    decimal TotalTheoreticalUsage,
    decimal TotalWastedQuantity,
    decimal TotalWasteCost,
    decimal OverallShrinkageRatePercentage,
    string HealthRating, // "Tốt (<2%)", "Cần lưu ý (2-5%)", "Báo động (>5%)"
    List<WasteItemDetailDto> Items
);

public record TopSellerItemDto(
    Guid ProductId,
    string ProductName,
    string Sku,
    int UnitsSold,
    decimal Revenue,
    decimal EstimatedProfit,
    decimal MarginPercentage,
    decimal RevenueSharePercentage,
    string MenuClassification // "Star", "Plowhorse", "Puzzle", "Dog"
);

