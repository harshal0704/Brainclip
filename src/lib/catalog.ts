export const duoPresets = [
  {
    id: "expert-vs-beginner",
    label: "Expert vs Beginner",
    icon: "🎓",
    category: "Educational",
    hook: "Great for explainers that start with tension and end with clarity.",
    speakerA: "Sharp operator who simplifies complex ideas without sounding robotic.",
    speakerB: "Curious beginner who asks smart questions the audience is already thinking.",
    tone: "educational",
  },
  {
    id: "debate-room",
    label: "Debate Room",
    icon: "⚔️",
    category: "Opinion",
    hook: "High-retention format for opinionated topics and myth-busting clips.",
    speakerA: "Confident contrarian with punchy one-liners and bold hooks.",
    speakerB: "Measured realist who grounds the conversation with credible context.",
    tone: "debate",
  },
  {
    id: "host-guest",
    label: "Host and Guest",
    icon: "🎙️",
    category: "Interview",
    hook: "Best for interview-style shorts with memorable takeaways.",
    speakerA: "Warm host who guides the structure and sets up revealing prompts.",
    speakerB: "Insightful guest with story-driven answers and crisp analogies.",
    tone: "interview",
  },
  {
    id: "storytime",
    label: "Storytime Duo",
    icon: "📖",
    category: "Narrative",
    hook: "Perfect for dramatic recaps, lore breakdowns, and binge-worthy story arcs.",
    speakerA: "Vivid narrator who paints scenes with suspense and emotional beats.",
    speakerB: "Reactive commentator who voices audience reactions and adds context twists.",
    tone: "storytelling",
  },
  {
    id: "rapid-fire",
    label: "Rapid Fire",
    icon: "⚡",
    category: "Facts",
    hook: "Ultra-fast pacing for listicles, rankings, and did-you-know compilations.",
    speakerA: "Machine-gun fact-dropper with punchy delivery and zero filler words.",
    speakerB: "Stunned reactor who amplifies shock value with genuine disbelief.",
    tone: "rapid",
  },
  {
    id: "conspiracy-corner",
    label: "Conspiracy Corner",
    icon: "🔍",
    category: "Mystery",
    hook: "Deep-dive format for mysteries, unsolved cases, and alternative theories.",
    speakerA: "Obsessive investigator who connects dots and drops eerie clues.",
    speakerB: "Skeptical analyst who pushes back with logic but stays hooked.",
    tone: "mystery",
  },
  {
    id: "coach-player",
    label: "Coach & Player",
    icon: "🏆",
    category: "Motivation",
    hook: "Motivational format for self-improvement, fitness, and accountability content.",
    speakerA: "Tough-love coach who delivers hard truths with inspirational fire.",
    speakerB: "Relatable player who voices internal doubts and celebrates breakthroughs.",
    tone: "motivational",
  },
  {
    id: "roast-battle",
    label: "Roast Battle",
    icon: "🔥",
    category: "Comedy",
    hook: "Satirical format for hot takes, pop culture roasts, and comedic commentary.",
    speakerA: "Quick-witted roaster with surgical one-liners and comedic timing.",
    speakerB: "Self-aware target who fires back with unexpected comebacks and charm.",
    tone: "comedy",
  },
];

export const voicePresetCatalog = [
  {
    id: "atlas-anchor",
    label: "Atlas Anchor",
    persona: "Grounded male explainer voice with newsroom pacing.",
    language: "en",
    tags: ["editorial", "trust", "calm"],
    fishModelId: "atlas-anchor",
    previewUrl: "",
    recommendedEmotion: "neutral",
    recommendedRate: 0.98,
    hasRefAudio: true,
  },
  {
    id: "nova-spark",
    label: "Nova Spark",
    persona: "Energetic reveal voice built for fast social hooks.",
    language: "en",
    tags: ["reveal", "bright", "social"],
    fishModelId: "nova-spark",
    previewUrl: "",
    recommendedEmotion: "excited",
    recommendedRate: 1.08,
    hasRefAudio: true,
  },
  {
    id: "saffron-note",
    label: "Saffron Note",
    persona: "Warm bilingual delivery that feels human on educational reels.",
    language: "hinglish",
    tags: ["warm", "bilingual", "creator"],
    fishModelId: "saffron-note",
    previewUrl: "",
    recommendedEmotion: "happy",
    recommendedRate: 1.02,
    hasRefAudio: true,
  },
  {
    id: "midnight-proof",
    label: "Midnight Proof",
    persona: "Low-register debate voice for myth-busting and strong claims.",
    language: "en",
    tags: ["debate", "deep", "assertive"],
    fishModelId: "midnight-proof",
    previewUrl: "",
    recommendedEmotion: "neutral",
    recommendedRate: 0.96,
    hasRefAudio: true,
  },
];

