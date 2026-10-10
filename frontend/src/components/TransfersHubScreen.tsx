import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  Box,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Filter,
  Package,
  PackageCheck,
  PackagePlus,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Truck,
  X,
  XCircle,
  Sparkles,
  ShoppingCart,
  TrendingDown,
  BarChart3,
  Timer,
} from "lucide-react";
import {
  getTransferOrders,
  createTransferOrder,
  submitTransferOrder,
  approveTransferOrder,
  rejectTransferOrder,
  dispatchTransferOrder,
  receiveTransferOrder,
  resolveDiscrepancy,
  cancelTransferOrder,
  getWarehouses,
  getWarehouseInventory,
  inboundWarehouseStock,
  type StockTransferOrderDto,
  type WarehouseDto,
  type WarehouseInventoryDto,
  type TransferStatus,
} from "../services/transfers.ts";
import { type User } from "../services/auth.ts";
import { costingApi, type IngredientItem } from "../services/costing.ts";
import { api, type AutoReorderSuggestionResponse, type SupplyChainKpiSummary } from "../services/api.ts";

export interface TransferStoreOption {
  id: string;
  name: string;
  code: string;
}

const defaultTransferStores: TransferStoreOption[] = [
  { id: "22222222-2222-2222-2222-222222222222", name: "Chi nhánh Quận 1 (Flagship Store)", code: "STORE-Q1" },
  { id: "33333333-3333-3333-3333-333333333333", name: "Chi nhánh Landmark 81", code: "STORE-L81" },
];


const initialMockWarehouses: WarehouseDto[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    code: "WH-CENTRAL-01",
    name: "Kho Tổng Trung Tâm Miền Nam",
    address: "Khu Công Nghiệp Tân Bình, Tây Thạnh, Tân Phú, TP. HCM",
    contactPhone: "1900 6868",
    isActive: true,
  },
];

const initialMockWhInventory: WarehouseInventoryDto[] = [
  {
    id: "wi-1",
    warehouseId: "11111111-1111-1111-1111-111111111111",
    ingredientId: "44444444-4444-4444-4444-444444444441",
    ingredientCode: "BEAN-ARA",
    ingredientName: "Arabica Coffee Beans",
    unit: "gram",
    currentStock: 1500000,
    safetyStock: 200000,
    unitCost: 350,
    lastRestockedAt: "2026-10-05T09:00:00Z",
  },
  {
    id: "wi-2",
    warehouseId: "11111111-1111-1111-1111-111111111111",
    ingredientId: "44444444-4444-4444-4444-444444444442",
    ingredientCode: "PEARL-01",
    ingredientName: "Black Tapioca Pearl",
    unit: "gram",
    currentStock: 800000,
    safetyStock: 100000,
    unitCost: 150,
    lastRestockedAt: "2026-10-05T09:00:00Z",
  },
  {
    id: "wi-3",
    warehouseId: "11111111-1111-1111-1111-111111111111",
    ingredientId: "44444444-4444-4444-4444-444444444443",
    ingredientCode: "MILK-OW",
    ingredientName: "Oat Milk Barista",
    unit: "ml",
    currentStock: 450000,
    safetyStock: 50000,
    unitCost: 120,
    lastRestockedAt: "2026-10-04T11:00:00Z",
  },
  {
    id: "wi-4",
    warehouseId: "11111111-1111-1111-1111-111111111111",
    ingredientId: "44444444-4444-4444-4444-444444444445",
    ingredientCode: "TEA-SEN",
    ingredientName: "Sen Dried Tea Leaves",
    unit: "gram",
    currentStock: 120000,
    safetyStock: 30000,
    unitCost: 280,
    lastRestockedAt: "2026-10-06T06:00:00Z",
  },
];

export interface TransfersHubScreenProps {
  currentUser: User | null;
  onSwitchUser?: (user: User | null) => void;
}

