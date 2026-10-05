using FluentAssertions;
using Franchise.Application.DTOs.Orders;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Franchise.Domain.Exceptions;
using Franchise.Infrastructure.Data;
using Franchise.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Franchise.UnitTests.Services;

public class OrderServiceTests
{
    private AppDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private (OrderService orderService, AppDbContext context) CreateOrderService()
    {
        var context = CreateInMemoryDbContext();
        var inventoryService = new InventoryService(context);
        var orderService = new OrderService(
            context,
            inventoryService,
            NullLogger<OrderService>.Instance);

        return (orderService, context);
    }

    [Fact]
    public async Task CheckoutAsync_ShouldCalculateCorrectTotalAndVat_AndGenerateOutbox_WhenStockSufficient()
    {
        // Arrange
        var (orderService, context) = CreateOrderService();
        var storeId = Guid.NewGuid();
        var productId = Guid.NewGuid();
        var coffeeIngId = Guid.NewGuid();

        // 1. Tạo Store
        context.Stores.Add(new Store
        {
            Id = storeId,
            Code = "ST-01",
            Name = "Chi nhánh Quận 1",
            IsActive = true
        });

        // 2. Tạo Product & Ingredient & Recipe
        context.Products.Add(new Product
        {
            Id = productId,
            Name = "Cà phê sữa đá",
            Sku = "CF-01",
            BasePrice = 30000m,
            IsAvailable = true
        });

        context.Ingredients.Add(new Ingredient
        {
            Id = coffeeIngId,
            Code = "CF-BEAN",
            Name = "Hạt cà phê",
            Unit = "gram"
        });

        context.ProductRecipes.Add(new ProductRecipe
        {
            ProductId = productId,
            IngredientId = coffeeIngId,
            Quantity = 20m
        });

        // 3. Tồn kho: 100g
        context.StoreInventories.Add(new StoreInventory
        {
            StoreId = storeId,
            IngredientId = coffeeIngId,
            CurrentStock = 100m,
            MinAlertThreshold = 10m
        });

        await context.SaveChangesAsync();

        var request = new CheckoutOrderRequest(
            StoreId: storeId,
            CustomerId: null,
            CashierId: null,
            OrderType: OrderType.DineIn,
            PaymentMethod: PaymentMethod.Cash,
            Items: new List<CreateOrderItemRequest>
            {
                new CreateOrderItemRequest(
                    ProductId: productId,
                    Quantity: 2 // 2 ly * 30,000 = 60,000 Subtotal; VAT 8% = 4,800; Final = 64,800
                )
            }
        );

        // Act
        var response = await orderService.CheckoutAsync(request);

        // Assert
        response.Should().NotBeNull();
        response.Status.Should().Be(OrderStatus.Completed);
        response.Subtotal.Should().Be(60000m);
        response.VatAmount.Should().Be(4800m);
        response.FinalAmount.Should().Be(64800m);
        response.PaymentStatus.Should().Be(PaymentStatus.Success);
        response.DeductedIngredients.Should().HaveCount(1);
        response.DeductedIngredients[0].QuantityDeducted.Should().Be(40m); // 2 * 20g
        response.DeductedIngredients[0].BalanceAfter.Should().Be(60m);     // 100 - 40 = 60g

        // Kiểm tra Order trong Database
        var savedOrder = await context.Orders
            .Include(o => o.OrderItems)
            .Include(o => o.Payments)
            .FirstOrDefaultAsync(o => o.Id == response.OrderId);

        savedOrder.Should().NotBeNull();
        savedOrder!.OrderNumber.Should().StartWith("ORD-");
        savedOrder.OrderItems.Should().HaveCount(1);
        savedOrder.OrderItems.First().UnitPrice.Should().Be(30000m);
        savedOrder.OrderItems.First().TotalPrice.Should().Be(60000m);
        savedOrder.Payments.Should().HaveCount(1);
        savedOrder.Payments.First().Amount.Should().Be(64800m);
        savedOrder.Payments.First().Status.Should().Be(PaymentStatus.Success);

        // Kiểm tra Outbox Message
        var outboxMessage = await context.OutboxMessages.FirstOrDefaultAsync(m => m.AggregateId == response.OrderId.ToString());
        outboxMessage.Should().NotBeNull();
        outboxMessage!.AggregateType.Should().Be("Order");
        outboxMessage.EventType.Should().Be("OrderCompleted");
        outboxMessage.Payload.Should().Contain(response.OrderNumber);
        outboxMessage.ProcessedAt.Should().BeNull();
    }

