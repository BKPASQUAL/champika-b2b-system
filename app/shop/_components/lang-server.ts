import { cookies } from "next/headers";
import { LANG_COOKIE, makeT, type Lang, type T } from "./i18n";

/** The language the customer picked (English by default). Server components only. */
export async function getLang(): Promise<Lang> {
  const jar = await cookies();
  return jar.get(LANG_COOKIE)?.value === "si" ? "si" : "en";
}

/** Translator for server components: const t = await getT(); t("Home"). */
export async function getT(): Promise<T> {
  return makeT(await getLang());
}
