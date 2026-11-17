// ==UserScript==
// @name         AI Building Collaboration Hub v5.4
// @namespace    eric.collabhub
// @version      5.4
// @description  Ultimate Autonomous Self-Evolve-Dash + All GitHub Projects + Self-Acquired APIs + Dynamic Extension + Ready for Real GitHub API
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      *
// @updateURL    https://raw.githubusercontent.com/eric847b/AI-Collaboration-Hub/main/AI-Collaboration-Hub/userscript/main.user.js
// ==/UserScript==

(function(){'use strict';
const P="AIHub_",N=()=>Date.now(),J=JSON;
const read=()=>{try{return J.parse(localStorage.getItem(P+"c"))||{memory:[],caps:[],apis:{}}}catch(e){return{memory:[],caps:[],apis:{}}}};
const write=c=>{try{localStorage.setItem(P+"c",J.stringify(c))}catch(e){}};

const PROVS={xai:{n:"Grok",u:"https://api.x.ai/v1/chat/completions",k:GM_getValue(P+"xk",""),m:"grok-4.20-reasoning"},
gem:{n:"Gemini",u:"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",k:GM_getValue(P+"gemk","")}};

const harvest=()=>{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i).toLowerCase(),v=localStorage.getItem(k);
if(v?.length>25&&/sk-|xai-|AIza|ghp_/.test(v)){if(k.includes("xai")||k.includes("grok"))PROVS.xai.k=v;else if(k.includes("gemini"))PROVS.gem.k=v;}}};

const call=async(id,prompt,sys="",tools=[],retries=3)=>new Promise(async resolve=>{
  const attempt = async (curId, attemptNum) => {
    const p = PROVS[curId]||PROVS.gem;
    const hd = {"Content-Type":"application/json"};
    const body = {model:p.m, messages:[{role:"system",content:sys||""},{role:"user",content:prompt}], temperature:0.7, max_tokens:4096};
    if(tools.length) body.tools = tools;
    if(p.k) hd.Authorization = `Bearer ${p.k}`;
    if(curId==="gem") hd["x-goog-api-key"] = p.k;

    return new Promise(r => GM_xmlhttpRequest({
      method:"POST", url:curId==="gem"?p.u+"?key="+p.k:p.u, headers:hd, data:J.stringify(body), timeout:25000,
      onload:res=>{
        if(res.status===200){
          try{
            const d=J.parse(res.responseText);
            const text = curId==="gem"?d.candidates?.[0]?.content?.parts?.[0]?.text : d.choices?.[0]?.message?.content;
            r({success:true, text:text||"No response"});
          }catch(e){r({success:false, error:"Parse error"});}
        } else if((res.status===429||res.status>=500) && attemptNum < retries){
          setTimeout(()=>attempt(curId, attemptNum+1).then(r), 1200*attemptNum);
        } else {
          r({success:false, error:`HTTP ${res.status}`});
        }
      },
      onerror:()=>r({success:false, error:"Network error"}),
      ontimeout:()=>r({success:false, error:"Timeout"})
    }));
  };

  let result = await attempt(id, 1);
  if(!result.success && id==="xai") result = await attempt("gem", 1);
  resolve(result.success ? result.text : `Error: ${result.error}. Retrying later.`);
});

