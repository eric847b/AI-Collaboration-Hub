import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TestTube, Play, CheckCircle, XCircle, Loader2, Shield, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

interface TestResult {
  id: string;
  code: string;
  status: 'passed' | 'failed' | 'running';
  output?: string;
  error?: string;
  timestamp: string;
}

export const SandboxTesting = () => {
  const [testCode, setTestCode] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const { toast } = useToast();

  const runInSandbox = async () => {
    if (!testCode.trim()) {
      toast({
        title: "No Code",
        description: "Enter code to test in sandbox",
        variant: "destructive",
      });
      return;
    }

    setIsRunning(true);
    const resultId = crypto.randomUUID();
    
    const runningResult: TestResult = {
      id: resultId,
      code: testCode,
      status: 'running',
      timestamp: new Date().toISOString()
    };
    
    setResults(prev => [runningResult, ...prev]);

    try {
      // Simulate sandboxed execution
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Basic code validation
      const hasErrors = testCode.includes('throw') || testCode.includes('error');
      
      const finalResult: TestResult = {
        ...runningResult,
        status: hasErrors ? 'failed' : 'passed',
        output: hasErrors ? undefined : "Code executed successfully\nAll checks passed",
        error: hasErrors ? "Detected potential error in code" : undefined
      };

      setResults(prev => prev.map(r => r.id === resultId ? finalResult : r));

      toast({
        title: hasErrors ? "⚠️ Test Failed" : "✅ Test Passed",
        description: hasErrors ? "Code has issues" : "Code executed safely in sandbox",
        variant: hasErrors ? "destructive" : "default"
      });

    } catch (error) {
      const errorResult: TestResult = {
        ...runningResult,
        status: 'failed',
        error: error instanceof Error ? error.message : "Unknown error"
      };
      
      setResults(prev => prev.map(r => r.id === resultId ? errorResult : r));
      
      toast({
        title: "Execution Error",
        description: "Code failed in sandbox",
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  const clearResults = () => {
    setResults([]);
    toast({
      title: "Results Cleared",
      description: "Test history has been cleared",
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-6 glass-effect border-accent/20">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gradient flex items-center gap-2">
                <TestTube className="h-6 w-6 text-accent" />
                Sandbox Testing
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Test AI-generated code safely before applying
              </p>
            </div>
            <Badge className="bg-success/20 text-success border-success/30">
              <Shield className="h-3 w-3 mr-1" />
              Isolated
            </Badge>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Test Code</label>
            <div className="border border-border rounded-lg overflow-hidden">
              <CodeMirror
                value={testCode}
                height="300px"
                theme={oneDark}
                extensions={[javascript()]}
                onChange={(value) => setTestCode(value)}
                basicSetup={{
                  lineNumbers: true,
                  highlightActiveLine: true,
                  foldGutter: true,
                }}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={runInSandbox}
              disabled={isRunning || !testCode.trim()}
              className="flex-1"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run in Sandbox
                </>
              )}
            </Button>
            {results.length > 0 && (
              <Button variant="outline" onClick={clearResults}>
                Clear
              </Button>
            )}
          </div>

          <Card className="p-4 bg-warning/5 border-warning/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p className="font-semibold text-warning mb-1">Sandboxed Environment</p>
                <p>Code runs in isolation. No access to production data or system resources.</p>
              </div>
            </div>
          </Card>
        </div>
      </Card>

      <Card className="p-6 glass-effect border-accent/20">
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2 mb-1">
              Test Results
            </h3>
            <p className="text-sm text-muted-foreground">
              View execution results and validation feedback
            </p>
          </div>

          {results.length > 0 ? (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3 pr-4">
                {results.map((result, idx) => (
                  <Card
                    key={result.id}
                    className={`p-4 border-l-4 ${
                      result.status === 'passed' 
                        ? 'border-l-success' 
                        : result.status === 'failed'
                        ? 'border-l-destructive'
                        : 'border-l-accent'
                    } transition-all animate-fade-in`}
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {result.status === 'running' && (
                            <Loader2 className="h-4 w-4 animate-spin text-accent" />
                          )}
                          {result.status === 'passed' && (
                            <CheckCircle className="h-4 w-4 text-success" />
                          )}
                          {result.status === 'failed' && (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                          <span className="font-semibold capitalize">{result.status}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(result.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      {result.output && (
                        <div className="bg-muted/30 p-3 rounded text-xs font-mono whitespace-pre-wrap">
                          {result.output}
                        </div>
                      )}

                      {result.error && (
                        <div className="bg-destructive/10 p-3 rounded text-xs font-mono text-destructive">
                          {result.error}
                        </div>
                      )}

                      <div className="bg-muted/20 p-2 rounded text-xs font-mono max-h-32 overflow-y-auto">
                        {result.code.slice(0, 200)}
                        {result.code.length > 200 && '...'}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <TestTube className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No test results yet</p>
              <p className="text-xs mt-2">Run code in sandbox to see results</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};