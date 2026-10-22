/* ============================================================
   Dashboard dinâmico (animações, dicas nos gráficos, análise rápida)
   + Relatório mensal (impressão / PDF)
   ============================================================ */
var TEST_MONTHS=["2026-09","2026-10"]; // meses em fase de teste (aparece no relatório)
var DASH_CHART_IDS=["resultChart","monthlyGeneralChart","trendChart","questionMonthChart","worstSectorChart","auditorChart","paretoChart","statusChart","collabChart"];
var DASH_REDUCED=!!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches);
var _dashSig="";

/* ---------- Funções de análise (usadas no Dashboard e no relatório) ---------- */
function xScore(v){return v==="A"?100:v==="P"?50:0;}
function prevYm(ym){const p=ym.split("-").map(Number);const d=new Date(p[0],p[1]-2,1);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");}
function ymLabel(ym){return monthLabelPt(ym)+"/"+ym.slice(0,4);}
function fmtPct(x,d){return x===null||x===undefined?"—":Number(x).toLocaleString("pt-BR",{maximumFractionDigits:d===undefined?1:d})+"%";}
function analyze(recs,plant){
  const cats=getCategoriesForPlant(plant);
  const o={n:recs.length,A:0,P:0,N:0,NA:0,cats:[],topQ:[],sectors:[],collabs:[],auditors:[],pend:[],pendOpen:0,pendDone:0};
  recs.forEach(r=>Object.values(r.answers||{}).forEach(v=>{if(v==="A")o.A++;else if(v==="P")o.P++;else if(v==="N")o.N++;else if(v==="NA")o.NA++;}));
  o.valid=o.A+o.P+o.N;
  o.nota=o.valid?Math.round((o.A*100+o.P*50)/o.valid*10)/10:null;
  o.cats=cats.map(function(c){let s=0,n=0;recs.forEach(r=>c[1].forEach(code=>{const v=r.answers&&r.answers[code];if(v==="A"||v==="P"||v==="N"){s+=xScore(v);n++;}}));return {name:c[0],pct:n?s/n:null,n:n};});
  const qm={},sm={},cm={},am={};
  recs.forEach(function(r){
    getQuestionsForRecord(r).forEach(function(q){
      const v=r.answers&&r.answers[q.code];
      if(v==="N"||v==="P"){
        const e=qm[q.code]||(qm[q.code]={code:q.code,text:q.text,N:0,P:0});e[v]++;
        const just=(r.justificativas&&r.justificativas[q.code]||"").trim(), acao=(r.acoesTomadas&&r.acoesTomadas[q.code]||"").trim();
        const open=!just||!acao; if(open)o.pendOpen++; else o.pendDone++;
        o.pend.push({data:r.data,local:r.local,code:q.code,text:q.text,v:v,status:!just?"PENDENTE":!acao?"AGUARDANDO AÇÃO":"RESOLVIDA",open:open});
      }
    });
    const sk=r.setor||r.local||"—"; const se=sm[sk]||(sm[sk]={name:sk,n:0,N:0,s:0}); se.n++; se.s+=calcAuditScorePercent(r); Object.values(r.answers||{}).forEach(v=>{if(v==="N")se.N++;});
    const ck=(r.colaborador||r.local||"—").trim(); const ce=cm[ck]||(cm[ck]={name:ck,n:0,s:0}); ce.n++; ce.s+=calcAuditScorePercent(r);
    const ak=r.auditor||"—"; const ae=am[ak]||(am[ak]={name:ak,n:0,s:0}); ae.n++; ae.s+=calcAuditScorePercent(r);
  });
  o.topQ=Object.values(qm).sort((a,b)=>b.N-a.N||b.P-a.P).slice(0,5);
  o.sectors=Object.values(sm).map(x=>({name:x.name,n:x.n,N:x.N,avg:x.n?x.s/x.n:0})).sort((a,b)=>b.N-a.N||a.avg-b.avg);
  o.collabs=Object.values(cm).map(x=>({name:x.name,n:x.n,avg:x.s/x.n})).sort((a,b)=>b.avg-a.avg);
  o.auditors=Object.values(am).map(x=>({name:x.name,n:x.n,avg:x.s/x.n})).sort((a,b)=>b.n-a.n);
  return o;
}
function buildInsights(cur,prev,prevLabel){
  const L=[];
  if(!cur.n) return [{i:"ℹ️",t:"Sem auditorias registradas no período."}];
  L.push({i:"📋",t:"<b>"+cur.n+"</b> auditoria(s) com <b>"+cur.valid+"</b> respostas válidas; nota geral <b>"+fmtPct(cur.nota)+"</b>."});
  if(prev&&prev.nota!==null&&cur.nota!==null){
    const d=Math.round((cur.nota-prev.nota)*10)/10;
    L.push(d===0?{i:"➖",t:"Nota estável em relação a "+prevLabel+" ("+fmtPct(prev.nota)+")."}
      :{i:d>0?"📈":"📉",tone:d>0?"good":"bad",t:"Nota "+(d>0?"subiu":"caiu")+" <b>"+Math.abs(d).toLocaleString("pt-BR")+" p.p.</b> frente a "+prevLabel+" ("+fmtPct(prev.nota)+")."});
  }
  const cs=cur.cats.filter(c=>c.pct!==null).slice().sort((a,b)=>b.pct-a.pct);
  if(cs.length){
    L.push({i:"🏆",tone:"good",t:"Melhor categoria: <b>"+esc(cs[0].name)+"</b> ("+Math.round(cs[0].pct)+"%)."});
    const w=cs[cs.length-1];
    if(cs.length>1) L.push({i:"⚠️",tone:w.pct<80?"bad":"",t:"Categoria mais fraca: <b>"+esc(w.name)+"</b> ("+Math.round(w.pct)+"%)."});
  }
  if(prev){
    const drops=[];
    cur.cats.forEach(function(c,i){const p=prev.cats[i];if(c.pct!==null&&p&&p.pct!==null&&c.pct-p.pct<=-5)drops.push(esc(c.name)+" (−"+Math.round(p.pct-c.pct)+" p.p.)");});
    if(drops.length) L.push({i:"🔻",tone:"bad",t:"Queda relevante frente a "+prevLabel+": "+drops.join("; ")+"."});
  }
  if(cur.topQ.length&&cur.topQ[0].N>0){const q=cur.topQ[0];L.push({i:"🔎",tone:"bad",t:"Item mais crítico: <b>"+esc(q.code)+"</b> — "+esc(q.text)+" ("+q.N+" N, "+q.P+" P)."});}
  if(cur.sectors.length&&cur.sectors[0].N>0){const s=cur.sectors[0];L.push({i:"🏭",t:"Setor com mais não conformidades: <b>"+esc(s.name)+"</b> ("+s.N+" N)."});}
  if(cur.pendOpen) L.push({i:"🕒",tone:"bad",t:"<b>"+cur.pendOpen+"</b> pendência(s) aguardando justificativa ou ação do líder."});
  else if(cur.pend.length) L.push({i:"✅",tone:"good",t:"Todas as pendências do mês estão com justificativa e ação."});
  return L;
}

/* ---------- Dashboard: análise rápida, contadores, barras e revelação dos gráficos ---------- */
function renderInsights(){
  let box=document.getElementById("dashInsights");
  if(!box){const m=document.getElementById("metrics");if(!m)return;box=document.createElement("div");box.id="dashInsights";box.className="excel-card dash-insights";m.parentNode.insertBefore(box,m.nextSibling);}
  const plant=normalizePlantName(dashboardPlantFilter)||"USINAGEM";
  const rec=getDashRecords();
  const months=[...new Set(rec.map(r=>String(r.data||"").slice(0,7)).filter(x=>/^\d{4}-\d{2}$/.test(x)))].sort();
  if(!months.length){box.innerHTML='<div class="card-head">Análise rápida</div><div class="card-body"><div class="empty">Sem dados para o filtro.</div></div>';return;}
  const ym=months[months.length-1], pym=prevYm(ym);
  const cur=analyze(rec.filter(r=>String(r.data||"").slice(0,7)===ym),plant);
  const prev=analyze(rec.filter(r=>String(r.data||"").slice(0,7)===pym),plant);
  const L=buildInsights(cur,prev.n?prev:null,ymLabel(pym));
  box.innerHTML='<div class="card-head"><span>💡 Análise rápida — '+ymLabel(ym)+' ('+plant+')</span><button class="primary" type="button" onclick="openMonthlyReport(\''+ym+'\')">📄 Relatório deste mês</button></div><div class="card-body"><div class="insight-grid">'+L.map(x=>'<div class="insight '+(x.tone||"")+'"><span class="insight-ico">'+x.i+'</span><span>'+x.t+'</span></div>').join("")+'</div></div>';
}
function styleCatBars(animate){
  document.querySelectorAll("#catBars .progress-fill").forEach(function(el){
    const w=parseFloat(el.style.width)||0;
    el.style.background=w>=85?"linear-gradient(90deg,#2e9e5b,#4cc27a)":w>=70?"linear-gradient(90deg,#e8a317,#f5c04a)":"linear-gradient(90deg,#d64545,#ef7a6b)";
    if(animate&&!DASH_REDUCED){
      el.style.transition="none";el.style.width="0%";void el.offsetWidth;
      el.style.transition="width .9s cubic-bezier(.22,.8,.25,1)";
      requestAnimationFrame(function(){el.style.width=w+"%";});
    }
  });
}
function countUpKpis(){
  if(DASH_REDUCED)return;
  document.querySelectorAll("#metrics .kpi .num").forEach(function(el){
    const txt=el.textContent.trim(), m=txt.match(/^([\d.,]+)(.*)$/); if(!m)return;
    const target=parseFloat(m[1].replace(/\./g,"").replace(",",".")); if(!isFinite(target))return;
    const dec=(m[1].split(",")[1]||"").length, suf=m[2], t0=performance.now(), dur=800;
    function step(t){const p=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-p,3), v=target*e;
      el.textContent=v.toLocaleString("pt-BR",{minimumFractionDigits:dec,maximumFractionDigits:dec})+suf;
      if(p<1)requestAnimationFrame(step); else el.textContent=txt;}
    requestAnimationFrame(step);
  });
}
function revealCanvas(c){
  if(!c||!c.width||!c.height)return;
  const w=c.width,h=c.height,snap=document.createElement("canvas");snap.width=w;snap.height=h;
  snap.getContext("2d").drawImage(c,0,0); c.__snap=snap;
  const ctx=c.getContext("2d"), id=(c.__rev=(c.__rev||0)+1), t0=performance.now(), dur=750;
  function step(t){
    if(c.__rev!==id)return;
    const p=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-p,3);
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);
    ctx.save();ctx.beginPath();ctx.rect(0,0,w*e,h);ctx.clip();ctx.drawImage(snap,0,0);ctx.restore();
    if(p<1)requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
