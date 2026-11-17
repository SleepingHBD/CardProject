import test from "node:test";
import assert from "node:assert/strict";
import "../src/rules.js";

const rules = globalThis.ClawRules;
const card = (power = 4, tactic = "rally", element = "ember") => Object.freeze({ power, tactic, element });
const roles = ["vanguard", "link", "finisher", "rally"];
const elements = ["ember", "gust", "tide"];
const rolePlanner = [{ id: "tactic-planner", category: "formation" }];
const bonusTotal = formation => formation.reduce((sum, _, index) =>
  sum + rules.getTacticBonus(formation, index) + rules.getRallyBonus(formation, index), 0);
const permutations = cards => cards.length ? cards.flatMap((value, index) =>
  permutations(cards.filter((_, other) => other !== index)).map(rest => [value, ...rest])) : [[]];

test("Rally is a fourth frozen role without altering Normal Play's limits or goals", () => {
  assert.deepEqual(Object.keys(rules.TACTICS), roles);
  assert.equal(rules.TACTICS.rally.label, "Rally");
  assert.equal(rules.TACTICS.rally.icon, "banner");
  assert.ok(Object.isFrozen(rules.TACTICS.rally));
  assert.equal(rules.MAX_COMMITMENT, 3);
  assert.equal(rules.TROPHIES_PER_ELEMENT, 2);
  assert.equal(rules.LANE_WIN_POINTS, 2);
  assert.equal(rules.EXTRA_CARD_POINTS, 1);
  assert.equal(rules.ELEMENT_EDGE_BONUS, 2);
  assert.equal(rules.hasCompletedElementSet(elements.flatMap(element => [card(4, "rally", element), card(4, "rally", element)])), true);
});

test("Rally supports exactly the card directly before it and never itself or a following card", () => {
  for (let count = 1; count <= 3; count++) {
    for (let rallyLane = 0; rallyLane < count; rallyLane++) {
      const formation = Array.from({ length: count }, (_, lane) => card(4, lane === rallyLane ? "rally" : "link"));
      for (let lane = 0; lane < count; lane++) {
        assert.equal(rules.getRallyBonus(formation, lane), lane === rallyLane - 1 ? 1 : 0);
      }
      assert.equal(rules.getTacticBonus(formation, rallyLane), 0);
    }
  }
  assert.equal(rules.getRallyBonus([], 0), 0);
  assert.equal(rules.getRallyBonus([card()], -1), 0);
  assert.equal(rules.getRallyBonus([null, card()], 0), 0, "no phantom card receives support");
  assert.equal(rules.getRallyBonus([card(), null, card()], 0), 0, "support cannot cross a gap");
});

test("Vanguard, received Rally and elemental edge are separate additive bonuses", () => {
  const player = [card(4, "vanguard"), card(4)];
  const opponent = [card(8, "finisher", "gust")];
  const resolution = rules.resolveClashes(player, opponent);
  assert.deepEqual(resolution.lanes[0].player, {
    base: 4, edge: 2, tactic: 1, tacticName: "Vanguard", rally: 1, total: 8,
  });
  assert.equal(resolution.lanes[0].winner, "draw");
  assert.deepEqual(resolution.score, { player: 1, ai: 0, draw: 1 });
  assert.equal(rules.compareCards(player[0], opponent[0], 1, 0, 1, 0), "draw");
});

test("a Lane 3 Rally can support an active Lane 2 Link", () => {
  const player = [card(4, "vanguard"), card(5, "link", "tide"), card(4, "rally", "gust")];
  const opponent = [card(4, "link"), card(8, "vanguard"), card(4, "link", "gust")];
  const result = rules.resolveClashes(player, opponent);
  assert.equal(result.lanes[1].player.edge, 2);
  assert.equal(result.lanes[1].player.tactic, 1);
  assert.equal(result.lanes[1].player.rally, 1);
  assert.equal(result.lanes[1].player.total, 9);
  assert.equal(result.lanes[1].winner, "player");
});

