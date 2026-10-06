# Phase 11: Real-Time Kitchen Display System (KDS) & Barista Queue Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Xây dựng phân hệ Màn hình Điều phối Bếp & Quầy Pha Chế (Kitchen Display System - KDS Screen) thời gian thực kết nối với POS qua SignalR WebSockets, quản lý hàng đợi Barista Queue, đồng hồ SLA đếm ngược chống trễ đơn, và Interactive Modifier Checklist loại bỏ 100% sai sót pha chế topping.

**Architecture:** Tuân thủ Clean Architecture chuẩn mực:
- **Domain**: Thực thể `KitchenTicket`, `KitchenTicketItem`, `KitchenTicketItemModifier` cùng Finite State Machine 5 trạng thái (`New` -> `InPreparation` -> `Ready` -> `Completed` / `Cancelled`).
- **Application**: DTOs chuẩn hóa, hợp đồng `IKitchenDisplayService`, thông điệp thời gian thực SignalR (`ReceiveKitchenTicketCreated`, `ReceiveKitchenTicketUpdated`).
- **Infrastructure**: Triển khai `KitchenDisplayService` với Entity Framework Core, kết nối Outbox & POS checkout để tự động sinh ticket khi thanh toán đơn hàng.
- **Api**: Mở rộng `FranchiseHub` và `KdsController` (`api/stores/{storeId}/kds`) cho các thiết bị Tablet bếp/barista thao tác một chạm (One-touch Bumping).
- **Frontend**: Giao diện Barista KDS chuyên dụng trên React 19 với Kanban Ticket Grid, đồng hồ SLA trực tiếp (Xanh < 3p, Vàng 3-5p, Đỏ nhấp nháy > 5p), âm thanh thông báo chuông bếp, và danh sách kiểm tra Topping cảm ứng.

**Tech Stack:** .NET 8, C# 12, Entity Framework Core 8, SignalR WebSockets, React 19, TypeScript, Lucide Icons, Tailwind CSS, Web Audio API, xUnit, FluentAssertions.

---

### Task 1: Domain Entities, Enums & KDS State Machine

**Files:**
- Create: `src/Franchise.Domain/Enums/KitchenTicketStatus.cs`
- Create: `src/Franchise.Domain/Entities/KitchenTicket.cs`
- Create: `src/Franchise.Domain/Entities/KitchenTicketItem.cs`
- Create: `src/Franchise.Domain/Entities/KitchenTicketItemModifier.cs`
- Test: `tests/Franchise.UnitTests/Domain/KitchenTicketTests.cs`

**Step 1: Write failing domain tests for KDS State Machine**
- Kiểm tra chuyển dịch trạng thái hợp lệ: `New` -> `InPreparation` -> `Ready` -> `Completed`.
- Kiểm tra chuyển dịch bất hợp lệ (ví dụ: `New` nhảy sang `Completed` hoặc `Completed` cố gắng sửa đổi) ném `BusinessRuleException`.
- Kiểm tra toggle checklist món lẻ và topping modifier.

**Step 2: Run test to verify it fails**
- Command: `dotnet test tests/Franchise.UnitTests --filter FullyQualifiedName~KitchenTicketTests`
- Expected: FAIL do chưa có entity & enum.

**Step 3: Implement Domain Entities & State Machine**
- `KitchenTicketStatus`: `New = 1, InPreparation = 2, Ready = 3, Completed = 4, Cancelled = 5`.
- `KitchenTicket`:
  - `TicketNumber` (vd: `KDS-202610-001`), `OrderId`, `StoreId`, `OrderNumber`, `OrderType`, `Status`, `TargetPreparationSeconds`, `PreparationStartedAt`, `ReadyAt`, `CompletedAt`, `CancellationReason`.
  - Methods: `StartPreparation()`, `MarkReady()`, `Complete()`, `Cancel(reason)`.
