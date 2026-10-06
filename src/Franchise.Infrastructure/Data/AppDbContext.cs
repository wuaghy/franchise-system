using Microsoft.EntityFrameworkCore;
using Franchise.Domain.Entities;

namespace Franchise.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    // 1. Phân hệ Tổ chức & Chi nhánh
    public DbSet<Franchisee> Franchisees => Set<Franchisee>();
    public DbSet<Store> Stores => Set<Store>();
    public DbSet<StoreUser> StoreUsers => Set<StoreUser>();
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    // 2. Phân hệ Sản phẩm & Định lượng (Recipe/BoM)
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<StoreProductPrice> StoreProductPrices => Set<StoreProductPrice>();
    public DbSet<Ingredient> Ingredients => Set<Ingredient>();
    public DbSet<ProductRecipe> ProductRecipes => Set<ProductRecipe>();

    // 3. Phân hệ Kho & Chuỗi cung ứng
    public DbSet<StoreInventory> StoreInventories => Set<StoreInventory>();
    public DbSet<InventoryTransaction> InventoryTransactions => Set<InventoryTransaction>();
    public DbSet<Warehouse> Warehouses => Set<Warehouse>();
    public DbSet<WarehouseInventory> WarehouseInventories => Set<WarehouseInventory>();
    public DbSet<WarehouseInventoryTransaction> WarehouseInventoryTransactions => Set<WarehouseInventoryTransaction>();
    public DbSet<StockTransferOrder> StockTransferOrders => Set<StockTransferOrder>();
    public DbSet<StockTransferItem> StockTransferItems => Set<StockTransferItem>();

    // 4. Phân hệ Khách hàng & Đơn hàng
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderItemModifier> OrderItemModifiers => Set<OrderItemModifier>();
    public DbSet<Payment> Payments => Set<Payment>();

    // 5. Phân hệ Outbox & Idempotency
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();
    public DbSet<IdempotencyRecord> IdempotencyRecords => Set<IdempotencyRecord>();

    // 6. Phân hệ Kitchen Display System (KDS) & Barista Queue
    public DbSet<KitchenTicket> KitchenTickets => Set<KitchenTicket>();
    public DbSet<KitchenTicketItem> KitchenTicketItems => Set<KitchenTicketItem>();
    public DbSet<KitchenTicketItemModifier> KitchenTicketItemModifiers => Set<KitchenTicketItemModifier>();

    // 7. Phân hệ Tài chính, Báo cáo & Phí Nhượng quyền (Royalty & Financial BI)
    public DbSet<RoyaltyInvoice> RoyaltyInvoices => Set<RoyaltyInvoice>();
    public DbSet<StoreRoyaltySetting> StoreRoyaltySettings => Set<StoreRoyaltySetting>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // --- 1. FRANCHISE & STORE ---
        modelBuilder.Entity<Franchisee>(b =>
        {
            b.HasKey(e => e.Id);
            b.Property(e => e.CompanyName).IsRequired().HasMaxLength(200);
            b.Property(e => e.TaxCode).IsRequired().HasMaxLength(50);
            b.Property(e => e.RevenueSharePercentage).HasPrecision(5, 2);
        });

        modelBuilder.Entity<Store>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => e.Code).IsUnique();
            b.Property(e => e.Code).IsRequired().HasMaxLength(50);
            b.Property(e => e.Name).IsRequired().HasMaxLength(200);
            b.Property(e => e.Address).HasMaxLength(500);
            b.Property(e => e.PhoneNumber).HasMaxLength(20);
            b.Property(e => e.Latitude).HasPrecision(9, 6);
            b.Property(e => e.Longitude).HasPrecision(9, 6);

            b.HasOne(e => e.Franchisee)
                .WithMany(f => f.Stores)
                .HasForeignKey(e => e.FranchiseeId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<StoreUser>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => e.Username).IsUnique();
            b.Property(e => e.Username).IsRequired().HasMaxLength(50);
            b.Property(e => e.FullName).IsRequired().HasMaxLength(100);
            b.Property(e => e.Role).HasConversion<string>().HasMaxLength(30);

            b.HasOne(e => e.Store)
                .WithMany(s => s.StoreUsers)
                .HasForeignKey(e => e.StoreId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<User>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => e.Username).IsUnique();
            b.HasIndex(e => e.Email).IsUnique();
            b.Property(e => e.Username).IsRequired().HasMaxLength(50);
            b.Property(e => e.Email).IsRequired().HasMaxLength(150);
            b.Property(e => e.PasswordHash).IsRequired().HasMaxLength(255);
            b.Property(e => e.FullName).IsRequired().HasMaxLength(150);
            b.Property(e => e.Role).HasConversion<string>().HasMaxLength(40);

            b.HasOne(e => e.Store)
                .WithMany(s => s.Users)
                .HasForeignKey(e => e.StoreId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(e => e.Franchisee)
                .WithMany(f => f.Users)
                .HasForeignKey(e => e.FranchiseeId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<RefreshToken>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => e.Token).IsUnique();
            b.Property(e => e.Token).IsRequired().HasMaxLength(255);
            b.Property(e => e.ReplacedByToken).HasMaxLength(255);

            b.HasOne(e => e.User)
                .WithMany(u => u.RefreshTokens)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // --- 2. CATALOG & RECIPE ---
        modelBuilder.Entity<Category>(b =>
        {
            b.HasKey(e => e.Id);
            b.Property(e => e.Name).IsRequired().HasMaxLength(100);
        });

        modelBuilder.Entity<Product>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => e.Sku).IsUnique();
            b.Property(e => e.Sku).IsRequired().HasMaxLength(50);
            b.Property(e => e.Name).IsRequired().HasMaxLength(200);
            b.Property(e => e.BasePrice).HasPrecision(18, 2);

            b.HasOne(e => e.Category)
                .WithMany(c => c.Products)
                .HasForeignKey(e => e.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<StoreProductPrice>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => new { e.StoreId, e.ProductId }).IsUnique();
            b.Property(e => e.CustomPrice).HasPrecision(18, 2);

            b.HasOne(e => e.Store)
                .WithMany(s => s.StoreProductPrices)
                .HasForeignKey(e => e.StoreId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(e => e.Product)
                .WithMany(p => p.StoreProductPrices)
                .HasForeignKey(e => e.ProductId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Ingredient>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => e.Code).IsUnique();
            b.Property(e => e.Code).IsRequired().HasMaxLength(50);
            b.Property(e => e.Name).IsRequired().HasMaxLength(200);
            b.Property(e => e.Unit).IsRequired().HasMaxLength(20);
            b.Property(e => e.StandardCost).HasPrecision(18, 4);
        });

        modelBuilder.Entity<ProductRecipe>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => new { e.ProductId, e.IngredientId }).IsUnique();
            b.Property(e => e.Quantity).HasPrecision(12, 4);

            b.HasOne(e => e.Product)
                .WithMany(p => p.Recipes)
                .HasForeignKey(e => e.ProductId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(e => e.Ingredient)
                .WithMany(i => i.ProductRecipes)
                .HasForeignKey(e => e.IngredientId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // --- 3. INVENTORY & SUPPLY CHAIN ---
        modelBuilder.Entity<StoreInventory>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => new { e.StoreId, e.IngredientId }).IsUnique();
            b.Property(e => e.CurrentStock).HasPrecision(12, 4);
            b.Property(e => e.MinAlertThreshold).HasPrecision(12, 4);

            b.HasOne(e => e.Store)
                .WithMany(s => s.StoreInventories)
                .HasForeignKey(e => e.StoreId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(e => e.Ingredient)
                .WithMany(i => i.StoreInventories)
                .HasForeignKey(e => e.IngredientId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<InventoryTransaction>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => new { e.StoreId, e.CreatedAt });
            b.Property(e => e.TransactionType).HasConversion<string>().HasMaxLength(30);
            b.Property(e => e.QuantityChange).HasPrecision(12, 4);
            b.Property(e => e.BalanceAfter).HasPrecision(12, 4);
            b.Property(e => e.Note).HasMaxLength(255);

            b.HasOne(e => e.Store)
                .WithMany()
                .HasForeignKey(e => e.StoreId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(e => e.Ingredient)
                .WithMany(i => i.InventoryTransactions)
                .HasForeignKey(e => e.IngredientId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // --- 4. CUSTOMER, ORDER & PAYMENT ---
        modelBuilder.Entity<Customer>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => e.PhoneNumber).IsUnique();
            b.Property(e => e.PhoneNumber).IsRequired().HasMaxLength(20);
            b.Property(e => e.FullName).IsRequired().HasMaxLength(100);
            b.Property(e => e.MemberTier).HasConversion<string>().HasMaxLength(20);
        });

        modelBuilder.Entity<Order>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => e.OrderNumber).IsUnique();
            b.HasIndex(e => new { e.StoreId, e.CreatedAt }); // Composite Index báo cáo ca/ngày
            b.Property(e => e.OrderNumber).IsRequired().HasMaxLength(50);
            b.Property(e => e.OrderType).HasConversion<string>().HasMaxLength(20);
            b.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
            b.Property(e => e.Subtotal).HasPrecision(18, 2);
            b.Property(e => e.DiscountAmount).HasPrecision(18, 2);
            b.Property(e => e.VatAmount).HasPrecision(18, 2);
            b.Property(e => e.FinalAmount).HasPrecision(18, 2);

            b.HasOne(e => e.Store)
                .WithMany(s => s.Orders)
                .HasForeignKey(e => e.StoreId)
                .OnDelete(DeleteBehavior.Restrict); // Không xóa đơn khi xóa store

            b.HasOne(e => e.Customer)
                .WithMany(c => c.Orders)
                .HasForeignKey(e => e.CustomerId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(e => e.Cashier)
                .WithMany()
                .HasForeignKey(e => e.CashierId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<OrderItem>(b =>
        {
            b.HasKey(e => e.Id);
            b.Property(e => e.UnitPrice).HasPrecision(18, 2);
            b.Property(e => e.TotalPrice).HasPrecision(18, 2);
            b.Property(e => e.SpecialNote).HasMaxLength(255);

            b.HasOne(e => e.Order)
                .WithMany(o => o.OrderItems)
                .HasForeignKey(e => e.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(e => e.Product)
                .WithMany(p => p.OrderItems)
                .HasForeignKey(e => e.ProductId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<OrderItemModifier>(b =>
        {
            b.HasKey(e => e.Id);
            b.Property(e => e.Name).IsRequired().HasMaxLength(100);
            b.Property(e => e.ExtraPrice).HasPrecision(18, 2);
            b.Property(e => e.ConsumptionQuantity).HasPrecision(12, 4);

            b.HasOne(e => e.OrderItem)
                .WithMany(oi => oi.Modifiers)
                .HasForeignKey(e => e.OrderItemId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(e => e.Ingredient)
                .WithMany()
                .HasForeignKey(e => e.IngredientId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Payment>(b =>
        {
            b.HasKey(e => e.Id);
            b.Property(e => e.PaymentMethod).HasConversion<string>().HasMaxLength(30);
            b.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
            b.Property(e => e.Amount).HasPrecision(18, 2);
            b.Property(e => e.TransactionReference).HasMaxLength(100);

            b.HasOne(e => e.Order)
                .WithMany(o => o.Payments)
                .HasForeignKey(e => e.OrderId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // --- 5. RESILIENCY & AUDIT ---
        modelBuilder.Entity<OutboxMessage>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => new { e.ProcessedAt, e.CreatedAt });
            b.Property(e => e.AggregateType).IsRequired().HasMaxLength(50);
            b.Property(e => e.AggregateId).IsRequired().HasMaxLength(50);
            b.Property(e => e.EventType).IsRequired().HasMaxLength(100);
            b.Property(e => e.Payload).IsRequired(); // JSON
        });

        modelBuilder.Entity<IdempotencyRecord>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => e.IdempotencyKey).IsUnique();
            b.Property(e => e.IdempotencyKey).IsRequired().HasMaxLength(100);
            b.Property(e => e.ResponsePayload).IsRequired();
        });

        // --- 6. SUPPLY CHAIN, WAREHOUSE & TRANSFERS ---
        modelBuilder.Entity<Warehouse>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => e.Code).IsUnique();
            b.Property(e => e.Code).IsRequired().HasMaxLength(50);
            b.Property(e => e.Name).IsRequired().HasMaxLength(200);
            b.Property(e => e.Address).HasMaxLength(500);
            b.Property(e => e.ContactPhone).HasMaxLength(50);
        });

        modelBuilder.Entity<WarehouseInventory>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => new { e.WarehouseId, e.IngredientId }).IsUnique();
            b.Property(e => e.CurrentStock).HasPrecision(18, 4);
            b.Property(e => e.SafetyStock).HasPrecision(18, 4);

            b.HasOne(e => e.Warehouse)
                .WithMany(w => w.Inventories)
                .HasForeignKey(e => e.WarehouseId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(e => e.Ingredient)
                .WithMany()
                .HasForeignKey(e => e.IngredientId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<WarehouseInventoryTransaction>(b =>
        {
            b.HasKey(e => e.Id);
            b.Property(e => e.QuantityChange).HasPrecision(18, 4);
            b.Property(e => e.BalanceAfter).HasPrecision(18, 4);
            b.Property(e => e.TransactionType).HasConversion<string>().HasMaxLength(50);
            b.Property(e => e.ReferenceNumber).HasMaxLength(100);
            b.Property(e => e.Note).HasMaxLength(500);

            b.HasOne(e => e.Warehouse)
                .WithMany()
                .HasForeignKey(e => e.WarehouseId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(e => e.Ingredient)
                .WithMany()
                .HasForeignKey(e => e.IngredientId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<StockTransferOrder>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => e.TransferCode).IsUnique();
            b.Property(e => e.TransferCode).IsRequired().HasMaxLength(50);
            b.Property(e => e.Status).HasConversion<string>().HasMaxLength(30);
            b.Property(e => e.DispatchTrackingNumber).HasMaxLength(100);
            b.Property(e => e.Notes).HasMaxLength(500);
            b.Property(e => e.RejectionReason).HasMaxLength(500);
            b.Property(e => e.DiscrepancyNotes).HasMaxLength(500);

            b.HasOne(e => e.SourceWarehouse)
                .WithMany(w => w.OutboundTransfers)
                .HasForeignKey(e => e.SourceWarehouseId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(e => e.DestinationStore)
                .WithMany()
                .HasForeignKey(e => e.DestinationStoreId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<StockTransferItem>(b =>
        {
            b.HasKey(e => e.Id);
            b.Property(e => e.RequestedQuantity).HasPrecision(18, 4);
            b.Property(e => e.ApprovedQuantity).HasPrecision(18, 4);
            b.Property(e => e.ActualReceivedQuantity).HasPrecision(18, 4);
            b.Property(e => e.UnitCost).HasPrecision(18, 2);
            b.Property(e => e.Notes).HasMaxLength(500);

            b.HasOne(e => e.TransferOrder)
                .WithMany(o => o.Items)
                .HasForeignKey(e => e.TransferOrderId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(e => e.Ingredient)
                .WithMany()
                .HasForeignKey(e => e.IngredientId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Seed Kho Tổng Trung Tâm HQ
        var centralWarehouseId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        modelBuilder.Entity<Warehouse>().HasData(
            new Warehouse
            {
                Id = centralWarehouseId,
                Code = "WH-CENTRAL-01",
                Name = "Kho Tổng Trung Tâm Miền Nam",
                Address = "Khu Công Nghiệp Tân Bình, P. Tây Thạnh, Q. Tân Phú, TP. HCM",
                ContactPhone = "1900 6868",
                IsActive = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );

        // --- 7. KITCHEN DISPLAY SYSTEM (KDS) ---
        modelBuilder.Entity<KitchenTicket>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => e.TicketNumber).IsUnique();
            b.Property(e => e.TicketNumber).IsRequired().HasMaxLength(50);
            b.Property(e => e.OrderNumber).IsRequired().HasMaxLength(50);
            b.Property(e => e.OrderType).HasConversion<string>().HasMaxLength(30);
            b.Property(e => e.Status).HasConversion<string>().HasMaxLength(30);
            b.Property(e => e.CancellationReason).HasMaxLength(500);

            b.HasOne(e => e.Store)
                .WithMany()
                .HasForeignKey(e => e.StoreId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(e => e.Order)
                .WithMany()
                .HasForeignKey(e => e.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<KitchenTicketItem>(b =>
        {
            b.HasKey(e => e.Id);
            b.Property(e => e.ProductName).IsRequired().HasMaxLength(200);
            b.Property(e => e.SpecialNote).HasMaxLength(500);

            b.HasOne(e => e.KitchenTicket)
                .WithMany(t => t.Items)
                .HasForeignKey(e => e.KitchenTicketId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<KitchenTicketItemModifier>(b =>
        {
            b.HasKey(e => e.Id);
            b.Property(e => e.ModifierName).IsRequired().HasMaxLength(200);

            b.HasOne(e => e.KitchenTicketItem)
                .WithMany(i => i.Modifiers)
                .HasForeignKey(e => e.KitchenTicketItemId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // --- 7. ROYALTY INVOICING & BI SETTINGS ---
        modelBuilder.Entity<StoreRoyaltySetting>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => e.StoreId).IsUnique();
            b.Property(e => e.RoyaltyRate).HasPrecision(5, 4);
            b.Property(e => e.MarketingFeeRate).HasPrecision(5, 4);
            b.Property(e => e.TechFeeFixedMonthly).HasPrecision(18, 2);

            b.HasOne(e => e.Store)
                .WithMany()
                .HasForeignKey(e => e.StoreId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<RoyaltyInvoice>(b =>
        {
            b.HasKey(e => e.Id);
            b.HasIndex(e => e.InvoiceNumber).IsUnique();
            b.HasIndex(e => new { e.StoreId, e.BillingYear, e.BillingMonth });
            b.Property(e => e.InvoiceNumber).IsRequired().HasMaxLength(50);
            b.Property(e => e.Status).HasConversion<string>().HasMaxLength(30);
            b.Property(e => e.GrossRevenue).HasPrecision(18, 2);
            b.Property(e => e.DiscountAmount).HasPrecision(18, 2);
            b.Property(e => e.NetRevenue).HasPrecision(18, 2);
            b.Property(e => e.RoyaltyRate).HasPrecision(5, 4);
            b.Property(e => e.RoyaltyFee).HasPrecision(18, 2);
            b.Property(e => e.MarketingFeeRate).HasPrecision(5, 4);
            b.Property(e => e.MarketingFee).HasPrecision(18, 2);
            b.Property(e => e.TechFee).HasPrecision(18, 2);
            b.Property(e => e.TotalDue).HasPrecision(18, 2);
            b.Property(e => e.PaymentReference).HasMaxLength(100);
            b.Property(e => e.CancellationReason).HasMaxLength(500);

            b.HasOne(e => e.Store)
                .WithMany()
                .HasForeignKey(e => e.StoreId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
