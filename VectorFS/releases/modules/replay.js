export const Replay={
 log:[],
 push(e){this.log.push({t:Date.now(),...e});return this.log.length-1},
 state(n,roots){
  let s=null;
  for(let i=0;i<=n&&i<this.log.length;i++){
   const e=this.log[i];
   if(e.root&&roots.has(e.root))s=roots.get(e.root);
  }
  return structuredClone(s);
 },
 branch(n){
  return this.log.slice(0,n+1);
 },
 export(){
  return JSON.stringify(this.log);
 },
 import(v){
  this.log=JSON.parse(v);
 }
};