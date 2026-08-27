// Must be the first import in server.ts (and nothing else before it in that
// file) — esbuild/tsx hoists all `import` statements above interspersed code,
// so a bare `config()` call interleaved between imports in server.ts runs
// AFTER every transitively-imported module has already evaluated, silently
// leaving their module-level `process.env.X` reads undefined. Import order
// between import statements themselves is preserved, so putting the dotenv
// load in its own module and importing it first guarantees it runs first.
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../../../.env") });
