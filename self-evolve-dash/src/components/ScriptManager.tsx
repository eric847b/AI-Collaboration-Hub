import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Copy, Download, Code, History, Trash2, Sparkles, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { VersionHistory } from "./VersionHistory";
import { ConfidenceMeter } from "./ConfidenceMeter";
import { TrustBadge } from "./TrustBadge";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

interface Script {
  id: string;
  name: string;
  description: string;
  code: string;
  version: string;
  status: string;
  confidence_score?: number | null;
  iterations?: number;
  created_at: string;
}

export const ScriptManager = () => {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const loadScripts = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('scripts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading scripts:', error);
      return;
    }

    setScripts((data || []) as Script[]);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadScripts();
  }, [loadScripts]);

  useRealtimeSubscription({
    table: 'scripts',
    callback: loadScripts,
  });

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied!",
      description: "Code copied to clipboard",
    });
  };

  const handleDownload = (script: Script) => {
    const blob = new Blob([script.code], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${script.name.replace(/[^a-z0-9]/gi, "_")}_v${script.version}.user.js`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Downloaded!",
      description: `Script saved as ${script.name}_v${script.version}.user.js`,
    });
  };

  const handleDelete = async (scriptId: string) => {
    const { error } = await supabase
      .from('scripts')
      .delete()
      .eq('id', scriptId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete script",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Script Deleted",
      description: "The script has been removed",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-success/10 text-success border-success/20";
      case "testing":
        return "bg-accent/10 text-accent border-accent/20";
      case "needs_review":
        return "bg-warning/10 text-warning border-warning/20";
      case "updating":
        return "bg-primary/10 text-primary border-primary/20";
      default:
        return "bg-muted/10 text-muted-foreground border-muted/20";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gradient">Script Manager</h2>
          <p className="text-sm text-muted-foreground">
            View and manage your generated scripts
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i} className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-32 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-24" />
                  <Skeleton className="h-9 w-24" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : scripts.length === 0 ? (
        <Card className="p-12 text-center border-dashed glass-effect">
          <div className="inline-flex p-4 bg-primary/10 rounded-full mb-4 animate-float">
            <Code className="h-12 w-12 text-primary" />
          </div>
          <p className="text-lg font-semibold mb-2">No scripts yet</p>
          <p className="text-sm text-muted-foreground">
            Create your first script using the AI Task panel
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {scripts.map((script, index) => (
            <Card 
              key={script.id} 
              className="p-6 glass-effect border-primary/20 hover-lift transition-all animate-fade-in shadow-lg"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gradient">{script.name}</h3>
                      <Badge className={`${getStatusColor(script.status)} transition-all`}>
                        {script.status === "updating" && (
                          <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                        )}
                        {script.status}
                      </Badge>
                      <Badge variant="outline" className="border-accent/50">
                        v{script.version}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{script.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <TrustBadge
                      trustScore={script.confidence_score || 0}
                    />
                  </div>
                </div>

                {/* Metrics */}
                {script.confidence_score !== null && (
                  <div className="space-y-2">
                    <ConfidenceMeter confidence={script.confidence_score || 0} />
                    <p className="text-xs text-muted-foreground">
                      {script.iterations || 0} iteration{script.iterations !== 1 ? "s" : ""}
                    </p>
                  </div>
                )}

                {/* Code Preview */}
                <div className="rounded-lg overflow-hidden border border-border/50 shadow-md">
                  <CodeMirror
                    value={script.code.split('\n').slice(0, 5).join('\n') + '\n// ...'}
                    height="120px"
                    theme={oneDark}
                    extensions={[javascript()]}
                    editable={false}
                    basicSetup={{
                      lineNumbers: true,
                      highlightActiveLine: false,
                      foldGutter: false,
                    }}
                  />
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(script.code)}
                    className="hover-lift interactive-scale"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Code
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(script)}
                    className="hover-lift interactive-scale"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedScriptId(script.id)}
                    className="hover-lift interactive-scale"
                  >
                    <History className="mr-2 h-4 w-4" />
                    Version History
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(script.id)}
                    className="hover-lift interactive-scale text-destructive hover:text-destructive hover:border-destructive/50"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>

                {/* Metadata */}
                <div className="pt-3 border-t border-border/50">
                  <p className="text-xs text-muted-foreground">
                    Created: {new Date(script.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Version History Sheet */}
      {selectedScriptId && (
        <VersionHistory
          scriptId={selectedScriptId}
          open={!!selectedScriptId}
          onOpenChange={(open) => !open && setSelectedScriptId(null)}
          onRestore={loadScripts}
        />
      )}
    </div>
  );
};
