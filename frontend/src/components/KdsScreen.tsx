import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Bell,
  BellOff,
  Check,
  CheckCircle2,
  Clock,
  Coffee,
  Flame,
  LayoutGrid,
  RefreshCcw,
  Sparkles,
  Store,
  Timer,
  Trash2,
  UserCheck,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import {
  kdsService,
  type KitchenTicketDto,
  type KitchenTicketStatus,
} from "../services/kds.ts";
import { realtimeHub } from "../services/signalr.ts";
import { type User } from "../services/auth.ts";

interface KdsScreenProps {
  currentUser: User | null;
}

// Fallback initial tickets for demonstration if offline
const mockInitialTickets: KitchenTicketDto[] = [
  {
    id: "90000000-0000-0000-0000-000000000001",
    ticketNumber: "KDS-202610-0012",
    orderId: "80000000-0000-0000-0000-000000000001",
    storeId: "11111111-1111-1111-1111-111111111111",
    orderNumber: "ORD-202610-0042",
    orderType: "DineIn",
    status: "InPreparation",
    targetPreparationSeconds: 300,
    createdAt: new Date(Date.now() - 140 * 1000).toISOString(),
    preparationStartedAt: new Date(Date.now() - 130 * 1000).toISOString(),
    elapsedSeconds: 130,
    slaStatus: "Healthy",
    items: [
      {
        id: "item-101",
        orderItemId: "oi-101",
        productName: "Trà Sen Vàng (Củ Năng)",
        quantity: 2,
        specialNote: "Ít đường 50%, nhiều đá",
        isPrepared: false,
        modifiers: [
          { id: "mod-101", modifierName: "Thêm Hạt Sen", isChecked: true },
          { id: "mod-102", modifierName: "Thêm Củ Năng Giòn", isChecked: false },
        ],
      },
      {
        id: "item-102",
        orderItemId: "oi-102",
        productName: "Phin Sữa Đá Đậm Đà",
        quantity: 1,
        specialNote: "Nhiều sữa đặc",
        isPrepared: true,
        modifiers: [
          { id: "mod-103", modifierName: "Thêm Kem Cheese", isChecked: true },
        ],
      },
    ],
  },
  {
    id: "90000000-0000-0000-0000-000000000002",
    ticketNumber: "KDS-202610-0013",
    orderId: "80000000-0000-0000-0000-000000000002",
    storeId: "11111111-1111-1111-1111-111111111111",
    orderNumber: "ORD-202610-0043",
    orderType: "TakeAway",
    status: "New",
    targetPreparationSeconds: 300,
    createdAt: new Date(Date.now() - 45 * 1000).toISOString(),
    elapsedSeconds: 45,
    slaStatus: "Healthy",
    items: [
      {
        id: "item-201",
        orderItemId: "oi-201",
        productName: "Freeze Trà Xanh Matcha",
        quantity: 1,
        specialNote: "Kèm thìa muỗng mang về",
        isPrepared: false,
        modifiers: [
          { id: "mod-201", modifierName: "Thêm Thạch Trà Xanh", isChecked: false },
          { id: "mod-202", modifierName: "Gấp Đôi Whipping Cream", isChecked: false },
        ],
      },
    ],
  },
  {
    id: "90000000-0000-0000-0000-000000000003",
    ticketNumber: "KDS-202610-0010",
    orderId: "80000000-0000-0000-0000-000000000003",
    storeId: "11111111-1111-1111-1111-111111111111",
    orderNumber: "ORD-202610-0039",
    orderType: "Delivery",
    status: "Ready",
    targetPreparationSeconds: 300,
    createdAt: new Date(Date.now() - 280 * 1000).toISOString(),
    preparationStartedAt: new Date(Date.now() - 260 * 1000).toISOString(),
    readyAt: new Date(Date.now() - 20 * 1000).toISOString(),
    elapsedSeconds: 260,
    slaStatus: "Warning",
    items: [
      {
        id: "item-301",
        orderItemId: "oi-301",
        productName: "Cà Phê Muối Huê",
        quantity: 2,
        specialNote: "Đóng màng seal cẩn thận giao Grab",
        isPrepared: true,
        modifiers: [],
      },
    ],
  },
];

