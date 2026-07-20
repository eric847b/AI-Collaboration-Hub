import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileCode, Check, X, Download } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { useToast } from "@/hooks/use-toast";

import { useAutonomousEngine } from "@/hooks/useAutonomousEngine";

interface DiffViewerProps {
  oldCode: string;
  newCode: string;
  fileName: string;
  onAccept?: () => void;
  onReject?: () => void;
}

export const CodeDiffViewer = ({
  oldCode,
  newCode,
  fileName,
  onAccept,
  onReject
}: DiffViewerProps) => {
  const { toast } = useToast();
  const { dispatch } = useAutonomousEngine();

  const downloadDiff = () => {
    const diff = `--- ${fileName} (original)\n+++ ${fileName} (modified)\n\n${oldCode}\n\n---\n\n${newCode}`;
    const blob = new Blob([diff], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `${fileName}-diff.txt`;
    a.click();

    URL.revokeObjectURL(url);

    toast({
      title: "📥 Diff Downloaded",
      description: "Code comparison saved"
    });
  };

  const getDiffStats = () => {
    const oldLines = oldCode.split("\n").length;
    const newLines = newCode.split("\n").length;
    const added = Math.max(0, newLines - oldLines);
    const removed = Math.max(0, oldLines - newLines);
    return { added, removed, total: Math.abs(newLines - oldLines) };
  };

  const stats = getDiffStats();

  const handleAccept = () => {
    dispatch({
      type: "IMPROVEMENT_APPLIED",
      improvement: {
        id: crypto.randomUUID(),
        title: `Accepted diff for ${fileName}`,
        target: fileName,
        confidence: 100,
        applied: true,
        verified: false,
        timestamp: new Date().toISOString(),
        hash: crypto.randomUUID()
      }
    });

    toast({
      title: "✓ Improvement Accepted",
      description: `${fileName} updated successfully`
    });

    onAccept?.();
  };

  const handleReject = () => {
    dispatch({
      type: "FAILED_ATTEMPT",
      suggestion: {
        title: `Rejected diff for ${fileName}`,
        description: "User rejected the proposed code change",
        priority: "low",
        impact: "manual rejection",
        implementation: "diff-reject",
        target: fileName,
        hash: crypto.randomUUID()
      },
      reason: "User rejected diff"
    });

    toast({
      title: "✗ Diff Rejected",
      description: "Change discarded"
    });

    onReject?.();
  };

  return (
    <Card className="p-6 glass-effect border-accent/20">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileCode className="h-5 w-5 text-accent" />
            <div>
              <h3 className="font-semibold">{fileName}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs text-success">
                  +{stats.added} lines
                </Badge>
                <Badge variant="outline" className="text-xs text-destructive">
                  -{stats.removed} lines
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={downloadDiff}>
              <Download className="h-3 w-3 mr-1" />
              Download
            </Button>

            {onAccept && (
              <Button
                size="sm"
                onClick={handleAccept}
                className="bg-success hover:bg-success/90"
              >
                <Check className="h-3 w-3 mr-1" />
                Accept
              </Button>
            )}

            {onReject && (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleReject}
              >
                <X className="h-3 w-3 mr-1" />
                Reject
              </Button>
            )}
          </div>
        </div>

        {/* Side-by-side diff */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Original */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-destructive">
                Original
              </span>
              <Badge variant="outline" className="text-xs">
                {oldCode.split("\n").length} lines
              </Badge>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <ScrollArea className="h-[400px]">
                <CodeMirror
                  value={oldCode}
                  height="400px"
                  theme={oneDark}
                  extensions={[javascript()]}
                  editable={false}
                  basicSetup={{
                    lineNumbers: true,
                    highlightActiveLine: false,
                    foldGutter: false
                  }}
                />
              </ScrollArea>
            </div>
          </div>

          {/* Modified */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-success">
                Modified
              </span>
              <Badge variant="outline" className="text-xs">
                {newCode.split("\n").length} lines
              </Badge>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <ScrollArea className="h-[400px]">
                <CodeMirror
                  value={newCode}
                  height="400px"
                  theme={oneDark}
                  extensions={[javascript()]}
                  editable={false}
                  basicSetup={{
                    lineNumbers: true,
                    highlightActiveLine: false,
                    foldGutter: false
                  }}
                />
              </ScrollArea>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
