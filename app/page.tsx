export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center font-sans">
      <h1 className="text-5xl font-semibold tracking-tight">Tandem</h1>
      <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
        Our web app is on its way.
      </p>
      <a
        href="https://ctang0416.github.io/tandem/"
        className="rounded-full bg-foreground px-5 py-3 font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
      >
        Learn about Tandem
      </a>
    </main>
  );
}
