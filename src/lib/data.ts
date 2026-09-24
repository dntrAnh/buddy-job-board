import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  email: string;
  display_name: string;
  resume: string;
  reminder_mode: "easy" | "medium" | "hard";
  onboarded: boolean;
};
export type Job = {
  id: string;
  group_id: string;
  posted_by: string;
  company: string;
  role: string;
  description: string;
  link: string | null;
  notes: string | null;
  created_at: string;
};
export type Application = { job_id: string; user_id: string; status: "applied" | "skipped" };
export type Score = {
  job_id: string;
  user_id: string;
  score: number;
  matched: string[];
  missing: string[];
  suggestions: string[];
  updated_at: string;
};

export async function ensureProfile(userId: string, email: string): Promise<Profile> {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (data) return data as Profile;
  const { data: created, error } = await supabase
    .from("profiles")
    .insert({ id: userId, email, display_name: email.split("@")[0] })
    .select("*")
    .single();
  if (error) throw error;
  return created as Profile;
}

export async function fetchGroups(userId: string) {
  const { data, error } = await supabase
    .from("group_members")
    .select("group_id, groups(id, name, created_by)")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.groups).filter(Boolean) as { id: string; name: string; created_by: string }[];
}

export async function fetchPendingInvites(email: string) {
  const { data } = await supabase
    .from("invites")
    .select("id, group_id, email, accepted")
    .ilike("email", email)
    .eq("accepted", false);
  return data ?? [];
}

export async function fetchGroupData(groupId: string, userId: string) {
  const [jobs, members, invites] = await Promise.all([
    supabase.from("jobs").select("*").eq("group_id", groupId).order("created_at", { ascending: false }),
    supabase.from("group_members").select("user_id").eq("group_id", groupId),
    supabase.from("invites").select("id, email, accepted").eq("group_id", groupId).eq("accepted", false),
  ]);
  const jobList = (jobs.data ?? []) as Job[];
  const ids = jobList.map((j) => j.id);
  const memberIds = (members.data ?? []).map((m) => m.user_id);
  const [apps, scores, profiles] = await Promise.all([
    ids.length ? supabase.from("applications").select("*").in("job_id", ids) : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("match_scores").select("*").in("job_id", ids).eq("user_id", userId)
      : Promise.resolve({ data: [] }),
    memberIds.length
      ? supabase.from("profiles").select("id, display_name, email").in("id", memberIds)
      : Promise.resolve({ data: [] }),
  ]);
  return {
    jobs: jobList,
    memberIds,
    pendingInvites: invites.data ?? [],
    applications: (apps.data ?? []) as Application[],
    scores: (scores.data ?? []) as Score[],
    profiles: (profiles.data ?? []) as { id: string; display_name: string; email: string }[],
  };
}
