import { cp, mkdir } from "node:fs/promises";

await mkdir("dist/src", { recursive: true });
await cp("src/rules.js", "dist/src/rules.js");
await cp("src/audio.js", "dist/src/audio.js");
await cp("src/game.js", "dist/src/game.js");
await cp("src/expedition-rules.js", "dist/src/expedition-rules.js");
await cp("src/expedition.js", "dist/src/expedition.js");
await cp("expedition.html", "dist/expedition.html");
await cp("expedition.css", "dist/expedition.css");
await cp("assets", "dist/assets", {
  recursive: true,
  filter: (source) => !source.endsWith(".new-art.webp"),
});
