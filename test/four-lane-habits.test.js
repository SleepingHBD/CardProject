import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import "../src/rules.js";
import "../src/four-lane-rules.js";

const normal = globalThis.ClawRules, four = globalThis.ClawFourLaneRules;
const gameSource = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const rulesSource = readFileSync(new URL("../src/four-lane-rules.js", import.meta.url), "utf8");
const rng = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const card = (power, element = "gust", tactic = "rally") => Object.freeze({ power, element, tactic });
const hand = Object.freeze([card(9, "ember", "finisher"), card(8, "tide", "vanguard"),
  card(6, "gust", "link"), card(5, "tide", "rally"), card(4, "ember", "rally"),
  card(3, "gust", "finisher"), card(5, "ember", "link")]);
const history = counts => counts.map(count => ({
  playerCards: Array.from({ length: count }, () => card(6, "gust", "none")), aiCards: [card(5)],
}));
const meanPower = cards => cards.reduce((sum, value) => sum + value.power, 0) / cards.length;
const bonusPerCard = cards => cards.reduce((sum, _, lane) =>
  sum + four.getTacticBonus(cards, lane) + four.getRallyBonus(cards, lane), 0) / cards.length;
const library = runInNewContext([
  gameSource.slice(gameSource.indexOf("const CARD_LIBRARY ="), gameSource.indexOf("const HAND_SIZE =")),
  gameSource.slice(gameSource.indexOf("const FOUR_LANE_RALLY_CARDS ="), gameSource.indexOf("const DIFFICULTIES =")),
  "[...CARD_LIBRARY, ...FOUR_LANE_CARDS]",
].join("\n"));

