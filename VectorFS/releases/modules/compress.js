export const Compress={
 encode(v){
  let s=JSON.stringify(v),o='',p='';
  for(let i=0;i<s.length;i++){
   let c=s[i];
   o+=c===p?'~':c;
   p=c;
  }
  return btoa(o);
 },
 decode(v){
  let s=atob(v),o='',p='';
  for(let i=0;i<s.length;i++){
   let c=s[i]==='~'?p:s[i];
   o+=c;
   p=c;
  }
  return JSON.parse(o);
 }
};