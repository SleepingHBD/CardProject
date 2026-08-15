import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pageSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const styleSource = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const chronicleSource = readFileSync(new URL("../src/chronicle.js", import.meta.url), "utf8");

test("the main menu opens a dedicated illustrated World Chronicle", () => {
  assert.match(pageSource, /id="mainMenuChronicleButton"[\s\S]*?aria-controls="worldChronicleScreen"/);
  assert.match(pageSource, /id="worldChronicleScreen"[\s\S]*?role="dialog"[\s\S]*?aria-modal="true"/);
  assert.match(pageSource, /<script defer src="\.\/src\/chronicle\.js"><\/script>/);
  assert.equal((pageSource.match(/data-chronicle-page/g) || []).length, 10);
  assert.match(pageSource, /The Threefold Realm/);
  assert.match(pageSource, /Hearthmarch/);
  assert.match(pageSource, /Galecrest/);
  assert.match(pageSource, /Moonmere/);
  assert.doesNotMatch(pageSource, /Oathcard/i);
});

test("the Severed Years explains every stage of the war in chronological order", () => {
  const firstCrossing = pageSource.indexOf("The First Crossing");
  const ashenRains = pageSource.indexOf("The Ashen Rains");
  const bannerlessMeeting = pageSource.indexOf("The Bannerless Meeting");
  const accord = pageSource.indexOf("The Accord", bannerlessMeeting);

  assert.ok(firstCrossing >= 0);
  assert.ok(ashenRains > firstCrossing);
  assert.ok(bannerlessMeeting > ashenRains);
  assert.ok(accord > bannerlessMeeting);
  assert.match(pageSource, /data-chronicle-target="7"[\s\S]*?The Severed Years/);
  assert.match(pageSource, /How the war began/);
  assert.match(pageSource, /How the war harmed everyone/);
  assert.match(pageSource, /How peace began/);
  assert.match(pageSource, /How the war ended/);
  assert.match(pageSource, /Entry 1 of 10/);
});

test("chronicle artwork reuses established inhabitants and includes an accessible map", () => {
  assert.match(pageSource, /assets\/cards\/comet-claw\.webp/);
  assert.match(pageSource, /assets\/cards\/sir-squall\.webp/);
  assert.match(pageSource, /assets\/cards\/empress-ebb\.webp/);
  assert.match(pageSource, /assets\/characters\/professor-paws\.webp/);
  assert.match(pageSource, /aria-labelledby="feldenMapTitle feldenMapDescription"/);
  assert.match(pageSource, /<title id="feldenMapTitle">Map of Felden<\/title>/);
});

test("chronicle navigation supports persistence, keyboard reading, and focus return", () => {
  assert.match(chronicleSource, /projectProwl\.chroniclePage/);
  assert.match(chronicleSource, /window\.localStorage\.setItem\(STORAGE_KEY, String\(currentPage\)\)/);
  assert.match(chronicleSource, /event\.key === "ArrowLeft"/);
  assert.match(chronicleSource, /event\.key === "ArrowRight"/);
  assert.match(chronicleSource, /event\.key === "Escape"/);
  assert.match(chronicleSource, /mainMenu\.inert = true/);
  assert.match(chronicleSource, /returnFocusTarget\?\.focus\(\)/);
  assert.match(chronicleSource, /function focusableControls\(\)/);
});

test("chronicle layout becomes a readable single-column volume on narrow screens", () => {
  assert.match(styleSource, /\.chronicle-screen \{[\s\S]*?height: var\(--app-viewport-height, 100dvh\)/);
  assert.match(styleSource, /\.chronicle-spread \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(
    styleSource,
    /@media \(max-width: 760px\), \(orientation: portrait\)[\s\S]*?\.chronicle-spread \{\s*display: block;/,
  );
  assert.match(styleSource, /@media \(orientation: landscape\) and \(max-width: 1024px\) and \(max-height: 600px\)/);
});
