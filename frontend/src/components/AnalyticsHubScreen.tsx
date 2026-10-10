import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  LayoutGrid,
  Percent,
  Plus,
  Printer,
  RefreshCcw,
  Sparkles,
  Store,
  TrendingUp,
  XCircle,
  Send,
  AlertTriangle,
  Trash2,
  Bell,
  Users,
} from "lucide-react";
import {
  reportsService,
  type FinancialSummaryDto,
  type HourlySalesHeatmapDto,
  type ProductSalesRankDto,
  type NetworkOverviewDto,
  type RoyaltyInvoiceDto,
} from "../services/reports.ts";
import { type User } from "../services/auth.ts";
import { 
  api, 
  type AdvancedPeakHoursAnalysis, 
  type WasteShrinkageReport, 
  type LowStockAlert, 
  type AlertBroadcastResult,
  type InventoryItem 
} from "../services/api.ts";

interface AnalyticsHubScreenProps {
  currentUser: User | null;
}

export interface AnalyticsStoreOption {
  id: string;
  name: string;
  code: string;
}

const defaultStores: AnalyticsStoreOption[] = [
  { id: "22222222-2222-2222-2222-222222222222", name: "Chi nhánh Quận 1 (Flagship Store)", code: "STORE-Q1" },
  { id: "33333333-3333-3333-3333-333333333333", name: "Chi nhánh Landmark 81", code: "STORE-L81" },
];

const initialEmptySummary: FinancialSummaryDto = {
  storeId: "",
  storeName: "",
  fromDate: new Date(Date.now() - 30 * 86400 * 1000).toISOString(),
  toDate: new Date().toISOString(),
  totalOrders: 0,
  grossRevenue: 0,
  discountAmount: 0,
  vatAmount: 0,
  netRevenue: 0,
  averageOrderValue: 0,
  estimatedCogs: 0,
  estimatedGrossProfit: 0,
  grossMarginPercentage: 0,
};

const initialEmptyHeatmap: HourlySalesHeatmapDto = {
  storeId: "",
  storeName: "",
  date: new Date().toISOString(),
  totalOrders: 0,
  totalRevenue: 0,
  hourlyDistribution: Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    orderCount: 0,
    revenue: 0,
    isPeakHour: false,
  })),
};

