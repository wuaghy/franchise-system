import React, { useState } from 'react';
import {
  Phone,
  Search,
  UserPlus,
  Sparkles,
  Award,
  Ticket,
  Coins,
  CheckCircle2,
  X,
  Tag,
  AlertCircle,
} from 'lucide-react';
import {
  api,
  type CustomerData,
  type CustomerLookupResponse,
  type VoucherData,
  type ApplyPromotionResponse,
} from '../services/api.ts';

export interface LoyaltyModalProps {
  subtotal: number;
  initialCustomer?: CustomerData | null;
  initialVoucherCode?: string;
  initialPointsRedeemed?: number;
  onApply: (data: {
    customer: CustomerData | null;
    voucherCode?: string;
    pointsRedeemed: number;
    promotionSummary: ApplyPromotionResponse;
  }) => void;
  onClose: () => void;
}

const TIER_BADGES = [
  { tier: 0, label: 'Thành viên Chuẩn', discount: '0%', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { tier: 1, label: 'Hội viên Bạc (Silver)', discount: '5%', color: 'bg-slate-200 text-slate-800 border-slate-300' },
  { tier: 2, label: 'Hội viên Vàng (Gold)', discount: '10%', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { tier: 3, label: 'Kim Cương (Diamond)', discount: '15%', color: 'bg-cyan-100 text-cyan-900 border-cyan-300' },
];

export function LoyaltyModal({
  subtotal,
  initialCustomer = null,
  initialVoucherCode = '',
  initialPointsRedeemed = 0,
  onApply,
  onClose,
}: LoyaltyModalProps) {
  const [phoneNumber, setPhoneNumber] = useState(initialCustomer?.phoneNumber || '');
  const [customer, setCustomer] = useState<CustomerData | null>(initialCustomer);
  const [availableVouchers, setAvailableVouchers] = useState<VoucherData[]>([]);
  const [tierDiscountPercent, setTierDiscountPercent] = useState<number>(0);
  const [selectedVoucherCode, setSelectedVoucherCode] = useState<string>(initialVoucherCode);
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(initialPointsRedeemed);

  const [isSearching, setIsSearching] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Tra cứu số điện thoại
  const handleLookup = async (phoneToSearch?: string) => {
    const target = phoneToSearch || phoneNumber;
    if (!target || target.length < 9) {
      setErrorMsg('Vui lòng nhập số điện thoại hợp lệ (ít nhất 9 chữ số)');
      return;
    }
    setErrorMsg(null);
    setIsSearching(true);
    try {
      const res = await api.lookupCustomer(target);
      if (res.found && res.customer) {
        setCustomer(res.customer);
        setTierDiscountPercent(res.tierDiscountPercent);
        setAvailableVouchers(res.availableVouchers);
        setIsRegisterMode(false);
      } else {
        setCustomer(null);
        setTierDiscountPercent(0);
        setAvailableVouchers(res.availableVouchers);
        setIsRegisterMode(true);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi tra cứu khách hàng');
    } finally {
      setIsSearching(false);
    }
  };

  // Đăng ký thành viên mới
  const handleRegister = async () => {
    if (!newFullName.trim()) {
      setErrorMsg('Vui lòng nhập họ và tên khách hàng');
      return;
    }
    setErrorMsg(null);
    setIsSearching(true);
    try {
      const newCust = await api.registerCustomer({
        phoneNumber: phoneNumber.trim(),
        fullName: newFullName.trim(),
        email: newEmail.trim() || undefined,
      });
      setCustomer(newCust);
      setTierDiscountPercent(0);
      setIsRegisterMode(false);
      const vouchers = await api.getActiveVouchers(newCust.phoneNumber);
      setAvailableVouchers(vouchers);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi đăng ký hội viên');
    } finally {
      setIsSearching(false);
    }
  };

  // Xác nhận áp dụng ưu đãi vào đơn
  const handleConfirmPromotion = async () => {
    setIsCalculating(true);
    setErrorMsg(null);
    try {
      const promoResult = await api.applyPromotion({
        phoneNumber: customer?.phoneNumber,
        voucherCode: selectedVoucherCode || undefined,
        pointsToRedeem: pointsToRedeem,
        subtotal: subtotal,
      });

      onApply({
        customer,
        voucherCode: selectedVoucherCode || undefined,
        pointsRedeemed: promoResult.pointsRedeemed,
        promotionSummary: promoResult,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể áp dụng ưu đãi');
    } finally {
      setIsCalculating(false);
    }
  };

  const currentTierInfo = TIER_BADGES[customer?.memberTier ?? 0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-10 place-items-center rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/20">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 leading-tight">Khách Hàng & Ưu Đãi Hội Viên</h2>
              <p className="text-xs text-slate-500 font-medium">Tích điểm · Hạng thẻ (Bạc/Vàng/Kim Cương) · Voucher</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
            <AlertCircle size={15} className="shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {/* SĐT Lookup */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Số điện thoại khách hàng</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="tel"
                  placeholder="09xx xxx xxx"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                  className="w-full rounded-2xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm font-mono font-bold text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => handleLookup()}
                disabled={isSearching}
                className="flex items-center gap-1.5 rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white hover:bg-slate-800 transition disabled:opacity-50"
              >
                <Search size={14} />
                <span>{isSearching ? 'Đang tìm...' : 'Tra cứu'}</span>
              </button>
            </div>
          </div>

          {/* Form đăng ký nhanh nếu chưa có thông tin */}
          {isRegisterMode && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                <UserPlus size={16} className="text-amber-700" />
                <span>Khách hàng mới - Đăng ký nhận 10 điểm chào mừng</span>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Họ và tên (*)</label>
                <input
                  type="text"
                  placeholder="Nguyễn Văn A"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Email (nhận voucher sinh nhật)</label>
                <input
                  type="email"
                  placeholder="khachhang@gmail.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-amber-500"
                />
              </div>
              <button
                type="button"
                onClick={handleRegister}
                disabled={isSearching}
                className="w-full rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 py-2.5 text-xs font-black text-white shadow-sm hover:from-amber-500 hover:to-amber-600 transition"
              >
                {isSearching ? 'Đang lưu...' : 'Hoàn tất đăng ký & Tích điểm'}
              </button>
            </div>
          )}

          {/* Thông tin hội viên sau khi tra cứu thành công */}
          {customer && (
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900">{customer.fullName}</h3>
                  <p className="text-xs font-mono text-slate-500">{customer.phoneNumber}</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${currentTierInfo.color}`}>
                  <Award size={13} />
                  <span>{currentTierInfo.label} (-{currentTierInfo.discount})</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                <div className="rounded-xl bg-white p-2.5 border border-slate-100 shadow-2xs">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Điểm khả dụng</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Coins size={16} className="text-amber-500" />
                    <span className="text-base font-black text-slate-900 font-mono">{customer.loyaltyPoints}</span>
                    <span className="text-[10px] text-slate-400 font-medium">(1đ = 1.000đ)</span>
                  </div>
                </div>
                <div className="rounded-xl bg-white p-2.5 border border-slate-100 shadow-2xs">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Tổng chi tiêu</span>
                  <span className="block text-sm font-black text-emerald-800 font-mono mt-0.5">
                    {customer.totalSpent.toLocaleString('vi-VN')} đ
                  </span>
                </div>
              </div>

              {/* Đổi điểm tích lũy */}
              {customer.loyaltyPoints > 0 && (
                <div className="border-t border-slate-100 pt-3 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">Dùng điểm thưởng khấu trừ đơn:</span>
                    <span className="font-mono font-black text-amber-700">
                      -{(pointsToRedeem * 1000).toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={customer.loyaltyPoints}
                      step={5}
                      value={pointsToRedeem}
                      onChange={(e) => setPointsToRedeem(Number(e.target.value))}
                      className="flex-1 accent-amber-600 cursor-pointer"
                    />
                    <span className="w-12 text-right font-mono font-black text-xs text-slate-800">{pointsToRedeem} đ</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Chọn Voucher khuyến mãi */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Ticket size={14} className="text-red-700" />
                <span>Mã ưu đãi / Voucher</span>
              </label>
              {selectedVoucherCode && (
                <button
                  type="button"
                  onClick={() => setSelectedVoucherCode('')}
                  className="text-[11px] font-bold text-rose-600 hover:underline"
                >
                  Xóa mã
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="text"
                  placeholder="Nhập mã voucher (VD: WELCOME10, VIP20K)..."
                  value={selectedVoucherCode}
                  onChange={(e) => setSelectedVoucherCode(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-xs font-mono font-bold uppercase text-slate-900 outline-none focus:border-red-500"
                />
              </div>
            </div>

            {/* Danh sách Voucher gợi ý */}
            {availableVouchers.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Voucher dành cho bạn:</p>
                <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto">
                  {availableVouchers.map((v) => {
                    const isSelected = selectedVoucherCode === v.code;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVoucherCode(v.code)}
                        className={`flex items-center justify-between p-2 rounded-xl border text-left transition ${
                          isSelected
                            ? 'border-red-500 bg-red-50/70 text-red-950 ring-1 ring-red-500'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-xs text-red-700">{v.code}</span>
                            <span className="text-[11px] font-bold text-slate-700">· {v.title}</span>
                          </div>
                          <p className="text-[10px] text-slate-400">
                            Đơn tối thiểu {v.minOrderAmount.toLocaleString('vi-VN')} đ · HSD: {new Date(v.validTo).toLocaleDateString('vi-VN')}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-black font-mono text-emerald-700">
                          {v.discountType === 1 ? `-${v.discountValue}%` : `-${v.discountValue.toLocaleString('vi-VN')} đ`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="border-t border-slate-100 pt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleConfirmPromotion}
            disabled={isCalculating}
            className="flex-1 rounded-2xl bg-gradient-to-r from-red-800 to-red-700 py-2.5 text-xs font-black text-white shadow-md shadow-red-900/20 hover:from-red-700 hover:to-red-600 transition active:scale-98 disabled:opacity-50"
          >
            {isCalculating ? 'Đang tính...' : 'Áp Dụng Cho Đơn Hàng'}
          </button>
        </div>
      </div>
    </div>
  );
}
