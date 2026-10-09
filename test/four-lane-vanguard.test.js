import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import "../src/rules.js";
import "../src/four-lane-rules.js";

const normal = globalThis.ClawRules, four = globalThis.ClawFourLaneRules;
const elements = Object.keys(four.ELEMENTS), roles = ["none", "vanguard", "link", "finisher", "rally"];
const card = (power = 5, element = "gust", tactic = "vanguard") => Object.freeze({ power, element, tactic });
const slots = (...cards) => [...cards, ...Array(4 - cards.length).fill(null)];
const source = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");

function independentBonus(cards, lane) {
  const value = cards[lane];
  if (!value) return 0;
  const count = cards.filter(Boolean).length;
  if (value.tactic === "vanguard") return Number(count >= 2 && lane === cards.findIndex(Boolean));
  if (value.tactic === "link") return Number(Boolean(cards[lane - 1] && cards[lane - 1].element !== value.element));
  if (value.tactic === "finisher") return Number(count >= 2 && lane === cards.findLastIndex(Boolean));
  return 0;
}

test("all 1,295 sparse role arrangements apply Vanguard to the leftmost card only when supported", () => {
  let arrangements = 0, checks = 0;
  // Each physical slot is empty or holds one of the five diagnostic roles.
  for (let variant = 1; variant < 6 ** 4; variant++) {
    let rest = variant;
    const cards = Array.from({ length: 4 }, (_, lane) => {
      const type = rest % 6; rest = Math.floor(rest / 6);
      return type ? card(5, elements[lane % 3], roles[type - 1]) : null;
    });
    const before = JSON.stringify(cards), enemy = cards.map((value, lane) => card(5, elements[lane % 3], "none"));
    const result = four.resolveClashes(cards, enemy);
    for (let lane = 0; lane < 4; lane++) {
      const expected = independentBonus(cards, lane);
      assert.equal(four.getTacticBonus(cards, lane), expected, `arrangement ${variant}, lane ${lane + 1}`);
      if (cards[lane]) assert.equal(result.lanes[lane].player.total,
        5 + expected + Number(cards[lane + 1]?.tactic === "rally"));
      checks++;
    }
    assert.equal(JSON.stringify(cards), before);
    arrangements++;
  }
  assert.equal(arrangements, 1295);
  assert.equal(checks, 5180);
});

test("multiple Vanguards cannot share the role bonus and a non-Vanguard to their left blocks it", () => {
  const vanguard = card(), companion = card(5, "tide", "none");
  assert.deepEqual([0, 1, 2, 3].map(lane => four.getTacticBonus(slots(null, vanguard, vanguard, companion), lane)), [0, 1, 0, 0]);
  assert.deepEqual([0, 1, 2, 3].map(lane => four.getTacticBonus(slots(companion, null, vanguard, vanguard), lane)), [0, 0, 0, 0]);
  assert.equal(four.getTacticBonus(slots(null, vanguard, null, companion), 1), 1,
    "Vanguard checks the whole formation, not adjacent support");
  for (let lane = 0; lane < 4; lane++) {
    const lone = Array(4).fill(null); lone[lane] = vanguard;
    assert.equal(four.getTacticBonus(lone, lane), 0, `lone Vanguard in Lane ${lane + 1}`);
  }
});

test("backward Rally stacks once with a leading Vanguard in every eligible physical lane, without bridging gaps", () => {
  for (let lane = 0; lane < 3; lane++) {
    const own = Array(4).fill(null), enemy = Array(4).fill(null);
    own[lane] = card(5); own[lane + 1] = card(3, "tide", "rally"); enemy[lane] = card(6, "gust", "none");
    const result = four.resolveProgress(own, enemy);
    assert.equal(result.lanes[lane].player.tactic, 1);
    assert.equal(result.lanes[lane].player.rally, 1);
    assert.equal(result.lanes[lane].player.total, 7);
    assert.equal(result.results[lane], "player");
    assert.deepEqual(result.progressGains.player, { ember: 0, gust: 2, tide: 1 },
      "stacked Power wins a fight but does not multiply trophy rewards");
  }
  const gapped = slots(null, card(5), null, card(3, "tide", "rally"));
  assert.equal(four.getTacticBonus(gapped, 1), 1);
  assert.equal(four.getRallyBonus(gapped, 1), 0);
  const chain = slots(null, card(5), card(3, "tide", "rally"), card(3, "ember", "rally"));
  assert.equal(four.getTacticBonus(chain, 1) + four.getRallyBonus(chain, 1), 2,
    "a Rally receiving support still grants only its own single boost backwards");
});

