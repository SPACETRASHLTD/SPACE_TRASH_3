import Link from "next/link";

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-800 bg-neutral-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold">
            Booking Bot
          </Link>
          <nav className="flex items-center gap-6 text-sm text-neutral-300">
            <Link href="/artists" className="hover:text-white">
              Artists
            </Link>
            <Link href="/calendar" className="hover:text-white">
              Calendar
            </Link>
            <Link href="/offers" className="hover:text-white">
              Offers
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
