interface PageProps {
  searchParams: Promise<{ reason?: string }>;
}

export default async function OnboardErrorPage({ searchParams }: PageProps) {
  const { reason } = await searchParams;
  return (
    <div className="mx-auto mt-24 max-w-md px-6 text-center">
      <h1 className="text-2xl font-semibold text-red-400">Connection failed</h1>
      <p className="mt-3 text-neutral-400">
        Something went wrong while connecting your calendar.
      </p>
      {reason ? (
        <p className="mt-3 rounded-md border border-red-900/40 bg-red-950/30 p-3 text-sm text-red-300">
          {reason}
        </p>
      ) : null}
      <p className="mt-4 text-sm text-neutral-500">
        Ask your agent to send you a fresh invite link, or try again.
      </p>
    </div>
  );
}
