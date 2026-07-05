import type { IntakeMessage, Stats, Status } from "./types";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function fetchMessages(status: string): Promise<IntakeMessage[]> {
  const query = status && status !== "all" ? `?status=${status}` : "";
  return handle<IntakeMessage[]>(await fetch(`/api/messages${query}`));
}

export async function fetchStats(): Promise<Stats> {
  return handle<Stats>(await fetch("/api/stats"));
}

export interface CreateInput {
  sender: string;
  subject: string;
  body: string;
  channel: string;
  priority: string;
}

export async function createMessage(input: CreateInput): Promise<IntakeMessage> {
  return handle<IntakeMessage>(
    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function updateMessage(
  id: number,
  patch: { status?: Status; assignee?: string | null }
): Promise<IntakeMessage> {
  return handle<IntakeMessage>(
    await fetch(`/api/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
  );
}

export async function deleteMessage(id: number): Promise<void> {
  await handle<void>(await fetch(`/api/messages/${id}`, { method: "DELETE" }));
}
