import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import "../src/rules.js";
import "../src/four-lane-rules.js";
import "../src/deckbuilding.js";

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
  assert.equal(four.ROUND_DRAW, 2);
  assert.equal(four.LANE_WIN_POINTS, 2);
  assert.equal(four.EXTRA_CARD_POINTS, 1);
  assert.equal(four.MAX_EXTRA_CARD_POINTS, 2);
  assert.equal(normal.MAX_COMMITMENT, 3);
  assert.deepEqual(Object.keys(normal.TACTICS), ["vanguard", "link", "finisher"]);
  assert.equal(normal.getTacticBonus([card("gust", 5, "rally")], 0), 0);
});

test("one-card victories have the agreed results against one through four cards", () => {
  for (const [count, winner, points] of [[1, "player", 0], [2, "player", 1], [3, "draw", 2], [4, "draw", 2]]) {
    const result = four.resolveClashes([card("gust", 9)], Array.from({ length: count }, () => card("gust", 3)));
    assert.equal(result.winner, winner);
    assert.equal(result.score.player, 2);
    assert.equal(result.score.ai, points);
  }
});

test("the first two extra cards score, their total is capped, and every other count pairing is unchanged", () => {
  for (let own = 1; own <= 4; own++) for (let opposing = 1; opposing <= 4; opposing++) {
    const perLane = Array.from({ length: own }, (_, index) => four.getExtraCardLanePoints(index, opposing));
    assert.equal(perLane.reduce((sum, points) => sum + points, 0), four.getExtraCardPoints(own, opposing));
    assert.ok(perLane.every(points => points === 0 || points === 1));
    if (Math.abs(own - opposing) <= 2) assert.equal(four.getExtraCardPoints(own, opposing), Math.max(0, own - opposing));
  }
  assert.deepEqual([0, 1, 2, 3].map(index => four.getExtraCardLanePoints(index, 1)), [0, 1, 1, 0]);
});

test("four versus one must draw after a lane loss and still wins after a lane win or draw", () => {
  for (const [power, score, winner, trophyLane] of [[3, 2, "draw", null], [5, 2, "player", 1], [9, 4, "player", 0]]) {
    const player = [card("gust", power), card("tide", 3), card("ember", 3), card("gust", 3)];
    const opponent = [card("gust", 5)];
    const result = four.resolveClashes(player, opponent);
    assert.equal(result.score.player, score);
    assert.equal(result.winner, winner);
    const options = four.getFormationRewardOptions(player, opponent, result);
    assert.equal(options[0]?.lane ?? null, trophyLane);
    assert.equal(options.length, trophyLane === null ? 0 : 1);
    const reverse = four.resolveClashes(opponent, player);
    assert.equal(reverse.winner, winner === "player" ? "ai" : "draw");
    assert.equal(reverse.extraCardPoints.ai, 2);
  }
});

