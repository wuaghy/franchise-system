using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Franchise.Infrastructure.Data;
using Franchise.Domain.Entities;
using Franchise.Application.DTOs.Recipes;

namespace Franchise.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/products/{productId:guid}/recipe")]
[Produces("application/json")]
public class RecipesController : ControllerBase
{
    private readonly AppDbContext _context;

    public RecipesController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    [ProducesResponseType(typeof(ProductRecipeResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetRecipe(Guid productId)
    {
        var product = await _context.Products
            .AsNoTracking()
            .Include(p => p.Recipes)
                .ThenInclude(r => r.Ingredient)
            .FirstOrDefaultAsync(p => p.Id == productId);

        if (product == null)
        {
            return Problem(statusCode: 404, title: "Not Found", detail: "Không tìm thấy sản phẩm.");
        }

        var recipeItems = product.Recipes.Select(r => new RecipeItemDto(
            r.IngredientId,
            r.Ingredient?.Code ?? string.Empty,
            r.Ingredient?.Name ?? string.Empty,
            r.Ingredient?.Unit ?? string.Empty,
            r.Quantity
        )).ToList();

        return Ok(new ProductRecipeResponse(product.Id, product.Sku, product.Name, recipeItems));
    }

    [Authorize(Roles = "HQ_SuperAdmin,Supply_Chain_Officer")]
    [HttpPut]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetRecipe(Guid productId, [FromBody] SetProductRecipeRequest request)
    {
        var product = await _context.Products.Include(p => p.Recipes).FirstOrDefaultAsync(p => p.Id == productId);
        if (product == null)
        {
            return Problem(statusCode: 404, title: "Not Found", detail: "Không tìm thấy sản phẩm.");
        }

        // Xóa các định lượng cũ và thay bằng danh sách định lượng mới
        _context.ProductRecipes.RemoveRange(product.Recipes);

        foreach (var item in request.Items)
        {
            _context.ProductRecipes.Add(new ProductRecipe
            {
                ProductId = productId,
                IngredientId = item.IngredientId,
                Quantity = item.Quantity
            });
        }

        await _context.SaveChangesAsync();
        return NoContent();
    }
}
