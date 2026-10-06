using FluentAssertions;
using Franchise.Application.DTOs.Costing;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Franchise.Domain.Exceptions;
using Franchise.Infrastructure.Data;
using Franchise.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Franchise.UnitTests.Services;

public class CostingServiceTests
{
    private AppDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private (CostingService costingService, AppDbContext context) CreateCostingService()
    {
        var context = CreateInMemoryDbContext();
        var service = new CostingService(context, NullLogger<CostingService>.Instance);
        return (service, context);
    }

    [Fact]
    public async Task CalculateProductCostAsync_WithValidRecipe_ShouldCalculateAccurateCogsAndMargin()
    {
        // Arrange
        var (costingService, context) = CreateCostingService();
        var productId = Guid.NewGuid();
        var teaId = Guid.NewGuid();
        var milkId = Guid.NewGuid();

        var teaIng = new Ingredient { Id = teaId, Code = "TEA", Name = "Cốt trà", Unit = "ml", StandardCost = 100m };
        var milkIng = new Ingredient { Id = milkId, Code = "MILK", Name = "Sữa tươi", Unit = "ml", StandardCost = 120m };

        var product = new Product
        {
            Id = productId,
            Name = "Trà sữa truyền thống",
            Sku = "TS-01",
            BasePrice = 35000m,
            IsAvailable = true
        };

        var recipe1 = new ProductRecipe { ProductId = productId, IngredientId = teaId, Ingredient = teaIng, Quantity = 30m };
        var recipe2 = new ProductRecipe { ProductId = productId, IngredientId = milkId, Ingredient = milkIng, Quantity = 50m };

        context.Ingredients.AddRange(teaIng, milkIng);
        context.Products.Add(product);
        context.ProductRecipes.AddRange(recipe1, recipe2);
        await context.SaveChangesAsync();

        // Act
        var result = await costingService.CalculateProductCostAsync(productId);

        // Assert: 30 * 100 = 3,000 | 50 * 120 = 6,000 -> Total COGS = 9,000 VND
        result.Should().NotBeNull();
        result.SellingPrice.Should().Be(35000m);
        result.TotalCogs.Should().Be(9000m);
        result.GrossProfit.Should().Be(26000m);
        result.GrossMarginPercentage.Should().Be(74.29m); // (26,000 / 35,000) * 100 = 74.2857 -> 74.29%
        result.MarginStatus.Should().Be("Healthy");

        result.CostBreakdown.Should().HaveCount(2);
        var teaCost = result.CostBreakdown.First(b => b.IngredientId == teaId);
        teaCost.TotalCost.Should().Be(3000m);
        teaCost.CostSharePercentage.Should().Be(33.33m); // 3,000 / 9,000 * 100 = 33.33%

        var milkCost = result.CostBreakdown.First(b => b.IngredientId == milkId);
        milkCost.TotalCost.Should().Be(6000m);
        milkCost.CostSharePercentage.Should().Be(66.67m); // 6,000 / 9,000 * 100 = 66.67%
    }

    [Fact]
    public async Task CalculateProductCostAsync_WhenStoreHasCustomPrice_ShouldUseStorePriceForMargin()
    {
        // Arrange
        var (costingService, context) = CreateCostingService();
        var productId = Guid.NewGuid();
        var storeId = Guid.NewGuid();
        var coffeeId = Guid.NewGuid();

        var coffeeIng = new Ingredient { Id = coffeeId, Code = "CF", Name = "Cà phê", Unit = "g", StandardCost = 200m };
        var product = new Product
        {
            Id = productId,
            Name = "Cà phê phin",
            Sku = "CF-01",
            BasePrice = 25000m,
            IsAvailable = true
        };

        var recipe = new ProductRecipe { ProductId = productId, IngredientId = coffeeId, Ingredient = coffeeIng, Quantity = 25m };
        var storePrice = new StoreProductPrice { StoreId = storeId, ProductId = productId, CustomPrice = 30000m };

        context.Ingredients.Add(coffeeIng);
        context.Products.Add(product);
        context.ProductRecipes.Add(recipe);
        context.StoreProductPrices.Add(storePrice);
        await context.SaveChangesAsync();

        // Act: Tính theo storeId
        var result = await costingService.CalculateProductCostAsync(productId, storeId);

        // Assert: Giá bán lấy 30,000đ (thay vì 25,000đ); COGS = 25 * 200 = 5,000đ
        result.SellingPrice.Should().Be(30000m);
        result.TotalCogs.Should().Be(5000m);
        result.GrossProfit.Should().Be(25000m);
        result.GrossMarginPercentage.Should().Be(83.33m); // 25,000 / 30,000 * 100 = 83.33%
        result.MarginStatus.Should().Be("Healthy");
    }

