import { useCallback } from "react";
import ReactFlow, { Background, Controls, MiniMap, addEdge, useEdgesState, useNodesState, BackgroundVariant, MarkerType, Node, Edge, Connection } from "reactflow";
import "reactflow/dist/style.css";

const initialNodes: Node[] = [
  { id: "1", position: { x: 0, y: 80 }, data: { label: "Kernel" }, style: nodeStyle("cyan") },
  { id: "2", position: { x: 220, y: 0 }, data: { label: "Prompt Engine" }, style: nodeStyle("violet") },
  { id: "3", position: { x: 220, y: 160 }, data: { label: "Script Runner" }, style: nodeStyle("magenta") },
  { id: "4", position: { x: 460, y: 80 }, data: { label: "Event Bus" }, style: nodeStyle("lime") },
  { id: "5", position: { x: 700, y: 0 }, data: { label: "Memory Vault" }, style: nodeStyle("cyan") },
  { id: "6", position: { x: 700, y: 160 }, data: { label: "Remote Iface" }, style: nodeStyle("amber") },
  { id: "7", position: { x: 940, y: 80 }, data: { label: "Inversion Sandbox" }, style: nodeStyle("violet") },
];

const initialEdges: Edge[] = [
  e("1", "2"), e("1", "3"), e("2", "4"), e("3", "4"),
  e("4", "5"), e("4", "6"), e("5", "7"), e("6", "7"),
];

function nodeStyle(c: "cyan" | "violet" | "magenta" | "lime" | "amber"): React.CSSProperties {
  const map: Record<string, string> = { cyan: "180 100% 55%", violet: "270 90% 65%", magenta: "320 100% 60%", lime: "90 100% 55%", amber: "40 100% 60%" };
  return {
    background: `hsl(230 35% 8% / 0.85)`,
    border: `1px solid hsl(${map[c]} / 0.6)`,
    color: `hsl(${map[c]})`,
    borderRadius: 10,
    padding: "8px 14px",
    fontSize: 12,
    fontFamily: "JetBrains Mono, monospace",
    boxShadow: `0 0 16px hsl(${map[c]} / 0.3)`,
    backdropFilter: "blur(8px)",
  };
}

function e(s: string, t: string): Edge {
  return {
    id: `${s}-${t}`, source: s, target: t, animated: true,
    style: { stroke: "hsl(180 100% 55% / 0.6)", strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(180 100% 55%)" },
  };
}

export const GraphView = () => {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const onConnect = useCallback((p: Connection) => setEdges(eds => addEdge({ ...p, animated: true, style: { stroke: "hsl(270 90% 65%)" } }, eds)), [setEdges]);
  return (
    <div className="glass-strong rounded-xl h-full overflow-hidden">
      <div className="px-3 py-2 border-b border-border/40 flex items-center justify-between">
        <h3 className="text-xs mono uppercase text-neon-cyan">AI Graph :: Connections</h3>
        <span className="text-[10px] mono text-muted-foreground">{nodes.length} nodes · {edges.length} edges</span>
      </div>
      <div className="h-[calc(100%-2.5rem)]">
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} fitView proOptions={{ hideAttribution: true }}>
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(180 100% 55% / 0.2)" />
          <MiniMap maskColor="hsl(230 35% 4% / 0.8)" nodeColor={() => "hsl(180 100% 55%)"} style={{ background: "hsl(230 35% 6%)", border: "1px solid hsl(180 80% 60% / 0.2)" }} />
          <Controls className="!bg-card !border-border" />
        </ReactFlow>
      </div>
    </div>
  );
};
