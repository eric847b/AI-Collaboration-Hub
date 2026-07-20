//==UserScript==
//@name VectorFS Dense Core
//@namespace vectorfs.ai
//@version 10.07.2026.2
//@match *://*/*
//@grant GM_getValue
//@grant GM_setValue
//@grant navigator.storage.getDirectory
//@run-at document-start
//==/UserScript==
(()=>{
const D=1,S=new Map,Q=new Map,Z=[],T=[],C={i:!!indexedDB,w:!!Worker,b:!!BroadcastChannel,o:!!navigator.storage?.getDirectory,g:!!navigator.gpu,m:!!WebAssembly};

// === Voltage signal encoding (transistor states) ===
const V=[0.0,0.3,0.7,1.0]; // off, low, mid, high

// === Fast hash (xxHash-style) ===
const h=(s,o=0n)=>{let H=0xcbf29ce48dd0e300n;for(const c of new TextEncoder().encode(s)){H^=BigInt(c);H*=0x100000001b3n;}return H^o;};

// === Lazy loader with hash checkpoints ===
const L=async(d,m)=>{let i=h(d);if(Q.has(i))return Q.get(i);let r=structuredClone(m);Q.set(i,r);Z.push(i);return i;};

// === Voltage-optimized dispatch ===
const X=(r,f)=>{if(!S.has(r)){S.set(r,f);Z.push(r);return r;}let v=S.get(r);let s=f(v);return s;};

// === Fast path finder (XOR-based) ===
const P=(a,b)=>h(a.toString()+b.toString());

// === Single global state ===
const G={};

// === Readable mode toggle ===
let readMode = false;
const RM = GM_getValue('vfs_readable','0') !== '0';

// Export
globalThis.VectorFS={Dense:D,Ver:'10.07.2026.2',Capabilities:C,Store:S,Hash:h,Load:L,Exec:X,Path:P,GPU:V};

// Save on exit
addEventListener('beforeunload',()=>GM_setValue('vfs',JSON.stringify({s:[...S],h:Z})));
})();