- `KitchenTicketItem`:
  - `KitchenTicketId`, `OrderItemId`, `ProductName`, `Quantity`, `SpecialNote`, `IsPrepared`.
  - Method: `TogglePrepared()`.
- `KitchenTicketItemModifier`:
  - `KitchenTicketItemId`, `ModifierName`, `IsChecked`.
  - Method: `ToggleChecked()`.

**Step 4: Run test to verify it passes**
- Command: `dotnet test tests/Franchise.UnitTests --filter FullyQualifiedName~KitchenTicketTests`
- Expected: PASS.

**Step 5: Commit**
- Command: `git add src/Franchise.Domain tests/Franchise.UnitTests && git commit -m "feat(domain): add kitchen ticket entities and KDS state machine"`

---

### Task 2: EF Core Persistence Configuration in AppDbContext

**Files:**
- Modify: `src/Franchise.Infrastructure/Data/AppDbContext.cs`

**Step 1: Configure DbSets and Relationships**
- Thêm `DbSet<KitchenTicket>`, `DbSet<KitchenTicketItem>`, `DbSet<KitchenTicketItemModifier>`.
- Fluent API:
  - Khóa ngoại `StoreId` trỏ tới `Store` (Restrict delete).
  - Khóa ngoại `OrderId` trỏ tới `Order` (Cascade delete).
  - Quan hệ cascade giữa `KitchenTicket` -> `KitchenTicketItem` -> `KitchenTicketItemModifier`.
  - Index trên `TicketNumber`, `StoreId`, `Status`.

**Step 2: Verify project build**
- Command: `dotnet build src/Franchise.Infrastructure`
- Expected: 0 Warning(s), 0 Error(s).

**Step 3: Commit**
- Command: `git add src/Franchise.Infrastructure && git commit -m "feat(infra): configure KDS entities mapping in AppDbContext"`

---

### Task 3: Application DTOs, Service Contract & SignalR Notification Interface

**Files:**
- Create: `src/Franchise.Application/DTOs/Kds/KdsDtos.cs`
- Create: `src/Franchise.Application/Common/Interfaces/IKitchenDisplayService.cs`
- Modify: `src/Franchise.Application/Common/Interfaces/IRealtimeNotificationService.cs`
- Modify: `src/Franchise.Api/Hubs/IFranchiseHubClient.cs`
- Modify: `src/Franchise.Api/Services/RealtimeNotificationService.cs`

**Step 1: Define DTOs**
- `KitchenTicketDto`, `KitchenTicketItemDto`, `KitchenTicketItemModifierDto`.
- `KitchenTicketCreatedNotification`, `KitchenTicketStatusChangedNotification`.
- `ToggleItemPreparedRequest`, `ToggleModifierCheckedRequest`, `CancelTicketRequest`.

**Step 2: Define Service Interface**
- `IKitchenDisplayService`:
  - `GetActiveTicketsAsync(Guid storeId, CancellationToken ct)`
  - `CreateTicketFromOrderAsync(Guid orderId, CancellationToken ct)`
  - `StartPreparationAsync(Guid ticketId, Guid? baristaUserId, CancellationToken ct)`
  - `ToggleItemPreparedAsync(Guid ticketId, Guid itemId, CancellationToken ct)`
  - `ToggleModifierCheckedAsync(Guid ticketId, Guid modifierId, CancellationToken ct)`
  - `MarkTicketReadyAsync(Guid ticketId, CancellationToken ct)`
  - `CompleteTicketAsync(Guid ticketId, CancellationToken ct)`
  - `CancelTicketAsync(Guid ticketId, string reason, CancellationToken ct)`

**Step 3: Update Realtime Hub Contracts**
- Thêm vào `IRealtimeNotificationService`:
  - `NotifyKitchenTicketCreatedAsync(Guid storeId, KitchenTicketDto ticket, CancellationToken ct)`
  - `NotifyKitchenTicketStatusChangedAsync(Guid storeId, Guid ticketId, string status, DateTime timestamp, CancellationToken ct)`
  - `NotifyKitchenTicketItemToggledAsync(Guid storeId, Guid ticketId, Guid itemId, bool isPrepared, CancellationToken ct)`
