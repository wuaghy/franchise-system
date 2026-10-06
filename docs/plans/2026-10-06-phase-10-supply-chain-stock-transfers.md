# Phase 10: Supply Chain, Central Warehouse & Inter-Store Transfers (STO) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Xây dựng phân hệ Chuỗi Cung Ứng khép kín (Supply Chain Management) gồm Kho Tổng Trung Tâm (Central Warehouse), Quy trình Luân chuyển Hàng hóa (Stock Transfer Orders - STO) quản lý bằng Finite State Machine (FSM), Tự động khấu trừ/cộng dồn tồn kho nhiều chặng, và Cổng Quản lý Nghiệm thu & Lệch kho (Discrepancy Resolution) cho Cửa hàng và Trụ sở HQ.

**Architecture:** Tuân thủ Clean Architecture chuẩn mực:
- **Domain**: Mô hình hóa Thực thể `Warehouse`, `WarehouseInventory`, `WarehouseInventoryTransaction`, `StockTransferOrder`, `StockTransferItem` cùng Finite State Machine kiểm soát 8 trạng thái chuyển dịch của STO (`Draft` -> `Submitted` -> `Approved` / `Rejected` -> `Dispatched` -> `Received` / `DiscrepancyReported` -> `Cancelled`).
- **Application**: Định nghĩa DTOs chuẩn hóa, các quy tắc nghiệp vụ kiểm tra khả dụng tồn kho kho tổng, tính chênh lệch thực nhận vs số lượng duyệt, và giao diện `ISupplyChainService`.
- **Infrastructure**: Triển khai `SupplyChainService` với EF Core Database Transactions đảm bảo tính toàn vẹn (ACID), trừ kho tổng khi xuất hàng (Dispatch), ghi nhận tồn kho trên đường vận chuyển (In-Transit), cộng tồn kho chi nhánh khi nghiệm thu (Receive), và xử lý biên bản lệch kho (Discrepancy).
- **Api**: Cung cấp `TransfersController` và `WarehousesController` với phân quyền RBAC đa cấp (Store Manager chỉ thao tác trên chi nhánh phụ trách, HQ Admin / Supply Chain duyệt và xuất kho tổng).
- **Frontend**: Portal quản lý điều chuyển trên React 19 với bảng điều khiển trực quan: Lọc trạng thái, Modal tạo đơn đề xuất, Modal duyệt đơn HQ, Modal xuất kho gắn mã vận đơn, và Modal nghiệm thu đối soát hàng nhập tại điểm bán.

**Tech Stack:** .NET 8, C# 12, Entity Framework Core 8, PostgreSQL, React 19, TypeScript, Lucide Icons, Tailwind CSS, xUnit, FluentAssertions.

---

### Task 1: Domain Entities, Enums & State Machine Rules

**Files:**
- Create: `src/Franchise.Domain/Enums/TransferStatus.cs`
- Create: `src/Franchise.Domain/Enums/WarehouseTransactionType.cs`
- Create: `src/Franchise.Domain/Entities/Warehouse.cs`
- Create: `src/Franchise.Domain/Entities/WarehouseInventory.cs`
- Create: `src/Franchise.Domain/Entities/WarehouseInventoryTransaction.cs`
- Create: `src/Franchise.Domain/Entities/StockTransferOrder.cs`
- Create: `src/Franchise.Domain/Entities/StockTransferItem.cs`
- Test: `tests/Franchise.UnitTests/Domain/StockTransferOrderTests.cs`

**Step 1: Write failing domain tests for State Machine**
- Viết test kiểm tra chuyển trạng thái hợp lệ: `Draft` -> `Submitted` -> `Approved` -> `Dispatched` -> `Received`.
- Viết test kiểm tra chuyển trạng thái bất hợp lệ (ví dụ: `Draft` nhảy trực tiếp sang `Dispatched` hoặc `Received` sửa đổi đơn) ném `DomainException`.

**Step 2: Run test to verify it fails**
- Command: `dotnet test tests/Franchise.UnitTests --filter FullyQualifiedName~StockTransferOrderTests`
- Expected: FAIL do chưa có thực thể và enums.

