using System.Security.Claims;
using Franchise.Application.Common.Interfaces;
using Microsoft.AspNetCore.Http;

namespace Franchise.Api.Services;

public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    private ClaimsPrincipal? User => _httpContextAccessor.HttpContext?.User;

    public Guid? UserId
    {
        get
        {
            var idClaim = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User?.FindFirst("sub")?.Value;
            return Guid.TryParse(idClaim, out var id) ? id : null;
        }
    }

    public string? Username => User?.FindFirst(ClaimTypes.Name)?.Value;

    public string? Role => User?.FindFirst(ClaimTypes.Role)?.Value 
        ?? User?.FindFirst("role")?.Value;

    public Guid? StoreId
    {
        get
        {
            var storeClaim = User?.FindFirst("store_id")?.Value;
            return Guid.TryParse(storeClaim, out var id) ? id : null;
        }
    }

    public Guid? FranchiseeId
    {
        get
        {
            var fClaim = User?.FindFirst("franchisee_id")?.Value;
            return Guid.TryParse(fClaim, out var id) ? id : null;
        }
    }

    public bool IsSuperAdmin => Role is "HQ_SuperAdmin";
}
