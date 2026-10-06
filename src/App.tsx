/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Download,
  Volume2,
  RotateCcw,
  Plus,
  Trash2,
  FileText,
  Sliders,
  Check,
  Loader2,
  Repeat,
  ArrowDownToLine,
  Upload,
  SplitSquareVertical,
  AlignLeft,
} from 'lucide-react';
import {
  VOICE_PERSONAS,
  EMOTION_OPTIONS,
  SPEED_OPTIONS,
  SAMPLE_SCRIPTS,
  VoiceCategory,
  VoicePersona,
} from './data/voices';

interface GeneratedTrack {
  id: string;
  title: string;
  scriptExcerpt: string;
  fullText: string;
  voiceName: string;
  voiceCategoryLabel: string;
  emotionLabel: string;
  speedLabel: string;
  mp3Url: string;
  wavUrl: string;
  durationSeconds: number;
  byteLengthMp3: number;
  byteLengthWav: number;
  peaks: number[];
  createdAt: string;
  isMultiVoice?: boolean;
}

interface DialogueSegment {
  id: string;
  voiceId: string;
  emotionId: string;
  text: string;
}

function base64ToBlobUrl(base64: string, mimeType: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function sanitizeFileName(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 36);
  return cleaned || 'voice_atelier_reading';
}

async function parseApiResponse(response: Response) {
  const rawText = await response.text();
  let data: any = null;
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    if (response.status === 404 || rawText.includes('The page could not be found')) {
      throw new Error(
        '음성 합성 API 경로(/api/tts)를 찾을 수 없습니다(404). 외부 호스팅(Vercel 등)에 배포하신 경우 최신 코드(/api 폴더 포함)로 재배포하고 환경 변수에 GEMINI_API_KEY를 등록해 주세요.'
      );
    }
    throw new Error(
      `서버에서 올바른 응답을 받지 못했습니다 (HTTP ${response.status}). 잠시 후 다시 시도해 주세요.`
    );
  }

  if (!response.ok) {
    throw new Error(data?.error || `음성 합성 요청 실패 (HTTP ${response.status})`);
  }
  return data;
}

