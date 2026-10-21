/* ============================================================
   Eventos globais e partida do sistema
   ============================================================ */
document.querySelectorAll(".side-nav button").forEach(b=>b.onclick=()=>nav(b.dataset.page));
const formAnswers={};
let activeScheduleDueDate="";
document.addEventListener("input",e=>{if(e.target.id?.startsWith("txt-"))updateSummary();});
(function(){
  const iniciar=async()=>{updateToday();await bootOnline();init();updateSectorBadge();};
  // window.__domPronto é marcado no index.html quando o DOMContentLoaded dispara (depois do SDK do Firebase).
  if(window.__domPronto) iniciar(); else document.addEventListener("DOMContentLoaded",iniciar);
})();
