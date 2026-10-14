"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import type { AuthFormState } from "@/lib/auth-actions";
import styles from "./AuthForm.module.scss";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn--dark btn--lg" disabled={pending}>
      {pending ? "One moment…" : label}
    </button>
  );
}

export default function AuthForm({
  mode,
  action,
  next,
}: {
  mode: "sign-in" | "sign-up";
  action: (prev: AuthFormState, form: FormData) => Promise<AuthFormState>;
  next?: string;
}) {
  const [state, formAction] = useFormState(action, {});
  const signUp = mode === "sign-up";
  const other = signUp ? "/sign-in" : "/sign-up";
  const otherHref = next ? `${other}?next=${encodeURIComponent(next)}` : other;

  return (
    <form action={formAction} className={`card rise ${styles.form}`} noValidate={false}>
      <h1 className={styles.title}>{signUp ? "Start climbing" : "Welcome back"}</h1>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      {next && <input type="hidden" name="next" value={next} />}
      {signUp && (
        <div className="field">
          <label htmlFor="displayName">Display name</label>
          <input
            id="displayName"
            name="displayName"
            autoComplete="nickname"
            required
            minLength={2}
            maxLength={40}
            defaultValue={state.fields?.displayName}
          />
        </div>
      )}
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          defaultValue={state.fields?.email}
        />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={signUp ? "new-password" : "current-password"}
          required
          minLength={signUp ? 8 : 1}
          maxLength={128}
          aria-describedby={signUp ? "password-hint" : undefined}
        />
        {signUp && (
          <span id="password-hint" className={styles.hint}>
            At least 8 characters.
          </span>
        )}
      </div>
      <SubmitButton label={signUp ? "Create account" : "Sign in"} />
      <p className={styles.switch}>
        {signUp ? "Already have an account? " : "New here? "}
        <Link href={otherHref}>{signUp ? "Sign in" : "Create an account"}</Link>
      </p>
    </form>
  );
}