test("Guided previews, forecasts and formation messages show a zero-point third extra card without leaking sealed plans", () => {
  const selected = [card("gust", 5, "vanguard", "1"), card("tide", 4, "rally", "2"),
    card("ember", 4, "rally", "3"), card("gust", 5, "finisher", "4")];
  const context = {
    state: { aiPlan: [card()], aiTellClues: ["full"], selectedCardIds: ["1", "2", "3", "4"],
      playerHand: selected, difficulty: "guided", locked: false },
    tutorial: { active: false }, ELEMENTS: normal.ELEMENTS, EXTRA_CARD_POINTS: 1, ELEMENT_EDGE_BONUS: 2,
    isFourLaneMode: () => true, duelRules: () => four, concealsOpponentFormation: () => false,
    getKnownPlayerTacticBonus: four.getTacticBonus, getTacticBonus: four.getTacticBonus, getRallyBonus: four.getRallyBonus,
    cardRoleDefinition: value => four.TACTICS[value.tactic], getPowerTier: normal.getPowerTier,
    scoreClash: four.scoreClash, getBonusBreakdown: () => ({ total: 0, label: "No bonus" }),
    ui: { matchupForecast: { style: {} } }, renderOpponentTells: () => {},
  };
  context.setMessage = (title, detail) => { context.message = { title, detail }; };
  runInNewContext(["getExtraCardPoints", "getExtraCardLanePoints", "getFormationBonusPreview", "renderMatchupForecast", "updateFormationMessage"]
    .map(sourceFunction).join("\n"), context);
  assert.equal(context.getFormationBonusPreview(selected, 1).text, "+1");
  assert.equal(context.getFormationBonusPreview(selected, 2).text, "+1");
  assert.equal(context.getFormationBonusPreview(selected, 3).text, "+0");
  assert.match(context.getFormationBonusPreview(selected, 3).label, /2-point extra-card cap/);
  context.renderMatchupForecast();
  assert.equal((context.ui.matchupForecast.innerHTML.match(/EXTRA CARD \+1/g) || []).length, 2);
  assert.match(context.ui.matchupForecast.innerHTML, /EXTRA CARD \+0/);
  context.updateFormationMessage();
  assert.match(context.message.detail, /3 extra cards add 2 Round Points \(the 2-point cap\)/);
  context.concealsOpponentFormation = () => true;
  context.renderMatchupForecast();
  const sealed = context.ui.matchupForecast.innerHTML;
  const badge = JSON.stringify(context.getFormationBonusPreview(selected, 3));
  context.state.aiPlan = selected;
  context.renderMatchupForecast();
  assert.equal(context.ui.matchupForecast.innerHTML, sealed);
  assert.equal(JSON.stringify(context.getFormationBonusPreview(selected, 3)), badge);
});

test("played formations label the third extra card +0 while Normal Play keeps +1 extras", () => {
  const context = { isFourLaneMode: () => true, duelRules: () => four, EXTRA_CARD_POINTS: 1,
    cardMarkup: (card, interactive, index, display, bonus, points) => `<b data-points="${points}">${display}</b>` };
  runInNewContext(["getExtraCardLanePoints", "playedCardsMarkup"].map(sourceFunction).join("\n"), context);
  const markup = context.playedCardsMarkup([card(), card(), card(), card()], "player", 1);
  assert.equal((markup.match(/>EXTRA \+1</g) || []).length, 2);
  assert.match(markup, />CAP \+0</);
  context.isFourLaneMode = () => false;
  assert.equal((context.playedCardsMarkup([card(), card(), card()], "player", 1).match(/>EXTRA \+1</g) || []).length, 2);
});

test("the Guided plan heading uses earned extra points, and sealed headings reveal no cap or count", () => {
  const context = {
    state: { difficulty: "guided", aiPlan: [card()], aiTellClues: ["full"], selectedCardIds: ["1", "2", "3", "4"] },
    DIFFICULTIES: { guided: { label: "Guided" }, instinct: { label: "Instinct" } },
    ELEMENTS: normal.ELEMENTS, EXTRA_CARD_POINTS: 1, getPowerTier: normal.getPowerTier,
    isFourLaneMode: () => true, duelRules: () => four, getMaxPlaySize: () => 4,
    concealsOpponentFormation: () => false, renderOpponentHabits() {},
    ui: { tacticsTitle: {}, commitmentHint: {}, opponentTells: {} },
  };
  runInNewContext(["getExtraCardPoints", "renderOpponentTells"].map(sourceFunction).join("\n"), context);
  context.renderOpponentTells();
  assert.match(context.ui.commitmentHint.textContent, /Your 3 extra cards add 2 Round Points \(the 2-point cap\)/);
  context.state.aiPlan = [card(), card(), card(), card()]; context.state.selectedCardIds = ["1"];
  context.renderOpponentTells();
  assert.match(context.ui.commitmentHint.textContent, /3 opposing extra cards add 2 Round Points/);
  context.state.difficulty = "instinct"; context.concealsOpponentFormation = () => true;
  context.renderOpponentTells();
  assert.equal(context.ui.commitmentHint.textContent, "Instinct · Formation size and cards concealed");
  assert.equal(context.ui.opponentTells.innerHTML, "");
  context.state.aiPlan = [card()]; context.renderOpponentTells();
  assert.equal(context.ui.commitmentHint.textContent, "Instinct · Formation size and cards concealed");
});

