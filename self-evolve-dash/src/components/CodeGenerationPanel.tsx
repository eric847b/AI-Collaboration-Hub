import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Code2, Loader2, CheckCircle, Sparkles, FileCode, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { useAutonomousEngine } from "@/hooks/useAutonomousEngine";
import { useEngineEvents } from "@/hooks/useEngineEvents";

interface GeneratedFile {
  filePath: string;
  code: string;
  type: string;
  timestamp: string;
}

export const CodeGenerationPanel = () => {
  const { toast } = useToast();
  const { dispatch } = useAutonomousEngine();

  const [isGenerating, setIsGenerating] = useState(false);
  const [type, setType] = useState<string>("component");
  const [description, setDescription] = useState("");
  const [filePath, setFilePath] = useState("");
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);

  // Listen for engine events that deliver generated code
  useEngineEvents((event) => {
    if (event.type === "IMPROVEMENT_APPLIED" && event.improvement.target === "codegen") {
      const payload = event.improvement.metadata;
      if (!payload) return;

      setGeneratedFiles((prev) => [
        {
          filePath: payload.filePath,
          code: payload.code,
          type: payload.type,
          timestamp: new Date().toISOString()
        },
        ...prev
      ]);

      toast({
        title: "🎉 Code Generated!",
        description: `Generated ${payload.type}: ${payload.filePath}`
      });
    }
  });

  const generateCode = () => {
    if (!description.trim() || !filePath.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both description and file path",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);

    // Send request into engine pipeline
    dispatch({
      type: "SUGGESTIONS_ADDED",
      suggestions: [
        {
          title: `Generate ${type}: ${filePath}`,
          description,
          priority: "high",
          impact: "codegen",
          implementation: "engine-codegen",
          target: "codegen",
          metadata: { type, description, filePath }
        }
      ]
    });

    toast({
      title: "⏳ Code Generation Started",
      description: "Engine is generating your code"
    });

    setDescription("");
    setFilePath("");

    setTimeout(() => setIsGenerating(false), 600);
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied!",
      description: "Code copied to clipboard"
    });
  };

  const suggestFilePath = (codeType: string) => {
    const suggestions: Record<string, string> = {
      component: "src/components/MyComponent.tsx",
      utility: "src/lib/myUtil.ts",
      hook: "src/hooks/useMyHook.ts",
      edgeFunction: "supabase/functions/my-function/index.ts"
    };
    return suggestions[codeType] || "src/";
  };

  return (
    <Card className="p-6 glass-effect border-accent/20 animate-fade-in">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gradient flex items-center gap-2">
              <Code2 className="h-6 w-6 text-accent animate-pulse" />
              AI Code Generator
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Generate production-ready code with AI - components, hooks, utilities, and more
            </p>
          </div>
          <Badge className="bg-accent/20 text-accent border-accent/30">
            <Sparkles className="h-3 w-3 mr-1" />
            Powered by Engine
          </Badge>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="codeType">Code Type</Label>
            <Select
              value={type}
              onValueChange={(value) => {
                setType(value);
                setFilePath(suggestFilePath(value));
              }}
            >
              <SelectTrigger id="codeType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="component">React Component</SelectItem>
                <SelectItem value="hook">Custom Hook</SelectItem>
                <SelectItem value="utility">Utility Function</SelectItem>
                <SelectItem value="edgeFunction">Edge Function</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="filePath">File Path</Label>
            <Input
              id="filePath"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="e.g., src/components/MyComponent.tsx"
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you want to create..."
              rows={4}
              className="resize-none"
            />
          </div>

          <Button
            onClick={generateCode}
            disabled={isGenerating || !description.trim() || !filePath.trim()}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Code...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Generate Code
              </>
            )}
          </Button>
        </div>

        {/* Generated Files */}
        {generatedFiles.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <FileCode className="h-5 w-5 text-success" />
                Generated Files
              </h3>
              <Badge variant="secondary">{generatedFiles.length}</Badge>
            </div>

            <ScrollArea className="h-[500px]">
              <div className="space-y-4 pr-4">
                {generatedFiles.map((file, idx) => (
                  <Card
                    key={idx}
                    className="p-4 border-l-4 border-l-success hover:scale-[1.01] transition-all"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle className="h-4 w-4 text-success" />
                            <span className="font-mono text-sm font-semibold">
                              {file.filePath}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {file.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(file.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(file.code)}
                        >
                          Copy Code
                        </Button>
                      </div>

                      <div className="relative">
                        <pre className="bg-muted/50 p-3 rounded text-xs overflow-x-auto max-h-[300px] overflow-y-auto">
                          <code>{file.code}</code>
                        </pre>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Empty State */}
        {generatedFiles.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Code2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Generated code will appear here</p>
            <p className="text-xs mt-2">
              Describe what you want and AI will create it for you
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};
