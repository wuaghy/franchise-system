using FluentAssertions;
using Franchise.Application.DTOs.SupplyChain;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Franchise.Domain.Exceptions;
using Franchise.Infrastructure.Data;
using Franchise.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Franchise.UnitTests.Services;

public class SupplyChainServiceTests
{
    private AppDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private async Task<(Warehouse warehouse, Store store, Ingredient coffee, Ingredient milk)> SeedDataAsync(AppDbContext context)
    {
        var warehouse = new Warehouse
        {
            Id = Guid.NewGuid(),
            Code = "WH-CENTRAL-01",
            Name = "Kho Tổng Trung Tâm Miền Nam",
            Address = "TP. HCM",
            ContactPhone = "19006868",
            IsActive = true
        };
        context.Warehouses.Add(warehouse);

        var store = new Store
        {
            Id = Guid.NewGuid(),
            Code = "STR-Q1-01",
            Name = "Franchise Store Quận 1",
            Address = "123 Lê Lợi, Q1, TP.HCM",
            IsActive = true
        };
        context.Stores.Add(store);

        var coffee = new Ingredient
        {
            Id = Guid.NewGuid(),
            Code = "ING-CF-01",
            Name = "Cà phê Robusta Hạt",
            Unit = "kg",
            StandardCost = 120000
        };
        var milk = new Ingredient
        {
            Id = Guid.NewGuid(),
            Code = "ING-MK-01",
            Name = "Sữa đặc Ngôi Sao",
            Unit = "lon",
            StandardCost = 25000
        };
        context.Ingredients.AddRange(coffee, milk);

        // Kho tổng ban đầu có 100kg cà phê và 200 lon sữa
        context.WarehouseInventories.AddRange(
            new WarehouseInventory
            {
                WarehouseId = warehouse.Id,
                IngredientId = coffee.Id,
                CurrentStock = 100,
                SafetyStock = 20
            },
            new WarehouseInventory
            {
                WarehouseId = warehouse.Id,
                IngredientId = milk.Id,
                CurrentStock = 200,
                SafetyStock = 50
            }
        );

        await context.SaveChangesAsync();
        return (warehouse, store, coffee, milk);
    }

    [Fact]
    public async Task CreateTransferOrder_WhenValid_ShouldCreateDraftOrderWithAutoCode()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var (warehouse, store, coffee, milk) = await SeedDataAsync(context);
        var service = new SupplyChainService(context);

        var request = new CreateTransferOrderRequest(
            warehouse.Id,
            store.Id,
            "Yêu cầu nhập nguyên liệu tuần 42",
            new List<CreateTransferItemRequest>
            {
                new(coffee.Id, 20),
                new(milk.Id, 40)
            }
        );

        // Act
        var result = await service.CreateTransferOrderAsync(request, Guid.NewGuid());

