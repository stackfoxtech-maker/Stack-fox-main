/**
 * FoxBot's brain on the server. The engine itself lives in shared/foxbot-engine.mjs, which the
 * website also runs in the browser, so replies are identical either way and cost no network
 * round trip there. This file only supplies the catalogue and the tier multipliers.
 *
 * `rootDir` is ./src, so the shared file is loaded at runtime rather than imported.
 */
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { TIER_MULTIPLIERS } from "./estimate";
import { readRawCatalogue } from "./catalogue";

export interface Link {
  label: string;
  to: string;
}
export interface Answer {
  intent: string;
  reply: string;
  suggestions: string[];
  links: Link[];
}

interface Engine {
  answerQuestion(message: string, ctx?: { page?: string }): Promise<Answer>;
  starterSuggestions(page?: string): string[];
  parseBudget(text: string): number | null;
  findServices(text: string): unknown[];
}

const dynamicImport = new Function("p", "return import(p)") as (p: string) => Promise<{
  createEngine(o: { data: unknown; tiers: unknown }): Engine;
}>;

let engine: Promise<Engine> | undefined;
const load = () =>
  (engine ??= dynamicImport(
    pathToFileURL(resolve(__dirname, "../../../../shared/foxbot-engine.mjs")).href,
  ).then((m) =>
    m.createEngine({ data: readRawCatalogue() ?? {}, tiers: TIER_MULTIPLIERS }),
  ));

export const answerQuestion = (message: string, ctx?: { page?: string }) =>
  load().then((e) => e.answerQuestion(message, ctx));
export const starterSuggestions = (page?: string) =>
  load().then((e) => e.starterSuggestions(page));
export const parseBudget = (text: string) => load().then((e) => e.parseBudget(text));
export const findServices = (text: string) => load().then((e) => e.findServices(text));
