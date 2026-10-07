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
  X,
  ChevronDown,
  Flame,
  Award,
  SlidersHorizontal,
} from "lucide-react";
import { API_BASE } from "../config/api.ts";
import { audioNotifier } from "../services/audioNotification.ts";
import { api, type CheckoutOrderPayload } from "../services/api.ts";

const DB_PRODUCT_MAPPING: Record<string, string> = {
  "cf-01": "09ffff04-0f0b-4200-994a-d7decc20d2cc", // Phin Sữa Đá Đậm Đà
  "cf-02": "9398818e-183c-4b68-8780-42719896f4b5", // Cà Phê Muối Xứ Huế
  "cf-03": "dd5dbb7a-938a-4cad-bfb3-658b36e9a5e5", // Bạc Xỉu Sữa Tươi 3 Tầng
  "cf-04": "09ffff04-0f0b-4200-994a-d7decc20d2cc",
  "cf-05": "09ffff04-0f0b-4200-994a-d7decc20d2cc",
  "mt-01": "8009ae26-207a-4a4e-9ee0-0e0819b17737", // Trà Sen Vàng Kem Cheese
  "mt-02": "8009ae26-207a-4a4e-9ee0-0e0819b17737",
  "mt-03": "8009ae26-207a-4a4e-9ee0-0e0819b17737",
  "ft-01": "55c9b685-7d0b-4dac-8a51-a3ec01949fd6", // Trà Đào Cam Sả Tươi
  "ft-02": "55c9b685-7d0b-4dac-8a51-a3ec01949fd6",
  "ft-03": "55c9b685-7d0b-4dac-8a51-a3ec01949fd6",
  "frz-01": "577d3866-b7c3-4189-8e7f-2340224991de", // Freeze Trà Xanh Thạch
  "frz-02": "577d3866-b7c3-4189-8e7f-2340224991de",
  "bk-01": "5753143c-abcf-4ce2-b57d-b96f62c13ae2", // Bánh Mì Que Hải Phòng Cay
  "bk-02": "5753143c-abcf-4ce2-b57d-b96f62c13ae2",
  "bk-03": "5753143c-abcf-4ce2-b57d-b96f62c13ae2",
};

export interface MenuItem {
  id: string;
  name: string;
  category: "coffee" | "milktea" | "fruit_tea" | "freeze" | "bakery";
  price: number;
  image: string;
  description: string;
  isPopular?: boolean;
  isSignature?: boolean;
  tag?: string;
  allowCustomization?: boolean;
}

