import { cn } from "@/lib/utils";

export const IDFITMark = ({ size = 18, className }: { size?: number; className?: string }) => (
  <img
    src="/idfit-icon.png"
    width={size}
    height={size}
    alt=""
    className={cn("object-contain", className)}
    aria-hidden
  />
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
  <div className={cn("flex items-center gap-2 min-w-0", className)}>
    {showWord ? (
      <img
        src="/idfit-logo.png"
        height={Math.max(24, Math.round(size * 1.8))}
        alt="IDFIT"
        className="h-auto max-w-[150px] object-contain shrink-0"
        style={{ width: Math.max(90, Math.round(size * 7.5)) }}
      />
    ) : (
      <IDFITMark size={size} />
    )}
  </div>
);
