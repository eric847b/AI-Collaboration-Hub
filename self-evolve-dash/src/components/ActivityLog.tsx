import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Activity, CheckCircle, XCircle, AlertCircle, RefreshCw, Search } from "lucide-react";
import { hybridDataManager } from "@/lib/hybridDataManager";
import { ActivityLog as ActivityLogType } from "@/lib/localStorageManager";
import { useEngineEvents } from "@/hooks/useEngineEvents";

interface ActivityLogProps {
  isAutonomous: boolean;
}

export const ActivityLog = ({ isAutonomous }: ActivityLogProps) => {
  const [logs, setLogs] = useState<ActivityLogType[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const initialized = useRef(false);

  // Load historical logs once
  const loadLogs = async () => {
    setIsLoading(true);
    const data = await hybridDataManager.getActivityLogs(50);
    setLogs(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  // Real-time engine events
  useEngineEvents((event) => {
    if (!initialized.current) return; // avoid firing during initial load

    const entry: ActivityLogType = {
      id: crypto.randomUUID(),
      type: mapEventType(event),
      message: formatEvent(event),
      metadata: event,
      created_at: new Date().toISOString()
    };

    setLogs((prev) => [entry, ...prev].slice(0, 200));
  });

  // Mark initialization complete after first load
  useEffect(() => {
    if (!isLoading) initialized.current = true;
  }, [isLoading]);

  const mapEventType = (event: any): string => {
    switch (event.type) {
      case "ERROR":
      case "FAILED_ATTEMPT":
        return "error";
      case "IMPROVEMENT_APPLIED":
      case "CYCLE_RESULT":
        return event.success === false ? "error" : "success";
      default:
        return "info";
    }
  };

  const formatEvent = (event: any): string => {
    switch (event.type) {
      case "PHASE":
        return `Phase → ${event.phase}`;
      case "START":
        return "Engine started";
      case "STOP":
        return "Engine stopped";
      case "ERROR":
        return `Error: ${event.message}`;
      case "SUGGESTIONS_ADDED":
        return `Added ${event.suggestions.length} suggestion(s)`;
      case "IMPROVEMENT_APPLIED":
        return `Improvement applied: ${event.improvement.title}`;
      case "FAILED_ATTEMPT":
        return `Failed attempt: ${event.suggestion.title}`;
      case "CYCLE_RESULT":
        return event.success ? "Cycle success" : "Cycle failure";
      default:
        return `Event: ${event.type}`;
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "error":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Activity className="h-4 w-4 text-primary" />;
    }
  };

  const filteredLogs = logs.filter((log) => {
    const q = searchQuery.toLowerCase();
    return (
      log.message.toLowerCase().includes(q) ||
      (log.metadata && JSON.stringify(log.metadata).toLowerCase().includes(q))
    );
  });

  return (
    <Card className="p-6 glass-effect animate-fade-in">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gradient flex items-center gap-2">
              <Activity className="h-6 w-6 text-accent" />
              Activity Log
            </h2>
            <p className="text-sm text-muted-foreground">
              Real-time monitoring of system operations
            </p>
          </div>

          {isAutonomous && (
            <Badge className="bg-accent text-accent-foreground animate-pulse-glow">
              <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
              Live
            </Badge>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search activities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <ScrollArea className="h-[500px]">
        <div className="space-y-3">
          {isLoading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="p-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-5 w-5 rounded" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                </Card>
              ))}
            </>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{logs.length === 0 ? "No activity yet" : "No matching activities found"}</p>
              {logs.length > 0 && <p className="text-sm mt-2">Try adjusting your search</p>}
            </div>
          ) : (
            filteredLogs.map((log, index) => (
              <Card
                key={log.id}
                className={`p-4 border-l-4 transition-all hover:scale-[1.01] animate-fade-in ${
                  log.type === "success"
                    ? "border-l-success"
                    : log.type === "error"
                    ? "border-l-destructive"
                    : "border-l-primary"
                }`}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{getIcon(log.type)}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium">{log.message}</p>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    {log.metadata && (
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                        {JSON.stringify(log.metadata, null, 2)}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
};
