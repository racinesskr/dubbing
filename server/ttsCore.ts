import { GoogleGenAI } from "@google/genai";
// @ts-ignore - @breezystack/lamejs does not ship strict TS declarations
import { Mp3Encoder } from "@breezystack/lamejs";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const ALLOWED_PREBUILT_VOICES = new Set([
  "Puck",
  "Charon",
  "Kore",
  "Fenrir",
  "Zephyr",
]);

interface NeuralVoicePreset {
  voiceName: string;
  basePitchHz: number;
  baseRate: number;
}

const NEURAL_VOICE_PRESETS: Record<string, NeuralVoicePreset> = {
  "seoyeon-female-anchor": {
    voiceName: "ko-KR-SunHiNeural",
    basePitchHz: 0,
    baseRate: 1.0,
  },
  "jia-female-lyric": {
    voiceName: "ko-KR-SunHiNeural",
    basePitchHz: -4,
    baseRate: 0.94,
  },
  "minjun-male-narrator": {
    voiceName: "ko-KR-InJoonNeural",
    basePitchHz: -6,
    baseRate: 0.95,
  },
  "hyunwoo-male-creator": {
    voiceName: "ko-KR-HyunsuMultilingualNeural",
    basePitchHz: 3,
    baseRate: 1.06,
  },
  "hajun-child-boy": {
    voiceName: "ko-KR-HyunsuMultilingualNeural",
    basePitchHz: 34,
    baseRate: 1.1,
  },
  "haeun-child-girl": {
    voiceName: "ko-KR-SunHiNeural",
    basePitchHz: 28,
    baseRate: 1.08,
  },
  "eunsu-storyteller": {
    voiceName: "ko-KR-SunHiNeural",
    basePitchHz: -6,
    baseRate: 0.92,
  },
  "taeseok-senior-sage": {
    voiceName: "ko-KR-InJoonNeural",
    basePitchHz: -12,
    baseRate: 0.88,
  },
};

const EMOTION_MODIFIERS: Record<string, { pitchDelta: number; rateMultiplier: number }> = {
  natural: { pitchDelta: 0, rateMultiplier: 1.0 },
  warm: { pitchDelta: -2, rateMultiplier: 0.96 },
  cheerful: { pitchDelta: 5, rateMultiplier: 1.06 },
  calm: { pitchDelta: -3, rateMultiplier: 0.95 },
  "fairy-tale": { pitchDelta: 6, rateMultiplier: 1.03 },
  whisper: { pitchDelta: -5, rateMultiplier: 0.9 },
};

const SPEED_MODIFIERS: Record<string, number> = {
  slow: 0.88,
  normal: 1.0,
  brisk: 1.12,
};

export function createWavHeader(
  dataLength: number,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);

  return header;
}

export function parseAudioBuffer(rawBuffer: Buffer): {
  wavBuffer: Buffer;
  pcmBuffer: Buffer;
  sampleRate: number;
  numChannels: number;
} {
  const isRiff =
    rawBuffer.length > 44 &&
    rawBuffer.toString("ascii", 0, 4) === "RIFF" &&
    rawBuffer.toString("ascii", 8, 12) === "WAVE";

  if (isRiff) {
    const numChannels = rawBuffer.readUInt16LE(22) || 1;
    const sampleRate = rawBuffer.readUInt32LE(24) || 24000;

    let offset = 12;
    let dataOffset = 44;
    let dataLength = rawBuffer.length - 44;

    while (offset + 8 <= rawBuffer.length) {
      const chunkId = rawBuffer.toString("ascii", offset, offset + 4);
      const chunkSize = rawBuffer.readUInt32LE(offset + 4);
      if (chunkId === "data") {
        dataOffset = offset + 8;
        dataLength = Math.min(chunkSize, rawBuffer.length - dataOffset);
        break;
      }
      offset += 8 + chunkSize;
    }

    const pcmBuffer = rawBuffer.subarray(dataOffset, dataOffset + dataLength);
    return {
      wavBuffer: rawBuffer,
      pcmBuffer,
      sampleRate,
      numChannels,
    };
  }

  const sampleRate = 24000;
  const numChannels = 1;
  const wavHeader = createWavHeader(rawBuffer.length, sampleRate, numChannels, 16);
  const wavBuffer = Buffer.concat([wavHeader, rawBuffer]);

  return {
    wavBuffer,
    pcmBuffer: rawBuffer,
    sampleRate,
    numChannels,
  };
}

