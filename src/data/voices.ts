export type VoiceCategory = 'all' | 'female' | 'male' | 'child' | 'storyteller';

export interface VoicePersona {
  id: string;
  name: string;
  englishName: string;
  category: Exclude<VoiceCategory, 'all'>;
  categoryLabel: string;
  roleLabel: string;
  ageTone: string;
  description: string;
  baseVoice: 'Kore' | 'Zephyr' | 'Charon' | 'Fenrir' | 'Puck';
  stylePrompt: string;
  sampleLine: string;
}

export interface EmotionOption {
  id: string;
  label: string;
  subtitle: string;
  prompt: string;
}

export interface SpeedOption {
  id: string;
  label: string;
  multiplierLabel: string;
  prompt: string;
  playbackRate: number;
}

export interface SampleScript {
  id: string;
  title: string;
  categoryLabel: string;
  recommendedVoiceId: string;
  recommendedEmotionId: string;
  content: string;
}

export const VOICE_PERSONAS: VoicePersona[] = [
  {
    id: 'seoyeon-female-anchor',
    name: '서연',
    englishName: 'Seoyeon',
    category: 'female',
    categoryLabel: '여성 목소리',
    roleLabel: '차분한 아나운서',
    ageTone: '20~30대 여성 · 중저음의 단정한 톤',
    description: '정확한 발음과 안정적인 호흡으로 에세이, 뉴스 브리핑, 정보 전달 원고를 신뢰감 있게 읽어줍니다.',
    baseVoice: 'Kore',
    stylePrompt:
      'Clear, calm, articulate Korean adult female news anchor and audiobook narrator with warm, natural intonation and poised diction',
    sampleLine: '안녕하세요, 오늘 당신이 적어 내려간 소중한 문장들을 가장 편안하고 또렷한 목소리로 전해 드릴게요.',
  },
  {
    id: 'jia-female-lyric',
    name: '지아',
    englishName: 'Jia',
    category: 'female',
    categoryLabel: '여성 목소리',
    roleLabel: '다정한 라디오 DJ',
    ageTone: '20대 여성 · 부드럽고 따뜻한 톤',
    description: '심야 라디오 DJ처럼 포근하고 감성적인 억양으로 일기, 편지, 브이로그 내레이션을 자연스럽게 소화합니다.',
    baseVoice: 'Zephyr',
    stylePrompt:
      'Warm, gentle, affectionate young Korean woman speaking softly and naturally like a late-night radio host reading a heartfelt letter',
    sampleLine: '유난히 길었던 하루의 끝에서, 따뜻한 차 한 잔과 함께 이 이야기를 조용히 들려드리고 싶어요.',
  },
  {
    id: 'minjun-male-narrator',
    name: '민준',
    englishName: 'Minjun',
    category: 'male',
    categoryLabel: '남성 목소리',
    roleLabel: '중후한 다큐 내레이터',
    ageTone: '30~40대 남성 · 깊이 있는 바리톤',
    description: '묵직하고 차분한 울림을 가진 남성 목소리로 다큐멘터리, 칼럼, 브랜드 스토리, 인문학 원고에 어울립니다.',
    baseVoice: 'Charon',
    stylePrompt:
      'Deep, resonant, trustworthy Korean adult male documentary narrator with a calm baritone voice, steady pacing, and rich vocal warmth',
    sampleLine: '시간이 흘러도 변하지 않는 가치들이 있습니다. 깊이 있는 울림으로 당신의 글을 낭독합니다.',
  },
  {
    id: 'hyunwoo-male-creator',
    name: '현우',
    englishName: 'Hyunwoo',
    category: 'male',
    categoryLabel: '남성 목소리',
    roleLabel: '활기찬 크리에이터',
    ageTone: '20~30대 남성 · 밝고 경쾌한 톤',
    description: '생동감 넘치는 리듬감으로 유튜브 영상 내레이션, 팟캐스트 오프닝, 제품 소개 글을 막힘없이 읽어줍니다.',
    baseVoice: 'Fenrir',
    stylePrompt:
      'Energetic, friendly, conversational young Korean male creator speaking brightly and naturally with engaging rhythm',
    sampleLine: '반갑습니다 여러분! 오늘 준비한 흥미로운 이야기를 지금 바로 생생한 목소리로 시작해 볼까요?',
  },
  {
    id: 'hajun-child-boy',
    name: '하준',
    englishName: 'Hajun',
    category: 'child',
    categoryLabel: '아이 목소리',
    roleLabel: '호기심 많은 소년',
    ageTone: '8세 어린이 · 맑고 명랑한 소년 톤',
    description: '세상 모든 것이 신기한 어린 소년의 통통 튀는 억양으로 동화책 대사, 어린이 교육 콘텐츠를 생생하게 표현합니다.',
    baseVoice: 'Puck',
    stylePrompt:
      'High-pitched, bright, cheerful 7-year-old Korean little boy speaking with innocent childlike curiosity, playful enthusiasm, and cute youthful cadence',
    sampleLine: '우와! 저기 하늘에 떠 있는 구름 모양 좀 보세요! 꼭 솜사탕을 타고 날아가는 아기 곰 같아요!',
  },
  {
    id: 'haeun-child-girl',
    name: '하은',
    englishName: 'Haeun',
    category: 'child',
    categoryLabel: '아이 목소리',
    roleLabel: '해맑은 어린이 소녀',
    ageTone: '7세 어린이 · 사랑스럽고 고운 소녀 톤',
    description: '맑고 순수한 어린 소녀의 목소리로 동요 내레이션, 창작 동화, 귀여운 캐릭터 음성을 자연스럽게 들려줍니다.',
    baseVoice: 'Zephyr',
    stylePrompt:
      'Sweet, high-pitched, adorable 6-year-old Korean little girl voice speaking innocently, brightly, and joyfully like a child in a fairy tale',
    sampleLine: '엄마, 아빠! 오늘 숲속에서 반짝반짝 빛나는 작은 요정을 만났어요! 정말 신기하죠?',
  },
  {
    id: 'eunsu-storyteller',
    name: '은수',
    englishName: 'Eunsu',
    category: 'storyteller',
    categoryLabel: '스토리텔러',
    roleLabel: '구연동화 · 오디오북 배우',
    ageTone: '중년 성우 톤 · 풍부한 감정 표현력',
    description: '문장의 행간과 극적인 감정선을 살려 소설, 구연동화, 오디오 드라마를 한 편의 공연처럼 읽어줍니다.',
    baseVoice: 'Kore',
    stylePrompt:
      'Expressive, theatrical Korean master storyteller and voice actor with warm dynamics, vivid phrasing, and heartwarming grandmother/motherly storytelling charm',
    sampleLine: '옛날 옛적, 깊은 산골짜기 작은 오두막에 밤마다 별빛을 모아 이야기를 짓는 노인이 살고 있었답니다.',
  },
  {
    id: 'taeseok-senior-sage',
    name: '태석',
    englishName: 'Taeseok',
    category: 'storyteller',
    categoryLabel: '스토리텔러',
    roleLabel: '인자한 시니어 낭독가',
    ageTone: '50~60대 남성 · 여유롭고 온화한 울림',
    description: '세월의 깊이가 느껴지는 느긋하고 인자한 호흡으로 시, 명상록, 회고록, 고전 문학을 깊이 있게 전달합니다.',
    baseVoice: 'Charon',
    stylePrompt:
      'Wise, gentle, unhurried older Korean gentleman narrator in his 60s speaking with deep warmth, nostalgia, and peaceful cadence',
    sampleLine: '서두르지 않아도 괜찮습니다. 천천히 걸으며 스쳐 지나간 계절의 이름을 하나씩 불러 보려 합니다.',
  },
];

