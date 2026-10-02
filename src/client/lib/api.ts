import type { ApiErrorBody } from "../types";

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as T & ApiErrorBody;
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

export const jsonPost = (body: unknown): RequestInit => ({
  method: "POST",
  body: JSON.stringify(body),
});

export function singaporeDate(): string {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Singapore",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .map(({ type, value }) => [type, value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
