import { useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Printer,
  ArrowUpRight,
  Wifi,
  Copy,
  Check,
  Building2,
  Clock,
  UserCheck,
  CreditCard,
  Banknote,
  QrCode,
  Box,
  X,
  FileText,
} from "lucide-react";
import type { DeductedIngredient } from "../services/api.ts";

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  size?: string;
  toppings?: string[];
}

export interface ReceiptData {
  orderId: string;
  orderNumber: string;
  subtotal: number;
  vatAmount: number;
  discountAmount?: number;
  finalAmount: number;
  createdAt: string;
  paymentMethod: "Cash" | "QR Transfer" | "Credit Card" | string;
  orderType: "Dine-in" | "Take-away" | string;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  cashierName: string;
  counterName: string;
  items: ReceiptItem[];
  deductedIngredients?: DeductedIngredient[];
  isOffline?: boolean;
}

export interface ReceiptModalProps {
  receipt: ReceiptData;
  onClose: () => void;
  onNewOrder: () => void;
}

export function ReceiptModal({ receipt, onClose, onNewOrder }: ReceiptModalProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "thermal">("summary");

  const handleCopyOrderNumber = () => {
    navigator.clipboard?.writeText(receipt.orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = (() => {
    try {
      const d = new Date(receipt.createdAt);
      return isNaN(d.getTime())
        ? receipt.createdAt
        : d.toLocaleString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
    } catch {
      return receipt.createdAt;
    }
  })();

  const paymentIcon =
    receipt.paymentMethod === "Cash" ? (
      <Banknote size={15} />
    ) : receipt.paymentMethod === "Credit Card" ? (
      <CreditCard size={15} />
    ) : (
      <QrCode size={15} />
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
      {/* Container for on-screen modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-lg my-auto overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200"
      >
        {/* Top Success Banner */}
        <div
          className={`px-6 py-6 text-center text-white ${
            receipt.isOffline
              ? "bg-gradient-to-br from-amber-600 to-amber-800"
              : "bg-gradient-to-br from-emerald-600 to-emerald-800"
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 rounded-full bg-white/20 p-1.5 text-white hover:bg-white/30 transition"
          >
            <X size={18} />
          </button>

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
            className="mx-auto grid size-14 place-items-center rounded-full bg-white/20 ring-4 ring-white/20 shadow-inner"
          >
            <CheckCircle2 size={32} />
          </motion.div>

          <p className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-100">
            {receipt.isOffline ? "Lưu đơn ngoại tuyến thành công" : "Thanh toán thành công (Paid)"}
          </p>
          <h2 className="mt-1 text-3xl font-black tracking-tight">
            {receipt.finalAmount.toLocaleString("vi-VN")} đ
          </h2>

          <div className="mt-2 inline-flex items-center gap-2 rounded-xl bg-black/20 px-3 py-1 font-mono text-xs backdrop-blur-sm">
            <span>#{receipt.orderNumber}</span>
            <button
              type="button"
              onClick={handleCopyOrderNumber}
              title="Sao chép mã đơn"
              className="text-white/80 hover:text-white transition"
            >
              {copied ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />}
            </button>
          </div>
        </div>

        {/* View Switcher: Summary vs Thermal Receipt */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab("summary")}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
              activeTab === "summary"
                ? "border-red-700 text-red-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <FileText size={14} /> Chi tiết đơn hàng
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("thermal")}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
              activeTab === "thermal"
                ? "border-red-700 text-red-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Printer size={14} /> Hóa đơn in nhiệt 80mm
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-5 space-y-4">
          {activeTab === "summary" ? (
            <>
              {/* Meta information grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {paymentIcon} Phương thức
                  </span>
                  <p className="mt-1 font-bold text-slate-800">{receipt.paymentMethod}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <Clock size={12} /> Thời gian
                  </span>
                  <p className="mt-1 font-bold text-slate-800 truncate">{formattedDate}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <Building2 size={12} /> Chi nhánh
                  </span>
                  <p className="mt-1 font-bold text-slate-800 truncate">{receipt.storeName}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <UserCheck size={12} /> Thu ngân
                  </span>
                  <p className="mt-1 font-bold text-slate-800 truncate">{receipt.cashierName}</p>
                </div>
              </div>

              {/* Items summary */}
              <div>
                <p className="mb-2 text-xs font-black text-slate-800 uppercase tracking-wider">
                  Món đã gọi ({receipt.items.reduce((s, i) => s + i.quantity, 0)})
                </p>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 bg-white overflow-hidden">
                  {receipt.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 text-xs">
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-red-800">{item.quantity}×</span>
                          <span className="font-bold text-slate-900 truncate">{item.name}</span>
                          {item.size && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                              Size {item.size}
                            </span>
                          )}
                        </div>
                        {item.toppings && item.toppings.length > 0 && (
                          <p className="mt-0.5 text-[11px] text-amber-700 font-medium">
                            + {item.toppings.join(", ")}
                          </p>
                        )}
                      </div>
                      <span className="font-mono font-bold text-slate-800 shrink-0">
                        {(item.price * item.quantity).toLocaleString("vi-VN")} đ
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Tạm tính</span>
                  <span className="font-mono font-bold text-slate-800">
                    {receipt.subtotal.toLocaleString("vi-VN")} đ
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Thuế GTGT (VAT 8%)</span>
                  <span className="font-mono font-bold text-slate-800">
                    {receipt.vatAmount.toLocaleString("vi-VN")} đ
                  </span>
                </div>
                {receipt.discountAmount ? (
                  <div className="flex justify-between text-emerald-700">
                    <span>Khuyến mãi / Giảm giá</span>
                    <span className="font-mono font-bold">
                      -{receipt.discountAmount.toLocaleString("vi-VN")} đ
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-black text-slate-900">
                  <span>Tổng tiền thanh toán</span>
                  <span className="font-mono text-red-800">
                    {receipt.finalAmount.toLocaleString("vi-VN")} đ
                  </span>
                </div>
              </div>

              {/* Inventory Deductions (BoM) */}
              {receipt.deductedIngredients && receipt.deductedIngredients.length > 0 && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 mb-2">
                    <Box size={14} className="text-blue-700" />
                    <span>Đã tự động khấu trừ định mức tồn kho (BoM):</span>
                  </div>
                  <div className="space-y-1 text-[11px]">
                    {receipt.deductedIngredients.map((ing, i) => (
                      <div key={i} className="flex justify-between text-blue-800">
                        <span>• {ing.ingredientName}</span>
                        <span className="font-mono font-semibold">
                          −{ing.quantityDeducted} (Còn: {ing.balanceAfter})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Outbox Status */}
              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-800">
                <Wifi size={16} className="text-emerald-700 shrink-0" />
                <div>
                  <p className="font-bold">Transactional Outbox Xác Nhận</p>
                  <p className="text-[11px] text-emerald-700">
                    Dữ liệu đơn hàng, thanh toán và vé bếp KDS đã lưu vào CSDL và đồng bộ qua SignalR.
                  </p>
                </div>
              </div>
            </>
          ) : (
            /* Thermal Receipt 80mm Screen Preview */
            <div className="mx-auto max-w-[340px] rounded-2xl border-2 border-dashed border-slate-300 bg-amber-50/20 p-4 font-mono text-xs text-slate-900 shadow-inner">
              <div className="text-center">
                <h3 className="font-black text-sm tracking-wider uppercase">ENTERPRISE COFFEE & TEA</h3>
                <p className="text-[10px] font-bold text-slate-600 uppercase">{receipt.storeName}</p>
                <p className="text-[9px] text-slate-500">{receipt.storeAddress}</p>
                <p className="text-[9px] text-slate-500">Hotline: {receipt.storePhone} · MST: 0318999888</p>
                <div className="my-2 border-b-2 border-dashed border-slate-400" />
                <h4 className="font-black text-xs uppercase tracking-widest">PHIẾU THANH TOÁN</h4>
                <p className="font-black text-[11px]">#{receipt.orderNumber}</p>
              </div>

              <div className="my-2 space-y-0.5 text-[10px]">
                <div className="flex justify-between">
                  <span>Giờ in:</span>
                  <span>{formattedDate}</span>
                </div>
                <div className="flex justify-between">
                  <span>Thu ngân:</span>
                  <span>{receipt.cashierName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Quầy / Ca:</span>
                  <span>{receipt.counterName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Loại đơn:</span>
                  <span className="font-bold uppercase">{receipt.orderType}</span>
                </div>
              </div>

              <div className="my-2 border-b border-dashed border-slate-400" />

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between font-bold text-[10px] uppercase text-slate-500 pb-0.5">
                  <span>Món</span>
                  <span>T.Tiền</span>
                </div>
                {receipt.items.map((it, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between">
                      <span className="font-bold">
                        {it.quantity}x {it.name} {it.size ? `(${it.size})` : ""}
                      </span>
                      <span>{(it.price * it.quantity).toLocaleString("vi-VN")}</span>
                    </div>
                    {it.toppings && it.toppings.length > 0 && (
                      <p className="text-[9px] text-slate-500 pl-3">
                        + {it.toppings.join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="my-2 border-b-2 border-dashed border-slate-400" />

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Tạm tính:</span>
                  <span>{receipt.subtotal.toLocaleString("vi-VN")} đ</span>
                </div>
                <div className="flex justify-between">
                  <span>VAT (8%):</span>
                  <span>{receipt.vatAmount.toLocaleString("vi-VN")} đ</span>
                </div>
                <div className="flex justify-between text-sm font-black pt-1 border-t border-slate-300">
                  <span>TỔNG CỘNG:</span>
                  <span>{receipt.finalAmount.toLocaleString("vi-VN")} đ</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-600">
                  <span>Phương thức:</span>
                  <span className="font-bold uppercase">{receipt.paymentMethod}</span>
                </div>
              </div>

              <div className="my-3 border-b-2 border-dashed border-slate-400" />

              <div className="text-center space-y-1 text-[9px] text-slate-600">
                <p className="font-bold">Pass Wifi: 88888888 (Tầng 1 & 2)</p>
                <p className="font-extrabold uppercase text-[10px]">Cảm ơn Quý khách & Hẹn gặp lại!</p>
                <p className="text-[8px] text-slate-400 mt-1">Hóa đơn điện tử khởi tạo từ máy tính tiền</p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Action Buttons */}
        <div className="grid grid-cols-2 gap-2 border-t border-slate-200 bg-white p-4">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 py-3 text-xs font-black text-slate-800 shadow-sm hover:bg-slate-100 transition active:scale-98"
          >
            <Printer size={16} /> In Hóa Đơn 80mm
          </button>
          <button
            type="button"
            onClick={onNewOrder}
            className="flex items-center justify-center gap-2 rounded-2xl bg-red-800 py-3 text-xs font-black text-white shadow-md shadow-red-900/20 hover:bg-red-700 transition active:scale-98"
          >
            <span>Tạo Đơn Mới</span> <ArrowUpRight size={15} />
          </button>
        </div>
      </motion.div>

      {/* Hidden container dedicated solely for 80mm Thermal Printer when window.print() is called */}
      <div id="printable-thermal-receipt" className="hidden print:block">
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: "900", margin: "0", letterSpacing: "1px" }}>
            ENTERPRISE COFFEE & TEA
          </h2>
          <p style={{ fontSize: "12px", fontWeight: "bold", margin: "2px 0 0 0" }}>{receipt.storeName}</p>
          <p style={{ fontSize: "10px", margin: "2px 0" }}>{receipt.storeAddress}</p>
          <p style={{ fontSize: "10px", margin: "2px 0" }}>Hotline: {receipt.storePhone} · MST: 0318999888</p>
          <p style={{ margin: "4px 0", letterSpacing: "2px" }}>--------------------------------</p>
          <h3 style={{ fontSize: "14px", fontWeight: "bold", margin: "2px 0", letterSpacing: "1px" }}>
            PHIẾU THANH TOÁN (BILL)
          </h3>
          <p style={{ fontSize: "13px", fontWeight: "bold", margin: "2px 0" }}>#{receipt.orderNumber}</p>
        </div>

        <div style={{ fontSize: "11px", margin: "8px 0", lineHeight: "1.4" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Giờ in:</span>
            <span>{formattedDate}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Thu ngân:</span>
            <span>{receipt.cashierName}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Quầy:</span>
            <span>{receipt.counterName}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Loại đơn:</span>
            <span style={{ fontWeight: "bold" }}>{receipt.orderType.toUpperCase()}</span>
          </div>
        </div>

        <p style={{ margin: "4px 0", letterSpacing: "2px" }}>--------------------------------</p>

        <div style={{ fontSize: "11px", margin: "6px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", marginBottom: "4px" }}>
            <span>TÊN MÓN</span>
            <span>SL x GIÁ</span>
            <span>T.TIỀN</span>
          </div>
          {receipt.items.map((it, idx) => (
            <div key={idx} style={{ marginBottom: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: "bold" }}>
                  {it.name} {it.size ? `(${it.size})` : ""}
                </span>
                <span>
                  {it.quantity} x {it.price.toLocaleString("vi-VN")}
                </span>
                <span style={{ fontWeight: "bold" }}>
                  {(it.price * it.quantity).toLocaleString("vi-VN")}
                </span>
              </div>
              {it.toppings && it.toppings.length > 0 && (
                <div style={{ fontSize: "9px", paddingLeft: "10px", color: "#333" }}>
                  + {it.toppings.join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>

        <p style={{ margin: "4px 0", letterSpacing: "2px" }}>--------------------------------</p>

        <div style={{ fontSize: "11px", margin: "6px 0", lineHeight: "1.5" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Tạm tính:</span>
            <span>{receipt.subtotal.toLocaleString("vi-VN")} đ</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Thuế GTGT (VAT 8%):</span>
            <span>{receipt.vatAmount.toLocaleString("vi-VN")} đ</span>
          </div>
          {receipt.discountAmount ? (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Giảm giá:</span>
              <span>-{receipt.discountAmount.toLocaleString("vi-VN")} đ</span>
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "14px",
              fontWeight: "900",
              marginTop: "4px",
              paddingTop: "4px",
              borderTop: "1px dashed #000",
            }}
          >
            <span>TỔNG CỘNG:</span>
            <span>{receipt.finalAmount.toLocaleString("vi-VN")} đ</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginTop: "2px" }}>
            <span>Hình thức thanh toán:</span>
            <span style={{ fontWeight: "bold" }}>{receipt.paymentMethod.toUpperCase()}</span>
          </div>
        </div>

        <p style={{ margin: "6px 0", letterSpacing: "2px" }}>================================</p>

        <div style={{ textAlign: "center", fontSize: "10px", lineHeight: "1.4", marginTop: "6px" }}>
          <p style={{ margin: "2px 0", fontWeight: "bold" }}>Wifi: EnterpriseCoffee · Pass: 88888888</p>
          <p style={{ margin: "2px 0", fontWeight: "900", letterSpacing: "1px" }}>
            CẢM ƠN QUÝ KHÁCH & HẸN GẶP LẠI!
          </p>
          <p style={{ fontSize: "8px", margin: "4px 0 0 0" }}>
            Tra cứu hóa đơn điện tử tại e-invoice.franchise.vn
          </p>
        </div>
      </div>
    </div>
  );
}
