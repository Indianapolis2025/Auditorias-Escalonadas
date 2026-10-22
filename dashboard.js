/* ============================================================
   Dashboard e gráficos
   ============================================================ */
/* ---- Áreas de "hover" dos gráficos (tooltip e clique para filtrar) ---- */
var CHART_HITS={};
function hit(id,x,y,w,h,t,f){(CHART_HITS[id]||(CHART_HITS[id]=[])).push({x:x,y:y,w:w,h:h,t:t,f:f});}
function arcHit(id,cx,cy,r0,r1,a0,a1,t){(CHART_HITS[id]||(CHART_HITS[id]=[])).push({arc:true,cx:cx,cy:cy,r0:r0,r1:r1,a0:a0,a1:a1,t:t});}
function allItems(){
 const arr=[]; state.records.forEach(r=>getQuestionsForRecord(r).forEach(q=>{const v=r.answers?.[q.code]; if(v==="N"||v==="P")arr.push({r,q,v,just:r.justificativas?.[q.code]||""});})); return arr;
}
function normalizeFilterValue(v){
 return String(v??"").trim().toLocaleLowerCase("pt-BR");
}
function getRecordPlantSafe(r){
 return String(r?.planta ?? r?.Planta ?? r?.plant ?? r?.site ?? r?.unidade ?? r?.unidadeNegocio ?? "").trim();
}
function getDashRecords(){
 const period=document.getElementById("dashPeriod")?.value||"all";
 const local=document.getElementById("dashLocal")?.value||"all";
 const setor=document.getElementById("dashSetor")?.value||"all";
 const auditor=document.getElementById("dashAuditor")?.value||"all";
 const plant=document.getElementById("dashboardPlantFilter")?.value||"all";
 const nLocal=normalizeFilterValue(local), nSetor=normalizeFilterValue(setor), nAuditor=normalizeFilterValue(auditor), nPlant=normalizeFilterValue(plant);
 const now=new Date(); now.setHours(23,59,59,999);
 return state.records.filter(r=>{
   if(nLocal!=="all" && normalizeFilterValue(r.local)!==nLocal)return false;
   if(nSetor!=="all" && normalizeFilterValue(r.setor)!==nSetor)return false;
   if(nAuditor!=="all" && normalizeFilterValue(r.auditor)!==nAuditor)return false;
   if(inferPlant(r)!==normalizePlantName(dashboardPlantFilter))return false;
   if(period==="all")return true;
   const raw=String(r.data||"").slice(0,10), d=new Date(raw+"T00:00:00");
   if(isNaN(d))return true;
   if(period==="month")return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
   const days=Number(period); if(!Number.isFinite(days))return true;
   const from=new Date(now); from.setDate(from.getDate()-days+1); from.setHours(0,0,0,0);
   return d>=from&&d<=now;
 });
}
function renderDashboardTabs(){
 const wrap=document.getElementById("dashboardPlantTabs"); if(!wrap)return;
 const counts={"FUNDI\u00c7\u00c3O":0,"USINAGEM":0};
 (state.records||[]).forEach(r=>{const p=inferPlant(r); if(counts[p]!==undefined)counts[p]++;});
 const active=normalizePlantName(dashboardPlantFilter)||"USINAGEM";
 wrap.innerHTML=["FUNDI\u00c7\u00c3O","USINAGEM"].map(p=>`<button type="button" class="plant-tab ${active===p?"active":""}" onclick="setDashboardPlant('${p}')">${p}<span class="tab-count">${counts[p]} auditorias</span></button>`).join("");
}
function setDashboardPlant(plant){
 dashboardPlantFilter=normalizePlantName(plant)||"USINAGEM";
 const sel=document.getElementById("dashboardPlantFilter"); if(sel)sel.value=dashboardPlantFilter;
 renderDashboardTabs();
 renderDashboard();
}
function fillDashFilters(){
 const uniq=a=>[...new Set(a.map(x=>String(x??"").trim()).filter(Boolean))].sort((x,y)=>x.localeCompare(y,"pt-BR"));
 const ls=document.getElementById("dashLocal"), ss=document.getElementById("dashSetor"), as=document.getElementById("dashAuditor");
 if(!ls)return;
 const plant=normalizePlantName(dashboardPlantFilter)||"USINAGEM";
 const plantRecords=state.records.filter(r=>inferPlant(r)===plant);
 const keepL=ls.value||"all",keepS=ss.value||"all",keepA=as.value||"all";
 ls.innerHTML='<option value="all">Todos</option>'+uniq(plantRecords.map(r=>r.local)).map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
 ss.innerHTML='<option value="all">Todos</option>'+uniq(plantRecords.map(r=>r.setor)).map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
 as.innerHTML='<option value="all">Todos</option>'+uniq([...(state.auditors||[]).map(x=>x?.name),...plantRecords.map(r=>r.auditor)]).map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
 if([...ls.options].some(o=>o.value===keepL))ls.value=keepL; else ls.value="all";
 if([...ss.options].some(o=>o.value===keepS))ss.value=keepS; else ss.value="all";
 if([...as.options].some(o=>o.value===keepA))as.value=keepA; else as.value="all";
}
function clearDashFilters(){
 document.getElementById("dashPeriod").value="all";
 document.getElementById("dashLocal").value="all";
 document.getElementById("dashSetor").value="all";
 document.getElementById("dashAuditor").value="all";
 renderDashboard();
}
function renderDashboard(){
 dashboardPlantFilter=normalizePlantName(dashboardPlantFilter)||"USINAGEM";
 setActiveQuestionSet(dashboardPlantFilter);
 renderDashboardTabs();
 fillDashFilters();
 const rec=getDashRecords(), answers=rec.flatMap(r=>questions.map(q=>r.answers?.[q.code]).filter(Boolean));
 const A=answers.filter(x=>x==="A").length,P=answers.filter(x=>x==="P").length,N=answers.filter(x=>x==="N").length;
 const pend=rec.flatMap(r=>questions.map(q=>({r,q,v:r.answers?.[q.code],just:r.justificativas?.[q.code]||"",acao:r.acoesTomadas?.[q.code]||""}))).filter(x=>(x.v==="N"||x.v==="P")&&(!x.just.trim()||!x.acao.trim())).length;
 const totalNotas=answers.length;
 const validN=A+P+N; // N.A. não entra no cálculo
 const notaGeral=validN?Math.round((A*100+P*50)/validN*10)/10:0;
 const pctConf=validN?Math.round(A/validN*1000)/10:0;
 const pctParcial=validN?Math.round(P/validN*1000)/10:0;
 const pctNaoConf=validN?Math.round(N/validN*1000)/10:0;
 const conf=Math.round(pctConf);
 const metrics=[
  ["AUDITORIAS",rec.length,""],
  ["RESPOSTAS",totalNotas,"blue"],
  ["NOTA GERAL %",notaGeral.toLocaleString("pt-BR")+"%",""],
  ["PARCIAL %",pctParcial.toLocaleString("pt-BR")+"%","yellow"],
  ["N\u00c3O CONFORME %",pctNaoConf.toLocaleString("pt-BR")+"%","red"],
  ["PEND\u00caNCIAS",pend,"orange"]
 ];
 document.getElementById("metrics").innerHTML=metrics.map(x=>`<div class="kpi ${x[2]}"><div class="caption">${x[0]}</div><div class="num">${x[1]}</div></div>`).join("");
 document.getElementById("dashCount").textContent=`${rec.length} auditorias no filtro`;

 let bars="";
 categories.forEach(([cat,codes])=>{
   let vals=[];rec.forEach(r=>codes.forEach(c=>{const v=r.answers?.[c];if(v==="A"||v==="P"||v==="N")vals.push(v)}));
   let pct=vals.length?Math.round(vals.reduce((s,x)=>s+(x==="A"?100:x==="P"?50:0),0)/vals.length):0;
   bars+=`<div class="progress-row"><b>${esc(cat)}</b><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div><b class="right">${pct}%</b></div>`;
 });
 document.getElementById("catBars").innerHTML=bars||'<div class="empty">Sem dados para o filtro.</div>';

 const c=document.getElementById("resultChart"),ctx=c.getContext("2d"),w=c.width,h=c.height;ctx.clearRect(0,0,w,h);CHART_HITS.resultChart=[];c.__unit=1;
 ctx.fillStyle=chartTextColor();ctx.font="bold 15px Arial";ctx.textAlign="center";ctx.fillText("Distribui\u00e7\u00e3o das respostas",w/2,18);
 const data=[["A",A,"#70ad47",pctConf],["P",P,"#ffc000",pctParcial],["N",N,"#c00000",pctNaoConf]],max=Math.max(1,...data.map(x=>x[1]));
 const bw=Math.min(110,(w-180)/3),gap=45,start=(w-(bw*3+gap*2))/2;
 data.forEach((d,i)=>{let x=start+i*(bw+gap),bh=(d[1]/max)*170;ctx.fillStyle=d[2];ctx.fillRect(x,h-45-bh,bw,bh);hit("resultChart",x,h-70-bh,bw,bh+70,d[0]+": "+d[1]+" resposta(s) \u2022 "+d[3].toLocaleString("pt-BR")+"%");ctx.fillStyle=document.documentElement.getAttribute("data-theme")==="dark"?"#ffffff":"#333";ctx.font="bold 15px Arial";ctx.textAlign="center";ctx.fillText(d[1]+" ("+d[3].toLocaleString("pt-BR")+"%)",x+bw/2,h-58-bh);ctx.fillText(d[0],x+bw/2,h-20);});

 const localMap={};
 rec.forEach(r=>{localMap[r.local]??={aud:0,a:0,p:0,n:0};localMap[r.local].aud++;Object.values(r.answers||{}).forEach(v=>{if(v==="A")localMap[r.local].a++;if(v==="P")localMap[r.local].p++;if(v==="N")localMap[r.local].n++;});});
 const locals=Object.entries(localMap).sort((a,b)=>b[1].aud-a[1].aud).slice(0,12);
 document.getElementById("localSummary").innerHTML=locals.length?`<table class="mini-table"><thead><tr><th>Local</th><th>Aud.</th><th>A</th><th>P</th><th>N</th><th>Conf.</th></tr></thead><tbody>${locals.map(([l,v])=>`<tr class="clickable" onclick="setDashLocal('${String(l).replace(/'/g,"\\'")}')"><td>${esc(l)}</td><td>${v.aud}</td><td>${v.a}</td><td>${v.p}</td><td>${v.n}</td><td><b>${v.a+v.p+v.n?Math.round((v.a*100+v.p*50)/(v.a+v.p+v.n)):0}%</b></td></tr>`).join("")}</tbody></table>`:'<div class="empty">Sem dados.</div>';

 const pendItems=rec.flatMap(r=>questions.map(q=>({r,q,v:r.answers?.[q.code],just:r.justificativas?.[q.code]||"",acao:r.acoesTomadas?.[q.code]||""}))).filter(x=>(x.v==="N"||x.v==="P")&&(!x.just.trim()||!x.acao.trim())).slice(0,8);
 document.getElementById("pendingSummary").innerHTML=pendItems.length?`<table class="mini-table"><thead><tr><th>Data</th><th>Local</th><th>Item</th><th>Nota</th><th>Status</th></tr></thead><tbody>${pendItems.map(x=>{const status=!x.just.trim()?"PENDENTE":!x.acao.trim()?"AGUARDANDO A\u00c7\u00c3O":"RESOLVIDA";return `<tr><td>${fmtDate(x.r.data)}</td><td>${esc(x.r.local)}</td><td>${esc(x.q.code)}</td><td><span class="badge b-${x.v.toLowerCase()}">${x.v}</span></td><td><span class="badge ${status==='RESOLVIDA'?'b-resolved':status==='AGUARDANDO A\u00c7\u00c3O'?'b-action':'b-pend'}">${status}</span></td></tr>`}).join("")}</tbody></table><div style="margin-top:8px;font-size:11px;color:#666">${pend} pend\u00eancia(s) aguardando justificativa e/ou a\u00e7\u00e3o tomada.</div>`:'<div class="empty">Nenhuma pend\u00eancia ou a\u00e7\u00e3o em aberto.</div>';

 const latest=rec.slice(-10).reverse();
 document.getElementById("latest").innerHTML=latest.length?`<div class="tablewrap" style="max-height:350px"><table><thead><tr><th>Data</th><th>Local</th><th>Setor</th><th>Colaborador</th><th>Auditor</th><th>A</th><th>P</th><th>N</th><th>Nota %</th></tr></thead><tbody>${latest.map(r=>{let a=Object.values(r.answers||{});return `<tr><td>${fmtDate(r.data)}</td><td>${esc(r.local)}</td><td>${esc(r.setor)}</td><td>${esc(r.colaborador||"\u2014")}</td><td>${esc(r.auditor)}</td><td>${a.filter(x=>x==="A").length}</td><td>${a.filter(x=>x==="P").length}</td><td>${a.filter(x=>x==="N").length}</td><td><b>${auditScoreLabel(r)}</b></td></tr>`}).join("")}</tbody></table></div>`:'<div class="empty">Nenhuma auditoria.</div>';

 renderMonthlyCategoryEvolution(rec); renderTrendChart(rec); renderQuestionMonthChart(rec); renderWorstSectorChart(rec); renderAuditorChart(rec); renderParetoChart(rec); renderStatusChart(rec); renderCollabChart(rec);
}
/* --- Gráficos adicionais do dashboard --- */
function mondayOf(dateStr){
 const dt=new Date(String(dateStr)+"T00:00:00"); if(isNaN(dt))return null;
 const day=(dt.getDay()+6)%7; dt.setDate(dt.getDate()-day); return dt;
}
function prepareChartCanvas(id, fallbackH){
 const c=document.getElementById(id); if(!c)return null;
 const rect=c.getBoundingClientRect();
 const cssW=Math.max(320,Math.round(rect.width||c.parentElement?.clientWidth||700));
 const cssH=Math.max(220,Math.round(rect.height||fallbackH||300));
 const dpr=Math.max(1,Math.min(window.devicePixelRatio||1,3));
 c.width=Math.round(cssW*dpr); c.height=Math.round(cssH*dpr); c.__unit=dpr; CHART_HITS[id]=[];
 const ctx=c.getContext("2d"); ctx.setTransform(dpr,0,0,dpr,0,0);
 return {c,ctx,w:cssW,h:cssH};
}
function chartTextColor(){return document.documentElement.getAttribute("data-theme")==="dark"?"#ffffff":"#334155";}
function chartGridColor(){return document.documentElement.getAttribute("data-theme")==="dark"?"#475569":"#dbe3ea";}
function drawEmpty(id,msg){
 const z=prepareChartCanvas(id,300); if(!z)return; const {ctx,w,h}=z;
 ctx.clearRect(0,0,w,h); ctx.fillStyle=document.documentElement.getAttribute("data-theme")==="dark"?"#a9b7c7":"#64748b";
 ctx.font="13px Arial"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(msg||"Sem dados para o filtro.",w/2,h/2);
}
function drawHBars(id,data){
 const z=prepareChartCanvas(id,300); if(!z)return; const {ctx,w,h}=z; ctx.clearRect(0,0,w,h);
 if(!data.length){drawEmpty(id);return;}
 const max=Math.max(1,...data.map(d=>d[1]));
 const padL=Math.min(190,Math.max(125,w*0.24)),padR=42,padT=32,padB=18;
 const chartTitles={worstSectorChart:"Top 5 setores com mais n\u00e3o conformidades",auditorChart:"Auditorias por auditor",collabChart:"Colaboradores com mais n\u00e3o conformidades"};
 ctx.fillStyle=chartTextColor();ctx.font="bold 15px Arial";ctx.textAlign="center";ctx.textBaseline="alphabetic";ctx.fillText(chartTitles[id]||"",w/2,18);
 const rowH=(h-padT-padB)/data.length, bh=Math.min(34,rowH*0.58), plotW=w-padL-padR;
 ctx.font="11px Arial"; ctx.textBaseline="middle";
 data.forEach((d,i)=>{
  const cy=padT+rowH*i+rowH/2;
  ctx.strokeStyle=chartGridColor();ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(padL,cy+rowH/2-2);ctx.lineTo(w-padR,cy+rowH/2-2);ctx.stroke();
  ctx.fillStyle=chartTextColor();ctx.textAlign="right";
  let label=String(d[0]); if(label.length>25)label=label.slice(0,24)+"\u2026"; ctx.fillText(label,padL-10,cy);
  const bw=Math.max(3,(d[1]/max)*plotW);
  ctx.fillStyle=d[2]||"#4472c4"; ctx.fillRect(padL,cy-bh/2,bw,bh); hit(id,0,cy-rowH/2,w,rowH,String(d[0])+": "+d[1]+(id==="worstSectorChart"?" n\u00e3o conformidade(s)":id==="auditorChart"?" auditoria(s)":""),id==="worstSectorChart"?["dashSetor",String(d[0])]:id==="auditorChart"?["dashAuditor",String(d[0])]:null);
  ctx.fillStyle=chartTextColor();ctx.textAlign="left";ctx.font="bold 12px Arial";ctx.fillText(String(d[1]),padL+bw+8,cy);ctx.font="11px Arial";
 });
}
function drawLineTrend(id,points,color){
 const z=prepareChartCanvas(id,300); if(!z)return; const {ctx,w,h}=z; ctx.clearRect(0,0,w,h);
 if(!points.length){drawEmpty(id);return;}
 const padL=42,padR=18,padT=34,padB=38,plotW=w-padL-padR,plotH=h-padT-padB;
 ctx.fillStyle=chartTextColor();ctx.font="bold 15px Arial";ctx.textAlign="center";ctx.textBaseline="alphabetic";ctx.fillText("Tend\u00eancia de conformidade por semana",w/2,18);
 ctx.font="10px Arial";ctx.textAlign="right";ctx.textBaseline="middle";
 [0,25,50,75,100].forEach(v=>{const y=padT+plotH-(v/100)*plotH;ctx.strokeStyle=chartGridColor();ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(w-padR,y);ctx.stroke();ctx.fillStyle=document.documentElement.getAttribute("data-theme")==="dark"?"#cbd5e1":"#64748b";ctx.fillText(v+"%",padL-7,y);});
 const stepX=points.length>1?plotW/(points.length-1):0;
 ctx.strokeStyle=color||"#1769aa";ctx.lineWidth=3;ctx.lineJoin="round";ctx.lineCap="round";ctx.beginPath();
 points.forEach((p,i)=>{const x=padL+stepX*i,y=padT+plotH-(p[1]/100)*plotH;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});ctx.stroke();
 points.forEach((p,i)=>{const x=padL+stepX*i,y=padT+plotH-(p[1]/100)*plotH;ctx.fillStyle=color||"#1769aa";ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();ctx.fillStyle=chartTextColor();ctx.font="bold 10px Arial";ctx.textAlign="center";ctx.fillText(p[1]+"%",x,y-11);hit(id,x-14,0,28,h,"Semana de "+p[0]+": "+p[1]+"% de conformidade");});
 ctx.fillStyle=chartTextColor();ctx.font="10px Arial";ctx.textAlign="center";
 points.forEach((p,i)=>{if(points.length<=10||i%Math.ceil(points.length/10)===0||i===points.length-1){const x=padL+stepX*i;ctx.fillText(p[0],x,h-12);}});
}
function renderTrendChart(rec){
 const weekMap={};
 rec.forEach(r=>{
  const mon=mondayOf(r.data); if(!mon)return;
  const key=mon.toISOString().slice(0,10);
  weekMap[key]=weekMap[key]||{s:0,t:0};
  Object.values(r.answers||{}).forEach(v=>{ if(v==="A"||v==="P"||v==="N"){weekMap[key].t++; weekMap[key].s+=(v==="A"?100:v==="P"?50:0);} });
 });
 const keys=Object.keys(weekMap).sort().slice(-12);
 const points=keys.map(k=>[fmtDate(k).slice(0,5),weekMap[k].t?Math.round(weekMap[k].s/weekMap[k].t):0]);
 drawLineTrend("trendChart",points,"#1769aa");
}
function monthLabelPt(key){
 const [y,m]=String(key).split("-");
 const names=["Janeiro","Fevereiro","Mar\u00e7o","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
 return names[Math.max(0,Number(m)-1)]||key;
}
function monthlyCellStyle(pct){
 if(pct===null)return {bg:"#f3f4f6",fg:"#64748b"};
 if(pct>=95)return {bg:"#63be7b",fg:"#12351f"};
 if(pct>=85)return {bg:"#c6e48b",fg:"#263b17"};
 if(pct>=75)return {bg:"#ffeb84",fg:"#514600"};
 if(pct>=60)return {bg:"#f8cb78",fg:"#5a3500"};
 return {bg:"#ef8f76",fg:"#5b170d"};
}
function renderMonthlyCategoryEvolution(rec){
 const wrap=document.getElementById("monthlyEvolutionTable"); if(!wrap)return;
 const monthSet={};
 rec.forEach(r=>{if(!r.data)return;const d=new Date(String(r.data)+"T00:00:00");if(isNaN(d))return;monthSet[d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")]=true;});
 const months=Object.keys(monthSet).sort();
 const cats=categories.map(c=>c[0]);
 if(!months.length){wrap.innerHTML='<div class="monthly-evolution-empty">Sem dados mensais para os filtros selecionados.</div>';document.getElementById("monthlyEvolutionCount").textContent="";drawEmpty("monthlyGeneralChart","Sem dados para o filtro.");return;}
 const stats={};
 months.forEach(m=>{stats[m]={};cats.forEach(c=>stats[m][c]={sum:0,n:0});stats[m]._all={sum:0,n:0};});
 rec.forEach(r=>{
   if(!r.data)return;const d=new Date(String(r.data)+"T00:00:00");if(isNaN(d))return;
   const m=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");if(!stats[m])return;
   categories.forEach(([cat,codes])=>codes.forEach(code=>{const v=r.answers?.[code];if(!["A","P","N"].includes(v))return;const score=v==="A"?100:v==="P"?50:0;stats[m][cat].sum+=score;stats[m][cat].n++;stats[m]._all.sum+=score;stats[m]._all.n++;}));
 });
 const shortCat={"Seguran\u00e7a":"Seguran\u00e7a","Housekeeping (Casa Limpa)":"Housekeeping","Registros de Controle":"Registros de Controle","Doc. de Processos":"Doc. de Processos","Instrumentos de Medi\u00e7\u00e3o":"Instrumentos de Medi\u00e7\u00e3o","Identifica\u00e7\u00e3o de Pe\u00e7as N/OK":"Pe\u00e7as N/OK","Armazenamento / Identifica\u00e7\u00e3o":"Armazen./Identif.","Identifica\u00e7\u00e3o de Pe\u00e7as Para Retrabalho":"Pe\u00e7as p/ Retrabalho"};
 let html='<table class="monthly-evolution-table"><thead><tr><th>M\u00eas</th>';
 cats.forEach(c=>html+='<th>'+esc(shortCat[c]||c)+'</th>'); html+='<th>M\u00e9dia Geral</th></tr></thead><tbody>';
 months.forEach(m=>{
   html+='<tr><td>'+monthLabelPt(m)+'</td>';
   cats.forEach(c=>{const x=stats[m][c],pct=x.n?x.sum/x.n:null,st=monthlyCellStyle(pct);html+='<td style="background:'+st.bg+'!important;color:'+st.fg+'!important">'+(pct===null?"\u2014":Math.round(pct)+"%")+'</td>';});
   const g=stats[m]._all,pct=g.n?g.sum/g.n:null,st=monthlyCellStyle(pct);html+='<td class="general" style="background:'+st.bg+'!important;color:'+st.fg+'!important">'+(pct===null?"\u2014":Math.round(pct)+"%")+'</td></tr>';
 });
 html+='</tbody></table>'; wrap.innerHTML=html;
 const totalAnswers=rec.reduce((n,r)=>n+Object.values(r.answers||{}).filter(v=>["A","P","N"].includes(v)).length,0);
 document.getElementById("monthlyEvolutionCount").textContent=months.length+" m\u00eas(es) \u2022 "+totalAnswers+" respostas";
 const points=months.map(m=>{const x=stats[m]._all;return [monthLabelPt(m).slice(0,3),x.n?Math.round(x.sum/x.n):0];});
 drawMonthlyGeneralChart("monthlyGeneralChart",points);
}
function drawMonthlyGeneralChart(id,points){
 const z=prepareChartCanvas(id,280);if(!z)return;const {ctx,w,h}=z;ctx.clearRect(0,0,w,h);if(!points.length){drawEmpty(id);return;}
 const padL=44,padR=20,padT=40,padB=38,plotW=w-padL-padR,plotH=h-padT-padB;
 ctx.fillStyle=chartTextColor();ctx.font="bold 15px Arial";ctx.textAlign="center";ctx.textBaseline="alphabetic";ctx.fillText("Evolu\u00e7\u00e3o Mensal \u2014 M\u00e9dia Geral",w/2,18);
 [0,25,50,75,100].forEach(v=>{const y=padT+plotH-(v/100)*plotH;ctx.strokeStyle=chartGridColor();ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(w-padR,y);ctx.stroke();ctx.fillStyle=chartTextColor();ctx.font="10px Arial";ctx.textAlign="right";ctx.textBaseline="middle";ctx.fillText(v+"%",padL-7,y);});
 const step=points.length>1?plotW/(points.length-1):0;ctx.strokeStyle="#4472c4";ctx.lineWidth=3;ctx.lineJoin="round";ctx.lineCap="round";ctx.beginPath();
 points.forEach((p,i)=>{const x=padL+step*i,y=padT+plotH-(p[1]/100)*plotH;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();
 points.forEach((p,i)=>{const x=padL+step*i,y=padT+plotH-(p[1]/100)*plotH;ctx.fillStyle="#4472c4";ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();ctx.fillStyle=chartTextColor();ctx.font="bold 10px Arial";ctx.textAlign="center";ctx.fillText(p[1]+"%",x,y-11);ctx.font="10px Arial";ctx.fillText(p[0],x,h-12);hit(id,x-20,0,40,h,p[0]+": "+p[1]+"% (m\u00e9dia geral)");});
}
function renderQuestionMonthChart(rec){
 const z=prepareChartCanvas("questionMonthChart",760); if(!z)return;
 const {ctx,w,h}=z; ctx.clearRect(0,0,w,h);
 if(!rec.length){drawEmpty("questionMonthChart","Sem dados para o filtro.");return;}
 const monthMap={};
 rec.forEach(r=>{
   if(!r.data)return;
   const d=new Date(String(r.data)+"T00:00:00"); if(isNaN(d))return;
   const key=String(d.getFullYear())+"-"+String(d.getMonth()+1).padStart(2,"0");
   monthMap[key]=true;
 });
 const months=Object.keys(monthMap).sort().slice(-12);
 if(!months.length){drawEmpty("questionMonthChart","Sem datas v\u00e1lidas para o filtro.");return;}
 const vals={};
 questions.forEach(q=>{vals[q.code]={};months.forEach(m=>vals[q.code][m]={sum:0,n:0});});
 rec.forEach(r=>{
   if(!r.data)return;
   const d=new Date(String(r.data)+"T00:00:00"); if(isNaN(d))return;
   const m=String(d.getFullYear())+"-"+String(d.getMonth()+1).padStart(2,"0");
   if(!vals[questions[0]?.code] || !months.includes(m))return;
   questions.forEach(q=>{
     const v=r.answers?.[q.code];
     if(v!=="A"&&v!=="P"&&v!=="N")return;
     const score=v==="A"?100:v==="P"?50:0;
     vals[q.code][m].sum+=score; vals[q.code][m].n++;
   });
 });
 const padL=150,padR=20,padT=52,padB=42;
 ctx.fillStyle=chartTextColor();ctx.font="bold 15px Arial";ctx.textAlign="center";ctx.textBaseline="alphabetic";ctx.fillText("M\u00e9dia das notas por pergunta \u00d7 m\u00eas",w/2,20);
 const plotW=Math.max(420,w-padL-padR), plotH=Math.max(500,h-padT-padB);
 const rowH=Math.max(18,plotH/questions.length);
 const colW=plotW/months.length;
 const text=chartTextColor(), grid=chartGridColor();
 ctx.font="10px Arial"; ctx.textBaseline="middle";
 // title / scale
 ctx.fillStyle=text;ctx.font="bold 12px Arial";ctx.textAlign="left";ctx.fillText("M\u00e9dia mensal (%)",padL,padT-18);
 ctx.font="10px Arial";ctx.textAlign="center";
 months.forEach((m,i)=>{const x=padL+i*colW+colW/2;const [yy,mm]=m.split("-");ctx.fillStyle=text;ctx.fillText(mm+"/"+yy.slice(2),x,padT-18);});
 // rows
 questions.forEach((q,ri)=>{
   const y=padT+ri*rowH;
   ctx.fillStyle=text;ctx.font="bold 10px Arial";ctx.textAlign="right";
   ctx.fillText(q.code+" \u2014 "+String(q.text||q.title||q.label||"").slice(0,25),padL-8,y+rowH/2);
   months.forEach((m,ci)=>{
     const cell=vals[q.code][m]; const pct=cell.n?cell.sum/cell.n: null;
     const x=padL+ci*colW;
     hit("questionMonthChart",x,y,colW,rowH,q.code+" \u2014 "+String(q.text||"")+" \u2022 "+m.slice(5)+"/"+m.slice(2,4)+": "+(pct===null?"sem respostas":Math.round(pct)+"% ("+cell.n+" resp.)"));
     ctx.strokeStyle=grid;ctx.lineWidth=1;ctx.strokeRect(x,y,colW,rowH);
     if(pct===null){ctx.fillStyle=document.documentElement.getAttribute("data-theme")==="dark"?"#1e293b":"#f1f5f9";ctx.fillRect(x+1,y+1,Math.max(0,colW-2),Math.max(0,rowH-2));}
     else {
       const hue=Math.max(0,Math.min(120,pct*1.2));
       ctx.fillStyle=`hsl(${hue}, ${document.documentElement.getAttribute("data-theme")==="dark"?"65%":"75%"}, ${document.documentElement.getAttribute("data-theme")==="dark"?"35%":"82%"})`;
       ctx.fillRect(x+1,y+1,Math.max(0,colW-2),Math.max(0,rowH-2));
       ctx.fillStyle=pct>=60?"#102a12":text;ctx.font="bold 9px Arial";ctx.textAlign="center";ctx.fillText(Math.round(pct)+"%",x+colW/2,y+rowH/2);
     }
   });
 });
 // legend
 const ly=h-15; ctx.font="10px Arial";ctx.textAlign="left";ctx.fillStyle=text;ctx.fillText("Sem respostas",padL,ly);
 for(let i=0;i<5;i++){const pct=i*25;const x=padL+82+i*58;ctx.fillStyle=`hsl(${pct*1.2}, ${document.documentElement.getAttribute("data-theme")==="dark"?"65%":"75%"}, ${document.documentElement.getAttribute("data-theme")==="dark"?"35%":"82%"})`;ctx.fillRect(x,ly-7,28,10);ctx.fillStyle=text;ctx.fillText(pct+"%",x+31,ly);}
}
function renderWorstSectorChart(rec){
 const map={};
 rec.forEach(r=>{ const s=r.setor||r.local||"\u2014"; map[s]=map[s]||0; Object.values(r.answers||{}).forEach(v=>{ if(v==="N")map[s]++; }); });
 const data=Object.entries(map).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([s,n])=>[s,n,"#c00000"]);
 drawHBars("worstSectorChart",data);
 if(!data.length)drawEmpty("worstSectorChart","Nenhuma n\u00e3o conformidade no filtro.");
}
function renderAuditorChart(rec){
 const map={};
 rec.forEach(r=>{ const a=r.auditor||"\u2014"; map[a]=(map[a]||0)+1; });
 const data=Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([a,n])=>[a,n,"#4472c4"]);
 drawHBars("auditorChart",data);
}
function renderCollabChart(rec){
 const map={};
 rec.forEach(r=>{
   const c=(r.colaborador||r.local||"\u2014").trim();
   if(!map[c])map[c]={auditorias:0,soma:0};
   map[c].auditorias++;
   map[c].soma+=calcAuditScorePercent(r);
 });
 const data=Object.entries(map).filter(([,v])=>v.auditorias>0)
   .sort((a,b)=>b[1].soma/b[1].auditorias-a[1].soma/a[1].auditorias)
   .slice(0,10);
 drawCollabScoreBars("collabChart",data);
}
function drawCollabScoreBars(id,data){
 const z=prepareChartCanvas(id,330); if(!z)return; const {ctx,w,h}=z; ctx.clearRect(0,0,w,h);
 if(!data.length){drawEmpty(id,"Sem dados de colaboradores para o filtro.");return;}
 const padL=Math.min(220,Math.max(150,w*0.30)),padR=78,padT=34,padB=18;
 const rowH=(h-padT-padB)/data.length,bh=Math.min(30,rowH*0.55),plotW=w-padL-padR;
 ctx.fillStyle=chartTextColor();ctx.font="bold 15px Arial";ctx.textAlign="center";ctx.textBaseline="alphabetic";ctx.fillText("M\u00e9dia das notas por colaborador",w/2,18);
 ctx.font="11px Arial";ctx.textBaseline="middle";
 data.forEach(([name,v],i)=>{
   const avg=Math.round((v.soma/v.auditorias)*10)/10;
   const cy=padT+rowH*i+rowH/2;
   ctx.strokeStyle=chartGridColor();ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(padL,cy+rowH/2-2);ctx.lineTo(w-padR,cy+rowH/2-2);ctx.stroke();
   ctx.fillStyle=chartTextColor();ctx.textAlign="right";
   let label=String(name);if(label.length>27)label=label.slice(0,26)+"\u2026";ctx.fillText(label,padL-10,cy);
   const bw=Math.max(3,(avg/100)*plotW);
   ctx.fillStyle=avg>=80?"#70ad47":avg>=60?"#ffc000":"#c00000";ctx.fillRect(padL,cy-bh/2,bw,bh);hit(id,0,cy-rowH/2,w,rowH,String(name)+": "+avg.toLocaleString("pt-BR")+"% \u2022 "+v.auditorias+" auditoria(s)");
   ctx.fillStyle=chartTextColor();ctx.textAlign="left";ctx.font="bold 12px Arial";ctx.fillText(avg.toLocaleString("pt-BR")+"%",padL+bw+8,cy-5);
   ctx.font="10px Arial";ctx.fillText(v.auditorias+" auditorias",padL+bw+8,cy+10);
   ctx.font="11px Arial";
 });
}
function drawDonut(id,data,opts){
 const z=prepareChartCanvas(id,opts?.h||300); if(!z)return; const {ctx,w,h}=z; ctx.clearRect(0,0,w,h);
 ctx.fillStyle=chartTextColor();ctx.font="bold 15px Arial";ctx.textAlign="center";ctx.textBaseline="alphabetic";ctx.fillText(opts?.title||"",w/2,18);
 const total=data.reduce((s,d)=>s+d[1],0);
 if(!total){drawEmpty(id,"Sem dados para o filtro.");return;}
 const legendH=Math.max(24,Math.ceil(data.length/2)*20);
 const cx=w*0.34, cy=(h-legendH+30)/2+8, rOuter=Math.min(cx-24,(h-legendH-40)/2), rInner=rOuter*0.55;
 let ang=-Math.PI/2;
 data.forEach(d=>{
  const slice=(d[1]/total)*Math.PI*2;
  ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,rOuter,ang,ang+slice);ctx.closePath();ctx.fillStyle=d[2];ctx.fill();
  arcHit(id,cx,cy,rInner,rOuter,ang,ang+slice,d[0]+": "+d[1]+" ("+Math.round(d[1]/total*100)+"%)");
  ang+=slice;
 });
 ctx.globalCompositeOperation="destination-out";ctx.beginPath();ctx.arc(cx,cy,rInner,0,Math.PI*2);ctx.fill();ctx.globalCompositeOperation="source-over";
 ctx.fillStyle=chartTextColor();ctx.font="bold 20px Arial";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(String(total),cx,cy-8);
 ctx.font="10px Arial";ctx.fillText("auditorias",cx,cy+12);
 const legX=w*0.6, legY0=cy-rOuter+6, rowH=22;
 data.forEach((d,i)=>{
  const y=legY0+i*rowH, pct=Math.round(d[1]/total*100);
  ctx.fillStyle=d[2];ctx.fillRect(legX,y-7,12,12);
  ctx.fillStyle=chartTextColor();ctx.font="12px Arial";ctx.textAlign="left";ctx.textBaseline="middle";
  ctx.fillText(`${d[0]} \u2014 ${d[1]} (${pct}%)`,legX+18,y);
 });
}
function renderStatusChart(rec){
 const map={"NO PRAZO":0,"ATRASADA":0,"SEM STATUS":0};
 rec.forEach(r=>{ const s=String(r.situacao||"").trim().toUpperCase(); if(s==="NO PRAZO")map["NO PRAZO"]++; else if(s==="ATRASADA")map["ATRASADA"]++; else map["SEM STATUS"]++; });
 const colors={"NO PRAZO":"#1fa463","ATRASADA":"#ef3434","SEM STATUS":"#94a3b8"};
 const data=Object.entries(map).filter(([,n])=>n>0).map(([k,n])=>[k,n,colors[k]]);
 drawDonut("statusChart",data,{title:"Situa\u00e7\u00e3o das auditorias",h:260});
}
function renderParetoChart(rec){
 const map={};
 rec.forEach(r=>{
  questions.forEach(q=>{if(r.answers?.[q.code]==="N") map[q.code]=(map[q.code]||0)+1;});
 });
 const items=Object.entries(map).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]);
 const z=prepareChartCanvas("paretoChart",360); if(!z)return; const {ctx,w,h}=z; ctx.clearRect(0,0,w,h);
 if(!items.length){drawEmpty("paretoChart","Nenhuma n\u00e3o conformidade no filtro.");return;}
 const total=items.reduce((s,x)=>s+x[1],0); const padL=48,padR=52,padT=38,padB=72;
 ctx.fillStyle=chartTextColor();ctx.font="bold 15px Arial";ctx.textAlign="center";ctx.textBaseline="alphabetic";ctx.fillText("Pareto \u2014 N\u00e3o conformidades por pergunta",w/2,20);
 const plotW=w-padL-padR,plotH=h-padT-padB; const max=Math.max(1,...items.map(x=>x[1]));
 const gap=Math.max(3,Math.min(10,plotW/items.length*0.12)); const bw=Math.max(8,(plotW-gap*(items.length+1))/items.length);
 // grid esquerda (quantidade)
 ctx.font="10px Arial";ctx.textAlign="right";ctx.textBaseline="middle";
 const ticks=4; for(let i=0;i<=ticks;i++){const val=Math.ceil(max*i/ticks);const y=padT+plotH-(val/max)*plotH;ctx.strokeStyle=chartGridColor();ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(w-padR,y);ctx.stroke();ctx.fillStyle=chartTextColor();ctx.fillText(String(val),padL-8,y);}
 // linha 80%
 const y80=padT+plotH-(80/100)*plotH;ctx.setLineDash([5,4]);ctx.strokeStyle=document.documentElement.getAttribute("data-theme")==="dark"?"#94a3b8":"#94a3b8";ctx.beginPath();ctx.moveTo(padL,y80);ctx.lineTo(w-padR,y80);ctx.stroke();ctx.setLineDash([]);
 ctx.fillStyle=document.documentElement.getAttribute("data-theme")==="dark"?"#cbd5e1":"#64748b";ctx.font="10px Arial";ctx.textAlign="left";ctx.fillText("80%",w-padR+8,y80);
 let cum=0; const pts=[];
 items.forEach((it,i)=>{const x=padL+gap+i*(bw+gap);const bh=(it[1]/max)*plotH;const y=padT+plotH-bh;ctx.fillStyle="#c00000";ctx.fillRect(x,y,bw,bh);hit("paretoChart",x-gap/2,padT,bw+gap,plotH,it[0]+" \u2014 "+(((questions.find(q=>q.code===it[0])||{}).text)||"")+": "+it[1]+" n\u00e3o conformidade(s)");ctx.fillStyle=chartTextColor();ctx.font="bold 10px Arial";ctx.textAlign="center";ctx.fillText(String(it[1]),x+bw/2,y-7);ctx.save();ctx.translate(x+bw/2,h-padB+12);ctx.rotate(-Math.PI/4);ctx.font="10px Arial";ctx.fillText(it[0],0,0);ctx.restore();cum+=it[1];pts.push([x+bw/2,padT+plotH-(cum/total)*plotH,cum/total*100]);});
 // eixo direito 0–100%
 ctx.fillStyle=chartTextColor();ctx.font="10px Arial";ctx.textAlign="left";ctx.textBaseline="middle";[0,25,50,75,100].forEach(v=>{const y=padT+plotH-(v/100)*plotH;ctx.fillText(v+"%",w-padR+8,y);});
 ctx.strokeStyle="#4472c4";ctx.lineWidth=3;ctx.lineJoin="round";ctx.lineCap="round";ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke();
 pts.forEach(p=>{ctx.fillStyle="#4472c4";ctx.beginPath();ctx.arc(p[0],p[1],4,0,Math.PI*2);ctx.fill();ctx.fillStyle=chartTextColor();ctx.font="bold 9px Arial";ctx.textAlign="center";ctx.fillText(Math.round(p[2])+"%",p[0],p[1]-10);});
 ctx.fillStyle=chartTextColor();ctx.font="bold 10px Arial";ctx.textAlign="left";ctx.fillText("N\u00ba de N",padL,12);ctx.fillStyle="#4472c4";ctx.textAlign="right";ctx.fillText("% acumulado",w-padR,12);
}
function clearAllRecords(){
 if(!state.records.length){alert("N\u00e3o h\u00e1 registros para apagar.");return;}
 if(!confirm(`Isso vai apagar TODAS as ${state.records.length} auditorias do hist\u00f3rico deste navegador. Essa a\u00e7\u00e3o n\u00e3o pode ser desfeita.\n\nRecomendado: exporte um Backup (JSON) antes, caso ainda n\u00e3o tenha.\n\nDeseja continuar?`))return;
 if(!confirm("Confirmar definitivamente a exclus\u00e3o de TODO o hist\u00f3rico?"))return;
 takeSnapshot("antes de apagar o hist\u00f3rico",true); state.records=[]; saveState(); alert("Hist\u00f3rico apagado."); Promise.resolve(onlineReady?syncStateOnlineNow():null).catch(e=>console.warn("sync",e)).then(()=>location.reload());
}
function setDashLocal(local){document.getElementById("dashLocal").value=local;renderDashboard();}
function exportDashboardPDF(){
  const rec=getDashRecords();
  if(!rec.length){alert("N\u00e3o h\u00e1 dados no Dashboard para exportar com os filtros atuais.");return;}

  const ids=["resultChart","monthlyGeneralChart","trendChart","questionMonthChart","worstSectorChart","auditorChart","paretoChart","statusChart","collabChart"];
  const imgs={};
  ids.forEach(id=>{
    const c=document.getElementById(id);
    if(!c)return;
    try{imgs[id]=c.toDataURL("image/png",1.0);}catch(e){imgs[id]="";}
  });
  const cloneTable=document.getElementById("monthlyEvolutionTable")?.cloneNode(true);
  const catBars=document.getElementById("catBars")?.cloneNode(true);
  const metrics=document.getElementById("metrics")?.cloneNode(true);
  const period=document.getElementById("dashPeriod")?.selectedOptions?.[0]?.textContent||"Todo o per\u00edodo";
  const local=document.getElementById("dashLocal")?.selectedOptions?.[0]?.textContent||"Todos";
  const setor=document.getElementById("dashSetor")?.selectedOptions?.[0]?.textContent||"Todos";
  const auditor=document.getElementById("dashAuditor")?.selectedOptions?.[0]?.textContent||"Todos";
  const planta=document.getElementById("dashboardPlantFilter")?.selectedOptions?.[0]?.textContent||"Todas as plantas";
  const plantTitle=(normalizePlantName(dashboardPlantFilter)||planta||"PLANTA").toUpperCase();
  const chart=(id,cls="")=>imgs[id]?`<div class="chart-frame ${cls}"><img src="${imgs[id]}" alt="${id}"></div>`:`<div class="chart-missing">Gr\u00e1fico indispon\u00edvel</div>`;
  const cats=catBars?.innerHTML||'<div class="empty">Sem dados.</div>';
  const kpis=metrics?.innerHTML||'';
  const table=cloneTable?.outerHTML||'<div class="empty">Sem dados mensais.</div>';
  const w=window.open("","_blank","width=1600,height=1100");
  if(!w){alert("Permita pop-ups para exportar o Dashboard em PDF.");return;}
  w.document.open();
  w.document.write(`<!doctype html><html lang="pt-BR" data-theme="dark"><head><meta charset="utf-8"><title>Dashboard - ${esc(plantTitle)}</title><style>
@page{size:A4 landscape;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#0b1220;color:#e5edf5;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-size:9px}
.pdf-page{position:relative;width:297mm;height:209mm;min-height:209mm;max-height:209mm;page-break-after:always;break-after:page;background:#0b1220;padding:5mm;overflow:hidden}
.pdf-page:last-child{page-break-after:auto;break-after:auto}
.pdf-page,.box{break-inside:avoid;page-break-inside:avoid}
.header{height:12mm;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #ff7a00;padding:0 1mm 2mm}
.brand{font-size:18px;font-weight:900;color:#fff}.sub{font-size:8px;color:#aebed0;margin-top:1px}.date{font-size:7px;color:#aebed0;text-align:right}
.filters{margin:2mm 0;border:1px solid #334155;background:#121c2d;border-radius:4px;padding:1.8mm 2mm;color:#dbe5ef;font-size:8px}.filters b{color:#fff}.plant{font-size:13px;font-weight:900;color:#ff8a19;margin:2mm 0}
.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:2mm;margin-bottom:3mm}.kpi{height:16mm;border:1px solid #334155;border-radius:4px;background:#172235;padding:2mm;overflow:hidden}.kpi .caption{font-size:7px;color:#9fb0c2}.kpi .num{font-size:15px;font-weight:900;color:#fff;margin-top:1mm}
.kpi.blue{border-left:3px solid #3b82f6}.kpi.yellow{border-left:3px solid #f59e0b}.kpi.red{border-left:3px solid #ef4444}.kpi.orange{border-left:3px solid #f97316}
.section-title,.box-head{font-size:11px;font-weight:900;color:#fff;background:#172235;border:1px solid #334155;border-bottom:2px solid #ff7a00;padding:2mm 2.5mm;border-radius:4px 4px 0 0}
.box{border:1px solid #334155;background:#111827;border-radius:4px;overflow:hidden}.box-body{padding:3mm}
.overview-grid{display:grid;grid-template-columns:1fr 1fr;gap:3mm}.overview-grid .box{height:70mm}.overview-grid .box-body{height:calc(100% - 10mm);overflow:hidden}
.category-bars{width:100%;padding:1mm 0}.progress-row{display:grid;grid-template-columns:46mm 1fr 12mm;gap:2.5mm;align-items:center;margin:2.3mm 0;font-size:8.2px;line-height:1.1;color:#e5edf5}.progress-row b:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.progress-row .right{text-align:right}.progress-track{height:4.2mm;background:#334155;border-radius:99px;overflow:hidden}.progress-fill{height:100%;background:#1fa463;border-radius:99px;min-width:0}
.chart-frame{width:100%;height:100%;display:flex;justify-content:center;align-items:center;overflow:hidden;background:#111827}.chart-frame img{display:block;max-width:100%;max-height:100%;width:100%;height:100%;object-fit:contain}
.legend{display:flex;justify-content:center;gap:9mm;color:#cbd5e1;font-size:8px;margin-top:2mm}.dot{display:inline-block;width:2.8mm;height:2.8mm;border-radius:50%;vertical-align:middle;margin-right:1mm}.a{background:#70ad47}.p{background:#ffc000}.n{background:#c00000}
.monthly{margin-top:3mm;height:164mm}.monthly .box-body{padding:2mm;overflow:hidden}.monthly table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:7.5px;color:#e5edf5}.monthly th{background:#ed7900;color:#fff;border:1px solid #fff;padding:1.7mm 1mm;line-height:1.02;font-size:7.5px}.monthly td{border:1px solid #334155;padding:1.5mm 1mm;text-align:center;font-weight:700;line-height:1.02;font-size:7.5px}.monthly td:first-child{text-align:left;font-weight:800;background:#172235;color:#fff}.monthly th:first-child{width:9%}.monthly th:last-child{width:9%}
.page-title{font-size:13px;font-weight:900;color:#fff;margin:3mm 0 2mm}.note{font-size:8px;color:#aebed0;margin:2mm 0;text-align:left}.footer{font-size:7px;color:#708198;text-align:right;margin-top:2mm}
.full-chart{height:166mm}.full-chart .box-body{height:calc(100% - 10mm);padding:3mm}.full-chart .chart-frame{height:100%}
.half-chart{height:80mm}.half-chart .box-body{height:calc(100% - 10mm);padding:3mm}.half-chart .chart-frame{height:100%}
.two-half{display:grid;grid-template-columns:1fr 1fr;gap:3mm}.two-half .box{height:82mm}
.chart-missing{padding:20mm;text-align:center;color:#94a3b8}
@media print{html,body{background:#0b1220!important}.pdf-page{width:297mm;height:209mm;min-height:209mm;max-height:209mm;overflow:hidden!important}.no-print{display:none!important}}
</style></head><body>
<div class="pdf-page">
 <div class="header"><div><div class="brand">AUDITORIAS ESCALONADAS</div><div class="sub">Dashboard Executivo \u2022 Controle \u2022 Conformidade \u2022 Resultados</div></div><div class="date">${new Date().toLocaleString("pt-BR")}</div></div>
 <div class="filters"><b>Filtros:</b> Per\u00edodo: ${esc(period)} | Local: ${esc(local)} | Setor: ${esc(setor)} | Auditor: ${esc(auditor)} | Planta: ${esc(planta)}</div>
 <div class="plant">PLANTA: ${esc(plantTitle)}</div><div class="kpis">${kpis}</div>
 <div class="overview-grid"><div class="box"><div class="box-head">Conformidade por categoria</div><div class="box-body"><div class="category-bars">${cats}</div></div></div><div class="box"><div class="box-head">Distribui\u00e7\u00e3o das respostas</div><div class="box-body">${chart("resultChart")}<div class="legend"><span><i class="dot a"></i>A \u2014 Conforme</span><span><i class="dot p"></i>P \u2014 Parcial</span><span><i class="dot n"></i>N \u2014 N\u00e3o conforme</span></div></div></div></div>
 <div class="footer">P\u00e1gina 1 \u2022 ${esc(plantTitle)}</div>
</div>
<div class="pdf-page"><div class="header"><div><div class="brand">${esc(plantTitle)} \u2014 EVOLU\u00c7\u00c3O MENSAL</div><div class="sub">Tabela completa de conformidade por categoria e m\u00eas</div></div><div class="date">Dashboard Executivo</div></div><div class="page-title">Evolu\u00e7\u00e3o Mensal por Categoria</div><div class="box monthly"><div class="box-head">M\u00e9dia de conformidade por m\u00eas</div><div class="box-body"><div class="note">A = 100%, P = 50% e N = 0%. A m\u00e9dia \u00e9 calculada sobre as respostas dispon\u00edveis em cada m\u00eas.</div>${table}</div></div><div class="footer">P\u00e1gina 2 \u2022 ${esc(plantTitle)}</div></div>
<div class="pdf-page"><div class="header"><div><div class="brand">${esc(plantTitle)} \u2014 EVOLU\u00c7\u00c3O MENSAL</div><div class="sub">Acompanhamento da m\u00e9dia geral</div></div><div class="date">Dashboard Executivo</div></div><div class="box full-chart"><div class="box-head">Evolu\u00e7\u00e3o Mensal \u2014 M\u00e9dia Geral</div><div class="box-body">${chart("monthlyGeneralChart")}</div></div><div class="footer">P\u00e1gina 3 \u2022 ${esc(plantTitle)}</div></div>
<div class="pdf-page"><div class="header"><div><div class="brand">${esc(plantTitle)} \u2014 TEND\u00caNCIA</div><div class="sub">Acompanhamento temporal da conformidade</div></div><div class="date">Dashboard Executivo</div></div><div class="box full-chart"><div class="box-head">Tend\u00eancia de Conformidade por Semana</div><div class="box-body">${chart("trendChart")}</div></div><div class="footer">P\u00e1gina 4 \u2022 ${esc(plantTitle)}</div></div>
<div class="pdf-page"><div class="header"><div><div class="brand">${esc(plantTitle)} \u2014 M\u00c9DIA POR PERGUNTA</div><div class="sub">M\u00e9dia das notas de cada pergunta em cada m\u00eas</div></div><div class="date">Dashboard Executivo</div></div><div class="box full-chart"><div class="box-head">M\u00e9dia das Notas por Pergunta \u00d7 M\u00eas</div><div class="box-body"><div class="note">A = 100%, P = 50% e N = 0%.</div>${chart("questionMonthChart")}</div></div><div class="footer">P\u00e1gina 5 \u2022 ${esc(plantTitle)}</div></div>
<div class="pdf-page"><div class="header"><div><div class="brand">${esc(plantTitle)} \u2014 SETORES</div><div class="sub">Principais setores com n\u00e3o conformidades</div></div><div class="date">Dashboard Executivo</div></div><div class="box full-chart"><div class="box-head">Top 5 Setores com Mais N\u00e3o Conformidades</div><div class="box-body">${chart("worstSectorChart")}</div></div><div class="footer">P\u00e1gina 6 \u2022 ${esc(plantTitle)}</div></div>
<div class="pdf-page"><div class="header"><div><div class="brand">${esc(plantTitle)} \u2014 AUDITORES</div><div class="sub">Quantidade de auditorias por auditor</div></div><div class="date">Dashboard Executivo</div></div><div class="box full-chart"><div class="box-head">Auditorias por Auditor</div><div class="box-body">${chart("auditorChart")}</div></div><div class="footer">P\u00e1gina 7 \u2022 ${esc(plantTitle)}</div></div>
<div class="pdf-page"><div class="header"><div><div class="brand">${esc(plantTitle)} \u2014 PARETO</div><div class="sub">Concentra\u00e7\u00e3o das n\u00e3o conformidades por pergunta</div></div><div class="date">Dashboard Executivo</div></div><div class="box full-chart"><div class="box-head">Diagrama de Pareto \u2014 N\u00e3o Conformidades por Pergunta</div><div class="box-body"><div class="note">Perguntas ordenadas pela quantidade de respostas N. A linha mostra o percentual acumulado.</div>${chart("paretoChart")}</div></div><div class="footer">P\u00e1gina 8 \u2022 ${esc(plantTitle)}</div></div>
<div class="pdf-page"><div class="header"><div><div class="brand">${esc(plantTitle)} \u2014 SITUA\u00c7\u00c3O</div><div class="sub">Status das auditorias</div></div><div class="date">Dashboard Executivo</div></div><div class="box full-chart"><div class="box-head">Situa\u00e7\u00e3o das Auditorias</div><div class="box-body">${chart("statusChart")}</div></div><div class="footer">P\u00e1gina 9 \u2022 ${esc(plantTitle)}</div></div>
<div class="pdf-page"><div class="header"><div><div class="brand">${esc(plantTitle)} \u2014 COLABORADORES</div><div class="sub">Ranking por n\u00e3o conformidades</div></div><div class="date">Dashboard Executivo</div></div><div class="box full-chart"><div class="box-head">Colaboradores com Mais N\u00e3o Conformidades / M\u00e9dia das Notas</div><div class="box-body">${chart("collabChart")}</div></div><div class="footer">P\u00e1gina 10 \u2022 ${esc(plantTitle)}</div></div>
<script>window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print();},900);});<\/script>
</body></html>`);
  w.document.close();
}
