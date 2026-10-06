namespace Franchise.Domain.Enums;

public enum KitchenTicketStatus
{
    New = 1,            // Đơn mới từ POS, đang xếp hàng chờ pha chế
    InPreparation = 2,  // Barista đã nhận pha chế, SLA timer đang đếm
    Ready = 3,          // Pha chế xong, sẵn sàng trả cho khách/shipper
    Completed = 4,      // Khách đã nhận đồ uống
    Cancelled = 5       // Hủy đơn
}