test("the rules strip and dedicated Four-Lane rules explain the cap without changing Normal Play copy", () => {
  const nodes = { ".arena": { setAttribute() {} }, "#gameTitle": {},
    ".rules-strip .rule-chip.gust": {}, ".rules-strip .rule-chip.tide": {} };
  const context = { state: { gameMode: "four-lane" }, document: { body: { dataset: {} }, querySelector: selector => nodes[selector] },
    isFourLaneMode: () => true, renderGallery() {}, renderFourLaneRivalInfo() {} };
  runInNewContext(sourceFunction("renderDuelMode"), context);
  context.renderDuelMode();
  assert.match(nodes[".rules-strip .rule-chip.gust"].innerHTML, /up to 2 per side per round/);
  context.isFourLaneMode = () => false; context.renderDuelMode();
  assert.equal(nodes[".rules-strip .rule-chip.gust"].innerHTML, "<b>EXTRA</b> Every extra card with no opposing card adds 1 Round Point");
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const fourRules = html.slice(html.indexOf('id="fourLaneRulesDialog"'));
  assert.match(fourRules, /2 extra-card points per side per round/);
  assert.match(fourRules, /Only your first two extra cards score; a third adds 0/);
  assert.match(fourRules, /4 cards against 1 and lose Lane 1.*round draws/);
});

