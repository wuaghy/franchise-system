using FluentAssertions;
using Franchise.Application.DTOs.Inventory;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Franchise.Infrastructure.Data;
using Franchise.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

namespace Franchise.UnitTests.Services;

public class InventoryServiceTests
{
    private AppDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public async Task ProcessOrder_ShouldDeductBothBaseAndTopping_WhenStockIsSufficient()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var storeId = Guid.NewGuid();
        var productId = Guid.NewGuid();
        var coffeeIngId = Guid.NewGuid();
        var pearlIngId = Guid.NewGuid();

        // 1. Tạo nguyên liệu
        context.Ingredients.AddRange(
            new Ingredient { Id = coffeeIngId, Code = "CF", Name = "Cà phê", Unit = "gram" },
            new Ingredient { Id = pearlIngId, Code = "PEARL", Name = "Trân châu", Unit = "gram" }
        );

        // 2. Công thức gốc: 1 ly cần 20g cà phê
        context.ProductRecipes.Add(new ProductRecipe
        {
            ProductId = productId,
            IngredientId = coffeeIngId,
            Quantity = 20
        });

        // 3. Tồn kho chi nhánh: Cà phê có 100g, Trân châu có 50g
        context.StoreInventories.AddRange(
            new StoreInventory { StoreId = storeId, IngredientId = coffeeIngId, CurrentStock = 100, MinAlertThreshold = 10 },
            new StoreInventory { StoreId = storeId, IngredientId = pearlIngId, CurrentStock = 50, MinAlertThreshold = 10 }
        );
        await context.SaveChangesAsync();

        var service = new InventoryService(context);

        // Khách mua 2 ly, mỗi ly thêm 15g trân châu (Cần: 40g cà phê, 30g trân châu)
        var request = new CheckoutOrderInventoryRequest(
            storeId,
            "ORD-001",
            new List<OrderItemInventoryRequest>
            {
                new OrderItemInventoryRequest(
                    productId,
                    Quantity: 2,
                    Modifiers: new List<OrderModifierInventoryRequest>
                    {
                        new OrderModifierInventoryRequest("Thêm Trân Châu", pearlIngId, ConsumptionQuantity: 15)
                    }
                )
            }
        );

        // Act
        var result = await service.ProcessOrderInventoryDeductionAsync(request);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.DeductedItems.Should().HaveCount(2);

        // Kiểm tra tồn kho sau khi trừ
        var coffeeStock = await context.StoreInventories.FirstAsync(s => s.IngredientId == coffeeIngId);
        coffeeStock.CurrentStock.Should().Be(60); // 100 - 40 = 60

        var pearlStock = await context.StoreInventories.FirstAsync(s => s.IngredientId == pearlIngId);
        pearlStock.CurrentStock.Should().Be(20); // 50 - 30 = 20

