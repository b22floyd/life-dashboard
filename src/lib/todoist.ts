import { createClient } from "@/lib/supabase/server";

const TODOIST_API_BASE = "https://api.todoist.com/api/v1";

async function todoistFetch(path: string, init?: RequestInit): Promise<unknown> {
  const token = process.env.TODOIST_API_TOKEN;
  if (!token) {
    throw new Error("TODOIST_API_TOKEN is not configured.");
  }

  const response = await fetch(`${TODOIST_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Todoist API error (${response.status}) for ${path}`);
  }

  if (response.status === 204) return undefined;

  return response.json();
}

// Todoist's list endpoints return either a flat array or a paginated
// { results: [...], next_cursor } wrapper depending on API version — accept
// either shape rather than assuming one.
function extractList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: T[] }).results;
  }
  return [];
}

export type TodoistProject = {
  id: string;
  name: string;
};

// Returns null on any failure (missing token, network error, non-2xx
// response) so the UI can show a clear error instead of crashing.
export async function getTodoistProjects(): Promise<TodoistProject[] | null> {
  try {
    const data = await todoistFetch("/projects");
    return extractList<{ id: string | number; name: string }>(data).map((project) => ({
      id: String(project.id),
      name: project.name,
    }));
  } catch (error) {
    console.error("Failed to load Todoist projects:", error);
    return null;
  }
}

export type TodoistTask = {
  id: string;
  projectId: string;
  content: string;
  dueDate: string | null; // "yyyy-mm-dd" or an ISO datetime if the task has a time
};

// Returns null on failure, [] when there's simply nothing due.
export async function getTodoistTasksForProjects(
  projectIds: string[],
): Promise<TodoistTask[] | null> {
  if (projectIds.length === 0) return [];

  try {
    const results = await Promise.all(
      projectIds.map((id) => todoistFetch(`/tasks?project_id=${encodeURIComponent(id)}`)),
    );

    return results.flatMap((data) =>
      extractList<{
        id: string | number;
        project_id: string | number;
        content: string;
        due: { date?: string; datetime?: string } | null;
      }>(data).map((task) => ({
        id: String(task.id),
        projectId: String(task.project_id),
        content: task.content,
        dueDate: task.due?.datetime ?? task.due?.date ?? null,
      })),
    );
  } catch (error) {
    console.error("Failed to load Todoist tasks:", error);
    return null;
  }
}

export async function closeTodoistTask(taskId: string): Promise<void> {
  await todoistFetch(`/tasks/${encodeURIComponent(taskId)}/close`, { method: "POST" });
}

export async function getSelectedProjectIds(): Promise<string[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("todoist_preferences")
    .select("selected_project_ids")
    .eq("user_id", user.id)
    .maybeSingle();

  return data?.selected_project_ids ?? [];
}
