# FitFeed AI 💪

Uma rede social fitness completa com recursos de IA generativa (postagens assistidas, dicas e chat).

## ⚠️ Sobre a Hospedagem no GitHub Pages

O GitHub Pages é uma excelente ferramenta para hospedar sites estáticos (apenas HTML, CSS e JS). No entanto, este projeto é **Full-Stack**. Ele possui um servidor backend em Node.js (`server.ts`) responsável por se comunicar de forma segura com a API do Gemini. 

**Se você hospedar no GitHub Pages, o site vai carregar, mas a Inteligência Artificial (dicas, geração de postagens) não vai funcionar.**

Para hospedar o site completo gratuitamente, recomendamos serviços focados em Full-Stack (como **Render**, **Railway** ou **Vercel**) ou o **Google Cloud Run**.

---

## 🚀 Como subir o código para o GitHub

Para guardar e gerenciar seu código no GitHub, siga estes passos:

1. **Crie um repositório no GitHub:**
   - Acesse [github.com](https://github.com/) e faça login.
   - Clique no botão verde **"New"** (ou "+ > New repository").
   - Dê um nome ao seu projeto (ex: `fitfeed-ai`), deixe-o como Público ou Privado e clique em **Create repository**. (Não inicialize com README, pois já criamos um).

2. **No terminal do seu computador (após exportar o código em ZIP do AI Studio e extraí-lo), rode:**
   ```bash
   git init
   git add .
   git commit -m "Commit inicial: FitFeed AI"
   git branch -M main
   # Substitua a URL abaixo pela URL do seu repositório recém-criado
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
   git push -u origin main
   ```

---

## 🌍 Como hospedar gratuitamente no Render (Recomendado)

O [Render](https://render.com) é perfeito para este projeto porque roda o backend Node.js (que se conecta com o Gemini) de forma nativa e gratuita.

1. Acesse [render.com](https://render.com) e faça login com seu GitHub.
2. Clique em **"New +"** e escolha **"Web Service"**.
3. Escolha **"Build and deploy from a Git repository"** e conecte o repositório que você acabou de criar.
4. Preencha as configurações:
   - **Name:** fitfeed-ai
   - **Environment:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
5. Em **Environment Variables** (Variáveis de Ambiente), adicione a chave secreta da IA:
   - Key: `GEMINI_API_KEY`
   - Value: `(Cole aqui a sua chave do Google Gemini)`
6. Clique em **Create Web Service**. 

Em poucos minutos seu aplicativo estará no ar e 100% funcional, incluindo o Firebase e a Inteligência Artificial!
