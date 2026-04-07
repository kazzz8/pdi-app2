"use client";

import { useRef } from "react";

type DefectPin = {
  id: string;
  x: number;   // 0-100 percentage within SVG viewBox
  y: number;   // 0-100 percentage within SVG viewBox
  severity: "A" | "B" | "C";
  index: number;
};

type Props = {
  defects: DefectPin[];
  pendingPin?: { x: number; y: number };
  onLocationClick: (x: number, y: number) => void;
  onDefectClick: (id: string) => void;
};

const VB_W = 220;
const VB_H = 490;

export default function VehicleDiagram({ defects, pendingPin, onLocationClick, onDefectClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = parseFloat((((e.clientX - rect.left) / rect.width) * 100).toFixed(1));
    const y = parseFloat((((e.clientY - rect.top) / rect.height) * 100).toFixed(1));
    onLocationClick(x, y);
  };

  const toSvg = (xPct: number, yPct: number) => ({
    x: (xPct / 100) * VB_W,
    y: (yPct / 100) * VB_H,
  });

  const severityColor = (s: "A" | "B" | "C") =>
    s === "A" ? "#eab308" : s === "B" ? "#f97316" : "#ef4444";

  return (
    <div className="w-full">
      <p className="text-center text-xs text-gray-400 mb-2">不具合箇所をタップして記録</p>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        xmlns="http://www.w3.org/2000/svg"
        className="w-full max-w-[220px] mx-auto block cursor-crosshair select-none"
        onClick={handleSvgClick}
      >
        {/* ===== WHEELS ===== */}
        {/* Front Left */}
        <ellipse cx="20" cy="110" rx="17" ry="23" fill="#1f2937" stroke="#111827" strokeWidth="1.5" />
        <ellipse cx="20" cy="110" rx="9" ry="13" fill="#4b5563" />
        <line x1="20" y1="97" x2="20" y2="123" stroke="#374151" strokeWidth="1" />
        <line x1="7" y1="110" x2="33" y2="110" stroke="#374151" strokeWidth="1" />
        {/* Front Right */}
        <ellipse cx="200" cy="110" rx="17" ry="23" fill="#1f2937" stroke="#111827" strokeWidth="1.5" />
        <ellipse cx="200" cy="110" rx="9" ry="13" fill="#4b5563" />
        <line x1="200" y1="97" x2="200" y2="123" stroke="#374151" strokeWidth="1" />
        <line x1="187" y1="110" x2="213" y2="110" stroke="#374151" strokeWidth="1" />
        {/* Rear Left */}
        <ellipse cx="20" cy="383" rx="17" ry="23" fill="#1f2937" stroke="#111827" strokeWidth="1.5" />
        <ellipse cx="20" cy="383" rx="9" ry="13" fill="#4b5563" />
        <line x1="20" y1="370" x2="20" y2="396" stroke="#374151" strokeWidth="1" />
        <line x1="7" y1="383" x2="33" y2="383" stroke="#374151" strokeWidth="1" />
        {/* Rear Right */}
        <ellipse cx="200" cy="383" rx="17" ry="23" fill="#1f2937" stroke="#111827" strokeWidth="1.5" />
        <ellipse cx="200" cy="383" rx="9" ry="13" fill="#4b5563" />
        <line x1="200" y1="370" x2="200" y2="396" stroke="#374151" strokeWidth="1" />
        <line x1="187" y1="383" x2="213" y2="383" stroke="#374151" strokeWidth="1" />

        {/* ===== MAIN BODY ===== */}
        <path
          d="M62,30 Q48,30 48,44 L48,460 Q48,472 62,472 L158,472 Q172,472 172,460 L172,44 Q172,30 158,30 Z"
          fill="#e5e7eb" stroke="#6b7280" strokeWidth="2"
        />

        {/* ===== FRONT BUMPER ===== */}
        <path
          d="M66,30 L154,30 Q170,30 170,46 L170,60 L50,60 L50,46 Q50,30 66,30 Z"
          fill="#d1d5db" stroke="#6b7280" strokeWidth="1.5"
        />
        {/* Bumper grille lines */}
        <line x1="80" y1="48" x2="140" y2="48" stroke="#9ca3af" strokeWidth="1" />
        <line x1="80" y1="54" x2="140" y2="54" stroke="#9ca3af" strokeWidth="1" />

        {/* ===== FRONT LIGHTS ===== */}
        <path d="M48,34 L64,34 L64,56 L48,52 Z" fill="#fef08a" stroke="#9ca3af" strokeWidth="1" />
        <path d="M172,34 L156,34 L156,56 L172,52 Z" fill="#fef08a" stroke="#9ca3af" strokeWidth="1" />
        {/* Light inner detail */}
        <path d="M50,36 L62,36 L62,50 L50,48 Z" fill="#fde047" fillOpacity="0.6" />
        <path d="M170,36 L158,36 L158,50 L170,48 Z" fill="#fde047" fillOpacity="0.6" />

        {/* ===== HOOD ===== */}
        <rect x="50" y="60" width="120" height="93" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="1" />
        {/* Hood crease lines */}
        <line x1="86" y1="66" x2="86" y2="148" stroke="#bbb" strokeWidth="0.8" />
        <line x1="134" y1="66" x2="134" y2="148" stroke="#bbb" strokeWidth="0.8" />
        {/* Engine center crease */}
        <line x1="110" y1="70" x2="110" y2="148" stroke="#ccc" strokeWidth="0.5" strokeDasharray="4,4" />

        {/* ===== FRONT WINDSHIELD ===== */}
        <path d="M66,153 L154,153 L150,175 L70,175 Z"
          fill="#bfdbfe" stroke="#93c5fd" strokeWidth="1.5" fillOpacity="0.85" />
        {/* Wiper lines */}
        <line x1="90" y1="162" x2="110" y2="173" stroke="#93c5fd" strokeWidth="1" />
        <line x1="130" y1="162" x2="110" y2="173" stroke="#93c5fd" strokeWidth="1" />

        {/* ===== A-PILLARS ===== */}
        <path d="M50,150 L66,153 L70,175 L50,180 Z" fill="#9ca3af" />
        <path d="M170,150 L154,153 L150,175 L170,180 Z" fill="#9ca3af" />

        {/* ===== SIDE MIRRORS ===== */}
        <path d="M50,180 L38,184 L38,200 L50,197 Z" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1" />
        <path d="M170,180 L182,184 L182,200 L170,197 Z" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1" />

        {/* ===== CABIN GLASS (ROOF) ===== */}
        <rect x="70" y="177" width="80" height="150" rx="2"
          fill="#dbeafe" stroke="#93c5fd" strokeWidth="1" fillOpacity="0.75" />
        {/* Roof center line */}
        <line x1="110" y1="180" x2="110" y2="324" stroke="#93c5fd" strokeWidth="0.8" strokeDasharray="5,5" />

        {/* ===== LEFT FRONT DOOR ===== */}
        <path d="M50,180 L70,180 L70,268 L50,268 Z" fill="#e5e7eb" stroke="#6b7280" strokeWidth="1.5" />
        {/* LF door window */}
        <path d="M53,183 L67,183 L67,260 L53,260 Z"
          fill="#dbeafe" stroke="#93c5fd" strokeWidth="1" fillOpacity="0.6" />
        {/* LF door handle */}
        <rect x="51" y="230" width="8" height="3" rx="1.5" fill="#9ca3af" />

        {/* ===== RIGHT FRONT DOOR ===== */}
        <path d="M170,180 L150,180 L150,268 L170,268 Z" fill="#e5e7eb" stroke="#6b7280" strokeWidth="1.5" />
        {/* RF door window */}
        <path d="M167,183 L153,183 L153,260 L167,260 Z"
          fill="#dbeafe" stroke="#93c5fd" strokeWidth="1" fillOpacity="0.6" />
        {/* RF door handle */}
        <rect x="161" y="230" width="8" height="3" rx="1.5" fill="#9ca3af" />

        {/* ===== B-PILLARS ===== */}
        <rect x="48" y="266" width="4" height="8" fill="#6b7280" />
        <rect x="168" y="266" width="4" height="8" fill="#6b7280" />

        {/* ===== LEFT REAR DOOR ===== */}
        <path d="M50,276 L70,276 L70,332 L50,332 Z" fill="#e5e7eb" stroke="#6b7280" strokeWidth="1.5" />
        {/* LR door window */}
        <path d="M53,279 L67,279 L67,328 L53,328 Z"
          fill="#dbeafe" stroke="#93c5fd" strokeWidth="1" fillOpacity="0.6" />
        {/* LR door handle */}
        <rect x="51" y="308" width="8" height="3" rx="1.5" fill="#9ca3af" />

        {/* ===== RIGHT REAR DOOR ===== */}
        <path d="M170,276 L150,276 L150,332 L170,332 Z" fill="#e5e7eb" stroke="#6b7280" strokeWidth="1.5" />
        {/* RR door window */}
        <path d="M167,279 L153,279 L153,328 L167,328 Z"
          fill="#dbeafe" stroke="#93c5fd" strokeWidth="1" fillOpacity="0.6" />
        {/* RR door handle */}
        <rect x="161" y="308" width="8" height="3" rx="1.5" fill="#9ca3af" />

        {/* ===== C-PILLARS ===== */}
        <path d="M50,332 L70,332 L70,346 L50,342 Z" fill="#9ca3af" />
        <path d="M170,332 L150,332 L150,346 L170,342 Z" fill="#9ca3af" />

        {/* ===== REAR WINDSHIELD ===== */}
        <path d="M70,334 L150,334 L154,346 L66,346 Z"
          fill="#bfdbfe" stroke="#93c5fd" strokeWidth="1.5" fillOpacity="0.85" />
        {/* Rear wiper */}
        <line x1="100" y1="338" x2="118" y2="344" stroke="#93c5fd" strokeWidth="1" />

        {/* ===== TRUNK ===== */}
        <rect x="50" y="346" width="120" height="100" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="1" />
        {/* Trunk lines */}
        <line x1="86" y1="352" x2="86" y2="440" stroke="#bbb" strokeWidth="0.8" />
        <line x1="134" y1="352" x2="134" y2="440" stroke="#bbb" strokeWidth="0.8" />
        {/* Trunk keyhole */}
        <circle cx="110" cy="400" r="4" fill="none" stroke="#9ca3af" strokeWidth="1.5" />
        <line x1="110" y1="404" x2="110" y2="410" stroke="#9ca3af" strokeWidth="1.5" />

        {/* ===== REAR LIGHTS ===== */}
        <path d="M48,356 L62,356 L62,422 L48,418 Z" fill="#fca5a5" stroke="#9ca3af" strokeWidth="1" />
        <path d="M172,356 L158,356 L158,422 L172,418 Z" fill="#fca5a5" stroke="#9ca3af" strokeWidth="1" />
        {/* Rear light detail */}
        <path d="M50,358 L60,358 L60,416 L50,412 Z" fill="#f87171" fillOpacity="0.5" />
        <path d="M170,358 L160,358 L160,416 L170,412 Z" fill="#f87171" fillOpacity="0.5" />

        {/* ===== REAR BUMPER ===== */}
        <path
          d="M66,444 L154,444 Q170,444 170,458 L170,472 L50,472 L50,458 Q50,444 66,444 Z"
          fill="#d1d5db" stroke="#6b7280" strokeWidth="1.5"
        />
        {/* Bumper lines */}
        <line x1="80" y1="456" x2="140" y2="456" stroke="#9ca3af" strokeWidth="1" />
        <line x1="80" y1="462" x2="140" y2="462" stroke="#9ca3af" strokeWidth="1" />

        {/* ===== SIDE SILLS ===== */}
        <rect x="48" y="180" width="4" height="152" fill="#9ca3af" fillOpacity="0.8" />
        <rect x="168" y="180" width="4" height="152" fill="#9ca3af" fillOpacity="0.8" />

        {/* ===== FRONT / REAR LABELS ===== */}
        <text x="110" y="15" textAnchor="middle" fontSize="8" fill="#9ca3af">前</text>
        <text x="110" y="487" textAnchor="middle" fontSize="8" fill="#9ca3af">後</text>

        {/* ===== EXISTING DEFECT PINS ===== */}
        {defects.map((d) => {
          const { x, y } = toSvg(d.x, d.y);
          const color = severityColor(d.severity);
          return (
            <g
              key={d.id}
              transform={`translate(${x}, ${y})`}
              onClick={(e) => { e.stopPropagation(); onDefectClick(d.id); }}
              className="cursor-pointer"
            >
              <circle r="10" fill={color} stroke="white" strokeWidth="2" />
              <text textAnchor="middle" dominantBaseline="central" fontSize="9" fill="white" fontWeight="bold">
                {d.index}
              </text>
            </g>
          );
        })}

        {/* ===== PENDING PIN (タップ直後) ===== */}
        {pendingPin && (() => {
          const { x, y } = toSvg(pendingPin.x, pendingPin.y);
          return (
            <g transform={`translate(${x}, ${y})`} pointerEvents="none">
              <circle r="10" fill="#3b82f6" stroke="white" strokeWidth="2" fillOpacity="0.8" />
              <text textAnchor="middle" dominantBaseline="central" fontSize="10" fill="white">+</text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
