// tools/dialog-view.ts — forløbs-viewer for dialog.json + dialog.md (multi-agent-koordinering).
// Start: deno task dialog   (eller: deno run --allow-net --allow-read --allow-env tools/dialog-view.ts)
// Port fra DIALOG_PORT (default 8790); ledig nabo-port vælges automatisk, hvis den er optaget.

const ROOT = new URL("../", import.meta.url);
const FILES = { "dialog.json": new URL("dialog.json", ROOT), "dialog.md": new URL("dialog.md", ROOT) } as const;

type MdEntry = { at: string | null; sortAt: string; agent: string; title: string; body: string; order: number };
type State = {
  json: unknown; md: string; mdEntries: MdEntry[];
  mtimes: Record<string, string | null>; now: string; error?: string;
};

// Sidst kendte gode tilstand — bruges hvis en fil er midt i en skrivning eller ugyldig.
let lastJson: unknown = null;
let lastMd = "";

const HEADING = /^##\s+(?:\[(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}:\d{2}))?\]|(\d{4}-\d{2}-\d{2}))\s*(.*)$/;

function localIso(date: string, time?: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time ?? "00:00").split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm).toISOString();
}

function agentIds(json: unknown): string[] {
  const agents = (json as { agents?: { id?: string }[] } | null)?.agents;
  const ids = Array.isArray(agents) ? agents.map((a) => String(a?.id ?? "")).filter(Boolean) : [];
  return ids.length ? ids : ["claude", "codex", "copilot"];
}

