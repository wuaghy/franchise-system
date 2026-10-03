using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Franchise.Infrastructure.Data;
using Franchise.Domain.Entities;

namespace Franchise.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StoresController : ControllerBase
{
    private readonly AppDbContext _context;

    public StoresController(AppDbContext context)
    {
        _context = context;
    }

    // GET: api/stores (Lấy danh sách chi nhánh cửa hàng)
    [HttpGet]
    public async Task<IActionResult> GetStores()
    {
        var stores = await _context.Stores
            .AsNoTracking()
            .Select(s => new
            {
                s.Id,
                s.Code,
                s.Name,
                s.Address,
                s.PhoneNumber,
                s.IsActive,
                s.CreatedAt
            })
            .ToListAsync();

        return Ok(stores);
    }

    // POST: api/stores (Tạo chi nhánh cửa hàng mới)
    [HttpPost]
    public async Task<IActionResult> CreateStore([FromBody] CreateStoreRequest request)
    {
        // 1. Tìm hoặc tạo mặc định một Franchisee chủ đầu tư mẫu nếu chưa có
        var defaultFranchisee = await _context.Franchisees.FirstOrDefaultAsync();
        if (defaultFranchisee == null)
        {
            defaultFranchisee = new Franchisee
            {
                CompanyName = "Franchise Group Vietnam",
                TaxCode = "0109999999",
                RevenueSharePercentage = 5.0m
            };
            _context.Franchisees.Add(defaultFranchisee);
            await _context.SaveChangesAsync();
        }

        // 2. Tạo chi nhánh cửa hàng mới
        var store = new Store
        {
            FranchiseeId = defaultFranchisee.Id,
            Code = request.Code,
            Name = request.Name,
            Address = request.Address,
            PhoneNumber = request.PhoneNumber,
            IsActive = true
        };

        _context.Stores.Add(store);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetStores), new { id = store.Id }, new
        {
            store.Id,
            store.Code,
            store.Name,
            store.Address,
            store.PhoneNumber,
            store.IsActive,
            store.CreatedAt
        });
    }
}

public record CreateStoreRequest(string Code, string Name, string Address, string PhoneNumber);
