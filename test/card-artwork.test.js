import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { runInNewContext } from "node:vm";

const pageSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const gameSource = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const styleSource = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const teapotPhoto = new URL(
  "../assets/cards/photographic/teapot-tabby-bell.jpg",
  import.meta.url,
);
const cinderPhoto = new URL(
  "../assets/cards/photographic/cinder-shiopan.png",
  import.meta.url,
);

test("Riptide Rook replaces the Water Epic Vanguard without changing its library slot", () => {
  const libraryDeclaration = gameSource.match(
    /const CARD_LIBRARY = \[[\s\S]*?\}\)\);/,
  )?.[0];
  assert.ok(libraryDeclaration, "the mapped card library should be declared");
  const cards = JSON.parse(runInNewContext(
    `${libraryDeclaration}\nJSON.stringify(CARD_LIBRARY)`,
  ));

  assert.equal(cards.length, 24);
  assert.deepEqual(cards[16], {
    id: "card-16",
    element: "tide",
    power: 8,
    name: "Riptide Rook",
    move: "Anchorbreaker",
    lore: "Small paws. Heavy anchor.",
    rarity: "epic",
    tactic: "vanguard",
    art: "riptide-rook",
  });
  assert.equal(cards.filter((card) => card.art === "riptide-rook").length, 1);
  assert.doesNotMatch(
    `${pageSource}\n${gameSource}\n${styleSource}`,
    /Puddle Pouncer|puddle-pouncer|Splash Ambush|Dry socks are overrated\./i,
  );
});

test("photographic artwork settings are temporarily hidden, not deleted", () => {
  assert.match(gameSource, /const PHOTOGRAPHIC_ARTWORK_ENABLED = false;/);
  assert.match(pageSource, /id="artworkSettingsTab"\s+hidden/);
  assert.match(pageSource, /name="artworkStyle" value="illustrated"/);
  assert.match(pageSource, /name="artworkStyle" value="photographic"/);
  assert.match(gameSource, /projectProwl\.artworkStyle/);
  assert.match(gameSource, /saveArtworkStyle\(state\.artworkStyle\)/);
  assert.match(styleSource, /\.settings-tab\[hidden\],[\s\S]*?display: none/);
  assert.match(styleSource, /repeat\(auto-fit, minmax\(120px, 1fr\)\)/);
  assert.doesNotMatch(pageSource, /Adjust the duel’s board, artwork/);
});