function finishChartAnimations(){
  DASH_CHART_IDS.forEach(function(id){const c=document.getElementById(id);if(c&&c.__snap){c.__rev=(c.__rev||0)+1;const ctx=c.getContext("2d");ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(c.__snap,0,0);}});
}
function dashAfter(){
  const g=id=>document.getElementById(id)?document.getElementById(id).value:"";
  const sig=[dashboardPlantFilter,g("dashPeriod"),g("dashLocal"),g("dashSetor"),g("dashAuditor"),(state.records||[]).length].join("|");
  const visible=document.getElementById("dashboard")&&document.getElementById("dashboard").classList.contains("active");
  renderInsights();
  if(!visible){styleCatBars(false);return;}
  const animate=(sig!==_dashSig)&&!DASH_REDUCED; _dashSig=sig;
  styleCatBars(animate);
  if(animate){
    countUpKpis();
    const d=document.getElementById("dashboard"); d.classList.remove("dash-enter"); void d.offsetWidth; d.classList.add("dash-enter");
    setTimeout(function(){d.classList.remove("dash-enter");},1400);
    DASH_CHART_IDS.forEach(id=>revealCanvas(document.getElementById(id)));
  }
}
(function(){
  const baseRender=renderDashboard;
  renderDashboard=function(){baseRender.apply(this,arguments);try{dashAfter();}catch(e){console.error("dashextra",e);}};
  const baseNav=nav;
  nav=function(page){if(page==="dashboard")_dashSig="";return baseNav.apply(this,arguments);};
  const basePDF=exportDashboardPDF;
  exportDashboardPDF=function(){finishChartAnimations();return basePDF.apply(this,arguments);};
})();