export function encodePcmToMp3(
  pcmBuffer: Buffer,
  sampleRate: number,
  numChannels: number
): Buffer {
  const sampleCount = Math.floor(pcmBuffer.length / 2);
  const samples = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = pcmBuffer.readInt16LE(i * 2);
  }

  const mp3Encoder = new Mp3Encoder(numChannels, sampleRate, 128);
  const mp3Data: Uint8Array[] = [];
  const sampleBlockSize = 1152;

  if (numChannels === 1) {
    for (let i = 0; i < samples.length; i += sampleBlockSize) {
      const sampleChunk = samples.subarray(i, i + sampleBlockSize);
      const mp3buf = mp3Encoder.encodeBuffer(sampleChunk);
      if (mp3buf.length > 0) {
        mp3Data.push(new Uint8Array(mp3buf));
      }
    }
  } else {
    const left = new Int16Array(Math.floor(samples.length / 2));
    const right = new Int16Array(Math.floor(samples.length / 2));
    for (let i = 0; i < left.length; i++) {
      left[i] = samples[i * 2];
      right[i] = samples[i * 2 + 1];
    }
    for (let i = 0; i < left.length; i += sampleBlockSize) {
      const leftChunk = left.subarray(i, i + sampleBlockSize);
      const rightChunk = right.subarray(i, i + sampleBlockSize);
      const mp3buf = mp3Encoder.encodeBuffer(leftChunk, rightChunk);
      if (mp3buf.length > 0) {
        mp3Data.push(new Uint8Array(mp3buf));
      }
    }
  }

  const endBuf = mp3Encoder.flush();
  if (endBuf.length > 0) {
    mp3Data.push(new Uint8Array(endBuf));
  }

  return Buffer.concat(mp3Data.map((arr) => Buffer.from(arr)));
}

export function computeWaveformPeaks(pcmBuffer: Buffer, barCount = 68): number[] {
  const sampleCount = Math.floor(pcmBuffer.length / 2);
  if (sampleCount === 0) {
    return Array(barCount).fill(0.2);
  }

  const samplesPerBar = Math.max(1, Math.floor(sampleCount / barCount));
  const rawPeaks: number[] = [];
  let maxPeak = 0.01;

  for (let b = 0; b < barCount; b++) {
    const start = b * samplesPerBar;
    const end = Math.min(sampleCount, start + samplesPerBar);
    let sumSquares = 0;
    let count = 0;

    for (let i = start; i < end; i++) {
      const val = pcmBuffer.readInt16LE(i * 2) / 32768;
      sumSquares += val * val;
      count++;
    }

    const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;
    if (rms > maxPeak) maxPeak = rms;
    rawPeaks.push(rms);
  }

  return rawPeaks.map((p) => {
    const normalized = p / maxPeak;
    return Math.max(0.08, Math.min(1, Number(normalized.toFixed(3))));
  });
}

function computePeaksFromMp3Buffer(mp3Buffer: Buffer, barCount = 68): number[] {
  if (mp3Buffer.length === 0) return Array(barCount).fill(0.25);
  const step = Math.max(1, Math.floor(mp3Buffer.length / barCount));
  const peaks: number[] = [];
  let maxVal = 1;

  for (let i = 0; i < barCount; i++) {
    const start = i * step;
    const end = Math.min(mp3Buffer.length, start + step);
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j += 4) {
      const diff = Math.abs(mp3Buffer[j] - 128);
      sum += diff;
      count++;
    }
    const avg = count > 0 ? sum / count : 20;
    if (avg > maxVal) maxVal = avg;
    peaks.push(avg);
  }

  return peaks.map((p, idx) => {
    const ratio = p / maxVal;
    const waveShape = 0.75 + 0.25 * Math.sin(idx * 0.45);
    return Math.max(0.12, Math.min(0.98, Number((ratio * waveShape).toFixed(3))));
  });
}

function cleanTextForNeuralFallback(text: string): string {
  return text
    .replace(/<breath>/gi, ", ")
    .replace(/<laugh>/gi, " 하하, ")
    .replace(/<gasp>/gi, " 아! ")
    .replace(/\s+/g, " ")
    .trim();
}

