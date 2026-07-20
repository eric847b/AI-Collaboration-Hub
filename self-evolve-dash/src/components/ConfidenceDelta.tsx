import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ConfidenceDeltaProps {
  current: number;
  previous: number;
  size?: "sm" | "md";
}

export const ConfidenceDelta = ({
  current,
  previous,
  size = "md",
}: ConfidenceDeltaProps) => {
  const delta = current - previous;

  const getDeltaState = (value: number) => {
    if (value > 0) return { color: "text-success", icon: TrendingUp, label: `+${value}%` };
    if (value < 0) return { color: "text-destructive", icon: TrendingDown, label: `${value}%` };
    return { color: "text-muted-foreground", icon: Minus, label: "0%" };
  };

  const state = getDeltaState(delta);
  const Icon = state.icon;

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-1",
  };

  return (
    <Badge variant="outline" className={`${state.color} ${sizeClasses[size]} flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {state.label}
    </Badge>
  );
};