export type VoicePreset = typeof voicePresetCatalog[number];

export const assetPackCatalog = [
  {
    id: "metro-glass",
    label: "Metro Glass",
    category: "backgrounds",
    description: "Reflective city gradients and lens-bloom motion for polished explainers.",
  },
  {
    id: "paper-signals",
    label: "Paper Signals",
    category: "stickers",
    description: "Editorial cutout sticker pack with ink-like shadows and tactile frames.",
  },
  {
    id: "kinetic-ledger",
    label: "Kinetic Ledger",
    category: "backgrounds",
    description: "Data-grid loops built for analytics, finance, and product education shorts.",
  },
];

export const pollyVoiceCatalog = [
  { id: "Matthew", label: "Matthew (US Male)", language: "en-US", gender: "male", tags: ["clear", "narration", "news"] },
  { id: "Joanna", label: "Joanna (US Female)", language: "en-US", gender: "female", tags: ["warm", "friendly", "conversational"] },
  { id: "Ivy", label: "Ivy (US Child)", language: "en-US", gender: "female", tags: ["youthful", "energetic"] },
  { id: "Kevin", label: "Kevin (US Male)", language: "en-US", gender: "male", tags: ["casual", "modern"] },
  { id: "Justin", label: "Justin (US Male)", language: "en-US", gender: "male", tags: ["deep", "authoritative"] },
  { id: "Kendra", label: "Kendra (US Female)", language: "en-US", gender: "female", tags: ["professional", "clear"] },
  { id: "Amy", label: "Amy (UK Female)", language: "en-GB", gender: "female", tags: ["british", "elegant"] },
  { id: "Brian", label: "Brian (UK Male)", language: "en-GB", gender: "male", tags: ["british", "distinguished"] },
  { id: "Arthur", label: "Arthur (UK Male)", language: "en-GB", gender: "male", tags: ["british", "deep"] },
  { id: "Emma", label: "Emma (UK Female)", language: "en-GB", gender: "female", tags: ["british", "warm"] },
  { id: "Kajal", label: "Kajal (Indian Female)", language: "en-IN", gender: "female", tags: ["indian", "warm", "bilingual"] },
  { id: "Aditi", label: "Aditi (Indian Female)", language: "en-IN", gender: "female", tags: ["indian", "clear", "bilingual"] },
  { id: "Nicole", label: "Nicole (AU Female)", language: "en-AU", gender: "female", tags: ["australian", "friendly"] },
  { id: "Russell", label: "Russell (AU Male)", language: "en-AU", gender: "male", tags: ["australian", "casual"] },
] as const;

export type PollyVoice = typeof pollyVoiceCatalog[number];

export const gameBackgroundCatalog = [
  {
    id: "fortnite",
    label: "Fortnite",
    description: "Epic gaming moments and battle royale clips",
    videos: [
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Fortnite/split_001.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Fortnite/split_002.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Fortnite/split_003.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Fortnite/split_004.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Fortnite/split_005.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Fortnite/split_006.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Fortnite/split_007.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Fortnite/split_008.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Fortnite/split_009.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Fortnite/split_010.mp4",
    ],
  },
  {
    id: "gta",
    label: "GTA V",
    description: "Open world chaos and heist highlights",
    videos: [
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/GTA/video_2.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/GTA/video_3.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/GTA/video_7.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/GTA/video_9.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/GTA/video_11.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/GTA/video_12.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/GTA/video_13.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/GTA/video_14.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/GTA/video_15.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/GTA/video_16.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/GTA/video_17.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/GTA/video_18.mp4",
    ],
  },
  {
    id: "minecraft",
    label: "Minecraft",
    description: "Building adventures and blocky action",
    videos: [
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Minecraft/reel_001.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Minecraft/reel_002.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Minecraft/reel_005.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Minecraft/reel_006.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Minecraft/reel_007.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Minecraft/reel_008.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Minecraft/reel_009.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Minecraft/reel_010.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Minecraft/reel_011.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Minecraft/reel_012.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Minecraft/reel_013.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Minecraft/reel_014.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Minecraft/reel_015.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Minecraft/reel_016.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Minecraft/reel_017.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Minecraft/reel_018.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Minecraft/reel_019.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Minecraft/reel_022.mp4",
    ],
  },
  {
    id: "subway",
    label: "Subway Surfers",
    description: "Endless runner highlights and city dashes",
    videos: [
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Subway/reel_000.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Subway/reel_001.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Subway/reel_002.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Subway/reel_003.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Subway/reel_004.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Subway/reel_005.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Subway/reel_006.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Subway/reel_007.mp4",
      "https://brainclips-videos.s3.us-east-1.amazonaws.com/Subway/reel_008.mp4",
    ],
  },
];

