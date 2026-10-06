# Phase 13: Distributed Caching (Redis), Observability & Offline-First POS Resilience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Hoàn thiện Phase cuối cùng trong lộ trình Master Enterprise Architecture: Triển khai Caching phân tán (Redis/Distributed Cache), Giám sát hiệu năng (OpenTelemetry, Health Checks & Request Timing), Động cơ bán hàng Offline-First cho máy POS (tiếp tục thanh toán khi đứt cáp/mất mạng và tự động đồng bộ khi có Internet trở lại), và cấu hình Docker Compose Full-Stack đóng gói toàn bộ hệ thống.

**Architecture:** 
- **Caching Layer:** `ICacheService` với Cache-Aside pattern, hỗ trợ Redis `IDistributedCache` và In-Memory fallback.
- **Offline POS Engine:** `IOfflineOrderSyncService` xử lý nạp lô (Bulk Replay) các giao dịch phát sinh ngoại tuyến với cơ chế kiểm tra Idempotency chống trùng lặp, bảo toàn tính nguyên tử của kho nguyên liệu.
- **Observability:** `RequestTimingMiddleware` ghi nhận độ trễ từng request, Health Check endpoints `/health` & `/health/ready`, và chẩn đoán số liệu `DiagnosticsController`.
- **Frontend Resilience:** `offlineQueue.ts` lưu đơn vào local storage khi rớt mạng, tự động kích hoạt Worker đồng bộ khi sự kiện `window.addEventListener('online')` kích hoạt.
- **DevOps:** Docker Compose (PostgreSQL 16, Redis 7, Backend .NET 8, Frontend Nginx + React 19).

**Tech Stack:** ASP.NET Core 8, Microsoft.Extensions.Caching, xUnit, FluentAssertions, Moq, React 19, TypeScript, Docker, Docker Compose, Nginx.

---

## 🗺️ CÁC TASK THỰC THI CHI TIẾT (TASK BREAKDOWN)

### Task 1: Caching Abstraction & Distributed Cache Service
- **Files:**
  - Create: `src/Franchise.Application/Common/Interfaces/ICacheService.cs`
  - Create: `src/Franchise.Infrastructure/Services/DistributedCacheService.cs`
  - Test: `tests/Franchise.UnitTests/Services/DistributedCacheServiceTests.cs`
- **Chỉ dẫn:**
  - `ICacheService`: `GetAsync<T>`, `SetAsync<T>`, `RemoveAsync`, `RemoveByPrefixAsync`.
  - `DistributedCacheService`: Sử dụng `IDistributedCache` với serialize JSON `System.Text.Json`. Hỗ trợ đặt thời gian hết hạn `TimeSpan? expiration`.
- **Verification:** `dotnet test tests/Franchise.UnitTests --filter FullyQualifiedName~DistributedCacheServiceTests` $\rightarrow$ PASS.

---

### Task 2: Offline POS Contracts & DTOs
- **Files:**
  - Create: `src/Franchise.Application/DTOs/Pos/OfflineSyncDtos.cs`
  - Create: `src/Franchise.Application/Common/Interfaces/IOfflineOrderSyncService.cs`
- **Chỉ dẫn:**
  - `OfflineOrderSyncItem`: `OfflineOrderId`, `IdempotencyKey`, `StoreId`, `Items`, `PaymentMethod`, `FinalAmount`, `OfflineCreatedAt`.
  - `BulkSyncOfflineOrdersRequest`: `StoreId`, `DeviceIdentifier`, `Orders`.
  - `BulkSyncOfflineOrdersResponse`: `TotalProcessed`, `SuccessfulCount`, `DuplicateSkippedCount`, `FailedCount`, `Results`.

---

### Task 3: Infrastructure Offline Order Sync Service & Tests
- **Files:**
  - Create: `src/Franchise.Infrastructure/Services/OfflineOrderSyncService.cs`
  - Modify: `src/Franchise.Infrastructure/DependencyInjection.cs`
  - Test: `tests/Franchise.UnitTests/Services/OfflineOrderSyncServiceTests.cs`
- **Chỉ dẫn:**
  - `OfflineOrderSyncService`:
    - Duyệt từng đơn trong lô.
    - Kiểm tra `IdempotencyRecords`: nếu đơn đã đồng bộ trước đó $\rightarrow$ đánh dấu `DuplicateSkipped` (không trừ kho 2 lần).
    - Tạo `Order`, trừ kho nguyên liệu qua `IInventoryService`, ghi Outbox message.
    - Đăng ký `ICacheService` và `IOfflineOrderSyncService` trong `DependencyInjection.cs`.
- **Verification:** `dotnet test tests/Franchise.UnitTests --filter FullyQualifiedName~OfflineOrderSyncServiceTests` $\rightarrow$ PASS.

---

### Task 4: API Controllers, Health Checks & Middleware
- **Files:**
  - Create: `src/Franchise.Api/Controllers/PosSyncController.cs`
  - Create: `src/Franchise.Api/Controllers/DiagnosticsController.cs`
  - Create: `src/Franchise.Api/Middleware/RequestTimingMiddleware.cs`
  - Modify: `src/Franchise.Api/Program.cs`
- **Chỉ dẫn:**
  - `PosSyncController`: `POST /api/pos/offline-sync`.
  - `DiagnosticsController`: `GET /api/diagnostics/metrics`, `GET /health`.
  - `RequestTimingMiddleware`: Tính `Stopwatch.ElapsedMilliseconds`, gắn header `X-Response-Time-Ms`, log cảnh báo nếu request $> 500ms$.

---

### Task 5: Frontend Offline Queue & Replay Service
- **Files:**
  - Create: `frontend/src/services/offlineQueue.ts`
  - Create: `frontend/src/services/posSync.ts`
- **Chỉ dẫn:**
  - Quản lý hàng đợi `offline_orders_queue` trong `localStorage`.
  - Hàm `enqueueOfflineOrder`, `getPendingOfflineOrders`, `clearPendingOfflineOrders`.
  - Tự động bắt sự kiện `window.addEventListener('online', syncPendingOrders)`.

---

### Task 6: Frontend POS Screen Offline Indicator & Sync Banner
- **Files:**
  - Modify: `frontend/src/App.tsx`
  - Modify: `frontend/src/App.test.ts`
- **Chỉ dẫn:**
  - Thêm Banner trên màn hình POS khi mất mạng: "⚠️ Đang ở chế độ Offline - Các đơn thanh toán sẽ lưu tạm và tự động nộp lại khi có mạng".
  - Nút "Đồng bộ thủ công" kèm badge đếm số đơn đang chờ phát lại.
  - Viết unit test cho logic offline queue trong `App.test.ts`.

---

### Task 7: Docker Compose & Containerization Full-Stack
- **Files:**
  - Create: `docker-compose.yml`
  - Create: `Dockerfile.backend`
  - Create: `Dockerfile.frontend`
  - Create: `nginx.conf`
- **Chỉ dẫn:**
  - PostgreSQL 16 Alpine với volume persistence.
  - Redis 7 Alpine.
  - Backend .NET 8 Multi-stage build.
  - Frontend SPA Nginx reverse proxy.

---

### Task 8: Verification, Full Suite Test & Git Push
- **Chỉ dẫn:**
  - Chạy toàn bộ backend tests: `dotnet test tests/Franchise.UnitTests`.
  - Chạy frontend tests: `npm test`.
  - Chạy build frontend: `npm run build`.
  - Push toàn bộ commits sạch lên `origin/main`.
