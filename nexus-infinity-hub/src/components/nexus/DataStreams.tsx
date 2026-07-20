import { useEffect, useState } from "react";

export const DataStreams = ({ count = 18 }: { count?: number }) => {
  const [streams, setStreams] = useState<{ left: number; duration: number; delay: number }[]>([]);
  useEffect(() => {
    setStreams(Array.from({ length: count }, () => ({
      left: Math.random() * 100,
      duration: 4 + Math.random() * 6,
      delay: Math.random() * 5,
    })));
  }, [count]);
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {streams.map((s, i) => (
        <div
          key={i}
          className="data-stream h-32"
          style={{ left: `${s.left}%`, animationDuration: `${s.duration}s`, animationDelay: `${s.delay}s` }}
        />
      ))}
    </div>
  );
};
