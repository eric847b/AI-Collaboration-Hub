import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, XCircle, Clock, Loader2, Timer } from "lucide-react";

import { taskQueue, BackgroundTask, TaskLogEntry } from "@/lib/taskQueue";
import { useEngineEvents } from "@/hooks/useEngineEvents";

const statusIcon = (status: BackgroundTask["status"]) => {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-3 w-3 text-green-500" />;
    case "failed":
      return <XCircle className="h-3 w-3 text-red-500" />;
    case "running":
      return <Loader2 className="h-3 w-3 animate-spin text-blue-500" />;
    case "cooldown":
      return <Timer className="h-3 w-3 text-yellow-500" />;
    default:
      return <Clock className="h-3 w-3 text-muted-foreground" />;
  }
};

const statusVariant = (
  status: BackgroundTask["status"]
): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "completed":
      return "default";
    case "failed":
      return "destructive";
    case "running":
      return "secondary";
    default:
      return "outline";
  }
};

export const BackgroundTasksPanel = () => {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [lastExecuted, setLastExecuted] = useState<BackgroundTask | null>(null);
  const [log, setLog] = useState<TaskLogEntry[]>([]);

  // Unified refresh function
  const refresh = () => {
    setTasks(taskQueue.getAllTasks());
    setLastExecuted(taskQueue.getLastExecuted());
    setLog(taskQueue.getLog().slice(0, 20));
  };

  // Initial load
  useEffect(() => {
    refresh();
  }, []);

  // Real-time engine events update the task panel instantly
  useEngineEvents(() => {
    refresh();
  });

  const stats = taskQueue.getStats();

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Current Tasks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            Background Tasks
            <div className="flex gap-1">
              <Badge variant="outline" className="text-xs">
                {stats.pending} pending
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {stats.running} running
              </Badge>
              <Badge variant="default" className="text-xs">
                {stats.completed} done
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="space-y-2">
            {tasks.length === 0 && (
              <p className="text-xs text-muted-foreground">No background tasks</p>
            )}

            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between text-xs border rounded p-2"
              >
                <div className="flex items-center gap-2">
                  {statusIcon(task.status)}
                  <span className="font-mono">{task.type}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant={statusVariant(task.status)}
                    className="text-[10px]"
                  >
                    {task.status}
                  </Badge>

                  <span className="text-muted-foreground">P{task.priority}</span>

                  {task.retries > 0 && (
                    <span className="text-muted-foreground">
                      R{task.retries}/{task.maxRetries}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {lastExecuted && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-muted-foreground mb-1">Last Executed</p>
              <div className="text-xs font-mono">
                {lastExecuted.type} —{" "}
                {lastExecuted.lastResult ||
                  lastExecuted.error ||
                  "No result"}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Task Activity Log</CardTitle>
        </CardHeader>

        <CardContent>
          <ScrollArea className="h-[220px]">
            <div className="space-y-1">
              {log.length === 0 && (
                <p className="text-xs text-muted-foreground">No activity yet</p>
              )}

              {log.map((entry, i) => (
                <div
                  key={i}
                  className="text-[11px] font-mono border-b border-border/50 py-1"
                >
                  <span className="text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>{" "}
                  <span className="font-semibold">{entry.action}</span>{" "}
                  <span className="text-muted-foreground">{entry.taskType}</span>{" "}
                  <span>{entry.detail}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
