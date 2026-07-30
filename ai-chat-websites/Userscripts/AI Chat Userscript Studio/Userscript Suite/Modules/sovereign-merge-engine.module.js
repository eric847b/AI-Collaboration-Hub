// sovereign-merge-engine.module.js
// Canonical Sovereign Merge Engine
// Δ → Ω(Δ) → Π(Δ)

window.SovereignEngine = (() => {
  const modules = new Map();

  function register(name, handlers = {}) {
    modules.set(name, {
      name,
      onDelta: handlers.onDelta || (() => null),
      onCombo: handlers.onCombo || (() => null),
      onPerfect: handlers.onPerfect || (() => null)
    });
  }

  function apply(delta) {
    const Δ = Object.freeze(delta);

    const Ω = Array.from(modules.values())
      .map(m => m.onDelta(Δ))
      .filter(Boolean);

    const Π = {
      delta: Δ,
      combo: Ω,
      timestamp: Date.now()
    };

    modules.forEach(m => m.onPerfect(Π));

    return Π;
  }

  return { register, apply };
})();