        // Assert
        result.Should().NotBeNull();
        result.TransferCode.Should().StartWith("STO-");
        result.Status.Should().Be("Draft");
        result.Items.Should().HaveCount(2);
        result.Items.Should().Contain(i => i.IngredientId == coffee.Id && i.RequestedQuantity == 20);
    }

    [Fact]
    public async Task SubmitTransferOrder_WhenDraft_ShouldTransitionToSubmitted()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var (warehouse, store, coffee, _) = await SeedDataAsync(context);
        var service = new SupplyChainService(context);

        var order = await service.CreateTransferOrderAsync(
            new CreateTransferOrderRequest(warehouse.Id, store.Id, "Đơn nháp", new List<CreateTransferItemRequest> { new(coffee.Id, 10) }),
            Guid.NewGuid()
        );

        // Act
        var result = await service.SubmitTransferOrderAsync(order.Id, Guid.NewGuid());

        // Assert
        result.Status.Should().Be("Submitted");
    }

    [Fact]
    public async Task ApproveTransferOrder_WhenStockSufficient_ShouldTransitionToApproved()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var (warehouse, store, coffee, milk) = await SeedDataAsync(context);
        var service = new SupplyChainService(context);

        var order = await service.CreateTransferOrderAsync(
            new CreateTransferOrderRequest(warehouse.Id, store.Id, null, new List<CreateTransferItemRequest>
            {
                new(coffee.Id, 15),
                new(milk.Id, 30)
            }),
            Guid.NewGuid()
        );
        await service.SubmitTransferOrderAsync(order.Id, Guid.NewGuid());

        var approverId = Guid.NewGuid();
        var approveRequest = new ApproveTransferOrderRequest(new List<ApproveTransferItemDto>
        {
            new(coffee.Id, 15),
            new(milk.Id, 25) // HQ duyệt 25 lon thay vì 30
        });

        // Act
        var result = await service.ApproveTransferOrderAsync(order.Id, approveRequest, approverId);

        // Assert
        result.Status.Should().Be("Approved");
        result.ApprovedByUserId.Should().Be(approverId);
        result.Items.First(i => i.IngredientId == milk.Id).ApprovedQuantity.Should().Be(25);
    }

    [Fact]
    public async Task ApproveTransferOrder_WhenWarehouseStockInsufficient_ShouldThrowBusinessRuleException()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var (warehouse, store, coffee, _) = await SeedDataAsync(context);
        var service = new SupplyChainService(context);

        // Kho tổng chỉ có 100kg cà phê, nhưng yêu cầu và duyệt 150kg
        var order = await service.CreateTransferOrderAsync(
            new CreateTransferOrderRequest(warehouse.Id, store.Id, null, new List<CreateTransferItemRequest> { new(coffee.Id, 150) }),
            Guid.NewGuid()
        );
        await service.SubmitTransferOrderAsync(order.Id, Guid.NewGuid());

        var approveRequest = new ApproveTransferOrderRequest(new List<ApproveTransferItemDto> { new(coffee.Id, 150) });

        // Act
        var act = async () => await service.ApproveTransferOrderAsync(order.Id, approveRequest, Guid.NewGuid());

        // Assert
        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*Kho tổng không đủ tồn kho*");
    }

    [Fact]
    public async Task DispatchTransferOrder_WhenApproved_ShouldDeductWarehouseStockAndRecordTransaction()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var (warehouse, store, coffee, milk) = await SeedDataAsync(context);
        var service = new SupplyChainService(context);

        var order = await service.CreateTransferOrderAsync(
            new CreateTransferOrderRequest(warehouse.Id, store.Id, null, new List<CreateTransferItemRequest>
            {
                new(coffee.Id, 20),
                new(milk.Id, 50)
            }),
            Guid.NewGuid()
        );
        await service.SubmitTransferOrderAsync(order.Id, Guid.NewGuid());
        await service.ApproveTransferOrderAsync(order.Id, new ApproveTransferOrderRequest(new List<ApproveTransferItemDto>
        {
            new(coffee.Id, 20),
            new(milk.Id, 50)
        }), Guid.NewGuid());

        // Act
        var dispatchResult = await service.DispatchTransferOrderAsync(
            order.Id,
            new DispatchTransferOrderRequest("VNPOST-9923841"),
            Guid.NewGuid()
        );

        // Assert
        dispatchResult.Status.Should().Be("Dispatched");
        dispatchResult.DispatchTrackingNumber.Should().Be("VNPOST-9923841");

        // Kiểm tra tồn kho kho tổng bị trừ (100 - 20 = 80kg cà phê, 200 - 50 = 150 lon sữa)
        var coffeeInv = await context.WarehouseInventories.FirstAsync(wi => wi.IngredientId == coffee.Id);
        coffeeInv.CurrentStock.Should().Be(80);

        var milkInv = await context.WarehouseInventories.FirstAsync(wi => wi.IngredientId == milk.Id);
        milkInv.CurrentStock.Should().Be(150);

        // Kiểm tra sổ cái kho tổng
        var transactions = await context.WarehouseInventoryTransactions.Where(t => t.WarehouseId == warehouse.Id).ToListAsync();
        transactions.Should().HaveCount(2);
        transactions.Should().AllSatisfy(t => t.TransactionType.Should().Be(WarehouseTransactionType.TransferDispatch));
    }

    [Fact]
    public async Task ReceiveTransferOrder_WhenExactQuantitiesReceived_ShouldCreditStoreInventoryAndSetReceived()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var (warehouse, store, coffee, milk) = await SeedDataAsync(context);
        var service = new SupplyChainService(context);

        var order = await service.CreateTransferOrderAsync(
            new CreateTransferOrderRequest(warehouse.Id, store.Id, null, new List<CreateTransferItemRequest>
            {
                new(coffee.Id, 10),
                new(milk.Id, 20)
            }),
            Guid.NewGuid()
        );
        await service.SubmitTransferOrderAsync(order.Id, Guid.NewGuid());
        await service.ApproveTransferOrderAsync(order.Id, new ApproveTransferOrderRequest(new List<ApproveTransferItemDto>
        {
            new(coffee.Id, 10),
            new(milk.Id, 20)
        }), Guid.NewGuid());
        await service.DispatchTransferOrderAsync(order.Id, new DispatchTransferOrderRequest("TRACK-123"), Guid.NewGuid());

        // Act: Nhận đủ 10kg cà phê và 20 lon sữa
        var receiveResult = await service.ReceiveTransferOrderAsync(
            order.Id,
            new ReceiveTransferOrderRequest(new List<ReceiveTransferItemDto>
            {
                new(coffee.Id, 10),
                new(milk.Id, 20)
            }, "Kiểm tra hàng nguyên đai nguyên kiện"),
            Guid.NewGuid()
        );

        // Assert
        receiveResult.Status.Should().Be("Received");

        // Kiểm tra kho chi nhánh được cộng
        var storeCoffee = await context.StoreInventories.FirstOrDefaultAsync(si => si.StoreId == store.Id && si.IngredientId == coffee.Id);
        storeCoffee.Should().NotBeNull();
        storeCoffee!.CurrentStock.Should().Be(10);

        var storeMilk = await context.StoreInventories.FirstOrDefaultAsync(si => si.StoreId == store.Id && si.IngredientId == milk.Id);
        storeMilk.Should().NotBeNull();
        storeMilk!.CurrentStock.Should().Be(20);

        // Kiểm tra sổ cái giao dịch điểm bán
        var storeTx = await context.InventoryTransactions.Where(tx => tx.StoreId == store.Id).ToListAsync();
        storeTx.Should().HaveCount(2);
        storeTx.Should().AllSatisfy(tx => tx.TransactionType.Should().Be(InventoryTransactionType.Inbound_HQ));
    }

    [Fact]
    public async Task ReceiveTransferOrder_WhenDiscrepancyFound_ShouldSetDiscrepancyReportedAndCreditActualOnly()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var (warehouse, store, coffee, milk) = await SeedDataAsync(context);
        var service = new SupplyChainService(context);

        var order = await service.CreateTransferOrderAsync(
            new CreateTransferOrderRequest(warehouse.Id, store.Id, null, new List<CreateTransferItemRequest>
            {
                new(coffee.Id, 10),
                new(milk.Id, 20)
            }),
            Guid.NewGuid()
        );
        await service.SubmitTransferOrderAsync(order.Id, Guid.NewGuid());
        await service.ApproveTransferOrderAsync(order.Id, new ApproveTransferOrderRequest(new List<ApproveTransferItemDto>
        {
            new(coffee.Id, 10),
            new(milk.Id, 20)
        }), Guid.NewGuid());
        await service.DispatchTransferOrderAsync(order.Id, new DispatchTransferOrderRequest("TRACK-123"), Guid.NewGuid());

        // Act: Nhận thực tế cà phê 10 (đủ), sữa 18 (thiếu 2 lon do vỡ)
        var receiveResult = await service.ReceiveTransferOrderAsync(
            order.Id,
            new ReceiveTransferOrderRequest(new List<ReceiveTransferItemDto>
            {
                new(coffee.Id, 10),
                new(milk.Id, 18)
            }, "Vỡ 2 lon sữa khi vận chuyển"),
            Guid.NewGuid()
        );

        // Assert
        receiveResult.Status.Should().Be("DiscrepancyReported");
        receiveResult.DiscrepancyNotes.Should().Contain("Vỡ 2 lon sữa");

        var milkItem = receiveResult.Items.First(i => i.IngredientId == milk.Id);
        milkItem.ActualReceivedQuantity.Should().Be(18);
        milkItem.DiscrepancyQuantity.Should().Be(2);

        // Kho chi nhánh chỉ được cộng đúng 18 lon sữa thực nhận
        var storeMilk = await context.StoreInventories.FirstOrDefaultAsync(si => si.StoreId == store.Id && si.IngredientId == milk.Id);
        storeMilk!.CurrentStock.Should().Be(18);
    }

    [Fact]
    public async Task InboundWarehouseStock_WhenSupplierDelivers_ShouldIncreaseCentralWarehouseStock()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var (warehouse, _, coffee, _) = await SeedDataAsync(context);
        var service = new SupplyChainService(context);

        var inboundRequest = new WarehouseInboundRequest(
            warehouse.Id,
            "SUPPLIER-ROBUSTA-VN",
            "PO-2026-0099",
            "Nhập lô cà phê mới từ Đắk Lắk",
            new List<WarehouseInboundItemRequest>
            {
                new(coffee.Id, 200, 125000)
            }
        );

        // Act
        var result = await service.InboundWarehouseStockAsync(inboundRequest, Guid.NewGuid());

        // Assert
        result.Should().NotBeNull();
        var coffeeInv = result.First(i => i.IngredientId == coffee.Id);
        coffeeInv.CurrentStock.Should().Be(300); // 100 ban đầu + 200 nhập mới

        var tx = await context.WarehouseInventoryTransactions.FirstOrDefaultAsync(t => t.ReferenceNumber == "PO-2026-0099");
        tx.Should().NotBeNull();
        tx!.TransactionType.Should().Be(WarehouseTransactionType.SupplierInbound);
        tx.QuantityChange.Should().Be(200);
    }
}
