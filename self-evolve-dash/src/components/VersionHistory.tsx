import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface Version {
  id: string;
  version: string;
  code: string;
  confidence_score: number;
  test_results: any;
  created_at: string;
}

interface VersionHistoryProps {
  scriptId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore?: () => void;
}

export const VersionHistory = ({ scriptId, open, onOpenChange, onRestore }: VersionHistoryProps) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open && scriptId) {
      loadVersions();
    }
  }, [open, scriptId]);

  const loadVersions = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('script_versions')
      .select('*')
      .eq('script_id', scriptId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading versions:', error);
      toast({
        title: "Error",
        description: "Failed to load version history",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    setVersions(data || []);
    setIsLoading(false);
  };

  const handleRestore = async (versionId: string, version: string) => {
    setRestoringId(versionId);
    
    try {
      const { error } = await supabase.functions.invoke('rollback-script', {
        body: { scriptId, versionId }
      });

      if (error) throw error;

      toast({
        title: "Version Restored",
        description: `Successfully restored to version ${version}`,
      });

      onRestore?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Restore error:', error);
      toast({
        title: "Error",
        description: "Failed to restore version",
        variant: "destructive",
      });
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl glass-effect border-primary/20">
        <DialogHeader>
          <DialogTitle>Version History</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Restore your script to a previous version
          </p>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading versions...
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No version history available
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="p-4 rounded-lg border border-border/50 hover:border-primary/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant="outline">v{version.version}</Badge>
                        <Badge 
                          variant={version.confidence_score >= 70 ? "default" : "secondary"}
                          className="gap-1"
                        >
                          {version.confidence_score >= 70 ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <AlertCircle className="h-3 w-3" />
                          )}
                          {version.confidence_score}% confidence
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}
                      </p>
                      {version.test_results && version.test_results.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {version.test_results[0].issues?.length > 0 && (
                            <span>Issues: {version.test_results[0].issues.length}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRestore(version.id, version.version)}
                      disabled={restoringId === version.id}
                      className="hover:border-primary/50"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      {restoringId === version.id ? "Restoring..." : "Restore"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
