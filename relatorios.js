/* ============================================================
   Relatórios
   ============================================================ */
function renderReports(){
  const map={};
  state.records.forEach(r=>{
    map[r.setor]??={aud:0,a:0,p:0,n:0};
    map[r.setor].aud++;
    Object.values(r.answers||{}).forEach(v=>{
      if(v==="A")map[r.setor].a++;
      if(v==="P")map[r.setor].p++;
      if(v==="N")map[r.setor].n++;
    });
  });
  const rows=Object.entries(map).sort((a,b)=>b[1].aud-a[1].aud);
  document.getElementById("reportSector").innerHTML=rows.length
    ? `<div class="report-table-wrap"><table class="report-table"><thead><tr><th>Setor</th><th class="num">Aud.</th><th class="num">A</th><th class="num">P</th><th class="num">N</th><th class="num">Conf.</th></tr></thead><tbody>${rows.map(([k,v])=>`<tr><td>${esc(k)}</td><td class="num">${v.aud}</td><td class="num">${v.a}</td><td class="num">${v.p}</td><td class="num">${v.n}</td><td class="percent">${v.a+v.p+v.n?Math.round((v.a*100+v.p*50)/(v.a+v.p+v.n)):0}%</td></tr>`).join("")}</tbody></table></div>`
    : '<div class="report-empty">Sem dados.</div>';

  let cats="";
  categories.forEach(([cat,codes])=>{
    let sum=0,t=0;
    state.records.forEach(r=>codes.forEach(c=>{
      const v=r.answers?.[c];
      if(v==="A"||v==="P"||v==="N"){t++;sum+=(v==="A"?100:v==="P"?50:0);}
    }));
    const pctCat=t?Math.round(sum/t):0;
    cats+=`<div class="progress-row"><b>${esc(cat)}</b><div class="progress-track"><div class="progress-fill" style="width:${pctCat}%"></div></div><b>${pctCat}%</b></div>`;
  });
  document.getElementById("reportCategory").innerHTML=cats||'<div class="report-empty">Sem dados.</div>';

  // Mês usado para a situação da programação dos auditores.
  const monthInput=document.getElementById("reportMonth");
  const ym=monthInput?.value || new Date().toISOString().slice(0,7);
  if(monthInput && !monthInput.value) monthInput.value=ym;

  // 1) Média das notas por colaborador.
  // A auditoria recebe A=100, P=50 e N=0; a média do colaborador
  // é a média das notas das auditorias realizadas por ele.
  const collNames=new Set((state.collaborators||[]).map(c=>String(c.name||"").trim()).filter(Boolean));
  state.records.forEach(r=>{if(String(r.colaborador||"").trim())collNames.add(String(r.colaborador).trim());});
  const collRows=[...collNames].map(name=>{
    const recs=state.records.filter(r=>String(r.colaborador||"").trim().toLowerCase()===name.toLowerCase());
    const scores=recs.map(r=>calcAuditScorePercent(r)).filter((_,i)=>Object.keys(recs[i].answers||{}).length>0);
    const avg=scores.length?scores.reduce((s,v)=>s+v,0)/scores.length:0;
    return {name,auditorias:scores.length,media:Math.round(avg*10)/10};
  }).sort((a,b)=>b.media-a.media || a.name.localeCompare(b.name,"pt-BR"));

  document.getElementById("reportCollaboratorScores").innerHTML=collRows.length
    ? `<div class="report-table-wrap"><table class="report-table"><thead><tr><th>Colaborador</th><th class="num">Auditorias</th><th class="num">M\u00e9dia</th></tr></thead><tbody>${collRows.map(v=>`<tr><td>${esc(v.name)}</td><td class="num">${v.auditorias}</td><td class="percent">${v.auditorias?v.media.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1}):"\u2014"}${v.auditorias?"%":""}</td></tr>`).join("")}</tbody></table></div><div class="report-note">A m\u00e9dia considera as notas das auditorias realizadas: A = 100%, P = 50% e N = 0%.</div>`
    : '<div class="report-empty">Nenhum colaborador cadastrado.</div>';

  // 2) Situação por auditor.
  // Prioriza a programação do mês. Cada programação sem auditoria concluída
  // fica PENDENTE ou ATRASADA conforme a data limite; quando concluída,
  // usa a situação gravada na auditoria.
  const auditorNames=(state.auditors||[]).map(a=>String(a.name||"").trim()).filter(Boolean);
  const uniqueAuditors=[...new Set(auditorNames)];
  const schedules=[];
  const keys=[ym+"|all",ym+"|FUNDI\u00c7\u00c3O",ym+"|USINAGEM"];
  keys.forEach(k=>{
    const s=state.schedule?.[k];
    if(s?.assignments?.length)s.assignments.forEach(a=>schedules.push({...a,ym}));
  });
  const dedup=new Map();
  schedules.forEach(a=>{
    const key=[a.planta,a.weekIdx,a.auditor,a.colaborador].join("|");
    dedup.set(key,a);
  });
  const assignments=[...dedup.values()];
  const today=new Date();
  today.setHours(23,59,59,999);

  function findCompletedForAssignment(a){
    return state.records.find(r=>{
      const sameName=String(r.colaborador||"").trim().toLowerCase()===String(a.colaborador||"").trim().toLowerCase();
      const sameAud=String(r.auditor||"").trim().toLowerCase()===String(a.auditor||"").trim().toLowerCase();
      const samePlant=normalizePlantName(r.planta||r.questionSet)===normalizePlantName(a.planta);
      const sameMonth=String(r.data||"").slice(0,7)===ym;
      return sameName&&sameAud&&samePlant&&sameMonth;
    });
  }

  const statusByAud={};
  uniqueAuditors.forEach(a=>statusByAud[a]={pendente:0,atrasada:0,noPrazo:0});
  assignments.forEach(a=>{
    if(!statusByAud[a.auditor])statusByAud[a.auditor]={pendente:0,atrasada:0,noPrazo:0};
    const rec=findCompletedForAssignment(a);
    if(rec){
      const s=String(rec.situacao||"").trim().toUpperCase();
      if(s==="ATRASADA")statusByAud[a.auditor].atrasada++;
      else if(s==="NO PRAZO")statusByAud[a.auditor].noPrazo++;
      else {
        const due=new Date((a.weekIdx!=null && a.weekIdx>=0 && a.weekIdx<999 ? (state.schedule?.[ym+"|all"]?.weeks?.[a.weekIdx]?.end || "") : "")+"T23:59:59");
        if(!isNaN(due)&&due<today)statusByAud[a.auditor].atrasada++; else statusByAud[a.auditor].noPrazo++;
      }
    }else{
      let dueStr="";
      const candidateSchedules=keys.map(k=>state.schedule?.[k]).filter(Boolean);
      const schedWithWeek=candidateSchedules.find(s=>s.assignments?.some(x=>x===a));
      dueStr=schedWithWeek?.weeks?.[a.weekIdx]?.end||"";
      const due=new Date(dueStr+"T23:59:59");
      if(dueStr && due<today)statusByAud[a.auditor].atrasada++;
      else statusByAud[a.auditor].pendente++;
    }
  });

  // Se ainda não houver programação para o mês, mostra os registros realizados
  // daquele mês, sem inventar pendências.
  if(!assignments.length){
    state.records.forEach(r=>{
      if(String(r.data||"").slice(0,7)!==ym)return;
      const a=String(r.auditor||"").trim();
      if(!a)return;
      if(!statusByAud[a])statusByAud[a]={pendente:0,atrasada:0,noPrazo:0};
      const s=String(r.situacao||"").trim().toUpperCase();
      if(s==="ATRASADA")statusByAud[a].atrasada++;
      else statusByAud[a].noPrazo++;
    });
  }

  const audRows=uniqueAuditors.map(name=>({name,...(statusByAud[name]||{pendente:0,atrasada:0,noPrazo:0})}))
    .sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"));

  document.getElementById("reportAuditorStatus").innerHTML=audRows.length
    ? `<div class="report-table-wrap"><table class="report-table"><thead><tr><th>Auditor</th><th class="num">Pendentes</th><th class="num">Atrasadas</th><th class="num">No prazo</th><th class="num">Total</th></tr></thead><tbody>${audRows.map(v=>`<tr><td>${esc(v.name)}</td><td class="num"><span class="report-status-badge report-status-pending">${v.pendente}</span></td><td class="num"><span class="report-status-badge report-status-late">${v.atrasada}</span></td><td class="num"><span class="report-status-badge report-status-ok">${v.noPrazo}</span></td><td class="num"><b>${v.pendente+v.atrasada+v.noPrazo}</b></td></tr>`).join("")}</tbody></table></div><div class="report-note">A situa\u00e7\u00e3o considera a programa\u00e7\u00e3o do m\u00eas ${ym.split("-").reverse().join("/")} quando ela estiver dispon\u00edvel.</div>`
    : '<div class="report-empty">Nenhum auditor cadastrado.</div>';
}
function generateReportsPDF(){
  renderReports();
  const month=document.getElementById("reportMonth")?.value||new Date().toISOString().slice(0,7);
  const monthLabel=month.split("-").reverse().join("/");
  const sector=document.getElementById("reportSector")?.innerHTML||'<div>Sem dados.</div>';
  const category=document.getElementById("reportCategory")?.innerHTML||'<div>Sem dados.</div>';
  const coll=document.getElementById("reportCollaboratorScores")?.innerHTML||'<div>Sem dados.</div>';
  const aud=document.getElementById("reportAuditorStatus")?.innerHTML||'<div>Sem dados.</div>';
  const w=window.open("","_blank","width=1400,height=1000");
  if(!w){alert("Permita pop-ups para gerar o PDF dos Relat\u00f3rios.");return;}
  w.document.open();
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relat\u00f3rios \u2014 Auditorias Escalonadas</title><style>
@page{size:A4 landscape;margin:0}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#17333a;margin:0;font-size:10px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{position:relative;width:297mm;height:209mm;max-height:209mm;padding:7mm;page-break-after:always;break-after:page;overflow:hidden}.page:last-child{page-break-after:auto}.head{display:flex;justify-content:space-between;align-items:end;border-bottom:2px solid #087b61;padding-bottom:3mm;margin-bottom:4mm}.brand{font-size:18px;font-weight:900}.sub{font-size:9px;color:#68787b;margin-top:1mm}.period{font-size:10px;font-weight:700}.grid{display:grid;grid-template-columns:1fr 1fr;gap:5mm}.card{border:1px solid #cfdad8;border-radius:5px;overflow:hidden;break-inside:avoid}.card h2{font-size:12px;margin:0;padding:3mm;background:#eef3f2;border-bottom:2px solid #087b61}.card-body{padding:3mm}.report-table-wrap{overflow:visible}.report-table{width:100%;border-collapse:collapse;font-size:9px}.report-table th,.report-table td{padding:2.4mm 2mm;border:1px solid #cfdad8;text-align:left;white-space:nowrap}.report-table th{background:#e7efed;color:#315b58;text-transform:uppercase;font-size:8px}.report-table td.num,.report-table th.num{text-align:center}.report-table td.percent{font-weight:800;text-align:right}.report-status-badge{display:inline-block;min-width:26px;padding:1.5mm 2mm;border-radius:999px;text-align:center;font-weight:800;font-size:8px}.report-status-ok{background:#e5f4ea;color:#16803c}.report-status-late{background:#fde8e8;color:#c53030}.report-status-pending{background:#fff3d9;color:#9a6700}.report-note{font-size:8px;color:#68787b;margin-top:2mm}.progress-row{display:grid;grid-template-columns:50mm 1fr 14mm;align-items:center;gap:3mm;margin:3mm 0;font-size:9px}.progress-track{height:6mm;background:#e4ebea;border-radius:4px;overflow:hidden}.progress-fill{height:100%;background:#087b61;border-radius:4px}.footer{font-size:7px;color:#708198;text-align:right;margin-top:3mm}@media print{.page{width:297mm;height:209mm;max-height:209mm;padding:7mm;overflow:hidden}}
</style></head><body>
<div class="page"><div class="head"><div><div class="brand">AUDITORIAS ESCALONADAS \u2014 RELAT\u00d3RIOS</div><div class="sub">Consolida\u00e7\u00e3o gerencial</div></div><div class="period">M\u00eas da programa\u00e7\u00e3o: ${esc(monthLabel)}</div></div><div class="grid"><div class="card"><h2>Conformidade por Setor</h2><div class="card-body">${sector}</div></div><div class="card"><h2>Resultado por Categoria</h2><div class="card-body">${category}</div></div></div><div class="footer">P\u00e1gina 1</div></div>
<div class="page"><div class="head"><div><div class="brand">AUDITORIAS ESCALONADAS \u2014 RELAT\u00d3RIOS</div><div class="sub">Acompanhamento de colaboradores e auditores</div></div><div class="period">M\u00eas: ${esc(monthLabel)}</div></div><div class="grid"><div class="card"><h2>M\u00e9dia das Notas por Colaborador</h2><div class="card-body">${coll}</div></div><div class="card"><h2>Situa\u00e7\u00e3o das Auditorias por Auditor</h2><div class="card-body">${aud}</div></div></div><div class="footer">P\u00e1gina 2</div></div>
<script>window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print();},700);});<\/script></body></html>`);
  w.document.close();
}
function generateAuditorPDF(){
 const sel=document.getElementById("histAuditor");
 const colSel=document.getElementById("histColaborador");
 const auditor="all";
 const colaborador=colSel?.value||"all";
 const dataIni=document.getElementById("histDataIni")?.value||"";
 const dataFim=document.getElementById("histDataFim")?.value||"";
 // PDF consolidado para TODOS os auditores. Os filtros de colaborador e período continuam valendo.
 const records=state.records.filter(r=>{
   const rd=String(r.data||"").slice(0,10);
   return (colaborador==="all" || normalizeFilterValue(r.colaborador)===normalizeFilterValue(colaborador)) &&
          (!dataIni || rd>=dataIni) && (!dataFim || rd<=dataFim);
 });
 if(!records.length){alert(colaborador==="all"?"N\u00e3o h\u00e1 auditorias no per\u00edodo selecionado.":`N\u00e3o h\u00e1 auditorias para o colaborador "${colaborador}" no per\u00edodo selecionado.`);return;}
 records.sort((a,b)=>String(b.data||"").localeCompare(String(a.data||"")));

 const esc=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
 const val=v=>v===undefined||v===null||v===""?"-":esc(v);
 const count=(arr,p)=>arr.filter(p).length;
 function pdfResponses(r){
   if(Array.isArray(r.respostas)) return r.respostas;
   const answers=r.answers&&typeof r.answers==="object"?r.answers:{};
   return Object.entries(answers).map(([code,resposta])=>{
     const q=getQuestionsForRecord(r).find(x=>x.code===code)||{};
     return {pergunta:q.text||code,resposta,justificativa:r.justificativas?.[code]||"",acao:r.acoesTomadas?.[code]||""};
   });
 }
 const conform=records.reduce((n,r)=>n+pdfResponses(r).filter(x=>{
   const v=String(x.resposta||x.status||"").toUpperCase();
   return v==="A" || v.includes("CONFORME");
 }).length,0);
 const totalQ=records.reduce((n,r)=>n+pdfResponses(r).length,0);
 const pend=count(records,r=>pdfResponses(r).some(x=>{
   const v=String(x.resposta||x.status||"").toUpperCase();
   return (v==="N"||v==="P") && (!String(x.justificativa||x.justification||"").trim() || !String(x.acao||x.a\u00e7\u00e3o||x.action||"").trim());
 }));
 const resolved=count(records,r=>pdfResponses(r).some(x=>{
   const v=String(x.resposta||x.status||"").toUpperCase();
   return (v==="N"||v==="P") && String(x.acao||x.a\u00e7\u00e3o||x.action||"").trim();
 }));
 const pct=totalQ?((conform/totalQ)*100).toFixed(1):"0.0";

 let rows="";
 records.forEach((r,i)=>{
   const respostas=pdfResponses(r);
   let details="";
   respostas.forEach((q,j)=>{
     details+=`<tr><td>${j+1}</td><td>${val(q.pergunta||q.question||q.item)}</td><td>${val(q.resposta||q.status)}</td><td>${val(q.justificativa||q.justification)}</td><td>${val(q.acao||q.a\u00e7\u00e3o||q.action)}</td></tr>`;
   });
   rows+=`<div class="audit-block">
    <table class="meta"><tr>
      <th>Data</th><td>${val(r.data)}</td><th>Planta</th><td>${val(r.planta||'-')}</td>
      <th>Local</th><td>${val(r.local)}</td><th>Setor</th><td>${val(r.setor)}</td>
    </tr><tr>
      <th>Colaborador</th><td>${val(r.colaborador)}</td><th>Auditor</th><td>${val(r.auditor||auditor)}</td><th>Situa\u00e7\u00e3o</th><td>${val(r.situacao||'-')}</td><th></th><td></td>
    </tr></table>
    ${details?`<table><thead><tr><th style="width:4%">#</th><th style="width:31%">Pergunta</th><th style="width:12%">Resposta</th><th style="width:27%">Justificativa</th><th style="width:26%">A\u00e7\u00e3o</th></tr></thead><tbody>${details}</tbody></table>`:""}
   </div>`;
 });
 const importPayload={version:2,auditor:"all",records:records.map(r=>({id:r.id,local:r.local||'',setor:r.setor||'',planta:r.planta||inferPlant(r),questionSet:r.questionSet||inferPlant(r),colaborador:r.colaborador||'',auditor:r.auditor||auditor,situacao:r.situacao||'',data:r.data||'',answers:r.answers||{},justificativas:r.justificativas||{},acoesTomadas:r.acoesTomadas||{}}))};
 const importB64=btoa(unescape(encodeURIComponent(JSON.stringify(importPayload))));
 const importMarker=`<div class="import-marker">AUDITORIA_IMPORT_V6|${importB64.match(/.{1,160}/g)?.join(" ")||importB64}</div>`;
 const w=window.open("","_blank");
 if(!w){alert("Permita pop-ups para gerar o PDF.");return;}
 w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Relat\u00f3rio Consolidado de Auditorias \u2014 Todos os Auditores</title>
 <style>
 @page{size:A4 portrait;margin:8mm 7mm}
 *{box-sizing:border-box}
 body{font-family:Arial,sans-serif;color:#111;font-size:8.5px;margin:0}
 h1{font-size:15px;margin:0 0 2px}
 .sub{font-size:8px;margin-bottom:4px}
 .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:3px;margin:3px 0 5px}
 .stat{border:1px solid #bbb;padding:3px;text-align:center}
 .stat b{display:block;font-size:11px}
 table{width:100%;border-collapse:collapse;table-layout:fixed;margin:2px 0 4px}
 th,td{border:1px solid #aaa;padding:2px 3px;vertical-align:top;line-height:1.12;word-break:break-word}
 th{background:#eee;font-weight:700}
 .meta th{width:8%}.meta td{width:17%}
 .audit-block{page-break-inside:avoid;margin:4px 0 6px}
 .audit-block table:last-child{page-break-inside:auto}
 .footer{font-size:7px;color:#666;margin-top:4px}
 .import-marker{font-size:3px;line-height:1.05px;color:#fff;opacity:1;word-break:break-all;overflow-wrap:anywhere;width:100%;margin:2px 0 0;padding:0;letter-spacing:0}
 @media print{.no-print{display:none}}
 
/* ===== TEMA CLARO / ESCURO ===== */
html[data-theme="dark"] body,
body[data-theme="dark"]{
  background:#111827!important;
  color:#f3f4f6!important;
}
html[data-theme="dark"] .content,
html[data-theme="dark"] main,
html[data-theme="dark"] .page,
html[data-theme="dark"] .card,
html[data-theme="dark"] .tablewrap,
html[data-theme="dark"] .toolbar,
html[data-theme="dark"] .dashboard-toolbar,
html[data-theme="dark"] .question,
html[data-theme="dark"] .panel,
html[data-theme="dark"] .box,
html[data-theme="dark"] .modal-content{
  background-color:#1f2937!important;
  color:#f3f4f6!important;
  border-color:#374151!important;
}
html[data-theme="dark"] input,
html[data-theme="dark"] select,
html[data-theme="dark"] textarea{
  background:#111827!important;
  color:#f3f4f6!important;
  border-color:#4b5563!important;
}
html[data-theme="dark"] td{color:#e5e7eb!important;border-color:#374151!important}
html[data-theme="dark"] th{background:#263244!important;color:#fff!important;border-color:#374151!important}
html[data-theme="dark"] .sub,
html[data-theme="dark"] small,
html[data-theme="dark"] .muted,
html[data-theme="dark"] .label{
  color:#aab4c3!important;
}
html[data-theme="dark"] .notice{
  background:#172554!important;color:#dbeafe!important;border-color:#1e40af!important;
}
html[data-theme="dark"] .secondary{
  background:#1f2937!important;color:#bfdbfe!important;border-color:#60a5fa!important;
}
html[data-theme="dark"] .danger{
  background:#1f2937!important;color:#fecaca!important;border-color:#b91c1c!important;
}
html[data-theme="dark"] .side-nav,
html[data-theme="dark"] aside{
  background:#0b1220!important;
}
html[data-theme="dark"] .side-nav button{color:#cbd5e1!important}
html[data-theme="dark"] .side-nav button.active{background:#1e293b!important}

.theme-toggle{
  display:inline-flex!important;
  align-items:center!important;
  justify-content:center!important;
  gap:7px!important;
  border:1px solid rgba(255,255,255,.35)!important;
  background:rgba(255,255,255,.12)!important;
  color:#fff!important;
  border-radius:9px!important;
  padding:9px 12px!important;
  font-weight:800!important;
  cursor:pointer!important;
  white-space:nowrap!important;
  z-index:99999!important;
}
@media(max-width:700px){
  .theme-toggle span{display:none!important}
  .theme-toggle{padding:9px 10px!important}
}

/* Filtro de planta */
.dashboard-filters{
  display:flex;
  align-items:end;
  gap:10px;
  flex-wrap:wrap;
  margin:0 0 14px;
}
.dashboard-filter-group{
  display:flex;
  flex-direction:column;
  gap:5px;
  min-width:190px;
}
.dashboard-filter-group label{
  font-size:12px;
  font-weight:800;
}
.dashboard-filter-group select{
  min-height:38px;
  padding:8px 10px;
  border:1px solid #d9dee7;
  border-radius:8px;
  background:#fff;
}
html[data-theme="dark"] .dashboard-filter-group select{
  background:#111827!important;
  color:#f3f4f6!important;
  border-color:#4b5563!important;
}


/* ===== ABAS DE PLANTA ===== */
.plant-tabs{display:flex;gap:8px;margin:0 0 12px;flex-wrap:wrap}
.plant-tab{border:1px solid #475569;background:#1f2937;color:#cbd5e1;border-radius:10px;padding:10px 22px;font-weight:800;cursor:pointer;transition:.15s}
.plant-tab:hover{border-color:#f97316;color:#fff}
.plant-tab.active{background:#f97316;border-color:#f97316;color:#fff;box-shadow:0 4px 12px rgba(249,115,22,.22)}
.plant-tab .tab-count{font-size:11px;opacity:.82;margin-left:6px;font-weight:700}
html:not([data-theme="dark"]) .plant-tab{background:#fff;color:#334155;border-color:#cbd5e1}
html:not([data-theme="dark"]) .plant-tab.active{background:#f97316;color:#fff;border-color:#f97316}

.schedule-plant-block{margin-bottom:22px;border:1px solid rgba(255,255,255,.10);border-radius:12px;overflow:hidden;background:rgba(255,255,255,.02)}
.schedule-plant-title{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;font-weight:800;letter-spacing:.3px;background:rgba(255,255,255,.05)}
.schedule-plant-title small{font-weight:600;opacity:.75}
.schedule-plant-block table{margin:0}

/* Ajuda organizada por abas */
.help-intro{background:var(--card,#fff);border:1px solid var(--border,#d7dee8);border-radius:14px;padding:26px;text-align:center;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,.04)}.help-intro-icon{width:54px;height:54px;margin:0 auto 10px;border-radius:14px;display:grid;place-items:center;background:#ff7900;color:#fff;font-size:25px;font-weight:800}.help-intro h2{margin:0 0 6px}.help-intro p{margin:0;color:var(--muted,#66778a);line-height:1.5}.help-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:0 0 16px;padding:10px;background:var(--card,#fff);border:1px solid var(--border,#d7dee8);border-radius:12px}.help-tab{min-height:44px;border:1px solid var(--border,#cfd8e3);background:transparent;color:var(--text,#17324d);padding:10px 12px;border-radius:9px;font-weight:750;cursor:pointer;transition:.15s;text-align:left}.help-tab:hover{border-color:#ff7900;transform:translateY(-1px)}.help-tab.active{background:#ff7900;color:#fff;border-color:#ff7900;box-shadow:0 2px 5px rgba(255,121,0,.2)}.help-panel{display:none}.help-panel.active{display:block}.help-title{display:flex;gap:14px;align-items:flex-start;background:var(--card,#fff);border:1px solid var(--border,#d7dee8);border-radius:12px;padding:18px;margin-bottom:14px}.help-title>span{display:grid;place-items:center;width:42px;height:42px;border-radius:10px;background:#ff7900;color:#fff;font-size:20px;flex:0 0 auto}.help-title h2{margin:0 0 4px}.help-title p{margin:0;color:var(--muted,#66778a)}.help-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.help-detail{background:var(--card,#fff);border:1px solid var(--border,#d7dee8);border-radius:10px;padding:16px}.help-detail h3{margin:0 0 8px;color:#ff7900}.help-detail p{margin:0;line-height:1.55}.help-steps{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.help-steps>div{background:var(--card,#fff);border:1px solid var(--border,#d7dee8);border-radius:10px;padding:16px}.help-steps b{font-size:16px}.help-steps p{margin:8px 0 0;line-height:1.55}@media(max-width:900px){.help-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}.help-detail-grid,.help-steps{grid-template-columns:1fr}}@media(max-width:520px){.help-tabs{grid-template-columns:1fr}.help-tab{text-align:center;font-size:12px}}
</style></head><body>
 <h1>Relat\u00f3rio Consolidado de Auditorias \u2014 Todos os Auditores</h1>
 <div class="sub">Hist\u00f3rico de auditorias \u2022 ${records.length} auditoria(s) \u2022 Colaborador: <b>${colaborador==="all"?"Todos os colaboradores":esc(colaborador)}</b> \u2022 Per\u00edodo: <b>${dataIni?esc(dataIni.split("-").reverse().join("/")):"Todos"}</b> a <b>${dataFim?esc(dataFim.split("-").reverse().join("/")):"Todos"}</b></div>
 <div class="stats">
  <div class="stat"><b>${records.length}</b>Auditorias</div>
  <div class="stat"><b>${totalQ}</b>Itens</div>
  <div class="stat"><b>${pct}%</b>Conformidade</div>
  <div class="stat"><b>${pend}/${resolved}</b>Pend./Resol.</div>
 </div>
 ${rows}
 ${importMarker}
 <div class="footer">Gerado pelo sistema de auditorias.</div>
 <script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script>
 </body></html>`);
 w.document.close();
}