        // Kiểm tra sổ cái có 2 bản ghi giao dịch
        var transactions = await context.InventoryTransactions.ToListAsync();
        transactions.Should().HaveCount(2);
    }

    [Fact]
    public async Task ProcessOrder_ShouldFailAndRollback_WhenToppingIsOutOfStock()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var storeId = Guid.NewGuid();
        var productId = Guid.NewGuid();
        var coffeeIngId = Guid.NewGuid();
        var pearlIngId = Guid.NewGuid();

        context.Ingredients.AddRange(
            new Ingredient { Id = coffeeIngId, Code = "CF", Name = "Cà phê", Unit = "gram" },
            new Ingredient { Id = pearlIngId, Code = "PEARL", Name = "Trân châu", Unit = "gram" }
        );

        context.ProductRecipes.Add(new ProductRecipe { ProductId = productId, IngredientId = coffeeIngId, Quantity = 25 });

        // Cà phê dư dả (1000g), nhưng Trân châu chỉ còn 10g
        context.StoreInventories.AddRange(
            new StoreInventory { StoreId = storeId, IngredientId = coffeeIngId, CurrentStock = 1000, MinAlertThreshold = 10 },
            new StoreInventory { StoreId = storeId, IngredientId = pearlIngId, CurrentStock = 10, MinAlertThreshold = 10 }
        );
        await context.SaveChangesAsync();

        var service = new InventoryService(context);

        // Cần 40g trân châu nhưng kho chỉ có 10g
        var request = new CheckoutOrderInventoryRequest(
            storeId,
            "ORD-002",
            new List<OrderItemInventoryRequest>
            {
                new OrderItemInventoryRequest(
                    productId,
                    Quantity: 1,
                    Modifiers: new List<OrderModifierInventoryRequest>
                    {
                        new OrderModifierInventoryRequest("Thêm Trân Châu", pearlIngId, ConsumptionQuantity: 40)
                    }
                )
            }
        );

        // Act
        var result = await service.ProcessOrderInventoryDeductionAsync(request);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorMessage.Should().ContainEquivalentOf("Trân châu");

        // CỰC KỲ QUAN TRỌNG: Cà phê không được phép bị trừ dở dang!
        var coffeeStock = await context.StoreInventories.FirstAsync(s => s.IngredientId == coffeeIngId);
        coffeeStock.CurrentStock.Should().Be(1000); // Vẫn nguyên 1000g
    }

    [Fact]
    public async Task RecordWaste_ShouldDeductStockAndLogWasteTransaction()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var storeId = Guid.NewGuid();
        var ingId = Guid.NewGuid();

        context.Ingredients.Add(new Ingredient { Id = ingId, Code = "MLK", Name = "Sữa tươi", Unit = "lít", StandardCost = 35000 });
        context.StoreInventories.Add(new StoreInventory { StoreId = storeId, IngredientId = ingId, CurrentStock = 20, MinAlertThreshold = 5 });
        await context.SaveChangesAsync();

        var service = new InventoryService(context);

        // Act
        var result = await service.RecordWasteAsync(new RecordWasteRequest(storeId, ingId, 3.5m, "Hỏng tủ mát"));

        // Assert
        result.QuantityWasted.Should().Be(3.5m);
        result.RemainingStock.Should().Be(16.5m);
        result.Reason.Should().Be("Hỏng tủ mát");

        var transaction = await context.InventoryTransactions.FirstOrDefaultAsync(t => t.StoreId == storeId && t.IngredientId == ingId);
        transaction.Should().NotBeNull();
        transaction!.TransactionType.Should().Be(InventoryTransactionType.Waste_Spoiled);
        transaction.QuantityChange.Should().Be(-3.5m);
        transaction.BalanceAfter.Should().Be(16.5m);
    }

    [Fact]
    public async Task BroadcastLowStockAlerts_ShouldInvokeTelegramAndEmail_WhenStockBelowThreshold()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var storeId = Guid.NewGuid();
        var ingId = Guid.NewGuid();

        var store = new Store
        {
            Id = storeId,
            Code = "ST-01",
            Name = "Chi nhánh Nguyễn Huệ",
            ManagerEmail = "manager@store.vn",
            TelegramChatId = "-100123456789"
        };
        context.Stores.Add(store);

        context.Ingredients.Add(new Ingredient { Id = ingId, Code = "TEA", Name = "Trà Oolong", Unit = "kg", StandardCost = 120000 });
        context.StoreInventories.Add(new StoreInventory { StoreId = storeId, IngredientId = ingId, CurrentStock = 2, MinAlertThreshold = 10 });
        await context.SaveChangesAsync();

        var mockTelegram = new Moq.Mock<Franchise.Application.Common.Interfaces.ITelegramService>();
        mockTelegram
            .Setup(t => t.SendLowStockAlertAsync(Moq.It.IsAny<string>(), Moq.It.IsAny<string>(), Moq.It.IsAny<List<LowStockAlertResponse>>(), Moq.It.IsAny<CancellationToken>()))
            .Returns(Task.FromResult(new Franchise.Application.Common.Interfaces.TelegramSendResult(true, "Sent")));

        var mockEmail = new Moq.Mock<Franchise.Application.Common.Interfaces.IEmailService>();

        var service = new InventoryService(context, telegramService: mockTelegram.Object, emailService: mockEmail.Object);

        // Act
        var result = await service.BroadcastLowStockAlertsAsync(storeId);

        // Assert
        result.AlertCount.Should().Be(1);
        result.TelegramSent.Should().BeTrue();
        result.EmailSent.Should().BeTrue();
        mockTelegram.Verify(t => t.SendLowStockAlertAsync(store.TelegramChatId, store.Name, Moq.It.IsAny<List<LowStockAlertResponse>>(), Moq.It.IsAny<CancellationToken>()), Moq.Times.Once);
        mockEmail.Verify(e => e.SendBatchLowStockAlertEmailAsync(store.ManagerEmail, store.Name, Moq.It.IsAny<List<LowStockAlertResponse>>(), Moq.It.IsAny<CancellationToken>()), Moq.Times.Once);
    }
}