    [Fact]
    public async Task CalculateProductCostAsync_WhenProductHasNoRecipe_ShouldReturnZeroCogsAnd100PercentMargin()
    {
        // Arrange
        var (costingService, context) = CreateCostingService();
        var productId = Guid.NewGuid();

        context.Products.Add(new Product
        {
            Id = productId,
            Name = "Khăn ướt lạnh",
            Sku = "TOWEL",
            BasePrice = 5000m,
            IsAvailable = true
        });
        await context.SaveChangesAsync();

        // Act
        var result = await costingService.CalculateProductCostAsync(productId);

        // Assert
        result.TotalCogs.Should().Be(0m);
        result.GrossProfit.Should().Be(5000m);
        result.GrossMarginPercentage.Should().Be(100m);
        result.MarginStatus.Should().Be("Healthy");
        result.CostBreakdown.Should().BeEmpty();
    }

    [Fact]
    public async Task SimulateRecipeCostAsync_ShouldCalculateSimulationWithoutSavingToDatabase()
    {
        // Arrange
        var (costingService, context) = CreateCostingService();
        var matchaId = Guid.NewGuid();
        var sugarId = Guid.NewGuid();

        context.Ingredients.AddRange(
            new Ingredient { Id = matchaId, Code = "MATCHA", Name = "Bột Matcha Nhật", Unit = "g", StandardCost = 500m },
            new Ingredient { Id = sugarId, Code = "SUGAR", Name = "Đường cát", Unit = "g", StandardCost = 30m }
        );
        await context.SaveChangesAsync();

        var request = new SimulateRecipeCostRequest(
            SellingPrice: 45000m,
            Items: new List<SimulateIngredientItemDto>
            {
                new(matchaId, Quantity: 20m), // 20 * 500 = 10,000đ
                new(sugarId, Quantity: 50m)   // 50 * 30 = 1,500đ
            }
        );

        // Act
        var result = await costingService.SimulateRecipeCostAsync(request);

        // Assert
        result.SellingPrice.Should().Be(45000m);
        result.TotalCogs.Should().Be(11500m);
        result.GrossProfit.Should().Be(33500m);
        result.GrossMarginPercentage.Should().Be(74.44m); // 33,500 / 45,000 * 100 = 74.44%
        result.MarginStatus.Should().Be("Healthy");
        result.Breakdown.Should().HaveCount(2);

        // Xác nhận tuyệt đối không có ProductRecipe nào bị ghi vào DB
        var totalRecipesInDb = await context.ProductRecipes.CountAsync();
        totalRecipesInDb.Should().Be(0);
    }

