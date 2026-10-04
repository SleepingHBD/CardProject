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

const childrenWith = (effect, name) => effect.children.filter(child => child.className.split(/\s+/).includes(name));

function fixture() {
  const card = new Element("button");
  card.className = "game-card element-tide";
  card.attributes = { "data-card-id": "original", "aria-label": "Peasant Bell", "aria-pressed": "false" };
  const context = { document: { createElement: (tag) => new Element(tag) }, card };
  const fragments = source.match(/const FIRE_CHAR_FRAGMENTS = Object\.freeze\(\[[\s\S]*?\n\]\);/)?.[0];
  assert.ok(fragments);
  runInNewContext([
    fragments,
    sourceFunction("createCinematicCardCopy"),
    sourceFunction("createFireDefeatEffect"),
    sourceFunction("createDefeatEffect"),
  ].join("\n"), context);
  return context;
}

test("Fire consumes the actual card with separate face and char layers, not a full-card flame overlay", () => {
  const { card, createFireDefeatEffect } = fixture();
  const effect = createFireDefeatEffect(card);
  assert.equal(effect.className, "defeat-effect defeat-ember");
  assert.equal(effect.attributes["aria-hidden"], "true");
  assert.equal(childrenWith(effect, "fire-paper-face").length, 1);
  assert.equal(childrenWith(effect, "fire-paper-char").length, 1);
  assert.equal(childrenWith(effect, "fire-char-fragment").length, 3);
  assert.equal(childrenWith(effect, "fire-burn-front")[0].children.length, 4);
  assert.equal(childrenWith(effect, "fire-flame-envelope")[0].children.length, 5);
  assert.equal(childrenWith(effect, "fire-contact-heat").length, 1);
  assert.equal(childrenWith(effect, "fire-smoke")[0].children.length, 3);
  const debris = childrenWith(effect, "fire-debris")[0];
  assert.equal(childrenWith(debris, "fire-spark").length, 7);
  assert.equal(childrenWith(debris, "fire-ash").length, 9);
  assert.equal(childrenWith(effect, "defeat-particles").length, 0);
  assert.equal(card.children.length, 0);
  assert.equal(card.attributes["data-card-id"], "original");
});

