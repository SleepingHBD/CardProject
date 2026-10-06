import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import "../src/rules.js";
import "../src/four-lane-rules.js";

const normal = globalThis.ClawRules;
const four = globalThis.ClawFourLaneRules;
const card = (element = "gust", power = 5, tactic = "none", instanceId = "test") => ({ element, power, tactic, instanceId });
const trait = id => [{ id }];
const gameSource = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const sourceFunction = name => {
  const start = gameSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1);
  return gameSource.slice(start, gameSource.indexOf("\n}", start) + 2);
};

test("four-lane constants and roles are isolated from Normal Play", () => {
  assert.equal(four.MAX_COMMITMENT, 4);
  assert.equal(four.HAND_SIZE, 7);
  assert.equal(four.ROUND_DRAW, 3);
  assert.equal(four.LANE_WIN_POINTS, 2);
  assert.equal(four.EXTRA_CARD_POINTS, 1);
  assert.equal(normal.MAX_COMMITMENT, 3);
  assert.deepEqual(Object.keys(normal.TACTICS), ["vanguard", "link", "finisher"]);
  assert.equal(normal.getTacticBonus([card("gust", 5, "rally")], 0), 0);
});

test("one-card victories have the agreed results against one through four cards", () => {
  for (const [count, winner, points] of [[1, "player", 0], [2, "player", 1], [3, "draw", 2], [4, "ai", 3]]) {
    const result = four.resolveClashes([card("gust", 9)], Array.from({ length: count }, () => card("gust", 3)));
    assert.equal(result.winner, winner);
    assert.equal(result.score.player, 2);
    assert.equal(result.score.ai, points);
  }
});

test("all 228 abstract outcomes use symmetric 2-per-win and unconditional 1-per-extra scoring", () => {
  let checked = 0;
  for (let playerCount = 1; playerCount <= 4; playerCount++) {
    for (let opponentCount = 1; opponentCount <= 4; opponentCount++) {
      const paired = Math.min(playerCount, opponentCount);
      for (let variant = 0; variant < 3 ** paired; variant++) {
        const player = Array.from({ length: playerCount }, () => card());
        const opponent = Array.from({ length: opponentCount }, () => card());
        let code = variant, playerWins = 0, opponentWins = 0;
        for (let lane = 0; lane < paired; lane++) {
          const outcome = code % 3;
          code = Math.floor(code / 3);
          if (outcome === 1) { player[lane].power++; playerWins++; }
          if (outcome === 2) { opponent[lane].power++; opponentWins++; }
        }
        const resolution = four.resolveClashes(player, opponent);
        const playerPoints = playerWins * 2 + Math.max(0, playerCount - opponentCount);
        const opponentPoints = opponentWins * 2 + Math.max(0, opponentCount - playerCount);
        assert.equal(resolution.score.player, playerPoints);
        assert.equal(resolution.score.ai, opponentPoints);
        assert.equal(resolution.winner, playerPoints === opponentPoints ? "draw" : playerPoints > opponentPoints ? "player" : "ai");
        const reverse = four.resolveClashes(opponent, player);
        assert.equal(reverse.score.player, resolution.score.ai);
        assert.equal(reverse.score.ai, resolution.score.player);
        const options = four.getFormationRewardOptions(player, opponent, resolution);
        if (resolution.winner === "draw") assert.deepEqual(options, []);
        else {
          assert.ok(options.length > 0);
          const wins = resolution.results.filter(winner => winner === resolution.winner).length;
          assert.equal(options.length, wins || 1);
          for (const option of options) {
            assert.equal(option.fixed, wins === 0);
            if (wins) assert.equal(resolution.results[option.lane], resolution.winner);
            else assert.equal(option.lane, paired);
          }
        }
        checked++;
      }
    }
  }
  assert.equal(checked, 228);
});

test("invalid empty or five-card formations cannot bypass the mode limits", () => {
  assert.throws(() => four.resolveClashes([], [card()]), RangeError);
  assert.throws(() => four.resolveClashes([card()], Array(5).fill(card())), RangeError);
});

