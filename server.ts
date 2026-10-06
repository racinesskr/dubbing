import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { synthesizeSingleTts, synthesizeMultiTts } from "./server/ttsCore.ts";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "10mb" }));

  app.post("/api/tts/generate", async (req, res) => {
    try {
      const result = await synthesizeSingleTts(req.body || {});
      res.json(result);
    } catch (error: unknown) {
      console.error("TTS generation error:", error);
      const message =
        error instanceof Error
          ? error.message
          : "음성 합성 중 오류가 발생했습니다.";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/tts/generate-multi", async (req, res) => {
    try {
      const result = await synthesizeMultiTts(req.body || {});
      res.json(result);
    } catch (error: unknown) {
      console.error("Multi-TTS generation error:", error);
      const message =
        error instanceof Error
          ? error.message
          : "멀티 보이스 음성 합성 중 오류가 발생했습니다.";
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Voice Atelier Server listening on http://localhost:${PORT}`);
  });
}

startServer();
