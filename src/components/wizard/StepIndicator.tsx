"use client";

import { useCallback } from "react";

export type WizardStep = 1 | 2 | 3 | 4 | 5;

interface StepIndicatorProps {
  currentStep: WizardStep;
  onStepClick?: (step: WizardStep) => void;
  completedSteps?: Set<WizardStep>;
}

const stepLabels: Record<WizardStep, string> = {
  1: "Concept",
  2: "Voice",
  3: "Style",
  4: "Script",
  5: "Render",
};

export const StepIndicator = ({ currentStep, onStepClick, completedSteps = new Set() }: StepIndicatorProps) => {
  const steps: WizardStep[] = [1, 2, 3, 4, 5];

  const getStepClass = useCallback((step: WizardStep) => {
    const isCompleted = completedSteps.has(step);
    const isCurrent = currentStep === step;
    const isPast = step < currentStep || isCompleted;
    
    let classes = "step-indicator-item";
    if (isCurrent) classes += " current";
    if (isCompleted) classes += " completed";
    if (isPast && !isCompleted) classes += " past";
    return classes;
  }, [currentStep, completedSteps]);

  return (
    <div className="step-indicator">
      {steps.map((step, index) => (
        <div key={step} style={{ display: "flex", alignItems: "center", flex: index < steps.length - 1 ? 1 : "none" }}>
          <button
            type="button"
            className={getStepClass(step)}
            onClick={() => onStepClick?.(step)}
            disabled={!onStepClick}
          >
            <span className="step-indicator-number">
              {completedSteps.has(step) ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M11.6 4.2L5.6 10.2L2.4 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : step}
            </span>
            <span className="step-indicator-label">{stepLabels[step]}</span>
          </button>
          {index < steps.length - 1 && <div className="step-indicator-line" />}
        </div>
      ))}
    </div>
  );
};

export default StepIndicator;