namespace Franchise.Application.DTOs.Ingredients;

public record CreateIngredientRequest(
    string Code,
    string Name,
    string Unit,
    decimal StandardCost
);

public record IngredientResponse(
    Guid Id,
    string Code,
    string Name,
    string Unit,
    decimal StandardCost,
    DateTime CreatedAt
);
