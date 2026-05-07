import { getRequestConfig } from "next-intl/server"
import { cookies } from "next/headers"

export default getRequestConfig(async () => {
  const store = await cookies()
  const supportedLocales = ["en", "ms"] as const
  type SupportedLocale = (typeof supportedLocales)[number]

  const cookieLocale = store.get("locale")?.value
  const locale: SupportedLocale = supportedLocales.includes(cookieLocale as SupportedLocale)
    ? (cookieLocale as SupportedLocale)
    : "en"

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
