import Link from "next/link";

export default function Home() {
  return (
    <main className="landing-page flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center font-sans">
      <h1 className="text-5xl font-semibold tracking-tight">Tandem</h1>
      <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
        Our web app is on its way.
      </p>
      <div className="flex flex-col items-center gap-3">
        <a
          href="https://ctang0416.github.io/tandem/"
          className="landing-button rounded-full px-5 py-3 font-medium transition-colors"
        >
          Learn about Tandem
        </a>
        <Link
          href="/demo"
          className="rounded-full border border-current px-5 py-3 font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/10"
        >
          Demo
        </Link>
      </div>
    </main>
  );
}
