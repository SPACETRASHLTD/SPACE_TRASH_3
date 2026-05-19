export default function OnboardDonePage() {
  return (
    <div className="mx-auto mt-24 max-w-md px-6 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-600/20">
        <svg className="h-6 w-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-2xl font-semibold">You're all set</h1>
      <p className="mt-3 text-neutral-400">
        Your Google Calendar is connected. Your agent will see when you're busy — never what you're doing.
      </p>
      <p className="mt-4 text-sm text-neutral-500">You can close this page.</p>
    </div>
  );
}
