import { notFound } from "next/navigation";
import { serviceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ invite: string }>;
}

export default async function OnboardPage({ params }: PageProps) {
  const { invite } = await params;
  if (!/^[A-Za-z0-9_-]+$/.test(invite)) notFound();

  const sb = serviceClient();
  const { data: artist } = await sb
    .from("artists")
    .select("id, full_name, status")
    .eq("invite_token", invite)
    .maybeSingle();

  if (!artist) notFound();

  if (artist.status === "connected") {
    return (
      <div className="mx-auto mt-24 max-w-md px-6 text-center">
        <h1 className="text-2xl font-semibold">You're already set up</h1>
        <p className="mt-3 text-neutral-400">
          Hi {artist.full_name} — your calendar is already connected. Your agent has everything they need.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-24 max-w-md px-6 text-center">
      <h1 className="text-2xl font-semibold">Welcome, {artist.full_name}</h1>
      <p className="mt-3 text-neutral-400">
        Connect your Google Calendar so your agent can see when you're available — without ever seeing
        your event details.
      </p>
      <div className="mt-4 rounded-md border border-neutral-800 bg-neutral-950 p-4 text-left text-sm text-neutral-400">
        <p className="font-medium text-neutral-200">What we see:</p>
        <p className="mt-1">Only that you're busy at certain times. No event titles, locations, descriptions, or attendees.</p>
        <p className="mt-3 font-medium text-neutral-200">What you do after this:</p>
        <p className="mt-1">Nothing. Just keep using your Google Calendar like normal.</p>
      </div>
      <a
        href={`/api/auth/google/start?invite=${encodeURIComponent(invite)}`}
        className="mt-6 inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-500"
      >
        Connect Google Calendar
      </a>
    </div>
  );
}
