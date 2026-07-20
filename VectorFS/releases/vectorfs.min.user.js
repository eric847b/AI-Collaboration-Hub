//==UserScript==
//@name VectorFS Min
//@namespace vectorfs.ai
//@version 10.07.2026.1
//@match *://*/*
//@grant GM_getValue
//@grant GM_setValue
//@run-at document-start
//==/UserScript==
(()=>{'use strict';const V='10.07.2026.1',R=new Map,F=new Map,L=[],T=[],C={i:!!indexedDB,w:!!Worker,b:!!BroadcastChannel,o:!!navigator.storage?.getDirectory,g:!!navigator.gpu,m:!!WebAssembly},H=async v=>[...(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(v)))))].map(x=>x.toString(16).padStart(2,'0')).join(''),S=async s=>{let r=Object.freeze(structuredClone(s)),i=await H(r);return R.set(i,r),L.push(i),i},W=(r,i)=>{if(!R.has(i))throw Error('root');return F.set(r,i),i},G=r=>R.get(F.get(r)),X=async(r,m)=>{let b=G(r)||{},n=structuredClone(b),t={r,t:Date.now()};T.push(t);try{await m(n);let i=await S(n);return W(r,i),t.o=1,t.i=i,i}catch(e){throw t.o=0,t.e=''+e,e}},P={save:k=>GM_setValue(k,JSON.stringify({r:[...F],l:L})),load:k=>{try{let d=JSON.parse(GM_getValue(k,'{}'));d.r?.forEach(v=>F.set(v[0],v[1])),d.l?.forEach(v=>L.push(v))}catch{}}};globalThis.VectorFS={V,C,R,F,L,T,H,S,W,G,X,P};P.load('vectorfs');addEventListener('beforeunload',()=>P.save('vectorfs'));})();