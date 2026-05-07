"use client"

import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react"
import { NextIntlClientProvider } from "next-intl"

import enMessages from "@/messages/en.json"
import msMessages from "@/messages/ms.json"

const supportedLocales = ["en", "ms"] as const
export type SupportedLocale = (typeof supportedLocales)[number]

type LocaleContextValue = {
	locale: SupportedLocale
	setLocale: (nextLocale: SupportedLocale) => void
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function isSupportedLocale(value: unknown): value is SupportedLocale {
	return supportedLocales.includes(value as SupportedLocale)
}

function getCookieValue(name: string): string | null {
	const parts = document.cookie.split(";")
	for (const part of parts) {
		const [key, ...rest] = part.trim().split("=")
		if (key === name) {
			return decodeURIComponent(rest.join("="))
		}
	}
	return null
}

function readPreferredLocale(fallback: SupportedLocale): SupportedLocale {
	try {
		const stored = localStorage.getItem("locale")
		if (isSupportedLocale(stored)) return stored
	} catch {
		// ignore
	}

	try {
		const fromCookie = getCookieValue("locale")
		if (isSupportedLocale(fromCookie)) return fromCookie
	} catch {
		// ignore
	}

	return fallback
}

function getMessages(locale: SupportedLocale) {
	return locale === "ms" ? msMessages : enMessages
}

export function I18nProvider({
	children,
	initialLocale,
}: {
	children: ReactNode
	initialLocale: SupportedLocale
}) {
	const [locale, setLocale] = useState<SupportedLocale>(initialLocale)
	const didInitRef = useRef(false)

	useEffect(() => {
		if (didInitRef.current) return
		didInitRef.current = true
		setLocale(readPreferredLocale(initialLocale))
	}, [initialLocale])

	useEffect(() => {
		try {
			localStorage.setItem("locale", locale)
		} catch {
      // ignore
    }

		document.cookie = `locale=${encodeURIComponent(locale)}; path=/; max-age=31536000; samesite=lax`
		document.documentElement.lang = locale
	}, [locale])

	const value = useMemo(() => ({ locale, setLocale }), [locale])

	return (
		<LocaleContext.Provider value={value}>
			<NextIntlClientProvider locale={locale} messages={getMessages(locale)}>
				{children}
			</NextIntlClientProvider>
		</LocaleContext.Provider>
	)
}

export function useAppLocale() {
	const ctx = useContext(LocaleContext)
	if (!ctx) {
		throw new Error("useAppLocale must be used within I18nProvider")
	}
	return ctx
}
