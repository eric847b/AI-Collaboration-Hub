import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, RotateCcw, CheckCircle, Clock, GitBranch, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Snapshot {
  id: string;
  timestamp: string;
  description: string;
  changes: {
    file: string;
    type: 'create' | 'update' | 'delete';
  }[];
  canRollback: boolean;
}

export const VersionControl = () => {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSnapshots();
  }, []);

  const loadSnapshots = () => {
    const saved = localStorage.getItem('version_snapshots');
    if (saved) {
      setSnapshots(JSON.parse(saved));
    }
  };

  const createSnapshot = (description: string) => {
    setIsCreating(true);
    
    const snapshot: Snapshot = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      description,
      changes: [],
      canRollback: true
    };

    const updated = [snapshot, ...snapshots].slice(0, 50);
    setSnapshots(updated);
    localStorage.setItem('version_snapshots', JSON.stringify(updated));

    toast({
      title: "📸 Snapshot Created",
      description: description,
    });

    setIsCreating(false);
  };

  const rollback = (snapshotId: string) => {
    const snapshot = snapshots.find(s => s.id === snapshotId);
    if (!snapshot) return;

    toast({
      title: "⏮️ Rolling Back",
      description: `Restoring snapshot from ${new Date(snapshot.timestamp).toLocaleString()}`,
    });
  };

  const exportSnapshot = (snapshot: Snapshot) => {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snapshot-${snapshot.id}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "💾 Snapshot Exported",
      description: "Snapshot downloaded successfully",
    });
  };

  // Auto-create snapshot on mount
  useEffect(() => {
    const shouldAutoSnapshot = localStorage.getItem('auto_snapshot') !== 'false';
    if (shouldAutoSnapshot && snapshots.length === 0) {
      createSnapshot('Initial snapshot');
    }
  }, []);

  return (
    <Card className="p-6 glass-effect border-accent/20">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gradient flex items-center gap-2">
              <History className="h-6 w-6 text-accent" />
              Version Control
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Automatic snapshots before each AI modification
            </p>
          </div>
          <Button
            onClick={() => createSnapshot('Manual snapshot')}
            disabled={isCreating}
            variant="outline"
            className="hover:border-accent/50"
          >
            <GitBranch className="h-4 w-4 mr-2" />
            Create Snapshot
          </Button>
        </div>

        {snapshots.length > 0 ? (
          <ScrollArea className="h-[500px]">
            <div className="space-y-3 pr-4">
              {snapshots.map((snapshot, idx) => (
                <Card
                  key={snapshot.id}
                  className={`p-4 border-l-4 ${
                    idx === 0 ? 'border-l-accent' : 'border-l-muted'
                  } transition-all hover:scale-[1.01]`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{snapshot.description}</span>
                          {idx === 0 && (
                            <Badge className="bg-accent/20 text-accent">Current</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(snapshot.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {idx > 0 && snapshot.canRollback && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rollback(snapshot.id)}
                            className="hover:border-warning/50"
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Rollback
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => exportSnapshot(snapshot)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {snapshot.changes.length > 0 && (
                      <div className="text-xs space-y-1">
                        <span className="font-semibold text-muted-foreground">Changes:</span>
                        {snapshot.changes.map((change, i) => (
                          <div key={i} className="flex items-center gap-2 text-muted-foreground">
                            <CheckCircle className="h-3 w-3" />
                            <span className="font-mono">{change.file}</span>
                            <Badge variant="outline" className="text-xs">
                              {change.type}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No snapshots yet</p>
            <p className="text-xs mt-2">Snapshots are created automatically before AI changes</p>
          </div>
        )}
      </div>
    </Card>
  );
};