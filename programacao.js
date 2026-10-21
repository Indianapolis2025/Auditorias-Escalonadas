/* ============================================================
   Programação mensal, rodízio, situação e reprogramação
   ============================================================ */
/* Unifica programações antigas (uma por planta + "todas") em uma única por mês. */
function migrateSchedules(){
  const sc=state.schedule||{}, groups={};
  Object.keys(sc).forEach(k=>{const i=k.indexOf("|"); if(i<0)return; const ym=k.slice(0,i), p=k.slice(i+1); (groups[ym]=groups[ym]||{})[p]=k;});
  const todo=Object.keys(groups).filter(ym=>Object.keys(groups[ym]).some(p=>p!=="all"));
  if(!todo.length) return false;
  takeSnapshot("antes de unificar programa\u00e7\u00f5es",true);
  todo.forEach(ym=>{
    const g=groups[ym];
    let base=sc[ym+"|all"];
    const others=Object.keys(g).filter(p=>p!=="all").map(p=>({p:normalizePlantName(p),s:sc[g[p]]})).filter(x=>x.s&&Array.isArray(x.s.assignments));
    if(!base||!Array.isArray(base.assignments)){
      const f=others[0]; if(!f){Object.keys(g).forEach(p=>{if(p!=="all")delete sc[g[p]];});return;}
      base={ym,plantaFilter:"all",weeks:f.s.weeks,assignments:[],generatedAt:f.s.generatedAt};
    }
    base.plantaFilter="all";
    ["FUNDI\u00c7\u00c3O","USINAGEM"].forEach(pl=>{
      if(base.assignments.some(a=>normalizePlantName(a.planta)===pl)) return;
      const src=others.find(x=>x.p===pl); if(!src) return;
      src.s.assignments.filter(a=>normalizePlantName(a.planta)===pl).forEach(a=>{
        base.assignments.push({...a,weekIdx:Math.min(a.weekIdx,base.weeks.length-1)});
      });
    });
    sc[ym+"|all"]=base;
    Object.keys(g).forEach(p=>{if(p!=="all")delete sc[g[p]];});
  });
  state.schedule=sc; saveState(); return true;
}
/* ===== PROGRAMAÇÃO MENSAL (rodízio de auditorias) ===== */
function monthWeeks(ym){
  const [y,m]=ym.split("-").map(Number);
  const first=new Date(y,m-1,1), last=new Date(y,m,0);
  let d=new Date(first); d.setDate(d.getDate()-((d.getDay()+6)%7));
  const weeks=[];
  while(d<=last){
    const start=new Date(d), end=new Date(d); end.setDate(end.getDate()+6);
    weeks.push({start,end});
    d=new Date(d); d.setDate(d.getDate()+7);
  }
  return weeks;
}
function fmtShort(d){return d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"});}
function monthDiff(a,b){const [y1,m1]=a.split("-").map(Number),[y2,m2]=b.split("-").map(Number);return (y2-y1)*12+(m2-m1);}
function buildPairHistory(ym,planta){
  // Histórico de quem auditou quem (auditorias feitas + programações anteriores) antes do mês ym.
  const norm=n=>String(n||"").trim().toLowerCase();
  const seen=new Map();
  const add=(m,c,a,pl)=>{
    if(!m||!c||!a||m>=ym) return;
    if(normalizePlantName(pl)!==planta) return;
    seen.set(m+"|"+norm(c)+"|"+norm(a),{m,c:norm(c),a:norm(a)});
  };
  (state.records||[]).forEach(r=>add(String(r.data||"").slice(0,7),r.colaborador,r.auditor,r.planta));
  Object.values(state.schedule||{}).forEach(sc=>{
    if(!sc||!sc.ym) return;
    (sc.assignments||[]).forEach(x=>add(sc.ym,x.colaborador,x.auditor,x.planta));
  });
  const pair={}, load={};
  seen.forEach(e=>{
    const d=monthDiff(e.m,ym);
    const w=d===1?100:(d===2?10:1); // mês anterior pesa muito mais
    const k=e.c+"|"+e.a;
    pair[k]=(pair[k]||0)+w;
    if(d<=3) load[e.a]=(load[e.a]||0)+1;
  });
  return {cost:(c,a)=>pair[norm(c)+"|"+norm(a)]||0, load:a=>load[norm(a)]||0};
}
function pickRandom(arr){return arr[Math.floor(Math.random()*arr.length)];}
function shuffleArray(arr){
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
function generateSchedule(ym,plantaFilter){
  const weeks=monthWeeks(ym);
  const plants=plantaFilter==="all"?["FUNDI\u00c7\u00c3O","USINAGEM"]:[normalizePlantName(plantaFilter)];
  const assignments=[];
  const weekData=weeks.map(w=>({start:w.start.toISOString().slice(0,10),end:w.end.toISOString().slice(0,10)}));

  // Quando "Todas as plantas" estiver selecionado, a programação é montada
  // separadamente por planta. Assim, nenhum auditor de Usinagem aparece
  // na Fundição e vice-versa.
  for(const planta of plants){
    const auditors=(state.auditors||[])
      .map(a=>a.name)
      .filter(Boolean)
      .filter(a=>auditorAllowedForPlant(a,planta));

    const collabs=shuffleArray([...(state.collaborators||[])]
      .filter(c=>normalizePlantName(c.planta)===planta)
      .map(c=>c.name));

    if(!auditors.length || !collabs.length) continue;

    const hist=buildPairHistory(ym,planta);
    const N=collabs.length, A=auditors.length;
    const base=Math.floor(N/A), rem=N%A;
    // Quem auditou menos nos últimos meses recebe a auditoria "extra" quando a divisão não é exata.
    const order=shuffleArray(auditors).sort((x,y)=>hist.load(x)-hist.load(y));
    const left={}; order.forEach((a,i)=>{left[a]=base+(i<rem?1:0);});

    // Sorteio guiado: evita repetir o mesmo auditor/colaborador dos meses anteriores.
    const list=shuffleArray(collabs), asg=[];
    list.forEach(c=>{
      const opts=auditors.filter(a=>left[a]>0);
      const min=Math.min(...opts.map(a=>hist.cost(c,a)));
      const a=pickRandom(opts.filter(x=>hist.cost(c,x)===min));
      asg.push({c,a}); left[a]--;
    });
    // Melhoria por trocas: troca auditores entre dois colaboradores quando reduz repetições.
    for(let it=0; it<3000 && asg.length>1; it++){
      const i=Math.floor(Math.random()*asg.length), j=Math.floor(Math.random()*asg.length);
      if(i===j||asg[i].a===asg[j].a) continue;
      const cur=hist.cost(asg[i].c,asg[i].a)+hist.cost(asg[j].c,asg[j].a);
      const alt=hist.cost(asg[i].c,asg[j].a)+hist.cost(asg[j].c,asg[i].a);
      if(alt<cur){const t=asg[i].a; asg[i].a=asg[j].a; asg[j].a=t;}
    }
    // Distribui nas semanas: cada auditor faz uma por semana; o excedente vai para a última semana.
    auditors.forEach(a=>{
      asg.filter(x=>x.a===a).forEach((x,t)=>{
        if(t<weeks.length) assignments.push({weekIdx:t,auditor:a,colaborador:x.c,planta});
        else assignments.push({weekIdx:weeks.length-1,auditor:a,colaborador:x.c,planta,extra:true});
      });
    });
  }

  return {ym,plantaFilter,weeks:weekData,assignments,generatedAt:new Date().toISOString()};
}
function scheduleKey(ym,planta){return ym+"|all";}
 // uma única programação por mês; a planta é só filtro de exibição
function syncSchedule(sched){
  // Atualiza uma programação já existente sem mexer nos nomes já programados:
  // remove só quem saiu do cadastro e encaixa só quem entrou.
  const plants=sched.plantaFilter==="all"?["FUNDI\u00c7\u00c3O","USINAGEM"]:[normalizePlantName(sched.plantaFilter)];
  const norm=n=>String(n||"").trim().toLowerCase();
  const removed=[], added=[];
  for(const planta of plants){
    const collabs=(state.collaborators||[]).filter(c=>normalizePlantName(c.planta)===planta).map(c=>c.name);
    const valid=new Set(collabs.map(norm));
    // Remoções
    sched.assignments=sched.assignments.filter(a=>{
      if(normalizePlantName(a.planta)!==planta) return true;
      if(valid.has(norm(a.colaborador))) return true;
      removed.push(a.colaborador); return false;
    });
    // Inclusões
    const scheduled=new Set(sched.assignments.filter(a=>normalizePlantName(a.planta)===planta).map(a=>norm(a.colaborador)));
    const novos=shuffleArray(collabs.filter(n=>!scheduled.has(norm(n))));
    if(!novos.length) continue;
    const auditors=(state.auditors||[]).map(a=>a.name).filter(Boolean).filter(a=>auditorAllowedForPlant(a,planta));
    if(!auditors.length) continue;
    const hist=buildPairHistory(sched.ym,planta);
    for(const nome of novos){
      const rows=sched.assignments.filter(a=>normalizePlantName(a.planta)===planta);
      const occ=new Set(rows.map(a=>a.weekIdx+"|"+a.auditor));
      const livres=[];
      for(let w=0; w<sched.weeks.length; w++){
        for(const aud of auditors){ if(!occ.has(w+"|"+aud)) livres.push({weekIdx:w,auditor:aud}); }
      }
      const loadOf=a=>rows.filter(r=>r.auditor===a).length;
      const pickBest=cands=>{
        const minL=Math.min(...cands.map(loadOf));
        const lo=cands.filter(a=>loadOf(a)===minL);
        const minC=Math.min(...lo.map(a=>hist.cost(nome,a)));
        return pickRandom(lo.filter(a=>hist.cost(nome,a)===minC));
      };
      const audsLivres=[...new Set(livres.map(l=>l.auditor))];
      if(audsLivres.length){
        const aud=pickBest(audsLivres);
        const slot=pickRandom(livres.filter(l=>l.auditor===aud));
        sched.assignments.push({weekIdx:slot.weekIdx,auditor:aud,colaborador:nome,planta});
      }else{
        const aud=pickBest(auditors);
        sched.assignments.push({weekIdx:sched.weeks.length-1,auditor:aud,colaborador:nome,planta,extra:true});
      }
      added.push(nome);
    }
  }
  sched.updatedAt=new Date().toISOString();
  return {added,removed};
}
function onGenerateSchedule(){
  const ym=document.getElementById("schedMonth").value, planta=document.getElementById("schedPlanta").value;
  if(!ym){alert("Selecione o m\u00eas.");return;}
  const key=scheduleKey(ym,planta);
  if(state.schedule[key]){
    const r=syncSchedule(state.schedule[key]);
    if(!r.added.length && !r.removed.length){
      alert("A programa\u00e7\u00e3o deste m\u00eas j\u00e1 foi gerada e n\u00e3o h\u00e1 colaboradores novos ou removidos. Nada foi alterado.");
      return;
    }
    saveState(); renderSchedule();
    let msg="Programa\u00e7\u00e3o atualizada. Os demais nomes foram mantidos.";
    if(r.added.length) msg+="\n\nInclu\u00eddos: "+r.added.join(", ");
    if(r.removed.length) msg+="\n\nRemovidos: "+r.removed.join(", ");
    alert(msg);
    return;
  }
  state.schedule[key]=generateSchedule(ym,"all");
  saveState();
  renderSchedule();
}
function onRegenerateSchedule(){
  const ym=document.getElementById("schedMonth").value, planta=document.getElementById("schedPlanta").value;
  if(!ym){alert("Selecione o m\u00eas.");return;}
  const key=scheduleKey(ym,planta);
  const label="todas as plantas";
  if(!confirm("Refazer do zero a programa\u00e7\u00e3o de "+ym.split("-").reverse().join("/")+" ("+label+")?\n\nTodos os nomes atuais ser\u00e3o sorteados novamente e os ajustes manuais ser\u00e3o perdidos. Auditorias j\u00e1 realizadas n\u00e3o s\u00e3o apagadas.")) return;
  if(state.schedule[key]){
    try{localStorage.setItem("auditoria_programacao_anterior",JSON.stringify({key,savedAt:new Date().toISOString(),schedule:state.schedule[key]}));}catch(e){}
  }
  takeSnapshot("antes de refazer a programa\u00e7\u00e3o",true);
  state.schedule[key]=generateSchedule(ym,"all");
  saveState();
  renderSchedule();
}
function initSchedulePage(){
  const monthInput=document.getElementById("schedMonth");
  if(monthInput && !monthInput.value) monthInput.value=new Date().toISOString().slice(0,7);
  if(!monthInput.onchange) monthInput.onchange=renderSchedule;
  const plantaSel=document.getElementById("schedPlanta");
  if(plantaSel && !plantaSel.onchange) plantaSel.onchange=renderSchedule;
  renderSchedule();
}
function collaboratorAuditedThisMonth(name,ym){
  const n=String(name||"").trim().toLowerCase();
  return (state.records||[]).some(r=>String(r.colaborador||"").trim().toLowerCase()===n && String(r.data||"").slice(0,7)===ym);
}
function renderSchedule(){
  const wrap=document.getElementById("scheduleWrap"); if(!wrap)return;
  const ym=document.getElementById("schedMonth").value, planta=document.getElementById("schedPlanta").value;
  const key=scheduleKey(ym,planta);
  const sched=state.schedule[key];
  document.getElementById("schedCount").textContent=sched?`${sched.assignments.filter(a=>planta==="all"||normalizePlantName(a.planta)===normalizePlantName(planta)).length} auditoria(s) programada(s)`:"";
  renderScheduleAlerts();
  if(!sched){
    wrap.innerHTML='<div class="empty">Nenhuma programa\u00e7\u00e3o gerada para este m\u00eas. Clique em "Gerar / Atualizar programa\u00e7\u00e3o".</div>';
    return;
  }

  const today=new Date();

  function buildPlantTable(plant){
    const rows=sched.assignments.filter(a=>normalizePlantName(a.planta)===plant);
    if(!rows.length) return `<div class="empty">Nenhuma programa\u00e7\u00e3o para ${esc(plant)}.</div>`;

    // Só aparecem os auditores autorizados para esta planta.
    const auditors=[...new Set(rows.map(a=>a.auditor))]
      .filter(a=>auditorAllowedForPlant(a,plant));

    let html=`<div class="schedule-plant-block">
      <div class="schedule-plant-title"><span>${plant}</span><small>${rows.length} auditoria(s)</small></div>
      <table><thead><tr><th>Semana</th>${auditors.map(a=>`<th>${esc(a)}</th>`).join("")}</tr></thead><tbody>`;

    sched.weeks.forEach((w,wi)=>{
      const wEnd=new Date(w.end+"T23:59:59");
      html+=`<tr><td>${fmtShort(new Date(w.start+"T00:00:00"))} \u2013 ${fmtShort(new Date(w.end+"T00:00:00"))}</td>`;
      auditors.forEach(a=>{
        const cell=rows.filter(x=>x.weekIdx===wi && x.auditor===a);
        if(!cell.length){ html+="<td>\u2014</td>"; return; }
        html+="<td>"+cell.map(c=>{
          const done=collaboratorAuditedThisMonth(c.colaborador,ym);
          const cls=done?"b-ok":(wEnd<today?"b-n":"b-p");
          const label=done?"Auditada":(wEnd<today?"Atrasada":"Pendente");
          return `<div class="clickable" style="margin-bottom:4px" onclick="startAuditFromSchedule('${encodeURIComponent(c.colaborador)}','${encodeURIComponent(a)}','${encodeURIComponent(w.end)}')" title="Clique para abrir Nova Auditoria j\u00e1 preenchida"><span class="badge ${cls}">${label}</span> ${esc(c.colaborador)}<button type="button" class="mini-edit" onclick="event.stopPropagation();openMoveAssignment(${sched.assignments.indexOf(c)})" title="Reprogramar (trocar auditor ou semana)">\u270e</button>${c.manual?'<span title="Ajustado manualmente" style="margin-left:3px;font-size:10px">\u270b</span>':''}</div>`;
        }).join("")+"</td>";
      });
      html+="</tr>";
    });
    html+="</tbody></table></div>";
    return html;
  }

  if(planta==="all"){
    // Exibe primeiro Fundição e depois Usinagem, cada uma com seus próprios auditores.
    wrap.innerHTML=buildPlantTable("FUNDI\u00c7\u00c3O")+buildPlantTable("USINAGEM");
  }else{
    wrap.innerHTML=buildPlantTable(normalizePlantName(planta));
  }
}
/* ===== SITUAÇÃO DA PROGRAMAÇÃO (aba Programação) ===== */
let alertAuditorFilter="all";
function getScheduleAlerts(ym,planta){
  // Usa exatamente a mesma programação e os mesmos critérios da tabela "Rodízio do mês".
  const sc=state.schedule[scheduleKey(ym,planta)];
  const out={total:0,done:0,late:[],week:[],next:[],has:!!sc};
  if(!sc||!Array.isArray(sc.assignments)||!Array.isArray(sc.weeks)) return out;
  const now=new Date();
  sc.assignments.forEach(a=>{
    if(planta!=="all" && normalizePlantName(a.planta)!==normalizePlantName(planta)) return;
    const w=sc.weeks[a.weekIdx]; if(!w) return;
    out.total++;
    if(collaboratorAuditedThisMonth(a.colaborador,ym)){out.done++;return;}
    const it={colaborador:a.colaborador,auditor:a.auditor,planta:normalizePlantName(a.planta),start:w.start,end:w.end};
    const start=new Date(w.start+"T00:00:00"), end=new Date(w.end+"T23:59:59");
    if(end<now) out.late.push(it); else if(start<=now) out.week.push(it); else out.next.push(it);
  });
  out.late.sort((x,y)=>x.end.localeCompare(y.end));
  out.week.sort((x,y)=>x.auditor.localeCompare(y.auditor,"pt-BR"));
  return out;
}
function setAlertAuditor(enc){alertAuditorFilter=decodeURIComponent(enc);renderScheduleAlerts();}
function renderScheduleAlerts(){
  const el=document.getElementById("scheduleAlerts"); if(!el) return;
  const ym=document.getElementById("schedMonth")?.value, planta=document.getElementById("schedPlanta")?.value||"all";
  if(!ym){el.innerHTML="";return;}
  const al=getScheduleAlerts(ym,planta);
  if(!al.has){el.innerHTML="";return;}
  const fmt=iso=>iso.slice(8,10)+"/"+iso.slice(5,7);
  const auds=[...new Set([...al.late,...al.week].map(x=>x.auditor))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  if(alertAuditorFilter!=="all" && !auds.includes(alertAuditorFilter)) alertAuditorFilter="all";
  const f=x=>alertAuditorFilter==="all"||x.auditor===alertAuditorFilter;
  const late=al.late.filter(f), week=al.week.filter(f);
  const showPl=planta==="all";
  const row=(x,cls,label)=>`<div class="alert-row"><span><span class="badge ${cls}">${label}</span> <b>${esc(x.colaborador)}</b><br><small>${esc(x.auditor)}${showPl?" \u00b7 "+esc(x.planta):""} \u00b7 semana ${fmt(x.start)} \u2013 ${fmt(x.end)}</small></span><button class="secondary" type="button" onclick="startAuditFromSchedule('${encodeURIComponent(x.colaborador)}','${encodeURIComponent(x.auditor)}','${encodeURIComponent(x.end)}')">Iniciar</button></div>`;
  let html=`<div class="excel-card" style="margin-bottom:14px"><div class="card-head"><span>\u23f0 Situa\u00e7\u00e3o da programa\u00e7\u00e3o</span><span>${al.done} de ${al.total} auditada(s) \u00b7 ${al.late.length} atrasada(s) \u00b7 ${al.week.length} nesta semana \u00b7 ${al.next.length} nas pr\u00f3ximas</span></div><div class="card-body">`;
  if(!al.late.length && !al.week.length){
    html+='<div style="font-size:13px;color:#166534">\u2705 Nenhuma auditoria atrasada ou pendente nesta semana.</div>';
  }else{
    html+=`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px"><button class="alert-chip ${alertAuditorFilter==="all"?"on":""}" type="button" onclick="setAlertAuditor('all')">Todos</button>${auds.map(a=>{const n=al.late.filter(x=>x.auditor===a).length+al.week.filter(x=>x.auditor===a).length;return `<button class="alert-chip ${alertAuditorFilter===a?"on":""}" type="button" onclick="setAlertAuditor('${encodeURIComponent(a)}')">${esc(a)} (${n})</button>`;}).join("")}</div>`;
    if(late.length) html+='<div class="alert-title" style="color:#991b1b">Atrasadas</div>'+late.map(x=>row(x,"b-n","Atrasada")).join("");
    if(week.length) html+='<div class="alert-title" style="color:#92400e">Esta semana</div>'+week.map(x=>row(x,"b-p","Pendente")).join("");
    if(alertAuditorFilter!=="all") html+=`<div style="margin-top:10px"><button class="primary" type="button" onclick="sendAuditorReminder('${encodeURIComponent(alertAuditorFilter)}')">\ud83d\udcf2 Enviar lembrete de ${esc(alertAuditorFilter)} no WhatsApp</button></div>`;
  }
  html+="</div></div>";
  el.innerHTML=html;
}
function sendAuditorReminder(enc){
  const aud=decodeURIComponent(enc);
  const ym=document.getElementById("schedMonth").value, planta=document.getElementById("schedPlanta").value;
  const al=getScheduleAlerts(ym,planta);
  const fmt=iso=>iso.slice(8,10)+"/"+iso.slice(5,7);
  const l=al.late.filter(x=>x.auditor===aud), w=al.week.filter(x=>x.auditor===aud);
  if(!l.length&&!w.length){alert("Nenhuma pend\u00eancia para "+aud+".");return;}
  let t="Ol\u00e1, "+aud+"! Auditorias escalonadas pendentes ("+ym.split("-").reverse().join("/")+"):\n";
  if(l.length) t+="\n*Atrasadas*\n"+l.map(x=>"\u2022 "+x.colaborador+" ("+x.planta+", semana "+fmt(x.start)+"\u2013"+fmt(x.end)+")").join("\n")+"\n";
  if(w.length) t+="\n*Esta semana*\n"+w.map(x=>"\u2022 "+x.colaborador+" ("+x.planta+", at\u00e9 "+fmt(x.end)+")").join("\n")+"\n";
  window.open("https://wa.me/?text="+encodeURIComponent(t),"_blank");
}
/* ===== REPROGRAMAR UM NOME (auditor e/ou semana) ===== */
let moveCtx=null;
function openMoveAssignment(idx){
  const ym=document.getElementById("schedMonth").value, planta=document.getElementById("schedPlanta").value;
  const sched=state.schedule[scheduleKey(ym,planta)]; if(!sched) return;
  const a=sched.assignments[idx]; if(!a) return;
  const pl=normalizePlantName(a.planta);
  const auds=(state.auditors||[]).map(x=>x.name).filter(Boolean).filter(n=>auditorAllowedForPlant(n,pl));
  if(!auds.includes(a.auditor)) auds.unshift(a.auditor);
  moveCtx={key:scheduleKey(ym,planta),idx};
  document.getElementById("moveWho").innerHTML="<b>"+esc(a.colaborador)+"</b> \u00b7 "+esc(pl);
  document.getElementById("moveAuditor").innerHTML=auds.map(n=>`<option value="${esc(n)}" ${n===a.auditor?"selected":""}>${esc(n)}</option>`).join("");
  document.getElementById("moveWeek").innerHTML=sched.weeks.map((w,i)=>`<option value="${i}" ${i===a.weekIdx?"selected":""}>Semana ${i+1}: ${w.start.slice(8,10)}/${w.start.slice(5,7)} \u2013 ${w.end.slice(8,10)}/${w.end.slice(5,7)}</option>`).join("");
  document.getElementById("moveModal").classList.add("open");
}
function closeMoveAssignment(){document.getElementById("moveModal")?.classList.remove("open");moveCtx=null;}
function saveMoveAssignment(){
  if(!moveCtx) return;
  const sched=state.schedule[moveCtx.key]; const a=sched&&sched.assignments[moveCtx.idx]; if(!a){closeMoveAssignment();return;}
  const aud=document.getElementById("moveAuditor").value, wk=Number(document.getElementById("moveWeek").value);
  if(aud===a.auditor && wk===a.weekIdx){closeMoveAssignment();return;}
  const pl=normalizePlantName(a.planta);
  const other=sched.assignments.find(x=>x!==a && normalizePlantName(x.planta)===pl && x.auditor===aud && x.weekIdx===wk);
  if(other && !confirm(aud+" j\u00e1 tem "+other.colaborador+" nessa semana. Programar "+a.colaborador+" tamb\u00e9m nessa mesma semana?")) return;
  a.auditor=aud; a.weekIdx=wk; a.manual=true;
  if(other) a.extra=true; else delete a.extra;
  sched.updatedAt=new Date().toISOString();
  saveState(); closeMoveAssignment(); renderSchedule(); renderScheduleAlerts();
}
function startAuditFromSchedule(colaboradorEnc,auditorEnc,dueDateEnc){
  const colaborador=decodeURIComponent(colaboradorEnc), auditor=decodeURIComponent(auditorEnc);
  const dueDate=dueDateEnc?decodeURIComponent(dueDateEnc):"";
  activeScheduleDueDate=dueDate;
  const c=(state.collaborators||[]).find(x=>x.name===colaborador);
  const planta=normalizePlantName(c?.planta)||"USINAGEM";
  nav("nova");
  document.getElementById("fPlanta").value=planta;
  changeAuditPlant();
  document.getElementById("fColaborador").value=colaborador;
  document.getElementById("fAuditor").value=auditor;
  document.getElementById("fData").value=new Date().toISOString().slice(0,10);
}
