import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Archive, Search, Calendar, Code, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Fragment {
  id: string;
  script_id: string;
  version: string;
  code: string;
  confidence_score: number;
  test_results: { passed?: boolean } | null;
  created_at: string;
  script?: {
    name: string;
  };
}

interface FragmentPoolProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const FragmentPool = ({ open, onOpenChange }: FragmentPoolProps) => {
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const [filteredFragments, setFilteredFragments] = useState<Fragment[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFragment, setExpandedFragment] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (open) loadFragments();
  }, [open]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFragments(fragments);
      return;
    }

    const q = searchQuery.toLowerCase();
    setFilteredFragments(
      fragments.filter(
        (f) =>
          f.script?.name?.toLowerCase().includes(q) ||
          f.version.toLowerCase().includes(q)
      )
    );
  }, [searchQuery, fragments]);

  const loadFragments = async () => {
    setIsLoading(true);

    const { data, error } = await supabase
      .from("script_versions")
      .select(
        `
        id,
        script_id,
        version,
        code,
        confidence_score,
        test_results,
        created_at,
        script:scripts(name)
      `
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error loading fragments:", error);
      toast({
        title: "Error",
        description: "Failed to load fragment pool",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    setFragments((data as any) || []);
    setFilteredFragments((data as any) || []);
    setIsLoading(false);
  };

  const calculateTrustScore = (fragment: Fragment) => {
    const base = fragment.confidence_score ?? 50;
    const testBonus = fragment.test_results?.passed ? 20 : 0;
    return Math.min(100, base + testBonus);
  };

  const toggleExpanded = (id: string) => {
    setExpandedFragment((prev) => (prev === id ? null : id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] glass-effect">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Archive className="h-6 w-6 text-accent" />
            Fragment Pool
          </DialogTitle>
          <DialogDescription>
            View archived script versions and their reliability metrics
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search fragments by script name or version..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Fragment List */}
        <ScrollArea className="h-[500px]">
          <div className="space-y-3">
            {isLoading ? (
              <>
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-5 w-20" />
                      </div>
                      <div className="flex gap-2">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </div>
                  </Card>
                ))}
              </>
            ) : filteredFragments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Archive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{fragments.length === 0 ? "No fragments yet" : "No matching fragments found"}</p>
                <p className="text-sm mt-2">
                  {fragments.length === 0
                    ? "Fragments are created when scripts are revised"
                    : "Try a different search term"}
                </p>
              </div>
            ) : (
              filteredFragments.map((fragment, index) => {
                const trust = calculateTrustScore(fragment);
                const expanded = expandedFragment === fragment.id;

                return (
                  <Card
                    key={fragment.id}
                    className="p-4 border-l-4 border-l-accent/50 hover:border-l-accent transition-all animate-fade-in"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold flex items-center gap-2">
                            <Code className="h-4 w-4 text-accent" />
                            {fragment.script?.name || "Unknown Script"}
                          </h3>

                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              v{fragment.version}
                            </Badge>

                            <Badge variant="outline" className="text-xs">
                              {fragment.confidence_score}% confidence
                            </Badge>

                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                trust >= 80
                                  ? "border-success text-success"
                                  : trust >= 60
                                  ? "border-chart-2 text-chart-2"
                                  : "border-warning text-warning"
                              }`}
                            >
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Trust: {trust}
                            </Badge>

                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(fragment.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <Collapsible open={expanded} onOpenChange={() => toggleExpanded(fragment.id)}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="w-full">
                            {expanded ? "Hide" : "View"} Code
                          </Button>
                        </CollapsibleTrigger>

                        <CollapsibleContent className="mt-3">
                          <div className="rounded-lg overflow-hidden border">
                            <CodeMirror
                              value={fragment.code}
                              height="200px"
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
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
