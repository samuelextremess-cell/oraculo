# EVERYTHING_CONTEXT — Projeto Oráculo

> Documento de contexto completo. Cole este arquivo no início de qualquer conversa com uma IA para que ela entenda o projeto sem reexplicações.

---

## 🔮 Visão do Projeto

O **Oráculo** é uma interface central de chat com múltiplos modelos de IA, com roteamento inteligente automático, voz bidirecional, persistência de histórico e auto-melhoria de código. Roda como PWA, funciona offline e faz deploy automático via GitHub + Vercel.

**Objetivo:** ser o hub pessoal de IA do desenvolvedor — acessível de qualquer dispositivo, sem depender de um único modelo ou serviço.

---

## 🏗️ Arquitetura

```
Navegador (HTML/CSS/JS vanilla + PWA)
      ↓  chamadas fetch para /api/*
Vercel Serverless Functions (pasta /api/)
      ↓
┌──────────────────────────────────────────┐
│  DeepSeek API   │  Hugging Face API      │
│  (programação)  │  (outros modelos)      │
└──────────────────────────────────────────┘
      ↓
localStorage (histórico) + GitHub (backup)
      ↓
Vercel (deploy automático via autopush)
```

**Por que serverless?** Tokens (`DS_TOKEN`, `HF_TOKEN`, `GITHUB_TOKEN`) ficam apenas nas variáveis de ambiente do Vercel. O frontend chama `/api/*` e cada rota é uma função serverless independente na pasta `/api/`.

---

## ⚙️ Stack

| Camada | Tecnologia |
|---|---|
| Frontend | HTML5 + CSS3 + JavaScript vanilla |
| Backend (local) | Node.js + Express (`server.js`) |
| Backend (produção) | Vercel Serverless Functions (`/api/*.js`) |
| Estado | `chatHistory[]` + `localStorage` (`oraculoHistory`) |
| IA principal | DeepSeek API (`/v1/chat/completions`) |
| IA auxiliar | Hugging Face Inference API |
| Roteamento | `detectBestModel()` — análise de palavras-chave |
| Voz | Web Speech API nativa (STT + TTS) |
| Persistência | `localStorage` + export/import JSON + backup GitHub |
| Deploy | Vercel (auto-deploy no push para `main`) |
| PWA | Service Worker + manifest.json + ícone SVG |

---

## 📁 Estrutura de Pastas

```
oraculo/
├── public/                    # Arquivos estáticos (servidos pelo Vercel)
│   ├── index.html             # Frontend completo (CSS + JS inline)
│   ├── manifest.json          # Config PWA
│   ├── service-worker.js      # Service Worker (cache-first)
│   └── icon.svg               # Ícone PWA
├── api/                       # Vercel Serverless Functions
│   ├── _lib.js                # Funções compartilhadas (callDeepSeek, etc.)
│   ├── chat/
│   │   ├── deepseek.js        # POST /api/chat/deepseek
│   │   ├── auto.js            # POST /api/chat/auto
│   │   └── huggingface.js     # POST /api/chat/huggingface
│   ├── models.js              # GET /api/models
│   ├── github/
│   │   └── save.js            # POST /api/github/save
│   └── improve/
│       ├── analyze.js         # POST /api/improve/analyze
│       └── apply.js           # POST /api/improve/apply
├── server.js                  # Express (dev local)
├── vercel.json                # Config de rotas Vercel
├── package.json               # Dependências: express, dotenv
├── .env / .env.example        # Tokens (local)
├── .gitignore
├── autopush.ps1 / .bat        # Auto-push scripts
└── EVERYTHING_CONTEXT.md      # Este arquivo
```

---

## 🧠 Rotas do Servidor (server.js)

| Método | Rota | Função |
|---|---|---|
| `POST` | `/api/chat/deepseek` | `callDeepSeek(prompt)` → resposta da API oficial |
| `POST` | `/api/chat/auto` | `detectBestModel(prompt)` → DeepSeek ou HF com fallbacks |
| `POST` | `/api/chat/huggingface` | `callHuggingFace(modelId, prompt)` → modelo HF específico |
| `GET` | `/api/models` | Lista top 18 modelos text-generation do HuggingFace |
| `POST` | `/api/github/save` | Commit do histórico no repositório configurado |
| `GET` | `/api/source` | Retorna conteúdo de `index.html` e `server.js` |
| `POST` | `/api/improve/analyze` | Envia código para DeepSeek → sugestões de melhoria |
| `POST` | `/api/improve/apply` | DeepSeek reescreve arquivos → `writeFileSync` |
| `GET` | `/*` | `express.static(__dirname)` — serve arquivos estáticos |

---

## 🤖 Modelos de IA

### callDeepSeek(userText, opts)
- Endpoint: `https://api.deepseek.com/v1/chat/completions`
- Modelo: `deepseek-chat`, system message em pt-BR
- Options: `{ systemMessage, maxTokens }` (default 1000)
- Usado para: programação, raciocínio, auto-melhoria

### callHuggingFace(modelId, userText)
- Endpoint: `https://api-inference.huggingface.co/models/{modelId}`
- `max_new_tokens: 500`
- Trata 3 formatos de resposta: array, objeto com `generated_text`, chat (`choices[0].message.content`)

### detectBestModel(prompt) — Roteamento automático

| Condição | Palavras-chave | Modelo |
|---|---|---|
| Programação | código, python, js, api, git, docker, sql... | `__deepseek__` |
| Tradução | traduz, translate, "em inglês"... | `google/flan-t5-large` |
| Mensagem curta | `< 30 caracteres` | `microsoft/DialoGPT-medium` |
| Criativo | história, poema, ficção, personagem... | `mistralai/Mistral-7B-Instruct-v0.2` |
| Padrão | — | `__deepseek__` |

