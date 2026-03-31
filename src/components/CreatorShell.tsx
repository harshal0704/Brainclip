"use client";

import { useWorkspace, type WizardStep } from "@/components/workspace-provider";
import { StepIndicator } from "@/components/wizard";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, ReactNode } from "react";

export function CreatorShell({ children }: { children: ReactNode }) {
  const { wizardStep, setWizardStep, completedSteps, isSavingDraft, saveDraft } = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === "/edit") setWizardStep(1);
    else if (pathname === "/edit/voice") setWizardStep(2);
    else if (pathname === "/edit/style") setWizardStep(3);
    else if (pathname === "/edit/script") setWizardStep(4);
    else if (pathname === "/render") setWizardStep(5);
  }, [pathname, setWizardStep]);

  const handleStepClick = (step: WizardStep) => {
    if (step <= wizardStep || completedSteps.has(step)) {
      if (step === 1) router.push("/edit");
      if (step === 2) router.push("/edit/voice");
      if (step === 3) router.push("/edit/style");
      if (step === 4) router.push("/edit/script");
      if (step === 5) router.push("/render");
    }
  };

  return (
    <div className="workspace-stack animate-fade-in-up">
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Create Video</h1>
          <p>Follow the steps to create your video</p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={saveDraft}
          disabled={isSavingDraft}
        >
          {isSavingDraft ? "Saving..." : "Save Draft"}
        </button>
      </div>

      <StepIndicator
        currentStep={wizardStep}
        onStepClick={handleStepClick}
        completedSteps={completedSteps}
      />

      <div style={{ marginTop: '24px' }}>
        {children}
      </div>
    </div>
  );
}