/* ---------- Dicas (tooltip) e clique para filtrar ---------- */
function hitAt(c,e){
  const hs=CHART_HITS[c.id]; if(!hs||!hs.length)return null;
  const r=c.getBoundingClientRect(), u=c.__unit||1;
  const x=(e.clientX-r.left)*((c.width/u)/r.width), y=(e.clientY-r.top)*((c.height/u)/r.height);
  for(const h of hs){
    if(h.arc){const dx=x-h.cx,dy=y-h.cy,d=Math.hypot(dx,dy);if(d>=h.r0&&d<=h.r1){let a=Math.atan2(dy,dx);if(a<-Math.PI/2)a+=2*Math.PI;if(a>=h.a0&&a<=h.a1)return h;}}
    else if(x>=h.x&&x<=h.x+h.w&&y>=h.y&&y<=h.y+h.h)return h;
  }
  return null;
}
(function(){
  let tip=null;
  function getTip(){if(!tip){tip=document.createElement("div");tip.id="chartTip";document.body.appendChild(tip);}return tip;}
  document.addEventListener("mousemove",function(e){
    const c=e.target;
    if(!c||c.tagName!=="CANVAS"||!CHART_HITS[c.id]){if(tip)tip.classList.remove("show");return;}
    const h=hitAt(c,e), t=getTip();
    if(!h){t.classList.remove("show");c.style.cursor="";return;}
    t.innerHTML=esc(h.t)+(h.f?'<div class="tip-sub">clique para filtrar</div>':"");
    c.style.cursor=h.f?"pointer":"crosshair";
    t.classList.add("show");
    const w=t.offsetWidth,hh=t.offsetHeight;
    let x=e.clientX+14,y=e.clientY+16; if(x+w>innerWidth-8)x=e.clientX-w-14; if(y+hh>innerHeight-8)y=e.clientY-hh-12;
    t.style.left=Math.max(6,x)+"px";t.style.top=Math.max(6,y)+"px";
  });
  document.addEventListener("mouseout",function(e){if(e.target&&e.target.tagName==="CANVAS"&&tip)tip.classList.remove("show");});
  document.addEventListener("click",function(e){
    const c=e.target; if(!c||c.tagName!=="CANVAS"||!CHART_HITS[c.id])return;
    const h=hitAt(c,e); if(!h||!h.f)return;
    const sel=document.getElementById(h.f[0]); if(!sel)return;
    if([...sel.options].some(o=>o.value===h.f[1])){sel.value=h.f[1];renderDashboard();}
  });
})();