test("all 228 abstract outcomes use symmetric 2-per-win scoring and a two-point extra-card cap", () => {
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
        const playerPoints = playerWins * 2 + Math.min(2, Math.max(0, playerCount - opponentCount));
        const opponentPoints = opponentWins * 2 + Math.min(2, Math.max(0, opponentCount - playerCount));
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

test("Rally only strengthens the directly preceding card, stacks with its role and does not cascade", () => {
  const formation = [card("gust", 4, "vanguard"), card("tide", 4, "rally"), card("ember", 5, "rally")];
  assert.deepEqual(formation.map((_, index) => four.getRallyBonus(formation, index)), [1, 1, 0]);
  assert.deepEqual(formation.map((_, index) => four.getTacticBonus(formation, index)), [1, 0, 0]);
  const resolution = four.resolveClashes(formation, [card("gust"), card("tide"), card("ember")]);
  assert.deepEqual(resolution.lanes.map(lane => lane.player.total), [6, 5, 5]);
  assert.equal(four.getRallyBonus([card("gust", 4, "rally")], 0), 0);
  assert.equal(four.getRallyBonus([card("gust", 4, "rally"), card()], 1), 0);
  assert.equal(four.getRallyBonus(formation, -1), 0);
  assert.equal(four.getRallyBonus(formation, 3), 0);
});

test("Rally can stack with Link, but an active Finisher cannot receive Rally", () => {
  const linked = [card("tide", 4), card("ember", 5, "link"), card("gust", 4, "rally")];
  assert.equal(four.getTacticBonus(linked, 1), 1);
  assert.equal(four.getRallyBonus(linked, 1), 1);
  const finishers = [card("gust", 5, "finisher"), card("tide", 4, "rally"), card("ember", 5, "finisher")];
  assert.equal(four.getTacticBonus(finishers, 0), 0);
  assert.equal(four.getRallyBonus(finishers, 0), 1, "an earlier Finisher receives support but not its own role bonus");
  assert.equal(four.getTacticBonus(finishers, 2), 1);
  assert.equal(four.getRallyBonus(finishers, 2), 0);
});

test("an unopposed Rally supports the preceding clash without changing extra points or trophy eligibility", () => {
  const player = [card("gust", 5, "vanguard"), card("tide", 4, "rally")];
  const opponent = [card("gust", 5, "vanguard")];
  const result = four.resolveClashes(player, opponent);
  assert.equal(result.lanes[0].player.total, 7);
  assert.equal(result.lanes[0].ai.total, 6);
  assert.deepEqual(result.score, { player: 3, ai: 0, draw: 0 });
  assert.equal(result.extraCardPoints.player, 1);
  assert.deepEqual(four.getFormationRewardOptions(player, opponent, result), [
    { winner: "player", card: player[0], lane: 0, fixed: false },
  ]);
  const reverse = four.resolveClashes(opponent, player);
  assert.deepEqual(reverse.score, { player: 0, ai: 3, draw: 0 });
  assert.equal(reverse.lanes[0].ai.total, 7);
});

test("all role and element arrangements receive only immediate backward Rally support", () => {
  const elements = Object.keys(normal.ELEMENTS), roles = ["vanguard", "link", "finisher", "rally"];
  let checked = 0;
  for (let count = 1; count <= 4; count++) for (let code = 0; code < 12 ** count; code++) {
    let remaining = code;
    const cards = Array.from({ length: count }, () => {
      const type = remaining % 12; remaining = Math.floor(remaining / 12);
      return card(elements[type % 3], 5, roles[Math.floor(type / 3)]);
    });
    for (let lane = 0; lane < count; lane++) {
      const rally = four.getRallyBonus(cards, lane), tactic = four.getTacticBonus(cards, lane);
      assert.equal(rally, Number(cards[lane + 1]?.tactic === "rally"));
      assert.ok(rally + tactic <= 2);
      if (cards[lane].tactic === "finisher" && tactic) assert.equal(rally, 0);
      checked++;
    }
  }
  assert.equal(checked, 88428);
});

test("Rally explanations consistently say before, while Role Planner keeps its concise general explanation", () => {
  const description = four.TACTICS.rally.description;
  assert.match(description, /card committed directly before it/);
  assert.match(description, /In Lane 1, Rally gives no bonus/);
  const context = {};
  runInNewContext(gameSource.slice(gameSource.indexOf("const FOUR_LANE_ROLES ="), gameSource.indexOf("const MAX_PLAY_SIZE =")), context);
  assert.equal(runInNewContext("FOUR_LANE_ROLES.rally.description", context), description);
  const planner = four.createAiTraits(() => 0).find(value => value.id === "tactic-planner");
  assert.equal(planner.description, "Favors formations that activate role bonuses.");
  assert.doesNotMatch(planner.description, /Rally/i);
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /Rally gives \+1 Power to the card committed directly before it/);
  assert.match(html, /Rally in Lane 2 boosts Lane 1/);
  assert.doesNotMatch(html + gameSource + description, /Rally[^\n]{0,100}(?:directly after it|No following card|strengthen the next card)/);
});

test("Lane 4 supports Link and Finisher, and unopposed bonuses never multiply extra points", () => {
  const player = [card("gust", 4, "vanguard"), card("tide", 4, "rally"), card("ember", 4, "rally"), card("gust", 5, "link")];
  assert.equal(four.getTacticBonus(player, 3), 1);
  const result = four.resolveClashes(player, [card("gust", 9)]);
  assert.equal(result.extraCardPoints.player, 2);
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
  const opponent = [card("gust", 3)];
  const result = four.resolveClashes(player, opponent);
  assert.deepEqual(four.getFormationRewardOptions(player, opponent, result), [
    { winner: "player", card: player[1], lane: 1, fixed: true },
  ]);
});

test("seven-card opening deals and two-card replenishment respect the hand cap", () => {
  const deck = Array.from({ length: 36 }, (_, index) => card("gust", 5, "none", `player-${index}`));
  const hand = [];
  assert.equal(four.replenishHand(deck, [], hand, 7).drawn, 7);
  assert.equal(deck.length, 29);
  hand.splice(0, 1);
  assert.equal(four.replenishHand(deck, [], hand).drawn, 1);
  hand.splice(0, 4);
  assert.equal(four.replenishHand(deck, [], hand).drawn, 2);
  assert.equal(hand.length, 5);
});

test("four-card pushes spend reserves and legal small plays rebuild up to seven", () => {
  const deck = Array(40).fill(card());
  const hand = Array(7).fill(card());
  for (const [commitment, expected] of [[4, 5], [4, 3], [3, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7]]) {
    assert.ok(commitment <= hand.length);
    hand.splice(0, commitment);
    four.replenishHand(deck, [], hand);
    assert.equal(hand.length, expected);
  }
});

test("two-card formations maintain hand size while repeated three-card formations deplete it", () => {
  const deck = Array(40).fill(card());
  const hand = Array(7).fill(card());
  for (let round = 0; round < 5; round++) {
    hand.splice(0, 2);
    assert.equal(four.replenishHand(deck, [], hand).drawn, 2);
    assert.equal(hand.length, 7);
  }
  for (const expected of [6, 5, 4, 3, 2]) {
    hand.splice(0, 3);
    assert.equal(four.replenishHand(deck, [], hand).drawn, 2);
    assert.equal(hand.length, expected);
  }
});

test("live four-lane refills deal seven initially, then at most two to both players", () => {
  const context = {
    state: { deck: [], discardPile: [], playerHand: [], aiDeck: [], aiDiscardPile: [], aiHand: [] },
    isFourLaneMode: () => true,
    duelRules: () => four,
  };
  const resetDecks = () => {
    context.state.deck = Array.from({ length: 36 }, (_, index) => card("gust", 5, "none", `player-${index}`));
    context.state.aiDeck = Array.from({ length: 36 }, (_, index) => card("gust", 5, "none", `opponent-${index}`));
    context.state.playerHand = [];
    context.state.aiHand = [];
  };
  runInNewContext(sourceFunction("refillHands"), context);
  for (let playerCount = 1; playerCount <= 4; playerCount++) {
    resetDecks();
    assert.equal(context.refillHands(true), false);
    assert.deepEqual([context.state.playerHand.length, context.state.aiHand.length], [7, 7]);
    assert.deepEqual([context.state.deck.length, context.state.aiDeck.length], [29, 29]);
    const opponentCount = 5 - playerCount;
    context.state.playerHand.splice(0, playerCount);
    context.state.aiHand.splice(0, opponentCount);
    context.refillHands();
    assert.equal(context.state.playerHand.length, Math.min(7, 7 - playerCount + 2));
    assert.equal(context.state.aiHand.length, Math.min(7, 7 - opponentCount + 2));
    assert.equal(context.state.deck.length, 29 - Math.min(2, playerCount));
    assert.equal(context.state.aiDeck.length, 29 - Math.min(2, opponentCount));
  }
});

test("Normal Play still refills both hands to six from its shared deck", () => {
  const context = {
    state: { deck: Array.from({ length: 39 }, (_, index) => card("gust", 5, "none", `shared-${index}`)), playerHand: [], aiHand: [] },
    HAND_SIZE: 6,
    isFourLaneMode: () => false,
    duelRules: () => { throw new Error("Normal Play must not use the four-lane draw limit"); },
  };
  context.drawCard = () => ({ card: context.state.deck.pop() || null, reshuffled: false });
  runInNewContext(sourceFunction("refillHands"), context);
  context.refillHands(true);
  assert.deepEqual([context.state.playerHand.length, context.state.aiHand.length, context.state.deck.length], [6, 6, 27]);
  context.state.playerHand.splice(0, 3);
  context.state.aiHand.splice(0, 4);
  context.refillHands();
  assert.deepEqual([context.state.playerHand.length, context.state.aiHand.length, context.state.deck.length], [6, 6, 20]);
});

test("four-lane lobby and rules explain two-card draws and the reserve tradeoff", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const lobby = html.slice(html.indexOf('<section class="four-lane-launch"'), html.indexOf('<section class="four-lane-card-showcase"'));
  const rules = html.slice(html.indexOf('<div class="four-lane-rules-content"'));
  assert.match(lobby, /Start with 7.*draw up to 2 between rounds.*exceeding 7/);
  assert.match(rules, /each draws up to 2.*exceeding 7/);
  assert.match(rules, /Commit 2 cards to maintain.*Commit 3 or 4 to spend 1 or 2.*Commit 1 to rebuild/);
  assert.doesNotMatch(lobby + rules, /draw up to 3/);
});

