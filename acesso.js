/* ============================================================
   Senha da aba Cadastros
   ============================================================ */
function cadastroLiberado(){try{return sessionStorage.getItem("cadastro_liberado")==="1";}catch(e){return false;}}
function askCadastroPassword(){
  closeMobileMenu();
  const m=document.getElementById("cadModal"), inp=document.getElementById("cadPass");
  document.getElementById("cadPassErr").textContent=""; inp.value="";
  m.classList.add("open"); setTimeout(()=>inp.focus(),50);
}
function closeCadastroPassword(){document.getElementById("cadModal")?.classList.remove("open");}
function submitCadastroPassword(){
  const v=document.getElementById("cadPass").value.trim();
  if(v===CADASTRO_SENHA){
    try{sessionStorage.setItem("cadastro_liberado","1");}catch(e){}
    closeCadastroPassword(); nav("cadastro");
  }else{
    document.getElementById("cadPassErr").textContent="Senha incorreta.";
    document.getElementById("cadPass").value=""; document.getElementById("cadPass").focus();
  }
}
