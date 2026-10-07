import { motion } from "framer-motion";
import {
  Sparkles,
  LayoutGrid,
  Coffee,
  Truck,
  Building2,
  TrendingUp,
  ShoppingBag,
  ArrowRight,
  Lock,
  UserCheck,
} from "lucide-react";
import type { User } from "../services/auth.ts";
import { canAccessScreen, type Screen } from "../services/rbac.ts";

interface LandingScreenProps {
  currentUser?: User | null;
  onNavigate: (screen: Screen) => void;
  openLogin: () => void;
}

interface GatewayCard {
  screen: Screen;
  badge: string;
  badgeTone: string;
  icon: typeof ShoppingBag;
  title: string;
  description: string;
  actionText: string;
  themeClass: {
    iconBg: string;
    iconText: string;
    hoverBg: string;
    badgeText: string;
  };
}

const ALL_GATEWAYS: GatewayCard[] = [
  {
    screen: "customer",
    badge: "Dành Cho Khách Hàng",
    badgeTone: "text-rose-700",
    icon: ShoppingBag,
    title: "Customer Digital Menu & Kiosk",
    description: "Xem menu đồ uống, tùy chọn đường đá topping, quét mã VietQR Napas thanh toán và tự động phát tín hiệu chuông về quầy pha chế.",
    actionText: "Trải nghiệm Đặt món Khách",
    themeClass: {
      iconBg: "bg-rose-50",
      iconText: "text-rose-700",
      hoverBg: "group-hover:bg-red-700 group-hover:text-white",
      badgeText: "text-rose-700",
    },
  },
  {
    screen: "pos",
    badge: "Dành Cho Nhân Viên Thu Ngân",
    badgeTone: "text-amber-700",
    icon: LayoutGrid,
    title: "Quầy Bán Hàng POS Terminal",
    description: "Bán hàng chạm cực nhạy, hỗ trợ Offline Outbox Pattern tự lưu đơn khi mất mạng, tự động trừ kho nguyên liệu theo BoM công thức.",
    actionText: "Mở Quầy Thu Ngân POS",
    themeClass: {
      iconBg: "bg-amber-50",
      iconText: "text-amber-700",
      hoverBg: "group-hover:bg-amber-600 group-hover:text-white",
      badgeText: "text-amber-700",
    },
  },
  {
    screen: "kds",
    badge: "Dành Cho Barista & Bếp",
    badgeTone: "text-orange-700",
    icon: Coffee,
    title: "Màn Hình Điều Phối Bếp KDS",
    description: "Nhận vé pha chế tức thì qua SignalR, đếm ngược thời gian SLA cảnh báo màu sắc, toggle từng topping và chuông báo khi có đơn mới.",
    actionText: "Vào Màn Hình KDS",
    themeClass: {
      iconBg: "bg-orange-50",
      iconText: "text-orange-700",
      hoverBg: "group-hover:bg-orange-600 group-hover:text-white",
      badgeText: "text-orange-700",
    },
  },
  {
    screen: "transfers",
    badge: "Dành Cho Kho Vận Cung Ứng",
    badgeTone: "text-blue-700",
    icon: Truck,
    title: "Chuỗi Cung Ứng & Điều Chuyển STO",
    description: "Quy trình điều chuyển kho tổng 6 bước chuẩn mực, nhập xuất kho an toàn, lập biên bản tự động và xử lý chênh lệch hàng giao nhận.",
    actionText: "Quản Lý Điều Chuyển STO",
    themeClass: {
      iconBg: "bg-blue-50",
      iconText: "text-blue-700",
      hoverBg: "group-hover:bg-blue-600 group-hover:text-white",
      badgeText: "text-blue-700",
    },
  },
  {
    screen: "bom-studio",
    badge: "Dành Cho Bếp Trưởng & Kỹ Thuật COGS",
    badgeTone: "text-purple-700",
    icon: Sparkles,
    title: "BoM Studio & Định Lượng COGS",
    description: "Mô phỏng kịch bản What-If khi giá nguyên liệu biến động, tính toán chính xác chi phí từng gram/ml và tối ưu biên lợi nhuận món.",
    actionText: "Vào BoM Studio",
    themeClass: {
      iconBg: "bg-purple-50",
      iconText: "text-purple-700",
      hoverBg: "group-hover:bg-purple-600 group-hover:text-white",
      badgeText: "text-purple-700",
    },
  },
  {
    screen: "analytics",
    badge: "Dành Cho Quản Trị & Chủ Chuỗi",
    badgeTone: "text-emerald-700",
    icon: TrendingUp,
    title: "Báo Cáo Tài Chính & Phí Royalty",
    description: "Biểu đồ nhiệt doanh thu 24 giờ, xếp hạng món bán chạy, tự động kết toán và phát hành hóa đơn thu phí nhượng quyền hàng tháng.",
    actionText: "Xem Báo Cáo Doanh Thu",
    themeClass: {
      iconBg: "bg-emerald-50",
      iconText: "text-emerald-700",
      hoverBg: "group-hover:bg-emerald-600 group-hover:text-white",
      badgeText: "text-emerald-700",
    },
  },
];

