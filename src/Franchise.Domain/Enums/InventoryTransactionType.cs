namespace Franchise.Domain.Enums;

public enum InventoryTransactionType
{
    Inbound_HQ,        // Nhập hàng từ Tổng công ty
    Outbound_Sale,     // Tự động trừ kho khi bán đơn hàng theo BoM/Recipe
    Waste_Spoiled,     // Xuất hủy do rơi vỡ, hết hạn sử dụng
    Audit_Adjustment   // Cân bằng sau kiểm kê kho thực tế
}
