/* ============================================================
   Nova Auditoria (formulário)
   ============================================================ */
function populateAuditPlants(){
 const sel=document.getElementById("fPlanta"); if(!sel)return;
 const current=normalizePlantName(sel.value)||"USINAGEM";
 sel.innerHTML='<option value="USINAGEM">USINAGEM</option><option value="FUNDI\u00c7\u00c3O">FUNDI\u00c7\u00c3O</option>';
 sel.value=current;
}
function populateAuditLocals(plant,keepLocal=""){
 const loc=document.getElementById("fLocal"); if(!loc)return;
 const p=normalizePlantName(plant)||"USINAGEM";
 const list=(state.sectors||[]).filter(s=>normalizePlantName(s.planta)===p).sort((a,b)=>String(a.local).localeCompare(String(b.local),"pt-BR"));
 loc.innerHTML='<option value="">Selecione...</option>';
 list.forEach(s=>{const o=document.createElement("option");o.value=s.local;o.textContent=`${s.local} \u2014 ${s.setor}`;loc.appendChild(o);});
 if(keepLocal && list.some(s=>s.local===keepLocal)) loc.value=keepLocal;
 updateAuditLocalFields();
}
function updateAuditLocalFields(){
 const loc=document.getElementById("fLocal"); const s=(state.sectors||[]).find(x=>x.local===loc?.value)||{};
 const plant=normalizePlantName(s.planta)||normalizePlantName(document.getElementById("fPlanta")?.value)||"USINAGEM";
 if(document.getElementById("fSetor"))document.getElementById("fSetor").value=s.setor||"";
 if(document.getElementById("fPlanta"))document.getElementById("fPlanta").value=plant;
}
function changeAuditPlant(){
 const plant=normalizePlantName(document.getElementById("fPlanta")?.value)||"USINAGEM";
 setActiveQuestionSet(plant);
 Object.keys(formAnswers).forEach(k=>delete formAnswers[k]);
 populateAuditLocals(plant);
 refreshPeopleOptions(plant);
 renderQuestions(plant);
 updateSummary();
}
function init(){
 activeScheduleDueDate="";
 populateAuditPlants();
 applyTheme();
 const loc=document.getElementById("fLocal");
 document.getElementById("fPlanta").value="USINAGEM";
 populateAuditLocals("USINAGEM");
 loc.onchange=updateAuditLocalFields;
 document.getElementById("fData").value=new Date().toISOString().slice(0,10);
 refreshPeopleOptions("USINAGEM");
 setActiveQuestionSet("USINAGEM");
 renderQuestions("USINAGEM"); fillDashFilters(); renderDashboard(); renderHistorico(); renderPendencias(); renderSectors();
}
function renderQuestions(plant){
 const p=normalizePlantName(plant||document.getElementById("fPlanta")?.value)||"USINAGEM";
 setActiveQuestionSet(p);
 const qs=getQuestionsForPlant(p);
 const wrap=document.getElementById("questionsForm"); wrap.innerHTML="";
 let by={}; qs.forEach(q=>(by[q.category]??=[]).push(q));
 Object.entries(by).forEach(([cat,items])=>{
   const box=document.createElement("div"); box.className="card"; box.style.marginBottom="16px";
   box.innerHTML=`<h2>${esc(cat)}</h2>`;
   items.forEach(q=>{
     box.insertAdjacentHTML("beforeend",`<div class="question" data-q="${q.code}">
       <div class="qcat">${esc(q.code)}</div><div class="qtext">${esc(q.text)}</div>
       <div class="choices">
         <button onclick="choose('${q.code}','A',this)">A \u2014 Conforme</button>
         <button onclick="choose('${q.code}','P',this)">P \u2014 Parcial</button>
         <button onclick="choose('${q.code}','N',this)">N \u2014 N\u00e3o conforme</button>
         <button onclick="choose('${q.code}','NA',this)">N.A \u2014 N\u00e3o aplic\u00e1vel</button>
       </div>
       <div class="just" id="just-${q.code}"><label style="font-size:12px;font-weight:800">Justificativa obrigat\u00f3ria</label><textarea id="txt-${q.code}" placeholder="Descreva o motivo..."></textarea></div>
     </div>`);
   });
   wrap.appendChild(box);
 });
}
 // Data limite da programação quando a auditoria é aberta pela aba Programação
