"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  return (
    <html lang="ru">
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "24px",
            fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
            backgroundColor: "#ffffff",
            color: "#1a1a1a",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              backgroundColor: "#fee2e2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px",
              fontSize: "28px",
            }}
          >
            !
          </div>

          <h1
            style={{
              fontSize: "18px",
              fontWeight: 700,
              marginBottom: "8px",
              textAlign: "center",
            }}
          >
            Что-то пошло не так
          </h1>

          <p
            style={{
              fontSize: "13px",
              color: "#6b7280",
              textAlign: "center",
              maxWidth: "320px",
              lineHeight: "1.5",
              marginBottom: "20px",
            }}
          >
            {error.message || "Произошла непредвиденная ошибка"}
          </p>

          <button
            onClick={reset}
            type="button"
            style={{
              padding: "10px 24px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#ffffff",
              backgroundColor: "#22c55e",
              border: "none",
              borderRadius: "12px",
              cursor: "pointer",
            }}
          >
            Попробовать снова
          </button>
        </div>
      </body>
    </html>
  );
}