test("Normal Play retains lone Vanguard +1 in Lane 1 and never adopts the WIP support requirement", () => {
  const lone = [card(5)];
  assert.equal(normal.getTacticBonus(lone, 0), 1);
  assert.equal(four.getTacticBonus(lone, 0), 0);
  const normalResult = normal.resolveClashes(lone, [card(5, "gust", "none")]);
  assert.equal(normalResult.lanes[0].player.total, 6);
  assert.equal(normalResult.results[0], "player");
  const later = [card(5, "tide", "none"), card(5)];
  assert.equal(normal.getTacticBonus(later, 1), 0);
  assert.match(normal.TACTICS.vanguard.description, /Lane 1/);
});

test("WIP role explanations match the supported leftmost rule while the Normal tutorial remains Lane 1", () => {
  assert.match(four.TACTICS.vanguard.description, /leftmost/);
  assert.match(four.TACTICS.vanguard.description, /at least two|2 or more/);
  assert.doesNotMatch(four.TACTICS.vanguard.description, /in Lane 1/);
  const context = { state: { gameMode: "four-lane" }, TACTICS: normal.TACTICS, ClawFourLaneRules: four, FOUR_LANE_ROLES: {} };
  runInNewContext(source.match(/function cardRoleDefinition\([\s\S]*?\n\}/)[0], context);
  const description = context.cardRoleDefinition(card()).description;
  assert.match(description, /leftmost/);
  assert.match(description, /at least two|2 or more/);
  assert.ok(source.includes('title: "Vanguard: commit it in Lane 1"'), "the original three-lane tutorial is unaffected");
});

