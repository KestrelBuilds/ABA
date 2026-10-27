import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { prompts } from "../questionnaires";
function check(condition: boolean, message: string) {
  if (!condition) throw Error(message + " did not pass.");
}
export async function checkCreativeJourney(
  owner: SupabaseClient,
  sessions: SupabaseClient[],
  projects: string[],
  users: string[],
  document: string,
) {
  for (let i = 0; i < 2; i++) {
    const kind = i === 0 ? "brand" : "website";
    const answers = Object.fromEntries(
      prompts[kind].map(([key]) => [key, "Fictional test response"]),
    );
    const saved = await sessions[i]
      .from("questionnaires")
      .insert({
        project_id: projects[i],
        kind,
        answers,
        submitted_by: users[i],
      })
      .select("id")
      .single();
    check(!saved.error && Boolean(saved.data), "Questionnaire submission");
    const read = await owner
      .from("questionnaires")
      .select("answers")
      .eq("project_id", projects[i])
      .eq("kind", kind)
      .single();
    check(
      !read.error &&
        Object.entries(answers).every(
          ([key, value]) => read.data?.answers[key] === value,
        ),
      "Questionnaire owner review",
    );
    const hidden = await sessions[1 - i]
      .from("questionnaires")
      .select("id")
      .eq("project_id", projects[i]);
    check(
      !hidden.error && hidden.data?.length === 0,
      "Questionnaire client isolation",
    );
    const wrong = await sessions[i].from("questionnaires").insert({
      project_id: projects[i],
      kind: i === 0 ? "website" : "brand",
      answers,
      submitted_by: users[i],
    });
    check(
      wrong.error?.code === "42501",
      "Wrong-workflow questionnaire protection",
    );
  }
  for (const decision of ["comment", "changes_requested", "approved"]) {
    const feedback = await sessions[0]
      .from("feedback")
      .insert({
        document_id: document,
        author_id: users[0],
        body: "Fictional creative review: " + decision,
        decision,
      })
      .select("id")
      .single();
    check(!feedback.error && Boolean(feedback.data), "Creative " + decision);
    const reviewed = await owner
      .from("feedback")
      .select("decision")
      .eq("id", feedback.data!.id)
      .single();
    check(
      !reviewed.error && reviewed.data?.decision === decision,
      "Owner feedback review",
    );
  }
  const cross = await sessions[1].from("feedback").insert({
    document_id: document,
    author_id: users[1],
    body: "Forbidden other-client review",
    decision: "approved",
  });
  check(cross.error?.code === "42501", "Cross-client approval protection");
  const controls = await owner
    .from("projects")
    .select("final_approved,final_paid")
    .eq("id", projects[0])
    .single();
  check(
    !controls.error &&
      !controls.data?.final_approved &&
      !controls.data?.final_paid,
    "Creative approval does not bypass delivery controls",
  );
}
