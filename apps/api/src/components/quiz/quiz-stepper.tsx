"use client";

import { useState, useCallback } from "react";
import clsx from "clsx";
import type { QuizQuestion } from "@vesna/shared";
import { ProgressBar } from "../ui/progress-bar";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";

interface QuizStepperProps {
  questions: QuizQuestion[];
  onSubmit: (answers: Record<string, unknown>) => void;
  loading: boolean;
}

function RadioInput({
  question,
  value,
  onChange,
}: {
  question: QuizQuestion;
  value: string | undefined;
  onChange: (val: string) => void;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      {question.options?.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={clsx(
            "w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all duration-150",
            value === option
              ? "border-vesna-green bg-vesna-green/10 text-vesna-green-dark"
              : "border-tg-hint/30 bg-tg-bg text-tg-text hover:border-tg-hint/50 active:bg-tg-secondary-bg",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function NumberInput({
  question,
  value,
  onChange,
}: {
  question: QuizQuestion;
  value: number | undefined;
  onChange: (val: number) => void;
}): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <input
        type="number"
        min={question.min}
        max={question.max}
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        placeholder={
          question.min !== undefined && question.max !== undefined
            ? `${question.min}--${question.max}`
            : undefined
        }
        className={clsx(
          "w-full rounded-xl border border-tg-hint/30 bg-tg-bg px-4 py-3 text-tg-text",
          "placeholder:text-tg-hint",
          "transition-colors duration-150",
          "focus:border-tg-button focus:outline-none focus:ring-2 focus:ring-tg-button/50",
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        )}
      />
      {question.unit && (
        <span className="shrink-0 text-sm font-medium text-tg-hint">
          {question.unit}
        </span>
      )}
    </div>
  );
}

function SelectInput({
  question,
  value,
  onChange,
}: {
  question: QuizQuestion;
  value: string | undefined;
  onChange: (val: string) => void;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      {question.options?.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={clsx(
            "w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all duration-150",
            value === option
              ? "border-tg-button bg-tg-button/10 text-tg-button"
              : "border-tg-hint/30 bg-tg-bg text-tg-text hover:border-tg-hint/50 active:bg-tg-secondary-bg",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function MultiselectInput({
  question,
  value,
  onChange,
}: {
  question: QuizQuestion;
  value: string[] | undefined;
  onChange: (val: string[]) => void;
}): JSX.Element {
  const selected = value ?? [];

  function toggle(option: string): void {
    if (selected.includes(option)) {
      onChange(selected.filter((v) => v !== option));
    } else {
      onChange([...selected, option]);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {question.options?.map((option) => {
        const isSelected = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            className={clsx(
              "rounded-full border px-4 py-2 text-sm font-medium transition-all duration-150",
              isSelected
                ? "border-vesna-green bg-vesna-green/15 text-vesna-green-dark"
                : "border-tg-hint/30 bg-tg-bg text-tg-text hover:border-tg-hint/50 active:bg-tg-secondary-bg",
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export function QuizStepper({
  questions,
  onSubmit,
  loading,
}: QuizStepperProps): JSX.Element {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});

  const totalSteps = questions.length;
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;
  const isLastStep = currentStep === totalSteps - 1;
  const currentQuestion = questions[currentStep];

  const currentAnswer = currentQuestion
    ? answers[String(currentQuestion.id)]
    : undefined;

  const isCurrentAnswered = (() => {
    if (!currentQuestion) return false;
    if (currentAnswer === undefined || currentAnswer === null) return false;
    if (currentQuestion.type === "number") {
      return typeof currentAnswer === "number" && !Number.isNaN(currentAnswer);
    }
    if (currentQuestion.type === "multiselect") {
      return Array.isArray(currentAnswer) && currentAnswer.length > 0;
    }
    return currentAnswer !== "";
  })();

  const handleAnswer = useCallback(
    (value: unknown): void => {
      if (!currentQuestion) return;
      setAnswers((prev) => ({
        ...prev,
        [String(currentQuestion.id)]: value,
      }));
    },
    [currentQuestion],
  );

  function handleBack(): void {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }

  function handleNext(): void {
    if (isLastStep) {
      onSubmit(answers);
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  }

  if (!currentQuestion) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col">
      {/* Progress bar */}
      <div className="px-4 pb-2 pt-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-tg-hint">
            {currentStep + 1} / {totalSteps}
          </span>
          <span className="text-xs font-medium text-tg-hint">
            {Math.round(progress)}%
          </span>
        </div>
        <ProgressBar value={progress} />
      </div>

      {/* Question */}
      <div className="flex flex-1 flex-col px-4 py-6">
        <h2 className="mb-6 text-lg font-semibold text-tg-text">
          {currentQuestion.question}
        </h2>

        {/* Input based on type */}
        <div className="flex-1">
          {currentQuestion.type === "radio" && (
            <RadioInput
              question={currentQuestion}
              value={currentAnswer as string | undefined}
              onChange={handleAnswer}
            />
          )}
          {currentQuestion.type === "number" && (
            <NumberInput
              question={currentQuestion}
              value={currentAnswer as number | undefined}
              onChange={handleAnswer}
            />
          )}
          {currentQuestion.type === "select" && (
            <SelectInput
              question={currentQuestion}
              value={currentAnswer as string | undefined}
              onChange={handleAnswer}
            />
          )}
          {currentQuestion.type === "multiselect" && (
            <MultiselectInput
              question={currentQuestion}
              value={currentAnswer as string[] | undefined}
              onChange={handleAnswer}
            />
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3 border-t border-tg-hint/10 px-4 py-4">
        <Button
          variant="secondary"
          size="md"
          onClick={handleBack}
          disabled={currentStep === 0 || loading}
          className="flex-1"
        >
          Назад
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={handleNext}
          disabled={!isCurrentAnswered || loading}
          loading={isLastStep && loading}
          className="flex-1"
        >
          {isLastStep ? "Завершить" : "Далее"}
        </Button>
      </div>
    </div>
  );
}
