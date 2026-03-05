"use client";

import { ReactNode, useCallback, useState } from "react";

export type WizardStep = 1 | 2 | 3 | 4 | 5;

interface StepShellProps {
  step: WizardStep;
  stepLabel: string;
  stepDescription: string;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  onSaveDraft?: () => void;
  canGoNext?: boolean;
  canGoBack?: boolean;
  isSaving?: boolean;
  showSaveDraft?: boolean;
  extraActions?: ReactNode;
}

export const StepShell = ({
  step,
  stepLabel,
  stepDescription,
  children,
  onBack,
  onNext,
  onSaveDraft,
  canGoNext = true,
  canGoBack = true,
  isSaving = false,
  showSaveDraft = true,
  extraActions,
}: StepShellProps) => {
  const [isSavingLocal, setIsSavingLocal] = useState(false);

  const handleSaveDraft = useCallback(async () => {
    if (!onSaveDraft || isSaving || isSavingLocal) return;
    setIsSavingLocal(true);
    await onSaveDraft();
    setIsSavingLocal(false);
  }, [onSaveDraft, isSaving, isSavingLocal]);

  return (
    <div className="step-shell">
      <div className="step-header">
        <div className="step-badge">Step {step}</div>
        <h2 className="step-title">{stepLabel}</h2>
        <p className="step-description">{stepDescription}</p>
      </div>
      
      <div className="step-content">
        {children}
      </div>

      <div className="step-footer">
        <div className="step-footer-left">
          {showSaveDraft && onSaveDraft && (
            <button
              type="button"
              className="secondary-button"
              onClick={handleSaveDraft}
              disabled={isSaving || isSavingLocal}
            >
              {isSaving || isSavingLocal ? (
                <span className="saving-indicator">Saving...</span>
              ) : (
                "Save Draft"
              )}
            </button>
          )}
        </div>
        
        <div className="step-footer-right">
          {extraActions}
          
          {canGoBack && onBack && (
            <button type="button" className="secondary-button" onClick={onBack}>
              ← Back
            </button>
          )}
          
          {onNext && (
            <button
              type="button"
              className="primary-button"
              onClick={onNext}
              disabled={!canGoNext}
            >
              {step === 4 ? "Generate" : step === 5 ? "Start Render" : "Next →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StepShell;