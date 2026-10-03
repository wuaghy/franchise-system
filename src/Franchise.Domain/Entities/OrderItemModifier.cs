using Franchise.Domain.Common;

namespace Franchise.Domain.Entities;

public class OrderItemModifier : BaseEntity
{
    public Guid OrderItemId { get; set; }
    public OrderItem? OrderItem { get; set; }

    public string Name { get; set; } = string.Empty; // Vd: "Thêm Trân Châu Trắng", "70% Đường"
    public decimal ExtraPrice { get; set; }         // Giá cộng thêm (vd: 10,000 VND)

    // --- LIÊN KẾT ĐỊNH LƯỢNG TIÊU HAO NGUYÊN LIỆU (NẾU CÓ) ---
    public Guid? IngredientId { get; set; }          // Null nếu chỉ là ghi chú (như "Ít đá")
    public Ingredient? Ingredient { get; set; }
    public decimal ConsumptionQuantity { get; set; } // Định lượng tiêu hao (vd: 40.0000 gram)
}