export default function App() {
  // Navigation & Mode
  const [studioMode, setStudioMode] = useState<'single' | 'multi'>('single');
  const [voiceFilter, setVoiceFilter] = useState<VoiceCategory>('all');

  // Single-Voice State
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(VOICE_PERSONAS[0].id);
  const [selectedEmotionId, setSelectedEmotionId] = useState<string>(EMOTION_OPTIONS[0].id);
  const [selectedSpeedId, setSelectedSpeedId] = useState<string>(SPEED_OPTIONS[1].id);
  const [manuscriptTitle, setManuscriptTitle] = useState<string>(SAMPLE_SCRIPTS[0].title);
  const [manuscriptText, setManuscriptText] = useState<string>(SAMPLE_SCRIPTS[0].content);

  // Multi-Voice Paragraph State
  const [segments, setSegments] = useState<DialogueSegment[]>([
    {
      id: 'seg-1',
      voiceId: 'seoyeon-female-anchor',
      emotionId: 'calm',
      text: '옛날 어느 푸른 숲속 마을에, 밤하늘의 별빛을 모으는 작은 우체국이 있었습니다.',
    },
    {
      id: 'seg-2',
      voiceId: 'hajun-child-boy',
      emotionId: 'fairy-tale',
      text: '우와! 우체부 아저씨, 이 반짝이는 별빛 편지는 어디에서 온 거예요? 정말 신기해요!',
    },
    {
      id: 'seg-3',
      voiceId: 'minjun-male-narrator',
      emotionId: 'warm',
      text: '허허, 이 편지는 오늘 밤 가장 아름다운 꿈을 선물받을 어린이에게 보낸 별의 인사란다.',
    },
  ]);
  const [pauseMs, setPauseMs] = useState<number>(380);

  // Generation & Preview State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Tracks & Audio Player State
  const [tracks, setTracks] = useState<GeneratedTrack[]>([]);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [customFileName, setCustomFileName] = useState<string>('오후_네_시의_햇살과_커피_한_잔');

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const voiceCatalogRef = useRef<HTMLElement | null>(null);
  const libraryRef = useRef<HTMLElement | null>(null);

  const selectedVoice =
    VOICE_PERSONAS.find((v) => v.id === selectedVoiceId) || VOICE_PERSONAS[0];
  const selectedEmotion =
    EMOTION_OPTIONS.find((e) => e.id === selectedEmotionId) || EMOTION_OPTIONS[0];
  const selectedSpeed =
    SPEED_OPTIONS.find((s) => s.id === selectedSpeedId) || SPEED_OPTIONS[1];

  const activeTrack = tracks.find((t) => t.id === activeTrackId) || tracks[0] || null;

  const filteredVoices = VOICE_PERSONAS.filter((v) =>
    voiceFilter === 'all' ? true : v.category === voiceFilter
  );

  // Sync audio playback rate and loop
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.loop = isLooping;
    }
  }, [playbackRate, isLooping]);

  // Estimate reading time from Korean character count (~280 chars / min)
  const charCount =
    studioMode === 'single'
      ? manuscriptText.length
      : segments.reduce((acc, s) => acc + s.text.length, 0);
  const estimatedSeconds = Math.max(1, Math.round((charCount / 280) * 60));

  const handleInsertCue = (cue: string) => {
    if (studioMode !== 'single') return;
    const el = textareaRef.current;
    if (!el) {
      setManuscriptText((prev) => `${prev} ${cue} `);
      return;
    }
    const start = el.selectionStart ?? manuscriptText.length;
    const end = el.selectionEnd ?? manuscriptText.length;
    const next =
      manuscriptText.slice(0, start) + ` ${cue} ` + manuscriptText.slice(end);
    setManuscriptText(next);
    setTimeout(() => {
      el.focus();
      const cursor = start + cue.length + 2;
      el.setSelectionRange(cursor, cursor);
    }, 10);
  };

  const handleLoadSample = (sampleId: string) => {
    const sample = SAMPLE_SCRIPTS.find((s) => s.id === sampleId);
    if (!sample) return;
    setStudioMode('single');
    setManuscriptTitle(sample.title);
    setManuscriptText(sample.content);
    setSelectedVoiceId(sample.recommendedVoiceId);
    setSelectedEmotionId(sample.recommendedEmotionId);
    setCustomFileName(sanitizeFileName(sample.title));
    setErrorMsg(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = typeof event.target?.result === 'string' ? event.target.result : '';
      if (content.trim()) {
        const baseName = file.name.replace(/\.[^/.]+$/, '');
        setStudioMode('single');
        setManuscriptTitle(baseName);
        setManuscriptText(content.slice(0, 5000));
        setCustomFileName(sanitizeFileName(baseName));
        setErrorMsg(null);
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const handleSplitManuscriptToSegments = () => {
    const paragraphs = manuscriptText
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);

    if (paragraphs.length === 0) return;

    const newSegments: DialogueSegment[] = paragraphs.map((p, idx) => ({
      id: `seg-${Date.now()}-${idx}`,
      voiceId: selectedVoiceId,
      emotionId: selectedEmotionId,
      text: p,
    }));
    setSegments(newSegments);
    setStudioMode('multi');
  };

  const handlePreviewVoice = async (voice: VoicePersona, e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewingVoiceId === voice.id) {
      previewAudioRef.current?.pause();
      setPreviewingVoiceId(null);
      return;
    }

    try {
      setPreviewingVoiceId(voice.id);
      setErrorMsg(null);

      const response = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: voice.sampleLine,
          baseVoice: voice.baseVoice,
          stylePrompt: voice.stylePrompt,
          tonePrompt: selectedEmotion.prompt,
          speedPrompt: selectedSpeed.prompt,
        }),
      });

      const data = await parseApiResponse(response);

      const mp3Url = base64ToBlobUrl(data.mp3Base64, 'audio/mpeg');
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      const audio = new Audio(mp3Url);
      previewAudioRef.current = audio;
      audio.onended = () => setPreviewingVoiceId(null);
      audio.onerror = () => setPreviewingVoiceId(null);
      await audio.play();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : '샘플 미리듣기 중 오류가 발생했습니다.'
      );
      setPreviewingVoiceId(null);
    }
  };

  const handleGenerateAudio = async () => {
    if (isGenerating) return;
    setErrorMsg(null);

    if (studioMode === 'single') {
      if (!manuscriptText.trim()) {
        setErrorMsg('낭독할 글을 입력해 주세요.');
        return;
      }
    } else {
      const hasValid = segments.some((s) => s.text.trim().length > 0);
      if (!hasValid) {
        setErrorMsg('최소 한 개 이상의 문단에 내용을 입력해 주세요.');
        return;
      }
    }

    setIsGenerating(true);
    try {
      if (studioMode === 'single') {
        const response = await fetch('/api/tts/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: manuscriptText,
            baseVoice: selectedVoice.baseVoice,
            stylePrompt: selectedVoice.stylePrompt,
            tonePrompt: selectedEmotion.prompt,
            speedPrompt: selectedSpeed.prompt,
          }),
        });

        const data = await parseApiResponse(response);

        const mp3Url = base64ToBlobUrl(data.mp3Base64, 'audio/mpeg');
        const wavUrl = base64ToBlobUrl(data.wavBase64, 'audio/wav');
        const titleText =
          manuscriptTitle.trim() ||
          manuscriptText.trim().slice(0, 22).replace(/\s+/g, ' ');

        const newTrack: GeneratedTrack = {
          id: `track-${Date.now()}`,
          title: titleText,
          scriptExcerpt: manuscriptText.trim().slice(0, 90),
          fullText: manuscriptText.trim(),
          voiceName: selectedVoice.name,
          voiceCategoryLabel: selectedVoice.categoryLabel,
          emotionLabel: selectedEmotion.label,
          speedLabel: selectedSpeed.label,
          mp3Url,
          wavUrl,
          durationSeconds: data.durationSeconds || estimatedSeconds,
          byteLengthMp3: data.byteLengthMp3 || 0,
          byteLengthWav: data.byteLengthWav || 0,
          peaks: Array.isArray(data.peaks) ? data.peaks : Array(64).fill(0.35),
          createdAt: new Date().toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          isMultiVoice: false,
        };

        setTracks((prev) => [newTrack, ...prev]);
        setActiveTrackId(newTrack.id);
        setPlaybackRate(selectedSpeed.playbackRate);
        setCustomFileName(sanitizeFileName(`${titleText}_${selectedVoice.name}`));

        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.src = mp3Url;
            audioRef.current.playbackRate = selectedSpeed.playbackRate;
            audioRef.current.play().catch(() => {});
          }
        }, 60);
      } else {
        const payloadSegments = segments
          .filter((s) => s.text.trim().length > 0)
          .map((s) => {
            const v =
              VOICE_PERSONAS.find((vp) => vp.id === s.voiceId) || VOICE_PERSONAS[0];
            const em =
              EMOTION_OPTIONS.find((eo) => eo.id === s.emotionId) ||
              EMOTION_OPTIONS[0];
            return {
              text: s.text.trim(),
              baseVoice: v.baseVoice,
              stylePrompt: v.stylePrompt,
              tonePrompt: em.prompt,
              speedPrompt: selectedSpeed.prompt,
            };
          });

        const response = await fetch('/api/tts/generate-multi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            segments: payloadSegments,
            pauseMs,
          }),
        });

        const data = await parseApiResponse(response);

        const mp3Url = base64ToBlobUrl(data.mp3Base64, 'audio/mpeg');
        const wavUrl = base64ToBlobUrl(data.wavBase64, 'audio/wav');
        const combinedScript = segments.map((s) => s.text.trim()).join('\n\n');
        const uniqueVoiceNames = Array.from(
          new Set(
            segments.map(
              (s) =>
                VOICE_PERSONAS.find((v) => v.id === s.voiceId)?.name || '서연'
            )
          )
        ).join(', ');

        const titleText = manuscriptTitle.trim() || '멀티 보이스 드라마 낭독';

        const newTrack: GeneratedTrack = {
          id: `track-${Date.now()}`,
          title: titleText,
          scriptExcerpt: combinedScript.slice(0, 90),
          fullText: combinedScript,
          voiceName: uniqueVoiceNames,
          voiceCategoryLabel: `멀티 보이스 (${segments.length}문단)`,
          emotionLabel: '문단별 맞춤 톤',
          speedLabel: selectedSpeed.label,
          mp3Url,
          wavUrl,
          durationSeconds: data.durationSeconds || estimatedSeconds,
          byteLengthMp3: data.byteLengthMp3 || 0,
          byteLengthWav: data.byteLengthWav || 0,
          peaks: Array.isArray(data.peaks) ? data.peaks : Array(64).fill(0.35),
          createdAt: new Date().toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          isMultiVoice: true,
        };

        setTracks((prev) => [newTrack, ...prev]);
        setActiveTrackId(newTrack.id);
        setPlaybackRate(selectedSpeed.playbackRate);
        setCustomFileName(sanitizeFileName(`${titleText}_멀티보이스`));

        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.src = mp3Url;
            audioRef.current.playbackRate = selectedSpeed.playbackRate;
            audioRef.current.play().catch(() => {});
          }
        }, 60);
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : '음성 생성 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio || !activeTrack) return;
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  };

  const handleSeek = (ratio: number) => {
    const audio = audioRef.current;
    if (!audio || !activeTrack) return;
    const total = audio.duration || activeTrack.durationSeconds || 1;
    audio.currentTime = Math.max(0, Math.min(total, ratio * total));
    setCurrentTime(audio.currentTime);
  };

  const handleDownloadTrack = (track: GeneratedTrack, format: 'mp3' | 'wav') => {
    const link = document.createElement('a');
    link.href = format === 'mp3' ? track.mp3Url : track.wavUrl;
    const base =
      track.id === activeTrack?.id && customFileName.trim()
        ? sanitizeFileName(customFileName)
        : sanitizeFileName(`${track.title}_${track.voiceName}`);
    link.download = `${base}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSelectTrackToPlay = (track: GeneratedTrack) => {
    setActiveTrackId(track.id);
    setCustomFileName(sanitizeFileName(`${track.title}_${track.voiceName}`));
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.src = track.mp3Url;
        audioRef.current.playbackRate = playbackRate;
        audioRef.current.play().catch(() => {});
      }
    }, 30);
  };

  const handleDeleteTrack = (trackId: string) => {
    setTracks((prev) => {
      const target = prev.find((t) => t.id === trackId);
      if (target) {
        URL.revokeObjectURL(target.mp3Url);
        URL.revokeObjectURL(target.wavUrl);
      }
      const remaining = prev.filter((t) => t.id !== trackId);
      if (activeTrackId === trackId) {
        setActiveTrackId(remaining[0]?.id || null);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = remaining[0]?.mp3Url || '';
        }
      }
      return remaining;
    });
  };

  const addSegment = () => {
    setSegments((prev) => [
      ...prev,
      {
        id: `seg-${Date.now()}`,
        voiceId: selectedVoiceId,
        emotionId: selectedEmotionId,
        text: '',
      },
    ]);
  };

  const updateSegment = (
    id: string,
    field: keyof DialogueSegment,
    value: string
  ) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const removeSegment = (id: string) => {
    if (segments.length <= 1) return;
    setSegments((prev) => prev.filter((s) => s.id !== id));
  };

  const effectiveDuration = duration > 0 ? duration : activeTrack?.durationSeconds || 0;
  const progressRatio =
    effectiveDuration > 0 ? Math.min(1, currentTime / effectiveDuration) : 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F4F0] text-[#141413]">
      {/* Hidden Audio Element & File Input */}
      <audio
        ref={audioRef}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Top Bar Contract: 3 Zones (Single-element Brand, 4 Nav Links, Primary Actions) */}
      <header className="sticky top-0 z-30 bg-[#F4F4F0]/95 backdrop-blur-sm border-b border-[#E4E4E0] px-6 lg:px-10 py-4 flex items-center justify-between">
        <a
          href="#top"
          className="text-xl font-semibold tracking-tight text-[#141413] whitespace-nowrap shrink-0"
        >
          Voice Atelier
        </a>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#6E6D68]">
          <button
            type="button"
            onClick={() => setStudioMode('single')}
            className={`hover:text-[#141413] transition-colors whitespace-nowrap cursor-pointer ${
              studioMode === 'single'
                ? 'text-[#141413] underline underline-offset-8 decoration-[#E11D48] decoration-2'
                : ''
            }`}
          >
            단일 원고 낭독
          </button>
          <button
            type="button"
            onClick={() => setStudioMode('multi')}
            className={`hover:text-[#141413] transition-colors whitespace-nowrap cursor-pointer ${
              studioMode === 'multi'
                ? 'text-[#141413] underline underline-offset-8 decoration-[#E11D48] decoration-2'
                : ''
            }`}
          >
            문단별 멀티 보이스
          </button>
          <button
            type="button"
            onClick={() =>
              voiceCatalogRef.current?.scrollIntoView({ behavior: 'smooth' })
            }
            className="hover:text-[#141413] transition-colors whitespace-nowrap cursor-pointer"
          >
            목소리 라인업
          </button>
          <button
            type="button"
            onClick={() =>
              libraryRef.current?.scrollIntoView({ behavior: 'smooth' })
            }
            className="hover:text-[#141413] transition-colors whitespace-nowrap cursor-pointer"
          >
            MP3 보관함 ({tracks.length})
          </button>
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 text-xs font-semibold text-[#141413] bg-white border border-[#E4E4E0] rounded-lg hover:bg-[#ECECE6] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>텍스트 불러오기</span>
          </button>
          {activeTrack && (
            <button
              type="button"
              onClick={() => handleDownloadTrack(activeTrack, 'mp3')}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#E11D48] rounded-lg hover:bg-[#BE123C] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>최신 MP3 다운로드</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Studio Workspace */}
      <main id="top" className="flex-1 max-w-[1440px] w-full mx-auto px-6 lg:px-10 py-8 space-y-10">
        {/* Editorial Intro & Quick Sample Selector */}
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-[#E4E4E0]">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-medium text-[#6E6D68]">
              자연어 음성 합성 & MP3 마스터링 스튜디오 · 여성 · 남성 · 어린이 · 스토리텔러
            </p>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-[#141413] text-balance">
              당신이 쓴 문장에 가장 어울리는 목소리를 입히고 MP3로 소장하세요
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <span className="text-xs text-[#6E6D68] whitespace-nowrap">
              샘플 원고 불러오기:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {SAMPLE_SCRIPTS.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleLoadSample(sample.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                    manuscriptTitle === sample.title && studioMode === 'single'
                      ? 'bg-[#141413] text-white border-[#141413]'
                      : 'bg-white text-[#141413] border-[#E4E4E0] hover:bg-[#ECECE6]'
                  }`}
                >
                  {sample.categoryLabel}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Error Alert Banner */}
        {errorMsg && (
          <div
            role="alert"
            className="bg-white border border-[#E11D48] text-[#141413] px-5 py-3.5 rounded-xl flex items-center justify-between gap-4"
          >
            <div className="text-sm">
              <span className="font-semibold text-[#E11D48] mr-2">오류 안내</span>
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-xs font-semibold text-[#6E6D68] hover:text-[#141413] whitespace-nowrap cursor-pointer"
            >
              닫기
            </button>
          </div>
        )}

        {/* Two-Column Studio Grid: Left Voice Selector (5 cols) + Right Manuscript & MP3 Deck (7 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: Voice Casting & Direction Controls */}
          <section
            ref={voiceCatalogRef}
            className="lg:col-span-5 bg-white border border-[#E4E4E0] rounded-2xl p-6 space-y-6"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-[#141413]">
                  01. 목소리 배역 선택
                </h2>
                <p className="text-xs text-[#6E6D68] mt-0.5">
                  남성 · 여성 · 아이 · 스토리텔러 중 원고에 맞는 목소리를 고르세요
                </p>
              </div>
              <span className="text-xs text-[#6E6D68] font-mono-tabular">
                {filteredVoices.length}종 표시
              </span>
            </div>

            {/* Interactive Category Filter Segmented Control */}
            <div className="grid grid-cols-5 gap-1 p-1 bg-[#F4F4F0] rounded-xl">
              {(
                [
                  { id: 'all', label: '전체' },
                  { id: 'female', label: '여성' },
                  { id: 'male', label: '남성' },
                  { id: 'child', label: '아이' },
                  { id: 'storyteller', label: '낭독가' },
                ] as { id: VoiceCategory; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setVoiceFilter(tab.id)}
                  className={`py-2 px-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    voiceFilter === tab.id
                      ? 'bg-white text-[#141413] shadow-xs'
                      : 'text-[#6E6D68] hover:text-[#141413]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Voice Persona List */}
            <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
              {filteredVoices.map((voice) => {
                const isSelected = voice.id === selectedVoiceId;
                const isPreviewing = previewingVoiceId === voice.id;

                return (
                  <div
                    key={voice.id}
                    onClick={() => setSelectedVoiceId(voice.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedVoiceId(voice.id);
                      }
                    }}
                    className={`w-full text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#141413] bg-[#F9F9F6]'
                        : 'border-[#E4E4E0] bg-white hover:border-[#B8B8B0]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-semibold text-[#141413]">
                            {voice.name}
                          </span>
                          <span className="text-xs text-[#6E6D68] font-editorial italic">
                            {voice.englishName}
                          </span>
                          {isSelected && (
                            <span className="inline-flex items-center text-xs font-semibold text-[#E11D48]">
                              <Check className="w-3.5 h-3.5 mr-0.5" />
                              선택됨
                            </span>
                          )}
                        </div>
                        {/* Zero-Pill Metadata Discipline: Unboxed text with · separators */}
                        <div className="text-xs text-[#6E6D68] flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-[#141413]">
                            {voice.categoryLabel}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{voice.roleLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span>{voice.ageTone}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handlePreviewVoice(voice, e)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                          isPreviewing
                            ? 'bg-[#E11D48] text-white border-[#E11D48]'
                            : 'bg-[#F4F4F0] text-[#141413] border-[#E4E4E0] hover:bg-[#E4E4E0]'
                        }`}
                      >
                        {isPreviewing ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>정지</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>목소리 듣기</span>
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-xs text-[#6E6D68] mt-2.5 leading-relaxed">
                      {voice.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Emotion & Speed Direction */}
            <div className="pt-4 border-t border-[#E4E4E0] space-y-5">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#141413] flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-[#E11D48]" />
                    <span>낭독 감정 톤 & 분위기</span>
                  </label>
                  <span className="text-xs text-[#6E6D68]">
                    {selectedEmotion.subtitle}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {EMOTION_OPTIONS.map((emotion) => (
                    <button
                      key={emotion.id}
                      type="button"
                      onClick={() => setSelectedEmotionId(emotion.id)}
                      className={`px-3 py-2 text-left rounded-lg border text-xs font-medium transition-colors whitespace-nowrap truncate cursor-pointer ${
                        selectedEmotionId === emotion.id
                          ? 'bg-[#141413] text-white border-[#141413]'
                          : 'bg-[#F4F4F0] text-[#141413] border-transparent hover:border-[#D4D4CE]'
                      }`}
                    >
                      {emotion.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#141413]">
                    낭독 호흡 빠르기
                  </label>
                  <span className="text-xs text-[#6E6D68] font-mono-tabular">
                    {selectedSpeed.multiplierLabel}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {SPEED_OPTIONS.map((spd) => (
                    <button
                      key={spd.id}
                      type="button"
                      onClick={() => setSelectedSpeedId(spd.id)}
                      className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer flex items-center justify-between ${
                        selectedSpeedId === spd.id
                          ? 'bg-[#141413] text-white border-[#141413]'
                          : 'bg-[#F4F4F0] text-[#141413] border-transparent hover:border-[#D4D4CE]'
                      }`}
                    >
                      <span>{spd.label}</span>
                      <span className="font-mono-tabular opacity-75">
                        {spd.multiplierLabel}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT COLUMN: Manuscript Studio & Master MP3 Deck */}
          <div className="lg:col-span-7 space-y-6">
            {/* Manuscript Editor Card */}
            <section className="bg-white border border-[#E4E4E0] rounded-2xl p-6 space-y-5">
              {/* Studio Header & Mode Switch */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E4E4E0]">
                <div>
                  <h2 className="text-lg font-semibold text-[#141413]">
                    02. 낭독 원고 작성 스튜디오
                  </h2>
                  <div className="text-xs text-[#6E6D68] mt-0.5 flex items-center gap-2">
                    <span>현재 선택된 성우: {selectedVoice.name} ({selectedVoice.categoryLabel})</span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedEmotion.label}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 p-1 bg-[#F4F4F0] rounded-xl self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setStudioMode('single')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                      studioMode === 'single'
                        ? 'bg-white text-[#141413] shadow-xs'
                        : 'text-[#6E6D68] hover:text-[#141413]'
                    }`}
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                    <span>단일 목소리 원고</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudioMode('multi')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                      studioMode === 'multi'
                        ? 'bg-white text-[#141413] shadow-xs'
                        : 'text-[#6E6D68] hover:text-[#141413]'
                    }`}
                  >
                    <SplitSquareVertical className="w-3.5 h-3.5" />
                    <span>문단별 멀티 보이스</span>
                  </button>
                </div>
              </div>

              {/* Title Input */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <label
                  htmlFor="manuscript-title"
                  className="text-xs font-semibold text-[#6E6D68] whitespace-nowrap"
                >
                  오디오 제목
                </label>
                <input
                  id="manuscript-title"
                  type="text"
                  value={manuscriptTitle}
                  onChange={(e) => {
                    setManuscriptTitle(e.target.value);
                    setCustomFileName(sanitizeFileName(e.target.value));
                  }}
                  placeholder="예: 가을 밤의 편지, 어린이 동화 1화..."
                  className="flex-1 px-3.5 py-2 text-sm font-medium bg-[#F4F4F0] border border-transparent focus:border-[#141413] focus:bg-white rounded-lg outline-none transition-colors"
                />
              </div>

              {studioMode === 'single' ? (
                <>
                  {/* Natural Vocal Expression Cue Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 bg-[#F4F4F0] rounded-xl">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-medium text-[#6E6D68] mr-1">
                        자연스러운 호흡 기호 넣기:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleInsertCue('<breath>')}
                        className="px-2.5 py-1 text-xs font-medium bg-white border border-[#E4E4E0] rounded-md hover:bg-[#ECECE6] transition-colors whitespace-nowrap cursor-pointer"
                      >
                        + 숨고르기 &lt;breath&gt;
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertCue('<laugh>')}
                        className="px-2.5 py-1 text-xs font-medium bg-white border border-[#E4E4E0] rounded-md hover:bg-[#ECECE6] transition-colors whitespace-nowrap cursor-pointer"
                      >
                        + 웃음소리 &lt;laugh&gt;
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertCue('<gasp>')}
                        className="px-2.5 py-1 text-xs font-medium bg-white border border-[#E4E4E0] rounded-md hover:bg-[#ECECE6] transition-colors whitespace-nowrap cursor-pointer"
                      >
                        + 놀람/감탄 &lt;gasp&gt;
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertCue('...')}
                        className="px-2.5 py-1 text-xs font-medium bg-white border border-[#E4E4E0] rounded-md hover:bg-[#ECECE6] transition-colors whitespace-nowrap cursor-pointer"
                      >
                        + 여운 쉬어가기 ...
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleSplitManuscriptToSegments}
                      className="text-xs font-semibold text-[#141413] hover:text-[#E11D48] transition-colors whitespace-nowrap cursor-pointer"
                    >
                      문단별로 쪼개서 다른 목소리 배정하기 →
                    </button>
                  </div>

                  {/* Main Textarea */}
                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      value={manuscriptText}
                      onChange={(e) => setManuscriptText(e.target.value)}
                      rows={9}
                      maxLength={5000}
                      placeholder="여기에 읽어주길 원하는 글을 자유롭게 작성하거나 붙여넣으세요. 에세이, 동화책, 유튜브 대본, 영어/한국어 문장 모두 자연스럽게 읽어줍니다."
                      className="w-full p-4 text-base leading-relaxed bg-[#F9F9F6] border border-[#E4E4E0] focus:border-[#141413] focus:bg-white rounded-xl outline-none resize-y transition-colors"
                    />
                  </div>
                </>
              ) : (
                /* Multi-Voice Paragraph / Story Mode */
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 px-3.5 bg-[#F4F4F0] rounded-xl text-xs">
                    <span className="text-[#6E6D68]">
                      각 문단마다 <strong className="text-[#141413]">남자 · 여자 · 아이 목소리</strong>를 다르게 지정해 한 편의 구연동화나 대화극 MP3로 합칠 수 있습니다.
                    </span>
                    <div className="flex items-center gap-2">
                      <label htmlFor="pause-select" className="text-[#6E6D68] whitespace-nowrap">
                        문단 사이 간격:
                      </label>
                      <select
                        id="pause-select"
                        value={pauseMs}
                        onChange={(e) => setPauseMs(Number(e.target.value))}
                        className="bg-white border border-[#E4E4E0] rounded-md px-2 py-1 font-mono-tabular text-[#141413]"
                      >
                        <option value={200}>0.2초 (빠른 대화)</option>
                        <option value={380}>0.4초 (자연스러움)</option>
                        <option value={650}>0.65초 (여유로운 낭독)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                    {segments.map((seg, idx) => (
                      <div
                        key={seg.id}
                        className="p-4 rounded-xl bg-[#F9F9F6] border border-[#E4E4E0] space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-mono-tabular font-semibold text-[#6E6D68]">
                              #{String(idx + 1).padStart(2, '0')}
                            </span>
                            <select
                              aria-label={`문단 ${idx + 1} 목소리 선택`}
                              value={seg.voiceId}
                              onChange={(e) =>
                                updateSegment(seg.id, 'voiceId', e.target.value)
                              }
                              className="text-xs font-semibold bg-white border border-[#E4E4E0] rounded-lg px-2.5 py-1.5 text-[#141413]"
                            >
                              {VOICE_PERSONAS.map((vp) => (
                                <option key={vp.id} value={vp.id}>
                                  {vp.name} ({vp.categoryLabel} · {vp.roleLabel})
                                </option>
                              ))}
                            </select>
                            <select
                              aria-label={`문단 ${idx + 1} 감정 톤 선택`}
                              value={seg.emotionId}
                              onChange={(e) =>
                                updateSegment(seg.id, 'emotionId', e.target.value)
                              }
                              className="text-xs bg-white border border-[#E4E4E0] rounded-lg px-2.5 py-1.5 text-[#6E6D68]"
                            >
                              {EMOTION_OPTIONS.map((em) => (
                                <option key={em.id} value={em.id}>
                                  {em.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeSegment(seg.id)}
                            disabled={segments.length <= 1}
                            className="p-1.5 text-[#6E6D68] hover:text-[#E11D48] disabled:opacity-30 transition-colors cursor-pointer"
                            title="문단 삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <textarea
                          value={seg.text}
                          onChange={(e) =>
                            updateSegment(seg.id, 'text', e.target.value)
                          }
                          rows={2}
                          placeholder={`${idx + 1}번째 문단의 대사나 내레이션을 입력하세요...`}
                          className="w-full p-3 text-sm bg-white border border-[#E4E4E0] focus:border-[#141413] rounded-lg outline-none resize-y"
                        />
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={addSegment}
                    className="w-full py-2.5 text-xs font-semibold text-[#141413] bg-[#F4F4F0] hover:bg-[#E4E4E0] rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>새 대사 / 문단 추가하기</span>
                  </button>
                </div>
              )}

              {/* Bottom Action Bar: Telemetry & Primary Generate CTA */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-xs text-[#6E6D68] font-mono-tabular">
                  <span>글자 수: {charCount.toLocaleString()} / 5,000자</span>
                  <span aria-hidden="true">·</span>
                  <span>예상 낭독 시간: 약 {estimatedSeconds}초</span>
                  {studioMode === 'single' && (
                    <>
                      <span aria-hidden="true">·</span>
                      <button
                        type="button"
                        onClick={() => setManuscriptText('')}
                        className="text-[#6E6D68] hover:text-[#141413] underline cursor-pointer"
                      >
                        비우기
                      </button>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleGenerateAudio}
                  disabled={isGenerating}
                  className="px-6 py-3 text-sm font-semibold text-white bg-[#E11D48] hover:bg-[#BE123C] disabled:opacity-60 rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer shadow-xs"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>자연스러운 음성 합성 및 MP3 인코딩 중...</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4" />
                      <span>
                        {studioMode === 'single'
                          ? `${selectedVoice.name} 목소리로 낭독 & MP3 만들기`
                          : `멀티 보이스(${segments.length}문단) 합쳐서 MP3 만들기`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </section>

            {/* MASTER AUDIO PLAYER & MP3 DOWNLOAD DECK */}
            <section className="bg-white border border-[#E4E4E0] rounded-2xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-[#141413]">
                    03. 오디오 마스터 플레이어 & MP3 다운로드
                  </h2>
                  <p className="text-xs text-[#6E6D68] mt-0.5">
                    합성된 음성을 바로 들어보고 원하는 파일명의 MP3 또는 무손실 WAV로 저장하세요
                  </p>
                </div>
                {activeTrack && (
                  <div className="text-xs text-[#6E6D68] font-mono-tabular">
                    <span>24kHz</span>
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    <span>128kbps MP3 ({formatFileSize(activeTrack.byteLengthMp3)})</span>
                  </div>
                )}
              </div>

              {activeTrack ? (
                <div className="space-y-5">
                  {/* Track Info Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#F4F4F0] rounded-xl">
                    <div className="space-y-1 min-w-0">
                      <h3 className="text-base font-semibold text-[#141413] truncate">
                        {activeTrack.title}
                      </h3>
                      <div className="text-xs text-[#6E6D68] flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-[#141413]">
                          성우: {activeTrack.voiceName}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{activeTrack.voiceCategoryLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span>{activeTrack.emotionLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">{activeTrack.createdAt} 생성</span>
                      </div>
                    </div>

                    {/* Playback Rate & Loop Controls */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center bg-white border border-[#E4E4E0] rounded-lg p-0.5">
                        {[0.85, 1.0, 1.15, 1.3].map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => setPlaybackRate(rate)}
                            className={`px-2 py-1 text-xs font-mono-tabular rounded-md transition-colors cursor-pointer ${
                              Math.abs(playbackRate - rate) < 0.03
                                ? 'bg-[#141413] text-white font-semibold'
                                : 'text-[#6E6D68] hover:text-[#141413]'
                            }`}
                          >
                            {rate}x
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsLooping((prev) => !prev)}
                        title="반복 재생"
                        className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                          isLooping
                            ? 'bg-[#141413] text-white border-[#141413]'
                            : 'bg-white text-[#6E6D68] border-[#E4E4E0] hover:text-[#141413]'
                        }`}
                      >
                        <Repeat className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Interactive Waveform Scrubber */}
                  <div className="space-y-2">
                    <div
                      className="h-20 bg-[#F9F9F6] border border-[#E4E4E0] rounded-xl px-4 py-3 flex items-center gap-1 cursor-pointer select-none"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const ratio = (e.clientX - rect.left) / rect.width;
                        handleSeek(ratio);
                      }}
                    >
                      {activeTrack.peaks.map((peak, idx) => {
                        const barRatio = idx / activeTrack.peaks.length;
                        const isPassed = barRatio <= progressRatio;
                        const heightPct = Math.max(12, Math.round(peak * 100));
                        return (
                          <div
                            key={idx}
                            className="flex-1 h-full flex items-center justify-center"
                          >
                            <div
                              style={{ height: `${heightPct}%` }}
                              className={`w-full rounded-full transition-colors duration-100 ${
                                isPassed ? 'bg-[#E11D48]' : 'bg-[#D4D4CE]'
                              }`}
                            />
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono-tabular text-[#6E6D68]">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(effectiveDuration)}</span>
                    </div>
                  </div>

                  {/* Transport & MP3 File Download Bar */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2 border-t border-[#E4E4E0]">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={togglePlayPause}
                        className="px-5 py-2.5 bg-[#141413] hover:bg-[#2C2C2A] text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
                      >
                        {isPlaying ? (
                          <>
                            <Pause className="w-4 h-4" />
                            <span>일시정지</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            <span>낭독 재생하기</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSeek(0)}
                        className="p-2.5 bg-[#F4F4F0] hover:bg-[#E4E4E0] text-[#141413] rounded-xl transition-colors cursor-pointer"
                        title="처음부터 재생"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>

                    {/* File Name Input + MP3 & WAV Download Buttons */}
                    <div className="flex flex-wrap items-center gap-2 flex-1 sm:justify-end">
                      <div className="flex items-center bg-[#F4F4F0] border border-[#E4E4E0] rounded-xl px-3 py-1.5 min-w-[180px] flex-1 sm:flex-initial">
                        <input
                          type="text"
                          aria-label="다운로드할 MP3 파일 이름"
                          value={customFileName}
                          onChange={(e) => setCustomFileName(e.target.value)}
                          placeholder="파일 이름 입력"
                          className="bg-transparent text-xs font-medium text-[#141413] outline-none w-full"
                        />
                        <span className="text-xs font-mono-tabular text-[#6E6D68] ml-1">
                          .mp3
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDownloadTrack(activeTrack, 'mp3')}
                        className="px-4 py-2.5 bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <ArrowDownToLine className="w-4 h-4" />
                        <span>MP3 다운로드</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadTrack(activeTrack, 'wav')}
                        className="px-3.5 py-2.5 bg-white hover:bg-[#F4F4F0] text-[#141413] border border-[#E4E4E0] text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>WAV 원음</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Empty State */
                <div className="py-10 px-6 bg-[#F9F9F6] border border-dashed border-[#D4D4CE] rounded-xl text-center space-y-3">
                  <p className="text-sm font-semibold text-[#141413]">
                    아직 생성된 낭독 오디오가 없습니다
                  </p>
                  <p className="text-xs text-[#6E6D68] max-w-md mx-auto leading-relaxed">
                    왼쪽에서 남자, 여자, 아이 목소리 중 원하는 배역을 고르고 원고 작성창의{' '}
                    <strong className="text-[#141413]">낭독 &amp; MP3 만들기</strong> 버튼을 누르면
                    이곳에서 바로 재생하고 MP3 파일로 다운로드할 수 있습니다.
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>

        {/* RECORDING ARCHIVE / LIBRARY SECTION */}
        <section
          ref={libraryRef}
          className="bg-white border border-[#E4E4E0] rounded-2xl p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-[#E4E4E0] pb-4">
            <div>
              <h2 className="text-lg font-semibold text-[#141413]">
                04. 생성된 MP3 녹음 보관함
              </h2>
              <p className="text-xs text-[#6E6D68] mt-0.5">
                이번 세션에서 제작한 모든 음성 파일들을 비교 청취하고 개별 다운로드할 수 있습니다
              </p>
            </div>
            <span className="text-xs font-mono-tabular text-[#6E6D68]">
              총 {tracks.length}개 트랙
            </span>
          </div>

          {tracks.length > 0 ? (
            <div className="divide-y divide-[#E4E4E0]">
              {tracks.map((track, index) => {
                const isCurrent = activeTrack?.id === track.id;
                return (
                  <div
                    key={track.id}
                    className={`py-4 px-3 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors rounded-xl ${
                      isCurrent ? 'bg-[#F9F9F6]' : 'hover:bg-[#F9F9F6]/60'
                    }`}
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleSelectTrackToPlay(track)}
                        className={`mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                          isCurrent && isPlaying
                            ? 'bg-[#E11D48] text-white'
                            : 'bg-[#141413] text-white hover:bg-[#2C2C2A]'
                        }`}
                        title="이 트랙 재생"
                      >
                        {isCurrent && isPlaying ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4 ml-0.5" />
                        )}
                      </button>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono-tabular text-[#6E6D68]">
                            {String(tracks.length - index).padStart(2, '0')}
                          </span>
                          <h3 className="text-sm font-semibold text-[#141413] truncate">
                            {track.title}
                          </h3>
                        </div>
                        <p className="text-xs text-[#6E6D68] truncate max-w-2xl">
                          “{track.scriptExcerpt}”
                        </p>
                        <div className="text-xs text-[#6E6D68] flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-[#141413]">
                            {track.voiceName}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{track.voiceCategoryLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span>{track.emotionLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">
                            {formatTime(track.durationSeconds)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">
                            {formatFileSize(track.byteLengthMp3)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setStudioMode('single');
                          setManuscriptTitle(track.title);
                          setManuscriptText(track.fullText);
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-[#141413] bg-[#F4F4F0] hover:bg-[#E4E4E0] rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>원고 다시 불러오기</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadTrack(track, 'mp3')}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#E11D48] hover:bg-[#BE123C] rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>MP3 저장</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteTrack(track.id)}
                        className="p-1.5 text-[#6E6D68] hover:text-[#E11D48] transition-colors cursor-pointer"
                        title="삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-[#6E6D68]">
              생성된 트랙이 이곳에 순서대로 보관됩니다. 여러 목소리로 같은 문장을 읽혀보고 가장 마음에 드는 MP3를 골라보세요.
            </div>
          )}
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-[#E4E4E0] py-6 px-6 lg:px-10 text-xs text-[#6E6D68] flex flex-col sm:flex-row items-center justify-between gap-2 max-w-[1440px] w-full mx-auto">
        <span>Voice Atelier — AI Natural Speech &amp; MP3 Mastering Studio</span>
        <span>지원 포맷: 128kbps MP3 (audio/mpeg) · 24kHz 16-bit WAV (audio/wav)</span>
      </footer>
    </div>
  );
}
