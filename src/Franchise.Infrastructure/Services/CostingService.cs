using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Costing;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Franchise.Domain.Exceptions;
using Franchise.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Franchise.Infrastructure.Services;

public class CostingService : ICostingService
{
    private readonly AppDbContext _context;
    private readonly ILogger<CostingService> _logger;

    public CostingService(AppDbContext context, ILogger<CostingService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<ProductCostingResponse> CalculateProductCostAsync(Guid productId, Guid? storeId = null, CancellationToken ct = default)
    {
        var product = await _context.Products
            .AsNoTracking()
            .Include(p => p.Recipes)
                .ThenInclude(r => r.Ingredient)
            .Include(p => p.StoreProductPrices)
            .FirstOrDefaultAsync(p => p.Id == productId, ct);

        if (product == null)
        {
            throw new NotFoundException("PRODUCT_NOT_FOUND", $"Không tìm thấy sản phẩm với ID '{productId}'.");
        }

        return ComputeProductCosting(product, storeId);
    }

    public async Task<List<ProductCostingResponse>> GetAllProductsCostingAsync(Guid? storeId = null, CancellationToken ct = default)
    {
        var products = await _context.Products
            .AsNoTracking()
            .Include(p => p.Recipes)
                .ThenInclude(r => r.Ingredient)
            .Include(p => p.StoreProductPrices)
            .Where(p => p.IsAvailable)
            .OrderBy(p => p.Name)
            .ToListAsync(ct);

        return products.Select(p => ComputeProductCosting(p, storeId)).ToList();
    }

    public async Task<SimulateRecipeCostResponse> SimulateRecipeCostAsync(SimulateRecipeCostRequest request, CancellationToken ct = default)
    {
        if (request.SellingPrice < 0)
        {
            throw new RequestValidationException("SellingPrice", "Giá bán mô phỏng không được là số âm.");
        }

        if (request.Items == null || request.Items.Count == 0)
        {
            var grossProfitZero = request.SellingPrice;
            var marginZero = request.SellingPrice > 0 ? 100m : 0m;
            return new SimulateRecipeCostResponse(
                request.SellingPrice,
                0m,
                grossProfitZero,
                marginZero,
                GetMarginStatus(marginZero),
                new List<SimulateIngredientDetailDto>()
            );
        }

        var ingredientIds = request.Items.Select(i => i.IngredientId).Distinct().ToList();
        var ingredients = await _context.Ingredients
            .AsNoTracking()
            .Where(ing => ingredientIds.Contains(ing.Id))
            .ToDictionaryAsync(ing => ing.Id, ct);

        decimal totalCogs = 0m;
        var rawBreakdown = new List<(Ingredient Ingredient, decimal Quantity, decimal ItemCost)>();

        foreach (var item in request.Items)
        {
            if (item.Quantity < 0)
            {
                throw new RequestValidationException("Quantity", "Định lượng nguyên liệu không được là số âm.");
            }

            if (!ingredients.TryGetValue(item.IngredientId, out var ing))
            {
                throw new NotFoundException("INGREDIENT_NOT_FOUND", $"Không tìm thấy nguyên liệu với ID '{item.IngredientId}'.");
            }

            var itemCost = Math.Round(item.Quantity * ing.StandardCost, 2);
            totalCogs += itemCost;
            rawBreakdown.Add((ing, item.Quantity, itemCost));
        }

        var breakdown = rawBreakdown.Select(rb =>
        {
            var share = totalCogs > 0 ? Math.Round((rb.ItemCost / totalCogs) * 100m, 2) : 0m;
            return new SimulateIngredientDetailDto(
                rb.Ingredient.Id,
                rb.Ingredient.Code,
                rb.Ingredient.Name,
                rb.Ingredient.Unit,
                rb.Quantity,
                rb.Ingredient.StandardCost,
                rb.ItemCost,
                share
            );
        }).ToList();

        var grossProfit = request.SellingPrice - totalCogs;
        var marginPercentage = request.SellingPrice > 0
            ? Math.Round((grossProfit / request.SellingPrice) * 100m, 2)
            : 0m;

        return new SimulateRecipeCostResponse(
            request.SellingPrice,
            totalCogs,
            grossProfit,
            marginPercentage,
            GetMarginStatus(marginPercentage),
            breakdown
        );
    }

    public async Task<StoreGrossMarginReportResponse> GetStoreGrossMarginReportAsync(
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

        var from = fromDate ?? DateTime.UtcNow.AddMonths(-1);
        var to = toDate ?? DateTime.UtcNow;

        // Lấy tất cả đơn hàng đã hoàn tất trong khoảng thời gian
        var orders = await _context.Orders
            .AsNoTracking()
            .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Modifiers)
            .Where(o => o.StoreId == storeId &&
                        o.Status == OrderStatus.Completed &&
                        o.CompletedAt >= from &&
                        o.CompletedAt <= to)
            .ToListAsync(ct);

        // Lấy thông tin công thức và giá vốn tất cả sản phẩm
        var products = await _context.Products
            .AsNoTracking()
            .Include(p => p.Recipes)
                .ThenInclude(r => r.Ingredient)
            .ToDictionaryAsync(p => p.Id, ct);

        // Lấy thông tin nguyên liệu để tính chi phí modifier
        var allIngredients = await _context.Ingredients
            .AsNoTracking()
            .ToDictionaryAsync(ing => ing.Id, ct);

        decimal totalRevenue = 0m;
        decimal totalCogs = 0m;

        var productStats = new Dictionary<Guid, (int Qty, decimal Revenue, decimal Cogs)>();

        foreach (var order in orders)
        {
            foreach (var item in order.OrderItems)
            {
                var itemRevenue = item.TotalPrice;
                totalRevenue += itemRevenue;

                // Tính COGS của món cơ sở
                decimal itemUnitCogs = 0m;
                if (products.TryGetValue(item.ProductId, out var prod))
                {
                    foreach (var recipe in prod.Recipes)
                    {
                        var ingCost = recipe.Ingredient?.StandardCost ?? 0m;
                        itemUnitCogs += recipe.Quantity * ingCost;
                    }
                }

                // Tính COGS của toppings / modifiers
                decimal modifierTotalCogs = 0m;
                if (item.Modifiers != null)
                {
                    foreach (var mod in item.Modifiers)
                    {
                        if (mod.IngredientId.HasValue &&
                            allIngredients.TryGetValue(mod.IngredientId.Value, out var modIng))
                        {
                            modifierTotalCogs += mod.ConsumptionQuantity * modIng.StandardCost;
                        }
                    }
                }

                var itemTotalCogs = Math.Round((itemUnitCogs * item.Quantity) + (modifierTotalCogs * item.Quantity), 2);
                totalCogs += itemTotalCogs;

                if (productStats.TryGetValue(item.ProductId, out var stat))
                {
                    productStats[item.ProductId] = (stat.Qty + item.Quantity, stat.Revenue + itemRevenue, stat.Cogs + itemTotalCogs);
                }
                else
                {
                    productStats[item.ProductId] = (item.Quantity, itemRevenue, itemTotalCogs);
                }
            }
        }

        var netGrossProfit = totalRevenue - totalCogs;
        var overallMargin = totalRevenue > 0
            ? Math.Round((netGrossProfit / totalRevenue) * 100m, 2)
            : 0m;

        var productSummaries = productStats.Select(kv =>
        {
            var pId = kv.Key;
            var (qty, rev, cogs) = kv.Value;
            var prodName = products.TryGetValue(pId, out var p) ? p.Name : pId.ToString();
            var prodSku = p?.Sku ?? string.Empty;
            var profit = rev - cogs;
            var margin = rev > 0 ? Math.Round((profit / rev) * 100m, 2) : 0m;

            return new ProductMarginSummaryDto(pId, prodName, prodSku, qty, rev, cogs, profit, margin);
        }).ToList();

        var topProfitable = productSummaries
            .OrderByDescending(p => p.GrossProfit)
            .Take(5)
            .ToList();

        var lowMarginAlerts = productSummaries
            .Where(p => p.GrossMarginPercentage < 50m)
            .OrderBy(p => p.GrossMarginPercentage)
            .ToList();

        return new StoreGrossMarginReportResponse(
            storeId,
            store.Name,
            from,
            to,
            totalRevenue,
            totalCogs,
            netGrossProfit,
            overallMargin,
            topProfitable,
            lowMarginAlerts
        );
    }

