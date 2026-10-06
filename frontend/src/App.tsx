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
} from "lucide-react";
import { useEffect, useMemo, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { realtimeHub, type ConnectionStatus, type LowStockAlertNotification } from "./services/signalr.ts";
import { getCurrentUser, login as apiLogin, logout as apiLogout, type User } from "./services/auth.ts";

type Screen = "stores" | "inventory" | "pos";
type Modal = "store" | "restock" | "modifier" | "receipt" | "login" | null;
type Payment = "Cash" | "QR Transfer" | "Credit Card";

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
  { id: "stores" as Screen, label: "Store Network", sub: "Chi nhánh", icon: Building2 },
  { id: "inventory" as Screen, label: "Live Inventory", sub: "Kho & BoM", icon: Box },
  { id: "pos" as Screen, label: "POS Terminal", sub: "Bán hàng", icon: LayoutGrid },
];

function Header({
  screen,
  setScreen,
  connectionStatus,
  currentUser,
  openLogin,
  onLogout,
}: {
  screen: Screen;
  setScreen: (screen: Screen) => void;
  connectionStatus: ConnectionStatus;
  currentUser: User | null;
  openLogin: () => void;
  onLogout: () => void;
}) {
  const badgeTone = connectionStatus === "Connected" ? "success" : connectionStatus === "Reconnecting" ? "warning" : "neutral";
  const badgeText = connectionStatus === "Connected" ? "Outbox Synced" : connectionStatus === "Reconnecting" ? "Reconnecting..." : "Offline";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 lg:px-6">
        <button onClick={() => setScreen("stores")} className="flex shrink-0 items-center gap-3 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700">
          <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-red-700 to-red-950 text-lg font-black text-white shadow-lg shadow-red-900/20">F</span>
          <span className="hidden xl:block">
            <span className="block text-sm font-black tracking-tight text-slate-950">FRANCHISE</span>
            <span className="block text-[9px] font-extrabold tracking-[0.2em] text-red-700">ENTERPRISE</span>
          </span>
        </button>
        <nav className="mx-auto hidden items-center rounded-2xl bg-slate-100 p-1 lg:flex" aria-label="Primary navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setScreen(item.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  screen === item.id ? "bg-white text-red-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Icon size={15} /> <span>{item.label}</span>
                <span className="hidden 2xl:inline text-slate-400">· {item.sub}</span>
              </button>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {currentUser ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm">
              <span className="grid size-7 place-items-center rounded-lg bg-red-800 text-[11px] font-black text-white">
                {currentUser.username.slice(0, 2).toUpperCase()}
              </span>
              <div className="hidden sm:block text-left">
                <span className="block max-w-28 truncate text-xs font-black text-slate-900 leading-tight">
                  {currentUser.fullName || currentUser.username}
                </span>
                <span className="block text-[9px] font-extrabold uppercase tracking-wider text-red-700 leading-none">
                  {currentUser.role}
                </span>
              </div>
              <button
                type="button"
                onClick={onLogout}
                title="Hết ca / Đăng xuất"
                className="ml-1 rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <Button
              variant="primary"
              onClick={openLogin}
              className="!h-9 !min-h-9 !px-3 text-xs shadow-md shadow-red-900/10"
            >
              <Lock size={14} /> <span className="hidden sm:inline">Nhận ca POS</span>
            </Button>
          )}

          <Button variant="ghost" className="!size-10 !min-h-10 !p-0" aria-label="Notifications">
            <Bell size={18} />
            <span className="absolute mt-[-18px] ml-[16px] size-2 rounded-full bg-red-600 ring-2 ring-white" />
          </Button>
          <button className="hidden items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm md:flex">
            <span className="grid size-8 place-items-center rounded-lg bg-red-50 text-red-800">
              <Store size={16} />
            </span>
            <span>
              <span className="block max-w-40 truncate text-xs font-bold text-slate-800">Highlands Lê Lợi Q1</span>
              <span className="block font-mono text-[10px] text-slate-400">HL-01 · Flagship</span>
            </span>
            <ChevronDown size={14} className="text-slate-400" />
          </button>
          <Badge tone={badgeTone} pulse={connectionStatus === "Connected" || connectionStatus === "Reconnecting"}>
            <span className="hidden sm:inline">{badgeText}</span>
            <span className="sm:hidden">{connectionStatus === "Connected" ? "Live" : "Offline"}</span>
          </Badge>
        </div>
      </div>
      <nav className="flex overflow-x-auto border-t border-slate-100 px-3 py-2 lg:hidden" aria-label="Mobile navigation">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setScreen(item.id)}
            className={`min-w-max rounded-lg px-3 py-1.5 text-xs font-bold ${screen === item.id ? "bg-red-50 text-red-800" : "text-slate-500"}`}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  );
}

