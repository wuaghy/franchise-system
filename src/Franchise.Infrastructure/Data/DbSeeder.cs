using Franchise.Application.Common.Interfaces;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Franchise.Infrastructure.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext context, IPasswordHasher passwordHasher, ILogger logger, CancellationToken ct = default)
    {
        try
        {
            // 1. Franchisee
            var franchisee = await context.Franchisees.FirstOrDefaultAsync(ct);
            if (franchisee == null)
            {
                franchisee = new Franchisee
                {
                    Id = Guid.Parse("11111111-1111-1111-1111-111111111111"),
                    CompanyName = "Enterprise Coffee & Tea Franchise Group Vietnam",
                    TaxCode = "0318999888",
                    RevenueSharePercentage = 5.0m,
                    CreatedAt = DateTime.UtcNow
                };
                context.Franchisees.Add(franchisee);
                await context.SaveChangesAsync(ct);
                logger.LogInformation("DbSeeder: Seeded default Franchisee.");
            }

            // 2. Stores
            var storeQ1Id = Guid.Parse("22222222-2222-2222-2222-222222222222");
            var storeL81Id = Guid.Parse("33333333-3333-3333-3333-333333333333");

            if (!await context.Stores.AnyAsync(s => s.Code == "STORE-Q1", ct))
            {
                var storeQ1 = new Store
                {
                    Id = storeQ1Id,
                    FranchiseeId = franchisee.Id,
                    Code = "STORE-Q1",
                    Name = "Chi nhánh Quận 1 (Flagship Store)",
                    Address = "12 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
                    PhoneNumber = "02838221234",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };
                context.Stores.Add(storeQ1);
            }

            if (!await context.Stores.AnyAsync(s => s.Code == "STORE-L81", ct))
            {
                var storeL81 = new Store
                {
                    Id = storeL81Id,
                    FranchiseeId = franchisee.Id,
                    Code = "STORE-L81",
                    Name = "Chi nhánh Landmark 81",
                    Address = "Tầng trệt Landmark 81, Vinhomes Central Park, Bình Thạnh, TP.HCM",
                    PhoneNumber = "02839995678",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };
                context.Stores.Add(storeL81);
            }
            await context.SaveChangesAsync(ct);

            // 3. Default Users (Admin, Manager Q1, Cashier Q1)
            var adminUser = await context.Users.FirstOrDefaultAsync(u => u.Username == "admin", ct);
            if (adminUser == null)
            {
                adminUser = new User
                {
                    Username = "admin",
                    Email = "admin@franchise.vn",
                    FullName = "HQ Super Admin",
                    PasswordHash = passwordHasher.HashPassword("Admin123!"),
                    Role = UserRole.HQ_SuperAdmin,
                    FranchiseeId = franchisee.Id,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };
                context.Users.Add(adminUser);
            }
            else
            {
                adminUser.PasswordHash = passwordHasher.HashPassword("Admin123!");
                adminUser.IsActive = true;
            }

            var managerUser = await context.Users.FirstOrDefaultAsync(u => u.Username == "manager_q1", ct);
            if (managerUser == null)
            {
                managerUser = new User
                {
                    Username = "manager_q1",
                    Email = "manager.q1@franchise.vn",
                    FullName = "Quản lý Chi nhánh Q1",
                    PasswordHash = passwordHasher.HashPassword("Manager123!"),
                    Role = UserRole.Store_Manager,
                    StoreId = storeQ1Id,
                    FranchiseeId = franchisee.Id,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };
                context.Users.Add(managerUser);
            }

            var cashierUser = await context.Users.FirstOrDefaultAsync(u => u.Username == "cashier_q1", ct);
            if (cashierUser == null)
            {
                cashierUser = new User
                {
                    Username = "cashier_q1",
                    Email = "cashier.q1@franchise.vn",
                    FullName = "Thu ngân Chi nhánh Q1",
                    PasswordHash = passwordHasher.HashPassword("Cashier123!"),
                    Role = UserRole.POS_Cashier,
                    StoreId = storeQ1Id,
                    FranchiseeId = franchisee.Id,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };
                context.Users.Add(cashierUser);
            }
            await context.SaveChangesAsync(ct);
            logger.LogInformation("DbSeeder: Seeded system accounts (admin, manager_q1, cashier_q1).");

            // 4. Categories & Sample Products
            if (!await context.Categories.AnyAsync(ct))
            {
                var catCoffee = new Category { Id = Guid.NewGuid(), Name = "Cà phê Phin & Pha máy", DisplayOrder = 1, CreatedAt = DateTime.UtcNow };
                var catTea = new Category { Id = Guid.NewGuid(), Name = "Trà Sen & Trà Trái Cây", DisplayOrder = 2, CreatedAt = DateTime.UtcNow };
                var catFreeze = new Category { Id = Guid.NewGuid(), Name = "Freeze Đá Xay", DisplayOrder = 3, CreatedAt = DateTime.UtcNow };
                var catBakery = new Category { Id = Guid.NewGuid(), Name = "Bánh Mì & Pastry", DisplayOrder = 4, CreatedAt = DateTime.UtcNow };

                context.Categories.AddRange(catCoffee, catTea, catFreeze, catBakery);
                await context.SaveChangesAsync(ct);

                var products = new List<Product>
                {
                    new() { Id = Guid.NewGuid(), CategoryId = catCoffee.Id, Sku = "CF-01", Name = "Phin Sữa Đá Đậm Đà", BasePrice = 29000, IsAvailable = true, CreatedAt = DateTime.UtcNow },
                    new() { Id = Guid.NewGuid(), CategoryId = catCoffee.Id, Sku = "CF-02", Name = "Bạc Xỉu Sữa Tươi 3 Tầng", BasePrice = 32000, IsAvailable = true, CreatedAt = DateTime.UtcNow },
                    new() { Id = Guid.NewGuid(), CategoryId = catCoffee.Id, Sku = "CF-03", Name = "Cà Phê Muối Xứ Huế", BasePrice = 35000, IsAvailable = true, CreatedAt = DateTime.UtcNow },
                    new() { Id = Guid.NewGuid(), CategoryId = catTea.Id, Sku = "TEA-01", Name = "Trà Sen Vàng Kem Cheese", BasePrice = 45000, IsAvailable = true, CreatedAt = DateTime.UtcNow },
                    new() { Id = Guid.NewGuid(), CategoryId = catTea.Id, Sku = "TEA-02", Name = "Trà Đào Cam Sả Tươi", BasePrice = 45000, IsAvailable = true, CreatedAt = DateTime.UtcNow },
                    new() { Id = Guid.NewGuid(), CategoryId = catFreeze.Id, Sku = "FRZ-01", Name = "Freeze Trà Xanh Thạch", BasePrice = 55000, IsAvailable = true, CreatedAt = DateTime.UtcNow },
                    new() { Id = Guid.NewGuid(), CategoryId = catBakery.Id, Sku = "BK-01", Name = "Bánh Mì Que Hải Phòng Cay", BasePrice = 19000, IsAvailable = true, CreatedAt = DateTime.UtcNow }
                };

                context.Products.AddRange(products);
                await context.SaveChangesAsync(ct);
                logger.LogInformation("DbSeeder: Seeded default Categories & Products.");
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "DbSeeder encountered an error during startup data seeding.");
        }
    }
}
