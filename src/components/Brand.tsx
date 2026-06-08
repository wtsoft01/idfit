import { cn } from "@/lib/utils";

/** IDFIT monogram: radar/scope mark */
export const IDFITMark = ({ size = 18, className }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="12" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
    <path d="M12 2 L12 22 M2 12 L22 12" stroke="currentColor" strokeWidth="0.8" opacity="0.35" />
    <path d="M12 12 L20 6" stroke="hsl(var(--neon))" strokeWidth="2" strokeLinecap="square" />
    <circle cx="20" cy="6" r="1.6" fill="hsl(var(--neon))" />
  </svg>
);

export const BrandLockup = ({
  size = 18,
  className,
  showWord = true,
}: {
  size?: number;
  className?: string;
  showWord?: boolean;
}) => (
  <div className={cn("flex items-center gap-2", className)}>
    <IDFITMark size={size} className="text-foreground" />
    {showWord && (
      <span
        className="font-display font-bold uppercase tracking-[0.14em] text-foreground"
        style={{ fontSize: Math.round(size * 0.85) }}
      >
        ID<span className="text-neon">FIT</span>
      </span>
    )}
  </div>
);

