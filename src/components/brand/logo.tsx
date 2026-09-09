import { cn } from "@/lib/utils";

/**
 * HASHCODE REBOOT logo system.
 * - Symbol: italicized "H" built from 3 sheared geometric segments, lime.
 * - Wordmark: "HASHCODE" white italic + "REBOOT" lime tracked + lime rule.
 *
 * No external font dependency for the symbol (pure SVG geometry).
 * The wordmark uses Sora (font-display) with italic + tight tracking to
 * approximate the engineered Eurostile-style reference.
 */

type LogoVariant = "full" | "compact" | "symbol";

export function HashSymbol({
  className,
  size = 28,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <g transform="skewX(-14)">
        {/* Left stem */}
        <rect x="6" y="6" width="5" height="20" fill="currentColor" />
        {/* Right stem */}
        <rect x="21" y="6" width="5" height="20" fill="currentColor" />
        {/* Crossbar */}
        <rect x="6" y="13.5" width="20" height="5" fill="currentColor" />
      </g>
    </svg>
  );
}

export function Logo({
  variant = "full",
  className,
  size = "md",
}: {
  variant?: LogoVariant;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const hSize = size === "sm" ? 22 : size === "lg" ? 36 : 28;
  const wordSize =
    size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-xl";
  const subSize =
    size === "sm" ? "text-[9px]" : size === "lg" ? "text-xs" : "text-[10px]";

  if (variant === "symbol") {
    return (
      <span
        className={cn("text-lime inline-flex", className)}
        aria-label="HASHCODE"
      >
        <HashSymbol size={hSize} />
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex items-center gap-2.5 select-none", className)}
      aria-label={variant === "compact" ? "HASHCODE" : "HASHCODE REBOOT"}
    >
      <span className="text-lime">
        <HashSymbol size={hSize} />
      </span>
      <span className="inline-flex flex-col leading-none">
        <span
          className={cn(
            "font-display font-bold italic tracking-tight text-foreground wordmark-italic",
            wordSize,
          )}
        >
          HASHCODE
        </span>
        {variant === "full" && (
          <span className="inline-flex items-center gap-2 mt-1">
            <span
              className={cn(
                "font-display font-medium italic text-lime uppercase",
                subSize,
              )}
              style={{ letterSpacing: "0.42em" }}
            >
              REBOOT
            </span>
            <span
              className="block h-px w-8 bg-lime/80"
              aria-hidden="true"
            />
          </span>
        )}
      </span>
    </span>
  );
}

/** Compact footer/wordmark used in subtle placements. */
export function LogoWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display font-bold italic tracking-tight text-foreground",
        className,
      )}
    >
      HASHCODE
    </span>
  );
}
