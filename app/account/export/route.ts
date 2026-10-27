import { loadWorkspace } from "@/lib/workspace";
export async function GET() {
  try {
    const data = await loadWorkspace();
    return Response.json(
      {
        exportedAt: new Date().toISOString(),
        format: "aba-workspace-export-v1",
        limitations:
          "Project data available to this account. Does not contain file bytes, authentication accounts, secrets or a full historical audit log. This is not a restorable database backup.",
        data,
      },
      {
        headers: {
          "Content-Disposition":
            'attachment; filename="aba-workspace-export.json"',
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch {
    return new Response(
      "Sign in and complete any required account security check to export your data.",
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
}
