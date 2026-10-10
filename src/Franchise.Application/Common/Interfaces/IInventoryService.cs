using Franchise.Application.DTOs.Inventory;

namespace Franchise.Application.Common.Interfaces;

public interface IInventoryService
{
    // Trừ kho động theo Base BoM + Toppings, chống âm kho bằng Atomic Decrement
    Task<InventoryDeductionResult> ProcessOrderInventoryDeductionAsync(
        CheckoutOrderInventoryRequest request, 
        CancellationToken ct = default);

    // Lấy danh sách tồn kho hiện tại của chi nhánh
    Task<List<StoreInventoryResponse>> GetStoreInventoryAsync(
        Guid storeId, 
        CancellationToken ct = default);

    // Lấy danh sách nguyên vật liệu chạm ngưỡng báo động đỏ
    Task<List<LowStockAlertResponse>> GetLowStockAlertsAsync(
        Guid storeId, 
        CancellationToken ct = default);

    // Nhập hàng về kho chi nhánh (Inbound)
    Task<StoreInventoryResponse> InboundStockAsync(
        InboundStockRequest request, 
        CancellationToken ct = default);

    // Khai báo xuất hủy hao hụt, rơi vỡ, hư hỏng nguyên liệu
    Task<RecordWasteResponse> RecordWasteAsync(
        RecordWasteRequest request, 
        CancellationToken ct = default);

    // Kích hoạt phát cảnh báo tồn kho tới Telegram Bot và Email Quản lý
    Task<AlertBroadcastResultDto> BroadcastLowStockAlertsAsync(
        Guid storeId, 
        BroadcastStockAlertRequest? request = null, 
        CancellationToken ct = default);

    // Cập nhật cấu hình Telegram Chat ID và Email Quản lý của chi nhánh
    Task<bool> UpdateStoreAlertConfigAsync(
        Guid storeId, 
        UpdateStoreAlertConfigRequest request, 
        CancellationToken ct = default);
}
