using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Franchise.Infrastructure.Data;
using Franchise.Domain.Entities;
using Franchise.Application.DTOs.Stores;
using Franchise.Application.Common.Models;

namespace Franchise.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class StoresController : ControllerBase
{
    private readonly AppDbContext _context;

    public StoresController(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Lấy danh sách chi nhánh cửa hàng (Hỗ trợ phân trang, tìm kiếm và lọc trạng thái)
    /// </summary>
    /// <remarks>GET /api/stores?page=1&amp;pageSize=10&amp;search=Highlands&amp;isActive=true</remarks>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<StoreResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetStores([FromQuery] StoreQueryParameters query)
    {
        var storesQuery = _context.Stores
            .AsNoTracking()
            .AsQueryable();

        // 1. Lọc theo trạng thái hoạt động (nếu có)
        if (query.IsActive.HasValue)
        {
            storesQuery = storesQuery.Where(s => s.IsActive == query.IsActive.Value);
        }

        // 2. Tìm kiếm theo tên, mã chi nhánh hoặc địa chỉ
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLower();
            storesQuery = storesQuery.Where(s =>
                s.Name.ToLower().Contains(search) ||
                s.Code.ToLower().Contains(search) ||
                s.Address.ToLower().Contains(search));
        }

        // 3. Đếm tổng số bản ghi thỏa điều kiện
        var totalCount = await storesQuery.CountAsync();

        // 4. Phân trang và chiếu sang StoreResponse DTO
        var items = await storesQuery
            .OrderByDescending(s => s.CreatedAt)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(s => new StoreResponse(
                s.Id,
                s.Code,
                s.Name,
                s.Address,
                s.PhoneNumber,
                s.IsActive,
                s.CreatedAt
            ))
            .ToListAsync();

        var pagedResult = new PagedResult<StoreResponse>(items, totalCount, query.Page, query.PageSize);
        return Ok(pagedResult);
    }

    /// <summary>
    /// Lấy thông tin chi tiết một chi nhánh theo ID
    /// </summary>
    /// <remarks>GET /api/stores/{id}</remarks>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(StoreDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetStoreById(Guid id)
    {
        var store = await _context.Stores
            .AsNoTracking()
            .Include(s => s.Franchisee)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (store == null)
        {
            return Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Not Found",
                detail: $"Không tìm thấy chi nhánh với ID '{id}'."
            );
        }

        var response = new StoreDetailResponse(
            store.Id,
            store.FranchiseeId,
            store.Franchisee?.CompanyName ?? string.Empty,
            store.Code,
            store.Name,
            store.Address,
            store.Latitude,
            store.Longitude,
            store.PhoneNumber,
            store.OpeningTime,
            store.ClosingTime,
            store.IsActive,
            store.CreatedAt,
            store.UpdatedAt
        );