    [Fact]
    public async Task CheckoutAsync_WithModifiers_ShouldCalculateExtraPriceAndDeductModifierIngredients()
    {
        // Arrange
        var (orderService, context) = CreateOrderService();
        var storeId = Guid.NewGuid();
        var teaProductId = Guid.NewGuid();
        var teaIngId = Guid.NewGuid();
        var pearlIngId = Guid.NewGuid();

        context.Stores.Add(new Store
        {
            Id = storeId,
            Code = "ST-02",
            Name = "Chi nhánh Quận 3",
            IsActive = true
        });

        context.Products.Add(new Product
        {
            Id = teaProductId,
            Name = "Trà sữa truyền thống",
            Sku = "TS-01",
            BasePrice = 35000m,
            IsAvailable = true
        });

        context.Ingredients.AddRange(
            new Ingredient { Id = teaIngId, Code = "TEA", Name = "Cốt trà", Unit = "ml" },
            new Ingredient { Id = pearlIngId, Code = "PEARL", Name = "Trân châu đen", Unit = "gram" }
        );

        context.ProductRecipes.Add(new ProductRecipe
        {
            ProductId = teaProductId,
            IngredientId = teaIngId,
            Quantity = 100m // 100ml cốt trà mỗi ly
        });

        context.StoreInventories.AddRange(
            new StoreInventory { StoreId = storeId, IngredientId = teaIngId, CurrentStock = 500m, MinAlertThreshold = 50m },
            new StoreInventory { StoreId = storeId, IngredientId = pearlIngId, CurrentStock = 200m, MinAlertThreshold = 20m }
        );

        await context.SaveChangesAsync();

        // Mua 2 ly trà sữa (35,000 + 10,000 phụ thu trân châu = 45,000/ly)
        // Subtotal = 90,000; VAT 8% = 7,200; Final = 97,200
        var request = new CheckoutOrderRequest(
            StoreId: storeId,
            CustomerId: null,
            CashierId: null,
            OrderType: OrderType.TakeAway,
            PaymentMethod: PaymentMethod.MoMo,
            Items: new List<CreateOrderItemRequest>
            {
                new CreateOrderItemRequest(
                    ProductId: teaProductId,
                    Quantity: 2,
                    SpecialNote: "Ít đường",
                    Modifiers: new List<CreateOrderModifierRequest>
                    {
                        new CreateOrderModifierRequest(
                            Name: "Thêm Trân Châu Đen",
                            ExtraPrice: 10000m,
                            IngredientId: pearlIngId,
                            ConsumptionQuantity: 30m // 30g trân châu mỗi ly
                        )
                    }
                )
            }
        );

        // Act
        var response = await orderService.CheckoutAsync(request);

        // Assert
        response.Subtotal.Should().Be(90000m);
        response.VatAmount.Should().Be(7200m);
        response.FinalAmount.Should().Be(97200m);
        response.DeductedIngredients.Should().HaveCount(2);

        // Kiểm tra tồn kho sau khi trừ:
        // Cốt trà: 500 - (100 * 2) = 300ml
        // Trân châu: 200 - (30 * 2) = 140g
        var teaInv = await context.StoreInventories.FirstAsync(si => si.StoreId == storeId && si.IngredientId == teaIngId);
        var pearlInv = await context.StoreInventories.FirstAsync(si => si.StoreId == storeId && si.IngredientId == pearlIngId);
        teaInv.CurrentStock.Should().Be(300m);
        pearlInv.CurrentStock.Should().Be(140m);
    }

    [Fact]
    public async Task CheckoutAsync_WhenStoreDoesNotExist_ShouldThrowNotFoundException()
    {
        // Arrange
        var (orderService, _) = CreateOrderService();
        var nonExistentStoreId = Guid.NewGuid();

        var request = new CheckoutOrderRequest(
            StoreId: nonExistentStoreId,
            CustomerId: null,
            CashierId: null,
            OrderType: OrderType.DineIn,
            PaymentMethod: PaymentMethod.Cash,
            Items: new List<CreateOrderItemRequest>
            {
                new CreateOrderItemRequest(Guid.NewGuid(), 1)
            }
        );

        // Act
        var act = async () => await orderService.CheckoutAsync(request);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*{nonExistentStoreId}*");
    }