- Thêm tương ứng vào `IFranchiseHubClient` và `RealtimeNotificationService`.

**Step 4: Build project**
- Command: `dotnet build src/Franchise.Application`
- Expected: 0 errors.

**Step 5: Commit**
- Command: `git add src/Franchise.Application src/Franchise.Api && git commit -m "feat(application): define KDS service contracts and realtime broadcast methods"`

---

### Task 4: Infrastructure KitchenDisplayService Implementation & POS Hook

**Files:**
- Create: `src/Franchise.Infrastructure/Services/KitchenDisplayService.cs`
- Modify: `src/Franchise.Infrastructure/Services/OrderService.cs` (Hook tự động sinh KDS ticket khi POS thanh toán thành công)
- Modify: `src/Franchise.Infrastructure/DependencyInjection.cs`
- Test: `tests/Franchise.UnitTests/Services/KitchenDisplayServiceTests.cs`

**Step 1: Write unit tests for KitchenDisplayService**
- Test 1: Tạo ticket từ Order hợp lệ đầy đủ món và modifiers.
- Test 2: Bắt đầu pha chế (`New` -> `InPreparation`), ghi nhận thời gian bắt đầu.
- Test 3: Toggle checklist món và topping.
- Test 4: Chuyển sang `Ready` và phát thông báo SignalR.
- Test 5: Hoàn tất đơn `Completed`.
- Test 6: SLA calculation (Elapsed seconds vs Target SLA).

**Step 2: Run test to verify it fails**
- Command: `dotnet test tests/Franchise.UnitTests --filter FullyQualifiedName~KitchenDisplayServiceTests`
- Expected: FAIL do chưa implement service.

**Step 3: Implement KitchenDisplayService**
- Triển khai logic, transaction DB, và gọi `_realtimeNotificationService` thông báo tức thì cho nhóm `store_{storeId}`.
- Tích hợp vào `OrderService.CheckoutAsync`: khi Order hoàn tất thành công, tự động gọi `CreateTicketFromOrderAsync`.

**Step 4: Run test to verify it passes**
- Command: `dotnet test tests/Franchise.UnitTests --filter FullyQualifiedName~KitchenDisplayServiceTests`
- Expected: PASS.

**Step 5: Commit**
- Command: `git add src/Franchise.Infrastructure tests/Franchise.UnitTests && git commit -m "feat(infra): implement KitchenDisplayService with automated POS checkout ticket generation"`

---

### Task 5: API Controller (KdsController) with Store-Level Access Control

**Files:**
- Create: `src/Franchise.Api/Controllers/KdsController.cs`

**Step 1: Implement KdsController**
- `[Route("api/stores/{storeId:guid}/kds")]`
- `[Authorize(Policy = "RequireStoreAccess")]`
- Endpoints:
  - `GET /active`: Lấy toàn bộ ticket chưa hoàn tất của cửa hàng.
  - `POST /tickets/{ticketId:guid}/start`: Bắt đầu pha chế.
  - `POST /tickets/{ticketId:guid}/items/{itemId:guid}/toggle`: Toggle trạng thái món lẻ.
  - `POST /tickets/{ticketId:guid}/modifiers/{modifierId:guid}/toggle`: Toggle trạng thái topping lẻ.
  - `POST /tickets/{ticketId:guid}/ready`: Báo hoàn tất pha chế (món sẵn sàng trả khách).
  - `POST /tickets/{ticketId:guid}/complete`: Báo đã trả món cho khách.
  - `POST /tickets/{ticketId:guid}/cancel`: Hủy ticket.

**Step 2: Run all backend unit tests**
- Command: `dotnet test tests/Franchise.UnitTests`
- Expected: 100% PASS (dự kiến ~82+ unit tests).

