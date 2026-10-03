using Microsoft.Extensions.DependencyInjection;

namespace Franchise.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        // Sau này đăng ký MediatR, AutoMapper, FluentValidation tại đây
        return services;
    }
}
