import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

function sourceFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1);
  return source.slice(start, source.indexOf("\n}", start) + 2);
}

class Element {
  constructor(tagName = "span") {
    this.tagName = tagName;
    this.children = [];
    this.attributes = {};
    this.properties = {};
    this.className = "";
    this.style = { setProperty: (name, value) => { this.properties[name] = value; } };
    this.classList = { add: (...names) => { this.className += ` ${names.join(" ")}`; } };
  }
  append(...children) { this.children.push(...children); }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  cloneNode() {
    const clone = new Element(this.tagName);
    clone.className = this.className;
    clone.attributes = { ...this.attributes };
    return clone;
  }
}

function fixture() {
  const card = new Element("button");
  card.className = "game-card element-ember";
  card.attributes = { "data-card-id": "original", "aria-label": "Teapot Tabby" };
  const context = {
    document: { createElement: (tagName) => new Element(tagName) },
    card,
  };
  const declarations = source.match(/const WATER_PAPER_FOLDS = Object\.freeze\(\[[\s\S]*?\n\]\);/)?.[0];
  assert.ok(declarations);
  runInNewContext([
    declarations,
    sourceFunction("createCinematicCardCopy"),
    sourceFunction("createWaterDefeatEffect"),
    sourceFunction("createDefeatEffect"),
  ].join("\n"), context);
  return context;
}

const childrenWith = (effect, name) => effect.children.filter(child => child.className.split(/\s+/).includes(name));