export function TransfersHubScreen({ currentUser, onSwitchUser }: TransfersHubScreenProps) {
  const [activeTab, setActiveTab] = useState<"transfers" | "warehouse" | "suggestions" | "analytics">("transfers");
  const [orders, setOrders] = useState<StockTransferOrderDto[]>([]);
  const [stores, setStores] = useState<TransferStoreOption[]>(defaultTransferStores);
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>(initialMockWarehouses);
  const [warehouseInventory, setWarehouseInventory] = useState<WarehouseInventoryDto[]>(initialMockWhInventory);
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modals state
  const [activeModal, setActiveModal] = useState<
    "create" | "approve" | "dispatch" | "receive" | "resolve" | "inbound" | "detail" | null
  >(null);
  const [selectedOrder, setSelectedOrder] = useState<StockTransferOrderDto | null>(null);

  // Form states
  const [createStoreId, setCreateStoreId] = useState("22222222-2222-2222-2222-222222222222");
  const [createNotes, setCreateNotes] = useState("");
  const [createItems, setCreateItems] = useState<{ ingredientId: string; quantity: number }[]>([
    { ingredientId: "44444444-4444-4444-4444-444444444441", quantity: 10000 },
  ]);

  const [approveItems, setApproveItems] = useState<{ [ingId: string]: number }>({});
  const [approveNotes, setApproveNotes] = useState("");

  const [dispatchTracking, setDispatchTracking] = useState("");
  const [dispatchNotes, setDispatchNotes] = useState("");

  const [receiveItems, setReceiveItems] = useState<{ [ingId: string]: number }>({});
  const [receiveInspectionNotes, setReceiveInspectionNotes] = useState("");

  const [resolveNotes, setResolveNotes] = useState("");

  const [inboundSupplierCode, setInboundSupplierCode] = useState("VINAMILK");
  const [inboundRef, setInboundRef] = useState("PO-202610-09");
  const [inboundIngId, setInboundIngId] = useState("44444444-4444-4444-4444-444444444441");
  const [inboundQty, setInboundQty] = useState(50000);
  const [inboundCost, setInboundCost] = useState(80);

  // Auto-Reorder & PO Suggestions
  const [suggestionsStoreId, setSuggestionsStoreId] = useState("22222222-2222-2222-2222-222222222222");
  const [planningHorizonDays, setPlanningHorizonDays] = useState(7);
  const [leadTimeDays, setLeadTimeDays] = useState(2);
  const [reorderSuggestions, setReorderSuggestions] = useState<AutoReorderSuggestionResponse | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [selectedSuggestionItems, setSelectedSuggestionItems] = useState<{ [ingId: string]: boolean }>({});

  // Supply Chain & Lead-Time Analytics
  const [kpiSummary, setKpiSummary] = useState<SupplyChainKpiSummary | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiStoreFilter, setKpiStoreFilter] = useState<string>("ALL");

  // Load data
  const loadData = async () => {
    try {
      setLoading(true);
      const [apiOrders, apiWh, apiIngs, apiStores] = await Promise.all([
        getTransferOrders().catch(() => []),
        getWarehouses().catch(() => initialMockWarehouses),
        costingApi.getIngredients().catch(() => []),
        api.getStores(1, 50).catch(() => null),
      ]);
      if (Array.isArray(apiOrders)) setOrders(apiOrders);
      if (apiWh && apiWh.length > 0) {
        setWarehouses(apiWh);
        const inv = await getWarehouseInventory(apiWh[0].id).catch(() => initialMockWhInventory);
        setWarehouseInventory(inv);
      }
      if (apiIngs && apiIngs.length > 0) {
        setIngredients(apiIngs);
        setInboundIngId(apiIngs[0].id);
        setCreateItems([{ ingredientId: apiIngs[0].id, quantity: 10000 }]);
      }
      if (apiStores && apiStores.items && apiStores.items.length > 0) {
        setStores(apiStores.items.map((s) => ({ id: s.id, name: s.name, code: s.code })));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchSearch =
        o.transferCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.dispatchTrackingNumber && o.dispatchTrackingNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        o.destinationStoreName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === "ALL" || o.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [orders, searchTerm, statusFilter]);

  // KPIs
  const kpis = useMemo(() => {
    const total = orders.length;
    const submitted = orders.filter((o) => o.status === "Submitted").length;
    const dispatched = orders.filter((o) => o.status === "Dispatched").length;
    const discrepancy = orders.filter((o) => o.status === "DiscrepancyReported").length;
    return { total, submitted, dispatched, discrepancy };
  }, [orders]);

  // Actions
  const handleOpenApprove = (order: StockTransferOrderDto) => {
    setSelectedOrder(order);
    const map: { [ingId: string]: number } = {};
    order.items.forEach((i) => {
      map[i.ingredientId] = i.requestedQuantity;
    });
    setApproveItems(map);
    setApproveNotes("");
    setActiveModal("approve");
  };

  const handleOpenDispatch = (order: StockTransferOrderDto) => {
    setSelectedOrder(order);
    setDispatchTracking(`VNPOST-${Math.floor(1000000 + Math.random() * 9000000)}`);
    setDispatchNotes("");
    setActiveModal("dispatch");
  };

  const handleOpenReceive = (order: StockTransferOrderDto) => {
    setSelectedOrder(order);
    const map: { [ingId: string]: number } = {};
    order.items.forEach((i) => {
      map[i.ingredientId] = i.approvedQuantity;
    });
    setReceiveItems(map);
    setReceiveInspectionNotes("");
    setActiveModal("receive");
  };

  const handleOpenResolve = (order: StockTransferOrderDto) => {
    setSelectedOrder(order);
    setResolveNotes("HQ xác nhận ghi giảm chi phí hao hụt vận chuyển và đối soát với đơn vị vận chuyển.");
    setActiveModal("resolve");
  };

  const handleSubmitOrder = async (orderId: string) => {
    try {
      await submitTransferOrder(orderId);
      await loadData();
    } catch (e: any) {
      alert("Lỗi trình duyệt đơn: " + e.message);
    }
  };

  const handleExecuteApprove = async () => {
    if (!selectedOrder) return;
    try {
      const payload = {
        approvedItems: Object.entries(approveItems).map(([ingredientId, approvedQuantity]) => ({
          ingredientId,
          approvedQuantity: Number(approvedQuantity),
        })),
        notes: approveNotes,
      };
      await approveTransferOrder(selectedOrder.id, payload);
      setActiveModal(null);
      await loadData();
    } catch (e: any) {
      alert("Lỗi phê duyệt đơn: " + e.message);
    }
  };

  const handleExecuteDispatch = async () => {
    if (!selectedOrder) return;
    try {
      await dispatchTransferOrder(selectedOrder.id, {
        dispatchTrackingNumber: dispatchTracking,
        notes: dispatchNotes,
      });
      setActiveModal(null);
      await loadData();
    } catch (e: any) {
      alert("Lỗi xuất kho: " + e.message);
    }
  };

  const handleExecuteReceive = async () => {
    if (!selectedOrder) return;
    try {
      const payload = {
        receivedItems: Object.entries(receiveItems).map(([ingredientId, actualReceivedQuantity]) => ({
          ingredientId,
          actualReceivedQuantity: Number(actualReceivedQuantity),
        })),
        inspectionNotes: receiveInspectionNotes,
      };
      await receiveTransferOrder(selectedOrder.id, payload);
      setActiveModal(null);
      await loadData();
    } catch (e: any) {
      alert("Lỗi nghiệm thu đơn: " + e.message);
    }
  };

  const handleExecuteResolve = async () => {
    if (!selectedOrder) return;
    try {
      await resolveDiscrepancy(selectedOrder.id, resolveNotes);
      setActiveModal(null);
      await loadData();
    } catch (e: any) {
      alert("Lỗi giải quyết lệch kho: " + e.message);
    }
  };

  const handleExecuteCreate = async () => {
    if (!warehouses.length) return;
    try {
      await createTransferOrder({
        sourceWarehouseId: warehouses[0].id,
        destinationStoreId: createStoreId,
        notes: createNotes,
        items: createItems.map((i) => ({
          ingredientId: i.ingredientId,
          requestedQuantity: Number(i.quantity),
        })),
      });
      setActiveModal(null);
      await loadData();
    } catch (e: any) {
      alert("Lỗi tạo đơn điều chuyển: " + e.message);
    }
  };

  const handleExecuteInbound = async () => {
    if (!warehouses.length) return;
    try {
      await inboundWarehouseStock(warehouses[0].id, {
        warehouseId: warehouses[0].id,
        supplierCode: inboundSupplierCode,
        referenceNumber: inboundRef,
        notes: "Nhập nguyên liệu từ NCC",
        items: [
          {
            ingredientId: inboundIngId,
            quantity: Number(inboundQty),
            unitCost: Number(inboundCost),
          },
        ],
      });
      setActiveModal(null);
      await loadData();
    } catch (e: any) {
      alert("Lỗi nhập kho tổng: " + e.message);
    }
  };

  const fetchSuggestions = async (storeId = suggestionsStoreId, planDays = planningHorizonDays, ltDays = leadTimeDays) => {
    try {
      setSuggestionsLoading(true);
      const res = await api.getAutoReorderSuggestions(storeId, planDays, ltDays);
      setReorderSuggestions(res);
      // Default: select items with RecommendedOrderQuantity > 0
      const initialSelected: { [ingId: string]: boolean } = {};
      res.suggestions.forEach((item) => {
        if (item.recommendedOrderQuantity > 0) {
          initialSelected[item.ingredientId] = true;
        }
      });
      setSelectedSuggestionItems(initialSelected);
    } catch (err: any) {
      alert("Không thể tải gợi ý đề xuất đặt hàng: " + err.message);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleCreatePoFromSuggestions = async () => {
    if (!reorderSuggestions || !warehouses.length) return;
    const selectedList = reorderSuggestions.suggestions.filter(
      (item) => selectedSuggestionItems[item.ingredientId] && item.recommendedOrderQuantity > 0
    );
    if (selectedList.length === 0) {
      alert("Vui lòng chọn ít nhất 1 mặt hàng có lượng đặt > 0.");
      return;
    }
    try {
      setLoading(true);
      await createTransferOrder({
        sourceWarehouseId: reorderSuggestions.recommendedWarehouseId || warehouses[0].id,
        destinationStoreId: suggestionsStoreId,
        notes: `Auto-PO: Tự động đề xuất đặt hàng theo chu kỳ ${planningHorizonDays} ngày (+ Lead time ${leadTimeDays} ngày)`,
        items: selectedList.map((item) => ({
          ingredientId: item.ingredientId,
          requestedQuantity: Math.ceil(item.recommendedOrderQuantity),
        })),
      });
      alert(`Đã khởi tạo thành công đơn đề xuất STO gồm ${selectedList.length} mặt hàng!`);
      setActiveTab("transfers");
      await loadData();
    } catch (err: any) {
      alert("Lỗi khi tạo đơn STO từ đề xuất: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchKpis = async (storeId?: string) => {
    try {
      setKpiLoading(true);
      const sid = storeId && storeId !== "ALL" ? storeId : undefined;
      const res = await api.getSupplyChainKpis(sid);
      setKpiSummary(res);
    } catch (err: any) {
      alert("Không thể tải báo cáo Lead-Time KPI: " + err.message);
    } finally {
      setKpiLoading(false);
    }
  };

  function renderStatusBadge(status: TransferStatus) {
    switch (status) {
      case "Draft":
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-600">Nháp (Draft)</span>;
      case "Submitted":
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-extrabold text-amber-700 ring-1 ring-amber-500/20">⏳ Chờ HQ Duyệt</span>;
      case "Approved":
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-extrabold text-blue-700 ring-1 ring-blue-500/20">✓ Đã Duyệt</span>;
      case "Rejected":
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-extrabold text-rose-700 ring-1 ring-rose-500/20">✕ Bị Từ Chối</span>;
      case "Dispatched":
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-extrabold text-purple-700 ring-1 ring-purple-500/20">🚚 Đang Vận Chuyển</span>;
      case "Received":
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700 ring-1 ring-emerald-500/20">★ Đã Nghiệm Thu</span>;
      case "DiscrepancyReported":
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-extrabold text-rose-800 ring-1 ring-rose-600/30">⚠️ Lệch / Hao Hụt</span>;
      case "Cancelled":
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-extrabold text-slate-700">Đã Hủy</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-600">{status}</span>;
    }
  }

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.2em] text-red-700">Enterprise Supply Chain</p>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 md:text-3xl">Trung Tâm Điều Chuyển Kho & STO</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
            Quản lý kho tổng trung tâm, theo dõi hành trình đơn luân chuyển hàng hóa và kiểm soát sai lệch hao hụt giữa HQ & Cửa hàng.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setActiveModal("create")}
            className="inline-flex items-center gap-2 rounded-xl bg-red-800 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-red-700 transition"
          >
            <Plus size={16} /> Tạo Đơn Đề Xuất (STO)
          </button>
          <button
            onClick={() => setActiveModal("inbound")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <PackagePlus size={16} /> Nhập Kho Tổng NCC
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Tổng Số Đơn STO</span>
            <span className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-600"><FileText size={18} /></span>
          </div>
          <div className="mt-3 text-2xl font-black text-slate-900">{kpis.total}</div>
          <span className="mt-1 block text-[11px] font-semibold text-slate-400">Toàn bộ vòng đời đơn</span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700">Chờ HQ Phê Duyệt</span>
            <span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-600"><Clock size={18} /></span>
          </div>
          <div className="mt-3 text-2xl font-black text-amber-900">{kpis.submitted}</div>
          <span className="mt-1 block text-[11px] font-semibold text-amber-600">Đơn hàng cần cấp phát</span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-700">Đang Vận Chuyển</span>
            <span className="grid size-9 place-items-center rounded-xl bg-purple-50 text-purple-600"><Truck size={18} /></span>
          </div>
          <div className="mt-3 text-2xl font-black text-purple-900">{kpis.dispatched}</div>
          <span className="mt-1 block text-[11px] font-semibold text-purple-600">Hàng trên đường giao</span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700">Lệch Kiểm Kê / Hỏng</span>
            <span className="grid size-9 place-items-center rounded-xl bg-rose-50 text-rose-600"><AlertTriangle size={18} /></span>
          </div>
          <div className="mt-3 text-2xl font-black text-rose-900">{kpis.discrepancy}</div>
          <span className="mt-1 block text-[11px] font-semibold text-rose-600">Cần đối soát biên bản</span>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          onClick={() => setActiveTab("transfers")}
          className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-bold transition ${
            activeTab === "transfers" ? "border-red-800 text-red-800" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <ArrowRightLeft size={16} /> Đơn Điều Chuyển Hàng (Stock Transfer Orders)
        </button>
        <button
          onClick={() => setActiveTab("warehouse")}
          className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-bold transition ${
            activeTab === "warehouse" ? "border-red-800 text-red-800" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Building2 size={16} /> Tồn Kho Tổng Trung Tâm HQ (Central Warehouse)
        </button>
        <button
          onClick={() => {
            setActiveTab("suggestions");
            if (!reorderSuggestions) {
              fetchSuggestions();
            }
          }}
          className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-bold transition ${
            activeTab === "suggestions" ? "border-red-800 text-red-800" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Sparkles size={16} className="text-amber-500" /> ✨ Tự Động Đề Xuất Đặt Hàng (Auto-PO)
          {reorderSuggestions && reorderSuggestions.itemsNeedingReorderCount > 0 && (
            <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black text-white">
              {reorderSuggestions.itemsNeedingReorderCount} cần đặt
            </span>
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab("analytics");
            if (!kpiSummary) {
              fetchKpis();
            }
          }}
          className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-bold transition ${
            activeTab === "analytics" ? "border-red-800 text-red-800" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <BarChart3 size={16} /> 📊 Phân Tích Chuỗi Cung Ứng & Lead-Time KPI
        </button>
      </div>

      {/* TAB 1: TRANSFERS LIST */}
      {activeTab === "transfers" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm mã đơn STO, vận đơn, tên cửa hàng..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-xs outline-none focus:border-red-800 focus:bg-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
              <span className="text-slate-400 mr-1 flex items-center gap-1"><Filter size={13} /> Lọc:</span>
              {["ALL", "Draft", "Submitted", "Approved", "Dispatched", "Received", "DiscrepancyReported"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-lg px-2.5 py-1 transition ${
                    statusFilter === s ? "bg-red-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {s === "ALL" ? "Tất cả" : s}
                </button>
              ))}
            </div>
          </div>

          {/* Orders Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Mã STO</th>
                    <th className="py-3.5 px-4">Nguồn xuất</th>
                    <th className="py-3.5 px-4">Điểm đến (Store)</th>
                    <th className="py-3.5 px-4">Trạng thái</th>
                    <th className="py-3.5 px-4">Vận đơn</th>
                    <th className="py-3.5 px-4">Số mặt hàng</th>
                    <th className="py-3.5 px-4">Thời gian</th>
                    <th className="py-3.5 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                        Không có đơn điều chuyển nào phù hợp.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{order.transferCode}</td>
                        <td className="py-3 px-4 text-slate-600">{order.sourceWarehouseName}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {order.destinationStoreName}
                          <span className="block font-mono text-[10px] text-slate-400">{order.destinationStoreCode}</span>
                        </td>
                        <td className="py-3 px-4">{renderStatusBadge(order.status)}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {order.dispatchTrackingNumber ? (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5">{order.dispatchTrackingNumber}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700">
                          {order.items.length} nguyên liệu
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {new Date(order.createdAt).toLocaleDateString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedOrder(order);
                                setActiveModal("detail");
                              }}
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                              title="Xem chi tiết"
                            >
                              <Eye size={15} />
                            </button>

                            {order.status === "Draft" && (
                              <button
                                onClick={() => handleSubmitOrder(order.id)}
                                className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-600 transition"
                                title="Gửi duyệt lên HQ"
                              >
                                <Send size={12} /> Gửi duyệt
                              </button>
                            )}

                            {order.status === "Submitted" && (
                              <button
                                onClick={() => handleOpenApprove(order)}
                                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-700 transition"
                                title="HQ Phê duyệt"
                              >
                                <Check size={12} /> Duyệt đơn
                              </button>
                            )}

                            {order.status === "Approved" && (
                              <button
                                onClick={() => handleOpenDispatch(order)}
                                className="inline-flex items-center gap-1 rounded-lg bg-purple-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-purple-700 transition"
                                title="Kho tổng xuất hàng"
                              >
                                <Truck size={12} /> Xuất kho
                              </button>
                            )}

                            {order.status === "Dispatched" && (
                              <button
                                onClick={() => handleOpenReceive(order)}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 transition"
                                title="Cửa hàng nghiệm thu nhận hàng"
                              >
                                <PackageCheck size={12} /> Nghiệm thu
                              </button>
                            )}

                            {order.status === "DiscrepancyReported" && (
                              <button
                                onClick={() => handleOpenResolve(order)}
                                className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-700 transition"
                                title="HQ xử lý biên bản lệch"
                              >
                                <CheckCircle2 size={12} /> Xử lý lệch
                              </button>
                            )}
                          </div>
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

      {/* TAB 2: CENTRAL WAREHOUSE INVENTORY */}
      {activeTab === "warehouse" && (
        <div className="space-y-4">
          {/* Warehouse Info Card */}
          {warehouses.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-red-700">HQ Central Hub</span>
                <h3 className="text-lg font-black text-slate-900">{warehouses[0].name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{warehouses[0].address} · Hotline: {warehouses[0].contactPhone}</p>
              </div>
              <button
                onClick={() => setActiveModal("inbound")}
                className="inline-flex items-center gap-2 rounded-xl bg-red-800 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition shrink-0"
              >
                <PackagePlus size={16} /> Nhập Hàng Từ Nhà Cung Cấp
              </button>
            </div>
          )}

          {/* Warehouse Inventory Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Mã SKU</th>
                  <th className="py-3 px-4">Tên nguyên liệu</th>
                  <th className="py-3 px-4">Đơn vị</th>
                  <th className="py-3 px-4">Tồn kho khả dụng</th>
                  <th className="py-3 px-4">Ngưỡng an toàn</th>
                  <th className="py-3 px-4">Giá tiêu chuẩn</th>
                  <th className="py-3 px-4">Tình trạng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {warehouseInventory.map((item) => {
                  const isLow = item.currentStock <= item.safetyStock;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{item.ingredientCode}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{item.ingredientName}</td>
                      <td className="py-3 px-4 text-slate-600">{item.unit}</td>
                      <td className="py-3 px-4 font-mono font-black text-slate-900 text-sm">
                        {item.currentStock.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">{item.safetyStock.toLocaleString()}</td>
                      <td className="py-3 px-4 font-mono text-slate-700">{item.unitCost.toLocaleString()}₫</td>
                      <td className="py-3 px-4">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-extrabold text-rose-700">
                            ⚠️ Cần nhập thêm
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
                            ✓ Đầy đủ
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: AUTO-PO & REORDER SUGGESTIONS */}
      {activeTab === "suggestions" && (
        <div className="space-y-5">
          {/* Controls Bar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
                  <Sparkles size={13} /> F&B Smart Demand Forecasting
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  Dự Trù & Đề Xuất Đặt Hàng Thông Minh (Auto-PO)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Phân tích lịch sử xuất bán 14 ngày, tính tốc độ tiêu hao/ngày kết hợp số ngày dự trù và thời gian giao hàng (Lead Time).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchSuggestions(suggestionsStoreId, planningHorizonDays, leadTimeDays)}
                  disabled={suggestionsLoading}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition disabled:opacity-50"
                >
                  <RefreshCcw size={14} className={suggestionsLoading ? "animate-spin text-amber-600" : ""} />
                  {suggestionsLoading ? "Đang tính toán..." : "Tính Lại Dự Báo"}
                </button>
                <button
                  onClick={handleCreatePoFromSuggestions}
                  disabled={suggestionsLoading || !reorderSuggestions || reorderSuggestions.suggestions.filter(i => selectedSuggestionItems[i.ingredientId] && i.recommendedOrderQuantity > 0).length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-800 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ShoppingCart size={15} /> 1-Click Tạo Đơn STO Tự Động
                </button>
              </div>
            </div>

            {/* Filter / Param Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-100 pt-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Cửa hàng cần dự trù tồn kho:</label>
                <select
                  value={suggestionsStoreId}
                  onChange={(e) => {
                    setSuggestionsStoreId(e.target.value);
                    fetchSuggestions(e.target.value, planningHorizonDays, leadTimeDays);
                  }}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs font-semibold outline-none focus:border-red-800"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Chu kỳ kế hoạch dự trù (Ngày):</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={planningHorizonDays}
                  onChange={(e) => setPlanningHorizonDays(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs font-semibold outline-none focus:border-red-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Thời gian giao hàng Lead Time (Ngày):</label>
                <input
                  type="number"
                  min={0}
                  max={14}
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs font-semibold outline-none focus:border-red-800"
                />
              </div>
            </div>
          </div>

          {/* Suggestions Summary Banner */}
          {reorderSuggestions && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
                <div className="text-[11px] font-black uppercase text-rose-700">Mặt hàng cấp bách (Critical)</div>
                <div className="mt-1 text-2xl font-black text-rose-900">
                  {reorderSuggestions.suggestions.filter(s => s.priority === "Critical").length} NL
                </div>
                <p className="text-[11px] text-rose-600 mt-0.5">Tồn kho âm hoặc đã cạn kiệt đáy kho</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="text-[11px] font-black uppercase text-amber-700">Cảnh báo chạm ngưỡng (Warning)</div>
                <div className="mt-1 text-2xl font-black text-amber-900">
                  {reorderSuggestions.suggestions.filter(s => s.priority === "Warning").length} NL
                </div>
                <p className="text-[11px] text-amber-600 mt-0.5">Dưới ngưỡng an toàn, nguy cơ thiếu nguyên liệu</p>
              </div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
                <div className="text-[11px] font-black uppercase text-blue-700">Tổng chi phí dự toán (Est. Cost)</div>
                <div className="mt-1 text-2xl font-black text-blue-900">
                  {reorderSuggestions.suggestions
                    .filter((i) => selectedSuggestionItems[i.ingredientId])
                    .reduce((sum, i) => sum + i.estimatedTotalCost, 0)
                    .toLocaleString()}₫
                </div>
                <p className="text-[11px] text-blue-600 mt-0.5">Dựa trên đơn giá tiêu chuẩn kho tổng</p>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="select-all-suggestions"
                  checked={
                    reorderSuggestions?.suggestions.filter((i) => i.recommendedOrderQuantity > 0).length
                      ? reorderSuggestions.suggestions
                          .filter((i) => i.recommendedOrderQuantity > 0)
                          .every((i) => selectedSuggestionItems[i.ingredientId])
                      : false
                  }
                  onChange={(e) => {
                    const checked = e.target.checked;
                    const map: { [id: string]: boolean } = {};
                    reorderSuggestions?.suggestions.forEach((i) => {
                      if (i.recommendedOrderQuantity > 0) {
                        map[i.ingredientId] = checked;
                      }
                    });
                    setSelectedSuggestionItems(map);
                  }}
                  className="rounded text-red-800 focus:ring-red-800"
                />
                <label htmlFor="select-all-suggestions" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Chọn tất cả các món cần đặt hàng
                </label>
              </div>
              <span className="text-[11px] font-semibold text-slate-400">
                {reorderSuggestions?.suggestions.length || 0} nguyên liệu được phân tích
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 w-10 text-center">Chọn</th>
                    <th className="py-3 px-4">Mã NL</th>
                    <th className="py-3 px-4">Tên nguyên liệu</th>
                    <th className="py-3 px-4">Đơn vị</th>
                    <th className="py-3 px-4 text-right">Tồn hiện tại</th>
                    <th className="py-3 px-4 text-right">Tiêu hao / ngày</th>
                    <th className="py-3 px-4 text-right">Mức tối thiểu</th>
                    <th className="py-3 px-4 text-right font-black text-red-900">Đề xuất đặt (Auto-PO)</th>
                    <th className="py-3 px-4 text-right">Dự toán chi phí</th>
                    <th className="py-3 px-4 text-center">Mức ưu tiên</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reorderSuggestions && reorderSuggestions.suggestions.length > 0 ? (
                    reorderSuggestions.suggestions.map((item) => {
                      const isSelected = !!selectedSuggestionItems[item.ingredientId];
                      const isReorderNeeded = item.recommendedOrderQuantity > 0;
                      return (
                        <tr
                          key={item.ingredientId}
                          className={`hover:bg-slate-50/60 transition ${
                            isSelected && isReorderNeeded ? "bg-amber-50/30" : ""
                          }`}
                        >
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!isReorderNeeded}
                              onChange={(e) => {
                                setSelectedSuggestionItems({
                                  ...selectedSuggestionItems,
                                  [item.ingredientId]: e.target.checked,
                                });
                              }}
                              className="rounded text-red-800 focus:ring-red-800 disabled:opacity-30"
                            />
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">{item.ingredientCode}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">{item.ingredientName}</td>
                          <td className="py-3 px-4 text-slate-500">{item.unit}</td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-800 text-right">
                            {item.currentStock.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600 text-right">
                            {item.averageDailyConsumption.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600 text-right">
                            {item.minAlertThreshold.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 font-mono font-black text-red-800 text-right text-sm">
                            {item.recommendedOrderQuantity > 0 ? (
                              `+${item.recommendedOrderQuantity.toLocaleString()}`
                            ) : (
                              <span className="text-slate-400 font-normal">0</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-800 text-right">
                            {item.estimatedTotalCost.toLocaleString()}₫
                          </td>
                          <td className="py-3 px-4 text-center">
                            {item.priority === "Critical" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-black text-rose-800 ring-1 ring-rose-600/20">
                                🚨 Khẩn cấp
                              </span>
                            )}
                            {item.priority === "Warning" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-amber-600/20">
                                ⚠️ Cảnh báo
                              </span>
                            )}
                            {item.priority === "Normal" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                ✓ Ổn định
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        {suggestionsLoading ? "Đang tính toán đề xuất..." : "Chưa có dữ liệu đề xuất hoặc không có nguyên liệu."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SUPPLY CHAIN & LEAD-TIME KPI ANALYTICS */}
      {activeTab === "analytics" && (
        <div className="space-y-5">
          {/* Controls Bar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
                  <BarChart3 size={13} /> Supply Chain SLA & Lead-Time Intelligence
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  Phân Tích Vòng Đời Đơn Điều Chuyển (Lead-Time KPI)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đo lường thời gian xử lý: Trình duyệt &rarr; Phê duyệt &rarr; Xuất kho tổng &rarr; Vận chuyển (Transit) &rarr; Nghiệm thu tại cửa hàng.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchKpis(kpiStoreFilter)}
                  disabled={kpiLoading}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition disabled:opacity-50"
                >
                  <RefreshCcw size={14} className={kpiLoading ? "animate-spin text-purple-600" : ""} />
                  {kpiLoading ? "Đang tính..." : "Cập Nhật KPI"}
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
              <div className="w-full sm:w-72">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Lọc theo chi nhánh:</label>
                <select
                  value={kpiStoreFilter}
                  onChange={(e) => {
                    setKpiStoreFilter(e.target.value);
                    fetchKpis(e.target.value);
                  }}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs font-semibold outline-none focus:border-red-800"
                >
                  <option value="ALL">Toàn Bộ Hệ Thống (All Stores)</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* KPI Stat Cards */}
          {kpiSummary && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Tỷ Lệ Giao Đúng Hạn (SLA)</span>
                  <span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 size={18} /></span>
                </div>
                <div className="mt-3 text-2xl font-black text-emerald-700">{kpiSummary.overallOnTimeDeliveryRate}%</div>
                <span className="mt-1 block text-[11px] font-semibold text-slate-400">Cam kết giao nhận &le; 48 giờ</span>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Thời Gian Vận Chuyển TB</span>
                  <span className="grid size-9 place-items-center rounded-xl bg-purple-50 text-purple-600"><Truck size={18} /></span>
                </div>
                <div className="mt-3 text-2xl font-black text-purple-900">{kpiSummary.systemAvgTransitHours}h</div>
                <span className="mt-1 block text-[11px] font-semibold text-purple-600">Từ kho tổng tới cửa hàng</span>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Tổng Vòng Đời Đơn TB</span>
                  <span className="grid size-9 place-items-center rounded-xl bg-blue-50 text-blue-600"><Timer size={18} /></span>
                </div>
                <div className="mt-3 text-2xl font-black text-blue-900">{kpiSummary.systemAvgTotalCycleHours}h</div>
                <span className="mt-1 block text-[11px] font-semibold text-blue-600">Từ tạo đơn tới hoàn tất</span>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Tỷ Lệ Đơn Có Sai Lệch</span>
                  <span className="grid size-9 place-items-center rounded-xl bg-rose-50 text-rose-600"><AlertTriangle size={18} /></span>
                </div>
                <div className="mt-3 text-2xl font-black text-rose-900">{kpiSummary.discrepancyRatePercentage}%</div>
                <span className="mt-1 block text-[11px] font-semibold text-rose-600">{kpiSummary.discrepancyReportedCount} đơn lệch / {kpiSummary.totalOrdersCreated} đơn</span>
              </div>
            </div>
          )}

          {/* Store Lead-Time Comparison Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Timer size={15} className="text-red-700" /> Bảng Đối Soát Hiệu Suất & Lead-Time Theo Chi Nhánh
              </h4>
              <span className="text-[11px] font-semibold text-slate-400">
                {kpiSummary?.storeKpis.length || 0} chi nhánh được theo dõi
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Mã Store</th>
                    <th className="py-3 px-4">Tên chi nhánh</th>
                    <th className="py-3 px-4 text-center">Tổng đơn</th>
                    <th className="py-3 px-4 text-center">Hoàn tất</th>
                    <th className="py-3 px-4 text-right">Duyệt (h)</th>
                    <th className="py-3 px-4 text-right">Xuất kho (h)</th>
                    <th className="py-3 px-4 text-right">Vận chuyển (h)</th>
                    <th className="py-3 px-4 text-right font-black text-purple-900">Tổng chu kỳ (h)</th>
                    <th className="py-3 px-4 text-center font-black text-emerald-900">Đúng hạn SLA</th>
                    <th className="py-3 px-4 text-center">Đơn lệch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {kpiSummary && kpiSummary.storeKpis.length > 0 ? (
                    kpiSummary.storeKpis.map((kpi) => (
                      <tr key={kpi.storeId} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{kpi.storeCode}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{kpi.storeName}</td>
                        <td className="py-3 px-4 text-center font-bold text-slate-700">{kpi.totalOrders}</td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-700">{kpi.completedOrders}</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">{kpi.avgApprovalHours}h</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">{kpi.avgDispatchHours}h</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">{kpi.avgTransitHours}h</td>
                        <td className="py-3 px-4 text-right font-mono font-black text-purple-900">{kpi.avgTotalCycleHours}h</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                            kpi.onTimeDeliveryRate >= 90
                              ? "bg-emerald-100 text-emerald-800"
                              : kpi.onTimeDeliveryRate >= 75
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}>
                            {kpi.onTimeDeliveryRate}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {kpi.discrepancyOrdersCount > 0 ? (
                            <span className="font-bold text-rose-700">{kpi.discrepancyOrdersCount}</span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        {kpiLoading ? "Đang tổng hợp báo cáo hiệu suất..." : "Chưa có dữ liệu vòng đời đơn STO."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE TRANSFER ORDER */}
      {activeModal === "create" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Plus size={18} className="text-red-700" /> Tạo Đề Xuất Điều Chuyển Hàng (STO)
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cửa hàng nhận hàng:</label>
                <select
                  value={createStoreId}
                  onChange={(e) => setCreateStoreId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-red-800"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú yêu cầu:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Nhập bổ sung cà phê và sữa cho tuần cao điểm..."
                  value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-red-800"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-700">Danh sách nguyên vật liệu cần nhập:</label>
                  <button
                    type="button"
                    onClick={() => setCreateItems([...createItems, { ingredientId: ingredients[0]?.id || "44444444-4444-4444-4444-444444444441", quantity: 5000 }])}
                    className="text-xs font-bold text-red-700 hover:underline flex items-center gap-1"
                  >
                    <Plus size={13} /> Thêm dòng
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {createItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <select
                        value={item.ingredientId}
                        onChange={(e) => {
                          const updated = [...createItems];
                          updated[idx].ingredientId = e.target.value;
                          setCreateItems(updated);
                        }}
                        className="flex-1 rounded-lg border border-slate-200 p-1.5 text-xs"
                      >
                        {ingredients.length > 0 ? (
                          ingredients.map((ing) => (
                            <option key={ing.id} value={ing.id}>
                              {ing.name} ({ing.code} - {ing.unit})
                            </option>
                          ))
                        ) : (
                          <option value="44444444-4444-4444-4444-444444444441">Arabica Coffee Beans (BEAN-ARA)</option>
                        )}
                      </select>
                      <input
                        type="number"
                        placeholder="Số lượng"
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...createItems];
                          updated[idx].quantity = Number(e.target.value);
                          setCreateItems(updated);
                        }}
                        className="w-28 rounded-lg border border-slate-200 p-1.5 text-xs text-right"
                      />
                      <button
                        type="button"
                        onClick={() => setCreateItems(createItems.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4 bg-slate-50">
              <button onClick={() => setActiveModal(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700">Hủy</button>
              <button onClick={handleExecuteCreate} className="rounded-xl bg-red-800 px-4 py-2 text-xs font-bold text-white hover:bg-red-700">Tạo Đơn Nháp</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: APPROVE TRANSFER ORDER */}
      {activeModal === "approve" && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Check size={18} className="text-blue-600" /> Phê Duyệt Cấp Hàng STO: {selectedOrder.transferCode}
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs text-blue-900">
                HQ Supply Chain xem xét định lượng yêu cầu và kiểm tra lượng tồn khả dụng tại kho tổng trước khi duyệt.
              </div>
              <div className="space-y-3">
                {selectedOrder.items.map((i) => (
                  <div key={i.ingredientId} className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">{i.ingredientName}</span>
                      <span className="text-[11px] text-slate-500">Đề xuất: {i.requestedQuantity.toLocaleString()} {i.unit}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-600">Duyệt cấp:</span>
                      <input
                        type="number"
                        value={approveItems[i.ingredientId] ?? i.requestedQuantity}
                        onChange={(e) => setApproveItems({ ...approveItems, [i.ingredientId]: Number(e.target.value) })}
                        className="w-24 rounded-lg border border-slate-200 p-1.5 text-xs text-right font-bold"
                      />
                      <span className="text-xs text-slate-500">{i.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú phê duyệt:</label>
                <input
                  type="text"
                  placeholder="Ghi chú xuất kho..."
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4 bg-slate-50">
              <button onClick={() => setActiveModal(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700">Hủy</button>
              <button onClick={handleExecuteApprove} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700">Xác Nhận Phê Duyệt</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DISPATCH TRANSFER ORDER */}
      {activeModal === "dispatch" && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Truck size={18} className="text-purple-600" /> Xuất Kho Giao Hàng STO
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-xl bg-purple-50 border border-purple-100 p-3 text-xs text-purple-900">
                Khi bấm Xuất kho, hệ thống sẽ tự động <b>khấu trừ tồn kho thực tế</b> tại Kho Tổng và chuyển hàng vào trạng thái đang vận chuyển (In-Transit).
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mã Vận Đơn (Tracking Number):</label>
                <input
                  type="text"
                  value={dispatchTracking}
                  onChange={(e) => setDispatchTracking(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono font-bold outline-none focus:border-purple-600"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú giao nhận:</label>
                <input
                  type="text"
                  placeholder="Tên tài xế, biển số xe..."
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4 bg-slate-50">
              <button onClick={() => setActiveModal(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700">Hủy</button>
              <button onClick={handleExecuteDispatch} className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700">Xác Nhận Xuất Kho</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: RECEIVE & INSPECTION TRANSFER ORDER */}
      {activeModal === "receive" && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <PackageCheck size={18} className="text-emerald-600" /> Nghiệm Thu Nhập Kho: {selectedOrder.transferCode}
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-xs text-emerald-900">
                Nhân viên cửa hàng đếm thực tế số lượng hàng nhập. Nếu phát hiện thiếu hụt/hư hỏng, hệ thống sẽ tự động tạo biên bản sai lệch (Discrepancy).
              </div>
              <div className="space-y-3">
                {selectedOrder.items.map((i) => {
                  const actual = receiveItems[i.ingredientId] ?? i.approvedQuantity;
                  const diff = i.approvedQuantity - actual;
                  return (
                    <div key={i.ingredientId} className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                      <div>
                        <span className="font-bold text-xs text-slate-900 block">{i.ingredientName}</span>
                        <span className="text-[11px] text-slate-500">HQ xuất: {i.approvedQuantity.toLocaleString()} {i.unit}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-600">Thực nhận:</span>
                        <input
                          type="number"
                          value={actual}
                          onChange={(e) => setReceiveItems({ ...receiveItems, [i.ingredientId]: Number(e.target.value) })}
                          className="w-24 rounded-lg border border-slate-200 p-1.5 text-xs text-right font-bold"
                        />
                        <span className="text-xs text-slate-500">{i.unit}</span>
                        {diff !== 0 && (
                          <span className="text-[10px] font-extrabold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                            Lệch: {diff > 0 ? `-${diff}` : `+${Math.abs(diff)}`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Biên bản ghi chú kiểm kê (Inspection Notes):</label>
                <input
                  type="text"
                  placeholder="Ghi chú tình trạng hàng hóa khi mở thùng..."
                  value={receiveInspectionNotes}
                  onChange={(e) => setReceiveInspectionNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4 bg-slate-50">
              <button onClick={() => setActiveModal(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700">Hủy</button>
              <button onClick={handleExecuteReceive} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700">Hoàn Tất Nhập Kho</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: RESOLVE DISCREPANCY */}
      {activeModal === "resolve" && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <AlertTriangle size={18} className="text-rose-600" /> Xử Lý Lệch Kho STO: {selectedOrder.transferCode}
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-xs text-rose-900">
                <b>Ghi chú chi nhánh:</b> {selectedOrder.discrepancyNotes || "Chưa có ghi chú"}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phương án xử lý hao hụt của HQ:</label>
                <textarea
                  rows={3}
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs outline-none focus:border-red-800"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4 bg-slate-50">
              <button onClick={() => setActiveModal(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700">Hủy</button>
              <button onClick={handleExecuteResolve} className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700">Đóng Biên Bản</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: SUPPLIER INBOUND */}
      {activeModal === "inbound" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <PackagePlus size={18} className="text-red-700" /> Nhập Hàng Từ Nhà Cung Cấp
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mã Nhà Cung Cấp:</label>
                <input
                  type="text"
                  value={inboundSupplierCode}
                  onChange={(e) => setInboundSupplierCode(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Số Hóa Đơn / Mã PO:</label>
                <input
                  type="text"
                  value={inboundRef}
                  onChange={(e) => setInboundRef(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs font-mono outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nguyên liệu:</label>
                  <select
                    value={inboundIngId}
                    onChange={(e) => setInboundIngId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs outline-none"
                  >
                    {ingredients.length > 0 ? (
                      ingredients.map((ing) => (
                        <option key={ing.id} value={ing.id}>
                          {ing.name} ({ing.code} - {ing.unit})
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="44444444-4444-4444-4444-444444444441">Arabica Coffee Beans (BEAN-ARA - gram)</option>
                        <option value="44444444-4444-4444-4444-444444444442">Black Tapioca Pearl (PEARL-01 - gram)</option>
                        <option value="44444444-4444-4444-4444-444444444443">Oat Milk Barista (MILK-OW - ml)</option>
                        <option value="44444444-4444-4444-4444-444444444445">Sen Dried Tea Leaves (TEA-SEN - gram)</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số lượng:</label>
                  <input
                    type="number"
                    value={inboundQty}
                    onChange={(e) => setInboundQty(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-right outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Đơn giá nhập kho (₫/đv):</label>
                <input
                  type="number"
                  value={inboundCost}
                  onChange={(e) => setInboundCost(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs text-right outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4 bg-slate-50">
              <button onClick={() => setActiveModal(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700">Hủy</button>
              <button onClick={handleExecuteInbound} className="rounded-xl bg-red-800 px-4 py-2 text-xs font-bold text-white hover:bg-red-700">Xác Nhận Nhập Kho</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: DETAIL MODAL */}
      {activeModal === "detail" && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <span className="text-[10px] font-mono text-slate-400">CHI TIẾT ĐƠN ĐIỀU CHUYỂN</span>
                <h3 className="text-base font-black text-slate-900">{selectedOrder.transferCode}</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold">Trạng thái</span>
                  <div className="mt-1">{renderStatusBadge(selectedOrder.status)}</div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold">Chi nhánh nhận</span>
                  <span className="font-bold text-slate-800 mt-1 block">{selectedOrder.destinationStoreName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold">Mã Vận đơn</span>
                  <span className="font-mono text-slate-800 mt-1 block">{selectedOrder.dispatchTrackingNumber || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold">Ngày lập</span>
                  <span className="text-slate-800 mt-1 block">{new Date(selectedOrder.createdAt).toLocaleDateString("vi-VN")}</span>
                </div>
              </div>

              {selectedOrder.discrepancyNotes && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-900">
                  <b>Biên bản sai lệch / Ghi chú kiểm kê:</b> {selectedOrder.discrepancyNotes}
                </div>
              )}

              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 text-slate-500 font-bold">
                  <tr>
                    <th className="pb-2">Nguyên liệu</th>
                    <th className="pb-2 text-right">Yêu cầu</th>
                    <th className="pb-2 text-right">Duyệt</th>
                    <th className="pb-2 text-right">Thực nhận</th>
                    <th className="pb-2 text-right">Lệch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedOrder.items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2 font-bold text-slate-800">{it.ingredientName}</td>
                      <td className="py-2 text-right font-mono">{it.requestedQuantity.toLocaleString()} {it.unit}</td>
                      <td className="py-2 text-right font-mono">{it.approvedQuantity.toLocaleString()} {it.unit}</td>
                      <td className="py-2 text-right font-mono font-bold text-emerald-700">{it.actualReceivedQuantity.toLocaleString()} {it.unit}</td>
                      <td className={`py-2 text-right font-mono font-bold ${it.discrepancyQuantity !== 0 ? "text-rose-600" : "text-slate-400"}`}>
                        {it.discrepancyQuantity.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end border-t border-slate-100 px-6 py-4 bg-slate-50">
              <button onClick={() => setActiveModal(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700">Đóng</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
