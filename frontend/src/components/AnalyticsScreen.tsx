import React, { useState, useEffect } from 'react';
import { 
  api, 
  StoreItem, 
  AdvancedPeakHoursAnalysis, 
  TopSellerItem, 
  WasteShrinkageReport, 
  LowStockAlert, 
  AlertBroadcastResult,
  InventoryItem 
} from '../services/api.ts';

interface AnalyticsScreenProps {
  currentStoreId?: string;
  stores?: StoreItem[];
}

export const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({ currentStoreId, stores = [] }) => {
  const [selectedStoreId, setSelectedStoreId] = useState<string>(currentStoreId || (stores[0]?.id || ''));
  const [activeTab, setActiveTab] = useState<'peakhours' | 'topsellers' | 'waste' | 'alerts'>('peakhours');
  const [loading, setLoading] = useState(false);

  // Data states
  const [peakHoursData, setPeakHoursData] = useState<AdvancedPeakHoursAnalysis | null>(null);
  const [topSellersData, setTopSellersData] = useState<TopSellerItem[]>([]);
  const [wasteData, setWasteData] = useState<WasteShrinkageReport | null>(null);
  const [lowStockItems, setLowStockItems] = useState<LowStockAlert[]>([]);
  const [allInventory, setAllInventory] = useState<InventoryItem[]>([]);

  // Alert & Broadcast state
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<AlertBroadcastResult | null>(null);
  const [managerEmail, setManagerEmail] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [saveConfigSuccess, setSaveConfigSuccess] = useState(false);

  // Waste Recording Modal
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [wasteIngredientId, setWasteIngredientId] = useState('');
  const [wasteQuantity, setWasteQuantity] = useState<number>(1);
  const [wasteReason, setWasteReason] = useState('Đổ vỡ trong quá trình pha chế');
  const [wasteSubmitting, setWasteSubmitting] = useState(false);

  useEffect(() => {
    if (selectedStoreId) {
      loadData(selectedStoreId);
    }
  }, [selectedStoreId]);

  const loadData = async (storeId: string) => {
    setLoading(true);
    try {
      const [peakRes, topRes, wasteRes, lowStockRes, invRes] = await Promise.allSettled([
        api.getPeakHoursAnalysis(storeId),
        api.getTopSellers(storeId),
        api.getWasteShrinkageReport(storeId),
        api.getLowStockAlerts(storeId),
        api.getStoreInventory(storeId)
      ]);

      if (peakRes.status === 'fulfilled') setPeakHoursData(peakRes.value);
      if (topRes.status === 'fulfilled') setTopSellersData(topRes.value);
      if (wasteRes.status === 'fulfilled') setWasteData(wasteRes.value);
      if (lowStockRes.status === 'fulfilled') setLowStockItems(lowStockRes.value);
      if (invRes.status === 'fulfilled') setAllInventory(invRes.value);
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBroadcastAlert = async () => {
    if (!selectedStoreId) return;
    setIsBroadcasting(true);
    setBroadcastResult(null);
    try {
      const result = await api.broadcastLowStockAlerts(selectedStoreId, {
        customTelegramChatId: telegramChatId || undefined,
        customManagerEmail: managerEmail || undefined
      });
      setBroadcastResult(result);
    } catch (err: any) {
      alert('Lỗi phát cảnh báo: ' + (err.message || 'Không thể kết nối'));
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
        telegramChatId: telegramChatId || undefined
      });
      setSaveConfigSuccess(true);
      setTimeout(() => setSaveConfigSuccess(false), 3000);
    } catch (err: any) {
      alert('Lỗi lưu cấu hình: ' + (err.message || 'Thất bại'));
    }
  };

  const handleRecordWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStoreId || !wasteIngredientId || wasteQuantity <= 0) {
      alert('Vui lòng chọn nguyên liệu và số lượng hợp lệ.');
      return;
    }
    setWasteSubmitting(true);
    try {
      await api.recordWaste(selectedStoreId, {
        storeId: selectedStoreId,
        ingredientId: wasteIngredientId,
        quantity: wasteQuantity,
        reason: wasteReason
      });
      setShowWasteModal(false);
      setWasteQuantity(1);
      setWasteReason('Đổ vỡ trong quá trình pha chế');
      // Tải lại báo cáo hao hụt và tồn kho
      await loadData(selectedStoreId);
      alert('Đã ghi nhận xuất hủy hao hụt thành công!');
    } catch (err: any) {
      alert('Lỗi ghi nhận xuất hủy: ' + (err.message || 'Thất bại'));
    } finally {
      setWasteSubmitting(false);
    }
  };

  const maxRevenue = peakHoursData?.hourlyDistribution 
    ? Math.max(...peakHoursData.hourlyDistribution.map(h => h.revenue), 1)
    : 1;

  return (
    <div className="flex-1 bg-slate-900 text-slate-100 flex flex-col h-full overflow-y-auto p-4 md:p-6">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📊</span>
            <h1 className="text-xl md:text-2xl font-bold text-white">
              Báo cáo Phân tích Chuyên sâu & Cảnh báo Tồn kho
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Phân tích khung giờ cao điểm F&B, ma trận thực đơn, tỷ lệ hao hụt nguyên liệu và cảnh báo Telegram/Email.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {stores.length > 0 && (
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  🏬 {s.name} ({s.code})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => selectedStoreId && loadData(selectedStoreId)}
            disabled={loading}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm font-medium transition text-slate-300 hover:text-white"
          >
            {loading ? 'Đang tải...' : '🔄 Làm mới'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mt-6 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('peakhours')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'peakhours'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <span>⏰</span> Khung Giờ Vàng (Peak Hours)
        </button>

        <button
          onClick={() => setActiveTab('topsellers')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'topsellers'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <span>🏆</span> Món Bán Chạy (Menu Matrix)
        </button>

        <button
          onClick={() => setActiveTab('waste')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'waste'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <span>📉</span> Tỷ Lệ Hao Hụt (Waste/Shrinkage)
        </button>

        <button
          onClick={() => setActiveTab('alerts')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'alerts'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <span>🚨</span> Cảnh Báo Tồn Kho & Bot Telegram
          {lowStockItems.length > 0 && (
            <span className="bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full font-bold ml-1">
              {lowStockItems.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Peak Hours */}
      {activeTab === 'peakhours' && (
        <div className="space-y-6 mt-6">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4">
              <span className="text-xs uppercase font-bold text-amber-400">Khung Giờ Đông Nhất</span>
              <p className="text-2xl font-black text-white mt-2">
                {peakHoursData?.busiestHourRange || 'Chưa có'}
              </p>
              <p className="text-xs text-slate-400 mt-1">Đỉnh điểm lượng khách trong ngày</p>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4">
              <span className="text-xs uppercase font-bold text-emerald-400">Doanh Thu Giờ Cao Điểm</span>
              <p className="text-2xl font-black text-emerald-300 mt-2">
                {(peakHoursData?.peakHourRevenue || 0).toLocaleString()} đ
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Chiếm {peakHoursData?.totalRevenue ? Math.round(((peakHoursData.peakHourRevenue || 0) / peakHoursData.totalRevenue) * 100) : 0}% tổng doanh thu ngày
              </p>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4">
              <span className="text-xs uppercase font-bold text-sky-400">Định Biên Nhân Sự Ca Cao Điểm</span>
              <p className="text-2xl font-black text-sky-300 mt-2">
                {peakHoursData?.recommendedStaffingOnPeak || 3} nhân sự
              </p>
              <p className="text-xs text-slate-400 mt-1">1 thu ngân, 2 pha chế + hỗ trợ</p>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4">
              <span className="text-xs uppercase font-bold text-indigo-400">Định Biên Nhân Sự Ca Thường</span>
              <p className="text-2xl font-black text-indigo-300 mt-2">
                {peakHoursData?.recommendedStaffingOffPeak || 2} nhân sự
              </p>
              <p className="text-xs text-slate-400 mt-1">Tối ưu chi phí lao động (Labor Cost)</p>
            </div>
          </div>

          {/* 24h Hourly Heatmap Bar Chart */}
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>📊</span> Biểu Đồ Phân Bổ Doanh Thu & Lưu Lượng Đơn Theo 24 Giờ
              </h2>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-amber-500"></span>
                  <span className="text-slate-300">Giờ Cao Điểm (Peak)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-slate-600"></span>
                  <span className="text-slate-400">Giờ Thường (Off-Peak)</span>
                </div>
              </div>
            </div>

            <div className="h-64 flex items-end gap-1.5 pt-8 pb-4 px-2 border-b border-slate-700">
              {peakHoursData?.hourlyDistribution.map((point) => {
                const heightPercent = Math.max(8, Math.round((point.revenue / maxRevenue) * 100));
                return (
                  <div
                    key={point.hour}
                    className="flex-1 flex flex-col items-center h-full justify-end group relative"
                  >
                    {/* Tooltip */}
                    <div className="absolute -top-14 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-slate-950 text-white border border-slate-700 text-xs px-2 py-1 rounded shadow-xl whitespace-nowrap z-20">
                      <p className="font-bold">{point.hour}:00 - {point.hour + 1}:00</p>
                      <p className="text-amber-400">{point.revenue.toLocaleString()} đ ({point.orderCount} đơn)</p>
                    </div>

                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-t transition-all ${
                        point.isPeakHour
                          ? 'bg-amber-500 hover:bg-amber-400 shadow-md shadow-amber-500/20'
                          : 'bg-slate-700 hover:bg-slate-600'
                      }`}
                    ></div>
                    <span className="text-[10px] text-slate-400 mt-2">
                      {point.hour}h
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-slate-400 mt-3 italic">
              💡 Khung giờ cao điểm F&B thông thường: 07:00 - 09:00 (Cà phê sáng), 11:30 - 13:30 (Trưa văn phòng), 18:30 - 21:00 (Tối tụ họp).
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: Top Sellers & Menu Matrix */}
      {activeTab === 'topsellers' && (
        <div className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-amber-950/40 border border-amber-800/40 rounded-xl p-4">
              <span className="text-xs uppercase font-bold text-amber-400">🌟 Star (Ngôi Sao)</span>
              <p className="text-xs text-slate-300 mt-1">Lợi nhuận cao & Bán rất chạy. Duy trì công thức chuẩn và vị trí trang bìa.</p>
            </div>
            <div className="bg-sky-950/40 border border-sky-800/40 rounded-xl p-4">
              <span className="text-xs uppercase font-bold text-sky-400">🐎 Plowhorse (Ngựa Thồ)</span>
              <p className="text-xs text-slate-300 mt-1">Bán rất chạy nhưng biên lãi thấp. Cân nhắc tăng giá nhẹ hoặc tối ưu cost nguyên liệu.</p>
            </div>
            <div className="bg-purple-950/40 border border-purple-800/40 rounded-xl p-4">
              <span className="text-xs uppercase font-bold text-purple-400">❓ Puzzle (Ẩn Số)</span>
              <p className="text-xs text-slate-300 mt-1">Biên lãi rất cao nhưng ít khách biết. Đẩy mạnh upsell tại quầy POS hoặc đặt làm combo.</p>
            </div>
            <div className="bg-rose-950/40 border border-rose-800/40 rounded-xl p-4">
              <span className="text-xs uppercase font-bold text-rose-400">🐶 Dog (Kém)</span>
              <p className="text-xs text-slate-300 mt-1">Kém cả doanh số lẫn lợi nhuận. Cân nhắc loại khỏi menu để tinh gọn tồn kho.</p>
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <h2 className="font-bold text-white text-base">Xếp Hạng Sản Phẩm & Ma Trận Thực Đơn F&B</h2>
              <span className="text-xs text-slate-400">Top {topSellersData.length} món chủ lực</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/60 text-slate-400 uppercase text-xs font-semibold">
                  <tr>
                    <th className="py-3 px-4">Xếp hạng</th>
                    <th className="py-3 px-4">Tên Món</th>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4 text-right">Số Lượng Bán</th>
                    <th className="py-3 px-4 text-right">Doanh Thu</th>
                    <th className="py-3 px-4 text-right">Lợi Nhuận Gộp</th>
                    <th className="py-3 px-4 text-right">Biên Lãi (%)</th>
                    <th className="py-3 px-4 text-center">Phân Nhóm Menu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40 text-slate-300">
                  {topSellersData.map((item, idx) => {
                    const badgeColor =
                      item.menuClassification === 'Star'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : item.menuClassification === 'Plowhorse'
                        ? 'bg-sky-500/20 text-sky-400 border-sky-500/30'
                        : item.menuClassification === 'Puzzle'
                        ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                        : 'bg-rose-500/20 text-rose-400 border-rose-500/30';

                    return (
                      <tr key={item.productId} className="hover:bg-slate-700/30 transition">
                        <td className="py-3 px-4 font-bold text-slate-400">#{idx + 1}</td>
                        <td className="py-3 px-4 font-semibold text-white">{item.productName}</td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-400">{item.sku}</td>
                        <td className="py-3 px-4 text-right font-bold text-amber-400">{item.unitsSold} ly</td>
                        <td className="py-3 px-4 text-right font-semibold text-emerald-400">{item.revenue.toLocaleString()} đ</td>
                        <td className="py-3 px-4 text-right">{item.estimatedProfit.toLocaleString()} đ</td>
                        <td className="py-3 px-4 text-right font-bold">{item.marginPercentage}%</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${badgeColor}`}>
                            {item.menuClassification}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {topSellersData.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        Chưa có dữ liệu bán hàng cho chi nhánh này.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Waste & Shrinkage */}
      {activeTab === 'waste' && (
        <div className="space-y-6 mt-6">
          {/* Summary Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4">
              <span className="text-xs uppercase font-bold text-slate-400">Tỷ Lệ Hao Hụt Toàn Quán</span>
              <div className="flex items-baseline gap-3 mt-2">
                <span className="text-3xl font-black text-rose-400">
                  {wasteData?.overallShrinkageRatePercentage || 0}%
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-slate-700 text-slate-200">
                  {wasteData?.healthRating || 'Đang tính toán'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">Chuẩn ngành F&B chấp nhận &lt; 2.0%</p>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4">
              <span className="text-xs uppercase font-bold text-slate-400">Chi Phí Tổn Thất Do Hao Hụt</span>
              <p className="text-3xl font-black text-rose-400 mt-2">
                {(wasteData?.totalWasteCost || 0).toLocaleString()} đ
              </p>
              <p className="text-xs text-slate-400 mt-2">Giá vốn xuất hủy, rơi vỡ, hết hạn</p>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-xs uppercase font-bold text-slate-400">Hành Động Khai Báo</span>
                <p className="text-xs text-slate-300 mt-1">Ghi nhận ngay khi barista làm đổ vỡ hoặc phát hiện nguyên liệu hư hỏng.</p>
              </div>
              <button
                onClick={() => setShowWasteModal(true)}
                className="mt-3 w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm rounded-lg transition shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2"
              >
                <span>➕</span> Khai Báo Xuất Hủy / Đổ Vỡ Nhanh
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <h2 className="font-bold text-white text-base">Bảng Chi Tiết Hao Hụt Từng Nguyên Liệu</h2>
              <span className="text-xs text-slate-400">30 ngày gần nhất</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/60 text-slate-400 uppercase text-xs font-semibold">
                  <tr>
                    <th className="py-3 px-4">Mã</th>
                    <th className="py-3 px-4">Nguyên Liệu</th>
                    <th className="py-3 px-4 text-right">Xuất Bán Lý Thuyết</th>
                    <th className="py-3 px-4 text-right">Xuất Hủy Hao Hụt</th>
                    <th className="py-3 px-4 text-right">Tổn Thất (VND)</th>
                    <th className="py-3 px-4 text-right">Tỷ Lệ Hao Hụt</th>
                    <th className="py-3 px-4 text-center">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40 text-slate-300">
                  {wasteData?.items.map((item) => (
                    <tr key={item.ingredientId} className="hover:bg-slate-700/30 transition">
                      <td className="py-3 px-4 font-mono text-xs text-slate-400">{item.ingredientCode}</td>
                      <td className="py-3 px-4 font-semibold text-white">{item.ingredientName}</td>
                      <td className="py-3 px-4 text-right">{item.theoreticalUsage.toFixed(2)} {item.unit}</td>
                      <td className="py-3 px-4 text-right text-rose-400 font-bold">{item.wastedQuantity.toFixed(2)} {item.unit}</td>
                      <td className="py-3 px-4 text-right font-semibold">{item.totalWasteCost.toLocaleString()} đ</td>
                      <td className="py-3 px-4 text-right font-bold">{item.shrinkageRatePercentage}%</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                            item.status === 'Normal'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : item.status === 'Warning'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {item.status === 'Normal' ? 'Đạt' : item.status === 'Warning' ? 'Cần lưu ý' : 'Báo động'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!wasteData?.items || wasteData.items.length === 0) && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        Chưa ghi nhận giao dịch xuất kho hoặc hao hụt nào trong kỳ.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Low Stock Alerts & Telegram Broadcast */}
      {activeTab === 'alerts' && (
        <div className="space-y-6 mt-6">
          {/* Telegram / Email Config & Trigger Banner */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Broadcast Action Card */}
            <div className="bg-gradient-to-br from-rose-950/80 to-slate-900 border border-rose-800/50 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-rose-400 font-bold text-base mb-2">
                  <span>🚨</span> Phát Cảnh Báo Khẩn Cấp
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Quét toàn bộ nguyên liệu chạm ngưỡng đỏ và gửi thông báo trực tiếp qua <b>Telegram Bot</b> và <b>Email Quản lý</b> của quán.
                </p>

                <div className="my-4 bg-slate-900/80 rounded-lg p-3 border border-slate-800">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Nguyên liệu dưới ngưỡng:</span>
                    <span className="font-bold text-rose-400">{lowStockItems.length} món</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleBroadcastAlert}
                disabled={isBroadcasting}
                className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm rounded-lg transition shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isBroadcasting ? (
                  <span>Đang bắn thông báo...</span>
                ) : (
                  <>
                    <span>✈️</span> Gửi Cảnh Báo Telegram & Email Ngay
                  </>
                )}
              </button>
            </div>

            {/* Config Form Card */}
            <div className="lg:col-span-2 bg-slate-800/80 border border-slate-700/60 rounded-xl p-5">
              <h2 className="font-bold text-white text-base mb-1 flex items-center gap-2">
                <span>⚙️</span> Cấu Hình Kênh Nhận Cảnh Báo Cửa Hàng
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Điền Chat ID Telegram (group hoặc cá nhân) và Email quản lý để nhận tin tức thì khi cạn nguyên liệu.
              </p>

              <form onSubmit={handleSaveAlertConfig} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Telegram Chat ID (Nhóm hoặc Quản lý)
                    </label>
                    <input
                      type="text"
                      placeholder="VD: -100123456789 hoặc @username"
                      value={telegramChatId}
                      onChange={(e) => setTelegramChatId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Thêm Bot vào nhóm và cấp quyền nhắn tin.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Email Quản Lý Chi Nhánh
                    </label>
                    <input
                      type="email"
                      placeholder="VD: store_manager@highlands.vn"
                      value={managerEmail}
                      onChange={(e) => setManagerEmail(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Nhận bảng thống kê thiếu hụt định dạng HTML.
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-lg transition"
                  >
                    💾 Lưu Cấu Hình Nhận Tin
                  </button>
                  {saveConfigSuccess && (
                    <span className="text-xs text-emerald-400 font-semibold animate-pulse">
                      ✅ Đã lưu cấu hình thành công!
                    </span>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Broadcast Result Toast/Alert */}
          {broadcastResult && (
            <div className="bg-slate-800 border border-emerald-500/50 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <p className="font-bold text-emerald-400 text-sm flex items-center gap-2">
                  <span>✅</span> Đã hoàn tất phát cảnh báo tồn kho cho: {broadcastResult.storeName}
                </p>
                <div className="flex flex-wrap gap-4 text-xs text-slate-300 mt-1">
                  <span>
                    Telegram: <b>{broadcastResult.telegramSent ? 'Thành công' : 'Thất bại'}</b> ({broadcastResult.telegramStatus})
                  </span>
                  <span>•</span>
                  <span>
                    Email: <b>{broadcastResult.emailSent ? 'Thành công' : 'Thất bại'}</b> ({broadcastResult.emailStatus})
                  </span>
                </div>
              </div>
              <span className="text-[11px] text-slate-400">
                Lúc: {new Date(broadcastResult.sentAt).toLocaleTimeString()}
              </span>
            </div>
          )}

          {/* Low Stock Table */}
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <h2 className="font-bold text-white text-base">Danh Sách Nguyên Liệu Chạm Ngưỡng Đỏ</h2>
              <span className="text-xs text-rose-400 font-bold">{lowStockItems.length} mặt hàng</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/60 text-slate-400 uppercase text-xs font-semibold">
                  <tr>
                    <th className="py-3 px-4">Mã</th>
                    <th className="py-3 px-4">Tên Nguyên Liệu</th>
                    <th className="py-3 px-4 text-right">Tồn Kho Hiện Tại</th>
                    <th className="py-3 px-4 text-right">Ngưỡng Tối Thiểu</th>
                    <th className="py-3 px-4 text-right">Thiếu Hụt Cần Bổ Sung</th>
                    <th className="py-3 px-4 text-center">Hành Động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40 text-slate-300">
                  {lowStockItems.map((item) => (
                    <tr key={item.ingredientId} className="hover:bg-slate-700/30 transition">
                      <td className="py-3 px-4 font-mono text-xs text-slate-400">{item.ingredientCode}</td>
                      <td className="py-3 px-4 font-semibold text-white">{item.ingredientName}</td>
                      <td className="py-3 px-4 text-right font-black text-rose-400">
                        {item.currentStock.toFixed(2)} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-400">
                        {item.minAlertThreshold.toFixed(2)} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-amber-400">
                        +{item.shortage.toFixed(2)} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-xs text-rose-400 font-bold bg-rose-950/60 border border-rose-800/50 px-2 py-0.5 rounded">
                          Cần nhập ngay
                        </span>
                      </td>
                    </tr>
                  ))}
                  {lowStockItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        🎉 Tuyệt vời! Tất cả nguyên liệu đều đang ở mức an toàn trên ngưỡng cảnh báo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Khai Báo Xuất Hủy */}
      {showWasteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>➕</span> Khai Báo Xuất Hủy / Đổ Vỡ
              </h3>
              <button
                onClick={() => setShowWasteModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordWaste} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Chọn Nguyên Liệu
                </label>
                <select
                  value={wasteIngredientId}
                  onChange={(e) => setWasteIngredientId(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Chọn nguyên liệu trong kho --</option>
                  {allInventory.map((item) => (
                    <option key={item.ingredientId} value={item.ingredientId}>
                      {item.ingredientName} ({item.currentStock} {item.unit} tồn)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Số Lượng Xuất Hủy
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={wasteQuantity}
                  onChange={(e) => setWasteQuantity(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Lý Do Xuất Hủy / Tổn Thất
                </label>
                <select
                  value={wasteReason}
                  onChange={(e) => setWasteReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="Đổ vỡ trong quá trình pha chế">Đổ vỡ trong quá trình pha chế</option>
                  <option value="Hết hạn sử dụng (Expired)">Hết hạn sử dụng (Expired)</option>
                  <option value="Hỏng hóc thiết bị bảo quản lạnh">Hỏng hóc thiết bị bảo quản lạnh</option>
                  <option value="Pha chế sai đơn / Khách đổi ý">Pha chế sai đơn / Khách đổi ý</option>
                  <option value="Lý do khác">Lý do khác</option>
                </select>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowWasteModal(false)}
                  className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-semibold transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={wasteSubmitting}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-bold transition shadow-lg shadow-rose-600/30"
                >
                  {wasteSubmitting ? 'Đang lưu...' : 'Xác Nhận Xuất Hủy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