const availableStores = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Highlands Lê Lợi Q1", code: "HL-01" },
  { id: "22222222-2222-2222-2222-222222222222", name: "Highlands Landmark 81", code: "HL-02" },
  { id: "33333333-3333-3333-3333-333333333333", name: "Heritage Bạch Đằng", code: "DN-04" },
  { id: "44444444-4444-4444-4444-444444444444", name: "Heritage Hồ Gươm", code: "HN-07" },
];

export function KdsScreen({ currentUser }: KdsScreenProps) {
  const [selectedStoreId, setSelectedStoreId] = useState<string>(
    currentUser?.storeId || availableStores[0].id
  );
  const [tickets, setTickets] = useState<KitchenTicketDto[]>(mockInitialTickets);
  const [loading, setLoading] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [filterView, setFilterView] = useState<"all" | "prep" | "ready">("all");
  const [cancelModalTicket, setCancelModalTicket] = useState<KitchenTicketDto | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);

  // Web Audio chime generator
  const audioContextRef = useRef<AudioContext | null>(null);

  const playChime = () => {
    if (!audioEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContextRef.current || audioContextRef.current.state === "suspended") {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      const now = ctx.currentTime;

      // Bell chime tone 1: D5 (587.33 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.4);

      // Bell chime tone 2: A5 (880 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, now + 0.12);
      gain2.gain.setValueAtTime(0.25, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.8);
    } catch {
      // AudioContext muted or blocked by browser policy until gesture
    }
  };

  // Fetch active tickets from backend
  const fetchTickets = async () => {
    setLoading(true);
    try {
      const data = await kdsService.getActiveTickets(selectedStoreId);
      if (data && data.length > 0) {
        setTickets(data);
      }
    } catch {
      // Keep existing mock / cached tickets if backend unavailable
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [selectedStoreId]);

  // Join SignalR Store Group & listen for KDS real-time events
  useEffect(() => {
    realtimeHub.joinStore(selectedStoreId);

    const unsubCreated = realtimeHub.onKitchenTicketCreated((newTicket) => {
      if (newTicket.storeId === selectedStoreId) {
        setTickets((prev) => {
          if (prev.some((t) => t.id === newTicket.id)) return prev;
          return [newTicket, ...prev];
        });
        playChime();
      }
    });

    const unsubStatus = realtimeHub.onKitchenTicketStatusChanged((data) => {
      if (data.storeId === selectedStoreId) {
        setTickets((prev) => {
          if (data.status === "Completed" || data.status === "Cancelled") {
            return prev.filter((t) => t.id !== data.ticketId);
          }
          return prev.map((t) =>
            t.id === data.ticketId
              ? {
                  ...t,
                  status: data.status as KitchenTicketStatus,
                  preparationStartedAt: data.status === "InPreparation" ? new Date().toISOString() : t.preparationStartedAt,
                  readyAt: data.status === "Ready" ? new Date().toISOString() : t.readyAt,
                }
              : t
          );
        });
      }
    });

    const unsubItemToggled = realtimeHub.onKitchenTicketItemToggled((data) => {
      if (data.storeId === selectedStoreId) {
        setTickets((prev) =>
          prev.map((t) => {
            if (t.id !== data.ticketId) return t;
            return {
              ...t,
              items: t.items.map((item) =>
                item.id === data.itemId ? { ...item, isPrepared: data.isPrepared } : item
              ),
            };
          })
        );
      }
    });

    return () => {
      unsubCreated();
      unsubStatus();
      unsubItemToggled();
      realtimeHub.leaveStore(selectedStoreId);
    };
  }, [selectedStoreId, audioEnabled]);

  // SLA Live Timer: update elapsed seconds every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTickets((prev) =>
        prev.map((ticket) => {
          const startTime = ticket.preparationStartedAt || ticket.createdAt;
          const elapsed = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
          const positiveElapsed = Math.max(0, elapsed);
          let sla: "Healthy" | "Warning" | "Critical" | "Completed" = "Healthy";
          if (ticket.status === "Completed") {
            sla = "Completed";
          } else if (positiveElapsed > ticket.targetPreparationSeconds) {
            sla = "Critical";
          } else if (positiveElapsed > 180) {
            sla = "Warning";
          }
          return {
            ...ticket,
            elapsedSeconds: positiveElapsed,
            slaStatus: sla,
          };
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Action handlers
  const handleStartPrep = async (ticket: KitchenTicketDto) => {
    setSubmittingAction(`start-${ticket.id}`);
    try {
      const updated = await kdsService.startPreparation(selectedStoreId, ticket.id);
      setTickets((prev) => prev.map((t) => (t.id === ticket.id ? updated : t)));
    } catch {
      // Optimistic fallback
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticket.id
            ? {
                ...t,
                status: "InPreparation",
                preparationStartedAt: new Date().toISOString(),
                elapsedSeconds: 0,
              }
            : t
        )
      );
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleToggleItem = async (ticketId: string, itemId: string) => {
    try {
      const updated = await kdsService.toggleItemPrepared(selectedStoreId, ticketId, itemId);
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? updated : t)));
    } catch {
      // Optimistic local toggle
      setTickets((prev) =>
        prev.map((t) => {
          if (t.id !== ticketId) return t;
          return {
            ...t,
            items: t.items.map((i) =>
              i.id === itemId ? { ...i, isPrepared: !i.isPrepared } : i
            ),
          };
        })
      );
    }
  };

  const handleToggleModifier = async (ticketId: string, modifierId: string) => {
    try {
      const updated = await kdsService.toggleModifierChecked(selectedStoreId, ticketId, modifierId);
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? updated : t)));
    } catch {
      // Optimistic local toggle
      setTickets((prev) =>
        prev.map((t) => {
          if (t.id !== ticketId) return t;
          return {
            ...t,
            items: t.items.map((i) => ({
              ...i,
              modifiers: i.modifiers.map((m) =>
                m.id === modifierId ? { ...m, isChecked: !m.isChecked } : m
              ),
            })),
          };
        })
      );
    }
  };

  const handleMarkReady = async (ticket: KitchenTicketDto) => {
    setSubmittingAction(`ready-${ticket.id}`);
    try {
      const updated = await kdsService.markReady(selectedStoreId, ticket.id);
      setTickets((prev) => prev.map((t) => (t.id === ticket.id ? updated : t)));
      playChime();
    } catch {
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticket.id
            ? {
                ...t,
                status: "Ready",
                readyAt: new Date().toISOString(),
              }
            : t
        )
      );
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleComplete = async (ticket: KitchenTicketDto) => {
    setSubmittingAction(`complete-${ticket.id}`);
    try {
      await kdsService.completeTicket(selectedStoreId, ticket.id);
      setTickets((prev) => prev.filter((t) => t.id !== ticket.id));
    } catch {
      setTickets((prev) => prev.filter((t) => t.id !== ticket.id));
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalTicket || !cancelReason.trim()) return;
    setSubmittingAction(`cancel-${cancelModalTicket.id}`);
    try {
      await kdsService.cancelTicket(selectedStoreId, cancelModalTicket.id, cancelReason);
      setTickets((prev) => prev.filter((t) => t.id !== cancelModalTicket.id));
      setCancelModalTicket(null);
      setCancelReason("");
    } catch {
      setTickets((prev) => prev.filter((t) => t.id !== cancelModalTicket.id));
      setCancelModalTicket(null);
      setCancelReason("");
    } finally {
      setSubmittingAction(null);
    }
  };

  // Group tickets into 3 stages
  const newTickets = useMemo(() => tickets.filter((t) => t.status === "New"), [tickets]);
  const inPrepTickets = useMemo(() => tickets.filter((t) => t.status === "InPreparation"), [tickets]);
  const readyTickets = useMemo(() => tickets.filter((t) => t.status === "Ready"), [tickets]);

  // Format stopwatch MM:SS
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8 space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-amber-600 text-white shadow-md shadow-red-500/20">
            <Coffee size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-slate-900 md:text-2xl">
                Kitchen Display System (KDS)
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Barista Queue
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500">
              Điều phối chế biến đồ uống thời gian thực · Cảnh báo SLA 5 phút · Tự động đồng bộ POS & SignalR
            </p>
          </div>
        </div>

        {/* Controls: Store Selector, Sound Toggle, Refresh */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Store select */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
            <Store size={14} className="text-slate-400" />
            <select
              aria-label="Chọn chi nhánh pha chế"
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="bg-transparent font-bold text-slate-800 outline-none"
            >
              {availableStores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} - {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => {
              setAudioEnabled(!audioEnabled);
              if (!audioEnabled) playChime();
            }}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
              audioEnabled
                ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                : "border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
            title={audioEnabled ? "Tắt âm thanh thông báo" : "Bật âm thanh chuông báo"}
          >
            {audioEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            {audioEnabled ? "Âm chuông: Bật" : "Âm chuông: Tắt"}
          </button>

          {/* Refresh */}
          <button
            onClick={fetchTickets}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCcw size={14} className={loading ? "animate-spin text-red-600" : ""} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Metric Counters & View Filter Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Đang phục vụ</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <LayoutGrid size={14} />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{tickets.length}</div>
          <div className="mt-0.5 text-[11px] text-slate-500">Tổng vé active</div>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">Chờ tiếp nhận</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              <Bell size={14} />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-indigo-900">{newTickets.length}</div>
          <div className="mt-0.5 text-[11px] text-indigo-600 font-medium">Chưa bắt đầu pha chế</div>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Đang pha chế</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Flame size={14} />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-900">{inPrepTickets.length}</div>
          <div className="mt-0.5 text-[11px] text-amber-600 font-medium">Đang tính giờ SLA</div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Chờ trả khách</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <CheckCircle2 size={14} />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-900">{readyTickets.length}</div>
          <div className="mt-0.5 text-[11px] text-emerald-600 font-medium">Pha xong, chờ gọi số</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex gap-2">
          <button
            onClick={() => setFilterView("all")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition-colors ${
              filterView === "all"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Toàn bộ bảng ({tickets.length})
          </button>
          <button
            onClick={() => setFilterView("prep")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition-colors ${
              filterView === "prep"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-amber-50 text-amber-800 hover:bg-amber-100"
            }`}
          >
            Quầy Barista ({newTickets.length + inPrepTickets.length})
          </button>
          <button
            onClick={() => setFilterView("ready")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition-colors ${
              filterView === "ready"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            }`}
          >
            Quầy Trả Đồ ({readyTickets.length})
          </button>
        </div>

        <span className="text-xs font-bold text-slate-400">
          Chạm vào thẻ hoặc topping để tương tác cảm ứng
        </span>
      </div>

      {/* Kanban Board 3 Columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Column 1: Chờ làm (New) */}
        {(filterView === "all" || filterView === "prep") && (
          <div className="flex flex-col gap-3 rounded-2xl bg-slate-100/70 p-3.5">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-indigo-500" />
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                  1. Chờ tiếp nhận ({newTickets.length})
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-slate-500">Mới nhận từ POS</span>
            </div>

            {newTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/50 p-8 text-center text-slate-400">
                <Sparkles size={28} className="mb-2 text-slate-300" />
                <p className="text-xs font-bold">Không có vé mới</p>
                <p className="text-[11px]">Đơn mới từ quầy POS sẽ tự động nhảy vào đây</p>
              </div>
            ) : (
              newTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="group flex flex-col justify-between rounded-xl border border-indigo-200/80 bg-white p-4 shadow-sm transition-all hover:shadow-md"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between border-b border-slate-100 pb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-black text-indigo-900">
                            {ticket.ticketNumber}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            #{ticket.orderNumber}
                          </span>
                        </div>
                        <span className="text-[11px] font-medium text-slate-400">
                          {ticket.orderType === "DineIn"
                            ? "Tại bàn"
                            : ticket.orderType === "TakeAway"
                            ? "Mang đi"
                            : "Giao hàng"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                        <Clock size={12} />
                        {formatTimer(ticket.elapsedSeconds)}
                      </div>
                    </div>

                    {/* Items List */}
                    <div className="space-y-2">
                      {ticket.items.map((item) => (
                        <div key={item.id} className="rounded-lg bg-slate-50 p-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-800">
                              {item.quantity}x {item.productName}
                            </span>
                          </div>
                          {item.specialNote && (
                            <div className="mt-1 rounded bg-amber-100/70 px-1.5 py-0.5 text-[11px] font-bold text-amber-900">
                              Note: {item.specialNote}
                            </div>
                          )}
                          {item.modifiers.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {item.modifiers.map((mod) => (
                                <span
                                  key={mod.id}
                                  className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200"
                                >
                                  +{mod.modifierName}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleStartPrep(ticket)}
                      disabled={submittingAction === `start-${ticket.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white shadow-sm shadow-indigo-500/20 hover:bg-indigo-700 active:scale-95 transition-transform disabled:opacity-50"
                    >
                      <Flame size={14} />
                      Bắt đầu pha chế
                    </button>
                    <button
                      onClick={() => setCancelModalTicket(ticket)}
                      className="rounded-xl border border-slate-200 p-2.5 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Hủy vé"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Column 2: Đang pha chế (InPreparation) */}
        {(filterView === "all" || filterView === "prep") && (
          <div className="flex flex-col gap-3 rounded-2xl bg-amber-50/60 p-3.5 border border-amber-100">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-amber-500 animate-pulse" />
                <h2 className="text-sm font-black uppercase tracking-wider text-amber-950">
                  2. Đang pha chế ({inPrepTickets.length})
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-amber-700">SLA 5 phút</span>
            </div>

            {inPrepTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-amber-200 bg-white/50 p-8 text-center text-slate-400">
                <Coffee size={28} className="mb-2 text-amber-300" />
                <p className="text-xs font-bold text-amber-900">Quầy trống</p>
                <p className="text-[11px] text-amber-700">Chưa có ly nào đang pha chế</p>
              </div>
            ) : (
              inPrepTickets.map((ticket) => {
                const isOverSla = ticket.elapsedSeconds > ticket.targetPreparationSeconds;
                const isWarningSla = ticket.elapsedSeconds > 180 && !isOverSla;

                return (
                  <div
                    key={ticket.id}
                    className={`flex flex-col justify-between rounded-xl bg-white p-4 shadow-sm transition-all border-2 ${
                      isOverSla
                        ? "border-red-500 shadow-red-500/10"
                        : isWarningSla
                        ? "border-amber-400 shadow-amber-400/10"
                        : "border-slate-200 hover:border-amber-300"
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Ticket Header & Live SLA Clock */}
                      <div className="flex items-start justify-between border-b border-slate-100 pb-2.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-900">
                              {ticket.ticketNumber}
                            </span>
                            <span className="text-xs font-bold text-slate-800">
                              #{ticket.orderNumber}
                            </span>
                          </div>
                          <span className="text-[11px] font-medium text-slate-400">
                            {ticket.orderType === "DineIn"
                              ? "Tại bàn"
                              : ticket.orderType === "TakeAway"
                              ? "Mang đi"
                              : "Giao hàng"}
                          </span>
                        </div>

                        {/* SLA Stopwatch Pill */}
                        <div
                          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-black ${
                            isOverSla
                              ? "bg-red-100 text-red-700 animate-pulse"
                              : isWarningSla
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          <Timer size={13} />
                          {formatTimer(ticket.elapsedSeconds)} / 05:00
                        </div>
                      </div>

                      {/* Items & Checklist */}
                      <div className="space-y-2.5">
                        {ticket.items.map((item) => (
                          <div
                            key={item.id}
                            className={`rounded-xl p-3 transition-colors ${
                              item.isPrepared
                                ? "bg-emerald-50/70 border border-emerald-200"
                                : "bg-slate-50 border border-slate-100"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <button
                                onClick={() => handleToggleItem(ticket.id, item.id)}
                                className="flex items-center gap-2 text-left"
                              >
                                <div
                                  className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs transition-colors ${
                                    item.isPrepared
                                      ? "border-emerald-600 bg-emerald-600 text-white"
                                      : "border-slate-300 bg-white"
                                  }`}
                                >
                                  {item.isPrepared && <Check size={13} strokeWidth={3} />}
                                </div>
                                <span
                                  className={`text-xs font-black ${
                                    item.isPrepared ? "line-through text-slate-400" : "text-slate-900"
                                  }`}
                                >
                                  {item.quantity}x {item.productName}
                                </span>
                              </button>
                            </div>

                            {item.specialNote && (
                              <div className="mt-1.5 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                                ⚠️ {item.specialNote}
                              </div>
                            )}

                            {/* Modifiers / Toppings Checklist (Touch to toggle) */}
                            {item.modifiers.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {item.modifiers.map((mod) => (
                                  <button
                                    key={mod.id}
                                    onClick={() => handleToggleModifier(ticket.id, mod.id)}
                                    className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-extrabold transition-colors border ${
                                      mod.isChecked
                                        ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                                    }`}
                                  >
                                    <div
                                      className={`h-2 w-2 rounded-full ${
                                        mod.isChecked ? "bg-emerald-600" : "bg-slate-300"
                                      }`}
                                    />
                                    {mod.modifierName}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions: Mark Ready */}
                    <div className="mt-4 flex items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleMarkReady(ticket)}
                        disabled={submittingAction === `ready-${ticket.id}`}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-black text-white shadow-sm shadow-amber-500/20 hover:bg-amber-700 active:scale-95 transition-transform disabled:opacity-50"
                      >
                        <CheckCircle2 size={15} />
                        Pha chế xong (Chuông báo)
                      </button>
                      <button
                        onClick={() => setCancelModalTicket(ticket)}
                        className="rounded-xl border border-slate-200 p-2.5 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Hủy vé"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Column 3: Chờ trả khách (Ready) */}
        {(filterView === "all" || filterView === "ready") && (
          <div className="flex flex-col gap-3 rounded-2xl bg-emerald-50/60 p-3.5 border border-emerald-100">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-500" />
                <h2 className="text-sm font-black uppercase tracking-wider text-emerald-950">
                  3. Chờ trả khách ({readyTickets.length})
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700">Đã xong ly</span>
            </div>

            {readyTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-emerald-200 bg-white/50 p-8 text-center text-slate-400">
                <CheckCircle2 size={28} className="mb-2 text-emerald-300" />
                <p className="text-xs font-bold text-emerald-900">Không có ly chờ giao</p>
                <p className="text-[11px] text-emerald-700">Món pha xong sẽ chuyển về đây để nhân viên gọi tên khách</p>
              </div>
            ) : (
              readyTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex flex-col justify-between rounded-xl border border-emerald-200 bg-white p-4 shadow-sm"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between border-b border-slate-100 pb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-900">
                            {ticket.ticketNumber}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            #{ticket.orderNumber}
                          </span>
                        </div>
                        <span className="text-[11px] font-medium text-slate-400">
                          {ticket.orderType === "DineIn"
                            ? "Tại bàn"
                            : ticket.orderType === "TakeAway"
                            ? "Mang đi"
                            : "Giao hàng"}
                        </span>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-black text-emerald-800">
                        SẴN SÀNG
                      </span>
                    </div>

                    {/* Summary items */}
                    <div className="space-y-1.5 rounded-xl bg-slate-50 p-2.5">
                      {ticket.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800">
                            {item.quantity}x {item.productName}
                          </span>
                          <span className="text-[11px] text-emerald-600 font-semibold">✓ Xong</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions: Complete */}
                  <div className="mt-4 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleComplete(ticket)}
                      disabled={submittingAction === `complete-${ticket.id}`}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-sm shadow-emerald-500/20 hover:bg-emerald-700 active:scale-95 transition-transform disabled:opacity-50"
                    >
                      <UserCheck size={15} />
                      Đã giao cho khách hàng (Hoàn tất)
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal Hủy Vé */}
      {cancelModalTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
                <AlertCircle size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Xác nhận hủy vé pha chế</h3>
                <p className="text-xs text-slate-500">
                  {cancelModalTicket.ticketNumber} (#{cancelModalTicket.orderNumber})
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Lý do hủy vé:</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Nhập lý do hủy (ví dụ: Khách đổi món, lỗi nhân viên POS...)"
                rows={3}
                className="w-full rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setCancelModalTicket(null);
                  setCancelReason("");
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Đóng
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={!cancelReason.trim() || submittingAction?.startsWith("cancel-")}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white hover:bg-red-700 disabled:opacity-50"
              >
                Xác nhận hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
