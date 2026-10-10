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

    [Fact]
    public async Task ExecuteFullStoLifecycle_ManagerQ1AndSupplyChain_CoffeeTransferLoop_ShouldSucceedAndBalanceCorrectly()
    {
        // Kịch bản hoàn chỉnh đa vai trò:
        // 1. manager_q1 tạo đơn đề xuất xin 20kg cà phê Arabica từ kho tổng -> Trình duyệt (Submitted)
        // 2. supply_chain duyệt đơn 20kg (Approved) -> Xuất kho kèm mã vận đơn VNPost (Dispatched) -> Khấu trừ kho tổng
        // 3. manager_q1 nghiệm thu nhận hàng (Received) -> Tự động cộng tồn kho chi nhánh Q1

        // Arrange
        using var context = CreateInMemoryDbContext();
        var (warehouse, store, coffee, _) = await SeedDataAsync(context);
        var service = new SupplyChainService(context);

        var managerQ1UserId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var supplyChainUserId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

        // Đặt số lượng tồn kho thực tế ban đầu:
        // Kho tổng: 1,500,000 gram (1,500 kg)
        var whCoffee = await context.WarehouseInventories.FirstAsync(wi => wi.WarehouseId == warehouse.Id && wi.IngredientId == coffee.Id);
        whCoffee.CurrentStock = 1500000;

        // Chi nhánh Q1: 14,250 gram (14.25 kg)
        context.StoreInventories.Add(new StoreInventory
        {
            StoreId = store.Id,
            IngredientId = coffee.Id,
            CurrentStock = 14250,
            MinAlertThreshold = 5000,
            LastCountedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        // 20kg cà phê = 20,000 gram
        const decimal requestedCoffeeQty = 20000;

        // BƯỚC 1: manager_q1 Tạo đơn đề xuất (Draft)
        var createRequest = new CreateTransferOrderRequest(
            warehouse.Id,
            store.Id,
            "Chi nhánh Q1 đề xuất xin cấp 20kg cà phê từ kho tổng cho tuần cao điểm",
            new List<CreateTransferItemRequest>
            {
                new(coffee.Id, requestedCoffeeQty, "Cà phê hạt pha máy Arabica")
            }
        );
        var draftOrder = await service.CreateTransferOrderAsync(createRequest, managerQ1UserId);
        draftOrder.Status.Should().Be("Draft");
        draftOrder.CreatedByUserId.Should().Be(managerQ1UserId);

        // BƯỚC 1 (tiếp): manager_q1 Trình duyệt đơn lên HQ (Submitted)
        var submittedOrder = await service.SubmitTransferOrderAsync(draftOrder.Id, managerQ1UserId);
        submittedOrder.Status.Should().Be("Submitted");

        // BƯỚC 2: supply_chain Duyệt đơn (Approved)
        var approveRequest = new ApproveTransferOrderRequest(new List<ApproveTransferItemDto>
        {
            new(coffee.Id, requestedCoffeeQty)
        }, "HQ Supply Chain phê duyệt xuất kho đúng 20kg cà phê");
        var approvedOrder = await service.ApproveTransferOrderAsync(submittedOrder.Id, approveRequest, supplyChainUserId);
        approvedOrder.Status.Should().Be("Approved");
        approvedOrder.ApprovedByUserId.Should().Be(supplyChainUserId);

        // BƯỚC 2 (tiếp): supply_chain Xuất kho kèm mã vận đơn VNPost (Dispatched)
        var dispatchRequest = new DispatchTransferOrderRequest("VNPOST-8839210", "Giao qua bưu điện VNPost Express xe số SG-8291");
        var dispatchedOrder = await service.DispatchTransferOrderAsync(approvedOrder.Id, dispatchRequest, supplyChainUserId);
        dispatchedOrder.Status.Should().Be("Dispatched");
        dispatchedOrder.DispatchTrackingNumber.Should().Be("VNPOST-8839210");

        // Kiểm tra tồn kho kho tổng bị khấu trừ chính xác: 1,500,000 - 20,000 = 1,480,000 gram
        var whCoffeeAfter = await context.WarehouseInventories.FirstAsync(wi => wi.WarehouseId == warehouse.Id && wi.IngredientId == coffee.Id);
        whCoffeeAfter.CurrentStock.Should().Be(1480000);

        // Kiểm tra sổ cái giao dịch xuất kho tổng
        var whTx = await context.WarehouseInventoryTransactions.FirstOrDefaultAsync(t => t.WarehouseId == warehouse.Id && t.ReferenceNumber == dispatchedOrder.TransferCode);
        whTx.Should().NotBeNull();
        whTx!.QuantityChange.Should().Be(-requestedCoffeeQty);
        whTx.BalanceAfter.Should().Be(1480000);
        whTx.TransactionType.Should().Be(WarehouseTransactionType.TransferDispatch);

        // BƯỚC 3: manager_q1 Nghiệm thu nhận hàng tại Chi nhánh Q1 (Received)
        var receiveRequest = new ReceiveTransferOrderRequest(new List<ReceiveTransferItemDto>
        {
            new(coffee.Id, requestedCoffeeQty, "Hàng nhận đủ 20kg bao bì nguyên vẹn")
        }, "Đã cân kiểm tra tại quầy, đủ 20kg cà phê");
        var receivedOrder = await service.ReceiveTransferOrderAsync(dispatchedOrder.Id, receiveRequest, managerQ1UserId);
        receivedOrder.Status.Should().Be("Received");
        receivedOrder.DiscrepancyNotes.Should().Be("Đã cân kiểm tra tại quầy, đủ 20kg cà phê");

        // Tồn kho chi nhánh Q1 được tự động cộng thêm: 14,250 + 20,000 = 34,250 gram
        var storeCoffeeAfter = await context.StoreInventories.FirstAsync(si => si.StoreId == store.Id && si.IngredientId == coffee.Id);
        storeCoffeeAfter.CurrentStock.Should().Be(34250);

        // Kiểm tra sổ cái giao dịch nhập hàng chi nhánh Q1
        var storeTx = await context.InventoryTransactions.FirstOrDefaultAsync(t => t.StoreId == store.Id && t.TransactionType == InventoryTransactionType.Inbound_HQ);
        storeTx.Should().NotBeNull();
        storeTx!.QuantityChange.Should().Be(requestedCoffeeQty);
        storeTx.BalanceAfter.Should().Be(34250);
        storeTx.Note.Should().Contain(dispatchedOrder.TransferCode);
    }

    [Fact]
    public async Task GetAutoReorderSuggestions_ShouldRecommendAccurateQuantities_BasedOnUsageAndThresholds()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var (warehouse, store, coffee, milk) = await SeedDataAsync(context);

        // Store current stock:
        // Cà phê = 2kg (dưới min threshold 10kg)
        // Sữa đặc = 50 lon (trên min threshold 20 lon)
        context.StoreInventories.AddRange(
            new StoreInventory { StoreId = store.Id, IngredientId = coffee.Id, CurrentStock = 2, MinAlertThreshold = 10 },
            new StoreInventory { StoreId = store.Id, IngredientId = milk.Id, CurrentStock = 50, MinAlertThreshold = 20 }
        );

        // Giả lập tiêu hao trong 14 ngày qua:
        // Cà phê: bán 28kg trong 14 ngày -> trung bình 2kg/ngày
        // Sữa: bán 14 lon trong 14 ngày -> trung bình 1 lon/ngày
        context.InventoryTransactions.AddRange(
            new InventoryTransaction
            {
                StoreId = store.Id,
                IngredientId = coffee.Id,
                TransactionType = InventoryTransactionType.Outbound_Sale,
                QuantityChange = -28,
                CreatedAt = DateTime.UtcNow.AddDays(-5)
            },
            new InventoryTransaction
            {
                StoreId = store.Id,
                IngredientId = milk.Id,
                TransactionType = InventoryTransactionType.Outbound_Sale,
                QuantityChange = -14,
                CreatedAt = DateTime.UtcNow.AddDays(-3)
            }
        );

        await context.SaveChangesAsync();

        var service = new SupplyChainService(context);

        // Act: Dự trù 7 ngày an toàn + 2 ngày lead time = 9 ngày chu kỳ
        // Cà phê: Nhu cầu = max(10, 2kg * 9 ngày = 18kg). Hiện có: 2kg -> Cần đặt: 18 - 2 = 16kg
        // Sữa: Nhu cầu = max(20, 1 lon * 9 ngày = 9 lon) = 20 lon. Hiện có: 50 lon -> Đã đủ tồn kho
        var result = await service.GetAutoReorderSuggestionsAsync(store.Id, planningDays: 7, leadTimeDays: 2);

        // Assert
        result.StoreId.Should().Be(store.Id);
        result.TotalItemsEvaluated.Should().Be(2);
        result.ItemsNeedingReorderCount.Should().BeGreaterThanOrEqualTo(1);

        var coffeeSuggestion = result.Suggestions.FirstOrDefault(s => s.IngredientId == coffee.Id);
        coffeeSuggestion.Should().NotBeNull();
        coffeeSuggestion!.Priority.Should().Be("Warning");
        coffeeSuggestion.AverageDailyConsumption.Should().Be(2.0m);
        coffeeSuggestion.RecommendedOrderQuantity.Should().Be(16m);
        coffeeSuggestion.EstimatedTotalCost.Should().Be(16m * 120000m); // 1,920,000 đ
    }

    [Fact]
    public async Task GetSupplyChainKpis_ShouldCalculateLeadTimesAndSlaMetricsAccurately()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var (warehouse, store, coffee, _) = await SeedDataAsync(context);

        var now = DateTime.UtcNow;

        // Order 1: Hoàn tất đúng hạn trong 24 giờ
        var order1 = new StockTransferOrder
        {
            TransferCode = "STO-202610-0001",
            SourceWarehouseId = warehouse.Id,
            DestinationStoreId = store.Id,
            Status = TransferStatus.Received,
            CreatedAt = now.AddHours(-24),
            ApprovedAt = now.AddHours(-20), // 4h duyệt
            DispatchedAt = now.AddHours(-16), // 4h xuất kho
            ReceivedAt = now, // 16h vận chuyển -> Tổng = 24h (<= 48h SLA)
        };

        // Order 2: Đang trên đường vận chuyển (Dispatched)
        var order2 = new StockTransferOrder
        {
            TransferCode = "STO-202610-0002",
            SourceWarehouseId = warehouse.Id,
            DestinationStoreId = store.Id,
            Status = TransferStatus.Dispatched,
            CreatedAt = now.AddHours(-10),
            ApprovedAt = now.AddHours(-8),
            DispatchedAt = now.AddHours(-5),
        };

        // Order 3: Có lệch hao hụt (DiscrepancyReported)
        var order3 = new StockTransferOrder
        {
            TransferCode = "STO-202610-0003",
            SourceWarehouseId = warehouse.Id,
            DestinationStoreId = store.Id,
            Status = TransferStatus.DiscrepancyReported,
            CreatedAt = now.AddHours(-30),
            ApprovedAt = now.AddHours(-25),
            DispatchedAt = now.AddHours(-20),
            ReceivedAt = now.AddHours(-2), // 18h vận chuyển -> Tổng = 28h (<= 48h SLA)
        };

        context.StockTransferOrders.AddRange(order1, order2, order3);
        await context.SaveChangesAsync();

        var service = new SupplyChainService(context);

        // Act
        var kpis = await service.GetSupplyChainKpisAsync();

        // Assert
        kpis.TotalOrdersCreated.Should().Be(3);
        kpis.TotalOrdersCompleted.Should().Be(2); // order1 & order3
        kpis.InTransitOrdersCount.Should().Be(1); // order2
        kpis.DiscrepancyReportedCount.Should().Be(1); // order3
        kpis.OverallOnTimeDeliveryRate.Should().Be(100.0); // cả 2 đơn hoàn tất đều <= 48h
        kpis.SystemAvgTransitHours.Should().Be(17.0); // (16 + 18) / 2 = 17.0h
        kpis.SystemAvgTotalCycleHours.Should().Be(26.0); // (24 + 28) / 2 = 26.0h

        kpis.StoreKpis.Should().HaveCount(1);
        var storeKpi = kpis.StoreKpis.First();
        storeKpi.StoreId.Should().Be(store.Id);
        storeKpi.CompletedOrders.Should().Be(2);
        storeKpi.AvgTransitHours.Should().Be(17.0);
        storeKpi.AvgTotalCycleHours.Should().Be(26.0);
        storeKpi.OnTimeDeliveryRate.Should().Be(100.0);
        storeKpi.DiscrepancyOrdersCount.Should().Be(1);
    }
}


