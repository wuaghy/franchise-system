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

    // 2. Phân hệ Sản phẩm & Định lượng (Recipe/BoM)
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<StoreProductPrice> StoreProductPrices => Set<StoreProductPrice>();
    public DbSet<Ingredient> Ingredients => Set<Ingredient>();
    public DbSet<ProductRecipe> ProductRecipes => Set<ProductRecipe>();

    // 3. Phân hệ Kho & Chuỗi cung ứng
    public DbSet<StoreInventory> StoreInventories => Set<StoreInventory>();
    public DbSet<InventoryTransaction> InventoryTransactions => Set<InventoryTransaction>();

    // 4. Phân hệ Khách hàng & Đơn hàng
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderItemModifier> OrderItemModifiers => Set<OrderItemModifier>();
    public DbSet<Payment> Payments => Set<Payment>();

    // 5. Phân hệ Outbox & Idempotency
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();
    public DbSet<IdempotencyRecord> IdempotencyRecords => Set<IdempotencyRecord>();

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

            b.HasOne(e => e.OrderItem)
                .WithMany(oi => oi.Modifiers)
                .HasForeignKey(e => e.OrderItemId)
                .OnDelete(DeleteBehavior.Cascade);
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
    }
}
