"use client";

import type { EditorForm, SettingsState, ScriptLine } from "./types";

interface RenderStepProps {
  form: EditorForm;
  settings: SettingsState;
  scriptLines: ScriptLine[];
  onFormChange: (form: EditorForm) => void;
  onStartRender: () => Promise<void>;
  isStarting?: boolean;
  message?: string;
}

export const RenderStep = ({
  form,
  settings,
  scriptLines,
  onFormChange,
  onStartRender,
  isStarting,
  message,
}: RenderStepProps) => {
  const isReadyForRender = scriptLines.length > 0 && form.topic;

  const checklist = {
    topic: !!form.topic,
    duo: !!form.duoId,
    speakers: !!form.speakerAPersona && !!form.speakerBPersona,
    voices: !!settings.fishModelA && !!settings.fishModelB,
    script: scriptLines.length > 0,
    style: !!form.subtitleStyle,
  };

  const readyCount = Object.values(checklist).filter(Boolean).length;
  const totalItems = Object.keys(checklist).length;

  return (
    <div className="render-step">
      <section className="panel-block readiness-panel">
        <div className="panel-intro">
          <strong>Readiness Check</strong>
          <span className="panel-hint">{readyCount}/{totalItems} items configured</span>
        </div>
        
        <div className="checklist">
          <div className={`checklist-item ${checklist.topic ? "done" : ""}`}>
            <span className="check-icon">{checklist.topic ? "✓" : "○"}</span>
            <span>Topic entered</span>
          </div>
          <div className={`checklist-item ${checklist.duo ? "done" : ""}`}>
            <span className="check-icon">{checklist.duo ? "✓" : "○"}</span>
            <span>Duo format selected</span>
          </div>
          <div className={`checklist-item ${checklist.speakers ? "done" : ""}`}>
            <span className="check-icon">{checklist.speakers ? "✓" : "○"}</span>
            <span>Speaker personas defined</span>
          </div>
          <div className={`checklist-item ${checklist.voices ? "done" : ""}`}>
            <span className="check-icon">{checklist.voices ? "✓" : "○"}</span>
            <span>Voices assigned</span>
          </div>
          <div className={`checklist-item ${checklist.script ? "done" : ""}`}>
            <span className="check-icon">{checklist.script ? "✓" : "○"}</span>
            <span>Script generated ({scriptLines.length} lines)</span>
          </div>
          <div className={`checklist-item ${checklist.style ? "done" : ""}`}>
            <span className="check-icon">{checklist.style ? "✓" : "○"}</span>
            <span>Visual style chosen</span>
          </div>
        </div>

        <div className="progress-bar-mini">
          <div className="progress-fill-mini" style={{ width: `${(readyCount / totalItems) * 100}%` }} />
        </div>
      </section>

      <section className="panel-block">
        <div className="panel-intro">
          <strong>Resolution</strong>
          <span className="panel-hint">Draft is faster and cheaper</span>
        </div>
        <div className="selection-grid two">
          <button
            className={form.resolution === "480p" ? "selection-card active" : "selection-card"}
            onClick={() => onFormChange({ ...form, resolution: "480p" })}
          >
            <strong>480p Draft</strong>
            <span>Fast render, lower quality</span>
            <span className="cost-badge">~$0.02</span>
          </button>
          <button
            className={form.resolution === "720p" ? "selection-card active" : "selection-card"}
            onClick={() => onFormChange({ ...form, resolution: "720p" })}
          >
            <strong>720p Final</strong>
            <span>Best quality, standard</span>
            <span className="cost-badge">~$0.05</span>
          </button>
        </div>
      </section>

      <section className="panel-block">
        <div className="panel-intro">
          <strong>End Card</strong>
          <span className="panel-hint">Text shown at the end of the video</span>
        </div>
        <label className="field-block">
          <span>CTA Text (optional)</span>
          <input
            type="text"
            value={form.ctaText}
            onChange={(e) => onFormChange({ ...form, ctaText: e.target.value })}
            placeholder="e.g., Made with Brainclip"
          />
        </label>
      </section>

      {message && <div className="status-chip">{message}</div>}

      <section className="panel-block final-cta">
        <div className="final-summary">
          <h3>Ready to Render</h3>
          <p>
            {scriptLines.length} script lines • {form.resolution} • {form.voiceMode}
          </p>
        </div>
        
        <button
          className="primary-button render-btn"
          onClick={onStartRender}
          disabled={!isReadyForRender || isStarting}
        >
          {isStarting ? (
            "Starting..."
          ) : (
            <>
              Start Render →
              {!isReadyForRender && <span className="disabled-hint"> (complete previous steps)</span>}
            </>
          )}
        </button>
      </section>
    </div>
  );
};

export default RenderStep;