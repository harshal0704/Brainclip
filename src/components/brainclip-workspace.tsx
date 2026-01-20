"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { assetPackCatalog, duoPresets, subtitlePresetCatalog, voicePresetCatalog } from "@/lib/catalog";
import { VoiceLibrary, type CustomVoice } from "./VoiceLibrary";

type SettingsState = {
  llmBaseUrl: string;
  llmModel: string;
  llmApiKey: string;
  fishModelA: string;
  fishModelB: string;
  fishApiKey: string;
  colabUrl: string;
  hasLlmApiKey?: boolean;
  hasFishApiKey?: boolean;
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
  initialView: "dashboard" | "editor" | "voices";
};

type SelectedCustomVoices = {
  speakerA?: { id: string; modelId: string; name: string };
  speakerB?: { id: string; modelId: string; name: string };
};

const defaultSettings: SettingsState = {
  llmBaseUrl: "https://api.openai.com/v1",
  llmModel: "gpt-4o-mini",
  llmApiKey: "",
  fishModelA: voicePresetCatalog[0]?.fishModelId ?? "",
  fishModelB: voicePresetCatalog[1]?.fishModelId ?? "",
  fishApiKey: "",
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
  backgroundUrl: "",
  assetPackId: assetPackCatalog[0]?.id ?? "",
  resolution: "720p" as "720p" | "480p",
  ctaText: "Made with Brainclip.",
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
  const [renderHealth, setRenderHealth] = useState<{ ok: boolean; note: string }>({ ok: false, note: "Render health not checked yet." });
  const [selectedCustomVoices, setSelectedCustomVoices] = useState<SelectedCustomVoices>({});
  const pollRef = useRef<number | null>(null);

  const activeJob = useMemo(() => jobs.find((job) => job.id === activeJobId) ?? jobs[0] ?? null, [activeJobId, jobs]);
  const readyForFish = Boolean((settings.hasFishApiKey || settings.fishApiKey) && settings.fishModelA && settings.fishModelB);
  const readyForColab = Boolean(settings.colabUrl);
  const readyForLlm = Boolean(settings.llmModel && (settings.hasLlmApiKey || settings.llmApiKey));
  const isReadyForRender = readyForLlm && (editorForm.voiceMode === "fish-api" ? readyForFish : readyForColab);

  const loadSettings = useCallback(async () => {
    const response = await fetch("/api/settings");
    const data = await response.json();
    if (response.ok) {
      setSettings((current) => ({ ...current, ...data.settings, llmApiKey: "", fishApiKey: "" }));
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

    setSettings((current) => ({ ...current, ...data.settings, llmApiKey: "", fishApiKey: "" }));
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
            stickerUrl: "",
            position: "top",
            modelId: settings.fishModelA,
          },
          speakerB: {
            label: "Speaker B",
            color: "#ffb36b",
            stickerUrl: "",
            position: "bottom",
            modelId: settings.fishModelB,
          },
        },
        subtitleStyleId: editorForm.subtitleStyle,
        backgroundUrl: editorForm.backgroundUrl,
        resolution: editorForm.resolution,
        editConfig: {
          stickerAnim: "bounce",
          subtitleFont: "Newsreader",
          subtitleSize: 46,
          subtitleFill: "#f9f5ee",
          subtitleStroke: "#0a1118",
          subtitleHighlight: "#84d7ff",
          subtitleY: 70,
          bgDimOpacity: 0.34,
          bgColorOverlay: "#16202d",
          bgBlendMode: "screen",
          speakerLayout: "top-bottom",
          stickerSizeA: 150,
          stickerSizeB: 150,
          stickerShape: "circle",
          introAnim: "fade",
          animSpeed: 1,
          showProgressBar: true,
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

    // Update the fish model in settings
    setSettings((current) => ({
      ...current,
      [speaker === "A" ? "fishModelA" : "fishModelB"]: voice.fishModelId!,
    }));

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
            <h1>Build reels with a production-grade interface, not a starter template.</h1>
            <p>
              Sign in to save your bucket, LLM endpoint, Fish voice routing, and render history. The studio then takes you from script to Lambda delivery.
            </p>
            <div className="landing-actions">
              <button className="primary-button" onClick={() => signIn("google")}>Sign in with Google</button>
              <Link className="secondary-button inline-link" href="/">See landing page</Link>
            </div>
          </div>
          <div className="signin-panel">
            <div className="signal-card">
              <span className="signal-label">Included</span>
              <div className="catalog-row"><strong>Auth + S3</strong><span>Per-user storage provisioning on first login.</span></div>
              <div className="catalog-row"><strong>Voice Routing</strong><span>Fish.audio fallback and Colab voice path.</span></div>
              <div className="catalog-row"><strong>Render Polling</strong><span>Lambda progress, final URL, and rerender-friendly state.</span></div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-topbar">
        <div>
          <span className="eyebrow">Brainclip orchestration</span>
          <h1>One surface for setup, scripting, voice, and delivery.</h1>
        </div>
        <div className="topbar-actions">
          <span className="user-pill">{session.user?.email}</span>
          <button className="secondary-button" onClick={() => signOut()}>Sign out</button>
        </div>
      </header>

      <section className="workspace-hero-grid">
        <div className="studio-overview-card">
          <span className="signal-label">Current direction</span>
          <h2>{editorForm.topic}</h2>
          <p>{selectedAssetPack?.description}</p>
          <div className="overview-tags">
            <span>{editorForm.voiceMode === "fish-api" ? "Fish.audio" : "Colab S2-Pro"}</span>
            <span>{editorForm.resolution}</span>
            <span>{selectedSubtitlePreset?.label ?? "Subtitle preset"}</span>
          </div>
        </div>
        <div className="mini-metrics">
          <div className="metric-tile"><strong>{jobs.length}</strong><span>Tracked jobs</span></div>
          <div className="metric-tile"><strong>{completedJobs}</strong><span>Completed renders</span></div>
          <div className="metric-tile"><strong>{scriptLines.length || "--"}</strong><span>Script lines</span></div>
          <div className="metric-tile"><strong>{activeJob?.progressPct ?? 0}%</strong><span>Live progress</span></div>
        </div>
      </section>

      <nav className="workspace-tabs">
        <button className={view === "editor" ? "tab-button active" : "tab-button"} onClick={() => setView("editor")}>Editor</button>
        <button className={view === "voices" ? "tab-button active" : "tab-button"} onClick={() => setView("voices")}>Voices</button>
        <button className={view === "dashboard" ? "tab-button active" : "tab-button"} onClick={() => setView("dashboard")}>Dashboard</button>
      </nav>

      <section className="workspace-grid">
        <aside className="workspace-sidebar">
          <div className="panel-block">
            <div className="panel-intro">
              <strong>Studio setup</strong>
              <span>Store your model and routing configuration.</span>
            </div>
            <label className="field-block">
              <span>LLM base URL</span>
              <input value={settings.llmBaseUrl} onChange={(event) => setSettings((current) => ({ ...current, llmBaseUrl: event.target.value }))} />
            </label>
            <label className="field-block">
              <span>LLM model</span>
              <input value={settings.llmModel} onChange={(event) => setSettings((current) => ({ ...current, llmModel: event.target.value }))} />
            </label>
            <label className="field-block">
              <span>LLM API key {settings.hasLlmApiKey ? "(stored)" : ""}</span>
              <input type="password" value={settings.llmApiKey} onChange={(event) => setSettings((current) => ({ ...current, llmApiKey: event.target.value }))} placeholder="sk-..." />
            </label>
            <label className="field-block">
              <span>Fish model A</span>
              <input value={settings.fishModelA} onChange={(event) => setSettings((current) => ({ ...current, fishModelA: event.target.value }))} />
            </label>
            <label className="field-block">
              <span>Fish model B</span>
              <input value={settings.fishModelB} onChange={(event) => setSettings((current) => ({ ...current, fishModelB: event.target.value }))} />
            </label>
            <label className="field-block">
              <span>Fish API key {settings.hasFishApiKey ? "(stored)" : ""}</span>
              <input type="password" value={settings.fishApiKey} onChange={(event) => setSettings((current) => ({ ...current, fishApiKey: event.target.value }))} placeholder="fish_..." />
            </label>
            <label className="field-block">
              <span>Colab tunnel URL</span>
              <input value={settings.colabUrl} onChange={(event) => setSettings((current) => ({ ...current, colabUrl: event.target.value }))} placeholder="https://...trycloudflare.com" />
            </label>
            <button className="primary-button full-width" onClick={saveSettings}>Save studio settings</button>
            <div className="status-chip subtle">{settingsMessage || "Keys are stored server-side and reused across the studio."}</div>
          </div>

          <div className="panel-block compact-panel">
            <div className="panel-intro">
              <strong>Routing health</strong>
              <span>{renderHealth.note}</span>
            </div>
            <div className="status-list">
              <div className={readyForLlm ? "status-row good" : "status-row"}><strong>LLM</strong><span>{readyForLlm ? "Ready" : "Needs key"}</span></div>
              <div className={readyForFish ? "status-row good" : "status-row"}><strong>Fish API</strong><span>{readyForFish ? "Ready" : "Needs config"}</span></div>
              <div className={readyForColab ? "status-row good" : "status-row"}><strong>Colab</strong><span>{readyForColab ? "Ready" : "Optional"}</span></div>
              <div className={renderHealth.ok ? "status-row good" : "status-row"}><strong>Lambda</strong><span>{renderHealth.ok ? "Healthy" : "Check env"}</span></div>
            </div>
          </div>
        </aside>

        <section className="workspace-main">
          {view === "editor" ? (
            <div className="workspace-stack">
              <section className="panel-block feature-panel">
                <div className="panel-intro">
                  <strong>Creative setup</strong>
                  <span>Choose a structured conversation format, then tune the inputs that drive generation.</span>
                </div>
                <div className="selection-grid three">
                  {duoPresets.map((preset) => (
                    <button key={preset.id} className={editorForm.duoId === preset.id ? "selection-card active" : "selection-card"} onClick={() => applyDuoPreset(preset.id)}>
                      <strong>{preset.label}</strong>
                      <span>{preset.hook}</span>
                    </button>
                  ))}
                </div>
                <div className="field-grid two">
                  <label className="field-block">
                    <span>Topic</span>
                    <textarea value={editorForm.topic} rows={3} onChange={(event) => setEditorForm((current) => ({ ...current, topic: event.target.value }))} />
                  </label>
                  <label className="field-block">
                    <span>Background URL</span>
                    <input value={editorForm.backgroundUrl} onChange={(event) => setEditorForm((current) => ({ ...current, backgroundUrl: event.target.value }))} placeholder="Optional S3 or R2 video URL" />
                  </label>
                  <label className="field-block">
                    <span>Speaker A persona</span>
                    <textarea value={editorForm.speakerAPersona} rows={4} onChange={(event) => setEditorForm((current) => ({ ...current, speakerAPersona: event.target.value }))} />
                  </label>
                  <label className="field-block">
                    <span>Speaker B persona</span>
                    <textarea value={editorForm.speakerBPersona} rows={4} onChange={(event) => setEditorForm((current) => ({ ...current, speakerBPersona: event.target.value }))} />
                  </label>
                </div>
                <div className="field-grid four">
                  <label className="field-block">
                    <span>Tone</span>
                    <select value={editorForm.tone} onChange={(event) => setEditorForm((current) => ({ ...current, tone: event.target.value }))}>
                      <option value="educational">Educational</option>
                      <option value="debate">Debate</option>
                      <option value="storytelling">Storytelling</option>
                      <option value="comedy">Comedy</option>
                      <option value="interview">Interview</option>
                    </select>
                  </label>
                  <label className="field-block">
                    <span>Language</span>
                    <input value={editorForm.language} onChange={(event) => setEditorForm((current) => ({ ...current, language: event.target.value }))} />
                  </label>
                  <label className="field-block">
                    <span>Voice mode</span>
                    <select value={editorForm.voiceMode} onChange={(event) => setEditorForm((current) => ({ ...current, voiceMode: event.target.value as "fish-api" | "colab" }))}>
                      <option value="fish-api">Fish.audio proxy</option>
                      <option value="colab">Colab FastAPI</option>
                    </select>
                  </label>
                  <label className="field-block">
                    <span>Resolution</span>
                    <select value={editorForm.resolution} onChange={(event) => setEditorForm((current) => ({ ...current, resolution: event.target.value as "720p" | "480p" }))}>
                      <option value="720p">720p final</option>
                      <option value="480p">480p draft</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className="panel-block split-panel">
                <div>
                  <div className="panel-intro">
                    <strong>Voice pack suggestions</strong>
                    <span>Use preset models now, then swap to custom references later.</span>
                  </div>
                  <div className="selection-grid two">
                    {voicePresetCatalog.map((voice) => (
                      <button
                        key={voice.id}
                        className={settings.fishModelA === voice.fishModelId || settings.fishModelB === voice.fishModelId ? "selection-card active" : "selection-card"}
                        onClick={() => setSettings((current) => ({ ...current, fishModelA: current.fishModelA || voice.fishModelId || voice.id, fishModelB: current.fishModelB || voice.fishModelId || voice.id }))}
                      >
                        <strong>{voice.label}</strong>
                        <span>{voice.persona}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="panel-intro">
                    <strong>Visual system</strong>
                    <span>Choose subtitle behavior and asset mood before rendering.</span>
                  </div>
                  <div className="selection-grid two">
                    {subtitlePresetCatalog.slice(0, 6).map((preset) => (
                      <button key={preset.id} className={editorForm.subtitleStyle === preset.id ? "selection-card active" : "selection-card"} onClick={() => setEditorForm((current) => ({ ...current, subtitleStyle: preset.id }))}>
                        <strong>{preset.label}</strong>
                        <span>{preset.note}</span>
                      </button>
                    ))}
                  </div>
                  <div className="selection-grid three compact-grid">
                    {assetPackCatalog.map((pack) => (
                      <button key={pack.id} className={editorForm.assetPackId === pack.id ? "selection-card active" : "selection-card"} onClick={() => setEditorForm((current) => ({ ...current, assetPackId: pack.id }))}>
                        <strong>{pack.label}</strong>
                        <span>{pack.category}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="panel-block">
                <div className="panel-intro">
                  <strong>Script engine</strong>
                  <span>Generate, edit, and dispatch without leaving the same surface.</span>
                </div>
                <div className="action-row">
                  <button className="primary-button" onClick={generateScript}>Generate script</button>
                  <button className="secondary-button" onClick={startRenderFlow} disabled={!scriptLines.length || !isReadyForRender}>Start render pipeline</button>
                </div>
                <div className="status-chip">{editorMessage || "Generate a script first, then Brainclip can route voice generation and render work."}</div>
                <div className="script-grid">
                  {scriptLines.length === 0 ? (
                    <div className="empty-panel">Generated lines appear here with editable dialogue, pacing, and pause values.</div>
                  ) : (
                    scriptLines.map((line) => (
                      <article key={line.id} className="script-card">
                        <div className="script-meta">
                          <strong>{line.id}</strong>
                          <span>Speaker {line.speaker} · {line.emotion} · {line.speaking_rate.toFixed(2)}x · {line.pause_ms}ms</span>
                        </div>
                        <textarea
                          value={line.text}
                          rows={3}
                          onChange={(event) => {
                            const value = event.target.value;
                            setScriptLines((current) => current.map((entry) => (entry.id === line.id ? { ...entry, text: value } : entry)));
                          }}
                        />
                      </article>
                    ))
                  )}
                </div>
              </section>
            </div>
          ) : view === "dashboard" ? (
            <div className="workspace-stack">
              <section className="panel-block">
                <div className="panel-intro">
                  <strong>Pipeline dashboard</strong>
                  <span>Track stage movement from voice generation to the final video URL.</span>
                </div>
                <div className="job-grid">
                  {jobs.length === 0 ? (
                    <div className="empty-panel">No jobs yet. Move to the editor, generate a script, and launch the first Brainclip render.</div>
                  ) : (
                    jobs.map((job) => (
                      <button key={job.id} className={activeJobId === job.id ? "job-card active" : "job-card"} onClick={() => startPollingJob(job.id)}>
                        <div>
                          <strong>{job.status}</strong>
                          <span>{job.stage ?? "Waiting for updates"}</span>
                        </div>
                        <div className="job-progress-pill">{job.progressPct}%</div>
                      </button>
                    ))
                  )}
                </div>
              </section>

              {activeJob ? (
                <section className="panel-block active-job-panel">
                  <div className="panel-intro">
                    <strong>Active job</strong>
                    <span>{activeJob.id}</span>
                  </div>
                  <div className="progress-track"><div className="progress-fill" style={{ width: `${activeJob.progressPct}%` }} /></div>
                  <div className="status-list wide">
                    <div className="status-row"><strong>Status</strong><span>{activeJob.status}</span></div>
                    <div className="status-row"><strong>Stage</strong><span>{activeJob.stage ?? "Waiting"}</span></div>
                    <div className="status-row"><strong>Progress</strong><span>{activeJob.progressPct}%</span></div>
                  </div>
                  {activeJob.errorMessage ? <div className="error-banner">{activeJob.errorMessage}</div> : null}
                  {jobResultUrl ? <a className="primary-button inline-link" href={jobResultUrl} target="_blank">Open final video</a> : null}
                </section>
              ) : null}
            </div>
          ) : view === "voices" ? (
            <div className="workspace-stack">
              <section className="panel-block">
                <div className="panel-intro">
                  <strong>Voice Library</strong>
                  <span>Upload voice references, clone to Fish.audio, and assign to speakers.</span>
                </div>
                {selectedCustomVoices.speakerA || selectedCustomVoices.speakerB ? (
                  <div className="selected-voices-bar">
                    <span className="selected-voices-label">Current selection:</span>
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
                    <button 
                      className="secondary-button small" 
                      onClick={() => setView("editor")}
                    >
                      Go to Editor
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
          ) : null}
        </section>
      </section>

      <footer className="workspace-footer">
        <Link href="/">Landing</Link>
        <Link href="/editor">Editor</Link>
        <Link href="/voices">Voices</Link>
        <Link href="/dashboard">Dashboard</Link>
      </footer>
    </main>
  );
};
