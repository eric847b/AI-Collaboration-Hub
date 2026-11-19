//==UserScript==
//@name VectorFS Max
//@namespace vectorfs.ai
//@version 10.27.2026.1
//@description Max density max features max capabilities - AI interpretable
//@match *://*/*
//@grant GM_getValue
//@grant GM_setValue
//@grant GM_getValues
//@grant navigator.storage.getDirectory
//@run-at document-start
//==/UserScript==
(()=>{'use strict';const V=[0,.3,.7,1],C={i:!!indexedDB,w:!!Worker,b:!!BroadcastChannel,o:!!navigator.storage?.getDirectory,g:!!navigator.gpu,m:!!WebAssembly},R=new Map,F=new Map,B=new Map,T=[],L=[],W=[],S=new Map,Q=new Map,Z=[],h=(s,o=0n)=>{let H=0xcbf29ce48dd0e300n;for(const c of new TextEncoder().encode(typeof s=='string'?s:JSON.stringify(s)))H=(H^BigInt(c))*0x100000001b3n;return H^o},H2=async v=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(v))))].map(x=>x.toString(16).padStart(2,'0')).join(''),Fz=o=>Object.freeze(structuredClone(o)),Sn=async s=>{let r=Fz(s),id=await H2(r);R.set(id,r);L.push(id);Z.push(id);return id},Sw=(r,id)=>{if(!R.has(id))throw Error('root');F.set(r,id);return id},Cu=r=>R.get(F.get(r)),Ld=async(k,m)=>{let i=h(k);if(Q.has(i))return Q.get(i);let r=Fz(m);Q.set(i,r);Z.push(i);return i},Pf=(a,b)=>h((a+'')+(b+'')),Xv=(r,f)=>{if(!S.has(r)){S.set(r,f);Z.push(r);return r}let v=S.get(r);return S.set(r,f(v)),f(v)},Ex=async(r,m)=>{let b=Cu(r)||{},n=structuredClone(b),t={r,t:Date.now(),v:V[3]};T.push(t);try{await m(n);let id=await Sn(n);Sw(r,id);t.o=1;t.id=id;W.forEach(fn=>fn(r,id,n));return id}catch(e){t.o=0;t.e=''+e;throw e}},Pst={save:k=>{try{GM_setValue(k,JSON.stringify({r:[...F],l:L,s:[...S],z:Z,b:[...B]}))}catch{}},load:k=>{try{let d=JSON.parse(GM_getValue(k,'{}'));d.r?.forEach(v=>F.set(v[0],v[1]));d.l?.forEach(v=>L.push(v));d.s?.forEach(v=>S.set(v[0],v[1]));d.z?.forEach(v=>Z.push(v));d.b?.forEach(v=>B.set(v[0],v[1]))}catch{}}},API={Ver:'10.27.2026.1',V,C,R,F,B,T,L,W,S,Q,Z,h,H:H2,fz:Fz,sn:Sn,sw:Sw,cu:Cu,ld:Ld,pf:Pf,ex:Ex,xv:Xv,txn:Ex,current:Cu,snapshot:Sn,swap:Sw,hash:H2,fastHash:h,load:Ld,exec:Xv,path:Pf,persist:Pst};Object.defineProperty(globalThis,'VectorFS',{value:API,configurable:0,writable:0});Pst.load('vectorfs');addEventListener('beforeunload',()=>Pst.save('vectorfs'));})();