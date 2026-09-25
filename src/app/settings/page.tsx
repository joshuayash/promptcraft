"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PROVIDERS, getProvider } from "@/lib/providers";
import { getLocalKeys, addLocalKey, deleteLocalKey } from "@/lib/local-store";
import type { ApiKeyView, LocalApiKey, Protocol, ApiErrorBody } from "@/lib/types";

interface DisplayKey {
  id: string;
  label: string;
  provider: string;
  protocol: string;
  baseUrl?: string | null;
  maskedKey: string;
}

export default function SettingsPage() {
  const { data: session, status: authStatus } = useSession();
  const isLoggedIn = authStatus === "authenticated" && !!session?.user;

  const [keys, setKeys] = useState<DisplayKey[]>([]);
  const [loading, setLoading] = useState(true);

  // 表单状态
  const [providerId, setProviderId] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [customProtocol, setCustomProtocol] = useState<Protocol>("openai");
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isCustom = providerId === "custom";
  const selectedProvider = getProvider(providerId);

  // 加载 keys
  useEffect(() => {
    if (authStatus === "loading") return;

    if (isLoggedIn) {
      void fetch("/api/keys")
        .then((r) => r.json())
        .then((data: ApiKeyView[] | ApiErrorBody) => {
          if (Array.isArray(data)) {
            setKeys(
              data.map((k) => ({
                id: k.id,
                label: k.label,
                provider: k.provider,
                protocol: k.protocol,
                baseUrl: k.baseUrl,
                maskedKey: k.maskedKey,
              })),
            );
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      const localKeys = getLocalKeys();
      setKeys(
        localKeys.map((k: LocalApiKey) => ({
          id: k.id,
          label: k.label,
          provider: k.provider,
          protocol: k.protocol,
          baseUrl: k.baseUrl,
          maskedKey:
            k.apiKey.length > 8
              ? `${k.apiKey.slice(0, 4)}••••${k.apiKey.slice(-4)}`
              : "••••",
        })),
      );
      setLoading(false);
    }
  }, [isLoggedIn, authStatus]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!providerId) {
      setError("请选择厂商");
      return;
    }
    if (!apiKey.trim()) {
      setError("请输入 API Key");
      return;
    }
    if (isCustom && (!customLabel.trim() || !customBaseUrl.trim())) {
      setError("自定义厂商需要填写名称和端点地址");
      return;
    }

    setSubmitting(true);

    try {
      if (isLoggedIn) {
        const body: Record<string, string> = {
          provider: providerId,
          apiKey: apiKey.trim(),
        };
        if (isCustom) {
          body.label = customLabel.trim();
          body.protocol = customProtocol;
          body.baseUrl = customBaseUrl.trim();
        }

        const res = await fetch("/api/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errBody = (await res.json().catch(() => null)) as ApiErrorBody | null;
          setError(errBody?.error?.message ?? "添加失败");
          return;
        }

        const created = (await res.json()) as ApiKeyView;
        setKeys((prev) => [
          ...prev,
          {
            id: created.id,
            label: created.label,
            provider: created.provider,
            protocol: created.protocol,
            baseUrl: created.baseUrl,
            maskedKey: created.maskedKey,
          },
        ]);
      } else {
        // 游客模式
        const provider = isCustom ? "custom" : providerId;
        const protocol = isCustom
          ? customProtocol
          : (selectedProvider?.protocol ?? "openai");
        const baseUrl = isCustom
          ? customBaseUrl.trim()
          : (selectedProvider?.baseUrl ?? undefined);
        const label = isCustom
          ? customLabel.trim()
          : (selectedProvider?.name ?? providerId);

        const entry = addLocalKey({
          label,
          provider,
          protocol,
          baseUrl,
          apiKey: apiKey.trim(),
        });

        setKeys((prev) => [
          ...prev,
          {
            id: entry.id,
            label: entry.label,
            provider: entry.provider,
            protocol: entry.protocol,
            baseUrl: entry.baseUrl,
            maskedKey:
              entry.apiKey.length > 8
                ? `${entry.apiKey.slice(0, 4)}••••${entry.apiKey.slice(-4)}`
                : "••••",
          },
        ]);
      }

      // 清空表单
      setApiKey("");
      setCustomLabel("");
      setCustomBaseUrl("");
      setProviderId("");
    } catch {
      setError("添加失败，请稍后再试");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (isLoggedIn) {
      const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setKeys((prev) => prev.filter((k) => k.id !== id));
      }
    } else {
      deleteLocalKey(id);
      setKeys((prev) => prev.filter((k) => k.id !== id));
    }
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <h1 className="mb-6 text-2xl font-bold">API Key 管理</h1>

        {!isLoggedIn && authStatus !== "loading" && (
          <div className="mb-4 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
            游客模式：Key 明文保存在浏览器 localStorage 中，仅支持 Moonshot AI
            兼容协议直连。登录后可加密存储并使用全部协议。
          </div>
        )}

        {/* 已有 Keys */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">已配置的 Key</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">加载中…</p>
            ) : keys.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                还没有配置 API Key，请在下方添加。
              </p>
            ) : (
              <div className="space-y-3">
                {keys.map((k) => (
                  <div
                    key={k.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{k.label}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {k.protocol}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {k.maskedKey}
                        {k.baseUrl && ` · ${k.baseUrl}`}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => void handleDelete(k.id)}
                    >
                      删除
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Separator className="my-6" />

        {/* 添加新 Key */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">添加 API Key</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleAdd(e)} className="space-y-4">
              {error && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label>厂商</Label>
                <Select value={providerId} onValueChange={setProviderId}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择厂商" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">自定义厂商</SelectItem>
                  </SelectContent>
                </Select>
                {selectedProvider && (
                  <p className="text-xs text-muted-foreground">
                    申请地址：{selectedProvider.keyHint}
                  </p>
                )}
              </div>

              {isCustom && (
                <>
                  <div className="space-y-2">
                    <Label>名称</Label>
                    <Input
                      placeholder="例如：我的代理"
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>协议</Label>
                    <Select
                      value={customProtocol}
                      onValueChange={(v) => setCustomProtocol(v as Protocol)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">Moonshot AI 兼容</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="gemini">Gemini</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>端点地址</Label>
                    <Input
                      placeholder="https://api.example.com/v1"
                      value={customBaseUrl}
                      onChange={(e) => setCustomBaseUrl(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>

              <Button type="submit" disabled={submitting}>
                {submitting ? "添加中…" : "添加"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
