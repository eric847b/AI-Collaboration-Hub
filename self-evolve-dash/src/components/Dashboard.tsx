import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Archive, Play, Square, Brain } from "lucide-react";

import { AITaskPanel } from "./AITaskPanel";
import { ScriptManager } from "./ScriptManager";
import { ActivityLog } from "./ActivityLog";
import { StatsCards } from "./StatsCards";
import { FragmentPool } from "./FragmentPool";
import { SelfImprovementPanel } from "./SelfImprovementPanel";
import { CodeGenerationPanel } from "./CodeGenerationPanel";
import { AutoImplementPanel } from "./AutoImplementPanel";
import { AutonomousControlPanel } from "./AutonomousControlPanel";
import { OfflineModePanel } from "./OfflineModePanel";
import { VersionControl } from "./VersionControl";
import { SandboxTesting } from "./SandboxTesting";
import { CodeQualityAnalyzer } from "./CodeQualityAnalyzer";
import { FeedbackLearningSystem } from "./FeedbackLearningSystem";
import { AdvancedAnalytics } from "./AdvancedAnalytics";
import { RecoverySystem } from "./RecoverySystem";
import { BackgroundTasksPanel } from "./BackgroundTasksPanel";
import { TestPanel } from "./TestPanel";
import { SystemHealthDashboard } from "./SystemHealthDashboard";
import { ConnectionStatus } from "./ConnectionStatus";
import { ErrorBoundary } from "./ErrorBoundary";
import { PerformanceMonitor } from "./PerformanceMonitor";
import { OmegaCorePanel } from "./OmegaCorePanel";

import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAutonomousEngine } from "@/hooks/useAutonomousEngine";

export const Dashboard = () => {
  const [fragmentPoolOpen, setFragmentPoolOpen] = useState(false);
  const { toast } = useToast();

  const { state, start, stop, isRunning, phase, metrics } = useAutonomousEngine();

  const handleToggleEngine = useCallback(() => {
    if (isRunning) {
      stop();
      toast({
        title: "Autonomous Engine Stopped",
        description: "Self-improvement cycle paused"
      });
    } else {
      start();
      toast({
        title: "🤖 Autonomous Engine Started",
        description: "AI will now improve scripts AND itself continuously"
      });
    }
  }, [isRunning, start, stop, toast]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background p-6">
        <PerformanceMonitor />

        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between animate-slide-up">
            <div className="space-y-2">
              <h1 className="text-5xl font-bold bg-clip-text text-transparent gradient-primary animate-glow-pulse">
                AI Script Automation
              </h1>
              <p className="text-muted-foreground text-lg flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent animate-pulse" />
                Autonomous Tampermonkey userscript creation and management
              </p>
              <p className="text-xs text-muted-foreground">
                Phase: <span className="font-semibold">{phase}</span> ·
                Success: <span className="font-semibold">{metrics.successRate}%</span> ·
                Gen: <span className="font-semibold">{metrics.generation}</span> ·
                Best fitness: <span className="font-semibold">{metrics.bestFitness}</span>
              </p>
            </div>

            <div className="flex gap-3 items-center">
              {isRunning && (
                <Badge className="bg-accent/20 text-accent border-accent/30 animate-pulse">
                  <Brain className="h-3 w-3 mr-1" />
                  {phase}
                </Badge>
              )}

              <Button
                size="lg"
                variant="outline"
                onClick={() => setFragmentPoolOpen(true)}
                className="hover-lift interactive-scale"
              >
                <Archive className="mr-2 h-5 w-5" />
                Fragment Pool
              </Button>

              <Button
                size="lg"
                onClick={handleToggleEngine}
                className={`${
                  isRunning
                    ? "bg-destructive hover:bg-destructive/90"
                    : "gradient-primary hover:opacity-90 hover-lift"
                } transition-all interactive-scale shadow-lg`}
              >
                {isRunning ? (
                  <>
                    <Square className="mr-2 h-5 w-5" />
                    Stop Engine
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-5 w-5" />
                    Start Engine
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Connection + Health */}
          <div className="grid md:grid-cols-2 gap-4">
            <ConnectionStatus />
            <SystemHealthDashboard />
          </div>

          {/* Stats */}
          <StatsCards />

          {/* Tabs */}
          <Tabs defaultValue="autonomous" className="space-y-6 animate-fade-in">
            <TabsList className="glass-effect p-1 shadow-lg flex flex-wrap gap-1">
              {[
                ["autonomous", "Autonomous"],
                ["overview", "Tasks"],
                ["scripts", "Scripts"],
                ["activity", "Activity"],
                ["self-improve", "Self-Improve"],
                ["code-gen", "Code Gen"],
                ["auto-apply", "Auto-Apply"],
                ["sandbox", "Sandbox"],
                ["versions", "Versions"],
                ["quality", "Quality"],
                ["analytics", "Analytics"],
                ["recovery", "Recovery"],
                ["bg-tasks", "Tasks BG"],
                ["omega", "Ω∞ Core"],
                ["test", "Test"]
              ].map(([value, label]) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="data-[state=active]:gradient-primary data-[state=active]:text-white data-[state=active]:shadow-lg transition-all"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="autonomous" className="space-y-6">
              <AutonomousControlPanel />
            </TabsContent>

            <TabsContent value="overview" className="space-y-6">
              <AITaskPanel />
            </TabsContent>

            <TabsContent value="scripts" className="space-y-6">
              <ScriptManager />
            </TabsContent>

            <TabsContent value="activity" className="space-y-6">
              <ActivityLog isAutonomous={isRunning} />
            </TabsContent>

            <TabsContent value="self-improve" className="space-y-6">
              <SelfImprovementPanel isActive={isRunning} />
            </TabsContent>

            <TabsContent value="code-gen" className="space-y-6">
              <CodeGenerationPanel />
            </TabsContent>

            <TabsContent value="auto-apply" className="space-y-6">
              <AutoImplementPanel />
            </TabsContent>

            <TabsContent value="sandbox" className="space-y-6">
              <SandboxTesting />
            </TabsContent>

            <TabsContent value="versions" className="space-y-6">
              <VersionControl />
            </TabsContent>

            <TabsContent value="quality" className="space-y-6">
              <CodeQualityAnalyzer />
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <div className="grid gap-6">
                <AdvancedAnalytics />
                <FeedbackLearningSystem />
              </div>
            </TabsContent>

            <TabsContent value="recovery" className="space-y-6">
              <div className="grid gap-6">
                <RecoverySystem />
                <OfflineModePanel />
              </div>
            </TabsContent>

            <TabsContent value="bg-tasks" className="space-y-6">
              <BackgroundTasksPanel />
            </TabsContent>

            <TabsContent value="omega" className="space-y-6">
              <OmegaCorePanel />
            </TabsContent>

            <TabsContent value="test" className="space-y-6">
              <TestPanel />
            </TabsContent>
          </Tabs>
        </div>

        <FragmentPool
          open={fragmentPoolOpen}
          onOpenChange={setFragmentPoolOpen}
        />
      </div>
    </ErrorBoundary>
  );
};
