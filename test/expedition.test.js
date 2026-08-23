import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CLASS_FORMS,
  ENEMIES,
  PET_PERSONALITIES,
  bondRank,
  bondReward,
  cardDefinition,
  createExpeditionMap,
  createRun,
  createStarterDeck,
  elementEdge,
  evaluateCommandPlan,
  uniqueRewardChoices,
} from "../src/expedition-rules.js";

const expeditionPage = readFileSync(new URL("../expedition.html", import.meta.url), "utf8");
const expeditionScript = readFileSync(new URL("../src/expedition.js", import.meta.url), "utf8");

test("the expedition offers three distinct elemental champion forms", () => {
  assert.equal(Object.keys(CLASS_FORMS).length, 3);
  assert.deepEqual(new Set(Object.values(CLASS_FORMS).map((form) => form.element)), new Set(["ember", "gust", "tide"]));
  assert.equal(new Set(Object.values(CLASS_FORMS).map((form) => form.crest)).size, 3);
});

test("pet personalities provide four permanent and mechanically distinct identities", () => {
  assert.deepEqual(Object.keys(PET_PERSONALITIES), ["bold", "cunning", "loyal", "playful"]);
  assert.equal(new Set(Object.values(PET_PERSONALITIES).map((personality) => personality.description)).size, 4);
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
  const run = createRun({ classId: "tide-warden", personalityId: "loyal" }, () => .25);
  assert.equal(run.classId, "tide-warden");
  assert.equal(run.personalityId, "loyal");
  assert.equal(run.hp, CLASS_FORMS["tide-warden"].maxHealth);
  assert.equal(run.deck.length, 10);
  assert.doesNotThrow(() => JSON.stringify(run));
});

test("ordered commands create readable combos and personality bonuses", () => {
  const cunningPlan = evaluateCommandPlan([{ id: "feint" }, { id: "strike" }], {
    classId: "gust-ranger", personalityId: "cunning",
  });
  assert.equal(cunningPlan.valid, true);
  assert.equal(cunningPlan.steps[0].cost, 0);
  assert.ok(cunningPlan.steps[1].bonus.labels.includes("Exploit +3"));

  const boldCounter = evaluateCommandPlan([{ id: "brace" }, { id: "strike" }], {
    classId: "ember-knight", personalityId: "bold",
  });
  assert.equal(boldCounter.totals.damage, 10);
  assert.ok(boldCounter.steps[1].bonus.labels.includes("Counter +2"));
  assert.ok(boldCounter.steps[1].bonus.labels.includes("Bold strike +2"));
});

test("three-command personality chains reward variety without allowing impossible plans", () => {
  const playful = evaluateCommandPlan([{ id: "strike" }, { id: "brace" }, { id: "feint" }], {
    classId: "gust-ranger", personalityId: "playful",
  });
  assert.equal(playful.valid, true);
  assert.ok(playful.totals.prowl >= 6);
  assert.match(playful.steps[2].bonus.labels.join(" "), /Playful trio/);
  assert.equal(evaluateCommandPlan([{ id: "fortify" }, { id: "undertow" }]).valid, false);
});

test("every enemy telegraphs a named repeating pattern", () => {
  Object.values(ENEMIES).forEach((enemy) => {
    assert.ok(enemy.intents.length >= 3);
    enemy.intents.forEach((intent) => assert.ok(intent.name));
  });
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
    "creatorScreen", "petPhotoInput", "classChoices", "personalityChoices", "hubScreen", "mapScreen", "routeMap",
    "combatScreen", "combatHand", "commandQueue", "planForecast", "decisionScreen", "endingScreen",
  ]) assert.match(expeditionPage, new RegExp(`id="${id}"`));
  assert.match(expeditionScript, /indexedDB\.open\(DB_NAME/);
  assert.match(expeditionScript, /canvas\.toBlob/);
  assert.match(expeditionScript, /localStorage\.setItem\(RUN_KEY/);
  assert.match(expeditionScript, /classCrestMarkup/);
  assert.match(expeditionScript, /resolveCommandPlan/);
  assert.match(expeditionScript, /commandAnimation/);
  assert.match(expeditionScript, /viewBox="0 0 512 512"/);
  assert.match(expeditionScript, /crest-source/);
  assert.doesNotMatch(expeditionScript, /crest-badge/);
  assert.match(expeditionPage, /Game-Icons\.net/);
  assert.match(expeditionPage, /creativecommons\.org\/licenses\/by\/3\.0/);
});
