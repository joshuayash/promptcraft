"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PRESET_TEMPLATES } from "@/lib/preset-templates";
import {
  getLocalTemplates,
  addLocalTemplate,
  updateLocalTemplate,
  deleteLocalTemplate,
} from "@/lib/local-store";
import type { TemplateItem, ApiErrorBody } from "@/lib/types";

export default function TemplatesPage() {
  const { data: session, status: authStatus } = useSession();
  const isLoggedIn = authStatus === "authenticated" && !!session?.user;

  const [customTemplates, setCustomTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 编辑/新增对话框状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPrompt, setFormPrompt] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 加载自定义模板
  useEffect(() => {
    if (authStatus === "loading") return;

    if (isLoggedIn) {
      void fetch("/api/templates")
        .then((r) => r.json())
        .then((data: TemplateItem[] | ApiErrorBody) => {
          if (Array.isArray(data)) setCustomTemplates(data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setCustomTemplates(getLocalTemplates());
      setLoading(false);
    }
  }, [isLoggedIn, authStatus]);

  function openCreate() {
    setEditingId(null);
    setFormName("");
    setFormDesc("");
    setFormPrompt("");
    setFormError("");
    setDialogOpen(true);
  }

  function openEdit(t: TemplateItem) {
    setEditingId(t.id);
    setFormName(t.name);
    setFormDesc(t.description);
    setFormPrompt(t.systemPrompt);
    setFormError("");
    setDialogOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!formName.trim() || !formPrompt.trim()) {
      setFormError("名称和模板内容不能为空");
      return;
    }

    setSubmitting(true);

    try {
      if (isLoggedIn) {
        const url = editingId
          ? `/api/templates/${editingId}`
          : "/api/templates";
        const method = editingId ? "PUT" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            description: formDesc.trim(),
            systemPrompt: formPrompt.trim(),
          }),
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
          setFormError(body?.error?.message ?? "保存失败");
          return;
        }

        // 重新加载
        const listRes = await fetch("/api/templates");
        const list = (await listRes.json()) as TemplateItem[];
        if (Array.isArray(list)) setCustomTemplates(list);
      } else {
        if (editingId) {
          updateLocalTemplate(editingId, {
            name: formName.trim(),
            description: formDesc.trim(),
            systemPrompt: formPrompt.trim(),
          });
        } else {
          addLocalTemplate({
            name: formName.trim(),
            description: formDesc.trim(),
            systemPrompt: formPrompt.trim(),
          });
        }
        setCustomTemplates(getLocalTemplates());
      }

      setDialogOpen(false);
    } catch {
      setFormError("保存失败，请稍后再试");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (isLoggedIn) {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setCustomTemplates((prev) => prev.filter((t) => t.id !== id));
      }
    } else {
      deleteLocalTemplate(id);
      setCustomTemplates((prev) => prev.filter((t) => t.id !== id));
    }
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">提示词模板</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>新建模板</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "编辑模板" : "新建模板"}
                </DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => void handleSubmit(e)}
                className="space-y-4"
              >
                {formError && (
                  <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    {formError}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>名称</Label>
                  <Input
                    placeholder="模板名称"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>描述</Label>
                  <Input
                    placeholder="一句话描述这个模板的用途"
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>元提示词（System Prompt）</Label>
                  <Textarea
                    placeholder="发给 AI 的系统提示词，指导它如何优化用户的提示词…"
                    className="min-h-[200px] font-mono text-sm"
                    value={formPrompt}
                    onChange={(e) => setFormPrompt(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? "保存中…" : "保存"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* 预设模板 */}
        <h2 className="mb-3 text-lg font-semibold">预设模板</h2>
        <div className="mb-8 grid gap-3 sm:grid-cols-2">
          {PRESET_TEMPLATES.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <Badge variant="secondary" className="text-[10px]">
                    预设
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator className="my-6" />

        {/* 自定义模板 */}
        <h2 className="mb-3 text-lg font-semibold">自定义模板</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : customTemplates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            还没有自定义模板，点击右上角「新建模板」创建。
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {customTemplates.map((t) => (
              <Card key={t.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 text-sm text-muted-foreground">
                    {t.description || "无描述"}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(t)}
                    >
                      编辑
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => void handleDelete(t.id)}
                    >
                      删除
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
