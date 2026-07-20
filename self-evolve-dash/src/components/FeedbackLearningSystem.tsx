import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Brain, 
  ThumbsUp, 
  ThumbsDown, 
  TrendingUp, 
  BarChart, 
  Sparkles 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { useEngineEvents } from "@/hooks/useEngineEvents";
import { useAutonomousEngine } from "@/hooks/useAutonomousEngine";

interface FeedbackEntry {
  id: string;
  suggestionType: string;
  accepted: boolean;
  confidence: number;
  timestamp: string;
  context: string;
}

interface LearningMetric {
  category: string;
  acceptanceRate: number;
  totalSuggestions: number;
  avgConfidence: number;
  trend: "improving" | "stable" | "declining";
}

export const FeedbackLearningSystem = () => {
  const { toast } = useToast();
  const { state } = useAutonomousEngine();

  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [metrics, setMetrics] = useState<LearningMetric[]>([]);

  // Load existing feedback
  useEffect(() => {
    const saved = localStorage.getItem("ai_feedback");
    if (saved) setFeedback(JSON.parse(saved));
  }, []);

  // Listen for engine events and record feedback automatically
  useEngineEvents((event) => {
    if (event.type === "IMPROVEMENT_APPLIED") {
      recordFeedback(
        event.improvement.category ?? "General",
        true,
        event.improvement.confidence ?? 80,
        event.improvement.title
      );
    }

    if (event.type === "FAILED_ATTEMPT") {
      recordFeedback(
        event.suggestion.category ?? "General",
        false,
        event.suggestion.confidence ?? 50,
        event.suggestion.title
      );
    }
  });

  // Recalculate metrics whenever feedback changes
  useEffect(() => {
    calculateMetrics();
  }, [feedback]);

  const recordFeedback = (
    suggestionType: string,
    accepted: boolean,
    confidence: number,
    context: string
  ) => {
    const entry: FeedbackEntry = {
      id: crypto.randomUUID(),
      suggestionType,
      accepted,
      confidence,
      timestamp: new Date().toISOString(),
      context
    };

    const updated = [entry, ...feedback].slice(0, 500);
    setFeedback(updated);
    localStorage.setItem("ai_feedback", JSON.stringify(updated));

    toast({
      title: "📊 Feedback Recorded",
      description: `${accepted ? "Accepted" : "Rejected"}: ${suggestionType}`
    });
  };

  const calculateMetrics = () => {
    const categories = ["Security", "Performance", "Code Quality", "UI/UX", "General"];

    const calculated: LearningMetric[] = categories.map((category) => {
      const categoryFeedback = feedback.filter((f) => f.suggestionType === category);

      const accepted = categoryFeedback.filter((f) => f.accepted).length;
      const total = categoryFeedback.length;

      const acceptanceRate = total > 0 ? (accepted / total) * 100 : 0;
      const avgConfidence =
        total > 0
          ? categoryFeedback.reduce((sum, f) => sum + f.confidence, 0) / total
          : 0;

      const recent = categoryFeedback.slice(-10);
      const recentAccepted = recent.filter((f) => f.accepted).length;
      const recentRate = recent.length > 0 ? (recentAccepted / recent.length) * 100 : 0;

      let trend: "improving" | "stable" | "declining" = "stable";
      if (recentRate > acceptanceRate + 10) trend = "improving";
      else if (recentRate < acceptanceRate - 10) trend = "declining";

      return {
        category,
        acceptanceRate,
        totalSuggestions: total,
        avgConfidence,
        trend
      };
    });

    setMetrics(calculated);
  };

  const getOverallAcceptance = () => {
    if (feedback.length === 0) return 0;
    const accepted = feedback.filter((f) => f.accepted).length;
    return Math.round((accepted / feedback.length) * 100);
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "improving":
        return <TrendingUp className="h-4 w-4 text-success" />;
      case "declining":
        return <TrendingUp className="h-4 w-4 text-destructive rotate-180" />;
      default:
        return <BarChart className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "improving":
        return "text-success";
      case "declining":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <Card className="p-6 glass-effect border-accent/20">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gradient flex items-center gap-2">
              <Brain className="h-6 w-6 text-accent animate-pulse" />
              Learning & Feedback System
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              AI learns from your feedback to improve future suggestions
            </p>
          </div>
          <Badge className="bg-accent/20 text-accent border-accent/30">
            <Sparkles className="h-3 w-3 mr-1" />
            {feedback.length} insights
          </Badge>
        </div>

        {/* Overall Acceptance */}
        <Card className="p-6 border-l-4 border-l-accent">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Overall Acceptance Rate</h3>
              <span className="text-2xl font-bold text-gradient">
                {getOverallAcceptance()}%
              </span>
            </div>
            <Progress value={getOverallAcceptance()} className="h-3" />
            <p className="text-xs text-muted-foreground">
              Based on {feedback.length} AI suggestions
            </p>
          </div>
        </Card>

        {/* Category Metrics */}
        {metrics.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Learning by Category</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {metrics.map((metric, idx) => (
                <Card
                  key={idx}
                  className="p-4 glass-effect hover:scale-[1.02] transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{metric.category}</span>
                      <div className="flex items-center gap-2">
                        {getTrendIcon(metric.trend)}
                        <Badge className={getTrendColor(metric.trend)}>
                          {metric.trend}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Acceptance Rate</span>
                        <span className="font-semibold">
                          {Math.round(metric.acceptanceRate)}%
                        </span>
                      </div>
                      <Progress value={metric.acceptanceRate} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-muted/30 p-2 rounded">
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-semibold">{metric.totalSuggestions}</p>
                      </div>
                      <div className="bg-muted/30 p-2 rounded">
                        <p className="text-muted-foreground">Avg Confidence</p>
                        <p className="font-semibold">
                          {Math.round(metric.avgConfidence)}%
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Recent Feedback */}
        {feedback.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Recent Feedback</h3>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2 pr-4">
                {feedback.slice(0, 20).map((entry, idx) => (
                  <Card
                    key={entry.id}
                    className={`p-3 border-l-4 ${
                      entry.accepted ? "border-l-success" : "border-l-destructive"
                    } text-sm animate-fade-in`}
                    style={{ animationDelay: `${idx * 30}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {entry.accepted ? (
                          <ThumbsUp className="h-3 w-3 text-success" />
                        ) : (
                          <ThumbsDown className="h-3 w-3 text-destructive" />
                        )}
                        <span className="font-semibold">{entry.suggestionType}</span>
                        <Badge variant="outline" className="text-xs">
                          {entry.confidence}% conf
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Empty State */}
        {feedback.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No feedback data yet</p>
            <p className="text-xs mt-2">
              AI will learn as you accept or reject suggestions
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};
