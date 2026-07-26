import { cp, mkdir } from "node:fs/promises";

await mkdir("dist/src", { recursive: true });
await cp("src/rules.js", "dist/src/rules.js");
await cp("src/audio.js", "dist/src/audio.js");
await cp("src/game.js", "dist/src/game.js");
await cp("assets", "dist/assets", { recursive: true });
