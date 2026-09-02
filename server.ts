import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // AI Assistant endpoint for answering fitness questions
  app.post("/api/assistant", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');

      const stream = await ai.interactions.create({
        model: "gemini-3.7-flash",
        input: prompt,
        system_instruction: "Você é um assistente especializado em nutrição e mundo fitness. Dê respostas curtas, precisas e em tom encorajador.",
        stream: true
      });

      for await (const event of stream) {
        if (event.event_type === "step.delta" && event.delta.type === "text" && event.delta.text) {
          res.write(event.delta.text);
        }
      }
      res.end();
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to generate response" });
      } else {
        res.write("\n[Erro na conexão]");
        res.end();
      }
    }
  });

  // AI Assistant endpoint for generating quick fitness posts
  app.post("/api/generate-post", async (req, res) => {
    try {
      const { topic, category } = req.body;
      const topicStr = topic ? `sobre ${topic}` : "sobre fitness, exercícios ou receitas saudáveis";
      
      let systemInstruction = "Você é um criador de conteúdo fitness. Retorne um JSON estrito com as chaves: 'title' (string), 'content' (string) e 'details' (string opcional para receitas ou notícias).";
      
      const interaction = await ai.interactions.create({
        model: "gemini-3.7-flash",
        input: `Crie um post engajador para minha rede social ${topicStr}. Retorne APENAS UM JSON VÁLIDO.
        Se a categoria for 'receita', inclua em 'details' informações como passo a passo e valor nutricional.
        Se a categoria for 'noticia', inclua em 'details' informações como fonte e tempo estimado de leitura.
        Categoria atual: ${category || 'dica'}`,
        system_instruction: systemInstruction,
      });

      let responseText = '';
      for (const step of interaction.steps) {
        if (step.type === 'model_output') {
          const textContent = step.content?.find(c => c.type === 'text');
          if (textContent && textContent.text) {
            responseText += textContent.text;
          }
        }
      }
      
      try {
        // Try parsing the text as JSON, stripping markdown block if present
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : responseText;
        const parsedData = JSON.parse(jsonStr);
        res.json(parsedData);
      } catch (parseError) {
        // Fallback if AI didn't return proper JSON
        res.json({ title: "", content: responseText.replace(/```json/g, "").replace(/```/g, "").trim(), details: "" });
      }
    } catch (error) {
      console.error("Error generating post:", error);
      res.status(500).json({ error: "Failed to generate post" });
    }
  });

  // AI endpoint for extracting nutrition summary from recipe
  app.post("/api/nutrition-summary", async (req, res) => {
    try {
      const { content } = req.body;
      if (!content) return res.status(400).json({ error: "Content is required" });
      
      const interaction = await ai.interactions.create({
        model: "gemini-3.7-flash",
        input: `Baseado nesta receita, crie um pequeno cartão visual de resumo nutricional com marcadores (ex: Calorias, Proteínas, Carboidratos, etc). Seja bem conciso. Use emojis.
        
        Receita:
        ${content}`,
        system_instruction: "Você é um nutricionista esportivo. Forneça apenas o resumo nutricional curto e estimado.",
      });

      let summary = '';
      for (const step of interaction.steps) {
        if (step.type === 'model_output') {
          const textContent = step.content?.find(c => c.type === 'text');
          if (textContent && textContent.text) summary += textContent.text;
        }
      }
      res.json({ summary: summary.trim() });
    } catch (error) {
      console.error("Error generating nutrition summary:", error);
      res.status(500).json({ error: "Failed to generate summary" });
    }
  });

// AI endpoint for meal suggestions based on macros
  app.post("/api/suggest-meal", async (req, res) => {
    try {
      const { macros } = req.body;
      if (!macros) return res.status(400).json({ error: "Macros are required" });
      
      const interaction = await ai.interactions.create({
        model: "gemini-3.7-flash",
        input: `Meus alvos restantes para hoje são:
        ${macros.calories} kcal
        ${macros.protein}g de Proteína
        ${macros.carbs}g de Carboidratos
        ${macros.fat}g de Gordura
        
        Por favor, sugira uma refeição saudável ou lanche que se encaixe (ou chegue muito perto) desses macros restantes. Inclua os ingredientes, modo de preparo e os macros estimados.
        Retorne no formato JSON com as chaves 'title' (string), 'recipe' (string), e 'estimatedMacros' (string).`,
        system_instruction: "Você é um nutricionista. Forneça receitas realistas e saudáveis. Retorne apenas JSON.",
      });

      let responseText = '';
      for (const step of interaction.steps) {
        if (step.type === 'model_output') {
          const textContent = step.content?.find(c => c.type === 'text');
          if (textContent && textContent.text) responseText += textContent.text;
        }
      }

      try {
        const jsonMatch = responseText.match(/```json\n([\s\S]*)\n```/) || responseText.match(/```\n([\s\S]*)\n```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : responseText;
        const parsedData = JSON.parse(jsonStr);
        res.json(parsedData);
      } catch (parseError) {
        res.json({ title: "Sugestão", recipe: responseText.replace(/```json/g, "").replace(/```/g, "").trim(), estimatedMacros: "" });
      }
    } catch (error) {
      console.error("Error generating meal suggestion:", error);
      res.status(500).json({ error: "Failed to suggest meal" });
    }
  });

  // Vite middleware for development

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      try {
        let template = await require('fs').promises.readFile(path.resolve('index.html'), 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
