"use client";

import { duoPresets } from "@/lib/catalog";
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

  return (
    <div className="concept-step">
      <section className="panel-block">
        <div className="panel-intro">
          <strong>Choose Format</strong>
          <span className="panel-hint">Select a duo pattern that fits your content style</span>
        </div>
        <div className="selection-grid three duo-grid">
          {duoPresets.map((preset) => (
            <button
              key={preset.id}
              className={form.duoId === preset.id ? "selection-card active" : "selection-card"}
              onClick={() => applyDuoPreset(preset.id)}
            >
              <strong>{preset.label}</strong>
              <span>{preset.hook}</span>
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
            {form.stickerUrlA && (
              <div className="sticker-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.stickerUrlA} alt="Speaker A sticker" />
                <span>✓ Custom sticker uploaded</span>
              </div>
            )}
          </label>
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
            {form.stickerUrlB && (
              <div className="sticker-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.stickerUrlB} alt="Speaker B sticker" />
                <span>✓ Custom sticker uploaded</span>
              </div>
            )}
          </label>
        </div>
      </section>

      <section className="panel-block">
        <div className="panel-intro">
          <strong>Background (Optional)</strong>
          <span className="panel-hint">Add a background video or image URL</span>
        </div>
        <label className="field-block">
          <span>Background URL</span>
          <input
            type="url"
            value={form.backgroundUrl}
            onChange={(e) => onFormChange({ ...form, backgroundUrl: e.target.value })}
            placeholder="https://..."
          />
        </label>
      </section>

      {message && <div className="status-chip">{message}</div>}
    </div>
  );
};

export default ConceptStep;