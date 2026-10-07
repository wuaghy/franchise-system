import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  Bell,
  Box,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Download,
  Filter,
  LayoutGrid,
  MapPin,
  Minus,
  MoreHorizontal,
  PackageCheck,
  PackagePlus,
  Phone,
  Plus,
  QrCode,
  ReceiptText,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  Trash2,
  TrendingUp,
  Wifi,
  X,
  KeyRound,
  Lock,
  LogOut,
  Sparkles,
  Calculator,
  SlidersHorizontal,
  Save,
  RotateCcw,
  Truck,
  Coffee,
  BarChart3,
  Mail,
  BellOff,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { realtimeHub, type ConnectionStatus, type LowStockAlertNotification } from "./services/signalr.ts";
import { audioNotifier, type AudioSettings } from "./services/audioNotification.ts";
import {
  getCurrentUser,
  login as apiLogin,
  logout as apiLogout,
  googleLogin,
  sendOtp,
  verifyOtpLogin,
  type User,
} from "./services/auth.ts";
import { costingApi, type ProductCosting, type IngredientItem } from "./services/costing.ts";
import { TransfersHubScreen } from "./components/TransfersHubScreen.tsx";
import { KdsScreen } from "./components/KdsScreen.tsx";
import { AnalyticsHubScreen } from "./components/AnalyticsHubScreen.tsx";
import { LandingScreen } from "./components/LandingScreen.tsx";
import { CustomerScreen } from "./components/CustomerScreen.tsx";
import {
  enqueueOfflineOrder,
  getPendingOfflineOrders,
  getPendingOfflineOrderCount,
  type OfflineOrderSyncItem,
} from "./services/offlineQueue.ts";
import {
  syncPendingOfflineOrders,
  initOfflineSyncListeners,
} from "./services/posSync.ts";
import {
  canAccessScreen,
  canAccessPortal,
  filterStaffNavItems,
  filterAdminNavItems,
  getDefaultScreenForUser,
  getPortalForScreen,
  type Screen,
  type Portal,
} from "./services/rbac.ts";
import {
  api,
  type CheckoutOrderPayload,
  type CheckoutResponse,
  type DeductedIngredient,
  type IngredientItem as ApiIngredientItem,
} from "./services/api.ts";
import { ReceiptModal, type ReceiptData } from "./components/ReceiptModal.tsx";
import { VietQrModal } from "./components/VietQrModal.tsx";

type Modal = "store" | "restock" | "modifier" | "receipt" | "login" | null;
type Payment = "Cash" | "QR Transfer" | "Credit Card";

export interface SystemNotification {
  id: string;
  title: string;
  detail: string;
  amount?: number;
  time: string;
  type: "order" | "alert" | "kds";
  isRead: boolean;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}

