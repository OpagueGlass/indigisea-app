import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="grid min-h-svh place-items-center bg-[radial-gradient(circle_at_top,_hsl(192_55%_92%),_transparent_55%),linear-gradient(180deg,_hsl(198_48%_97%),_hsl(201_36%_93%))] p-6">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/85 p-6 text-center shadow-lg backdrop-blur-sm">
        <p className="text-xs font-semibold tracking-[0.14em] text-slate-600 uppercase">Offline Mode</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">No Connection Needed</h1>
        <p className="mt-3 text-sm text-slate-700">
          Indigisea Recorder is available offline. Return to the home screen to continue recording.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex h-10 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Go to Recorder
        </Link>
      </section>
    </main>
  );
}