import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CLASS_FORMS,
  bondRank,
  bondReward,
  cardDefinition,
  createExpeditionMap,
  createRun,
  createStarterDeck,
  elementEdge,
  uniqueRewardChoices,
} from "../src/expedition-rules.js";

const expeditionPage = readFileSync(new URL("../expedition.html", import.meta.url), "utf8");
const expeditionScript = readFileSync(new URL("../src/expedition.js", import.meta.url), "utf8");

test("the expedition offers three distinct elemental champion forms", () => {
  assert.equal(Object.keys(CLASS_FORMS).length, 3);
  assert.deepEqual(new Set(Object.values(CLASS_FORMS).map((form) => form.element)), new Set(["ember", "gust", "tide"]));
  assert.equal(new Set(Object.values(CLASS_FORMS).map((form) => form.crest)).size, 3);
});

test("each champion begins with a ten-card deck containing its two class techniques", () => {
  Object.values(CLASS_FORMS).forEach((form) => {
    const deck = createStarterDeck(form.id);
    assert.equal(deck.length, 10);
    assert.deepEqual(deck.slice(-2).map((entry) => entry.id), [...form.starterCards]);
  });
});

test("elemental edge follows the Project Prowl cycle", () => {
  assert.equal(elementEdge("ember", "gust"), 2);
  assert.equal(elementEdge("gust", "tide"), 2);
  assert.equal(elementEdge("tide", "ember"), 2);
  assert.equal(elementEdge("ember", "tide"), 0);
  assert.equal(elementEdge(null, "gust"), 0);
});

test("card upgrades apply their declared numeric improvements", () => {
  assert.equal(cardDefinition({ id: "strike", upgraded: false }).damage, 6);
  assert.equal(cardDefinition({ id: "strike", upgraded: true }).damage, 8);
  assert.equal(cardDefinition({ id: "slipstream", upgraded: true }).cost, 0);
});

test("a generated route has choices, recovery, an elite option and a final boss", () => {
  const route = createExpeditionMap(() => .42);
  assert.equal(route.length, 6);
  assert.ok(route.some((stage) => stage.some((node) => node.type === "camp")));
  assert.ok(route.some((stage) => stage.some((node) => node.type === "elite")));
  assert.equal(route.at(-1).length, 1);
  assert.equal(route.at(-1)[0].type, "boss");
});

test("new runs carry the chosen form and a complete serializable state", () => {
  const run = createRun({ classId: "tide-warden" }, () => .25);
  assert.equal(run.classId, "tide-warden");
  assert.equal(run.hp, CLASS_FORMS["tide-warden"].maxHealth);
  assert.equal(run.deck.length, 10);
  assert.doesNotThrow(() => JSON.stringify(run));
});

test("reward choices are unique and bond progression survives between runs", () => {
  const rewards = uniqueRewardChoices("gust-ranger", 3, () => .37);
  assert.equal(rewards.length, 3);
  assert.equal(new Set(rewards).size, 3);
  assert.equal(bondRank(0), 1);
  assert.equal(bondRank(199), 2);
  assert.ok(bondReward(6, true) > bondReward(3, false));
});

test("the expedition page exposes the complete vertical slice and local-only portrait storage", () => {
  for (const id of [
    "creatorScreen", "petPhotoInput", "classChoices", "hubScreen", "mapScreen", "routeMap",
    "combatScreen", "combatHand", "decisionScreen", "endingScreen",
  ]) assert.match(expeditionPage, new RegExp(`id="${id}"`));
  assert.match(expeditionScript, /indexedDB\.open\(DB_NAME/);
  assert.match(expeditionScript, /canvas\.toBlob/);
  assert.match(expeditionScript, /localStorage\.setItem\(RUN_KEY/);
  assert.match(expeditionScript, /classCrestMarkup/);
  assert.doesNotMatch(expeditionScript, /crest-badge/);
});
