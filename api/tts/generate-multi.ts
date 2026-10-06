import type { Request, Response } from "express";
import { synthesizeMultiTts } from "../../server/ttsCore.ts";

export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST 요청만 지원합니다." });
    return;
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const result = await synthesizeMultiTts(body);
    res.status(200).json(result);
  } catch (error: unknown) {
    console.error("Multi-TTS generation error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "멀티 보이스 음성 합성 중 오류가 발생했습니다.";
    res.status(500).json({ error: message });
  }
}
