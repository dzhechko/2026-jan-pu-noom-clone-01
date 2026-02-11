"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Tab = "login" | "register";

export default function LoginPage(): React.JSX.Element {
  const router = useRouter();
  const { login, register } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function resetForm(): void {
    setName("");
    setEmail("");
    setPassword("");
    setError(null);
  }

  function switchTab(tab: Tab): void {
    setActiveTab(tab);
    resetForm();
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (activeTab === "login") {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-tg-bg">
      {/* Header */}
      <div className="px-6 pt-12 pb-6 text-center">
        <h1 className="text-2xl font-bold text-tg-text">Весна</h1>
        <p className="mt-1 text-sm text-tg-hint">
          Управление весом через CBT
        </p>
      </div>

      {/* Tabs */}
      <div className="mx-6 flex rounded-xl bg-tg-secondary-bg p-1">
        <button
          type="button"
          onClick={() => switchTab("login")}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all duration-150 ${
            activeTab === "login"
              ? "bg-tg-bg text-tg-text shadow-sm"
              : "text-tg-hint"
          }`}
        >
          Вход
        </button>
        <button
          type="button"
          onClick={() => switchTab("register")}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all duration-150 ${
            activeTab === "register"
              ? "bg-tg-bg text-tg-text shadow-sm"
              : "text-tg-hint"
          }`}
        >
          Регистрация
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 pt-6">
        {activeTab === "register" && (
          <Input
            label="Имя"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ваше имя"
            required
            autoComplete="name"
          />
        )}

        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          required
          autoComplete="email"
        />

        <Input
          label="Пароль"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Минимум 8 символов"
          required
          minLength={8}
          autoComplete={activeTab === "login" ? "current-password" : "new-password"}
        />

        {error && (
          <div className="rounded-xl bg-vesna-red/10 px-4 py-3">
            <p className="text-sm font-medium text-vesna-red">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="mt-2 w-full"
        >
          {activeTab === "login" ? "Войти" : "Зарегистрироваться"}
        </Button>
      </form>
    </div>
  );
}
