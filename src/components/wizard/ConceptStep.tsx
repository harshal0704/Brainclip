"use client";

import { duoPresets, gameBackgroundCatalog, stickerPresetCatalog } from "@/lib/catalog";
import type { EditorForm } from "./types";

interface ConceptStepProps {
  form: EditorForm;
  onFormChange: (form: EditorForm) => void;
  onUploadSticker: (speaker: "A" | "B", file: File) => void;
  message?: string;
}

export const ConceptStep = ({ form, onFormChange, onUploadSticker, message }: ConceptStepProps) => {
  const applyDuoPreset = (duoId: string) => {
    const preset = duoPresets.find((item) => item.id === duoId);
    if (!preset) return;

    onFormChange({
      ...form,
      duoId: preset.id,
      tone: preset.tone,
      speakerAPersona: preset.speakerA,
      speakerBPersona: preset.speakerB,
    });
  };

  const selectPresetSticker = (speaker: "A" | "B", url: string) => {
    onFormChange({
      ...form,
      [speaker === "A" ? "stickerUrlA" : "stickerUrlB"]: url,
    });
  };

  return (
    <div className="concept-step">
      <section className="panel-block">
        <div className="panel-intro">
          <strong>Choose Format</strong>
          <span className="panel-hint">Select a duo pattern that fits your content style</span>
        </div>
        <div className="duo-format-grid">
          {duoPresets.map((preset) => (
            <button
              key={preset.id}
              className={`duo-format-card ${form.duoId === preset.id ? "active" : ""}`}
              onClick={() => applyDuoPreset(preset.id)}
            >
              <div className="duo-format-icon">{preset.icon}</div>
              <div className="duo-format-body">
                <div className="duo-format-title-row">
                  <strong>{preset.label}</strong>
                  <span className="duo-format-category">{preset.category}</span>
                </div>
                <span className="duo-format-hook">{preset.hook}</span>
              </div>
              {form.duoId === preset.id && (
                <div className="duo-format-personas">
                  <div className="duo-format-persona">
                    <span className="persona-badge speaker-a-badge">A</span>
                    <span>{preset.speakerA}</span>
                  </div>
                  <div className="duo-format-persona">
                    <span className="persona-badge speaker-b-badge">B</span>
                    <span>{preset.speakerB}</span>
                  </div>
                </div>
              )}
              {form.duoId === preset.id && (
                <div className="duo-format-check">✓</div>
              )}
            </button>
          ))}
        </div>
      </section>

      <section className="panel-block">
        <div className="panel-intro">
          <strong>What is your video about?</strong>
          <span className="panel-hint">Describe the topic in a few words or a sentence</span>
        </div>
        <label className="field-block">
          <span>Topic</span>
          <textarea
            value={form.topic}
            rows={3}
            placeholder="e.g., Why short-form lessons outperform long lectures..."
            onChange={(e) => onFormChange({ ...form, topic: e.target.value })}
          />
          <span className="field-count">{form.topic.length} characters</span>
        </label>
      </section>

      <section className="panel-block split-panel">
        <div>
          <div className="panel-intro">
            <strong>Speaker A Persona</strong>
            <span className="panel-hint">Describe who this speaker is</span>
          </div>
          <label className="field-block">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Persona</span>
              <label className="upload-label">
                Upload Sticker
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    if (e.target.files?.[0]) onUploadSticker("A", e.target.files[0]);
                  }}
                />
              </label>
            </div>
            <textarea
              value={form.speakerAPersona}
              rows={2}
              onChange={(e) => onFormChange({ ...form, speakerAPersona: e.target.value })}
              placeholder="e.g., Sharp operator who simplifies complex ideas..."
            />
          </label>

          <div style={{ marginTop: '12px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'block', marginBottom: '8px' }}>Or pick a preset sticker:</span>
            <div className="sticker-preset-grid">
              {stickerPresetCatalog.map((sticker) => (
                <button
                  key={sticker.id}
                  className={`sticker-preset-card ${form.stickerUrlA === sticker.url ? 'active' : ''}`}
                  onClick={() => selectPresetSticker("A", sticker.url)}
                  title={sticker.label}
                >
                  <span className="sticker-preset-emoji">{sticker.emoji}</span>
                </button>
              ))}
            </div>
          </div>

          {form.stickerUrlA && (
            <div className="sticker-preview">
              <img src={form.stickerUrlA} alt="Speaker A sticker" />
              <span>✓ Sticker selected</span>
            </div>
          )}
        </div>

        <div>
          <div className="panel-intro">
            <strong>Speaker B Persona</strong>
            <span className="panel-hint">Describe who this speaker is</span>
          </div>
          <label className="field-block">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Persona</span>
              <label className="upload-label accent">
                Upload Sticker
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    if (e.target.files?.[0]) onUploadSticker("B", e.target.files[0]);
                  }}
                />
              </label>
            </div>
            <textarea
              value={form.speakerBPersona}
              rows={2}
              onChange={(e) => onFormChange({ ...form, speakerBPersona: e.target.value })}
              placeholder="e.g., Curious beginner who asks smart questions..."
            />
          </label>

          <div style={{ marginTop: '12px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'block', marginBottom: '8px' }}>Or pick a preset sticker:</span>
            <div className="sticker-preset-grid">
              {stickerPresetCatalog.map((sticker) => (
                <button
                  key={sticker.id}
                  className={`sticker-preset-card ${form.stickerUrlB === sticker.url ? 'active' : ''}`}
                  onClick={() => selectPresetSticker("B", sticker.url)}
                  title={sticker.label}
                >
                  <span className="sticker-preset-emoji">{sticker.emoji}</span>
                </button>
              ))}
            </div>
          </div>

          {form.stickerUrlB && (
            <div className="sticker-preview">
              <img src={form.stickerUrlB} alt="Speaker B sticker" />
              <span>✓ Sticker selected</span>
            </div>
          )}
        </div>
      </section>

      <section className="panel-block">
        <div className="panel-intro">
          <strong>Background Video</strong>
          <span className="panel-hint">Pick a game — a random video will be used each render</span>
        </div>
        <div className="game-background-grid">
          {gameBackgroundCatalog.map((game) => (
            <button
              key={game.id}
              className={`game-background-card ${form.backgroundGameId === game.id ? 'active' : ''}`}
              onClick={() => {
                onFormChange({ ...form, backgroundGameId: game.id, backgroundUrl: '' });
              }}
            >
              <strong>{game.label}</strong>
            </button>
          ))}
        </div>
        {form.backgroundGameId && (
          <div className="selected-game-hint">
            <span>A random {gameBackgroundCatalog.find(g => g.id === form.backgroundGameId)?.label || 'video'} clip will be used when rendering</span>
          </div>
        )}
      </section>

      {message && <div className="status-chip">{message}</div>}
    </div>
  );
};

export default ConceptStep;