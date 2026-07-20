import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Code2, TrendingUp, Zap, RefreshCw, Brain } from "lucide-react";
import { hybridDataManager } from "@/lib/hybridDataManager";

interface Stats {
  totalScripts: number;
  activeScripts: number;
  totalIterations: number;
  recentActivity: number;
  systemHealth: number;
}

export const StatsCards = () => {
  const [stats, setStats] = useState<Stats>({
    totalScripts: 0,
    activeScripts: 0,
    totalIterations: 0,
    recentActivity: 0,
    systemHealth: 100,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    const data = await hybridDataManager.getStats();
    setStats({
      ...data,
      totalIterations: 0,
      recentActivity: 0,
    });
    setIsLoading(false);
  };

  const statCards = [
    {
      title: "Total Scripts",
      value: stats.totalScripts,
      icon: Code2,
      color: "text-primary",
      bgColor: "bg-primary/10",
      description: stats.totalScripts > 0 ? "Scripts created" : "Create your first script"
    },
    {
      title: "Active Scripts",
      value: stats.activeScripts,
      icon: Zap,
      color: "text-success",
      bgColor: "bg-success/10",
      description: stats.activeScripts > 0 ? "Running smoothly" : "No active scripts"
    },
    {
      title: "AI Iterations",
      value: stats.totalIterations,
      icon: RefreshCw,
      color: "text-accent",
      bgColor: "bg-accent/10",
      description: stats.totalIterations > 0 ? "AI improvements" : "Ready to improve"
    },
    {
      title: "System Health",
      value: `${stats.systemHealth}%`,
      icon: Brain,
      color: stats.systemHealth >= 80 ? "text-success" : stats.systemHealth >= 50 ? "text-warning" : "text-destructive",
      bgColor: stats.systemHealth >= 80 ? "bg-success/10" : stats.systemHealth >= 50 ? "bg-warning/10" : "bg-destructive/10",
      description: stats.systemHealth >= 80 ? "Optimal performance" : stats.systemHealth >= 50 ? "Needs attention" : "Critical"
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-12 w-12 rounded-lg" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat, index) => (
        <Card 
          key={stat.title} 
          className="p-6 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 border-l-4 border-l-transparent hover:border-l-primary animate-fade-in group cursor-pointer"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground mb-1">
                {stat.title}
              </p>
              <p className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-foreground via-foreground/90 to-foreground/70 mb-1 group-hover:scale-105 transition-transform">
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </div>
            <div className={`${stat.bgColor} p-3 rounded-lg transition-all duration-300 group-hover:scale-110 group-hover:rotate-6`}>
              <stat.icon className={`h-6 w-6 ${stat.color}`} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