/* ---------- Relatório mensal ---------- */
function monthsWithRecords(){
  return [...new Set((state.records||[]).map(r=>String(r.data||"").slice(0,7)).filter(x=>/^\d{4}-\d{2}$/.test(x)))].sort().reverse();
}
function openMonthlyReport(preset){
  const months=monthsWithRecords();
  if(!months.length){alert("Não há auditorias registradas para gerar o relatório.");return;}
  document.getElementById("repModal")?.remove();
  const cur=preset&&months.includes(preset)?preset:months[0];
  const plantSel=normalizePlantName(dashboardPlantFilter)||"all";
  const m=document.createElement("div");m.id="repModal";m.className="modal-back";
  m.innerHTML='<div class="modal"><div class="modal-head"><b>📄 Relatório mensal</b><button onclick="document.getElementById(\'repModal\').remove()">×</button></div><div class="modal-body"><div class="formgrid"><div class="field"><label>Mês</label><select id="repMonth">'+months.map(x=>'<option value="'+x+'"'+(x===cur?" selected":"")+'>'+ymLabel(x)+'</option>').join("")+'</select></div><div class="field"><label>Planta</label><select id="repPlant"><option value="all">Ambas as plantas</option><option value="USINAGEM"'+(plantSel==="USINAGEM"?" selected":"")+'>USINAGEM</option><option value="FUNDIÇÃO"'+(plantSel==="FUNDIÇÃO"?" selected":"")+'>FUNDIÇÃO</option></select></div></div><div class="notice">O relatório traz indicadores, comparação com o mês anterior, análise automática, itens críticos, pendências e cumprimento da programação. Ele abre em uma nova janela pronta para imprimir ou salvar em PDF.</div></div><div class="modal-foot"><button class="secondary" onclick="document.getElementById(\'repModal\').remove()">Cancelar</button><button class="primary" onclick="generateMonthlyReport()">Gerar relatório</button></div></div>';
  document.body.appendChild(m);
}
function progStatusFor(plant,ym){
  const sc=state.schedule&&state.schedule[ym+"|all"]; if(!sc||!Array.isArray(sc.assignments))return null;
  const rows=sc.assignments.filter(a=>normalizePlantName(a.planta)===plant);
  if(!rows.length)return null;
  const pend=rows.filter(a=>!collaboratorAuditedThisMonth(a.colaborador,ym)).map(a=>({colaborador:a.colaborador,auditor:a.auditor,week:sc.weeks[a.weekIdx]}));
  return {total:rows.length,done:rows.length-pend.length,pend:pend};
}
function svgCats(cur,prev){
  const rowH=26,labW=235,barW=330,H=cur.cats.length*rowH+8,W=labW+barW+130;
  let s='<svg width="100%" viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" font-family="Arial">';
  cur.cats.forEach(function(c,i){
    const y=i*rowH+4, p=prev&&prev.cats[i]?prev.cats[i].pct:null;
    s+='<text x="'+(labW-8)+'" y="'+(y+14)+'" text-anchor="end" font-size="11" fill="#17333a">'+esc(c.name)+'</text><rect x="'+labW+'" y="'+(y+3)+'" width="'+barW+'" height="14" rx="3" fill="#e8eef0"/>';
    if(c.pct!==null){
      const col=c.pct>=85?"#2e9e5b":c.pct>=70?"#f0a81c":"#d64545";
      s+='<rect x="'+labW+'" y="'+(y+3)+'" width="'+(barW*c.pct/100).toFixed(1)+'" height="14" rx="3" fill="'+col+'"/><text x="'+(labW+barW+8)+'" y="'+(y+14)+'" font-size="11" font-weight="700" fill="#17333a">'+Math.round(c.pct)+'%</text>';
      if(p!==null){const d=Math.round(c.pct-p);s+='<line x1="'+(labW+barW*p/100).toFixed(1)+'" x2="'+(labW+barW*p/100).toFixed(1)+'" y1="'+y+'" y2="'+(y+20)+'" stroke="#17333a" stroke-width="2"/><text x="'+(labW+barW+46)+'" y="'+(y+14)+'" font-size="10" font-weight="700" fill="'+(d>0?"#1a7f45":d<0?"#c0392b":"#64748b")+'">'+(d>0?"▲ +":d<0?"▼ ":"= ")+d+' p.p.</text>';}
    }else s+='<text x="'+(labW+barW+8)+'" y="'+(y+14)+'" font-size="11" fill="#64748b">—</text>';
  });
  return s+'</svg>';
}
function svgTrend(points){
  const W=560,H=170,pl=36,pr=14,pt=14,pb=26,pw=W-pl-pr,ph=H-pt-pb;
  let s='<svg width="100%" viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" font-family="Arial">';
  [0,50,100].forEach(v=>{const y=pt+ph-v/100*ph;s+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y+'" y2="'+y+'" stroke="#dbe3ea"/><text x="'+(pl-5)+'" y="'+(y+3)+'" font-size="9" text-anchor="end" fill="#64748b">'+v+'%</text>';});
  const step=points.length>1?pw/(points.length-1):0; let path="";
  points.forEach(function(p,i){const x=pl+step*i;s+='<text x="'+x+'" y="'+(H-8)+'" font-size="9" text-anchor="middle" fill="#334155">'+p[0]+'</text>';if(p[1]!==null){const y=pt+ph-p[1]/100*ph;path+=(path?"L":"M")+x.toFixed(1)+" "+y.toFixed(1)+" ";}});
  s+='<path d="'+path+'" fill="none" stroke="#1769aa" stroke-width="2.5" stroke-linejoin="round"/>';
  points.forEach(function(p,i){if(p[1]===null)return;const x=pl+step*i,y=pt+ph-p[1]/100*ph;s+='<circle cx="'+x+'" cy="'+y+'" r="3.5" fill="#1769aa"/><text x="'+x+'" y="'+(y-8)+'" font-size="9" font-weight="700" text-anchor="middle" fill="#17333a">'+Math.round(p[1])+'%</text>';});
  return s+'</svg>';
}
function plantReportHTML(ym,plant,first){
  const pym=prevYm(ym);
  const cur=analyze(recsForReport(plant,ym),plant), prev=analyze(recsForReport(plant,pym),plant);
  const hasPrev=prev.n>0, ins=buildInsights(cur,hasPrev?prev:null,ymLabel(pym));
  const prog=progStatusFor(plant,ym);
  if(prog) ins.push({i:"📅",tone:prog.done<prog.total?"bad":"good",t:"Programação: <b>"+prog.done+" de "+prog.total+"</b> auditorias realizadas ("+Math.round(prog.done/prog.total*100)+"%)."});
  const trend=[];let k=ym;const ks=[];for(let i=0;i<6;i++){ks.unshift(k);k=prevYm(k);}
  ks.forEach(x=>{const a=analyze(recsForReport(plant,x),plant);trend.push([monthLabelPt(x).slice(0,3)+"/"+x.slice(2,4),a.nota]);});
  const dnota=hasPrev&&cur.nota!==null&&prev.nota!==null?Math.round((cur.nota-prev.nota)*10)/10:null;
  const kpi=(l,v,c)=>'<div class="kpi '+(c||"")+'"><div class="kl">'+l+'</div><div class="kv">'+v+'</div></div>';
  let h='<section class="plant'+(first?"":" brk")+'"><div class="head"><div><div class="brand">AUDITORIAS ESCALONADAS — RELATÓRIO MENSAL</div><div class="sub">Planta '+plant+' • FQ100</div></div><div class="period">'+ymLabel(ym)+'</div></div>';
  if(TEST_MONTHS.includes(ym)) h+='<div class="testnote">⚠ Mês em fase de teste do programa: os resultados podem ser ajustados ou descartados.</div>';
  if(!cur.n) return h+'<div class="empty">Nenhuma auditoria registrada nesta planta no mês.</div></section>';
  h+='<div class="kpis">'+kpi("Auditorias",cur.n)+kpi("Respostas válidas",cur.valid)+kpi("Nota geral",fmtPct(cur.nota)+(dnota!==null?'<small class="'+(dnota>0?"up":dnota<0?"down":"")+'">'+(dnota>0?"▲ +":dnota<0?"▼ ":"= ")+dnota.toLocaleString("pt-BR")+' p.p.</small>':""),"blue")+kpi("Conforme (A)",fmtPct(cur.valid?cur.A/cur.valid*100:null),"green")+kpi("Parcial (P)",fmtPct(cur.valid?cur.P/cur.valid*100:null),"yellow")+kpi("Não conforme (N)",fmtPct(cur.valid?cur.N/cur.valid*100:null),"red")+kpi("Pendências abertas",cur.pendOpen,"orange")+'</div>';
  h+='<div class="card"><h2>Análise do mês</h2><ul class="ins">'+ins.map(x=>'<li class="'+(x.tone||"")+'"><span>'+x.i+'</span><div>'+x.t+'</div></li>').join("")+'</ul></div>';
  h+='<div class="card"><h2>Conformidade por categoria <small>(barra = mês atual; traço = '+ymLabel(pym)+')</small></h2>'+svgCats(cur,hasPrev?prev:null)+'</div>';
  h+='<div class="card"><h2>Evolução da nota geral — últimos 6 meses</h2>'+svgTrend(trend)+'</div>';
  h+='<div class="two"><div class="card"><h2>Itens mais críticos (Pareto)</h2>'+(cur.topQ.length?'<table><thead><tr><th>Item</th><th class="n">N</th><th class="n">P</th></tr></thead><tbody>'+cur.topQ.map(q=>'<tr><td><b>'+esc(q.code)+'</b> — '+esc(q.text)+'</td><td class="n">'+q.N+'</td><td class="n">'+q.P+'</td></tr>').join("")+'</tbody></table>':'<div class="empty">Nenhum item com N ou P.</div>')+'</div>';
  const secs=cur.sectors.filter(s=>s.N>0).slice(0,5);
  h+='<div class="card"><h2>Setores com mais não conformidades</h2>'+(secs.length?'<table><thead><tr><th>Setor</th><th class="n">Aud.</th><th class="n">N</th><th class="n">Nota</th></tr></thead><tbody>'+secs.map(s=>'<tr><td>'+esc(s.name)+'</td><td class="n">'+s.n+'</td><td class="n">'+s.N+'</td><td class="n">'+Math.round(s.avg)+'%</td></tr>').join("")+'</tbody></table>':'<div class="empty">Nenhuma não conformidade.</div>')+'</div></div>';
  const best=cur.collabs.slice(0,5), worst=cur.collabs.slice().reverse().slice(0,5);
  const crow=a=>a.map(c=>'<tr><td>'+esc(c.name)+'</td><td class="n">'+c.n+'</td><td class="n"><b>'+Math.round(c.avg)+'%</b></td></tr>').join("");
  h+='<div class="two"><div class="card"><h2>Colaboradores — maiores notas</h2><table><thead><tr><th>Colaborador</th><th class="n">Aud.</th><th class="n">Nota</th></tr></thead><tbody>'+crow(best)+'</tbody></table></div><div class="card"><h2>Colaboradores — pontos de atenção</h2><table><thead><tr><th>Colaborador</th><th class="n">Aud.</th><th class="n">Nota</th></tr></thead><tbody>'+crow(worst)+'</tbody></table></div></div>';
  h+='<div class="two"><div class="card"><h2>Auditorias por auditor</h2><table><thead><tr><th>Auditor</th><th class="n">Aud.</th><th class="n">Nota média</th></tr></thead><tbody>'+cur.auditors.map(a=>'<tr><td>'+esc(a.name)+'</td><td class="n">'+a.n+'</td><td class="n">'+Math.round(a.avg)+'%</td></tr>').join("")+'</tbody></table></div>';
  const open=cur.pend.filter(p=>p.open);
  h+='<div class="card"><h2>Pendências e ações</h2><div class="mini">Total de N/P: <b>'+cur.pend.length+'</b> • Resolvidas: <b>'+cur.pendDone+'</b> • Abertas: <b>'+cur.pendOpen+'</b></div>'+(open.length?'<table><thead><tr><th>Data</th><th>Local</th><th>Item</th><th>Status</th></tr></thead><tbody>'+open.slice(0,10).map(p=>'<tr><td>'+fmtDate(p.data)+'</td><td>'+esc(p.local)+'</td><td>'+esc(p.code)+' ('+p.v+')</td><td>'+esc(p.status)+'</td></tr>').join("")+'</tbody></table>'+(open.length>10?'<div class="mini">+ '+(open.length-10)+' pendência(s) não listada(s).</div>':""):'<div class="empty">Sem pendências abertas.</div>')+'</div></div>';
  h+='<div class="card"><h2>Cumprimento da programação</h2>'+(prog?'<div class="mini">Realizadas: <b>'+prog.done+' de '+prog.total+'</b> ('+Math.round(prog.done/prog.total*100)+'%)</div>'+(prog.pend.length?'<table><thead><tr><th>Colaborador sem auditoria</th><th>Auditor programado</th><th>Semana</th></tr></thead><tbody>'+prog.pend.map(p=>'<tr><td>'+esc(p.colaborador)+'</td><td>'+esc(p.auditor)+'</td><td>'+(p.week?fmtShort(new Date(p.week.start+"T00:00:00"))+" – "+fmtShort(new Date(p.week.end+"T00:00:00")):"—")+'</td></tr>').join("")+'</tbody></table>':'<div class="empty">Todos os colaboradores programados foram auditados. ✅</div>'):'<div class="empty">Não há programação gerada para este mês.</div>')+'</div>';
  return h+'<div class="foot">Gerado em '+new Date().toLocaleString("pt-BR")+' • N.A. não entra no cálculo • A = 100%, P = 50%, N = 0%</div></section>';
}
function recsForReport(plant,ym){
  return (state.records||[]).filter(r=>inferPlant(r)===plant&&String(r.data||"").slice(0,7)===ym);
}
function generateMonthlyReport(){
  const ym=document.getElementById("repMonth").value, sel=document.getElementById("repPlant").value;
  const plants=sel==="all"?["USINAGEM","FUNDIÇÃO"]:[normalizePlantName(sel)];
  document.getElementById("repModal")?.remove();
  const w=window.open("","_blank","width=1100,height=900");
  if(!w){alert("Permita pop-ups para gerar o relatório mensal.");return;}
  const body=plants.map((p,i)=>plantReportHTML(ym,p,i===0)).join("");
  const css='@page{size:A4 portrait;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#17333a;margin:0;font-size:11px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.brk{break-before:page;page-break-before:always}.head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #f26a00;padding-bottom:6px;margin-bottom:8px}.brand{font-size:16px;font-weight:900}.sub{font-size:10px;color:#68787b;margin-top:2px}.period{font-size:15px;font-weight:800;color:#f26a00}.testnote{background:#fff3cd;border:1px solid #f0c24b;color:#5c4400;padding:6px 9px;border-radius:5px;margin-bottom:8px;font-weight:700}.kpis{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:8px}.kpi{border:1px solid #cfdad8;border-left:4px solid #94a3b8;border-radius:5px;padding:5px 7px}.kpi.blue{border-left-color:#1769aa}.kpi.green{border-left-color:#2e9e5b}.kpi.yellow{border-left-color:#f0a81c}.kpi.red{border-left-color:#d64545}.kpi.orange{border-left-color:#f26a00}.kl{font-size:8px;font-weight:700;text-transform:uppercase;color:#52666a}.kv{font-size:16px;font-weight:900;margin-top:2px}.kv small{display:block;font-size:9px;font-weight:700}.up{color:#1a7f45}.down{color:#c0392b}.card{border:1px solid #cfdad8;border-radius:6px;margin-bottom:8px;break-inside:avoid;overflow:hidden}.card h2{font-size:11px;margin:0;padding:5px 8px;background:#eef3f2;border-bottom:2px solid #f26a00}.card h2 small{font-weight:400;color:#68787b}.card>*:not(h2){margin:6px 8px}.two{display:grid;grid-template-columns:1fr 1fr;gap:8px}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #e3eaea;padding:3px 4px;text-align:left;font-size:10px}th{background:#f6f9f9}.n{text-align:right;width:44px}.ins{list-style:none;padding:0;margin:4px 8px 6px}.ins li{display:flex;gap:7px;padding:3px 0;border-bottom:1px dashed #e3eaea;line-height:1.35}.ins li.bad{color:#8a1f12}.ins li.good{color:#14532d}.mini{font-size:10px;color:#52666a}.empty{color:#68787b;font-style:italic}.foot{font-size:9px;color:#68787b;text-align:right;margin-top:4px}';
  w.document.open();
  w.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório mensal — '+ymLabel(ym)+'</title><style>'+css+'</style></head><body>'+body+'<script>window.addEventListener("load",function(){setTimeout(function(){window.focus();window.print();},600);});<\/script></body></html>');
  w.document.close();
}