test("Fire copies are decorative, noninteractive, and sized relative to their lane", () => {
  const { card, createFireDefeatEffect } = fixture();
  const effect = createFireDefeatEffect(card);
  const copies = effect.children.filter(child => child.tagName === "button");
  assert.equal(copies.length, 5);
  for (const copy of copies) {
    assert.equal(copy.disabled, true);
    assert.equal(copy.attributes.tabindex, "-1");
    assert.equal(copy.attributes["aria-hidden"], "true");
    assert.equal(copy.attributes["data-card-id"], undefined);
    assert.equal(copy.attributes["aria-label"], undefined);
    assert.equal(copy.attributes["aria-pressed"], undefined);
  }
  for (const fragment of childrenWith(effect, "fire-char-fragment")) {
    assert.match(fragment.properties["--char-clip"], /^polygon\(/);
    assert.match(fragment.properties["--char-y"], /%$/);
  }
});

test("Fire aftermath retains only three small charred fragments and ashes", () => {
  const { card, createFireDefeatEffect } = fixture();
  const effect = createFireDefeatEffect(card, { aftermath: true });
  assert.match(effect.className, /aftermath-remains/);
  assert.equal(effect.children.length, 4);
  assert.equal(childrenWith(effect, "fire-char-fragment").length, 3);
  assert.equal(childrenWith(effect, "fire-ash-bed").length, 1);
  for (const name of ["fire-paper-face", "fire-paper-char", "fire-burn-front", "fire-flame-envelope", "fire-contact-heat", "fire-smoke", "fire-debris"]) {
    assert.equal(childrenWith(effect, name).length, 0);
  }
  assert.match(styles, /\.defeat-ember\.aftermath-remains \.fire-char-fragment \{\s*animation: none;/);
  assert.match(styles, /\.defeat-ember\.aftermath-remains \.fire-ash-bed \{\s*animation: none;/);
  assert.match(styles, /\.defeat-ember \.card-bonus-badge \{\s*visibility: hidden;\s*animation: none;/);
});

test("Fire dispatch attaches the effect only to its losing lane, with empty-lane safety", () => {
  const context = fixture();
  const lane = new Element();
  lane.querySelector = () => context.card;
  const effect = context.createDefeatEffect(lane, "ember");
  assert.equal(lane.children[0], effect);
  assert.match(lane.className, /cinematic-defeat defeated-by-ember/);
  assert.equal(childrenWith(effect, "fire-paper-face").length, 1);
  lane.querySelector = () => null;
  assert.equal(context.createDefeatEffect(lane, "ember"), null);
});

test("Fire replaces legacy rings and full rectangular husks with progressive clipped and masked paper", () => {
  assert.doesNotMatch(`${source}\n${styles}`, /ember-burning-card|ember-charred-remains|ember-heat-wave|cinematic-card-burn|cinematic-charred-husk|cinematic-flame-rise/);
  assert.match(styles, /@property --fire-hole-size \{\s*syntax: "<percentage>";/);
  assert.match(styles, /mask-composite: intersect;/);
  assert.match(styles, /-webkit-mask-composite: source-in;/);
  assert.match(styles, /\.clash-card\.defeated-by-ember > \.game-card \{\s*animation: none;\s*opacity: 0;/);
  assert.match(styles, /@keyframes fire-paper-consume[\s\S]*?100% \{ --fire-hole-size: 40%; opacity: 0;/);
  assert.match(styles, /\.defeat-ember \.fire-paper-face \{\s*z-index: 10;\s*animation: fire-paper-consume 1\.4s/);
  assert.match(styles, /\.clash-card \.defeat-ember \.fire-char-fragment \{[\s\S]*?brightness\(\.16\)/);
  assert.match(styles, /\.clash-card \.defeat-ember \.fire-paper-char \{[\s\S]*?brightness\(\.3\)/);
});

test("Fire animations have finite lifetimes and keep existing clash timing and audio dispatch", () => {
  assert.match(styles, /animation: fire-tongue-curl var\(--flame-cycle\) ease-in-out 5 alternate both;/);
  assert.match(styles, /animation: fire-fleck-rise \.58s/);
  const { card, createFireDefeatEffect } = fixture();
  const effect = createFireDefeatEffect(card);
  for (const bank of ["fire-burn-front", "fire-flame-envelope"]) {
    for (const flame of childrenWith(effect, bank)[0].children) {
      assert.ok(parseFloat(flame.properties["--flame-cycle"]) * 5 <= 1400);
    }
  }
  for (const wisp of childrenWith(effect, "fire-smoke")[0].children) {
    assert.ok(parseFloat(wisp.properties["--smoke-delay"]) + 1060 <= 1400);
  }
  for (const fleck of childrenWith(effect, "fire-debris")[0].children) {
    const duration = fleck.className === "fire-spark" ? 580 : 780;
    assert.ok(parseFloat(fleck.properties["--fleck-delay"]) + duration <= 1400);
  }
  const animate = source.slice(source.indexOf("async function animateClashes("), source.indexOf("\nfunction playRound("));
  assert.match(animate, /const pauseDuration = reducedMotion \? 30 : cinematic \? 1450 : 180;/);
  assert.match(animate, /const cinematic = state\.clashStyle === "cinematic" && !reducedMotion;/);
  assert.match(animate, /audio\.cardDestruction\(winningCard\.element, destructionPan\);/);
});

test("Fire has a fast destructive peak, curling collapse, and slower smoke/ash settling", () => {
  assert.match(styles, /@keyframes fire-paper-consume[\s\S]*?40% \{\s*--fire-hole-size: 27%;[\s\S]*?brightness\(\.3\)[\s\S]*?65%, 100% \{ --fire-hole-size: 40%; opacity: 0;/);
  assert.match(styles, /@keyframes fire-char-fall[\s\S]*?44% \{ opacity: \.92;[\s\S]*?rotateX\(70deg\)/);
  assert.match(styles, /@keyframes fire-engulf-rise[\s\S]*?17% \{ opacity: 1;[\s\S]*?84%, 100% \{ opacity: 0;/);
  assert.match(styles, /\.fire-flame-envelope \{\s*position: absolute;\s*z-index: 8;/);
  assert.match(styles, /\.fire-burn-front \{[\s\S]*?bottom: 6%;[\s\S]*?height: 86%;/);
  const { card, createFireDefeatEffect } = fixture();
  const effect = createFireDefeatEffect(card);
  const flames = childrenWith(effect, "fire-flame-envelope")[0].children;
  assert.equal(new Set(flames.map(flame => flame.innerHTML)).size, 3, "Organic flame silhouette variants");
  assert.ok(flames.every(flame => parseFloat(flame.style.height) >= 74));
  assert.ok(childrenWith(effect, "fire-smoke")[0].children.every(wisp => wisp.innerHTML.includes("<svg")));
});
