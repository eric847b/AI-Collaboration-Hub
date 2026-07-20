import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, PlayCircle, AlertCircle, CheckCircle2 } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ConfidenceMeter } from "./ConfidenceMeter";

interface SandboxModeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scriptId: string;
  code: string;
  scriptName: string;
}

export const SandboxMode = ({ open, onOpenChange, scriptId, code, scriptName }: SandboxModeProps) => {
  const [isRunning, setIsRunning] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const { toast } = useToast();

  const runSandboxTest = async () => {
    setIsRunning(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('test-script', {
        body: { scriptId, code }
      });

      if (error) throw error;

      setTestResult(data);
      
      toast({
        title: data.passed ? "Test Passed" : "Test Failed",
        description: data.passed 
          ? "Script is safe to commit" 
          : "Issues found in script",
        variant: data.passed ? "default" : "destructive",
      });
    } catch (error) {
      console.error('Sandbox test error:', error);
      toast({
        title: "Test Error",
        description: error instanceof Error ? error.message : "Failed to run test",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] glass-effect">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <PlayCircle className="h-6 w-6 text-accent" />
            Sandbox Mode - {scriptName}
          </DialogTitle>
          <DialogDescription>
            Test script revisions in a safe environment before committing
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Code Editor */}
          <div className="rounded-lg overflow-hidden border">
            <CodeMirror
              value={code}
              height="300px"
              theme={oneDark}
              extensions={[javascript()]}
              editable={false}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLine: false,
              }}
            />
          </div>

          {/* Test Button */}
          <Button
            onClick={runSandboxTest}
            disabled={isRunning}
            className="w-full gradient-primary"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4 mr-2" />
                Run Sandbox Test
              </>
            )}
          </Button>

          {/* Test Results */}
          {testResult && (
            <div className="space-y-3">
              <Alert className={testResult.passed ? "border-success" : "border-destructive"}>
                <div className="flex items-start gap-3">
                  {testResult.passed ? (
                    <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                  )}
                  <div className="flex-1">
                    <AlertDescription>
                      <p className="font-semibold mb-2">
                        {testResult.passed ? "All Tests Passed" : "Tests Failed"}
                      </p>
                      {testResult.issues && testResult.issues.length > 0 && (
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {testResult.issues.map((issue: string, idx: number) => (
                            <li key={idx}>{issue}</li>
                          ))}
                        </ul>
                      )}
                      {testResult.suggestions && testResult.suggestions.length > 0 && (
                        <div className="mt-3">
                          <p className="font-semibold text-sm mb-1">Suggestions:</p>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            {testResult.suggestions.map((suggestion: string, idx: number) => (
                              <li key={idx}>{suggestion}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </AlertDescription>
                  </div>
                </div>
              </Alert>

              {/* Confidence Meter */}
              <ConfidenceMeter
                confidence={testResult.confidence}
                showLabel={true}
                showIcon={true}
                size="lg"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
