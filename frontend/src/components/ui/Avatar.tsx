import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  color?: string;
  url?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Avatar({ name, color = "#888", url, size = "md", className }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-12 h-12 text-sm",
    lg: "w-16 h-16 text-xl",
  };

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={cn("rounded-full object-cover shrink-0", sizeClasses[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center text-white font-medium shrink-0 shadow-inner",
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
}
