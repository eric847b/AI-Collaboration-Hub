import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Send, Loader2, Sparkles, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

import { useAutonomousEngine } from "@/hooks/useAutonomousEngine";
import { useEngineEvents } from "@/hooks/useEngineEvents";

import AutonomousAgent from "./AutonomousAgent";

const QUICK_PROMPTS = [
  "Create a script that highlights all external links on any webpage",
  "Make a script that adds a dark mode toggle to YouTube",
  "Build a script that auto-fills forms with test data",
  "Create a script that removes ads from news websites",
];

export const AITaskPanel = () => {
  const { toast } = useToast();

  // Engine state
  const { state, dispatch, isRunning } = useAutonomousEngine();

  // Local UI state
  const [task, setTask] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [autonomousTask, setAutonomousTask] = useState<string | null>(null);
  const [conversation, setConversation] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);

  // Sync autonomous mode with engine
  const [isAutonomous, setIsAutonomous] = useState(isRunning);

  useEffect(() => {
    setIsAutonomous(isRunning);
  }, [isRunning]);

  // Listen for engine events to update conversation
  useEngineEvents((event) => {
    if (!isAutonomous) return;

    switch (event.type) {
      case "PHASE":
        setConversation((prev) => [
          ...prev,
          { role: "assistant", content: `→ Phase changed to **${event.phase}**` }
        ]);
        break;

      case "IMPROVEMENT_APPLIED":
        setConversation((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `✓ Improvement applied: ${event.improvement.title}`
          }
        ]);
        break;

      case "FAILED_ATTEMPT":
        setConversation((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `✗ Failed attempt: ${event.suggestion.title}`
          }
        ]);
        break;

      case "CYCLE_RESULT":
        setConversation((prev) => [
          ...prev,
          {
            role: "assistant",
            content: event.success
              ? "✓ Cycle succeeded"
              : "✗ Cycle failed"
          }
        ]);
        break;
    }
  });

  // Submit task
  const handleSubmitTask = async () => {
    if (!task.trim()) return;

    const userMessage = { role: "user" as const, content: task };
    setConversation((prev) => [...prev, userMessage]);

    const taskContent = task;
    setTask("");

    // Autonomous mode → send task into engine pipeline
    if (isAutonomous) {
      setAutonomousTask(taskContent);

      dispatch({
        type: "SUGGESTIONS_ADDED",
        suggestions: [
          {
            title: `User Task: ${taskContent}`,
            description: "User-submitted autonomous task",
            priority: "high",
            impact: "User request",
            implementation: "engine-autonomous-task",
            target: "scripts"
          }
        ]
      });

      toast({
        title: "Autonomous Task Added",
        description: "Engine will process this task automatically"
      });

      return;
    }

    // Manual mode → Supabase function
    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke("process-task", {
        body: { task: taskContent, isAutonomous: false }
      });

      if (error) throw error;

      const response = {
        role: "assistant" as const,
        content: data.message
      };

      setConversation((prev) => [...prev, response]);

      toast({
        title: "Success!",
        description: "Script created successfully"
      });
    } catch (error) {
      console.error("Task processing error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to process task",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Autonomous agent commit
  const handleAutonomousCommit = (script: any) => {
    setConversation((prev) => [
      ...prev,
      {
        role: "assistant",
        content: `✓ Script "${script.name}" created and validated successfully!`
      }
    ]);
    setAutonomousTask(null);

    toast({
      title: "Autonomous agent completed!",
      description: `Created ${script.name}`
    });
  };

  // Autonomous agent error
  const handleAutonomousError = (error: any) => {
    setConversation((prev) => [
      ...prev,
      {
        role: "assistant",
        content: `✗ Autonomous agent failed: ${error.message || error}`
      }
    ]);
    setAutonomousTask(null);

    toast({
      title: "Autonomous agent failed",
      description: "Manual review recommended",
      variant: "destructive"
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left Panel */}
      <Card className="p-6 space-y-4 border-primary/20 glass-effect animate-fade-in">
        <div>
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <span className="text-gradient">Task AI Agent</span>
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          </h2>
          <p className="text-sm text-muted-foreground">
            Describe what you want the AI to create or improve. In autonomous mode, it will
            continue optimizing without interruption.
          </p>
        </div>

        {/* Task Input */}
        <div className="space-y-4">
          <Textarea
            placeholder="Example: Create a userscript that highlights all links on Reddit in bright green and adds a copy button..."
            value={task}
            onChange={(e) => setTask(e.target.value)}
            className="min-h-32 bg-secondary border-muted"
            disabled={isProcessing || !!autonomousTask}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmitTask();
              }
            }}
          />

          {/* Autonomous Mode Toggle */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background/30 border border-white/10">
            <Switch
              id="autonomous-mode"
              checked={isAutonomous}
              onCheckedChange={setIsAutonomous}
              disabled={isProcessing || !!autonomousTask}
            />
            <Label htmlFor="autonomous-mode" className="text-sm cursor-pointer">
              <span className="font-medium">Autonomous Mode</span>
              <span className="text-muted-foreground ml-2 text-xs">
                Auto-test and self-recover
              </span>
            </Label>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmitTask}
            disabled={isProcessing || !task.trim() || !!autonomousTask}
            className="w-full gradient-primary hover:opacity-90 transition-all hover:scale-[1.02] hover:glow-primary"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                {isAutonomous ? "Start Autonomous Agent" : "Submit Task"}
              </>
            )}
          </Button>
        </div>

        {/* Quick Prompts */}
        <div className="pt-4 border-t border-border space-y-3">
          <h3 className="font-semibold text-accent flex items-center gap-2">
            <Sparkles className="h-4 w-4 animate-pulse" />
            Quick Start Ideas
          </h3>
          <div className="grid gap-2">
            {QUICK_PROMPTS.map((prompt, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                className="justify-start text-left h-auto py-2 px-3 hover:border-accent/50 hover:bg-accent/5 transition-all hover:scale-[1.01] animate-fade-in"
                style={{ animationDelay: `${idx * 50}ms` }}
                onClick={() => setTask(prompt)}
                disabled={isProcessing}
              >
                <span className="text-xs line-clamp-2">{prompt}</span>
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Right Panel — Conversation */}
      <Card className="p-6 space-y-4 border-accent/20 glass-effect animate-fade-in" style={{ animationDelay: "100ms" }}>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <span className="text-gradient">Conversation</span>
          {(isProcessing || autonomousTask) && (
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
          )}
        </h2>

        {autonomousTask && (
          <AutonomousAgent
            task={autonomousTask}
            onCommit={handleAutonomousCommit}
            onError={handleAutonomousError}
          />
        )}

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {conversation.length === 0 && !isProcessing ? (
            <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 animate-float">
                <MessageSquare className="h-8 w-8" />
              </div>
              <p className="font-semibold text-lg">No conversations yet</p>
              <p className="text-sm mt-2">Submit a task to start your first AI conversation</p>
            </div>
          ) : (
            <>
              {conversation.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg transition-all animate-fade-in ${
                    msg.role === "user"
                      ? "bg-primary/10 border border-primary/20 ml-8 hover:bg-primary/15"
                      : "bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 mr-8 hover:from-accent/15 hover:to-accent/10"
                  }`}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <p className="font-semibold text-sm">
                    {msg.role === "user" ? "You" : "✨ AI Agent"}
                  </p>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))}

              {isProcessing && (
                <div className="p-4 rounded-lg bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 mr-8 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-accent animate-pulse" />
                    <p className="font-semibold text-sm">AI Agent is thinking...</p>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
};
