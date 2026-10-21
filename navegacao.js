/* ============================================================
   Navegação entre abas e menu
   ============================================================ */
function nav(page){if(page==="cadastro"&&!cadastroLiberado()){askCadastroPassword();return;}closeMobileMenu();document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));document.getElementById(page).classList.add("active");document.querySelectorAll(".side-nav button").forEach(x=>x.classList.toggle("active",x.dataset.page===page));if(page==="dashboard"){renderDashboardTabs();renderDashboard();}if(page==="pendencias")renderPendencias();if(page==="programacao")initSchedulePage();if(page==="gerencial")initGerencial();if(page==="historico"){populateHistoryAuditors();renderHistorico();}if(page==="cadastro"){showCadastroTab("colaboradores");renderCollaborators();}if(page==="relatorios"){const rm=document.getElementById("reportMonth");if(rm&&!rm.onchange)rm.onchange=renderReports;renderReports();}if(page==="ajuda"){document.querySelectorAll("#ajuda .help-panel").forEach(p=>p.classList.remove("active"));document.querySelectorAll("#ajuda .help-tab").forEach(b=>{b.classList.remove("active");b.setAttribute("aria-selected","false");});const intro=document.getElementById("help-intro");if(intro)intro.style.display="block";}}
function openHelpTab(id, btn){
  const help=document.getElementById("ajuda");
  if(!help) return;
  help.querySelectorAll(".help-panel").forEach(p=>p.classList.remove("active"));
  help.querySelectorAll(".help-tab").forEach(b=>{b.classList.remove("active");b.setAttribute("aria-selected","false");});
  const panel=document.getElementById(id);
  const intro=document.getElementById("help-intro");
  if(intro) intro.style.display="none";
  if(panel) panel.classList.add("active");
  if(btn){btn.classList.add("active");btn.setAttribute("aria-selected","true");}
}
function toggleMobileMenu(){
  const side=document.querySelector('.sidebar');
  const ov=document.getElementById('mobileMenuOverlay');
  const btn=document.getElementById('mobileMenuBtn');
  const open=side?.classList.toggle('mobile-open');
  ov?.classList.toggle('open',!!open);
  if(btn)btn.setAttribute('aria-expanded',open?'true':'false');
}
function closeMobileMenu(){
  document.querySelector('.sidebar')?.classList.remove('mobile-open');
  document.getElementById('mobileMenuOverlay')?.classList.remove('open');
  document.getElementById('mobileMenuBtn')?.setAttribute('aria-expanded','false');
}
function updateToday(){document.getElementById("todayLabel").textContent=new Date().toLocaleDateString("pt-BR");}
