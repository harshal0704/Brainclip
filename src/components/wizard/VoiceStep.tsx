"use client";

import { voicePresetCatalog } from "@/lib/catalog";
import type { EditorForm, SettingsState } from "./types";

interface VoiceStepProps {
  form: EditorForm;
  settings: SettingsState;
  onFormChange: (form: EditorForm) => void;
  onSettingsChange: (settings: SettingsState) => void;
  onGoToVoiceLibrary?: () => void;
  message?: string;
}

export const VoiceStep = ({ form, settings, onFormChange, onSettingsChange, onGoToVoiceLibrary, message }: VoiceStepProps) => {
  const handleVoiceSelect = (voiceId: string, speaker: "A" | "B") => {
    const voice = voicePresetCatalog.find((v) => v.id === voiceId);
    if (!voice) return;

    if (speaker === "A") {
      onSettingsChange({ ...settings, fishModelA: voice.fishModelId || voice.id });
    } else {
      onSettingsChange({ ...settings, fishModelB: voice.fishModelId || voice.id });
    }
  };

  const isVoiceSelectedForA = (voiceId: string) => {
    const voice = voicePresetCatalog.find((v) => v.id === voiceId);
    return settings.fishModelA === (voice?.fishModelId || voice?.id);
  };

  const isVoiceSelectedForB = (voiceId: string) => {
    const voice = voicePresetCatalog.find((v) => v.id === voiceId);
    return settings.fishModelB === (voice?.fishModelId || voice?.id);
  };

  return (
    <div className="voice-step">
      <div className="voice-columns">
        <section className="panel-block voice-column">
          <div className="speaker-header speaker-a">
            <strong>Speaker A</strong>
            <span>Who speaks first</span>
          </div>

          <div className="panel-intro">
            <strong>Select Voice</strong>
          </div>

          <div className="voice-grid">
            {voicePresetCatalog.map((voice) => (
              <button
                key={`a-${voice.id}`}
                className={`voice-card ${isVoiceSelectedForA(voice.id) ? "active" : ""}`}
                onClick={() => handleVoiceSelect(voice.id, "A")}
              >
                <div className="voice-card-header">
                  <strong>{voice.label}</strong>
                  {voice.previewUrl && (
                    <button
                      type="button"
                      className="voice-preview-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        const audio = new Audio(voice.previewUrl);
                        audio.play();
                      }}
                    >
                      ▶
                    </button>
                  )}
                </div>
                <span className="voice-persona">{voice.persona}</span>
                {voice.tags?.length > 0 && (
                  <div className="voice-tags">
                    {voice.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="voice-tag">{tag}</span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>

          {onGoToVoiceLibrary && (
            <button className="secondary-button full-width" onClick={onGoToVoiceLibrary}>
              Select Custom Voice →
            </button>
          )}
        </section>

        <section className="panel-block voice-column">
          <div className="speaker-header speaker-b">
            <strong>Speaker B</strong>
            <span>Responds to A</span>
          </div>

          <div className="panel-intro">
            <strong>Select Voice</strong>
          </div>

          <div className="voice-grid">
            {voicePresetCatalog.map((voice) => (
              <button
                key={`b-${voice.id}`}
                className={`voice-card ${isVoiceSelectedForB(voice.id) ? "active" : ""}`}
                onClick={() => handleVoiceSelect(voice.id, "B")}
              >
                <div className="voice-card-header">
                  <strong>{voice.label}</strong>
                  {voice.previewUrl && (
                    <button
                      type="button"
                      className="voice-preview-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        const audio = new Audio(voice.previewUrl);
                        audio.play();
                      }}
                    >
                      ▶
                    </button>
                  )}
                </div>
                <span className="voice-persona">{voice.persona}</span>
                {voice.tags?.length > 0 && (
                  <div className="voice-tags">
                    {voice.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="voice-tag">{tag}</span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>

          {onGoToVoiceLibrary && (
            <button className="secondary-button full-width" onClick={onGoToVoiceLibrary}>
              Select Custom Voice →
            </button>
          )}
        </section>
      </div>

      <section className="panel-block">
        <div className="panel-intro">
          <strong>Voice Mode</strong>
        </div>
        <div className="selection-grid two">
          <button
            className={form.voiceMode === "fish-api" ? "selection-card active" : "selection-card"}
            onClick={() => onFormChange({ ...form, voiceMode: "fish-api" })}
          >
            <strong>Fish.audio API</strong>
            <span>Use cloud TTS (no GPU needed)</span>
          </button>
          <button
            className={form.voiceMode === "colab" ? "selection-card active" : "selection-card"}
            onClick={() => onFormChange({ ...form, voiceMode: "colab" })}
          >
            <strong>Colab (GPU)</strong>
            <span>Use your own GPU runtime</span>
          </button>
        </div>
      </section>

      {message && <div className="status-chip">{message}</div>}
    </div>
  );
};

export default VoiceStep;