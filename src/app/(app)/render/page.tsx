"use client";

import { useWorkspace } from "@/components/workspace-provider";
import { RenderStep } from "@/components/wizard";
import { CreatorShell } from "@/components/CreatorShell";
import { useRouter } from "next/navigation";

export default function RenderPage() {
  const {
    editorForm,
    setEditorForm,
    settings,
    scriptLines,
    startRenderFlow,
    isStartingRender,
    editorMessage,
  } = useWorkspace();
  const router = useRouter();

  return (
    <CreatorShell>
      <RenderStep
        form={editorForm}
        settings={settings as any}
        scriptLines={scriptLines as any}
        onFormChange={setEditorForm as any}
        onStartRender={startRenderFlow}
        isStarting={isStartingRender}
        message={editorMessage}
      />
      
      <div className="wizard-nav" style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between' }}>
        <button
          type="button"
          className="secondary-button"
          onClick={() => router.push("/edit/script")}
        >
          ← Back
        </button>
        <div style={{ flex: 1 }}></div>
      </div>
    </CreatorShell>
  );
}