function Button({ className = "", variant = "secondary", ...props }: ButtonProps) {
  const variants = {
    primary: "bg-red-800 text-white shadow-sm hover:bg-red-700",
    secondary: "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50",
    ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
    danger: "bg-rose-50 text-rose-700 hover:bg-rose-100",
  };
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-all duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

function Badge({
  children,
  tone = "neutral",
  pulse = false,
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "danger" | "warning" | "brand";
  pulse?: boolean;
}) {
  const tones = {
    neutral: "bg-slate-100 text-slate-600",
    success: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    danger: "bg-rose-50 text-rose-700 ring-rose-600/10",
    warning: "bg-amber-50 text-amber-800 ring-amber-600/10",
    brand: "bg-red-50 text-red-800 ring-red-700/10",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-wide ring-1 ring-inset ${tones[tone]}`}>
      {pulse && (
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-50" />
          <span className="relative inline-flex size-2 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] ${className}`}>{children}</section>;
}


const navItems = [
  { id: "landing" as Screen, label: "Tổng Quan", sub: "Cổng phân quyền", icon: Sparkles },
  { id: "customer" as Screen, label: "Khách Đặt Món", sub: "Menu & VietQR", icon: ShoppingBag },
  { id: "pos" as Screen, label: "POS Terminal", sub: "Thu ngân", icon: LayoutGrid },
  { id: "kds" as Screen, label: "Kitchen Display", sub: "Barista KDS", icon: Coffee },
  { id: "transfers" as Screen, label: "Supply Chain", sub: "Điều chuyển STO", icon: Truck },
  { id: "bom-studio" as Screen, label: "BoM Studio", sub: "COGS & Lợi nhuận", icon: Calculator },
  { id: "stores" as Screen, label: "Store Network", sub: "Chi nhánh", icon: Building2 },
  { id: "inventory" as Screen, label: "Live Inventory", sub: "Kho & BoM", icon: Box },
  { id: "analytics" as Screen, label: "Business Intelligence", sub: "Báo cáo & Phí HQ", icon: BarChart3 },
];

const staffNavItems = [
  { id: "pos" as Screen, label: "POS Terminal", sub: "Thu ngân bán hàng", icon: LayoutGrid },
  { id: "kds" as Screen, label: "Kitchen KDS", sub: "Barista & Bếp", icon: Coffee },
  { id: "transfers" as Screen, label: "Kho & STO", sub: "Điều chuyển hàng", icon: Truck },
];

const adminNavItems = [
  { id: "stores" as Screen, label: "Mạng Lưới Chi Nhánh", sub: "Quản lý cửa hàng", icon: Building2 },
  { id: "analytics" as Screen, label: "Báo Cáo & Phí HQ", sub: "Doanh thu & Royalty", icon: BarChart3 },
  { id: "bom-studio" as Screen, label: "BoM Studio", sub: "Định mức & COGS", icon: Calculator },
  { id: "inventory" as Screen, label: "Tồn Kho Toàn Chuỗi", sub: "Ledger", icon: Box },
];

function ShiftUserButton({
  currentUser,
  openLogin,
  onLogout,
  label = "Nhận ca POS",
  tone = "amber",
}: {
  currentUser: User | null;
  openLogin: () => void;
  onLogout: () => void;
  label?: string;
  tone?: "amber" | "red" | "dark";
}) {
  if (currentUser) {
    return (
      <div className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-2xs">
        <span
          className={`grid size-7 shrink-0 place-items-center rounded-lg ${
            tone === "amber" ? "bg-amber-700" : "bg-red-800"
          } text-[11px] font-black text-white`}
        >
          {currentUser.username.slice(0, 2).toUpperCase()}
        </span>
        <div className="hidden sm:block text-left">
          <span className="block max-w-24 truncate text-xs font-black text-slate-900 leading-tight">
            {currentUser.fullName || currentUser.username}
          </span>
          <span
            className={`block text-[9px] font-extrabold uppercase tracking-wider ${
              tone === "amber" ? "text-amber-700" : "text-red-700"
            } leading-none`}
          >
            {currentUser.role}
          </span>
        </div>
        <button
          type="button"
          onClick={onLogout}
          title="Hết ca / Đăng xuất"
          className="ml-0.5 rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition shrink-0"
        >
          <LogOut size={14} />
        </button>
      </div>
    );
  }

  const bgClasses =
    tone === "amber"
      ? "bg-red-800 hover:bg-red-700 text-white shadow-md shadow-red-900/15"
      : tone === "red"
      ? "bg-red-800 hover:bg-red-700 text-white shadow-md shadow-red-900/15"
      : "bg-slate-900 hover:bg-slate-800 text-white shadow-sm";

  return (
    <button
      type="button"
      onClick={openLogin}
      className={`shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition active:scale-95 ${bgClasses}`}
      title={label}
    >
      <Lock size={13} className="shrink-0" />
      <span className="whitespace-nowrap font-bold">{label}</span>
    </button>
  );
}

function NotificationCenter({
  notifications,
  unreadCount,
  isNotifOpen,
  setIsNotifOpen,
  audioSettings,
  onToggleSound,
  onToggleSpeech,
  onTestSound,
  onSimulateOrder,
  onClearNotifications,
  onMarkAllRead,
}: {
  notifications: SystemNotification[];
  unreadCount: number;
  isNotifOpen: boolean;
  setIsNotifOpen: (open: boolean) => void;
  audioSettings: AudioSettings;
  onToggleSound: () => void;
  onToggleSpeech: () => void;
  onTestSound: () => void;
  onSimulateOrder: () => void;
  onClearNotifications: () => void;
  onMarkAllRead: () => void;
}) {
  return (
    <div className="relative shrink-0">
      <Button
        variant="ghost"
        onClick={() => setIsNotifOpen(!isNotifOpen)}
        className="relative !size-10 !min-h-10 !p-0"
        aria-label="Notifications"
      >
        {audioSettings.soundEnabled ? (
          <Bell size={18} className={unreadCount > 0 ? "text-red-700" : "text-slate-600"} />
        ) : (
          <BellOff size={18} className="text-slate-400" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 grid min-w-4.5 h-4.5 place-items-center rounded-full bg-red-600 px-1 text-[9px] font-black text-white ring-2 ring-white shadow-xs">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      <AnimatePresence>
        {isNotifOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-lg bg-red-50 text-red-700">
                  <Bell size={15} />
                </span>
                <div>
                  <h4 className="text-xs font-black text-slate-900">Chuông báo & Đơn hàng</h4>
                  <p className="text-[10px] text-slate-400 font-semibold">{unreadCount} thông báo chưa xem</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllRead}
                    className="rounded-lg px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100 transition"
                  >
                    Đã đọc
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={onClearNotifications}
                    className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                    title="Xóa danh sách"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Audio Controls Box */}
            <div className="my-3 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                  {audioSettings.soundEnabled ? <Volume2 size={14} className="text-emerald-600" /> : <VolumeX size={14} className="text-slate-400" />}
                  <span>Chuông POS (Web Audio)</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={onTestSound}
                    className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition active:scale-95"
                    title="Phát thử âm thanh Ting-Ting"
                  >
                    Thử chuông
                  </button>
                  <button
                    onClick={onToggleSound}
                    className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold transition ${
                      audioSettings.soundEnabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {audioSettings.soundEnabled ? "BẬT" : "TẮT"}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200/50 pt-2 text-[11px]">
                <span className="text-[10px] text-slate-500 font-medium">Giọng đọc đơn AI (TTS):</span>
                <button
                  onClick={onToggleSpeech}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition ${
                    audioSettings.speechEnabled ? "bg-red-100 text-red-800" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {audioSettings.speechEnabled ? "BẬT" : "TẮT"}
                </button>
              </div>

              <button
                type="button"
                onClick={onSimulateOrder}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-red-800/10 hover:bg-red-800/15 py-1.5 text-[11px] font-extrabold text-red-900 transition active:scale-98"
              >
                <Zap size={13} className="text-red-700" />
                <span>Giả lập đơn Online (Reng chuông)</span>
              </button>
            </div>

            {/* Notification List */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-0.5">
              {notifications.length === 0 ? (
                <div className="py-6 text-center text-[11px] text-slate-400">
                  Chưa có thông báo nào
                </div>
              ) : (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-start gap-2.5 rounded-xl p-2.5 transition text-left ${
                      item.isRead ? "bg-slate-50/50 text-slate-600" : "bg-red-50/40 border border-red-100/70 text-slate-900"
                    }`}
                  >
                    <span className={`grid size-6 shrink-0 place-items-center rounded-md text-[10px] font-black ${
                      item.type === "order" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}>
                      {item.type === "order" ? "₫" : "!"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black truncate">{item.title}</p>
                      <p className="text-[11px] text-slate-500 font-medium">{item.detail}</p>
                      <span className="text-[9px] font-bold text-slate-400">{item.time}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Header({
  screen,
  setScreen,
  connectionStatus,
  currentUser,
  openLogin,
  onLogout,
  notifications,
  unreadCount,
  isNotifOpen,
  setIsNotifOpen,
  audioSettings,
  onToggleSound,
  onToggleSpeech,
  onTestSound,
  onSimulateOrder,
  onClearNotifications,
  onMarkAllRead,
}: {
  screen: Screen;
  setScreen: (screen: Screen) => void;
  connectionStatus: ConnectionStatus;
  currentUser: User | null;
  openLogin: () => void;
  onLogout: () => void;
  notifications: SystemNotification[];
  unreadCount: number;
  isNotifOpen: boolean;
  setIsNotifOpen: (open: boolean) => void;
  audioSettings: AudioSettings;
  onToggleSound: () => void;
  onToggleSpeech: () => void;
  onTestSound: () => void;
  onSimulateOrder: () => void;
  onClearNotifications: () => void;
  onMarkAllRead: () => void;
}) {
  const badgeTone = connectionStatus === "Connected" ? "success" : connectionStatus === "Reconnecting" ? "warning" : "neutral";
  const badgeText = connectionStatus === "Connected" ? "Outbox Synced" : connectionStatus === "Reconnecting" ? "Reconnecting..." : "Offline";
  const portal = getPortalForScreen(screen);

  // 1. CỔNG KHÁCH HÀNG (CUSTOMER PORTAL) - Tinh giản, chỉ phục vụ thực khách
  if (portal === "customer") {
    return (
      <header className="sticky top-0 z-40 border-b border-rose-100 bg-white/95 backdrop-blur-xl shadow-2xs">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-3 sm:px-4 lg:px-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setScreen("landing")}
              className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 transition p-1.5 rounded-xl hover:bg-slate-100 shrink-0"
              title="Quay lại Trang Chủ"
            >
              <ChevronLeft size={18} />
              <span className="hidden sm:inline text-xs font-bold whitespace-nowrap">Trang chủ</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-red-700 to-rose-900 text-base font-black text-white shadow-md shadow-red-900/20 shrink-0">
                ☕
              </span>
              <div>
                <span className="block text-sm font-black tracking-tight text-slate-950 whitespace-nowrap">Highlands Coffee</span>
                <span className="block text-[10px] font-extrabold uppercase tracking-wider text-rose-700 whitespace-nowrap">Cổng Đặt Món Khách Hàng</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 rounded-xl bg-rose-50/80 border border-rose-100 px-3 py-1.5 text-xs shrink-0">
              <MapPin size={13} className="text-rose-700 shrink-0" />
              <span className="font-bold text-slate-800 whitespace-nowrap">Bàn 05 · Highlands Lê Lợi Q1</span>
            </div>

            {canAccessScreen("pos", currentUser) && (
              <button
                onClick={() => setScreen("pos")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition active:scale-95 whitespace-nowrap shrink-0"
              >
                <LayoutGrid size={13} className="text-slate-500 shrink-0" />
                <span className="hidden md:inline">Cổng Cửa Hàng (POS)</span>
                <span className="md:hidden">Cổng POS</span>
              </button>
            )}
            {canAccessPortal("admin", currentUser) && (
              <button
                onClick={() => setScreen("analytics")}
                className="hidden lg:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition active:scale-95 whitespace-nowrap shrink-0"
              >
                <Building2 size={13} className="text-slate-500 shrink-0" />
                <span>Cổng Trụ Sở HQ</span>
              </button>
            )}
            {!currentUser && (
              <ShiftUserButton
                currentUser={currentUser}
                openLogin={openLogin}
                onLogout={onLogout}
                label="Đăng nhập NV"
                tone="red"
              />
            )}
          </div>
        </div>
      </header>
    );
  }

  // 2. CỔNG CỬA HÀNG / NHÂN VIÊN (STAFF PORTAL: POS, KDS, TRANSFERS)
  if (portal === "staff") {
    const visibleStaffNavItems = filterStaffNavItems(staffNavItems, currentUser);
    return (
      <header className="sticky top-0 z-40 border-b border-amber-200/80 bg-white/95 backdrop-blur-xl shadow-2xs">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-2 sm:gap-4 px-3 sm:px-4 lg:px-6">
          {/* Logo & Badge */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setScreen("landing")}
              className="flex items-center gap-2 text-left focus:outline-none shrink-0"
              title="Quay về Trang Chủ"
            >
              <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-red-700 to-amber-700 text-base font-black text-white shadow-md shadow-amber-800/20 shrink-0">
                🏪
              </span>
              <div className="hidden xl:block">
                <span className="block text-sm font-black tracking-tight text-slate-950 whitespace-nowrap">FRANCHISE STORE</span>
                <span className="block text-[9px] font-extrabold uppercase tracking-widest text-amber-700 whitespace-nowrap">Cổng Ca Nhân Viên</span>
              </div>
            </button>
            <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-900 tracking-wide shrink-0">
              Staff
            </span>
          </div>

          {/* Staff Navigation Tabs - Filtered strictly by role */}
          <nav className="hidden lg:flex items-center rounded-2xl bg-slate-100/90 p-1 mx-auto" aria-label="Staff navigation">
            {visibleStaffNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = screen === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setScreen(item.id)}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                    isActive ? "bg-white text-red-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Icon size={14} className={isActive ? "text-red-700" : "text-slate-400"} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Actions Toolbar */}
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Quick Switch to HQ Admin - Only if authorized */}
            {canAccessPortal("admin", currentUser) && (
              <button
                onClick={() => setScreen("analytics")}
                className="hidden md:inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition whitespace-nowrap shrink-0"
                title="Chuyển sang Cổng Quản Trị HQ"
              >
                <Building2 size={13} className="text-slate-400 shrink-0" />
                <span>Sang Cổng HQ</span>
              </button>
            )}

            {/* Quick Link to Customer Menu */}
            <button
              onClick={() => setScreen("customer")}
              className="hidden 2xl:inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition whitespace-nowrap shrink-0"
              title="Xem Menu Đặt Món Khách"
            >
              <ShoppingBag size={13} className="text-slate-400 shrink-0" />
              <span>Menu Khách</span>
            </button>

            {/* Nhận ca POS button (Fixed: Never wraps text!) */}
            <ShiftUserButton
              currentUser={currentUser}
              openLogin={openLogin}
              onLogout={onLogout}
              label="Nhận ca POS"
              tone="amber"
            />

            {/* Notification Bell */}
            <NotificationCenter
              notifications={notifications}
              unreadCount={unreadCount}
              isNotifOpen={isNotifOpen}
              setIsNotifOpen={setIsNotifOpen}
              audioSettings={audioSettings}
              onToggleSound={onToggleSound}
              onToggleSpeech={onToggleSpeech}
              onTestSound={onTestSound}
              onSimulateOrder={onSimulateOrder}
              onClearNotifications={onClearNotifications}
              onMarkAllRead={onMarkAllRead}
            />

            {/* Store Name Badge */}
            <div className="hidden xl:flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-left shadow-2xs shrink-0">
              <Store size={14} className="text-amber-700 shrink-0" />
              <span className="text-xs font-bold text-slate-800 whitespace-nowrap">Highlands Lê Lợi Q1</span>
            </div>

            {/* Connection Badge */}
            <Badge tone={badgeTone} pulse={connectionStatus === "Connected" || connectionStatus === "Reconnecting"}>
              <span className="hidden sm:inline whitespace-nowrap">{badgeText}</span>
              <span className="sm:hidden">{connectionStatus === "Connected" ? "Live" : "Off"}</span>
            </Badge>
          </div>
        </div>

        {/* Mobile Navigation for Staff - Filtered */}
        <nav className="flex lg:hidden overflow-x-auto border-t border-slate-100 px-2 py-1.5 gap-1" aria-label="Staff mobile nav">
          {visibleStaffNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setScreen(item.id)}
              className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition shrink-0 ${
                screen === item.id ? "bg-amber-100 text-amber-900" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          ))}
          {canAccessPortal("admin", currentUser) && (
            <button
              onClick={() => setScreen("analytics")}
              className="ml-auto whitespace-nowrap rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-slate-100 shrink-0"
            >
              Sang Cổng HQ →
            </button>
          )}
        </nav>
      </header>
    );
  }

  // 3. CỔNG TRỤ SỞ QUẢN TRỊ (HQ ADMIN PORTAL: STORES, ANALYTICS, BOM-STUDIO, INVENTORY)
  if (portal === "admin") {
    const visibleAdminNavItems = filterAdminNavItems(adminNavItems, currentUser);
    return (
      <header className="sticky top-0 z-40 border-b border-red-200/80 bg-white/95 backdrop-blur-xl shadow-2xs">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-2 sm:gap-4 px-3 sm:px-4 lg:px-6">
          {/* Logo & Badge */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setScreen("landing")}
              className="flex items-center gap-2 text-left focus:outline-none shrink-0"
              title="Quay về Trang Chủ"
            >
              <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-red-700 to-red-950 text-base font-black text-white shadow-md shadow-red-900/20 shrink-0">
                🏢
              </span>
              <div className="hidden xl:block">
                <span className="block text-sm font-black tracking-tight text-slate-950 whitespace-nowrap">FRANCHISE HQ</span>
                <span className="block text-[9px] font-extrabold uppercase tracking-widest text-red-700 whitespace-nowrap">Trụ Sở Quản Trị</span>
              </div>
            </button>
            <span className="rounded-lg bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase text-red-900 tracking-wide shrink-0">
              HQ Admin
            </span>
          </div>

          {/* Admin Navigation Tabs - Filtered strictly by role */}
          <nav className="hidden lg:flex items-center rounded-2xl bg-slate-100/90 p-1 mx-auto" aria-label="HQ Admin navigation">
            {visibleAdminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = screen === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setScreen(item.id)}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                    isActive ? "bg-white text-red-950 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Icon size={14} className={isActive ? "text-red-700" : "text-slate-400"} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Actions Toolbar */}
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Quick Switch to Store POS - Only if authorized */}
            {canAccessPortal("staff", currentUser) && (
              <button
                onClick={() => setScreen("pos")}
                className="hidden md:inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition whitespace-nowrap shrink-0"
                title="Chuyển sang Quầy Thu Ngân Cửa Hàng"
              >
                <LayoutGrid size={13} className="text-slate-400 shrink-0" />
                <span>Sang Cổng Cửa Hàng</span>
              </button>
            )}

            {/* Admin User Button */}
            <ShiftUserButton
              currentUser={currentUser}
              openLogin={openLogin}
              onLogout={onLogout}
              label="Đăng nhập HQ"
              tone="red"
            />

            {/* Notification Bell */}
            <NotificationCenter
              notifications={notifications}
              unreadCount={unreadCount}
              isNotifOpen={isNotifOpen}
              setIsNotifOpen={setIsNotifOpen}
              audioSettings={audioSettings}
              onToggleSound={onToggleSound}
              onToggleSpeech={onToggleSpeech}
              onTestSound={onTestSound}
              onSimulateOrder={onSimulateOrder}
              onClearNotifications={onClearNotifications}
              onMarkAllRead={onMarkAllRead}
            />

            {/* Connection Badge */}
            <Badge tone={badgeTone} pulse={connectionStatus === "Connected" || connectionStatus === "Reconnecting"}>
              <span className="hidden sm:inline whitespace-nowrap">{badgeText}</span>
              <span className="sm:hidden">{connectionStatus === "Connected" ? "Live" : "Off"}</span>
            </Badge>
          </div>
        </div>

        {/* Mobile Navigation for Admin - Filtered */}
        <nav className="flex lg:hidden overflow-x-auto border-t border-slate-100 px-2 py-1.5 gap-1" aria-label="Admin mobile nav">
          {visibleAdminNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setScreen(item.id)}
              className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition shrink-0 ${
                screen === item.id ? "bg-red-100 text-red-900" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          ))}
          {canAccessPortal("staff", currentUser) && (
            <button
              onClick={() => setScreen("pos")}
              className="ml-auto whitespace-nowrap rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-slate-100 shrink-0"
            >
              Sang Cổng POS →
            </button>
          )}
        </nav>
      </header>
    );
  }

  // 4. TRANG CHỦ TỔNG QUAN (LANDING PORTAL) - Cổng chọn vai trò
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-2xs">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-3 sm:px-4 lg:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-red-700 to-red-950 text-lg font-black text-white shadow-md shadow-red-900/20 shrink-0">
            F
          </span>
          <div>
            <span className="block text-sm font-black tracking-tight text-slate-950 whitespace-nowrap">FRANCHISE ENTERPRISE</span>
            <span className="block text-[9px] font-extrabold uppercase tracking-widest text-red-700 whitespace-nowrap">Cổng Điều Hành Chuỗi F&B</span>
          </div>
        </div>

        {/* 3 Portal Links - Filtered by role */}
        <nav className="hidden md:flex items-center gap-1 rounded-2xl bg-slate-100 p-1 mx-auto" aria-label="Landing Portals">
          <button
            onClick={() => setScreen("customer")}
            className="flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-white hover:text-slate-950 transition whitespace-nowrap shrink-0"
          >
            <ShoppingBag size={14} className="text-rose-600 shrink-0" />
            <span>1. Khách Đặt Món</span>
          </button>
          {canAccessPortal("staff", currentUser) && (
            <button
              onClick={() => setScreen("pos")}
              className="flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-white hover:text-slate-950 transition whitespace-nowrap shrink-0"
            >
              <LayoutGrid size={14} className="text-amber-600 shrink-0" />
              <span>2. Cửa Hàng (POS & KDS)</span>
            </button>
          )}
          {canAccessPortal("admin", currentUser) && (
            <button
              onClick={() => setScreen("analytics")}
              className="flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-white hover:text-slate-950 transition whitespace-nowrap shrink-0"
            >
              <Building2 size={14} className="text-red-700 shrink-0" />
              <span>3. Quản Trị Trụ Sở HQ</span>
            </button>
          )}
        </nav>

        {/* Right Login & Status */}
        <div className="flex items-center gap-2 shrink-0">
          <ShiftUserButton
            currentUser={currentUser}
            openLogin={openLogin}
            onLogout={onLogout}
            label="Đăng nhập"
            tone="dark"
          />

          <Badge tone={badgeTone} pulse={connectionStatus === "Connected" || connectionStatus === "Reconnecting"}>
            <span className="hidden sm:inline whitespace-nowrap">{badgeText}</span>
            <span className="sm:hidden">{connectionStatus === "Connected" ? "Live" : "Off"}</span>
          </Badge>
        </div>
      </div>
    </header>
  );
}

const initialStores = [
  { code: "STORE-Q1", name: "Chi nhánh Quận 1 (Flagship Store)", address: "12 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh", phone: "028 3822 1234", revenue: "₫18.4m", active: true },
  { code: "STORE-L81", name: "Chi nhánh Landmark 81", address: "Tầng trệt Landmark 81, Vinhomes Central Park, Bình Thạnh, TP.HCM", phone: "028 3999 5678", revenue: "₫22.8m", active: true },
  { code: "DN-04", name: "Heritage Bạch Đằng", address: "96 Bạch Đằng, Hải Châu, Đà Nẵng", phone: "+84 236 388 1132", revenue: "₫12.1m", active: true },
  { code: "HN-07", name: "Heritage Hồ Gươm", address: "12 Lê Thái Tổ, Hoàn Kiếm, Hà Nội", phone: "+84 24 3928 8228", revenue: "₫16.7m", active: true },
  { code: "CT-03", name: "Mekong Ninh Kiều", address: "02 Hai Bà Trưng, Ninh Kiều, Cần Thơ", phone: "+84 292 381 2888", revenue: "₫8.9m", active: false },
];

function PageHeading({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.2em] text-red-700">{eyebrow}</p>
        <h1 className="text-2xl font-black tracking-tight text-slate-950 md:text-3xl">{title}</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-slate-500">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

function StoresScreen({
  openModal,
  dailyRevenue,
  refreshTrigger,
  newlyCreatedStore,
}: {
  openModal: (modal: Modal) => void;
  dailyRevenue: number;
  refreshTrigger?: number;
  newlyCreatedStore?: { code: string; name: string; address?: string; phoneNumber?: string } | null;
}) {
  const [query, setQuery] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [storeList, setStoreList] = useState(initialStores);
  const [exportSuccess, setExportSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;
    api.getStores(1, 50)
      .then((res) => {
        if (!isMounted || !res?.items || res.items.length === 0) return;
        const mapped = res.items.map((s) => ({
          code: s.code,
          name: s.name,
          address: s.address,
          phone: s.phoneNumber || "+84 28 3822 2211",
          revenue: "₫18.4m",
          active: s.isActive,
        }));
        setStoreList(mapped);
      })
      .catch((err) => console.warn("Could not load backend stores:", err));
    return () => {
      isMounted = false;
    };
  }, [refreshTrigger]);

  // Optimistic UI: Prepend newly created store immediately
  useEffect(() => {
    if (newlyCreatedStore) {
      setStoreList((prev) => [
        {
          code: newlyCreatedStore.code,
          name: newlyCreatedStore.name,
          address: newlyCreatedStore.address || "Việt Nam",
          phone: newlyCreatedStore.phoneNumber || "+84 28 3822 1234",
          revenue: "₫0.0m",
          active: true,
        },
        ...prev.filter((s) => s.code !== newlyCreatedStore.code),
      ]);
    }
  }, [newlyCreatedStore]);

  const filtered = storeList.filter(
    (store) => `${store.name} ${store.code} ${store.address}`.toLowerCase().includes(query.toLowerCase()) && (!activeOnly || store.active)
  );

  const formattedDailyRevenue = `₫${(dailyRevenue / 1000000).toFixed(1)}m`;

  const handleExportCsv = () => {
    const headers = ["Mã Chi Nhánh", "Tên Chi Nhánh", "Địa Chỉ", "Số Điện Thoại", "Doanh Thu", "Trạng Thái"];
    const rows = filtered.map((s) => [
      `"${s.code}"`,
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.address.replace(/"/g, '""')}"`,
      `"${s.phone}"`,
      `"${s.revenue}"`,
      s.active ? "Đang hoạt động" : "Tạm đóng",
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `danh-sach-chi-nhanh-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 3000);
  };

  const kpis = [
    { label: "Active stores", value: String(storeList.filter((s) => s.active).length), detail: "across 6 regions", icon: Store, trend: "+2 this quarter", color: "text-red-800 bg-red-50" },
    { label: "Daily revenue", value: formattedDailyRevenue, detail: "vs ₫278.8m yesterday", icon: CircleDollarSign, trend: "+14.2%", color: "text-emerald-700 bg-emerald-50" },
    { label: "Low stock alerts", value: "3", detail: "stores require action", icon: AlertTriangle, trend: "Priority", color: "text-rose-700 bg-rose-50" },
    { label: "Outbox sync rate", value: "99.98%", detail: "last 24 hours", icon: Wifi, trend: "Healthy", color: "text-blue-700 bg-blue-50" },
  ];

  return (
    <motion.main initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="mx-auto max-w-[1600px] px-4 py-6 lg:px-6 lg:py-8">
      <PageHeading
        eyebrow="Network Operations"
        title="Store Network"
        description="Monitor performance and manage every franchise location from one live control plane."
        actions={
          <>
            <Button
              onClick={handleExportCsv}
              title="Xuất danh sách chi nhánh ra file CSV"
              className={exportSuccess ? "!border-emerald-300 !bg-emerald-50 !text-emerald-700 font-bold" : ""}
            >
              {exportSuccess ? <Check size={16} className="text-emerald-600" /> : <Download size={16} />}
              {exportSuccess ? "Đã tải CSV!" : "Export"}
            </Button>
            <Button variant="primary" onClick={() => openModal("store")}>
              <Plus size={17} /> New store
            </Button>
          </>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Panel key={kpi.label} className="group p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-start justify-between">
                <span className={`grid size-10 place-items-center rounded-xl ${kpi.color}`}>
                  <Icon size={19} />
                </span>
                <Badge tone={kpi.label === "Low stock alerts" ? "danger" : kpi.label === "Daily revenue" ? "success" : "neutral"}>{kpi.trend}</Badge>
              </div>
              <p className="mt-6 text-sm font-semibold text-slate-500">{kpi.label}</p>
              <div className="mt-1 flex items-end justify-between gap-2">
                <p className="text-3xl font-black tracking-tight text-slate-950">{kpi.value}</p>
                <p className="mb-1 text-right text-xs text-slate-400">{kpi.detail}</p>
              </div>
            </Panel>
          );
        })}
      </div>
      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-extrabold text-slate-900">Franchise directory</h2>
            <p className="text-xs text-slate-500">{filtered.length} locations shown · Live data</p>
          </div>
          <div className="flex gap-2">
            <label className="relative flex-1 sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search stores, code, city..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-red-300 focus:bg-white focus:ring-4 focus:ring-red-50"
              />
            </label>
            <Button onClick={() => setActiveOnly(!activeOnly)} className={activeOnly ? "!border-red-200 !bg-red-50 !text-red-800" : ""}>
              <Filter size={15} />
              <span className="hidden sm:inline">Active</span>
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50/80 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Store code</th>
                <th className="px-5 py-3.5">Store name</th>
                <th className="px-5 py-3.5">Location</th>
                <th className="px-5 py-3.5">Contact</th>
                <th className="px-5 py-3.5">Today</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((store) => (
                <tr key={store.code} className="group transition hover:bg-slate-50/70">
                  <td className="px-5 py-4">
                    <span className="font-mono text-xs font-extrabold text-red-800">{store.code}</span>
                  </td>
                  <td className="px-5 py-4 font-bold text-slate-800">{store.name}</td>
                  <td className="px-5 py-4 text-slate-500">
                    <span className="flex items-center gap-2">
                      <MapPin size={14} className="shrink-0 text-slate-400" />
                      {store.address}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-500">
                    <span className="flex items-center gap-2">
                      <Phone size={14} />
                      {store.phone}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-mono font-bold text-slate-800">{store.revenue}</td>
                  <td className="px-5 py-4">
                    <Badge tone={store.active ? "success" : "neutral"} pulse={store.active}>
                      {store.active ? "Active" : "Closed"}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Button variant="ghost" className="!size-9 !min-h-9 !p-0">
                      <MoreHorizontal size={18} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
          <p className="text-xs text-slate-500">
            Hiển thị <span className="font-bold text-slate-800">{filtered.length}</span> / {storeList.length} chi nhánh trên toàn hệ thống
          </p>
          <div className="flex gap-1">
            <Button className="!size-9 !min-h-9 !p-0" disabled>
              <ChevronLeft size={15} />
            </Button>
            <Button className="!size-9 !min-h-9 !p-0">
              <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      </Panel>
    </motion.main>
  );
}

interface InventoryRecord {
  code: string;
  name: string;
  unit: string;
  current: number;
  min: number;
  counted: string;
}

const initialInventory: InventoryRecord[] = [
  { code: "BEAN-ARA", name: "Arabica Coffee Beans", unit: "gram", current: 14250, min: 5000, counted: "Just now" },
  { code: "PEARL-01", name: "Black Tapioca Pearl", unit: "gram", current: 10, min: 50, counted: "Just now" },
  { code: "MILK-OW", name: "Oat Milk Barista", unit: "ml", current: 18200, min: 8000, counted: "Just now" },
  { code: "CHEESE-02", name: "Sea Salt Cheese Foam", unit: "gram", current: 380, min: 500, counted: "Just now" },
  { code: "SYRUP-PS", name: "Passionfruit Syrup", unit: "ml", current: 4200, min: 2500, counted: "Just now" },
  { code: "CUP-L-01", name: "Cold Cup 700ml", unit: "piece", current: 46, min: 100, counted: "Just now" },
];

function InventoryScreen({
  openModal,
  inventory,
  activeAlert,
  onSync,
  isSyncing,
}: {
  openModal: (modal: Modal) => void;
  inventory: InventoryRecord[];
  activeAlert: LowStockAlertNotification | null;
  onSync?: () => void;
  isSyncing?: boolean;
}) {
  return (
    <motion.main initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="mx-auto max-w-[1600px] px-4 py-6 lg:px-6 lg:py-8">
      <PageHeading
        eyebrow="Highlands Lê Lợi Q1 · HL-01"
        title="Live Inventory & BoM"
        description="Real-time stock ledger with recipe-level consumption and threshold alerts."
        actions={
          <>
            <Button onClick={onSync} disabled={isSyncing} title="Đồng bộ sổ cái tồn kho thời gian thực từ máy chủ">
              <RefreshCcw size={16} className={isSyncing ? "animate-spin" : ""} />
              {isSyncing ? "Đang đồng bộ..." : "Sync now"}
            </Button>
            <Button variant="primary" onClick={() => openModal("restock")}>
              <PackagePlus size={17} /> Inbound restock
            </Button>
          </>
        }
      />
      <div className="mb-6 overflow-hidden rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 to-white">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-rose-600 text-white shadow-lg shadow-rose-600/20">
            <AlertTriangle size={23} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="danger" pulse>
                Critical shortage
              </Badge>
              <span className="font-mono text-xs font-bold text-rose-700">{activeAlert?.ingredientCode || "PEARL-01"}</span>
            </div>
            <h2 className="mt-2 text-lg font-black text-slate-950">
              {activeAlert ? `${activeAlert.ingredientName} is below safety stock` : "Black Tapioca Pearl is below safety stock"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Current <b className="font-mono text-rose-700">{activeAlert?.currentStock ?? 10}g</b> / Minimum{" "}
              <b className="font-mono">{activeAlert?.minAlertThreshold ?? 50}g</b> ·{" "}
              <span className="font-bold">{activeAlert?.shortage ?? 40}g needed</span> to restore service level.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center lg:w-80">
            <div className="rounded-xl bg-white p-3 ring-1 ring-rose-100">
              <p className="text-[9px] font-bold uppercase text-slate-400">Impact</p>
              <p className="mt-1 text-xs font-black text-slate-800">4 drinks</p>
            </div>
            <div className="rounded-xl bg-white p-3 ring-1 ring-rose-100">
              <p className="text-[9px] font-bold uppercase text-slate-400">Runout</p>
              <p className="mt-1 text-xs font-black text-rose-700">12 mins</p>
            </div>
            <div className="rounded-xl bg-white p-3 ring-1 ring-rose-100">
              <p className="text-[9px] font-bold uppercase text-slate-400">HQ ETA</p>
              <p className="mt-1 text-xs font-black text-slate-800">24 mins</p>
            </div>
          </div>
          <Button variant="primary" onClick={() => openModal("restock")}>
            <Plus size={16} /> Quick inbound
          </Button>
        </div>
      </div>
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        {[
          ["Stock health", "87.4%", "3 items need attention", PackageCheck, "text-emerald-700 bg-emerald-50"],
          ["Inventory value", "₫84.2m", "+2.8% this week", CircleDollarSign, "text-blue-700 bg-blue-50"],
          ["Today’s consumption", "₫6.8m", "1,248 recipe events", TrendingUp, "text-amber-700 bg-amber-50"],
        ].map(([label, value, detail, Icon, color]) => (
          <Panel key={label as string} className="flex items-center gap-4 p-4">
            <span className={`grid size-11 place-items-center rounded-xl ${color}`}>
              <Icon size={20} />
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-500">{label as string}</p>
              <p className="text-xl font-black text-slate-950">{value as string}</p>
              <p className="text-[11px] text-slate-400">{detail as string}</p>
            </div>
          </Panel>
        ))}
      </div>
      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-extrabold text-slate-900">Comprehensive stock ledger</h2>
            <p className="text-xs text-slate-500">Auto-updated from POS transactional events</p>
          </div>
          <div className="flex gap-2">
            <label className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input placeholder="Search ingredients..." className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50" />
            </label>
            <Button>
              <Filter size={15} />
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Ingredient</th>
                <th className="px-5 py-3.5">Code</th>
                <th className="px-5 py-3.5">UoM</th>
                <th className="px-5 py-3.5">Current stock</th>
                <th className="px-5 py-3.5">Min threshold</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Last counted</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inventory.map((item) => {
                const critical = item.current <= item.min;
                const ratio = Math.min(100, (item.current / item.min) * 50);
                return (
                  <tr key={item.code} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4 font-bold text-slate-800">{item.name}</td>
                    <td className="px-5 py-4 font-mono text-xs font-bold text-red-800">{item.code}</td>
                    <td className="px-5 py-4 text-slate-500">{item.unit}</td>
                    <td className="px-5 py-4">
                      <p className={`font-mono font-black ${critical ? "text-rose-700" : "text-slate-800"}`}>{item.current.toLocaleString()}</p>
                      <div className="mt-1.5 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${critical ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${ratio}%` }} />
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-500">{item.min.toLocaleString()}</td>
                    <td className="px-5 py-4">
                      <Badge tone={critical ? "danger" : "success"} pulse={critical}>
                        {critical ? "Critical restock" : "Safe"}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      <Clock3 size={13} className="mr-1 inline" />
                      {item.counted}
                    </td>
                    <td className="px-5 py-4">
                      <Button variant="ghost" className="!size-9 !min-h-9 !p-0">
                        <MoreHorizontal size={17} />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </motion.main>
  );
}

const initialMockCosting: ProductCosting[] = [
  {
    productId: "prod-001",
    sku: "TS-01",
    name: "Trà Sữa Truyền Thống (Lê Lợi Flagship)",
    sellingPrice: 35000,
    totalCogs: 9000,
    grossProfit: 26000,
    grossMarginPercentage: 74.3,
    marginStatus: "Healthy",
    costBreakdown: [
      { ingredientId: "ing-001", ingredientCode: "TEA", ingredientName: "Cốt trà đen Ceylon", unit: "ml", quantity: 30, unitCost: 100, totalCost: 3000, costSharePercentage: 33.3 },
      { ingredientId: "ing-002", ingredientCode: "MILK", ingredientName: "Sữa tươi thanh trùng Dalat", unit: "ml", quantity: 50, unitCost: 120, totalCost: 6000, costSharePercentage: 66.7 },
    ],
  },
  {
    productId: "prod-002",
    sku: "CF-01",
    name: "Cà Phê Sữa Đá Sài Gòn",
    sellingPrice: 29000,
    totalCogs: 7500,
    grossProfit: 21500,
    grossMarginPercentage: 74.1,
    marginStatus: "Healthy",
    costBreakdown: [
      { ingredientId: "ing-003", ingredientCode: "COFFEE", ingredientName: "Cà phê phin Đắk Lắk", unit: "g", quantity: 25, unitCost: 180, totalCost: 4500, costSharePercentage: 60.0 },
      { ingredientId: "ing-004", ingredientCode: "CONDENSED", ingredientName: "Sữa đặc có đường", unit: "g", quantity: 33, unitCost: 90, totalCost: 3000, costSharePercentage: 40.0 },
    ],
  },
  {
    productId: "prod-003",
    sku: "MT-01",
    name: "Trà Oolong Tứ Quý Kem Cheese",
    sellingPrice: 48000,
    totalCogs: 21500,
    grossProfit: 26500,
    grossMarginPercentage: 55.2,
    marginStatus: "Warning",
    costBreakdown: [
      { ingredientId: "ing-001", ingredientCode: "TEA", ingredientName: "Cốt trà Oolong Tứ Quý", unit: "ml", quantity: 40, unitCost: 150, totalCost: 6000, costSharePercentage: 27.9 },
      { ingredientId: "ing-005", ingredientCode: "CHEESE", ingredientName: "Kem phô mai tươi Macchiato", unit: "g", quantity: 50, unitCost: 250, totalCost: 12500, costSharePercentage: 58.1 },
      { ingredientId: "ing-006", ingredientCode: "SUGAR", ingredientName: "Nước đường mía nguyên chất", unit: "ml", quantity: 30, unitCost: 100, totalCost: 3000, costSharePercentage: 14.0 },
    ],
  },
  {
    productId: "prod-004",
    sku: "FR-01",
    name: "Sinh Tố Bơ Dừa Sáp Đặc Biệt",
    sellingPrice: 45000,
    totalCogs: 26000,
    grossProfit: 19000,
    grossMarginPercentage: 42.2,
    marginStatus: "Critical",
    costBreakdown: [
      { ingredientId: "ing-007", ingredientCode: "AVOCADO", ingredientName: "Bơ sáp 034 Đắk Nông", unit: "g", quantity: 120, unitCost: 150, totalCost: 18000, costSharePercentage: 69.2 },
      { ingredientId: "ing-004", ingredientCode: "CONDENSED", ingredientName: "Sữa đặc có đường", unit: "g", quantity: 40, unitCost: 90, totalCost: 3600, costSharePercentage: 13.8 },
      { ingredientId: "ing-002", ingredientCode: "MILK", ingredientName: "Sữa tươi thanh trùng", unit: "ml", quantity: 36, unitCost: 122, totalCost: 4400, costSharePercentage: 17.0 },
    ],
  },
];

const initialMockIngredients: IngredientItem[] = [
  { id: "ing-001", code: "TEA", name: "Cốt trà đen Ceylon", unit: "ml", standardCost: 100, createdAt: "" },
  { id: "ing-002", code: "MILK", name: "Sữa tươi thanh trùng Dalat", unit: "ml", standardCost: 120, createdAt: "" },
  { id: "ing-003", code: "COFFEE", name: "Cà phê phin Đắk Lắk", unit: "g", standardCost: 180, createdAt: "" },
  { id: "ing-004", code: "CONDENSED", name: "Sữa đặc có đường", unit: "g", standardCost: 90, createdAt: "" },
  { id: "ing-005", code: "CHEESE", name: "Kem phô mai tươi Macchiato", unit: "g", standardCost: 250, createdAt: "" },
  { id: "ing-006", code: "SUGAR", name: "Nước đường mía nguyên chất", unit: "ml", standardCost: 100, createdAt: "" },
  { id: "ing-007", code: "AVOCADO", name: "Bơ sáp 034 Đắk Nông", unit: "g", standardCost: 150, createdAt: "" },
  { id: "ing-008", code: "PEARL", name: "Trân châu hoàng kim", unit: "g", standardCost: 50, createdAt: "" },
  { id: "ing-009", code: "JELLY", name: "Thạch củ năng giòn", unit: "g", standardCost: 70, createdAt: "" },
];

function BomStudioScreen() {
  const [productsCosting, setProductsCosting] = useState<ProductCosting[]>(initialMockCosting);
  const [ingredients, setIngredients] = useState<IngredientItem[]>(initialMockIngredients);
  const [selectedProductId, setSelectedProductId] = useState<string>("prod-001");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form state cho món đang chọn
  const [sellingPrice, setSellingPrice] = useState<number>(35000);
  const [recipeItems, setRecipeItems] = useState<{ ingredientId: string; quantity: number }[]>([
    { ingredientId: "ing-001", quantity: 30 },
    { ingredientId: "ing-002", quantity: 50 },
  ]);
  const [selectedIngredientToAdd, setSelectedIngredientToAdd] = useState<string>("");

  useEffect(() => {
    async function loadBackendData() {
      try {
        const [apiCogs, apiIngs] = await Promise.all([
          costingApi.getAllProductsCosting().catch(() => []),
          costingApi.getIngredients().catch(() => []),
        ]);
        if (apiCogs && apiCogs.length > 0) {
          setProductsCosting(apiCogs);
          const first = apiCogs[0];
          setSelectedProductId(first.productId);
          setSellingPrice(first.sellingPrice);
          setRecipeItems(first.costBreakdown.map((b) => ({ ingredientId: b.ingredientId, quantity: b.quantity })));
        }
        if (apiIngs && apiIngs.length > 0) {
          setIngredients(apiIngs);
        }
      } catch {
        // Fallback to initial mocks
      }
    }
    loadBackendData();
  }, []);

  const activeProduct = useMemo(
    () => productsCosting.find((p) => p.productId === selectedProductId) || productsCosting[0],
    [productsCosting, selectedProductId]
  );

  const selectProduct = (p: ProductCosting) => {
    setSelectedProductId(p.productId);
    setSellingPrice(p.sellingPrice);
    setRecipeItems(p.costBreakdown.map((b) => ({ ingredientId: b.ingredientId, quantity: b.quantity })));
    setSaveSuccess(false);
  };

  // Real-time calculation engine trong React
  const calculated = useMemo(() => {
    let totalCogs = 0;
    const items = recipeItems.map((item) => {
      const ing = ingredients.find((i) => i.id === item.ingredientId);
      const unitCost = ing ? ing.standardCost : 0;
      const cost = Math.round(item.quantity * unitCost);
      totalCogs += cost;
      return {
        ingredientId: item.ingredientId,
        code: ing?.code || "ING",
        name: ing?.name || "Nguyên liệu",
        unit: ing?.unit || "đv",
        unitCost,
        quantity: item.quantity,
        totalCost: cost,
      };
    });

    const itemsWithShare = items.map((i) => ({
      ...i,
      share: totalCogs > 0 ? Math.round((i.totalCost / totalCogs) * 1000) / 10 : 0,
    }));

    const grossProfit = sellingPrice - totalCogs;
    const margin = sellingPrice > 0 ? Math.round((grossProfit / sellingPrice) * 1000) / 10 : 0;
    const status: "Healthy" | "Warning" | "Critical" =
      margin >= 65 ? "Healthy" : margin >= 50 ? "Warning" : "Critical";

    return {
      totalCogs,
      grossProfit,
      margin,
      status,
      items: itemsWithShare,
    };
  }, [recipeItems, ingredients, sellingPrice]);

  const updateQuantity = (ingredientId: string, qty: number) => {
    setRecipeItems((prev) =>
      prev.map((item) => (item.ingredientId === ingredientId ? { ...item, quantity: Math.max(0, qty) } : item))
    );
    setSaveSuccess(false);
  };

  const removeIngredient = (ingredientId: string) => {
    setRecipeItems((prev) => prev.filter((item) => item.ingredientId !== ingredientId));
    setSaveSuccess(false);
  };

  const addIngredient = () => {
    if (!selectedIngredientToAdd) return;
    if (recipeItems.some((i) => i.ingredientId === selectedIngredientToAdd)) return;
    setRecipeItems((prev) => [...prev, { ingredientId: selectedIngredientToAdd, quantity: 25 }]);
    setSelectedIngredientToAdd("");
    setSaveSuccess(false);
  };

  const handleSaveRecipe = async () => {
    if (!activeProduct) return;
    try {
      setSaving(true);
      await costingApi.saveProductRecipe(activeProduct.productId, recipeItems);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert("Lưu công thức thất bại: " + (err.message || "Lỗi quyền hạn"));
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return productsCosting;
    const s = search.toLowerCase();
    return productsCosting.filter((p) => p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s));
  }, [productsCosting, search]);

  const gaugeColors = {
    Healthy: "from-emerald-500 to-teal-600 text-emerald-700 bg-emerald-50 border-emerald-200",
    Warning: "from-amber-500 to-orange-500 text-amber-800 bg-amber-50 border-amber-200",
    Critical: "from-rose-500 to-red-600 text-rose-700 bg-rose-50 border-rose-200",
  };

  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-[1600px] px-4 py-6 lg:px-6 space-y-6"
    >
      {/* 1. Header Banner */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-red-700">
            <Sparkles size={14} />
            <span>R&D Barista Lab · Financial Engine</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            Dynamic BoM & COGS Studio
          </h1>
          <p className="text-xs text-slate-500">
            Trực quan hóa định lượng công thức pha chế, tính toán giá vốn hàng bán và bảo vệ biên lợi nhuận thời gian thực.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="brand" pulse>
            What-If Simulator Active
          </Badge>
          <Button variant="secondary" onClick={() => selectProduct(activeProduct)}>
            <RotateCcw size={15} />
            <span>Khôi phục</span>
          </Button>
          <Button variant="primary" onClick={handleSaveRecipe} disabled={saving}>
            {saving ? <RefreshCcw size={15} className="animate-spin" /> : <Save size={15} />}
            <span>{saveSuccess ? "Đã lưu thành công!" : "Lưu công thức"}</span>
          </Button>
        </div>
      </div>

      {saveSuccess && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-bold text-emerald-800">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>Công thức pha chế cho '{activeProduct?.name}' đã được lưu vào hệ thống cơ sở dữ liệu chuỗi!</span>
        </div>
      )}

      {/* 2. Three-Column Workspace Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* CỘT 1: Danh sách sản phẩm (3 cột) */}
        <div className="lg:col-span-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm món theo tên, SKU..."
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3.5 py-2 text-xs font-medium outline-none focus:border-red-600 focus:ring-4 focus:ring-red-50"
            />
          </div>

          <div className="space-y-2 max-h-[750px] overflow-y-auto pr-1">
            {filteredProducts.map((p) => {
              const isSelected = p.productId === selectedProductId;
              const tone = p.marginStatus === "Healthy" ? "success" : p.marginStatus === "Warning" ? "warning" : "danger";
              return (
                <button
                  key={p.productId}
                  onClick={() => selectProduct(p)}
                  className={`w-full text-left rounded-2xl border p-3.5 transition-all duration-150 ${
                    isSelected
                      ? "border-red-700 bg-red-50/50 shadow-md shadow-red-900/5 ring-2 ring-red-700/20"
                      : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-[10px] font-extrabold text-slate-400">{p.sku}</span>
                    <Badge tone={tone}>
                      {p.grossMarginPercentage.toFixed(1)}%
                    </Badge>
                  </div>
                  <h3 className="mt-1 text-sm font-black text-slate-900 line-clamp-1">{p.name}</h3>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Giá bán: {p.sellingPrice.toLocaleString()}₫</span>
                    <span className="font-bold text-slate-700">COGS: {p.totalCogs.toLocaleString()}₫</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* CỘT 2: Visual Recipe Mixer & Component Sliders (5 cột) */}
        <div className="lg:col-span-5 space-y-4">
          <Panel className="p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="font-mono text-xs font-extrabold text-red-700">{activeProduct?.sku}</span>
                <h2 className="text-lg font-black text-slate-950">{activeProduct?.name}</h2>
              </div>
              <div className="text-right">
                <label className="block text-[10px] font-extrabold uppercase text-slate-400">Giá bán niêm yết</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={sellingPrice}
                    step={1000}
                    onChange={(e) => setSellingPrice(Number(e.target.value))}
                    className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm font-black text-slate-900 outline-none focus:border-red-600"
                  />
                  <span className="text-xs font-bold text-slate-500">₫</span>
                </div>
              </div>
            </div>

            {/* Danh sách thanh trượt định lượng */}
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                <span>Thành phần công thức ly chuẩn</span>
                <span>Chi phí tiêu hao</span>
              </div>

              {calculated.items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                  Món này chưa có định lượng nguyên liệu. Hãy chọn nguyên liệu bên dưới để thêm vào ly.
                </div>
              ) : (
                calculated.items.map((item) => (
                  <div
                    key={item.ingredientId}
                    className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2.5 transition hover:border-slate-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="grid size-6 place-items-center rounded bg-red-100 text-[10px] font-black text-red-800">
                          {item.code.slice(0, 2)}
                        </span>
                        <div>
                          <span className="text-xs font-bold text-slate-900">{item.name}</span>
                          <span className="block text-[10px] text-slate-400 font-mono">
                            Đơn giá: {item.unitCost.toLocaleString()}₫/{item.unit}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-900">
                          {item.totalCost.toLocaleString()}₫
                        </span>
                        <button
                          type="button"
                          onClick={() => removeIngredient(item.ingredientId)}
                          className="text-slate-400 hover:text-rose-600 transition"
                          title="Xóa nguyên liệu"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Interactive Slider */}
                    <div className="flex items-center gap-3 pt-1">
                      <input
                        type="range"
                        min="0"
                        max="150"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.ingredientId, Number(e.target.value))}
                        className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-red-700"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          min="0"
                          max="500"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.ingredientId, Number(e.target.value))}
                          className="w-16 rounded-md border border-slate-200 px-2 py-0.5 text-center text-xs font-bold text-slate-900 outline-none focus:border-red-600"
                        />
                        <span className="text-[11px] font-bold text-slate-400">{item.unit}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Thêm nguyên liệu */}
              <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                <select
                  value={selectedIngredientToAdd}
                  onChange={(e) => setSelectedIngredientToAdd(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-red-600"
                >
                  <option value="">-- Chọn nguyên liệu thêm vào ly --</option>
                  {ingredients
                    .filter((ing) => !recipeItems.some((r) => r.ingredientId === ing.id))
                    .map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({ing.code}) · {ing.standardCost.toLocaleString()}₫/{ing.unit}
                      </option>
                    ))}
                </select>
                <Button variant="secondary" onClick={addIngredient} disabled={!selectedIngredientToAdd} className="!text-xs">
                  <Plus size={15} />
                  <span>Thêm</span>
                </Button>
              </div>
            </div>
          </Panel>
        </div>

        {/* CỘT 3: Real-time Margin Gauge & Financial Intelligence (4 cột) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Margin Gauge Card */}
          <Panel className={`p-6 border-2 ${gaugeColors[calculated.status]} transition-all`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                Gross Margin Gauge
              </span>
              <Badge
                tone={
                  calculated.status === "Healthy"
                    ? "success"
                    : calculated.status === "Warning"
                    ? "warning"
                    : "danger"
                }
                pulse
              >
                {calculated.status}
              </Badge>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tight text-slate-950">
                {calculated.margin.toFixed(1)}%
              </span>
              <span className="text-xs font-extrabold text-slate-400">biên lợi nhuận gộp</span>
            </div>

            {/* Visual Progress Bar */}
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-200/80">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  calculated.status === "Healthy"
                    ? "bg-emerald-500"
                    : calculated.status === "Warning"
                    ? "bg-amber-500"
                    : "bg-rose-500"
                }`}
                style={{ width: `${Math.min(100, Math.max(0, calculated.margin))}%` }}
              />
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-600">
              {calculated.status === "Healthy" && "🟢 Tỷ suất sinh lời tuyệt vời. Món này đạt chuẩn lợi nhuận mục tiêu chuỗi F&B (≥65%)."}
              {calculated.status === "Warning" && "🟡 Cảnh báo: Lợi nhuận gộp ở mức trung bình (50-65%). Cân nhắc điều chỉnh định lượng hoặc giá bán."}
              {calculated.status === "Critical" && "🔴 Nguy hiểm: Biên lợi nhuận dưới 50%! Cần rà soát ngay chi phí nguyên liệu để tránh rủi ro lỗ giá vốn."}
            </p>
          </Panel>

          {/* KPI Summary Cards */}
          <Panel className="p-5 space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Cơ cấu Tài chính</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Giá vốn (COGS)</span>
                <span className="block text-base font-black text-rose-600">
                  {calculated.totalCogs.toLocaleString()}₫
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Lợi nhuận gộp</span>
                <span className="block text-base font-black text-emerald-600">
                  {calculated.grossProfit.toLocaleString()}₫
                </span>
              </div>
            </div>

            {/* Tỷ trọng chi phí nguyên liệu */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Tỷ trọng chi phí nguyên liệu (%)
              </span>
              <div className="space-y-1.5">
                {calculated.items.map((item) => (
                  <div key={item.ingredientId} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-slate-700">{item.name}</span>
                      <span className="font-mono text-slate-500">{item.share}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-red-700 rounded-full"
                        style={{ width: `${item.share}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </motion.main>
  );
}

export interface PosProduct {
  id: string;
  name: string;
  category: string;
  sku: string;
  price: number;
  image: string;
}

const defaultPosProducts: PosProduct[] = [
  {
    id: "09ffff04-0f0b-4200-994a-d7decc20d2cc",
    name: "Phin Sữa Đá Đậm Đà",
    category: "Coffee",
    sku: "CF-01",
    price: 29000,
    image: "https://images.unsplash.com/photo-1650527122326-0abd4c8c0f99?auto=format&fit=crop&w=700&q=85",
  },
  {
    id: "dd5dbb7a-938a-4cad-bfb3-658b36e9a5e5",
    name: "Bạc Xỉu Sữa Tươi 3 Tầng",
    category: "Coffee",
    sku: "CF-02",
    price: 32000,
    image: "https://images.unsplash.com/photo-1687902625864-faedb40f83a8?auto=format&fit=crop&w=700&q=85",
  },
  {
    id: "9398818e-183c-4b68-8780-42719896f4b5",
    name: "Cà Phê Muối Xứ Huế",
    category: "Coffee",
    sku: "CF-03",
    price: 35000,
    image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=700&q=85",
  },
  {
    id: "8009ae26-207a-4a4e-9ee0-0e0819b17737",
    name: "Trà Sen Vàng Kem Cheese",
    category: "Tea",
    sku: "TEA-01",
    price: 45000,
    image: "https://images.unsplash.com/photo-1601919764353-922faa5c0eb4?auto=format&fit=crop&w=700&q=85",
  },
  {
    id: "55c9b685-7d0b-4dac-8a51-a3ec01949fd6",
    name: "Trà Đào Cam Sả Tươi",
    category: "Tea",
    sku: "TEA-02",
    price: 45000,
    image: "https://images.unsplash.com/photo-1761335831408-c8c3e16c2c1d?auto=format&fit=crop&w=700&q=85",
  },
  {
    id: "577d3866-b7c3-4189-8e7f-2340224991de",
    name: "Freeze Trà Xanh Thạch",
    category: "Freeze",
    sku: "FRZ-01",
    price: 55000,
    image: "https://images.unsplash.com/photo-1786602181711-b9ebb69caf3c?auto=format&fit=crop&w=700&q=85",
  },
  {
    id: "5753143c-abcf-4ce2-b57d-b96f62c13ae2",
    name: "Bánh Mì Que Hải Phòng Cay",
    category: "Bakery",
    sku: "BK-01",
    price: 19000,
    image: "https://images.unsplash.com/photo-1612737144187-d51c1483225a?auto=format&fit=crop&w=700&q=85",
  },
];

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  size: string;
  toppings: string[];
}

function PosScreen({
  openModal,
  currentUser,
  onCheckoutSuccess,
}: {
  openModal: (modal: Modal) => void;
  currentUser: User | null;
  onCheckoutSuccess: (receipt: ReceiptData) => void;
}) {
  const [category, setCategory] = useState("All");
  const [productList, setProductList] = useState<PosProduct[]>(defaultPosProducts);

  useEffect(() => {
    let isMounted = true;
    api.getProducts()
      .then((items) => {
        if (!isMounted || !items || items.length === 0) return;
        const mapped: PosProduct[] = items.map((p) => {
          const matched = defaultPosProducts.find(
            (dp) => dp.sku.toLowerCase() === p.sku.toLowerCase() || dp.name.toLowerCase() === p.name.toLowerCase()
          );
          return {
            id: p.id,
            name: p.name,
            sku: p.sku,
            category: p.categoryName || matched?.category || "Coffee",
            price: p.basePrice,
            image:
              matched?.image ||
              "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=700&q=85",
          };
        });
        setProductList(mapped);
      })
      .catch((err) => console.warn("Could not load backend products for POS:", err));
    return () => {
      isMounted = false;
    };
  }, []);

  const categories = useMemo(() => {
    const list = Array.from(new Set(productList.map((p) => p.category)));
    return ["All", ...list];
  }, [productList]);
  const [cart, setCart] = useState<CartItem[]>([
    {
      id: "init-1",
      productId: "09ffff04-0f0b-4200-994a-d7decc20d2cc",
      name: "Phin Sữa Đá Đậm Đà",
      price: 29000,
      quantity: 1,
      size: "M",
      toppings: ["Black pearl"],
    },
    {
      id: "init-2",
      productId: "577d3866-b7c3-4189-8e7f-2340224991de",
      name: "Freeze Trà Xanh Thạch",
      price: 55000,
      quantity: 1,
      size: "L",
      toppings: ["Cheese foam"],
    },
  ]);
  const [payment, setPayment] = useState<Payment>("Cash");
  const [orderType, setOrderType] = useState("Take-away");
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [offlineCount, setOfflineCount] = useState<number>(() => getPendingOfflineOrderCount());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [ticketSeq, setTicketSeq] = useState(() => Math.floor(100 + Math.random() * 900));
  const [showVietQrModal, setShowVietQrModal] = useState<boolean>(false);

  const effectiveStoreId = currentUser?.storeId || "22222222-2222-2222-2222-222222222222";
  const effectiveStoreName =
    currentUser?.storeId === "33333333-3333-3333-3333-333333333333"
      ? "Chi nhánh Landmark 81"
      : "Chi nhánh Quận 1 (Flagship Store)";
  const cashierDisplayName = currentUser?.fullName || currentUser?.username || "Linh (Thu ngân 01)";

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setOfflineCount(getPendingOfflineOrderCount());
    };
    const handleOffline = () => {
      setIsOnline(false);
      setOfflineCount(getPendingOfflineOrderCount());
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const cleanupSync = initOfflineSyncListeners(effectiveStoreId, () => {
      setOfflineCount(getPendingOfflineOrderCount());
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      cleanupSync();
    };
  }, [effectiveStoreId]);

  const filtered = category === "All" ? productList : productList.filter((product) => product.category === category);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity + item.toppings.length * 10000, 0);
  const vat = Math.round(subtotal * 0.08);
  const total = subtotal + vat;

  const currentOrderCode = useMemo(
    () => `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${ticketSeq}`,
    [ticketSeq]
  );

  const add = (product: PosProduct) =>
    setCart((items) => {
      const current = items.find((item) => item.productId === product.id && item.size === "M");
      return current
        ? items.map((item) => (item.id === current.id ? { ...item, quantity: item.quantity + 1 } : item))
        : [
            ...items,
            {
              id: `${product.id}-${Date.now()}`,
              productId: product.id,
              name: product.name,
              price: product.price,
              quantity: 1,
              size: "M",
              toppings: [],
            },
          ];
    });

  const updateQty = (id: string, delta: number) =>
    setCart((items) =>
      items
        .map((item) => (item.id === id ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0)
    );

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const res = await syncPendingOfflineOrders(effectiveStoreId);
      setOfflineCount(getPendingOfflineOrderCount());
      alert(`Đồng bộ thành công: ${res.successfulCount} đơn mới, ${res.duplicateSkippedCount} đơn đã tồn tại.`);
    } catch (err: any) {
      alert(`Lỗi đồng bộ: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const executeOfflineCheckout = () => {
    const mappedOrderType = orderType === "Dine-in" ? 0 : 1;
    const mappedPaymentMethod = payment === "Cash" ? 0 : payment === "Credit Card" ? 1 : 2;

    const offlineOrderId = `OFF-${Date.now()}`;
    const idempotencyKey = `POS-OFF-${offlineOrderId}`;
    const offlineOrder: OfflineOrderSyncItem = {
      offlineOrderId,
      idempotencyKey,
      storeId: effectiveStoreId,
      paymentMethod: mappedPaymentMethod,
      orderType: mappedOrderType,
      subtotal,
      discountAmount: 0,
      vatAmount: vat,
      finalAmount: total,
      offlineCreatedAt: new Date().toISOString(),
      items: cart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.price,
        specialNote: item.size ? `Size ${item.size}` : undefined,
        modifiers: item.toppings.map((t) => ({
          name: t,
          extraPrice: 10000,
          consumptionQuantity: 25,
        })),
      })),
    };

    enqueueOfflineOrder(offlineOrder);
    setOfflineCount(getPendingOfflineOrderCount());

    const offlineReceipt: ReceiptData = {
      orderId: offlineOrderId,
      orderNumber: offlineOrderId,
      subtotal,
      vatAmount: vat,
      finalAmount: total,
      createdAt: new Date().toISOString(),
      paymentMethod: payment,
      orderType: orderType,
      storeName: effectiveStoreName,
      storeAddress: "12 Lê Lợi, P. Bến Nghé, Quận 1, TP. HCM",
      storePhone: "028 3822 1234",
      cashierName: cashierDisplayName,
      counterName: "Counter 03 · Shift A",
      items: cart.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        size: i.size,
        toppings: i.toppings,
      })),
      isOffline: true,
    };

    audioNotifier.playOrderChime("standard");
    setCart([]);
    setTicketSeq((seq) => seq + 1);
    setShowVietQrModal(false);
    onCheckoutSuccess(offlineReceipt);
  };

  const executeOnlineCheckout = async () => {
    const mappedOrderType = orderType === "Dine-in" ? 0 : 1;
    const mappedPaymentMethod = payment === "Cash" ? 0 : payment === "Credit Card" ? 1 : 2;

    try {
      setIsSyncing(true);
      const payload: CheckoutOrderPayload = {
        storeId: effectiveStoreId,
        cashierId: currentUser?.id,
        orderType: mappedOrderType,
        paymentMethod: mappedPaymentMethod,
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          specialNote: item.size ? `Size ${item.size}` : undefined,
          modifiers: item.toppings.map((t) => ({
            name: t,
            extraPrice: 10000,
            consumptionQuantity: 25,
          })),
        })),
      };

      const result = await api.checkout(payload);

      const receipt: ReceiptData = {
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        subtotal: result.subtotal,
        vatAmount: result.vatAmount,
        finalAmount: result.finalAmount,
        createdAt: result.createdAt,
        paymentMethod: payment,
        orderType: orderType,
        storeName: effectiveStoreName,
        storeAddress: "12 Lê Lợi, P. Bến Nghé, Quận 1, TP. HCM",
        storePhone: "028 3822 1234",
        cashierName: cashierDisplayName,
        counterName: "Counter 03 · Shift A",
        items: cart.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          price: i.price,
          size: i.size,
          toppings: i.toppings,
        })),
        deductedIngredients: result.deductedIngredients,
        isOffline: false,
      };

      audioNotifier.playOrderChime("standard");
      setTimeout(() => {
        audioNotifier.speakAnnouncement(
          `Thanh toán thành công đơn hàng số ${result.orderNumber.slice(-4)}`
        );
      }, 350);

      setCart([]);
      setTicketSeq((seq) => seq + 1);
      setShowVietQrModal(false);
      onCheckoutSuccess(receipt);
    } catch (err: any) {
      console.warn("API checkout failed, falling back to offline queue:", err);
      executeOfflineCheckout();
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePay = async () => {
    if (!cart.length) return;

    if (!isOnline) {
      executeOfflineCheckout();
      return;
    }

    if (payment === "QR Transfer") {
      setShowVietQrModal(true);
      return;
    }

    await executeOnlineCheckout();
  };

  return (
    <motion.main initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="mx-auto grid max-w-[1600px] gap-4 px-3 py-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(350px,0.75fr)] lg:px-5">
      <section className="min-w-0">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-red-700">Counter 03 · Shift A</p>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">
              Good morning, {currentUser?.fullName || currentUser?.username || "Linh"}
            </h1>
            <p className="text-xs text-slate-500">Tap a menu item to start building the order.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isOnline ? (
              <Badge tone="success" pulse>
                Terminal online
              </Badge>
            ) : (
              <Badge tone="danger" pulse>
                Offline Mode
              </Badge>
            )}
            {offlineCount > 0 && (
              <Badge tone="warning">
                {offlineCount} đơn chờ nộp
              </Badge>
            )}
            <Button
              variant={offlineCount > 0 ? "primary" : "secondary"}
              disabled={isSyncing || (!isOnline && offlineCount === 0)}
              onClick={handleManualSync}
              className="!text-xs !py-1 !px-3 !min-h-8"
              title="Đồng bộ các đơn offline lên máy chủ"
            >
              <RefreshCcw size={14} className={isSyncing ? "animate-spin" : ""} />
              {isSyncing ? "Đang nộp..." : "Đồng bộ"}
            </Button>
            <Button>
              <MoreHorizontal size={18} />
            </Button>
          </div>
        </div>

        {!isOnline && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 shadow-sm animate-pulse">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="text-amber-600 shrink-0" size={18} />
              <span>⚠️ Đang ở chế độ Offline - Các đơn thanh toán sẽ lưu tạm tại máy POS và tự động nộp lại khi có kết nối Internet.</span>
            </div>
            {offlineCount > 0 && (
              <span className="shrink-0 rounded-lg bg-amber-200/80 px-2.5 py-1 font-mono font-black text-amber-950">
                {offlineCount} đơn trong hàng đợi
              </span>
            )}
          </div>
        )}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {categories.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`min-w-max rounded-xl px-4 py-2.5 text-xs font-extrabold transition-all active:scale-[0.98] ${
                category === item ? "bg-red-800 text-white shadow-md shadow-red-900/15" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {filtered.map((product) => (
            <motion.article layout key={product.id} className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/60">
              <button
                onClick={() => add(product)}
                className="w-full text-left"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                  <img src={product.image} alt={product.name} className="size-full object-cover transition duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/25 to-transparent" />
                  <Badge tone="neutral">
                    <span className="absolute left-3 top-3">{product.category}</span>
                  </Badge>
                </div>
                <div className="p-3.5">
                  <p className="truncate text-sm font-extrabold text-slate-900">{product.name}</p>
                  <p className="mt-0.5 font-mono text-[9px] font-bold text-slate-400">{product.sku}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="font-mono text-sm font-black text-red-800">{product.price.toLocaleString("vi-VN")} đ</p>
                    <span className="grid size-9 place-items-center rounded-xl bg-red-50 text-red-800 transition group-hover:bg-red-800 group-hover:text-white">
                      <Plus size={18} />
                    </span>
                  </div>
                </div>
              </button>
            </motion.article>
          ))}
        </div>
      </section>
      <Panel className="flex max-h-[calc(100vh-6rem)] min-h-[650px] flex-col overflow-hidden lg:sticky lg:top-20">
        <div className="border-b border-slate-200 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Current ticket</p>
              <h2 className="mt-0.5 font-mono text-sm font-black text-slate-900">#{currentOrderCode}</h2>
            </div>
            <Button variant="ghost" className="!size-9 !min-h-9 !p-0">
              <MoreHorizontal size={18} />
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
            {["Dine-in", "Take-away"].map((type) => (
              <button
                key={type}
                onClick={() => setOrderType(type)}
                className={`rounded-lg py-2 text-xs font-extrabold transition ${orderType === type ? "bg-white text-red-800 shadow-sm" : "text-slate-500"}`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <ShoppingBag className="mx-auto text-slate-300" size={36} />
                <p className="mt-3 font-bold text-slate-600">Ticket is empty</p>
                <p className="text-xs text-slate-400">Choose a product to begin</p>
              </div>
            </div>
          ) : (
            cart.map((item) => (
              <motion.div layout key={item.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <div className="flex gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-red-50 text-xs font-black text-red-800">{item.quantity}×</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="truncate text-sm font-extrabold text-slate-800">{item.name}</p>
                        <p className="text-[10px] font-semibold text-slate-400">Size {item.size} · Standard ice</p>
                      </div>
                      <p className="shrink-0 font-mono text-xs font-black text-slate-800">{(item.price * item.quantity).toLocaleString("vi-VN")} đ</p>
                    </div>
                    {item.toppings.map((topping) => (
                      <div key={topping} className="mt-2 flex items-center justify-between rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-900">
                        <span>+ {topping}</span>
                        <span>10,000 đ</span>
                      </div>
                    ))}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center rounded-lg border border-slate-200 bg-white">
                        <button onClick={() => updateQty(item.id, -1)} className="grid size-7 place-items-center text-slate-500">
                          <Minus size={12} />
                        </button>
                        <motion.span key={item.quantity} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className="w-7 text-center text-xs font-black">
                          {item.quantity}
                        </motion.span>
                        <button onClick={() => updateQty(item.id, 1)} className="grid size-7 place-items-center text-slate-500">
                          <Plus size={12} />
                        </button>
                      </div>
                      <Button variant="ghost" onClick={() => setCart((items) => items.filter((cartItem) => cartItem.id !== item.id))} className="!size-7 !min-h-7 !p-0 hover:!bg-rose-50 hover:!text-rose-600">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
        <div className="border-t border-slate-200 bg-white p-4">
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span className="font-mono font-bold text-slate-800">{subtotal.toLocaleString("vi-VN")} đ</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>VAT (8%)</span>
              <span className="font-mono font-bold text-slate-800">{vat.toLocaleString("vi-VN")} đ</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Discount</span>
              <span className="font-mono font-bold">0 đ</span>
            </div>
          </div>
          <div className="my-4 flex items-end justify-between border-t border-dashed border-slate-200 pt-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Amount due</p>
              <p className="text-xs text-slate-500">{cart.reduce((sum, item) => sum + item.quantity, 0)} items</p>
            </div>
            <p className="font-mono text-2xl font-black tracking-tight text-red-800">{total.toLocaleString("vi-VN")} đ</p>
          </div>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {(
              [
                { name: "Cash", icon: Banknote },
                { name: "QR Transfer", icon: QrCode },
                { name: "Credit Card", icon: CreditCard },
              ] as { name: Payment; icon: typeof Banknote }[]
            ).map(({ name, icon: Icon }) => (
              <button
                key={name}
                onClick={() => setPayment(name)}
                className={`flex flex-col items-center gap-1 rounded-xl border py-2 text-[9px] font-bold transition ${
                  payment === name ? "border-red-300 bg-red-50 text-red-800 ring-2 ring-red-100" : "border-slate-200 text-slate-500"
                }`}
              >
                <Icon size={17} />
                {name}
              </button>
            ))}
          </div>

          {payment === "QR Transfer" && total > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3 overflow-hidden rounded-2xl border border-red-200 bg-gradient-to-b from-red-50/70 to-white p-3 shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-red-100 pb-2">
                <span className="flex items-center gap-1.5 text-xs font-black text-red-900">
                  <QrCode size={15} className="text-red-700" /> VietQR Napas 247
                </span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-800">
                  Khớp lệnh tức thì
                </span>
              </div>
              <div className="my-2.5 flex flex-col items-center">
                <div className="relative rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
                  <img
                    src={`https://img.vietqr.io/image/vietinbank-100878137043-compact2.png?amount=${total}&addInfo=ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}&accountName=NGUYEN%20QUANG%20HUY`}
                    alt="VietQR VietinBank Payment"
                    className="size-44 object-contain"
                  />
                </div>
                <p className="mt-1 text-[10px] text-slate-400">Quét qua App Ngân hàng hoặc Ví MoMo</p>
              </div>
              <div className="space-y-1.5 rounded-xl border border-slate-100 bg-white p-2.5 text-[11px] shadow-xs">
                <div className="flex justify-between">
                  <span className="font-medium text-slate-400">Ngân hàng:</span>
                  <span className="font-bold text-slate-800">VietinBank (ICB)</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-400">Số tài khoản:</span>
                  <span className="font-mono font-black text-red-700">100878137043</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-400">Chủ tài khoản:</span>
                  <span className="font-bold uppercase text-slate-800">NGUYEN QUANG HUY</span>
                </div>
                <div className="flex justify-between border-t border-dashed border-slate-100 pt-1">
                  <span className="font-medium text-slate-400">Số tiền thanh toán:</span>
                  <span className="font-mono font-black text-emerald-700">{total.toLocaleString("vi-VN")} đ</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowVietQrModal(true)}
                className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-800 to-red-700 py-2.5 px-3 text-xs font-bold text-white shadow-md shadow-red-900/15 hover:from-red-700 hover:to-red-600 transition active:scale-98"
              >
                <QrCode size={16} /> Mở Kiosk Quét Mã (Toàn màn hình)
              </button>
            </motion.div>
          )}

          <Button variant="primary" disabled={!cart.length} onClick={handlePay} className="w-full !min-h-13 text-xs tracking-wide">
            <ShieldCheck size={18} /> {isOnline ? (payment === "QR Transfer" ? "Mở Kiosk Quét VietQR Napas" : "Pay & deduct inventory") : "Lưu đơn ngoại tuyến (Offline)"} <span className="ml-auto rounded-md bg-white/15 px-1.5 py-0.5 font-mono">F9</span>
          </Button>
        </div>
      </Panel>

      {showVietQrModal && (
        <VietQrModal
          orderCode={currentOrderCode}
          amount={total}
          storeName={effectiveStoreName}
          isProcessing={isSyncing}
          onClose={() => setShowVietQrModal(false)}
          onSuccess={async () => {
            await executeOnlineCheckout();
          }}
        />
      )}
    </motion.main>
  );
}

function ModalShell({ onClose, children, side = false }: { onClose: () => void; children: ReactNode; side?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex bg-slate-950/40 backdrop-blur-sm" onMouseDown={onClose}>
      <motion.div
        initial={side ? { x: "100%" } : { opacity: 0, scale: 0.96, y: 12 }}
        animate={side ? { x: 0 } : { opacity: 1, scale: 1, y: 0 }}
        exit={side ? { x: "100%" } : { opacity: 0, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        onMouseDown={(e) => e.stopPropagation()}
        className={`${side ? "ml-auto h-full w-full max-w-lg rounded-none" : "m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl"} overflow-y-auto bg-white shadow-2xl`}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function Field({
  label,
  placeholder,
  error,
  value,
  onChange,
  required,
  type = "text",
  disabled = false,
}: {
  label: string;
  placeholder?: string;
  error?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-700">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      <input
        type={type}
        disabled={disabled}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none transition focus:ring-4 disabled:bg-slate-50 disabled:text-slate-500 ${
          error ? "border-rose-300 focus:border-rose-400 focus:ring-rose-50" : "border-slate-200 focus:border-red-300 focus:ring-red-50"
        }`}
      />
      {error && (
        <span className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-rose-600">
          <AlertTriangle size={12} />
          {error}
        </span>
      )}
    </label>
  );
}

function LoginModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (user: User) => void;
}) {
  const [tab, setTab] = useState<"password" | "otp">("password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSubmit = async (e?: React.FormEvent, customUser?: string, customPass?: string) => {
    if (e) e.preventDefault();
    const u = (customUser ?? username).trim();
    const p = customPass ?? password;
    if (!u || !p) {
      setError("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await apiLogin({ username: u, password: p });
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || "Đăng nhập thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setError("Vui lòng nhập địa chỉ email hợp lệ để nhận mã OTP.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await sendOtp(trimmedEmail);
      setOtpSent(true);
      setCountdown(60);
      setSuccessMsg(`Mã OTP đã được gửi đến ${trimmedEmail}. Vui lòng kiểm tra hộp thư!`);
    } catch (err: any) {
      setError(err.message || "Không thể gửi mã OTP. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedOtp = otpCode.trim();
    if (!trimmedEmail || !trimmedOtp) {
      setError("Vui lòng nhập email và mã OTP 6 chữ số.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await verifyOtpLogin(trimmedEmail, trimmedOtp);
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || "Xác thực OTP không thành công hoặc mã đã hết hạn.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setSuccessMsg(null);
    const gWindow = window as any;
    if (gWindow.google?.accounts?.id) {
      gWindow.google.accounts.id.prompt();
      return;
    }
    const token = prompt("Nhập Google ID Token (hoặc nhấn OK để đăng nhập tài khoản Google mẫu):");
    if (token === null) return;
    setLoading(true);
    try {
      const res = await googleLogin(token || "demo-google-token");
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || "Đăng nhập Google thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    handleSubmit(undefined, u, p);
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-start justify-between border-b border-slate-100 p-6 pb-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-red-100 text-red-800">
            <Lock size={22} />
          </span>
          <div>
            <h2 className="text-xl font-black text-slate-950">Xác thực ca làm việc POS</h2>
            <p className="text-xs text-slate-500">Đăng nhập tài khoản nhân sự / quản trị viên</p>
          </div>
        </div>
        <Button variant="ghost" onClick={onClose} className="!size-10 !p-0">
          <X size={18} />
        </Button>
      </div>

      <div className="flex border-b border-slate-100 bg-slate-50/50 p-2">
        <button
          type="button"
          onClick={() => {
            setTab("password");
            setError(null);
            setSuccessMsg(null);
          }}
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
            tab === "password" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Mật khẩu
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("otp");
            setError(null);
            setSuccessMsg(null);
          }}
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
            tab === "otp" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Mã OTP Email
        </button>
      </div>

      <div className="space-y-4 p-6">
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {tab === "password" ? (
          <form onSubmit={(e) => handleSubmit(e)} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-extrabold text-slate-700">Tên đăng nhập (Username)</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin / cashier_q1"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-red-600 focus:ring-4 focus:ring-red-50"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-extrabold text-slate-700">Mật khẩu (Password)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-red-600 focus:ring-4 focus:ring-red-50"
                required
              />
            </div>

            <Button variant="primary" type="submit" disabled={loading} className="w-full !min-h-11">
              {loading ? <RefreshCcw size={16} className="animate-spin" /> : <KeyRound size={16} />}
              <span>{loading ? "Đang xác thực..." : "Đăng nhập nhận ca"}</span>
            </Button>

            <div className="pt-2">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <span className="relative bg-white px-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Tài khoản Demo nhanh
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => quickLogin("admin", "Admin123!")}
                  className="flex flex-col items-center rounded-xl border border-slate-200 p-2 text-center transition hover:border-red-400 hover:bg-red-50"
                >
                  <span className="text-[10px] font-black text-red-800">HQ Admin</span>
                  <span className="font-mono text-[9px] text-slate-400">admin</span>
                </button>
                <button
                  type="button"
                  onClick={() => quickLogin("supply_chain", "Supply123!")}
                  className="flex flex-col items-center rounded-xl border border-slate-200 p-2 text-center transition hover:border-purple-400 hover:bg-purple-50"
                >
                  <span className="text-[10px] font-black text-purple-800">Supply Chain</span>
                  <span className="font-mono text-[9px] text-slate-400">supply_chain</span>
                </button>
                <button
                  type="button"
                  onClick={() => quickLogin("manager_q1", "Manager123!")}
                  className="flex flex-col items-center rounded-xl border border-slate-200 p-2 text-center transition hover:border-blue-400 hover:bg-blue-50"
                >
                  <span className="text-[10px] font-black text-blue-800">Manager Q1</span>
                  <span className="font-mono text-[9px] text-slate-400">manager_q1</span>
                </button>
                <button
                  type="button"
                  onClick={() => quickLogin("cashier_q1", "Cashier123!")}
                  className="flex flex-col items-center rounded-xl border border-slate-200 p-2 text-center transition hover:border-emerald-400 hover:bg-emerald-50"
                >
                  <span className="text-[10px] font-black text-emerald-800">Cashier Q1</span>
                  <span className="font-mono text-[9px] text-slate-400">cashier_q1</span>
                </button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-extrabold text-slate-700">Email nhận OTP</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 grid w-10 place-items-center text-slate-400">
                    <Mail size={16} />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nguyenquanghuy14022005@gmail.com"
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-red-600 focus:ring-4 focus:ring-red-50"
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading || countdown > 0}
                  className="shrink-0 rounded-xl bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {countdown > 0 ? `${countdown}s` : otpSent ? "Gửi lại" : "Gửi OTP"}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-extrabold text-slate-700">Mã OTP (6 chữ số)</label>
              <input
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="w-full tracking-widest text-center font-mono text-lg font-bold rounded-xl border border-slate-200 px-3.5 py-2 outline-none focus:border-red-600 focus:ring-4 focus:ring-red-50"
                required
              />
            </div>

            <Button variant="primary" type="submit" disabled={loading} className="w-full !min-h-11">
              {loading ? <RefreshCcw size={16} className="animate-spin" /> : <KeyRound size={16} />}
              <span>{loading ? "Đang xác thực..." : "Xác nhận OTP & Đăng nhập"}</span>
            </Button>
          </form>
        )}

        <div className="pt-2">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <span className="relative bg-white px-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Hoặc tiếp tục với
            </span>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:border-slate-300 active:scale-[0.99]"
          >
            <svg className="size-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Đăng nhập với Google</span>
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function StoreModal({
  onClose,
  onStoreCreated,
}: {
  onClose: () => void;
  onStoreCreated?: (createdStore?: { code: string; name: string; address?: string; phoneNumber?: string }) => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setError("Mã chi nhánh và Tên chi nhánh là bắt buộc.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const created = await api.createStore({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        address: address.trim() || "Việt Nam",
        phoneNumber: phoneNumber.trim() || "028 3822 1234",
      });
      onStoreCreated?.(created);
      onClose();
    } catch (err: any) {
      if (err.message && (err.message.includes("409") || err.message.includes("đã tồn tại"))) {
        setError(`Mã chi nhánh '${code.trim().toUpperCase()}' đã tồn tại trong hệ thống.`);
        return;
      }
      // Fallback for network/offline: optimistic store object
      const fallbackStore = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        address: address.trim() || "Việt Nam",
        phoneNumber: phoneNumber.trim() || "028 3822 1234",
      };
      onStoreCreated?.(fallbackStore);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell side onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 p-6">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-red-700">Network expansion</p>
            <h2 className="text-xl font-black text-slate-950">Create franchise store</h2>
          </div>
          <Button variant="ghost" type="button" onClick={onClose} className="!size-10 !p-0">
            <X size={19} />
          </Button>
        </div>
        <div className="flex-1 space-y-5 p-6 overflow-y-auto">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-relaxed text-blue-800">
            <b>Mã chi nhánh là duy nhất.</b> Hệ thống sẽ tự động gán tài khoản nhượng quyền và kích hoạt trên hệ thống đám mây.
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Store code"
              placeholder="e.g. HL-25"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <Field
              label="Phone number"
              placeholder="+84 28 ..."
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
          </div>
          <Field
            label="Store name"
            placeholder="Highlands Nguyễn Huệ"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Field
            label="Street address"
            placeholder="Địa chỉ kinh doanh đầy đủ"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white p-5">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            <Check size={16} /> {isSubmitting ? "Creating..." : "Create store"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

function RestockModal({
  onClose,
  storeId,
  onRestocked,
}: {
  onClose: () => void;
  storeId: string;
  onRestocked?: () => void;
}) {
  const [ingredients, setIngredients] = useState<ApiIngredientItem[]>([]);
  const [selectedIngredientId, setSelectedIngredientId] = useState("");
  const [quantity, setQuantity] = useState("500");
  const [notes, setNotes] = useState("TRF-2026-HQ");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    api.getIngredients()
      .then((items) => {
        if (!isMounted || !items || items.length === 0) return;
        setIngredients(items);
        setSelectedIngredientId(items[0].id);
      })
      .catch((err) => console.warn("Could not load ingredients for restock:", err));
    return () => {
      isMounted = false;
    };
  }, []);

  const selectedIng = ingredients.find((i) => i.id === selectedIngredientId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIngredientId || !quantity || Number(quantity) <= 0) {
      setError("Vui lòng chọn nguyên liệu và nhập số lượng nhập kho hợp lệ.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await api.inboundStock({
        storeId,
        ingredientId: selectedIngredientId,
        quantity: Number(quantity),
        note: notes,
      });
      onRestocked?.();
      onClose();
    } catch (err: any) {
      setError(err.message || "Nhập kho thất bại. Vui lòng kiểm tra lại kết nối.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="flex items-start justify-between p-6 pb-3">
          <div>
            <span className="mb-3 grid size-11 place-items-center rounded-xl bg-red-50 text-red-800">
              <PackagePlus size={21} />
            </span>
            <h2 className="text-xl font-black text-slate-950">Inbound from HQ</h2>
            <p className="mt-1 text-sm text-slate-500">Create a verified stock ledger entry.</p>
          </div>
          <Button variant="ghost" type="button" onClick={onClose} className="!size-10 !p-0">
            <X size={18} />
          </Button>
        </div>
        <div className="space-y-4 px-6 pb-6">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-700">Ingredient / SKU</span>
            <select
              value={selectedIngredientId}
              onChange={(e) => setSelectedIngredientId(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50"
            >
              {ingredients.length === 0 ? (
                <option value="">Đang tải danh mục nguyên liệu...</option>
              ) : (
                ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.code} · {ing.name} ({ing.unit})
                  </option>
                ))
              )}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-700">Quantity</span>
              <input
                type="number"
                min="1"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="500"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-700">Unit</span>
              <input
                type="text"
                disabled
                value={selectedIng?.unit || "gram"}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-mono text-slate-500 outline-none"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-700">HQ transfer reference</span>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="TRF-2026-10842"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50"
            />
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
            <input type="checkbox" defaultChecked className="mt-0.5 accent-red-800" />
            <span className="text-xs text-slate-600">
              <b className="block text-slate-800">Update available-to-sell now</b>Cập nhật ngay vào sổ cái tồn kho và giải phóng cảnh báo thiếu hụt.
            </span>
          </label>
          <Button variant="primary" type="submit" disabled={isSubmitting} className="w-full">
            <PackageCheck size={17} /> {isSubmitting ? "Đang ghi nhận..." : "Confirm inbound stock"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

function ModalContent({
  modal,
  close,
  onLoginSuccess,
  receiptData,
  storeId,
  onRestocked,
  onStoreCreated,
}: {
  modal: Exclude<Modal, null>;
  close: () => void;
  onLoginSuccess: (user: User) => void;
  receiptData: ReceiptData | null;
  storeId: string;
  onRestocked?: () => void;
  onStoreCreated?: (store?: any) => void;
}) {
  if (modal === "login") {
    return <LoginModal onClose={close} onSuccess={onLoginSuccess} />;
  }
  if (modal === "receipt") {
    const fallbackReceipt: ReceiptData = {
      orderId: "demo-ord-01",
      orderNumber: "ORD-20261007-0001",
      subtotal: 94000,
      vatAmount: 7520,
      finalAmount: 101520,
      createdAt: new Date().toISOString(),
      paymentMethod: "Cash",
      orderType: "Take-away",
      storeName: "Chi nhánh Quận 1 (Flagship Store)",
      storeAddress: "12 Lê Lợi, Bến Nghé, Quận 1, TP. HCM",
      storePhone: "028 3822 1234",
      cashierName: "Linh (Thu ngân 01)",
      counterName: "Counter 03 · Shift A",
      items: [
        { name: "Phin Sữa Đá Đậm Đà", quantity: 1, price: 29000, size: "M", toppings: ["Black pearl"] },
        { name: "Freeze Trà Xanh Thạch", quantity: 1, price: 55000, size: "L", toppings: ["Cheese foam"] },
      ],
      deductedIngredients: [
        { ingredientId: "ing-1", ingredientName: "Cà phê hạt Robusta", quantityDeducted: 36, balanceAfter: 14214 },
        { ingredientId: "ing-2", ingredientName: "Sữa tươi thanh trùng", quantityDeducted: 180, balanceAfter: 18020 },
        { ingredientId: "ing-3", ingredientName: "Trân châu đen", quantityDeducted: 25, balanceAfter: 1485 },
      ],
    };

    return (
      <ReceiptModal
        receipt={receiptData || fallbackReceipt}
        onClose={close}
        onNewOrder={close}
      />
    );
  }
  if (modal === "store") {
    return <StoreModal onClose={close} onStoreCreated={onStoreCreated} />;
  }
  if (modal === "restock") {
    return <RestockModal onClose={close} storeId={storeId} onRestocked={onRestocked} />;
  }
  if (modal === "modifier")
    return (
      <ModalShell onClose={close}>
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-red-700">Customize item</p>
            <h2 className="text-xl font-black text-slate-950">Phin Sữa Đá</h2>
          </div>
          <Button variant="ghost" onClick={close} className="!size-10 !p-0">
            <X size={18} />
          </Button>
        </div>
        <div className="space-y-5 p-5">
          <div>
            <p className="mb-2 text-xs font-extrabold text-slate-800">Choose size</p>
            <div className="grid grid-cols-2 gap-2">
              <button className="rounded-xl border-2 border-red-700 bg-red-50 p-3 text-left text-xs font-bold text-red-900">
                <span className="block">Size M</span>
                <span className="text-[10px] text-red-600">Included</span>
              </button>
              <button className="rounded-xl border border-slate-200 p-3 text-left text-xs font-bold text-slate-700">
                <span className="block">Size L</span>
                <span className="text-[10px] text-slate-400">+6,000 đ</span>
              </button>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-extrabold text-slate-800">Toppings</p>
            <div className="space-y-2">
              {[
                ["Black pearl", "10,000 đ", "Consumes 25g"],
                ["Sea salt cheese foam", "12,000 đ", "Consumes 30g"],
                ["Coffee jelly", "8,000 đ", "Consumes 20g"],
              ].map(([name, price, usage], i) => (
                <button key={name} className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${i === 0 ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{name}</p>
                    <p className="text-[10px] text-slate-400">{usage}</p>
                  </div>
                  <span className="text-xs font-black text-amber-900">+{price}</span>
                </button>
              ))}
            </div>
          </div>
          <label>
            <span className="mb-1.5 block text-xs font-extrabold text-slate-800">Barista note</span>
            <textarea placeholder="Less ice, 50% sugar..." className="h-20 w-full resize-none rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50" />
          </label>
          <Button variant="primary" onClick={close} className="w-full">
            <Plus size={17} /> Add customized item · 39,000 đ
          </Button>
        </div>
      </ModalShell>
    );
  return null;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [modal, setModal] = useState<Modal>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("Connecting");
  const [dailyRevenue, setDailyRevenue] = useState(318400000);
  const [inventory, setInventory] = useState<InventoryRecord[]>(initialInventory);
  const [activeAlert, setActiveAlert] = useState<LowStockAlertNotification | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(() => getCurrentUser());
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [storesRefreshTrigger, setStoresRefreshTrigger] = useState(0);
  const [newlyCreatedStore, setNewlyCreatedStore] = useState<{ code: string; name: string; address?: string; phoneNumber?: string } | null>(null);
  const [isSyncingInventory, setIsSyncingInventory] = useState(false);

  const effectiveStoreId = currentUser?.storeId || "22222222-2222-2222-2222-222222222222";

  const fetchStoreInventory = async (storeId = effectiveStoreId) => {
    setIsSyncingInventory(true);
    try {
      const [invItems, lowAlerts] = await Promise.all([
        api.getStoreInventory(storeId).catch(() => []),
        api.getLowStockAlerts(storeId).catch(() => []),
      ]);

      if (invItems && invItems.length > 0) {
        setInventory(
          invItems.map((item) => ({
            code: item.ingredientCode,
            name: item.ingredientName,
            unit: item.unit,
            current: item.currentStock,
            min: item.minAlertThreshold,
            counted: item.lastCountedAt
              ? new Date(item.lastCountedAt).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Vừa xong",
          }))
        );
      }

      if (lowAlerts && lowAlerts.length > 0) {
        const first = lowAlerts[0];
        setActiveAlert({
          storeId: first.storeId,
          ingredientId: first.ingredientId,
          ingredientCode: first.ingredientCode,
          ingredientName: first.ingredientName,
          unit: first.unit,
          currentStock: first.currentStock,
          minAlertThreshold: first.minAlertThreshold,
          shortage: first.shortage,
          triggeredAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn("Could not sync store inventory:", err);
    } finally {
      setIsSyncingInventory(false);
    }
  };

  useEffect(() => {
    fetchStoreInventory(effectiveStoreId);
  }, [effectiveStoreId]);

  // Announcement & Notification State
  const [notifications, setNotifications] = useState<SystemNotification[]>([
    {
      id: "init-1",
      title: "Hệ thống chuông báo sẵn sàng",
      detail: "Web Audio Synthesizer đã kích hoạt trên trình duyệt",
      time: "Hôm nay",
      type: "kds",
      isRead: true,
    },
  ]);
  const [activeToast, setActiveToast] = useState<SystemNotification | null>(null);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() => audioNotifier.getSettings());

  useEffect(() => {
    if (!activeToast) return;
    const timer = setTimeout(() => {
      setActiveToast(null);
    }, 7000);
    return () => clearTimeout(timer);
  }, [activeToast]);

  const handleToggleSound = () => {
    const updated = audioNotifier.saveSettings({ soundEnabled: !audioSettings.soundEnabled });
    setAudioSettings(updated);
  };

  const handleToggleSpeech = () => {
    const updated = audioNotifier.saveSettings({ speechEnabled: !audioSettings.speechEnabled });
    setAudioSettings(updated);
  };

  const handleTestSound = () => {
    audioNotifier.testSound();
  };

  const handleSimulateOrder = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const orderNum = `ORD-ONLINE-${randomNum}`;
    const amount = [55000, 75000, 95000, 120000][Math.floor(Math.random() * 4)];
    const simNotif: SystemNotification = {
      id: `sim-${Date.now()}`,
      title: `Đơn online mới #${orderNum}`,
      detail: `ShopeeFood / App Khách · +${amount.toLocaleString("vi-VN")} đ`,
      amount,
      time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      type: "order",
      isRead: false,
    };
    setNotifications((prev) => [simNotif, ...prev.slice(0, 29)]);
    setActiveToast(simNotif);
    setDailyRevenue((prev) => prev + amount);

    // Kích hoạt chuông báo Ting-Ting!
    audioNotifier.playOrderChime("urgent");
    audioNotifier.speakAnnouncement(`Có đơn hàng online mới, ${orderNum}`);
  };

  const handleClearNotifications = () => {
    setNotifications([]);
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  useEffect(() => {
    // 1. Khởi chạy kết nối SignalR Hub
    realtimeHub.start();

    // 2. Lắng nghe trạng thái kết nối
    const unsubStatus = realtimeHub.onStatusChange((status) => {
      setConnectionStatus(status);
    });

    // 3. Lắng nghe sự kiện Đơn hàng hoàn tất -> Cập nhật doanh thu & phát chuông báo
    const unsubOrder = realtimeHub.onOrderCompleted((notification) => {
      setDailyRevenue((prev) => prev + notification.finalAmount);
      const newNotif: SystemNotification = {
        id: `ord-${Date.now()}`,
        title: `Đơn hàng #${notification.orderNumber}`,
        detail: `Thanh toán thành công · +${notification.finalAmount.toLocaleString("vi-VN")} đ`,
        amount: notification.finalAmount,
        time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        type: "order",
        isRead: false,
      };
      setNotifications((prev) => [newNotif, ...prev.slice(0, 29)]);
      setActiveToast(newNotif);

      // Kích hoạt chuông âm thanh Ting-Ting
      audioNotifier.playOrderChime("standard");
      audioNotifier.speakAnnouncement(`Đơn hàng mới, ${notification.orderNumber}`);
    });

    // 4. Lắng nghe sự kiện Biến động tồn kho -> Cập nhật ledger
    const unsubInv = realtimeHub.onInventoryUpdated((updates) => {
      setInventory((prev) =>
        prev.map((item) => {
          const update = updates.find((u) => u.ingredientName.toLowerCase().includes(item.name.toLowerCase()));
          if (update) {
            return { ...item, current: Number(update.balanceAfter), counted: "Just now (Live)" };
          }
          return item;
        })
      );
    });

    // 5. Lắng nghe Cảnh báo Low Stock
    const unsubAlert = realtimeHub.onLowStockAlert((alert) => {
      setActiveAlert(alert);
      const newNotif: SystemNotification = {
        id: `alert-${Date.now()}`,
        title: `Cảnh báo kho: ${alert.ingredientName}`,
        detail: `Tồn kho còn ${alert.currentStock} ${alert.unit} (dưới mức ${alert.minAlertThreshold})`,
        time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        type: "alert",
        isRead: false,
      };
      setNotifications((prev) => [newNotif, ...prev.slice(0, 29)]);
      audioNotifier.playOrderChime("alert");
    });

    return () => {
      unsubStatus();
      unsubOrder();
      unsubInv();
      unsubAlert();
    };
  }, []);

  // Strict RBAC Guard: If current screen is forbidden for user role, auto-redirect to permitted default
  useEffect(() => {
    if (!canAccessScreen(screen, currentUser)) {
      setScreen(getDefaultScreenForUser(currentUser));
    }
  }, [screen, currentUser]);

  const handleSetScreen = (newScreen: Screen) => {
    if (canAccessScreen(newScreen, currentUser)) {
      setScreen(newScreen);
    } else {
      setScreen(getDefaultScreenForUser(currentUser));
    }
  };

  const title = useMemo(() => navItems.find((item) => item.id === screen)?.label, [screen]);

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-slate-50 text-slate-900">
      <a href="#main-content" className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white focus:translate-y-0">
        Skip to content
      </a>
      <Header
        screen={screen}
        setScreen={handleSetScreen}
        connectionStatus={connectionStatus}
        currentUser={currentUser}
        openLogin={() => setModal("login")}
        onLogout={() => {
          apiLogout();
          setCurrentUser(null);
          setScreen("landing");
        }}
        notifications={notifications}
        unreadCount={notifications.filter((n) => !n.isRead).length}
        isNotifOpen={isNotifOpen}
        setIsNotifOpen={setIsNotifOpen}
        audioSettings={audioSettings}
        onToggleSound={handleToggleSound}
        onToggleSpeech={handleToggleSpeech}
        onTestSound={handleTestSound}
        onSimulateOrder={handleSimulateOrder}
        onClearNotifications={handleClearNotifications}
        onMarkAllRead={handleMarkAllRead}
      />
      <div id="main-content" aria-label={title} className="w-full max-w-[100vw] overflow-x-hidden">
        {screen === "landing" && (
          <LandingScreen
            currentUser={currentUser}
            onNavigate={handleSetScreen}
            openLogin={() => setModal("login")}
          />
        )}
        {screen === "customer" && <CustomerScreen />}
        {screen === "stores" && (
          <StoresScreen
            openModal={setModal}
            dailyRevenue={dailyRevenue}
            refreshTrigger={storesRefreshTrigger}
            newlyCreatedStore={newlyCreatedStore}
          />
        )}
        {screen === "inventory" && (
          <InventoryScreen
            openModal={setModal}
            inventory={inventory}
            activeAlert={activeAlert}
            onSync={() => fetchStoreInventory(effectiveStoreId)}
            isSyncing={isSyncingInventory}
          />
        )}
        {screen === "transfers" && (
          <TransfersHubScreen
            currentUser={currentUser}
            onSwitchUser={setCurrentUser}
          />
        )}
        {screen === "bom-studio" && <BomStudioScreen />}
        {screen === "pos" && (
          <PosScreen
            openModal={setModal}
            currentUser={currentUser}
            onCheckoutSuccess={(rec) => {
              setReceiptData(rec);
              setModal("receipt");
              fetchStoreInventory(effectiveStoreId);
            }}
          />
        )}
        {screen === "kds" && <KdsScreen currentUser={currentUser} />}
        {screen === "analytics" && <AnalyticsHubScreen currentUser={currentUser} />}
      </div>
      <AnimatePresence>
        {modal && (
          <ModalContent
            modal={modal}
            close={() => setModal(null)}
            receiptData={receiptData}
            storeId={effectiveStoreId}
            onRestocked={() => fetchStoreInventory(effectiveStoreId)}
            onStoreCreated={(s) => {
              if (s) setNewlyCreatedStore(s);
              setStoresRefreshTrigger((v) => v + 1);
            }}
            onLoginSuccess={(u) => {
              setCurrentUser(u);
              realtimeHub.start();
              setScreen(getDefaultScreenForUser(u));
            }}
          />
        )}
      </AnimatePresence>

      {/* Floating Order Announcement Toast */}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -25, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed top-20 right-4 z-50 flex max-w-sm items-start gap-3 rounded-2xl border border-red-200 bg-white/95 p-4 shadow-2xl backdrop-blur-xl ring-1 ring-slate-900/5"
          >
            <motion.div
              animate={{ rotate: [0, -18, 18, -12, 12, 0] }}
              transition={{ duration: 0.6, repeat: 2 }}
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-red-600 to-red-800 text-white shadow-md shadow-red-600/30"
            >
              <Bell size={20} />
            </motion.div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase text-red-800">
                  {activeToast.type === "order" ? "🔔 ĐƠN HÀNG MỚI" : "⚠️ CẢNH BÁO KHO"}
                </span>
                <span className="text-[10px] font-medium text-slate-400">{activeToast.time}</span>
              </div>
              <p className="mt-1 truncate text-xs font-black text-slate-900">{activeToast.title}</p>
              <p className="text-xs font-bold text-emerald-700">{activeToast.detail}</p>
              <div className="mt-2.5 flex items-center gap-2">
                {canAccessScreen("kds", currentUser) && (
                  <button
                    type="button"
                    onClick={() => {
                      handleSetScreen("kds");
                      setActiveToast(null);
                    }}
                    className="rounded-lg bg-red-700 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-red-800"
                  >
                    Xem KDS
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveToast(null)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-100"
                >
                  Đã nhận
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveToast(null)}
              className="text-slate-400 transition hover:text-slate-600"
            >
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>


      <div className="pointer-events-none fixed bottom-4 left-1/2 z-30 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-[10px] font-bold text-slate-500 shadow-lg backdrop-blur md:flex lg:hidden">
        <Wifi size={12} className={connectionStatus === "Connected" ? "text-emerald-600" : "text-amber-500"} /> Live operations · {connectionStatus}
      </div>
    </div>
  );
}
