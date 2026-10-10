using Franchise.Application.Common.Interfaces;
using Franchise.Application.DTOs.Loyalty;
using Microsoft.AspNetCore.Mvc;

namespace Franchise.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LoyaltyController : ControllerBase
{
    private readonly ILoyaltyService _loyaltyService;

    public LoyaltyController(ILoyaltyService loyaltyService)
    {
        _loyaltyService = loyaltyService;
    }

    /// <summary>
    /// Tra cứu thông tin hội viên, hạng thẻ và ưu đãi khả dụng qua số điện thoại
    /// </summary>
    [HttpGet("customers/lookup")]
    public async Task<ActionResult<CustomerLookupResponse>> LookupCustomer(
        [FromQuery] string phoneNumber, 
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(phoneNumber))
        {
            return BadRequest(new { message = "Số điện thoại không được để trống" });
        }

        var result = await _loyaltyService.LookupCustomerAsync(phoneNumber, ct);
        return Ok(result);
    }

    /// <summary>
    /// Đăng ký thành viên mới tại quầy POS hoặc Cổng khách hàng
    /// </summary>
    [HttpPost("customers/register")]
    public async Task<ActionResult<CustomerDto>> RegisterCustomer(
        [FromBody] RegisterCustomerRequest request, 
        CancellationToken ct)
    {
        var result = await _loyaltyService.RegisterCustomerAsync(request, ct);
        return Ok(result);
    }

    /// <summary>
    /// Kiểm tra tính toán chiết khấu (Hạng thẻ + Voucher + Điểm thưởng)
    /// </summary>
    [HttpPost("promotions/apply")]
    public async Task<ActionResult<ApplyPromotionResponse>> ApplyPromotion(
        [FromBody] ApplyPromotionRequest request, 
        CancellationToken ct)
    {
        var result = await _loyaltyService.ApplyPromotionAsync(request, ct);
        return Ok(result);
    }

    /// <summary>
    /// Danh sách các Voucher đang hoạt động
    /// </summary>
    [HttpGet("vouchers")]
    public async Task<ActionResult<IReadOnlyList<VoucherDto>>> GetActiveVouchers(
        [FromQuery] string? phoneNumber, 
        CancellationToken ct)
    {
        var result = await _loyaltyService.GetActiveVouchersAsync(phoneNumber, ct);
        return Ok(result);
    }

    /// <summary>
    /// Tạo mã Voucher khuyến mãi mới (HQ / Marketing)
    /// </summary>
    [HttpPost("vouchers")]
    public async Task<ActionResult<VoucherDto>> CreateVoucher(
        [FromBody] CreateVoucherRequest request, 
        CancellationToken ct)
    {
        var result = await _loyaltyService.CreateVoucherAsync(request, ct);
        return Ok(result);
    }
}
