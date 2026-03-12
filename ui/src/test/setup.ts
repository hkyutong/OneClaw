import { beforeEach } from "vitest";

beforeEach(() => {
  if (typeof localStorage !== "undefined") {
    localStorage.clear();
    localStorage.setItem("oneclaw.i18n.locale", "en");
  }
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.clear();
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = "en";
    document.title = "OneClaw Control";
  }
});
