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
import { useLocale } from "@/lib/locale-context";
import type { TemplateItem, ApiErrorBody } from "@/lib/types";

export default function TemplatesPage() {
  const { data: session, status: authStatus } = useSession();
  const isLoggedIn = authStatus === "authenticated" && !!session?.user;
  const { t } = useLocale();

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

  function openEdit(tpl: TemplateItem) {
    setEditingId(tpl.id);
    setFormName(tpl.name);
    setFormDesc(tpl.description);
    setFormPrompt(tpl.systemPrompt);
    setFormError("");
    setDialogOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!formName.trim() || !formPrompt.trim()) {
      setFormError(t("templates.nameRequired"));
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
          setFormError(body?.error?.message ?? t("templates.saveFailed"));
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
      setFormError(t("templates.saveFailed"));
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
          <h1 className="text-2xl font-bold">{t("templates.title")}</h1>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>{t("templates.newTemplate")}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? t("templates.editTemplate") : t("templates.newTemplate")}
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
                  <Label>{t("templates.name")}</Label>
                  <Input
                    placeholder={t("templates.namePlaceholder")}
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("templates.description")}</Label>
                  <Input
                    placeholder={t("templates.descriptionPlaceholder")}
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("templates.systemPrompt")}</Label>
                  <Textarea
                    placeholder={t("templates.systemPromptPlaceholder")}
                    className="min-h-[200px] font-mono text-sm"
                    value={formPrompt}
                    onChange={(e) => setFormPrompt(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? t("templates.saving") : t("templates.save")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* 预设模板 */}
        <h2 className="mb-3 text-lg font-semibold">{t("templates.presetTemplates")}</h2>
        <div className="mb-8 grid gap-3 sm:grid-cols-2">
          {PRESET_TEMPLATES.map((tpl) => (
            <Card key={tpl.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{tpl.name}</CardTitle>
                  <Badge variant="secondary" className="text-[10px]">
                    {t("templates.preset")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{tpl.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator className="my-6" />

        {/* 自定义模板 */}
        <h2 className="mb-3 text-lg font-semibold">{t("templates.customTemplates")}</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("templates.loading")}</p>
        ) : customTemplates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("templates.empty")}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {customTemplates.map((tpl) => (
              <Card key={tpl.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{tpl.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 text-sm text-muted-foreground">
                    {tpl.description || t("templates.noDescription")}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(tpl)}
                    >
                      {t("templates.edit")}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => void handleDelete(tpl.id)}
                    >
                      {t("templates.delete")}
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