**Step 3: Implement Domain Enums & Entities**
- `TransferStatus`: `Draft = 1, Submitted = 2, Approved = 3, Rejected = 4, Dispatched = 5, Received = 6, DiscrepancyReported = 7, Cancelled = 8`.
- `WarehouseTransactionType`: `SupplierInbound = 1, TransferDispatch = 2, TransferReturn = 3, DiscrepancyAdjustment = 4`.
- `Warehouse`: `Id`, `Code`, `Name`, `Address`, `ContactPhone`, `IsActive`.
- `WarehouseInventory`: `Id`, `WarehouseId`, `IngredientId`, `CurrentStock`, `SafetyStock`, `LastRestockedAt`.
- `WarehouseInventoryTransaction`: `Id`, `WarehouseId`, `IngredientId`, `QuantityChange`, `BalanceAfter`, `TransactionType`, `ReferenceNumber`, `Note`.
- `StockTransferOrder`: `Id`, `TransferCode` (STO-YYYYMM-XXXX), `SourceWarehouseId`, `DestinationStoreId`, `Status`, `DispatchTrackingNumber`, `DispatchedAt`, `ReceivedAt`, `CreatedByUserId`, `ApprovedByUserId`, `Notes`, `Items`. Cung cấp domain methods: `Submit()`, `Approve()`, `Reject()`, `Dispatch()`, `Receive()`, `Cancel()`.
- `StockTransferItem`: `Id`, `TransferOrderId`, `IngredientId`, `RequestedQuantity`, `ApprovedQuantity`, `ActualReceivedQuantity`, `DiscrepancyQuantity`, `UnitCost`, `Notes`.

**Step 4: Run test to verify it passes**
- Command: `dotnet test tests/Franchise.UnitTests --filter FullyQualifiedName~StockTransferOrderTests`
- Expected: PASS.

**Step 5: Commit**
- Command: `git add src/Franchise.Domain tests/Franchise.UnitTests && git commit -m "feat(domain): add stock transfer order entities and state machine"`

---

### Task 2: EF Core AppDbContext Configuration & Persistence Mapping

**Files:**
- Modify: `src/Franchise.Infrastructure/Data/AppDbContext.cs`

**Step 1: Configure DbSets and Fluent API mappings**
- Thêm `DbSet<Warehouse>`, `DbSet<WarehouseInventory>`, `DbSet<WarehouseInventoryTransaction>`, `DbSet<StockTransferOrder>`, `DbSet<StockTransferItem>`.
- Cấu hình quan hệ:
  - `StockTransferOrder` has many `StockTransferItem` (Delete cascade).
  - Khóa ngoại `SourceWarehouseId` trỏ tới `Warehouse` (Restrict delete).
  - Khóa ngoại `DestinationStoreId` trỏ tới `Store` (Restrict delete).
  - Độ chính xác số thực: `HasPrecision(18, 4)` cho `Quantity` và `UnitCost`.
  - Unique Index trên `Warehouse.Code` và `StockTransferOrder.TransferCode`.
- Thêm seed data mặc định cho Kho Tổng Trung Tâm HQ (`WH-CENTRAL-01` - "Kho Tổng Trung Tâm Miền Nam").

**Step 2: Build project to verify compilation**
- Command: `dotnet build src/Franchise.Infrastructure`
- Expected: Build succeeded with 0 errors.

**Step 3: Commit**
- Command: `git add src/Franchise.Infrastructure && git commit -m "feat(infra): map supply chain entities and seed warehouse in AppDbContext"`

---

### Task 3: Application DTOs & Service Contract (ISupplyChainService)

**Files:**
- Create: `src/Franchise.Application/DTOs/SupplyChain/TransferDtos.cs`
- Create: `src/Franchise.Application/DTOs/SupplyChain/WarehouseDtos.cs`
- Create: `src/Franchise.Application/Common/Interfaces/ISupplyChainService.cs`

