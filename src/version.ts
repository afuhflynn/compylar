import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** Single release identity shared by every public Compylar surface. */
export const COMPYLAR_VERSION = (require("../package.json") as { version: string })
  .version;
