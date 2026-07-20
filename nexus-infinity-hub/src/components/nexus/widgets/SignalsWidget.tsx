import { useEffect, useState } from "react";

export const SignalsWidget = () => {
  const [data, setData] = useState<number[]>(Array.from({ length: 40 }, () => Math.random()));
  useEffect(() => {
    const t = setInterval(() => setData(d => [...d.slice(1), Math.random()]), 200);
    return () => clearInterval(t);
  }, []);
  const max = Math.max(...data);
  return (
    <div className="space-y-2 h-full flex flex-col">
      <div className="text-[10px] mono text-muted-foreground">SIGNAL_STREAM :: rt</div>
      <div className="flex items-end gap-0.5 flex-1">
        {data.map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm transition-all"
            style={{
              height: `${(v / max) * 100}%`,
              background: `linear-gradient(180deg, hsl(var(--neon-cyan)) 0%, hsl(var(--neon-violet)) 100%)`,
              boxShadow: i === data.length - 1 ? `0 0 8px hsl(var(--neon-cyan))` : undefined,
              opacity: 0.4 + (i / data.length) * 0.6,
            }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] mono text-muted-foreground">
        <span>amp.{(data[data.length - 1] * 100).toFixed(1)}</span>
        <span className="text-neon-cyan">●REC</span>
      </div>
    </div>
  );
};
