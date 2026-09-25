import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const PENDING_JOIN_KEY = "crew-pending-join";
const INVITE_TITLE = "You're invited to a private job crew";
const INVITE_DESCRIPTION = "Join Crew Board to share job posts, compare ATS matches, and remind each other to apply.";
const INVITE_IMAGE = "https://buddy-job-board.lovable.app/crew-board-invite.png";

export const Route = createFileRoute("/join/$token")({
  head: ({ params }) => ({
    meta: [
      { title: `${INVITE_TITLE} — Crew Board` },
      { name: "description", content: INVITE_DESCRIPTION },
      { property: "og:title", content: INVITE_TITLE },
      { property: "og:description", content: INVITE_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `https://buddy-job-board.lovable.app/join/${params.token}` },
      { property: "og:image", content: INVITE_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: INVITE_TITLE },
      { name: "twitter:description", content: INVITE_DESCRIPTION },
      { name: "twitter:image", content: INVITE_IMAGE },
    ],
    links: [{ rel: "canonical", href: `https://buddy-job-board.lovable.app/join/${params.token}` }],
  }),
  component: Join,
});

function Join() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    localStorage.setItem(PENDING_JOIN_KEY, token);
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (data.session) navigate({ to: "/board", replace: true });
      else setChecking(false);
    });
    return () => { alive = false; };
  }, [token, navigate]);
  return (
    <div className="min-h-screen bg-background px-4">
      <header className="mx-auto flex max-w-4xl items-center justify-between py-6">
        <Link to="/" className="font-display text-xl font-bold">Crew Board</Link>
      </header>
      <main className="mx-auto grid max-w-4xl place-items-center py-16 sm:py-24">
        <section className="w-full max-w-2xl rounded-2xl border-2 border-foreground bg-card p-6 text-center shadow-[var(--shadow-pop)] sm:p-10">
          <div className="mx-auto grid size-14 place-items-center rounded-full border-2 border-foreground bg-primary text-primary-foreground">
            <Users className="size-7" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-bold leading-tight sm:text-5xl">You're invited to a private job crew.</h1>
          <p className="mx-auto mt-4 max-w-lg text-muted-foreground">Share job posts, compare ATS matches, and nudge each other to apply before good roles slip away.</p>
          <Link to="/auth" className="mt-7 inline-flex">
            <Button size="lg">Accept invite <ArrowRight className="size-4" /></Button>
          </Link>
          <p className="mt-4 text-sm text-muted-foreground">{checking ? "Checking your sign-in…" : "Sign in or create an account to join."}</p>
        </section>
      </main>
    </div>
  );
}
