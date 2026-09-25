"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { PRESET_TEMPLATES } from "@/lib/preset-templates";
import { PROVIDERS, getProvider } from "@/lib/providers";
import {
  getLocalKeys,
  getLocalTemplates,
  addLocalHistory,
} from "@/lib/local-store";
import type {
  TemplateItem,
  ApiKeyView,
  LocalApiKey,
  ApiErrorBody,
} from "@/lib/types";

// ── 类型 ──────────────────────────────────────────────────

interface KeyOption {
  id: string;
  label: string;
  provider: string;
  protocol: string;
  baseUrl?: string | null;
  /** 游客模式有明文 key；登录模式为 undefined（走后端代理） */
  apiKey?: string;
  maskedKey?: string;
}

type Status = "idle" | "streaming" | "done" | "error";

// ── 工具函数 ──────────────────────────────────────────────

function maskLocal(key: string): string {
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

/** 游客模式：浏览器直连 Moonshot AI 兼容端点，解析 SSE 流 */
async function* streamGuest(
  baseUrl: string,
  apiKey: string,
  model: string,
  system: string,
  prompt: string,
): AsyncGenerator<string> {
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let msg = `请求失败 (${res.status})`;
    if (res.status === 401) msg = "API Key 无效或已过期";
    else if (res.status === 402) msg = "账户余额不足";
    else if (res.status === 429) msg = "请求过于频繁，请稍后再试";
    throw new Error(msg + (text ? `\n${text.slice(0, 200)}` : ""));
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("无法读取响应流");

  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const json: unknown = JSON.parse(data);
        const delta = (
          json as {
            choices?: { delta?: { content?: string } }[];
          }
        ).choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // 忽略不完整 JSON 行
      }
    }
  }
}

// ── 组件 ──────────────────────────────────────────────────

