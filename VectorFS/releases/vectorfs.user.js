// ==UserScript==
// @name         VectorFS
// @namespace    vectorfs.ai
// @version      10.07.2026.1
// @description  Immutable lineage runtime and transactional browser kernel
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// ==/UserScript==

(()=>{
'use strict';

const VERSION='10.07.2026.1';
const ROOTS=new Map();
const REFS=new Map();
const BLOBS=new Map();
const TXNS=[];
const LINEAGE=[];
const WATCHERS=[];

const CAPS={
 indexedDB:!!globalThis.indexedDB,
 worker:!!globalThis.Worker,
 broadcast:!!globalThis.BroadcastChannel,
 opfs:!!navigator.storage?.getDirectory,
 gpu:!!navigator.gpu,
 wasm:!!globalThis.WebAssembly
};

const hash=async v=>{
 const b=new TextEncoder().encode(JSON.stringify(v));
 const h=await crypto.subtle.digest('SHA-256',b);
 return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('');
};

const freeze=o=>Object.freeze(structuredClone(o));

const snapshot=async state=>{
 const root=freeze(state);
 const id=await hash(root);
 ROOTS.set(id,root);
 LINEAGE.push(id);
 return id;
};

const swap=(ref,id)=>{
 if(!ROOTS.has(id))throw Error('invalid root');
 REFS.set(ref,id);
 return id;
};

const current=ref=>ROOTS.get(REFS.get(ref));

const txn=async(ref,mutator)=>{
 const base=current(ref)||{};
 const next=structuredClone(base);
 const t={ref,time:Date.now()};
 TXNS.push(t);
 try{
  await mutator(next);
  const id=await snapshot(next);
  swap(ref,id);
  t.ok=1;
  t.root=id;
  WATCHERS.forEach(f=>f(ref,id,next));
  return id;
 }catch(e){
  t.ok=0;
  t.err=''+e;
  throw e;
 }
};

const persist={
 save:k=>GM_setValue(k,JSON.stringify({
  refs:[...REFS],
  lineage:LINEAGE
 })),
 load:k=>{
  try{
   const d=JSON.parse(GM_getValue(k,'{}'));
   d.refs?.forEach(v=>REFS.set(v[0],v[1]));
   d.lineage?.forEach(v=>LINEAGE.push(v));
  }catch{}
 }
};

const api={
 VERSION,
 CAPS,
 ROOTS,
 REFS,
 BLOBS,
 LINEAGE,
 WATCHERS,
 hash,
 snapshot,
 swap,
 current,
 txn,
 persist
};

Object.defineProperty(globalThis,'VectorFS',{
 value:api,
 configurable:0,
 writable:0
});

persist.load('vectorfs');

addEventListener('beforeunload',()=>persist.save('vectorfs'));

console.log('[VectorFS]',VERSION,CAPS);

})();