test("Rally only strengthens the directly following card, stacks with its role and does not cascade", () => {
  const formation = [card("gust", 4, "rally"), card("tide", 4, "rally"), card("ember", 5, "finisher")];
  assert.deepEqual(formation.map((_, index) => four.getRallyBonus(formation, index)), [0, 1, 1]);
  assert.deepEqual(formation.map((_, index) => four.getTacticBonus(formation, index)), [0, 0, 1]);
  const resolution = four.resolveClashes(formation, [card("gust"), card("tide"), card("ember")]);
  assert.deepEqual(resolution.lanes.map(lane => lane.player.total), [4, 5, 7]);
  assert.equal(four.getRallyBonus([card("gust", 4, "rally")], 0), 0);
  assert.equal(four.getRallyBonus(formation, 3), 0);
});

test("Lane 4 supports Link and Finisher, and unopposed bonuses never multiply extra points", () => {
  const player = [card("gust", 4, "vanguard"), card("tide", 4, "rally"), card("ember", 4, "rally"), card("gust", 5, "link")];
  assert.equal(four.getTacticBonus(player, 3), 1);
  const result = four.resolveClashes(player, [card("gust", 9)]);
  assert.equal(result.extraCardPoints.player, 3);
  assert.equal(four.getTacticBonus([card(), card("gust", 5, "finisher")], 1), 1);
  assert.equal(four.getTacticBonus([card("gust", 5, "finisher")], 0), 0);
});

test("an extra-points victory with a won lane still requires the lane-winning trophy", () => {
  const player = [card("gust", 9), card("gust", 3), card("gust", 3), card("gust", 3)];
  const opponent = [card("gust", 3), card("gust", 9)];
  const result = four.resolveClashes(player, opponent);
  assert.equal(result.decidedBy, "extra-cards");
  const options = four.getFormationRewardOptions(player, opponent, result);
  assert.deepEqual(options, [{ winner: "player", card: player[0], lane: 0, fixed: false }]);
  // Normal Play deliberately retains its old trophy eligibility.
  const normalResult = normal.resolveClashes(player.slice(0, 3), opponent);
  assert.equal(normal.getFormationRewardOptions(player.slice(0, 3), opponent, normalResult)[0].lane, 2);
});

test("a no-lane-win victory claims the first unopposed card, never another extra card", () => {
  const player = [card("gust", 3), card("tide", 4), card("ember", 6), card("gust", 9)];
  const opponent = [card("gust", 9)];
  const result = four.resolveClashes(player, opponent);
  assert.deepEqual(four.getFormationRewardOptions(player, opponent, result), [
    { winner: "player", card: player[1], lane: 1, fixed: true },
  ]);
});

test("seven-card opening deals and three-card replenishment respect the hand cap", () => {
  const deck = Array.from({ length: 36 }, (_, index) => card("gust", 5, "none", `player-${index}`));
  const hand = [];
  assert.equal(four.replenishHand(deck, [], hand, 7).drawn, 7);
  assert.equal(deck.length, 29);
  hand.splice(0, 1);
  assert.equal(four.replenishHand(deck, [], hand).drawn, 1);
  hand.splice(0, 4);
  assert.equal(four.replenishHand(deck, [], hand).drawn, 3);
  assert.equal(hand.length, 6);
});

test("four-card pushes run down 7 to 6 to 5 to 4 to 3; small plays rebuild reserves", () => {
  const deck = Array(40).fill(card());
  const hand = Array(7).fill(card());
  for (const expected of [6, 5, 4, 3]) {
    hand.splice(0, 4);
    four.replenishHand(deck, [], hand);
    assert.equal(hand.length, expected);
  }
  hand.splice(0, 1);
  four.replenishHand(deck, [], hand);
  assert.equal(hand.length, 5);
});

test("only the owner's empty deck reshuffles and trophy cards stay outside circulation", () => {
  const playerDeck = [card("gust", 4, "none", "player-a")];
  const playerDiscard = [card("ember", 5, "none", "player-b")];
  const opponentDiscard = [card("tide", 6, "none", "opponent-a")];
  const playerHand = [];
  const before = JSON.stringify(opponentDiscard);
  assert.equal(four.replenishHand(playerDeck, playerDiscard, playerHand, 1).reshuffled, false);
  assert.equal(playerDiscard.length, 1);
  assert.equal(four.replenishHand(playerDeck, playerDiscard, playerHand, 3, () => 0).reshuffled, true);
  assert.equal(playerDiscard.length, 0);
  assert.equal(JSON.stringify(opponentDiscard), before);
  assert.ok(playerHand.every(value => value.instanceId.startsWith("player-")));
});

