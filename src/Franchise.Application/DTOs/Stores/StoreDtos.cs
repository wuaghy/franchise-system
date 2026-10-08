namespace Franchise.Application.DTOs.Stores;

public record StoreQueryParameters
{
    private const int MaxPageSize = 50;
    private int _pageSize = 10;

    public int Page { get; init; } = 1;

    public int PageSize
    {
        get => _pageSize;
        init => _pageSize = value > MaxPageSize ? MaxPageSize : (value < 1 ? 10 : value);
    }

    public string? Search { get; init; }
    public bool? IsActive { get; init; }
}

public record CreateStoreManagerAccountRequest(
    string FullName,
    string Email,
    string Username,
    string Password
);

public record OnlineContractSigningRequest(
    string SignerName,
    string SignerIdCard,
    string? SignerTitle,
    string SignatureBase64,
    decimal RoyaltyRate = 0.05m,
    decimal MarketingFeeRate = 0.02m
);

public record CreateStoreRequest(
    string Code,
    string Name,
    string Address,
    string PhoneNumber,
    decimal? Latitude = null,
    decimal? Longitude = null,
    TimeSpan? OpeningTime = null,
    TimeSpan? ClosingTime = null,
    CreateStoreManagerAccountRequest? ManagerAccount = null,
    OnlineContractSigningRequest? ContractSigning = null
);

public record UpdateStoreRequest(
    string Name,
    string Address,
    string PhoneNumber,
    decimal? Latitude = null,
    decimal? Longitude = null,
    TimeSpan? OpeningTime = null,
    TimeSpan? ClosingTime = null,
    bool IsActive = true
);

public record UpdateStoreStatusRequest(bool IsActive);

public record StoreContractResponse(
    Guid Id,
    string ContractNumber,
    string Status,
    string SignerName,
    string SignerTitle,
    string SignerIdCard,
    DateTime SignedAt,
    string? SignatureBase64,
    decimal RoyaltyRate,
    decimal MarketingFeeRate,
    decimal TechFeeFixedMonthly
);

public record StoreResponse(
    Guid Id,
    string Code,
    string Name,
    string Address,
    string PhoneNumber,
    bool IsActive,
    DateTime CreatedAt,
    string? ManagerUsername = null,
    string? ManagerFullName = null,
    StoreContractResponse? Contract = null
);

public record StoreDetailResponse(
    Guid Id,
    Guid FranchiseeId,
    string FranchiseeCompanyName,
    string Code,
    string Name,
    string Address,
    decimal? Latitude,
    decimal? Longitude,
    string PhoneNumber,
    TimeSpan? OpeningTime,
    TimeSpan? ClosingTime,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);
