/* ============================================================
   Histórico de auditorias
   ============================================================ */
function renderHistorico(){
 populateHistoryAuditors();
 populateHistoryCollaborators();
 const q=normalizeFilterValue(document.getElementById("histSearch")?.value||"");
 const auditor=document.getElementById("histAuditor")?.value||"all";
 const colaborador=document.getElementById("histColaborador")?.value||"all";
 const dataIni=document.getElementById("histDataIni")?.value||"";
 const dataFim=document.getElementById("histDataFim")?.value||"";
 let rows=state.records.filter(r=>{
   const text=normalizeFilterValue(`${r.local||""} ${r.setor||""} ${r.auditor||""} ${r.colaborador||""}`);
   const rd=String(r.data||"").slice(0,10);
   return (!q||text.includes(q)) &&
          (auditor==="all" || normalizeFilterValue(r.auditor)===normalizeFilterValue(auditor)) &&
          (colaborador==="all" || normalizeFilterValue(r.colaborador)===normalizeFilterValue(colaborador)) &&
          (!dataIni || rd>=dataIni) && (!dataFim || rd<=dataFim);
 }).slice().sort((a,b)=>String(b.data||"").localeCompare(String(a.data||"")));
 document.getElementById("histTable").innerHTML=rows.length?`<table><thead><tr><th>Data</th><th>Local</th><th>Setor</th><th>Colaborador</th><th>Auditor</th><th>A</th><th>P</th><th>N</th><th>Nota %</th></tr></thead><tbody>${rows.map(r=>{let a=Object.values(r.answers||{});return `<tr><td>${fmtDate(r.data)}</td><td>${esc(r.local)}</td><td>${esc(r.setor)}</td><td>${esc(r.colaborador)}</td><td>${esc(r.auditor)}</td><td>${a.filter(x=>x==="A").length}</td><td>${a.filter(x=>x==="P").length}</td><td>${a.filter(x=>x==="N").length}</td><td><b>${auditScoreLabel(r)}</b></td></tr>`}).join("")}</tbody></table>`:`<div class="empty">Nenhum registro encontrado para os filtros selecionados.</div>`;
}
function populateHistoryAuditors(){
 const el=document.getElementById("histAuditor"); if(!el)return;
 const cur=el.value||"all";
 const vals=[...new Set([
   ...(state.auditors||[]).map(x=>String(x?.name||"").trim()),
   ...state.records.map(r=>String(r?.auditor||"").trim())
 ].filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
 el.innerHTML='<option value="all">Todos os auditores</option>'+vals.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");
 if(vals.includes(cur))el.value=cur; else el.value="all";
}
function populateHistoryCollaborators(){
 const el=document.getElementById("histColaborador"); if(!el)return;
 const cur=el.value||"all";
 const vals=[...new Set([
   ...(state.collaborators||[]).map(x=>String(x?.name||"").trim()),
   ...state.records.map(r=>String(r?.colaborador||"").trim())
 ].filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
 el.innerHTML='<option value="all">Todos os colaboradores</option>'+vals.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");
 if(vals.includes(cur))el.value=cur; else el.value="all";
}
function clearHistoryFilters(){
 const q=document.getElementById("histSearch"),a=document.getElementById("histAuditor"),c=document.getElementById("histColaborador"),di=document.getElementById("histDataIni"),df=document.getElementById("histDataFim");
 if(q)q.value=""; if(a)a.value="all"; if(c)c.value="all"; if(di)di.value=""; if(df)df.value=""; renderHistorico();
}
function clearHistory(){
 if(!state.records.length){alert("O hist\u00f3rico j\u00e1 est\u00e1 vazio.");return;}
 const first=confirm(`Voc\u00ea est\u00e1 prestes a apagar ${state.records.length} auditoria(s) do hist\u00f3rico deste navegador.\n\nOs cadastros de setores, colaboradores e auditores N\u00c3O ser\u00e3o apagados.\n\nDeseja continuar?`);
 if(!first)return;
 const second=confirm("CONFIRMA\u00c7\u00c3O FINAL\n\nApagar definitivamente todo o hist\u00f3rico de auditorias? Esta a\u00e7\u00e3o n\u00e3o pode ser desfeita pelo sistema.\n\nRecomenda\u00e7\u00e3o: fa\u00e7a um backup JSON antes de apagar.");
 if(!second)return;
 takeSnapshot("antes de apagar o hist\u00f3rico",true);
 state.records=[];
 saveState();
 alert("Hist\u00f3rico de auditorias apagado com sucesso. Os cadastros foram mantidos.");
 renderHistorico();
 updateSectorBadge();
 if(typeof renderDashboard === "function") renderDashboard();
}