test("the nine refined habit descriptions are concise, accurate and generated consistently", () => {
  const expected = {
    "power-seeker": "Prefers to commit high-Power cards rather than save them.",
    "trophy-denier": "Favors counters to elements you have 1 trophy in.",
    "tactic-planner": "Favors formations that activate role bonuses.",
    "strong-opener": "Places his highest-Power committed card in Lane 1.",
    "late-striker": "Places his highest-Power committed card in his last occupied lane.",
    "solo-gambler": "Favors committing 1 card when his hand needs rebuilding, but can commit more to avoid giving away rounds.",
    "score-reader": "Favors committing more cards when behind in trophies, and fewer when ahead.",
    "echo-tactician": "Favors committing the same number of cards you committed in the previous round.",
    "restless-dealer": "Favors committing a different number of cards than he committed in the previous round.",
  };
  const seen = new Set();
  for (let m = 0; m < normal.AI_MOTIVE_TRAITS.length; m++) {
    for (let f = 0; f < normal.AI_FORMATION_TRAITS.length; f++) {
      for (let c = 0; c < normal.AI_COMMITMENT_TRAITS.length; c++) {
        const rolls = [m / 6, f / 3, c / 6, 0];
        const traits = four.createAiTraits(() => rolls.shift());
        assert.deepEqual(traits.map(value => value.category), ["motive", "formation", "commitment"]);
        assert.ok(traits.every(Object.isFrozen));
        for (const trait of traits) {
          if (expected[trait.id]) {
            seen.add(trait.id);
            assert.equal(trait.description, expected[trait.id]);
          }
          if (trait.id === "tactic-planner") assert.doesNotMatch(trait.description, /Rally/i);
        }
      }
    }
  }
  assert.equal(seen.size, 9);
  for (const trait of [...normal.AI_MOTIVE_TRAITS, ...normal.AI_FORMATION_TRAITS, ...normal.AI_COMMITMENT_TRAITS]) {
    if (expected[trait.id] && trait.id !== "solo-gambler") assert.equal(trait.description, expected[trait.id]);
  }
  assert.match(normal.AI_COMMITMENT_TRAITS.find(value => value.id === "solo-gambler").description, /conserve cards/);
  assert.ok(gameSource.includes("Strong Opener places his highest-Power committed card in Lane 1."));
  assert.doesNotMatch(gameSource, /Strong Opener places the opponent's highest-Power card in Lane 1/);
});

test("Instinct renders the refined explanations; Blind does not display hidden habits", () => {
  const traitIds = ["power-seeker", "tactic-planner", "solo-gambler"];
  const rolls = [2 / 6, 0, 0];
  const traits = four.createAiTraits(() => rolls.shift());
  assert.deepEqual(traits.map(value => value.id), traitIds);
  const start = gameSource.indexOf("function renderOpponentHabits()");
  const source = gameSource.slice(start, gameSource.indexOf("\n}", start) + 2);
  const context = { state: { difficulty: "instinct", aiTraits: traits }, ui: { opponentHabits: {} } };
  runInNewContext(source, context);
  context.renderOpponentHabits();
  assert.equal(context.ui.opponentHabits.hidden, false);
  for (const trait of traits) assert.ok(context.ui.opponentHabits.innerHTML.includes(trait.description));
  context.state.difficulty = "blind";
  context.renderOpponentHabits();
  assert.equal(context.ui.opponentHabits.hidden, true);
  assert.equal(context.ui.opponentHabits.innerHTML, "");
});

test("personality only chooses within the close-score window and resolves equal preferences strategically", () => {
  const window = Number(rulesSource.match(/const HABIT_SCORE_WINDOW = ([\d.]+);/)[1]);
  assert.ok(window > 0 && window <= 1);
  const start = rulesSource.indexOf("function selectCloseHabitPlan(");
  const source = rulesSource.slice(start, rulesSource.indexOf("\n  function chooseAiFormation(", start));
  const context = { HABIT_SCORE_WINDOW: window };
  runInNewContext(source, context);
  const strongest = [card(9)], nearby = [card(8)], clearlyWorse = [card(7)];
  const candidates = Object.freeze([
    Object.freeze({ cards: strongest, score: 10, preference: 0 }),
    Object.freeze({ cards: nearby, score: 10 - window, preference: 1 }),
    Object.freeze({ cards: clearlyWorse, score: 10 - window - .01, preference: 100 }),
  ]);
  assert.equal(context.selectCloseHabitPlan(candidates, 10), nearby);
  assert.equal(context.selectCloseHabitPlan([
    { cards: strongest, score: 10, preference: 1 }, { cards: nearby, score: 9.5, preference: 1 },
  ], 10), strongest);
  assert.equal(context.selectCloseHabitPlan([], 10), undefined);
});

test("Power Seeker commits stronger cards when comparable formations are available", () => {
  const info = { history: history([2, 2, 2]), cardLibrary: hand };
  const neutral = four.chooseAiFormation(hand, [], [], rng(1), [], info);
  const seeker = four.chooseAiFormation(hand, [], [], rng(1), [{ id: "power-seeker" }], info);
  assert.ok(meanPower(seeker) > meanPower(neutral) + 1);
  assert.ok(seeker.includes(hand[0]), "the high-Power Finisher is committed rather than conserved");
  assert.ok(seeker.every(value => hand.includes(value)));
});

test("Role Planner makes role combinations more distinctive without needing Rally in its explanation", () => {
  const info = { history: history([1, 1, 1]), cardLibrary: hand };
  const neutral = four.chooseAiFormation(hand, [], [], rng(8), [], info);
  const planner = four.chooseAiFormation(hand, [], [], rng(8), [{ id: "tactic-planner" }], info);
  assert.ok(bonusPerCard(planner) > bonusPerCard(neutral));
  assert.equal(planner[0].tactic, "vanguard");
  assert.equal(planner[1].tactic, "rally");
  assert.equal(four.getTacticBonus(planner, 0) + four.getRallyBonus(planner, 0), 2);
  assert.equal(four.getRallyBonus(planner, 1), 0);
});

test("Solo Gambler recovers with one card but can still oppose larger pushes", () => {
  const trait = [{ id: "solo-gambler" }];
  const info = { history: history([1, 1, 1]), cardLibrary: hand };
  const depleted = four.chooseAiFormation(hand.slice(0, 4), [], [], rng(1), trait, info);
  assert.equal(depleted.length, 1);
  const playerHand = [...hand.slice(0, 4)].filter(value => !depleted.includes(value));
  four.replenishHand([...hand.slice(4)], [], playerHand);
  assert.equal(playerHand.length, 5, "a one-card round followed by draw-two rebuilds the hand");
  const full = four.chooseAiFormation(hand, [], [], rng(1), trait, info);
  assert.ok(full.length > 1, "a full hand does not trigger recovery singles");
  const push = four.chooseAiFormation(hand, [], [], rng(1), trait,
    { history: history([4, 4, 4]), cardLibrary: hand });
  assert.ok(push.length > 1, "the habit can challenge a repeating large formation");
  assert.equal(normal.chooseAiCommitment(6, [], [], () => .5, trait), 1, "Normal Play's original AI is unchanged");
});

test("all 108 refined habit combinations complete matches, conserve personal cards and preserve ordering promises", () => {
  let matches = 0, reshuffles = 0;
  for (const motive of normal.AI_MOTIVE_TRAITS) for (const formation of normal.AI_FORMATION_TRAITS) {
    for (const commitment of normal.AI_COMMITMENT_TRAITS) for (let trial = 0; trial < 3; trial++) {
      const seed = 1000 + matches * 131;
      const traits = [motive.id === "element-loyalist"
        ? { ...motive, element: ["ember", "gust", "tide"][trial] } : motive, formation, commitment];
      const traitsBefore = JSON.stringify(traits);
      const sides = [0, 1].map(owner => {
        const random = rng(seed + owner * 8191), deck = [];
        const discard = library.map((value, index) => ({ ...value, instanceId: `${owner}-${index}` }));
        normal.reshuffleDiscardPile(deck, discard, random);
        const side = { deck, discard, hand: [], trophies: [], random };
        four.replenishHand(deck, discard, side.hand, 7, random);
        return side;
      });
      const decisions = [rng(seed + 31001), rng(seed + 41001)], completed = [];
      let finished = false;
      for (let round = 0; round < 150; round++) {
        const opponentHistory = completed.map(value => ({ playerCards: value.aiCards, aiCards: value.playerCards }));
        const plays = [
          four.chooseAiFormation(sides[0].hand, sides[1].trophies, sides[0].trophies, decisions[0], [],
            { history: opponentHistory, cardLibrary: library }),
          four.chooseAiFormation(sides[1].hand, sides[0].trophies, sides[1].trophies, decisions[1], traits,
            { history: completed, cardLibrary: library }),
        ];
        const strongest = Math.max(...plays[1].map(value => value.power));
        if (formation.id === "strong-opener") assert.equal(plays[1][0].power, strongest);
        if (formation.id === "late-striker") assert.equal(plays[1].at(-1).power, strongest);
        const result = four.resolveClashes(...plays);
        assert.ok(result.extraCardPoints.player <= 2 && result.extraCardPoints.ai <= 2);
        const winner = result.winner === "draw" ? -1 : result.winner === "player" ? 0 : 1;
        const options = four.getFormationRewardOptions(...plays, result);
        const reward = options.length ? normal.chooseTrophyReward(options, sides[winner].trophies) : null;
        sides.forEach((side, owner) => {
          assert.ok(plays[owner].length >= 1 && plays[owner].length <= 4);
          assert.equal(new Set(plays[owner]).size, plays[owner].length);
          assert.ok(plays[owner].every(value => side.hand.includes(value)));
          side.hand = side.hand.filter(value => !plays[owner].includes(value));
          side.discard.push(...plays[owner].filter(value => value !== reward?.card));
          if (reward && winner === owner) side.trophies.push(reward.card);
          const all = [...side.deck, ...side.discard, ...side.hand, ...side.trophies];
          assert.equal(all.length, 36);
          assert.equal(new Set(all.map(value => value.instanceId)).size, 36);
          assert.ok(all.every(value => value.instanceId.startsWith(`${owner}-`)));
        });
        const snapshot = cards => cards.map(({ element, power, tactic }) => ({ element, power, tactic }));
        completed.push({ playerCards: snapshot(plays[0]), aiCards: snapshot(plays[1]) });
        if (sides.some(side => normal.hasCompletedElementSet(side.trophies))) { finished = true; break; }
        sides.forEach(side => {
          reshuffles += Number(four.replenishHand(side.deck, side.discard, side.hand, 2, side.random).reshuffled);
          assert.ok(side.hand.length >= 1 && side.hand.length <= 7);
        });
      }
      assert.ok(finished, `habit combination ${traits.map(value => value.id).join("/")} must finish`);
      assert.equal(JSON.stringify(traits), traitsBefore, "habit identities remain stable throughout the match");
      matches++;
    }
  }
  assert.equal(matches, 324);
  assert.ok(reshuffles > 0, "complete matches exercise personal deck recycling");
});
