"use client";

import { useWorkspace } from "@/components/workspace-provider";

export default function SettingsPage() {
  const {
    settings,
    setSettings,
    settingsMessage,
    saveSettings,
    renderHealth
  } = useWorkspace();

  const readyForFish = Boolean((settings.hasFishApiKey || settings.fishApiKey) && settings.fishModelA && settings.fishModelB);
  const readyForHf = Boolean((settings.hasHfToken || settings.hfToken) && settings.hfModelA && settings.hfModelB);
  const readyForElevenLabs = Boolean((settings.hasElevenLabsApiKey || settings.elevenLabsApiKey) && settings.elevenLabsVoiceA && settings.elevenLabsVoiceB);
  const readyForPolly = Boolean(settings.pollyVoiceA && settings.pollyVoiceB);
  const readyForTTS = settings.ttsProvider === "huggingface" ? readyForHf : settings.ttsProvider === "elevenlabs" ? readyForElevenLabs : settings.ttsProvider === "polly" ? readyForPolly : readyForFish;
  const readyForColab = Boolean(settings.colabUrl);
  const readyForLlm = Boolean(settings.llmModel && (settings.hasLlmApiKey || settings.llmApiKey));

  return (
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
              onChange={(event) => setSettings((current) => ({ ...current, ttsProvider: event.target.value as "fish" | "huggingface" | "elevenlabs" | "polly" }))}
            >
              <option value="fish">Fish.audio</option>
              <option value="huggingface">Hugging Face (Kokoro etc.)</option>
              <option value="elevenlabs">Eleven Labs</option>
              <option value="polly">Amazon Polly (Neural)</option>
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
          ) : settings.ttsProvider === "polly" ? (
            <>
              <label className="field-block">
                <span>Speaker A Voice</span>
                <select value={settings.pollyVoiceA} onChange={(event) => setSettings((current) => ({ ...current, pollyVoiceA: event.target.value }))}>
                  <option value="Matthew">Matthew (US Male)</option>
                  <option value="Joanna">Joanna (US Female)</option>
                  <option value="Ivy">Ivy (US Child)</option>
                  <option value="Kevin">Kevin (US Male)</option>
                  <option value="Justin">Justin (US Male)</option>
                  <option value="Kendra">Kendra (US Female)</option>
                  <option value="Amy">Amy (UK Female)</option>
                  <option value="Brian">Brian (UK Male)</option>
                  <option value="Arthur">Arthur (UK Male)</option>
                  <option value="Emma">Emma (UK Female)</option>
                  <option value="Kajal">Kajal (Indian Female)</option>
                  <option value="Aditi">Aditi (Indian Female)</option>
                  <option value="Nicole">Nicole (AU Female)</option>
                  <option value="Russell">Russell (AU Male)</option>
                </select>
              </label>
              <label className="field-block">
                <span>Speaker B Voice</span>
                <select value={settings.pollyVoiceB} onChange={(event) => setSettings((current) => ({ ...current, pollyVoiceB: event.target.value }))}>
                  <option value="Matthew">Matthew (US Male)</option>
                  <option value="Joanna">Joanna (US Female)</option>
                  <option value="Ivy">Ivy (US Child)</option>
                  <option value="Kevin">Kevin (US Male)</option>
                  <option value="Justin">Justin (US Male)</option>
                  <option value="Kendra">Kendra (US Female)</option>
                  <option value="Amy">Amy (UK Female)</option>
                  <option value="Brian">Brian (UK Male)</option>
                  <option value="Arthur">Arthur (UK Male)</option>
                  <option value="Emma">Emma (UK Female)</option>
                  <option value="Kajal">Kajal (Indian Female)</option>
                  <option value="Aditi">Aditi (Indian Female)</option>
                  <option value="Nicole">Nicole (AU Female)</option>
                  <option value="Russell">Russell (AU Male)</option>
                </select>
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
  );
}
