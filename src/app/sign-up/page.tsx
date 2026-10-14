import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import SiteHeader from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/auth";
import { signUp } from "@/lib/auth-actions";

export const metadata: Metadata = { title: "Create an account" };

export default async function Page({ searchParams }: { searchParams: { next?: string } }) {
  if (await getCurrentUser()) redirect("/problems");
  const next = typeof searchParams.next === "string" && searchParams.next.startsWith("/") ? searchParams.next : undefined;
  return (
    <>
      <SiteHeader />
      <main className="container">
        <AuthForm mode="sign-up" action={signUp} next={next} />
      </main>
    </>
  );
}
