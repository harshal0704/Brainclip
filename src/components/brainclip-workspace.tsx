"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { assetPackCatalog, duoPresets, subtitlePresetCatalog, voicePresetCatalog } from "@/lib/catalog";
import { VoiceLibrary, type CustomVoice } from "./VoiceLibrary";
import { StepIndicator, ConceptStep, VoiceStep, StyleStep, ScriptStep, RenderStep } from "./wizard";

type JobRecord = {
  id: string;
  status: string;
  stage: string | null;
  progressPct: number;
  createdAt: string;
  errorMessage: string | null;
  s3VideoKey?: string | null;
};

type WorkspaceProps = {
  initialView: "dashboard" | "editor" | "voices" | "settings";
};

type WizardStep = 1 | 2 | 3 | 4 | 5;

type SelectedCustomVoices = {
  speakerA?: { id: string; modelId: string; name: string };
  speakerB?: { id: string; modelId: string; name: string };
};

type SettingsState = {
  llmBaseUrl: string;
  llmModel: string;
  llmApiKey: string;
  ttsProvider: "fish" | "huggingface" | "elevenlabs";
  renderProvider: "lambda" | "colab";
  fishModelA: string;
  fishModelB: string;
  fishApiKey: string;
  hfModelA: string;
  hfModelB: string;
  hfToken: string;
  elevenLabsVoiceA: string;
  elevenLabsVoiceB: string;
  elevenLabsApiKey: string;
  colabUrl: string;
  hasLlmApiKey?: boolean;
  hasFishApiKey?: boolean;
  hasHfToken?: boolean;
  hasElevenLabsApiKey?: boolean;
};

type ScriptLine = {
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
  colabUrl: "",
};

const defaultDuo = duoPresets[0];

const buildDefaultEditorForm = () => ({
  topic: "Why short-form lessons outperform long lectures when the goal is retention",
  tone: defaultDuo.tone,
  language: "en",
  duoId: defaultDuo.id,
  speakerAPersona: defaultDuo.speakerA,
  speakerBPersona: defaultDuo.speakerB,
  voiceMode: "fish-api" as "fish-api" | "colab",
  subtitleStyle: "pop-highlight",
  stickerAnim: "bounce" as "bounce" | "slide" | "float" | "pulse" | "shake" | "static" | "spin",
  stickerUrlA: "",
  stickerUrlB: "",
  backgroundUrl: "",
  bgDimOpacity: 0.34,
  showProgressBar: true,
  assetPackId: assetPackCatalog[0]?.id ?? "",
  resolution: "720p" as "720p" | "480p",
  ctaText: "Made with Brainclip.",
  draftId: undefined as string | undefined,
});

