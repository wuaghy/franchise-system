# 📚 TỔNG HỢP KIẾN THỨC VÀ TÀI LIỆU ÔN TẬP: ENTERPRISE CLOUD, FULLSTACK & DEVOPS

> **Dự án thực chiến:** Hệ thống Quản trị Chuỗi Nhượng quyền F&B Đa Chi nhánh (Franchise Enterprise System)  
> **Hạ tầng Production:** Oracle Cloud OCI (Ubuntu 24.04 VM) + Vercel Edge Network  
> **Tech Stack cốt lõi:** C# .NET 8 · React 19 + TypeScript · PostgreSQL 16 · Redis 7 · Docker · SignalR WebSockets

---

## MỤC LỤC
1. [Phần 1: Điện Toán Đám Mây & Hạ Tầng Cloud (Oracle Cloud & Vercel)](#phần-1-điện-toán-đám-mây--hạ-tầng-cloud)
2. [Phần 2: Kiến Trúc Backend .NET 8 & Clean Architecture](#phần-2-kiến-trúc-backend-net-8--clean-architecture)
3. [Phần 3: Kỹ Thuật Frontend Hiện Đại (React 19, Vite, Typography & Audio)](#phần-3-kỹ-thuật-frontend-hiện-đại)
4. [Phần 4: Nghiệp Vụ Chuỗi F&B Enterprise & Tích Hợp Thứ Ba](#phần-4-nghiệp-vụ-chuỗi-fb-enterprise--tích-hợp-thứ-ba)
5. [Phần 5: Bộ Câu Hỏi Phỏng Vấn & Ôn Tập Chuyên Sâu](#phần-5-bộ-câu-hỏi-phỏng-vấn--ôn-tập-chuyên-sâu)

---

## PHẦN 1: ĐIỆN TOÁN ĐÁM MÂY & HẠ TẦNG CLOUD

### 1.1. Kiến Trúc Mạng Ảo Oracle Cloud Infrastructure (OCI)
Khi triển khai một ứng dụng lên Oracle Cloud (hoặc AWS VPC / GCP VPC), cần nắm vững các thành phần mạng:
* **VCN (Virtual Cloud Network):** Mạng riêng ảo biệt lập trên cloud. Thường sử dụng dải mạng CIDR `10.0.0.0/16` (cung cấp tới 65,536 địa chỉ IP nội bộ).
* **Internet Gateway:** Cổng định tuyến trung gian kết nối VCN với mạng internet toàn cầu. Không có Internet Gateway, máy ảo không thể nhận hoặc gửi dữ liệu ra bên ngoài.
* **Public Subnet:** Phân vùng mạng công khai (thường là `10.0.0.0/24`). Các máy ảo nằm trong Public Subnet được phép gán địa chỉ **Public IPv4** để truy cập trực tiếp từ internet.
* **Security Lists & Ingress Rules:** Tường lửa cấp độ mạng (Stateful Firewall):
  * **Source CIDR `0.0.0.0/0`**: Cho phép lưu lượng đến từ bất kỳ đâu trên internet.
  * **Destination Port Range**: Mở cổng đích (Ví dụ: `22` cho SSH, `80` cho HTTP, `443` cho HTTPS, `8080` cho Backend API). Lưu ý: Oracle Cloud không chấp nhận dấu phẩy `,` mà dùng số đơn lẻ hoặc dải có gạch ngang `-`.

### 1.2. Bảo Mật SSH Key & Khắc Phục Lỗi Quyền Truy Cập Trên Windows
* **Cơ chế SSH Key Pair:** Bao gồm Public Key (đặt trên máy ảo `~/.ssh/authorized_keys`) và Private Key (giữ bí mật trên máy cá nhân).
* **Lỗi `WARNING: UNPROTECTED PRIVATE KEY FILE! (bad permissions)`**:
  * **Nguyên nhân:** Trên Windows, các file mới tải về thường kế thừa quyền đọc từ nhóm `NT AUTHORITY\Authenticated Users`, dẫn đến vi phạm nguyên tắc bảo mật của OpenSSH (chỉ duy nhất chủ sở hữu file mới có quyền đọc).
  * **Lệnh khắc phục bằng `icacls` trên Windows PowerShell:**
    ```powershell
    $keyPath = "duong_dan_file_key.key"
    # Gỡ bỏ kế thừa quyền và chỉ cấp quyền Đọc (Read) cho người dùng hiện tại
    icacls.exe $keyPath /inheritance:r /grant:r "$($env:USERNAME):(R)"
    ```

### 1.3. Quản Lý Bộ Nhớ Linux & Kỹ Thuật Tạo Swap RAM
* **Vấn đề trên máy ảo tài nguyên giới hạn (1GB RAM):**
  Khi chạy nhiều container (Backend .NET 8, PostgreSQL 16, Redis 7) kết hợp với quá trình biên dịch `dotnet publish`, máy ảo rất dễ bị **Linux OOM Killer (Out-of-Memory Killer)** cưỡng chế tắt tiến trình (`Exit Code 137`).
* **Giải pháp Swap RAM (Bộ nhớ ảo trên ổ SSD):**
  Tạo thêm 4GB Swap giúp mở rộng dung lượng đệm:
  ```bash
  sudo fallocate -l 4G /swapfile      # Cấp phát file 4GB
  sudo chmod 600 /swapfile            # Giới hạn chỉ root được truy cập
  sudo mkswap /swapfile               # Định dạng file swap
  sudo swapon /swapfile               # Kích hoạt swap vào RAM
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab  # Tự động kích hoạt khi reboot
  ```

### 1.4. Tường Lửa Nội Bộ Máy Ảo (`iptables`)
Bên cạnh Security List của nhà cung cấp Cloud, các bản phân phối Linux (như Ubuntu/Oracle Linux) đều có tường lửa nội bộ:
```bash
# Thêm rule mở cổng 8080, 80 vào chuỗi INPUT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8080 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
```

### 1.5. Triển Khai Frontend Trên Vercel & SPA Routing Rewrite
* **Vấn đề SPA (Single Page Application):** React Router sử dụng HTML5 History API để thay đổi URL trên trình duyệt. Khi người dùng F5 hoặc gõ trực tiếp URL dạng `https://domain.com/kds`, web server thông thường sẽ tìm file vật lý `/kds/index.html` và báo **404 Not Found**.
* **Giải pháp `vercel.json`:**
  ```json
  {
    "rewrites": [
      { "source": "/(.*)", "destination": "/index.html" }
    ]
  }
  ```
  Quy tắc này hướng dẫn Vercel chuyển hướng mọi yêu cầu không phải file tĩnh về lại `/index.html` để React Router xử lý định tuyến phía client.

---

## PHẦN 2: KIẾN TRÚC BACKEND .NET 8 & CLEAN ARCHITECTURE

### 2.1. Clean Architecture 4 Tầng
```
                    ┌─────────────────────────────────┐
                    │          Franchise.Api          │
                    │  (Controllers, Hubs, Program)   │
                    └────────────────┬────────────────┘
                                     │
                    ┌────────────────▼────────────────┐
                    │      Franchise.Application      │
                    │    (UseCases, DTOs, Services)   │
                    └────────┬───────────────┬────────┘
                             │               │
        ┌────────────────────▼─────┐   ┌─────▼────────────────────┐
        │     Franchise.Domain     │   │ Franchise.Infrastructure │
        │ (Entities, Enums, Rules) │   │ (EF Core, Redis, Postgres│
        └──────────────────────────┘   └──────────────────────────┘
```
1. **Domain Layer:** Trọng tâm của hệ thống, hoàn toàn không phụ thuộc vào bất kỳ thư viện bên ngoài hay cơ sở dữ liệu nào. Chứa các Entity (`Order`, `Store`, `Ingredient`), Enum, và Domain Logic.
2. **Application Layer:** Chứa logic nghiệp vụ ứng dụng, CQRS Use Cases, interface định nghĩa dịch vụ (`IRealtimeNotificationService`, `ICurrentUserService`).
3. **Infrastructure Layer:** Hiện thực hóa các interface từ tầng Application: kết nối cơ sở dữ liệu EF Core (`AppDbContext`), Redis Caching, gọi SMTP Email, xử lý Outbox background worker.
4. **Api Layer:** Điểm vào (Entry point) tiếp nhận HTTP Request, WebSocket kết nối, cấu hình Middleware pipeline và Dependency Injection.

### 2.2. Transactional Outbox Pattern & Chống Trùng Đơn (Idempotency)
* **Bài toán:** Khi quầy POS bị mất kết nối internet, nhân viên vẫn cần thanh toán cho khách. Khi có mạng trở lại, việc gửi đồng loạt đơn hàng có thể gây ra hiện tượng gửi lặp (Duplicate Request) hoặc mất tính nhất quán giữa đơn hàng và kho.
* **Giải pháp:**
  1. **Idempotency Key:** Mỗi đơn hàng sinh ra một mã khóa bất biến duy nhất (`IdempotencyKey` UUID). Khi Backend nhận đơn, kiểm tra bảng `IdempotencyRecords`: nếu khóa đã tồn tại thì bỏ qua (Status: `DuplicateSkipped`), nếu chưa thì tiến hành xử lý.
  2. **Transactional Outbox:** Đơn hàng và sự kiện trừ kho được lưu trong cùng một Database Transaction. Khi transaction commit thành công, một bản tin sự kiện được đẩy vào bảng `OutboxMessages` để background worker xử lý tiếp theo mà không làm nghẽn quầy thu ngân.

### 2.3. Realtime SignalR Hubs & WebSockets
* **Cơ chế hoạt động:** SignalR ưu tiên sử dụng giao thức **WebSockets** hai chiều (Full-Duplex) với độ trễ thấp (<10ms). Nếu môi trường mạng chặn WebSockets, SignalR tự động fallback về **Server-Sent Events** hoặc **Long Polling**.
* **Phân vùng kênh (Groups):**
  * `JoinStore(storeId)`: Phân phối thông báo vé món KDS và cảnh báo tồn kho riêng cho từng chi nhánh.
  * `JoinHQ()`: Phân phối doanh thu toàn hệ thống cho ban lãnh đạo.
* **Xác thực JWT trên SignalR:** Do chuẩn WebSockets trên trình duyệt không hỗ trợ tùy biến header `Authorization`, token được truyền qua Query String `?access_token=...` và được middleware JwtBearer bóc tách tại sự kiện `OnMessageReceived`.

### 2.4. Tính Phục Hồi & Chuẩn Đoán Sản Xuất (Production Observability)
* **RFC 9110 / RFC 7807 ProblemDetails:** Định dạng lỗi chuẩn hóa cho toàn bộ API (chứa `type`, `title`, `status`, `detail`, `instance`, `traceId`).
* **Health Checks:** Cung cấp 2 endpoint:
  * `/health`: Liveness probe (kiểm tra ứng dụng có đang sống không).
  * `/health/ready`: Readiness probe (kiểm tra kết nối đến Database và Redis đã sẵn sàng chưa).
* **Auto-Migration:** Tự động chạy `dbContext.Database.Migrate()` khi khởi động ứng dụng trong container, giúp cơ sở dữ liệu luôn khớp với phiên bản mã nguồn mới nhất mà không cần can thiệp thủ công.

---

## PHẦN 3: KỸ THUẬT FRONTEND HIỆN ĐẠI

### 3.1. Cấu Hình Endpoint Động (Environment Variables vs Proxy)
* **Vấn đề:** Trong môi trường Dev, Frontend chạy cổng `3000` gọi `/api` được Vite Dev Server proxy về `http://localhost:5000`. Nhưng khi đưa lên Vercel, ứng dụng là các file tĩnh chạy trên Edge CDN, gọi tương đối `/api` sẽ dẫn đến lỗi 404.
* **Giải pháp cấu hình tập trung (`frontend/src/config/api.ts`):**
  ```typescript
  export const BACKEND_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  export const API_BASE = `${BACKEND_URL}/api`;
  export const HUB_URL = `${BACKEND_URL}/hubs/franchise`;
  ```
  * Khi deploy Vercel: Cấu hình `VITE_API_URL=http://192.9.185.53:8080` $\rightarrow$ gọi thẳng đến Oracle Cloud.
  * Khi chạy local: Để trống $\rightarrow$ tự động dùng relative path `/api` qua proxy.

### 3.2. Bộ Giải Mã Âm Thanh Web Audio API & Trí Tuệ Nhân Tạo TTS
* **Tại sao không dùng file âm thanh MP3 tĩnh?** File MP3 phụ thuộc vào đường truyền mạng, có thể tải chậm, bị chặn trình duyệt hoặc lỗi 404.
* **Bộ tổng hợp âm thanh Web Audio API (Synthesizer):**
  Sử dụng các đối tượng `AudioContext`, `OscillatorNode` và `GainNode` để tự tổng hợp sóng âm hình sin đa âm sắc (Melodic Chime) với tần số nốt nhạc chuẩn (`F5 698.46Hz`, `A5 880Hz`, `C6 1046.5Hz`), tạo chuông báo vang êm ái như thiết bị POS chuyên dụng.
* **Web Speech API (`speechSynthesis`):**
  Sử dụng engine tổng hợp giọng nói bản địa của trình duyệt với thiết lập `utterance.lang = 'vi-VN'` để phát âm thanh thông báo tiếng Việt tự nhiên: *"Đơn hàng mới từ khách hàng trực tuyến"*.

### 3.3. Xử Lý Font Chữ & Hiển Thị Tiếng Việt Chuẩn (Typography)
* **Hiện tượng lỗi font tiếng Việt (Font fallback):** Khi font chữ hệ thống không có đầy đủ bộ dấu thanh tiếng Việt (huyền, sắc, hỏi, ngã, nặng, ơ, ư, ă, đ), trình duyệt sẽ mượn tạm ký tự từ font Arial hoặc Times New Roman, tạo cảm giác chữ bị lệch chân hoặc gãy nét.
* **Khắc phục:**
  1. Tích hợp font **`Be Vietnam Pro`** (font chữ hình học thiết kế chuyên biệt cho tiếng Việt) từ Google Fonts.
  2. Khai báo chuỗi dự phòng hoàn chỉnh trong CSS:
     ```css
     --font-sans: "Be Vietnam Pro", "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
     ```

---

## PHẦN 4: NGHIỆP VỤ CHUỖI F&B ENTERPRISE & TÍCH HỢP THỨ BA

### 4.1. Tích Hợp VietQR Napas 247 Động
* Sử dụng chuẩn VietQR sinh mã thanh toán tức thì:
  * Ngân hàng: **VietinBank** (Mã ngân hàng: `ICB` / `vietinbank`)
  * Số tài khoản: `100878137043`
  * Tên chủ tài khoản: `NGUYEN QUANG HUY`
  * Cấu trúc URL động:
    `https://img.vietqr.io/image/vietinbank-100878137043-compact2.png?amount={SốTiền}&addInfo={MãĐơn}&accountName=NGUYEN%20QUANG%20HUY`
* Khách hàng quét mã trên bất kỳ ứng dụng ngân hàng nào (Vietcombank, MB, Techcombank, MoMo) đều tự động điền sẵn số tiền và nội dung chuyển khoản chính xác 100%.

### 4.2. Bảo Mật Xác Thực 2 Lớp (Gmail SMTP OTP)
* **Cơ chế OTP 6 chữ số:**
  1. Khi người dùng yêu cầu đăng nhập bằng email, hệ thống sinh ngẫu nhiên số có 6 chữ số (`RandomNumberGenerator.GetInt32(100000, 1000000)`).
  2. Lưu mã vào bộ nhớ đệm (MemoryCache / Redis) với thời gian hết hạn (TTL) là **5 phút**.
  3. Gửi email qua giao thức SMTP của Google với mật khẩu ứng dụng (App Password).
  4. Người dùng nhập mã $\rightarrow$ đối soát mã trong cache $\rightarrow$ sinh JWT Access Token đăng nhập.

### 4.3. Quản Lý Chuỗi Cung Ứng & Lệch Kho (STO - Stock Transfer Orders)
Quy trình điều chuyển kho tổng 6 bước chuẩn kiểm toán:
1. `Draft`: Chi nhánh lập phiếu yêu cầu xin nguyên vật liệu.
2. `Submitted`: Trình duyệt lên Giám đốc chuỗi cung ứng.
3. `Approved`: Kho tổng phê duyệt số lượng cấp phát.
4. `Dispatched`: Kho tổng xuất hàng và bàn giao đơn vị vận chuyển (trừ tồn kho kho tổng).
5. `Received`: Chi nhánh nhận hàng, kiểm đếm thực tế (cộng tồn kho chi nhánh).
6. `DiscrepancyReported`: Nếu số lượng thực nhận khác số lượng xuất (ví dụ vỡ, hỏng trên đường), hệ thống tự sinh biên bản giải trình để bộ phận kho lập phương án xử lý.

### 4.4. Định Lượng BoM (Bill of Materials) & Tính Giá Vốn COGS
* **Công thức COGS (Cost of Goods Sold):**  
  $$\text{COGS} = \sum (\text{Định lượng nguyên liệu } i \times \text{Đơn giá nguyên liệu } i)$$
* **Tỷ lệ giá vốn (Cost Share %):**  
  $$\text{Tỷ lệ COGS} = \frac{\text{Tổng COGS}}{\text{Giá bán chưa VAT}} \times 100\%$$
* Trong ngành F&B, tỷ lệ COGS lý tưởng thường dao động từ **25% – 32%** để đảm bảo biên lợi nhuận bù đắp cho chi phí mặt bằng, nhân công và khấu hao thiết bị.

---

## PHẦN 5: BỘ CÂU HỎI PHỎNG VẤN & ÔN TẬP CHUYÊN SÂU

### Câu 1: Làm thế nào bạn giải quyết bài toán quầy POS bán hàng khi bị mất kết nối mạng (Network Partition)?
> **Trả lời:** Em áp dụng kiến trúc **Offline-First với Outbox Pattern và Idempotency Key**. Phía Frontend lưu trữ danh sách đơn hàng vào hàng đợi `localStorage`. Mỗi đơn được gắn một `IdempotencyKey` UUID duy nhất. Khi kết nối mạng phục hồi, dịch vụ đồng bộ ngầm gửi gói tin `BulkSync` lên Backend. Backend sử dụng Database Transaction để kiểm tra: nếu khóa đã tồn tại thì bỏ qua, nếu chưa có thì ghi nhận đơn và trừ kho. Nhờ đó, thu ngân phục vụ khách liên tục mà không lo mất đơn hay trùng lặp doanh thu.

### Câu 2: Tại sao máy ảo 1GB RAM trên Oracle Cloud lại cần cấu hình Swap, và nếu không có Swap thì điều gì sẽ xảy ra?
> **Trả lời:** Khi chạy cùng lúc PostgreSQL, Redis và .NET 8 Kestrel Web API, tổng dung lượng bộ nhớ vật lý yêu cầu có thể vượt ngưỡng 900MB (đặc biệt trong giai đoạn Docker build layer). Nếu không có Swap, nhân Linux sẽ kích hoạt **OOM Killer** để giải phóng bộ nhớ bằng cách gửi tín hiệu `SIGKILL` dừng đột ngột container của backend. Bằng việc cấp phát 4GB Swap trên ổ đĩa SSD NVMe của Oracle Cloud, hệ thống có một vùng đệm an toàn để hoán đổi các trang bộ nhớ ít sử dụng, giúp máy ảo chạy ổn định với tải cao mà không bao giờ bị sập.

### Câu 3: Làm thế nào để ngăn chặn lỗi Mixed Content khi Frontend chạy HTTPS trên Vercel và Backend chạy HTTP trên IP máy ảo?
> **Trả lời:** Có hai phương án giải quyết:
> 1. **Phương án 1 (Vercel Server-Side Rewrites):** Trong file `vercel.json`, cấu hình rewrite các đường dẫn `/api/:path*` trỏ về IP Backend. Khi đó trình duyệt chỉ gọi tới domain HTTPS của Vercel, và máy chủ Vercel sẽ thay mặt client gọi HTTP về backend phía sau, loại bỏ hoàn toàn lỗi Mixed Content.
> 2. **Phương án 2 (Reverse Proxy với Nginx & SSL Certbot):** Cấu hình Nginx trên máy ảo Linux làm reverse proxy, trỏ một tên miền hoặc dynamic DNS và cấp chứng chỉ SSL Let's Encrypt miễn phí để mở cổng HTTPS trực tiếp cho Backend.

---
*Tài liệu được biên soạn phục vụ học tập, ôn tập kiến trúc hệ thống và bảo vệ dự án chuyên nghiệp.*
