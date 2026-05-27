import { env } from "../lib/env";
import { createLogger } from "../lib/logger";
import type { UserProfile } from "./types";

const log = createLogger("kimi/platform");

async function kimiRequest<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T | null> {
  const resp = await fetch(`${env.kimiOpenUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  if (!resp.ok) {
    const text = await resp.text();
    log.warn({ path, status: resp.status, body: text }, "kimi request failed");
    return null;
  }
  return resp.json() as Promise<T>;
}

export const users = {
  getProfile: (token: string) =>
    kimiRequest<UserProfile>("/v1/users/me/profile", token),
};
