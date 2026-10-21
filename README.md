# Auditorias Escalonadas

Sistema de auditorias escalonadas (Usinagem e Fundicao). Funciona direto no GitHub Pages.

## Como publicar no GitHub
1. Envie **a pasta inteira** para a raiz do repositorio: `index.html`, `css/`, `js/`, `data/`, `assets/` e `.nojekyll`.
2. Em **Settings > Pages**, deixe a branch `main` e a pasta `/ (root)`.
3. No Firebase Console, em **Authentication > Settings > Authorized domains**, adicione o dominio do GitHub Pages.
4. Ao publicar uma nova versao, aumente o valor de `V` no inicio de `js/carregador.js` e o `?v=` dos `<link>` no `index.html` (evita o navegador usar arquivos antigos).

> Nao abra o `index.html` com duplo clique: os dados sao lidos de arquivos `.json`, que o navegador so permite por um servidor (GitHub Pages ou `python -m http.server` dentro da pasta).

## Estrutura
| Pasta / arquivo | Conteudo |
|---|---|
| `index.html` | Estrutura das telas |
| `css/` | Estilos: `base`, `componentes`, `tema-indi`, `historico`, `tema-funcional`, `ajuda`, `mobile`, `gerencial` (a ordem importa) |
| `data/*.json` | Dados editaveis: perguntas (Usinagem/Fundicao), locais, colaboradores, auditores e plantas permitidas, historico inicial e configuracao do Firebase |
| `js/carregador.js` | Le os JSON e carrega os scripts abaixo, na ordem |
| `js/online.js` | Sincronizacao com o Firebase |
| `js/armazenamento.js` | Regras de planta, perguntas, pontuacao (A=100, P=50, N=0, N.A. fora) e salvar dados |
| `js/backup.js` | Backup, copias automaticas, exportar/importar JSON |
| `js/acesso.js` | Senha da aba Cadastros |
| `js/navegacao.js`, `auditoria.js`, `dashboard.js`, `pendencias.js`, `historico.js`, `cadastros.js`, `programacao.js`, `relatorios.js`, `exportacao.js` | Uma tela/assunto por arquivo |
| `js/gerencial.js` | Auditoria Gerencial: cadastro de gestores/diretores, programacao mensal, nova auditoria, resultados |
| `js/tema.js` | Tema claro/escuro |
| `js/estado.js`, `js/inicio.js` | Carga do estado inicial e partida do sistema (devem ficar por ultimo) |
| `assets/logo.png` | Logotipo |

## Onde alterar o que
- **Colaboradores / auditores padrao:** `data/colaboradores.json`, `data/auditores.json` (so valem em um navegador novo, sem dados salvos).
- **Perguntas:** `data/perguntas-usinagem.json` e `data/perguntas-fundicao.json`.
- **Perguntas da Auditoria Gerencial:** `data/perguntas-gerencial.json` (as que vieram sao so exemplo; mantenha `code`, `category` e `text`). Se trocar perguntas depois de ja haver auditorias, use codigos novos para nao misturar com o historico.
- **Gestores e diretores:** cadastrados pela tela, em Cadastros > Gestores/Diretores (`data/gestores.json` so serve de lista inicial).
- **Firebase:** `data/firebase-config.json`.
- **Senha da aba Cadastros:** constante `CADASTRO_SENHA` em `js/estado.js` (protecao simples, nao e seguranca real).

## Auditoria Gerencial
- Unidade auditada = cada **setor** (por planta), uma vez por mes; o rodizio e sorteado, equilibrado entre os responsaveis e evita repetir o mesmo responsavel/setor do mes anterior.
- Os registros ficam em `state.mgrRecords` e, no Firebase, na mesma colecao `audit_records` com `tipo: "gerencial"` (nao precisa mudar as regras do Firestore). Gestores e programacao vao nos documentos `audit_app/config` e `audit_app/schedule`.
- Entram no backup (Backup > Exportar) e nas copias automaticas.
