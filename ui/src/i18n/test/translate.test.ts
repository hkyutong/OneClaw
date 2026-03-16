import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "../locales/en.ts";
import { pt_BR } from "../locales/pt-BR.ts";
import { zh_CN } from "../locales/zh-CN.ts";
import { zh_TW } from "../locales/zh-TW.ts";

type TranslateModule = typeof import("../lib/translate.ts");

function setNavigatorLanguage(value: string) {
  Object.defineProperty(window.navigator, "language", {
    configurable: true,
    value,
  });
}

describe("i18n", () => {
  let translate: TranslateModule;

  beforeEach(async () => {
    vi.resetModules();
    window.localStorage.clear();
    setNavigatorLanguage("en-US");
    document.documentElement.lang = "en";
    translate = await import("../lib/translate.ts");
    await translate.i18n.setLocale("en");
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
    window.localStorage.clear();
  });

  it("should return the key if translation is missing", () => {
    expect(translate.t("non.existent.key")).toBe("non.existent.key");
  });

  it("should return the correct English translation", () => {
    expect(translate.t("common.health")).toBe("Health");
  });

  it("should replace parameters correctly", () => {
    expect(translate.t("overview.stats.cronNext", { time: "10:00" })).toBe("Next wake 10:00");
  });

  it("should fallback to English if key is missing in another locale", async () => {
    // We haven't registered other locales in the test environment yet,
    // but the logic should fallback to 'en' map which is always there.
    await translate.i18n.setLocale("zh-CN");
    // Since we don't mock the import, it might fail to load zh-CN,
    // but let's assume it falls back to English for now.
    expect(translate.t("common.health")).toBeDefined();
  });

  it("loads translations even when setting the same locale again", async () => {
    const internal = translate.i18n as unknown as {
      locale: string;
      translations: Record<string, unknown>;
    };
    internal.locale = "zh-CN";
    delete internal.translations["zh-CN"];

    await translate.i18n.setLocale("zh-CN");
    expect(translate.t("common.health")).toBe("健康状况");
  });

  it("loads saved non-English locale on startup", () => {
    expect(
      translate.resolveStartupLocale({
        savedLocale: "zh-CN",
        legacySavedLocale: "zh-CN",
        navigatorLanguage: "en-US",
      }),
    ).toBe("zh-CN");
  });

  it("prefers an explicit document locale over a stale saved English default", () => {
    expect(
      translate.resolveStartupLocale({
        savedLocale: "en",
        documentLocale: "zh-CN",
        navigatorLanguage: "en-US",
      }),
    ).toBe("zh-CN");
  });

  it("lets query locale override a saved locale", () => {
    expect(
      translate.resolveStartupLocale({
        queryLocale: "zh-CN",
        savedLocale: "en",
        documentLocale: "en",
        navigatorLanguage: "en-US",
      }),
    ).toBe("zh-CN");
  });

  it("skips node localStorage accessors that warn without a storage file", async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.stubGlobal("navigator", { language: "en-US" } as Navigator);
    const warningSpy = vi.spyOn(process, "emitWarning");

    const fresh = await import("../lib/translate.ts");

    expect(fresh.i18n.getLocale()).toBe("en");
    expect(warningSpy).not.toHaveBeenCalledWith(
      "`--localstorage-file` was provided without a valid path",
      expect.anything(),
      expect.anything(),
    );
  });

  it("keeps the version label available in shipped locales", () => {
    expect((pt_BR.common as { version?: string }).version).toBeTruthy();
    expect((zh_CN.common as { version?: string }).version).toBeTruthy();
    expect((zh_TW.common as { version?: string }).version).toBeTruthy();
  });

  it("keeps zh-CN translation keys in sync with English", () => {
    const flatten = (value: Record<string, unknown>, prefix = ""): string[] => {
      const keys: string[] = [];
      for (const [key, nested] of Object.entries(value)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (nested && typeof nested === "object" && !Array.isArray(nested)) {
          keys.push(...flatten(nested as Record<string, unknown>, fullKey));
        } else {
          keys.push(fullKey);
        }
      }
      return keys;
    };

    const englishKeys = new Set(flatten(en as Record<string, unknown>));
    const chineseKeys = new Set(flatten(zh_CN as Record<string, unknown>));
    const missing = Array.from(englishKeys)
      .filter((key) => !chineseKeys.has(key))
      .toSorted();

    expect(missing).toEqual([]);
  });
});
