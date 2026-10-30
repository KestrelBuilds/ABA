import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
// Called only with this run's preallocated paths, never with browser input.
export async function removeCheckFiles(
  service: SupabaseClient,
  paths: string[],
) {
  const removed = await service.storage.from("project-files").remove(paths);
  if (removed.error) return false;
  const checks = await Promise.all(
    paths.map(async (path) => {
      const [project, name] = path.split("/");
      const listed = await service.storage
        .from("project-files")
        .list(project, { search: name, limit: 10 });
      return (
        !listed.error &&
        Array.isArray(listed.data) &&
        !listed.data.some((file) => file.name === name)
      );
    }),
  );
  return checks.every(Boolean);
}
