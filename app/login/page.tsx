// app/login/page.tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/ui/Shell";
import Field from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import StatusMessage from "@/components/ui/StatusMessage";
import inputStyles from "@/components/ui/inputs.module.css";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setSubmitting(false);

    if (!response.ok) {
      setError("Incorrect password");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <Shell width="narrow">
      <div className={styles.header}>
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.subtitle}>Enter the password to continue.</p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <Field label="Password" htmlFor="password">
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            className={inputStyles.input}
          />
        </Field>

        <Button type="submit" disabled={submitting || !password}>
          {submitting ? "Checking..." : "Log in"}
        </Button>

        {error && <StatusMessage variant="error">{error}</StatusMessage>}
      </form>
    </Shell>
  );
}
