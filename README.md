# 🏪 Enterprise Franchise Management System

[![CI Backend](https://github.com/wuaghy/franchise-system/actions/workflows/ci-backend.yml/badge.svg?branch=main)](https://github.com/wuaghy/franchise-system/actions/workflows/ci-backend.yml)
[![CI Frontend](https://github.com/wuaghy/franchise-system/actions/workflows/ci-frontend.yml/badge.svg?branch=main)](https://github.com/wuaghy/franchise-system/actions/workflows/ci-frontend.yml)
[![Docker CD](https://github.com/wuaghy/franchise-system/actions/workflows/cd-docker-publish.yml/badge.svg?branch=main)](https://github.com/wuaghy/franchise-system/actions/workflows/cd-docker-publish.yml)
[![K3s Deploy CD](https://github.com/wuaghy/franchise-system/actions/workflows/cd-k3s-deploy.yml/badge.svg?branch=main)](https://github.com/wuaghy/franchise-system/actions/workflows/cd-k3s-deploy.yml)
[![Tests](https://img.shields.io/badge/Automated_Tests-126_Backend_+_24_Frontend_Passing-brightgreen?logo=checkmarx&logoColor=white)](https://github.com/wuaghy/franchise-system/actions)

[![Backend Platform](https://img.shields.io/badge/.NET_8-ASP.NET_Core_Web_API-512BD4?logo=dotnet&logoColor=white)](https://dotnet.microsoft.com/)
[![Frontend Platform](https://img.shields.io/badge/Frontend-React_19_Vite_TS-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL_16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Caching](https://img.shields.io/badge/Cache-Redis_7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Cloud OCI](https://img.shields.io/badge/Cloud-Oracle_Cloud_Always_Free-F80000?logo=oracle&logoColor=white)](https://cloud.oracle.com/)
[![Cloud Vercel](https://img.shields.io/badge/Edge-Vercel_Deployment-000000?logo=vercel&logoColor=white)](https://vercel.com/)
[![Realtime](https://img.shields.io/badge/Realtime-SignalR_WebSockets-512BD4?logo=signal&logoColor=white)](https://dotnet.microsoft.com/apps/aspnet/signalr)

Hệ thống Quản trị Chuỗi Cửa hàng Nhượng quyền Đa Chi nhánh (**Enterprise Franchise & Multi-Store Management System**) xây dựng theo chuẩn **Clean Architecture 4 Tầng**, phục vụ vận hành chuỗi F&B từ **Quầy Thu ngân POS Offline Outbox**, **Điều phối pha chế KDS**, **Cung ứng kho tổng STO**, **Tính toán chi phí COGS & BoM**, đến **Khai thác Báo cáo Doanh thu & Thu phí nhượng quyền (Royalty)**.

---

## 🌐 Trạng Thái Triển Khai Production (Live Deployment)

| Thành phần | Nền tảng | Địa chỉ truy cập / Endpoint | Trạng thái |
| :--- | :--- | :--- | :---: |
| **Frontend Portal** | **Vercel** (Global Edge CDN) | `https://franchise-system.vercel.app` | 🟢 **Production Ready** |
| **Backend Web API** | **Oracle Cloud OCI** (Ubuntu 24.04 VM) | `http://192.9.185.53:8080` | 🟢 **Healthy (200 OK)** |
| **SignalR Realtime Hub** | **Oracle Cloud OCI** | `http://192.9.185.53:8080/hubs/franchise` | 🟢 **Connected** |
| **Database & Cache** | **Docker trên OCI VM** | PostgreSQL 16 Alpine + Redis 7 Alpine | 🟢 **Healthy** |
| **Swagger API Docs** | **Oracle Cloud OCI** | `http://192.9.185.53:8080/swagger` | 🟢 **Active** |

---

## 🏛️ Kiến Trúc Hệ Thống (Clean Architecture & Micro-Modules)

```
franchise-system/
├── src/
│   ├── Franchise.Domain/          # Core Domain Entities, Aggregate Roots, Enums, Value Objects
│   ├── Franchise.Application/     # CQRS Use Cases, Commands, Queries, DTOs, Event Handlers
│   ├── Franchise.Infrastructure/  # EF Core 8, Npgsql, Redis Cache, Outbox Worker, Migrations
│   └── Franchise.Api/             # ASP.NET Core 8 API, SignalR Hub, Middlewares, HealthChecks
├── frontend/                      # React 19 + TypeScript + Vite + Tailwind CSS v4 + Framer Motion
├── k8s/                           # Kubernetes / K3s Production Manifests (Deployment, Service, Ingress)
├── tests/                         # 120 Backend Tests (Unit + Integration) & 13 Frontend Tests
└── docker-compose.yml             # Orchestration cho Postgres, Redis, Backend & Frontend
```

---

## ✨ Các Tính Năng Nổi Bật (Enterprise Features)

### 1. Cổng Đăng Nhập Đa Phương Thức (Enterprise Auth & 2FA)
* **JWT Authentication**: Cơ chế Access Token (Bearer) & Refresh Token an toàn.
* **Google OAuth 2.0**: Xác thực một chạm với Client ID chuẩn Google Cloud Identity.
* **Gmail SMTP OTP 2FA**: Gửi mã xác thực 6 chữ số qua email (TTL 5 phút, mẫu email HTML thương hiệu cao cấp).
* **Role-Based Access Control (RBAC)**: Phân quyền chặt chẽ giữa `HQ_SuperAdmin`, `Franchise_Owner`, `Store_Manager`, `POS_Cashier`, và `Supply_Chain_Officer`.

### 2. Quầy Bán Hàng POS & Chống Mất Dữ Liệu Ngoại Tuyến (Offline Outbox Pattern)
* **Local Queue & Idempotency**: Bán hàng không gián đoạn ngay cả khi rớt mạng; lưu hàng đợi trên trình duyệt và tự động đồng bộ (Bulk Sync) khi có mạng trở lại với khóa `IdempotencyKey`.
* **VietQR Napas 247**: Tích hợp mã QR động sinh tức thì theo chuẩn ngân hàng VietinBank (`100878137043` - `NGUYEN QUANG HUY`).
* **Webhook Tự Động Nhận Tiền (PayOS & Casso)**: Bắt biến động số dư ngân hàng qua Webhook, xác thực HMAC-SHA256, truyền tín hiệu SignalR tức thì về quầy POS tự động in hóa đơn và hoàn tất đơn (thu ngân không cần thao tác bấm tay).
* **Trừ Kho Tự Động**: Đơn thanh toán hoàn tất kích hoạt trừ nguyên vật liệu theo định lượng BoM thực tế.

### 3. Kitchen Display System (KDS) & Chuông Báo Âm Thanh Nổi Realtime
* **SignalR WebSockets**: Cập nhật trạng thái vé pha chế tức thì giữa thu ngân và quầy Barista.
* **Đếm Ngược SLA Thông Minh**: Cảnh báo đổi màu vé (Xanh `< 5p`, Vàng `5-10p`, Đỏ `> 10p`).
* **Web Audio API Synthesizer & TTS Voice**: Bộ giải mã âm thanh tổng hợp đa âm sắc (Melodic Chime) và giọng đọc trí tuệ nhân tạo Tiếng Việt thông báo *"Đơn hàng mới từ khách hàng trực tuyến"*.

### 4. BoM Studio & Phân Tích Lợi Nhuận COGS (Cost of Goods Sold)
* **What-If Simulation**: Mô phỏng sự biến động giá vốn món khi giá nguyên liệu trên thị trường thay đổi trước khi áp dụng chính thức.
* **Công Thức Đa Tầng**: Tách bạch chi phí từng gram/ml nguyên liệu, chiết khấu và biên lợi nhuận ròng.

### 5. Chuỗi Cung Ứng & Điều Chuyển Kho Tổng (Stock Transfer Orders - STO)
* **Quy Trình 6 Bước Chuẩn Mực**: `Draft` ➔ `Submitted` ➔ `Approved` ➔ `Dispatched` ➔ `Received` ➔ `DiscrepancyReported`.
* **Xử Lý Lệch Kho Tự Động**: Bắt chênh lệch thực tế khi kiểm đếm hàng giao nhận, hỗ trợ lập biên bản giải trình và bù trừ kho tự động.

### 6. Báo Cáo Doanh Thu BI & Thu Phí Nhượng Quyền (Royalty Invoicing)
* **Biểu Đồ Nhiệt 24 Giờ (Hourly Heatmap)**: Phân tích khung giờ vàng bán hàng trong ngày.
* **Động Cơ Xuất Hóa Đơn Phí Nhượng Quyền**: Tự động tính phí doanh thu (`RevenueFee`) và phí tiếp thị (`MarketingFee`) cho toàn bộ chi nhánh định kỳ hàng tháng.

---

## 🚀 Hướng Dẫn Khởi Chạy Nhanh (Local & Cloud)

### 1. Khởi chạy bằng Docker Compose (Khuyên dùng)
```bash
# Clone repo
git clone https://github.com/wuaghy/franchise-system.git
cd franchise-system

# Khởi chạy toàn bộ hệ thống (Postgres, Redis, Backend)
docker compose up -d --build
```
* **Backend API & Swagger**: `http://localhost:8080/swagger`
* **Health Check**: `http://localhost:8080/health`

### 2. Chạy Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
* Truy cập giao diện tại: `http://localhost:3000`

### 3. Triển khai lên cụm Kubernetes (K3s / k3d)
```powershell
# Tạo cluster k3d
k3d cluster create franchise-cluster --port 8080:80@loadbalancer

# Nạp image và apply manifests
k3d image import franchise-backend:local -c franchise-cluster
kubectl apply -f k8s/
```

---

## 🧪 Kiểm Thử Hệ Thống (Test Suites)

Toàn bộ hệ thống được bảo vệ bởi bộ kiểm thử tự động toàn diện:

```powershell
# Chạy toàn bộ 126 bài test Backend (.NET 8)
dotnet test

# Chạy toàn bộ 24 bài test Frontend (Node test runner)
cd frontend
npm test
```

* **Backend Test Result**: `125 Unit Tests + 1 Integration Test (100% Passed)`.
* **Frontend Test Result**: `24 Tests (100% Passed)`.

---

## 📋 Danh Sách Cổng Truy Cập (Portals & Screens)

1. **Trang Chủ (Landing Portal)**: Tổng quan giải pháp, trạng thái đám mây và cổng chọn vai trò làm việc.
2. **Khách Đặt Món (Customer Self-Service)**: Menu điện tử, quét VietQR Napas 247 và tự động kích hoạt chuông báo đơn mới.
3. **Quầy Thu Ngân (POS Terminal)**: Bán hàng chạm, quét QR, hỗ trợ Offline Outbox Sync.
4. **Màn Hình Bếp (Kitchen Display KDS)**: Nhận vé món realtime, đếm ngược SLA pha chế.
5. **Chuỗi Cung Ứng (Supply Chain STO)**: Điều chuyển kho tổng, kiểm đếm hàng giao nhận.
6. **BoM Studio**: Định lượng công thức, mô phỏng COGS và biên lợi nhuận món.
7. **Chi Nhánh (Store Network)**: Quản lý danh sách cửa hàng nhượng quyền và doanh số.
8. **Kho Hàng (Live Inventory)**: Theo dõi tồn kho thực tế và cảnh báo thiếu hàng.
9. **Báo Cáo & Phí HQ (Business Intelligence)**: Biểu đồ nhiệt 24h, phát hành hóa đơn thu phí Royalty.

---

## 📄 Bản Quyền & Giấy Phép
Dự án được xây dựng và phát triển phục vụ mục đích học tập, nghiên cứu và triển khai thực tế giải pháp nhượng quyền F&B chuẩn Enterprise.