test("four-lane habits create legal commitments including four, and Full Formation can recover", () => {
  assert.equal(four.chooseAiCommitment(7, [], [], () => .7, trait("full-formation")), 4);
  assert.equal(four.chooseAiCommitment(4, [], [], () => .5, trait("full-formation")), 2);
  assert.equal(four.chooseAiCommitment(7, [], [], () => .5, trait("solo-gambler")), 2);
  assert.equal(four.chooseAiCommitment(7, [], [], () => .5, trait("measured-planner")), 2);
  assert.equal(four.chooseAiCommitment(7, [], [], () => .5, trait("echo-tactician"), { player: 4 }), 4);
  for (const id of normal.AI_COMMITMENT_TRAITS.map(value => value.id)) {
    for (let hand = 0; hand <= 7; hand++) {
      for (let sample = 0; sample < 100; sample++) {
        const count = four.chooseAiCommitment(hand, [], [], () => sample / 100, trait(id), { player: 4, ai: 3 });
        assert.ok(count >= Math.min(1, hand) && count <= Math.min(4, hand));
      }
    }
  }
  assert.match(four.createAiTraits(() => .5).find(value => value.category === "formation").description, /./);
});

test("AI orders Rally and picks up to four unique cards without mutating its hand", () => {
  const hand = [card("gust", 4, "rally", "1"), card("ember", 6, "finisher", "2"), card("tide", 5, "link", "3"), card("gust", 4, "vanguard", "4")];
  const before = JSON.stringify(hand);
  const result = four.chooseAiCards(hand, 4, [], [], () => 0, trait("tactic-planner"));
  assert.equal(result.length, 4);
  assert.equal(new Set(result.map(value => value.instanceId)).size, 4);
  assert.equal(JSON.stringify(hand), before);
  const pair = four.orderAiFormation(hand.slice(0, 2), () => 0, trait("tactic-planner"));
  assert.equal(pair[0].tactic, "rally");
  assert.equal(pair[1].tactic, "finisher");
});

test("four-lane concealment returns four sealed clues and Guided has four positions", () => {
  assert.deepEqual(four.buildTellClues(1, "blind"), Array(4).fill("sealed"));
  assert.deepEqual(four.buildTellClues(4, "instinct"), Array(4).fill("sealed"));
  assert.deepEqual(four.buildTellClues(2, "guided"), ["full", "full", "empty", "empty"]);
});

test("live personal starter decks contain all 36 cards, balanced roles, and owner-specific identities", () => {
  const context = { shuffle: cards => cards };
  runInNewContext([
    gameSource.slice(gameSource.indexOf("const CARD_LIBRARY ="), gameSource.indexOf("const HAND_SIZE =")),
    gameSource.slice(gameSource.indexOf("const FOUR_LANE_RALLY_CARDS ="), gameSource.indexOf("const DIFFICULTIES =")),
    sourceFunction("freshPersonalDeck"),
  ].join("\n"), context);
  const player = JSON.parse(runInNewContext('JSON.stringify(freshPersonalDeck("player"))', context));
  const opponent = JSON.parse(runInNewContext('JSON.stringify(freshPersonalDeck("opponent"))', context));
  assert.equal(player.length, 36);
  assert.equal(new Set(player.map(value => value.art)).size, 36);
  for (const element of ["ember", "gust", "tide"]) {
    for (const role of ["vanguard", "link", "finisher", "rally"]) {
      assert.equal(player.filter(value => value.element === element && value.tactic === role).length, 3);
    }
  }
  const ids = new Set(player.map(value => value.instanceId));
  assert.ok(opponent.every(value => !ids.has(value.instanceId)));
});

test("bonus explanations include incoming Rally separately from the card's own role", () => {
  const context = {};
  runInNewContext(sourceFunction("getBonusBreakdown"), context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.getBonusBreakdown({ edge: 2, tactic: 1, tacticName: "Finisher", rally: 1 }))), {
    total: 4, label: "Element Edge +2, Finisher +1, Rally received +1",
  });
});

