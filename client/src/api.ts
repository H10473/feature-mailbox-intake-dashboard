import type {
  AgingBucket,
  AppConfig,
  IntakeMessage,
  Kpis,
  TrendPoint,
} from "./types";

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

export async function fetchConfig(): Promise<AppConfig> {
  return handle<AppConfig>(await fetch("/api/config"));
}

export async function fetchMessages(status: string): Promise<IntakeMessage[]> {
  const query = status && status !== "all" ? `?status=${status}` : "";
  return handle<IntakeMessage[]>(await fetch(`/api/messages${query}`));
}

export async function fetchKpis(): Promise<Kpis> {
  return handle<Kpis>(await fetch("/api/kpis"));
}

export async function fetchAging(): Promise<AgingBucket[]> {
  return handle<AgingBucket[]>(await fetch("/api/aging"));
}

export async function fetchTrends(days = 14): Promise<TrendPoint[]> {
  return handle<TrendPoint[]>(await fetch(`/api/trends?days=${days}`));
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

export async function acknowledgeMessage(id: number): Promise<IntakeMessage> {
  return handle<IntakeMessage>(
    await fetch(`/api/messages/${id}/acknowledge`, { method: "POST" })
  );
}

export async function completeMessage(id: number): Promise<IntakeMessage> {
  return handle<IntakeMessage>(
    await fetch(`/api/messages/${id}/complete`, { method: "POST" })
  );
}

export async function deleteMessage(id: number): Promise<void> {
  await handle<void>(await fetch(`/api/messages/${id}`, { method: "DELETE" }));
}
