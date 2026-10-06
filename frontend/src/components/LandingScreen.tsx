import { motion } from "framer-motion";
import {
  Sparkles,
  LayoutGrid,
  Coffee,
  Truck,
  Building2,
  QrCode,
  ShieldCheck,
  Zap,
  TrendingUp,
  ShoppingBag,
  ArrowRight,
  Server,
  Cloud,
  CheckCircle2,
  Users,
} from "lucide-react";

interface LandingScreenProps {
  onNavigate: (screen: "stores" | "inventory" | "transfers" | "bom-studio" | "pos" | "kds" | "analytics" | "customer") => void;
  openLogin: () => void;
}

export function LandingScreen({ onNavigate, openLogin }: LandingScreenProps) {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 lg:px-8">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-red-100 bg-gradient-to-br from-white via-red-50/40 to-white p-8 lg:p-14 shadow-sm"
      >
        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-100/60 px-3.5 py-1 text-xs font-bold text-red-800 backdrop-blur-md mb-6">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Hệ thống Đám mây Trực tuyến · Oracle Cloud OCI & Vercel Ready</span>
          </div>

          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl lg:leading-[1.15]">
            Nền Tảng Quản Trị Chuỗi Nhượng Quyền{" "}
            <span className="bg-gradient-to-r from-red-700 via-rose-600 to-amber-600 bg-clip-text text-transparent">
              F&B Enterprise
            </span>
          </h1>

          <p className="mt-5 text-base text-slate-600 sm:text-lg lg:text-xl font-normal leading-relaxed max-w-3xl">
            Giải pháp số hóa toàn diện từ Quầy bán hàng POS Offline Outbox, Điều phối pha chế KDS, 
            Chuỗi cung ứng STO kho tổng đến Tính toán phí nhượng quyền (Royalty) & Chuông báo âm thanh thời gian thực.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3 sm:gap-4">
            <button
              onClick={() => onNavigate("customer")}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-red-700 to-rose-700 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-900/20 hover:from-red-800 hover:to-rose-800 transition active:scale-95"
            >
              <ShoppingBag size={18} />
              <span>Khách Hàng Đặt Món Online</span>
              <ArrowRight size={16} />
            </button>
            <button
              onClick={() => onNavigate("pos")}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 transition active:scale-95"
            >
              <LayoutGrid size={18} className="text-red-700" />
              <span>Vào Quầy Thu Ngân POS</span>
            </button>
            <button
              onClick={() => onNavigate("analytics")}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 transition active:scale-95"
            >
              <TrendingUp size={18} className="text-emerald-600" />
              <span>Báo Cáo Doanh Thu & Royalty</span>
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="mt-12 grid grid-cols-2 gap-4 border-t border-slate-200/80 pt-8 sm:grid-cols-4">
            <div>
              <div className="text-2xl font-black text-slate-900">120/120</div>
              <div className="text-xs font-semibold text-slate-500">Unit & Integration Tests Pass</div>
            </div>
            <div>
              <div className="text-2xl font-black text-red-700">100% Napas</div>
              <div className="text-xs font-semibold text-slate-500">VietQR 247 Động Tức thì</div>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">&lt; 10ms</div>
              <div className="text-xs font-semibold text-slate-500">SignalR WebSockets Latency</div>
            </div>
            <div>
              <div className="text-2xl font-black text-emerald-600">Zero OOM</div>
              <div className="text-xs font-semibold text-slate-500">Oracle Cloud 4GB Swap RAM</div>
            </div>
          </div>
        </div>

        {/* Decorative Background Blob */}
        <div className="pointer-events-none absolute -right-20 -top-20 size-96 rounded-full bg-red-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-40 size-80 rounded-full bg-amber-500/10 blur-3xl" />
      </motion.div>

      {/* Role Gateways Section */}
      <div className="mt-12">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              Cổng Truy Cập Theo Vai Trò (Role Gateways)
            </h2>
            <p className="mt-1 text-sm text-slate-500 font-medium">
              Lựa chọn cổng làm việc phù hợp cho nhân viên, quản lý hoặc khách hàng tự phục vụ
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* 1. Customer Ordering */}
          <motion.div
            whileHover={{ y: -4 }}
            className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-7 shadow-sm transition hover:border-red-200 hover:shadow-md"
          >
            <div>
              <div className="flex size-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700 font-black mb-5 group-hover:bg-red-700 group-hover:text-white transition">
                <ShoppingBag size={24} />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-rose-700">Dành Cho Khách Hàng</span>
              <h3 className="mt-1 text-xl font-black text-slate-900">Customer Digital Menu & Kiosk</h3>
              <p className="mt-2.5 text-sm text-slate-600 leading-relaxed font-normal">
                Xem menu đồ uống, tùy chọn đường đá topping, quét mã VietQR Napas thanh toán và tự động phát tín hiệu chuông về quầy pha chế.
              </p>
            </div>
            <button
              onClick={() => onNavigate("customer")}
              className="mt-6 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-xs font-bold text-slate-800 group-hover:bg-red-700 group-hover:text-white transition"
            >
              <span>Trải nghiệm Đặt món Khách</span>
              <ArrowRight size={16} />
            </button>
          </motion.div>

          {/* 2. POS Cashier */}
          <motion.div
            whileHover={{ y: -4 }}
            className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-7 shadow-sm transition hover:border-red-200 hover:shadow-md"
          >
            <div>
              <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 font-black mb-5 group-hover:bg-amber-600 group-hover:text-white transition">
                <LayoutGrid size={24} />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-700">Dành Cho Nhân Viên Thu Ngân</span>
              <h3 className="mt-1 text-xl font-black text-slate-900">Quầy Bán Hàng POS Terminal</h3>
              <p className="mt-2.5 text-sm text-slate-600 leading-relaxed font-normal">
                Bán hàng chạm cực nhạy, hỗ trợ Offline Outbox Pattern tự lưu đơn khi mất mạng, tự động trừ kho nguyên liệu theo BoM công thức.
              </p>
            </div>
            <button
              onClick={() => onNavigate("pos")}
              className="mt-6 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-xs font-bold text-slate-800 group-hover:bg-amber-600 group-hover:text-white transition"
            >
              <span>Mở Quầy Thu Ngân POS</span>
              <ArrowRight size={16} />
            </button>
          </motion.div>

          {/* 3. Kitchen Barista KDS */}
          <motion.div
            whileHover={{ y: -4 }}
            className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-7 shadow-sm transition hover:border-red-200 hover:shadow-md"
          >
            <div>
              <div className="flex size-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-700 font-black mb-5 group-hover:bg-orange-600 group-hover:text-white transition">
                <Coffee size={24} />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-orange-700">Dành Cho Barista & Bếp</span>
              <h3 className="mt-1 text-xl font-black text-slate-900">Màn Hình Điều Phối Bếp KDS</h3>
              <p className="mt-2.5 text-sm text-slate-600 leading-relaxed font-normal">
                Nhận vé pha chế tức thì qua SignalR, đếm ngược thời gian SLA cảnh báo màu sắc, toggle từng topping và chuông báo khi có đơn mới.
              </p>
            </div>
            <button
              onClick={() => onNavigate("kds")}
              className="mt-6 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-xs font-bold text-slate-800 group-hover:bg-orange-600 group-hover:text-white transition"
            >
              <span>Vào Màn Hình KDS</span>
              <ArrowRight size={16} />
            </button>
          </motion.div>

          {/* 4. Supply Chain STO */}
          <motion.div
            whileHover={{ y: -4 }}
            className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-7 shadow-sm transition hover:border-red-200 hover:shadow-md"
          >
            <div>
              <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 font-black mb-5 group-hover:bg-blue-600 group-hover:text-white transition">
                <Truck size={24} />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-blue-700">Dành Cho Kho Vận Cung Ứng</span>
              <h3 className="mt-1 text-xl font-black text-slate-900">Chuỗi Cung Ứng & Điều Chuyển STO</h3>
              <p className="mt-2.5 text-sm text-slate-600 leading-relaxed font-normal">
                Quy trình điều chuyển kho tổng 6 bước chuẩn mực, nhập xuất kho an toàn, lập biên bản tự động và xử lý chênh lệch hàng giao nhận.
              </p>
            </div>
            <button
              onClick={() => onNavigate("transfers")}
              className="mt-6 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-xs font-bold text-slate-800 group-hover:bg-blue-600 group-hover:text-white transition"
            >
              <span>Quản Lý Điều Chuyển STO</span>
              <ArrowRight size={16} />
            </button>
          </motion.div>

          {/* 5. BoM Studio */}
          <motion.div
            whileHover={{ y: -4 }}
            className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-7 shadow-sm transition hover:border-red-200 hover:shadow-md"
          >
            <div>
              <div className="flex size-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-700 font-black mb-5 group-hover:bg-purple-600 group-hover:text-white transition">
                <Sparkles size={24} />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-purple-700">Dành Cho Bếp Trưởng & Tài Chính</span>
              <h3 className="mt-1 text-xl font-black text-slate-900">BoM Studio & Định Lượng COGS</h3>
              <p className="mt-2.5 text-sm text-slate-600 leading-relaxed font-normal">
                Mô phỏng kịch bản What-If khi giá nguyên liệu biến động, tính toán chính xác chi phí từng gram/ml và tối ưu biên lợi nhuận món.
              </p>
            </div>
            <button
              onClick={() => onNavigate("bom-studio")}
              className="mt-6 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-xs font-bold text-slate-800 group-hover:bg-purple-600 group-hover:text-white transition"
            >
              <span>Vào BoM Studio</span>
              <ArrowRight size={16} />
            </button>
          </motion.div>

          {/* 6. HQ Admin & BI */}
          <motion.div
            whileHover={{ y: -4 }}
            className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-7 shadow-sm transition hover:border-red-200 hover:shadow-md"
          >
            <div>
              <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 font-black mb-5 group-hover:bg-emerald-600 group-hover:text-white transition">
                <TrendingUp size={24} />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Dành Cho Chủ Chuỗi (Franchise Owner)</span>
              <h3 className="mt-1 text-xl font-black text-slate-900">Báo Cáo Tài Chính & Phí Royalty</h3>
              <p className="mt-2.5 text-sm text-slate-600 leading-relaxed font-normal">
                Biểu đồ nhiệt doanh thu 24 giờ, xếp hạng món bán chạy, tự động kết toán và phát hành hóa đơn thu phí nhượng quyền hàng tháng.
              </p>
            </div>
            <button
              onClick={() => onNavigate("analytics")}
              className="mt-6 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-xs font-bold text-slate-800 group-hover:bg-emerald-600 group-hover:text-white transition"
            >
              <span>Xem Báo Cáo Doanh Thu</span>
              <ArrowRight size={16} />
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