export default function WorkbenchPage() {
  const { data: session, status: authStatus } = useSession();
  const isLoggedIn = authStatus === "authenticated" && !!session?.user;

  // 输入状态
  const [prompt, setPrompt] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("preset:general");
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [customModel, setCustomModel] = useState("");

  // 数据
  const [templates, setTemplates] = useState<TemplateItem[]>(PRESET_TEMPLATES);
  const [keys, setKeys] = useState<KeyOption[]>([]);

  // 输出状态
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // 加载 keys + templates
  useEffect(() => {
    if (authStatus === "loading") return;

    if (isLoggedIn) {
      // 登录：从 API 加载
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
        .catch(() => {});

      void fetch("/api/templates")
        .then((r) => r.json())
        .then((data: TemplateItem[] | ApiErrorBody) => {
          if (Array.isArray(data)) {
            setTemplates([...PRESET_TEMPLATES, ...data]);
          }
        })
        .catch(() => {});
    } else {
      // 游客：从 localStorage 加载
      const localKeys = getLocalKeys();
      setKeys(
        localKeys.map((k: LocalApiKey) => ({
          id: k.id,
          label: k.label,
          provider: k.provider,
          protocol: k.protocol,
          baseUrl: k.baseUrl,
          apiKey: k.apiKey,
          maskedKey: maskLocal(k.apiKey),
        })),
      );
      const localTemplates = getLocalTemplates();
      setTemplates([...PRESET_TEMPLATES, ...localTemplates]);
    }
  }, [isLoggedIn, authStatus]);

  // 选中 key 变化时重置模型
  useEffect(() => {
    setSelectedModel("");
    setCustomModel("");
  }, [selectedKeyId]);

  const selectedKey = keys.find((k) => k.id === selectedKeyId);
  const providerDef = selectedKey ? getProvider(selectedKey.provider) : undefined;
  const modelList = providerDef?.models ?? [];
  const effectiveModel = customModel.trim() || selectedModel;

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // 优化
  const handleOptimize = useCallback(async () => {
    if (!prompt.trim() || !selectedKey || !effectiveModel || !selectedTemplate)
      return;

    setStatus("streaming");
    setOutput("");
    setError("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (isLoggedIn) {
        // 登录：走后端代理
        const res = await fetch("/api/optimize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: prompt.trim(),
            templateId: selectedTemplateId,
            keyId: selectedKey.id,
            model: effectiveModel,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
          throw new Error(body?.error?.message ?? `请求失败 (${res.status})`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("无法读取响应流");
        const decoder = new TextDecoder();
        let acc = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setOutput(acc);
        }
      } else {
        // 游客：浏览器直连（仅 Moonshot AI 兼容协议）
        if (selectedKey.protocol !== "openai") {
          throw new Error(
            "游客模式仅支持 Moonshot AI 兼容协议的厂商。Anthropic/Gemini 原生协议请登录后使用。",
          );
        }
        if (!selectedKey.apiKey || !selectedKey.baseUrl) {
          throw new Error("缺少 API Key 或端点地址");
        }

        let acc = "";
        const gen = streamGuest(
          selectedKey.baseUrl,
          selectedKey.apiKey,
          effectiveModel,
          selectedTemplate.systemPrompt,
          prompt.trim(),
        );
        for await (const chunk of gen) {
          if (controller.signal.aborted) break;
          acc += chunk;
          setOutput(acc);
        }
      }

      setStatus("done");

      // 保存历史
      const finalOutput = output; // 注意：这里 output 可能不是最终值，用 acc 更准确
      const historyEntry = {
        originalPrompt: prompt.trim(),
        optimizedPrompt: "", // 会在下面更新
        templateId: selectedTemplateId,
        templateName: selectedTemplate.name,
        provider: selectedKey.label,
        model: effectiveModel,
      };

      // 等 output state 稳定后保存
      setOutput((final) => {
        historyEntry.optimizedPrompt = final;
        if (isLoggedIn) {
          void fetch("/api/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              originalPrompt: historyEntry.originalPrompt,
              optimizedPrompt: final,
              templateId: selectedTemplateId.startsWith("preset:")
                ? null
                : selectedTemplateId,
              provider: historyEntry.provider,
              model: historyEntry.model,
            }),
          }).catch(() => {});
        } else {
          addLocalHistory(historyEntry);
        }
        return final;
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setStatus("idle");
        return;
      }
      setError(err instanceof Error ? err.message : "未知错误");
      setStatus("error");
    }
  }, [prompt, selectedKey, effectiveModel, selectedTemplate, selectedTemplateId, isLoggedIn, output]);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(output);
  }, [output]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setStatus(output ? "done" : "idle");
  }, [output]);

  const canOptimize =
    prompt.trim().length > 0 &&
    selectedKeyId !== "" &&
    effectiveModel !== "" &&
    status !== "streaming";

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          {/* 模板选择 */}
          <div className="space-y-2">
            <Label>优化模板</Label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="选择模板" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.isPreset && (
                      <Badge variant="secondary" className="ml-1 text-[10px]">
                        预设
                      </Badge>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <p className="text-xs text-muted-foreground">
                {selectedTemplate.description}
              </p>
            )}
          </div>

          {/* 厂商/Key 选择 */}
          <div className="space-y-2">
            <Label>API Key</Label>
            <Select value={selectedKeyId} onValueChange={setSelectedKeyId}>
              <SelectTrigger>
                <SelectValue placeholder="选择 Key" />
              </SelectTrigger>
              <SelectContent>
                {keys.length === 0 && (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    请先在设置中添加 API Key
                  </div>
                )}
                {keys.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.label}
                    <span className="ml-1 text-xs text-muted-foreground">
                      {k.maskedKey}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedKey && (
              <p className="text-xs text-muted-foreground">
                {providerDef?.name ?? selectedKey.provider}
              </p>
            )}
          </div>

          {/* 模型选择 */}
          <div className="space-y-2">
            <Label>模型</Label>
            {modelList.length > 0 ? (
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
                <SelectContent>
                  {modelList.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <input
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="输入模型名称"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
              />
            )}
            {modelList.length > 0 && (
              <input
                className="flex h-7 w-full rounded-md border border-input bg-transparent px-2 py-0.5 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="或手动输入其他模型"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
              />
            )}
          </div>
        </div>

        <Separator className="my-4" />

        {/* 输入 + 输出 左右分栏 */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* 左侧：原始输入 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">原始提示词</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="输入你要优化的提示词…"
                className="min-h-[300px] resize-y font-mono text-sm"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <div className="mt-3 flex items-center gap-2">
                {status === "streaming" ? (
                  <Button variant="destructive" size="sm" onClick={handleStop}>
                    停止生成
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={!canOptimize}
                    onClick={() => void handleOptimize()}
                  >
                    优化提示词
                  </Button>
                )}
                <span className="text-xs text-muted-foreground">
                  {prompt.length > 0 && `${prompt.length} 字`}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 右侧：优化结果 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">优化结果</CardTitle>
                {status === "done" && output && (
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={handleCopy}>
                      复制
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleOptimize()}
                    >
                      重新优化
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {status === "error" && (
                <div className="mb-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              {status === "idle" && !output && (
                <div className="flex min-h-[300px] items-center justify-center text-sm text-muted-foreground">
                  优化后的提示词将在这里显示
                </div>
              )}
              {(status === "streaming" || status === "done" || output) && (
                <Textarea
                  className="min-h-[300px] resize-y font-mono text-sm"
                  value={output}
                  onChange={(e) => setOutput(e.target.value)}
                  readOnly={status === "streaming"}
                />
              )}
              {status === "streaming" && (
                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
                  正在生成…
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
