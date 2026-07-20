import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ConfidenceMeterProps {
  confidence: number;
  showLabel?: boolean;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
}

export const ConfidenceMeter = ({
  confidence,
  showLabel = true,
  showIcon = true,
  size = "md",
}: ConfidenceMeterProps) => {
  const getConfidenceLevel = (score: number) => {
    if (score >= 80) return { label: "High", color: "text-success", icon: TrendingUp };
    if (score >= 60) return { label: "Medium", color: "text-warning", icon: Minus };
    return { label: "Low", color: "text-destructive", icon: TrendingDown };
  };

  const level = getConfidenceLevel(confidence);
  const Icon = level.icon;

  const sizeClasses = {
    sm: { height: "h-1", text: "text-xs", badge: "text-xs" },
    md: { height: "h-2", text: "text-sm", badge: "text-sm" },
    lg: { height: "h-3", text: "text-base", badge: "text-base" },
  };

  const classes = sizeClasses[size];

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        {showLabel && (
          <span className={`font-semibold ${level.color} ${classes.text}`}>
            Confidence: {confidence}%
          </span>
        )}
        {showIcon && (
          <Badge variant="outline" className={`${level.color} ${classes.badge}`}>
            <Icon className="h-3 w-3 mr-1" />
            {level.label}
          </Badge>
        )}
      </div>
      <Progress value={confidence} className={classes.height} />
    </div>
  );
};
