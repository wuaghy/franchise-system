namespace Franchise.Application.DTOs.Products;

public record ProductResponse(
    Guid Id,
    Guid CategoryId,
    string CategoryName,
    string Sku,
    string Name,
    decimal BasePrice,
    bool IsAvailable,
    DateTime CreatedAt
);

public record CreateProductRequest(
    Guid CategoryId,
    string Sku,
    string Name,
    decimal BasePrice
);

public record UpdateProductRequest(
    string Name,
    decimal BasePrice,
    bool IsAvailable
);
