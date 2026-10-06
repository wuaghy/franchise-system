import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  QrCode,
  CheckCircle2,
  Coffee,
  Sparkles,
  ArrowRight,
  Clock,
  MapPin,
  UtensilsCrossed,
  Volume2,
} from "lucide-react";
import { API_BASE } from "../config/api.ts";
import { audioNotifier } from "../services/audioNotification.ts";

interface MenuItem {
  id: string;
  name: string;
  category: "coffee" | "milktea" | "fruit_tea" | "bakery";
  price: number;
  image: string;
  description: string;
  isPopular?: boolean;
}

const MENU_DATA: MenuItem[] = [
  {
    id: "cf-01",
    name: "Cà Phê Muối Đặc Biệt",
    category: "coffee",
    price: 35000,
    image: "☕",
    description: "Cốt cà phê Robusta truyền thống kết hợp lớp kem béo mặn sánh mịn độc quyền.",
    isPopular: true,
  },
  {
    id: "cf-02",
    name: "Bạc Xỉu Sữa Tươi Kem Trứng",
    category: "coffee",
    price: 38000,
    image: "🥛",
    description: "Sữa đặc béo thơm, sữa tươi thanh trùng và lớp foam cà phê sóng sánh.",
  },
  {
    id: "cf-03",
    name: "Cold Brew Cam Vàng Hạnh Nhân",
    category: "coffee",
    price: 45000,
    image: "🍊",
    description: "Cà phê ủ lạnh 16 tiếng mát lành, lát cam vàng mọng nước sảng khoái.",
    isPopular: true,
  },
  {
    id: "mt-01",
    name: "Trà Sữa Oolong Nướng Trân Châu",
    category: "milktea",
    price: 42000,
    image: "🧋",
    description: "Trà Oolong sao đậm lửa, sữa béo đậm đà kèm trân châu đen hoàng kim dẻo dai.",
    isPopular: true,
  },
  {
    id: "mt-02",
    name: "Hồng Trà Sữa Kem Cheese Macchiato",
    category: "milktea",
    price: 45000,
    image: "🧀",
    description: "Hồng trà Shan tuyết cổ thụ với lớp kem phô mai New Zealand sánh đặc ngậy vị.",
  },
  {
    id: "ft-01",
    name: "Trà Đào Cam Sả Tươi",
    category: "fruit_tea",
    price: 40000,
    image: "🍑",
    description: "Đào miếng giòn rụm, hương cam tươi thơm lừng hòa quyện tinh chất sả thanh mát.",
    isPopular: true,
  },
  {
    id: "ft-02",
    name: "Trà Dâu Tằm Mận Đỏ Hạt Chia",
    category: "fruit_tea",
    price: 42000,
    image: "🍓",
    description: "Dâu tằm ngâm đường phèn ngọt dịu, bổ sung hạt chia giàu dinh dưỡng.",
  },
  {
    id: "bk-01",
    name: "Bánh Croissant Trứng Muối Tan Chảy",
    category: "bakery",
    price: 32000,
    image: "🥐",
    description: "Vỏ ngàn lớp giòn tan nướng bơ Pháp thơm lừng, nhân sốt trứng muối béo mặn.",
  },
  {
    id: "bk-02",
    name: "Bánh Tiramisu Cacao Đậm Vị",
    category: "bakery",
    price: 45000,
    image: "🍰",
    description: "Cốt bánh ladyfinger thấm đẫm cà phê espresso và kem mascarpone mịn màng.",
  },
];

interface CartItem {
  item: MenuItem;
  quantity: number;
  note: string;
}

