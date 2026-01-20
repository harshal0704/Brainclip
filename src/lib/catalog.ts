export const duoPresets = [
  {
    id: "expert-vs-beginner",
    label: "Expert vs Beginner",
    hook: "Great for explainers that start with tension and end with clarity.",
    speakerA: "Sharp operator who simplifies complex ideas without sounding robotic.",
    speakerB: "Curious beginner who asks smart questions the audience is already thinking.",
    tone: "educational",
  },
  {
    id: "debate-room",
    label: "Debate Room",
    hook: "High-retention format for opinionated topics and myth-busting clips.",
    speakerA: "Confident contrarian with punchy one-liners and bold hooks.",
    speakerB: "Measured realist who grounds the conversation with credible context.",
    tone: "debate",
  },
  {
    id: "host-guest",
    label: "Host and Guest",
    hook: "Best for interview-style shorts with memorable takeaways.",
    speakerA: "Warm host who guides the structure and sets up revealing prompts.",
    speakerB: "Insightful guest with story-driven answers and crisp analogies.",
    tone: "interview",
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
  },
];

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
