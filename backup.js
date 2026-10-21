/* ============================================================
   Backup, cópias automáticas e exportação/importação JSON
   ============================================================ */
function buildBackupObject(){
  return {app:"auditorias-escalonadas",version:1,exportedAt:new Date().toISOString(),
    state:{records:state.records||[],sectors:state.sectors||[],collaborators:state.collaborators||[],auditors:state.auditors||[],schedule:state.schedule||{},managers:state.managers||[],mgrRecords:state.mgrRecords||[],mgrSchedule:state.mgrSchedule||{}},
    auditorRules:{...AUDITOR_PLANT_RULES}};
}
function backupSummary(b){const st=b.state||{};return `${(st.records||[]).length} auditoria(s), ${(st.collaborators||[]).length} colaborador(es), ${(st.auditors||[]).length} auditor(es), ${Object.keys(st.schedule||{}).length} programa\u00e7\u00e3o(\u00f5es), ${(st.mgrRecords||[]).length} auditoria(s) gerencial(is)`;}
function openBackup(){
  const last=localStorage.getItem(BACKUP_LAST_KEY);
  document.getElementById("backupInfo").innerHTML="Dados atuais: <b>"+esc(backupSummary(buildBackupObject()))+"</b>.<br>\u00daltimo backup exportado neste aparelho: <b>"+(last?esc(new Date(last).toLocaleString("pt-BR")):"nunca")+"</b>.";
  const snaps=readSnapshots();
  document.getElementById("backupSnaps").innerHTML=snaps.length?snaps.map((x,i)=>`<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;padding:8px 0;border-top:1px solid #e3e8ee"><span style="font-size:12px"><b>${esc(new Date(x.at).toLocaleString("pt-BR"))}</b> \u00b7 ${esc(x.reason)}<br>${esc(backupSummary(x.backup))}</span><button class="secondary" type="button" onclick="restoreSnapshot(${i})">Voltar a esta</button></div>`).join(""):'<div style="font-size:12px;color:#6b7280">Nenhuma c\u00f3pia autom\u00e1tica ainda.</div>';
  document.getElementById("backupModal").classList.add("open");
}
function closeBackup(){document.getElementById("backupModal")?.classList.remove("open");}
function exportBackup(){
  const b=buildBackupObject();
  const blob=new Blob([JSON.stringify(b,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="backup_auditorias_"+new Date().toISOString().slice(0,10)+".json";
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  localStorage.setItem(BACKUP_LAST_KEY,new Date().toISOString());
  openBackup();
}
async function applyBackup(b,reason){
  const st=b.state;
  takeSnapshot(reason,true);
  state.records=st.records; state.sectors=Array.isArray(st.sectors)?st.sectors:[]; state.collaborators=st.collaborators; state.auditors=st.auditors;
  state.schedule=(st.schedule&&typeof st.schedule==="object")?st.schedule:{};
  state.managers=Array.isArray(st.managers)?st.managers:[]; state.mgrRecords=Array.isArray(st.mgrRecords)?st.mgrRecords:[]; state.mgrSchedule=(st.mgrSchedule&&typeof st.mgrSchedule==="object")?st.mgrSchedule:{};
  if(b.auditorRules&&typeof b.auditorRules==="object"){Object.keys(AUDITOR_PLANT_RULES).forEach(k=>delete AUDITOR_PLANT_RULES[k]);Object.assign(AUDITOR_PLANT_RULES,b.auditorRules);}
  state.auditorRules={...AUDITOR_PLANT_RULES};
  localStorage.setItem(KEY,JSON.stringify(state));
  try{ if(onlineReady) await syncStateOnlineNow(); }catch(e){alert("Restaurado neste aparelho, mas houve falha ao enviar ao banco online. Verifique a conex\u00e3o e salve algo para tentar sincronizar de novo.");}
  alert("Dados restaurados com sucesso.");
  location.reload();
}
function importBackup(ev){
  const f=ev.target.files&&ev.target.files[0]; ev.target.value="";
  if(!f)return;
  const rd=new FileReader();
  rd.onload=async()=>{
    let b;
    try{b=JSON.parse(rd.result);}catch(e){alert("Arquivo inv\u00e1lido: n\u00e3o \u00e9 um JSON.");return;}
    const st=b&&b.state;
    if(!b||b.app!=="auditorias-escalonadas"||!st||!Array.isArray(st.records)||!Array.isArray(st.collaborators)||!Array.isArray(st.auditors)){alert("Este arquivo n\u00e3o parece ser um backup do sistema de Auditorias Escalonadas.");return;}
    const when=b.exportedAt?new Date(b.exportedAt).toLocaleString("pt-BR"):"data desconhecida";
    if(!confirm("Restaurar o backup de "+when+"?\n\nConte\u00fado: "+backupSummary(b)+".\n\nTodos os dados atuais ser\u00e3o SUBSTITU\u00cdDOS"+(onlineReady?" (inclusive no banco online, para todos os usu\u00e1rios)":"")+". Uma c\u00f3pia dos dados atuais ser\u00e1 guardada neste aparelho antes da troca."))return;
    applyBackup(b,"antes de restaurar um backup");
  };
  rd.readAsText(f);
}
function snapSignature(){return [(state.records||[]).length,(state.collaborators||[]).length,(state.auditors||[]).length,Object.keys(state.schedule||{}).length,JSON.stringify(state.schedule||{}).length,(state.managers||[]).length,(state.mgrRecords||[]).length,JSON.stringify(state.mgrSchedule||{}).length].join("|");}
function readSnapshots(){try{const a=JSON.parse(localStorage.getItem(SNAP_KEY)||"[]");return Array.isArray(a)?a:[];}catch(e){return [];}}
function takeSnapshot(reason,force){
  try{
    const has=(state.records||[]).length||(state.collaborators||[]).length||Object.keys(state.schedule||{}).length;
    if(!has) return;
    const list=readSnapshots(), sig=snapSignature();
    if(list.length && list[0].sig===sig) return;
    if(!force && list.length && Date.now()-new Date(list[0].at).getTime()<12*3600*1000) return;
    list.unshift({at:new Date().toISOString(),reason:reason||"autom\u00e1tica",sig,backup:buildBackupObject()});
    list.length=Math.min(list.length,SNAP_MAX);
    while(list.length){
      try{localStorage.setItem(SNAP_KEY,JSON.stringify(list));return;}
      catch(e){list.pop();} // sem espaço: descarta a mais antiga
    }
  }catch(e){}
}
function restoreSnapshot(i){
  const snap=readSnapshots()[i]; if(!snap)return;
  if(!confirm("Voltar para a c\u00f3pia de "+new Date(snap.at).toLocaleString("pt-BR")+" ("+snap.reason+")?\n\n"+backupSummary(snap.backup)+".\n\nOs dados atuais ser\u00e3o substitu\u00eddos (uma c\u00f3pia deles ser\u00e1 guardada antes)."))return;
  applyBackup(snap.backup,"antes de voltar a uma c\u00f3pia autom\u00e1tica");
}
function exportJSON(){
 const payload={exportadoEm:new Date().toISOString(),totalRegistros:state.records.length,records:state.records};
 const a=document.createElement("a");
 a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
 a.download="auditorias_backup_"+new Date().toISOString().slice(0,10)+".json";
 a.click();
}
async function importJSONMerge(ev){
 const file=ev.target.files[0]; if(!file)return;
 try{
  const text=await file.text();
  const data=JSON.parse(text);
  const newRecords=Array.isArray(data)?data:(Array.isArray(data.records)?data.records:null);
  if(!newRecords){alert("Arquivo JSON inv\u00e1lido. Use um backup exportado por este pr\u00f3prio sistema (bot\u00e3o \"Exportar Backup (JSON)\").");ev.target.value="";return;}
  const {added,skipped}=mergeRecords(newRecords);
  saveState();
  alert(`${added} nova(s) auditoria(s) adicionada(s) ao hist\u00f3rico.${skipped?` ${skipped} j\u00e1 existia(m) e foram ignoradas.`:""}`);
  location.reload();
 }catch(e){
  alert("N\u00e3o foi poss\u00edvel ler o arquivo. Verifique se \u00e9 um backup JSON v\u00e1lido.");
 }
 ev.target.value="";
}