export function CustomerScreen() {
  const [selectedCategory, setSelectedCategory] = useState<"all" | "coffee" | "milktea" | "fruit_tea" | "bakery">("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<"dine-in" | "take-away">("dine-in");
  const [customerName, setCustomerName] = useState("");
  const [tableNumber, setTableNumber] = useState("Bàn 05");
  const [showQrModal, setShowQrModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successOrderNumber, setSuccessOrderNumber] = useState<string | null>(null);

  const filteredMenu = selectedCategory === "all" ? MENU_DATA : MENU_DATA.filter((i) => i.category === selectedCategory);

  const totalAmount = cart.reduce((sum, c) => sum + c.item.price * c.quantity, 0);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) {
        return prev.map((c) => (c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [...prev, { item, quantity: 1, note: "" }];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.item.id === itemId) {
            const newQty = c.quantity + delta;
            return newQty > 0 ? { ...c, quantity: newQty } : null;
          }
          return c;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const orderCode = `ONL-${Math.floor(1000 + Math.random() * 9000)}`;

  // VietQR Napas URL
  const qrUrl = `https://img.vietqr.io/image/vietinbank-100878137043-compact2.png?amount=${totalAmount}&addInfo=${encodeURIComponent(
    `TT ${orderCode}`
  )}&accountName=${encodeURIComponent("NGUYEN QUANG HUY")}`;

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);

    try {
      // Gọi API announce lên Cloud backend để phát chuông
      await fetch(`${API_BASE}/orders/announce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: orderCode,
          finalAmount: totalAmount,
          type: "OnlineOrder",
          customerName: customerName || (orderType === "dine-in" ? tableNumber : "Khách mang đi"),
        }),
      }).catch(() => null);

      // Kích hoạt chuông âm thanh trên trình duyệt
      audioNotifier.playOrderChime("urgent");
      setTimeout(() => {
        audioNotifier.speakAnnouncement("Đơn hàng mới từ khách hàng trực tuyến");
      }, 500);

      setSuccessOrderNumber(orderCode);
      setShowQrModal(false);
      setCart([]);
    } catch {
      // Fallback
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 lg:px-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-red-900 via-rose-900 to-slate-900 p-6 lg:p-10 text-white shadow-md mb-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md mb-3">
              <Sparkles size={14} className="text-amber-400" />
              <span>Tiệm Cà Phê Nhượng Quyền Enterprise · Chi Nhánh 01</span>
            </div>
            <h1 className="text-2xl lg:text-4xl font-black tracking-tight">Thực Đơn Đặt Món Trực Tuyến</h1>
            <p className="mt-2 text-sm text-rose-100/80 font-normal">
              Chọn món yêu thích, thanh toán quét mã VietQR Napas 247 và nhận đồ nhanh chóng tại quầy.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/10">
            <MapPin size={18} className="text-amber-400 shrink-0" />
            <div className="text-xs">
              <div className="font-bold">Bàn Phục Vụ: {tableNumber}</div>
              <div className="text-slate-300">Wifi: Franchise_Guest (Pass: 88888888)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Menu vs Cart */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left: Category Filter & Menu Grid (8 Cols) */}
        <div className="lg:col-span-8">
          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-none">
            {[
              { id: "all", label: "Tất cả món" },
              { id: "coffee", label: "Cà phê pha máy & thủ công" },
              { id: "milktea", label: "Trà sữa đậm vị" },
              { id: "fruit_tea", label: "Trà trái cây nhiệt đới" },
              { id: "bakery", label: "Bánh ngọt & ăn kèm" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id as any)}
                className={`shrink-0 rounded-2xl px-5 py-2.5 text-xs font-bold transition ${
                  selectedCategory === tab.id
                    ? "bg-red-700 text-white shadow-md shadow-red-900/20"
                    : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Menu Cards */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMenu.map((item) => (
              <motion.div
                key={item.id}
                whileHover={{ y: -3 }}
                className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-red-200 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-2xl group-hover:scale-110 transition">
                      {item.image}
                    </span>
                    {item.isPopular && (
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-black uppercase text-amber-700 border border-amber-200/60">
                        Bán Chạy
                      </span>
                    )}
                  </div>
                  <h3 className="mt-4 text-base font-black text-slate-900 group-hover:text-red-700 transition">
                    {item.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 font-normal leading-relaxed line-clamp-2">
                    {item.description}
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
                  <div className="text-sm font-black text-red-700">
                    {item.price.toLocaleString("vi-VN")} đ
                  </div>
                  <button
                    onClick={() => addToCart(item)}
                    className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-800 hover:bg-red-700 hover:text-white transition active:scale-90"
                    title="Thêm vào giỏ"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right: Cart Drawer / Sidebar (4 Cols) */}
        <div className="lg:col-span-4">
          <div className="sticky top-20 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <ShoppingBag size={20} className="text-red-700" />
                <h2 className="text-base font-black text-slate-900">Giỏ Hàng Của Bạn</h2>
              </div>
              <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-black text-red-700">
                {cart.reduce((s, c) => s + c.quantity, 0)} món
              </span>
            </div>

            {/* Order Type Toggle */}
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
              <button
                onClick={() => setOrderType("dine-in")}
                className={`rounded-xl py-2 text-xs font-bold transition ${
                  orderType === "dine-in" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                Dùng Tại Quán
              </button>
              <button
                onClick={() => setOrderType("take-away")}
                className={`rounded-xl py-2 text-xs font-bold transition ${
                  orderType === "take-away" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                Mang Về (Take-Away)
              </button>
            </div>

            {/* Cart Items List */}
            <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <UtensilsCrossed size={36} className="mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-semibold">Chưa có món nào trong giỏ hàng</p>
                  <p className="text-[11px] text-slate-400 mt-1">Hãy bấm dấu (+) bên menu để chọn món nhé!</p>
                </div>
              ) : (
                cart.map((c) => (
                  <div
                    key={c.item.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-black text-slate-900">{c.item.name}</div>
                      <div className="text-[11px] font-bold text-red-700">
                        {c.item.price.toLocaleString("vi-VN")} đ
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(c.item.id, -1)}
                        className="grid size-6 place-items-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-5 text-center text-xs font-black">{c.quantity}</span>
                      <button
                        onClick={() => updateQuantity(c.item.id, 1)}
                        className="grid size-6 place-items-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Summary & Checkout CTA */}
            {cart.length > 0 && (
              <div className="mt-6 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Tạm tính</span>
                  <span>{totalAmount.toLocaleString("vi-VN")} đ</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                  <span>VAT (8%)</span>
                  <span>Đã bao gồm</span>
                </div>
                <div className="flex items-center justify-between text-base font-black text-slate-900 border-t border-slate-100 pt-2 mb-4">
                  <span>Tổng thanh toán</span>
                  <span className="text-red-700">{totalAmount.toLocaleString("vi-VN")} đ</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setShowQrModal(true)}
                    className="flex items-center justify-center gap-1.5 rounded-2xl border border-red-200 bg-red-50 py-3 text-xs font-black text-red-700 hover:bg-red-100 transition"
                  >
                    <QrCode size={16} />
                    <span>Quét VietQR</span>
                  </button>
                  <button
                    onClick={handlePlaceOrder}
                    disabled={isSubmitting}
                    className="flex items-center justify-center gap-1.5 rounded-2xl bg-red-700 py-3 text-xs font-black text-white shadow-md shadow-red-900/20 hover:bg-red-800 transition disabled:opacity-50"
                  >
                    <Volume2 size={16} />
                    <span>{isSubmitting ? "Đang gửi..." : "Đặt Đơn Ngay"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* VietQR Modal */}
      <AnimatePresence>
        {showQrModal && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-center"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="text-sm font-black text-slate-900">Mã Thanh Toán VietQR Napas 247</div>
                <button onClick={() => setShowQrModal(false)} className="text-slate-400 hover:text-slate-600">
                  ✕
                </button>
              </div>

              <div className="rounded-2xl border-2 border-dashed border-red-200 bg-red-50/30 p-4 mb-4">
                <img
                  src={qrUrl}
                  alt="VietQR Payment"
                  className="mx-auto size-56 object-contain rounded-xl shadow-sm"
                />
              </div>

              <div className="space-y-1.5 text-xs text-left bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 mb-5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Ngân hàng:</span>
                  <span className="font-bold text-slate-800">VietinBank (ICB)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Số tài khoản:</span>
                  <span className="font-mono font-bold text-slate-900">100878137043</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Chủ tài khoản:</span>
                  <span className="font-bold text-slate-800 uppercase">NGUYEN QUANG HUY</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5">
                  <span className="text-slate-500">Số tiền:</span>
                  <span className="font-black text-red-700">{totalAmount.toLocaleString("vi-VN")} đ</span>
                </div>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-red-700 py-3.5 text-sm font-black text-white shadow-lg shadow-red-900/20 hover:bg-red-800 transition active:scale-98"
              >
                {isSubmitting ? "Đang xử lý..." : "Tôi Đã Chuyển Khoản · Xác Nhận"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Order Modal */}
      <AnimatePresence>
        {successOrderNumber && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-2xl"
            >
              <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 mb-4">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="text-xl font-black text-slate-950">Đặt Đơn Thành Công!</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Tín hiệu chuông báo đơn mới đã được gửi tới quầy Barista. Món của bạn đang được ưu tiên chuẩn bị!
              </p>

              <div className="my-5 rounded-2xl bg-slate-50 border border-slate-200 p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mã đơn nhận đồ</span>
                <div className="text-2xl font-black tracking-wider text-red-700">{successOrderNumber}</div>
              </div>

              <button
                onClick={() => setSuccessOrderNumber(null)}
                className="w-full rounded-2xl bg-slate-900 py-3 text-xs font-bold text-white hover:bg-black transition"
              >
                Tiếp Tục Chọn Món
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
