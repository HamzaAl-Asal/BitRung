"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./prisma";
import { createSession, destroySession } from "./auth";
import { dummyPasswordHash, hashPassword, verifyPassword } from "./password";

export type AuthFormState = { error?: string; fields?: { email?: string; displayName?: string } };

// Only same-site relative paths, so ?next= can't bounce people to another site.
const safeNext = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : "/problems";
};

const email = z.string().trim().toLowerCase().email("Enter a valid email").max(254);
const password = z.string().min(8, "Use at least 8 characters").max(128, "Use at most 128 characters");

const signUpInput = z.object({
  email,
  displayName: z.string().trim().min(2, "Use at least 2 characters").max(40, "Use at most 40 characters"),
  password,
});

export async function signUp(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const raw = { email: form.get("email"), displayName: form.get("displayName"), password: form.get("password") };
  const fields = { email: String(raw.email ?? ""), displayName: String(raw.displayName ?? "") };
  const parsed = signUpInput.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };

  let userId: string;
  try {
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        displayName: parsed.data.displayName,
        passwordHash: await hashPassword(parsed.data.password),
      },
      select: { id: true },
    });
    userId = user.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "That email already has an account. Sign in instead.", fields };
    }
    throw err;
  }
  await createSession(userId);
  redirect(safeNext(form.get("next")));
}

const signInInput = z.object({ email, password: z.string().min(1).max(128) });

export async function signIn(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const fields = { email: String(form.get("email") ?? "") };
  const parsed = signInInput.safeParse({ email: form.get("email"), password: form.get("password") });
  const wrong = { error: "That email and password don't match.", fields };
  if (!parsed.success) return wrong;

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, passwordHash: true },
  });
  // Same work whether or not the account exists, so timing doesn't reveal which emails are registered.
  const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? (await dummyPasswordHash()));
  if (!user || !ok) return wrong;

  await createSession(user.id);
  redirect(safeNext(form.get("next")));
}

export async function signOut() {
  await destroySession();
  redirect("/");
}