export const EMOTION_OPTIONS: EmotionOption[] = [
  {
    id: 'natural',
    label: '자연스러운 일상 톤',
    subtitle: '꾸밈없이 편안한 억양',
    prompt: 'Speak naturally with conversational Korean prosody and authentic breathing.',
  },
  {
    id: 'warm',
    label: '따뜻하고 다정하게',
    subtitle: '위로와 공감을 전하는 톤',
    prompt: 'Speak with gentle warmth, empathy, and a soft, comforting smile in the voice.',
  },
  {
    id: 'cheerful',
    label: '밝고 생동감 있게',
    subtitle: '에너지를 높인 경쾌한 톤',
    prompt: 'Speak brightly, cheerfully, and enthusiastically with lively energy.',
  },
  {
    id: 'calm',
    label: '차분하고 정돈되게',
    subtitle: '뉴스 · 오디오북 정석 톤',
    prompt: 'Speak calmly, poised, and steadily with crisp articulation.',
  },
  {
    id: 'fairy-tale',
    label: '동화 구연처럼 생생하게',
    subtitle: '어린이 · 스토리텔링 특화',
    prompt: 'Speak with vivid fairy-tale storytelling expression, wonder, and animated intonation.',
  },
  {
    id: 'whisper',
    label: '조용하고 나지막하게',
    subtitle: '심야 낭독 · ASMR 무드',
    prompt: 'Speak softly, intimately, and quietly in a hushed, soothing close-mic voice.',
  },
];

