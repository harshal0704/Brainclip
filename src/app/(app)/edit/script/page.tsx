"use client";

import { useWorkspace, type WizardStep } from "@/components/workspace-provider";
import { ScriptStep } from "@/components/wizard";
import { CreatorShell } from "@/components/CreatorShell";
import { useRouter } from "next/navigation";

export default function EditScriptPage() {
  const {
    editorForm,
    scriptLines,
    setScriptLines,
    generateScript,
    isGeneratingScript,
    editorMessage,
    setCompletedSteps,
  } = useWorkspace();
  const router = useRouter();

  return (
    <CreatorShell>
      <ScriptStep
        form={editorForm}
        scriptLines={scriptLines as any}
        onScriptLinesChange={setScriptLines as any}
        onGenerateScript={async () => {
          try {
            await generateScript();
            setCompletedSteps((prev: Set<WizardStep>) => new Set(prev).add(4 as WizardStep));
          } catch (e) {
            console.error(e);
          }
        }}
        isGenerating={isGeneratingScript}
        message={editorMessage}
      />
      
      <div className="wizard-nav" style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between' }}>
        <button
          type="button"
          className="secondary-button"
          onClick={() => router.push("/edit/style")}
        >
          ← Back
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            setCompletedSteps((prev: Set<WizardStep>) => new Set(prev).add(4 as WizardStep));
            router.push("/render");
          }}
        >
          Next →
        </button>
      </div>
    </CreatorShell>
  );
}