test("100 seeded complete duels conserve each personal deck and exclude trophies from reshuffles", () => {
  const context = {};
  runInNewContext([
    gameSource.slice(gameSource.indexOf("const CARD_LIBRARY ="), gameSource.indexOf("const HAND_SIZE =")),
    gameSource.slice(gameSource.indexOf("const FOUR_LANE_RALLY_CARDS ="), gameSource.indexOf("const DIFFICULTIES =")),
  ].join("\n"), context);
  const library = JSON.parse(runInNewContext("JSON.stringify([...CARD_LIBRARY, ...FOUR_LANE_CARDS])", context));
  let reshuffles = 0;
  for (let match = 0; match < 100; match++) {
    let seed = match + 1;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    const sides = ["player", "ai"].map(side => {
      const deck = [];
      normal.reshuffleDiscardPile(deck, library.map((value, index) => ({ ...value, instanceId: `${side}-${index}` })), random);
      return { deck, discard: [], hand: [], trophies: [] };
    });
    const traits = four.createAiTraits(random);
    const previous = {};
    sides.forEach(side => four.replenishHand(side.deck, side.discard, side.hand, 7, random));
    let completed = false;
    for (let round = 0; round < 300; round++) {
      const [player, opponent] = sides;
      const playerCount = Math.min(player.hand.length, match % 5 === 4 ? 1 + Math.floor(random() * 4) : 1 + match % 5);
      const opponentCount = four.chooseAiCommitment(opponent.hand.length, player.trophies, opponent.trophies, random, traits, previous);
      const formations = [
        four.chooseAiCards(player.hand, playerCount, opponent.trophies, player.trophies, random),
        four.chooseAiCards(opponent.hand, opponentCount, player.trophies, opponent.trophies, random, traits),
      ];
      const resolution = four.resolveClashes(...formations);
      const options = four.getFormationRewardOptions(...formations, resolution);
      const winnerIndex = resolution.winner === "player" ? 0 : 1;
      const reward = options.length ? normal.chooseTrophyReward(options, sides[winnerIndex].trophies) : null;
      sides.forEach((side, index) => {
        side.hand = side.hand.filter(value => !formations[index].includes(value));
        side.discard.push(...formations[index].filter(value => value !== reward?.card));
        if (reward && index === winnerIndex) side.trophies.push(reward.card);
        const all = [...side.deck, ...side.discard, ...side.hand, ...side.trophies];
        assert.equal(all.length, 36, `match ${match}, round ${round}, side ${index}`);
        assert.equal(new Set(all.map(value => value.instanceId)).size, 36);
        assert.ok(all.every(value => value.instanceId.startsWith(index === 0 ? "player-" : "ai-")));
      });
      if (sides.some(side => normal.hasCompletedElementSet(side.trophies))) { completed = true; break; }
      sides.forEach(side => {
        reshuffles += Number(four.replenishHand(side.deck, side.discard, side.hand, 3, random).reshuffled);
        assert.ok(side.hand.length >= 1 && side.hand.length <= 7);
      });
      previous.player = playerCount;
      previous.ai = opponentCount;
    }
    assert.equal(completed, true, `seeded match ${match} should reach the trophy goal`);
  }
  assert.ok(reshuffles > 0, "long duels must exercise owner-specific recycling");
});

test("four-lane compact layouts reserve controls and contain result labels", () => {
  const css = readFileSync(new URL("../four-lane-preview.css", import.meta.url), "utf8");
  assert.match(css, /body\[data-duel-mode="four-lane"\] \.control-panel \{[^}]*grid-template-rows: auto minmax\(0, 1fr\) auto auto;/);
  assert.match(css, /body\[data-duel-mode="four-lane"\] \.control-panel \.tactics-board \{[^}]*overflow-y: auto;/);
  assert.match(css, /body\[data-duel-mode="four-lane"\] \.lane-result \{[^}]*min-width: 0;[^}]*width: 100%;/);
});

test("committed four-lane controls do not advertise a new three-card formation during clashes", () => {
  const context = {
    state: { selectedCardIds: [], locked: true, dealing: false }, tutorial: { active: false },
    ui: { selectionCount: {}, playSelectedButton: {} },
    isFourLaneMode: () => true, getPlayerFormationLimit: () => 3, renderMatchupForecast: () => {},
  };
  runInNewContext(sourceFunction("updateSelectionControls"), context);
  context.updateSelectionControls();
  assert.equal(context.ui.selectionCount.textContent, "Formation committed");
  assert.equal(context.ui.playSelectedButton.textContent, "Resolving lanes…");
  assert.equal(context.ui.playSelectedButton.disabled, true);
});
