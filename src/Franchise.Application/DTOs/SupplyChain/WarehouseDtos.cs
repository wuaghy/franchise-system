namespace Franchise.Application.DTOs.SupplyChain;

public record WarehouseDto(
    Guid Id,
    string Code,
    string Name,
    string Address,
    string ContactPhone,
    bool IsActive
);

public record WarehouseInventoryDto(
    Guid Id,
    Guid WarehouseId,
    Guid IngredientId,
    string IngredientCode,
    string IngredientName,
    string Unit,
    decimal CurrentStock,
    decimal SafetyStock,
    decimal UnitCost,
    DateTime? LastRestockedAt
);

public record WarehouseInboundItemRequest(
    Guid IngredientId,
    decimal Quantity,
    decimal UnitCost
);

public record WarehouseInboundRequest(
    Guid WarehouseId,
    string SupplierCode,
    string ReferenceNumber,
    string? Notes,
    List<WarehouseInboundItemRequest> Items
);
