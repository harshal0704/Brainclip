"use client";

import { useState } from "react";
import { assetPackCatalog, subtitlePresetCatalog } from "@/lib/catalog";
import type { EditorForm, StickerAnim, SubtitlePosition, StickerShape, ColorGrading, FontFamily } from "./types";

interface StyleStepProps {
  form: EditorForm;
  onFormChange: (form: EditorForm) => void;
  message?: string;
}

type TabId = "style" | "text" | "background" | "layout";

const stickerAnimations: { id: StickerAnim; label: string; icon: string }[] = [
  { id: "bounce", label: "Bounce", icon: "↕" },
  { id: "pulse", label: "Pulse", icon: "◎" },
  { id: "slide", label: "Slide", icon: "↔" },
  { id: "float", label: "Float", icon: "≋" },
  { id: "shake", label: "Shake", icon: "⚡" },
  { id: "static", label: "Static", icon: "●" },
  { id: "spin", label: "Spin", icon: "↻" },
];

const stickerShapes: { id: StickerShape; label: string; icon: string }[] = [
  { id: "circle", label: "Circle", icon: "⬤" },
  { id: "rounded-square", label: "Rounded", icon: "▪" },
  { id: "hexagon", label: "Hexagon", icon: "⬡" },
];

const colorGradingOptions: { id: ColorGrading; label: string; icon: string; desc: string }[] = [
  { id: "none", label: "Natural", icon: "○", desc: "No grading" },
  { id: "warm", label: "Warm", icon: "☀", desc: "Golden tones" },
  { id: "cool", label: "Cool", icon: "❄", desc: "Blue shifted" },
  { id: "vintage", label: "Vintage", icon: "📷", desc: "Sepia warmth" },
  { id: "cinematic", label: "Cinema", icon: "🎬", desc: "High contrast" },
  { id: "noir", label: "Noir", icon: "◆", desc: "B&W dark" },
];

const fontFamilies: { id: FontFamily; label: string; style: string }[] = [
  { id: "Inter", label: "Inter", style: "Inter, sans-serif" },
  { id: "Montserrat", label: "Montserrat", style: "Montserrat, sans-serif" },
  { id: "Poppins", label: "Poppins", style: "Poppins, sans-serif" },
  { id: "Roboto", label: "Roboto", style: "Roboto, sans-serif" },
  { id: "Oswald", label: "Oswald", style: "Oswald, sans-serif" },
  { id: "Bebas Neue", label: "Bebas Neue", style: "'Bebas Neue', sans-serif" },
  { id: "Anton", label: "Anton", style: "Anton, sans-serif" },
];

const positionOptions: { id: SubtitlePosition; label: string; icon: string; yHint: string }[] = [
  { id: "top", label: "Top", icon: "▲", yHint: "15%" },
  { id: "middle", label: "Middle", icon: "◆", yHint: "45%" },
  { id: "bottom", label: "Bottom", icon: "▼", yHint: "75%" },
];

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "style", label: "Style", icon: "✦" },
  { id: "text", label: "Text", icon: "Aa" },
  { id: "background", label: "Backdrop", icon: "⬛" },
  { id: "layout", label: "Layout", icon: "⊟" },
];