export const BrainclipWorkspace = ({ initialView }: WorkspaceProps) => {
  const { data: session, status } = useSession();
  const [view, setView] = useState(initialView);
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
  const pollRef = useRef<number | null>(null);

  const activeJob = useMemo(() => jobs.find((job) => job.id === activeJobId) ?? jobs[0] ?? null, [activeJobId, jobs]);
  const readyForFish = Boolean((settings.hasFishApiKey || settings.fishApiKey) && settings.fishModelA && settings.fishModelB);
  const readyForHf = Boolean((settings.hasHfToken || settings.hfToken) && settings.hfModelA && settings.hfModelB);
  const readyForElevenLabs = Boolean((settings.hasElevenLabsApiKey || settings.elevenLabsApiKey) && settings.elevenLabsVoiceA && settings.elevenLabsVoiceB);
  const readyForTTS = settings.ttsProvider === "huggingface" ? readyForHf : settings.ttsProvider === "elevenlabs" ? readyForElevenLabs : readyForFish;
  const readyForColab = Boolean(settings.colabUrl);
  const readyForLlm = Boolean(settings.llmModel && (settings.hasLlmApiKey || settings.llmApiKey));
  const isReadyForRender = readyForLlm && (editorForm.voiceMode === "fish-api" ? readyForTTS : readyForColab);

  const loadSettings = useCallback(async () => {
    const response = await fetch("/api/settings");
    const data = await response.json();
    if (response.ok) {
      setSettings((current) => ({ ...current, ...data.settings, llmApiKey: data.settings.llmApiKey || "", fishApiKey: data.settings.fishApiKey || "", hfToken: data.settings.hfToken || "", elevenLabsApiKey: data.settings.elevenLabsApiKey || "" }));
    }
  }, []);

  const loadJobs = useCallback(async () => {
    const response = await fetch("/api/jobs");
    const data = await response.json();
    if (response.ok) {
      setJobs(data.jobs ?? []);
      if (!activeJobId && data.jobs?.[0]?.id) {
        setActiveJobId(data.jobs[0].id);
      }
    }
  }, [activeJobId]);

  const loadRenderHealth = useCallback(async () => {
    try {
      const response = await fetch("/api/render/health");
      const data = await response.json();
      if (!response.ok) {
        setRenderHealth({ ok: false, note: data.error?.userMessage ?? "Render deployment needs attention." });
        return;
      }

      setRenderHealth({ ok: true, note: `${data.functionName} ready in AWS Lambda.` });
    } catch {
      setRenderHealth({ ok: false, note: "Could not verify Lambda health from the browser." });
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      void Promise.all([loadSettings(), loadJobs(), loadRenderHealth()]);
    }
  }, [loadJobs, loadRenderHealth, loadSettings, status]);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  useEffect(() => () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
    }
  }, []);

  const startPollingJob = (jobId: string) => {
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

      if (nextJob.status === "done") {
        if (pollRef.current) {
          window.clearInterval(pollRef.current);
        }

        const resultResponse = await fetch(`/api/jobs/${jobId}/result`);
        const resultData = await resultResponse.json();
        if (resultResponse.ok) {
          setJobResultUrl(resultData.url);
        }
      }
    };

    void poll();
    pollRef.current = window.setInterval(poll, 4000);
  };

  const saveSettings = async () => {
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

    setSettings((current) => ({ ...current, ...data.settings, llmApiKey: data.settings.llmApiKey || "", fishApiKey: data.settings.fishApiKey || "", hfToken: data.settings.hfToken || "" }));
    setSettingsMessage("Studio settings saved. Brainclip can now generate and route jobs.");
  };

  const generateScript = async () => {
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
  };

  const startRenderFlow = async () => {
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
        backgroundUrl: editorForm.backgroundUrl,
        resolution: editorForm.resolution,
        editConfig: {
          stickerAnim: editorForm.stickerAnim,
          subtitleFont: "Newsreader",
          subtitleSize: 46,
          subtitleFill: "#f9f5ee",
          subtitleStroke: "#0a1118",
          subtitleHighlight: "#84d7ff",
          subtitleY: 70,
          bgDimOpacity: editorForm.bgDimOpacity,
          bgColorOverlay: "#16202d",
          bgBlendMode: "screen",
          speakerLayout: "top-bottom",
          stickerSizeA: 150,
          stickerSizeB: 150,
          stickerShape: "circle",
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
      setView("dashboard");
    }
  };

  const saveDraft = async () => {
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
          backgroundUrl: editorForm.backgroundUrl,
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
  };

  const handleUploadSticker = async (speaker: "A" | "B", file: File) => {
    try {
      setEditorMessage(`Uploading sticker for Speaker ${speaker}...`);
      
      const res = await fetch("/api/upload/url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type })
      });
      
      if (!res.ok) throw new Error("Could not get upload URL");
      
      const { uploadUrl, publicUrl } = await res.json();
      
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });

      if (!uploadRes.ok) throw new Error("Failed to upload file to S3");

      setEditorForm(current => ({
        ...current,
        [speaker === "A" ? "stickerUrlA" : "stickerUrlB"]: publicUrl
      }));
      
      setEditorMessage(`Sticker for Speaker ${speaker} uploaded successfully.`);
    } catch (e: any) {
      setEditorMessage(`Upload failed: ${e.message}`);
    }
  };

  const applyDuoPreset = (duoId: string) => {
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
          // Could expand to set HF/ElevenLabs preset defaults here if we had them mapped
        }));
        setEditorMessage(`Auto-assigned voices: ${voiceA.label} and ${voiceB.label} to match the ${preset.label} duo.`);
      }
    }
  };

  const handleVoiceSelect = (voice: CustomVoice, speaker: "A" | "B") => {
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

    // Update the relevant TTS model in settings based on the current TTS provider
    setSettings((current) => {
      const update = { ...current };
      if (current.ttsProvider === "fish") {
        update[speaker === "A" ? "fishModelA" : "fishModelB"] = voice.fishModelId!;
      } else if (current.ttsProvider === "elevenlabs") {
        update[speaker === "A" ? "elevenLabsVoiceA" : "elevenLabsVoiceB"] = voice.fishModelId!; // Fallback logic assuming ID might be shared
      } else {
        update[speaker === "A" ? "hfModelA" : "hfModelB"] = voice.fishModelId!;
      }
      return update;
    });

    setEditorMessage(`Selected "${voice.name}" as Speaker ${speaker}`);
  };

  const selectedAssetPack = assetPackCatalog.find((item) => item.id === editorForm.assetPackId) ?? assetPackCatalog[0];
  const selectedSubtitlePreset = subtitlePresetCatalog.find((item) => item.id === editorForm.subtitleStyle);
  const completedJobs = jobs.filter((job) => job.status === "done").length;

  if (status === "loading") {
    return <main className="workspace-shell"><div className="status-chip">Loading Brainclip...</div></main>;
  }

  if (status !== "authenticated") {
    return (
      <main className="workspace-shell">
        <section className="signin-stage">
          <div className="stage-copy">
            <span className="eyebrow">Brainclip Studio</span>
            <h1>The fastest way to build vertical reels.</h1>
            <p>
              Sign in to manage your workspace, voices, and rendered history.
            </p>
            <div className="landing-actions">
              <button className="primary-button" onClick={() => signIn("google")}>Sign in with Google</button>
              <Link className="secondary-button inline-link" href="/">View landing page</Link>
            </div>
          </div>
          <div className="signin-panel">
            <div className="signal-card">
              <span className="signal-label">Included</span>
              <div className="catalog-row"><strong>Auth & S3</strong><span>Instant storage provisioning.</span></div>
              <div className="catalog-row"><strong>Voice Routing</strong><span>Fish.audio and custom endpoints.</span></div>
              <div className="catalog-row"><strong>Render Engine</strong><span>Cloud Lambda rendering.</span></div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand">Brainclip</div>
        <nav className="app-nav">
          <button className={`app-nav-item ${view === "editor" ? "active" : ""}`} onClick={() => setView("editor")}>
            Editor
          </button>
          <button className={`app-nav-item ${view === "voices" ? "active" : ""}`} onClick={() => setView("voices")}>
            Voice Library
          </button>
          <button className={`app-nav-item ${view === "dashboard" ? "active" : ""}`} onClick={() => setView("dashboard")}>
            Jobs & Activity
          </button>
          <button className={`app-nav-item ${view === "settings" ? "active" : ""}`} onClick={() => setView("settings")}>
            Studio Settings
          </button>
        </nav>
        <div className="app-user-section">
          <span className="app-user-email">{session.user?.email}</span>
          <button className="secondary-button" style={{ width: "100%", padding: "8px" }} onClick={() => signOut()}>Sign out</button>
        </div>
      </aside>

      <main className="app-main">
        {view === "editor" ? (
          <div className="workspace-stack">
            <div className="view-header">
              <h1>Create Video</h1>
              <p>Follow the steps to create your video</p>
            </div>

            <StepIndicator
              currentStep={wizardStep}
              onStepClick={(step) => {
                if (step <= wizardStep || completedSteps.has(step as WizardStep)) {
                  setWizardStep(step as WizardStep);
                }
              }}
              completedSteps={completedSteps}
            />

            {wizardStep === 1 && (
              <ConceptStep
                form={editorForm}
                onFormChange={setEditorForm as any}
                onUploadSticker={handleUploadSticker}
                message={editorMessage}
              />
            )}

            {wizardStep === 2 && (
              <VoiceStep
                form={editorForm}
                settings={settings}
                onFormChange={setEditorForm as any}
                onSettingsChange={setSettings as any}
                onGoToVoiceLibrary={() => setView("voices")}
                message={editorMessage}
              />
            )}

            {wizardStep === 3 && (
              <StyleStep
                form={editorForm}
                onFormChange={setEditorForm as any}
                message={editorMessage}
              />
            )}

            {wizardStep === 4 && (
              <ScriptStep
                form={editorForm}
                scriptLines={scriptLines as any}
                onScriptLinesChange={setScriptLines as any}
                onGenerateScript={async () => {
                  setIsGeneratingScript(true);
                  setEditorMessage("Generating script...");
                  try {
                    await generateScript();
                    setCompletedSteps((prev) => new Set(prev).add(4));
                    setEditorMessage("Script generated! You can now edit each line.");
                  } finally {
                    setIsGeneratingScript(false);
                  }
                }}
                isGenerating={isGeneratingScript}
                message={editorMessage}
              />
            )}

            {wizardStep === 5 && (
              <RenderStep
                form={editorForm}
                settings={settings as any}
                scriptLines={scriptLines as any}
                onFormChange={setEditorForm as any}
                onStartRender={async () => {
                  setIsStartingRender(true);
                  setEditorMessage("Starting render pipeline...");
                  try {
                    await startRenderFlow();
                  } finally {
                    setIsStartingRender(false);
                  }
                }}
                isStarting={isStartingRender}
                message={editorMessage}
              />
            )}

            <div className="wizard-nav">
              {wizardStep > 1 && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setWizardStep((wizardStep - 1) as WizardStep)}
                >
                  ← Back
                </button>
              )}
              
              <button
                type="button"
                className="secondary-button"
                onClick={saveDraft}
                disabled={isSavingDraft}
              >
                {isSavingDraft ? "Saving..." : "Save Draft"}
              </button>

              {wizardStep < 5 && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    setCompletedSteps((prev) => new Set(prev).add(wizardStep));
                    setWizardStep((wizardStep + 1) as WizardStep);
                  }}
                  disabled={wizardStep === 1 && (!editorForm.topic || !editorForm.duoId)}
                >
                  Next →
                </button>
              )}
            </div>
          </div>
        ) : view === "dashboard" ? (
          <div className="workspace-stack">
            <div className="view-header">
              <h1>Jobs & Activity</h1>
              <p>Monitor your active renders and review past completed reels.</p>
            </div>

            <div className="dashboard-stats">
              <div className="stat-card">
                <span className="stat-card-value">{jobs.length}</span>
                <span className="stat-card-label">Total Jobs</span>
              </div>
              <div className="stat-card">
                <span className="stat-card-value">{completedJobs}</span>
                <span className="stat-card-label">Completed Renders</span>
              </div>
              <div className="stat-card">
                <span className="stat-card-value">{activeJob?.progressPct ?? 0}%</span>
                <span className="stat-card-label">Live Progress</span>
              </div>
            </div>

            {activeJob && (
              <section className="panel-block active-job-panel" style={{boxShadow: 'var(--shadow-lg)', border: '1px solid var(--accent-soft)', background: 'linear-gradient(to bottom, var(--panel), var(--bg))'}}>
                <div className="panel-intro">
                  <strong style={{color: 'var(--accent-deep)', fontSize: '1.2rem'}}>Active Pipeline</strong>
                </div>
                <div className="progress-track" style={{height: '14px', margin: '8px 0', border: '1px solid var(--line)'}}>
                  <div className="progress-fill" style={{ width: `${activeJob.progressPct}%`, transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }} />
                </div>
                <div className="status-list wide" style={{display: 'flex', gap: '16px', background: 'var(--panel-strong)', padding: '16px', borderRadius: '16px'}}>
                   <div className="status-row" style={{flex: 1, flexDirection: 'column', alignItems: 'flex-start', border: 'none', padding: 0}}>
                      <strong style={{fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.05em'}}>Status</strong>
                      <span style={{fontSize: '1.2rem', color: 'var(--ink)', fontWeight: 600}}>{activeJob.status}</span>
                   </div>
                   <div className="status-row" style={{flex: 1, flexDirection: 'column', alignItems: 'flex-start', border: 'none', padding: 0}}>
                      <strong style={{fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.05em'}}>Stage</strong>
                      <span style={{fontSize: '1.2rem', color: 'var(--ink)'}}>{activeJob.stage ?? "Waiting"}</span>
                   </div>
                </div>
                {activeJob.errorMessage && <div className="error-banner">{activeJob.errorMessage}</div>}
                {jobResultUrl && <a className="primary-button inline-link" href={jobResultUrl} target="_blank" style={{boxShadow: 'var(--shadow-sm)', marginTop: '8px'}}>Download Video</a>}
              </section>
            )}

            <section className="panel-block">
              <div className="panel-intro">
                <strong>Job History</strong>
              </div>
              <div className="job-grid">
                {jobs.length === 0 ? (
                  <div className="empty-panel" style={{textAlign: 'center'}}>No jobs rendered yet.</div>
                ) : (
                  jobs.map((job) => (
                    <button key={job.id} className={activeJobId === job.id ? "job-card active" : "job-card"} onClick={() => startPollingJob(job.id)}>
                      <div>
                        <strong>{job.status}</strong>
                        <span>{job.stage ?? "Waiting"}</span>
                      </div>
                      <div className="job-progress-pill">{job.progressPct}%</div>
                    </button>
                  ))
                )}
              </div>
            </section>
          </div>
        ) : view === "voices" ? (
          <div className="workspace-stack">
            <div className="view-header">
              <h1>Voice Library</h1>
              <p>Upload voice references and clone them to your active roster.</p>
            </div>
            <section className="panel-block">
              {selectedCustomVoices.speakerA || selectedCustomVoices.speakerB ? (
                <div className="selected-voices-bar">
                  <span className="selected-voices-label">Selected for next render:</span>
                  {selectedCustomVoices.speakerA && (
                    <span className="selected-voice-chip speaker-a">
                      Speaker A: {selectedCustomVoices.speakerA.name}
                    </span>
                  )}
                  {selectedCustomVoices.speakerB && (
                    <span className="selected-voice-chip speaker-b">
                      Speaker B: {selectedCustomVoices.speakerB.name}
                    </span>
                  )}
                  <button className="secondary-button small" onClick={() => setView("editor")}>
                    Return to Editor
                  </button>
                </div>
              ) : null}
            </section>
            <VoiceLibrary 
              selectionMode={true}
              onSelectVoice={handleVoiceSelect}
              selectedVoiceIds={{
                speakerA: selectedCustomVoices.speakerA?.id,
                speakerB: selectedCustomVoices.speakerB?.id,
              }}
            />
          </div>
        ) : view === "settings" ? (
          <div className="workspace-stack">
            <div className="view-header">
              <h1>Settings</h1>
              <p>Manage API keys, routing, and render health.</p>
            </div>
            
            <section className="panel-block" style={{ maxWidth: '800px' }}>
              <div className="panel-intro">
                <strong>System Health</strong>
              </div>
              <div className="status-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                <div className={readyForLlm ? "status-row good" : "status-row"} style={{background: 'var(--panel-strong)', padding: '16px', borderRadius: '12px', border: 'none'}}>
                  <strong style={{display: 'block'}}>LLM Engine</strong>
                  <span style={{display: 'block', marginTop: '4px'}}>{readyForLlm ? "Connected" : "Missing Key"}</span>
                </div>
                <div className={readyForTTS ? "status-row good" : "status-row"} style={{background: 'var(--panel-strong)', padding: '16px', borderRadius: '12px', border: 'none'}}>
                  <strong style={{display: 'block'}}>TTS API ({settings.ttsProvider})</strong>
                  <span style={{display: 'block', marginTop: '4px'}}>{readyForTTS ? "Connected" : "Missing Key/Model"}</span>
                </div>
                <div className={readyForColab ? "status-row good" : "status-row"} style={{background: 'var(--panel-strong)', padding: '16px', borderRadius: '12px', border: 'none'}}>
                  <strong style={{display: 'block'}}>Colab Link</strong>
                  <span style={{display: 'block', marginTop: '4px'}}>{readyForColab ? "Ready" : "Not Set"}</span>
                </div>
                <div className={renderHealth.ok ? "status-row good" : "status-row"} style={{background: 'var(--panel-strong)', padding: '16px', borderRadius: '12px', border: 'none'}}>
                  <strong style={{display: 'block'}}>AWS Lambda</strong>
                  <span style={{display: 'block', marginTop: '4px'}}>{renderHealth.ok ? "Healthy" : "Check Config"}</span>
                </div>
              </div>
            </section>

            <section className="panel-block" style={{ maxWidth: '800px' }}>
              <div className="panel-intro">
                <strong>API Configuration</strong>
              </div>
              <div className="field-grid two">
                <label className="field-block">
                  <span>LLM Base URL</span>
                  <input value={settings.llmBaseUrl} onChange={(event) => setSettings((current) => ({ ...current, llmBaseUrl: event.target.value }))} />
                </label>
                <label className="field-block">
                  <span>LLM Model</span>
                  <input value={settings.llmModel} onChange={(event) => setSettings((current) => ({ ...current, llmModel: event.target.value }))} />
                </label>
                <label className="field-block" style={{ gridColumn: '1 / -1' }}>
                  <span style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <span>LLM API Key {settings.hasLlmApiKey ? "(Securely Stored)" : ""}</span>
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{color: 'var(--accent)', textDecoration: 'none'}}>Get Key</a>
                  </span>
                  <input type="text" value={settings.llmApiKey} onChange={(event) => setSettings((current) => ({ ...current, llmApiKey: event.target.value }))} placeholder="sk-..." />
                </label>
                
                <label className="field-block" style={{ gridColumn: '1 / -1', marginBottom: '16px' }}>
                  <span>TTS Provider</span>
                  <select 
                    value={settings.ttsProvider} 
                    onChange={(event) => setSettings((current) => ({ ...current, ttsProvider: event.target.value as "fish" | "huggingface" | "elevenlabs" }))}
                  >
                    <option value="fish">Fish.audio</option>
                    <option value="huggingface">Hugging Face (Kokoro etc.)</option>
                    <option value="elevenlabs">Eleven Labs</option>
                  </select>
                </label>

                {settings.ttsProvider === "fish" ? (
                  <>
                    <label className="field-block">
                      <span>Fish Model A</span>
                      <input value={settings.fishModelA} onChange={(event) => setSettings((current) => ({ ...current, fishModelA: event.target.value }))} />
                    </label>
                    <label className="field-block">
                      <span>Fish Model B</span>
                      <input value={settings.fishModelB} onChange={(event) => setSettings((current) => ({ ...current, fishModelB: event.target.value }))} />
                    </label>
                    <label className="field-block" style={{ gridColumn: '1 / -1' }}>
                      <span style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <span>Fish API Key {settings.hasFishApiKey ? "(Securely Stored)" : ""}</span>
                        <a href="https://fish.audio/" target="_blank" rel="noreferrer" style={{color: 'var(--accent)', textDecoration: 'none'}}>Get Key</a>
                      </span>
                      <input type="text" value={settings.fishApiKey} onChange={(event) => setSettings((current) => ({ ...current, fishApiKey: event.target.value }))} placeholder="fish_..." />
                    </label>
                  </>
                ) : settings.ttsProvider === "elevenlabs" ? (
                  <>
                    <label className="field-block">
                      <span>Eleven Labs Voice A ID</span>
                      <input value={settings.elevenLabsVoiceA} onChange={(event) => setSettings((current) => ({ ...current, elevenLabsVoiceA: event.target.value }))} placeholder="Voice ID (e.g. JBFqnCBsd6RMkjVDRZzb)" />
                    </label>
                    <label className="field-block">
                      <span>Eleven Labs Voice B ID</span>
                      <input value={settings.elevenLabsVoiceB} onChange={(event) => setSettings((current) => ({ ...current, elevenLabsVoiceB: event.target.value }))} placeholder="Voice ID (e.g. JBFqnCBsd6RMkjVDRZzb)" />
                    </label>
                    <label className="field-block" style={{ gridColumn: '1 / -1' }}>
                      <span style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <span>Eleven Labs API Key {settings.hasElevenLabsApiKey ? "(Securely Stored)" : ""}</span>
                        <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noreferrer" style={{color: 'var(--accent)', textDecoration: 'none'}}>Get Key</a>
                      </span>
                      <input type="text" value={settings.elevenLabsApiKey} onChange={(event) => setSettings((current) => ({ ...current, elevenLabsApiKey: event.target.value }))} placeholder="sk_..." />
                    </label>
                  </>
                ) : (
                  <>
                    <label className="field-block">
                      <span>HF Model A</span>
                      <input value={settings.hfModelA} onChange={(event) => setSettings((current) => ({ ...current, hfModelA: event.target.value }))} placeholder="hexgrad/Kokoro-82M" />
                    </label>
                    <label className="field-block">
                      <span>HF Model B</span>
                      <input value={settings.hfModelB} onChange={(event) => setSettings((current) => ({ ...current, hfModelB: event.target.value }))} placeholder="hexgrad/Kokoro-82M" />
                    </label>
                    <label className="field-block" style={{ gridColumn: '1 / -1' }}>
                      <span style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <span>Hugging Face Token {settings.hasHfToken ? "(Securely Stored)" : ""}</span>
                        <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" style={{color: 'var(--accent)', textDecoration: 'none'}}>Get Key</a>
                      </span>
                      <input type="text" value={settings.hfToken} onChange={(event) => setSettings((current) => ({ ...current, hfToken: event.target.value }))} placeholder="hf_..." />
                    </label>
                  </>
                )}

                <label className="field-block" style={{ gridColumn: '1 / -1' }}>
                  <span>Colab Tunnel URL (Optional)</span>
                  <input value={settings.colabUrl} onChange={(event) => setSettings((current) => ({ ...current, colabUrl: event.target.value }))} placeholder="https://...trycloudflare.com" />
                </label>
              </div>
              <div style={{ marginTop: '16px' }}>
                <button className="primary-button" onClick={saveSettings}>Save Settings</button>
                {settingsMessage && <div className="status-chip subtle" style={{ marginTop: '12px' }}>{settingsMessage}</div>}
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
};
