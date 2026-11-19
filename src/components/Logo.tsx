"use client";

import { motion, useReducedMotion } from "framer-motion";

export function Logo({
  inverted = false,
  compact = false,
  animated = true,
}: {
  inverted?: boolean;
  compact?: boolean;
  animated?: boolean;
}) {
  const reduced = useReducedMotion();
  const shouldAnimate = animated && !reduced;

  return (
    <motion.span
      className="group inline-flex items-center gap-2.5 select-none"
      translate="no"
      whileHover={shouldAnimate ? { scale: 1.02 } : undefined}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <svg
        viewBox="0 0 36 36"
        className="h-9 w-9 shrink-0 drop-shadow-sm"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="tc-badge-bg" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={inverted ? "#0B243E" : "#04111D"} />
            <stop offset="100%" stopColor={inverted ? "#071829" : "#0B243E"} />
          </linearGradient>
          <linearGradient id="tc-drop-fill" x1="18" y1="7" x2="18" y2="29" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="65%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#0369A1" />
          </linearGradient>
          <linearGradient id="tc-cap-bar" x1="7" y1="15" x2="29" y2="15" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="50%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>

        <rect
          x="1"
          y="1"
          width="34"
          height="34"
          rx="9"
          fill="url(#tc-badge-bg)"
          stroke={inverted ? "#1E3A5F" : "#0F2942"}
          strokeWidth="1.25"
        />

        {/* Droplet chamber capped at the peak */}
        <motion.path
          d="M18 7.2c3.8 4.4 6.5 7.4 6.5 11.1a6.5 6.5 0 1 1-13 0c0-3.7 2.7-6.7 6.5-11.1Z"
          fill="url(#tc-drop-fill)"
          fillOpacity="0.28"
          stroke="#38BDF8"
          strokeWidth="1.4"
          initial={shouldAnimate ? { pathLength: 0.2, opacity: 0.5 } : undefined}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
        />

        {/* Three stepped hydro load-shaving bars inside droplet */}
        <motion.rect
          x="14.1"
          y="19.8"
          width="2.1"
          height="4.4"
          rx="0.8"
          fill="#38BDF8"
          initial={shouldAnimate ? { scaleY: 0.2, opacity: 0 } : undefined}
          animate={{ scaleY: 1, opacity: 1 }}
          style={{ transformOrigin: "15.1px 24.2px" }}
          transition={{ duration: 0.4, delay: 0.12 }}
        />
        <motion.rect
          x="17.0"
          y="17.5"
          width="2.1"
          height="6.7"
          rx="0.8"
          fill="#7DD3FC"
          initial={shouldAnimate ? { scaleY: 0.2, opacity: 0 } : undefined}
          animate={{ scaleY: 1, opacity: 1 }}
          style={{ transformOrigin: "18px 24.2px" }}
          transition={{ duration: 0.45, delay: 0.2 }}
        />
        <motion.rect
          x="19.9"
          y="20.6"
          width="2.1"
          height="3.6"
          rx="0.8"
          fill="#10B981"
          initial={shouldAnimate ? { scaleY: 0.2, opacity: 0 } : undefined}
          animate={{ scaleY: 1, opacity: 1 }}
          style={{ transformOrigin: "20.9px 24.2px" }}
          transition={{ duration: 0.4, delay: 0.28 }}
        />

        {/* Firm Peak-Day Cap Ceiling Bar */}
        <motion.path
          d="M7.5 14.4h21"
          stroke="url(#tc-cap-bar)"
          strokeWidth="2.3"
          strokeLinecap="round"
          initial={shouldAnimate ? { pathLength: 0 } : undefined}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
        />
        <circle cx="28.5" cy="14.4" r="1.7" fill="#10B981" />
      </svg>

      {!compact && (
        <span className="flex flex-col leading-none">
          <span
            className={`font-display text-[19px] font-bold tracking-tight ${
              inverted ? "text-white" : "text-marine-ink"
            }`}
          >
            Thirst<span className={inverted ? "text-sky-400" : "text-hydro"}>Cap</span>
          </span>
          <span
            className={`mt-0.5 font-mono text-[9.5px] font-medium tracking-[0.08em] uppercase ${
              inverted ? "text-slate-400" : "text-marine-faint"
            }`}
          >
            Water-Cap OS
          </span>
        </span>
      )}
    </motion.span>
  );
}
