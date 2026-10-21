/* ============================================================
   Excel/CSV/PDF: exportação e importação
   ============================================================ */
/* ===== EXPORTAÇÃO EXCEL — MODELO PADRÃO DA PLANILHA =====
   O arquivo-base enviado pelo usuário é mantido como modelo visual.
   A exportação preenche a aba LANÇAMENTOS sem alterar o layout, estilos,
   larguras, cabeçalhos e estrutura da planilha.
*/

/* ===== EXPORTAÇÃO EXCEL — MODELO OFFLINE =====
   Gera o .XLSX diretamente no navegador, sem depender de CDN/internet.
   O arquivo-base embutido conserva o visual, cabeçalhos, larguras, estilos,
   filtros e demais elementos da planilha-modelo enviada pelo usuário.
*/
function _u16(a,o){return a[o]|(a[o+1]<<8)}
function _u32(a,o){return (a[o]|(a[o+1]<<8)|(a[o+2]<<16)|(a[o+3]<<24))>>>0}
function _put16(a,o,v){a[o]=v&255;a[o+1]=(v>>>8)&255}
function _put32(a,o,v){a[o]=v&255;a[o+1]=(v>>>8)&255;a[o+2]=(v>>>16)&255;a[o+3]=(v>>>24)&255}
function _concatBytes(parts){let n=parts.reduce((s,x)=>s+x.length,0),out=new Uint8Array(n),p=0;for(const x of parts){out.set(x,p);p+=x.length}return out}
const _crcTable=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);t[n]=c>>>0}return t})();
function _crc32(a){let c=0xffffffff;for(let i=0;i<a.length;i++)c=_crcTable[(c^a[i])&255]^(c>>>8);return (c^0xffffffff)>>>0}
async function _deflateRaw(bytes){const cs=new CompressionStream('deflate-raw'),w=cs.writable.getWriter();w.write(bytes);w.close();return new Uint8Array(await new Response(cs.readable).arrayBuffer())}
async function _inflateRaw(bytes){const ds=new DecompressionStream('deflate-raw'),w=ds.writable.getWriter();w.write(bytes);w.close();return new Uint8Array(await new Response(ds.readable).arrayBuffer())}
function _findEOCD(a){for(let i=a.length-22;i>=Math.max(0,a.length-22-65535);i--)if(_u32(a,i)===0x06054b50)return i;throw new Error('ZIP central directory n\u00e3o encontrado')}
async function _readZipEntries(bytes){
  const e=_findEOCD(bytes),count=_u16(bytes,e+10),cdSize=_u32(bytes,e+12),cdOff=_u32(bytes,e+16),entries=[];let p=cdOff;
  for(let i=0;i<count;i++){
    if(_u32(bytes,p)!==0x02014b50)throw new Error('Entrada ZIP inv\u00e1lida');
    const method=_u16(bytes,p+10),crc=_u32(bytes,p+16),cs=_u32(bytes,p+20),us=_u32(bytes,p+24),nl=_u16(bytes,p+28),xl=_u16(bytes,p+30),cl=_u16(bytes,p+32),lo=_u32(bytes,p+42);
    const name=new TextDecoder().decode(bytes.slice(p+46,p+46+nl));
    const lh=lo,ln=_u16(bytes,lh+26),lx=_u16(bytes,lh+28),dataStart=lh+30+ln+lx;
    entries.push({name,method,crc,cs,us,central:bytes.slice(p,p+46+nl+xl+cl),local:bytes.slice(lh,dataStart),data:bytes.slice(dataStart,dataStart+cs),localOffset:lo});
    p+=46+nl+xl+cl;
  }
  return {entries,comment:bytes.slice(e+22,e+22+_u16(bytes,e+20))};
}
function _patchLocalHeader(local,crc,cs,us){const x=new Uint8Array(local);_put32(x,14,crc);_put32(x,18,cs);_put32(x,22,us);return x}
function _patchCentralHeader(central,crc,cs,us,offset){const x=new Uint8Array(central);_put32(x,16,crc);_put32(x,20,cs);_put32(x,24,us);_put32(x,42,offset);return x}
async function _rebuildZip(originalBytes,replacements){
  const z=await _readZipEntries(originalBytes),parts=[],centrals=[];let offset=0,entryCount=0;
  for(const e of z.entries){
    if(Object.prototype.hasOwnProperty.call(replacements,e.name) && replacements[e.name]===null) continue;
    let data=e.data,crc=e.crc,cs=e.cs,us=e.us;
    if(replacements[e.name]!==undefined){
      const raw=replacements[e.name] instanceof Uint8Array?replacements[e.name]:new TextEncoder().encode(replacements[e.name]);
      data=await _deflateRaw(raw);crc=_crc32(raw);cs=data.length;us=raw.length;
    }
    const local=_patchLocalHeader(e.local,crc,cs,us);parts.push(local,data);centrals.push(_patchCentralHeader(e.central,crc,cs,us,offset));offset+=local.length+data.length;entryCount++;
  }
  const cd=_concatBytes(centrals),body=_concatBytes(parts),comment=z.comment||new Uint8Array(0),end=new Uint8Array(22+comment.length);
  _put32(end,0,0x06054b50);_put16(end,4,0);_put16(end,6,0);_put16(end,8,entryCount);_put16(end,10,entryCount);_put32(end,12,cd.length);_put32(end,16,body.length);_put16(end,20,comment.length);end.set(comment,22);
  return _concatBytes([body,cd,end]);
}
function _xml(s){
  return String(s??'')
    .replace(/[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]/g,'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&apos;')
}
function _colName(n){let s='';while(n){let r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26)}return s}
function _cellStyleMap(rowXml){
  const map={};
  for(const m of rowXml.matchAll(/<c\s+r="([A-Z]+)2"([^>]*)>/g)){
    // Algumas células do modelo são autocontidas (<c .../>). O "/" final
    // não pode ser reaproveitado como atributo na nova célula.
    map[m[1]]=m[2].replace(/\/\s*$/,'');
  }
  return map;
}
function _inlineCell(ref,attrs,value){
  const a=attrs.replace(/\s+t="[^"]*"/g,'').replace(/\/\s*$/,'');
  if(value===''||value===null||value===undefined)return `<c r="${ref}"${a}/>`;
  if(typeof value==='number'&&Number.isFinite(value))return `<c r="${ref}"${a}><v>${value}</v></c>`;
  return `<c r="${ref}"${a} t="inlineStr"><is><t xml:space="preserve">${_xml(value)}</t></is></c>`;
}
function _numCell(ref,attrs,value){
  const a=attrs.replace(/\s+t="[^"]*"/g,'').replace(/\/\s*$/,'');
  return (value===''||value===null||value===undefined)?`<c r="${ref}"${a}/>`:`<c r="${ref}"${a}><v>${value}</v></c>`;
}
function _dateSerial(iso){if(!iso)return '';const p=String(iso).split('-');if(p.length!==3)return '';const d=new Date(Number(p[0]),Number(p[1])-1,Number(p[2]));return Math.floor((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(1899,11,30))/86400000)}
function _monthName(iso){if(!iso)return '';const p=String(iso).split('-');if(p.length!==3)return '';return new Date(Number(p[0]),Number(p[1])-1,Number(p[2])).toLocaleString('pt-BR',{month:'long'})}
function exportCSV(){
 const allCodes=[...new Set(Object.values(QUESTION_SETS).flatMap(x=>x.questions.map(q=>q.code)))];
 const head=["ID","Data","Local","Setor","Planta","Colaborador","Auditor","Situa\u00e7\u00e3o",...allCodes];
 const rows=[head,...state.records.map(r=>[r.id,r.data,r.local,r.setor,r.planta,r.colaborador,r.auditor,r.situacao,...allCodes.map(code=>r.answers?.[code]||"")])];
 const csv=rows.map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\n");
 const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));a.download="auditorias_exportadas.csv";a.click();
}
/* ===== IMPORTAÇÃO DE PDF GERADO PELO SISTEMA ===== */
let _pdfJsPromise=null;
function loadPdfJs(){
  if(window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if(_pdfJsPromise) return _pdfJsPromise;
  _pdfJsPromise=new Promise((resolve,reject)=>{
    const sources=[
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js'
    ];
    let idx=0;
    const tryNext=()=>{
      if(idx>=sources.length){reject(new Error('N\u00e3o foi poss\u00edvel carregar o leitor de PDF. Conecte o computador \u00e0 internet na primeira importa\u00e7\u00e3o do PDF e tente novamente.'));return;}
      const sc=document.createElement('script'); sc.src=sources[idx++];
      sc.onload=()=>{if(window.pdfjsLib){try{window.pdfjsLib.GlobalWorkerOptions.workerSrc='';}catch(e){} resolve(window.pdfjsLib);}else tryNext();};
      sc.onerror=tryNext; document.head.appendChild(sc);
    };
    tryNext();
  });
  return _pdfJsPromise;
}
function normalizePdfText(s){
  return String(s||'').replace(/\u00a0/g,' ').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim();
}
function decodeImportMarker(text){
  const raw=String(text||'').replace(/\u00a0/g,' ').replace(/[\u200B-\u200D\uFEFF]/g,' ');
  const tryDecode=(b64)=>{
    try{
      let b=String(b64||'').replace(/\s+/g,'').replace(/-/g,'+').replace(/_/g,'/').replace(/[^A-Za-z0-9+/=]/g,'');
      while(b.length%4)b+='=';
      const json=decodeURIComponent(escape(atob(b)));
      const obj=JSON.parse(json);
      if(obj?.records) return obj;
    }catch(e){}
    return null;
  };
  const extract=(version)=>{
    // PDF.js/Chrome/Excel podem converter "_" em espaço na camada de texto.
    const re=new RegExp('AUDITORIA(?:_|\\s)+IMPORT(?:_|\\s)+'+version+'(?:_|\\s)*\\|','i');
    const m=re.exec(raw); if(!m)return null;
    let payload=raw.slice(m.index+m[0].length);
    const markerEnd=payload.search(/Gerado pelo sistema de auditorias/i);
    if(markerEnd>=0)payload=payload.slice(0,markerEnd);
    return tryDecode(payload);
  };
  let obj=extract('V6'); if(obj)return obj;
  obj=extract('V5'); if(obj)return obj;
  obj=extract('V4'); if(obj)return obj;
  obj=extract('V3'); if(obj)return obj;
  // V2 particionado
  const parts=[]; const re=/AUDITORIA(?:_|\\s)+IMPORT(?:_|\\s)+V2(?:_|\\s)+PART_(\\d+)_(\\d+)\\|([A-Za-z0-9+/=_-]+)\\|ENDPART\\|/gi; let x;
  while((x=re.exec(raw))) parts.push({n:Number(x[1]),total:Number(x[2]),b64:x[3]});
  if(parts.length){
    parts.sort((a,b)=>a.n-b.n); const total=parts[0].total;
    if(parts.length===total && parts.every((p,i)=>p.n===i+1 && p.total===total)){
      obj=tryDecode(parts.map(p=>p.b64).join('')); if(obj)return obj;
    }
  }
  obj=extract('V2'); if(obj)return obj;
  return null;
}
function inferAuditorFromPdf(text){
  const t=normalizePdfText(text);
  let m=t.match(/Relat\u00f3rio\s+de\s+Auditoria\s*[\u2014-]\s*(.+?)(?=\s+Hist\u00f3rico\s+de\s+auditorias|$)/i);
  if(m)return m[1].replace(/\s*#\s*$/,'').trim();
  m=t.match(/Auditor\s*[:\-]?\s*(.+?)(?=\s+(?:Situa\u00e7\u00e3o|Data|Local|Setor|Colaborador|Pergunta)\b|$)/i);
  return (m?.[1]||'').replace(/\s*#\s*$/,'').trim();
}
function pdfAnswerAfterQuestion(block,q){
  const phrase=normalizePdfText(q.text).toLowerCase();
  const b=normalizePdfText(block).toLowerCase();
  const pos=b.indexOf(phrase);
  if(pos<0)return '';
  const tail=b.slice(pos+phrase.length).replace(/^[:;,.\-\u2013\u2014\s]+/,'');
  const m=tail.match(/^(A|P|N)(?=\s|$|[|;,:])/i);
  return m?m[1].toUpperCase():'';
}
function parseLegacyAuditorPdf(text){
  const full=normalizePdfText(text);
  const detectedPlant=/Auditoria\s+Escalonada\s*\(\s*Fundi\u00e7\u00e3o\s*\)/i.test(full)||/\bFundi\u00e7\u00e3o\b/i.test(full)&&!/\bUsinagem\b/i.test(full) ? "FUNDI\u00c7\u00c3O" : "USINAGEM";
  const auditor=inferAuditorFromPdf(full);
  const records=[];
  const dateToken='(?:\\d{1,2}\\/\\d{1,2}\\/\\d{4}|\\d{4}-\\d{2}-\\d{2})';
  // Divide pelo início de cada auditoria. Aceita tanto tabelas quanto PDFs antigos.
  const starts=[]; const re=new RegExp('(?:Data\\s*[:\\-]?\\s*)?('+dateToken+')\\s+Local\\s*[:\\-]?','gi'); let m;
  while((m=re.exec(full))) starts.push({index:m.index,date:m[1]});
  if(!starts.length){
    // Alguns PDFs imprimem os rótulos separados por outros textos.
    const re2=new RegExp('Data\\s*[:\\-]?\\s*('+dateToken+')','gi');
    while((m=re2.exec(full))) starts.push({index:m.index,date:m[1]});
  }
  if(!starts.length){
    const re3=new RegExp('('+dateToken+')\\s+(?=Local\\b|Setor\\b|Colaborador\\b)','gi'); let m3;
    while((m3=re3.exec(full))) starts.push({index:m3.index,date:m3[1]});
  }
  for(let i=0;i<starts.length;i++){
    const x=starts[i], block=full.slice(x.index, starts[i+1]?.index||full.length);
    const get=(label,nextLabels)=>{
      const stop=nextLabels.join('|');
      const rg=new RegExp(label+'\\s*[:\\-]?\\s*(.+?)(?=\\s+(?:'+stop+')\\s*[:\\-]?|$)','i');
      const z=block.match(rg); return z?z[1].trim():'';
    };
    const date=normalizeDate(x.date||get('Data',['Local','Setor','Colaborador']));
    const local=get('Local',['Setor','Colaborador','Auditor','Data']);
    const setor=get('Setor',['Colaborador','Auditor','Data']);
    const colaborador=get('Colaborador',['Auditor','Data','Pergunta']);
    const auditorBlock=(get('Auditor',['Situa\u00e7\u00e3o','Data','Pergunta','Local','Setor','Colaborador'])||auditor).replace(/\s*#\s*$/,'').trim();
    const plantaMatch=block.match(/Planta\s*[:\-]?\s*(.+?)(?=\s+(?:Local|Setor|Colaborador|Auditor|Data)\s*[:\-]?|$)/i);
    const planta=plantaMatch?plantaMatch[1].trim():'';
    const recPlant=normalizePlantName(planta)||detectedPlant; const qs=getQuestionsForPlant(recPlant);
    const rec={id:'PDF-'+[date,local,colaborador,auditorBlock,i].join('|'),local,setor,planta:recPlant,questionSet:recPlant,colaborador,auditor:auditorBlock||auditor,situacao:'',data:date,answers:{},justificativas:{},acoesTomadas:{}};
    qs.forEach(q=>{
      const v=pdfAnswerAfterQuestion(block,q);
      if(v)rec.answers[q.code]=v;
    });
    // Fallback: captura sequências A/P/N próximas ao texto das perguntas mesmo quando a tabela quebra.
    if(!Object.keys(rec.answers).length){
      qs.forEach(q=>{
        const rx=new RegExp(q.code+'\\s*[\\)\\.:\\-]?[^A-Za-z0-9]{0,20}(.{0,300}?)\\b([APN])\\b','i');
        const z=block.match(rx); if(z)rec.answers[q.code]=z[2].toUpperCase();
      });
    }
    if(local||setor||colaborador||Object.keys(rec.answers).length) records.push(rec);
  }
  // Se não encontrou cabeçalhos Data/Local, tenta construir uma única auditoria pelo conteúdo do PDF.
  if(!records.length && (auditor||/Relat\u00f3rio\s+de\s+Auditoria/i.test(full))){
    const dm=full.match(new RegExp('(?:Data\\s*[:\\-]?\\s*)?('+dateToken+')','i'));
    const date=dm?normalizeDate(dm[1]):'';
    const getGlobal=(label,nextLabels)=>{
      const stop=nextLabels.join('|');
      const z=full.match(new RegExp(label+'\\s*[:\\-]?\\s*(.+?)(?=\\s+(?:'+stop+')\\s*[:\\-]?|$)','i'));
      return z?z[1].trim():'';
    };
    const local=getGlobal('Local',['Setor','Colaborador','Auditor','Data']);
    const setor=getGlobal('Setor',['Colaborador','Auditor','Data']);
    const colaborador=getGlobal('Colaborador',['Auditor','Data','Pergunta']);
    const pm=full.match(/Planta\s*[:\-]?\s*(.+?)(?=\s+(?:Local|Setor|Colaborador|Auditor|Data)\s*[:\-]?|$)/i);
    const planta=pm?pm[1].trim():'';
    const recPlant=normalizePlantName(planta)||detectedPlant; const qs=getQuestionsForPlant(recPlant);
    const rec={id:'PDF-'+[date,local,colaborador,auditor,Date.now()].join('|'),local,setor,planta:recPlant,questionSet:recPlant,colaborador,auditor,situacao:'',data:date,answers:{},justificativas:{},acoesTomadas:{}};
    qs.forEach(q=>{const v=pdfAnswerAfterQuestion(full,q);if(v)rec.answers[q.code]=v;});
    if(local||setor||colaborador||date||Object.keys(rec.answers).length)records.push(rec);
  }
  return {records,mode:'texto'};
}
async function extractPdfText(file){
  const lib=await loadPdfJs();
  // PDF.js moderno expõe getDocument em pdfjsLib. Alguns navegadores deixam o módulo
  // disponível apenas como global após o carregamento; cobrimos os dois casos.
  const api=lib||window.pdfjsLib;
  if(!api?.getDocument)throw new Error('Leitor de PDF indispon\u00edvel.');
  const data=new Uint8Array(await file.arrayBuffer());
  // Importação leve: evita criar um WebWorker adicional do PDF.js.
  // Isso reduz bastante o pico de memória no Chrome para PDFs gerados pelo sistema.
  const loadingTask=api.getDocument({
    data,
    disableWorker:true,
    disableAutoFetch:true,
    disableStream:true,
    useWorkerFetch:false,
    isEvalSupported:false,
    verbosity:0
  });
  const pdf=await loadingTask.promise;
  let all='';
  const MAX_TEXT=1024*1024;
  for(let p=1;p<=Math.min(pdf.numPages,20);p++){
    const page=await pdf.getPage(p);
    const content=await page.getTextContent({disableCombineTextItems:false});
    const items=(content.items||[]).map(it=>String(it.str||'')).filter(Boolean);
    all+='\n'+items.join(' ')+'\n';
    try{page.cleanup();}catch(e){}
    if(all.length>=MAX_TEXT){ all=all.slice(0,MAX_TEXT); break; }
  }
  try{await pdf.cleanup?.();}catch(e){}
  try{await loadingTask.destroy();}catch(e){}
  return all;
}
async function importAuditorPDF(ev){
  const files=Array.from(ev.target.files||[]);
  ev.target.value='';
  if(!files.length)return;
  const allImported=[]; const problems=[]; let markerCount=0;
  try{
    if(files.length>20){ throw new Error('Selecione no m\u00e1ximo 20 PDFs por vez para manter a importa\u00e7\u00e3o est\u00e1vel.'); }
    for(const file of files){
      if(!/\.pdf$/i.test(file.name)){problems.push(file.name+': n\u00e3o \u00e9 PDF');continue;}
      try{
        const text=await extractPdfText(file);
        if(!text.trim()){problems.push(file.name+': PDF sem texto selecion\u00e1vel');continue;}
        let parsed=decodeImportMarker(text);
        let imported=[];
        if(parsed?.records?.length){
          markerCount++;
          imported=(parsed.records||[]).map((r,i)=>{const qp=normalizePlantName(r.questionSet||r.planta)||inferPlant(r);return {...r,id:r.id||'PDF-'+Date.now()+'-'+i,planta:qp,questionSet:qp,answers:r.answers||{},justificativas:r.justificativas||{},acoesTomadas:r.acoesTomadas||{}};});
        }else{
          parsed=parseLegacyAuditorPdf(text);
          imported=parsed.records||[];
        }
        if(imported.length) allImported.push(...imported);
        else problems.push(file.name+': n\u00e3o foram encontradas auditorias');
      }catch(e){problems.push(file.name+': '+(e?.message||e));}
    }
    if(!allImported.length){
      alert('O PDF foi lido, mas nenhuma auditoria p\u00f4de ser identificada.\n\nDica: gere um novo PDF pelo bot\u00e3o \u201cGerar PDF do auditor\u201d desta vers\u00e3o e importe novamente.\n\nArquivos: '+problems.join('\n'));
      return;
    }
    const {added,skipped}=mergeRecords(allImported);
    saveState();
    alert(`${allImported.length} auditoria(s) identificada(s). ${added} nova(s) adicionada(s) ao hist\u00f3rico${skipped?`; ${skipped} duplicada(s) ignorada(s).`:'.'}${problems.length?`\n\nObserva\u00e7\u00f5es:\n${problems.join('\n')}`:''}`);
    renderHistorico(); updateSectorBadge();
    if(typeof renderDashboard==='function')renderDashboard();
  }catch(err){
    console.error(err);
    alert('N\u00e3o foi poss\u00edvel importar os PDFs. '+(err?.message||err));
  }
}
async function importExcel(ev){
 const file=ev.target.files[0]; if(!file)return;
 if(!window.XLSX){alert("Carregando leitor de Excel. Tente novamente em alguns segundos.");return;}
 const buf=await file.arrayBuffer(), wb2=XLSX.read(buf,{type:"array"}), ws2=wb2.Sheets["LAN\u00c7AMENTOS"]||wb2.Sheets[wb2.SheetNames[0]];
 const rows=XLSX.utils.sheet_to_json(ws2,{header:1,raw:true}); if(!rows.length){alert("Planilha vazia.");return;}
 const head=rows[0], idx={}; head.forEach((h,i)=>{if(h)idx[String(h).trim()]=i;});
 const imported=[];
 rows.slice(1).forEach((r,i)=>{
  if(!r[idx["Local"]])return;
  const loc=String(r[idx["Local"]]||"");
  const setorV=String(r[idx["Setor"]]||"");
  const plantaV=normalizePlantName(r[idx["Planta"]]||"")||inferPlant({local:loc,setor:setorV});
  const colabV=String(r[idx["Colaborador"]]||""),audV=String(r[idx["Auditor"]]||""),sitV=String(r[idx["Situa\u00e7\u00e3o"]]||""),dataV=normalizeDate(r[idx["Data"]]);
  const qs=getQuestionsForPlant(plantaV), qmap={};
  qs.forEach(q=>qmap[q.code]=head.findIndex(h=>String(h||"").trim().startsWith(q.code+")")));
  const rec={id:"IMP-"+[loc,colabV,audV,dataV,i].join("|"),local:loc,setor:setorV,planta:plantaV,questionSet:plantaV,colaborador:colabV,auditor:audV,situacao:sitV,data:dataV,answers:{},justificativas:{},acoesTomadas:{}};
  qs.forEach(q=>{let j=qmap[q.code];let v=j>=0?String(r[j]||"").trim().toUpperCase():"";if(["A","P","N"].includes(v))rec.answers[q.code]=v;});
  imported.push(rec);
 });
 const {added,skipped}=mergeRecords(imported);
 saveState();
 alert(`${added} auditoria(s) importada(s) e mescladas ao hist\u00f3rico.${skipped?` ${skipped} j\u00e1 existente(s) foram ignoradas (mesmo local/colaborador/auditor/data).`:""}`);
 location.reload();
}
function normalizeDate(v){if(!v)return ""; if(typeof v==="number"){let d=new Date(Math.round((v-25569)*86400*1000));return d.toISOString().slice(0,10);} let s=String(v);if(s.includes("/")){let p=s.split("/");if(p.length===3)return `${p[2].slice(-4)}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}`;}return s.slice(0,10);}
/* --- Backup/Mesclagem JSON: fluxo recomendado para consolidar auditorias de vários auditores/navegadores --- */
function mergeRecords(newRecords){
 const existingIds=new Set(state.records.map(r=>r.id));
 let added=0,skipped=0;
 (newRecords||[]).forEach(r=>{
  if(!r||!r.id||existingIds.has(r.id)){skipped++;return;}
  r.justificativas=r.justificativas||{}; r.acoesTomadas=r.acoesTomadas||{}; r.answers=r.answers||{};
  state.records.push(r); existingIds.add(r.id); added++;
 });
 return {added,skipped};
}