export const MENU_DATA: MenuItem[] = [
  // Cà Phê (Highlands & Trung Nguyên)
  {
    id: "cf-01",
    name: "Phin Sữa Đá Đậm Vị",
    category: "coffee",
    price: 32000,
    image: "☕",
    description: "Cốt cà phê Robusta Buôn Ma Thuột ủ phin truyền thống, sữa đặc béo ngậy đậm đà.",
    isPopular: true,
    tag: "Best Seller",
    allowCustomization: true,
  },
  {
    id: "cf-02",
    name: "Cà Phê Muối Kem Béo",
    category: "coffee",
    price: 35000,
    image: "🧂",
    description: "Cốt cà phê phin kết hợp lớp kem phô mai béo mặn sánh mịn độc quyền.",
    isSignature: true,
    tag: "Khuyên Thử",
    allowCustomization: true,
  },
  {
    id: "cf-03",
    name: "Bạc Xỉu 3 Tầng Kem Trứng",
    category: "coffee",
    price: 38000,
    image: "🥛",
    description: "Sữa đặc béo thơm, sữa tươi thanh trùng và lớp foam cà phê sóng sánh.",
    isPopular: true,
    allowCustomization: true,
  },
  {
    id: "cf-04",
    name: "PhinDi Hạnh Nhân Kem Sữa",
    category: "coffee",
    price: 45000,
    image: "🌰",
    description: "Cà phê phin hiện đại hòa quyện sốt hạnh nhân thơm bùi và lớp kem sữa mềm mượt.",
    isPopular: true,
    tag: "Giới Trẻ",
    allowCustomization: true,
  },
  {
    id: "cf-05",
    name: "Cold Brew Cam Vàng Hạnh Nhân",
    category: "coffee",
    price: 45000,
    image: "🍊",
    description: "Cà phê ủ lạnh 16 tiếng thanh khiết, lát cam vàng mọng nước giải nhiệt sảng khoái.",
    allowCustomization: true,
  },

  // Trà Sữa & Trà Sen (Phúc Long & Highlands)
  {
    id: "mt-01",
    name: "Trà Sen Vàng Hạt Sen Kem Cheese",
    category: "milktea",
    price: 49000,
    image: "🪷",
    description: "Trà Ô long thanh mát, hạt sen tươi rim đường phèn bùi ngậy và kem cheese mặn mà.",
    isSignature: true,
    isPopular: true,
    tag: "Signature Số 1",
    allowCustomization: true,
  },
  {
    id: "mt-02",
    name: "Trà Sữa Oolong Nướng Đậm Vị",
    category: "milktea",
    price: 42000,
    image: "🧋",
    description: "Trà Oolong sao đậm lửa chuẩn Phúc Long style, sữa béo ngậy kèm trân châu đen dai giòn.",
    isPopular: true,
    tag: "Đậm Vị Trà",
    allowCustomization: true,
  },
  {
    id: "mt-03",
    name: "Hồng Trà Sữa Kem Cheese Macchiato",
    category: "milktea",
    price: 45000,
    image: "🧀",
    description: "Hồng trà Shan tuyết cổ thụ với lớp kem phô mai New Zealand sánh đặc thơm ngậy.",
    allowCustomization: true,
  },

  // Trà Trái Cây Tươi
  {
    id: "ft-01",
    name: "Trà Đào Cam Sả Tươi",
    category: "fruit_tea",
    price: 45000,
    image: "🍑",
    description: "Đào miếng giòn rụm ngâm nước đường, hương cam tươi thơm lừng hòa quyện tinh chất sả.",
    isPopular: true,
    tag: "Thanh Mát",
    allowCustomization: true,
  },
  {
    id: "ft-02",
    name: "Trà Ổi Hồng Dâu Tây Hạt Chia",
    category: "fruit_tea",
    price: 42000,
    image: "🍓",
    description: "Ổi hồng thơm ngát, dâu tây đỏ mọng ngâm thanh nhiệt, hạt chia dinh dưỡng.",
    allowCustomization: true,
  },
  {
    id: "ft-03",
    name: "Trà Thanh Đào Thạch Củ Năng",
    category: "fruit_tea",
    price: 45000,
    image: "🧃",
    description: "Vị trà đào thanh khiết kết hợp thạch củ năng giòn sần sật vui miệng.",
    allowCustomization: true,
  },

  // Freeze & Đá Xay (Highlands Style)
  {
    id: "fz-01",
    name: "Freeze Trà Xanh Matcha Thạch",
    category: "freeze",
    price: 55000,
    image: "🍵",
    description: "Matcha Nhật Bản xay tuyết nhuyễn mịn, kèm thạch trà xanh giòn và lớp kem whipping béo ngậy.",
    isPopular: true,
    tag: "Đá Xay Hot",
    allowCustomization: true,
  },
  {
    id: "fz-02",
    name: "Caramel Phin Freeze Thạch Cà Phê",
    category: "freeze",
    price: 55000,
    image: "🍮",
    description: "Cốt cà phê phin đá xay cùng sốt sốt caramel ngọt ngào, thạch cà phê giòn dai rụm.",
    isSignature: true,
    allowCustomization: true,
  },
  {
    id: "fz-03",
    name: "Cookies & Cream Bánh Quy Freeze",
    category: "freeze",
    price: 55000,
    image: "🍪",
    description: "Bánh quy sô-cô-la xay giòn rụm cùng sữa béo ngọt ngào, topping vụn oreo thơm lừng.",
    allowCustomization: true,
  },

  // Bánh Mì & Bánh Ngọt Ăn Kèm
  {
    id: "bk-01",
    name: "Bánh Mì Que Hải Phòng Pate Tiêu",
    category: "bakery",
    price: 19000,
    image: "🥖",
    description: "Bánh mì que nướng lò giòn rụm, nhân pate gan đậm đà béo ngậy kèm tương ớt Chí Chương cay nồng.",
    isPopular: true,
    tag: "Combo Ăn Kèm",
    allowCustomization: false,
  },
  {
    id: "bk-02",
    name: "Croissant Bơ Pháp Trứng Muối",
    category: "bakery",
    price: 35000,
    image: "🥐",
    description: "Vỏ ngàn lớp giòn tan nướng bơ Pháp thơm lừng, nhân sốt trứng muối tan chảy béo mặn.",
    allowCustomization: false,
  },
  {
    id: "bk-03",
    name: "Bánh Mousse Đào Thạch Trái Cây",
    category: "bakery",
    price: 38000,
    image: "🍰",
    description: "Lớp mousse đào ngọt thanh mát lạnh tan ngay trong miệng, đế bánh mềm mịn.",
    allowCustomization: false,
  },
  {
    id: "bk-04",
    name: "Tiramisu Cacao Đậm Vị",
    category: "bakery",
    price: 42000,
    image: "🍫",
    description: "Cốt bánh thấm đẫm cà phê espresso, lớp kem mascarpone mịn màng phủ bột cacao nguyên chất.",
    allowCustomization: false,
  },
];

