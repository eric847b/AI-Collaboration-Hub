import { useState, useEffect } from "react";
import { generateScript, testScript, reviseScript, logAction, archiveVersion } from "@/lib/agentUtils";
import { Loader2, CheckCircle2, AlertCircle, Sparkles, RefreshCw, Code } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface AutonomousAgentProps {
  task: string;
  onCommit: (script: any) => void;
  onError: (error: any) => void;
}

export default function AutonomousAgent({ task, onCommit, onError }: AutonomousAgentProps) {
  const [status, setStatus] = useState<"idle" | "generating" | "testing" | "revising" | "complete" | "failed">("idle");
  const [script, setScript] = useState<any>(null);
  const [errorContext, setErrorContext] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const maxAttempts = 3;

  useEffect(() => {
    if (!task) return;
    setStatus("generating");
    runAutonomousLoop(task);
  }, [task]);

  async function runAutonomousLoop(taskDescription: string) {
    try {
      const initial = await generateScript(taskDescription);
      setScript(initial);
      setStatus("testing");
      
      const test = await testScript(initial);

      if (test.pass) {
        await archiveVersion(initial, "stable");
        await logAction({ 
          task: taskDescription, 
          result: "pass", 
          source: "initial", 
          scriptId: initial.id,
          trustScore: test.trustScore 
        });
        onCommit(initial);
        setStatus("complete");
      } else {
        setErrorContext(test.error);
        await handleRevision(initial, test.error, taskDescription);
      }
    } catch (err) {
      onError(err);
      setStatus("failed");
    }
  }

  async function handleRevision(currentScript: any, error: string, taskDescription: string) {
    let current = currentScript;
    let currentError = error;
    
    while (attempts < maxAttempts) {
      setStatus("revising");
      setAttempts((prev) => prev + 1);
      
      const revised = await reviseScript(current, currentError);
      setStatus("testing");
      const test = await testScript(revised);

      if (test.pass) {
        await archiveVersion(revised, "stable");
        await logAction({ 
          task: taskDescription, 
          result: "pass", 
          source: "revised", 
          attempts, 
          scriptId: revised.id,
          trustScore: test.trustScore 
        });
        onCommit(revised);
        setStatus("complete");
        return;
      } else {
        current = revised;
        currentError = test.error;
      }
    }

    await logAction({ task: taskDescription, result: "fail", source: "revised", attempts, scriptId: current.id });
    onError(currentError);
    setStatus("failed");
  }

  const statusConfig = {
    idle: { icon: null, text: "Idle", color: "text-muted-foreground", bgColor: "bg-muted/10" },
    generating: { icon: Loader2, text: "Generating script...", color: "text-primary", bgColor: "bg-primary/10" },
    testing: { icon: Loader2, text: "Testing script...", color: "text-accent", bgColor: "bg-accent/10" },
    revising: { icon: Loader2, text: `Revising (attempt ${attempts}/${maxAttempts})...`, color: "text-warning", bgColor: "bg-warning/10" },
    complete: { icon: CheckCircle2, text: "Complete!", color: "text-success", bgColor: "bg-success/10" },
    failed: { icon: AlertCircle, text: "Failed - manual review needed", color: "text-destructive", bgColor: "bg-destructive/10" }
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  const progressPercentage = ((attempts + 1) / (maxAttempts + 1)) * 100;

  return (
    <div className="glass-panel p-6 rounded-lg border border-primary/20 space-y-4 animate-fade-in shadow-lg">
      <div className="flex items-start gap-4">
        <div className={`p-3 ${config.bgColor} rounded-full transition-all ${status === 'generating' || status === 'testing' || status === 'revising' ? 'animate-pulse' : ''}`}>
          {Icon && <Icon className={`h-6 w-6 ${config.color} ${status === 'generating' || status === 'testing' || status === 'revising' ? 'animate-spin' : ''}`} />}
        </div>
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <p className={`font-semibold text-lg ${config.color} flex items-center gap-2`}>
              {config.text}
              {(status === 'generating' || status === 'testing' || status === 'revising') && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
              )}
            </p>
            <Badge 
              variant={status === 'complete' ? 'default' : status === 'failed' ? 'destructive' : 'secondary'}
              className="transition-all"
            >
              {status === 'complete' ? <CheckCircle2 className="h-3 w-3 mr-1" /> : null}
              {status === 'failed' ? <AlertCircle className="h-3 w-3 mr-1" /> : null}
              {status}
            </Badge>
          </div>

          {/* Progress Bar for Active States */}
          {(status === 'generating' || status === 'testing' || status === 'revising') && (
            <div className="space-y-2">
              <Progress value={progressPercentage} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {status === 'revising' ? `Attempt ${attempts}/${maxAttempts}` : 'Processing...'}
              </p>
            </div>
          )}

          {/* Script Info */}
          {script && (
            <div className="p-3 rounded-lg glass-effect border border-primary/20 flex items-center gap-2 hover-lift transition-all">
              <Code className="h-4 w-4 text-accent animate-pulse" />
              <span className="text-sm font-medium">{script.name}</span>
              <Badge variant="outline" className="text-xs border-accent/50">v{script.version}</Badge>
            </div>
          )}

          {/* Error Context */}
          {status === "failed" && (
            <div className="p-4 rounded-lg glass-effect bg-destructive/10 border border-destructive/30 animate-fade-in shadow-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-destructive font-semibold mb-1">
                    AI revision failed after {maxAttempts} attempts
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Manual review recommended. The script has been flagged for human intervention.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {errorContext && status !== "complete" && status !== "failed" && (
            <div className="p-4 rounded-lg glass-effect bg-warning/10 border border-warning/30 animate-fade-in">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-warning mb-1">Error Context:</p>
                  <p className="text-xs text-muted-foreground font-mono">{errorContext}</p>
                </div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {status === "complete" && (
            <div className="p-4 rounded-lg glass-effect bg-success/10 border border-success/30 animate-scale-bounce shadow-lg glow-success">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-success animate-pulse" />
                <p className="text-sm text-success font-semibold">
                  Script validated and deployed successfully!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