test("Water buckles six card regions and uses a bounded twelve-droplet splash", () => {
  const context = fixture();
  const effect = context.createWaterDefeatEffect(context.card);
  assert.equal(effect.className, "defeat-effect defeat-tide");
  assert.equal(effect.attributes["aria-hidden"], "true");
  assert.equal(childrenWith(effect, "water-paper-fold").length, 6);
  assert.equal(childrenWith(effect, "water-soaking-card").length, 1);
  assert.equal(childrenWith(effect, "water-running-ink").length, 1);
  assert.equal(childrenWith(effect, "water-surge").length, 1);
  assert.match(childrenWith(effect, "water-surge")[0].innerHTML, /class="water-breaking-crest"/);
  assert.equal(childrenWith(effect, "water-drench-sheet").length, 1);
  assert.equal(childrenWith(effect, "water-impact-splash").length, 1);
  assert.equal(childrenWith(effect, "water-pulp-body").length, 1);
  assert.equal(childrenWith(effect, "water-puddle").length, 1);
  assert.equal(childrenWith(effect, "water-droplets")[0].children.length, 12);
  assert.equal(childrenWith(effect, "defeat-particles").length, 0);
  for (const fold of childrenWith(effect, "water-paper-fold")) {
    assert.match(fold.properties["--fold-clip"], /^polygon\(/);
    assert.match(fold.properties["--fold-y"], /%$/);
    assert.match(fold.properties["--fold-angle"], /deg$/);
    assert.equal(fold.disabled, true);
    assert.equal(fold.attributes.tabindex, "-1");
    assert.equal(fold.attributes["data-card-id"], undefined);
    assert.equal(fold.attributes["aria-label"], undefined);
  }
  assert.equal(context.card.attributes["data-card-id"], "original");
  assert.equal(context.card.children.length, 0);
});

test("Water aftermath contains settled paper without recreating transient splash effects", () => {
  const context = fixture();
  const effect = context.createWaterDefeatEffect(context.card, { aftermath: true });
  assert.match(effect.className, /aftermath-remains/);
  assert.equal(effect.children.length, 8);
  for (const name of ["water-soaking-card", "water-running-ink", "water-surge", "water-drench-sheet", "water-impact-splash", "water-droplets"]) {
    assert.equal(childrenWith(effect, name).length, 0);
  }
  assert.equal(childrenWith(effect, "water-paper-fold").length, 6);
  assert.match(styles, /\.defeat-tide\.aftermath-remains \.water-paper-fold \{\s*animation: none;/);
  assert.match(styles, /\.defeat-tide\.aftermath-remains \.water-pulp-body \{\s*animation: none;/);
  assert.match(styles, /\.defeat-tide\.aftermath-remains \.water-puddle \{\s*animation: none;/);
});

test("Water dispatch marks only its losing lane and returns its cleanup container", () => {
  const context = fixture();
  const lane = new Element();
  lane.querySelector = () => context.card;
  const effect = context.createDefeatEffect(lane, "tide");
  assert.match(lane.className, /cinematic-defeat defeated-by-tide/);
  assert.equal(lane.children[0], effect);
  assert.equal(childrenWith(effect, "water-paper-fold").length, 6);
  lane.querySelector = () => null;
  assert.equal(context.createDefeatEffect(lane, "tide"), null);
});

test("Water folds override card-entry animations and hide the intact losing card", () => {
  assert.match(styles, /\.defeat-tide \.water-paper-fold \{[\s\S]*?animation: water-paper-crumple 1\.4s/);
  assert.match(styles, /\.defeat-tide \.water-soaking-card \{[\s\S]*?animation: water-paper-soak 1\.4s/);
  assert.match(styles, /\.clash-card\.defeated-by-tide > \.game-card \{\s*animation: none;\s*opacity: 0;/);
  assert.doesNotMatch(`${source}\n${styles}`, /tide-water-sheet|tide-pulp-remains|cinematic-card-soak|cinematic-droplet-fall/);
});

test("Water finishes within the unchanged lane timing; Classic and reduced motion bypass destruction", () => {
  const animate = source.slice(source.indexOf("async function animateClashes("), source.indexOf("\nfunction playRound("));
  assert.match(animate, /const cinematic = state\.clashStyle === "cinematic" && !reducedMotion;/);
  assert.match(animate, /const pauseDuration = reducedMotion \? 30 : cinematic \? 1450 : 180;/);
  assert.match(animate, /if \(cinematic && winner !== "draw"\)/);
  assert.match(animate, /audio\.cardDestruction\(winningCard\.element, destructionPan\);/);
  assert.match(styles, /@keyframes water-paper-crumple[\s\S]*?76%, 100%/);
  const { card, createWaterDefeatEffect } = fixture();
  for (const droplet of childrenWith(createWaterDefeatEffect(card), "water-droplets")[0].children) {
    assert.ok(parseFloat(droplet.properties["--drop-delay"]) + 700 <= 1400);
  }
});

test("Water has a forceful crest/splash, early card buckling, and an ink-bleed layer", () => {
  assert.match(styles, /@keyframes water-surge-break[\s\S]*?17% \{ opacity: 1;/);
  assert.match(styles, /@keyframes water-impact-fan[\s\S]*?27% \{ opacity: 1;/);
  assert.match(styles, /@keyframes water-crest-overturn[\s\S]*?30%[\s\S]*?rotate\(20deg\)[\s\S]*?44%[\s\S]*?rotate\(35deg\)/);
  assert.match(styles, /@keyframes water-sheet-pour[\s\S]*?19% \{ opacity: \.88;/);
  assert.match(styles, /@keyframes water-paper-soak[\s\S]*?14%[\s\S]*?rotateY\(24deg\)/);
  assert.match(styles, /@keyframes water-paper-crumple[\s\S]*?42%[\s\S]*?rotateX\(28deg\)[\s\S]*?58%[\s\S]*?rotateX\(55deg\)/);
  assert.match(styles, /\.clash-card \.defeat-tide \.water-running-ink \{[\s\S]*?blur\(\.9cqw\)[\s\S]*?animation: water-ink-run 1\.4s/);
  assert.match(styles, /\.defeat-tide \.card-bonus-badge \{ visibility: hidden; animation: none; \}/);
  assert.match(styles, /\.water-running-ink \{[\s\S]*?background: transparent;\s*border-color: transparent;/);
  assert.match(styles, /\.water-running-ink::before,[\s\S]*?content: none;/);
  assert.match(styles, /\.water-running-ink \.card-art > :not\(img\) \{\s*visibility: hidden;/);
});

test("Water ink copies retain the card's artwork but cannot be played or focused", () => {
  const { card, createWaterDefeatEffect } = fixture();
  card.className += " uses-photographic-art";
  const copies = createWaterDefeatEffect(card).children.filter(child => child.tagName === "button");
  assert.equal(copies.length, 8);
  for (const copy of copies) {
    assert.match(copy.className, /uses-photographic-art/);
    assert.equal(copy.disabled, true);
    assert.equal(copy.attributes["aria-hidden"], "true");
    assert.equal(copy.attributes.tabindex, "-1");
    assert.equal(copy.attributes["data-card-id"], undefined);
  }
});

test("production packaging copies every deferred game script, including viewport sizing", () => {
  const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const copy = readFileSync(new URL("../scripts/copy-static.js", import.meta.url), "utf8");
  for (const [, script] of page.matchAll(/<script defer src="\.\/([^\"]+)"/g)) {
    assert.ok(copy.includes(`cp("${script}", "dist/${script}")`), `${script} must exist in the production build`);
  }
});