test("only the owner's empty deck reshuffles and trophy cards stay outside circulation", () => {
  const playerDeck = [card("gust", 4, "none", "player-a")];
  const playerDiscard = [card("ember", 5, "none", "player-b")];
  const opponentDiscard = [card("tide", 6, "none", "opponent-a")];
  const playerHand = [];
  const before = JSON.stringify(opponentDiscard);
  assert.equal(four.replenishHand(playerDeck, playerDiscard, playerHand, 1).reshuffled, false);
  assert.equal(playerDiscard.length, 1);
  assert.equal(four.replenishHand(playerDeck, playerDiscard, playerHand, four.ROUND_DRAW, () => 0).reshuffled, true);
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
  const pair = four.orderAiFormation([hand[0], hand[3]], () => 0, trait("tactic-planner"));
  assert.equal(pair[0].tactic, "vanguard");
  assert.equal(pair[1].tactic, "rally");
});

test("four-lane concealment returns four sealed clues and Guided has four positions", () => {
  assert.deepEqual(four.buildTellClues(1, "blind"), Array(4).fill("sealed"));
  assert.deepEqual(four.buildTellClues(4, "instinct"), Array(4).fill("sealed"));
  assert.deepEqual(four.buildTellClues(2, "guided"), ["full", "full", "empty", "empty"]);
});

