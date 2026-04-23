export default function LandingPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold">Subscription commerce, refactored.</h1>
      <p className="text-lg text-slate-300 max-w-2xl">
        Orbital handles trials, seat-based billing, usage metering, and dunning
        so your team can ship billing features in days instead of quarters.
      </p>
      <div className="flex gap-4">
        <a
          href="/dashboard"
          className="rounded bg-orbital-primary px-4 py-2 text-white hover:bg-blue-700"
        >
          Open Dashboard
        </a>
        <a
          href="/invoices"
          className="rounded border border-slate-600 px-4 py-2 text-slate-200 hover:bg-slate-800"
        >
          View Invoices
        </a>
      </div>
    </div>
  );
}
