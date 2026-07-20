import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  BarChart3, 
  Shield, 
  Zap, 
  Users, 
  AlertCircle, 
  CheckCircle, 
  Info,
  TrendingUp,
  FileCode
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { useAutonomousEngine } from "@/hooks/useAutonomousEngine";
import { useEngineEvents } from "@/hooks/useEngineEvents";

interface QualityMetric {
  category: string;
  score: number;
  issues: {
    severity: "error" | "warning" | "info";
    message: string;
    line?: number;
  }[];
}

interface QualityReport {
  overallScore: number;
  metrics: QualityMetric[];
  timestamp: string;
}

export const CodeQualityAnalyzer = () => {
  const { toast } = useToast();
  const { dispatch } = useAutonomousEngine();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<QualityReport | null>(null);

  // Listen for engine events that deliver quality reports
  useEngineEvents((event) => {
    if (event.type === "IMPROVEMENT_APPLIED" && event.improvement.target === "quality") {
      const payload = event.improvement.metadata;
      if (!payload) return;

      setReport({
        overallScore: payload.overallScore,
        metrics: payload.metrics,
        timestamp: new Date().toISOString()
      });

      toast({
        title: "✅ Analysis Complete",
        description: `Overall Quality Score: ${payload.overallScore}/100`
      });

      setIsAnalyzing(false);
    }
  });

  const analyzeQuality = () => {
    setIsAnalyzing(true);

    // Send analysis request into engine pipeline
    dispatch({
      type: "SUGGESTIONS_ADDED",
      suggestions: [
        {
          title: "Analyze Code Quality",
          description: "Run full quality, security, and best-practices analysis",
          priority: "high",
          impact: "quality-analysis",
          implementation: "engine-quality-analysis",
          target: "quality",
          metadata: {}
        }
      ]
    });

    toast({
      title: "⏳ Running Analysis",
      description: "Engine is analyzing your code"
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-destructive";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-success/20 border-success/30";
    if (score >= 60) return "bg-warning/20 border-warning/30";
    return "bg-destructive/20 border-destructive/30";
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-warning" />;
      case "info":
        return <Info className="h-4 w-4 text-info" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  return (
    <Card className="p-6 glass-effect border-accent/20">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gradient flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-accent" />
              Code Quality Analyzer
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Comprehensive analysis of code quality, security, and best practices
            </p>
          </div>

          <Button
            onClick={analyzeQuality}
            disabled={isAnalyzing}
            className="hover:scale-105 transition-all"
          >
            {isAnalyzing ? (
              <>
                <Zap className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <FileCode className="mr-2 h-4 w-4" />
                Analyze Code
              </>
            )}
          </Button>
        </div>

        {/* Report */}
        {report && (
          <div className="space-y-6">
            {/* Overall Score */}
            <Card className={`p-6 border-l-4 ${getScoreBg(report.overallScore)}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Overall Quality Score</h3>
                  <p className="text-xs text-muted-foreground">
                    {new Date(report.timestamp).toLocaleString()}
                  </p>
                </div>
                <div className={`text-4xl font-bold ${getScoreColor(report.overallScore)}`}>
                  {report.overallScore}
                  <span className="text-lg">/100</span>
                </div>
              </div>
              <Progress value={report.overallScore} className="h-3" />
            </Card>

            {/* Metrics */}
            <div className="grid md:grid-cols-2 gap-4">
              {report.metrics.map((metric, idx) => (
                <Card
                  key={idx}
                  className="p-4 glass-effect hover:scale-[1.02] transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {metric.category === "Security" && <Shield className="h-5 w-5 text-accent" />}
                        {metric.category === "Performance" && <Zap className="h-5 w-5 text-accent" />}
                        {metric.category === "Maintainability" && <Users className="h-5 w-5 text-accent" />}
                        {metric.category === "Best Practices" && <TrendingUp className="h-5 w-5 text-accent" />}
                        <span className="font-semibold">{metric.category}</span>
                      </div>
                      <Badge className={getScoreColor(metric.score)}>
                        {metric.score}%
                      </Badge>
                    </div>

                    <Progress value={metric.score} className="h-2" />

                    <div className="space-y-2">
                      {metric.issues.map((issue, issueIdx) => (
                        <div
                          key={issueIdx}
                          className="flex items-start gap-2 text-xs bg-muted/30 p-2 rounded"
                        >
                          {getSeverityIcon(issue.severity)}
                          <div className="flex-1">
                            <p className="text-foreground">{issue.message}</p>
                            {issue.line && (
                              <p className="text-muted-foreground mt-0.5">
                                Line {issue.line}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Recommendations */}
            <Card className="p-4 bg-accent/5 border-accent/20">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-accent" />
                Quick Wins
              </h3>
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li>✅ Fix all security warnings to improve score</li>
                <li>✅ Optimize nested loops for better performance</li>
                <li>✅ Add error handling to critical functions</li>
                <li>✅ Refactor long functions for maintainability</li>
              </ul>
            </Card>
          </div>
        )}

        {/* Empty State */}
        {!report && !isAnalyzing && (
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No analysis yet</p>
            <p className="text-xs mt-2">Click analyze to get a comprehensive quality report</p>
          </div>
        )}
      </div>
    </Card>
  );
};
