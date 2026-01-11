import ReportViewer from "@/components/report-viewer";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-zinc-500">
              GitHub Reporter Viewer
            </p>
            <h1 className="text-2xl font-semibold text-zinc-100">
              Report Archive
            </h1>
          </div>
          <div className="text-xs text-zinc-500">Private proxy mode</div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        <ReportViewer />
      </main>
    </div>
  );
}
