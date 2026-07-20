import { useState, useEffect, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge, BadgeVariant } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Zap, CheckCircle2, XCircle, Loader2, PlayCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAutonomousEngine } from "@/hooks/useAutonomousEngine";
import { useEngineEvents } from "@/hooks/useEngineEvents";
import { useResourceOrchestrator } from "@/hooks/useResourceOrchestrator";

interface AppliedImprovement {
  id: string;
  filePath: string;
  suggestion: string;
  confidence: number;
  timestamp: string;
  success: boolean;
  provider?: string;        // Which AI provider made the change
  riskLevel?: "low" | "medium" | "high";
}

export const AutoImplementPanel = () => {
  const { toast } = useToast();
  const { state, dispatch } = useAutonomousEngine();
  const { providers, getBestProviderForTask } = useResourceOrchestrator();

  const [autoMode, setAutoMode] = useState(state.isRunning);
  const [minConfidence, setMinConfidence] = useState(state.adaptiveConfidence ?? 75);
  const [appliedImprovements, setAppliedImprovements] = useState<AppliedImprovement[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Sync with engine state
  useEffect(() => {
    setAutoMode(state.isRunning);
    setMinConfidence(state.adaptiveConfidence ?? 75);
  }, [state.isRunning, state.adaptiveConfidence]);

  // Listen for engine events
  useEngineEvents((event) => {
    if (event.type === "IMPROVEMENT_APPLIED") {
      const improvement: AppliedImprovement = {
        id: `imp_${Date.now()}`,
        filePath: event.improvement.target,
        suggestion: event.improvement.title,
        confidence: event.improvement.confidence,
        timestamp: event.improvement.timestamp || new Date().toISOString(),
        success: true,
        provider: event.improvement.provider,
        riskLevel: event.improvement.riskLevel,
      };

      setAppliedImprovements((prev) => [improvement, ...prev]);
      setIsProcessing(false);

      toast({
        title: "Improvement Applied",
        description: `${event.improvement.title} → ${event.improvement.target}`,
      });
    }

    if (event.type === "FAILED_ATTEMPT") {
      const failure: AppliedImprovement = {
        id: `imp_${Date.now()}`,
        filePath: event.suggestion.target,
        suggestion: event.suggestion.title,
        confidence: 0,
        timestamp: new Date().toISOString(),
        success: false,
        provider: event.suggestion.provider,
      };

      setAppliedImprovements((prev) => [failure, ...prev]);
      setIsProcessing(false);
    }

    if (event.type === "PROCESSING_STARTED") {
      setIsProcessing(true);
    }
  });

  const toggleAutoMode = useCallback(
    (value: boolean) => {
      setAutoMode(value);
      dispatch({ type: "TOGGLE_AUTO_MODE", payload: value });

      toast({
        title: value ? "Auto-Apply Enabled" : "Auto-Apply Disabled",
        description: value
          ? "High-confidence improvements will be applied automatically"
          : "Automatic application paused",
        variant: value ? "default" : "outline",
      });
    },
    [dispatch, toast]
  );

  const updateConfidence = useCallback(
    (value: number) => {
      setMinConfidence(value);
      dispatch({ type: "SET_MIN_CONFIDENCE", payload: value });

      toast({
        title: "Confidence Threshold Updated",
        description: `Auto-apply now requires ${value}%+ confidence`,
      });
    },
    [dispatch, toast]
  );

  const getConfidenceBadgeVariant = useCallback((confidence: number): BadgeVariant => {
    if (confidence >= 85) return "default";
    if (confidence >= 70) return "secondary";
    return "destructive";
  }, []);

  const getRiskBadge = (risk?: string) => {
    if (risk === "high") return <Badge variant="destructive" className="text-xs">High Risk</Badge>;
    if (risk === "medium") return <Badge variant="secondary" className="text-xs">Medium Risk</Badge>;
    return null;
  };

  // Live resource status
  const activeProvider = useMemo(() => {
    return providers.find(p => p.status === "healthy") || providers[0];
  }, [providers]);

  return (
    <Card className="p-6 glass-effect border-accent/20 animate-fade-in">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gradient flex items-center gap-2">
              <Zap className="h-6 w-6 text-accent animate-pulse" />
              Auto-Implementation Engine
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Safe autonomous code evolution with free AI optimization
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <div className={`w-2 h-2 rounded-full ${activeProvider?.status === "healthy" ? "bg-green-500" : "bg-yellow-500"}`} />
              {activeProvider?.name}
            </div>

            <Switch
              id="auto-mode"
              checked={autoMode}
              onCheckedChange={toggleAutoMode}
            />
            <Label htmlFor="auto-mode" className="cursor-pointer font-medium">
              {autoMode ? (
                <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">
                  <PlayCircle className="h-3 w-3 mr-1" />
                  AUTO ON
                </Badge>
              ) : (
                <Badge variant="outline">AUTO OFF</Badge>
              )}
            </Label>
          </div>
        </div>

        {/* Confidence Slider + Resource Info */}
        <Card className="p-5 bg-muted/30 border-accent/10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-sm font-medium">Minimum Confidence Threshold</span>
              <p className="text-xs text-muted-foreground">Higher = safer but slower evolution</p>
            </div>
            <Badge variant="outline" className="font-mono">{minConfidence}%</Badge>
          </div>

          <input
            type="range"
            min="50"
            max="100"
            step="5"
            value={minConfidence}
            onChange={(e) => updateConfidence(parseInt(e.target.value))}
            className="w-full accent-accent"
            disabled={!autoMode}
          />

          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" />
            Only improvements above this threshold are auto-applied
          </div>
        </Card>

        {/* Applied Improvements */}
        {appliedImprovements.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                Evolution History
                <Badge variant="secondary">{appliedImprovements.length}</Badge>
              </h3>
              <Badge variant="outline" className="text-xs">Latest first</Badge>
            </div>

            <ScrollArea className="h-[420px] pr-2">
              <div className="space-y-3">
                {appliedImprovements.map((imp) => (
                  <Card
                    key={imp.id}
                    className={`p-4 border-l-4 transition-all hover:shadow-md ${
                      imp.success ? "border-l-emerald-500" : "border-l-destructive"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          {imp.success ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                          <span className="font-semibold text-sm line-clamp-1">{imp.suggestion}</span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                            {imp.filePath}
                          </code>

                          {imp.success && (
                            <Badge variant={getConfidenceBadgeVariant(imp.confidence)}>
                              {imp.confidence}% confident
                            </Badge>
                          )}

                          {getRiskBadge(imp.riskLevel)}

                          {imp.provider && (
                            <Badge variant="outline" className="text-xs">
                              {imp.provider}
                            </Badge>
                          )}

                          <span className="text-xs text-muted-foreground ml-auto">
                            {new Date(imp.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl">
            <Zap className="h-16 w-16 mx-auto mb-4 opacity-40" />
            <p className="font-medium">No improvements applied yet</p>
            <p className="text-sm mt-1 max-w-xs mx-auto">
              {autoMode
                ? "High-confidence changes from free AI providers will appear here"
                : "Turn on Auto-Apply to begin autonomous evolution"}
            </p>
          </div>
        )}

        {isProcessing && (
          <div className="flex items-center justify-center gap-3 py-4 text-accent">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="font-medium">Applying safe improvement...</span>
          </div>
        )}
      </div>
    </Card>
  );
};