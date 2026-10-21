/* ============================================================
   Auditoria Gerencial: gestores e diretores auditam fábricas e setores
   - Cadastro de gestores/diretores (aba Cadastros)
   - Programação mensal (um setor por responsável, rodízio justo)
   - Nova auditoria gerencial, resultados e histórico
   ============================================================ */
const MGR_CARGOS=["Gestor","Diretor"];
let gTab="prog";
const gAnswers={};
const gNorm=s=>String(s||"").trim().toLowerCase();
function isoLocal(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function gCurYm(){return isoLocal(new Date()).slice(0,7);}
function gFmtDay(iso){return iso.slice(8,10)+"/"+iso.slice(5,7);}
function mgrQuestions(){return (window.MGR_SET&&Array.isArray(MGR_SET.questions))?MGR_SET.questions:[];}
function mgrNames(){return (state.managers||[]).map(m=>m.name).filter(Boolean);}
function mgrCargoOf(name){const m=(state.managers||[]).find(x=>gNorm(x.name)===gNorm(name));return m?m.cargo:"";}

/* Unidades auditadas = setores distintos de cada planta (a partir do cadastro de setores). */
function mgrUnits(){
  const seen=new Map();
  (state.sectors||[]).forEach(s=>{
    const p=normalizePlantName(s.planta), st=String(s.setor||"").trim();
    if(!p||!st) return;
    const k=p+"|"+st; if(!seen.has(k)) seen.set(k,{planta:p,setor:st});
  });
  return [...seen.values()].sort((a,b)=>a.planta.localeCompare(b.planta,"pt-BR")||a.setor.localeCompare(b.setor,"pt-BR"));
}
function mgrScore(answers){
  let s=0,n=0;
  Object.values(answers||{}).forEach(v=>{if(v==="A"){s+=100;n++;}else if(v==="P"){s+=50;n++;}else if(v==="N"){n++;}});
  return n?Math.round(s/n*10)/10:null; // N.A. não entra na conta
}
function mgrAudited(ym,planta,setor){
  return (state.mgrRecords||[]).find(r=>normalizePlantName(r.planta)===normalizePlantName(planta)
    && String(r.setor).trim()===String(setor).trim() && String(r.data||"").slice(0,7)===ym)||null;
}

/* ---------- CADASTRO DE GESTORES E DIRETORES ---------- */
function renderManagers(){
  const q=(document.getElementById("mgrSearch")?.value||"").toLowerCase();
  const rows=(state.managers||[]).filter(x=>`${x.name} ${x.cargo}`.toLowerCase().includes(q));
  const tb=document.getElementById("mgrTable"); if(!tb) return;
  document.getElementById("mgrCount").textContent=`${rows.length} cadastro(s)`;
  tb.innerHTML=rows.length?rows.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.cargo)}</td><td><button class="icon-btn" onclick="editManager('${encodeURIComponent(x.name)}')">\u270e</button><button class="icon-btn danger-icon" onclick="deleteManager('${encodeURIComponent(x.name)}')">\u00d7</button></td></tr>`).join(""):`<tr><td colspan="3" style="text-align:center;color:#64748b">Nenhum gestor ou diretor cadastrado. Clique em \u201cNovo\u201d.</td></tr>`;
}
function openManagerModal(existing){
  document.getElementById("mgrModal")?.remove();
  const x=existing||{name:"",cargo:"Gestor"};
  const m=document.createElement("div"); m.id="mgrModal"; m.className="modal-back";
  m.innerHTML=`<div class="modal"><div class="modal-head"><b>${existing?"Editar":"Novo"} gestor/diretor</b><button onclick="closeManagerModal()">\u00d7</button></div><div class="modal-body">
    <div class="field"><label>Nome *</label><input id="mgName" value="${esc(x.name)}" placeholder="Ex.: Maria Souza"></div>
    <div class="field" style="margin-top:12px"><label>Cargo *</label><select id="mgCargo">${MGR_CARGOS.map(c=>`<option ${c===x.cargo?"selected":""}>${c}</option>`).join("")}</select></div>
    </div><div class="modal-foot"><button class="secondary" onclick="closeManagerModal()">Cancelar</button><button class="primary" onclick="saveManager('${existing?encodeURIComponent(existing.name):""}')">Salvar</button></div></div>`;
  document.body.appendChild(m);
  setTimeout(()=>document.getElementById("mgName")?.focus(),50);
}
function closeManagerModal(){document.getElementById("mgrModal")?.remove();}
function saveManager(oldKey){
  const name=document.getElementById("mgName").value.trim(), cargo=document.getElementById("mgCargo").value;
  if(!name){alert("Informe o nome.");return;}
  const old=oldKey?decodeURIComponent(oldKey):"";
  if((state.managers||[]).some(x=>gNorm(x.name)===gNorm(name)&&gNorm(x.name)!==gNorm(old))){alert("J\u00e1 existe um cadastro com esse nome.");return;}
  state.managers=state.managers||[];
  if(old){
    const x=state.managers.find(a=>a.name===old);
    if(x){
      if(x.name!==name){ // mantém o histórico e a programação com o novo nome
        (state.mgrRecords||[]).forEach(r=>{if(r.auditor===old)r.auditor=name;});
        Object.values(state.mgrSchedule||{}).forEach(s=>(s.assignments||[]).forEach(a=>{if(a.auditor===old)a.auditor=name;}));
      }
      x.name=name; x.cargo=cargo;
    }
  }else state.managers.push({name,cargo});
  saveState(); closeManagerModal(); renderManagers(); refreshGerencialIfOpen();
}
function editManager(k){const x=(state.managers||[]).find(a=>a.name===decodeURIComponent(k));if(x)openManagerModal(x);}
function deleteManager(k){
  const name=decodeURIComponent(k);
  if(!confirm(`Excluir "${name}" do cadastro?\n\nAs auditorias j\u00e1 feitas por essa pessoa continuam no hist\u00f3rico.`))return;
  takeSnapshot("antes de excluir gestor/diretor",true);
  state.managers=(state.managers||[]).filter(x=>x.name!==name);
  saveState(); renderManagers(); refreshGerencialIfOpen();
}

/* ---------- PROGRAMAÇÃO MENSAL ---------- */
function mgrHistory(ym){
  const pair={}, load={}, seen=new Set();
  const add=(m,planta,setor,aud)=>{
    if(!m||m>=ym||!aud) return;
    const key=m+"|"+normalizePlantName(planta)+"|"+String(setor).trim()+"|"+gNorm(aud);
    if(seen.has(key)) return; seen.add(key);
    const d=monthDiff(m,ym), w=d===1?100:(d===2?10:1); // mês anterior pesa muito mais
    const k=normalizePlantName(planta)+"|"+String(setor).trim()+"|"+gNorm(aud);
    pair[k]=(pair[k]||0)+w;
    if(d<=3) load[gNorm(aud)]=(load[gNorm(aud)]||0)+1;
  };
  (state.mgrRecords||[]).forEach(r=>add(String(r.data||"").slice(0,7),r.planta,r.setor,r.auditor));
  Object.values(state.mgrSchedule||{}).forEach(s=>(s.assignments||[]).forEach(a=>add(s.ym,a.planta,a.setor,a.auditor)));
  return {cost:(u,a)=>pair[u.planta+"|"+u.setor+"|"+gNorm(a)]||0, load:a=>load[gNorm(a)]||0};
}
function mgrWeeks(ym){return monthWeeks(ym).map(w=>({start:isoLocal(w.start),end:isoLocal(w.end)}));}
function mgrBuildSchedule(ym){
  const mgrs=mgrNames(), units=shuffleArray(mgrUnits()), hist=mgrHistory(ym), weeks=mgrWeeks(ym);
  const N=units.length, A=mgrs.length, base=Math.floor(N/A), rem=N%A;
  // quem auditou menos nos últimos meses recebe a "sobra" quando a divisão não é exata
  const order=shuffleArray(mgrs).sort((x,y)=>hist.load(x)-hist.load(y));
  const left={}; order.forEach((a,i)=>{left[a]=base+(i<rem?1:0);});
  const asg=[];
  units.forEach(u=>{
    const opts=mgrs.filter(a=>left[a]>0);
    const min=Math.min(...opts.map(a=>hist.cost(u,a)));
    const a=pickRandom(opts.filter(x=>hist.cost(u,x)===min));
    asg.push({u,a}); left[a]--;
  });
  for(let it=0; it<3000 && asg.length>1; it++){ // trocas que reduzem repetição do mês anterior
    const i=Math.floor(Math.random()*asg.length), j=Math.floor(Math.random()*asg.length);
    if(i===j||asg[i].a===asg[j].a) continue;
    const cur=hist.cost(asg[i].u,asg[i].a)+hist.cost(asg[j].u,asg[j].a);
    const alt=hist.cost(asg[i].u,asg[j].a)+hist.cost(asg[j].u,asg[i].a);
    if(alt<cur){const t=asg[i].a; asg[i].a=asg[j].a; asg[j].a=t;}
  }
  const assignments=[];
  mgrs.forEach(a=>{ // distribui as visitas de cada responsável ao longo das semanas
    const mine=asg.filter(x=>x.a===a);
    mine.forEach((x,t)=>assignments.push({planta:x.u.planta,setor:x.u.setor,auditor:a,weekIdx:Math.min(weeks.length-1,Math.floor(t*weeks.length/mine.length))}));
  });
  return {ym,weeks,assignments,generatedAt:new Date().toISOString()};
}
function mgrSyncSchedule(sched){
  // Atualiza sem mexer nos demais: tira só o que saiu do cadastro e encaixa só o que entrou.
  const units=mgrUnits(), unitKeys=new Set(units.map(u=>u.planta+"|"+u.setor)), mgrs=mgrNames(), mset=new Set(mgrs.map(gNorm));
  const removed=[], added=[];
  sched.assignments=sched.assignments.filter(a=>{
    const ok=unitKeys.has(normalizePlantName(a.planta)+"|"+String(a.setor).trim()) && mset.has(gNorm(a.auditor));
    if(!ok) removed.push(a.setor+" ("+a.auditor+")");
    return ok;
  });
  if(!mgrs.length) return {added,removed};
  const hist=mgrHistory(sched.ym);
  const have=new Set(sched.assignments.map(a=>normalizePlantName(a.planta)+"|"+String(a.setor).trim()));
  shuffleArray(units.filter(u=>!have.has(u.planta+"|"+u.setor))).forEach(u=>{
    const loadOf=a=>sched.assignments.filter(x=>x.auditor===a).length;
    const minL=Math.min(...mgrs.map(loadOf)), lo=mgrs.filter(a=>loadOf(a)===minL);
    const minC=Math.min(...lo.map(a=>hist.cost(u,a)));
    const aud=pickRandom(lo.filter(a=>hist.cost(u,a)===minC));
    const cnt=sched.weeks.map((w,i)=>sched.assignments.filter(x=>x.auditor===aud&&x.weekIdx===i).length);
    const minW=Math.min(...cnt);
    const wk=pickRandom(cnt.map((c,i)=>c===minW?i:-1).filter(i=>i>=0));
    sched.assignments.push({planta:u.planta,setor:u.setor,auditor:aud,weekIdx:wk});
    added.push(u.setor+" ("+aud+")");
  });
  sched.updatedAt=new Date().toISOString();
  return {added,removed};
}
function onGerGenerate(){
  const ym=document.getElementById("gMonth").value;
  if(!ym){alert("Selecione o m\u00eas.");return;}
  if(!mgrNames().length){alert("Cadastre os gestores e diretores em Cadastros > Gestores/Diretores antes de gerar a programa\u00e7\u00e3o.");return;}
  if(!mgrUnits().length){alert("N\u00e3o h\u00e1 setores cadastrados.");return;}
  state.mgrSchedule=state.mgrSchedule||{};
  if(!state.mgrSchedule[ym]){
    state.mgrSchedule[ym]=mgrBuildSchedule(ym); saveState(); renderGerSchedule(); return;
  }
  const r=mgrSyncSchedule(state.mgrSchedule[ym]);
  if(!r.added.length&&!r.removed.length){alert("A programa\u00e7\u00e3o deste m\u00eas j\u00e1 foi gerada e n\u00e3o h\u00e1 mudan\u00e7as nos setores ou nos respons\u00e1veis. Nada foi alterado.");return;}
  saveState(); renderGerSchedule();
  let msg="Programa\u00e7\u00e3o atualizada. O restante foi mantido.";
  if(r.added.length) msg+="\n\nInclu\u00eddos: "+r.added.join(", ");
  if(r.removed.length) msg+="\n\nRemovidos: "+r.removed.join(", ");
  alert(msg);
}
function onGerRegenerate(){
  const ym=document.getElementById("gMonth").value;
  if(!ym){alert("Selecione o m\u00eas.");return;}
  if(!mgrNames().length){alert("Cadastre os gestores e diretores antes de gerar a programa\u00e7\u00e3o.");return;}
  if(!confirm("Refazer do zero a programa\u00e7\u00e3o gerencial de "+ym.split("-").reverse().join("/")+"?\n\nTodos os respons\u00e1veis ser\u00e3o sorteados novamente e os ajustes manuais ser\u00e3o perdidos. Auditorias j\u00e1 realizadas n\u00e3o s\u00e3o apagadas.")) return;
  takeSnapshot("antes de refazer a programa\u00e7\u00e3o gerencial",true);
  state.mgrSchedule=state.mgrSchedule||{};
  state.mgrSchedule[ym]=mgrBuildSchedule(ym); saveState(); renderGerSchedule();
}
function gItemStatus(sched,a,ym){
  if(mgrAudited(ym,a.planta,a.setor)) return {cls:"b-ok",label:"Auditada",k:"done"};
  const w=sched.weeks[a.weekIdx]; if(!w) return {cls:"b-p",label:"Pendente",k:"week"};
  const end=new Date(w.end+"T23:59:59"), start=new Date(w.start+"T00:00:00"), now=new Date();
  if(end<now) return {cls:"b-n",label:"Atrasada",k:"late"};
  return {cls:"b-p",label:"Pendente",k:start<=now?"week":"next"};
}
function renderGerSchedule(){
  const wrap=document.getElementById("gProgWrap"), sum=document.getElementById("gProgSummary");
  if(!wrap) return;
  const ym=document.getElementById("gMonth").value, plantaSel=document.getElementById("gPlanta").value;
  const sched=ym&&state.mgrSchedule?state.mgrSchedule[ym]:null;
  if(!mgrNames().length){sum.innerHTML="";wrap.innerHTML='<div class="empty">Cadastre os gestores e diretores em <b>Cadastros &gt; Gestores/Diretores</b> e depois gere a programa\u00e7\u00e3o.</div>';return;}
  if(!sched){sum.innerHTML="";wrap.innerHTML='<div class="empty">Nenhuma programa\u00e7\u00e3o gerencial para este m\u00eas. Clique em \u201cGerar / Atualizar programa\u00e7\u00e3o\u201d.</div>';return;}
  const show=a=>plantaSel==="all"||normalizePlantName(a.planta)===normalizePlantName(plantaSel);
  const items=sched.assignments.map((a,idx)=>({a,idx,st:gItemStatus(sched,a,ym)})).filter(x=>show(x.a));
  const c=k=>items.filter(x=>x.st.k===k).length;
  sum.innerHTML=`<div class="ger-note"><b>${c("done")}</b> de <b>${items.length}</b> setor(es) auditado(s) \u00b7 <b style="color:#991b1b">${c("late")}</b> atrasado(s) \u00b7 <b>${c("week")}</b> pendente(s) desta semana \u00b7 <b>${c("next")}</b> nas pr\u00f3ximas semanas</div>`;
  const auds=mgrNames().filter(n=>items.some(x=>x.a.auditor===n));
  if(!items.length){wrap.innerHTML='<div class="empty">Nenhum setor para este filtro.</div>';return;}
  let html='<table><thead><tr><th>Semana</th>'+auds.map(n=>`<th>${esc(n)}<br><small>${esc(mgrCargoOf(n))}</small></th>`).join("")+'</tr></thead><tbody>';
  sched.weeks.forEach((w,wi)=>{
    html+=`<tr><td><b>${gFmtDay(w.start)} \u2013 ${gFmtDay(w.end)}</b></td>`;
    auds.forEach(n=>{
      const cell=items.filter(x=>x.a.auditor===n&&x.a.weekIdx===wi).sort((p,q)=>p.a.setor.localeCompare(q.a.setor,"pt-BR"));
      html+="<td>"+(cell.length?cell.map(x=>`<div class="ger-item"><span class="badge ${x.st.cls}">${x.st.label}</span><a onclick="gStartAudit(${x.idx})" title="Iniciar auditoria deste setor">${esc(x.a.setor)}</a><small>${esc(x.a.planta)}</small><button type="button" class="mini-edit" onclick="gMoveOpen(${x.idx})" title="Reprogramar">\u270e</button>${x.a.manual?'<span title="Ajustado manualmente" style="font-size:10px">\u270b</span>':''}</div>`).join(""):"\u2014")+"</td>";
    });
    html+="</tr>";
  });
  wrap.innerHTML=html+"</tbody></table>";
}
function gMoveOpen(idx){
  const ym=document.getElementById("gMonth").value, sched=state.mgrSchedule?.[ym]; if(!sched) return;
  const a=sched.assignments[idx]; if(!a) return;
  document.getElementById("gMoveModal")?.remove();
  const mgrs=mgrNames(); if(!mgrs.includes(a.auditor)) mgrs.unshift(a.auditor);
  const m=document.createElement("div"); m.id="gMoveModal"; m.className="modal-back";
  m.innerHTML=`<div class="modal"><div class="modal-head"><b>Reprogramar auditoria</b><button onclick="document.getElementById('gMoveModal').remove()">\u00d7</button></div><div class="modal-body">
    <p><b>${esc(a.setor)}</b> \u00b7 ${esc(a.planta)}</p>
    <div class="field"><label>Respons\u00e1vel</label><select id="gMvAud">${mgrs.map(n=>`<option ${n===a.auditor?"selected":""}>${esc(n)}</option>`).join("")}</select></div>
    <div class="field" style="margin-top:12px"><label>Semana</label><select id="gMvWeek">${sched.weeks.map((w,i)=>`<option value="${i}" ${i===a.weekIdx?"selected":""}>Semana ${i+1}: ${gFmtDay(w.start)} \u2013 ${gFmtDay(w.end)}</option>`).join("")}</select></div>
    <div class="ger-note">S\u00f3 este setor \u00e9 alterado; o restante da programa\u00e7\u00e3o n\u00e3o muda.</div>
    </div><div class="modal-foot"><button class="secondary" onclick="document.getElementById('gMoveModal').remove()">Cancelar</button><button class="primary" onclick="gMoveSave(${idx})">Salvar</button></div></div>`;
  document.body.appendChild(m);
}
function gMoveSave(idx){
  const ym=document.getElementById("gMonth").value, sched=state.mgrSchedule?.[ym]; const a=sched&&sched.assignments[idx]; if(!a) return;
  const aud=document.getElementById("gMvAud").value, wk=Number(document.getElementById("gMvWeek").value);
  if(aud!==a.auditor||wk!==a.weekIdx){a.auditor=aud;a.weekIdx=wk;a.manual=true;sched.updatedAt=new Date().toISOString();saveState();}
  document.getElementById("gMoveModal")?.remove(); renderGerSchedule();
}
function gStartAudit(idx){
  const ym=document.getElementById("gMonth").value, a=state.mgrSchedule?.[ym]?.assignments[idx]; if(!a) return;
  showGerTab("nova");
  document.getElementById("gfPlanta").value=a.planta; gFillSectors();
  document.getElementById("gfSetor").value=a.setor;
  document.getElementById("gfAuditor").value=a.auditor;
}

/* ---------- NOVA AUDITORIA GERENCIAL ---------- */
function gFillSectors(){
  const p=normalizePlantName(document.getElementById("gfPlanta").value), sel=document.getElementById("gfSetor"), cur=sel.value;
  const list=mgrUnits().filter(u=>u.planta===p).map(u=>u.setor);
  sel.innerHTML='<option value="">Selecione...</option>'+list.map(s=>`<option>${esc(s)}</option>`).join("");
  if(list.includes(cur)) sel.value=cur;
}
function gFillForm(){
  const aud=document.getElementById("gfAuditor"), cur=aud.value;
  aud.innerHTML='<option value="">Selecione...</option>'+(state.managers||[]).map(m=>`<option value="${esc(m.name)}">${esc(m.name)} \u2014 ${esc(m.cargo)}</option>`).join("");
  if(mgrNames().includes(cur)) aud.value=cur;
  if(!document.getElementById("gfData").value) document.getElementById("gfData").value=isoLocal(new Date());
  gFillSectors();
}
function gRenderQuestions(){
  const wrap=document.getElementById("gQuestions"); if(!wrap) return;
  const qs=mgrQuestions(); wrap.innerHTML="";
  if(!qs.length){wrap.innerHTML='<div class="empty">Nenhuma pergunta cadastrada em data/perguntas-gerencial.json.</div>';return;}
  const by={}; qs.forEach(q=>(by[q.category]??=[]).push(q));
  Object.entries(by).forEach(([cat,items])=>{
    const box=document.createElement("div"); box.className="card"; box.style.marginBottom="16px";
    box.innerHTML=`<h2>${esc(cat)}</h2>`;
    items.forEach(q=>box.insertAdjacentHTML("beforeend",`<div class="question" data-q="${esc(q.code)}">
      <div class="qcat">${esc(q.code)}</div><div class="qtext">${esc(q.text)}</div>
      <div class="choices">
        <button onclick="gChoose('${q.code}','A',this)">A \u2014 Conforme</button>
        <button onclick="gChoose('${q.code}','P',this)">P \u2014 Parcial</button>
        <button onclick="gChoose('${q.code}','N',this)">N \u2014 N\u00e3o conforme</button>
        <button onclick="gChoose('${q.code}','NA',this)">N.A \u2014 N\u00e3o aplic\u00e1vel</button>
      </div>
      <div class="just" id="gjust-${q.code}"><label style="font-size:12px;font-weight:800">Justificativa obrigat\u00f3ria</label><textarea id="gtxt-${q.code}" oninput="gUpdateSummary()" placeholder="Descreva o motivo..."></textarea></div>
    </div>`));
    wrap.appendChild(box);
  });
  gUpdateSummary();
}
function gChoose(code,val,btn){
  gAnswers[code]=val;
  btn.parentElement.querySelectorAll("button").forEach(b=>b.className="");
  btn.className="sel-"+val;
  const need=val==="N"||val==="P", just=document.getElementById("gjust-"+code), txt=document.getElementById("gtxt-"+code);
  just.classList.toggle("show",need);
  if(!need&&txt) txt.value="";
  gUpdateSummary();
}
function gUpdateSummary(){
  const total=mgrQuestions().length, answered=Object.keys(gAnswers).length;
  const need=Object.entries(gAnswers).filter(([c,v])=>(v==="N"||v==="P")&&!(document.getElementById("gtxt-"+c)?.value||"").trim()).length;
  const el=document.getElementById("gSummary");
  if(el) el.textContent=`${answered}/${total} respondidas${need?` \u2022 ${need} justificativa(s) pendente(s)`:(answered===total&&total?" \u2022 Pronta para salvar":"")}`;
}
function gResetForm(){
  Object.keys(gAnswers).forEach(k=>delete gAnswers[k]);
  document.getElementById("gfSetor").value="";
  gRenderQuestions();
}
function gSave(){
  const planta=normalizePlantName(document.getElementById("gfPlanta").value), setor=document.getElementById("gfSetor").value,
        auditor=document.getElementById("gfAuditor").value, data=document.getElementById("gfData").value, qs=mgrQuestions();
  if(!planta||!setor||!auditor||!data){alert("Preencha Planta, Setor, Respons\u00e1vel e Data.");return;}
  if(!qs.length){alert("N\u00e3o h\u00e1 perguntas cadastradas.");return;}
  if(Object.keys(gAnswers).length!==qs.length){alert("Responda todos os itens da auditoria.");return;}
  const just={};
  for(const [c,v] of Object.entries(gAnswers)){
    if(v==="N"||v==="P"){
      const t=(document.getElementById("gtxt-"+c)?.value||"").trim();
      if(!t){alert("Informe a justificativa do item "+c+".");return;}
      just[c]=t;
    }
  }
  const rec={id:"GER-"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),tipo:"gerencial",planta,setor,auditor,cargo:mgrCargoOf(auditor),data,
             answers:{...gAnswers},justificativas:just,createdAt:new Date().toISOString()};
  rec.nota=mgrScore(rec.answers);
  state.mgrRecords=state.mgrRecords||[]; state.mgrRecords.push(rec);
  saveState();
  alert("Auditoria gerencial salva. Nota: "+(rec.nota==null?"\u2014":rec.nota.toLocaleString("pt-BR")+"%"));
  gResetForm(); showGerTab("prog");
}

/* ---------- RESULTADOS E HISTÓRICO ---------- */
function gBar(label,pct,extra){
  const v=pct==null?0:pct;
  return `<div class="progress-row"><b>${esc(label)}</b><div class="progress-track"><div class="progress-fill" style="width:${v}%"></div></div><b>${pct==null?"\u2014":String(pct).replace(".",",")+"%"}</b></div>${extra?`<div class="ger-note" style="margin:-4px 0 6px">${extra}</div>`:""}`;
}
function gAvg(list){const v=list.filter(x=>x!=null);return v.length?Math.round(v.reduce((a,b)=>a+b,0)/v.length*10)/10:null;}
function gFilteredRecords(){
  const m=document.getElementById("gResMonth")?.value||"", p=document.getElementById("gResPlanta")?.value||"all";
  return (state.mgrRecords||[]).filter(r=>(!m||String(r.data).slice(0,7)===m)&&(p==="all"||normalizePlantName(r.planta)===normalizePlantName(p)));
}
function renderGerResults(){
  const el=document.getElementById("gResults"); if(!el) return;
  const rec=gFilteredRecords().sort((a,b)=>String(b.data).localeCompare(String(a.data))||String(b.createdAt).localeCompare(String(a.createdAt)));
  if(!rec.length){el.innerHTML='<div class="empty">Nenhuma auditoria gerencial para este filtro.</div>';return;}
  const nota=gAvg(rec.map(r=>mgrScore(r.answers)));
  const sectors=new Set(rec.map(r=>r.planta+"|"+r.setor)).size;
  let h=`<div class="ger-kpis"><div class="ger-kpi"><span>Auditorias</span><b>${rec.length}</b></div><div class="ger-kpi"><span>Nota geral</span><b>${nota==null?"\u2014":String(nota).replace(".",",")+"%"}</b></div><div class="ger-kpi"><span>Setores auditados</span><b>${sectors}</b></div></div>`;
  const group=(keyFn)=>{const m=new Map();rec.forEach(r=>{const k=keyFn(r);(m.get(k)||m.set(k,[]).get(k)).push(r);});return [...m.entries()];};
  h+='<div class="excel-card" style="margin-bottom:14px"><div class="card-head"><span>Nota por f\u00e1brica</span></div><div class="card-body">'+
     group(r=>normalizePlantName(r.planta)).map(([k,l])=>gBar(k,gAvg(l.map(r=>mgrScore(r.answers))),l.length+" auditoria(s)")).join("")+'</div></div>';
  const bySetor=group(r=>r.planta+" \u00b7 "+r.setor).map(([k,l])=>[k,gAvg(l.map(r=>mgrScore(r.answers))),l.length]).sort((a,b)=>(a[1]??101)-(b[1]??101));
  h+='<div class="excel-card" style="margin-bottom:14px"><div class="card-head"><span>Nota por setor (menores primeiro)</span></div><div class="card-body">'+bySetor.map(([k,n,c])=>gBar(k,n,c+" auditoria(s)")).join("")+'</div></div>';
  const cat=new Map(); const qmap=new Map(mgrQuestions().map(q=>[q.code,q.category]));
  rec.forEach(r=>Object.entries(r.answers||{}).forEach(([c,v])=>{const ct=qmap.get(c)||"Outros";if(v==="NA")return;const o=cat.get(ct)||{s:0,n:0};o.s+=v==="A"?100:v==="P"?50:0;o.n++;cat.set(ct,o);}));
  h+='<div class="excel-card" style="margin-bottom:14px"><div class="card-head"><span>Nota por categoria</span></div><div class="card-body">'+[...cat.entries()].map(([k,o])=>gBar(k,o.n?Math.round(o.s/o.n*10)/10:null)).join("")+'</div></div>';
  h+='<div class="excel-card" style="margin-bottom:14px"><div class="card-head"><span>Por respons\u00e1vel</span></div><div class="card-body">'+
     group(r=>r.auditor).map(([k,l])=>gBar(k+(l[0].cargo?" ("+l[0].cargo+")":""),gAvg(l.map(r=>mgrScore(r.answers))),l.length+" auditoria(s)")).join("")+'</div></div>';
  if(!document.getElementById("gResMonth").value){
    const byM=group(r=>String(r.data).slice(0,7)).sort((a,b)=>a[0].localeCompare(b[0]));
    h+='<div class="excel-card" style="margin-bottom:14px"><div class="card-head"><span>Evolu\u00e7\u00e3o mensal</span></div><div class="card-body">'+byM.map(([k,l])=>gBar(k.split("-").reverse().join("/"),gAvg(l.map(r=>mgrScore(r.answers))),l.length+" auditoria(s)")).join("")+'</div></div>';
  }
  h+='<div class="excel-card"><div class="card-head"><span>Hist\u00f3rico</span><button class="secondary" type="button" onclick="gExportCsv()">\u2b07 Exportar CSV</button></div><div class="card-body tablewrap"><table><thead><tr><th>Data</th><th>Planta</th><th>Setor</th><th>Respons\u00e1vel</th><th>Nota</th><th>A\u00e7\u00f5es</th></tr></thead><tbody>'+
     rec.map(r=>{const n=mgrScore(r.answers);return `<tr><td>${esc(String(r.data).split("-").reverse().join("/"))}</td><td>${esc(r.planta)}</td><td>${esc(r.setor)}</td><td>${esc(r.auditor)}${r.cargo?"<br><small>"+esc(r.cargo)+"</small>":""}</td><td><b>${n==null?"\u2014":String(n).replace(".",",")+"%"}</b></td><td><button class="icon-btn" onclick="gView('${esc(r.id)}')" title="Ver respostas">\ud83d\udc41</button><button class="icon-btn danger-icon" onclick="gDelete('${esc(r.id)}')" title="Excluir">\u00d7</button></td></tr>`;}).join("")+'</tbody></table></div></div>';
  el.innerHTML=h;
}
function gView(id){
  const r=(state.mgrRecords||[]).find(x=>x.id===id); if(!r) return;
  document.getElementById("gViewModal")?.remove();
  const qmap=new Map(mgrQuestions().map(q=>[q.code,q]));
  const lab={A:"Conforme",P:"Parcial",N:"N\u00e3o conforme",NA:"N\u00e3o aplic\u00e1vel"};
  const n=mgrScore(r.answers);
  const rows=Object.entries(r.answers||{}).map(([c,v])=>`<tr><td><b>${esc(c)}</b></td><td>${esc(qmap.get(c)?.text||"(pergunta removida)")}</td><td>${esc(v)} \u2014 ${lab[v]||""}</td><td>${esc((r.justificativas||{})[c]||"")}</td></tr>`).join("");
  const m=document.createElement("div"); m.id="gViewModal"; m.className="modal-back";
  m.innerHTML=`<div class="modal" style="max-width:900px"><div class="modal-head"><b>${esc(r.setor)} \u00b7 ${esc(r.planta)} \u2014 ${n==null?"\u2014":String(n).replace(".",",")+"%"}</b><button onclick="document.getElementById('gViewModal').remove()">\u00d7</button></div><div class="modal-body"><p>${esc(String(r.data).split("-").reverse().join("/"))} \u00b7 ${esc(r.auditor)}${r.cargo?" ("+esc(r.cargo)+")":""}</p><div class="tablewrap"><table><thead><tr><th>Item</th><th>Pergunta</th><th>Resposta</th><th>Justificativa</th></tr></thead><tbody>${rows}</tbody></table></div></div><div class="modal-foot"><button class="secondary" onclick="document.getElementById('gViewModal').remove()">Fechar</button></div></div>`;
  document.body.appendChild(m);
}
function gDelete(id){
  const r=(state.mgrRecords||[]).find(x=>x.id===id); if(!r) return;
  if(!confirm(`Excluir a auditoria gerencial de "${r.setor}" (${String(r.data).split("-").reverse().join("/")})?`)) return;
  takeSnapshot("antes de excluir auditoria gerencial",true);
  state.mgrRecords=state.mgrRecords.filter(x=>x.id!==id); saveState(); renderGerResults(); renderGerSchedule();
}
function gExportCsv(){
  const rec=gFilteredRecords(), qs=mgrQuestions();
  const q=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
  const head=["Data","Planta","Setor","Respons\u00e1vel","Cargo","Nota %",...qs.map(x=>x.code),...qs.map(x=>"Just. "+x.code)];
  const lines=[head.map(q).join(";")];
  rec.forEach(r=>lines.push([String(r.data).split("-").reverse().join("/"),r.planta,r.setor,r.auditor,r.cargo||"",mgrScore(r.answers)==null?"":String(mgrScore(r.answers)).replace(".",","),...qs.map(x=>(r.answers||{})[x.code]||""),...qs.map(x=>(r.justificativas||{})[x.code]||"")].map(q).join(";")));
  const blob=new Blob(["\ufeff"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="auditoria_gerencial_"+isoLocal(new Date())+".csv";
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1500);
}

/* ---------- ABAS E INICIALIZAÇÃO ---------- */
function showGerTab(tab){
  gTab=tab;
  document.querySelectorAll(".ger-tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  document.querySelectorAll(".ger-panel").forEach(p=>p.classList.toggle("active",p.id==="ger-"+tab));
  if(tab==="prog") renderGerSchedule();
  if(tab==="nova"){gFillForm(); if(!document.getElementById("gQuestions").children.length) gRenderQuestions();}
  if(tab==="res") renderGerResults();
}
function initGerencial(){
  const gm=document.getElementById("gMonth"); if(gm&&!gm.value) gm.value=gCurYm();
  showGerTab(gTab||"prog");
}
function refreshGerencialIfOpen(){
  if(document.getElementById("gerencial")?.classList.contains("active")) showGerTab(gTab||"prog");
}
