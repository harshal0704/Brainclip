"use client";

import { useWorkspace, type WizardStep } from "@/components/workspace-provider";
import { StepIndicator, ConceptStep, VoiceStep, StyleStep, ScriptStep, RenderStep } from "@/components/wizard";

export default function EditorPage() {
  const {
    editorForm,
    setEditorForm,
    settings,
    setSettings,
    scriptLines,
    setScriptLines,
    wizardStep,
    setWizardStep,
    completedSteps,
    setCompletedSteps,
    editorMessage,
    isGeneratingScript,
    generateScript,
    isStartingRender,
    startRenderFlow,
    handleUploadSticker,
    saveDraft,
    isSavingDraft
  } = useWorkspace();

  return (
    <div className="workspace-stack">
      <div className="view-header">
        <h1>Create Video</h1>
        <p>Follow the steps to create your video</p>
      </div>

      <StepIndicator
        currentStep={wizardStep}
        onStepClick={(step) => {
          if (step <= wizardStep || completedSteps.has(step as WizardStep)) {
            setWizardStep(step as WizardStep);
          }
        }}
        completedSteps={completedSteps}
      />

      {wizardStep === 1 && (
        <ConceptStep
          form={editorForm}
          onFormChange={setEditorForm as any}
          onUploadSticker={handleUploadSticker}
          message={editorMessage}
        />
      )}

      {wizardStep === 2 && (
        <VoiceStep
          form={editorForm}
          settings={settings}
          onFormChange={setEditorForm as any}
          onSettingsChange={setSettings as any}
          onGoToVoiceLibrary={() => { window.location.href = '/voices'; }}
          message={editorMessage}
        />
      )}

      {wizardStep === 3 && (
        <StyleStep
          form={editorForm}
          onFormChange={setEditorForm as any}
          message={editorMessage}
        />
      )}

      {wizardStep === 4 && (
        <ScriptStep
          form={editorForm}
          scriptLines={scriptLines as any}
          onScriptLinesChange={setScriptLines as any}
          onGenerateScript={async () => {
            try {
              await generateScript();
              setCompletedSteps((prev) => new Set(prev).add(4));
            } catch (e) {
              console.error(e);
            }
          }}
          isGenerating={isGeneratingScript}
          message={editorMessage}
        />
      )}

      {wizardStep === 5 && (
        <RenderStep
          form={editorForm}
          settings={settings as any}
          scriptLines={scriptLines as any}
          onFormChange={setEditorForm as any}
          onStartRender={startRenderFlow}
          isStarting={isStartingRender}
          message={editorMessage}
        />
      )}

      <div className="wizard-nav">
        {wizardStep > 1 && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => setWizardStep((wizardStep - 1) as WizardStep)}
          >
            ← Back
          </button>
        )}
        
        <button
          type="button"
          className="secondary-button"
          onClick={saveDraft}
          disabled={isSavingDraft}
        >
          {isSavingDraft ? "Saving..." : "Save Draft"}
        </button>

        {wizardStep < 5 && (
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setCompletedSteps((prev) => new Set(prev).add(wizardStep));
              setWizardStep((wizardStep + 1) as WizardStep);
            }}
            disabled={wizardStep === 1 && (!editorForm.topic || !editorForm.duoId)}
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
