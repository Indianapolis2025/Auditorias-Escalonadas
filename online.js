/* ============================================================
   Sincronização online (Firebase)
   ============================================================ */
function getOnlineConfig(){
  try { const c=JSON.parse(localStorage.getItem(ONLINE_CONFIG_KEY)||"null"); if(c&&c.apiKey) return c; } catch(e){}
  const d=window.AUDIT_FIREBASE_DEFAULT; return (d&&d.apiKey&&d.projectId&&d.appId)?d:null;
}
function copyOnlineConfigLink(){
  const c=getOnlineConfig(); if(!c){alert("Salve a configura\u00e7\u00e3o primeiro (bot\u00e3o Salvar), depois copie o link.");return;}
  const link=location.origin+location.pathname+"#cfg="+btoa(unescape(encodeURIComponent(JSON.stringify(c))));
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(link).then(function(){alert("Link copiado! Abra-o em outro computador ou celular para conectar sem digitar nada.");},function(){prompt("Copie o link:",link);});}
  else prompt("Copie o link:",link);
}
function hasOnlineConfig(){
  const c=getOnlineConfig();
  return !!(c && c.apiKey && c.authDomain && c.projectId && c.appId);
}
function setOnlineStatus(text, cls){
  const el=document.getElementById("onlineStatus"); if(!el)return;
  el.textContent="\u25cf "+text; el.className="online-status "+(cls||"");
}
function openOnlineConfig(){
  const c=getOnlineConfig()||{};
  ["apiKey","authDomain","projectId","storageBucket","messagingSenderId","appId"].forEach(k=>{
    const el=document.getElementById("firebase_"+k); if(el) el.value=c[k]||"";
  });
  document.getElementById("onlineModal")?.classList.add("open");
}
function closeOnlineConfig(){document.getElementById("onlineModal")?.classList.remove("open");}
function saveOnlineConfig(){
  const cfg={};
  ["apiKey","authDomain","projectId","storageBucket","messagingSenderId","appId"].forEach(k=>cfg[k]=String(document.getElementById("firebase_"+k)?.value||"").trim());
  if(!cfg.apiKey||!cfg.authDomain||!cfg.projectId||!cfg.appId){alert("Preencha pelo menos API Key, Auth Domain, Project ID e App ID do seu projeto Firebase.");return;}
  localStorage.setItem(ONLINE_CONFIG_KEY,JSON.stringify(cfg));
  closeOnlineConfig();
  location.reload();
}
function clearOnlineConfig(){
  if(!confirm("Remover a configura\u00e7\u00e3o online deste dispositivo e voltar ao modo local? Os dados do banco online n\u00e3o ser\u00e3o apagados."))return;
  localStorage.removeItem(ONLINE_CONFIG_KEY); location.reload();
}
function refreshAfterRemote(){
  try{
    refreshGerencialIfOpen?.();
    updateSectorBadge?.();
    renderDashboard?.();
    renderHistorico?.();
    renderPendencias?.();
    renderReports?.();
    renderCollaborators?.();
    initSchedulePage?.();
    updateToday?.();
  }catch(e){ /* a página ativa pode ainda não estar inicializada */ }
}
let mgrSyncedOnce=false; // evita que o 1o retorno do banco apague auditorias gerenciais locais ainda nao enviadas
async function syncStateOnlineNow(){
  if(!onlineReady||!onlineDb||onlineApplyingRemote)return;
  const cfgRef=onlineDb.collection("audit_app").doc("config");
  const schRef=onlineDb.collection("audit_app").doc("schedule");
  const recordsRef=onlineDb.collection("audit_records");
  const clean=JSON.parse(JSON.stringify(state));
  await cfgRef.set({sectors:clean.sectors||[],collaborators:clean.collaborators||[],auditors:clean.auditors||[],managers:clean.managers||[],updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
  await schRef.set({schedule:clean.schedule||{},mgrSchedule:clean.mgrSchedule||{},updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
  const snap=await recordsRef.get();
  // Auditorias gerenciais ficam na mesma colecao, marcadas com tipo:"gerencial".
  const allRecs=[...(clean.records||[]),...(clean.mgrRecords||[]).map(r=>({...r,tipo:"gerencial"}))];
  const currentIds=new Set(allRecs.map((r,i)=>String(r.id||("REC-"+i))));
  let batch=onlineDb.batch(), ops=0;
  snap.forEach(doc=>{if(!currentIds.has(doc.id)){batch.delete(doc.ref);ops++;}});
  for(const r of allRecs){
    const id=String(r.id||("REC-"+Math.random().toString(36).slice(2))).replace(/\//g,"_");
    if(!r.id) r.id=id;
    batch.set(recordsRef.doc(id),r,{merge:true}); ops++;
    if(ops>=450){await batch.commit();batch=onlineDb.batch();ops=0;}
  }
  if(ops) await batch.commit();
  mgrSyncedOnce=true;
}
function queueOnlineSync(){
  if(!onlineReady)return;
  clearTimeout(onlineSyncTimer);
  onlineSyncTimer=setTimeout(()=>syncStateOnlineNow().catch(e=>{console.warn("Falha ao sincronizar",e);setOnlineStatus("Online \u2014 erro ao sincronizar","offline");}),500);
}
async function bootOnline(){
  if(!hasOnlineConfig()){setOnlineStatus("Local");return false;}
  if(!window.firebase){setOnlineStatus("SDK indispon\u00edvel","offline");return false;}
  try{
    const cfg=getOnlineConfig();
    onlineApp=firebase.apps.find(a=>a.name===ONLINE_APP_NAME)||firebase.initializeApp(cfg,ONLINE_APP_NAME);
    onlineAuth=onlineApp.auth();
    await onlineAuth.signInAnonymously();
    onlineDb=onlineApp.firestore();
    const cfgRef=onlineDb.collection("audit_app").doc("config");
    const schRef=onlineDb.collection("audit_app").doc("schedule");
    const recRef=onlineDb.collection("audit_records");
    const [cfgSnap,schSnap,recSnap]=await Promise.all([cfgRef.get(),schRef.get(),recRef.get()]);
    if(cfgSnap.exists){
      try{ if((state.records||[]).length>recSnap.size) takeSnapshot("antes de sincronizar com o banco online",true); }catch(e){}
      const d=cfgSnap.data()||{};
      state.sectors=Array.isArray(d.sectors)?d.sectors:state.sectors;
      state.collaborators=Array.isArray(d.collaborators)?d.collaborators:state.collaborators;
      state.auditors=Array.isArray(d.auditors)?d.auditors:state.auditors;
      state.schedule=schSnap.exists && schSnap.data()?.schedule ? schSnap.data().schedule : {};
      const allR=recSnap.docs.map(d=>d.data());
      state.records=allR.filter(r=>r.tipo!=="gerencial");
      const gR=allR.filter(r=>r.tipo==="gerencial"); if(gR.length) state.mgrRecords=gR;
      if(Array.isArray(d.managers)) state.managers=d.managers;
      if(schSnap.exists && schSnap.data()?.mgrSchedule) state.mgrSchedule=schSnap.data().mgrSchedule;
    }else{
      // Primeiro dispositivo: publica os cadastros padrão e histórico zerado atuais.
      await syncStateOnlineNow();
    }
    onlineReady=true;
    setOnlineStatus("Online","online");
    onlineUnsubs.push(cfgRef.onSnapshot(s=>{
      if(!s.exists||!onlineReady)return; const d=s.data()||{}; onlineApplyingRemote=true;
      if(Array.isArray(d.sectors))state.sectors=d.sectors;
      if(Array.isArray(d.collaborators))state.collaborators=d.collaborators;
      if(Array.isArray(d.auditors))state.auditors=d.auditors;
      if(Array.isArray(d.managers))state.managers=d.managers;
      localStorage.setItem(KEY,JSON.stringify(state)); onlineApplyingRemote=false; refreshAfterRemote();
    },e=>setOnlineStatus("Online \u2014 erro","offline")));
    onlineUnsubs.push(schRef.onSnapshot(s=>{
      if(!s.exists||!onlineReady)return; onlineApplyingRemote=true; state.schedule=s.data()?.schedule||{}; if(s.data()?.mgrSchedule)state.mgrSchedule=s.data().mgrSchedule; localStorage.setItem(KEY,JSON.stringify(state)); onlineApplyingRemote=false; refreshAfterRemote();
    }));
    onlineUnsubs.push(recRef.onSnapshot(s=>{
      if(!onlineReady)return; onlineApplyingRemote=true; const allR=s.docs.map(d=>d.data()); state.records=allR.filter(r=>r.tipo!=="gerencial"); const gR=allR.filter(r=>r.tipo==="gerencial"); if(gR.length||mgrSyncedOnce) state.mgrRecords=gR; else if((state.mgrRecords||[]).length) queueOnlineSync(); localStorage.setItem(KEY,JSON.stringify(state)); onlineApplyingRemote=false; refreshAfterRemote();
    }));
    localStorage.setItem(KEY,JSON.stringify(state));
    return true;
  }catch(e){
    console.error(e); setOnlineStatus("Online \u2014 erro","offline");
    return false;
  }
}
