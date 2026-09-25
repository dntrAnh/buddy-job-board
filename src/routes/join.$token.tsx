import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const PENDING_JOIN_KEY = "crew-pending-join";

export const Route = createFileRoute("/join/$token")({
  head: () => ({
    meta: [
      { title: "You're invited — Crew Board" },
      { name: "description", content: "Join your friends' private job board on Crew Board." },
      { property: "og:title", content: "You're invited to a Crew Board group" },
      { property: "og:description", content: "Join your friends' private job board — share jobs and remind each other to apply." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Join,
});

function Join() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  useEffect(() => {
    localStorage.setItem(PENDING_JOIN_KEY, token);
    navigate({ to: "/board", replace: true });
  }, [token, navigate]);
  return <div className="grid min-h-screen place-items-center bg-background font-display text-xl">Joining your crew…</div>;
}