test("live personal decks use 24 validated cards, allow duplicate templates and keep owner-specific identities", () => {
  const cardDefinitions = runInNewContext([
    gameSource.slice(gameSource.indexOf("const CARD_LIBRARY ="), gameSource.indexOf("const HAND_SIZE =")),
    gameSource.slice(gameSource.indexOf("const FOUR_LANE_RALLY_CARDS ="), gameSource.indexOf("const DIFFICULTIES =")),
    "[...CARD_LIBRARY, ...FOUR_LANE_CARDS]",
  ].join("\n"));
  const constructedDecks = globalThis.ClawDeckbuilding;
  const fourLaneDeckCatalog = constructedDecks.createCardCatalog(cardDefinitions);
  const fourLaneStarterDecks = constructedDecks.createStarterPresets(fourLaneDeckCatalog);
  const context = { shuffle: cards => cards, constructedDecks, fourLaneDeckCatalog, fourLaneStarterDecks,
    matchFourLaneDeck: fourLaneStarterDecks[0], matchFourLaneOpponent: { deck: fourLaneStarterDecks[0] } };
  runInNewContext(sourceFunction("freshPersonalDeck"), context);
  const player = JSON.parse(runInNewContext('JSON.stringify(freshPersonalDeck("player"))', context));
  const opponent = JSON.parse(runInNewContext('JSON.stringify(freshPersonalDeck("opponent"))', context));
  assert.equal(player.length, 24);
  assert.equal(new Set(player.map(value => value.instanceId)).size, 24);
  assert.ok(new Set(player.map(value => value.art)).size < 24);
  for (const element of ["ember", "gust", "tide"]) {
    for (const role of ["vanguard", "link", "finisher", "rally"]) {
      assert.equal(player.filter(value => value.element === element && value.tactic === role).length, 2);
    }
  }
  const ids = new Set(player.map(value => value.instanceId));
  assert.ok(opponent.every(value => !ids.has(value.instanceId)));
});

