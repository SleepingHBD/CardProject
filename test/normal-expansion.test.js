import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import "../src/rules.js";

const source = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const rules = globalThis.ClawRules;
const declaration = source.slice(source.indexOf("const CARD_LIBRARY ="), source.indexOf("const HAND_SIZE ="));
const library = JSON.parse(runInNewContext(`${declaration}\nJSON.stringify(CARD_LIBRARY)`));
const fn = name => source.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}`))?.[0];
const copies = { common: 2, uncommon: 2, rare: 1, epic: 1, legendary: 1 };
const random = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);

test("all twelve migrated characters retain their approved identity, stats and actual PNG sources", () => {
  const manifests = ["rare-rally-artwork.json", "uncommon-rally-artwork.json", "common-rally-artwork.json", "uncommon-expansion-artwork.json"];
  const approved = manifests.flatMap(file => JSON.parse(readFileSync(new URL(`../assets/cards/${file}`, import.meta.url), "utf8")).cards);
  assert.equal(approved.length, 12);
  assert.equal(library.length, 36);
  assert.equal(new Set(library.map(card => card.id)).size, 36);
  assert.equal(new Set(library.map(card => card.art)).size, 36);
  const context = { CARD_LIBRARY: library, cardUsesPhotographicArtwork: () => false };
  runInNewContext(fn("cardArtworkSource"), context);
  for (const expected of approved) {
    const card = library.find(value => value.name === expected.name);
    assert.ok(card, `${expected.name} is playable, not a preview`);
    assert.equal(card.element, expected.element);
    assert.equal(card.power, expected.intendedStats.power);
    assert.equal(card.rarity, expected.intendedStats.rarity);
    assert.equal(card.tactic, expected.intendedStats.role);
    assert.equal(card.move, expected.move);
    assert.equal(context.cardArtworkSource(card.art), `./assets/cards/${expected.asset}`);
    assert.equal(existsSync(new URL(`../${card.artworkSource}`, import.meta.url)), true);
    assert.equal(card.id, `card-${library.indexOf(card)}`);
  }
});

test("freshDeck creates the full balanced60-card Normal Play shuffle with unique physical instances", () => {
  const context = { CARD_LIBRARY: library, DECK_COPIES_BY_RARITY: copies, shuffle: cards => cards };
  runInNewContext(fn("freshDeck"), context);
  const deck = context.freshDeck();
  assert.equal(deck.length, 60);
  assert.equal(new Set(deck.map(card => card.instanceId)).size, 60);
  for (const element of Object.keys(rules.ELEMENTS)) {
    assert.equal(deck.filter(card => card.element === element).length, 20);
    for (const role of Object.keys(rules.TACTICS)) {
      assert.equal(deck.filter(card => card.element === element && card.tactic === role).length, 5);
    }
  }
  for (const card of library) assert.equal(deck.filter(value => value.art === card.art).length, copies[card.rarity]);
});

test("the actual Rally tutorial teaches a legal two-card formation with the intended2–0 result", () => {
  const start = source.indexOf("const TUTORIAL_LESSON_LIBRARY =");
  const end = source.indexOf("function readSavedClashStyle", start);
  const context = {
    AI_MOTIVE_TRAITS: rules.AI_MOTIVE_TRAITS,
    AI_FORMATION_TRAITS: rules.AI_FORMATION_TRAITS,
    AI_COMMITMENT_TRAITS: rules.AI_COMMITMENT_TRAITS,
  };
  const lessons = runInNewContext(`${source.slice(start, end)}\nTUTORIAL_LESSONS`, context);
  assert.equal(lessons.length, 8);
  const lesson = lessons[2];
  assert.equal(lesson.concept, "Rally Support");
  const player = Array.from(lesson.expected, art => library.find(card => card.art === art));
  const opponent = Array.from(lesson.aiCards, art => library.find(card => card.art === art));
  assert.ok([...player, ...opponent].every(Boolean));
  assert.equal(player[1].tactic, "rally");
  const result = rules.resolveClashes(player, opponent);
  assert.equal(result.lanes[0].player.total, 8);
  assert.equal(result.lanes[0].player.rally, 1);
  assert.equal(result.lanes[0].winner, "draw");
  assert.deepEqual(result.score, { player: 2, ai: 0, draw: 1 });
  assert.equal(rules.getFormationRewardOptions(player, opponent, result)[0].card.name, "Lucan");
});

test("the expanded shared deck survives complete matches, trophy removal and reshuffling without losing cards", () => {
  let reshuffles = 0;
  for (let seed = 1; seed <= 32; seed++) {
    const roll = random(seed * 7129), discard = [], trophies = [[], []], hands = [[], []];
    const deck = library.flatMap(card => Array.from({ length: copies[card.rarity] }, (_, copy) => ({ ...card, instanceId: `${card.id}-${copy}` })));
    const shuffle = values => {
      for (let i = values.length - 1; i > 0; i--) {
        const j = Math.floor(roll() * (i + 1));
        [values[i], values[j]] = [values[j], values[i]];
      }
    };
    shuffle(deck);
    const traits = [rules.createAiTraits(roll), rules.createAiTraits(roll)];
    const refill = () => {
      for (const hand of hands) while (hand.length < 6) {
        if (!deck.length && discard.length) { rules.reshuffleDiscardPile(deck, discard, roll); reshuffles++; }
        const drawn = deck.pop();
        if (!drawn) break;
        hand.push(drawn);
      }
    };
    refill();
    let completed = false;
    for (let round = 1; round <= 200; round++) {
      const formations = hands.map((hand, side) => {
        const count = rules.chooseAiCommitment(hand.length, trophies[1 - side], trophies[side], roll, traits[side]);
        return rules.chooseAiCards(hand, count, trophies[1 - side], trophies[side], roll, traits[side]);
      });
      for (let side = 0; side < 2; side++) {
        assert.ok(formations[side].length >= 1 && formations[side].length <= 3);
        for (const card of formations[side]) {
          const index = hands[side].indexOf(card);
          assert.ok(index >= 0);
          hands[side].splice(index, 1);
        }
      }
      const result = rules.resolveClashes(...formations);
      const options = rules.getFormationRewardOptions(...formations, result);
      const winner = result.winner === "player" ? 0 : result.winner === "ai" ? 1 : null;
      const reward = winner === null ? null : rules.chooseTrophyReward(options, trophies[winner]);
      if (reward) trophies[winner].push(reward.card);
      discard.push(...formations.flat().filter(card => card !== reward?.card));
      const owned = [...deck, ...discard, ...hands.flat(), ...trophies.flat()];
      assert.equal(owned.length, 60);
      assert.equal(new Set(owned.map(card => card.instanceId)).size, 60);
      assert.ok(result.extraCardPoints.player <= 2 && result.extraCardPoints.ai <= 2);
      if (winner !== null && rules.hasCompletedElementSet(trophies[winner])) { completed = true; break; }
      refill();
      assert.ok(hands.every(hand => hand.length === 6));
    }
    assert.ok(completed, `seed${seed} finishes using the unchanged trophy goal`);
  }
  assert.ok(reshuffles > 0, "the cohort exercises actual discard recycling");
});
