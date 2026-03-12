import { en } from "../locales/en.ts";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  loadLazyLocaleTranslation,
  resolveNavigatorLocale,
} from "./registry.ts";
import type { Locale, TranslationMap } from "./types.ts";

type Subscriber = (locale: Locale) => void;

export { SUPPORTED_LOCALES, isSupportedLocale };

const LOCALE_STORAGE_KEY = "oneclaw.i18n.locale";
const LEGACY_LOCALE_STORAGE_KEY = "openclaw.i18n.locale";

function resolveUrlLocale(): Locale | null {
  if (typeof window === "undefined") {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  const queryLocale = params.get("locale") ?? params.get("lang");
  return isSupportedLocale(queryLocale) ? queryLocale : null;
}

class I18nManager {
  private locale: Locale = DEFAULT_LOCALE;
  private translations: Partial<Record<Locale, TranslationMap>> = { [DEFAULT_LOCALE]: en };
  private subscribers: Set<Subscriber> = new Set();

  constructor() {
    this.loadLocale();
  }

  private resolveInitialLocale(): Locale {
    const queryLocale = resolveUrlLocale();
    if (queryLocale) {
      return queryLocale;
    }
    const saved =
      localStorage.getItem(LOCALE_STORAGE_KEY) ?? localStorage.getItem(LEGACY_LOCALE_STORAGE_KEY);
    if (isSupportedLocale(saved)) {
      if (saved === localStorage.getItem(LEGACY_LOCALE_STORAGE_KEY)) {
        localStorage.setItem(LOCALE_STORAGE_KEY, saved);
        localStorage.removeItem(LEGACY_LOCALE_STORAGE_KEY);
      }
      return saved;
    }
    return resolveNavigatorLocale(navigator.language);
  }

  private loadLocale() {
    const initialLocale = this.resolveInitialLocale();
    if (initialLocale === DEFAULT_LOCALE) {
      this.locale = DEFAULT_LOCALE;
      return;
    }
    // Use the normal locale setter so startup locale loading follows the same
    // translation-loading + notify path as manual locale changes.
    void this.setLocale(initialLocale);
  }

  public getLocale(): Locale {
    return this.locale;
  }

  public async setLocale(locale: Locale) {
    const needsTranslationLoad = locale !== DEFAULT_LOCALE && !this.translations[locale];
    if (this.locale === locale && !needsTranslationLoad) {
      return;
    }

    if (needsTranslationLoad) {
      try {
        const translation = await loadLazyLocaleTranslation(locale);
        if (!translation) {
          return;
        }
        this.translations[locale] = translation;
      } catch (e) {
        console.error(`Failed to load locale: ${locale}`, e);
        return;
      }
    }

    this.locale = locale;
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    localStorage.removeItem(LEGACY_LOCALE_STORAGE_KEY);
    this.notify();
  }

  public registerTranslation(locale: Locale, map: TranslationMap) {
    this.translations[locale] = map;
  }

  public subscribe(sub: Subscriber) {
    this.subscribers.add(sub);
    return () => this.subscribers.delete(sub);
  }

  private notify() {
    this.subscribers.forEach((sub) => sub(this.locale));
  }

  public t(key: string, params?: Record<string, string>): string {
    const keys = key.split(".");
    let value: unknown = this.translations[this.locale] || this.translations[DEFAULT_LOCALE];

    for (const k of keys) {
      if (value && typeof value === "object") {
        value = (value as Record<string, unknown>)[k];
      } else {
        value = undefined;
        break;
      }
    }

    // Fallback to English.
    if (value === undefined && this.locale !== DEFAULT_LOCALE) {
      value = this.translations[DEFAULT_LOCALE];
      for (const k of keys) {
        if (value && typeof value === "object") {
          value = (value as Record<string, unknown>)[k];
        } else {
          value = undefined;
          break;
        }
      }
    }

    if (typeof value !== "string") {
      return key;
    }

    if (params) {
      return value.replace(/\{(\w+)\}/g, (_, k) => params[k] || `{${k}}`);
    }

    return value;
  }
}

export const i18n = new I18nManager();
export const t = (key: string, params?: Record<string, string>) => i18n.t(key, params);