**Step 1: Define DTOs**
- `StockTransferOrderDto`, `StockTransferItemDto`.
- `CreateTransferOrderRequest`: `SourceWarehouseId`, `DestinationStoreId`, `Notes`, `Items: List<CreateTransferItemRequest>`.
- `ApproveTransferOrderRequest`: `ApprovedItems: List<ApproveTransferItemDto>`, `Notes`.
- `DispatchTransferOrderRequest`: `DispatchTrackingNumber`, `Notes`.
- `ReceiveTransferOrderRequest`: `ReceivedItems: List<ReceiveTransferItemDto>`, `InspectionNotes`.
- `WarehouseInventoryDto`, `WarehouseInboundRequest`.

**Step 2: Define Service Interface**
- Định nghĩa các hợp đồng nghiệp vụ đầy đủ:
  - `GetTransferOrdersAsync(TransferOrderFilterDto filter)`
  - `GetTransferOrderByIdAsync(Guid id)`
  - `CreateTransferOrderAsync(CreateTransferOrderRequest request, Guid currentUserId)`
  - `SubmitTransferOrderAsync(Guid id, Guid currentUserId)`
  - `ApproveTransferOrderAsync(Guid id, ApproveTransferOrderRequest request, Guid currentUserId)`
  - `RejectTransferOrderAsync(Guid id, string reason, Guid currentUserId)`
  - `DispatchTransferOrderAsync(Guid id, DispatchTransferOrderRequest request, Guid currentUserId)`
  - `ReceiveTransferOrderAsync(Guid id, ReceiveTransferOrderRequest request, Guid currentUserId)`
  - `ResolveDiscrepancyAsync(Guid id, string resolutionNotes, Guid currentUserId)`
  - `GetWarehouseInventoryAsync(Guid warehouseId)`
  - `WarehouseInboundStockAsync(WarehouseInboundRequest request, Guid currentUserId)`

**Step 3: Build Application layer**
- Command: `dotnet build src/Franchise.Application`
- Expected: Build succeeded with 0 errors.

**Step 4: Commit**
- Command: `git add src/Franchise.Application && git commit -m "feat(application): define supply chain DTOs and ISupplyChainService contract"`

---

### Task 4: Infrastructure Supply Chain Service Implementation & State Machine Execution

**Files:**
- Create: `src/Franchise.Infrastructure/Services/SupplyChainService.cs`
- Modify: `src/Franchise.Infrastructure/DependencyInjection.cs`
- Test: `tests/Franchise.UnitTests/Services/SupplyChainServiceTests.cs`

**Step 1: Write comprehensive unit tests for SupplyChainService**
- Test 1: Tạo Draft STO tự động sinh mã `STO-YYYYMM-XXXX`.
- Test 2: `SubmitTransferOrderAsync` chuyển từ `Draft` sang `Submitted`.
- Test 3: `ApproveTransferOrderAsync` kiểm tra tồn kho kho tổng:
  - Nếu đủ hàng: trạng thái thành `Approved`, gán `ApprovedQuantity`.
  - Nếu thiếu hàng: ném `DomainException` cảnh báo cụ thể nguyên liệu thiếu hụt.
- Test 4: `DispatchTransferOrderAsync`:
  - Khấu trừ tồn kho `WarehouseInventory.CurrentStock`.
  - Tạo bản ghi `WarehouseInventoryTransaction` (loại `TransferDispatch`).
  - Cập nhật trạng thái `Dispatched`, gán `DispatchedAt` và `DispatchTrackingNumber`.
- Test 5: `ReceiveTransferOrderAsync` nhận hàng khớp 100%:
  - Tăng tồn kho chi nhánh `StoreInventory.CurrentStock`.
  - Tạo bản ghi `InventoryTransaction` (loại `Inbound_HQ`).
  - Trạng thái thành `Received`.
- Test 6: `ReceiveTransferOrderAsync` phát hiện sai lệch (Thiếu/hỏng hàng):
  - Tăng tồn kho chi nhánh đúng theo `ActualReceivedQuantity`.
  - Trạng thái thành `DiscrepancyReported`.
  - Đánh dấu chênh lệch `DiscrepancyQuantity`.