export const SPEED_OPTIONS: SpeedOption[] = [
  {
    id: 'slow',
    label: '여유롭게',
    multiplierLabel: '0.88x',
    prompt: 'Pace the reading slowly and deliberately with generous pauses between sentences.',
    playbackRate: 0.92,
  },
  {
    id: 'normal',
    label: '표준 빠르기',
    multiplierLabel: '1.00x',
    prompt: 'Maintain a natural, balanced speaking pace.',
    playbackRate: 1.0,
  },
  {
    id: 'brisk',
    label: '경쾌하게',
    multiplierLabel: '1.12x',
    prompt: 'Speak at a brisk, lively, upbeat pace without rushing articulation.',
    playbackRate: 1.08,
  },
];

export const SAMPLE_SCRIPTS: SampleScript[] = [
  {
    id: 'essay-autumn',
    title: '오후 네 시의 햇살과 커피 한 잔',
    categoryLabel: '감성 에세이',
    recommendedVoiceId: 'jia-female-lyric',
    recommendedEmotionId: 'warm',
    content: `창가로 기울어지는 오후 네 시의 햇살은 유난히 다정한 색을 띠고 있습니다. <breath> 바쁘게 흘러가던 하루의 속도를 잠시 늦추고, 따뜻하게 내린 커피 한 잔을 책상 위에 올려놓았습니다.\n\n우리가 매일 적어 내려가는 짧은 문장들은 어쩌면 스스로에게 건네는 작은 안부일지도 모릅니다. 오늘 하루도 애썼다는 말, 내일은 조금 더 가벼운 마음으로 걸어가 보자는 다짐이 잔잔한 목소리를 타고 방 안을 채웁니다.`,
  },
  {
    id: 'fairy-tale-star',
    title: '구름 우체국과 아기 별의 편지',
    categoryLabel: '어린이 동화',
    recommendedVoiceId: 'hajun-child-boy',
    recommendedEmotionId: 'fairy-tale',
    content: `높고 푸른 하늘 위에는 뭉게구름으로 만들어진 폭신폭신 구름 우체국이 있어요! <breath> 어느 날, 가장 작고 반짝이는 아기 별이 노란 편지 봉투를 들고 폴짝폴짝 찾아왔답니다.\n\n"구름 우체부 아저씨! 이 편지를 밤하늘을 올려다보는 아이에게 꼭 전해 주세요! 오늘 밤에 가장 예쁜 꿈을 꾸게 해 주겠다고 약속했거든요!" <laugh> 아기 별의 목소리에 구름들도 기분이 좋아져 핑크빛으로 물들었답니다.`,
  },
  {
    id: 'docu-narr',
    title: '숲이 깨어나는 새벽의 기록',
    categoryLabel: '다큐멘터리 내레이션',
    recommendedVoiceId: 'minjun-male-narrator',
    recommendedEmotionId: 'calm',
    content: `안개가 채 걷히지 않은 새벽 다섯 시, 수백 년의 시간을 품은 고요한 숲이 서서히 숨을 고르기 시작합니다. <breath> 나뭇잎 끝에 맺힌 이슬 한 방울이 흙으로 떨어지는 순간, 숲속의 작은 생명들은 저마다의 리듬으로 새로운 하루를 맞이합니다.\n\n인간의 시간보다 훨씬 느리고 깊게 흐르는 자연의 질서 속에서, 우리는 잊고 지냈던 본연의 평온함과 마주하게 됩니다.`,
  },
  {
    id: 'podcast-opening',
    title: '크리에이터 오디오 레터 오프닝',
    categoryLabel: '유튜브 · 팟캐스트',
    recommendedVoiceId: 'hyunwoo-male-creator',
    recommendedEmotionId: 'cheerful',
    content: `안녕하세요 여러분! 한 주 동안 잘 지내셨나요? <breath> 일상 속 작은 아이디어를 발견하고 기록하는 오디오 스튜디오에 오신 것을 환영합니다.\n\n오늘은 우리가 쓴 글을 가장 자연스러운 목소리로 담아내는 방법에 대해 이야기해 보려고 하는데요, 지금 바로 시작해 볼까요?`,
  },
];
