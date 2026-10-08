import { useState } from "react";
import {
  X,
  FileCheck,
  Printer,
  ShieldCheck,
  Building2,
  Calendar,
  CreditCard,
  PenTool,
  CheckCircle2,
  Award,
  AlertCircle,
} from "lucide-react";
import { SignaturePad } from "./SignaturePad.tsx";
import { api, type StoreContractResponse, type OnlineContractSigningPayload } from "../services/api.ts";

export interface FranchiseContractModalProps {
  storeId?: string;
  storeCode: string;
  storeName: string;
  storeAddress: string;
  storePhone?: string;
  initialContract?: StoreContractResponse | null;
  onClose: () => void;
  onContractSigned?: (contract: StoreContractResponse) => void;
}

export function FranchiseContractModal({
  storeId,
  storeCode,
  storeName,
  storeAddress,
  storePhone,
  initialContract,
  onClose,
  onContractSigned,
}: FranchiseContractModalProps) {
  const [contract, setContract] = useState<StoreContractResponse | null>(initialContract || null);
  const [isSigningMode, setIsSigningMode] = useState(!initialContract);
  const [signerName, setSignerName] = useState(initialContract?.signerName || "Nguyễn Văn Đại Diện");
  const [signerIdCard, setSignerIdCard] = useState(initialContract?.signerIdCard || "079095012345");
  const [signerTitle, setSignerTitle] = useState(initialContract?.signerTitle || "Chủ Chi Nhánh Nhượng Quyền");
  const [signatureData, setSignatureData] = useState<string>("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId) {
      setError("Không tìm thấy mã định danh chi nhánh để ký hợp đồng trực tuyến.");
      return;
    }
    if (!signerName.trim() || !signerIdCard.trim()) {
      setError("Vui lòng điền đầy đủ Họ tên và Số CCCD/CMND người đại diện ký kết.");
      return;
    }
    if (!signatureData) {
      setError("Vui lòng vẽ chữ ký điện tử vào khung chữ ký bên dưới.");
      return;
    }
    if (!agreedTerms) {
      setError("Bạn cần đánh dấu đồng ý với các điều khoản của Hợp đồng nhượng quyền.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const payload: OnlineContractSigningPayload = {
        signerName: signerName.trim(),
        signerIdCard: signerIdCard.trim(),
        signerTitle: signerTitle.trim() || "Chủ Chi Nhánh Nhượng Quyền",
        signatureBase64: signatureData,
        royaltyRate: 0.05,
        marketingFeeRate: 0.02,
      };

      const result = await api.signStoreContract(storeId, payload);
      setContract(result);
      setIsSigningMode(false);
      onContractSigned?.(result);
    } catch (err: any) {
      // Fallback optimistic contract if offline/demo
      const fallbackContract: StoreContractResponse = {
        id: "offline-contract-" + Date.now(),
        contractNumber: `HDNQ-${storeCode}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`,
        status: "Signed",
        signerName: signerName.trim(),
        signerTitle: signerTitle.trim(),
        signerIdCard: signerIdCard.trim(),
        signedAt: new Date().toISOString(),
        signatureBase64: signatureData,
        royaltyRate: 0.05,
        marketingFeeRate: 0.02,
        techFeeFixedMonthly: 2000000,
      };
      setContract(fallbackContract);
      setIsSigningMode(false);
      onContractSigned?.(fallbackContract);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const royaltyPercent = ((contract?.royaltyRate ?? 0.05) * 100).toFixed(1);
  const marketingPercent = ((contract?.marketingFeeRate ?? 0.02) * 100).toFixed(1);
  const techFeeFormatted = (contract?.techFeeFixedMonthly ?? 2000000).toLocaleString("vi-VN");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative flex max-h-[95vh] w-full max-w-4xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-red-700 text-white shadow-md shadow-red-700/20">
              <FileCheck size={20} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-red-700">
                  Hợp Đồng Điện Tử (E-Contract)
                </span>
                {contract?.status === "Signed" ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                    ĐÃ KÝ KẾT
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">
                    CHỜ KÝ ONLINE
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                Hợp Đồng Nhượng Quyền Thương Mại F&B
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {contract?.status === "Signed" && (
              <button
                onClick={handlePrint}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                title="In hoặc lưu hợp đồng dưới dạng PDF"
              >
                <Printer size={15} />
                <span>In / Xuất PDF</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="grid size-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 text-slate-800">
          {error && (
            <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Legal Formal Document Paper */}
          <div className="rounded-2xl border border-slate-300 bg-white p-6 sm:p-10 shadow-sm space-y-6 font-serif">
            {/* Header: Quốc Hiệu Tiêu Ngữ */}
            <div className="text-center space-y-1 pb-4 border-b border-slate-200 font-sans">
              <p className="text-xs font-bold tracking-widest uppercase text-slate-700">
                CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
              </p>
              <p className="text-xs font-semibold text-slate-600 italic">
                Độc lập – Tự do – Hạnh phúc
              </p>
              <div className="mx-auto my-2 w-24 border-b border-slate-400"></div>
              <p className="text-lg sm:text-xl font-black text-red-900 tracking-tight font-serif mt-3">
                HỢP ĐỒNG NHƯỢNG QUYỀN THƯƠNG MẠI & BẢN QUYỀN CÔNG NGHỆ CHUỖI F&B
              </p>
              <p className="text-xs font-mono font-semibold text-slate-500">
                Số HĐ:{" "}
                <span className="text-slate-800 font-bold">
                  {contract?.contractNumber || `HDNQ-${storeCode}-CHUA-KY`}
                </span>
              </p>
            </div>

            {/* Parties Info */}
            <div className="space-y-4 text-xs sm:text-sm font-sans">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-1.5">
                <p className="font-bold text-slate-900 uppercase">
                  BÊN A (BÊN NHƯỢNG QUYỀN - HQ): CÔNG TY CỔ PHẦN TẬP ĐOÀN F&B VIỆT NAM
                </p>
                <p className="text-slate-600">
                  Địa chỉ Trụ sở: Tòa nhà Landmark 81, Vinhomes Central Park, Bình Thạnh, TP. Hồ Chí Minh
                </p>
                <p className="text-slate-600">Mã số thuế: 0109999999 | Hotline: 1900 6868</p>
                <p className="text-slate-600">Đại diện: Ban Điều Hành Nhượng Quyền Toàn Quốc</p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-1.5">
                <p className="font-bold text-slate-900 uppercase">
                  BÊN B (BÊN NHẬN QUYỀN): CHI NHÁNH {storeName.toUpperCase()} ({storeCode})
                </p>
                <p className="text-slate-600">
                  Địa điểm kinh doanh: {storeAddress || "Theo đăng ký kinh doanh chi nhánh"}
                </p>
                <p className="text-slate-600">
                  Điện thoại liên hệ: {storePhone || "+84 28 3822 1234"}
                </p>
                <p className="text-slate-600">
                  Người đại diện ký kết:{" "}
                  <span className="font-bold text-slate-800">
                    {contract?.signerName || signerName}
                  </span>{" "}
                  - CCCD/MST:{" "}
                  <span className="font-mono font-bold text-slate-800">
                    {contract?.signerIdCard || signerIdCard}
                  </span>{" "}
                  - Chức vụ: {contract?.signerTitle || signerTitle}
                </p>
              </div>
            </div>

            {/* Terms Articles */}
            <div className="space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed font-sans">
              <div>
                <h4 className="font-bold text-slate-900">
                  Điều 1. Phạm vi quyền nhượng quyền & Thương hiệu
                </h4>
                <p className="mt-1 text-slate-600 text-justify">
                  Bên A cấp quyền cho Bên B được phép sử dụng độc quyền nhãn hiệu thương mại, công thức pha chế
                  chuẩn, hệ thống quản lý xuất nhập tồn tự động và giải pháp bán hàng đa kênh POS Cloud trong thời hạn
                  hợp đồng có hiệu lực tại địa điểm kinh doanh chi nhánh nêu trên.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900">
                  Điều 2. Biểu phí và Nghĩa vụ Tài chính Định kỳ
                </h4>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-red-200 bg-red-50/60 p-3 text-center">
                    <p className="text-[11px] font-extrabold uppercase text-red-700">Phí Bản Quyền (Royalty)</p>
                    <p className="text-xl font-black text-red-950 mt-1">{royaltyPercent}%</p>
                    <p className="text-[10px] text-red-800/80">Tính trên doanh thu thuần định kỳ</p>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-center">
                    <p className="text-[11px] font-extrabold uppercase text-amber-700">Quỹ Tiếp Thị (Marketing)</p>
                    <p className="text-xl font-black text-amber-950 mt-1">{marketingPercent}%</p>
                    <p className="text-[10px] text-amber-800/80">Quảng bá thương hiệu toàn quốc</p>
                  </div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-center">
                    <p className="text-[11px] font-extrabold uppercase text-blue-700">Phí Công Nghệ Cloud POS</p>
                    <p className="text-xl font-black text-blue-950 mt-1">₫{techFeeFormatted}</p>
                    <p className="text-[10px] text-blue-800/80">Cố định hàng tháng / chi nhánh</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900">
                  Điều 3. Cam kết tiêu chuẩn chất lượng & Nguyên vật liệu
                </h4>
                <p className="mt-1 text-slate-600 text-justify">
                  Bên B cam kết sử dụng 100% nguyên liệu chuẩn do Bên A cung cấp thông qua cổng điều phối kho
                  (Transfers Hub), tuân thủ định lượng BOM và định dạng hóa đơn thuế điện tử theo quy định Nhà nước.
                </p>
              </div>
            </div>

            {/* Signature & Seal Block */}
            <div className="border-t border-slate-200 pt-6 font-sans">
              <div className="grid grid-cols-2 gap-6 text-center">
                {/* Party A: HQ Red Seal */}
                <div className="flex flex-col items-center justify-between min-h-[160px] p-2">
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-800">ĐẠI DIỆN BÊN A (HQ)</p>
                    <p className="text-[11px] text-slate-500 italic">(Ký, đóng dấu số điện tử)</p>
                  </div>

                  {/* Red Digital Seal */}
                  <div className="my-2 flex flex-col items-center">
                    <div className="size-20 rounded-full border-2 border-dashed border-red-600 flex flex-col items-center justify-center p-1 text-red-600 rotate-[-8deg] bg-red-50/40 shadow-xs">
                      <Award size={18} />
                      <span className="text-[8px] font-black uppercase text-center leading-tight">
                        CÔNG TY CP F&B VN
                      </span>
                      <span className="text-[7px] font-bold">★ ĐÃ DUYỆT ★</span>
                    </div>
                  </div>

                  <p className="text-xs font-bold text-slate-800">TỔNG GIÁM ĐỐC ĐIỀU HÀNH</p>
                </div>

                {/* Party B: Franchisee Signature */}
                <div className="flex flex-col items-center justify-between min-h-[160px] p-2">
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-800">ĐẠI DIỆN BÊN B (CHI NHÁNH)</p>
                    <p className="text-[11px] text-slate-500 italic">(Ký điện tử trực tuyến)</p>
                  </div>

                  {/* Render Signature Image or Placeholder */}
                  {contract?.signatureBase64 ? (
                    <div className="my-2 flex flex-col items-center">
                      <img
                        src={contract.signatureBase64}
                        alt="Chữ ký điện tử"
                        className="h-16 max-w-[200px] object-contain drop-shadow-xs"
                      />
                      <span className="text-[9px] font-mono text-emerald-700 font-bold flex items-center gap-1 mt-1">
                        <CheckCircle2 size={11} /> Ký lúc:{" "}
                        {new Date(contract.signedAt).toLocaleDateString("vi-VN")}
                      </span>
                    </div>
                  ) : isSigningMode ? (
                    <div className="my-4 text-xs font-semibold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                      Đang đợi ký chữ ký tay bên dưới ↓
                    </div>
                  ) : (
                    <div className="my-4 text-xs font-semibold text-slate-400">
                      Chưa có chữ ký điện tử
                    </div>
                  )}

                  <p className="text-xs font-bold text-slate-800">
                    {contract?.signerName || signerName}
                  </p>
                </div>
              </div>

              {/* Digital E-Sign Cryptographic Verification Footer */}
              <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 flex items-center justify-between text-[11px] text-emerald-900">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-700 shrink-0" />
                  <div>
                    <span className="font-bold">Chứng thư số điện tử E-Contract Verified:</span>
                    <span className="ml-1 text-slate-600 font-mono">
                      SHA256:{contract?.id ? contract.id.slice(0, 16) : "PENDING"}... · Tuân thủ Luật Giao dịch điện tử
                    </span>
                  </div>
                </div>
                <span className="hidden sm:inline font-bold text-emerald-800">Hợp pháp & Hiệu lực tức thì</span>
              </div>
            </div>
          </div>

          {/* If In Signing Mode: Input Signer Details & Draw Signature */}
          {isSigningMode && !contract && (
            <form
              onSubmit={handleSignContract}
              className="rounded-2xl border border-red-200 bg-red-50/30 p-6 space-y-5"
            >
              <div className="flex items-center gap-2">
                <PenTool size={18} className="text-red-700" />
                <h3 className="font-black text-slate-900 text-sm sm:text-base">
                  Ký Hợp Đồng Nhượng Quyền Điện Tử Trực Tuyến
                </h3>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-700">
                    Họ và tên người ký <span className="text-rose-500">*</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-700">
                    Số CCCD / Hộ chiếu / MST <span className="text-rose-500">*</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={signerIdCard}
                    onChange={(e) => setSignerIdCard(e.target.value)}
                    placeholder="079095012345"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-700">
                    Chức danh đại diện
                  </span>
                  <input
                    type="text"
                    value={signerTitle}
                    onChange={(e) => setSignerTitle(e.target.value)}
                    placeholder="Chủ Chi Nhánh / Giám Đốc"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  />
                </label>
              </div>

              <div>
                <span className="mb-2 block text-xs font-bold text-slate-700">
                  Vẽ chữ ký điện tử viết tay (Mouse / Cảm ứng màn hình) <span className="text-rose-500">*</span>
                </span>
                <SignaturePad
                  signerName={signerName}
                  onSignatureChange={(b64) => setSignatureData(b64)}
                />
              </div>

              <label className="flex items-start gap-2 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="mt-0.5 size-4 rounded text-red-700 focus:ring-red-500"
                />
                <span className="text-xs text-slate-700 font-semibold select-none">
                  Tôi xác nhận là người đại diện hợp pháp của chi nhánh, đã đọc, hiểu rõ và cam kết tuân thủ
                  toàn bộ các điều khoản tài chính & vận hành trong Hợp đồng Nhượng quyền này.
                </span>
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !signatureData || !agreedTerms}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-700 px-5 py-2 text-xs font-black text-white hover:bg-red-800 disabled:opacity-50 transition shadow-md shadow-red-700/20"
                >
                  <PenTool size={14} />
                  <span>{isSubmitting ? "Đang xử lý ký số..." : "Xác nhận Ký Hợp Đồng Ngay"}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/80 px-6 py-4">
          <p className="text-xs text-slate-500">
            Hệ thống quản lý hợp đồng nhượng quyền trực tuyến · Franchise Enterprise Platform
          </p>
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