- Test 7: `ResolveDiscrepancyAsync` xử lý biên bản lệch kho và đóng đơn thành `Received`.
- Test 8: Ngăn chặn thao tác trái phép theo nguyên tắc đa chi nhánh (Tenant Isolation).

**Step 2: Run test to verify it fails**
- Command: `dotnet test tests/Franchise.UnitTests --filter FullyQualifiedName~SupplyChainServiceTests`
- Expected: FAIL do chưa implement `SupplyChainService`.

**Step 3: Implement SupplyChainService**
- Triển khai toàn bộ logic với ACID Transaction:
  - Quản lý locking hoặc kiểm tra số dư nguyên vật liệu tại kho tổng.
  - Tự động tạo hoặc cập nhật `StoreInventory` khi hàng đến chi nhánh.
  - Ghi nhận `WarehouseInventoryTransaction` và `InventoryTransaction` làm sổ cái kiểm toán (Audit Trail).
- Đăng ký `services.AddScoped<ISupplyChainService, SupplyChainService>()` trong `DependencyInjection.cs`.

**Step 4: Run test to verify it passes**
- Command: `dotnet test tests/Franchise.UnitTests --filter FullyQualifiedName~SupplyChainServiceTests`
- Expected: All tests PASS.

**Step 5: Commit**
- Command: `git add src/Franchise.Infrastructure tests/Franchise.UnitTests && git commit -m "feat(infra): implement SupplyChainService and full state machine transaction handling"`

---

### Task 5: API Controllers with Multi-Tenant RBAC Security

**Files:**
- Create: `src/Franchise.Api/Controllers/TransfersController.cs`
- Create: `src/Franchise.Api/Controllers/WarehousesController.cs`

**Step 1: Implement TransfersController**
- Endpoints:
  - `GET /api/transfers`: Hỗ trợ filter theo `storeId`, `warehouseId`, `status`. HQ xem tất cả; Store Manager chỉ xem đơn liên quan đến cửa hàng của mình.
  - `GET /api/transfers/{id}`: Xem chi tiết đơn điều chuyển.
  - `POST /api/transfers`: Tạo draft STO.
  - `POST /api/transfers/{id}/submit`: Trình duyệt đơn lên HQ.
  - `POST /api/transfers/{id}/approve`: [Authorize(Roles = "HQ_Admin,Supply_Chain")] Duyệt đơn.
  - `POST /api/transfers/{id}/reject`: [Authorize(Roles = "HQ_Admin,Supply_Chain")] Từ chối đơn.
  - `POST /api/transfers/{id}/dispatch`: [Authorize(Roles = "HQ_Admin,Supply_Chain,Warehouse_Staff")] Xuất kho tổng.
  - `POST /api/transfers/{id}/receive`: Nghiệm thu nhập kho tại chi nhánh.
  - `POST /api/transfers/{id}/resolve-discrepancy`: [Authorize(Roles = "HQ_Admin,Supply_Chain")] Xử lý biên bản lệch kho.

**Step 2: Implement WarehousesController**
- Endpoints:
  - `GET /api/warehouses`: Lấy danh sách kho.
  - `GET /api/warehouses/{id}/inventory`: Lấy danh sách tồn kho kho tổng.
  - `POST /api/warehouses/{id}/inbound`: [Authorize(Roles = "HQ_Admin,Supply_Chain")] Nhập kho từ Nhà cung cấp.

**Step 3: Run full backend unit tests**
- Command: `dotnet test tests/Franchise.UnitTests`
- Expected: 100% PASS (bao gồm 52 test cũ + các test mới của Phase 10).

**Step 4: Commit**
- Command: `git add src/Franchise.Api && git commit -m "feat(api): expose TransfersController and WarehousesController with RBAC policies"`

---

### Task 6: Frontend API Client & Types

**Files:**
- Create: `frontend/src/services/transfers.ts`