### Seletor de modelos HuggingFace
- Carregados dinamicamente via `GET /api/models` na inicialização
- `<optgroup>` no `<select>` populado com IDs dos modelos
- Fallback: se API falhar, mostra "⚠️ Falha ao carregar modelos"

---

## 🎤 Sistema de Voz

### Speech-to-Text (STT)
- `toggleVoice()` — ativa/desativa via botão 🎤
- `SpeechRecognition` com `interimResults: true`
- Resultado final → preenche input + `sendMessage()` automático
- Feedback visual: barra de ondas animadas + botão pulsante vermelho

### Text-to-Speech (TTS)
- `speakText(text)` — sintetiza resposta do bot
- `SpeechSynthesisUtterance`, `lang: pt-BR`, `rate: 1.05`
- Toggle 🔊 (checkbox) — só fala se ativo
- Cancela fala anterior antes de iniciar nova

---

## 💾 Persistência e Estado

### chatHistory[] (estado em memória)
```javascript
{ role, text, model, error, time }
```
- `pushMessage(role, text, model, error)` — adiciona ao array + salva + renderiza
- `getMessages()` — retorna array limpo para export/GitHub

### localStorage (`oraculoHistory`)
- `saveHistory()` — `JSON.stringify(chatHistory)` a cada alteração
- `loadHistory()` — restaura no `DOMContentLoaded`
- `renderHistory()` — reconstrói DOM a partir do array (ou mostra welcome se vazio)

### Export/Import JSON
- `exportHistory()` — baixa `oraculo-backup-YYYY-MM-DD.json`
- `importHistory(event)` — **mescla** com histórico existente (`concat`)

### Backup GitHub
- `saveToGithub()` → `POST /api/github/save` — commit em `chats/oraculo-{timestamp}.json`
- `autopush.ps1` — loop de 30s: detecta mudanças → `git add . && git commit && git push`

---

## 🔧 Auto-melhoria

- `selfImprove()` — botão 🔧 Melhorar na toolbar
- Fluxo: analisa código → mostra sugestões no chat → botão ✅ Aplicar → DeepSeek reescreve → `writeFileSync`
- Segurança: whitelist de arquivos (`index.html`, `server.js`)
- `escapeHtml()` em toda renderização de texto do usuário (anti-XSS)

---

## 📱 PWA

- **manifest.json:** `display: standalone`, `theme_color: #8b5cf6`, `background_color: #07050d`, ícone SVG
- **service-worker.js:** precache (`/`, `/manifest.json`, `/icon.svg`), cache-first para GET estáticos, ignora `/api/*`
- **iOS:** meta tags `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`

---

## 🎨 Tema Visual

- Fundo: `#07050d` (preto profundo com gradientes radiais roxos/dourados)
- Superfície: `#100c1a`, bordas: `#2e2540`
- Acento principal: roxo `#8b5cf6` com glow `#a78bfa`
- Acento secundário: dourado `#d4a853` (cabeçalho com shimmer animado)
- Mensagens: usuário (roxo à direita), bot (card escuro à esquerda com tag do modelo)
- Animações: `msg-in` (fade+slide), `dot-blink` (digitando), `float` (orb welcome), `shimmer` (título)

---

## 🚀 Deploy e Fluxo de Trabalho

### Desenvolvimento local
```bash
npm install
npm start
# Acesse http://localhost:3000
```

### Auto-push para produção
```
1. Abrir autopush.bat (dois cliques)
2. Fazer alterações
3. Em até 30s → commit + push automático → Vercel deploia
```

### URLs
- **Local:** `http://localhost:3000`
- **Produção:** `https://oraculo-kappa-indol.vercel.app`
- **Repositório:** `https://github.com/samuelextremess-cell/oraculo` (privado)

---

## 📋 Regras do Projeto

1. **Sem dependências pagas** — tudo free tier
2. **Tokens no servidor** — nunca expostos ao frontend (`.env` + `process.env`)
3. **Single repo** — tudo no `samuelextremess-cell/oraculo`
4. **Deploy automático** — qualquer push no `main` dispara o Vercel
5. **Modelos flexíveis** — nunca depender de um único provedor de IA
6. **PWA first** — deve funcionar instalado no celular

---

## 🧠 Memória Permanente

> Atualize esta seção conforme o projeto evolui.

- Projeto iniciado em Junho/2026
- Stack real: HTML/CSS/JS vanilla + Node.js/Express proxy
- Desenvolvido 100% via prompts no OpenCode (DeepSeek V4 Pro)
- Repositório privado no GitHub: `samuelextremess-cell/oraculo`
- Deploy em: `oraculo-kappa-indol.vercel.app`
- Desenvolvedor: samuelextremess-cell (São Paulo, Brasil)

---

## 💬 Prompts Padrão para OpenCode

### Continuar o projeto
```
Leia o EVERYTHING_CONTEXT.md e continue o desenvolvimento do Oráculo. Stack: HTML/CSS/JS vanilla + Node.js/Express proxy. Tokens via process.env no servidor.
```

### Adicionar feature
```
Com base no EVERYTHING_CONTEXT.md, adicione [FEATURE] ao Oráculo. Mantenha compatibilidade com o sistema de voz, localStorage, roteamento automático e o proxy Express.
```

### Debug
```
Analise o código do Oráculo (server.js + index.html) com base no EVERYTHING_CONTEXT.md e identifique o problema: [DESCRIÇÃO].
```

---

*Última atualização: Junho 2026*