export function AnalyticsHubScreen({ currentUser }: AnalyticsHubScreenProps) {
  const isHQAdmin = !currentUser?.storeId || currentUser?.role === "HQ_SuperAdmin";
  const [stores, setStores] = useState<AnalyticsStoreOption[]>(defaultStores);
  const [selectedStoreId, setSelectedStoreId] = useState<string>(
    currentUser?.storeId || defaultStores[0].id
  );
  const [dateRange, setDateRange] = useState<"today" | "7d" | "30d">("30d");
  const [activeTab, setActiveTab] = useState<"overview" | "heatmap" | "royalty" | "waste" | "alerts">("overview");

  const [summary, setSummary] = useState<FinancialSummaryDto>(initialEmptySummary);
  const [heatmap, setHeatmap] = useState<HourlySalesHeatmapDto>(initialEmptyHeatmap);
  const [products, setProducts] = useState<ProductSalesRankDto[]>([]);
  const [invoices, setInvoices] = useState<RoyaltyInvoiceDto[]>([]);
  const [networkOverview, setNetworkOverview] = useState<NetworkOverviewDto | null>(null);

  const [peakAnalysis, setPeakAnalysis] = useState<AdvancedPeakHoursAnalysis | null>(null);
  const [wasteReport, setWasteReport] = useState<WasteShrinkageReport | null>(null);
  const [lowStockList, setLowStockList] = useState<LowStockAlert[]>([]);
  const [allInventory, setAllInventory] = useState<InventoryItem[]>([]);

  // Alert & Telegram broadcast
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<AlertBroadcastResult | null>(null);
  const [managerEmail, setManagerEmail] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [saveConfigSuccess, setSaveConfigSuccess] = useState(false);

  // Waste Recording Modal
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [wasteIngredientId, setWasteIngredientId] = useState("");
  const [wasteQuantity, setWasteQuantity] = useState<number>(1);
  const [wasteReason, setWasteReason] = useState("Đổ vỡ trong quá trình pha chế");
  const [wasteSubmitting, setWasteSubmitting] = useState(false);

  const [loading, setLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<RoyaltyInvoiceDto | null>(null);
  const [payReference, setPayReference] = useState("");
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [genYear, setGenYear] = useState(2026);
  const [genMonth, setGenMonth] = useState(10);

  // Load dynamic stores list from backend API
  useEffect(() => {
    let isMounted = true;
    api
      .getStores(1, 100)
      .then((res) => {
        if (!isMounted || !res?.items || res.items.length === 0) return;
        const mapped: AnalyticsStoreOption[] = res.items.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
        }));
        setStores(mapped);
        if (!currentUser?.storeId) {
          setSelectedStoreId((curr) => {
            const exists = mapped.some((m) => m.id === curr);
            return exists ? curr : mapped[0].id;
          });
        }
      })
      .catch((err) => console.warn("Could not load backend stores for AnalyticsHub:", err));

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const loadData = async () => {
    setLoading(true);
    try {
      const fromDate =
        dateRange === "today"
          ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
          : dateRange === "7d"
          ? new Date(Date.now() - 7 * 86400 * 1000).toISOString()
          : new Date(Date.now() - 30 * 86400 * 1000).toISOString();

      const [sumRes, heatRes, prodRes, invRes, peakRes, wasteRes, lowRes, invListRes] = await Promise.allSettled([
        reportsService.getStoreSummary(selectedStoreId, fromDate),
        reportsService.getHourlyHeatmap(selectedStoreId),
        reportsService.getProductPerformance(selectedStoreId, fromDate, undefined, 8),
        reportsService.getRoyaltyInvoices(selectedStoreId),
        api.getPeakHoursAnalysis(selectedStoreId),
        api.getWasteShrinkageReport(selectedStoreId, fromDate),
        api.getLowStockAlerts(selectedStoreId),
        api.getStoreInventory(selectedStoreId),
      ]);

      if (sumRes.status === "fulfilled") setSummary(sumRes.value);
      if (heatRes.status === "fulfilled") setHeatmap(heatRes.value);
      if (prodRes.status === "fulfilled") setProducts(prodRes.value);
      if (invRes.status === "fulfilled") setInvoices(invRes.value);
      if (peakRes.status === "fulfilled") setPeakAnalysis(peakRes.value);
      if (wasteRes.status === "fulfilled") setWasteReport(wasteRes.value);
      if (lowRes.status === "fulfilled") setLowStockList(lowRes.value);
      if (invListRes.status === "fulfilled") setAllInventory(invListRes.value);

      if (isHQAdmin) {
        const netRes = await reportsService.getNetworkOverview(fromDate).catch(() => null);
        if (netRes) setNetworkOverview(netRes);
      }
    } catch {
      // Use existing demo state
    } finally {
      setLoading(false);
    }
  };

  const handleBroadcastAlert = async () => {
    if (!selectedStoreId) return;
    setIsBroadcasting(true);
    setBroadcastResult(null);
    try {
      const res = await api.broadcastLowStockAlerts(selectedStoreId, {
        customTelegramChatId: telegramChatId || undefined,
        customManagerEmail: managerEmail || undefined,
      });
      setBroadcastResult(res);
    } catch (err: any) {
      alert("Lỗi phát cảnh báo: " + (err.message || "Thất bại"));
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleSaveAlertConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStoreId) return;
    try {
      await api.updateStoreAlertConfig(selectedStoreId, {
        managerEmail: managerEmail || undefined,
        telegramChatId: telegramChatId || undefined,
      });
      setSaveConfigSuccess(true);
      setTimeout(() => setSaveConfigSuccess(false), 3000);
    } catch (err: any) {
      alert("Lỗi lưu cấu hình: " + (err.message || "Thất bại"));
    }
  };

  const handleRecordWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStoreId || !wasteIngredientId || wasteQuantity <= 0) {
      alert("Vui lòng chọn nguyên liệu và số lượng hợp lệ.");
      return;
    }
    setWasteSubmitting(true);
    try {
      await api.recordWaste(selectedStoreId, {
        storeId: selectedStoreId,
        ingredientId: wasteIngredientId,
        quantity: wasteQuantity,
        reason: wasteReason,
      });
      setShowWasteModal(false);
      setWasteQuantity(1);
      setWasteReason("Đổ vỡ trong quá trình pha chế");
      await loadData();
      alert("Đã ghi nhận xuất hủy hao hụt thành công!");
    } catch (err: any) {
      alert("Lỗi ghi nhận xuất hủy: " + (err.message || "Thất bại"));
    } finally {
      setWasteSubmitting(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedStoreId, dateRange]);

  const handleGenerateInvoice = async () => {
    try {
      const newInv = await reportsService.generateRoyaltyInvoice({
        storeId: selectedStoreId,
        billingYear: genYear,
        billingMonth: genMonth,
      });
      setInvoices((prev) => [newInv, ...prev.filter((i) => i.id !== newInv.id)]);
      setShowGenerateModal(false);
    } catch {
      // Local optimistic fallback
      const storeObj = stores.find((s) => s.id === selectedStoreId) || stores[0];
      const fallbackInv: RoyaltyInvoiceDto = {
        id: `inv-${Date.now()}`,
        invoiceNumber: `ROY-${genYear}${genMonth.toString().padStart(2, "0")}-${storeObj.code}`,
        storeId: selectedStoreId,
        storeName: storeObj.name,
        storeCode: storeObj.code,
        billingYear: genYear,
        billingMonth: genMonth,
        status: "Draft",
        totalOrdersCount: summary.totalOrders,
        grossRevenue: summary.grossRevenue,
        discountAmount: summary.discountAmount,
        netRevenue: summary.netRevenue,
        royaltyRate: 0.05,
        royaltyFee: Math.round(summary.netRevenue * 0.05),
        marketingFeeRate: 0.02,
        marketingFee: Math.round(summary.netRevenue * 0.02),
        techFee: 2000000,
        totalDue: Math.round(summary.netRevenue * 0.07) + 2000000,
        createdAt: new Date().toISOString(),
      };
      setInvoices((prev) => [fallbackInv, ...prev]);
      setShowGenerateModal(false);
    }
  };

  const handleIssueInvoice = async (invoiceId: string) => {
    try {
      const issued = await reportsService.issueRoyaltyInvoice(invoiceId);
      setInvoices((prev) => prev.map((i) => (i.id === invoiceId ? issued : i)));
    } catch {
      setInvoices((prev) =>
        prev.map((i) =>
          i.id === invoiceId
            ? {
                ...i,
                status: "Issued",
                issuedAt: new Date().toISOString(),
                dueDate: new Date(Date.now() + 15 * 86400 * 1000).toISOString(),
              }
            : i
        )
      );
    }
  };

  const handlePayInvoice = async (invoiceId: string) => {
    if (!payReference.trim()) return;
    try {
      const paid = await reportsService.payRoyaltyInvoice(invoiceId, { paymentReference: payReference });
      setInvoices((prev) => prev.map((i) => (i.id === invoiceId ? paid : i)));
      setSelectedInvoice(null);
      setPayReference("");
    } catch {
      setInvoices((prev) =>
        prev.map((i) =>
          i.id === invoiceId
            ? {
                ...i,
                status: "Paid",
                paidAt: new Date().toISOString(),
                paymentReference: payReference,
              }
            : i
        )
      );
      setSelectedInvoice(null);
      setPayReference("");
    }
  };

  // Find max hourly revenue for bar chart scaling
  const maxHourlyRevenue = useMemo(() => {
    const max = Math.max(...heatmap.hourlyDistribution.map((h) => h.revenue));
    return max > 0 ? max : 1;
  }, [heatmap]);

  return (
    <div className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20">
            <BarChart3 size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-slate-900 md:text-2xl">
                Business Intelligence & Royalty Hub
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 border border-indigo-200">
                <Sparkles size={12} />
                Financial Engine
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500">
              Báo cáo doanh thu thời gian thực · Biểu đồ nhiệt Peak Hours · Tự động tính phí nhượng quyền Franchise
            </p>
          </div>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Branch selector */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
            <Store size={14} className="text-slate-400" />
            <select
              aria-label="Chọn chi nhánh xem báo cáo"
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="bg-transparent font-bold text-slate-800 outline-none"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} - {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date range toggle */}
          <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-0.5 text-xs font-bold">
            <button
              onClick={() => setDateRange("today")}
              className={`rounded-lg px-2.5 py-1 transition-colors ${
                dateRange === "today" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Hôm nay
            </button>
            <button
              onClick={() => setDateRange("7d")}
              className={`rounded-lg px-2.5 py-1 transition-colors ${
                dateRange === "7d" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              7 ngày
            </button>
            <button
              onClick={() => setDateRange("30d")}
              className={`rounded-lg px-2.5 py-1 transition-colors ${
                dateRange === "30d" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              30 ngày
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCcw size={14} className={loading ? "animate-spin text-indigo-600" : ""} />
            Cập nhật
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {/* Doanh thu thuần */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Doanh thu thuần</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <DollarSign size={16} />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {summary.netRevenue.toLocaleString("vi-VN")} ₫
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
            <span>{summary.totalOrders} đơn</span> · <span>AOV: {summary.averageOrderValue.toLocaleString("vi-VN")} ₫</span>
          </div>
        </div>

        {/* Giá vốn COGS */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Giá vốn COGS</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <TrendingUp size={16} />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {summary.estimatedCogs.toLocaleString("vi-VN")} ₫
          </div>
          <div className="mt-1 text-[11px] text-amber-600 font-medium">
            Tỷ lệ tiêu hao nguyên liệu ~32%
          </div>
        </div>

        {/* Lợi nhuận gộp & Biên gộp */}
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">Biên lợi nhuận gộp</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              <Percent size={16} />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-indigo-900">
            {summary.grossMarginPercentage}%
          </div>
          <div className="mt-1 text-[11px] text-indigo-600 font-semibold">
            Lãi gộp: {summary.estimatedGrossProfit.toLocaleString("vi-VN")} ₫
          </div>
        </div>

        {/* Phí nhượng quyền nộp HQ */}
        <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-700">Phí nhượng quyền HQ</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
              <CreditCard size={16} />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-purple-900">
            {Math.round(summary.netRevenue * 0.05 + summary.netRevenue * 0.02 + 2000000).toLocaleString("vi-VN")} ₫
          </div>
          <div className="mt-1 text-[11px] text-purple-600 font-medium">
            5% Bản quyền + 2% Mkt + Phần mềm
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-2 gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab("overview")}
            className={`rounded-xl px-4 py-2 text-xs font-extrabold transition-colors ${
              activeTab === "overview"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Tổng quan & Top Món
          </button>
          <button
            onClick={() => setActiveTab("heatmap")}
            className={`rounded-xl px-4 py-2 text-xs font-extrabold transition-colors flex items-center gap-1.5 ${
              activeTab === "heatmap"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-amber-50 text-amber-800 hover:bg-amber-100"
            }`}
          >
            <Clock size={13} />
            Khung Giờ Vàng (Peak Hours)
          </button>
          <button
            onClick={() => setActiveTab("waste")}
            className={`rounded-xl px-4 py-2 text-xs font-extrabold transition-colors flex items-center gap-1.5 ${
              activeTab === "waste"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            }`}
          >
            <TrendingUp size={13} />
            Hao Hụt & Hư Hỏng (Waste)
          </button>
          <button
            onClick={() => setActiveTab("alerts")}
            className={`rounded-xl px-4 py-2 text-xs font-extrabold transition-colors flex items-center gap-1.5 ${
              activeTab === "alerts"
                ? "bg-rose-600 text-white shadow-sm"
                : "bg-rose-50 text-rose-800 hover:bg-rose-100"
            }`}
          >
            <Bell size={13} />
            Cảnh Báo Tồn Kho & Telegram
            {lowStockList.length > 0 && (
              <span className="rounded-full bg-rose-500 text-white text-[10px] px-1.5 py-0.2 font-bold ml-1">
                {lowStockList.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("royalty")}
            className={`rounded-xl px-4 py-2 text-xs font-extrabold transition-colors ${
              activeTab === "royalty"
                ? "bg-purple-600 text-white shadow-sm"
                : "bg-purple-50 text-purple-800 hover:bg-purple-100"
            }`}
          >
            Sổ cái Hóa đơn Phí HQ ({invoices.length})
          </button>
        </div>

        {activeTab === "royalty" && (
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-black text-white shadow-sm shadow-purple-500/20 hover:bg-purple-700"
          >
            <Plus size={14} />
            Tính phí tháng mới
          </button>
        )}

        {activeTab === "waste" && (
          <button
            onClick={() => setShowWasteModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-black text-white shadow-sm shadow-rose-500/20 hover:bg-rose-700"
          >
            <Trash2 size={14} />
            Khai báo xuất hủy nhanh
          </button>
        )}
      </div>

      {/* Tab 1: Overview & Top Products */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Top Selling Products List */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">Xếp hạng thực đơn (Menu Pareto 80/20)</h3>
                <p className="text-xs text-slate-500">Các món đóng góp doanh thu và lợi nhuận cao nhất</p>
              </div>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                Top {products.length} sản phẩm
              </span>
            </div>

            <div className="space-y-3.5">
              {products.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400 font-medium">
                  Chưa có dữ liệu bán hàng cho kỳ này. Dữ liệu sẽ tự động tổng hợp khi có đơn hàng.
                </div>
              ) : (
                products.map((item, idx) => (
                <div key={item.productId} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-xs font-black text-white">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="text-xs font-black text-slate-900">{item.productName}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{item.sku}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-black text-slate-900">{item.revenue.toLocaleString("vi-VN")} ₫</div>
                      <div className="text-[10px] text-emerald-600 font-bold">{item.unitsSold} ly đã bán</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600"
                        style={{ width: `${Math.min(100, item.revenueSharePercentage * 3)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                      <span>Tỷ trọng doanh số: {item.revenueSharePercentage}%</span>
                      <span>Biên lợi nhuận: {item.marginPercentage}%</span>
                    </div>
                  </div>
                </div>
              ))
              )}
            </div>
          </div>

          {/* Network Comparison or Financial Breakdown */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-black text-slate-900">Cơ cấu chi phí tài chính</h3>
              <p className="text-xs text-slate-500">Phân rã dòng tiền doanh thu chi nhánh</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs">
                <span className="font-semibold text-slate-600">Doanh thu gộp (Gross):</span>
                <span className="font-black text-slate-900">{summary.grossRevenue.toLocaleString("vi-VN")} ₫</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs">
                <span className="font-semibold text-slate-600">Chiết khấu & Voucher:</span>
                <span className="font-black text-red-600">-{summary.discountAmount.toLocaleString("vi-VN")} ₫</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs">
                <span className="font-semibold text-slate-600">Thuế GTGT (VAT 8%):</span>
                <span className="font-black text-slate-900">{summary.vatAmount.toLocaleString("vi-VN")} ₫</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-3 text-xs border border-emerald-100">
                <span className="font-bold text-emerald-800">Doanh thu thực nhận:</span>
                <span className="font-black text-emerald-900">{summary.netRevenue.toLocaleString("vi-VN")} ₫</span>
              </div>
            </div>

            {/* Franchise Royalty Estimate Box */}
            <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-4 space-y-2">
              <div className="flex items-center gap-2 text-purple-900 font-black text-xs">
                <CreditCard size={14} />
                Ước tính phí nhượng quyền kỳ này:
              </div>
              <div className="space-y-1 text-[11px] text-purple-800">
                <div className="flex justify-between">
                  <span>Phí bản quyền thương hiệu (5%):</span>
                  <span className="font-bold">{Math.round(summary.netRevenue * 0.05).toLocaleString("vi-VN")} ₫</span>
                </div>
                <div className="flex justify-between">
                  <span>Quỹ Marketing chuỗi (2%):</span>
                  <span className="font-bold">{Math.round(summary.netRevenue * 0.02).toLocaleString("vi-VN")} ₫</span>
                </div>
                <div className="flex justify-between">
                  <span>Phần mềm quản lý chuỗi:</span>
                  <span className="font-bold">2.000.000 ₫</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Hourly Sales Heatmap */}
      {activeTab === "heatmap" && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-6">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">Biểu đồ nhiệt doanh thu 24 giờ (Hourly Heatmap)</h3>
                <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                  Phân tích khung giờ vàng
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Cường độ tiêu thụ theo từng khung giờ trong ngày giúp tối ưu ca trực Barista
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 rounded-full bg-amber-500" /> Giờ cao điểm
              </span>
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 rounded-full bg-indigo-500" /> Bình thường
              </span>
            </div>
          </div>

          {/* Peak Hours Staffing & Revenue Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-800">Khung Giờ Đông Nhất</span>
              <p className="text-xl font-black text-amber-950 mt-1">
                {peakAnalysis?.busiestHourRange || "11:00 - 13:00"}
              </p>
              <p className="text-[11px] text-amber-700 mt-0.5">Đỉnh điểm lượng khách trong ngày</p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-800">Doanh Thu Giờ Cao Điểm</span>
              <p className="text-xl font-black text-emerald-950 mt-1">
                {(peakAnalysis?.peakHourRevenue || 0).toLocaleString("vi-VN")} ₫
              </p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                {peakAnalysis?.peakHourOrderCount || 0} đơn cao điểm
              </p>
            </div>

            <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-sky-800">Định Biên Ca Cao Điểm</span>
              <p className="text-xl font-black text-sky-950 mt-1 flex items-center gap-1.5">
                <Users size={18} className="text-sky-600" />
                {peakAnalysis?.recommendedStaffingOnPeak || 3} nhân sự
              </p>
              <p className="text-[11px] text-sky-700 mt-0.5">1 thu ngân, 2 pha chế + hỗ trợ</p>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-800">Định Biên Ca Thường</span>
              <p className="text-xl font-black text-indigo-950 mt-1 flex items-center gap-1.5">
                <Users size={18} className="text-indigo-600" />
                {peakAnalysis?.recommendedStaffingOffPeak || 2} nhân sự
              </p>
              <p className="text-[11px] text-indigo-700 mt-0.5">Tối ưu chi phí lao động (Labor Cost)</p>
            </div>
          </div>

          {/* Bar chart visualization */}
          <div className="grid grid-cols-12 gap-1.5 sm:grid-cols-24 items-end h-64 pt-6 pb-2 border-b border-slate-200">
            {heatmap.hourlyDistribution.map((h) => {
              const heightPercent = Math.max(8, Math.round((h.revenue / maxHourlyRevenue) * 100));

              return (
                <div key={h.hour} className="group relative flex flex-col items-center h-full justify-end">
                  {/* Tooltip on hover */}
                  <div className="pointer-events-none absolute bottom-full mb-2 hidden -translate-x-1/2 flex-col items-center rounded-lg bg-slate-900 px-2 py-1.5 text-[10px] text-white shadow-xl group-hover:flex z-20 whitespace-nowrap">
                    <span className="font-black">{h.hour}:00 - {h.hour + 1}:00</span>
                    <span>{h.orderCount} đơn hàng</span>
                    <span className="text-amber-300 font-bold">{h.revenue.toLocaleString("vi-VN")} ₫</span>
                  </div>

                  {/* Peak icon */}
                  {h.isPeakHour && (
                    <Flame size={12} className="mb-1 text-amber-500 animate-pulse" />
                  )}

                  {/* Bar */}
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full rounded-t-md transition-all group-hover:brightness-110 ${
                      h.isPeakHour
                        ? "bg-gradient-to-t from-amber-500 to-orange-400"
                        : "bg-gradient-to-t from-indigo-500 to-indigo-300"
                    }`}
                  />
                  <span className="mt-2 text-[10px] font-bold text-slate-400">{h.hour}h</span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-amber-50 p-3.5 border border-amber-200">
              <div className="text-xs font-black text-amber-900">☕ Khung Giờ Sáng (7h - 9h)</div>
              <p className="mt-1 text-[11px] text-amber-800">
                Cao điểm cà phê mang đi (Take-away) của nhân viên văn phòng. Khuyến nghị chuẩn bị sẵn cốt cà phê phin.
              </p>
            </div>
            <div className="rounded-xl bg-orange-50 p-3.5 border border-orange-200">
              <div className="text-xs font-black text-orange-900">🍜 Khung Giờ Trưa (11h - 13h)</div>
              <p className="mt-1 text-[11px] text-orange-800">
                Khách dùng tại bàn kèm đồ ăn nhẹ (Bánh mì, Trà sen vàng). Đơn hàng cần ưu tiên chuyển nhanh sang KDS.
              </p>
            </div>
            <div className="rounded-xl bg-purple-50 p-3.5 border border-purple-200">
              <div className="text-xs font-black text-purple-900">🌙 Khung Giờ Tối (18h - 21h)</div>
              <p className="mt-1 text-[11px] text-purple-800">
                Doanh số Freeze và sinh tố đá xay tăng mạnh. Tăng cường nhân sự quầy pha chế và dọn bàn.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Waste & Shrinkage Report */}
      {activeTab === "waste" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Tỷ lệ hao hụt toàn quán</span>
              <div className="flex items-baseline gap-3 mt-2">
                <span className="text-3xl font-black text-rose-600">
                  {wasteReport?.overallShrinkageRatePercentage || 0}%
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700">
                  {wasteReport?.healthRating || "Chuẩn F&B < 2%"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">Dựa trên đối soát thực tế BoM & Lượng xuất hủy</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Chi phí thất thoát</span>
              <p className="text-3xl font-black text-rose-600 mt-2">
                {(wasteReport?.totalWasteCost || 0).toLocaleString("vi-VN")} ₫
              </p>
              <p className="text-xs text-slate-500 mt-2">Giá vốn xuất hủy do rơi vỡ, hết hạn, pha chế hỏng</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Khai báo tổn thất</span>
                <p className="text-xs text-slate-600 mt-1">Ghi nhận ngay khi barista làm đổ vỡ hoặc phát hiện nguyên liệu hư hỏng.</p>
              </div>
              <button
                onClick={() => setShowWasteModal(true)}
                className="mt-3 w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition shadow-md shadow-rose-600/20 flex items-center justify-center gap-2"
              >
                <Trash2 size={14} />
                Khai báo Xuất Hủy / Đổ Vỡ Nhanh
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">Chi Tiết Hao Hụt & Tổn Thất Từng Nguyên Liệu</h3>
                <p className="text-xs text-slate-500">So sánh lượng xuất bán lý thuyết và lượng xuất hủy thực tế</p>
              </div>
              <span className="text-xs font-bold text-slate-500">Kỳ 30 ngày</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="pb-3">Mã</th>
                    <th className="pb-3">Nguyên liệu</th>
                    <th className="pb-3 text-right">Xuất Bán Lý Thuyết</th>
                    <th className="pb-3 text-right">Xuất Hủy Hao Hụt</th>
                    <th className="pb-3 text-right">Tổn Thất (VND)</th>
                    <th className="pb-3 text-right">Tỷ Lệ Hao Hụt</th>
                    <th className="pb-3 text-center">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(!wasteReport?.items || wasteReport.items.length === 0) ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                        Chưa có dữ liệu xuất hủy hao hụt nào cho kỳ này.
                      </td>
                    </tr>
                  ) : (
                    wasteReport.items.map((item) => (
                      <tr key={item.ingredientId} className="hover:bg-slate-50">
                        <td className="py-3 font-mono font-bold text-slate-600">{item.ingredientCode}</td>
                        <td className="py-3 font-bold text-slate-900">{item.ingredientName}</td>
                        <td className="py-3 text-right font-semibold text-slate-700">{item.theoreticalUsage.toFixed(2)} {item.unit}</td>
                        <td className="py-3 text-right font-bold text-rose-600">{item.wastedQuantity.toFixed(2)} {item.unit}</td>
                        <td className="py-3 text-right font-bold text-slate-900">{item.totalWasteCost.toLocaleString("vi-VN")} ₫</td>
                        <td className="py-3 text-right font-black">{item.shrinkageRatePercentage}%</td>
                        <td className="py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.status === "Normal"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.status === "Warning"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}>
                            {item.status === "Normal" ? "Đạt chuẩn" : item.status === "Warning" ? "Cần lưu ý" : "Báo động"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Low-stock Alerts & Telegram Bot */}
      {activeTab === "alerts" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Broadcast Action Card */}
            <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-rose-700 font-black text-base mb-1">
                  <Bell size={18} />
                  Phát Cảnh Báo Khẩn Cấp
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Quét tự động toàn bộ nguyên liệu chạm ngưỡng đỏ và gửi thông báo tức thì qua <b>Telegram Bot</b> và <b>Email Quản lý</b> của cửa hàng.
                </p>

                <div className="my-4 rounded-xl bg-white p-3 border border-rose-100 shadow-xs">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Nguyên liệu dưới ngưỡng:</span>
                    <span className="font-black text-rose-600">{lowStockList.length} món</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleBroadcastAlert}
                disabled={isBroadcasting}
                className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl transition shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isBroadcasting ? (
                  <span>Đang gửi thông báo...</span>
                ) : (
                  <>
                    <Send size={14} />
                    Gửi Cảnh Báo Telegram & Email Ngay
                  </>
                )}
              </button>
            </div>

            {/* Config Form Card */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-3">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <span>⚙️</span> Cấu Hình Kênh Nhận Cảnh Báo Cửa Hàng
              </h3>
              <p className="text-xs text-slate-500">
                Thiết lập Telegram Chat ID (nhóm vận hành hoặc quản lý) và Email nhận bảng cảnh báo thiếu hụt.
              </p>

              <form onSubmit={handleSaveAlertConfig} className="space-y-3 pt-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Telegram Chat ID (Nhóm hoặc Quản lý)
                    </label>
                    <input
                      type="text"
                      placeholder="VD: -100123456789 hoặc @username"
                      value={telegramChatId}
                      onChange={(e) => setTelegramChatId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium outline-none focus:border-amber-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Thêm Bot vào nhóm vận hành để nhận tin nhắn cảnh báo.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Email Quản Lý Chi Nhánh
                    </label>
                    <input
                      type="email"
                      placeholder="VD: store_manager@highlands.vn"
                      value={managerEmail}
                      onChange={(e) => setManagerEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium outline-none focus:border-amber-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Nhận bảng thống kê chi tiết định dạng HTML qua hòm thư.
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition"
                  >
                    Lưu Cấu Hình
                  </button>
                  {saveConfigSuccess && (
                    <span className="text-xs text-emerald-600 font-bold animate-pulse">
                      ✅ Đã lưu cấu hình cảnh báo thành công!
                    </span>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Broadcast Result Banner */}
          {broadcastResult && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <p className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  Đã hoàn tất phát cảnh báo tồn kho cho: <b>{broadcastResult.storeName}</b>
                </p>
                <div className="flex flex-wrap gap-3 text-[11px] text-emerald-800 mt-1">
                  <span>
                    Telegram: <b>{broadcastResult.telegramSent ? "Thành công" : "Mô phỏng"}</b> ({broadcastResult.telegramStatus})
                  </span>
                  <span>•</span>
                  <span>
                    Email: <b>{broadcastResult.emailSent ? "Thành công" : "Mô phỏng"}</b> ({broadcastResult.emailStatus})
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-emerald-600 font-medium">
                {new Date(broadcastResult.sentAt).toLocaleTimeString()}
              </span>
            </div>
          )}

          {/* Low-stock Table */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">Danh Sách Nguyên Liệu Chạm Ngưỡng Báo Động Đỏ</h3>
                <p className="text-xs text-slate-500">Các mặt hàng cần lập lệnh điều chuyển kho (Stock Transfer) khẩn cấp</p>
              </div>
              <span className="rounded-lg bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700">
                {lowStockList.length} mặt hàng
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="pb-3">Mã</th>
                    <th className="pb-3">Tên Nguyên Liệu</th>
                    <th className="pb-3 text-right">Tồn Kho Hiện Tại</th>
                    <th className="pb-3 text-right">Ngưỡng An Toàn</th>
                    <th className="pb-3 text-right">Thiếu Hụt Cần Bổ Sung</th>
                    <th className="pb-3 text-center">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lowStockList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                        🎉 Tuyệt vời! Toàn bộ nguyên liệu đều đang ở mức an toàn trên ngưỡng cảnh báo.
                      </td>
                    </tr>
                  ) : (
                    lowStockList.map((item) => (
                      <tr key={item.ingredientId} className="hover:bg-slate-50">
                        <td className="py-3 font-mono font-bold text-slate-600">{item.ingredientCode}</td>
                        <td className="py-3 font-bold text-slate-900">{item.ingredientName}</td>
                        <td className="py-3 text-right font-black text-rose-600">{item.currentStock.toFixed(2)} {item.unit}</td>
                        <td className="py-3 text-right text-slate-500">{item.minAlertThreshold.toFixed(2)} {item.unit}</td>
                        <td className="py-3 text-right font-black text-amber-600">+{item.shortage.toFixed(2)} {item.unit}</td>
                        <td className="py-3 text-center">
                          <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                            Cần nhập gấp
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Royalty Invoices Ledger */}
      {activeTab === "royalty" && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-black text-slate-900">Sổ cái Hóa đơn Thu Phí Nhượng Quyền</h3>
            <p className="text-xs text-slate-500">
              Quản lý nghĩa vụ tài chính giữa Trụ sở HQ và Chi nhánh nhượng quyền (Franchisee)
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="pb-3">Mã Hóa Đơn</th>
                  <th className="pb-3">Kỳ Thu Phí</th>
                  <th className="pb-3 text-right">Doanh Thu Thuần</th>
                  <th className="pb-3 text-right">Phí Bản Quyền (5%)</th>
                  <th className="pb-3 text-right">Marketing (2%)</th>
                  <th className="pb-3 text-right">Phần Mềm</th>
                  <th className="pb-3 text-right font-black text-slate-700">Tổng Cần Nộp</th>
                  <th className="pb-3 text-center">Trạng Thái</th>
                  <th className="pb-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 text-xs font-medium">
                      Chưa có hóa đơn phí nhượng quyền nào cho chi nhánh này. Nhấn &quot;Đối Soát &amp; Lập Hóa Đơn Kỳ Mới&quot; để tạo.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 font-black text-slate-900">{inv.invoiceNumber}</td>
                    <td className="py-3.5 font-medium text-slate-600">
                      Tháng {inv.billingMonth}/{inv.billingYear}
                    </td>
                    <td className="py-3.5 text-right font-semibold text-slate-800">
                      {inv.netRevenue.toLocaleString("vi-VN")} ₫
                    </td>
                    <td className="py-3.5 text-right text-purple-700 font-bold">
                      {inv.royaltyFee.toLocaleString("vi-VN")} ₫
                    </td>
                    <td className="py-3.5 text-right text-indigo-700 font-bold">
                      {inv.marketingFee.toLocaleString("vi-VN")} ₫
                    </td>
                    <td className="py-3.5 text-right text-slate-600">
                      {inv.techFee.toLocaleString("vi-VN")} ₫
                    </td>
                    <td className="py-3.5 text-right font-black text-slate-900 text-sm">
                      {inv.totalDue.toLocaleString("vi-VN")} ₫
                    </td>
                    <td className="py-3.5 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          inv.status === "Paid"
                            ? "bg-emerald-100 text-emerald-800"
                            : inv.status === "Issued"
                            ? "bg-amber-100 text-amber-800"
                            : inv.status === "Overdue"
                            ? "bg-red-100 text-red-800 animate-pulse"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {inv.status === "Paid"
                          ? "Đã nộp"
                          : inv.status === "Issued"
                          ? "Đã phát hành"
                          : inv.status === "Overdue"
                          ? "Quá hạn"
                          : "Dự thảo (Draft)"}
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {inv.status === "Draft" && (
                          <button
                            onClick={() => handleIssueInvoice(inv.id)}
                            className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-indigo-700"
                          >
                            Phát hành
                          </button>
                        )}
                        {inv.status === "Issued" && (
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
                          >
                            Xác nhận nộp
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:bg-slate-100"
                          title="Xem chi tiết hóa đơn"
                        >
                          <FileText size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Tính Phí Tháng Mới */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-purple-600">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
                <CreditCard size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Tính Phí Nhượng Quyền Mới</h3>
                <p className="text-xs text-slate-500">Tự động tổng hợp doanh thu và tính toán nghĩa vụ phí</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Năm quyết toán:</label>
                <input
                  type="number"
                  value={genYear}
                  onChange={(e) => setGenYear(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Tháng quyết toán:</label>
                <select
                  value={genMonth}
                  onChange={(e) => setGenMonth(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold outline-none"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      Tháng {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleGenerateInvoice}
                className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-black text-white hover:bg-purple-700"
              >
                Tính toán & Tạo Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Chi Tiết Hóa Đơn / Xác Nhận Nộp Phí */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="rounded-md bg-purple-100 px-2 py-0.5 text-xs font-black text-purple-900">
                  {selectedInvoice.invoiceNumber}
                </span>
                <h3 className="mt-1 text-base font-black text-slate-900">{selectedInvoice.storeName}</h3>
                <p className="text-xs text-slate-500">
                  Kỳ thanh toán: Tháng {selectedInvoice.billingMonth}/{selectedInvoice.billingYear}
                </p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Tổng số đơn hàng trong tháng:</span>
                <span className="font-bold text-slate-800">{selectedInvoice.totalOrdersCount} đơn</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Doanh thu gộp (Gross):</span>
                <span className="font-bold text-slate-800">{selectedInvoice.grossRevenue.toLocaleString("vi-VN")} ₫</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Doanh thu thuần tính phí (Net):</span>
                <span className="font-bold text-slate-800">{selectedInvoice.netRevenue.toLocaleString("vi-VN")} ₫</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 text-purple-700">
                <span>Phí bản quyền ({selectedInvoice.royaltyRate * 100}%):</span>
                <span className="font-bold">{selectedInvoice.royaltyFee.toLocaleString("vi-VN")} ₫</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 text-indigo-700">
                <span>Quỹ Marketing ({selectedInvoice.marketingFeeRate * 100}%):</span>
                <span className="font-bold">{selectedInvoice.marketingFee.toLocaleString("vi-VN")} ₫</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                <span>Phí phần mềm công nghệ:</span>
                <span className="font-bold">{selectedInvoice.techFee.toLocaleString("vi-VN")} ₫</span>
              </div>
              <div className="flex justify-between py-2 text-sm font-black text-slate-900 bg-slate-50 px-2 rounded-lg">
                <span>TỔNG TIỀN NỘP VỀ TRỤ SỞ (HQ):</span>
                <span className="text-purple-700">{selectedInvoice.totalDue.toLocaleString("vi-VN")} ₫</span>
              </div>
            </div>

            {selectedInvoice.status === "Issued" && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-700">Mã giao dịch ngân hàng nộp tiền:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: VCB-TXN-11223344"
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-emerald-500"
                />
                <button
                  onClick={() => handlePayInvoice(selectedInvoice.id)}
                  disabled={!payReference.trim()}
                  className="w-full rounded-xl bg-emerald-600 p-2.5 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Xác nhận đã thanh toán nộp phí
                </button>
              </div>
            )}

            {selectedInvoice.status === "Paid" && (
              <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 font-semibold border border-emerald-200">
                ✓ Đã thanh toán nộp phí HQ. Mã tham chiếu: {selectedInvoice.paymentReference}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Waste / Shrinkage Recording Modal */}
      {showWasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🗑️</span>
                <h3 className="font-bold text-slate-800">Khai báo Xuất Hủy / Hao Hụt Nhanh</h3>
              </div>
              <button
                onClick={() => setShowWasteModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordWaste} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chọn nguyên liệu hư hỏng / hết hạn / làm đổ:
                </label>
                <select
                  value={wasteIngredientId}
                  onChange={(e) => setWasteIngredientId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  required
                >
                  <option value="">-- Chọn nguyên liệu trong kho --</option>
                  {allInventory.map((item) => (
                    <option key={item.ingredientId} value={item.ingredientId}>
                      {item.ingredientName} ({item.ingredientCode}) (Tồn: {item.currentStock} {item.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Số lượng xuất hủy:
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={wasteQuantity}
                  onChange={(e) => setWasteQuantity(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lý do xuất hủy / nguyên nhân hao hụt:
                </label>
                <select
                  value={wasteReason}
                  onChange={(e) => setWasteReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                >
                  <option value="Đổ vỡ trong quá trình pha chế">Đổ vỡ trong quá trình pha chế</option>
                  <option value="Hết hạn sử dụng (Expired)">Hết hạn sử dụng (Expired)</option>
                  <option value="Hư hỏng do bảo quản lạnh kém">Hư hỏng do bảo quản lạnh kém</option>
                  <option value="Kiểm kê thiếu hụt định kỳ">Kiểm kê thiếu hụt định kỳ</option>
                  <option value="Lý do khác">Lý do khác</option>
                </select>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowWasteModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={wasteSubmitting || !wasteIngredientId || wasteQuantity <= 0}
                  className="flex-1 rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {wasteSubmitting ? "Đang lưu..." : "Xác nhận xuất hủy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