    private static ProductCostingResponse ComputeProductCosting(Product product, Guid? storeId)
    {
        // 1. Xác định giá bán niêm yết (Ưu tiên giá riêng của Store nếu có)
        decimal sellingPrice = product.BasePrice;
        if (storeId.HasValue)
        {
            var customStorePrice = product.StoreProductPrices
                .FirstOrDefault(sp => sp.StoreId == storeId.Value);
            if (customStorePrice != null && customStorePrice.CustomPrice > 0)
            {
                sellingPrice = customStorePrice.CustomPrice;
            }
        }

        // 2. Tính toán chi phí nguyên liệu (COGS Breakdown)
        decimal totalCogs = 0m;
        var rawBreakdown = new List<(Ingredient Ingredient, decimal Quantity, decimal ItemCost)>();

        foreach (var recipe in product.Recipes)
        {
            var ing = recipe.Ingredient;
            var unitCost = ing?.StandardCost ?? 0m;
            var itemCost = Math.Round(recipe.Quantity * unitCost, 2);
            totalCogs += itemCost;

            if (ing != null)
            {
                rawBreakdown.Add((ing, recipe.Quantity, itemCost));
            }
        }

        var breakdown = rawBreakdown.Select(rb =>
        {
            var share = totalCogs > 0 ? Math.Round((rb.ItemCost / totalCogs) * 100m, 2) : 0m;
            return new IngredientCostDetailDto(
                rb.Ingredient.Id,
                rb.Ingredient.Code,
                rb.Ingredient.Name,
                rb.Ingredient.Unit,
                rb.Quantity,
                rb.Ingredient.StandardCost,
                rb.ItemCost,
                share
            );
        }).ToList();

        var grossProfit = sellingPrice - totalCogs;
        var marginPercentage = sellingPrice > 0
            ? Math.Round((grossProfit / sellingPrice) * 100m, 2)
            : 0m;

        return new ProductCostingResponse(
            product.Id,
            product.Sku,
            product.Name,
            sellingPrice,
            totalCogs,
            grossProfit,
            marginPercentage,
            GetMarginStatus(marginPercentage),
            breakdown
        );
    }

    private static string GetMarginStatus(decimal marginPercentage)
    {
        if (marginPercentage >= 65m) return "Healthy";
        if (marginPercentage >= 50m) return "Warning";
        return "Critical";
    }
}