    [Theory]
    [InlineData(10000, 7000, "Critical")] // Margin 30% (< 50%) -> Critical
    [InlineData(10000, 4500, "Warning")]  // Margin 55% (50% - 65%) -> Warning
    [InlineData(10000, 2000, "Healthy")]  // Margin 80% (>= 65%) -> Healthy
    public async Task SimulateRecipeCostAsync_MarginStatusClassification_ShouldClassifyCorrectly(
        decimal sellingPrice,
        decimal totalCogsTarget,
        string expectedStatus)
    {
        // Arrange
        var (costingService, context) = CreateCostingService();
        var ingId = Guid.NewGuid();
        context.Ingredients.Add(new Ingredient { Id = ingId, Code = "ING-X", Name = "X", Unit = "g", StandardCost = totalCogsTarget });
        await context.SaveChangesAsync();

        var request = new SimulateRecipeCostRequest(
            SellingPrice: sellingPrice,
            Items: new List<SimulateIngredientItemDto> { new(ingId, Quantity: 1m) }
        );

        // Act
        var result = await costingService.SimulateRecipeCostAsync(request);

        // Assert
        result.MarginStatus.Should().Be(expectedStatus);
    }

    [Fact]
    public async Task GetStoreGrossMarginReportAsync_ShouldAggregateSalesRevenueAndCogsAccurately()
    {
        // Arrange
        var (costingService, context) = CreateCostingService();
        var storeId = Guid.NewGuid();
        var prodId = Guid.NewGuid();
        var teaId = Guid.NewGuid();
        var pearlId = Guid.NewGuid();

        var store = new Store { Id = storeId, Code = "ST-REP", Name = "Store Report", Address = "Q1" };
        var teaIng = new Ingredient { Id = teaId, Code = "TEA", Name = "Trà", Unit = "ml", StandardCost = 100m };
        var pearlIng = new Ingredient { Id = pearlId, Code = "PEARL", Name = "Trân châu", Unit = "g", StandardCost = 50m };

        var prod = new Product { Id = prodId, Name = "Trà sữa", Sku = "TS", BasePrice = 30000m, IsAvailable = true };
        var recipe = new ProductRecipe { ProductId = prodId, IngredientId = teaId, Ingredient = teaIng, Quantity = 20m }; // 2,000đ base cogs

        context.Stores.Add(store);
        context.Ingredients.AddRange(teaIng, pearlIng);
        context.Products.Add(prod);
        context.ProductRecipes.Add(recipe);

        // Tạo 1 đơn hàng đã hoàn tất: 2 ly trà sữa, mỗi ly thêm trân châu (20g * 50đ = 1,000đ topping)
        // Unit COGS = 2,000 + 1,000 = 3,000đ. Với 2 ly: Total COGS = 6,000đ
        // Doanh thu TotalPrice = 70,000đ (2 ly giá 35k)
        var order = new Order
        {
            Id = Guid.NewGuid(),
            OrderNumber = "ORD-REP-01",
            StoreId = storeId,
            Status = OrderStatus.Completed,
            CompletedAt = DateTime.UtcNow,
            Subtotal = 70000m,
            FinalAmount = 70000m,
            OrderItems = new List<OrderItem>
            {
                new OrderItem
                {
                    ProductId = prodId,
                    Quantity = 2,
                    UnitPrice = 35000m,
                    TotalPrice = 70000m,
                    Modifiers = new List<OrderItemModifier>
                    {
                        new OrderItemModifier
                        {
                            Name = "Trân châu",
                            IngredientId = pearlId,
                            ConsumptionQuantity = 20m,
                            ExtraPrice = 5000m
                        }
                    }
                }
            }
        };

        context.Orders.Add(order);
        await context.SaveChangesAsync();

        // Act
        var report = await costingService.GetStoreGrossMarginReportAsync(storeId);

        // Assert
        report.Should().NotBeNull();
        report.StoreId.Should().Be(storeId);
        report.TotalRevenue.Should().Be(70000m);
        report.TotalCogs.Should().Be(6000m);
        report.NetGrossProfit.Should().Be(64000m);
        report.OverallGrossMarginPercentage.Should().Be(91.43m); // 64,000 / 70,000 * 100 = 91.43%
        report.TopProfitableProducts.Should().HaveCount(1);
        report.TopProfitableProducts.First().ProductName.Should().Be("Trà sữa");
    }
}
