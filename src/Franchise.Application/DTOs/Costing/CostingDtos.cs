namespace Franchise.Application.DTOs.Costing;

public record IngredientCostDetailDto(
    Guid IngredientId,
    string IngredientCode,
    string IngredientName,
    string Unit,
    decimal Quantity,
    decimal UnitCost,
    decimal TotalCost,
    decimal CostSharePercentage // Tỷ trọng phần trăm trong tổng COGS của món
);

public record ProductCostingResponse(
    Guid ProductId,
    string Sku,
    string Name,
    decimal SellingPrice,
    decimal TotalCogs,
    decimal GrossProfit,
    decimal GrossMarginPercentage,
    string MarginStatus, // "Healthy", "Warning", "Critical"
    List<IngredientCostDetailDto> CostBreakdown
);

public record SimulateIngredientItemDto(
    Guid IngredientId,
    decimal Quantity
);

public record SimulateRecipeCostRequest(
    decimal SellingPrice,
    List<SimulateIngredientItemDto> Items
);

public record SimulateIngredientDetailDto(
    Guid IngredientId,
    string IngredientCode,
    string IngredientName,
    string Unit,
    decimal Quantity,
    decimal UnitCost,
    decimal TotalCost,
    decimal CostSharePercentage
);

public record SimulateRecipeCostResponse(
    decimal SellingPrice,
    decimal TotalCogs,
    decimal GrossProfit,
    decimal GrossMarginPercentage,
    string MarginStatus, // "Healthy", "Warning", "Critical"
    List<SimulateIngredientDetailDto> Breakdown
);

public record ProductMarginSummaryDto(
    Guid ProductId,
    string ProductName,
    string Sku,
    int TotalQuantitySold,
    decimal TotalRevenue,
    decimal TotalCogs,
    decimal GrossProfit,
    decimal GrossMarginPercentage
);

public record StoreGrossMarginReportResponse(
    Guid StoreId,
    string StoreName,
    DateTime FromDate,
    DateTime ToDate,
    decimal TotalRevenue,
    decimal TotalCogs,
    decimal NetGrossProfit,
    decimal OverallGrossMarginPercentage,
    List<ProductMarginSummaryDto> TopProfitableProducts,
    List<ProductMarginSummaryDto> LowMarginAlerts
);
