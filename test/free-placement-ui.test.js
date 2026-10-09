import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import "../src/rules.js";
import "../src/four-lane-rules.js";

const source = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const fn = name => {
  const value = source.match(new RegExp(`(?:async )?function ${name}\\([\\s\\S]*?\\n\\}`))?.[0];
  assert.ok(value, name); return value;
};
const plain = value => JSON.parse(JSON.stringify(value));
const card = (id, tactic = "link") => ({ instanceId: id, name: id, art: id, element: "gust", power: 5, tactic });
function fixture(mode = "four-lane") {
  const context = {
    state: { gameMode: mode, selectedCardIds: [], pendingLaneCardId: null, playerHand: [card("a"), card("b"), card("c"), card("d")], locked: false },
    audio: { cardFlip() {}, denied() {} }, draggedCardId: null,
    updateFormationMessage() {}, renderHand() {}, setMessage() {},
    isFourLaneMode: () => mode === "four-lane", getMaxPlaySize: () => mode === "four-lane" ? 4 : 3,
    getPlayerFormationLimit: () => mode === "four-lane" ? 4 : 3,
  };
  runInNewContext(["formationCardCount", "selectedFormationCards", "placeCardInLane", "toggleCardSelection"].map(fn).join("\n"), context);
  return context;
}

test("WIP click/tap chooses a card without silently filling Lane 1", () => {
  const ctx = fixture(); ctx.toggleCardSelection("a");
  assert.equal(ctx.state.pendingLaneCardId, "a");
  assert.equal(ctx.formationCardCount(ctx.state.selectedCardIds), 0);
  ctx.placeCardInLane(ctx.state.pendingLaneCardId, 3);
  assert.deepEqual(plain(ctx.state.selectedCardIds), [null, null, null, "a"]);
  assert.equal(ctx.state.pendingLaneCardId, null);
  assert.equal(ctx.selectedFormationCards()[3].instanceId, "a");
});

test("WIP removing a card preserves gaps and does not move neighbouring cards", () => {
  const ctx = fixture(); ctx.placeCardInLane("a", 1); ctx.placeCardInLane("b", 3);
  ctx.toggleCardSelection("a");
  assert.deepEqual(plain(ctx.state.selectedCardIds), [null, null, null, "b"]);
  assert.equal(ctx.formationCardCount(ctx.selectedFormationCards()), 1);
});

test("WIP dragging into occupied lanes swaps placed cards or returns the replaced card to hand", () => {
  const ctx = fixture(); ctx.placeCardInLane("a", 0); ctx.placeCardInLane("b", 3);
  ctx.placeCardInLane("a", 3);
  assert.deepEqual(plain(ctx.state.selectedCardIds), ["b", null, null, "a"]);
  ctx.placeCardInLane("c", 3);
  assert.deepEqual(plain(ctx.state.selectedCardIds), ["b", null, null, "c"]);
  assert.equal(ctx.state.playerHand.length, 4, "building does not discard or duplicate card instances");
});

test("WIP Vanguard uses the leftmost physical slot, never the order in which cards were clicked", () => {
  const contexts = [fixture(), fixture()];
  for (const ctx of contexts) {
    ctx.state.playerHand[0].tactic = "vanguard";
    ctx.state.playerHand[1].tactic = "rally";
    ctx.getTacticBonus = globalThis.ClawFourLaneRules.getTacticBonus;
    runInNewContext(fn("getKnownPlayerTacticBonus"), ctx);
  }
  contexts[0].toggleCardSelection("b"); contexts[0].placeCardInLane("b", 3);
  contexts[0].toggleCardSelection("a"); contexts[0].placeCardInLane("a", 1);
  contexts[1].toggleCardSelection("a"); contexts[1].placeCardInLane("a", 1);
  contexts[1].toggleCardSelection("b"); contexts[1].placeCardInLane("b", 3);
  assert.deepEqual(plain(contexts[0].selectedFormationCards()), plain(contexts[1].selectedFormationCards()));
  for (const ctx of contexts) {
    assert.equal(ctx.getKnownPlayerTacticBonus(ctx.selectedFormationCards(), 1), 1,
      "a gap between the leading Vanguard and its companion does not cancel Vanguard");
    ctx.placeCardInLane("b", 0);
    assert.equal(ctx.getKnownPlayerTacticBonus(ctx.selectedFormationCards(), 1), 0,
      "moving a non-Vanguard to its left immediately removes its role bonus");
    ctx.toggleCardSelection("b");
    assert.equal(ctx.getKnownPlayerTacticBonus(ctx.selectedFormationCards(), 1), 0,
      "removing the companion leaves a lone Vanguard with no role bonus");
  }
});