export function LandingScreen({ currentUser, onNavigate, openLogin }: LandingScreenProps) {
  // Lọc các cổng truy cập mà người dùng hiện tại có quyền xem
  const visibleGateways = ALL_GATEWAYS.filter((gw) => canAccessScreen(gw.screen, currentUser ?? null));

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
            {/* Cổng khách hàng luôn sẵn sàng */}
            <button
              onClick={() => onNavigate("customer")}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-red-700 to-rose-700 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-900/20 hover:from-red-800 hover:to-rose-800 transition active:scale-95"
            >
              <ShoppingBag size={18} />
              <span>Khách Hàng Đặt Món Online</span>
              <ArrowRight size={16} />
            </button>

            {/* Chỉ hiển thị POS nếu role có quyền */}
            {canAccessScreen("pos", currentUser ?? null) && (
              <button
                onClick={() => onNavigate("pos")}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 transition active:scale-95"
              >
                <LayoutGrid size={18} className="text-red-700" />
                <span>Vào Quầy Thu Ngân POS</span>
              </button>
            )}

            {/* Chỉ hiển thị Analytics nếu role có quyền */}
            {canAccessScreen("analytics", currentUser ?? null) && (
              <button
                onClick={() => onNavigate("analytics")}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 transition active:scale-95"
              >
                <TrendingUp size={18} className="text-emerald-600" />
                <span>Báo Cáo Doanh Thu & Royalty</span>
              </button>
            )}

            {/* Nếu là khách vãng lai, hiển thị nút đăng nhập nhân viên */}
            {!currentUser && (
              <button
                onClick={openLogin}
                className="inline-flex items-center gap-2 rounded-2xl border border-dashed border-red-300 bg-red-50/70 px-5 py-3.5 text-sm font-bold text-red-800 hover:bg-red-100/70 transition active:scale-95"
              >
                <Lock size={16} className="text-red-700" />
                <span>Đăng Nhập Nhân Viên / Quản Lý</span>
              </button>
            )}
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
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              Cổng Truy Cập Theo Phân Quyền ({currentUser ? `Vai trò: ${currentUser.role}` : "Khách Chưa Đăng Nhập"})
            </h2>
            <p className="mt-1 text-sm text-slate-500 font-medium">
              Chỉ hiển thị các phân hệ mà tài khoản hiện tại được cấp quyền truy cập chính xác.
            </p>
          </div>
          {currentUser && (
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
              <UserCheck size={15} />
              <span>{currentUser.fullName} ({currentUser.username})</span>
            </div>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Lặp qua danh sách cổng ĐÃ ĐƯỢC LỌC theo quyền */}
          {visibleGateways.map((gw) => {
            const Icon = gw.icon;
            return (
              <motion.div
                key={gw.screen}
                whileHover={{ y: -4 }}
                className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-7 shadow-sm transition hover:border-red-200 hover:shadow-md"
              >
                <div>
                  <div
                    className={`flex size-12 items-center justify-center rounded-2xl ${gw.themeClass.iconBg} ${gw.themeClass.iconText} font-black mb-5 ${gw.themeClass.hoverBg} transition`}
                  >
                    <Icon size={24} />
                  </div>
                  <span className={`text-[11px] font-black uppercase tracking-wider ${gw.themeClass.badgeText}`}>
                    {gw.badge}
                  </span>
                  <h3 className="mt-1 text-xl font-black text-slate-900">{gw.title}</h3>
                  <p className="mt-2.5 text-sm text-slate-600 leading-relaxed font-normal">
                    {gw.description}
                  </p>
                </div>
                <button
                  onClick={() => onNavigate(gw.screen)}
                  className={`mt-6 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-xs font-bold text-slate-800 ${gw.themeClass.hoverBg} transition`}
                >
                  <span>{gw.actionText}</span>
                  <ArrowRight size={16} />
                </button>
              </motion.div>
            );
          })}

          {/* Nếu là khách vãng lai, hiển thị thêm Thẻ Đăng Nhập để mở khóa phân hệ nội bộ */}
          {!currentUser && (
            <motion.div
              whileHover={{ y: -4 }}
              className="group relative flex flex-col justify-between rounded-3xl border border-dashed border-amber-300 bg-gradient-to-br from-amber-50/50 to-white p-7 shadow-sm transition hover:border-amber-400 hover:shadow-md"
            >
              <div>
                <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 font-black mb-5 group-hover:bg-amber-600 group-hover:text-white transition">
                  <Lock size={24} />
                </div>
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-800">
                  Phân Hệ Nội Bộ Nhân Viên & Quản Trị
                </span>
                <h3 className="mt-1 text-xl font-black text-slate-900">Đăng Nhập Nhận Ca & Quản Trị</h3>
                <p className="mt-2.5 text-sm text-slate-600 leading-relaxed font-normal">
                  Dành cho nhân viên thu ngân POS, barista bếp KDS, quản lý kho STO và quản trị viên HQ. Vui lòng đăng nhập để mở các cổng nghiệp vụ tương ứng.
                </p>
              </div>
              <button
                onClick={openLogin}
                className="mt-6 flex items-center justify-between rounded-xl bg-amber-600 px-4 py-3 text-xs font-bold text-white shadow-sm hover:bg-amber-700 transition"
              >
                <span>Đăng Nhập Tài Khoản Ngay</span>
                <ArrowRight size={16} />
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
