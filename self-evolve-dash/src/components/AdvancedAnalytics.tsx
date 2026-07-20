import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart,
  TrendingUp,
  Activity,
  Download,
  RefreshCw,
  PieChart
} from "lucide-react";

import { analyticsTracker } from "@/lib/analyticsTracker";
import { useToast } from "@/hooks/use-toast";

import { useEngineMetrics } from "@/hooks/useEngineMetrics";
import { useEngineEvents } from "@/hooks/useEngineEvents";

export const AdvancedAnalytics = () => {
  const { toast } = useToast();

  // Engine metrics (live)
  const engine = useEngineMetrics();

  // AnalyticsTracker metrics (historical)
  const [trackerMetrics, setTrackerMetrics] = useState<any>(null);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);

  // Combined event feed (engine + tracker)
  const [liveEvents, setLiveEvents] = useState<any[]>([]);

  // Load initial analytics
  useEffect(() => {
    const data = analyticsTracker.getMetrics();
    setTrackerMetrics(data);
    setRecentEvents(analyticsTracker.getEvents(undefined, 20));
  }, []);

  // Listen for engine events
  useEngineEvents((event) => {
    const entry = {
      category: "engine",
      name: event.type,
      value: (event as any).success ?? undefined,
      timestamp: Date.now(),
      raw: event
    };

    setLiveEvents((prev) => [entry, ...prev].slice(0, 50));
  });

  const handleExport = () => {
    const data = {
      engineMetrics: engine,
      trackerMetrics,
      recentEvents,
      liveEvents
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `analytics-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);

    toast({
      title: "📊 Analytics Exported",
      description: "Analytics data downloaded successfully"
    });
  };

  if (!trackerMetrics) {
    return (
      <Card className="p-6 glass-effect border-accent/20">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-accent" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 glass-effect border-accent/20">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gradient flex items-center gap-2">
              <BarChart className="h-6 w-6 text-accent" />
              Advanced Analytics
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              System usage metrics, engine insights, and real-time events
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Events */}
          <Card className="p-4 glass-effect">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Activity className="h-4 w-4" />
                <span>Total Events</span>
              </div>
              <p className="text-2xl font-bold text-gradient">
                {trackerMetrics.total}
              </p>
            </div>
          </Card>

          {/* Categories */}
          <Card className="p-4 glass-effect">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <PieChart className="h-4 w-4" />
                <span>Categories</span>
              </div>
              <p className="text-2xl font-bold text-gradient">
                {Object.keys(trackerMetrics.byCategory).length}
              </p>
            </div>
          </Card>

          {/* Engine Success Rate */}
          <Card className="p-4 glass-effect">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <TrendingUp className="h-4 w-4" />
                <span>Success Rate</span>
              </div>
              <p className="text-2xl font-bold text-gradient">
                {engine.successRate}%
              </p>
            </div>
          </Card>

          {/* Engine Throughput */}
          <Card className="p-4 glass-effect">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <BarChart className="h-4 w-4" />
                <span>Throughput</span>
              </div>
              <p className="text-2xl font-bold text-gradient">
                {engine.throughput}
              </p>
            </div>
          </Card>
        </div>

        {/* Category Breakdown */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Category Breakdown</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {Object.entries(trackerMetrics.byCategory).map(
              ([category, data]: [string, any]) => (
                <Card
                  key={category}
                  className="p-4 glass-effect hover:scale-[1.01] transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{category}</span>
                      <Badge variant="outline">{data.count} events</Badge>
                    </div>

                    {data.avgValue > 0 && (
                      <div className="text-sm text-muted-foreground">
                        Avg Value:{" "}
                        <span className="font-semibold text-foreground">
                          {data.avgValue.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </Card>
              )
            )}
          </div>
        </div>

        {/* Recent Events (Tracker + Engine) */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Recent Events</h3>

          <ScrollArea className="h-[300px]">
            <div className="space-y-2 pr-4">
              {[...liveEvents, ...recentEvents].slice(0, 40).map((event, idx) => (
                <Card
                  key={idx}
                  className="p-3 glass-effect hover:bg-muted/50 transition-all text-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {event.category}
                        </Badge>
                        <span className="font-semibold">{event.name}</span>
                      </div>

                      {event.value !== undefined && (
                        <p className="text-xs text-muted-foreground">
                          Value: {event.value}
                        </p>
                      )}
                    </div>

                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </Card>
  );
};
