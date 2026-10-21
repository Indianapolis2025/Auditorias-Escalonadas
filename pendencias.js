/* ============================================================
   Pendências
   ============================================================ */
function getPendStatus(x){
  if(!x.just.trim()) return "PENDENTE";
  if(!x.acao.trim()) return "ACAO";
  return "RESOLVIDA";
}
function savePendencia(idx,code){
  const r=state.records[idx]; if(!r)return;
  r.justificativas=r.justificativas||{}; r.acoesTomadas=r.acoesTomadas||{};
  const just=document.getElementById(`pend-just-${idx}-${code}`)?.value.trim()||"";
  const acao=document.getElementById(`pend-acao-${idx}-${code}`)?.value.trim()||"";
  r.justificativas[code]=just; r.acoesTomadas[code]=acao;
  saveState(); renderPendencias(); renderDashboard();
  alert("Justificativa e a\u00e7\u00e3o tomada atualizadas com sucesso.");
}
function renderPendencias(){
  const q=(document.getElementById("pendSearch")?.value||"").toLowerCase(), st=document.getElementById("pendStatus")?.value||"ABERTAS";
  let items=allItems().map(x=>({...x,acao:x.r.acoesTomadas?.[x.q.code]||""})).filter(x=>{
    const status=getPendStatus(x);
    return (!st||(st==="ABERTAS"?(status!=="RESOLVIDA"):status===st))&&(!q||`${x.r.local} ${x.r.auditor} ${x.r.setor} ${x.q.text}`.toLowerCase().includes(q));
  });
  const table=document.getElementById("pendTable");
  if(!items.length){table.innerHTML='<div class="empty">Nenhuma pend\u00eancia encontrada.</div>';updateSectorBadge();return;}
  table.innerHTML=`<table class="pend-table"><thead><tr><th>Data</th><th>Local / Setor</th><th>Auditor</th><th>Item</th><th>Nota</th><th>Justificativa</th><th>A\u00e7\u00e3o tomada pelo l\u00edder</th><th>Status</th><th>Salvar</th></tr></thead><tbody>${items.map(x=>{
    const idx=state.records.indexOf(x.r), code=x.q.code, status=getPendStatus(x);
    const statusLabel=status==="RESOLVIDA"?"RESOLVIDA":status==="ACAO"?"AGUARDANDO A\u00c7\u00c3O":"PENDENTE";
    const badge=status==="RESOLVIDA"?"b-resolved":status==="ACAO"?"b-action":"b-pend";
    return `<tr><td class="date-cell">${fmtDate(x.r.data)}</td><td><b>${esc(x.r.local)}</b><br><span style="font-size:11px;color:#6d7c7e">${esc(x.r.setor)}</span></td><td>${esc(x.r.auditor||"\u2014")}</td><td class="item-cell"><b>${esc(code)}</b> \u2014 ${esc(x.q.text)}</td><td><span class="badge b-${x.v.toLowerCase()}">${x.v}</span></td><td><div class="pend-edit"><textarea id="pend-just-${idx}-${code}" placeholder="Digite ou altere a justificativa...">${esc(x.just)}</textarea></div></td><td><div class="pend-edit"><textarea id="pend-acao-${idx}-${code}" placeholder="Descreva a a\u00e7\u00e3o tomada pelo l\u00edder do setor..."></textarea><div class="pend-note">Informe o que foi feito para corrigir/prevenir a ocorr\u00eancia.</div></div></td><td class="status-cell"><span class="badge ${badge}">${statusLabel}</span></td><td><button class="save-pend" onclick="savePendencia(${idx},'${code}')">Salvar</button></td></tr>`;
  }).join("")}</tbody></table>`;
  // Reaplica o texto da ação após o HTML ser criado, evitando problemas de escape em atributos.
  items.forEach(x=>{const idx=state.records.indexOf(x.r),code=x.q.code;const el=document.getElementById(`pend-acao-${idx}-${code}`);if(el)el.value=x.acao;});
  updateSectorBadge();
}
