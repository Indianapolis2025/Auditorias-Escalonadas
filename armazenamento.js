/* ============================================================
   Estado, regras de planta, perguntas e pontuação
   ============================================================ */
function auditorAllowedForPlant(auditor, planta){
  const name=String(auditor||"").trim();
  const p=normalizePlantName(planta);
  const allowed=AUDITOR_PLANT_RULES[name];
  if(!allowed || !p) return true;
  return allowed.includes(p);
}
function auditorPlantsLabel(auditor){
  const p=AUDITOR_PLANT_RULES[String(auditor||"").trim()];
  return p ? p.join(" / ") : "Usinagem / Fundi\u00e7\u00e3o";
}
function normalizePlantName(v){
  const t=String(v??"").trim().toUpperCase();
  if(t.includes("FUNDI")) return "FUNDI\u00c7\u00c3O";
  if(t.includes("USIN")) return "USINAGEM";
  return "";
}
function inferPlant(r){
  const direct=normalizePlantName(r?.planta ?? r?.Planta ?? r?.plant ?? r?.site ?? r?.unidade ?? r?.unidadeNegocio);
  if(direct)return direct;
  const s=(state.sectors||[]).find(x=>normalizeFilterValue(x.local)===normalizeFilterValue(r?.local));
  return normalizePlantName(s?.planta)||"USINAGEM";
}
function getQuestionsForPlant(plant){
  const p=normalizePlantName(plant)||"USINAGEM";
  return QUESTION_SETS[p].questions;
}
function getCategoriesForPlant(plant){
  const p=normalizePlantName(plant)||"USINAGEM";
  return QUESTION_SETS[p].categories;
}
function getQuestionsForRecord(r){ return getQuestionsForPlant(r?.questionSet || inferPlant(r)); }
function calcAuditScorePercent(r){
 const vals=Object.values(r?.answers||{}).filter(v=>v==="A"||v==="P"||v==="N"); // N.A não entra no cálculo da nota
 if(!vals.length)return 0;
 const score=vals.reduce((sum,v)=>sum+(v==="A"?100:v==="P"?50:0),0);
 return Math.round((score/vals.length)*10)/10;
}
function auditScoreLabel(r){ return calcAuditScorePercent(r).toLocaleString("pt-BR")+"%"; }
function getCategoriesForRecord(r){ return getCategoriesForPlant(r?.questionSet || inferPlant(r)); }
function setActiveQuestionSet(plant){
  const p=normalizePlantName(plant)||"USINAGEM";
  questions=getQuestionsForPlant(p); categories=getCategoriesForPlant(p);
  return p;
}
function saveState(){
  state.auditorRules={...AUDITOR_PLANT_RULES};
  localStorage.setItem(KEY, JSON.stringify(state));
  queueOnlineSync();
}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function fmtDate(d){ if(!d)return ""; const x=String(d).slice(0,10).split("-"); return x.length===3?`${x[2]}/${x[1]}/${x[0]}`:d; }
