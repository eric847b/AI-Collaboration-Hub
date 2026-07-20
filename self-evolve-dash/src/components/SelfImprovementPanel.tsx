import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Brain, CheckCircle, Loader2, Zap, Wifi, WifiOff, RefreshCw, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { safeInvoke, formatErrorMessage, safeQuery, checkBackendHealth } from "@/lib/connectionUtils";
import { localStorageManager } from "@/lib/localStorageManager";
import { hybridDataManager } from "@/lib/hybridDataManager";
import { autonomousEngine, CachedSuggestion } from "@/lib/autonomousEngine";

interface Suggestion {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  impact: string;
  implementation: string;
}

interface SelfImprovementPanelProps {
  isActive: boolean;
}

// Local analysis templates for offline mode
const LOCAL_SUGGESTIONS: Record<string, Suggestion[]> = {
  dashboard: [
    {
      title: "Optimize Component Rendering",
      description: "Add React.memo() to heavy components to prevent unnecessary re-renders",
      priority: "high",
      impact: "Reduces CPU usage and improves responsiveness, especially on lower-end devices",
      implementation: "Wrap components like ScriptManager, ActivityLog with React.memo(). Add useMemo for expensive calculations."
    },
    {
      title: "Implement Lazy Loading",
      description: "Split code by tabs to reduce initial bundle size",
      priority: "medium",
      impact: "Faster initial load time, better user experience on slow connections",
      implementation: "Use React.lazy() and Suspense for tab content. Load analytics and recovery tabs on demand."
    },
    {
      title: "Add Keyboard Shortcuts",
      description: "Power users can navigate faster with keyboard shortcuts",
      priority: "low",
      impact: "Improved productivity for frequent users, better accessibility",
      implementation: "Add useEffect listener for Ctrl+1-9 to switch tabs, Ctrl+N for new script, Ctrl+S for save."
    }
  ],
  components: [
    {
      title: "Create Shared Loading State Hook",
      description: "Centralize loading state management across components",
      priority: "high",
      impact: "Reduces code duplication, consistent loading UX across the app",
      implementation: "Create useLoadingState hook with start/stop/error methods. Replace individual useState patterns."
    },
    {
      title: "Add Error Boundaries Per Section",
      description: "Isolate failures to prevent full app crashes",
      priority: "medium",
      impact: "Better fault tolerance, clearer error messages for users",
      implementation: "Wrap each major section (scripts, analytics, recovery) in dedicated ErrorBoundary with fallback UI."
    },
    {
      title: "Implement Toast Queue",
      description: "Prevent toast spam by queuing notifications",
      priority: "low",
      impact: "Cleaner UX, important messages don't get lost",
      implementation: "Create ToastManager that limits concurrent toasts and queues overflow."
    }
  ],
  'agent-logic': [
    {
      title: "Add Retry Backoff Strategy",
      description: "Implement exponential backoff for failed operations",
      priority: "high",
      impact: "Better handling of transient failures, reduced server load during issues",
      implementation: "Update safeInvoke to use exponential backoff: 1s, 2s, 4s delays between retries."
    },
    {
      title: "Implement Script Caching",
      description: "Cache generated scripts locally for faster access",
      priority: "medium",
      impact: "Faster script loading, works offline, reduced API calls",
      implementation: "Use localStorageManager to cache scripts with TTL. Invalidate on updates."
    },
    {
      title: "Add Confidence Calibration",
      description: "Track actual success rate vs predicted confidence",
      priority: "low",
      impact: "More accurate confidence scores over time, better auto-apply decisions",
      implementation: "Store predictions and outcomes. Adjust confidence calculation based on historical accuracy."
    }
  ],
  performance: [
    {
      title: "Implement Virtual Scrolling",
      description: "Use virtualization for long lists (activity logs, scripts)",
      priority: "high",
      impact: "Handles thousands of items smoothly, reduced memory usage",
      implementation: "Use react-virtual or similar for ActivityLog and script lists. Only render visible items."
    },
    {
      title: "Add Request Debouncing",
      description: "Debounce rapid user actions to reduce API calls",
      priority: "medium",
      impact: "Lower server load, better rate limit compliance, smoother UX",
      implementation: "Add debounce to search, filter, and analysis trigger functions. Use 300ms delay."
    },
    {
      title: "Optimize State Updates",
      description: "Batch related state updates to reduce renders",
      priority: "low",
      impact: "Fewer re-renders, better performance during rapid updates",
      implementation: "Use useReducer for complex state, or batch updates with unstable_batchedUpdates."
    }
  ]
};

