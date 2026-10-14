import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import SiteHeader from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/auth";
import { signIn } from "@/lib/auth-actions";

export const metadata: Metadata = { title: "Sign in" };

export default async function Page(props: { searchParams: Promise<{ next?: string }> }) {
  const searchParams = await props.searchParams;
  if (await getCurrentUser()) redirect("/problems");
  const next = typeof searchParams.next === "string" && searchParams.next.startsWith("/") ? searchParams.next : undefined;
  return (
    <>
      <SiteHeader />
      <main className="container">
        <AuthForm mode="sign-in" action={signIn} next={next} />
      </main>
    </>
  );
}