async function generateEdgeNeuralMp3(params: {
  text: string;
  voiceId?: string;
  baseVoice?: string;
  emotionId?: string;
  speedId?: string;
}): Promise<Buffer> {
  const {
    text,
    voiceId = "",
    baseVoice = "Kore",
    emotionId = "natural",
    speedId = "normal",
  } = params;

  let preset = NEURAL_VOICE_PRESETS[voiceId];
  if (!preset) {
    if (baseVoice === "Charon") {
      preset = NEURAL_VOICE_PRESETS["minjun-male-narrator"];
    } else if (baseVoice === "Fenrir") {
      preset = NEURAL_VOICE_PRESETS["hyunwoo-male-creator"];
    } else if (baseVoice === "Puck") {
      preset = NEURAL_VOICE_PRESETS["hajun-child-boy"];
    } else if (baseVoice === "Zephyr") {
      preset = NEURAL_VOICE_PRESETS["jia-female-lyric"];
    } else {
      preset = NEURAL_VOICE_PRESETS["seoyeon-female-anchor"];
    }
  }

  const emotionMod = EMOTION_MODIFIERS[emotionId] || EMOTION_MODIFIERS.natural;
  const speedMod = SPEED_MODIFIERS[speedId] || 1.0;

  const finalPitch = preset.basePitchHz + emotionMod.pitchDelta;
  const pitchStr = `${finalPitch >= 0 ? "+" : ""}${finalPitch}Hz`;
  const finalRate = Number(
    (preset.baseRate * emotionMod.rateMultiplier * speedMod).toFixed(2)
  );

  const cleanedText = cleanTextForNeuralFallback(text);
  const tts = new MsEdgeTTS();
  await tts.setMetadata(
    preset.voiceName,
    OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
  );

  return new Promise<Buffer>((resolve, reject) => {
    const { audioStream } = tts.toStream(cleanedText, {
      pitch: pitchStr,
      rate: finalRate,
    });
    const chunks: Buffer[] = [];

    audioStream.on("data", (chunk: Buffer) => {
      chunks.push(Buffer.from(chunk));
    });
    audioStream.on("end", () => {
      try {
        tts.close();
      } catch {
        // ignore close error
      }
      resolve(Buffer.concat(chunks));
    });
    audioStream.on("error", (err: Error) => {
      try {
        tts.close();
      } catch {
        // ignore close error
      }
      reject(err);
    });
  });
}

export async function generateSingleVoiceGemini(
  text: string,
  voiceName: string,
  stylePrompt: string
): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("NO_GEMINI_KEY");
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  const safeVoice = ALLOWED_PREBUILT_VOICES.has(voiceName) ? voiceName : "Kore";
  const partWithMetadata: Record<string, unknown> = {
    text,
    speechMetadata: {
      style: stylePrompt,
    },
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash-lite-tts",
      contents: [
        {
          role: "user",
          parts: [partWithMetadata as { text: string }],
        },
      ],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: safeVoice },
          },
        },
      },
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return Buffer.from(base64Audio, "base64");
    }
  } catch (err) {
    console.warn("Primary gemini-3.8-flash-lite-tts error, trying fallback:", err);
  }

  const fallbackResponse = await ai.models.generateContent({
    model: "gemini-3.8-flash-tts",
    contents: [
      {
        role: "user",
        parts: [partWithMetadata as { text: string }],
      },
    ],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: safeVoice },
        },
      },
    },
  });

  const fallbackAudio =
    fallbackResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!fallbackAudio) {
    throw new Error("EMPTY_GEMINI_AUDIO");
  }

  return Buffer.from(fallbackAudio, "base64");
}

export async function synthesizeSingleTts(params: {
  text: string;
  voiceId?: string;
  baseVoice?: string;
  emotionId?: string;
  speedId?: string;
  stylePrompt?: string;
  tonePrompt?: string;
  speedPrompt?: string;
}) {
  const {
    text,
    voiceId = "",
    baseVoice = "Kore",
    emotionId = "natural",
    speedId = "normal",
    stylePrompt = "Clear, natural Korean narrator",
    tonePrompt = "",
    speedPrompt = "",
  } = params;

  if (!text || typeof text !== "string" || !text.trim()) {
    throw new Error("낭독할 텍스트를 입력해 주세요.");
  }

  const trimmedText = text.trim();
  if (trimmedText.length > 5000) {
    throw new Error("한 번에 최대 5,000자까지 낭독할 수 있습니다.");
  }

  const fullStylePrompt = [stylePrompt, tonePrompt, speedPrompt]
    .filter(Boolean)
    .join(". ");

  try {
    const rawAudioBuffer = await generateSingleVoiceGemini(
      trimmedText,
      baseVoice,
      fullStylePrompt
    );

    const { wavBuffer, pcmBuffer, sampleRate, numChannels } =
      parseAudioBuffer(rawAudioBuffer);

    const mp3Buffer = encodePcmToMp3(pcmBuffer, sampleRate, numChannels);
    const peaks = computeWaveformPeaks(pcmBuffer, 68);
    const totalSamples = Math.floor(pcmBuffer.length / (2 * numChannels));
    const durationSeconds = Number((totalSamples / sampleRate).toFixed(2));

    return {
      mp3Base64: mp3Buffer.toString("base64"),
      wavBase64: wavBuffer.toString("base64"),
      durationSeconds,
      sampleRate,
      peaks,
      byteLengthMp3: mp3Buffer.length,
      byteLengthWav: wavBuffer.length,
    };
  } catch (geminiErr) {
    console.info("Using Neural Korean TTS engine:", (geminiErr as Error)?.message);
    const mp3Buffer = await generateEdgeNeuralMp3({
      text: trimmedText,
      voiceId,
      baseVoice,
      emotionId,
      speedId,
    });

    // 96kbps = 12,000 bytes per second
    const estimatedDuration = Math.max(
      0.8,
      Number((mp3Buffer.length / 12000).toFixed(2))
    );
    const peaks = computePeaksFromMp3Buffer(mp3Buffer, 68);

    return {
      mp3Base64: mp3Buffer.toString("base64"),
      wavBase64: "",
      durationSeconds: estimatedDuration,
      sampleRate: 24000,
      peaks,
      byteLengthMp3: mp3Buffer.length,
      byteLengthWav: mp3Buffer.length * 4,
    };
  }
}

