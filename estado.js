/* ============================================================
   Estado inicial, migrações e inicialização de dados (executa ao carregar)
   ============================================================ */
(function(){var h=location.hash;if(h.indexOf("#cfg=")===0){try{var c=JSON.parse(decodeURIComponent(escape(atob(h.slice(5)))));if(c&&c.apiKey&&c.projectId&&c.appId){localStorage.setItem("auditoria_firebase_config_v1",JSON.stringify(c))}}catch(e){}try{history.replaceState(null,"",location.pathname+location.search)}catch(e){}}})();
const ONLINE_CONFIG_KEY = "auditoria_firebase_config_v1";
const ONLINE_APP_NAME = "auditorias-escalonadas-online";
let onlineApp = null, onlineAuth = null, onlineDb = null;
let onlineReady = false, onlineApplyingRemote = false, onlineSyncTimer = null;
let onlineUnsubs = [];
const KEY = "auditoria_escalonada_v1";
// Preparação inicial da versão oficial: mantém os setores cadastrados,
// mas elimina todo o histórico anterior e deixa somente os cadastros padrão.
const storedState = JSON.parse(localStorage.getItem(KEY) || "null");
// PROTEÇÃO DE DADOS: as antigas "reinicializações" (que zeravam histórico, programação e cadastros)
// foram removidas. Agora os valores padrão só são usados em uma instalação nova, sem dados salvos.
const FRESH_INSTALL = !storedState;
let state;
if(FRESH_INSTALL){
  state = {
    records: [],
    sectors: INITIAL.sectors,
    collaborators: DEFAULT_COLLABORATORS.map(c=>({name:c.name,setor:"",planta:c.planta})),
    auditors: DEFAULT_AUDITORS.map(name=>({name})),
    schedule: {},
    managers: (window.DEFAULT_MANAGERS||[]).map(m=>({name:m.name,cargo:m.cargo||"Gestor"})),
    mgrRecords: [],
    mgrSchedule: {}
  };
  // Remoções pontuais antigas (valem só para a lista padrão).
  const rmC=new Set(["kleber dutra ad\u00e3o","leandro barbosa da silva","d\u00e9cio novais da silva"]);
  state.collaborators = state.collaborators.filter(x=>!rmC.has(String(x.name||"").trim().toLowerCase()));
  const rmA=new Set(["christoffer","fabio r"]);
  state.auditors = state.auditors.filter(a=>!rmA.has(String(a.name||a).trim().toLowerCase()));
}else{
  state = storedState;
  state.records = Array.isArray(state.records) ? state.records : [];
  state.sectors = Array.isArray(state.sectors) ? state.sectors : [];
  state.collaborators = Array.isArray(state.collaborators) ? state.collaborators : [];
  state.auditors = (Array.isArray(state.auditors) ? state.auditors : []).map(a=>({name:String(a&&a.name||a).trim()}));
  state.schedule = (state.schedule && typeof state.schedule==="object" && !Array.isArray(state.schedule)) ? state.schedule : {};
  // Auditoria Gerencial (gestores/diretores)
  state.managers = Array.isArray(state.managers) ? state.managers : [];
  state.mgrRecords = Array.isArray(state.mgrRecords) ? state.mgrRecords : [];
  state.mgrSchedule = (state.mgrSchedule && typeof state.mgrSchedule==="object" && !Array.isArray(state.mgrSchedule)) ? state.mgrSchedule : {};
}
// Restaura as plantas permitidas de cada auditor ANTES do primeiro saveState() (que regrava essas regras).
if(state.auditorRules && typeof state.auditorRules==="object") Object.assign(AUDITOR_PLANT_RULES,state.auditorRules);
saveState();
let questions = INITIAL.questions, categories = INITIAL.categories;
const QUESTION_SETS = {
  "USINAGEM": {
    questions: INITIAL.questions,
    categories: INITIAL.categories
  },
  "FUNDI\u00c7\u00c3O": FUNDICAO_SET
};
state.records.forEach(r=>{ if(!r.questionSet) r.questionSet=inferPlant(r); else r.questionSet=normalizePlantName(r.questionSet)||inferPlant(r); });
saveState();
/* ===== BACKUP: exportar e restaurar ===== */
const BACKUP_LAST_KEY="auditoria_ultimo_backup";
/* ===== CÓPIAS AUTOMÁTICAS DE SEGURANÇA (neste aparelho) ===== */
const SNAP_KEY="auditoria_copias_auto", SNAP_MAX=3;
try{takeSnapshot("abertura do sistema");}catch(e){}
try{migrateSchedules();}catch(e){console.error("migrateSchedules",e);}
/* ===== SENHA DA ABA CADASTRO ===== */
const CADASTRO_SENHA="1966";
