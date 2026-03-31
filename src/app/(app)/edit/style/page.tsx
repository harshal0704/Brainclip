"use client";

import { useWorkspace, type WizardStep } from "@/components/workspace-provider";
import { StyleStep } from "@/components/wizard";
import { CreatorShell } from "@/components/CreatorShell";
import { useRouter } from "next/navigation";

export default function EditStylePage() {
  const {
    editorForm,
    setEditorForm,
    editorMessage,
    setCompletedSteps,
  } = useWorkspace();
  const router = useRouter();

  return (
    <CreatorShell>
      <StyleStep
        form={editorForm}
        onFormChange={setEditorForm as any}
        message={editorMessage}
      />
      
      <div className="wizard-nav" style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between' }}>
        <button
          type="button"
          className="secondary-button"
          onClick={() => router.push("/edit/voice")}
        >
          ← Back
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            setCompletedSteps((prev: Set<WizardStep>) => new Set(prev).add(3 as WizardStep));
            router.push("/edit/script");
          }}
        >
          Next →
        </button>
      </div>
    </CreatorShell>
  );
}
