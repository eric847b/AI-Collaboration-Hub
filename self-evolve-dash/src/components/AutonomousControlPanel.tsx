import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Play, Square, Brain, Zap, CheckCircle2, XCircle, 
  Clock, TrendingUp, Target, RefreshCw, List, Trash2,
  Ban, RotateCcw, Gauge, Layers, ShieldCheck, Bell, BellOff, Rocket,
  AlertTriangle, Flame, Snowflake, Activity, Dna, Crosshair, ArrowUp, ArrowDown
} from "lucide-react";
import { autonomousEngine, AutonomousState } from "@/lib/autonomousEngine";
import type { TuningMode } from "@/lib/improvements/types";

const PHASE_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  idle: { label: 'Idle', color: 'text-muted-foreground', icon: RefreshCw },
  analyzing: { label: 'Analyzing...', color: 'text-blue-500', icon: Brain },
  generating: { label: 'Generating...', color: 'text-purple-500', icon: Zap },
  testing: { label: 'Testing...', color: 'text-yellow-500', icon: Gauge },
  applying: { label: 'Applying...', color: 'text-green-500', icon: CheckCircle2 },
  verifying: { label: 'Verifying...', color: 'text-indigo-500', icon: ShieldCheck },
  learning: { label: 'Learning...', color: 'text-cyan-500', icon: Brain },
  optimizing: { label: 'Optimizing...', color: 'text-orange-500', icon: Activity },
  refining: { label: 'Refining...', color: 'text-pink-500', icon: Target },
  cooldown: { label: 'Cooldown', color: 'text-muted-foreground', icon: Clock }
};

const SPEED_OPTIONS = [
  { value: 'slow', label: 'Slow', ms: 30000 },
  { value: 'normal', label: 'Normal', ms: 15000 },
  { value: 'fast', label: 'Fast', ms: 8000 },
  { value: 'turbo', label: 'Turbo', ms: 3000 },
  { value: 'ludicrous', label: '🚀 Ludicrous', ms: 1500 }
] as const;

const TUNING_MODES: Array<{ value: TuningMode; label: string; icon: any; desc: string }> = [
  { value: 'conservative', label: 'Conservative', icon: ShieldCheck, desc: 'Safe, high confidence' },
  { value: 'balanced', label: 'Balanced', icon: Activity, desc: 'Default trade-off' },
  { value: 'aggressive', label: 'Aggressive', icon: Flame, desc: 'Fast, lower threshold' },
  { value: 'maximum', label: 'Maximum', icon: Rocket, desc: 'All-out performance' },
  { value: 'auto', label: 'Auto', icon: Brain, desc: 'Self-tuning AI' }
];

