using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Franchise.Api.Authorization;

public class StoreAccessRequirement : IAuthorizationRequirement
{
}

public class StoreAccessAuthorizationHandler : AuthorizationHandler<StoreAccessRequirement>
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public StoreAccessAuthorizationHandler(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        StoreAccessRequirement requirement)
    {
        var user = context.User;
        if (user.Identity?.IsAuthenticated != true)
        {
            return Task.CompletedTask;
        }

        // HQ SuperAdmin và Supply Chain Officer có quyền truy cập thông tin chi nhánh
        var role = user.FindFirst(ClaimTypes.Role)?.Value ?? user.FindFirst("role")?.Value;
        if (role is "HQ_SuperAdmin" or "Supply_Chain_Officer")
        {
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext == null)
        {
            return Task.CompletedTask;
        }

        // Lấy storeId từ Route Value (ví dụ: /api/stores/{storeId}/...) hoặc Query param (?storeId=...)
        var routeStoreIdStr = httpContext.GetRouteValue("storeId")?.ToString();
        if (string.IsNullOrEmpty(routeStoreIdStr) && httpContext.Request.Query.ContainsKey("storeId"))
        {
            routeStoreIdStr = httpContext.Request.Query["storeId"].ToString();
        }

        var userStoreId = user.FindFirst("store_id")?.Value;

        if (!string.IsNullOrEmpty(routeStoreIdStr) && !string.IsNullOrEmpty(userStoreId))
        {
            if (string.Equals(routeStoreIdStr, userStoreId, StringComparison.OrdinalIgnoreCase))
            {
                context.Succeed(requirement);
                return Task.CompletedTask;
            }
        }

        return Task.CompletedTask;
    }
}
