using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Franchise.Infrastructure.Data;
using Franchise.Domain.Entities;
using Franchise.Domain.Enums;
using Franchise.Application.DTOs.Stores;
using Franchise.Application.Common.Models;
using Franchise.Application.Common.Interfaces;

namespace Franchise.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class StoresController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IPasswordHasher _passwordHasher;

    public StoresController(AppDbContext context, IPasswordHasher passwordHasher)
    {
        _context = context;
        _passwordHasher = passwordHasher;
    }

    /// <summary>
    /// Lấy danh sách chi nhánh cửa hàng (Hỗ trợ phân trang, tìm kiếm và lọc trạng thái)
    /// </summary>
    /// <remarks>GET /api/stores?page=1&amp;pageSize=10&amp;search=Highlands&amp;isActive=true</remarks>
    [AllowAnonymous]
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
            .Include(s => s.Contract)
            .Include(s => s.Users)
            .Select(s => new StoreResponse(
                s.Id,
                s.Code,
                s.Name,
                s.Address,
                s.PhoneNumber,
                s.IsActive,
                s.CreatedAt,
                s.Users.Where(u => u.Role == UserRole.Store_Manager || u.Role == UserRole.Franchise_Owner).Select(u => u.Username).FirstOrDefault(),
                s.Users.Where(u => u.Role == UserRole.Store_Manager || u.Role == UserRole.Franchise_Owner).Select(u => u.FullName).FirstOrDefault(),
                s.Contract != null ? new StoreContractResponse(
                    s.Contract.Id,
                    s.Contract.ContractNumber,
                    s.Contract.Status,
                    s.Contract.SignerName,
                    s.Contract.SignerTitle,
                    s.Contract.SignerIdCard,
                    s.Contract.SignedAt,
                    s.Contract.SignatureData,
                    s.Contract.RoyaltyRate,
                    s.Contract.MarketingFeeRate,
                    s.Contract.TechFeeFixedMonthly
                ) : null
            ))
            .ToListAsync();

        var pagedResult = new PagedResult<StoreResponse>(items, totalCount, query.Page, query.PageSize);
        return Ok(pagedResult);
    }

    /// <summary>
    /// Lấy thông tin chi tiết một chi nhánh theo ID
    /// </summary>
    /// <remarks>GET /api/stores/{id}</remarks>
    [AllowAnonymous]
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
    [AllowAnonymous]
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

        // 4. Cấp tài khoản Quản lý chi nhánh (nếu có yêu cầu trong request)
        User? createdManager = null;
        if (request.ManagerAccount != null && !string.IsNullOrWhiteSpace(request.ManagerAccount.Username))
        {
            var username = request.ManagerAccount.Username.Trim().ToLowerInvariant();
            var isUsernameTaken = await _context.Users.AnyAsync(u => u.Username.ToLower() == username);
            if (isUsernameTaken)
            {
                return Problem(
                    statusCode: StatusCodes.Status409Conflict,
                    title: "Conflict",
                    detail: $"Tên đăng nhập quản lý '{username}' đã được sử dụng."
                );
            }

            createdManager = new User
            {
                Username = username,
                Email = string.IsNullOrWhiteSpace(request.ManagerAccount.Email)
                    ? $"{username}@{request.Code.Trim().ToLowerInvariant()}.franchise.vn"
                    : request.ManagerAccount.Email.Trim().ToLowerInvariant(),
                FullName = string.IsNullOrWhiteSpace(request.ManagerAccount.FullName)
                    ? $"Quản lý {request.Name.Trim()}"
                    : request.ManagerAccount.FullName.Trim(),
                PasswordHash = _passwordHasher.HashPassword(
                    string.IsNullOrWhiteSpace(request.ManagerAccount.Password) ? "Manager123!" : request.ManagerAccount.Password
                ),
                Role = UserRole.Store_Manager,
                StoreId = store.Id,
                FranchiseeId = defaultFranchisee.Id,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            _context.Users.Add(createdManager);
        }

        // 5. Ký hợp đồng nhượng quyền trực tuyến (E-Contract nếu có)
        FranchiseContract? createdContract = null;
        if (request.ContractSigning != null && !string.IsNullOrWhiteSpace(request.ContractSigning.SignerName))
        {
            var royaltyRate = request.ContractSigning.RoyaltyRate > 0 ? request.ContractSigning.RoyaltyRate : 0.05m;
            var marketingRate = request.ContractSigning.MarketingFeeRate > 0 ? request.ContractSigning.MarketingFeeRate : 0.02m;
            var techFee = 2000000m;

            createdContract = new FranchiseContract
            {
                StoreId = store.Id,
                ContractNumber = $"HDNQ-{store.Code}-{DateTime.UtcNow:yyyyMMdd}",
                SignerName = request.ContractSigning.SignerName.Trim(),
                SignerIdCard = request.ContractSigning.SignerIdCard?.Trim() ?? string.Empty,
                SignerTitle = string.IsNullOrWhiteSpace(request.ContractSigning.SignerTitle)
                    ? "Chủ chi nhánh nhượng quyền"
                    : request.ContractSigning.SignerTitle.Trim(),
                SignatureData = request.ContractSigning.SignatureBase64 ?? string.Empty,
                RoyaltyRate = royaltyRate,
                MarketingFeeRate = marketingRate,
                TechFeeFixedMonthly = techFee,
                SignedAt = DateTime.UtcNow,
                Status = "Signed",
                CreatedAt = DateTime.UtcNow
            };
            _context.FranchiseContracts.Add(createdContract);

            var royaltySetting = new StoreRoyaltySetting
            {
                StoreId = store.Id,
                RoyaltyRate = royaltyRate,
                MarketingFeeRate = marketingRate,
                TechFeeFixedMonthly = techFee,
                IsActive = true
            };
            _context.StoreRoyaltySettings.Add(royaltySetting);
        }

        await _context.SaveChangesAsync();

        var contractResponse = createdContract != null
            ? new StoreContractResponse(
                createdContract.Id,
                createdContract.ContractNumber,
                createdContract.Status,
                createdContract.SignerName,
                createdContract.SignerTitle,
                createdContract.SignerIdCard,
                createdContract.SignedAt,
                createdContract.SignatureData,
                createdContract.RoyaltyRate,
                createdContract.MarketingFeeRate,
                createdContract.TechFeeFixedMonthly
            )
            : null;

        var response = new StoreResponse(
            store.Id,
            store.Code,
            store.Name,
            store.Address,
            store.PhoneNumber,
            store.IsActive,
            store.CreatedAt,
            createdManager?.Username,
            createdManager?.FullName,
            contractResponse
        );

        return CreatedAtAction(nameof(GetStoreById), new { id = store.Id }, response);
    }

    /// <summary>
    /// Lấy thông tin hợp đồng nhượng quyền điện tử của chi nhánh
    /// </summary>
    /// <remarks>GET /api/stores/{id}/contract</remarks>
    [AllowAnonymous]
    [HttpGet("{id:guid}/contract")]
    [ProducesResponseType(typeof(StoreContractResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetStoreContract(Guid id)
    {
        var contract = await _context.FranchiseContracts
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.StoreId == id);

        if (contract == null)
        {
            return NotFound(new { message = "Chi nhánh này chưa có hợp đồng nhượng quyền điện tử." });
        }

        var response = new StoreContractResponse(
            contract.Id,
            contract.ContractNumber,
            contract.Status,
            contract.SignerName,
            contract.SignerTitle,
            contract.SignerIdCard,
            contract.SignedAt,
            contract.SignatureData,
            contract.RoyaltyRate,
            contract.MarketingFeeRate,
            contract.TechFeeFixedMonthly
        );

        return Ok(response);
    }

    /// <summary>
    /// Ký hoặc cập nhật hợp đồng nhượng quyền điện tử cho chi nhánh
    /// </summary>
    /// <remarks>POST /api/stores/{id}/contract/sign</remarks>
    [AllowAnonymous]
    [HttpPost("{id:guid}/contract/sign")]
    [ProducesResponseType(typeof(StoreContractResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SignStoreContract(Guid id, [FromBody] OnlineContractSigningRequest request)
    {
        var store = await _context.Stores.Include(s => s.Contract).FirstOrDefaultAsync(s => s.Id == id);
        if (store == null)
        {
            return NotFound(new { message = $"Không tìm thấy chi nhánh với ID '{id}'." });
        }

        var royaltyRate = request.RoyaltyRate > 0 ? request.RoyaltyRate : 0.05m;
        var marketingRate = request.MarketingFeeRate > 0 ? request.MarketingFeeRate : 0.02m;
        var techFee = 2000000m;

        var contract = store.Contract;
        if (contract == null)
        {
            contract = new FranchiseContract
            {
                StoreId = store.Id,
                ContractNumber = $"HDNQ-{store.Code}-{DateTime.UtcNow:yyyyMMdd}",
                CreatedAt = DateTime.UtcNow
            };
            _context.FranchiseContracts.Add(contract);
        }

        contract.SignerName = request.SignerName.Trim();
        contract.SignerIdCard = request.SignerIdCard?.Trim() ?? string.Empty;
        contract.SignerTitle = string.IsNullOrWhiteSpace(request.SignerTitle) ? "Chủ chi nhánh nhượng quyền" : request.SignerTitle.Trim();
        contract.SignatureData = request.SignatureBase64 ?? string.Empty;
        contract.RoyaltyRate = royaltyRate;
        contract.MarketingFeeRate = marketingRate;
        contract.TechFeeFixedMonthly = techFee;
        contract.SignedAt = DateTime.UtcNow;
        contract.Status = "Signed";
        contract.UpdatedAt = DateTime.UtcNow;

        var royaltySetting = await _context.StoreRoyaltySettings.FirstOrDefaultAsync(r => r.StoreId == store.Id);
        if (royaltySetting == null)
        {
            royaltySetting = new StoreRoyaltySetting
            {
                StoreId = store.Id,
                RoyaltyRate = royaltyRate,
                MarketingFeeRate = marketingRate,
                TechFeeFixedMonthly = techFee,
                IsActive = true
            };
            _context.StoreRoyaltySettings.Add(royaltySetting);
        }
        else
        {
            royaltySetting.RoyaltyRate = royaltyRate;
            royaltySetting.MarketingFeeRate = marketingRate;
        }

        await _context.SaveChangesAsync();

        var response = new StoreContractResponse(
            contract.Id,
            contract.ContractNumber,
            contract.Status,
            contract.SignerName,
            contract.SignerTitle,
            contract.SignerIdCard,
            contract.SignedAt,
            contract.SignatureData,
            contract.RoyaltyRate,
            contract.MarketingFeeRate,
            contract.TechFeeFixedMonthly
        );

        return Ok(response);
    }

    /// <summary>
    /// Cập nhật toàn bộ thông tin chi nhánh (Idempotent)
    /// </summary>
    /// <remarks>PUT /api/stores/{id}</remarks>
    [Authorize(Roles = "HQ_SuperAdmin")]
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
    [Authorize(Roles = "HQ_SuperAdmin")]
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
    [Authorize(Roles = "HQ_SuperAdmin")]
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
