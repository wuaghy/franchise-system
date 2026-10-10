import React, { useState, useMemo } from 'react';
import {
  Banknote,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  X,
  Printer,
  Lock,
  Unlock,
  Coins,
  Receipt,
  FileSpreadsheet,
} from 'lucide-react';
import { api, type ShiftData, type ZReportData } from '../services/api.ts';

export type ShiftModalMode = 'open' | 'movement' | 'close' | 'z-report';

export interface ShiftModalProps {
  mode: ShiftModalMode;
  storeId: string;
  storeName?: string;
  currentShift?: ShiftData | null;
  onClose: () => void;
  onShiftUpdated: () => void;
}

const DENOMINATIONS = [
  { value: 500000, label: '500.000 đ' },
  { value: 200000, label: '200.000 đ' },
  { value: 100000, label: '100.000 đ' },
  { value: 50000, label: '50.000 đ' },
  { value: 20000, label: '20.000 đ' },
  { value: 10000, label: '10.000 đ' },
  { value: 5000, label: '5.000 đ' },
  { value: 2000, label: '2.000 đ' },
  { value: 1000, label: '1.000 đ' },
];

export function ShiftModal({
  mode,
  storeId,
  storeName = 'Chi nhánh Flagship',
  currentShift,
  onClose,
  onShiftUpdated,
}: ShiftModalProps) {
  const [activeTab, setActiveTab] = useState<ShiftModalMode>(mode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Open Shift State
  const [startingCash, setStartingCash] = useState<number>(1000000);
  const [openNotes, setOpenNotes] = useState('');

  // Cash Movement State
  const [movementAmount, setMovementAmount] = useState<number>(50000);
  const [movementType, setMovementType] = useState<number>(2); // 1: In, 2: Out (chi vặt)
  const [movementReason, setMovementReason] = useState('Mua đá viên / túi nilon');

  // Close Shift & Denomination State
  const [counts, setCounts] = useState<Record<number, number>>({
    500000: 0,
    200000: 0,
    100000: 0,
    50000: 0,
    20000: 0,
    10000: 0,
    5000: 0,
    2000: 0,
    1000: 0,
  });
  const [manualCountedCash, setManualCountedCash] = useState<number | null>(null);
  const [closeNotes, setCloseNotes] = useState('');

  // Z-Report State
  const [zReportData, setZReportData] = useState<ZReportData | null>(null);

  // Tính tổng tiền đếm từ các mệnh giá
  const calculatedCountedCash = useMemo(() => {
    return Object.entries(counts).reduce((total, [denom, qty]) => {
      return total + Number(denom) * (qty || 0);
    }, 0);
  }, [counts]);

  const effectiveCountedCash = manualCountedCash !== null ? manualCountedCash : calculatedCountedCash;

  const expectedEndingCash = currentShift ? currentShift.expectedEndingCash : 0;
  const cashDiscrepancy = effectiveCountedCash - expectedEndingCash;

  const handleOpenShift = async () => {
    if (startingCash < 0) {
      setError('Tiền mồi két không được âm.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.openShift({
        storeId,
        startingCash,
        notes: openNotes,
      });
      onShiftUpdated();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Không thể mở ca làm việc.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMovement = async () => {
    if (!currentShift) return;
    if (movementAmount <= 0) {
      setError('Số tiền phải lớn hơn 0 đồng.');
      return;
    }
    if (!movementReason.trim()) {
      setError('Vui lòng nhập lý do thu/chi tiền.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.addCashMovement(currentShift.id, {
        amount: movementAmount,
        type: movementType,
        reason: movementReason,
      });
      onShiftUpdated();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Không thể ghi nhận biến động két.');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async () => {
    if (!currentShift) return;
    setLoading(true);
    setError(null);
    try {
      const closed = await api.closeShift(currentShift.id, {
        actualEndingCash: effectiveCountedCash,
        notes: closeNotes,
      });
      // Load Z-Report
      const zReport = await api.getZReport(closed.id);
      setZReportData(zReport);
      setActiveTab('z-report');
      onShiftUpdated();
    } catch (err: any) {
      setError(err?.message || 'Không thể chốt ca.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-amber-700 to-amber-900 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-white/15 text-white shadow-inner">
              <Banknote size={22} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-200">
                  Quản Lý Két Tiền & Ca Thu Ngân
                </span>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">
                  {currentShift ? `Ca đang mở: ${currentShift.shiftNumber}` : 'Chưa mở ca'}
                </span>
              </div>
              <h2 className="text-lg font-black tracking-tight text-white">
                {activeTab === 'open' && 'Mở Ca Mới & Nạp Tiền Mồi Két'}
                {activeTab === 'movement' && 'Biến Động Tiền Mặt (Chi Vặt / Nạp Két)'}
                {activeTab === 'close' && 'Chốt Ca Làm Việc (Z-Report Closing)'}
                {activeTab === 'z-report' && 'Phiếu Bàn Giao Ca & Báo Cáo Z (80mm)'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation (when shift is open) */}
        {currentShift && activeTab !== 'z-report' && (
          <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('movement')}
              className={`border-b-2 px-4 py-2 text-xs font-extrabold transition ${
                activeTab === 'movement'
                  ? 'border-amber-600 text-amber-900 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              💸 Chi Vặt / Nạp Két
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('close')}
              className={`border-b-2 px-4 py-2 text-xs font-extrabold transition ${
                activeTab === 'close'
                  ? 'border-red-600 text-red-900 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              🔒 Chốt Ca (Z-Report)
            </button>
          </div>
        )}

        {/* Body Container */}
        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700 border border-red-200">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: MỞ CA */}
          {activeTab === 'open' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Tiền lẻ mồi két đầu ca (Opening Cash Float)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={startingCash}
                    onChange={(e) => setStartingCash(Number(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-lg font-black text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                  />
                  <span className="absolute right-4 top-3.5 text-xs font-black text-slate-400">VND</span>
                </div>

                {/* Quick Select Buttons */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {[500000, 1000000, 1500000, 2000000, 3000000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setStartingCash(amt)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-extrabold transition ${
                        startingCash === amt
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {amt.toLocaleString('vi-VN')} đ
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Ghi chú mở ca (Tùy chọn)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Nhận két từ quản lý ca sáng, đủ mệnh giá 1k-50k..."
                  value={openNotes}
                  onChange={(e) => setOpenNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleOpenShift}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 py-3.5 text-sm font-black text-white shadow-lg shadow-amber-900/20 transition hover:from-amber-700 hover:to-amber-800 disabled:opacity-50"
              >
                <Unlock size={18} />
                <span>{loading ? 'Đang mở ca...' : 'Xác Nhận Mở Ca & Bắt Đầu Bán Hàng'}</span>
              </button>
            </div>
          )}

          {/* TAB 2: BIẾN ĐỘNG KÉT (CASH MOVEMENT) */}
          {activeTab === 'movement' && currentShift && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMovementType(2);
                    setMovementReason('Mua đá viên / túi nilon');
                  }}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-black transition ${
                    movementType === 2
                      ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-sm'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <TrendingDown size={16} />
                  <span>Chi Tiền Vặt (Cash Out)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMovementType(1);
                    setMovementReason('Nạp thêm tiền lẻ thối');
                  }}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-black transition ${
                    movementType === 1
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <TrendingUp size={16} />
                  <span>Nạp Thêm Tiền Két (Cash In)</span>
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Số tiền {movementType === 2 ? 'xuất két chi' : 'nạp vào'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={movementAmount}
                    onChange={(e) => setMovementAmount(Number(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-black text-slate-900 focus:outline-none"
                  />
                  <span className="absolute right-4 top-3.5 text-xs font-black text-slate-400">VND</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Lý do chứng từ chi tiết
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Mua 2 bao đá bi khẩn cấp, mua cuộn in bill..."
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleAddMovement}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-600 py-3 text-sm font-black text-white shadow-md transition hover:bg-amber-700 disabled:opacity-50"
              >
                <span>{loading ? 'Đang lưu...' : 'Lưu Chứng Từ Biến Động Két'}</span>
              </button>
            </div>
          )}

          {/* TAB 3: CHỐT CA (CLOSE SHIFT) */}
          {activeTab === 'close' && currentShift && (
            <div className="space-y-5">
              {/* Summary Header */}
              <div className="grid grid-cols-3 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Mở két đầu ca</span>
                  <p className="text-xs font-black text-slate-800">{currentShift.startingCash.toLocaleString('vi-VN')} đ</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Bán tiền mặt</span>
                  <p className="text-xs font-black text-emerald-700">+{currentShift.totalCashSales.toLocaleString('vi-VN')} đ</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Lý thuyết trong két</span>
                  <p className="text-sm font-black text-amber-900">{expectedEndingCash.toLocaleString('vi-VN')} đ</p>
                </div>
              </div>

              {/* Bảng kê đếm mệnh giá */}
              <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Coins size={16} className="text-amber-600" />
                    Bảng Kê Đếm Tiền Mặt Thực Tế Theo Mệnh Giá
                  </span>
                  <span className="text-xs font-black text-amber-700 font-mono">
                    Tổng đếm: {calculatedCountedCash.toLocaleString('vi-VN')} đ
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {DENOMINATIONS.map((d) => (
                    <div key={d.value} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-2 text-xs">
                      <span className="font-bold text-slate-600">{d.label}</span>
                      <input
                        type="number"
                        min="0"
                        value={counts[d.value] || ''}
                        placeholder="0"
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          setCounts((prev) => ({ ...prev, [d.value]: val }));
                          setManualCountedCash(null); // Clear manual overwrite
                        }}
                        className="w-12 rounded-lg border border-slate-200 bg-white py-1 text-center font-black text-slate-900 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* So sánh & Chênh lệch (Variance) */}
              <div className={`rounded-2xl border p-4 text-center ${
                cashDiscrepancy === 0
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : cashDiscrepancy < 0
                  ? 'border-rose-200 bg-rose-50 text-rose-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}>
                <div className="flex items-center justify-between text-xs">
                  <span>Tiền đếm thực tế: <strong>{effectiveCountedCash.toLocaleString('vi-VN')} đ</strong></span>
                  <span>Lý thuyết hệ thống: <strong>{expectedEndingCash.toLocaleString('vi-VN')} đ</strong></span>
                </div>
                <div className="mt-2 text-sm font-black">
                  {cashDiscrepancy === 0 && '✅ Tiền két khớp 100% (Không lệch)'}
                  {cashDiscrepancy < 0 && `❌ Két bị THIẾU: ${Math.abs(cashDiscrepancy).toLocaleString('vi-VN')} đ (Thu ngân phải bù)`}
                  {cashDiscrepancy > 0 && `⚠️ Két bị THỪA: ${cashDiscrepancy.toLocaleString('vi-VN')} đ (Nghi thối thiếu tiền khách)`}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Ghi chú chốt ca / Giải trình chênh lệch
                </label>
                <input
                  type="text"
                  placeholder="Ghi chú đối soát cuối ca..."
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleCloseShift}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 py-3.5 text-sm font-black text-white shadow-lg shadow-rose-900/20 transition hover:from-red-700 hover:to-rose-800 disabled:opacity-50"
              >
                <Lock size={18} />
                <span>{loading ? 'Đang chốt ca...' : 'Xác Nhận Chốt Ca & In Báo Cáo Z'}</span>
              </button>
            </div>
          )}

          {/* TAB 4: XEM & IN Z-REPORT */}
          {activeTab === 'z-report' && zReportData && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 font-mono text-xs text-slate-800 space-y-3 shadow-inner">
                <div className="text-center border-b border-dashed border-slate-300 pb-3">
                  <h3 className="text-sm font-black text-slate-900">PHIẾU BÀN GIAO CA (Z-REPORT)</h3>
                  <p className="text-[11px] text-slate-500">{zReportData.storeName}</p>
                  <p className="text-[10px] text-slate-400">Mã ca: {zReportData.shiftNumber}</p>
                </div>

                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span>Thu ngân:</span>
                    <strong>{zReportData.cashierName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Mở ca:</span>
                    <span>{new Date(zReportData.openedAt).toLocaleTimeString('vi-VN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Chốt ca:</span>
                    <span>{new Date(zReportData.closedAt).toLocaleTimeString('vi-VN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Số đơn hàng:</span>
                    <strong>{zReportData.totalOrdersCount} đơn</strong>
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span>Tiền mồi đầu ca:</span>
                    <span>{zReportData.startingCash.toLocaleString('vi-VN')} đ</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>Thu tiền mặt:</span>
                    <strong>+{zReportData.totalCashSales.toLocaleString('vi-VN')} đ</strong>
                  </div>
                  <div className="flex justify-between text-blue-700">
                    <span>Thu chuyển khoản (VietQR):</span>
                    <strong>+{zReportData.totalBankTransferSales.toLocaleString('vi-VN')} đ</strong>
                  </div>
                  <div className="flex justify-between text-purple-700">
                    <span>Thu thẻ POS:</span>
                    <strong>+{zReportData.totalCardSales.toLocaleString('vi-VN')} đ</strong>
                  </div>
                  <div className="flex justify-between font-black text-slate-900 border-t border-slate-200 pt-1">
                    <span>TỔNG DOANH THU CA:</span>
                    <span>{zReportData.totalRevenue.toLocaleString('vi-VN')} đ</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span>Két lý thuyết:</span>
                    <strong>{zReportData.expectedEndingCash.toLocaleString('vi-VN')} đ</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Đếm thực tế:</span>
                    <strong>{zReportData.actualEndingCash.toLocaleString('vi-VN')} đ</strong>
                  </div>
                  <div className={`flex justify-between font-black ${
                    zReportData.cashDiscrepancy < 0 ? 'text-red-600' : 'text-emerald-700'
                  }`}>
                    <span>Chênh lệch két:</span>
                    <span>{zReportData.cashDiscrepancy.toLocaleString('vi-VN')} đ</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-300 pt-4 text-center text-[10px] text-slate-400">
                  <p>Ký tên thu ngân: ........................</p>
                  <p className="mt-2">Ký tên quản lý: ........................</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-xs font-black text-white hover:bg-slate-800"
                >
                  <Printer size={16} />
                  <span>In Phiếu Z-Report (80mm)</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs font-black text-slate-700 hover:bg-slate-50"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