**Step 1: Implement TypeScript models and Axios/Fetch client**
- Khai báo các enum và interfaces: `TransferStatus`, `StockTransferOrderDto`, `StockTransferItemDto`, `WarehouseInventoryDto`, v.v.
- Hàm gọi API:
  - `getTransferOrders(params)`
  - `getTransferOrderById(id)`
  - `createTransferOrder(data)`
  - `submitTransferOrder(id)`
  - `approveTransferOrder(id, data)`
  - `rejectTransferOrder(id, reason)`
  - `dispatchTransferOrder(id, data)`
  - `receiveTransferOrder(id, data)`
  - `resolveDiscrepancy(id, resolutionNotes)`
  - `getWarehouseInventory(warehouseId)`
  - `inboundWarehouseStock(warehouseId, data)`
- Đảm bảo strict relative import `.ts` để tương thích môi trường Windows đặc thù đường dẫn.

**Step 2: Run frontend type-check & test**
- Command: `npm test -- --run` trong `frontend/`
- Expected: PASS.

**Step 3: Commit**
- Command: `git add frontend/src/services/transfers.ts && git commit -m "feat(frontend): create supply chain and transfer orders API client"`

---

### Task 7: Frontend Transfer Orders & Central Warehouse Hub UI

**Files:**
- Modify: `frontend/src/App.tsx` (thêm tab `TransfersHubScreen` cùng các modal nghiệp vụ)

**Step 1: Implement TransfersHubScreen UI Components**
- **Dashboard Header**: Thống kê số lượng đơn theo trạng thái (Cần duyệt, Đang vận chuyển, Có chênh lệch).
- **Tab 1: Đơn Điều Chuyển Hàng (Transfer Orders)**:
  - Data table với các cột: Mã STO, Cửa hàng đích, Trạng thái (Badge màu sắc theo FSM), Mã vận đơn, Ngày tạo, Tổng số mặt hàng, Thao tác.
  - Nút bấm action tương ứng theo trạng thái: "Gửi duyệt", "Duyệt đơn", "Xuất kho", "Nghiệm thu", "Xử lý lệch kho".
- **Tab 2: Kho Tổng HQ (Central Warehouse)**:
  - Bảng tồn kho kho tổng: Tên nguyên liệu, Đơn vị tính, Tồn kho thực tế, Ngưỡng an toàn, Trạng thái (Đủ hàng / Cảnh báo thiếu).
  - Nút "Nhập hàng NCC" mở modal nhập kho.
- **Interactive Modals**:
  1. *Modal Đề Xuất Nhập Hàng*: Chọn chi nhánh, thêm nguyên liệu từ danh mục, nhập số lượng cần.
  2. *Modal Duyệt STO (HQ)*: Xem số lượng đề xuất, đối chiếu tồn kho tổng, nhập số lượng phê duyệt.
  3. *Modal Xuất Kho (Dispatch)*: Nhập hãng vận chuyển, mã tracking number, ghi chú giao nhận.
  4. *Modal Nghiệm Thu & Kiểm Kê (Inspection)*: Nhập số lượng thực nhận cho từng dòng, cảnh báo đỏ nếu phát hiện lệch thiếu/thừa, nhập lý do hao hụt.

**Step 2: Run frontend build**
- Command: `npm run build` trong `frontend/`
- Expected: Build thành công không có lỗi TypeScript / Rollup.

**Step 3: Commit**
- Command: `git add frontend/src/App.tsx && git commit -m "feat(frontend): build interactive Transfer Orders & Central Warehouse Hub"`

---

### Task 8: Comprehensive Verification & Quality Gate

**Files:**
- Test all projects end-to-end.

**Step 1: Backend verification**
- Command: `dotnet test tests/Franchise.UnitTests`
- Expected: Tất cả các unit tests PASS (dự kiến ~64+ tests).

**Step 2: Frontend verification**
- Command: `npm test -- --run` và `npm run build`
- Expected: 0 errors, build thành công bundle production.

**Step 3: Final push**
- Command: `git push origin main`
