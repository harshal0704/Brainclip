"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { voicePresetCatalog, assetPackCatalog, duoPresets, subtitlePresetCatalog } from "@/lib/catalog";
import type { CustomVoice } from "./VoiceLibrary";

export type JobRecord = {
  id: string;
  status: string;
  stage: string | null;
  progressPct: number;
  createdAt: string;
  errorMessage: string | null;
  s3VideoKey?: string | null;
};

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export type SelectedCustomVoices = {
  speakerA?: { id: string; modelId: string; name: string };
  speakerB?: { id: string; modelId: string; name: string };
};

export type SettingsState = {
  llmBaseUrl: string;
  llmModel: string;
  llmApiKey: string;
  ttsProvider: "fish" | "huggingface" | "elevenlabs" | "polly";
  renderProvider: "lambda" | "colab" | "github";
  fishModelA: string;
  fishModelB: string;
  fishApiKey: string;
  hfModelA: string;
  hfModelB: string;
  hfToken: string;
  elevenLabsVoiceA: string;
  elevenLabsVoiceB: string;
  elevenLabsApiKey: string;
  pollyVoiceA: string;
  pollyVoiceB: string;
  colabUrl: string;
  githubToken: string;
  githubRepo: string;
  hasLlmApiKey?: boolean;
  hasFishApiKey?: boolean;
  hasHfToken?: boolean;
  hasElevenLabsApiKey?: boolean;
  hasGithubToken?: boolean;
};

export type ScriptLine = {
  id: string;
  speaker: "A" | "B";
  text: string;
  emotion: string;
  speaking_rate: number;
  pause_ms: number;
  temperature: number;
  chunk_length: number;
  normalize: boolean;
};

const defaultSettings: SettingsState = {
  llmBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
  llmModel: "gemini-1.5-flash",
  llmApiKey: "",
  ttsProvider: "fish",
  renderProvider: "lambda",
  fishModelA: voicePresetCatalog[0]?.fishModelId ?? "",
  fishModelB: voicePresetCatalog[1]?.fishModelId ?? "",
  fishApiKey: "",
  hfModelA: "hexgrad/Kokoro-82M",
  hfModelB: "hexgrad/Kokoro-82M",
  hfToken: "",
  elevenLabsVoiceA: "JBFqnCBsd6RMkjVDRZzb",
  elevenLabsVoiceB: "JBFqnCBsd6RMkjVDRZzb",
  elevenLabsApiKey: "",
  pollyVoiceA: "Matthew",
  pollyVoiceB: "Joanna",
  colabUrl: "",
  githubToken: "",
  githubRepo: "",
};

const defaultDuo = duoPresets[0];

export const buildDefaultEditorForm = () => ({
  topic: "Why short-form lessons outperform long lectures when the goal is retention",
  tone: defaultDuo.tone,
  language: "en",
  duoId: defaultDuo.id,
  speakerAPersona: defaultDuo.speakerA,
  speakerBPersona: defaultDuo.speakerB,
  voiceMode: "fish-api" as "fish-api" | "colab",
  subtitleStyle: "pop-highlight",
  stickerAnim: "bounce" as "bounce" | "slide" | "float" | "pulse" | "shake" | "static" | "spin",
  stickerShape: "circle" as "circle" | "rounded-square" | "hexagon",
  stickerUrlA: "",
  stickerUrlB: "",
  backgroundUrl: "",
  backgroundGameId: "",
  bgDimOpacity: 0.34,
  showProgressBar: true,
  assetPackId: assetPackCatalog[0]?.id ?? "",
  resolution: "720p" as "720p" | "480p",
  ctaText: "Made with Brainclip.",
  draftId: undefined as string | undefined,
  subtitlePosition: "bottom" as "top" | "middle" | "bottom",
  subtitleSize: 46,
  subtitleColor: "#ffffff",
  subtitleOutlineColor: "#000000",
  subtitleOutlineWidth: 0,
  subtitleFontFamily: "Inter" as "Inter" | "Montserrat" | "Poppins" | "Roboto" | "Oswald" | "Bebas Neue" | "Anton",
  colorGrading: "none" as "none" | "warm" | "cool" | "vintage" | "cinematic" | "noir",
});

