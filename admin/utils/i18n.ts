import en from '~/i18n/en'
import fr from '~/i18n/fr'

export type Language = 'en' | 'fr'
const dictionaries = { en, fr }

export function useLanguage() {
  const locale = useCookie<Language>('tech-wave-language', { default: () => 'en', sameSite: 'lax' })
  const t = (key: keyof typeof en) => dictionaries[locale.value][key]
  return { locale, t }
}
