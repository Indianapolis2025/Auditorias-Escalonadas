/* ===== Tema claro/escuro ===== */
/* ===== CONTROLE DE TEMA ===== */
function applyTheme(){
  const dark=localStorage.getItem("indi_theme")==="dark";
  document.documentElement.setAttribute("data-theme",dark?"dark":"light");
  if(document.body) document.body.setAttribute("data-theme",dark?"dark":"light");
  const b=document.getElementById("themeToggle");
  if(b){
    b.textContent=dark?"\u2600\ufe0f Modo claro":"\ud83c\udf19 Modo escuro";
    b.setAttribute("title",dark?"Mudar para modo claro":"Mudar para modo escuro");
    b.setAttribute("aria-label",dark?"Mudar para modo claro":"Mudar para modo escuro");
    b.setAttribute("aria-pressed",dark?"true":"false");
  }
}
function toggleTheme(){
  const next=document.documentElement.getAttribute("data-theme")!=="dark";
  localStorage.setItem("indi_theme",next?"dark":"light");
  applyTheme();
  // Atualiza imediatamente textos, eixos e legendas dos gráficos em canvas.
  if(typeof renderDashboard==="function"){
    requestAnimationFrame(()=>renderDashboard());
  }
}
if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",applyTheme,{once:true});
}else{
  applyTheme();
}


/* ===== FILTRO DE PLANTA NO DASHBOARD ===== */
let dashboardPlantFilter="USINAGEM";

function getRecordPlant(r){
  return String(
    r.planta ?? r.Planta ?? r.plant ?? r.site ?? r.unidade ?? r.unidadeNegocio ?? ""
  ).trim();
}

function populateDashboardPlants(){
  const sel=document.getElementById("dashboardPlantFilter");
  if(!sel)return;
  const current=dashboardPlantFilter||sel.value||"all";
  const plants=[...new Set((state.records||[]).map(getRecordPlant).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,"pt-BR"));
  sel.innerHTML='<option value="all">Todas as plantas</option>';
  plants.forEach(p=>{
    const opt=document.createElement("option");
    opt.value=p;
    opt.textContent=p;
    sel.appendChild(opt);
  });
  sel.value=plants.includes(current)?current:"all";
  dashboardPlantFilter=sel.value;
}

function getDashboardRecords(){
  if(dashboardPlantFilter==="all")return state.records||[];
  return (state.records||[]).filter(r=>getRecordPlant(r)===dashboardPlantFilter);
}

function applyDashboardPlantFilter(){
  const sel=document.getElementById("dashboardPlantFilter");
  dashboardPlantFilter=sel?sel.value:"all";
  if(typeof renderDashboard==="function") renderDashboard();
  else if(typeof updateDashboard==="function") updateDashboard();
}

/* Mantém o filtro sincronizado ao entrar no Dashboard. */
function refreshDashboardPlantFilter(){
  populateDashboardPlants();
  if(typeof renderDashboard==="function") renderDashboard();
}


let dashResizeTimer;
window.addEventListener("resize",()=>{clearTimeout(dashResizeTimer);dashResizeTimer=setTimeout(()=>{if(typeof renderDashboard==="function" && document.getElementById("dashboard")?.classList.contains("active"))renderDashboard();},180);});

function openHelpTab(id,btn){
  document.querySelectorAll('#ajuda .help-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('#ajuda .help-tab').forEach(b=>b.classList.remove('active'));
  const intro=document.getElementById('help-intro');
  const panel=document.getElementById(id);
  if(panel){ panel.classList.add('active'); if(intro) intro.style.display='none'; }
  if(btn) btn.classList.add('active');
}