const initialStores = [
  { code: "HL-01", name: "Highlands Lê Lợi Q1", address: "187 Lê Lợi, Quận 1, HCMC", phone: "+84 28 3822 2211", revenue: "₫18.4m", active: true },
  { code: "HL-02", name: "Highlands Landmark 81", address: "720A Điện Biên Phủ, Bình Thạnh", phone: "+84 28 3636 8899", revenue: "₫22.8m", active: true },
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

function StoresScreen({ openModal, dailyRevenue }: { openModal: (modal: Modal) => void; dailyRevenue: number }) {
  const [query, setQuery] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const filtered = initialStores.filter(
    (store) => `${store.name} ${store.code} ${store.address}`.toLowerCase().includes(query.toLowerCase()) && (!activeOnly || store.active)
  );

  const formattedDailyRevenue = `₫${(dailyRevenue / 1000000).toFixed(1)}m`;

  const kpis = [
    { label: "Active stores", value: "24", detail: "across 6 regions", icon: Store, trend: "+2 this quarter", color: "text-red-800 bg-red-50" },
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
            <Button>
              <Download size={16} /> Export
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
            <span className="font-bold text-slate-800">1–5</span> of 24 stores
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
}: {
  openModal: (modal: Modal) => void;
  inventory: InventoryRecord[];
  activeAlert: LowStockAlertNotification | null;
}) {
  return (
    <motion.main initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="mx-auto max-w-[1600px] px-4 py-6 lg:px-6 lg:py-8">
      <PageHeading
        eyebrow="Highlands Lê Lợi Q1 · HL-01"
        title="Live Inventory & BoM"
        description="Real-time stock ledger with recipe-level consumption and threshold alerts."
        actions={
          <>
            <Button>
              <RefreshCcw size={16} /> Sync now
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

const products = [
  { id: 1, name: "Phin Sữa Đá", category: "Coffee", sku: "CF-PHIN-01", price: 29000, image: "https://images.unsplash.com/photo-1650527122326-0abd4c8c0f99?auto=format&fit=crop&w=700&q=85" },
  { id: 2, name: "Caramel Macchiato", category: "Coffee", sku: "CF-MAC-02", price: 49000, image: "https://images.unsplash.com/photo-1687902625864-faedb40f83a8?auto=format&fit=crop&w=700&q=85" },
  { id: 3, name: "Trà Sữa Trân Châu", category: "Milk Tea", sku: "MT-PEARL-01", price: 45000, image: "https://images.unsplash.com/photo-1601919764353-922faa5c0eb4?auto=format&fit=crop&w=700&q=85" },
  { id: 4, name: "Berry Matcha Cloud", category: "Milk Tea", sku: "MT-MAT-04", price: 55000, image: "https://images.unsplash.com/photo-1786602181711-b9ebb69caf3c?auto=format&fit=crop&w=700&q=85" },
  { id: 5, name: "Trà Đào Cam Sả", category: "Fruit Tea", sku: "FT-PEACH-02", price: 49000, image: "https://images.unsplash.com/photo-1761335831408-c8c3e16c2c1d?auto=format&fit=crop&w=700&q=85" },
  { id: 6, name: "Butter Croissant", category: "Pastry", sku: "PA-CRO-01", price: 35000, image: "https://images.unsplash.com/photo-1612737144187-d51c1483225a?auto=format&fit=crop&w=700&q=85" },
];

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  size: string;
  toppings: string[];
}

function PosScreen({ openModal }: { openModal: (modal: Modal) => void }) {
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([
    { id: 1, name: "Phin Sữa Đá", price: 29000, quantity: 1, size: "M", toppings: ["Black pearl"] },
    { id: 4, name: "Berry Matcha Cloud", price: 55000, quantity: 1, size: "L", toppings: ["Cheese foam"] },
  ]);
  const [payment, setPayment] = useState<Payment>("Cash");
  const [orderType, setOrderType] = useState("Take-away");
  const filtered = category === "All" ? products : products.filter((product) => product.category === category);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity + item.toppings.length * 10000, 0);
  const vat = Math.round(subtotal * 0.08);
  const total = subtotal + vat;

  const add = (product: (typeof products)[number]) =>
    setCart((items) => {
      const current = items.find((item) => item.id === product.id);
      return current
        ? items.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
        : [...items, { id: product.id, name: product.name, price: product.price, quantity: 1, size: "M", toppings: [] }];
    });

  const updateQty = (id: number, delta: number) =>
    setCart((items) => items.map((item) => (item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item)));

  return (
    <motion.main initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="mx-auto grid max-w-[1600px] gap-4 px-3 py-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(350px,0.75fr)] lg:px-5">
      <section className="min-w-0">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-red-700">Counter 03 · Shift A</p>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">Good morning, Linh</h1>
            <p className="text-xs text-slate-500">Tap a menu item to start building the order.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="success" pulse>
              Terminal online
            </Badge>
            <Button>
              <MoreHorizontal size={18} />
            </Button>
          </div>
        </div>
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {["All", "Coffee", "Milk Tea", "Fruit Tea", "Pastry"].map((item) => (
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
                onClick={() => {
                  add(product);
                  openModal("modifier");
                }}
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
              <h2 className="mt-0.5 font-mono text-sm font-black text-slate-900">#ORD-20261005-0842</h2>
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
          <Button variant="primary" disabled={!cart.length} onClick={() => openModal("receipt")} className="w-full !min-h-13 text-xs tracking-wide">
            <ShieldCheck size={18} /> Pay & deduct inventory <span className="ml-auto rounded-md bg-white/15 px-1.5 py-0.5 font-mono">F9</span>
          </Button>
        </div>
      </Panel>
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

function Field({ label, placeholder, error }: { label: string; placeholder: string; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-700">{label}</span>
      <input
        placeholder={placeholder}
        className={`h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none transition focus:ring-4 ${
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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

      <form onSubmit={(e) => handleSubmit(e)} className="space-y-4 p-6">
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

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

          <div className="mt-3 grid grid-cols-3 gap-2">
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
    </ModalShell>
  );
}

function ModalContent({
  modal,
  close,
  onLoginSuccess,
}: {
  modal: Exclude<Modal, null>;
  close: () => void;
  onLoginSuccess: (user: User) => void;
}) {
  if (modal === "login") {
    return <LoginModal onClose={close} onSuccess={onLoginSuccess} />;
  }
  if (modal === "store")
    return (
      <ModalShell side onClose={close}>
        <div className="flex items-center justify-between border-b border-slate-200 p-6">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-red-700">Network expansion</p>
            <h2 className="text-xl font-black text-slate-950">Create franchise store</h2>
          </div>
          <Button variant="ghost" onClick={close} className="!size-10 !p-0">
            <X size={19} />
          </Button>
        </div>
        <div className="space-y-5 p-6">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-relaxed text-blue-800">
            <b>Store IDs are permanent.</b> Review region and franchise ownership before creation.
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Store code" placeholder="e.g. HL-25" error="Code must match REGION-##" />
            <Field label="Region" placeholder="Ho Chi Minh City" />
          </div>
          <Field label="Store name" placeholder="Highlands Nguyễn Huệ" />
          <Field label="Street address" placeholder="Full operating address" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone number" placeholder="+84 ..." />
            <Field label="Franchise owner" placeholder="Legal entity" />
          </div>
          <Field label="Opening date" placeholder="DD / MM / YYYY" />
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white p-5">
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary">
            <Check size={16} /> Create store
          </Button>
        </div>
      </ModalShell>
    );
  if (modal === "restock")
    return (
      <ModalShell onClose={close}>
        <div className="flex items-start justify-between p-6 pb-3">
          <div>
            <span className="mb-3 grid size-11 place-items-center rounded-xl bg-red-50 text-red-800">
              <PackagePlus size={21} />
            </span>
            <h2 className="text-xl font-black text-slate-950">Inbound from HQ</h2>
            <p className="mt-1 text-sm text-slate-500">Create a verified stock ledger entry.</p>
          </div>
          <Button variant="ghost" onClick={close} className="!size-10 !p-0">
            <X size={18} />
          </Button>
        </div>
        <div className="space-y-4 px-6 pb-6">
          <Field label="Ingredient / SKU" placeholder="PEARL-01 · Black Tapioca Pearl" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Quantity" placeholder="500" />
            <Field label="Unit" placeholder="gram" />
          </div>
          <Field label="HQ transfer reference" placeholder="TRF-2026-10842" />
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
            <input type="checkbox" defaultChecked className="mt-0.5 accent-red-800" />
            <span className="text-xs text-slate-600">
              <b className="block text-slate-800">Update available-to-sell now</b>Creates an auditable inventory event and resolves the alert.
            </span>
          </label>
          <Button variant="primary" className="w-full" onClick={close}>
            <PackageCheck size={17} /> Confirm inbound stock
          </Button>
        </div>
      </ModalShell>
    );
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
  return (
    <ModalShell onClose={close}>
      <div className="overflow-hidden rounded-2xl">
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 px-6 py-8 text-center text-white">
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.15 }} className="mx-auto grid size-16 place-items-center rounded-full bg-white/15 ring-1 ring-white/20">
            <CheckCircle2 size={34} />
          </motion.span>
          <p className="mt-4 text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-100">Payment approved</p>
          <h2 className="mt-1 text-2xl font-black">₫101,520</h2>
          <p className="mt-1 font-mono text-xs text-emerald-100">#ORD-20261005-0842</p>
        </div>
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[9px] font-bold uppercase text-slate-400">Method</p>
              <p className="mt-1 text-xs font-extrabold text-slate-800">Cash · Exact</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[9px] font-bold uppercase text-slate-400">Processed</p>
              <p className="mt-1 text-xs font-extrabold text-slate-800">10:42:18 AM</p>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-extrabold text-slate-800">Inventory deductions</p>
            {[
              ["Black pearl", "−25g", "1,485g left"],
              ["Coffee beans", "−36g", "14,214g left"],
              ["Oat milk", "−180ml", "18,020ml left"],
            ].map(([name, used, left]) => (
              <div key={name} className="flex items-center justify-between border-b border-slate-100 py-2 text-xs">
                <span className="font-semibold text-slate-600">{name}</span>
                <span className="font-mono text-slate-500">
                  {used} · <b className="text-slate-800">{left}</b>
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
            <Wifi size={17} className="mt-0.5 shrink-0 text-emerald-700" />
            <div>
              <p className="text-xs font-extrabold text-emerald-800">Transactional outbox confirmed</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-emerald-700">Payment, order and inventory events synced successfully.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button>
              <ReceiptText size={16} /> Print receipt
            </Button>
            <Button variant="primary" onClick={close}>
              New order <ArrowUpRight size={15} />
            </Button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("stores");
  const [modal, setModal] = useState<Modal>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("Connecting");
  const [dailyRevenue, setDailyRevenue] = useState(318400000);
  const [inventory, setInventory] = useState<InventoryRecord[]>(initialInventory);
  const [activeAlert, setActiveAlert] = useState<LowStockAlertNotification | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(() => getCurrentUser());

  useEffect(() => {
    // 1. Khởi chạy kết nối SignalR Hub
    realtimeHub.start();

    // 2. Lắng nghe trạng thái kết nối
    const unsubStatus = realtimeHub.onStatusChange((status) => {
      setConnectionStatus(status);
    });

    // 3. Lắng nghe sự kiện Đơn hàng hoàn tất -> Cập nhật doanh thu real-time
    const unsubOrder = realtimeHub.onOrderCompleted((notification) => {
      setDailyRevenue((prev) => prev + notification.finalAmount);
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
    });

    return () => {
      unsubStatus();
      unsubOrder();
      unsubInv();
      unsubAlert();
    };
  }, []);

  const title = useMemo(() => navItems.find((item) => item.id === screen)?.label, [screen]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <a href="#main-content" className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white focus:translate-y-0">
        Skip to content
      </a>
      <Header
        screen={screen}
        setScreen={setScreen}
        connectionStatus={connectionStatus}
        currentUser={currentUser}
        openLogin={() => setModal("login")}
        onLogout={() => {
          apiLogout();
          setCurrentUser(null);
        }}
      />
      <div id="main-content" aria-label={title}>
        {screen === "stores" && <StoresScreen openModal={setModal} dailyRevenue={dailyRevenue} />}
        {screen === "inventory" && <InventoryScreen openModal={setModal} inventory={inventory} activeAlert={activeAlert} />}
        {screen === "pos" && <PosScreen openModal={setModal} />}
      </div>
      <AnimatePresence>
        {modal && (
          <ModalContent
            modal={modal}
            close={() => setModal(null)}
            onLoginSuccess={(u) => {
              setCurrentUser(u);
              realtimeHub.start();
            }}
          />
        )}
      </AnimatePresence>
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-30 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-[10px] font-bold text-slate-500 shadow-lg backdrop-blur md:flex lg:hidden">
        <Wifi size={12} className={connectionStatus === "Connected" ? "text-emerald-600" : "text-amber-500"} /> Live operations · {connectionStatus}
      </div>
    </div>
  );
}