        return Ok(response);
    }

    /// <summary>
    /// Tạo mới một chi nhánh cửa hàng
    /// </summary>
    /// <remarks>POST /api/stores</remarks>
    [HttpPost]
    [ProducesResponseType(typeof(StoreResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateStore([FromBody] CreateStoreRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Bad Request",
                detail: "Mã chi nhánh (Code) và Tên chi nhánh (Name) là các trường bắt buộc."
            );
        }

        // 1. Kiểm tra trùng mã chi nhánh (Unique Constraint)
        var isCodeTaken = await _context.Stores.AnyAsync(s => s.Code.ToLower() == request.Code.Trim().ToLower());
        if (isCodeTaken)
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Conflict",
                detail: $"Mã chi nhánh '{request.Code}' đã tồn tại trong hệ thống."
            );
        }

        // 2. Tìm hoặc tạo mặc định Franchisee mẫu nếu chưa có
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

        // 3. Khởi tạo và lưu Store mới
        var store = new Store
        {
            FranchiseeId = defaultFranchisee.Id,
            Code = request.Code.Trim().ToUpperInvariant(),
            Name = request.Name.Trim(),
            Address = request.Address.Trim(),
            PhoneNumber = request.PhoneNumber.Trim(),
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            OpeningTime = request.OpeningTime,
            ClosingTime = request.ClosingTime,
            IsActive = true
        };

        _context.Stores.Add(store);
        await _context.SaveChangesAsync();

        var response = new StoreResponse(
            store.Id,
            store.Code,
            store.Name,
            store.Address,
            store.PhoneNumber,
            store.IsActive,
            store.CreatedAt
        );

        return CreatedAtAction(nameof(GetStoreById), new { id = store.Id }, response);
    }

    /// <summary>
    /// Cập nhật toàn bộ thông tin chi nhánh (Idempotent)
    /// </summary>
    /// <remarks>PUT /api/stores/{id}</remarks>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(StoreResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateStore(Guid id, [FromBody] UpdateStoreRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Bad Request",
                detail: "Tên chi nhánh (Name) không được để trống."
            );
        }

        var store = await _context.Stores.FirstOrDefaultAsync(s => s.Id == id);
        if (store == null)
        {
            return Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Not Found",
                detail: $"Không tìm thấy chi nhánh với ID '{id}' để cập nhật."
            );
        }

        // Cập nhật các trường thông tin
        store.Name = request.Name.Trim();
        store.Address = request.Address.Trim();
        store.PhoneNumber = request.PhoneNumber.Trim();
        store.Latitude = request.Latitude;
        store.Longitude = request.Longitude;
        store.OpeningTime = request.OpeningTime;
        store.ClosingTime = request.ClosingTime;
        store.IsActive = request.IsActive;
        store.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var response = new StoreResponse(
            store.Id,
            store.Code,
            store.Name,
            store.Address,
            store.PhoneNumber,
            store.IsActive,
            store.CreatedAt
        );

        return Ok(response);
    }

    /// <summary>
    /// Cập nhật trạng thái hoạt động của chi nhánh
    /// </summary>
    /// <remarks>PATCH /api/stores/{id}/status</remarks>
    [HttpPatch("{id:guid}/status")]
    [ProducesResponseType(typeof(StoreResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateStoreStatus(Guid id, [FromBody] UpdateStoreStatusRequest request)
    {
        var store = await _context.Stores.FirstOrDefaultAsync(s => s.Id == id);
        if (store == null)
        {
            return Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Not Found",
                detail: $"Không tìm thấy chi nhánh với ID '{id}'."
            );
        }

        store.IsActive = request.IsActive;
        store.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        var response = new StoreResponse(
            store.Id,
            store.Code,
            store.Name,
            store.Address,
            store.PhoneNumber,
            store.IsActive,
            store.CreatedAt
        );

        return Ok(response);
    }

    /// <summary>
    /// Xóa một chi nhánh cửa hàng
    /// </summary>
    /// <remarks>DELETE /api/stores/{id}</remarks>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeleteStore(Guid id)
    {
        var store = await _context.Stores.FirstOrDefaultAsync(s => s.Id == id);
        if (store == null)
        {
            return Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Not Found",
                detail: $"Không tìm thấy chi nhánh với ID '{id}' để xóa."
            );
        }

        // Kiểm tra ràng buộc dữ liệu: Nếu đã có đơn hàng thì không được xóa (bảo toàn lịch sử kế toán)
        var hasOrders = await _context.Orders.AnyAsync(o => o.StoreId == id);
        if (hasOrders)
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Conflict",
                detail: $"Không thể xóa chi nhánh '{store.Name}' vì đã có lịch sử đơn hàng phát sinh. Vui lòng chuyển trạng thái (IsActive = false) để lưu trữ."
            );
        }

        _context.Stores.Remove(store);
        await _context.SaveChangesAsync();

        return NoContent(); // 204 No Content chuẩn RESTful
    }
}
