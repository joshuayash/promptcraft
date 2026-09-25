"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getLocalHistory, deleteLocalHistory } from "@/lib/local-store";
import type { HistoryEntry, ApiErrorBody } from "@/lib/types";

interface HistoryResponse {
  items: HistoryEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export default function HistoryPage() {
  const { data: session, status: authStatus } = useSession();
  const isLoggedIn = authStatus === "authenticated" && !!session?.user;

  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === "loading") return;

    if (isLoggedIn) {
      void fetch("/api/history")
        .then((r) => r.json())
        .then((data: HistoryResponse | ApiErrorBody) => {
          if ("items" in data) setEntries(data.items);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setEntries(getLocalHistory());
      setLoading(false);
    }
  }, [isLoggedIn, authStatus]);

  async function handleDelete(id: string) {
    if (isLoggedIn) {
      const res = await fetch(`/api/history/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setEntries((prev) => prev.filter((e) => e.id !== id));
      }
    } else {
      deleteLocalHistory(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    }
  }

  function handleCopy(text: string) {
    void navigator.clipboard.writeText(text);
  }

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <h1 className="mb-6 text-2xl font-bold">历史记录</h1>

        {loading ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            还没有优化记录，去工作台优化你的第一个提示词吧。
          </p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <Card key={entry.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-medium">
                        {entry.templateName}
                      </CardTitle>
                      <Badge variant="outline" className="text-[10px]">
                        {entry.provider}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {entry.model}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(entry.createdAt)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-2">
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {entry.originalPrompt}
                    </p>
                  </div>

                  {expandedId === entry.id && (
                    <div className="mb-3 space-y-3 rounded-md border bg-muted/50 p-3">
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">
                          原始提示词
                        </p>
                        <pre className="whitespace-pre-wrap text-sm">
                          {entry.originalPrompt}
                        </pre>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">
                          优化结果
                        </p>
                        <pre className="whitespace-pre-wrap text-sm">
                          {entry.optimizedPrompt}
                        </pre>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setExpandedId(
                          expandedId === entry.id ? null : entry.id,
                        )
                      }
                    >
                      {expandedId === entry.id ? "收起" : "展开"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(entry.optimizedPrompt)}
                    >
                      复制结果
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => void handleDelete(entry.id)}
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
