# Phase 12: Business Intelligence, Royalty Fees & Financial Reporting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Xây dựng hệ thống Báo cáo Quản trị Doanh nghiệp (Business Intelligence), Phân tích Nhiệt doanh số theo giờ (Hourly Sales Heatmap), Hiệu suất thực đơn (Menu Pareto), và Động cơ tính phí nhượng quyền tự động (Automated Franchise Royalty & Marketing Fees Engine) với đầy đủ hóa đơn điện tử cho từng chi nhánh.

**Architecture:** Tuân thủ Clean Architecture (Domain $\rightarrow$ Application $\rightarrow$ Infrastructure $\rightarrow$ API $\rightarrow$ Frontend). Tạo thực thể `RoyaltyInvoice` và `StoreRoyaltySetting` trong Domain; xây dựng `FinancialAnalyticsService` và `RoyaltyBillingService` trong Infrastructure với truy vấn tổng hợp hiệu năng cao; công bố REST API trong `ReportsController` & `RoyaltyController`; tích hợp màn hình `AnalyticsHubScreen.tsx` trên Frontend React 19 với các biểu đồ trực quan và hóa đơn nhượng quyền.

**Tech Stack:** ASP.NET Core 8, EF Core (PostgreSQL / In-Memory), xUnit, FluentAssertions, Moq, React 19, TypeScript, Tailwind CSS v4, Lucide Icons.

---

## 🗺️ CÁC TASK THỰC THI (DETAILED TASKS)

### Task 1: Domain Entities & Royalty Invoicing FSM
- **Files:**
  - Create: `src/Franchise.Domain/Enums/RoyaltyInvoiceStatus.cs`
  - Create: `src/Franchise.Domain/Entities/RoyaltyInvoice.cs`
  - Create: `src/Franchise.Domain/Entities/StoreRoyaltySetting.cs`
  - Test: `tests/Franchise.UnitTests/Domain/RoyaltyInvoiceTests.cs`
- **Chỉ dẫn:**
  - `RoyaltyInvoiceStatus`: `Draft`, `Issued`, `Paid`, `Overdue`, `Cancelled`.
  - `StoreRoyaltySetting`: `StoreId`, `RoyaltyRate` (default `0.05` = 5%), `MarketingFeeRate` (default `0.02` = 2%), `TechFeeFixedMonthly` (default `2,000,000 VND`).
  - `RoyaltyInvoice`: Các phương thức FSM:
    - `CalculateFees(decimal grossRevenue, decimal discountAmount)`: Tính `NetRevenue`, `RoyaltyFee = NetRevenue * RoyaltyRate`, `MarketingFee = NetRevenue * MarketingFeeRate`, `TotalDue = RoyaltyFee + MarketingFee + TechFeeFixed`.
    - `Issue()`: Chuyển từ `Draft` $\rightarrow$ `Issued`, gán `IssuedAt = UtcNow`, `DueDate = UtcNow + 15 days`.
    - `MarkPaid(string paymentReference)`: Chuyển từ `Issued` / `Overdue` $\rightarrow$ `Paid`, gán `PaidAt`.
    - `Cancel(string reason)`: Hủy hóa đơn.
- **Verification:** Chạy `dotnet test tests/Franchise.UnitTests --filter FullyQualifiedName~RoyaltyInvoiceTests` $\rightarrow$ PASS 100%.

---

### Task 2: EF Core AppDbContext Mapping & Configurations
- **Files:**
  - Modify: `src/Franchise.Infrastructure/Data/AppDbContext.cs`
- **Chỉ dẫn:**
  - Thêm `DbSet<RoyaltyInvoice> RoyaltyInvoices => Set<RoyaltyInvoice>();`
  - Thêm `DbSet<StoreRoyaltySetting> StoreRoyaltySettings => Set<StoreRoyaltySetting>();`
  - Fluent API: cấu hình Index trên `(StoreId, BillingYear, BillingMonth)`, quan hệ với `Store`.

---

### Task 3: Application DTOs & Service Contracts
- **Files:**
  - Create: `src/Franchise.Application/DTOs/Analytics/AnalyticsDtos.cs`
  - Create: `src/Franchise.Application/DTOs/Royalty/RoyaltyDtos.cs`
  - Create: `src/Franchise.Application/Common/Interfaces/IFinancialAnalyticsService.cs`
  - Create: `src/Franchise.Application/Common/Interfaces/IRoyaltyBillingService.cs`
- **Chỉ dẫn:**
  - `FinancialSummaryDto`: `GrossRevenue`, `NetRevenue`, `VatAmount`, `Discounts`, `TotalOrders`, `AverageOrderValue`, `EstimatedCogs`, `EstimatedGrossProfit`, `GrossMarginPercentage`.
  - `HourlySalesPointDto`: `Hour` (0-23), `OrderCount`, `Revenue`, `IsPeakHour`.
  - `ProductSalesRankDto`: `ProductId`, `ProductName`, `Sku`, `UnitsSold`, `Revenue`, `EstimatedCogs`, `GrossProfit`, `MarginPercentage`, `RevenueSharePercentage`.
  - `NetworkStoreComparisonDto`: `StoreId`, `StoreCode`, `StoreName`, `Revenue`, `OrdersCount`, `RoyaltyDue`.
  - `RoyaltyInvoiceDto`: Chi tiết hóa đơn thu phí nhượng quyền.
  - `GenerateRoyaltyInvoiceRequest`: `StoreId`, `BillingYear`, `BillingMonth`.

