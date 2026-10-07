using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Franchise.Infrastructure.Data;
using Franchise.Domain.Entities;
using Franchise.Application.DTOs.Ingredients;

namespace Franchise.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class IngredientsController : ControllerBase
{
    private readonly AppDbContext _context;

    public IngredientsController(AppDbContext context)
    {
        _context = context;
    }

    [AllowAnonymous]
    [HttpGet]
    [ProducesResponseType(typeof(List<IngredientResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetIngredients()
    {
        var items = await _context.Ingredients
            .AsNoTracking()
            .OrderBy(i => i.Name)
            .Select(i => new IngredientResponse(i.Id, i.Code, i.Name, i.Unit, i.StandardCost, i.CreatedAt))
            .ToListAsync();

        return Ok(items);
    }

    [Authorize(Roles = "HQ_SuperAdmin,Supply_Chain_Officer")]
    [HttpPost]
    [ProducesResponseType(typeof(IngredientResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateIngredient([FromBody] CreateIngredientRequest request)
    {
        var isTaken = await _context.Ingredients.AnyAsync(i => i.Code.ToLower() == request.Code.Trim().ToLower());
        if (isTaken)
        {
            return Problem(statusCode: 409, title: "Conflict", detail: $"Mã nguyên liệu '{request.Code}' đã tồn tại.");
        }

        var ingredient = new Ingredient
        {
            Code = request.Code.Trim().ToUpperInvariant(),
            Name = request.Name.Trim(),
            Unit = request.Unit.Trim().ToLower(),
            StandardCost = request.StandardCost
        };

        _context.Ingredients.Add(ingredient);
        await _context.SaveChangesAsync();

        var response = new IngredientResponse(ingredient.Id, ingredient.Code, ingredient.Name, ingredient.Unit, ingredient.StandardCost, ingredient.CreatedAt);
        return Created($"/api/ingredients/{ingredient.Id}", response);
    }
}
