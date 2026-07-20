import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  GitCompare
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

interface RecoveryPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCode: string;
  proposedCode: string;
  confidence: number;
  trustScore: number;
  errorContext?: string;
  onApprove: () => void;
  onReject: () => void;
  scriptName: string;
}

export const RecoveryPreview = ({
  open,
  onOpenChange,
  currentCode,
  proposedCode,
  confidence,
  trustScore,
  errorContext,
  onApprove,
  onReject,
  scriptName
}: RecoveryPreviewProps) => {
  const [viewMode, setViewMode] = useState<"current" | "proposed" | "diff">(
    "diff"
  );

  const safeCurrent = currentCode || "// No current code available";
  const safeProposed = proposedCode || "// No proposed code available";

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-destructive";
  };

  const getConfidenceLabel = (score: number) => {
    if (score >= 80) return "High Confidence";
    if (score >= 60) return "Medium Confidence";
    return "Low Confidence";
  };

  const getTrustColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-chart-2";
    return "text-warning";
  };

  const diffView = useMemo(() => {
    return (
      <div className="grid grid-cols-2 gap-4">
        {/* Current */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-destructive">Current (Failed)</h3>
          <div className="rounded-lg overflow-hidden border border-destructive/20">
            <CodeMirror
              value={safeCurrent}
              height="400px"
              theme={oneDark}
              extensions={[javascript()]}
              editable={false}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLine: false
              }}
            />
          </div>
        </div>

        {/* Proposed */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-success">Proposed (AI Recovery)</h3>
          <div className="rounded-lg overflow-hidden border border-success/20">
            <CodeMirror
              value={safeProposed}
              height="400px"
              theme={oneDark}
              extensions={[javascript()]}
              editable={false}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLine: false
              }}
            />
          </div>
        </div>
      </div>
    );
  }, [safeCurrent, safeProposed]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] glass-effect">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <GitCompare className="h-6 w-6 text-accent" />
            AI Recovery Preview — {scriptName}
          </DialogTitle>
          <DialogDescription>
            Review the AI‑proposed recovery solution before applying it to your script
          </DialogDescription>
        </DialogHeader>

        {/* Error Context */}
        {errorContext && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Error Context:</p>
              <p className="text-sm text-muted-foreground mt-1">{errorContext}</p>
            </div>
          </div>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-4">
          {/* Confidence */}
          <div className="space-y-2 p-4 rounded-lg bg-background/50 border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">AI Confidence Score</span>
              <Badge className={getConfidenceColor(confidence)}>
                {getConfidenceLabel(confidence)}
              </Badge>
            </div>
            <Progress value={confidence} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {confidence}% — Based on test results and code analysis
            </p>
          </div>

          {/* Trust */}
          <div className="space-y-2 p-4 rounded-lg bg-background/50 border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Trust Score
              </span>
              <Badge className={getTrustColor(trustScore)}>{trustScore}/100</Badge>
            </div>
            <Progress value={trustScore} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Community reliability and past success rate
            </p>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex gap-2 justify-center">
          <Button
            variant={viewMode === "current" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("current")}
          >
            Current Code
          </Button>

          <Button
            variant={viewMode === "diff" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("diff")}
          >
            <GitCompare className="h-4 w-4 mr-1" />
            Side‑by‑Side
          </Button>

          <Button
            variant={viewMode === "proposed" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("proposed")}
          >
            Proposed Code
          </Button>
        </div>

        {/* Code Display */}
        <ScrollArea className="max-h-[400px]">
          {viewMode === "diff" ? (
            diffView
          ) : (
            <div className="rounded-lg overflow-hidden border">
              <CodeMirror
                value={viewMode === "current" ? safeCurrent : safeProposed}
                height="400px"
                theme={oneDark}
                extensions={[javascript()]}
                editable={false}
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  highlightActiveLine: false
                }}
              />
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="gap-2">
          <Button variant="destructive" onClick={onReject}>
            Reject Recovery
          </Button>

          <Button className="gradient-primary" onClick={onApprove}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Approve & Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