export async function synthesizeMultiTts(params: {
  segments: Array<{
    text: string;
    voiceId?: string;
    baseVoice?: string;
    emotionId?: string;
    speedId?: string;
    stylePrompt?: string;
    tonePrompt?: string;
    speedPrompt?: string;
  }>;
  pauseMs?: number;
}) {
  const { segments, pauseMs = 380 } = params;
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error("낭독할 문단 목록이 비어 있습니다.");
  }

  const validSegments = segments
    .map((s) => ({
      text: typeof s.text === "string" ? s.text.trim() : "",
      voiceId: s.voiceId || "",
      baseVoice: s.baseVoice || "Kore",
      emotionId: s.emotionId || "natural",
      speedId: s.speedId || "normal",
      stylePrompt: s.stylePrompt || "Clear, natural Korean narrator",
      tonePrompt: s.tonePrompt || "",
      speedPrompt: s.speedPrompt || "",
    }))
    .filter((s) => s.text.length > 0);

  if (validSegments.length === 0) {
    throw new Error("낭독할 텍스트를 입력해 주세요.");
  }

  const hasGeminiKey =
    Boolean(process.env.GEMINI_API_KEY) &&
    process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY";

  if (hasGeminiKey) {
    try {
      const pcmParts: Buffer[] = [];
      let detectedSampleRate = 24000;
      const detectedChannels = 1;

      for (let i = 0; i < validSegments.length; i++) {
        const seg = validSegments[i];
        const fullStylePrompt = [seg.stylePrompt, seg.tonePrompt, seg.speedPrompt]
          .filter(Boolean)
          .join(". ");

        const rawAudio = await generateSingleVoiceGemini(
          seg.text,
          seg.baseVoice,
          fullStylePrompt
        );
        const parsed = parseAudioBuffer(rawAudio);
        detectedSampleRate = parsed.sampleRate || 24000;
        pcmParts.push(parsed.pcmBuffer);

        if (i < validSegments.length - 1 && pauseMs > 0) {
          const silenceSamples = Math.floor((detectedSampleRate * pauseMs) / 1000);
          const silenceBuffer = Buffer.alloc(silenceSamples * 2);
          pcmParts.push(silenceBuffer);
        }
      }

      const combinedPcm = Buffer.concat(pcmParts);
      const wavHeader = createWavHeader(
        combinedPcm.length,
        detectedSampleRate,
        detectedChannels,
        16
      );
      const wavBuffer = Buffer.concat([wavHeader, combinedPcm]);
      const mp3Buffer = encodePcmToMp3(
        combinedPcm,
        detectedSampleRate,
        detectedChannels
      );
      const peaks = computeWaveformPeaks(combinedPcm, 68);
      const totalSamples = Math.floor(combinedPcm.length / 2);
      const durationSeconds = Number(
        (totalSamples / detectedSampleRate).toFixed(2)
      );

      return {
        mp3Base64: mp3Buffer.toString("base64"),
        wavBase64: wavBuffer.toString("base64"),
        durationSeconds,
        sampleRate: detectedSampleRate,
        peaks,
        byteLengthMp3: mp3Buffer.length,
        byteLengthWav: wavBuffer.length,
      };
    } catch (err) {
      console.info("Multi-TTS falling back to Neural Korean TTS:", err);
    }
  }

  // Keyless Neural Korean TTS multi-segment synthesis
  const mp3Parts: Buffer[] = [];
  for (let i = 0; i < validSegments.length; i++) {
    const seg = validSegments[i];
    const partMp3 = await generateEdgeNeuralMp3({
      text: seg.text,
      voiceId: seg.voiceId,
      baseVoice: seg.baseVoice,
      emotionId: seg.emotionId,
      speedId: seg.speedId,
    });
    mp3Parts.push(partMp3);
  }

  const combinedMp3 = Buffer.concat(mp3Parts);
  const estimatedDuration = Math.max(
    1.0,
    Number((combinedMp3.length / 12000).toFixed(2))
  );
  const peaks = computePeaksFromMp3Buffer(combinedMp3, 68);

  return {
    mp3Base64: combinedMp3.toString("base64"),
    wavBase64: "",
    durationSeconds: estimatedDuration,
    sampleRate: 24000,
    peaks,
    byteLengthMp3: combinedMp3.length,
    byteLengthWav: combinedMp3.length * 4,
  };
}
