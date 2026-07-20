import { Badge } from "@/components/ui/badge";
import { TrendingUp, Shield, AlertTriangle } from "lucide-react";

interface TrustBadgeProps {
  trustScore: number;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

export const TrustBadge = ({ trustScore, size = "md", showIcon = true }: TrustBadgeProps) => {
  const getTrustLevel = (score: number) => {
    if (score >= 80) return {
      label: "High Trust",
      color: "bg-success/10 text-success border-success",
      icon: Shield,
    };
    if (score >= 60) return {
      label: "Medium Trust",
      color: "bg-chart-2/10 text-chart-2 border-chart-2",
      icon: TrendingUp,
    };
    return {
      label: "Low Trust",
      color: "bg-warning/10 text-warning border-warning",
      icon: AlertTriangle,
    };
  };

  const level = getTrustLevel(trustScore);
  const Icon = level.icon;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-1.5",
  };

  return (
    <Badge className={`${level.color} ${sizeClasses[size]} flex items-center gap-1`} variant="outline">
      {showIcon && <Icon className="h-3 w-3" />}
      {level.label}: {trustScore}
    </Badge>
  );
};