function artworkFixture(savedStyle, enabled = false, storageBlocked = false) {
  const storage = new Map([["projectProwl.artworkStyle", savedStyle]]);
  const context = {
    PHOTOGRAPHIC_ARTWORK_ENABLED: enabled,
    state: { artworkStyle: savedStyle },
    CARD_LIBRARY: [
      { art: "teapot-tabby", name: "Teapot Tabby" },
      { art: "cinder-kit", name: "Cinder Kit" },
    ],
    window: {
      localStorage: {
        getItem(key) {
          if (storageBlocked) throw new Error("Storage is unavailable");
          return storage.get(key) ?? null;
        },
        setItem(key, value) {
          if (storageBlocked) throw new Error("Storage is unavailable");
          storage.set(key, value);
        },
      },
    },
  };
  const declarations = ["ARTWORK_STYLES", "ARTWORK_STYLE_STORAGE_KEY", "PHOTOGRAPHIC_CARD_ART", "PHOTOGRAPHIC_CARD_NAMES"]
    .map((name) => gameSource.match(new RegExp(`const ${name} = [\\s\\S]*?;`))?.[0]);
  const functions = ["readSavedArtworkStyle", "saveArtworkStyle", "cardUsesPhotographicArtwork", "cardDisplayName", "artworkAdjustedCopy", "cardArtworkSource", "renderArtworkSettings", "showSettingsPanel"]
    .map((name) => gameSource.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}`))?.[0]);
  assert.ok([...declarations, ...functions].every(Boolean));
  runInNewContext([...declarations, ...functions].join("\n"), context);
  return { context, storage };
}

test("fresh and returning photographic preferences resolve and save as illustrated", () => {
  for (const savedStyle of [null, "illustrated", "photographic", "unknown"]) {
    const { context, storage } = artworkFixture(savedStyle);
    assert.equal(context.readSavedArtworkStyle(), "illustrated");
    assert.equal(context.saveArtworkStyle(savedStyle), true);
    assert.equal(storage.get("projectProwl.artworkStyle"), "illustrated");
  }
  const blocked = artworkFixture("photographic", false, true).context;
  assert.equal(blocked.readSavedArtworkStyle(), "illustrated");
  assert.equal(blocked.saveArtworkStyle("illustrated"), false);
  const future = artworkFixture("photographic", true).context;
  assert.equal(future.readSavedArtworkStyle(), "photographic", "the preserved mode can be re-enabled later");
});

test("disabled photographic mode cannot replace artwork, names, or tutorial copy", () => {
  const { context } = artworkFixture("photographic");
  for (const card of context.CARD_LIBRARY) {
    assert.equal(context.cardUsesPhotographicArtwork(card.art), false);
    assert.equal(context.cardDisplayName(card), card.name);
    assert.equal(context.cardArtworkSource(card.art), `./assets/cards/${card.art}.webp`);
  }
  assert.equal(context.artworkAdjustedCopy("Commit Teapot Tabby, then Cinder Kit."), "Commit Teapot Tabby, then Cinder Kit.");
});

test("rendering settings normalizes stale state and disables the hidden artwork controls", () => {
  const { context } = artworkFixture("photographic");
  const options = ["illustrated", "photographic"].map((value) => ({ value }));
  context.ui = { artworkSettingsTab: {}, artworkSettingsStatus: {} };
  context.document = { querySelectorAll: () => options };
  context.updateDisplayedCardArtwork = () => {};
  context.renderGallery = () => {};
  context.renderPreviousRoundsHistory = () => {};
  context.tutorial = { active: false };
  context.renderArtworkSettings();
  assert.equal(context.state.artworkStyle, "illustrated");
  assert.equal(context.ui.artworkSettingsTab.hidden, true);
  assert.ok(options.every((option) => option.disabled));
  assert.equal(options[0].checked, true);
  assert.equal(options[1].checked, false);
});

test("hidden artwork panel cannot displace the available audio, board, or clash panels", () => {
  const { context } = artworkFixture("illustrated");
  const panels = ["audio", "artwork", "board", "clash"];
  context.ui = {
    settingsTabs: panels.map((name) => ({
      dataset: { settingsPanel: name }, hidden: name === "artwork",
      classList: { toggle() {} }, setAttribute() {},
    })),
    settingsPanels: panels.map((name) => ({ id: `${name}SettingsPanel` })),
  };
  for (const requested of ["artwork", "missing", "audio", "board", "clash"]) {
    context.showSettingsPanel(requested);
    const active = context.ui.settingsPanels.filter((panel) => !panel.hidden);
    assert.equal(active.length, 1);
    assert.equal(active[0].id, `${["artwork", "missing"].includes(requested) ? "audio" : requested}SettingsPanel`);
  }
});

test("Teapot Tabby's preserved photograph retains illustrated fallback support", () => {
  assert.ok(statSync(teapotPhoto).size > 100_000);
  assert.match(
    gameSource,
    /"teapot-tabby": "\.\/assets\/cards\/photographic\/teapot-tabby-bell\.jpg"/,
  );
  assert.match(gameSource, /PHOTOGRAPHIC_CARD_ART\[cardArt\]/);
  assert.match(gameSource, /`\.\/assets\/cards\/\$\{cardArt\}\.webp`/);
  assert.match(styleSource, /\.art-teapot-tabby\.uses-photographic-art \.card-art img/);
  assert.match(styleSource, /transform: translateX\(15%\)/);
});

test("Bell's photographic card uses its mode-specific character name", () => {
  assert.match(
    gameSource,
    /const PHOTOGRAPHIC_CARD_NAMES = Object\.freeze\(\{[\s\S]*?"teapot-tabby": "Peasant Bell"/,
  );
  assert.match(gameSource, /function cardDisplayName\(card\)/);
  assert.match(gameSource, /PHOTOGRAPHIC_CARD_NAMES\[card\.art\] \|\| card\.name/);
  assert.match(gameSource, /<strong>\$\{displayName\}<\/strong>/);
  assert.match(gameSource, /cardDisplayName\(a\)\.localeCompare\(cardDisplayName\(b\)\)/);
});

test("Cinder Kit uses Shiopan's photographic portrait and name", () => {
  assert.ok(statSync(cinderPhoto).size > 1_000_000);
  assert.match(
    gameSource,
    /"cinder-kit": "\.\/assets\/cards\/photographic\/cinder-shiopan\.png"/,
  );
  assert.match(gameSource, /"cinder-kit": "Cinder Shiopan"/);
  assert.match(styleSource, /\.art-cinder-kit\.uses-photographic-art \.card-art img/);
  assert.match(styleSource, /object-position: center top/);
});

test("Shiopan's cleaned cutout retains its original dimensions and alpha channel", () => {
  const png = readFileSync(cinderPhoto);
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(png.toString("ascii", 12, 16), "IHDR");
  assert.equal(png.readUInt32BE(16), 1086);
  assert.equal(png.readUInt32BE(20), 1448);
  assert.equal(png[25], 6, "the portrait must remain an RGBA PNG, not an opaque background");
});

test("all photographic cards use one complete foreground frame", () => {
  assert.match(
    styleSource,
    /\.game-card\.uses-photographic-art \.card-art \{[\s\S]*?box-shadow: none/,
  );
  assert.match(
    styleSource,
    /\.game-card\.uses-photographic-art \.card-art::after[\s\S]*?inset: 0;[\s\S]*?border: 1px solid #d0aa59/,
  );
  assert.match(
    styleSource,
    /\.game-card\.uses-photographic-art \.art-vignette \{[\s\S]*?box-shadow: none/,
  );
  assert.doesNotMatch(styleSource, /\.art-teapot-tabby\.uses-photographic-art \.card-art::after/);
});
