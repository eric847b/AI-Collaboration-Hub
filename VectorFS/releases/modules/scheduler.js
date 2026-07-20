export const Scheduler={
 q:[],
 active:0,
 max:navigator.hardwareConcurrency||4,
 add(fn,p=0){
  this.q.push({fn,p});
  this.q.sort((a,b)=>b.p-a.p);
  this.run();
 },
 async run(){
  if(this.active>=this.max||!this.q.length)return;
  this.active++;
  const j=this.q.shift();
  try{await j.fn()}catch(e){console.error(e)}
  this.active--;
  queueMicrotask(()=>this.run());
 }
};