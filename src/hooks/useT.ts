import { useLanguage } from '../context/LanguageContext';
import { translations, type Translations } from '../i18n/translations';

/** Returns the full translation object for the currently selected language. */
export function useT(): Translations {
  const { lang } = useLanguage();
  return translations[lang];
}
