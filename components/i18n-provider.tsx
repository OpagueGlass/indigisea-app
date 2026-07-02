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

// Check if a given value is a supported locale.
function isSupportedLocale(value: unknown): value is SupportedLocale {
	return supportedLocales.includes(value as SupportedLocale)
}

// Read the preferred locale from localStorage, falling back to a default if not found or invalid.
function readPreferredLocale(fallback: SupportedLocale): SupportedLocale {
	try {
		const stored = localStorage.getItem("locale")
		if (isSupportedLocale(stored)) return stored
	} catch (e) {
		console.error("Failed to read preferred locale from localStorage", e)
	}

	return fallback
}

// Get the appropriate messages for the given locale.
function getMessages(locale: SupportedLocale) {
	return locale === "ms" ? msMessages : enMessages
}

/**
 * I18nProvider component provides internationalisation support for the application for switching between languages.
 */
export function I18nProvider({
	children,
	initialLocale,
}: {
	children: ReactNode
	initialLocale: SupportedLocale
}) {
	const [locale, setLocale] = useState<SupportedLocale>(initialLocale)
	const hasInitialised = useRef(false)

	useEffect(() => {
		// Set the initial locale from localStorage only once on mount.
		if (hasInitialised.current) return
		hasInitialised.current = true
		setLocale(readPreferredLocale(initialLocale))
	}, [initialLocale])

	useEffect(() => {
		// Update localStorage whenever the locale changes.
		try {
			localStorage.setItem("locale", locale)
		} catch (e) {
			console.error("Failed to set preferred locale in localStorage", e)
		}
	}, [locale])

	const value = useMemo(() => ({ locale, setLocale }), [locale])

	return (
		<LocaleContext.Provider value={value}>
			<NextIntlClientProvider locale={locale} messages={getMessages(locale)} timeZone="Asia/Kuala_Lumpur">
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