export const SelfImprovementPanel = ({ isActive }: SelfImprovementPanelProps) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [lastAnalysis, setLastAnalysis] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [currentTarget, setCurrentTarget] = useState<string | null>(null);
  const { toast } = useToast();

  // Check backend health on mount and periodically
  useEffect(() => {
    const checkHealth = async () => {
      const health = await checkBackendHealth();
      setIsOnline(health.healthy);
    };
    
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load cached suggestions on mount
  useEffect(() => {
    const cached = localStorageManager.get('self_improvement_suggestions');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setSuggestions(parsed.suggestions || []);
        setLastAnalysis(parsed.timestamp ? new Date(parsed.timestamp) : null);
        setCurrentTarget(parsed.target || null);
      } catch (e) {
        console.error('Failed to load cached suggestions:', e);
      }
    }
  }, []);

  const runLocalAnalysis = async (targetType: string): Promise<Suggestion[]> => {
    // Simulate analysis delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Get base suggestions
    const baseSuggestions = LOCAL_SUGGESTIONS[targetType] || LOCAL_SUGGESTIONS.dashboard;
    
    // Customize based on current state
    const scripts = await hybridDataManager.getScripts();
    const customizedSuggestions = [...baseSuggestions];
    
    // Add script-specific suggestions if we have scripts
    if (scripts.length > 5 && targetType === 'performance') {
      customizedSuggestions.unshift({
        title: "Paginate Script List",
        description: `You have ${scripts.length} scripts. Consider adding pagination.`,
        priority: "high",
        impact: "Faster load times, better navigation with many scripts",
        implementation: "Add pagination state with 10 items per page. Include page navigation controls."
      });
    }
    
    // Add low-confidence script suggestion
    const lowConfidenceScripts = scripts.filter(s => (s.performance_score || 0) < 70);
    if (lowConfidenceScripts.length > 0 && targetType === 'agent-logic') {
      customizedSuggestions.unshift({
        title: "Improve Low-Confidence Scripts",
        description: `${lowConfidenceScripts.length} scripts have low confidence scores and could benefit from refinement`,
        priority: "high",
        impact: "Higher quality scripts, better user trust",
        implementation: "Run autonomous improvement cycle on scripts with confidence < 70%"
      });
    }
    
    return customizedSuggestions;
  };

  const analyzeSelf = async (targetType: string) => {
    setIsAnalyzing(true);
    setCurrentTarget(targetType);
    
    try {
      let resultSuggestions: Suggestion[];
      
      if (isOnline) {
        // Try backend first
        try {
          const currentState = {
            targetType,
            timestamp: new Date().toISOString(),
            context: {
              activeScripts: await getActiveScriptsCount(),
              recentActivity: await getRecentActivitySummary(),
              systemHealth: "operational"
            }
          };

          const { data, error } = await safeInvoke('self-improve', 
            { targetType, currentState },
            { maxAttempts: 2, delayMs: 1000 }
          );

          if (error) throw new Error(error);
          resultSuggestions = data?.suggestions || [];
          
          if (resultSuggestions.length === 0) {
            // Fallback to local if backend returns empty
            resultSuggestions = await runLocalAnalysis(targetType);
          }
        } catch (backendError) {
          console.log('Backend unavailable, using local analysis:', backendError);
          setIsOnline(false);
          resultSuggestions = await runLocalAnalysis(targetType);
        }
      } else {
        // Use local analysis
        resultSuggestions = await runLocalAnalysis(targetType);
      }
      
      setSuggestions(resultSuggestions);
      setLastAnalysis(new Date());
      
      // Cache results
      localStorageManager.set('self_improvement_suggestions', JSON.stringify({
        suggestions: resultSuggestions,
        timestamp: new Date().toISOString(),
        target: targetType
      }));
      
      toast({
        title: "🧠 Analysis Complete",
        description: `Found ${resultSuggestions.length} improvements for ${targetType}${!isOnline ? ' (local mode)' : ''}`,
      });
    } catch (error) {
      console.error('Self-improvement error:', error);
      
      // Even on error, try local analysis as last resort
      try {
        const fallbackSuggestions = await runLocalAnalysis(targetType);
        setSuggestions(fallbackSuggestions);
        setLastAnalysis(new Date());
        
        toast({
          title: "Analysis Complete (Offline)",
          description: `Found ${fallbackSuggestions.length} local suggestions for ${targetType}`,
        });
      } catch (fallbackError) {
        toast({
          title: "Analysis Failed",
          description: formatErrorMessage(error),
          variant: "destructive",
        });
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getActiveScriptsCount = async () => {
    try {
      const scripts = await safeQuery(
        () => supabase
          .from('scripts')
          .select('id')
          .eq('status', 'active'),
        []
      );
      return scripts?.length || 0;
    } catch {
      const localScripts = await hybridDataManager.getScripts();
      return localScripts.filter(s => s.status === 'active').length;
    }
  };

  const getRecentActivitySummary = async () => {
    try {
      const data = await safeQuery(
        () => supabase
          .from('activity_logs')
          .select('type')
          .gte('created_at', new Date(Date.now() - 3600000).toISOString())
          .limit(50),
        []
      );
      
      return {
        total: data?.length || 0,
        byType: data?.reduce((acc: Record<string, number>, log: { type: string }) => {
          acc[log.type] = (acc[log.type] || 0) + 1;
          return acc;
        }, {})
      };
    } catch {
      return { total: 0, byType: {} };
    }
  };

  const getPriorityBadgeVariant = (priority: string): "destructive" | "secondary" | "outline" => {
    switch (priority) {
      case "high": return "destructive";
      case "medium": return "secondary";
      case "low": return "outline";
      default: return "outline";
    }
  };

  const analysisTargets = [
    { id: 'dashboard', label: 'Analyze Dashboard', color: 'primary' },
    { id: 'components', label: 'Analyze Components', color: 'accent' },
    { id: 'agent-logic', label: 'Analyze Agent Logic', color: 'success' },
    { id: 'performance', label: 'Analyze Performance', color: 'warning' }
  ];

  return (
    <Card className="p-6 glass-effect border-accent/20 animate-fade-in">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gradient flex items-center gap-2">
              <Brain className="h-6 w-6 text-accent animate-pulse" />
              Self-Improvement System
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              AI analyzes and suggests optimizations for code, dashboard, and logic
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Badge className="bg-success/20 text-success border-success/30">
                <Wifi className="h-3 w-3 mr-1" />
                Online
              </Badge>
            ) : (
              <Badge className="bg-warning/20 text-warning border-warning/30">
                <WifiOff className="h-3 w-3 mr-1" />
                Local Mode
              </Badge>
            )}
            {isActive && (
              <Badge className="bg-accent/20 text-accent border-accent/30 animate-pulse-glow">
                <Zap className="h-3 w-3 mr-1" />
                Active
              </Badge>
            )}
          </div>
        </div>

        {lastAnalysis && (
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <CheckCircle className="h-3 w-3 text-success" />
            Last analysis: {lastAnalysis.toLocaleString()}
            {currentTarget && <Badge variant="outline" className="text-xs">{currentTarget}</Badge>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {analysisTargets.map(target => (
            <Button
              key={target.id}
              onClick={() => analyzeSelf(target.id)}
              disabled={isAnalyzing}
              variant="outline"
              className={`hover:border-${target.color}/50 hover:bg-${target.color}/5 transition-all hover:scale-105`}
            >
              {isAnalyzing && currentTarget === target.id ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {target.label}
            </Button>
          ))}
        </div>

        {/* Quick Refresh */}
        {suggestions.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => currentTarget && analyzeSelf(currentTarget)}
            disabled={isAnalyzing}
            className="w-full"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
            Refresh Analysis
          </Button>
        )}

        {suggestions.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Improvement Suggestions</h3>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{suggestions.length} found</Badge>
                <Button
                  size="sm"
                  onClick={() => {
                    const cachedSuggestions: CachedSuggestion[] = suggestions.map(s => ({
                      ...s,
                      target: currentTarget || 'dashboard'
                    }));
                    autonomousEngine.addSuggestions(cachedSuggestions);
                    toast({
                      title: "Suggestions Queued",
                      description: `${suggestions.length} suggestions sent to autonomous engine`
                    });
                  }}
                  className="bg-accent/20 hover:bg-accent/30 text-accent"
                >
                  <Send className="h-3 w-3 mr-1" />
                  Send to Auto-Apply
                </Button>
              </div>
            </div>
            
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-4">
                {suggestions.map((suggestion, idx) => (
                  <Card
                    key={idx}
                    className="p-4 border-l-4 border-l-accent hover:scale-[1.01] transition-all animate-fade-in"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold">{suggestion.title}</h4>
                            <Badge variant={getPriorityBadgeVariant(suggestion.priority)}>
                              {suggestion.priority}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {suggestion.description}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            autonomousEngine.addSuggestions([{
                              ...suggestion,
                              target: currentTarget || 'dashboard'
                            }]);
                            toast({
                              title: "Suggestion Queued",
                              description: `"${suggestion.title}" added to autonomous queue`
                            });
                          }}
                          className="shrink-0"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <span className="text-xs font-semibold text-accent">Expected Impact:</span>
                          <p className="text-sm text-muted-foreground">{suggestion.impact}</p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-accent">Implementation:</span>
                          <p className="text-sm text-muted-foreground font-mono bg-muted/50 p-2 rounded mt-1">
                            {suggestion.implementation}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {suggestions.length === 0 && !isAnalyzing && (
          <div className="text-center py-12 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Click an analysis button to get AI-powered improvement suggestions</p>
            <p className="text-xs mt-2">
              {isOnline ? 'Connected to backend' : 'Works offline with local analysis'}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};