test("Card Archive switches between the WIP four-role legend and the unchanged Normal three-role legend", () => {
  const context = { state: { gameMode: "normal" }, TACTICS: normal.TACTICS, ClawFourLaneRules: four };
  const helper = source.match(/function galleryRoleLegendMarkup\([\s\S]*?\n\}/)?.[0];
  assert.ok(helper);
  runInNewContext(helper, context);
  const original = context.galleryRoleLegendMarkup();
  assert.match(original, /Vanguard · \+1 in Lane 1/);
  assert.match(original, /Link · \+1 when the card before the Link has a different element from the Link card/);
  assert.match(original, /Finisher · \+1 when last in a 2–3 card formation/);
  assert.doesNotMatch(original, /Rally|leftmost|at least two/);
  assert.equal((original.match(/<span>/g) || []).length, 3);
  context.state.gameMode = "four-lane";
  const wip = context.galleryRoleLegendMarkup();
  assert.equal((wip.match(/<span>/g) || []).length, 4);
  assert.match(wip, /Vanguard · \+1 Power when it is your leftmost card and you commit at least two cards/);
  assert.match(wip, /Rally · Gives \+1 Power to your card in the lane immediately to its left/);
  assert.doesNotMatch(wip, /\+1 in Lane 1|2–3 card formation/);
  context.state.gameMode = "normal";
  assert.equal(context.galleryRoleLegendMarkup(), original, "switching back removes every WIP-only rule");
  assert.match(source, /function renderGallery\(\) \{\s*ui\.galleryRoleLegend\.innerHTML = galleryRoleLegendMarkup\(\);/,
    "opening/refiltering the archive refreshes the current mode's legend");
});

test("public AI forecast bonuses agree with the supported leftmost oracle for all represented masks", () => {
  const library = [card(9, "gust", "vanguard"), card(8, "tide", "vanguard"), card(6, "ember", "rally"),
    card(5, "gust", "rally"), card(4, "tide", "link"), card(3, "ember", "finisher"), card(5, "gust", "none")];
  const read = four.readPlayerHistory([]), scenarios = four.buildPlayerScenarios(read, library, () => .3);
  const masks = new Set();
  for (const scenario of scenarios) {
    masks.add(scenario.mask);
    const enemy = scenario.cards.map((value, lane) => card(5, elements[lane % 3], "none"));
    const resolved = four.resolveClashes(scenario.cards, enemy);
    scenario.cards.forEach((value, lane) => {
      const expected = independentBonus(scenario.cards, lane) + Number(Boolean(value && scenario.cards[lane + 1]?.tactic === "rally"));
      assert.equal(scenario.bonuses[lane], expected);
      assert.equal(scenario.totals[lane], value ? value.power + expected : 0);
      if (value) assert.equal(resolved.lanes[lane].player.tactic, independentBonus(scenario.cards, lane));
    });
  }
  assert.equal(masks.size, 15);
  assert.ok(Math.abs(scenarios.reduce((sum, scenario) => sum + scenario.weight, 0) - 1) < 1e-12);
});

test("the numeric AI search and public resolver rank supported Vanguard plans consistently", () => {
  const fixtures = [
    { hand: [card(9, "gust"), card(8, "tide"), card(5, "gust", "rally"), card(4, "ember", "rally")], own: {}, other: {} },
    { hand: [card(6, "tide"), card(5, "gust", "rally"), card(4, "ember", "link"), card(5, "gust", "finisher")], own: { ember: 6, gust: 5, tide: 4 }, other: { ember: 5, gust: 4, tide: 6 } },
    { hand: [card(9, "ember"), card(8, "gust"), card(3, "tide", "rally"), card(4, "ember", "link"), card(6, "gust", "finisher")], own: { ember: 2, gust: 4, tide: 5 }, other: { ember: 4, gust: 5, tide: 2 } },
  ];
  for (const [index, fixture] of fixtures.entries()) {
    const trait = four.AI_PLACEMENT_TRAITS[index], random = () => .3;
    const info = { history: [], cardLibrary: fixture.hand };
    const forecasts = four.buildPlayerScenarios(four.readPlayerHistory([]), fixture.hand, random);
    const own = four.getElementProgress(fixture.own), other = four.getElementProgress(fixture.other);
    const score = cards => {
      const count = cards.filter(Boolean).length;
      let value = -[0, 3.1, 1.8, .85, .3, .08, 0, 0][Math.min(7, fixture.hand.length - count + 3)] - count * .035;
      for (const forecast of forecasts) {
        const result = four.resolveProgress(cards, forecast.cards, own, other);
        let utility = 0;
        for (const element of elements) {
          utility += result.progressGains.player[element] * (1 + (Math.max(...Object.values(own)) - own[element]) * .07)
            + Number(own[element] < 6 && result.progressAfter.player[element] === 6);
          utility -= (result.progressGains.ai[element] * (1 + (Math.max(...Object.values(other)) - other[element]) * .07)
            + Number(other[element] < 6 && result.progressAfter.ai[element] === 6)) * .8;
        }
        utility += result.matchWinner === "player" ? 15 : result.matchWinner === "ai" ? -15 : 0;
        value += forecast.weight * utility;
      }
      return value;
    };
    const plans = four.enumerateFormations(fixture.hand).map(cards => ({ cards, score: score(cards) }));
    const best = Math.max(...plans.map(plan => plan.score));
    const preferred = Math.max(...plans.filter(plan => four.isPreferredPlacement(plan.cards, trait)).map(plan => plan.score));
    const anchored = best - preferred <= four.PLACEMENT_ESCAPE_MARGIN;
    // chooseAiFormation sees own trophies as aiWins, opposite to this oracle.
    const chosen = four.chooseAiFormation(fixture.hand, other, own, random, [trait], info);
    if (anchored) assert.equal(four.isPreferredPlacement(chosen, trait), true);
    assert.ok(score(chosen) >= (anchored ? preferred : best) - .7500000001,
      `fixture ${index}: numeric search selected outside the resolver's permitted close-score window`);
  }
});
