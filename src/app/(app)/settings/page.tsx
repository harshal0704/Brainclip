"use client";

import { useState, useEffect } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useWorkspace } from "@/components/workspace-provider";

type SettingsTab = "api-keys" | "tts" | "colab" | "render" | "account";

type ColabHealth = {
  ok: boolean;
  stage?: string;
  gpuMemFreeGb?: number;
  error?: string;
};



export default function SettingsPage() {
  const { data: session } = useSession();
  const {
    settings,
    setSettings,
    settingsMessage,
    saveSettings,
    renderHealth,
    isLoadingSettings,
    isLoadingHealth
  } = useWorkspace();

  const [activeTab, setActiveTab] = useState<SettingsTab>("api-keys");
  const [showColabHelp, setShowColabHelp] = useState(false);
  const [colabHealth, setColabHealth] = useState<ColabHealth | null>(null);
  const [testingColab, setTestingColab] = useState(false);


  const readyForFish = Boolean((settings.hasFishApiKey || settings.fishApiKey) && settings.fishModelA && settings.fishModelB);
  const readyForHf = Boolean((settings.hasHfToken || settings.hfToken) && settings.hfModelA && settings.hfModelB);
  const readyForElevenLabs = Boolean((settings.hasElevenLabsApiKey || settings.elevenLabsApiKey) && settings.elevenLabsVoiceA && settings.elevenLabsVoiceB);
  const readyForPolly = Boolean(settings.pollyVoiceA && settings.pollyVoiceB);
  const readyForTTS = settings.ttsProvider === "huggingface" ? readyForHf : settings.ttsProvider === "elevenlabs" ? readyForElevenLabs : settings.ttsProvider === "polly" ? readyForPolly : readyForFish;
  const readyForColab = Boolean(settings.colabUrl);
  // GitHub Actions uses .env values (GITHUB_TOKEN + GITHUB_REPO), no per-user config needed
  const readyForGithub = settings.renderProvider === "github" ? renderHealth.ok : true;
  const readyForLlm = Boolean(settings.llmModel && (settings.hasLlmApiKey || settings.llmApiKey));

  const isRenderHealthy = settings.renderProvider === "colab" ? readyForColab : settings.renderProvider === "github" ? renderHealth.ok : renderHealth.ok;

  useEffect(() => {
    if (!settings.colabUrl) {
      setColabHealth(null);
      return;
    }

    const checkColab = async () => {
      try {
        const res = await fetch(new URL("/health", settings.colabUrl), {
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) {
          setColabHealth({ ok: false, error: "Health check failed" });
          return;
        }
        const data = await res.json();
        setColabHealth({ ok: true, stage: data.stage, gpuMemFreeGb: data.gpuMemFreeGb });
      } catch (err) {
        setColabHealth({ ok: false, error: "Could not connect to Colab server" });
      }
    };

    checkColab();
  }, [settings.colabUrl]);

  const testColabConnection = async () => {
    if (!settings.colabUrl) return;
    setTestingColab(true);
    try {
      const res = await fetch(new URL("/health", settings.colabUrl), {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        setColabHealth({ ok: false, error: "Health check failed" });
        return;
      }
      const data = await res.json();
      setColabHealth({ ok: true, stage: data.stage, gpuMemFreeGb: data.gpuMemFreeGb });
    } catch {
      setColabHealth({ ok: false, error: "Connection failed - server may be offline" });
    } finally {
      setTestingColab(false);
    }
  };



  if (isLoadingSettings) {
    return (
      <div className="workspace-stack">
        <div className="view-header">
          <h1>Settings</h1>
          <p>Manage API keys, routing, and render health.</p>
        </div>
        <div className="settings-loading">
          <span className="spinner-sm" style={{ marginRight: '8px' }}></span>
          Loading settings...
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "api-keys" as const, label: "🔑 API Keys", ready: readyForLlm },
    { id: "tts" as const, label: "🎙️ TTS Config", ready: readyForTTS },
    { id: "colab" as const, label: "🔌 Colab Setup", ready: readyForColab },
    { id: "render" as const, label: "🎬 Render", ready: isRenderHealthy },
    { id: "account" as const, label: "👤 Account", ready: true },
  ];

  return (
    <div className="workspace-stack">
      <div className="view-header">
        <h1>Settings</h1>
        <p>Configure your workspace, API keys, and services.</p>
      </div>

      {/* Tab Navigation */}
      <div className="settings-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`settings-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-label">{tab.label}</span>
            <span className={`tab-status ${tab.ready ? "ready" : "missing"}`}>
              {tab.ready ? "✓" : "!"}
            </span>
          </button>
        ))}
      </div>

      {/* API Keys Tab */}
      {activeTab === "api-keys" && (
        <section className="panel-block">
          <div className="panel-intro">
            <strong>LLM Configuration</strong>
            <p className="panel-desc">Configure the language model for script generation.</p>
          </div>
          <div className="field-grid-settings">
            <label className="field-block">
              <span>LLM Base URL</span>
              <input
                value={settings.llmBaseUrl}
                onChange={(e) => setSettings((c) => ({ ...c, llmBaseUrl: e.target.value }))}
                placeholder="https://generativelanguage.googleapis.com/v1beta"
              />
            </label>
            <label className="field-block">
              <span>LLM Model</span>
              <input
                value={settings.llmModel}
                onChange={(e) => setSettings((c) => ({ ...c, llmModel: e.target.value }))}
                placeholder="gemini-flash-latest"
              />
            </label>
            <label className="field-block full-width">
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>LLM API Key {settings.hasLlmApiKey ? "(Stored)" : ""}</span>
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Get Key →</a>
              </span>
              <input
                type="text"
                value={settings.llmApiKey}
                onChange={(e) => setSettings((c) => ({ ...c, llmApiKey: e.target.value }))}
                placeholder="sk-..."
              />
            </label>
          </div>
        </section>
      )}

      {/* TTS Config Tab */}
      {activeTab === "tts" && (
        <section className="panel-block">
          <div className="panel-intro">
            <strong>TTS Provider</strong>
            <p className="panel-desc">Select your text-to-speech service.</p>
          </div>
          <div className="field-grid-settings">
            <label className="field-block full-width">
              <span>TTS Provider</span>
              <select
                value={settings.ttsProvider}
                onChange={(e) => setSettings((c) => ({ ...c, ttsProvider: e.target.value as "fish" | "huggingface" | "elevenlabs" | "polly" }))}
              >
                <option value="fish">Fish.audio (Recommended)</option>
                <option value="huggingface">Hugging Face (Kokoro)</option>
                <option value="elevenlabs">Eleven Labs</option>
                <option value="polly">Amazon Polly</option>
              </select>
            </label>

            {settings.ttsProvider === "fish" && (
              <>
                <label className="field-block">
                  <span>Fish Model A</span>
                  <input
                    value={settings.fishModelA}
                    onChange={(e) => setSettings((c) => ({ ...c, fishModelA: e.target.value }))}
                    placeholder="model-id"
                  />
                </label>
                <label className="field-block">
                  <span>Fish Model B</span>
                  <input
                    value={settings.fishModelB}
                    onChange={(e) => setSettings((c) => ({ ...c, fishModelB: e.target.value }))}
                    placeholder="model-id"
                  />
                </label>
                <label className="field-block full-width">
                  <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Fish API Key {settings.hasFishApiKey ? "(Stored)" : ""}</span>
                    <a href="https://fish.audio/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Get Key →</a>
                  </span>
                  <input
                    type="text"
                    value={settings.fishApiKey}
                    onChange={(e) => setSettings((c) => ({ ...c, fishApiKey: e.target.value }))}
                    placeholder="fish_..."
                  />
                </label>
              </>
            )}

            {settings.ttsProvider === "elevenlabs" && (
              <>
                <label className="field-block">
                  <span>Eleven Labs Voice A ID</span>
                  <input
                    value={settings.elevenLabsVoiceA}
                    onChange={(e) => setSettings((c) => ({ ...c, elevenLabsVoiceA: e.target.value }))}
                    placeholder="Voice ID"
                  />
                </label>
                <label className="field-block">
                  <span>Eleven Labs Voice B ID</span>
                  <input
                    value={settings.elevenLabsVoiceB}
                    onChange={(e) => setSettings((c) => ({ ...c, elevenLabsVoiceB: e.target.value }))}
                    placeholder="Voice ID"
                  />
                </label>
                <label className="field-block full-width">
                  <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Eleven Labs API Key {settings.hasElevenLabsApiKey ? "(Stored)" : ""}</span>
                    <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Get Key →</a>
                  </span>
                  <input
                    type="text"
                    value={settings.elevenLabsApiKey}
                    onChange={(e) => setSettings((c) => ({ ...c, elevenLabsApiKey: e.target.value }))}
                    placeholder="sk_..."
                  />
                </label>
              </>
            )}

            {settings.ttsProvider === "polly" && (
              <>
                <label className="field-block">
                  <span>Speaker A Voice</span>
                  <select value={settings.pollyVoiceA} onChange={(e) => setSettings((c) => ({ ...c, pollyVoiceA: e.target.value }))}>
                    <option value="Matthew">Matthew (US Male)</option>
                    <option value="Joanna">Joanna (US Female)</option>
                    <option value="Ivy">Ivy (US Child)</option>
                    <option value="Kevin">Kevin (US Male)</option>
                    <option value="Amy">Amy (UK Female)</option>
                    <option value="Brian">Brian (UK Male)</option>
                    <option value="Kajal">Kajal (Indian Female)</option>
                  </select>
                </label>
                <label className="field-block">
                  <span>Speaker B Voice</span>
                  <select value={settings.pollyVoiceB} onChange={(e) => setSettings((c) => ({ ...c, pollyVoiceB: e.target.value }))}>
                    <option value="Joanna">Joanna (US Female)</option>
                    <option value="Matthew">Matthew (US Male)</option>
                    <option value="Ivy">Ivy (US Child)</option>
                    <option value="Amy">Amy (UK Female)</option>
                    <option value="Brian">Brian (UK Male)</option>
                    <option value="Kajal">Kajal (Indian Female)</option>
                  </select>
                </label>
              </>
            )}

            {settings.ttsProvider === "huggingface" && (
              <>
                <label className="field-block">
                  <span>HF Model A</span>
                  <input
                    value={settings.hfModelA}
                    onChange={(e) => setSettings((c) => ({ ...c, hfModelA: e.target.value }))}
                    placeholder="hexgrad/Kokoro-82M"
                  />
                </label>
                <label className="field-block">
                  <span>HF Model B</span>
                  <input
                    value={settings.hfModelB}
                    onChange={(e) => setSettings((c) => ({ ...c, hfModelB: e.target.value }))}
                    placeholder="hexgrad/Kokoro-82M"
                  />
                </label>
                <label className="field-block full-width">
                  <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Hugging Face Token {settings.hasHfToken ? "(Stored)" : ""}</span>
                    <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Get Token →</a>
                  </span>
                  <input
                    type="text"
                    value={settings.hfToken}
                    onChange={(e) => setSettings((c) => ({ ...c, hfToken: e.target.value }))}
                    placeholder="hf_..."
                  />
                </label>
              </>
            )}
          </div>
        </section>
      )}

      {/* Colab Setup Tab */}
      {activeTab === "colab" && (
        <section className="panel-block">
          <div className="panel-intro">
            <strong>🔌 Colab Server</strong>
            <p className="panel-desc">Connect your Colab notebook for local voice cloning and rendering.</p>
          </div>

          {/* Colab Status */}
          <div className="colab-status-bar">
            <div className={`status-indicator ${colabHealth?.ok ? "online" : colabHealth === null ? "unset" : "offline"}`}>
              <span className="status-dot" />
              <span className="status-label">
                {colabHealth === null ? "Not configured" : colabHealth.ok ? "Connected" : "Offline"}
              </span>
            </div>
            {colabHealth?.ok && (
              <div className="colab-info">
                {colabHealth.stage && <span className="colab-stage">{colabHealth.stage}</span>}
                {colabHealth.gpuMemFreeGb && (
                  <span className="colab-gpu">GPU: {colabHealth.gpuMemFreeGb.toFixed(1)}GB free</span>
                )}
              </div>
            )}
            {colabHealth?.error && (
              <span className="colab-error">{colabHealth.error}</span>
            )}
          </div>

          <div className="field-grid-settings">
            <label className="field-block full-width">
              <span>Colab Tunnel URL</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={settings.colabUrl}
                  onChange={(e) => setSettings((c) => ({ ...c, colabUrl: e.target.value }))}
                  placeholder="https://xxxx.trycloudflare.com"
                  style={{ flex: 1 }}
                />
                <button
                  className="secondary-button"
                  onClick={testColabConnection}
                  disabled={!settings.colabUrl || testingColab}
                >
                  {testingColab ? "Testing..." : "Test"}
                </button>
              </div>
            </label>
          </div>

          {/* Help Accordion */}
          <div className="colab-help-section">
            <button
              className="colab-help-toggle"
              onClick={() => setShowColabHelp(!showColabHelp)}
            >
              <span>📖 How to get your Colab URL</span>
              <span className="toggle-arrow">{showColabHelp ? "▲" : "▼"}</span>
            </button>

            {showColabHelp && (
              <div className="colab-help-content">
                <ol className="colab-steps">
                  <li>
                    <strong>Open the Colab notebook</strong>
                    <a
                      href="https://colab.research.google.com/drive/1y09k-TWpzpIyTtmMiNqJVtWQNqsznwP2"
                      target="_blank"
                      rel="noreferrer"
                      className="colab-link"
                    >
                      Open in Colab →
                    </a>
                  </li>
                  <li>
                    <strong>Click Connect</strong> (top right) to start a new runtime session
                  </li>
                  <li>
                    <strong>Run the Start Server &amp; Tunnel cell</strong> (look for the cloudflared cell)
                  </li>
                  <li>
                    <strong>Wait ~10 seconds</strong> for the tunnel to establish
                  </li>
                  <li>
                    <strong>Copy the URL</strong> shown (format: <code>https://xxxx.trycloudflare.com</code>)
                  </li>
                  <li>
                    <strong>Paste it above</strong> in the Colab Tunnel URL field
                  </li>
                  <li>
                    <strong>Click Test</strong> to verify the connection
                  </li>
                </ol>
                <div className="colab-tips">
                  <strong>💡 Tips:</strong>
                  <ul>
                    <li>Keep the Colab tab open - stopping the cell will disconnect the server</li>
                    <li>Use Always runtime to prevent disconnection</li>
                    <li>The free tier has session limits - reconnect if needed</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Render Tab */}
      {activeTab === "render" && (
        <section className="panel-block">
          <div className="panel-intro">
            <strong>Render Engine</strong>
            <p className="panel-desc">Choose how your videos are rendered.</p>
          </div>

          <div className="settings-grid">
            <div className={`status-tile ${readyForLlm ? 'good' : ''}`}>
              <strong>LLM Engine</strong>
              <span>{readyForLlm ? "Ready" : "Missing Key"}</span>
            </div>
            <div className={`status-tile ${readyForTTS ? 'good' : ''}`}>
              <strong>TTS ({settings.ttsProvider})</strong>
              <span>{readyForTTS ? "Ready" : "Not configured"}</span>
            </div>
            <div className={`status-tile ${readyForColab ? 'good' : ''}`}>
              <strong>Colab Server</strong>
              <span>{readyForColab ? "Ready" : "Not set"}</span>
            </div>
            <div className={`status-tile ${settings.renderProvider === 'github' ? (renderHealth.ok ? 'good' : '') : (readyForGithub ? 'good' : '')}`}>
              <strong>GitHub Actions</strong>
              <span>{settings.renderProvider === 'github' ? (renderHealth.ok ? 'Connected' : 'Check .env') : 'Available'}</span>
            </div>
            <div className={`status-tile ${isRenderHealthy ? 'good' : ''}`}>
              <strong>Render ({settings.renderProvider})</strong>
              <span>
                {settings.renderProvider === "colab"
                  ? (readyForColab ? "Ready" : "Missing URL")
                  : settings.renderProvider === "github"
                    ? (renderHealth.ok ? "Ready" : "Check .env config")
                    : (renderHealth.ok ? "Healthy" : "Check Config")}
              </span>
            </div>
          </div>

          <div className="field-grid-settings" style={{ marginTop: '20px' }}>
            <label className="field-block full-width">
              <span>Render Provider</span>
              <select
                value={settings.renderProvider}
                onChange={(e) => setSettings((c) => ({ ...c, renderProvider: e.target.value as "lambda" | "colab" | "github" }))}
              >
                <option value="lambda">AWS Lambda (Cloud - Recommended)</option>
                <option value="colab">Colab Server (Local)</option>
                <option value="github">GitHub Actions (Free compute via .env)</option>
              </select>
            </label>
          </div>
        </section>
      )}

      {/* Account Tab */}
      {activeTab === "account" && (
        <section className="panel-block">
          <div className="panel-intro">
            <strong>Account</strong>
            <p className="panel-desc">Manage your sign-in and session.</p>
          </div>

          {session ? (
            <div className="account-section">
              <div className="account-user">
                {session.user?.image && (
                  <img
                    src={session.user.image}
                    alt={session.user.name || "User"}
                    className="account-avatar"
                  />
                )}
                <div className="account-info">
                  <strong>{session.user?.name || "User"}</strong>
                  <span>{session.user?.email}</span>
                </div>
              </div>
              <button
                className="secondary-button"
                onClick={() => signOut({ callbackUrl: "/" })}
                style={{ marginTop: '16px' }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="account-section">
              <p>You are not signed in.</p>
              <button
                className="primary-button"
                onClick={() => signIn("google", { callbackUrl: "/" })}
                style={{ marginTop: '12px' }}
              >
                Sign in with Google
              </button>
            </div>
          )}
        </section>
      )}

      {/* Save Button */}
      <div className="settings-actions">
        <button className="primary-button" onClick={saveSettings}>Save Settings</button>
        {settingsMessage && <div className="status-chip subtle" style={{ marginTop: '12px' }}>{settingsMessage}</div>}
      </div>
    </div>
  );
}