type EditorForm = ReturnType<typeof buildDefaultEditorForm>;

type WorkspaceContextType = {
  settings: SettingsState;
  setSettings: React.Dispatch<React.SetStateAction<SettingsState>>;
  settingsMessage: string;
  setSettingsMessage: React.Dispatch<React.SetStateAction<string>>;
  jobs: JobRecord[];
  setJobs: React.Dispatch<React.SetStateAction<JobRecord[]>>;
  scriptLines: ScriptLine[];
  setScriptLines: React.Dispatch<React.SetStateAction<ScriptLine[]>>;
  jobResultUrl: string;
  setJobResultUrl: React.Dispatch<React.SetStateAction<string>>;
  activeJobId: string;
  setActiveJobId: React.Dispatch<React.SetStateAction<string>>;
  editorForm: EditorForm;
  setEditorForm: React.Dispatch<React.SetStateAction<EditorForm>>;
  editorMessage: string;
  setEditorMessage: React.Dispatch<React.SetStateAction<string>>;
  isGeneratingScript: boolean;
  setIsGeneratingScript: React.Dispatch<React.SetStateAction<boolean>>;
  isStartingRender: boolean;
  setIsStartingRender: React.Dispatch<React.SetStateAction<boolean>>;
  wizardStep: WizardStep;
  setWizardStep: React.Dispatch<React.SetStateAction<WizardStep>>;
  completedSteps: Set<WizardStep>;
  setCompletedSteps: React.Dispatch<React.SetStateAction<Set<WizardStep>>>;
  isSavingDraft: boolean;
  setIsSavingDraft: React.Dispatch<React.SetStateAction<boolean>>;
  renderHealth: { ok: boolean; note: string };
  selectedCustomVoices: SelectedCustomVoices;
  setSelectedCustomVoices: React.Dispatch<React.SetStateAction<SelectedCustomVoices>>;
  selectedJobDetail: JobRecord | null;
  setSelectedJobDetail: React.Dispatch<React.SetStateAction<JobRecord | null>>;
  activeJob: JobRecord | null;
  isRetryingJob: boolean;
  isDeletingJob: boolean;
  isLoadingSettings: boolean;
  isLoadingJobs: boolean;
  isLoadingHealth: boolean;
  loadSettings: () => Promise<void>;
  loadJobs: () => Promise<void>;
  startPollingJob: (jobId: string) => void;
  openJobDetail: (job: JobRecord) => void;
  retryJob: (jobId: string, stage: "voice" | "render" | "all") => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  deleteOldJobs: () => Promise<void>;
  saveSettings: () => Promise<void>;
  generateScript: () => Promise<void>;
  startRenderFlow: () => Promise<void>;
  saveDraft: () => Promise<void>;
  handleUploadSticker: (speaker: "A" | "B", file: File) => Promise<void>;
  applyDuoPreset: (duoId: string) => void;
  handleVoiceSelect: (voice: CustomVoice, speaker: "A" | "B") => void;
  refreshJobUrl: (jobId: string) => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
};

