using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Franchise.Infrastructure.Data;

namespace Franchise.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection");

        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(connectionString));

        services.AddScoped<Franchise.Application.Common.Interfaces.IInventoryService, Services.InventoryService>();
        services.AddScoped<Franchise.Application.Common.Interfaces.IOrderService, Services.OrderService>();
        services.AddScoped<Franchise.Application.Common.Interfaces.IPasswordHasher, Auth.PasswordHasher>();
        services.AddScoped<Franchise.Application.Common.Interfaces.IJwtTokenGenerator, Auth.JwtTokenGenerator>();
        services.AddScoped<Franchise.Application.Common.Interfaces.IAuthService, Services.AuthService>();
        services.AddScoped<Franchise.Application.Common.Interfaces.ICostingService, Services.CostingService>();
        services.AddScoped<Franchise.Application.Common.Interfaces.ISupplyChainService, Services.SupplyChainService>();
        services.AddScoped<Franchise.Application.Common.Interfaces.IKitchenDisplayService, Services.KitchenDisplayService>();
        services.AddHostedService<BackgroundJobs.OutboxProcessorBackgroundService>();

        return services;
    }
}
