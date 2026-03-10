"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const SIGNATURE_FONTS = [
  { name: "Dancing Script", label: "Dancing Script" },
  { name: "Great Vibes", label: "Great Vibes" },
  { name: "Pacifico", label: "Pacifico" },
  { name: "Satisfy", label: "Satisfy" },
];

const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Great+Vibes&family=Pacifico&family=Satisfy&display=swap";

type SignatureMode = "draw" | "upload" | "type";

type Props = {
  onSignature: (dataUrl: string) => void;
  /** Show the submit button and call onSignature on click */
  submitLabel?: string;
  /** If provided, shows a "Use Saved Signature" option */
  savedSignatureUrl?: string | null;
  onUseSaved?: () => void;
  /** Disable interactions */
  disabled?: boolean;
  /** Canvas dimensions */
  canvasWidth?: number;
  canvasHeight?: number;
  /** Color theme - "light" for white bg pages, "dark" for blue-950 pages */
  theme?: "light" | "dark";
};

export default function SignaturePad({
  onSignature,
  submitLabel = "Confirm Signature",
  savedSignatureUrl,
  onUseSaved,
  disabled = false,
  canvasWidth = 600,
  canvasHeight = 150,
  theme = "light",
}: Props) {
  const [mode, setMode] = useState<SignatureMode>("draw");
  const [uploadedSig, setUploadedSig] = useState("");
  const [typedName, setTypedName] = useState("");
  const [selectedFont, setSelectedFont] = useState(SIGNATURE_FONTS[0].name);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Load Google Fonts
  useEffect(() => {
    if (document.querySelector(`link[href="${FONT_URL}"]`)) {
      setFontsLoaded(true);
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONT_URL;
    link.onload = () => {
      // Give fonts a moment to be available
      setTimeout(() => setFontsLoaded(true), 300);
    };
    document.head.appendChild(link);
  }, []);

  // ── Canvas drawing ──────────────────────────────────────────────────

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent).clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e, canvas);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || !canvasRef.current || !lastPos.current || disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1e3a5f";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = () => {
    isDrawing.current = false;
    lastPos.current = null;
  };

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const isCanvasBlank = () => {
    const canvas = canvasRef.current;
    if (!canvas) return true;
    const ctx = canvas.getContext("2d");
    if (!ctx) return true;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    return !data.some((v) => v !== 0);
  };

  // ── Upload ──────────────────────────────────────────────────────────

  const handleSigUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setUploadedSig(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── Type → Canvas rendering ────────────────────────────────────────

  const renderTypedSignature = (): string | null => {
    if (!typedName.trim()) return null;
    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Measure & draw text
    const fontSize = Math.min(56, canvasWidth / (typedName.length * 0.6));
    ctx.font = `${fontSize}px '${selectedFont}', cursive`;
    ctx.fillStyle = "#1e3a5f";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(typedName, canvasWidth / 2, canvasHeight / 2);

    return canvas.toDataURL("image/png");
  };

  // ── Submit ──────────────────────────────────────────────────────────

  const handleSubmit = () => {
    if (disabled) return;

    if (mode === "draw") {
      if (isCanvasBlank()) return;
      onSignature(canvasRef.current!.toDataURL("image/png"));
    } else if (mode === "upload") {
      if (!uploadedSig) return;
      onSignature(uploadedSig);
    } else {
      const dataUrl = renderTypedSignature();
      if (!dataUrl) return;
      onSignature(dataUrl);
    }
  };

  const canSubmit =
    (mode === "draw" && true) || // validated on submit
    (mode === "upload" && !!uploadedSig) ||
    (mode === "type" && !!typedName.trim());

  // ── Styles ──────────────────────────────────────────────────────────

  const isDark = theme === "dark";
  const tabBase = "px-4 py-2 rounded-lg text-sm font-semibold border transition-colors";
  const tabActive = "bg-blue-700 text-white border-blue-700";
  const tabInactive = isDark
    ? "bg-transparent text-white/60 border-white/20 hover:bg-white/10"
    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50";
  const labelClass = isDark
    ? "block text-sm font-medium text-white/70 mb-2"
    : "block text-sm font-medium text-gray-700 mb-2";

  return (
    <div>
      {/* Saved signature option */}
      {savedSignatureUrl && onUseSaved && (
        <div className={`mb-4 rounded-lg border p-4 ${isDark ? "border-white/20 bg-white/5" : "border-blue-200 bg-blue-50"}`}>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className={`text-sm font-semibold ${isDark ? "text-white/80" : "text-gray-700"}`}>Saved Signature</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={savedSignatureUrl} alt="Saved signature" className="max-h-16 mt-2 object-contain" />
            </div>
            <button
              type="button"
              onClick={onUseSaved}
              disabled={disabled}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
            >
              Use Saved Signature
            </button>
          </div>
        </div>
      )}

      {/* Mode tabs */}
      <div className="flex gap-2 mb-4">
        {(["draw", "upload", "type"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`${tabBase} ${mode === m ? tabActive : tabInactive}`}
          >
            {m === "draw" && "Draw"}
            {m === "upload" && "Upload"}
            {m === "type" && "Type"}
          </button>
        ))}
      </div>

      {/* Draw mode */}
      {mode === "draw" && (
        <div className="mb-4">
          <label className={labelClass}>Draw your signature below:</label>
          <div className="relative border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50" style={{ touchAction: "none" }}>
            <canvas
              ref={canvasRef}
              width={canvasWidth}
              height={canvasHeight}
              className="w-full cursor-crosshair"
              style={{ display: "block", touchAction: "none" }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
            <p className="absolute bottom-2 right-3 text-xs text-gray-300 pointer-events-none select-none">Sign here</p>
          </div>
          <button onClick={clearCanvas} className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline">
            Clear signature
          </button>
        </div>
      )}

      {/* Upload mode */}
      {mode === "upload" && (
        <div className="mb-4">
          <label className={labelClass}>Upload your signature image (PNG or JPG):</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg"
            onChange={handleSigUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border-2 border-dashed border-gray-300 px-6 py-4 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors w-full text-center"
          >
            Click to select signature image…
          </button>
          {uploadedSig && (
            <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500 mb-2 font-medium">Preview:</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={uploadedSig} alt="Uploaded signature" className="max-h-24 max-w-xs object-contain" />
              <button
                type="button"
                onClick={() => setUploadedSig("")}
                className="mt-2 text-xs text-red-400 hover:text-red-600 underline block"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      )}

      {/* Type mode */}
      {mode === "type" && (
        <div className="mb-4">
          <label className={labelClass}>Type your name:</label>
          <input
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="Enter your full name"
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-800 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none mb-3"
          />

          <label className={labelClass}>Choose a font style:</label>
          <div className="flex flex-wrap gap-2 mb-4">
            {SIGNATURE_FONTS.map((f) => (
              <button
                key={f.name}
                type="button"
                onClick={() => setSelectedFont(f.name)}
                className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                  selectedFont === f.name
                    ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
                style={{ fontFamily: `'${f.name}', cursive` }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Live preview */}
          {typedName.trim() && (
            <div className="rounded-lg border-2 border-gray-200 bg-gray-50 p-6 flex items-center justify-center min-h-[80px]">
              <span
                className="text-[#1e3a5f]"
                style={{
                  fontFamily: `'${selectedFont}', cursive`,
                  fontSize: `${Math.min(48, 600 / (typedName.length * 0.6))}px`,
                  lineHeight: 1.2,
                }}
              >
                {fontsLoaded ? typedName : "Loading fonts..."}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Submit button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || !canSubmit}
        className="w-full rounded-lg bg-blue-700 px-6 py-3 font-bold text-white hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {disabled ? "Signing..." : submitLabel}
      </button>
    </div>
  );
}
