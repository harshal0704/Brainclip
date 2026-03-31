"use client";

import { useWorkspace, type WizardStep } from "@/components/workspace-provider";
import { VoiceStep } from "@/components/wizard";
import { CreatorShell } from "@/components/CreatorShell";
import { useRouter } from "next/navigation";

export default function EditVoicePage() {
  const {
    editorForm,
    setEditorForm,
    settings,
    setSettings,
    editorMessage,
    setCompletedSteps,
  } = useWorkspace();
  const router = useRouter();

  return (
    <CreatorShell>
      <VoiceStep
        form={editorForm}
        settings={settings}
        onFormChange={setEditorForm as any}
        onSettingsChange={(newSettings: any) => setSettings((prev: any) => ({ ...prev, ...newSettings }))}
        onGoToVoiceLibrary={() => { router.push('/voices'); }}
        message={editorMessage}
      />
      
      <div className="wizard-nav" style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between' }}>
        <button
          type="button"
          className="secondary-button"
          onClick={() => router.push("/edit")}
        >
          ← Back
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            setCompletedSteps((prev: Set<WizardStep>) => new Set(prev).add(2 as WizardStep));
            router.push("/edit/style");
          }}
        >
          Next →
        </button>
      </div>
    </CreatorShell>
  );
}