export const AutonomousControlPanel = () => {
  const [state, setState] = useState<AutonomousState>(autonomousEngine.getState());
  const [autoApply, setAutoApply] = useState(true);
  const [minConfidence, setMinConfidence] = useState(70);
  const [showQueue, setShowQueue] = useState(false);
  const [showBlacklist, setShowBlacklist] = useState(false);
  const [autoStart, setAutoStart] = useState(true);
  const [notifications, setNotifications] = useState(true);

  useEffect(() => {
    autonomousEngine.loadState();
    setState(autonomousEngine.getState());
    const unsubscribe = autonomousEngine.subscribe(setState);
    return () => unsubscribe();
  }, []);

  // Live polling for real-time stats updates
  useEffect(() => {
    if (!state.isRunning) return;
    const id = window.setInterval(() => {
      setState(autonomousEngine.getState());
    }, 1000);
    return () => window.clearInterval(id);
  }, [state.isRunning]);

  useEffect(() => { autonomousEngine.setAutoApply(autoApply); }, [autoApply]);
  useEffect(() => { autonomousEngine.setMinConfidence(minConfidence); }, [minConfidence]);

  const handleToggle = useCallback(() => {
    if (state.isRunning) autonomousEngine.stop();
    else autonomousEngine.start();
  }, [state.isRunning]);

  const stats = autonomousEngine.getStats();
  const pendingSuggestions = autonomousEngine.getPendingSuggestions();
  const failedAttempts = autonomousEngine.getFailedAttempts();
  const phase = PHASE_CONFIG[state.currentPhase] || PHASE_CONFIG.idle;

  // Calculate refinement info
  const lowConfItems = pendingSuggestions.filter(s => {
    const conf = s.priority === 'high' ? 90 : s.priority === 'medium' ? 75 : 60;
    return conf < state.adaptiveConfidence;
  });
  const refiningCount = lowConfItems.length;

  return (
    <Card className="p-6 border-accent/20 shadow-xl bg-gradient-to-br from-background to-muted/30">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl bg-accent/10 ${state.isRunning ? 'animate-pulse' : ''}`}>
              <Brain className="h-8 w-8 text-accent" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                Autonomous Engine
              </h2>
              <p className="text-sm text-muted-foreground">
                {state.isRunning
                  ? `Gen ${stats.generation} • ${stats.rollingSuccessRate}% success • ${stats.throughput}/min`
                  : 'Genetic optimization • Confidence refinement • Live updates'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {stats.hasConverged && (
              <Badge className="bg-green-600/20 text-green-400 border-green-500/30 animate-pulse">
                <Crosshair className="h-3 w-3 mr-1" /> Converged
              </Badge>
            )}
            {refiningCount > 0 && state.isRunning && (
              <Badge className="bg-pink-600/20 text-pink-400 border-pink-500/30">
                <Target className="h-3 w-3 mr-1" /> Refining {refiningCount}
              </Badge>
            )}
            <Button
              size="lg"
              variant={state.isRunning ? "destructive" : "default"}
              onClick={handleToggle}
              className="min-w-[160px] gap-2 shadow-md hover:shadow-lg transition-all"
            >
              {state.isRunning ? (
                <><Square className="h-5 w-5" /> Stop</>
              ) : (
                <><Play className="h-5 w-5" /> Start Engine</>
              )}
            </Button>
          </div>
        </div>

        {/* Live Status Bar */}
        {state.isRunning && (
          <Card className="p-4 bg-gradient-to-r from-accent/5 to-primary/5 border-accent/30">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <phase.icon className={`h-5 w-5 ${phase.color} ${state.currentPhase !== 'idle' ? 'animate-spin' : ''}`} />
                <span className={`font-semibold ${phase.color}`}>{phase.label}</span>
                {state.lastTarget && (
                  <Badge variant="outline" className="text-xs">
                    <Target className="h-3 w-3 mr-1" /> {state.lastTarget}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <MiniStat icon={Layers} label={`Batch ${stats.adaptiveBatchSize}`} />
                <MiniStat icon={Gauge} label={state.cycleSpeed.toUpperCase()} />
                <MiniStat icon={Dna} label={`Gen ${stats.generation}`} />
                <MiniStat icon={Crosshair} label={`${stats.adaptiveConfidence}% conf`} />
              </div>
            </div>
            <Progress 
              value={
                state.currentPhase === 'idle' ? 0 :
                state.currentPhase === 'analyzing' ? 15 :
                state.currentPhase === 'generating' ? 30 :
                state.currentPhase === 'refining' ? 40 :
                state.currentPhase === 'testing' ? 50 :
                state.currentPhase === 'applying' ? 70 :
                state.currentPhase === 'verifying' ? 85 :
                state.currentPhase === 'learning' ? 92 :
                state.currentPhase === 'optimizing' ? 97 : 100
              } 
              className="h-2 mt-3"
            />
          </Card>
        )}

        <Tabs defaultValue="metrics" className="space-y-4">
          <TabsList className="w-full grid grid-cols-4 h-9">
            <TabsTrigger value="metrics" className="text-xs">Live Metrics</TabsTrigger>
            <TabsTrigger value="queue" className="text-xs">Queue ({pendingSuggestions.length})</TabsTrigger>
            <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs">Settings</TabsTrigger>
          </TabsList>

          {/* METRICS TAB */}
          <TabsContent value="metrics" className="space-y-4">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <StatCard icon={RefreshCw} label="Cycles" value={stats.cycleCount} color="text-primary" />
              <StatCard icon={CheckCircle2} label="Success" value={stats.successCount} color="text-green-500" />
              <StatCard icon={XCircle} label="Failed" value={stats.failureCount} color="text-destructive" />
              <StatCard icon={TrendingUp} label="Rate" value={`${stats.successRate}%`} color="text-accent" />
              <StatCard icon={Activity} label="Thru/m" value={stats.throughput} color="text-cyan-500" />
              <StatCard icon={Zap} label="Effic." value={stats.efficiency} color="text-amber-500" />
            </div>

            {state.isRunning && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                <StatCard icon={Crosshair} label="Conf %" value={`${stats.adaptiveConfidence}%`} color="text-indigo-500" />
                <StatCard icon={Dna} label="Best Fit" value={Math.round(stats.bestFitness)} color="text-purple-500" />
                <StatCard icon={Snowflake} label="Anneal" value={stats.annealingTemp} color="text-sky-500" />
                <StatCard icon={Flame} label="Mom." value={`${stats.momentumConf > 0 ? '↑' : stats.momentumConf < 0 ? '↓' : '—'}${Math.abs(stats.momentumConf)}`} color="text-orange-500" />
                <StatCard icon={Target} label="Rolling" value={`${stats.rollingSuccessRate}%`} color="text-emerald-500" />
                <StatCard icon={Ban} label="Blocked" value={stats.blacklistedCount} color="text-destructive" />
              </div>
            )}

            {/* Confidence Refinement Live Indicator */}
            {state.isRunning && refiningCount > 0 && (
              <Card className="p-4 bg-pink-500/5 border-pink-500/20">
                <div className="flex items-center gap-3 mb-2">
                  <Target className="h-5 w-5 text-pink-500 animate-pulse" />
                  <span className="font-semibold text-pink-600 text-sm">Confidence Refinement Active</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {refiningCount} items below the {state.adaptiveConfidence}% adaptive threshold are being refined until they meet the target.
                </p>
                <Progress value={Math.min(100, ((stats.adaptiveConfidence - 40) / 55) * 100)} className="h-1.5" />
              </Card>
            )}
          </TabsContent>

          {/* QUEUE TAB */}
          <TabsContent value="queue" className="space-y-4">
            {pendingSuggestions.length > 0 ? (
              <Card className="p-4 border-yellow-500/20">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <List className="h-4 w-4 text-yellow-500" /> Queue ({pendingSuggestions.length})
                  </h3>
                  <Button size="sm" variant="ghost" onClick={() => autonomousEngine.clearPendingSuggestions()} className="text-destructive h-7 text-xs">
                    <Trash2 className="h-3 w-3 mr-1" /> Clear
                  </Button>
                </div>
                <ScrollArea className="h-[250px]">
                  <div className="space-y-2 pr-2">
                    {pendingSuggestions.map((s, i) => {
                      const conf = s.priority === 'high' ? 90 : s.priority === 'medium' ? 75 : 60;
                      const needsRefinement = conf < state.adaptiveConfidence;
                      return (
                        <div key={i} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${needsRefinement ? 'bg-pink-500/5 border-pink-500/20' : 'bg-background/80 hover:bg-accent/5'}`}>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate flex items-center gap-1.5">
                              {needsRefinement && <Target className="h-3 w-3 text-pink-500 shrink-0" />}
                              {s.title}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                              <Badge variant="outline" className="text-xs h-5">{s.target}</Badge>
                              <Badge variant={s.priority === 'high' ? 'destructive' : s.priority === 'medium' ? 'secondary' : 'outline'} className="text-xs h-5">
                                {s.priority}
                              </Badge>
                              {s.fitness !== undefined && (
                                <span className="text-xs">Fit: {Math.round(s.fitness)}</span>
                              )}
                              {needsRefinement && (
                                <span className="text-xs text-pink-500">Refining...</span>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className="shrink-0 ml-2">{conf}%</Badge>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </Card>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <List className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Queue is empty — engine will discover new improvements</p>
              </div>
            )}

            {/* Blocked Items */}
            {failedAttempts.length > 0 && (
              <Card className="p-4 bg-destructive/5 border-destructive/20">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2 text-destructive">
                    <Ban className="h-4 w-4" /> Blocked ({failedAttempts.length})
                  </h3>
                  <Button size="sm" variant="ghost" onClick={() => autonomousEngine.clearFailedAttempts()} className="h-7 text-xs">
                    <Trash2 className="h-3 w-3 mr-1" /> Clear
                  </Button>
                </div>
                <ScrollArea className="h-[150px]">
                  <div className="space-y-2 pr-2">
                    {failedAttempts.map((f, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-background/80 rounded-lg border">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-xs truncate">{f.title}</div>
                          <div className="text-xs text-muted-foreground">{f.attempts}x failed</div>
                        </div>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => autonomousEngine.retryBlacklisted(f.hash)}>
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </Card>
            )}
          </TabsContent>

          {/* HISTORY TAB */}
          <TabsContent value="history" className="space-y-4">
            {stats.recentImprovements.length > 0 ? (
              <ScrollArea className="h-[350px] rounded-xl border bg-muted/30">
                <div className="space-y-2 p-3">
                  {stats.recentImprovements.map(imp => (
                    <Card key={imp.id} className={`p-3 border-l-4 transition-all hover:shadow-md ${
                      imp.verified ? 'border-l-green-500 bg-green-500/5' :
                      imp.applied ? 'border-l-blue-500 bg-blue-500/5' :
                      'border-l-yellow-500 bg-yellow-500/5'
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm flex items-center gap-1.5">
                            {imp.verified ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" /> :
                             imp.applied ? <Zap className="h-3.5 w-3.5 text-blue-500 shrink-0" /> :
                             <Clock className="h-3.5 w-3.5 text-yellow-500 shrink-0" />}
                            <span className="truncate">{imp.title}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Badge variant="outline" className="text-xs h-4 px-1.5">{imp.target}</Badge>
                            <span>{new Date(imp.timestamp).toLocaleTimeString()}</span>
                            {imp.executionTime && <span>{Math.round(imp.executionTime)}ms</span>}
                          </div>
                        </div>
                        <Badge variant={imp.confidence >= 80 ? "default" : "secondary"}
                          className={`shrink-0 text-xs ${imp.confidence >= 90 ? "bg-green-600 hover:bg-green-700" : ""}`}>
                          {imp.confidence}%
                        </Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No improvements yet — start the engine</p>
              </div>
            )}
          </TabsContent>

          {/* SETTINGS TAB */}
          <TabsContent value="settings" className="space-y-4">
            <Card className="p-4 bg-muted/30">
              {/* Tuning Mode */}
              <div className="space-y-3 mb-5">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Brain className="h-4 w-4" /> Tuning Mode
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {TUNING_MODES.map(mode => (
                    <Button key={mode.value} size="sm"
                      variant={stats.tuningMode === mode.value ? "default" : "outline"}
                      onClick={() => autonomousEngine.setTuningMode(mode.value)}
                      className="text-xs gap-1 h-8" title={mode.desc}
                    >
                      <mode.icon className="h-3 w-3" /> {mode.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Cycle Speed */}
              <div className="space-y-3 mb-5">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Gauge className="h-4 w-4" /> Cycle Speed
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SPEED_OPTIONS.map(speed => (
                    <Button key={speed.value} size="sm"
                      variant={state.cycleSpeed === speed.value ? "default" : "outline"}
                      onClick={() => autonomousEngine.setCycleSpeed(speed.value)}
                      className="flex-1 min-w-[70px] text-xs h-8"
                    >
                      {speed.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Min Confidence Slider */}
              <div className="space-y-3 mb-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Crosshair className="h-4 w-4" /> Min Confidence
                  </span>
                  <Badge variant="outline">{minConfidence}%</Badge>
                </div>
                <input type="range" min="40" max="95" step="5" value={minConfidence}
                  onChange={e => setMinConfidence(parseInt(e.target.value))}
                  className="w-full accent-primary h-2 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Toggles */}
              <div className="space-y-4">
                <SettingToggle icon={Rocket} label="Auto-Start" desc="Resume on page load"
                  checked={autoStart} onChange={(v) => { setAutoStart(v); autonomousEngine.setAutoStart(v); }} />
                <SettingToggle icon={notifications ? Bell : BellOff} label="Notifications" desc="Engine event alerts"
                  checked={notifications} onChange={(v) => { setNotifications(v); autonomousEngine.setNotifications(v); }} />
                <SettingToggle icon={Zap} label="Auto-Apply" desc="Apply high-confidence changes"
                  checked={autoApply} onChange={setAutoApply} />
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Last Error */}
        {state.lastError && (
          <Card className="p-4 bg-destructive/5 border-destructive/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-medium text-destructive">Error</div>
                <p className="text-xs text-muted-foreground">{state.lastError}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Empty State */}
        {!state.isRunning && stats.recentImprovements.length === 0 && (
          <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl">
            <div className="inline-block p-4 rounded-full bg-accent/10 mb-3">
              <Brain className="h-10 w-10 text-accent opacity-70" />
            </div>
            <h3 className="text-lg font-medium mb-1">Ready to Self-Improve</h3>
            <p className="text-xs max-w-sm mx-auto">
              Genetic optimization, confidence refinement, momentum tuning, and live updates — all autonomous.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

const MiniStat = ({ icon: Icon, label }: { icon: any; label: string }) => (
  <Badge variant="outline" className="text-xs px-2 py-0.5 gap-1">
    <Icon className="h-3 w-3" /> {label}
  </Badge>
);

const StatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) => (
  <Card className="p-3 text-center bg-muted/40 border-muted hover:bg-muted/60 transition-colors">
    <Icon className={`h-4 w-4 mx-auto mb-1 ${color}`} />
    <div className={`text-lg font-bold ${color}`}>{value}</div>
    <div className="text-[10px] text-muted-foreground">{label}</div>
  </Card>
);

const SettingToggle = ({ icon: Icon, label, desc, checked, onChange }: {
  icon: any; label: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
}) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-accent" />
      <div>
        <Label className="text-sm">{label}</Label>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);
