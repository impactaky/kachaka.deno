import { decodeBase64 } from "https://deno.land/std@0.203.0/encoding/base64.ts";

export async function fetchText(url: URL) {
  return (await fetch(url)).text();
}

function reviver<T>(key: string, value: T): T | Uint8Array {
  if (key === "data" && typeof value === "string") {
    return decodeBase64(value);
  }
  return value;
}

export async function createFromJson<T>(url: URL): Promise<T> {
  const content = await fetchText(url);
  return JSON.parse(content, reviver);
}
