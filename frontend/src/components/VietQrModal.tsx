import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  QrCode,
  Radio,
  RefreshCcw,
  Sparkles,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import { audioNotifier } from "../services/audioNotification.ts";

export interface VietQrModalProps {
  orderCode: string;
  amount: number;
  storeName?: string;
  onSuccess: () => Promise<void> | void;
  onClose: () => void;
  isProcessing?: boolean;
}

export function VietQrModal({
  orderCode,
  amount,
  storeName = "Chi nhánh Quận 1 (Flagship Store)",
  onSuccess,
  onClose,
  isProcessing = false,
}: VietQrModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(300); // 5 minutes
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [simulatingIpn, setSimulatingIpn] = useState(false);

  const bankCode = "vietinbank";
  const bankName = "VietinBank (Ngân Hàng TMCP Công Thương VN)";
  const accountNumber = "100878137043";
  const accountName = "NGUYEN QUANG HUY";
  const transferNote = orderCode;

  // VietQR Napas dynamic QR URL
  const qrUrl = `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact2.png?amount=${Math.round(
    amount
  )}&addInfo=${encodeURIComponent(transferNote)}&accountName=${encodeURIComponent(accountName)}`;

  // Countdown timer
  useEffect(() => {
    if (paymentConfirmed) return;
    const interval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [paymentConfirmed]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSimulateIpn = async () => {
    setSimulatingIpn(true);
    // Simulate real-time Napas 24/7 bank response delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    setPaymentConfirmed(true);
    setSimulatingIpn(false);

    // Audio chime
    audioNotifier.playOrderChime("standard");

    // Vietnamese Text-to-speech announcement
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        const text = `Đã nhận thành công ${amount.toLocaleString("vi-VN")} đồng qua VietQR Napas cho đơn hàng ${orderCode}.`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "vi-VN";
        utterance.rate = 1.05;
        window.speechSynthesis.speak(utterance);
      } catch {
        // Audio policy or speech synthesis not ready
      }
    }

    // Call success handler after brief confirmation animation
    setTimeout(async () => {
      await onSuccess();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        {/* Top Header Banner */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-red-800 to-amber-700 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-white/15 text-white shadow-inner">
              <QrCode size={22} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-200">
                  Cổng Thanh Toán Napas 24/7
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                  Live Napas
                </span>
              </div>
              <h2 className="text-lg font-black tracking-tight text-white">Quét Mã VietQR Động Tại Quầy</h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing || simulatingIpn || paymentConfirmed}
            className="grid size-9 place-items-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="grid gap-6 p-6 sm:grid-cols-12 sm:gap-8">
          {/* Left Column: QR Code & Status */}
          <div className="flex flex-col items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-5 text-center sm:col-span-5">
            <div className="w-full">
              <div className="mb-2 flex items-center justify-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                <Clock size={13} className="text-red-700" />
                <span>Hiệu lực còn:</span>
                <span className={`font-mono font-black ${countdown < 60 ? "text-rose-600 animate-pulse" : "text-slate-800"}`}>
                  {formatTime(countdown)}
                </span>
              </div>

              {/* QR Image Container with Scanner Frame */}
              <div className="relative mx-auto aspect-square w-full max-w-[210px] overflow-hidden rounded-2xl border-2 border-red-700/20 bg-white p-2.5 shadow-md transition hover:scale-105">
                <img
                  src={qrUrl}
                  alt={`VietQR ${orderCode}`}
                  className="size-full object-contain"
                  loading="eager"
                />

                {paymentConfirmed && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-600/90 text-white backdrop-blur-xs animate-in zoom-in-95 duration-200">
                    <CheckCircle2 size={48} className="animate-bounce" />
                    <span className="mt-1 text-xs font-black">Khớp Lệnh Thành Công!</span>
                    <span className="text-[10px] text-emerald-100">Đang in hóa đơn...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Waiting Radar Pulse */}
            <div className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-2xs">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-600 opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-red-700" />
              </span>
              <span>Đang đợi khách quét mã...</span>
            </div>
          </div>

          {/* Right Column: Transaction Details & Actions */}
          <div className="flex flex-col justify-between sm:col-span-7">
            <div className="space-y-4">
              {/* Total Amount Badge */}
              <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4">
                <span className="block text-[11px] font-extrabold uppercase tracking-wider text-red-800">
                  Số tiền thanh toán chính xác
                </span>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-red-900 tracking-tight">
                    {amount.toLocaleString("vi-VN")}
                  </span>
                  <span className="text-sm font-black text-red-700">VNĐ</span>
                </div>
                <p className="mt-1 text-[11px] text-red-700/80">
                  Đã bao gồm 8% thuế GTGT (VAT) & công thức định mức BoM.
                </p>
              </div>

              {/* Bank Transfer Info Fields */}
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/90 bg-white text-xs">
                {/* Bank Name */}
                <div className="flex items-center justify-between p-3">
                  <span className="font-bold text-slate-500">Ngân hàng thụ hưởng:</span>
                  <span className="font-black text-slate-900 text-right">{bankName}</span>
                </div>

                {/* Account Number */}
                <div className="flex items-center justify-between p-3">
                  <span className="font-bold text-slate-500">Số tài khoản:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black text-red-800">{accountNumber}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(accountNumber, "acc")}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      title="Sao chép số tài khoản"
                    >
                      {copiedField === "acc" ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                {/* Account Name */}
                <div className="flex items-center justify-between p-3">
                  <span className="font-bold text-slate-500">Chủ tài khoản:</span>
                  <span className="font-extrabold uppercase text-slate-900">{accountName}</span>
                </div>

                {/* Transfer Content */}
                <div className="flex items-center justify-between p-3">
                  <span className="font-bold text-slate-500">Nội dung chuyển khoản:</span>
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-amber-50 px-2 py-0.5 font-mono text-xs font-black text-amber-900 border border-amber-200">
                      {transferNote}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(transferNote, "note")}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      title="Sao chép nội dung"
                    >
                      {copiedField === "note" ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="mt-6 space-y-2">
              <button
                type="button"
                onClick={handleSimulateIpn}
                disabled={isProcessing || simulatingIpn || paymentConfirmed}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-900/20 transition hover:from-emerald-700 hover:to-teal-800 active:scale-[0.99] disabled:opacity-50"
              >
                {simulatingIpn ? (
                  <>
                    <RefreshCcw size={18} className="animate-spin" />
                    <span>Đang xác nhận qua cổng Napas IPN...</span>
                  </>
                ) : paymentConfirmed ? (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Đã Khớp Lệnh Napas 24/7!</span>
                  </>
                ) : (
                  <>
                    <Zap size={18} className="text-amber-300 fill-amber-300" />
                    <span>Khách Đã Chuyển Khoản (Giả Lập IPN / Webhook)</span>
                  </>
                )}
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isProcessing || simulatingIpn || paymentConfirmed}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-extrabold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Đổi Phương Thức Thanh Toán
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-2.5 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Chi nhánh: {storeName}</span>
          <span className="font-mono">Chuẩn VietQR · Napas 24/7 Switch</span>
        </div>
      </div>
    </div>
  );
}
