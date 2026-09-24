import { useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

const MODES: { id: Profile["reminder_mode"]; title: string; desc: string }[] = [
  { id: "easy", title: "Easy", desc: "Digest 2–3× a day" },
  { id: "medium", title: "Medium", desc: "Every new job" },
  { id: "hard", title: "Hard", desc: "New jobs + friend applied" },
];

export function ReminderModePicker({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  async function pick(mode: Profile["reminder_mode"]) {
    const { error } = await supabase.from("profiles").update({ reminder_mode: mode }).eq("id", profile.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success(`Reminders: ${mode}`);
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="capitalize"><Bell className="size-4" /> {profile.reminder_mode}</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-1 p-2">
        {MODES.map((m) => (
          <button key={m.id} onClick={() => pick(m.id)}
            className={`w-full rounded-lg px-3 py-2 text-left ${profile.reminder_mode === m.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            <div className="font-semibold">{m.title}</div>
            <div className="text-xs opacity-80">{m.desc}</div>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
