namespace Franchise.Application.DTOs.Recipes;

public record SetProductRecipeRequest(
    List<RecipeItemInputDto> Items
);

public record RecipeItemInputDto(
    Guid IngredientId,
    decimal Quantity
);

public record RecipeItemDto(
    Guid IngredientId,
    string IngredientCode,
    string IngredientName,
    string Unit,
    decimal Quantity
);

public record ProductRecipeResponse(
    Guid ProductId,
    string ProductSku,
    string ProductName,
    List<RecipeItemDto> Items
);