test("WIP full formations permit swapping and replacement but ignore invalid lanes/cards and locked input", () => {
  const ctx = fixture(); ["a", "b", "c", "d"].forEach((id, lane) => ctx.placeCardInLane(id, lane));
  ctx.placeCardInLane("a", 3);
  assert.deepEqual(plain(ctx.state.selectedCardIds), ["d", "b", "c", "a"]);
  const before = JSON.stringify(ctx.state.selectedCardIds);
  for (const lane of [-1, 4, NaN, 1.5]) ctx.placeCardInLane("a", lane);
  ctx.placeCardInLane("missing", 2); ctx.toggleCardSelection("missing");
  assert.equal(JSON.stringify(ctx.state.selectedCardIds), before);
  ctx.state.locked = true; ctx.placeCardInLane("b", 0); ctx.toggleCardSelection("c");
  assert.equal(JSON.stringify(ctx.state.selectedCardIds), before);
});

test("Normal Play keeps automatic ordered selection and compacts after removal", () => {
  const ctx = fixture("normal"); ctx.toggleCardSelection("a"); ctx.toggleCardSelection("b");
  assert.deepEqual(plain(ctx.state.selectedCardIds), ["a", "b"]);
  ctx.toggleCardSelection("a");
  assert.deepEqual(plain(ctx.state.selectedCardIds), ["b"]);
  assert.equal(ctx.state.pendingLaneCardId, null);
  assert.equal(ctx.selectedFormationCards().length, 1);
});

test("played WIP cards reserve four equal physical slots and history does not compact gaps", () => {
  const ctx = { isFourLaneMode: () => true, cardMarkup: value => `<button>${value.name}</button>` };
  runInNewContext(fn("playedCardsMarkup"), ctx);
  const markup = ctx.playedCardsMarkup([null, card("b"), null, card("d")], "player", 1, [null, card("other"), null, null]);
  assert.match(markup, /data-clash-index="1"/);
  assert.match(markup, /data-clash-index="3"/);
  assert.equal((markup.match(/data-empty-lane=/g) || []).length, 2);
  assert.match(markup, /UNOPPOSED/);
  assert.doesNotMatch(markup, /EXTRA \+1|CAP \+0/);
});

test("effects locate physical indices rather than assuming DOM order equals lane order", () => {
  const nodes = [1, 3].map(index => ({ dataset: { clashIndex: String(index) } }));
  const ctx = {}; runInNewContext(fn("physicalLaneElements"), ctx);
  const lanes = ctx.physicalLaneElements({ querySelectorAll: () => nodes });
  assert.equal(lanes[0], undefined); assert.equal(lanes[1], nodes[0]);
  assert.equal(lanes[2], undefined); assert.equal(lanes[3], nodes[1]);
  assert.match(fn("animateClashes"), /if \(!laneScore \|\| !playerLane \|\| !aiLane\) continue/);
  assert.match(fn("restoreCinematicAftermathRemains"), /winner !== "player" && winner !== "ai"/);
});

test("every empty WIP lane supports keyboard placement without a previous-lane requirement", () => {
  const builder = fn("renderFormationBuilder");
  assert.match(builder, /role="button" tabindex="0"/);
  assert.match(builder, /event\.key === "Enter" \|\| event\.key === " "/);
  assert.match(builder, /!isFourLaneMode\(\) && \(laneIndex >= getPlayerFormationLimit/);
  assert.match(builder, /placeCardInLane\(state\.pendingLaneCardId, laneIndex\)/);
});
