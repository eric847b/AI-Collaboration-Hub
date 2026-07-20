//==UserScript==
//@name VectorFS Kernel
//@version 10.07.2026.1
//@match *://*/*
//@grant none
//==/UserScript==
(()=>{
const R=new Map,F=new Map;
const H=async v=>[...(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(v)))))].map(x=>x.toString(16).padStart(2,'0')).join('');
const S=async o=>{o=Object.freeze(structuredClone(o));let h=await H(o);R.set(h,o);return h};
const W=(r,h)=>(F.set(r,h),h);
const G=r=>R.get(F.get(r));
globalThis.VectorFS={R,F,H,S,W,G};
})();