export const StyleStep = ({ form, onFormChange, message }: StyleStepProps) => {
  const [activeTab, setActiveTab] = useState<TabId>("style");

  return (
    <div className="style-step">
      {/* Tab Navigation */}
      <div className="editor-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`editor-tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="editor-tab-icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── STYLE TAB ── */}
      {activeTab === "style" && (
        <div className="tab-content">
          <section className="panel-block">
            <div className="panel-intro">
              <strong>Caption Style</strong>
              <span className="panel-hint">How words appear on screen</span>
            </div>
            <div className="subtitle-grid">
              {subtitlePresetCatalog.map((preset) => (
                <button
                  key={preset.id}
                  className={`subtitle-card ${form.subtitleStyle === preset.id ? "active" : ""}`}
                  onClick={() => onFormChange({ ...form, subtitleStyle: preset.id })}
                >
                  <div className="subtitle-preview" data-style={preset.id}>
                    <span>WORD</span>
                  </div>
                  <strong>{preset.label}</strong>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ── TEXT TAB ── */}
      {activeTab === "text" && (
        <div className="tab-content">
          {/* Position Picker */}
          <section className="panel-block">
            <div className="panel-intro">
              <strong>Text Position</strong>
              <span className="panel-hint">Where captions appear on the video</span>
            </div>
            <div className="position-picker-wrap">
              <div className="position-phone-mock">
                <div className="phone-screen">
                  {positionOptions.map((pos) => (
                    <div
                      key={pos.id}
                      className={`position-zone ${pos.id} ${form.subtitlePosition === pos.id ? "active" : ""}`}
                      onClick={() => onFormChange({ ...form, subtitlePosition: pos.id })}
                    >
                      <span className="position-zone-dot" />
                      <span className="position-zone-label">{pos.label}</span>
                    </div>
                  ))}
                  {/* Caption preview bar */}
                  <div
                    className="caption-preview-bar"
                    style={{
                      top: form.subtitlePosition === "top" ? "14%"
                        : form.subtitlePosition === "middle" ? "44%"
                        : "72%",
                    }}
                  >
                    <span>Sample Caption</span>
                  </div>
                </div>
              </div>
              <div className="position-btn-col">
                {positionOptions.map((pos) => (
                  <button
                    key={pos.id}
                    className={`position-option-btn ${form.subtitlePosition === pos.id ? "active" : ""}`}
                    onClick={() => onFormChange({ ...form, subtitlePosition: pos.id })}
                  >
                    <span className="pos-icon">{pos.icon}</span>
                    <div>
                      <strong>{pos.label}</strong>
                      <span>{pos.yHint} from top</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Font Family */}
          <section className="panel-block">
            <div className="panel-intro">
              <strong>Font Family</strong>
              <span className="panel-hint">Typography for your captions</span>
            </div>
            <div className="font-family-grid">
              {fontFamilies.map((font) => (
                <button
                  key={font.id}
                  className={`font-card ${form.subtitleFontFamily === font.id ? "active" : ""}`}
                  style={{ fontFamily: font.style }}
                  onClick={() => onFormChange({ ...form, subtitleFontFamily: font.id })}
                >
                  Aa
                  <span>{font.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Text Size */}
          <section className="panel-block">
            <div className="panel-intro">
              <strong>Caption Size</strong>
              <span className="panel-hint">Base font size in pixels</span>
            </div>
            <label className="field-block">
              <div className="slider-header">
                <span>Size</span>
                <span className="slider-value">{form.subtitleSize}px</span>
              </div>
              <input
                type="range"
                min="28"
                max="80"
                step="2"
                value={form.subtitleSize}
                onChange={(e) => onFormChange({ ...form, subtitleSize: parseInt(e.target.value) })}
              />
            </label>
          </section>

          {/* Color Controls */}
          <section className="panel-block split-panel">
            <div>
              <div className="panel-intro">
                <strong>Text Color</strong>
                <span className="panel-hint">Caption fill color</span>
              </div>
              <div className="color-input-row">
                <input
                  type="color"
                  value={form.subtitleColor}
                  onChange={(e) => onFormChange({ ...form, subtitleColor: e.target.value })}
                  className="color-swatch-input"
                />
                <span className="color-hex-label">{form.subtitleColor}</span>
              </div>
            </div>
            <div>
              <div className="panel-intro">
                <strong>Outline Color</strong>
                <span className="panel-hint">Drop-shadow / stroke color</span>
              </div>
              <div className="color-input-row">
                <input
                  type="color"
                  value={form.subtitleOutlineColor}
                  onChange={(e) => onFormChange({ ...form, subtitleOutlineColor: e.target.value })}
                  className="color-swatch-input"
                />
                <span className="color-hex-label">{form.subtitleOutlineColor}</span>
              </div>
            </div>
          </section>

          {/* Outline Width */}
          <section className="panel-block">
            <label className="field-block">
              <div className="slider-header">
                <span>Outline Width</span>
                <span className="slider-value">{form.subtitleOutlineWidth}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="8"
                step="0.5"
                value={form.subtitleOutlineWidth}
                onChange={(e) => onFormChange({ ...form, subtitleOutlineWidth: parseFloat(e.target.value) })}
              />
            </label>
          </section>
        </div>
      )}

      {/* ── BACKGROUND TAB ── */}
      {activeTab === "background" && (
        <div className="tab-content">
          {/* Color Grading */}
          <section className="panel-block">
            <div className="panel-intro">
              <strong>Color Grading</strong>
              <span className="panel-hint">Visual mood applied to the background</span>
            </div>
            <div className="color-grading-grid">
              {colorGradingOptions.map((grade) => (
                <button
                  key={grade.id}
                  className={`grading-card ${form.colorGrading === grade.id ? "active" : ""}`}
                  onClick={() => onFormChange({ ...form, colorGrading: grade.id })}
                >
                  <span className="grading-icon">{grade.icon}</span>
                  <strong>{grade.label}</strong>
                  <span>{grade.desc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Background Dimming */}
          <section className="panel-block">
            <div className="panel-intro">
              <strong>Background Dimming</strong>
              <span className="panel-hint">Darken the backdrop for better text visibility</span>
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
          </section>

          {/* Asset Pack */}
          <section className="panel-block">
            <div className="panel-intro">
              <strong>Background Theme</strong>
              <span className="panel-hint">Visual asset pack for this reel</span>
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
          </section>
        </div>
      )}

      {/* ── LAYOUT TAB ── */}
      {activeTab === "layout" && (
        <div className="tab-content">
          {/* Sticker Animation */}
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

          {/* Sticker Shape */}
          <section className="panel-block">
            <div className="panel-intro">
              <strong>Sticker Shape</strong>
              <span className="panel-hint">Avatar frame style</span>
            </div>
            <div className="sticker-shape-grid">
              {stickerShapes.map((shape) => (
                <button
                  key={shape.id}
                  className={`shape-card ${form.stickerShape === shape.id ? "active" : ""}`}
                  onClick={() => onFormChange({ ...form, stickerShape: shape.id })}
                >
                  <span className="shape-icon">{shape.icon}</span>
                  <strong>{shape.label}</strong>
                </button>
              ))}
            </div>
          </section>

          {/* Layout Toggles */}
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
        </div>
      )}

      {message && <div className="status-chip">{message}</div>}
    </div>
  );
};

export default StyleStep;