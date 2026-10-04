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
    const copy = new Element(this.tagName);
    copy.className = this.className;
    copy.attributes = { ...this.attributes };
    return copy;
  }
}

const childrenWith = (element, name) => element.children.filter(child => child.className.split(/\s+/).includes(name));

function fixture() {
  const card = new Element("button");
  card.className = "game-card element-ember uses-photographic-art";
  card.attributes = { "data-card-id": "original", "aria-label": "Peasant Bell", "aria-pressed": "false" };
  const context = { document: { createElement: tag => new Element(tag) }, card };
  const shreds = source.match(/const GUST_PAPER_SHREDS = Object\.freeze\(\[[\s\S]*?\n\]\);/)?.[0];
  assert.ok(shreds);
  runInNewContext([
    shreds,
    sourceFunction("createCinematicCardCopy"),
    sourceFunction("createGustDefeatEffect"),
    sourceFunction("createDefeatEffect"),
  ].join("\n"), context);
  return context;
}

test("Gust tears eight actual card regions with paper edges and twelve bounded dust flecks", () => {
  const { card, createGustDefeatEffect } = fixture();
  const effect = createGustDefeatEffect(card);
  assert.equal(effect.className, "defeat-effect defeat-gust");
  assert.equal(effect.attributes["aria-hidden"], "true");
  assert.equal(childrenWith(effect, "gust-paper-shred").length, 8);
  assert.equal(childrenWith(effect, "gust-paper-bed").length, 1);
  assert.equal(childrenWith(effect, "gust-windfield").length, 1);
  assert.equal(childrenWith(effect, "gust-paper-dust")[0].children.length, 12);
  assert.equal((childrenWith(effect, "gust-windfield")[0].innerHTML.match(/class="gust-wind-band"/g) || []).length, 4);
  assert.equal(card.children.length, 0);
  assert.equal(card.attributes["data-card-id"], "original");
});

test("Gust regions cover the card exactly once, without duplicating any artwork", () => {
  const { card, createGustDefeatEffect } = fixture();
  const polygons = childrenWith(createGustDefeatEffect(card), "gust-paper-shred").map(shred =>
    shred.properties["--shred-clip"].slice(8, -1).split(",").map(point => point.trim().split(/\s+/).map(parseFloat)));
  const contains = (polygon, x, y) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  for (let x = .321; x < 100; x += 1) {
    for (let y = .789; y < 100; y += 1) {
      assert.equal(polygons.filter(polygon => contains(polygon, x, y)).length, 1, `Coverage at ${x},${y}`);
    }
  }
});

test("Gust copies preserve photographic artwork and are decorative, not playable cards", () => {
  const { card, createGustDefeatEffect } = fixture();
  for (const shred of childrenWith(createGustDefeatEffect(card), "gust-paper-shred")) {
    assert.equal(childrenWith(shred, "gust-paper-fibre").length, 1);
    const copy = childrenWith(shred, "gust-paper-face")[0];
    assert.match(copy.className, /uses-photographic-art/);
    assert.equal(copy.disabled, true);
    assert.equal(copy.attributes.tabindex, "-1");
    assert.equal(copy.attributes["aria-hidden"], "true");
    for (const name of ["data-card-id", "aria-label", "aria-pressed"]) assert.equal(copy.attributes[name], undefined);
    for (const name of ["--tear-x", "--tear-y", "--orbit-x", "--orbit-y", "--shred-x", "--shred-y"]) {
      assert.match(shred.properties[name], /%$/);
    }
  }
});

test("Gust aftermath restores only small settled scraps, without replaying wind or particles", () => {
  const { card, createGustDefeatEffect } = fixture();
  const effect = createGustDefeatEffect(card, { aftermath: true });
  assert.match(effect.className, /aftermath-remains/);
  assert.equal(effect.children.length, 9);
  assert.equal(childrenWith(effect, "gust-paper-shred").length, 8);
  for (const name of ["gust-windfield", "gust-paper-dust"]) assert.equal(childrenWith(effect, name).length, 0);
  assert.match(styles, /\.defeat-gust\.aftermath-remains \.gust-paper-shred \{\s*animation: none;/);
  assert.match(styles, /\.defeat-gust\.aftermath-remains \.gust-paper-bed \{\s*animation: none;/);
  assert.match(styles, /\.defeat-gust\.aftermath-remains \.gust-paper-face::after \{\s*animation: none;/);
});

test("Gust dispatch affects only its losing lane and safely ignores empty/unknown targets", () => {
  const context = fixture();
  const lane = new Element();
  lane.querySelector = () => context.card;
  const effect = context.createDefeatEffect(lane, "gust");
  assert.equal(lane.children[0], effect);
  assert.match(lane.className, /cinematic-defeat defeated-by-gust/);
  assert.equal(childrenWith(effect, "gust-paper-shred").length, 8);
  assert.equal(context.createDefeatEffect(lane, "unknown"), null);
  assert.equal(lane.children.length, 1);
  lane.querySelector = () => null;
  assert.equal(context.createDefeatEffect(lane, "gust"), null);
});

test("Gust replaces glowing rings/overlapping cutouts and prevents a ghost of the intact card", () => {
  assert.doesNotMatch(`${source}\n${styles}`, /tornado-vortex|tornado-fragment|cinematic-vortex-spin|cinematic-wind-slash|cinematic-tornado-debris/);
  assert.match(styles, /\.clash-card\.defeated-by-gust > \.game-card \{\s*animation: none;\s*opacity: 0;/);
  assert.match(styles, /\.clash-card \.defeat-gust \.gust-paper-face \{[\s\S]*?filter: none;\s*animation: none;/);
  assert.match(styles, /\.defeat-gust \.card-bonus-badge \{\s*visibility: hidden;\s*animation: none;/);
  assert.match(styles, /@keyframes gust-paper-tear[\s\S]*?rotateY\(-14deg\)[\s\S]*?92%, 100%/);
});

test("Gust settles within existing clash timing and preserves audio/Classic/reduced-motion behavior", () => {
  assert.match(styles, /animation: gust-paper-tear 1\.4s linear both;/);
  assert.match(styles, /animation: gust-wind-curl \.55s ease-in-out 2 alternate both;/);
  assert.match(styles, /animation: gust-dust-orbit \.98s/);
  const animate = source.slice(source.indexOf("async function animateClashes("), source.indexOf("\nfunction playRound("));
  assert.match(animate, /const pauseDuration = reducedMotion \? 30 : cinematic \? 1450 : 180;/);
  assert.match(animate, /const cinematic = state\.clashStyle === "cinematic" && !reducedMotion;/);
  assert.match(animate, /audio\.cardDestruction\(winningCard\.element, destructionPan\);/);
});
