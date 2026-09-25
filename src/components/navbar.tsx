"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe, ChevronDown } from "lucide-react";
import { useLocale } from "@/lib/locale-context";

const NAV_ITEMS = [
  { href: "/", key: "workbench" },
  { href: "/history", key: "history" },
  { href: "/templates", key: "templates" },
  { href: "/settings", key: "settings" },
] as const;

export function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated" && !!session?.user;
  const { locale, setLocale, t } = useLocale();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          PromptCraft
        </Link>
        <Separator orientation="vertical" className="h-6" />
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Button
              key={item.href}
              variant={pathname === item.href ? "secondary" : "ghost"}
              size="sm"
              asChild
            >
              <Link href={item.href}>{t(`nav.${item.key}`)}</Link>
            </Button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {/* 语言切换器 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1">
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {locale === "zh-CN" ? t("common.chinese") : t("common.english")}
                </span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setLocale("zh-CN")}
                className={locale === "zh-CN" ? "bg-accent" : ""}
              >
                {t("common.chinese")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setLocale("en-US")}
                className={locale === "en-US" ? "bg-accent" : ""}
              >
                {t("common.english")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {isLoggedIn ? (
            <>
              <span className="text-sm text-muted-foreground">
                {session.user?.email}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void signOut({ callbackUrl: "/" })}
              >
                {t("nav.logout")}
              </Button>
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">
                {t("nav.guest")}
              </span>
              <Button variant="outline" size="sm" asChild>
                <Link href="/login">{t("nav.login")}</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">{t("nav.register")}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