test("putting Rally after a Finisher replaces rather than stacks its inactive Finisher bonus", () => {
  const finisher = card(5, "finisher");
  assert.equal(rules.getTacticBonus([finisher, card()], 0), 0);
  assert.equal(rules.getRallyBonus([finisher, card()], 0), 1);
  assert.equal(rules.getTacticBonus([card(), finisher], 1), 1);
  assert.equal(rules.getRallyBonus([card(), finisher], 1), 0);
  assert.equal(rules.getTacticBonus([card()], 0), 0, "a lone Rally is not treated as a Finisher");
});

test("a supported Rally passes only +1 instead of propagating or multiplying its received boost", () => {
  const player = [card(4, "vanguard"), card(), card()];
  const opponent = [card(6, "link"), card(5, "link"), card(4, "link")];
  const result = rules.resolveClashes(player, opponent);
  assert.deepEqual(result.lanes.map(lane => lane.player.rally), [1, 1, 0]);
  assert.deepEqual(result.lanes.map(lane => lane.player.tactic), [1, 0, 0]);
  assert.deepEqual(result.lanes.map(lane => lane.player.total), [6, 5, 4]);
  assert.deepEqual(result.results, ["draw", "draw", "draw"]);
});

test("an unopposed Rally can turn a 2v1 first-lane loss into a draw and an existing 1–0 extra-card win", () => {
  const first = card(4, "vanguard"), rally = card(4, "rally", "tide");
  const opponent = [card(6, "finisher")];
  const withoutSupport = rules.resolveClashes([first, card(4, "link", "tide")], opponent);
  assert.deepEqual(withoutSupport.score, { player: 1, ai: 2, draw: 0 });
  const supported = rules.resolveClashes([first, rally], opponent);
  assert.deepEqual(supported.score, { player: 1, ai: 0, draw: 1 });
  assert.equal(supported.winner, "player");
  assert.equal(supported.decidedBy, "extra-cards");
  assert.deepEqual(rules.getFormationRewardOptions([first, rally], opponent, supported), [
    { winner: "player", card: rally, lane: 1, fixed: true },
  ]);
});

test("3v1 still awards exactly two extra-card points and chained Rally cannot inflate them", () => {
  const player = [card(4, "vanguard"), card(6), card(6)];
  const result = rules.resolveClashes(player, [card(7, "finisher")]);
  assert.equal(result.lanes[0].player.total, 6);
  assert.equal(result.lanes[0].winner, "ai");
  assert.deepEqual(result.extraCardPoints, { player: 2, ai: 0 });
  assert.deepEqual(result.score, { player: 2, ai: 2, draw: 0 });
  assert.equal(result.winner, "draw");
  assert.deepEqual(rules.getFormationRewardOptions(player, [card(7, "finisher")], result), []);
});

test("an unopposed third Rally supports the second lane during a 3v2", () => {
  const player = [card(4, "vanguard"), card(), card()];
  const opponent = [card(6, "finisher"), card(4, "finisher")];
  const result = rules.resolveClashes(player, opponent);
  assert.deepEqual(result.results, ["draw", "draw"]);
  assert.deepEqual(result.lanes.map(lane => lane.player.total), [6, 5]);
  assert.deepEqual(result.score, { player: 1, ai: 0, draw: 2 });
  assert.equal(rules.getFormationRewardOptions(player, opponent, result)[0].card, player[2]);
});

test("received Rally is included in direct comparison for either side", () => {
  const a = card(5, "link"), b = card(5, "link");
  assert.equal(rules.compareCards(a, b, 0, 0, 1, 0), "player");
  assert.equal(rules.compareCards(a, b, 0, 0, 0, 1), "ai");
  assert.equal(rules.compareCards(a, b, 0, 0, 1, 1), "draw");
});

test("Normal AI recognizes useful Rally support when choosing its next card", () => {
  const rally = card(4), other = card(4, "finisher"), previous = card(6, "vanguard");
  assert.equal(rules.chooseAiCard([other, rally], [], [], () => .5, previous, rolePlanner), rally);
  assert.equal(rules.chooseAiCard([other, rally], [], [], () => .5, null, rolePlanner), other,
    "Rally has no unconditional selection bonus when no partner is selected");
});

