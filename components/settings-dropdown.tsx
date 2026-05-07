"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Check, Languages, Monitor, Moon, Settings, Sun } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"

export function SettingsDropdown() {
  const { theme, setTheme } = useTheme()
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()

  const setLocaleCookie = (nextLocale: "en" | "ms") => {
    document.cookie = `locale=${nextLocale}; path=/; max-age=31536000; samesite=lax`
    router.refresh()
  }

  const themes = [
    { value: "light", label: t("settings.light"), icon: Sun },
    { value: "dark", label: t("settings.dark"), icon: Moon },
    { value: "system", label: t("settings.system"), icon: Monitor },
  ] as const

  const languages = [
    ["en", t("settings.languages.en")],
    ["ms", t("settings.languages.ms")],
  ] as const

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings className="size-4" />
          <span className="sr-only">{t("settings.title")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("settings.title")}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {t("settings.theme")}
          </DropdownMenuLabel>
          {themes.map(({ value, label, icon: Icon }) => (
            <DropdownMenuItem key={value} onClick={() => setTheme(value)} className="gap-2">
              <Icon className="size-4" />
              {label}
              {theme === value && <Check className="ml-auto size-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {t("settings.language")}
          </DropdownMenuLabel>
          {languages.map(([code, name]) => (
            <DropdownMenuItem key={code} onClick={() => setLocaleCookie(code)} className="gap-2">
              <Languages className="size-4" />
              {name}
              {locale === code && <Check className="ml-auto size-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
