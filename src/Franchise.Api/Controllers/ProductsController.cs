using Franchise.Application.DTOs.Products;
using Franchise.Domain.Entities;
using Franchise.Domain.Exceptions;
using Franchise.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Franchise.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/products")]
[Produces("application/json")]
public class ProductsController : ControllerBase
{
    private readonly AppDbContext _context;

    public ProductsController(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Lấy danh sách sản phẩm trong toàn hệ thống
    /// </summary>
    [AllowAnonymous]
    [HttpGet]
    [ProducesResponseType(typeof(List<ProductResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetProducts([FromQuery] Guid? categoryId, [FromQuery] bool? isAvailable)
    {
        var query = _context.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .AsQueryable();

        if (categoryId.HasValue)
        {
            query = query.Where(p => p.CategoryId == categoryId.Value);
        }

        if (isAvailable.HasValue)
        {
            query = query.Where(p => p.IsAvailable == isAvailable.Value);
        }

        var products = await query
            .OrderBy(p => p.Name)
            .Select(p => new ProductResponse(
                p.Id,
                p.CategoryId,
                p.Category != null ? p.Category.Name : string.Empty,
                p.Sku,
                p.Name,
                p.BasePrice,
                p.IsAvailable,
                p.CreatedAt
            ))
            .ToListAsync();

        return Ok(products);
    }

    /// <summary>
    /// Lấy thông tin chi tiết một sản phẩm theo ID
    /// </summary>
    [AllowAnonymous]
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ProductResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetProductById(Guid id)
    {
        var p = await _context.Products
            .AsNoTracking()
            .Include(prod => prod.Category)
            .FirstOrDefaultAsync(prod => prod.Id == id);

        if (p == null)
        {
            throw new NotFoundException("PRODUCT_NOT_FOUND", $"Không tìm thấy sản phẩm với ID '{id}'.");
        }

        var response = new ProductResponse(
            p.Id,
            p.CategoryId,
            p.Category != null ? p.Category.Name : string.Empty,
            p.Sku,
            p.Name,
            p.BasePrice,
            p.IsAvailable,
            p.CreatedAt
        );

        return Ok(response);
    }

    /// <summary>
    /// Tạo mới một sản phẩm
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "HQ_SuperAdmin")]
    [ProducesResponseType(typeof(ProductResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateProduct([FromBody] CreateProductRequest request)
    {
        var skuExists = await _context.Products
            .AnyAsync(p => p.Sku.ToLower() == request.Sku.Trim().ToLower());

        if (skuExists)
        {
            throw new ConflictException("SKU_EXISTS", $"Mã sản phẩm '{request.Sku}' đã tồn tại.");
        }

        var product = new Product
        {
            Id = Guid.NewGuid(),
            CategoryId = request.CategoryId,
            Sku = request.Sku.Trim().ToUpperInvariant(),
            Name = request.Name.Trim(),
            BasePrice = request.BasePrice,
            IsAvailable = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Products.Add(product);
        await _context.SaveChangesAsync();

        var category = await _context.Categories.FindAsync(request.CategoryId);
        var response = new ProductResponse(
            product.Id,
            product.CategoryId,
            category?.Name ?? string.Empty,
            product.Sku,
            product.Name,
            product.BasePrice,
            product.IsAvailable,
            product.CreatedAt
        );

        return CreatedAtAction(nameof(GetProductById), new { id = product.Id }, response);
    }

    /// <summary>
    /// Cập nhật thông tin sản phẩm
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Roles = "HQ_SuperAdmin")]
    [ProducesResponseType(typeof(ProductResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateProduct(Guid id, [FromBody] UpdateProductRequest request)
    {
        var product = await _context.Products
            .Include(p => p.Category)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (product == null)
        {
            throw new NotFoundException("PRODUCT_NOT_FOUND", $"Không tìm thấy sản phẩm với ID '{id}'.");
        }

        product.Name = request.Name.Trim();
        product.BasePrice = request.BasePrice;
        product.IsAvailable = request.IsAvailable;
        product.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var response = new ProductResponse(
            product.Id,
            product.CategoryId,
            product.Category?.Name ?? string.Empty,
            product.Sku,
            product.Name,
            product.BasePrice,
            product.IsAvailable,
            product.CreatedAt
        );

        return Ok(response);
    }
}
