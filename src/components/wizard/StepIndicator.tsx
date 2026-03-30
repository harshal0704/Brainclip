"use client";

import { useCallback } from "react";

export type WizardStep = 1 | 2 | 3 | 4 | 5;

interface StepIndicatorProps {
  currentStep: WizardStep;
  onStepClick?: (step: WizardStep) => void;
  completedSteps?: Set<WizardStep>;
}

const stepData: Record<WizardStep, { label: string; icon: React.ReactNode }> = {
  1: { 
    label: "Concept", 
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
    )
  },
  2: { 
    label: "Voice", 
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>
    )
  },
  3: { 
    label: "Style", 
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="13.5" cy="6.5" r="2.5"/>
        <circle cx="17.5" cy="15.5" r="2.5"/>
        <circle cx="8.5" cy="12.5" r="2.5"/>
        <path d="M12 20v-8.5"/>
        <path d="M5 20h14"/>
      </svg>
    )
  },
  4: { 
    label: "Script", 
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    )
  },
  5: { 
    label: "Render", 
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
    )
  },
};

export const StepIndicator = ({ currentStep, onStepClick, completedSteps = new Set() }: StepIndicatorProps) => {
  const steps: WizardStep[] = [1, 2, 3, 4, 5];

  const getStepClass = useCallback((step: WizardStep) => {
    const isCompleted = completedSteps.has(step);
    const isCurrent = currentStep === step;
    
    let classes = "step-indicator-item";
    if (isCurrent) classes += " current";
    if (isCompleted) classes += " completed";
    return classes;
  }, [currentStep, completedSteps]);

  return (
    <div className="step-indicator">
      {steps.map((step, index) => (
        <div key={step} className="step-indicator-step">
          <button
            type="button"
            className={getStepClass(step)}
            onClick={() => onStepClick?.(step)}
            disabled={!onStepClick}
          >
            <span className="step-indicator-icon">
              {completedSteps.has(step) ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                stepData[step].icon
              )}
            </span>
            <span className="step-indicator-label">{stepData[step].label}</span>
          </button>
          {index < steps.length - 1 && (
            <div className={`step-indicator-connector ${completedSteps.has(step) ? "completed" : ""}`} />
          )}
        </div>
      ))}
    </div>
  );
};

export default StepIndicator;