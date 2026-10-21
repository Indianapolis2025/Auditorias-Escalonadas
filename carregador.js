/* ============================================================
   Carregador: busca os dados (JSON) e depois carrega os scripts
   do sistema, um por vez e na ordem certa.
   ============================================================ */
(function(){
  var V="20261021-5"; // aumente este valor ao publicar uma nova versao (evita cache antigo)
  var SCRIPTS=["online","armazenamento","backup","acesso","navegacao","auditoria","dashboard","pendencias","historico","cadastros","programacao","relatorios","exportacao","dashextra","gerencial","tema","estado","inicio"];
  var DADOS=["perguntas-usinagem","perguntas-fundicao","locais","historico-inicial","colaboradores","auditores","firebase-config","perguntas-gerencial","gestores"];

  function getJSON(nome){
    var u=nome+".json?v="+V;
    return fetch(u,{cache:"no-cache"}).then(function(r){
      if(!r.ok) throw new Error(nome+".json (HTTP "+r.status+")");
      return r.json();
    });
  }
  function loadScript(nome){
    return new Promise(function(ok,erro){
      var s=document.createElement("script");
      s.src=nome+".js?v="+V; s.async=false;
      s.onload=ok;
      s.onerror=function(){erro(new Error(nome+".js"));};
      document.head.appendChild(s);
    });
  }
  function falha(e){
    console.error("Falha ao carregar o sistema:",e);
    var d=document.createElement("div");
    d.style.cssText="position:fixed;inset:0;z-index:99999;background:#fff;color:#111;padding:28px;font:16px/1.5 Arial,sans-serif;overflow:auto";
    d.innerHTML="<h2>N\u00e3o foi poss\u00edvel carregar o sistema</h2>"+
      "<p>Arquivo com problema: <b>"+String(e&&e.message||e)+"</b></p>"+
      "<p>Confira se todos os arquivos (index.html, .css, .js, .json e logo.png) foram enviados ao GitHub, todos na raiz do reposit\u00f3rio, e aguarde alguns minutos para o GitHub Pages atualizar.</p>"+
      "<p>Se voc\u00ea abriu o <code>index.html</code> direto do computador, isso n\u00e3o funciona: publique no GitHub Pages ou abra por um servidor local (por exemplo, <code>python -m http.server</code> dentro da pasta).</p>";
    document.body.appendChild(d);
  }

  Promise.all(DADOS.map(getJSON)).then(function(d){
    window.INITIAL={questions:d[0].questions,categories:d[0].categories,sectors:d[2],records:d[3]};
    window.FUNDICAO_SET=d[1];
    window.DEFAULT_COLLABORATORS=d[4];
    window.DEFAULT_AUDITORS=d[5].padrao;
    window.AUDITOR_PLANT_RULES=d[5].plantas_permitidas;
    window.AUDIT_FIREBASE_DEFAULT=d[6];
    window.MGR_SET=d[7];
    window.DEFAULT_MANAGERS=d[8];
    return SCRIPTS.reduce(function(p,s){return p.then(function(){return loadScript(s);});},Promise.resolve());
  }).catch(falha);
})();