function choose(code,val,btn){
 formAnswers[code]=val;
 btn.parentElement.querySelectorAll("button").forEach(b=>b.className="");
 btn.className="sel-"+val;
 const just=document.getElementById("just-"+code);
 const txt=document.getElementById("txt-"+code);
 const needsJust=val==="N"||val==="P";
 just.classList.toggle("show",needsJust);
 if(!needsJust && txt) txt.value="";
 updateSummary();
}
function updateSummary(){
 const total=getQuestionsForPlant(document.getElementById("fPlanta")?.value).length, answered=Object.keys(formAnswers).length, need=Object.entries(formAnswers).filter(([c,v])=>(v==="N"||v==="P") && !document.getElementById("txt-"+c).value.trim()).length;
 document.getElementById("formSummary").textContent=`${answered}/${total} respondidas${need?` \u2022 ${need} justificativa(s) pendente(s)`:answered===total?" \u2022 Pronta para salvar":""}`;
}
function saveAudit(){
 const local=document.getElementById("fLocal").value, auditor=document.getElementById("fAuditor").value.trim(), data=document.getElementById("fData").value, planta=normalizePlantName(document.getElementById("fPlanta")?.value)||"USINAGEM";
 const qs=getQuestionsForPlant(planta);
 if(!local||!auditor||!data){alert("Preencha Planta, Local, Auditor e Data.");return;}
 if(!auditorAllowedForPlant(auditor,planta)){
   alert(`O auditor "${auditor}" n\u00e3o est\u00e1 autorizado para a planta ${planta}.`);
   refreshPeopleOptions(planta);
   return;
 }
 if(Object.keys(formAnswers).length!==qs.length){alert("Responda todos os itens da auditoria.");return;}
 const missing=Object.entries(formAnswers).filter(([c,v])=>(v==="N"||v==="P")&&!document.getElementById("txt-"+c).value.trim());
 if(missing.length){alert("Toda resposta N ou P precisa de justificativa.");document.getElementById("txt-"+missing[0][0]).focus();return;}
 const s=state.sectors.find(x=>x.local===local)||{};
 const completionDate=String(data).slice(0,10);
 const dueDate=String(activeScheduleDueDate||"").slice(0,10);
 const situacao=dueDate && completionDate>dueDate ? "ATRASADA" : "NO PRAZO";
 const rec={id:"WEB-"+Date.now(),local,setor:s.setor||"",planta,questionSet:planta,colaborador:document.getElementById("fColaborador").value.trim(),auditor,data,situacao,programadaPara:dueDate||"",dataRealizacao:completionDate,answers:{},justificativas:{},acoesTomadas:{},notaPercentual:0};
 qs.forEach(q=>{rec.answers[q.code]=formAnswers[q.code]; const t=document.getElementById("txt-"+q.code).value.trim(); if(t)rec.justificativas[q.code]=t;});
 rec.notaPercentual=calcAuditScorePercent(rec);
 state.records.push(rec); saveState(); activeScheduleDueDate=""; alert(situacao==="ATRASADA" ? "Auditoria salva como ATRASADA. O dashboard ir\u00e1 contabiliz\u00e1-la como auditoria atrasada." : "Auditoria salva com sucesso."); location.reload();
}
function refreshLocalOptions(){const loc=document.getElementById("fLocal");if(!loc)return;const cur=loc.value;loc.innerHTML='<option value="">Selecione...</option>';[...state.sectors].sort((a,b)=>a.local.localeCompare(b.local)).forEach(x=>{const o=document.createElement("option");o.value=x.local;o.textContent=`${x.local} \u2014 ${x.setor}`;loc.appendChild(o)});if([...loc.options].some(o=>o.value===cur))loc.value=cur;}
