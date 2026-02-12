"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-tg-bg px-6">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <span className="text-2xl font-bold text-red-500">!</span>
        </div>

        <h1 className="mb-2 text-lg font-bold text-tg-text">
          Что-то пошло не так
        </h1>

        <p className="mb-6 max-w-xs text-sm leading-relaxed text-tg-hint">
          {error.message || "Произошла непредвиденная ошибка"}
        </p>

        <button
          onClick={reset}
          type="button"
          className="rounded-xl bg-vesna-green px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
        >
          Попробовать снова
        </button>
      </div>
    </div>
  );
}
