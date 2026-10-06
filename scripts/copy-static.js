import { cp, mkdir } from "node:fs/promises";

await mkdir("dist/src", { recursive: true });
await cp("src/viewport.js", "dist/src/viewport.js");
await cp("src/rules.js", "dist/src/rules.js");
await cp("src/four-lane-rules.js", "dist/src/four-lane-rules.js");
await cp("src/deckbuilding.js", "dist/src/deckbuilding.js");
await cp("src/deck-editor.js", "dist/src/deck-editor.js");
await cp("src/audio.js", "dist/src/audio.js");
await cp("src/game.js", "dist/src/game.js");
await cp("assets", "dist/assets", {
  recursive: true,
  filter: (source) => !source.endsWith(".new-art.webp"),
});
