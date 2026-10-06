namespace Franchise.Domain.Enums;

public enum WarehouseTransactionType
{
    SupplierInbound = 1,        // Nhập hàng từ Nhà Cung Cấp
    TransferDispatch = 2,       // Xuất kho cho đơn điều chuyển chi nhánh
    TransferReturn = 3,         // Nhận hoàn hàng từ chi nhánh
    DiscrepancyAdjustment = 4   // Điều chỉnh hao hụt/lệch kho kiểm kê
}