function guessAgent(rest: string, ids: string[]): string {
  const lower = rest.toLowerCase();
  let best: { id: string; idx: number } | null = null;
  for (const id of ids) {
    const idx = lower.indexOf(id.toLowerCase());
    if (idx >= 0 && (!best || idx < best.idx)) best = { id, idx };
  }
  if (best) return best.id;
  return (rest.replace(/^[\s—–\-:]+/, "").split(/[\s—–:(]/)[0] || "ukendt").toLowerCase();
}

function parseMd(md: string, ids: string[]): MdEntry[] {
  const entries: MdEntry[] = [];
  let cur: MdEntry | null = null;
  let lastTimed: string | null = null;
  for (const line of md.split(/\r?\n/)) {
    const m = line.match(HEADING);
    if (m) {
      const date = m[1] ?? m[3];
      const time = m[2];
      const rest = (m[4] ?? "").trim();
      const at = time ? localIso(date, time) : null;
      // Uden klokkeslæt: sortér efter nærmeste tidsstemplede forgænger (i filrækkefølge), ellers datoen kl. 00:00.
      const sortAt = at ?? lastTimed ?? localIso(date);
      if (at) lastTimed = at;
      cur = { at, sortAt, agent: guessAgent(rest, ids), title: rest.replace(/^[\s—–\-:]+/, "") || "(uden titel)", body: "", order: entries.length };
      entries.push(cur);
    } else if (cur) {
      cur.body += (cur.body ? "\n" : "") + line;
    }
  }
  for (const e of entries) e.body = e.body.trim();
  return entries;
}

async function loadState(): Promise<State> {
  const errors: string[] = [];
  const mtimes: Record<string, string | null> = {};
  for (const [name, url] of Object.entries(FILES)) {
    try { mtimes[name] = (await Deno.stat(url)).mtime?.toISOString() ?? null; } catch { mtimes[name] = null; }
  }
  try { lastJson = JSON.parse(await Deno.readTextFile(FILES["dialog.json"])); }
  catch (e) { errors.push(`dialog.json: ${(e as Error).message} (viser sidst kendte version)`); }
  try { lastMd = await Deno.readTextFile(FILES["dialog.md"]); }
  catch (e) { errors.push(`dialog.md: ${(e as Error).message} (viser sidst kendte version)`); }
  const state: State = { json: lastJson, md: lastMd, mdEntries: parseMd(lastMd, agentIds(lastJson)), mtimes, now: new Date().toISOString() };
  if (errors.length) state.error = errors.join("; ");
  return state;
}

const HTML = `<!doctype html>
<html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#111514"><title>Dialog · Kageatelier</title>
<style>
:root{color-scheme:dark;--bg:#111514;--panel:#191e1c;--raised:#202623;--line:#303a34;--text:#edf2eb;--muted:#a2ada4;--lime:#d5ef9d;--green:#a6d9ba;--radius:18px;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-size:14px;line-height:1.6}button,input,select{font:inherit}button,select{cursor:pointer}button,a,input,select,summary{outline-offset:5px} :focus-visible{outline:2px solid var(--lime)}button{color:inherit}a{color:var(--lime)}button{border:0}h1,h2,h3,p{margin:0}button:hover{filter:brightness(1.12)}.shell{max-width:1536px;margin:auto;display:grid;grid-template-columns:240px minmax(0,1fr);min-height:100vh}.sidebar{padding:32px 22px;border-right:1px solid var(--line);display:flex;flex-direction:column;gap:38px;position:sticky;top:0;height:100vh}.brand{display:flex;gap:12px;align-items:center;font-size:23px;font-weight:650;letter-spacing:-1px}.mark{width:36px;height:36px;border-radius:12px;background:var(--lime);color:#202b17;display:grid;place-items:center;font-size:24px}.workspace{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1.8px;margin-bottom:12px}.project{padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}.project strong{display:block;font-size:13px}.project small{color:var(--muted)}.nav{display:grid;gap:7px}.nav button{background:transparent;border-radius:10px;padding:12px;text-align:left;display:flex;align-items:center;gap:12px;color:var(--muted)}.nav button.selected{background:#d5ef9d12;color:var(--lime)}.nav-icon{font-size:18px;width:20px}.nav-count{margin-left:auto;font-size:11px;background:var(--raised);padding:1px 7px;border-radius:6px}.agent-links{display:grid;gap:6px}.agent-link{display:flex;align-items:center;gap:10px;width:100%;background:transparent;padding:9px 10px;border-radius:9px;text-align:left}.agent-link.selected{background:var(--raised)}.agent-link small{margin-left:auto;color:var(--muted)}.dot{width:7px;height:7px;border-radius:50%;background:var(--green);display:inline-block}.sidebar-foot{margin-top:auto;color:var(--muted);font-size:12px}.sidebar-foot strong{color:var(--text);font-weight:500;display:block}.content{padding:30px 42px 50px;min-width:0}.topbar{display:flex;justify-content:space-between;align-items:center;padding-bottom:32px;gap:12px;color:var(--muted);font-size:12px}.crumb strong{color:var(--text);font-weight:500}.live{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:30px;padding:5px 11px;white-space:nowrap}.hero{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:30px}.eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:2px;color:var(--lime);margin-bottom:12px}h1{font-size:clamp(32px,4vw,48px);line-height:1.12;font-weight:520;letter-spacing:-2px}.subtitle{color:var(--muted);margin-top:14px;max-width:540px}.action{padding:10px 16px;border:1px solid var(--line);background:var(--raised);border-radius:10px;white-space:nowrap}.action.primary{background:var(--lime);color:#243018;border-color:var(--lime)}.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:32px}.stat{padding:20px 24px;border:1px solid var(--line);border-radius:var(--radius);background:var(--panel);position:relative;overflow:hidden}.stat:first-child{background:linear-gradient(115deg,#2b3625,#1e2820);border-color:#46583c}.stat-label{color:var(--muted);font-size:12px}.stat-value{font-size:36px;line-height:1.3;letter-spacing:-1px;margin:8px 0 2px}.stat:first-child .stat-value{color:var(--lime)}.stat-note{font-size:11px;color:var(--muted)}.section-head{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:16px}h2{font-size:18px;font-weight:550;letter-spacing:-.3px}.section-head small{color:var(--muted)}.claim-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:28px}.claim{border:1px solid var(--line);background:var(--panel);border-radius:14px;padding:18px;min-width:0}.claim-top{display:flex;align-items:center;gap:9px;margin-bottom:12px}.claim-top .tag{margin-left:auto}.claim p{color:var(--muted);font-size:13px}.file-list{display:flex;gap:5px;flex-wrap:wrap;margin-top:14px}.file{font:11px ui-monospace,SFMono-Regular,monospace;background:var(--raised);border:1px solid var(--line);padding:3px 6px;border-radius:5px;overflow-wrap:anywhere;max-width:100%}.claim time{display:block;margin-top:12px;color:var(--muted);font-size:11px}.avatar{width:32px;height:32px;border-radius:10px;display:inline-grid;place-items:center;flex-shrink:0;background:hsl(var(--h) 25% 23%);color:hsl(var(--h) 65% 80%);font-size:12px;font-weight:650}.avatar.large{width:38px;height:38px;border-radius:12px}.tag{font-size:10px;border:1px solid var(--line);border-radius:5px;padding:2px 7px;color:var(--muted);white-space:nowrap}.tag.active,.tag.done{color:var(--green);border-color:#365640;background:#23372b}.tag.finding,.tag.question{color:#e7c898;border-color:#5a4930;background:#312b22}.toolbar{display:flex;gap:12px;align-items:center;justify-content:space-between;margin:16px 0 20px}.tabs{display:flex;gap:4px;flex-wrap:wrap}.tabs button{border-radius:8px;background:transparent;color:var(--muted);padding:8px 12px}.tabs button.selected{background:var(--raised);color:var(--text)}.search{display:flex;align-items:center;gap:8px;background:var(--panel);border:1px solid var(--line);border-radius:9px;padding:8px 12px;max-width:260px;min-width:100px;color:var(--muted)}.search input{width:100%;background:transparent;border:0;outline:0;color:var(--text);min-width:0}.search:focus-within{outline:2px solid var(--lime);outline-offset:2px}select{background:var(--panel);border:1px solid var(--line);border-radius:8px;color:var(--muted);padding:7px;max-width:150px}.feed{list-style:none;padding:0;margin:0}.event{display:grid;grid-template-columns:38px minmax(0,1fr);gap:14px;position:relative;padding-bottom:20px}.event:not(:last-child)::before{content:'';position:absolute;left:18px;top:46px;bottom:7px;width:1px;background:var(--line)}.event-card{padding:18px 20px;background:var(--panel);border:1px solid var(--line);border-radius:14px;min-width:0;transition:border-color .15s}.event-card:hover{border-color:#4b5b50}.event-meta{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin-bottom:10px;font-size:12px}.event-meta strong{font-weight:600}.event-meta time{color:var(--muted);margin-left:auto;font-size:11px}.recipient{color:var(--muted);font-size:11px}.event-body{color:#c2ccc3;font-size:13px;overflow-wrap:anywhere;line-height:1.8}.event-body p+p{margin-top:12px}.event-body code{font:11px ui-monospace,SFMono-Regular,monospace;border:1px solid var(--line);background:#111713;color:#d5e5cc;border-radius:4px;padding:2px 5px}.event-body ul{padding-left:20px;margin:8px 0}.event-body h3{font-size:13px;color:var(--text);margin:14px 0 5px}.event-body pre{white-space:pre-wrap;padding:12px;background:var(--bg);border-radius:8px}.event-body pre code{border:0;padding:0}.event-title{font-size:14px;font-weight:550;margin-bottom:8px}.event-foot{display:flex;justify-content:space-between;margin-top:12px;color:#8a998e;font-size:10px}.expand{background:transparent;color:var(--lime);padding:0;margin-top:9px;font-size:12px}.empty{padding:30px;border:1px dashed var(--line);border-radius:14px;color:var(--muted);text-align:center}.empty strong{display:block;color:var(--text);margin-bottom:4px}.error{padding:14px;background:#3b2723;border:1px solid #795247;color:#f0c4b6;border-radius:10px;margin-bottom:20px}.footer{border-top:1px solid var(--line);margin-top:24px;padding-top:18px;display:flex;gap:12px;justify-content:space-between;font-size:11px;color:var(--muted)}[hidden]{display:none!important}.skip{position:fixed;top:-80px;left:20px;z-index:9;background:var(--lime);color:#111;padding:10px}.skip:focus{top:10px}
@media(min-width:1400px){.content{padding:34px 60px}.claim-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:1050px){.shell{grid-template-columns:190px minmax(0,1fr)}.sidebar{padding:28px 14px}.content{padding:28px 24px}.toolbar{flex-wrap:wrap}.search{max-width:none;flex:1}.stat{padding:16px}.claim-grid{grid-template-columns:1fr}}
@media(max-width:720px){.shell{display:block}.sidebar{position:static;height:auto;padding:18px 20px;border-right:0;border-bottom:1px solid var(--line);display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:12px}.sidebar .workspace,.project,.sidebar-foot,.agents-section{display:none}.brand{font-size:20px}.mark{width:30px;height:30px}.nav{display:flex;gap:4px}.nav button{padding:8px;font-size:12px}.nav-icon,.nav-count{display:none}.content{padding:22px 18px}.topbar{padding-bottom:26px}.hero{align-items:flex-start}.hero .action{font-size:0;padding:10px}.hero .action::before{content:'↻';font-size:20px}h1{font-size:36px}.stats{gap:8px}.stat{padding:14px 10px;border-radius:12px}.stat-label{font-size:10px}.stat-value{font-size:28px}.stat-note{font-size:10px}.toolbar{gap:10px}.tabs{width:100%}.tabs button{padding:7px 10px}.event{gap:10px;grid-template-columns:30px minmax(0,1fr)}.avatar.large{width:30px;height:30px;border-radius:9px}.event:not(:last-child)::before{left:14px;top:38px}.event-card{padding:14px}.event-meta time{margin-left:0}.footer{flex-wrap:wrap}.subtitle{font-size:13px}.section-head{align-items:flex-start}}
@media(prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
</style></head><body>
<a href="#main" class="skip">Gå til indhold</a><div class="shell"><aside class="sidebar"><div class="brand"><span class="mark" aria-hidden="true">↗</span>dialog<span style="color:var(--lime)">.</span></div><div><div class="workspace">Arbejdsrum</div><div class="project"><strong>Kageatelier</strong><small>Fælles udviklingslog</small></div></div><nav class="nav" aria-label="Visning"><button data-view="all" class="selected" aria-pressed="true"><span class="nav-icon" aria-hidden="true">◫</span>Overblik<span class="nav-count" id="nav-count">0</span></button><button data-view="claims" aria-pressed="false"><span class="nav-icon" aria-hidden="true">⊞</span>Filansvar</button></nav><section class="agents-section"><div class="workspace">Filtrér efter agent</div><div id="agents" class="agent-links"></div></section><div class="sidebar-foot"><span class="dot"></span> Lokalt arbejdsrum<strong>Små skridt. Fælles fremdrift.</strong></div></aside>
<main class="content" id="main"><header class="topbar"><span class="crumb">Kageatelier <span aria-hidden="true"> / </span> <strong>Samarbejde</strong></span><span class="live" id="live" role="status"><span class="dot"></span><span id="live-text">Forbinder…</span></span></header><div class="hero"><div><div class="eyebrow">Sammen om næste skridt</div><h1>Et fælles overblik.</h1><p class="subtitle">Følg dialogen, se hvem der arbejder på hvad,<br>og fang de vigtige beslutninger undervejs.</p></div><button class="action" id="refresh" aria-label="Opdatér nu">↻ &nbsp; Opdatér nu</button></div><div id="err" class="error" role="alert" hidden></div>
<section class="stats" aria-label="Status"><div class="stat"><div class="stat-label">Aktive filreservationer</div><div class="stat-value" id="active-count">—</div><div class="stat-note">Arbejdes på lige nu</div></div><div class="stat"><div class="stat-label">Agenter i arbejdsrummet</div><div class="stat-value" id="agent-count">—</div><div class="stat-note">Et fælles projekt</div></div><div class="stat"><div class="stat-label">Beskeder & noter</div><div class="stat-value" id="message-count">—</div><div class="stat-note">Hele forløbet samlet</div></div></section>
<section id="claims-section"><div class="section-head"><h2 id="claims-heading">På arbejdsbordet</h2><button class="expand" id="toggle-claims" aria-expanded="false">Vis også afsluttede →</button></div><div id="claims" class="claim-grid"></div></section>
<section id="activity-section"><div class="section-head"><div><h2>Dialog & beslutninger</h2><small id="result-count" role="status">Henter forløbet…</small></div><select id="order" aria-label="Sortering"><option value="newest">Nyeste først</option><option value="oldest">Ældste først</option></select></div><div class="toolbar"><div class="tabs" role="group" aria-label="Filtrér indlæg"><button data-source="all" class="selected" aria-pressed="true">Alle indlæg</button><button data-source="json" aria-pressed="false">Beskeder</button><button data-source="md" aria-pressed="false">Logbog</button></div><label class="search"><span aria-hidden="true">⌕</span><input id="search" type="search" placeholder="Søg i dialogen…" aria-label="Søg i dialogen"></label><select id="agent-filter" aria-label="Agent"><option value="all">Alle agenter</option></select></div><ul id="tl" class="feed"></ul></section><footer class="footer"><span id="foot">Henter seneste opdatering…</span><button id="pause" class="expand" aria-pressed="false">Sæt live på pause</button></footer></main></div>
<script>
const $=id=>document.getElementById(id),HUES={claude:28,codex:135,copilot:215},LABELS={announce:'Orientering',question:'Spørgsmål',answer:'Svar',handoff:'Overdragelse',done:'Afsluttet',finding:'Fund',md:'Logbog',active:'I gang',planned:'Planlagt',released:'Frigivet'};
let state=null,signature='',source='all',agent='all',query='',order='newest',showReleased=false,view='all',paused=false,busy=false;const expanded=new Set();
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function hue(a){a=String(a).toLowerCase();if(HUES[a]!=null)return HUES[a];let h=0;for(const c of a)h=(h*31+c.charCodeAt(0))%360;return h}
function name(a){return String(a||'ukendt').replace(/^./,c=>c.toUpperCase())}
function avatar(a,large=false){return '<span class="avatar '+(large?'large':'')+'" style="--h:'+hue(a)+'" aria-hidden="true">'+esc(name(a).slice(0,2))+'</span>'}
function fmt(iso,approx=false){const d=new Date(iso);return !iso||isNaN(d)?'Uden tidspunkt':(approx?'Ca. ':'')+d.toLocaleDateString('da-DK',{day:'numeric',month:'short'})+' · '+d.toLocaleTimeString('da-DK',{hour:'2-digit',minute:'2-digit'})}
function inline(s){return esc(s).replace(/\`([^\`]+)\`/g,'<code>$1</code>').replace(/\\*\\*([^*]+)\\*\\*/g,'<strong>$1</strong>')}
function markdown(s){let code=false,list=false,out='';for(const line of String(s).split('\\n')){if(line.startsWith('\`\`\`')){if(list){out+='</ul>';list=false}out+=code?'</code></pre>':'<pre><code>';code=!code;continue}if(code){out+=esc(line)+'\\n';continue}if(/^\\s*[-*]\\s/.test(line)){if(!list){out+='<ul>';list=true}out+='<li>'+inline(line.replace(/^\\s*[-*]\\s/,''))+'</li>';continue}if(list){out+='</ul>';list=false}if(/^#{1,6}\\s/.test(line))out+='<h3>'+inline(line.replace(/^#{1,6}\\s/,''))+'</h3>';else if(line.trim())out+='<p>'+inline(line)+'</p>'}return out+(list?'</ul>':'')+(code?'</code></pre>':'')}
function items(){const j=state?.json||{};return [...(j.messages||[]).map((m,i)=>({key:'j'+(m.id||i),agent:m.from,at:m.at,sort:Date.parse(m.at)||0,type:m.type,text:m.text||'',to:m.to||[],source:'json',title:'',index:i})),...(state?.mdEntries||[]).map((e,i)=>({key:'md'+e.order,agent:e.agent,at:e.sortAt,approx:!e.at,sort:Date.parse(e.sortAt)||0,type:'md',text:e.body||'',title:e.title,to:[],source:'md',index:i}))]}
function renderFeed(){if(!state)return;const filtered=items().filter(e=>(source==='all'||e.source===source)&&(agent==='all'||e.agent===agent)&&(!query||(e.title+' '+e.text+' '+e.agent+' '+e.to.join(' ')).toLowerCase().includes(query)));filtered.sort((a,b)=>(order==='newest'?-1:1)*(a.sort-b.sort||a.index-b.index));$('result-count').textContent=filtered.length+' indlæg'+(agent!=='all'?' · '+name(agent):'')+' · '+(order==='newest'?'nyeste først':'ældste først');$('tl').innerHTML=filtered.length?filtered.map(e=>{const long=e.text.length>400,open=expanded.has(e.key),body=long&&!open?e.text.slice(0,340)+'…':e.text;return '<li class="event">'+avatar(e.agent,true)+'<article class="event-card"><div class="event-meta"><strong>'+esc(name(e.agent))+'</strong><span class="tag '+esc(e.type)+'">'+esc(LABELS[e.type]||e.type)+'</span><time>'+fmt(e.at,e.approx)+'</time></div>'+(e.title?'<h3 class="event-title">'+esc(e.title)+'</h3>':'')+'<div class="event-body">'+(e.source==='md'?markdown(body):'<p>'+inline(body)+'</p>')+'</div>'+(long?'<button class="expand" data-expand="'+esc(e.key)+'" aria-expanded="'+open+'">'+(open?'Vis mindre ↑':'Læs hele indlægget ↗')+'</button>':'')+'<div class="event-foot"><span>'+(e.to.length?'Til '+e.to.map(x=>esc(name(x))).join(', '):'Fælles logbog')+'</span><span>'+ (e.source==='json'?'Besked':'Note')+'</span></div></article></li>'}).join(''):'<li class="empty"><strong>Ingen indlæg matcher</strong>Prøv et andet søgeord eller vælg alle agenter.<br><button class="expand" id="reset">Nulstil filtre →</button></li>'}
function renderClaims(){if(!state)return;const claims=(state.json?.claims||[]).filter(c=>(showReleased||c.status!=='released')&&(agent==='all'||c.agent===agent)).slice().sort((a,b)=>(a.status==='active'?-1:1)-(b.status==='active'?-1:1));$('claims').innerHTML=claims.length?claims.map(c=>'<article class="claim"><div class="claim-top">'+avatar(c.agent)+'<strong>'+esc(name(c.agent))+'</strong><span class="tag '+esc(c.status)+'">'+esc(LABELS[c.status]||c.status)+'</span></div><p>'+esc(c.intent)+'</p><div class="file-list">'+(c.files||[]).map(f=>'<span class="file">'+esc(f)+'</span>').join('')+'</div><time>'+fmt(c.status==='released'?c.releasedAt:c.claimedAt)+'</time></article>').join(''):'<div class="empty" style="grid-column:1/-1"><strong>Arbejdsbordet er frit</strong>Ingen aktive filreservationer'+(agent!=='all'?' for '+esc(name(agent)):'')+'.</div>';$('toggle-claims').textContent=showReleased?'Vis kun igangværende ↑':'Vis også afsluttede →';$('toggle-claims').setAttribute('aria-expanded',String(showReleased))}
function chooseAgent(value){agent=value;$('agent-filter').value=value;document.querySelectorAll('[data-agent]').forEach(b=>{const selected=b.dataset.agent===agent;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected))});renderFeed();renderClaims()}
function render(s){state=s;const j=s.json||{},claims=j.claims||[],agents=j.agents||[];$('active-count').textContent=claims.filter(c=>c.status==='active').length;$('agent-count').textContent=agents.length;$('message-count').textContent=items().length;$('nav-count').textContent=items().length;const ids=[...new Set([...agents.map(a=>a.id),...items().map(e=>e.agent)])].filter(Boolean);$('agents').innerHTML='<button class="agent-link '+(agent==='all'?'selected':'')+'" data-agent="all" aria-pressed="'+(agent==='all')+'"><span class="avatar" style="--h:90">◎</span>Alle agenter</button>'+ids.map(id=>'<button class="agent-link '+(agent===id?'selected':'')+'" data-agent="'+esc(id)+'" aria-pressed="'+(agent===id)+'">'+avatar(id)+esc(name(id))+'<small>'+items().filter(e=>e.agent===id).length+'</small></button>').join('');$('agent-filter').innerHTML='<option value="all">Alle agenter</option>'+ids.map(id=>'<option value="'+esc(id)+'">'+esc(name(id))+'</option>').join('');$('agent-filter').value=agent;renderClaims();renderFeed()}
async function tick(force=false){if(busy||(paused&&!force))return;busy=true;try{const r=await fetch('/api/state',{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const s=await r.json();const next=JSON.stringify([s.json,s.mdEntries]);if(signature!==next){signature=next;render(s)}$('err').hidden=!s.error;$('err').textContent=s.error||'';$('live-text').textContent=s.error?'Viser gemt version':paused?'På pause':'Live · hvert 5. sek.';$('foot').textContent='Sidst hentet '+fmt(s.now)+' · dialog.json + dialog.md'}catch(e){$('err').hidden=false;$('err').textContent='Forbindelsen blev afbrudt. Viser seneste indhold og prøver igen automatisk. '+e.message;$('live-text').textContent='Forbindelse afbrudt'}finally{busy=false}}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.agent)chooseAgent(b.dataset.agent);if(b.dataset.source){source=b.dataset.source;document.querySelectorAll('[data-source]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b))});renderFeed()}if(b.dataset.expand){const k=b.dataset.expand;expanded.has(k)?expanded.delete(k):expanded.add(k);renderFeed();const replacement=Array.from(document.querySelectorAll('[data-expand]')).find(x=>x.dataset.expand===k);replacement?.focus({preventScroll:true})}if(b.dataset.view){view=b.dataset.view;document.querySelectorAll('[data-view]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b))});$('activity-section').hidden=view==='claims';showReleased=view==='claims';renderClaims()}if(b.id==='reset'){query='';$('search').value='';chooseAgent('all');source='all';document.querySelector('[data-source="all"]').click()}});
$('search').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();renderFeed()});$('agent-filter').addEventListener('change',e=>chooseAgent(e.target.value));$('order').addEventListener('change',e=>{order=e.target.value;renderFeed()});$('toggle-claims').addEventListener('click',()=>{showReleased=!showReleased;renderClaims()});$('refresh').addEventListener('click',()=>tick(true));$('pause').addEventListener('click',()=>{paused=!paused;$('pause').setAttribute('aria-pressed',String(paused));$('pause').textContent=paused?'Genoptag live':'Sæt live på pause';$('live-text').textContent=paused?'På pause':'Live · hvert 5. sek.';if(!paused)tick()});tick();setInterval(tick,5000);
</script></body></html>
`;

function pickPort(start: number): number {
  for (let p = start; p < start + 50; p++) {
    try { Deno.listen({ hostname: "127.0.0.1", port: p }).close(); return p; }
    catch (e) { if (!(e instanceof Deno.errors.AddrInUse)) throw e; }
  }
  throw new Error(`Ingen ledig port fra ${start}`);
}

const wanted = Number(Deno.env.get("DIALOG_PORT")) || 8790;
const port = pickPort(wanted);
if (port !== wanted) console.log(`dialog-view: port ${wanted} er optaget, bruger ${port}`);

Deno.serve({
  hostname: "127.0.0.1", port,
  onListen: ({ port }) => console.log(`dialog-view: http://localhost:${port}/  (læser ${ROOT.pathname}dialog.json + dialog.md)`),
}, async (req) => {
  const path = new URL(req.url).pathname;
  if (path === "/api/state" || path === "/api/state.json") {
    return Response.json(await loadState(), { headers: { "cache-control": "no-store" } });
  }
  if (path === "/") return new Response(HTML, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  return new Response("Ikke fundet", { status: 404 });
});
