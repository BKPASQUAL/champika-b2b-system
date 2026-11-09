import React from "react";

/**
 * Multi-color signature brand mark for BK Wiring බඩු කඩේ:
 * - Shield: Deep Midnight Navy to Electric Royal Blue (#1e3a8a → #1d4ed8 → #0f172a)
 * - House Roofline: Crisp Pure White (/\) with Electric Sky-Cyan (#38bdf8) walls
 * - Power Bolt: Vibrant Copper-Orange to Live-Coral (#fb923c → #f97316 → #e11d48)
 *   symbolizing pure copper house wiring and live electrical power.
 */
export function BrandLogoMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="bkw-bg-grad" x1="4" y1="2" x2="44" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="48%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="bkw-rim-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#60a5fa" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="bkw-copper-bolt" x1="17" y1="13" x2="31" y2="39" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="50%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>
      </defs>

      {/* Rounded squircle badge */}
      <rect x="1.5" y="1.5" width="45" height="45" rx="12" fill="url(#bkw-bg-grad)" />
      <rect x="2.2" y="2.2" width="43.6" height="43.6" rx="11.3" stroke="url(#bkw-rim-grad)" strokeWidth="1.4" />

      {/* Subtle circuit halo */}
      <circle cx="24" cy="24" r="14.5" stroke="#38bdf8" strokeOpacity="0.16" strokeWidth="1.2" strokeDasharray="3 3" />

      {/* House side walls in Electric Sky Cyan */}
      <path
        d="M13.5 20.5V33C13.5 34.3807 14.6193 35.5 16 35.5H18.8M34.5 20.5V33C34.5 34.3807 33.3807 35.5 32 35.5H29.2"
        stroke="#38bdf8"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Crisp White House Roofline */}
      <path
        d="M9.5 21.2L24 9.2L38.5 21.2"
        stroke="#ffffff"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Copper-Coral Electric Lightning Bolt */}
      <path
        d="M25.8 15.2L16.8 26.5H23.2L20.8 37.2L31.2 24.8H24.6L25.8 15.2Z"
        fill="url(#bkw-copper-bolt)"
        stroke="#ffffff"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BrandLogo({
  name = "BK Wiring",
  size = "md",
}: {
  name?: string;
  size?: "sm" | "md";
}) {
  const isSm = size === "sm";
  const parts = name.trim().split(/\s+/);
  const firstWord = parts[0] || "BK";
  const restWords = parts.slice(1).join(" ") || "WIRING";

  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <span className="relative flex shrink-0 items-center justify-center rounded-xl shadow-[0_4px_16px_rgba(37,99,235,0.45)] transition-transform duration-200 group-hover:scale-105">
        <BrandLogoMark className={isSm ? "h-9 w-9" : "h-10 w-10 md:h-11 md:w-11"} />
      </span>
      <span className="flex flex-col justify-center leading-none">
        <span className="flex items-baseline gap-1.5">
          <span
            className={`font-black uppercase tracking-tight text-white ${
              isSm ? "text-[16px]" : "text-[17px] md:text-[18px]"
            }`}
          >
            {firstWord}
          </span>
          <span
            className={`font-extrabold uppercase tracking-tight text-sky-400 ${
              isSm ? "text-[16px]" : "text-[17px] md:text-[18px]"
            }`}
          >
            {restWords}
          </span>
          <span
            style={{ fontFamily: '"Abhaya Libre", "Yaldevi", "Iskoola Pota", serif' }}
            className={`ml-0.5 font-extrabold italic tracking-normal text-orange-400 ${
              isSm ? "text-[15px]" : "text-[16.5px] md:text-[18px]"
            }`}
          >
            බඩු කඩේ
          </span>
        </span>
        <span className="mt-1 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
          House Wiring Store
        </span>
      </span>
    </span>
  );
}