export type GameBackground = typeof gameBackgroundCatalog[number];

export const getRandomVideo = (gameId: string): string | null => {
  const game = gameBackgroundCatalog.find(g => g.id === gameId);
  if (!game || game.videos.length === 0) return null;
  return game.videos[Math.floor(Math.random() * game.videos.length)];
};

export const subtitlePresetCatalog = [
  {
    id: "pop-highlight",
    label: "Pop Highlight",
    note: "Classic social captioning with an active-word pop.",
  },
  {
    id: "word-fade",
    label: "Word Fade",
    note: "Soft sequential reveal for thoughtful topics.",
  },
  {
    id: "karaoke",
    label: "Karaoke Sweep",
    note: "Underline sweep tuned for rhythmic delivery.",
  },
  {
    id: "sentence-reveal",
    label: "Sentence Reveal",
    note: "One-line cinematic emphasis.",
  },
  {
    id: "typewriter",
    label: "Typewriter",
    note: "Editorial cursor treatment for interviews and commentary.",
  },
  {
    id: "pill-word",
    label: "Pill Word",
    note: "Rounded per-word capsules for bold personality.",
  },
  {
    id: "cinematic-shadow",
    label: "Cinematic Shadow",
    note: "Dense shadowed captions that sit over busy footage.",
  },
  {
    id: "outline-bold",
    label: "Outline Bold",
    note: "Punchy contour captions for creator-style reels.",
  },
];

export const stickerPresetCatalog = [
  { id: "avatar-1", label: "Cool Headphones", url: "https://brainclips-videos.s3.us-east-1.amazonaws.com/stickers/presets/headphones.png", emoji: "🎧" },
  { id: "avatar-2", label: "Lightning Bolt", url: "https://brainclips-videos.s3.us-east-1.amazonaws.com/stickers/presets/lightning.png", emoji: "⚡" },
  { id: "avatar-3", label: "Fire Flame", url: "https://brainclips-videos.s3.us-east-1.amazonaws.com/stickers/presets/fire.png", emoji: "🔥" },
  { id: "avatar-4", label: "Star", url: "https://brainclips-videos.s3.us-east-1.amazonaws.com/stickers/presets/star.png", emoji: "⭐" },
  { id: "avatar-5", label: "Rocket", url: "https://brainclips-videos.s3.us-east-1.amazonaws.com/stickers/presets/rocket.png", emoji: "🚀" },
  { id: "avatar-6", label: "Brain", url: "https://brainclips-videos.s3.us-east-1.amazonaws.com/stickers/presets/brain.png", emoji: "🧠" },
  { id: "avatar-7", label: "Crown", url: "https://brainclips-videos.s3.us-east-1.amazonaws.com/stickers/presets/crown.png", emoji: "👑" },
  { id: "avatar-8", label: "Diamond", url: "https://brainclips-videos.s3.us-east-1.amazonaws.com/stickers/presets/diamond.png", emoji: "💎" },
  { id: "avatar-9", label: "Microphone", url: "https://brainclips-videos.s3.us-east-1.amazonaws.com/stickers/presets/mic.png", emoji: "🎤" },
  { id: "avatar-10", label: "Thumbs Up", url: "https://brainclips-videos.s3.us-east-1.amazonaws.com/stickers/presets/thumbsup.png", emoji: "👍" },
  { id: "avatar-11", label: "Speech Bubble", url: "https://brainclips-videos.s3.us-east-1.amazonaws.com/stickers/presets/speech.png", emoji: "💬" },
  { id: "avatar-12", label: "Glasses", url: "https://brainclips-videos.s3.us-east-1.amazonaws.com/stickers/presets/glasses.png", emoji: "😎" },
];

export type StickerPreset = typeof stickerPresetCatalog[number];