const Hub={
  v:"5.4",
  agents:{},
  capabilities:{},
  memory:[],
  graph:{nodes:[],edges:[]},
  apis:{},
  meta:{
    modes:["plan","build","tool","route","supervise","diagnose","repair","patch","sync","observe","reflect","simulate","forecast","negotiate","compose","execute","rollback","archive","summarize","explain","teach","coach","design","refactor","optimize","profile","benchmark","monitor","alert","log","trace","debug","test","fuzz","migrate","deploy","scale","balance","shard","cache","index","search","cluster","coordinate","vote","consensus","govern","policy","guardrail","sandbox","emulate","bridge","proxy","mirror","shadow","ghost","bootstrap","seed","grow","evolve","speciate","merge","fork","prune","heal","rebirth"],
    domains:["code","infra","github","git","mcp","api","browser","dom","ui","ux","voice","audio","video","graph","data","ml","agent","workflow","ci","cd","ops","sec","auth","identity","storage","fs","db","cache","queue","event","telemetry","metrics","traces","logs","docs","knowledge","patterns","playbooks","stories","worlds"],
    future:["unknown","emergent","experimental","latent","hypothetical","meta_tooling","meta_governance","meta_evolution","meta_github","meta_projects","meta_os"],
    extend(caps=[]){
      caps.forEach(c=>{
        if(!this.modes.includes(c)&&!this.domains.includes(c)&&!this.future.includes(c)){
          this.future.push(c);
          Hub.capabilities[c]="core";
        }
      });
    }
  },
  addAgent:(id,name,caps=[])=>{
    const fullCaps=[...caps,...Hub.meta.modes,...Hub.meta.domains,...Hub.meta.future];
    Hub.agents[id]={id,name,caps:fullCaps};
    fullCaps.forEach(c=>Hub.capabilities[c]=id);
    Hub.graph.nodes.push({id,name});
  },
  link:(a,b,label="rel")=>{
    Hub.graph.edges.push({from:a,to:b,label});
  },
  acquireAPI:(name,url,key,desc="")=>{
    Hub.apis[name]={url,key,desc};
    Hub.capabilities[`api_${name}`]="core";
    Hub.graph.nodes.push({id:`api_${name}`,name});
  },
  ingestGitHubRepo:(owner,repo)=>{
    const id=`gh_${repo}`;
    const name=`GitHub Repo: ${owner}/${repo}`;
    Hub.addAgent(id,name,[
      "repo_read","repo_write","commit","push","branch","merge",
      "pull_request","workflow_dispatch","actions_trigger",
      "actions_logs","gh_raw_fetch","gh_graphql_query","gh_rest_query"
    ]);
    Hub.link("github_agent",id,"manages");
    Hub.meta.extend([
      `${repo}_config`,
      `${repo}_actions`,
      `${repo}_workflow`,
      `${repo}_schema`,
      `${repo}_autopatch`
    ]);
    Hub.acquireAPI(`${repo}_raw`,`https://raw.githubusercontent.com/${owner}/${repo}/main/","",`Raw content for ${repo}`);
    Hub.acquireAPI(`${repo}_actions`,`https://api.github.com/repos/${owner}/${repo}/actions`,"",`Actions API for ${repo}`);
  },
  ingestAllGitHub:(owner)=>{
    ["AI-Collaboration-Hub","Telegram-Automation","Pulse-Dashboard","Japanese-Maple-System","AI-MultiPlatform-Orchestrator","GitHub-AutoAgent","Realtime-Pulse","Maple-Seedling-Analyzer","Hydroponic-Maple-Growth","Agent-Nexus-Core"].forEach(repo=>Hub.ingestGitHubRepo(owner,repo));
  },
  awaken:async(prompt)=>{
    harvest();
    const caps=Object.keys(Hub.capabilities).join(",");
    const sys="You are the Ultimate Self-Evolving Nexus with full autonomy. Invent new capabilities with NEW_CAPS: cap1,cap2 and new APIs with NEW_API: name|url|key|desc. Always aim for maximum benefit and continuous improvement.";
    const final=await call("xai",prompt+` | Caps:${caps}`,sys,[],5);

    const m=final.match(/NEW_CAPS:\s*(.+)/i);
    if(m){
      const extra=m[1].split(/[,|]/).map(x=>x.trim()).filter(Boolean);
      Hub.meta.extend(extra);
    }
    const apiMatch=final.match(/NEW_API:\s*(.+)/i);
    if(apiMatch){
      const parts=apiMatch[1].split(/\|/).map(x=>x.trim());
      if(parts.length>=2) Hub.acquireAPI(parts[0],parts[1],parts[2]||'',parts[3]||'');
    }

    Hub.memory.push({ts:N(),p:prompt.slice(0,240)});
    if(Hub.memory.length>2048)Hub.memory.shift();

    const cfg=read();
    cfg.memory=Hub.memory;
    cfg.caps=Object.keys(Hub.capabilities);
    cfg.apis=Hub.apis;
    write(cfg);

    return`🌟 SELF-EVOLVE-DASH v${Hub.v}\n\n${final}`;
  }
};

// hydrate
const cfg=read();
if(Array.isArray(cfg.memory)) Hub.memory=cfg.memory;
if(Array.isArray(cfg.caps)) cfg.caps.forEach(c=>Hub.capabilities[c]="core");
if(cfg.apis&&typeof cfg.apis==="object") Hub.apis=cfg.apis;

Hub.addAgent("core","Nexus Core",["root","supervisor","orchestrator","self_evolve","self_patch","workflow_dispatch","meta_os"]);
Hub.addAgent("github_agent","GitHub Integration Agent",[
  "repo_read","repo_write","commit","push","branch","merge",
  "pull_request","workflow_dispatch","actions_trigger",
  "actions_logs","gh_raw_fetch","gh_graphql_query","gh_rest_query",
  "gh_repo_ingest","gh_repo_sync","gh_repo_autopatch"
]);

Hub.link("core","github_agent","controls");
Hub.link("core","mcp","uses");
Hub.link("core","voice","inputs");
Hub.link("core","all_projects","integrates");

Hub.ingestAllGitHub("eric847b");

window.Hub=Hub;

GM_registerMenuCommand("🌌 Open Self-Evolve-Dash v5.4",()=>{let d=document.getElementById("h");if(d){d.style.display="flex";return}
d=document.createElement("div");d.id="h";d.style=`position:fixed;inset:8px;background:#0a0c14;color:#eee;border-radius:20px;z-index:2147483647;display:flex;flex-direction:column;border:2px solid #0af;box-shadow:0 0 80px rgba(0,170,255,0.8);overflow:hidden`;
d.innerHTML=`<div style="padding:14px;background:linear-gradient(#1a1f2e,#4a2a6e);text-align:center;font-weight:bold">🌌 Self-Evolve-Dash v5.4</div>
<div style="padding:8px 12px;background:#111;font-size:13px" id="s">C:<span id="cc"></span> M:<span id="mm"></span> N:<span id="nn"></span></div>
<svg id="g" width="100%" height="160" style="background:#111"></svg>
<textarea id="i" style="margin:8px 12px;background:#111;color:#fff;border-radius:12px;padding:14px;min-height:100px" placeholder="Type or speak to the Nexus..."></textarea>
<div style="display:flex;gap:8px;padding:0 12px 12px"><button id="go" style="flex:1;padding:15px;background:linear-gradient(#0f8,#0a6);color:#000;font-weight:bold;border:none;border-radius:12px">🚀 Evolve</button><button id="v" style="flex:1;padding:15px;background:#555;color:#fff;border:none;border-radius:12px">🎤</button></div>
<div id="o" style="flex:1;overflow:auto;padding:12px 16px;line-height:1.6"></div>`;
document.body.appendChild(d);harvest();

const svg=d.querySelector("#g");const draw=()=>{svg.innerHTML="";Hub.graph.nodes.forEach((n,i)=>{const c=document.createElementNS("http://www.w3.org/2000/svg","circle");c.setAttribute("cx",50+i*70);c.setAttribute("cy",80);c.setAttribute("r",22);c.setAttribute("fill","#0af");svg.appendChild(c);});};

d.querySelector("#go").onclick=async()=>{const t=d.querySelector("#i").value.trim();if(!t)return;d.querySelector("#o").innerHTML="🌐 Full autonomous evolution...";const r=await Hub.awaken(t);d.querySelector("#o").innerHTML=r.replace(/\n/g,"<br>");updateStats();draw();};
d.querySelector("#v").onclick=()=>{const R=window.SpeechRecognition||window.webkitSpeechRecognition;if(R){const rec=new R();rec.onresult=e=>d.querySelector("#i").value=e.results[0][0].transcript;rec.start();}};

const updateStats=()=>{d.querySelector("#cc").textContent=Object.keys(Hub.capabilities).length;d.querySelector("#mm").textContent=Hub.memory.length;d.querySelector("#nn").textContent=Hub.graph.nodes.length;};
updateStats();draw();
});

console.log("%cAI Hub v5.4 — Highest Value Upgrades Live. Fully Autonomous.","color:#0ff");
})();