test("bonus explanations include incoming Rally separately from the card's own role", () => {
  const context = {};
  runInNewContext(sourceFunction("getBonusBreakdown"), context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.getBonusBreakdown({ edge: 2, tactic: 1, tacticName: "Vanguard", rally: 1 }))), {
    total: 4, label: "Element Edge +2, Vanguard +1, Rally received +1",
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
    const history = [];
    sides.forEach(side => four.replenishHand(side.deck, side.discard, side.hand, four.HAND_SIZE, random));
    let completed = false;
    for (let round = 0; round < 300; round++) {
      const [player, opponent] = sides;
      const playerCount = Math.min(player.hand.length, match % 5 === 4 ? 1 + Math.floor(random() * 4) : 1 + match % 5);
      const formations = [
        four.chooseAiCards(player.hand, playerCount, opponent.trophies, player.trophies, random),
        four.chooseAiFormation(opponent.hand, player.trophies, opponent.trophies, random, traits,
          { history, cardLibrary: library }),
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
      history.push({ playerCards: formations[0], aiCards: formations[1] });
      if (sides.some(side => normal.hasCompletedElementSet(side.trophies))) { completed = true; break; }
      sides.forEach(side => {
        reshuffles += Number(four.replenishHand(side.deck, side.discard, side.hand, four.ROUND_DRAW, random).reshuffled);
        assert.ok(side.hand.length >= 1 && side.hand.length <= 7);
      });
    }
    assert.equal(completed, true, `seeded match ${match} should reach the trophy goal`);
  }
  assert.ok(reshuffles > 0, "long duels must exercise owner-specific recycling");
});

test("four-lane compact layouts reserve controls and contain result labels", () => {
  const css = readFileSync(new URL("../four-lane-preview.css", import.meta.url), "utf8");
  assert.match(css, /body\[data-duel-mode="four-lane"\] \.control-panel \{[^}]*grid-template-rows: auto minmax\(0, auto\) auto auto;[^}]*align-content: center;/);
  assert.match(css, /body\[data-duel-mode="four-lane"\] \.control-panel \.tactics-board \{[^}]*overflow-y: auto;/);
  assert.match(css, /body\[data-duel-mode="four-lane"\] \.lane-result \{[^}]*min-width: 0;[^}]*width: 100%;/);
});

test("four-lane deck status uses Normal Play's compact row and clears mode-specific tooltips", () => {
  const context = {
    state: { gameMode: "four-lane", round: 2, deck: Array(26), discardPile: Array(3), playerHand: Array(4) },
    tutorial: { active: false, phase: "idle" },
    ui: {
      roundLabel: {},
      deckStatusText: { removeAttribute(name) { delete this[name]; } },
    },
    document: { querySelector: () => ({}) },
    duelRules: () => four,
  };
  context.isFourLaneMode = () => context.state.gameMode === "four-lane";
  runInNewContext(sourceFunction("renderRound"), context);
  context.renderRound();
  const fourLaneMarkup = context.ui.deckStatusText.innerHTML;
  assert.equal(fourLaneMarkup, '<strong id="deckCount">26</strong> cards in draw pile · 3 discarded');
  assert.match(context.ui.deckStatusText.title, /4\/7 cards in hand.*Draw up to 2.*Only your own empty deck reshuffles/);

  context.state.gameMode = "normal";
  context.renderRound();
  assert.equal(context.ui.deckStatusText.innerHTML, fourLaneMarkup);
  assert.equal(context.ui.deckStatusText.title, undefined);

  context.ui.deckStatusText.title = "stale four-lane information";
  context.tutorial.active = true;
  context.tutorial.phase = "tour";
  context.renderRound();
  assert.equal(context.ui.roundLabel.textContent, "INTERFACE TOUR");
  assert.equal(context.ui.deckStatusText.title, undefined);
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