export const WorkspaceProvider = ({ children }: { children: React.ReactNode }) => {
  const { status } = useSession();
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [scriptLines, setScriptLines] = useState<ScriptLine[]>([]);
  const [jobResultUrl, setJobResultUrl] = useState("");
  const [activeJobId, setActiveJobId] = useState("");
  const [editorForm, setEditorForm] = useState(buildDefaultEditorForm);
  const [editorMessage, setEditorMessage] = useState("");
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isStartingRender, setIsStartingRender] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set());
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [renderHealth, setRenderHealth] = useState<{ ok: boolean; note: string }>({ ok: false, note: "Render health not checked yet." });
  const [selectedCustomVoices, setSelectedCustomVoices] = useState<SelectedCustomVoices>({});
  const [selectedJobDetail, setSelectedJobDetail] = useState<JobRecord | null>(null);
  const [isRetryingJob, setIsRetryingJob] = useState(false);
  const [isDeletingJob, setIsDeletingJob] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [isLoadingHealth, setIsLoadingHealth] = useState(true);
  const pollRef = useRef<number | null>(null);

  const activeJob = useMemo(() => jobs.find((job) => job.id === activeJobId) ?? jobs[0] ?? null, [activeJobId, jobs]);

  const loadSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    try {
      const response = await fetch("/api/settings");
      const data = await response.json();
      if (response.ok) {
        setSettings((current) => ({ ...current, ...data.settings, llmApiKey: data.settings.llmApiKey || "", fishApiKey: data.settings.fishApiKey || "", hfToken: data.settings.hfToken || "", elevenLabsApiKey: data.settings.elevenLabsApiKey || "", pollyVoiceA: data.settings.pollyVoiceA || "Matthew", pollyVoiceB: data.settings.pollyVoiceB || "Joanna", githubToken: data.settings.githubToken || "", githubRepo: data.settings.githubRepo || "" }));
      }
    } finally {
      setIsLoadingSettings(false);
    }
  }, []);

  const loadJobs = useCallback(async () => {
    setIsLoadingJobs(true);
    try {
      const response = await fetch("/api/jobs");
      const data = await response.json();
      if (response.ok) {
        setJobs(data.jobs ?? []);
        if (!activeJobId && data.jobs?.[0]?.id) {
          setActiveJobId(data.jobs[0].id);
        }
      }
    } finally {
      setIsLoadingJobs(false);
    }
  }, [activeJobId]);

  const loadRenderHealth = useCallback(async () => {
    setIsLoadingHealth(true);
    try {
      const provider = settings.renderProvider || "lambda";
      const response = await fetch(`/api/render/health?provider=${provider}`);
      const data = await response.json();
      if (!response.ok) {
        setRenderHealth({
          ok: false,
          note: data.error?.userMessage ?? "Render engine needs configuration. Check Settings."
        });
        return;
      }
      
      if (data.provider === "github") {
        if (data.needsConfig) {
          setRenderHealth({ ok: false, note: data.note });
        } else if (data.ok) {
          setRenderHealth({ ok: true, note: data.note });
        } else {
          setRenderHealth({ ok: false, note: data.note || "GitHub connection failed." });
        }
      } else {
        setRenderHealth({ ok: true, note: `${data.functionName} ready in AWS Lambda.` });
      }
    } catch {
      setRenderHealth({
        ok: false,
        note: "Could not verify render engine status. Check Settings for configuration."
      });
    } finally {
      setIsLoadingHealth(false);
    }
  }, [settings.renderProvider]);

  // Load settings and jobs only once when authenticated
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (status === "authenticated" && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      void Promise.all([loadSettings(), loadJobs(), loadRenderHealth()]);
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-check render health whenever the user changes the provider dropdown
  useEffect(() => {
    if (status === "authenticated" && hasInitializedRef.current) {
      void loadRenderHealth();
    }
  }, [settings.renderProvider]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
    }
  }, []);

  const startPollingJob = useCallback((jobId: string) => {
    setActiveJobId(jobId);

    if (pollRef.current) {
      window.clearInterval(pollRef.current);
    }

    const poll = async () => {
      const response = await fetch(`/api/jobs/${jobId}`);
      const data = await response.json();

      if (!response.ok) {
        setEditorMessage(data.error?.userMessage ?? "Polling failed.");
        return;
      }

      const nextJob = data.job;
      if (!nextJob) {
        return;
      }

      setJobs((current) => {
        const rest = current.filter((job) => job.id !== nextJob.id);
        return [nextJob, ...rest].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      });

      if (nextJob.status === "done" || nextJob.status === "failed") {
        if (pollRef.current) {
          window.clearInterval(pollRef.current);
        }

        if (nextJob.status === "done") {
          const resultResponse = await fetch(`/api/jobs/${jobId}/result`);
          const resultData = await resultResponse.json();
          if (resultResponse.ok) {
            setJobResultUrl(resultData.url);
          }
        }
      }
    };

    void poll();
    pollRef.current = window.setInterval(poll, 10000);
  }, []);

  const openJobDetail = useCallback((job: JobRecord) => {
    setSelectedJobDetail(job);
  }, []);

  const retryJob = useCallback(async (jobId: string, stage: "voice" | "render" | "all") => {
    setIsRetryingJob(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}/retry`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      const data = await response.json();

      if (!response.ok) {
        setEditorMessage(data.error?.userMessage ?? "Retry failed.");
        return;
      }

      setEditorMessage(`Job restarted from ${stage} stage.`);
      setSelectedJobDetail(null);
      startPollingJob(jobId);
      await loadJobs();
    } catch {
      setEditorMessage("Failed to retry job.");
    } finally {
      setIsRetryingJob(false);
    }
  }, [loadJobs, startPollingJob]);

  const deleteJob = useCallback(async (jobId: string) => {
    if (!confirm("Delete this job? This cannot be undone.")) return;

    setIsDeletingJob(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        setEditorMessage(data.error?.userMessage ?? "Delete failed.");
        return;
      }

      setEditorMessage("Job deleted.");
      setSelectedJobDetail(null);
      await loadJobs();
    } catch {
      setEditorMessage("Failed to delete job.");
    } finally {
      setIsDeletingJob(false);
    }
  }, [loadJobs]);

  const deleteOldJobs = useCallback(async () => {
    if (!confirm("Delete all completed jobs older than 30 days? This cannot be undone.")) return;

    try {
      const response = await fetch("/api/jobs?action=cleanup-old", {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        setEditorMessage(data.error?.userMessage ?? "Cleanup failed.");
        return;
      }

      setEditorMessage("Old jobs cleaned up.");
      await loadJobs();
    } catch {
      setEditorMessage("Failed to cleanup old jobs.");
    }
  }, [loadJobs]);

  const refreshJobUrl = useCallback(async (jobId: string) => {
    try {
      const resultResponse = await fetch(`/api/jobs/${jobId}/result`);
      const resultData = await resultResponse.json();
      if (resultResponse.ok) {
        setJobResultUrl(resultData.url);
      }
    } catch {
      console.error("[refreshJobUrl] Failed to fetch URL for job", jobId);
    }
  }, []);

  const saveSettings = useCallback(async () => {
    setSettingsMessage("Saving routing, voices, and model access...");
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(settings),
    });
    const data = await response.json();

    if (!response.ok) {
      setSettingsMessage(data.error?.userMessage ?? "Could not save settings.");
      return;
    }

    setSettings((current) => ({ ...current, ...data.settings, llmApiKey: data.settings.llmApiKey || "", fishApiKey: data.settings.fishApiKey || "", hfToken: data.settings.hfToken || "", githubToken: data.settings.githubToken || "", githubRepo: data.settings.githubRepo || "" }));
    setSettingsMessage("Studio settings saved. Brainclip can now generate and route jobs.");
  }, [settings]);

  const generateScript = useCallback(async () => {
    setEditorMessage("Generating a duo script with your model and timing rules...");
    const response = await fetch("/api/script/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topic: editorForm.topic,
        tone: editorForm.tone,
        language: editorForm.language,
        speakerAPersona: editorForm.speakerAPersona,
        speakerBPersona: editorForm.speakerBPersona,
        tempA: 0.7,
        tempB: 0.7,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setEditorMessage(data.error?.userMessage ?? "Script generation failed.");
      return;
    }

    setScriptLines(data.scriptLines ?? []);
    setEditorMessage("Script ready. Refine the lines, then start the production flow.");
  }, [editorForm]);

  const startRenderFlow = useCallback(async () => {
    setEditorMessage("Starting voice generation and preparing the Remotion render...");
    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topic: editorForm.topic,
        duoId: editorForm.duoId,
        scriptLines,
        voiceMap: {
          mode: editorForm.voiceMode,
          speakerA: {
            label: "Speaker A",
            color: "#84d7ff",
            stickerUrl: editorForm.stickerUrlA,
            position: "top",
            modelId: settings.ttsProvider === "huggingface" ? settings.hfModelA : settings.ttsProvider === "elevenlabs" ? settings.elevenLabsVoiceA : settings.fishModelA,
          },
          speakerB: {
            label: "Speaker B",
            color: "#ffb36b",
            stickerUrl: editorForm.stickerUrlB,
            position: "bottom",
            modelId: settings.ttsProvider === "huggingface" ? settings.hfModelB : settings.ttsProvider === "elevenlabs" ? settings.elevenLabsVoiceB : settings.fishModelB,
          },
        },
        subtitleStyleId: editorForm.subtitleStyle,
        backgroundGameId: editorForm.backgroundGameId,
        resolution: editorForm.resolution,
        editConfig: {
          stickerAnim: editorForm.stickerAnim,
          stickerShape: editorForm.stickerShape ?? "circle",
          subtitleFont: editorForm.subtitleFontFamily ?? "Inter",
          subtitleSize: editorForm.subtitleSize ?? 46,
          subtitleFill: editorForm.subtitleColor ?? "#ffffff",
          subtitleStroke: editorForm.subtitleOutlineColor ?? "#000000",
          subtitleOutlineWidth: editorForm.subtitleOutlineWidth ?? 0,
          subtitleHighlight: "#84d7ff",
          subtitlePosition: editorForm.subtitlePosition ?? "bottom",
          subtitleY: editorForm.subtitlePosition === "top" ? 15 : editorForm.subtitlePosition === "middle" ? 45 : 75,
          bgDimOpacity: editorForm.bgDimOpacity,
          bgColorOverlay: "#16202d",
          bgBlendMode: "screen",
          colorGrading: editorForm.colorGrading ?? "none",
          speakerLayout: "top-bottom",
          stickerSizeA: 150,
          stickerSizeB: 150,
          introAnim: "fade",
          animSpeed: 1,
          showProgressBar: editorForm.showProgressBar,
          ctaText: editorForm.ctaText,
          ctaStartSec: 4,
          reactionStickers: [],
          assetPackId: editorForm.assetPackId,
        },
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setEditorMessage(data.error?.userMessage ?? "Job creation failed.");
      return;
    }

    const job = data.job;
    if (job?.id) {
      setEditorMessage("Pipeline started. Brainclip is now routing voice and render work.");
      setJobResultUrl("");
      await loadJobs();
      startPollingJob(job.id);
      
      // We will redirect to /jobs from the page components instead of here directly,
      // or we can just window.location.href = '/jobs'
      window.location.href = '/jobs';
    }
  }, [editorForm, scriptLines, settings, loadJobs, startPollingJob]);

  const saveDraft = useCallback(async () => {
    setIsSavingDraft(true);
    try {
      const response = await fetch("/api/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          draftId: editorForm.draftId,
          topic: editorForm.topic,
          duoId: editorForm.duoId,
          speakerAPersona: editorForm.speakerAPersona,
          speakerBPersona: editorForm.speakerBPersona,
          voiceMode: editorForm.voiceMode,
          subtitleStyle: editorForm.subtitleStyle,
          stickerAnim: editorForm.stickerAnim,
          stickerUrlA: editorForm.stickerUrlA,
          stickerUrlB: editorForm.stickerUrlB,
          backgroundGameId: editorForm.backgroundGameId,
          bgDimOpacity: editorForm.bgDimOpacity,
          showProgressBar: editorForm.showProgressBar,
          assetPackId: editorForm.assetPackId,
          resolution: editorForm.resolution,
          ctaText: editorForm.ctaText,
          scriptLines: scriptLines,
          fishModelA: settings.fishModelA,
          fishModelB: settings.fishModelB,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.draft?.id) {
        setEditorForm((current) => ({ ...current, draftId: data.draft.id }));
        setEditorMessage("Draft saved successfully!");
      } else {
        setEditorMessage(data.error?.userMessage ?? "Failed to save draft.");
      }
    } catch (error) {
      setEditorMessage("Failed to save draft. Please try again.");
    } finally {
      setIsSavingDraft(false);
    }
  }, [editorForm, scriptLines, settings]);

  const handleUploadSticker = useCallback(async (speaker: "A" | "B", file: File) => {
    try {
      setEditorMessage(`Uploading sticker for Speaker ${speaker}...`);
      
      const res = await fetch("/api/upload/url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Could not get upload URL (${res.status})`);
      }
      
      const { uploadUrl, publicUrl } = await res.json();
      
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        const errorText = await uploadRes.text().catch(() => "");
        throw new Error(`Failed to upload to S3 (${uploadRes.status}): ${errorText.slice(0, 200)}`);
      }

      setEditorForm(current => ({
        ...current,
        [speaker === "A" ? "stickerUrlA" : "stickerUrlB"]: publicUrl
      }));
      
      setEditorMessage(`Sticker for Speaker ${speaker} uploaded successfully.`);
    } catch (e: any) {
      console.error("[Sticker Upload]", e);
      setEditorMessage(`Upload failed: ${e.message}`);
    }
  }, []);

  const applyDuoPreset = useCallback((duoId: string) => {
    const preset = duoPresets.find((item) => item.id === duoId);
    if (!preset) {
      return;
    }

    setEditorForm((current) => ({
      ...current,
      duoId: preset.id,
      tone: preset.tone,
      speakerAPersona: preset.speakerA,
      speakerBPersona: preset.speakerB,
    }));
    
    // Automatic voice selection based on preset
    if (voicePresetCatalog.length >= 2) {
      const idx = duoPresets.findIndex(p => p.id === duoId);
      const voiceA = voicePresetCatalog[(idx * 2) % voicePresetCatalog.length];
      const voiceB = voicePresetCatalog[(idx * 2 + 1) % voicePresetCatalog.length];
      if (voiceA && voiceB) {
        setSettings(current => ({
          ...current,
          fishModelA: voiceA.fishModelId || current.fishModelA,
          fishModelB: voiceB.fishModelId || current.fishModelB,
        }));
        setEditorMessage(`Auto-assigned voices: ${voiceA.label} and ${voiceB.label} to match the ${preset.label} duo.`);
      }
    }
  }, []);

  const handleVoiceSelect = useCallback((voice: CustomVoice, speaker: "A" | "B") => {
    if (!voice.fishModelId) {
      setEditorMessage("This voice hasn't been cloned yet. Clone it first to use as a speaker.");
      return;
    }

    setSelectedCustomVoices((prev) => ({
      ...prev,
      [speaker === "A" ? "speakerA" : "speakerB"]: {
        id: voice.id,
        modelId: voice.fishModelId!,
        name: voice.name,
      },
    }));

    setSettings((current) => {
      const update = { ...current };
      if (current.ttsProvider === "fish") {
        update[speaker === "A" ? "fishModelA" : "fishModelB"] = voice.fishModelId!;
      } else if (current.ttsProvider === "elevenlabs") {
        update[speaker === "A" ? "elevenLabsVoiceA" : "elevenLabsVoiceB"] = voice.fishModelId!;
      } else {
        update[speaker === "A" ? "hfModelA" : "hfModelB"] = voice.fishModelId!;
      }
      return update;
    });

    setEditorMessage(`Selected "${voice.name}" as Speaker ${speaker}`);
  }, []);

  const value = {
    settings,
    setSettings,
    settingsMessage,
    setSettingsMessage,
    jobs,
    setJobs,
    scriptLines,
    setScriptLines,
    jobResultUrl,
    setJobResultUrl,
    activeJobId,
    setActiveJobId,
    editorForm,
    setEditorForm,
    editorMessage,
    setEditorMessage,
    isGeneratingScript,
    setIsGeneratingScript,
    isStartingRender,
    setIsStartingRender,
    wizardStep,
    setWizardStep,
    completedSteps,
    setCompletedSteps,
    isSavingDraft,
    setIsSavingDraft,
    renderHealth,
    selectedCustomVoices,
    setSelectedCustomVoices,
    selectedJobDetail,
    setSelectedJobDetail,
    activeJob,
    isRetryingJob,
    isDeletingJob,
    isLoadingSettings,
    isLoadingJobs,
    isLoadingHealth,
    loadSettings,
    loadJobs,
    startPollingJob,
    openJobDetail,
    retryJob,
    deleteJob,
    deleteOldJobs,
    saveSettings,
    generateScript,
    startRenderFlow,
    saveDraft,
    handleUploadSticker,
    applyDuoPreset,
    handleVoiceSelect,
    refreshJobUrl,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};
