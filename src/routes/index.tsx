import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Crew Board — a private job board for your friends" },
      { name: "description", content: "Share job posts with your crew, get nudged to apply, and see your ATS match score." },
      { property: "og:title", content: "Crew Board — a private job board for your friends" },
      { property: "og:description", content: "Share job posts with your crew, get nudged to apply, and see your ATS match score." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="font-display text-xl font-bold">Crew Board</span>
        <Link to="/auth"><Button variant="outline">Sign in</Button></Link>
      </header>
      <main className="mx-auto max-w-5xl px-6 pb-24 pt-12">
        <h1 className="font-display text-5xl font-bold leading-[1.05] md:text-7xl">
          Job hunting is better<br />
          <span className="bg-primary px-2 text-primary-foreground">with your crew.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Paste a job, everyone in your group gets pinged. See who already applied, get your resume's ATS score for
          every post, and stop letting good roles slip by.
        </p>
        <Link to="/auth"><Button size="lg" className="mt-8">Get started</Button></Link>
        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            ["Up to 15 friends", "Invite-only groups keep it tight."],
            ["ATS match score", "See missing keywords and quick fixes. Re-grade anytime."],
            ["Friendly nudges", "Pick easy, medium or hard reminder mode."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl border-2 border-foreground bg-card p-5 shadow-[var(--shadow-pop)]">
              <h3 className="font-display text-lg font-bold">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
