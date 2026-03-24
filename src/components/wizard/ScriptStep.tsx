"use client";

import { useState } from "react";
import type { EditorForm, ScriptLine } from "./types";

interface ScriptStepProps {
  form: EditorForm;
  scriptLines: ScriptLine[];
  onScriptLinesChange: (lines: ScriptLine[]) => void;
  onGenerateScript: () => Promise<void>;
  isGenerating?: boolean;
  message?: string;
}

const emotions = [
  { value: "neutral", label: "Neutral", color: "#888" },
  { value: "happy", label: "Happy", color: "#4CAF50" },
  { value: "sad", label: "Sad", color: "#2196F3" },
  { value: "angry", label: "Angry", color: "#f44336" },
  { value: "surprised", label: "Surprised", color: "#9C27B0" },
  { value: "excited", label: "Excited", color: "#FF9800" },
  { value: "whispering", label: "Whisper", color: "#607D8B" },
  { value: "shouting", label: "Shout", color: "#E91E63" },
];

export const ScriptStep = ({
  form,
  scriptLines,
  onScriptLinesChange,
  onGenerateScript,
  isGenerating,
  message,
}: ScriptStepProps) => {
  const [showPreview, setShowPreview] = useState(false);

  const updateLine = (lineId: string, field: keyof ScriptLine, value: unknown) => {
    onScriptLinesChange(
      scriptLines.map((line) => (line.id === lineId ? { ...line, [field]: value } : line))
    );
  };

  const deleteLine = (lineId: string) => {
    if (scriptLines.length <= 8) {
      alert("Minimum 8 lines required");
      return;
    }
    onScriptLinesChange(scriptLines.filter((line) => line.id !== lineId));
  };

  const moveLine = (lineId: string, direction: "up" | "down") => {
    const index = scriptLines.findIndex((line) => line.id === lineId);
    if (direction === "up" && index > 0) {
      const newLines = [...scriptLines];
      [newLines[index - 1], newLines[index]] = [newLines[index], newLines[index - 1]];
      onScriptLinesChange(newLines);
    } else if (direction === "down" && index < scriptLines.length - 1) {
      const newLines = [...scriptLines];
      [newLines[index], newLines[index + 1]] = [newLines[index + 1], newLines[index]];
      onScriptLinesChange(newLines);
    }
  };

  const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="script-step">
      <div className="script-header-actions">
        <button
          className="primary-button large"
          onClick={onGenerateScript}
          disabled={isGenerating || !form.topic}
        >
          {isGenerating ? "Generating..." : "Generate Script"}
        </button>
        
        {scriptLines.length > 0 && (
          <button
            className="secondary-button"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? "Hide Preview" : "Show Preview"}
          </button>
        )}
      </div>

      {message && <div className="status-chip">{message}</div>}

      {showPreview && scriptLines.length > 0 && (
        <section className="panel-block preview-panel">
          <div className="panel-intro">
            <strong>Video Preview</strong>
            <span className="panel-hint">Live Remotion preview will appear here</span>
          </div>
          <div className="preview-placeholder">
            <div className="preview-screen">
              <div className="preview-speaker-a">Speaker A</div>
              <div className="preview-subtitle">
                {scriptLines[0]?.text || "Your script text..."}
              </div>
              <div className="preview-speaker-b">Speaker B</div>
            </div>
            <p className="preview-note">Remotion Player preview integration coming soon</p>
          </div>
        </section>
      )}

      {scriptLines.length === 0 ? (
        <div className="empty-script">
          <p>Enter a topic and click &quot;Generate Script&quot; to create your dialogue.</p>
          <p className="hint">You can edit each line after generation.</p>
        </div>
      ) : (
        <div className="script-editor">
          {scriptLines.map((line, index) => (
            <div
              key={line.id}
              className={`script-line-card speaker-${line.speaker.toLowerCase()}`}
            >
              <div className="script-line-header">
                <div className="script-line-id">
                  <span className={`speaker-badge ${line.speaker === "A" ? "sky" : "accent"}`}>
                    {line.speaker}
                  </span>
                  <span className="line-number">{line.id}</span>
                </div>
                <div className="script-line-controls">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => moveLine(line.id, "up")}
                    disabled={index === 0}
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => moveLine(line.id, "down")}
                    disabled={index === scriptLines.length - 1}
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="icon-btn delete"
                    onClick={() => deleteLine(line.id)}
                    title="Delete line"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="script-line-content">
                <textarea
                  value={line.text}
                  rows={2}
                  onChange={(e) => updateLine(line.id, "text", e.target.value)}
                  placeholder="Enter dialogue..."
                  className="script-text-input"
                />
                <span className="word-count">{wordCount(line.text)} words</span>
              </div>

              <div className="script-line-options">
                <div className="option-group">
                  <label>
                    <span>Emotion</span>
                    <select
                      value={line.emotion}
                      onChange={(e) => updateLine(line.id, "emotion", e.target.value)}
                    >
                      {emotions.map((em) => (
                        <option key={em.value} value={em.value}>
                          {em.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="option-group">
                  <label>
                    <span>Speed</span>
                    <div className="slider-input">
                      <input
                        type="range"
                        min="0.75"
                        max="1.25"
                        step="0.05"
                        value={line.speaking_rate}
                        onChange={(e) => updateLine(line.id, "speaking_rate", parseFloat(e.target.value))}
                      />
                      <span className="value-display">{line.speaking_rate.toFixed(2)}x</span>
                    </div>
                  </label>
                </div>

                <div className="option-group">
                  <label>
                    <span>Pause (ms)</span>
                    <input
                      type="number"
                      min="150"
                      max="800"
                      value={line.pause_ms}
                      onChange={(e) => updateLine(line.id, "pause_ms", parseInt(e.target.value) || 250)}
                    />
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {scriptLines.length > 0 && (
        <div className="script-summary">
          <span>{scriptLines.length} lines</span>
          <span>|</span>
          <span>Speaker A: {scriptLines.filter((l) => l.speaker === "A").length} lines</span>
          <span>|</span>
          <span>Speaker B: {scriptLines.filter((l) => l.speaker === "B").length} lines</span>
        </div>
      )}
    </div>
  );
};

export default ScriptStep;