using Franchise.Application.DTOs.Inventory;

namespace Franchise.Application.Common.Interfaces;

public interface IInventoryService
{
    // Trừ kho động theo Base BoM + Toppings, chống âm kho bằng Atomic Decrement
    Task<InventoryDeductionResult> ProcessOrderInventoryDeductionAsync(
        CheckoutOrderInventoryRequest request, 
        CancellationToken ct = default);
}