test("Role Planner orders Vanguard and Rally to activate both opener and support", () => {
  const rally = card(4), vanguard = card(6, "vanguard");
  const ordered = rules.orderAiFormation([rally, vanguard], () => .5, rolePlanner);
  assert.deepEqual(ordered, [vanguard, rally]);
  assert.equal(bonusTotal(ordered), 2);
});

test("Role Planner finds the maximum active role/support total for every three-role combination", () => {
  for (const first of roles) for (const second of roles) for (const third of roles) {
    const cards = Object.freeze([card(4, first), card(5, second, "gust"), card(6, third, "tide")]);
    const ordered = rules.orderAiFormation(cards, () => .5, rolePlanner);
    assert.equal(bonusTotal(ordered), Math.max(...permutations(cards).map(bonusTotal)));
    assert.equal(new Set(ordered).size, 3);
    assert.ok(ordered.every(value => cards.includes(value)));
  }
});

test("all 108 normal habit combinations still select legal owned cards with Rally present", () => {
  const hand = Object.freeze([
    card(4, "vanguard"), card(5, "link", "gust"), card(6, "finisher", "tide"),
    card(4, "rally", "tide"), card(5, "rally", "gust"), card(6),
  ]);
  for (const motive of rules.AI_MOTIVE_TRAITS) for (const formation of rules.AI_FORMATION_TRAITS)
    for (const commitment of rules.AI_COMMITMENT_TRAITS) {
      const traits = [motive, formation, commitment];
      const count = rules.chooseAiCommitment(6, [], [], () => .5, traits, { player: 2, ai: 3 });
      const chosen = rules.chooseAiCards(hand, count, [], [], () => .5, traits);
      assert.ok(count >= 1 && count <= 3);
      assert.equal(chosen.length, count);
      assert.equal(new Set(chosen).size, count);
      assert.ok(chosen.every(value => hand.includes(value)));
    }
});

test("10,000 randomized Rally clashes match an independent oracle and reverse symmetrically", () => {
  let seed = 779123;
  const roll = maximum => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) % maximum;
  const formation = () => Array.from({ length: 1 + roll(3) }, () => card(3 + roll(7), roles[roll(4)], elements[roll(3)]));
  const total = (cards, lane, opponent) => {
    const own = cards[lane], previous = cards[lane - 1];
    const role = own.tactic === "vanguard" ? Number(lane === 0)
      : own.tactic === "link" ? Number(lane > 0 && previous.element !== own.element)
        : own.tactic === "finisher" ? Number(cards.length >= 2 && lane === cards.length - 1) : 0;
    const support = Number(cards[lane + 1]?.tactic === "rally");
    const edge = Number((own.element === "ember" && opponent.element === "gust")
      || (own.element === "gust" && opponent.element === "tide")
      || (own.element === "tide" && opponent.element === "ember")) * 2;
    return own.power + role + support + edge;
  };
  for (let trial = 0; trial < 10000; trial++) {
    const player = formation(), opponent = formation();
    const result = rules.resolveClashes(player, opponent), reversed = rules.resolveClashes(opponent, player);
    let ownPoints = Math.max(0, player.length - opponent.length);
    let opposingPoints = Math.max(0, opponent.length - player.length);
    for (let lane = 0; lane < Math.min(player.length, opponent.length); lane++) {
      const p = total(player, lane, opponent[lane]), a = total(opponent, lane, player[lane]);
      assert.equal(result.lanes[lane].player.total, p);
      assert.equal(result.lanes[lane].ai.total, a);
      ownPoints += p > a ? 2 : 0;
      opposingPoints += a > p ? 2 : 0;
    }
    assert.equal(result.score.player, ownPoints);
    assert.equal(result.score.ai, opposingPoints);
    assert.equal(reversed.score.player, opposingPoints);
    assert.equal(reversed.score.ai, ownPoints);
    assert.equal(result.winner, ownPoints === opposingPoints ? "draw" : ownPoints > opposingPoints ? "player" : "ai");
    assert.equal(reversed.winner, result.winner === "draw" ? "draw" : result.winner === "player" ? "ai" : "player");
  }
});