**Step 3: Commit**
- Command: `git add src/Franchise.Api && git commit -m "feat(api): expose KdsController with store authorization and one-touch bump endpoints"`

---

### Task 6: Frontend SignalR Events & KDS API Client

**Files:**
- Create: `frontend/src/services/kds.ts`
- Modify: `frontend/src/services/signalr.ts`

**Step 1: Implement TypeScript models and API client**
- Types: `KitchenTicketStatus`, `KitchenTicketDto`, `KitchenTicketItemDto`, `KitchenTicketItemModifierDto`.
- API functions:
  - `getActiveTickets(storeId)`
  - `startPreparation(storeId, ticketId)`
  - `toggleItemPrepared(storeId, ticketId, itemId)`
  - `toggleModifierChecked(storeId, ticketId, modifierId)`
  - `markTicketReady(storeId, ticketId)`
  - `completeTicket(storeId, ticketId)`
  - `cancelTicket(storeId, ticketId, reason)`

**Step 2: Update SignalR Hub listeners in frontend**
- Thêm lắng nghe sự kiện: `onKitchenTicketCreated`, `onKitchenTicketStatusChanged`, `onKitchenTicketItemToggled`.

**Step 3: Test frontend**
- Command: `npm test -- --run` trong `frontend/`
- Expected: PASS.

**Step 4: Commit**
- Command: `git add frontend/src/services && git commit -m "feat(frontend): create KDS API client and SignalR event listeners"`

---

### Task 7: Frontend Barista KDS Screen & Interactive Touch Kanban UI

**Files:**
- Create: `frontend/src/components/KdsScreen.tsx`
- Modify: `frontend/src/App.tsx` (thêm tab `kds` vào `Screen` và `navItems`)

**Step 1: Implement KdsScreen Component**
- **SLA Stopwatch Engine**: `useEffect` đếm theo từng giây:
  - $< 180s$ (3 phút): Xanh lá (`Healthy`).
  - $180s - 300s$ (3-5 phút): Vàng (`Warning`).
  - $> 300s$ (> 5 phút): Đỏ nhấp nháy (`Critical SLA Breach`).
- **Ticket Columns / Lanes**:
  - `Cột 1: Hàng Chờ (New)` - Nhấp nháy xanh, nút "Nhận Pha Chế" (Start Prep).
  - `Cột 2: Đang Pha Chế (In Preparation)` - Đồng hồ đếm ngược, checklist Topping bấm chạm (One-touch tick), nút "Pha Chế Xong" (Bump to Ready).
  - `Cột 3: Chờ Trả Khách (Ready for Pickup)` - Thẻ món sẵn sàng trả khách hoặc shipper, nút "Đã Giao" (Complete).
- **Web Audio Alert**: Phát chuông thông báo (Beep/Chime) nhẹ khi có đơn hàng mới từ POS bắn sang.
- **Modifier Checklist**: Khả năng tick trực tiếp trên từng topping (`70% Đường`, `Ít đá`, `Thêm trân châu`) với hiệu ứng gạch ngang strikethrough.

**Step 2: Run frontend build**
- Command: `npm run build` trong `frontend/`
- Expected: 0 errors, build production thành công.

**Step 3: Commit**
- Command: `git add frontend/src/components/KdsScreen.tsx frontend/src/App.tsx && git commit -m "feat(frontend): build real-time touch KDS screen with SLA stopwatch and modifier checklist"`

---

### Task 8: Comprehensive Verification & Remote Push

**Files:**
- End-to-end quality check.

**Step 1: Run full backend unit tests**
- Command: `dotnet test tests/Franchise.UnitTests`
- Expected: 100% tests PASS.

**Step 2: Run full frontend tests & build**
- Command: `npm test -- --run` và `npm run build`
- Expected: 100% PASS.

**Step 3: Git push**
- Command: `git push origin main`
