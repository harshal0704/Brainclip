"use client";

import { useWorkspace, type WizardStep } from "@/components/workspace-provider";
import { ConceptStep } from "@/components/wizard";
import { CreatorShell } from "@/components/CreatorShell";
import { useRouter } from "next/navigation";

export default function EditConceptPage() {
  const {
    editorForm,
    setEditorForm,
    editorMessage,
    handleUploadSticker,
    setCompletedSteps,
  } = useWorkspace();
  const router = useRouter();

  return (
    <CreatorShell>
      <ConceptStep
        form={editorForm}
        onFormChange={setEditorForm as any}
        onUploadSticker={handleUploadSticker}
        message={editorMessage}
      />
      <div className="wizard-nav" style={{ marginTop: '24px' }}>
        <div style={{ flex: 1 }}></div>
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            setCompletedSteps((prev: Set<WizardStep>) => new Set(prev).add(1 as WizardStep));
            router.push("/edit/voice");
          }}
          disabled={!editorForm.topic || !editorForm.duoId}
        >
          Next →
        </button>
      </div>
    </CreatorShell>
  );
}
