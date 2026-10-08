import { useEffect, useRef, useState } from "react";
import { RotateCcw, Sparkles, Check, PenTool } from "lucide-react";

export interface SignaturePadProps {
  onSignatureChange?: (base64: string) => void;
  width?: number;
  height?: number;
  signerName?: string;
}

export function SignaturePad({
  onSignatureChange,
  width = 460,
  height = 160,
  signerName = "",
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set background to clean white
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw subtle signing baseline
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(30, canvas.height - 35);
    ctx.lineTo(canvas.width - 30, canvas.height - 35);
    ctx.stroke();
    ctx.setLineDash([]);

    // Baseline label
    ctx.font = "10px sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Ký tên vào khu vực này (Vẽ bằng chuột hoặc cảm ứng)", 30, canvas.height - 18);
  }, []);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = "#1e293b"; // dark slate blue ink
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if ("touches" in e) {
      // Prevent scrolling while drawing on mobile/touch screens
      e.preventDefault();
    }

    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasSignature) {
      setHasSignature(true);
    }
  };

  const endDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    exportSignature();
  };

  const exportSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSignatureChange?.(dataUrl);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(30, canvas.height - 35);
    ctx.lineTo(canvas.width - 30, canvas.height - 35);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = "10px sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Ký tên vào khu vực này (Vẽ bằng chuột hoặc cảm ứng)", 30, canvas.height - 18);

    setHasSignature(false);
    onSignatureChange?.("");
  };

  const drawQuickSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    clearCanvas();

    // Draw stylish calligraphic sample signature
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const startX = 60;
    const startY = 85;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.bezierCurveTo(startX + 30, startY - 45, startX + 50, startY + 25, startX + 90, startY - 30);
    ctx.bezierCurveTo(startX + 120, startY + 35, startX + 160, startY - 20, startX + 200, startY + 10);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(startX + 30, startY + 15);
    ctx.lineTo(startX + 280, startY - 5);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(startX + 230, startY - 25, 12, 0, Math.PI * 1.6);
    ctx.stroke();

    setHasSignature(true);
    exportSignature();
  };

  return (
    <div className="space-y-2">
      <div className="relative rounded-2xl border-2 border-dashed border-slate-200 bg-white p-2 shadow-inner overflow-hidden transition-all focus-within:border-red-400">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseLeave={endDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={endDrawing}
          className="w-full touch-none cursor-crosshair rounded-xl bg-white block"
        />

        {/* Floating Controls inside Canvas */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={drawQuickSignature}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800 border border-amber-200 hover:bg-amber-100 transition shadow-2xs"
            title="Tạo chữ ký mẫu nhanh"
          >
            <Sparkles size={12} className="text-amber-600" />
            <span>Ký mẫu nhanh</span>
          </button>
          <button
            type="button"
            onClick={clearCanvas}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-200 transition shadow-2xs"
            title="Xóa để ký lại"
          >
            <RotateCcw size={12} />
            <span>Xóa chữ ký</span>
          </button>
        </div>

        {/* Live Signed Status Badge */}
        {hasSignature && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 shadow-2xs">
            <Check size={11} />
            <span>Đã ghi nhận chữ ký</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-1 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <PenTool size={12} className="text-slate-400" />
          {signerName ? `Người ký: ${signerName}` : "Vui lòng ký tay vào ô trên"}
        </span>
        <span className="text-[10px] text-slate-400">Bảo mật chữ ký điện tử E-Sign</span>
      </div>
    </div>
  );
}
