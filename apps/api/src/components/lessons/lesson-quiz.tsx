"use client";

import { useState } from "react";
import clsx from "clsx";
import { Button } from "../ui/button";

interface LessonQuizQuestion {
  id: number;
  question: string;
  options: string[];
}

interface LessonQuizProps {
  questions: LessonQuizQuestion[];
  onSubmit: (answers: number[]) => void;
  loading: boolean;
}

export function LessonQuiz({
  questions,
  onSubmit,
  loading,
}: LessonQuizProps): JSX.Element {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(
    () => new Array(questions.length).fill(null),
  );

  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const selectedOption = answers[currentIndex];

  function handleSelectOption(optionIndex: number): void {
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = optionIndex;
      return next;
    });
  }

  function handleNext(): void {
    if (isLastQuestion) {
      // Submit all answers (filter nulls -- should all be filled by this point)
      const finalAnswers = answers.map((a) => a ?? 0);
      onSubmit(finalAnswers);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  }

  if (!currentQuestion) {
    return <div />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Progress indicator */}
      <div className="flex items-center gap-1.5">
        {questions.map((_, idx) => (
          <div
            key={idx}
            className={clsx(
              "h-1.5 flex-1 rounded-full transition-colors duration-300",
              idx < currentIndex
                ? "bg-vesna-green"
                : idx === currentIndex
                  ? "bg-tg-button"
                  : "bg-tg-hint/20",
            )}
          />
        ))}
      </div>

      {/* Question number */}
      <p className="text-xs font-medium text-tg-hint">
        Вопрос {currentIndex + 1} из {totalQuestions}
      </p>

      {/* Question text */}
      <h3 className="text-base font-semibold text-tg-text">
        {currentQuestion.question}
      </h3>

      {/* Options */}
      <div className="flex flex-col gap-2">
        {currentQuestion.options.map((option, optionIdx) => (
          <button
            key={optionIdx}
            type="button"
            onClick={() => handleSelectOption(optionIdx)}
            className={clsx(
              "w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all duration-150",
              selectedOption === optionIdx
                ? "border-vesna-green bg-vesna-green/10 text-vesna-green-dark"
                : "border-tg-hint/30 bg-tg-bg text-tg-text hover:border-tg-hint/50 active:bg-tg-secondary-bg",
            )}
          >
            {option}
          </button>
        ))}
      </div>

      {/* Submit / Next button */}
      <Button
        variant="primary"
        size="md"
        onClick={handleNext}
        disabled={selectedOption === null || loading}
        loading={isLastQuestion && loading}
        className="w-full"
      >
        {isLastQuestion ? "Отправить ответы" : "Следующий вопрос"}
      </Button>
    </div>
  );
}