export interface ToppingOption {
  id: string;
  name: string;
  price: number;
}

export const TOPPING_OPTIONS: ToppingOption[] = [
  { id: "top-lotus", name: "Hạt sen tươi rim đường", price: 10000 },
  { id: "top-chestnut", name: "Thạch củ năng giòn", price: 10000 },
  { id: "top-cheese", name: "Kem Cheese Macchiato", price: 12000 },
  { id: "top-pearl", name: "Trân châu trắng giòn", price: 8000 },
  { id: "top-coffee-jelly", name: "Thạch cà phê giòn", price: 10000 },
  { id: "top-peach", name: "Đào miếng giòn rụm", price: 12000 },
];

export interface CustomizationState {
  size: "S" | "M" | "L";
  ice: "100%" | "70%" | "0%" | "hot";
  sugar: "100%" | "70%" | "50%" | "0%";
  toppings: string[];
  note: string;
}

export interface CartItem {
  cartId: string;
  item: MenuItem;
  quantity: number;
  customization?: CustomizationState;
  finalPricePerUnit: number;
}

export function CustomerScreen() {
  const [selectedCategory, setSelectedCategory] = useState<"all" | "coffee" | "milktea" | "fruit_tea" | "freeze" | "bakery">("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<"dine-in" | "take-away">("dine-in");
  const [customerName, setCustomerName] = useState("");
  const [tableNumber, setTableNumber] = useState("Bàn 05");
  const [showQrModal, setShowQrModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successOrderNumber, setSuccessOrderNumber] = useState<string | null>(null);

  // Customization Modal State
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [customState, setCustomState] = useState<CustomizationState>({
    size: "M",
    ice: "100%",
    sugar: "100%",
    toppings: [],
    note: "",
  });

  const filteredMenu =
    selectedCategory === "all" ? MENU_DATA : MENU_DATA.filter((i) => i.category === selectedCategory);

  const totalAmount = cart.reduce((sum, c) => sum + c.finalPricePerUnit * c.quantity, 0);

  // Open customization modal
  const handleStartAdd = (item: MenuItem) => {
    if (!item.allowCustomization) {
      // Add directly if bakery/ready items
      addToCartDirect(item);
      return;
    }
    setCustomizingItem(item);
    setCustomState({
      size: "M",
      ice: "100%",
      sugar: "100%",
      toppings: [],
      note: "",
    });
  };

  const addToCartDirect = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id && !c.customization);
      if (existing) {
        return prev.map((c) =>
          c.cartId === existing.cartId ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        {
          cartId: `${item.id}-${Date.now()}`,
          item,
          quantity: 1,
          finalPricePerUnit: item.price,
        },
      ];
    });
  };

  // Calculate customized price
  const calculateModalPrice = () => {
    if (!customizingItem) return 0;
    let price = customizingItem.price;
    if (customState.size === "M") price += 6000;
    if (customState.size === "L") price += 12000;
    for (const tId of customState.toppings) {
      const found = TOPPING_OPTIONS.find((t) => t.id === tId);
      if (found) price += found.price;
    }
    return price;
  };

  const handleConfirmCustomization = () => {
    if (!customizingItem) return;
    const finalPricePerUnit = calculateModalPrice();
    const cartId = `${customizingItem.id}-${customState.size}-${customState.ice}-${customState.sugar}-${customState.toppings.sort().join(",")}`;

    setCart((prev) => {
      const existing = prev.find((c) => c.cartId === cartId);
      if (existing) {
        return prev.map((c) => (c.cartId === cartId ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [
        ...prev,
        {
          cartId,
          item: customizingItem,
          quantity: 1,
          customization: { ...customState },
          finalPricePerUnit,
        },
      ];
    });

    setCustomizingItem(null);
  };

  const updateQuantity = (cartId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.cartId === cartId) {
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
      let finalOrderCode = orderCode;
      try {
        const checkoutPayload: CheckoutOrderPayload = {
          storeId: "22222222-2222-2222-2222-222222222222",
          orderType: orderType === "dine-in" ? 0 : 1,
          paymentMethod: 2, // VietQR Napas
          items: cart.map((c) => ({
            productId: DB_PRODUCT_MAPPING[c.item.id] || "09ffff04-0f0b-4200-994a-d7decc20d2cc",
            quantity: c.quantity,
            specialNote: c.customization
              ? `Size ${c.customization.size}, Đá ${c.customization.ice}, Đường ${c.customization.sugar}${
                  c.customization.note ? ` - ${c.customization.note}` : ""
                }`
              : undefined,
            modifiers:
              c.customization?.toppings?.map((t) => ({
                name: t,
                extraPrice: TOPPING_OPTIONS.find((top) => top.id === t)?.price || 10000,
                consumptionQuantity: 25,
              })) || [],
          })),
        };

        const res = await api.checkout(checkoutPayload);
        if (res?.orderNumber) {
          finalOrderCode = res.orderNumber;
        }
      } catch (checkoutErr) {
        console.warn("Backend checkout call failed, continuing with online order announcement:", checkoutErr);
      }

      // Call announcement API on cloud backend
      await fetch(`${API_BASE}/orders/announce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: finalOrderCode,
          finalAmount: totalAmount,
          type: "OnlineOrder",
          customerName: customerName || (orderType === "dine-in" ? tableNumber : "Khách mang đi"),
        }),
      }).catch(() => null);

      // Trigger Web Audio Ting-Ting chime
      audioNotifier.playOrderChime("urgent");
      setTimeout(() => {
        audioNotifier.speakAnnouncement("Đơn hàng mới từ khách hàng trực tuyến " + finalOrderCode.slice(-4));
      }, 500);

      setSuccessOrderNumber(finalOrderCode);
      setShowQrModal(false);
      setCart([]);
    } catch {
      // Fallback
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] px-3 py-4 sm:px-4 sm:py-6 lg:px-8">
      {/* Header Banner - Inspired by Highlands & Trung Nguyên Legend */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-red-900 via-rose-900 to-slate-900 p-6 lg:p-8 text-white shadow-md mb-6">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md mb-2">
              <Sparkles size={14} className="text-amber-400" />
              <span>Cổng Đặt Món Khách Hàng · Highlands Lê Lợi Q1</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black tracking-tight">Thực Đơn Đặt Món & Tự Phục Vụ</h1>
            <p className="mt-1.5 text-xs sm:text-sm text-rose-100/80 font-normal max-w-xl">
              Chọn món tùy chỉnh size, đường, đá, quét mã VietQR Napas 247 và nhận thông báo chuông tức thì tại quầy Barista.
            </p>
          </div>

          {/* Dine-in Table Selector / Wifi Info */}
          <div className="flex flex-wrap items-center gap-3 bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/10">
            <div className="flex items-center gap-2 text-xs">
              <MapPin size={16} className="text-amber-400 shrink-0" />
              <div>
                <span className="text-slate-300 block text-[10px]">Vị trí đặt món:</span>
                <select
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="bg-transparent font-bold text-white text-xs outline-none cursor-pointer"
                >
                  <option value="Bàn 01" className="text-slate-900">Bàn 01 (Tầng trệt)</option>
                  <option value="Bàn 02" className="text-slate-900">Bàn 02 (Cửa sổ)</option>
                  <option value="Bàn 03" className="text-slate-900">Bàn 03 (Sân vườn)</option>
                  <option value="Bàn 05" className="text-slate-900">Bàn 05 (Trung tâm)</option>
                  <option value="Bàn 08" className="text-slate-900">Bàn 08 (Tầng 1)</option>
                  <option value="Bàn 10" className="text-slate-900">Bàn 10 (Góc yên tĩnh)</option>
                </select>
              </div>
            </div>
            <div className="hidden sm:block border-l border-white/20 pl-3 text-[11px] text-slate-300">
              <div>Wifi: <b className="text-white">Highlands_Guest</b></div>
              <div>Pass: <b className="text-white">88888888</b></div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Menu vs Cart */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Category Filter & Menu Grid (8 Cols) */}
        <div className="lg:col-span-8">
          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
            {[
              { id: "all", label: "Tất cả món" },
              { id: "coffee", label: "☕ Cà phê Phin & Máy" },
              { id: "milktea", label: "🧋 Trà Sen & Trà Sữa" },
              { id: "fruit_tea", label: "🍑 Trà Trái Cây Tươi" },
              { id: "freeze", label: "🍧 Freeze Đá Xay" },
              { id: "bakery", label: "🥐 Bánh Mì & Bánh Ngọt" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id as any)}
                className={`shrink-0 rounded-2xl px-4 py-2.5 text-xs font-bold transition whitespace-nowrap ${
                  selectedCategory === tab.id
                    ? "bg-red-800 text-white shadow-md shadow-red-900/20"
                    : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Menu Cards */}
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMenu.map((item) => (
              <motion.div
                key={item.id}
                whileHover={{ y: -2 }}
                className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs transition hover:border-red-200 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-2xl group-hover:scale-110 transition">
                      {item.image}
                    </span>
                    {item.tag && (
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase border ${
                        item.isSignature 
                          ? "bg-red-50 text-red-700 border-red-200" 
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}>
                        {item.tag}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-3.5 text-sm sm:text-base font-black text-slate-900 group-hover:text-red-700 transition">
                    {item.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 font-normal leading-relaxed line-clamp-2">
                    {item.description}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Giá từ:</span>
                    <span className="text-sm sm:text-base font-black text-red-800">
                      {item.price.toLocaleString("vi-VN")} đ
                    </span>
                  </div>
                  <button
                    onClick={() => handleStartAdd(item)}
                    className="flex h-9 items-center gap-1.5 rounded-xl bg-red-50 px-3 text-xs font-bold text-red-800 hover:bg-red-800 hover:text-white transition active:scale-95"
                    title={item.allowCustomization ? "Tùy biến món & thêm giỏ" : "Thêm vào giỏ"}
                  >
                    <Plus size={15} />
                    <span>{item.allowCustomization ? "Chọn món" : "Thêm"}</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right: Cart Drawer (4 Cols) */}
        <div className="lg:col-span-4">
          <div className="sticky top-20 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingBag size={18} className="text-red-800" />
                <h2 className="text-base font-black text-slate-900">Giỏ Hàng Của Bạn</h2>
              </div>
              <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-black text-red-800">
                {cart.reduce((s, c) => s + c.quantity, 0)} món
              </span>
            </div>

            {/* Order Type Toggle */}
            <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-100 p-1">
              <button
                onClick={() => setOrderType("dine-in")}
                className={`rounded-xl py-2 text-xs font-bold transition ${
                  orderType === "dine-in" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Dùng Tại Quán
              </button>
              <button
                onClick={() => setOrderType("take-away")}
                className={`rounded-xl py-2 text-xs font-bold transition ${
                  orderType === "take-away" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Mang Về (Take-Away)
              </button>
            </div>

            {/* Cart Items List */}
            <div className="mt-3.5 max-h-[340px] space-y-2.5 overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  <UtensilsCrossed size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-semibold">Giỏ hàng đang trống</p>
                  <p className="text-[11px] text-slate-400 mt-1">Chọn món ngon từ thực đơn bên trái để bắt đầu nhé!</p>
                </div>
              ) : (
                cart.map((c) => (
                  <div
                    key={c.cartId}
                    className="flex flex-col gap-1.5 rounded-2xl border border-slate-100 bg-slate-50/60 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-black text-slate-900">{c.item.name}</div>
                        {c.customization && (
                          <div className="text-[10px] text-slate-500 font-medium space-x-1.5 mt-0.5">
                            <span className="font-bold text-red-800">Size {c.customization.size}</span>
                            <span>•</span>
                            <span>{c.customization.ice === "hot" ? "Uống Nóng" : `${c.customization.ice} đá`}</span>
                            <span>•</span>
                            <span>{c.customization.sugar} đường</span>
                          </div>
                        )}
                        {c.customization?.toppings && c.customization.toppings.length > 0 && (
                          <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
                            + {c.customization.toppings.map((tId) => TOPPING_OPTIONS.find((t) => t.id === tId)?.name).join(", ")}
                          </div>
                        )}
                        {c.customization?.note && (
                          <div className="text-[10px] text-slate-400 italic">
                            Ghi chú: {c.customization.note}
                          </div>
                        )}
                      </div>
                      <div className="text-xs font-black text-red-800 shrink-0">
                        {(c.finalPricePerUnit * c.quantity).toLocaleString("vi-VN")} đ
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-200/50 pt-2 mt-1">
                      <div className="text-[10px] text-slate-400">
                        {c.finalPricePerUnit.toLocaleString("vi-VN")} đ / món
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(c.cartId, -1)}
                          className="grid size-6 place-items-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="w-4 text-center text-xs font-black">{c.quantity}</span>
                        <button
                          onClick={() => updateQuantity(c.cartId, 1)}
                          className="grid size-6 place-items-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Summary & Checkout CTA */}
            {cart.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Tạm tính</span>
                  <span className="font-bold text-slate-800">{totalAmount.toLocaleString("vi-VN")} đ</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                  <span>VAT (8%) & Phí dịch vụ</span>
                  <span className="text-emerald-700 font-bold">Đã bao gồm</span>
                </div>
                <div className="flex items-center justify-between text-base font-black text-slate-900 border-t border-slate-100 pt-2 mb-4">
                  <span>Tổng thanh toán</span>
                  <span className="text-red-800 font-mono text-lg">{totalAmount.toLocaleString("vi-VN")} đ</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setShowQrModal(true)}
                    className="flex items-center justify-center gap-1.5 rounded-2xl border border-red-200 bg-red-50 py-3 text-xs font-black text-red-800 hover:bg-red-100 transition active:scale-98"
                  >
                    <QrCode size={15} />
                    <span>Quét VietQR</span>
                  </button>
                  <button
                    onClick={handlePlaceOrder}
                    disabled={isSubmitting}
                    className="flex items-center justify-center gap-1.5 rounded-2xl bg-red-800 py-3 text-xs font-black text-white shadow-md shadow-red-900/20 hover:bg-red-700 transition disabled:opacity-50 active:scale-98"
                  >
                    <Volume2 size={15} />
                    <span>{isSubmitting ? "Đang gửi..." : "Đặt Đơn Ngay"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DRINK CUSTOMIZATION MODAL (Highlands & Phúc Long Inspired) */}
      <AnimatePresence>
        {customizingItem && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg rounded-3xl bg-white p-5 sm:p-6 shadow-2xl my-auto text-left"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-12 place-items-center rounded-2xl bg-red-50 text-2xl">
                    {customizingItem.image}
                  </span>
                  <div>
                    <h3 className="text-base font-black text-slate-900">{customizingItem.name}</h3>
                    <p className="text-xs text-red-800 font-bold">
                      Giá gốc: {customizingItem.price.toLocaleString("vi-VN")} đ
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCustomizingItem(null)}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1 text-xs">
                {/* 1. Size Selection */}
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                    1. Chọn Kích Cỡ (Size) <span className="text-red-600">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { size: "S", label: "Size S (350ml)", extra: "+0 đ" },
                      { size: "M", label: "Size M (500ml)", extra: "+6.000 đ" },
                      { size: "L", label: "Size L (650ml)", extra: "+12.000 đ" },
                    ].map((s) => (
                      <button
                        key={s.size}
                        type="button"
                        onClick={() => setCustomState((prev) => ({ ...prev, size: s.size as any }))}
                        className={`rounded-2xl border p-2.5 text-center transition ${
                          customState.size === s.size
                            ? "border-red-600 bg-red-50 text-red-900 ring-2 ring-red-100"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <div className="font-black text-xs">{s.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{s.extra}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Ice Level */}
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                    2. Mức Đá (Ice Level) <span className="text-red-600">*</span>
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: "100%", label: "100% Đá" },
                      { id: "70%", label: "70% Ít đá" },
                      { id: "0%", label: "Không đá" },
                      { id: "hot", label: "Uống nóng" },
                    ].map((ice) => (
                      <button
                        key={ice.id}
                        type="button"
                        onClick={() => setCustomState((prev) => ({ ...prev, ice: ice.id as any }))}
                        className={`rounded-xl border py-2 text-center text-[11px] font-bold transition ${
                          customState.ice === ice.id
                            ? "border-red-600 bg-red-50 text-red-900"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {ice.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Sugar Level */}
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                    3. Mức Đường (Sweetness) <span className="text-red-600">*</span>
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: "100%", label: "100% Chuẩn" },
                      { id: "70%", label: "70% Ít ngọt" },
                      { id: "50%", label: "50% Nửa ngọt" },
                      { id: "0%", label: "0% Không ngọt" },
                    ].map((sugar) => (
                      <button
                        key={sugar.id}
                        type="button"
                        onClick={() => setCustomState((prev) => ({ ...prev, sugar: sugar.id as any }))}
                        className={`rounded-xl border py-2 text-center text-[11px] font-bold transition ${
                          customState.sugar === sugar.id
                            ? "border-red-600 bg-red-50 text-red-900"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {sugar.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Topping Addons */}
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                    4. Thêm Topping Yêu Thích (Tùy chọn)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {TOPPING_OPTIONS.map((t) => {
                      const isSelected = customState.toppings.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setCustomState((prev) => ({
                              ...prev,
                              toppings: isSelected
                                ? prev.toppings.filter((id) => id !== t.id)
                                : [...prev.toppings, t.id],
                            }));
                          }}
                          className={`flex items-center justify-between rounded-xl border p-2.5 text-left transition ${
                            isSelected
                              ? "border-emerald-600 bg-emerald-50/60 text-emerald-950"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span className="text-[11px] font-bold truncate">{t.name}</span>
                          <span className="text-[10px] font-mono font-bold text-red-700 shrink-0 ml-1">
                            +{t.price.toLocaleString("vi-VN")} đ
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 5. Barista Special Note */}
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1">
                    5. Ghi chú cho Barista
                  </label>
                  <input
                    type="text"
                    value={customState.note}
                    onChange={(e) => setCustomState((prev) => ({ ...prev, note: e.target.value }))}
                    placeholder="Ví dụ: Để đá riêng, thêm sữa đặc..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100"
                  />
                </div>
              </div>

              {/* Modal Footer CTA */}
              <div className="border-t border-slate-100 pt-4 mt-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Tổng tiền món này:</span>
                  <span className="text-base font-black text-red-800">
                    {calculateModalPrice().toLocaleString("vi-VN")} đ
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleConfirmCustomization}
                  className="rounded-2xl bg-red-800 hover:bg-red-700 text-white px-5 py-2.5 text-xs font-bold shadow-md shadow-red-900/15 transition active:scale-95"
                >
                  Thêm Vào Giỏ Hàng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* VIETQR PAYMENT MODAL */}
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
                  className="mx-auto size-52 object-contain rounded-xl shadow-sm"
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
                  <span className="font-black text-red-800">{totalAmount.toLocaleString("vi-VN")} đ</span>
                </div>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-red-800 py-3.5 text-sm font-black text-white shadow-lg shadow-red-900/20 hover:bg-red-700 transition active:scale-98"
              >
                {isSubmitting ? "Đang xử lý..." : "Tôi Đã Chuyển Khoản · Xác Nhận"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SUCCESS ORDER CONFIRMATION MODAL */}
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

              {/* Order Status Stepper */}
              <div className="my-4 rounded-2xl bg-slate-50 border border-slate-200 p-3.5 text-left space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>1. Đã tiếp nhận đơn hàng</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-amber-700">
                  <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>2. Barista đang pha chế</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                  <span className="size-2 rounded-full bg-slate-300" />
                  <span>3. Sẵn sàng nhận đồ tại quầy</span>
                </div>
              </div>

              <div className="my-4 rounded-2xl bg-red-50/70 border border-red-200 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mã đơn nhận đồ</span>
                <div className="text-2xl font-black tracking-wider text-red-800">{successOrderNumber}</div>
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
