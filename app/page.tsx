export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Booking Bot</h1>
      <p className="mt-4 text-neutral-400">
        Artist availability & gig dispatch for talent booking agencies.
      </p>
      <div className="mt-8 space-y-2 text-sm text-neutral-500">
        <p>
          Agent dashboard: <a href="/calendar" className="text-blue-400 hover:underline">/calendar</a>
        </p>
        <p>
          Artist onboarding link is sent individually by invite.
        </p>
      </div>
    </main>
  );
}
