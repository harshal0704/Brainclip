"use client";

import { assetPackCatalog, subtitlePresetCatalog } from "@/lib/catalog";
import type { EditorForm, StickerAnim } from "./types";

interface StyleStepProps {
  form: EditorForm;
  onFormChange: (form: EditorForm) => void;
  message?: string;
}

const stickerAnimations: { id: StickerAnim; label: string; icon: string }[] = [
  { id: "bounce", label: "Bounce", icon: "↕" },
  { id: "pulse", label: "Pulse", icon: "◎" },
  { id: "slide", label: "Slide", icon: "↔" },
  { id: "float", label: "Float", icon: "≋" },
  { id: "shake", label: "Shake", icon: "⚡" },
  { id: "static", label: "Static", icon: "●" },
];

export const StyleStep = ({ form, onFormChange, message }: StyleStepProps) => {
  return (
    <div className="style-step">
      <section className="panel-block">
        <div className="panel-intro">
          <strong>Subtitle Style</strong>
          <span className="panel-hint">How text appears on screen</span>
        </div>
        <div className="subtitle-grid">
          {subtitlePresetCatalog.map((preset) => (
            <button
              key={preset.id}
              className={`subtitle-card ${form.subtitleStyle === preset.id ? "active" : ""}`}
              onClick={() => onFormChange({ ...form, subtitleStyle: preset.id })}
            >
              <div className="subtitle-preview" data-style={preset.id}>
                <span>Sample text</span>
              </div>
              <strong>{preset.label}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="panel-block">
        <div className="panel-intro">
          <strong>Sticker Animation</strong>
          <span className="panel-hint">How speaker avatars move when speaking</span>
        </div>
        <div className="animation-grid">
          {stickerAnimations.map((anim) => (
            <button
              key={anim.id}
              className={`animation-card ${form.stickerAnim === anim.id ? "active" : ""}`}
              onClick={() => onFormChange({ ...form, stickerAnim: anim.id })}
            >
              <span className="animation-icon">{anim.icon}</span>
              <strong>{anim.label}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="panel-block split-panel">
        <div>
          <div className="panel-intro">
            <strong>Background Dimming</strong>
            <span className="panel-hint">Darken background for better text visibility</span>
          </div>
          <label className="field-block">
            <div className="slider-header">
              <span>Opacity</span>
              <span className="slider-value">{Math.round(form.bgDimOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={form.bgDimOpacity}
              onChange={(e) => onFormChange({ ...form, bgDimOpacity: parseFloat(e.target.value) })}
            />
          </label>
        </div>

        <div>
          <div className="panel-intro">
            <strong>Asset Pack</strong>
            <span className="panel-hint">Background visual theme</span>
          </div>
          <div className="selection-grid two">
            {assetPackCatalog.slice(0, 4).map((pack) => (
              <button
                key={pack.id}
                className={form.assetPackId === pack.id ? "selection-card active" : "selection-card"}
                onClick={() => onFormChange({ ...form, assetPackId: pack.id })}
              >
                <strong>{pack.label}</strong>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="panel-block">
        <div className="panel-intro">
          <strong>Layout Options</strong>
        </div>
        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.showProgressBar}
              onChange={(e) => onFormChange({ ...form, showProgressBar: e.target.checked })}
            />
            <span>Show timeline progress bar</span>
          </label>
        </div>
      </section>

      {message && <div className="status-chip">{message}</div>}
    </div>
  );
};

export default StyleStep;