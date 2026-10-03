# 🏪 Franchise Management System

Hệ thống Quản lý Chuỗi Cửa hàng Nhượng quyền Đa Chi nhánh (Franchise Management System) được xây dựng theo kiến trúc **Clean Architecture** trên nền tảng **.NET 8 Web API**, tích hợp cơ sở dữ liệu **PostgreSQL**, quản trị container bằng **Docker** và điều phối hạ tầng trên **Kubernetes (K3s)**.

---

## 🏛️ Kiến Trúc Hệ Thống (Clean Architecture 4 Tầng)

```plaintext
Franchise.Api (Controllers, Middlewares, DI, Program.cs)
  └── Franchise.Application (CQRS, Use Cases, Interfaces, DTOs)
        └── Franchise.Domain (Entities, Enums, Value Objects)
  └── Franchise.Infrastructure (EF Core, AppDbContext, PostgreSQL, Configurations)
```

### 6 Phân Hệ Dữ Liệu Cốt Lõi (OLTP):
1. **Franchise & Organization**: Quản lý chủ đầu tư nhượng quyền (`Franchisee`), chi nhánh (`Store`), nhân sự (`StoreUser`).
2. **Catalog & Recipe (BoM)**: Danh mục món (`Category`), sản phẩm (`Product`), bảng giá theo vùng (`StoreProductPrice`), nguyên vật liệu (`Ingredient`), định lượng công thức (`ProductRecipe` phục vụ tính COGS).
3. **Inventory & Supply Chain**: Tồn kho tức thời (`StoreInventory`), sổ cái biến động kho bất biến (`InventoryTransaction` Append-Only).
4. **Orders & Payments**: Khách hàng (`Customer`), đơn hàng (`Order`), chi tiết món (`OrderItem`), tùy chọn/topping (`OrderItemModifier`), thanh toán đa kênh (`Payment`).
5. **Resiliency & CDC**: Hàng đợi tin nhắn tin cậy (`OutboxMessage`), chống trùng đơn quầy POS (`IdempotencyRecord`).

---

## 🚀 Công Nghệ Sử Dụng

- **Backend**: C# .NET 8 (Web API, Entity Framework Core 8, Npgsql)
- **Database**: PostgreSQL 16
- **Architecture**: Clean Architecture, RESTful API (RFC 7807 Problem Details)
- **DevOps & Infrastructure**: Docker, Docker Compose, Kubernetes (K3s / k3d), Traefik Ingress
- **CI/CD**: GitHub Actions (CI Backend, CI Frontend, CD Docker Publish, CD K3s Deploy)

---

## 🛠️ Hướng Dẫn Khởi Chạy Nhanh

### 1. Yêu cầu hệ thống
- .NET 8 SDK
- Docker Desktop
- k3d / kubectl (nếu triển khai Kubernetes)

### 2. Chạy ứng dụng nội bộ (Local Development)
```powershell
# Restore và build solution
dotnet build

# Chạy project Web API
dotnet run --project src/Franchise.Api
```
Truy cập Swagger UI tại: `http://localhost:8080/swagger` (hoặc port do Kestrel chỉ định).

### 3. Triển khai bằng Kubernetes (K3s / k3d)
```powershell
# 1. Tạo cụm K3d
k3d cluster create franchise-cluster --port 8080:80@loadbalancer

# 2. Build Docker image
docker build -t franchise-backend:local .

# 3. Nạp image vào cụm k3d
k3d image import franchise-backend:local -c franchise-cluster

# 4. Áp dụng toàn bộ Manifests
kubectl apply -f k8s/
```
Truy cập API qua cổng Ingress: `http://localhost:8080/swagger`.

---

## 📄 License
Dự án được phát triển cho mục đích học tập và xây dựng hệ thống nhượng quyền tiêu chuẩn Enterprise.
