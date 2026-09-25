import type { LocalApiKey, TemplateItem, HistoryEntry } from "./types";

/**
 * 游客模式的 localStorage 存取层。
 * 仅浏览器端调用（"use client" 组件内）。
 */

const KEYS_KEY = "promptcraft:keys";
const TEMPLATES_KEY = "promptcraft:templates";
const HISTORY_KEY = "promptcraft:history";

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, items: T[]): void {
  localStorage.setItem(key, JSON.stringify(items));
}

function genId(): string {
  return `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── API Keys ──────────────────────────────────────────────

export function getLocalKeys(): LocalApiKey[] {
  return read<LocalApiKey>(KEYS_KEY);
}

export function addLocalKey(
  key: Omit<LocalApiKey, "id">,
): LocalApiKey {
  const keys = getLocalKeys();
  const entry: LocalApiKey = { ...key, id: genId() };
  keys.push(entry);
  write(KEYS_KEY, keys);
  return entry;
}

export function deleteLocalKey(id: string): void {
  write(KEYS_KEY, getLocalKeys().filter((k) => k.id !== id));
}

// ── Templates ─────────────────────────────────────────────

export function getLocalTemplates(): TemplateItem[] {
  return read<TemplateItem>(TEMPLATES_KEY);
}

export function addLocalTemplate(
  t: Omit<TemplateItem, "id" | "isPreset">,
): TemplateItem {
  const templates = getLocalTemplates();
  const entry: TemplateItem = { ...t, id: genId(), isPreset: false };
  templates.push(entry);
  write(TEMPLATES_KEY, templates);
  return entry;
}

export function updateLocalTemplate(
  id: string,
  patch: Partial<Pick<TemplateItem, "name" | "description" | "systemPrompt">>,
): void {
  const templates = getLocalTemplates().map((t) =>
    t.id === id ? { ...t, ...patch } : t,
  );
  write(TEMPLATES_KEY, templates);
}

export function deleteLocalTemplate(id: string): void {
  write(TEMPLATES_KEY, getLocalTemplates().filter((t) => t.id !== id));
}

// ── History ───────────────────────────────────────────────

export function getLocalHistory(): HistoryEntry[] {
  return read<HistoryEntry>(HISTORY_KEY);
}

export function addLocalHistory(
  entry: Omit<HistoryEntry, "id" | "createdAt">,
): HistoryEntry {
  const history = getLocalHistory();
  const item: HistoryEntry = {
    ...entry,
    id: genId(),
    createdAt: new Date().toISOString(),
  };
  history.unshift(item); // 最新在前
  write(HISTORY_KEY, history);
  return item;
}

export function deleteLocalHistory(id: string): void {
  write(HISTORY_KEY, getLocalHistory().filter((h) => h.id !== id));
}