    [Fact]
    public async Task CheckoutAsync_WhenProductIsNotAvailable_ShouldThrowBusinessRuleException()
    {
        // Arrange
        var (orderService, context) = CreateOrderService();
        var storeId = Guid.NewGuid();
        var inactiveProductId = Guid.NewGuid();

        context.Stores.Add(new Store { Id = storeId, Code = "ST-03", Name = "Store 3", IsActive = true });
        context.Products.Add(new Product
        {
            Id = inactiveProductId,
            Name = "Món tạm ngưng",
            Sku = "OFF-01",
            BasePrice = 40000m,
            IsAvailable = false
        });
        await context.SaveChangesAsync();

        var request = new CheckoutOrderRequest(
            StoreId: storeId,
            CustomerId: null,
            CashierId: null,
            OrderType: OrderType.DineIn,
            PaymentMethod: PaymentMethod.Cash,
            Items: new List<CreateOrderItemRequest>
            {
                new CreateOrderItemRequest(inactiveProductId, 1)
            }
        );

        // Act
        var act = async () => await orderService.CheckoutAsync(request);

        // Assert
        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*ngừng kinh doanh*");
    }

    [Fact]
    public async Task CheckoutAsync_WhenInsufficientStock_ShouldThrowInsufficientStockException_AndRollbackOrder()
    {
        // Arrange
        var (orderService, context) = CreateOrderService();
        var storeId = Guid.NewGuid();
        var productId = Guid.NewGuid();
        var coffeeIngId = Guid.NewGuid();

        context.Stores.Add(new Store { Id = storeId, Code = "ST-04", Name = "Store 4", IsActive = true });
        context.Products.Add(new Product { Id = productId, Name = "Espresso", Sku = "ESP", BasePrice = 25000m, IsAvailable = true });
        context.Ingredients.Add(new Ingredient { Id = coffeeIngId, Code = "ESP-BEAN", Name = "Hạt Espresso", Unit = "gram" });
        context.ProductRecipes.Add(new ProductRecipe { ProductId = productId, IngredientId = coffeeIngId, Quantity = 20m });

        // Tồn kho chỉ còn 15g (không đủ cho 1 ly 20g)
        context.StoreInventories.Add(new StoreInventory
        {
            StoreId = storeId,
            IngredientId = coffeeIngId,
            CurrentStock = 15m,
            MinAlertThreshold = 10m
        });
        await context.SaveChangesAsync();

        var request = new CheckoutOrderRequest(
            StoreId: storeId,
            CustomerId: null,
            CashierId: null,
            OrderType: OrderType.DineIn,
            PaymentMethod: PaymentMethod.Cash,
            Items: new List<CreateOrderItemRequest>
            {
                new CreateOrderItemRequest(productId, 1)
            }
        );

        // Act
        var act = async () => await orderService.CheckoutAsync(request);

        // Assert
        await act.Should().ThrowAsync<ConflictException>();

        // Kiểm tra rollback: Không có Order hay OutboxMessage nào được lưu lại
        var ordersCount = await context.Orders.CountAsync();
        var outboxCount = await context.OutboxMessages.CountAsync();
        ordersCount.Should().Be(0);
        outboxCount.Should().Be(0);

        // Tồn kho không bị thay đổi
        var inv = await context.StoreInventories.FirstAsync(si => si.StoreId == storeId && si.IngredientId == coffeeIngId);
        inv.CurrentStock.Should().Be(15m);
    }

    [Fact]
    public async Task CheckoutAsync_WhenModifierHasNegativeExtraPrice_ShouldThrowRequestValidationException()
    {
        // Arrange
        var (orderService, context) = CreateOrderService();
        var storeId = Guid.NewGuid();
        var productId = Guid.NewGuid();

        context.Stores.Add(new Store { Id = storeId, Code = "ST-05", Name = "Store 5", IsActive = true });
        context.Products.Add(new Product { Id = productId, Name = "Trà đào", Sku = "TD", BasePrice = 30000m, IsAvailable = true });
        await context.SaveChangesAsync();

        var request = new CheckoutOrderRequest(
            StoreId: storeId,
            CustomerId: null,
            CashierId: null,
            OrderType: OrderType.DineIn,
            PaymentMethod: PaymentMethod.Cash,
            Items: new List<CreateOrderItemRequest>
            {
                new CreateOrderItemRequest(
                    ProductId: productId,
                    Quantity: 1,
                    Modifiers: new List<CreateOrderModifierRequest>
                    {
                        new CreateOrderModifierRequest("Khuyến mãi âm", ExtraPrice: -10000m)
                    }
                )
            }
        );

        // Act
        var act = async () => await orderService.CheckoutAsync(request);

        // Assert
        await act.Should().ThrowAsync<RequestValidationException>()
            .WithMessage("*không được là số âm*");
    }
}
