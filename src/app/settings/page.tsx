"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PROVIDERS, getProvider } from "@/lib/providers";
import { getLocalKeys, addLocalKey, deleteLocalKey, setCustomModels } from "@/lib/local-store";
import { useLocale } from "@/lib/locale-context";
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
  const { t } = useLocale();

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

  // 模型导入状态
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importProviderId, setImportProviderId] = useState("");
  const [modelList, setModelList] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");

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
      setError(t("settings.selectProvider"));
      return;
    }
    if (!apiKey.trim()) {
      setError(t("settings.enterApiKey"));
      return;
    }
    if (isCustom && (!customLabel.trim() || !customBaseUrl.trim())) {
      setError(t("settings.customRequired"));
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
          setError(errBody?.error?.message ?? t("settings.addFailed"));
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
      setError(t("settings.addFailed"));
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

  async function handleImportModels() {
    if (!importProviderId || !modelList.trim()) {
      setImportMessage(t("settings.importFailed"));
      return;
    }

    setImporting(true);
    setImportMessage("");

    try {
      const models = modelList
        .split("\n")
        .map((m) => m.trim())
        .filter((m) => m.length > 0);

      if (models.length === 0) {
        setImportMessage(t("settings.importFailed"));
        return;
      }

      // 保存到 localStorage（游客模式）或数据库（登录模式）
      if (isLoggedIn) {
        // TODO: 保存到数据库
        // 目前先保存到 localStorage 作为临时方案
        setCustomModels(importProviderId, models);
      } else {
        setCustomModels(importProviderId, models);
      }

      setImportMessage(t("settings.importSuccess", { count: models.length }));
      
      // 2 秒后关闭对话框
      setTimeout(() => {
        setImportDialogOpen(false);
        setModelList("");
        setImportMessage("");
      }, 2000);
    } catch {
      setImportMessage(t("settings.importFailed"));
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <h1 className="mb-6 text-2xl font-bold">{t("settings.title")}</h1>

        {!isLoggedIn && authStatus !== "loading" && (
          <div className="mb-4 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
            {t("settings.guestWarning")}
          </div>
        )}

        {/* 已有 Keys */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">{t("settings.configuredKeys")}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">{t("settings.loading")}</p>
            ) : keys.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("settings.empty")}
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
                      {t("settings.delete")}
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
            <CardTitle className="text-lg">{t("settings.addKey")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleAdd(e)} className="space-y-4">
              {error && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label>{t("settings.provider")}</Label>
                <Select value={providerId} onValueChange={setProviderId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("settings.providerPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">{t("settings.customProvider")}</SelectItem>
                  </SelectContent>
                </Select>
                {selectedProvider && (
                  <p className="text-xs text-muted-foreground">
                    {t("settings.applyUrl")}：{selectedProvider.keyHint}
                  </p>
                )}
              </div>

              {isCustom && (
                <>
                  <div className="space-y-2">
                    <Label>{t("settings.name")}</Label>
                    <Input
                      placeholder={t("settings.namePlaceholder")}
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("settings.protocol")}</Label>
                    <Select
                      value={customProtocol}
                      onValueChange={(v) => setCustomProtocol(v as Protocol)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI 兼容</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="gemini">Gemini</SelectItem>
                        <SelectItem value="moonshot">Moonshot AI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("settings.baseUrl")}</Label>
                    <Input
                      placeholder={t("settings.baseUrlPlaceholder")}
                      value={customBaseUrl}
                      onChange={(e) => setCustomBaseUrl(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>{t("settings.apiKey")}</Label>
                <Input
                  type="password"
                  placeholder={t("settings.apiKeyPlaceholder")}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? t("settings.adding") : t("settings.add")}
                </Button>

                <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline">
                      {t("settings.importModels")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("settings.importModels")}</DialogTitle>
                      <DialogDescription>
                        {t("settings.importModelsDesc")}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>{t("settings.provider")}</Label>
                        <Select value={importProviderId} onValueChange={setImportProviderId}>
                          <SelectTrigger>
                            <SelectValue placeholder={t("settings.providerPlaceholder")} />
                          </SelectTrigger>
                          <SelectContent>
                            {PROVIDERS.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t("settings.modelList")}</Label>
                        <Textarea
                          placeholder={t("settings.modelListPlaceholder")}
                          value={modelList}
                          onChange={(e) => setModelList(e.target.value)}
                          className="min-h-[150px] font-mono text-sm"
                        />
                      </div>
                      {importMessage && (
                        <div className={`rounded-md border p-3 text-sm ${
                          importMessage.includes("成功") || importMessage.includes("Success")
                            ? "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400"
                            : "border-destructive/50 bg-destructive/10 text-destructive"
                        }`}>
                          {importMessage}
                        </div>
                      )}
                      <Button
                        onClick={() => void handleImportModels()}
                        disabled={importing || !importProviderId || !modelList.trim()}
                        className="w-full"
                      >
                        {importing ? t("settings.importing") : t("settings.import")}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