---

### Task 4: Infrastructure Services & Tests
- **Files:**
  - Create: `src/Franchise.Infrastructure/Services/FinancialAnalyticsService.cs`
  - Create: `src/Franchise.Infrastructure/Services/RoyaltyBillingService.cs`
  - Modify: `src/Franchise.Infrastructure/DependencyInjection.cs`
  - Test: `tests/Franchise.UnitTests/Services/FinancialAnalyticsServiceTests.cs`
  - Test: `tests/Franchise.UnitTests/Services/RoyaltyBillingServiceTests.cs`
- **Chỉ dẫn:**
  - `FinancialAnalyticsService`:
    - `GetStoreSummaryAsync`: Tổng hợp từ bảng `Orders`, tính giá vốn từ công thức BoM nếu có.
    - `GetHourlySalesHeatmapAsync`: Phân bổ đơn hàng theo 24 khung giờ `Order.CreatedAt.Hour`, đánh dấu đỉnh giờ cao điểm.
    - `GetProductSalesPerformanceAsync`: Xếp hạng sản phẩm bán chạy theo doanh thu và biên lợi nhuận.
    - `GetNetworkOverviewAsync`: Tổng hợp toàn mạng lưới các chi nhánh cho HQ Admin.
  - `RoyaltyBillingService`:
    - `GetInvoicesAsync`: Tìm hóa đơn theo kỳ và chi nhánh.
    - `GenerateInvoiceAsync`: Tự động truy vấn doanh thu tháng, áp dụng tỷ lệ phí của chi nhánh, sinh mã hóa đơn `ROY-YYYYMM-XXXX`.
    - `MarkInvoicePaidAsync`: Ghi nhận hoàn tất nộp phí nhượng quyền.
- **Verification:** Chạy `dotnet test tests/Franchise.UnitTests` $\rightarrow$ PASS tất cả unit tests mới và cũ.

---

### Task 5: API Controllers (`ReportsController.cs` & `RoyaltyController.cs`)
- **Files:**
  - Create: `src/Franchise.Api/Controllers/ReportsController.cs`
  - Create: `src/Franchise.Api/Controllers/RoyaltyController.cs`
- **Chỉ dẫn:**
  - `ReportsController`:
    - `GET /api/reports/stores/{storeId}/summary?from=&to=`
    - `GET /api/reports/stores/{storeId}/hourly-heatmap?date=`
    - `GET /api/reports/stores/{storeId}/products?from=&to=`
    - `GET /api/reports/network/overview?from=&to=`
  - `RoyaltyController`:
    - `GET /api/royalty/invoices?storeId=&year=&month=`
    - `GET /api/royalty/invoices/{invoiceId}`
    - `POST /api/royalty/invoices/generate`
    - `POST /api/royalty/invoices/{invoiceId}/pay`
    - `POST /api/royalty/invoices/{invoiceId}/cancel`
- **Verification:** `dotnet build` $\rightarrow$ Build succeeded 0 error.

---

### Task 6: Frontend API Client (`reports.ts`)
- **Files:**
  - Create: `frontend/src/services/reports.ts`
- **Chỉ dẫn:**
  - Khai báo kiểu TypeScript và fetch functions cho toàn bộ endpoints của `ReportsController` & `RoyaltyController`.
  - Luôn tuân thủ quy tắc import đuôi file `.ts` (ví dụ `import { getTokenFromLocalStorage } from './auth.ts';`).

---

### Task 7: Frontend Analytics & Royalty Hub UI (`AnalyticsHubScreen.tsx`)
- **Files:**
  - Create: `frontend/src/components/AnalyticsHubScreen.tsx`
  - Modify: `frontend/src/App.tsx`
  - Modify: `frontend/src/App.test.ts`
- **Chỉ dẫn:**
  - `AnalyticsHubScreen`:
    - Bộ lọc phạm vi thời gian (Hôm nay, 7 ngày qua, Tháng này, Tùy chỉnh).
    - Thẻ KPI: Doanh thu thuần, Giá vốn COGS, Lợi nhuận gộp & Biên lợi nhuận %, Phí nhượng quyền nộp HQ.
    - Biểu đồ Hourly Heatmap 24 giờ trực quan (thanh bar gradient, highlight các khung giờ vàng 7-9h, 12-13h, 19-21h).
    - Top Sản phẩm bán chạy (Xếp hạng doanh thu, tỷ trọng đóng góp %).
    - Bảng Sổ cái Hóa đơn Phí Nhượng Quyền (Royalty Invoices): Xem trạng thái (Đã phát hành, Đã thanh toán), Nút Tạo hóa đơn tháng mới, Modal chi tiết hóa đơn điện tử in ấn.
  - Tích hợp vào `App.tsx`:
    - Cập nhật `Screen = ... | "analytics"`.
    - Thêm vào `navItems` với icon `BarChart3`.
    - Render `{screen === "analytics" && <AnalyticsHubScreen currentUser={currentUser} />}`.
  - Thêm tests vào `App.test.ts`.
- **Verification:** `npm test` PASS, `npm run build` PASS.

---

### Task 8: Verification & Git Push
- **Chỉ dẫn:**
  - Chạy toàn bộ backend tests: `dotnet test tests/Franchise.UnitTests`.
  - Chạy toàn bộ frontend tests: `npm test`.
  - Chạy build frontend production: `npm run build`.
  - Commit từng task và push sạch lên remote: `git push origin main`.
