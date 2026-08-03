import type { ScriptPreference, ScrippetPluginSettings } from "./types";

export function shouldConfirmFirstRun(
  settings: Pick<ScrippetPluginSettings, "confirmBeforeFirstRun">,
  prefs: ScriptPreference,
  trusted: boolean,
): boolean {
  return settings.confirmBeforeFirstRun && !prefs.hasRun && !trusted;
}

export function shouldConfirmStartupApproval(prefs: ScriptPreference, trusted: boolean): boolean {
  return prefs.startupApproved !== true && !trusted;
}
