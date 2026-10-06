import { GoogleGenAI } from "@google/genai";
// @ts-ignore - @breezystack/lamejs does not ship strict TS declarations
import { Mp3Encoder } from "@breezystack/lamejs";

const ALLOWED_PREBUILT_VOICES = new Set([
  "Puck",
  "Charon",
  "Kore",
  "Fenrir",
  "Zephyr",
]);

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "서버 환경 변수에 GEMINI_API_KEY가 설정되어 있지 않습니다. 배포 환경(Vercel 등)의 Environment Variables 설정에서 GEMINI_API_KEY를 추가해 주세요."
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

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
    return Array(barCount).fill(0.15);
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

export async function generateSingleVoiceChunk(
  text: string,
  voiceName: string,
  stylePrompt: string
): Promise<Buffer> {
  const ai = getGenAIClient();
  const safeVoice = ALLOWED_PREBUILT_VOICES.has(voiceName) ? voiceName : "Kore";

  const partWithMetadata: Record<string, unknown> = {
    text,
    speechMetadata: {
      style: stylePrompt,
    },
  };

  // Use gemini-3.8-flash-lite-tts by default for high throughput & low latency
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
    console.warn("Primary gemini-3.8-flash-lite-tts error, trying gemini-3.8-flash-tts:", err);
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
    throw new Error("오디오 데이터를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }

  return Buffer.from(fallbackAudio, "base64");
}

export async function synthesizeSingleTts(params: {
  text: string;
  baseVoice?: string;
  stylePrompt?: string;
  tonePrompt?: string;
  speedPrompt?: string;
}) {
  const {
    text,
    baseVoice = "Kore",
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

  const rawAudioBuffer = await generateSingleVoiceChunk(
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
}

export async function synthesizeMultiTts(params: {
  segments: Array<{
    text: string;
    baseVoice?: string;
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
      baseVoice: s.baseVoice || "Kore",
      stylePrompt: s.stylePrompt || "Clear, natural Korean narrator",
      tonePrompt: s.tonePrompt || "",
      speedPrompt: s.speedPrompt || "",
    }))
    .filter((s) => s.text.length > 0);

  if (validSegments.length === 0) {
    throw new Error("낭독할 텍스트를 입력해 주세요.");
  }

  const pcmParts: Buffer[] = [];
  let detectedSampleRate = 24000;
  const detectedChannels = 1;

  for (let i = 0; i < validSegments.length; i++) {
    const seg = validSegments[i];
    const fullStylePrompt = [seg.stylePrompt, seg.tonePrompt, seg.speedPrompt]
      .filter(Boolean)
      .join(". ");

    const rawAudio = await generateSingleVoiceChunk(
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
  const durationSeconds = Number((totalSamples / detectedSampleRate).toFixed(2));

  return {
    mp3Base64: mp3Buffer.toString("base64"),
    wavBase64: wavBuffer.toString("base64"),
    durationSeconds,
    sampleRate: detectedSampleRate,
    peaks,
    byteLengthMp3: mp3Buffer.length,
    byteLengthWav: wavBuffer.length,
  };
}
