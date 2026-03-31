"use client";

import { useWorkspace } from "@/components/workspace-provider";
import { VoiceLibrary } from "@/components/VoiceLibrary";

export default function VoicesPage() {
  const { selectedCustomVoices, handleVoiceSelect } = useWorkspace();

  return (
    <div className="workspace-stack">
      <div className="view-header">
        <h1>Voice Library</h1>
        <p>Upload voice references and clone them to your active roster.</p>
      </div>
      <section className="panel-block">
        {selectedCustomVoices.speakerA || selectedCustomVoices.speakerB ? (
          <div className="selected-voices-bar">
            <span className="selected-voices-label">Selected for next render:</span>
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
            <button className="secondary-button small" onClick={() => { window.location.href = '/editor'; }}>
              Return to Editor
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
  );
}
