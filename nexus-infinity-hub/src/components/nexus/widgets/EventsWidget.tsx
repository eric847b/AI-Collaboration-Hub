import { useEffect, useState } from "react";

const channels = ["kernel", "graph", "script", "prompt", "memory", "signal"];
const verbs = ["fired", "received", "mutated", "synced", "compressed", "routed", "inverted"];

export const EventsWidget = () => {
  const [events, setEvents] = useState<{ ts: string; ch: string; msg: string; id: number }[]>([]);
  useEffect(() => {
    let id = 0;
    const tick = () => {
      const ch = channels[Math.floor(Math.random() * channels.length)];
      const v = verbs[Math.floor(Math.random() * verbs.length)];
      const payload = Math.random().toString(16).slice(2, 8);
      setEvents(prev => [{ ts: new Date().toLocaleTimeString("en-GB"), ch, msg: `${v} :: 0x${payload}`, id: id++ }, ...prev].slice(0, 60));
    };
    tick();
    const t = setInterval(tick, 700 + Math.random() * 800);
    return () => clearInterval(t);
  }, []);
  const colorFor = (ch: string) => ({
    kernel: "text-neon-cyan", graph: "text-neon-violet", script: "text-neon-lime",
    prompt: "text-neon-magenta", memory: "text-neon-amber", signal: "text-neon-cyan",
  }[ch] || "text-foreground");
  return (
    <div className="mono text-[11px] space-y-0.5">
      {events.map(e => (
        <div key={e.id} className="flex gap-2 animate-fade-in">
          <span className="text-muted-foreground">{e.ts}</span>
          <span className={`uppercase font-semibold w-14 ${colorFor(e.ch)}`}>{e.ch}</span>
          <span className="text-foreground/80 truncate">{e.msg}</span>
        </div>
      ))}
    </div>
  );
};
