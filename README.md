# LetraDuelo 🎯

Jogo de palavras multiplayer em tempo real. Dois jogadores se enfrentam revelando uma palavra letra por letra.

## Como funciona

1. Uma palavra secreta é escolhida pelo sistema
2. Aparece apenas a primeira letra — o Jogador 1 digita qualquer palavra que começa com ela
3. Se acertar, uma nova letra é revelada (ex: "Q" → "QU") — agora é a vez do Jogador 2
4. Assim por diante, até alguém digitar a palavra secreta exata (ganha ponto!) ou errar (passa para nova palavra)
5. São 10 rodadas. Quem fizer mais pontos vence!

---

## Rodar localmente

### Pré-requisitos
- [Node.js 18+](https://nodejs.org/) instalado
- [VS Code](https://code.visualstudio.com/) (recomendado)

### Passo a passo

**1. Abra o terminal e entre na pasta do servidor:**
```bash
cd server
npm install
npm start
```
O servidor vai rodar em `http://localhost:3001`

**2. Abra o arquivo `public/index.html` no navegador**

Use a extensão **Live Server** do VS Code:
- Instale "Live Server" no VS Code (extensions: `ritwickdey.LiveServer`)
- Clique com botão direito em `public/index.html` → "Open with Live Server"
- O frontend abre em `http://localhost:5500`

**3. Para testar localmente com dois jogadores:**
- Abra duas abas no navegador com `http://localhost:5500`
- Um cria a sala, o outro entra com o mesmo código

---

## Deploy online (para jogar com seu amigo pela internet)

### Passo 1 — Backend no Render (gratuito)

1. Crie conta em [render.com](https://render.com)
2. Clique em **New → Web Service**
3. Conecte seu repositório GitHub
4. Configure:
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node
5. Clique em **Deploy**
6. Após o deploy, copie a URL (ex: `https://letraduelo-server.onrender.com`)

### Passo 2 — Atualizar a URL no frontend

Abra `public/index.html` e procure esta linha:

```javascript
: 'https://SEU-BACKEND.onrender.com'; // <- Coloque a URL do backend aqui após o deploy
```

Troque `SEU-BACKEND.onrender.com` pela URL real do seu servidor Render.

### Passo 3 — Frontend no Vercel (gratuito)

1. Crie conta em [vercel.com](https://vercel.com)
2. Clique em **Add New → Project**
3. Importe seu repositório GitHub
4. Configure:
   - **Framework Preset:** Other
   - **Root Directory:** `public`
   - Deixe o resto como está
5. Clique em **Deploy**
6. Sua URL pública será algo como `https://letraduelo.vercel.app`

### Passo 4 — Subir para o GitHub

```bash
git init
git add .
git commit -m "LetraDuelo inicial"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/letraduelo.git
git push -u origin main
```

---

## Estrutura do projeto

```
letraduelo/
├── public/
│   └── index.html      ← Frontend (HTML/CSS/JS puro)
├── server/
│   ├── index.js        ← Backend Node.js + Socket.io
│   └── package.json
├── vercel.json         ← Config do Vercel
├── render.yaml         ← Config do Render
└── README.md
```

---

## Tecnologias

- **Frontend:** HTML, CSS, JavaScript puro (sem frameworks)
- **Backend:** Node.js, Express, Socket.io
- **Deploy Frontend:** Vercel
- **Deploy Backend:** Render
