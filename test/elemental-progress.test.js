import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import "../src/rules.js";
import "../src/four-lane-rules.js";

const normal = globalThis.ClawRules, rules = globalThis.ClawFourLaneRules;
const source = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const fn = name => {
  const result = source.match(new RegExp(`(?:async )?function ${name}\\([\\s\\S]*?\\n\\}`))?.[0];
  assert.ok(result, name); return result;
};
const card = (element, power = 5, tactic = "none") => Object.freeze({ element, power, tactic, art: "qa", name: "QA" });
const progress = (ember = 0, gust = 0, tide = 0) => ({ ember, gust, tide });

test("WIP trophy labels pluralize counts without changing Normal Play Round Points", () => {
  const context = { isFourLaneMode: () => true };
  runInNewContext(fn("roundPointLabel"), context);
  assert.equal(context.roundPointLabel(0), "trophies");
  assert.equal(context.roundPointLabel(1), "trophy");
  assert.equal(context.roundPointLabel(2), "trophies");
  context.isFourLaneMode = () => false;
  assert.equal(context.roundPointLabel(1), "Round Point");
  assert.equal(context.roundPointLabel(2), "Round Points");
});

test("lobby and trophy counters explain lane-earned trophies and preserve work-in-progress labels", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("../four-lane-preview.css", import.meta.url), "utf8");
  const deck = readFileSync(new URL("../src/deckbuilding.js", import.meta.url), "utf8");
  const lobby = html.slice(html.indexOf('<details class="four-lane-basics"'), html.indexOf('<section class="four-lane-card-showcase"'));
  assert.match(lobby, /\+2<\/b> trophies of your card's element/);
  assert.match(lobby, /\+1<\/b> trophy of that card's element · one unlock per lane win · max\. 2/);
  assert.match(lobby, /(?:lane win|victory).*unlocks|unopposed.*(?:lane win|victory)/i);
  assert.match(lobby, /<b>8<\/b> rounds/);
  assert.match(lobby, /(?:complete set|Fire.*Gust.*Water)[\s\S]*\+2|\+2[\s\S]*(?:complete set|Fire.*Gust.*Water)/i);
  assert.match(lobby, /(?:both hands|opponent's hand|hands are visible)/i);
  assert.match(lobby, /(?:Battle Lane|battle lane)/);
  assert.match(lobby, /Unlike Normal Play, there is no trophy choice/);
  assert.match(lobby, /all committed cards stay in their owner's deck cycle/);
  assert.doesNotMatch(lobby, /\bprogress\b/i);
  assert.doesNotMatch(css, /content: "TROPHIES · 6 EACH"/);
  assert.doesNotMatch(css, /content: "PROGRESS/);
  assert.match(deck, /changing plans with the visible hands/);
  assert.match(deck, /complete-set bonuses/);
  assert.match(html, /Work in progress/);
});

test("split lanes award both sides their own winning elements, independent of a round winner", () => {
  const result = rules.resolveProgress([card("ember", 9), card("gust", 3)],
    [card("ember", 3), card("gust", 9), card("tide", 3)]);
  assert.deepEqual(result.progressGains, { player: progress(2), ai: progress(0, 2, 1) });
  assert.deepEqual(result.laneProgress, { player: [2, 0, 0, 0], ai: [0, 2, 1, 0] });
  assert.equal(result.matchWinner, null);
  assert.deepEqual(rules.getFormationRewardOptions(), []);
});

test("trophies stay uncapped and extra cards use lane order without skipping elements", () => {
  const result = rules.resolveProgress([card("ember", 9), card("ember", 9), card("gust", 3), card("tide", 3)],
    [card("ember", 3)], progress(5, 6, 5));
  assert.deepEqual(result.laneProgress.player, [2, 1, 0, 0]);
  assert.deepEqual(result.progressAfter.player, progress(8, 6, 5));
  assert.equal(result.matchWinner, null, "trophies do not end the match before Round 8");
  assert.equal(result.score.player, 3);
});

test("a repeated element still earns its complete lane victory reward", () => {
  const result = rules.resolveProgress([card("ember", 9)], [card("gust", 3)], progress(6));
  assert.equal(result.results[0], "player");
  assert.deepEqual(result.progressGains, { player: progress(2), ai: progress() });
  assert.deepEqual(result.progressAfter.player, progress(8));
});

test("ties earn nothing; both sides resolve before the eighth-round score comparison", () => {
  const tied = rules.resolveProgress([card("tide")], [card("tide")]);
  assert.deepEqual(tied.progressGains, { player: progress(), ai: progress() });
  const result = rules.resolveProgress([card("ember", 9), card("tide", 3)],
    [card("ember", 3), card("tide", 9)], progress(4, 6, 6), progress(6, 6, 4));
  assert.deepEqual(result.results, ["player", "ai", "empty", "empty"]);
  assert.deepEqual(result.progressAfter, { player: progress(6, 6, 6), ai: progress(6, 6, 6) });
  assert.equal(result.matchWinner, null);
  assert.equal(rules.getProgressMatchWinner(result.progressAfter.player, result.progressAfter.ai, 8), "draw");
});

test("eight-round scoring rewards complete sets without requiring all three elements", () => {
  assert.equal(rules.getProgressMatchWinner(progress(100, 100, 5), progress()), null);
  assert.equal(rules.getProgressMatchWinner(progress(6, 6, 6), progress()), null);
  assert.equal(rules.getProgressMatchWinner(progress(6, 6, 6), progress(), 8), "player");
  assert.equal(rules.getProgressMatchWinner(progress(), progress(6, 6, 6), 8), "ai");
  assert.equal(rules.getProgressMatchWinner(progress(100), progress(6, 6, 6), 8), "player");
  assert.deepEqual(rules.getElementProgress({ ember: -1, gust: 2.9, tide: NaN }), progress(0, 2));
});

test("10,000 seeded formations agree with an independent scoring oracle and side reversal", () => {
  let seed = 74329;
  const roll = n => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) % n;
  const elements = ["ember", "gust", "tide"], roles = ["vanguard", "link", "finisher", "rally"];
  const beats = { ember: "gust", gust: "tide", tide: "ember" };
  const oracle = (a, b, pa, pb) => {
    a = [...a, ...Array(4 - a.length).fill(null)]; b = [...b, ...Array(4 - b.length).fill(null)];
    const values = (cards, other) => cards.map((c, i) => !c ? 0 : c.power
      + (c.tactic === "vanguard" && cards.filter(Boolean).length >= 2 && i === cards.findIndex(Boolean)
        || c.tactic === "link" && cards[i - 1] && cards[i - 1].element !== c.element
        || c.tactic === "finisher" && cards.filter(Boolean).length >= 2 && i === cards.findLastIndex(Boolean) ? 1 : 0)
      + Number(cards[i + 1]?.tactic === "rally") + (other[i] && beats[c.element] === other[i].element ? 2 : 0));
    const aa = values(a, b), bb = values(b, a), out = [{ ...pa }, { ...pb }], credited = [Array(4).fill(0), Array(4).fill(0)];
    for (const [side, cards, other] of [[0, a, b], [1, b, a]]) {
      let wins = 0;
      cards.forEach((c, i) => {
        if (!c || !other[i] || !(side === 0 ? aa[i] > bb[i] : bb[i] > aa[i])) return;
        wins++; const gain = 2;
        out[side][c.element] += gain; credited[side][i] = gain;
      });
      for (let i = 0, used = 0; i < 4 && used < Math.min(2, wins); i++) {
        const c = cards[i]; if (!c || other[i]) continue;
        used++; out[side][c.element]++; credited[side][i] = 1;
      }
    }
    return { out, credited };
  };
  for (let sample = 0; sample < 10000; sample++) {
    const formations = [0, 1].map(() => Array.from({ length: roll(4) + 1 }, () => card(elements[roll(3)], roll(7) + 3, roles[roll(4)])));
    const goals = [0, 1].map(() => progress(roll(7), roll(7), roll(7)));
    const before = JSON.stringify([formations, goals]);
    const expected = oracle(...formations, ...goals), result = rules.resolveProgress(...formations, ...goals);
    assert.deepEqual(result.progressAfter, { player: expected.out[0], ai: expected.out[1] });
    assert.deepEqual(result.laneProgress, { player: expected.credited[0], ai: expected.credited[1] });
    const reversed = rules.resolveProgress(formations[1], formations[0], goals[1], goals[0]);
    assert.deepEqual(reversed.progressAfter.player, result.progressAfter.ai);
    assert.deepEqual(reversed.progressAfter.ai, result.progressAfter.player);
    assert.equal(reversed.matchWinner, result.matchWinner === "player" ? "ai" : result.matchWinner === "ai" ? "player" : result.matchWinner);
    assert.equal(JSON.stringify([formations, goals]), before);
  }
});

function node() {
  return { innerHTML: "", textContent: "", title: "", attributes: {}, hidden: false,
    setAttribute(key, value) { this.attributes[key] = value; }, removeAttribute(key) { delete this.attributes[key]; } };
}

test("board results distinguish unlocked and unfunded cards without completed-element clipping", () => {
  const cards = [card("ember", 9), card("ember", 4), card("gust", 4), card("tide", 4)];
  const result = rules.resolveProgress(cards, [card("ember", 3)], progress(5, 0, 0));
  const lanes = cards.map(() => {
    const label = node(), badge = node();
    label.innerHTML = "WIN 9–3";
    badge.innerHTML = "BONUS +2";
    return { label, badge, querySelector: selector => selector === ".lane-result" ? label : badge };
  });
  const context = { ELEMENTS: normal.ELEMENTS, getExtraCardLanePoints: rules.getExtraCardLanePoints, duelRules: () => rules,
    ui: { playerPlayZone: { querySelectorAll: () => lanes }, aiPlayZone: { querySelectorAll: () => [] } } };
  context.physicalLaneElements = zone => zone === context.ui.playerPlayZone ? lanes : [];
  runInNewContext(fn("renderProgressLaneResults"), context);
  context.renderProgressLaneResults(cards, [card("ember", 3)], result);
  assert.match(lanes[0].label.innerHTML, /\+2 FIRE TROPHIES/);
  assert.equal(lanes[0].badge.innerHTML, "BONUS +2");
  assert.equal(lanes[1].label.textContent, "UNOPPOSED +1 FIRE");
  assert.match(lanes[1].badge.attributes["aria-label"], /Unlocked by a lane win/);
  assert.equal(lanes[2].label.textContent, "NO REWARD +0");
  assert.equal(lanes[3].label.textContent, "NO REWARD +0");
  assert.match(lanes[3].badge.attributes["aria-label"], /Earlier cards used your unlocks/);
  assert.ok(lanes.every(lane => !/COMPLETE/.test(lane.label.textContent)));
});

test("live completion records detached progress, recycles every card, skips trophy claims and permits duel draws", () => {
  const a = [card("ember", 9), null, card("tide", 3), null], b = [card("ember", 3), null, card("tide", 9), null];
  const resolution = rules.resolveProgress(a, b, progress(4, 6, 6), progress(6, 6, 4));
  const state = { gameMode: "four-lane", round: 8, difficulty: "blind", playerWins: [], aiWins: [],
    previousRoundsHistory: [], discardPile: [], aiDiscardPile: [], playerRoundWins: 0, aiRoundWins: 0,
    dryProgressRounds: 0, matchDrawReason: null };
  const calls = {}, context = { state, structuredClone, ELEMENTS: normal.ELEMENTS, duelRules: () => rules,
    getElementTrophyCounts: normal.getElementTrophyCounts,
    ui: { versusBadge: node(), playerCollection: {}, aiCollection: {}, menuButton: { disabled: true } },
    clearTrophyClaim: () => { calls.clear = true; }, renderPreviousRoundsHistory() {},
    renderProgressLaneResults() {}, renderCollection() {}, renderRound() {}, renderRoundScore() {},
    renderOpponentTells() { calls.publicHandDiscardCount = state.aiDiscardPile.length; },
    renderAftermathBreakdown() {}, restoreCinematicAftermathRemains() {},
    setRoundAdvanceControls: (show, final) => { calls.advance = [show, final]; },
    setMessage: (title, detail) => { calls.message = [title, detail]; }, audio: { roundResult: result => { calls.audio = result; } } };
  runInNewContext(["snapshotHistoryCard", "recordCompletedRound", "completeProgressRound"].map(fn).join("\n"), context);
  context.completeProgressRound(a, b, resolution);
  assert.equal(state.pendingMatchWinner, "draw");
  assert.deepEqual(calls.advance, [true, true]);
  assert.deepEqual(state.discardPile, a.filter(Boolean)); assert.deepEqual(state.aiDiscardPile, b.filter(Boolean));
  assert.equal(calls.publicHandDiscardCount, 2, "public status refresh happens after committed cards enter discard");
  assert.equal(state.playerWins.length + state.aiWins.length, 0);
  assert.equal(state.playerRoundWins + state.aiRoundWins, 0);
  assert.equal(calls.audio, "draw"); assert.match(calls.message[0], /Eight rounds complete.*match scores tied/);
  assert.equal(context.ui.versusBadge.className, "versus-badge has-score progress-round-summary");
  assert.match(context.ui.versusBadge.innerHTML, /Trophies earned this round/);
  assert.match(context.ui.versusBadge.innerHTML, /<small>You<\/small><b>\+2<\/b>/);
  assert.match(context.ui.versusBadge.innerHTML, /<small>Opponent<\/small><b>\+2<\/b>/);
  assert.equal(context.ui.menuButton.disabled, false);
  const entry = state.previousRoundsHistory[0];
  assert.equal(entry.trophy, null); assert.equal(entry.matchWinner, "draw");
  assert.deepEqual(JSON.parse(JSON.stringify(entry.matchScores)), { player: 30, ai: 30 });
  assert.equal(entry.battleLane, 2);
  assert.deepEqual(entry.progressAfter, resolution.progressAfter);
  resolution.progressAfter.player.ember = 0; state.playerProgress.gust = 0;
  assert.deepEqual(entry.progressAfter.player, progress(6, 6, 6), "history cannot be changed by later rounds");
});

function liveProgressContext(round = 1) {
  const state = { gameMode: "four-lane", round, difficulty: "blind", playerWins: [], aiWins: [],
    previousRoundsHistory: [], discardPile: [], aiDiscardPile: [], playerRoundWins: 0, aiRoundWins: 0,
    dryProgressRounds: 0, matchDrawReason: null };
  const calls = {}, context = { state, structuredClone, ELEMENTS: normal.ELEMENTS, duelRules: () => rules,
    getElementTrophyCounts: normal.getElementTrophyCounts,
    ui: { versusBadge: node(), playerCollection: {}, aiCollection: {}, menuButton: { disabled: true } },
    clearTrophyClaim() {}, renderPreviousRoundsHistory() {}, renderProgressLaneResults() {},
    renderCollection() {}, renderRound() {}, renderRoundScore() {}, renderAftermathBreakdown() {},
    renderOpponentTells() { calls.publicHandDiscardCount = state.aiDiscardPile.length; },
    restoreCinematicAftermathRemains() {},
    setRoundAdvanceControls: (show, final) => { calls.advance = [show, final]; },
    setMessage: (title, detail) => { calls.message = [title, detail]; },
    audio: { roundResult: value => { calls.audio = value; } } };
  runInNewContext(["snapshotHistoryCard", "recordCompletedRound", "completeProgressRound"].map(fn).join("\n"), context);
  return { context, state, calls };
}

test("round completion refreshes public-hand counters after discard and marks the revealed board", () => {
  const { context, state } = liveProgressContext(1);
  state.locked = true;
  state.aiHand = [card("gust", 5, "link")];
  state.aiDeck = Array(17);
  state.aiDiscardPile.push(card("ember", 3));
  context.isFourLaneMode = () => true;
  context.renderOpponentHabits = () => {};
  context.cardRoleDefinition = value => rules.TACTICS[value.tactic];
  context.cardDisplayName = value => value.name;
  context.cardArtworkSource = art => `assets/${art}.png`;
  Object.assign(context.ui, { tacticsTitle: node(), commitmentHint: node(), opponentTells: node(),
    opponentPublicHand: node(), battleLaneNotice: node() });
  runInNewContext(fn("renderOpponentTells"), context);
  context.renderOpponentTells();
  assert.match(context.ui.commitmentHint.textContent, /1 available · 17 in draw pile · 1 discarded.*Formation stays secret/);
  const player = [null, card("ember", 9), null, null], opponent = [null, card("tide", 3), null, null];
  context.completeProgressRound(player, opponent, rules.resolveProgress(player, opponent));
  assert.equal(state.previousRoundsHistory.length, 1);
  assert.equal(state.aiDiscardPile.length, 2);
  assert.match(context.ui.commitmentHint.textContent, /1 available · 17 in draw pile · 2 discarded.*Committed cards are revealed on the board/);
  assert.equal((context.ui.opponentPublicHand.innerHTML.match(/class="public-hand-card /g) || []).length, 1);
  state.round = 2; state.locked = false; context.renderOpponentTells();
  assert.match(context.ui.commitmentHint.textContent, /Formation stays secret until the clash/);
  assert.match(context.ui.battleLaneNotice.innerHTML, /BATTLE LANE 3/);
});

test("dry rounds never end a match early and an earned eighth-round trophy resets their counter", () => {
  assert.equal(rules.DRY_ROUND_WARNING, 4);
  const { context, state, calls } = liveProgressContext();
  for (let round = 1; round <= 7; round++) {
    const player = Array(4).fill(null), opponent = Array(4).fill(null);
    player[rules.getBattleLane(round)] = card("gust", 5);
    opponent[rules.getBattleLane(round)] = card("gust", 5);
    state.round = round;
    context.completeProgressRound(player, opponent, rules.resolveProgress(player, opponent));
    assert.equal(state.dryProgressRounds, round);
    assert.equal(state.pendingMatchWinner, null, "avoiding battles does not trigger an early forced draw");
    assert.equal(state.matchDrawReason, null);
    assert.deepEqual(calls.advance, [true, false]);
    assert.match(calls.message[1], /no trophies/);
  }
  const earnedPlayer = [null, null, card("ember", 9), null], earnedOpponent = [null, null, card("ember", 3), null];
  state.round++;
  context.completeProgressRound(earnedPlayer, earnedOpponent, rules.resolveProgress(earnedPlayer, earnedOpponent));
  assert.equal(state.dryProgressRounds, 0);
  assert.equal(state.pendingMatchWinner, "player");
  assert.match(calls.message[0], /Eight rounds complete/);
  assert.ok(state.discardPile.every(Boolean) && state.aiDiscardPile.every(Boolean), "empty physical slots are never discarded as cards");
});

test("Round 8 compares final match scores, including set bonuses, rather than forcing a draw", () => {
  assert.equal(rules.MAX_MATCH_ROUNDS, 8);
  const a = [null, card("gust", 9), card("gust", 9), null], b = [null, card("gust", 3), card("gust", 3), null];
  const { context, state, calls } = liveProgressContext(7);
  const incomplete = rules.resolveProgress(a, b, progress(5, 2, 4), progress(1, 0, 1));
  context.completeProgressRound(a, b, incomplete);
  assert.equal(state.pendingMatchWinner, null);
  assert.deepEqual(calls.advance, [true, false]);
  state.round = 8;
  context.completeProgressRound(a, b, incomplete);
  assert.equal(incomplete.matchWinner, null, "UI completion does not mutate the pure scoring input");
  assert.equal(state.pendingMatchWinner, "player");
  assert.equal(state.matchDrawReason, null);
  assert.equal(state.previousRoundsHistory.at(-1).matchWinner, "player");
  assert.deepEqual(calls.advance, [true, true]);
  assert.equal(calls.audio, "win");
  assert.match(calls.message[0], /Eight rounds complete.*higher match score/);

  const tiedCards = [null, null, card("gust", 5), null];
  const bonusWinner = liveProgressContext(8);
  bonusWinner.context.completeProgressRound(tiedCards, tiedCards,
    rules.resolveProgress(tiedCards, tiedCards, progress(2, 2, 2), progress(8)));
  assert.equal(bonusWinner.state.pendingMatchWinner, "player", "six trophies plus four set points beats eight trophies");
  assert.equal(bonusWinner.calls.audio, "win");
  assert.match(bonusWinner.calls.message[1], /Match score: 10–8/);
  const tiedMatch = liveProgressContext(8);
  tiedMatch.context.completeProgressRound(tiedCards, tiedCards,
    rules.resolveProgress(tiedCards, tiedCards, progress(2, 2, 2), progress(10)));
  assert.equal(tiedMatch.state.pendingMatchWinner, "draw");
  assert.equal(tiedMatch.calls.audio, "draw");
  const losingMatch = liveProgressContext(8);
  losingMatch.context.completeProgressRound(a, b, rules.resolveProgress(a, b, progress(), progress(10)));
  assert.equal(losingMatch.state.pendingMatchWinner, "ai", "winning the final battle need not win the match");
  assert.equal(losingMatch.calls.audio, "loss");
});

test("advance after Round 8 ends the match without dealing or creating Round 9", async () => {
  const state = { round: 8, playerProgress: progress(2, 2, 2), aiProgress: progress(8) };
  let finalWinner;
  const context = { state, isFourLaneMode: () => true, duelRules: () => rules, endGame: winner => { finalWinner = winner; } };
  runInNewContext(fn("nextRound"), context);
  await context.nextRound();
  assert.equal(finalWinner, "player");
  assert.equal(state.round, 8);
});

test("four-lane round-gain summary has its own responsive size instead of a fixed circular seal", () => {
  const css = readFileSync(new URL("../four-lane-preview.css", import.meta.url), "utf8");
  const summaryStyle = css.match(/body\[data-duel-mode="four-lane"\] \.duel-table \.versus-badge\.progress-round-summary \{([^}]+)\}/)?.[1];
  assert.ok(summaryStyle);
  assert.match(summaryStyle, /width: 82px/);
  assert.match(summaryStyle, /height: auto/);
  assert.match(summaryStyle, /transform: translateY\(-50%\)/);
  assert.match(css, /\.progress-round-values\s*\{[^}]*grid-template-columns: 1fr;/s);
  assert.match(css, /@media \(orientation: landscape\)[\s\S]*\.progress-round-values b \{ font-size: 16px/);
});

test("uncapped trophy counters and set-adjusted match scores leave Normal Play unchanged", () => {
  const target = node(), context = { ELEMENTS: normal.ELEMENTS, duelRules: () => rules,
    isFourLaneMode: () => true, state: { playerProgress: progress(6, 3, 1), aiProgress: progress(), playerRoundWins: 4, aiRoundWins: 2 },
    ui: { playerCollection: target, playerRoundScore: node(), aiRoundScore: node(), roundScore: node(), matchScoreDetails: node() }, tutorial: { active: false },
    getElementTrophyCounts: normal.getElementTrophyCounts, getTrophyProgress: normal.getTrophyProgress, TROPHIES_PER_ELEMENT: 2 };
  runInNewContext(["renderElementProgress", "renderCollection", "renderRoundScore"].map(fn).join("\n"), context);
  context.renderCollection(target, []); context.renderRoundScore();
  assert.match(target.innerHTML, /<strong>6<\/strong>/);
  assert.doesNotMatch(target.innerHTML, /\/6|of 6/);
  assert.match(target.attributes["aria-label"], /Fire 6 trophies, Gust 3 trophies, Water 1 trophies/);
  assert.match(target.attributes["aria-label"], /1 complete sets, set bonus 2/);
  assert.match(target.innerHTML, /title="Fire trophies: 6"/);
  assert.match(context.ui.roundScore.attributes["aria-label"], /Match score: You 10 trophies \+ 2 set bonus = 12.*Highest score after 8 rounds wins/);
  assert.equal(context.ui.playerRoundScore.textContent, 12);
  assert.match(context.ui.matchScoreDetails.textContent, /You: 10 trophies \+ 2 set bonus/);
  context.state.playerProgress = progress(12, 10, 8); context.renderCollection(target, []); context.renderRoundScore();
  assert.match(target.innerHTML, /<strong>12<\/strong>/);
  assert.equal(context.ui.playerRoundScore.textContent, 46);
  context.isFourLaneMode = () => false;
  context.renderCollection(target, [card("ember")]); context.renderRoundScore();
  assert.doesNotMatch(target.innerHTML, /elemental-progress-goal/);
  assert.match(target.attributes["aria-label"], /1 of 6 trophy slots/);
  assert.equal(context.ui.playerRoundScore.textContent, 4);
});

test("Solo Gambler still spends support to complete a goal instead of recovering forever", () => {
  const hand = [card("gust", 5, "vanguard"), card("gust", 4, "rally")];
  const history = Array.from({ length: 6 }, () => ({ playerCards: [{ element: "gust", power: 6, tactic: "none" }, { element: "gust", power: 6, tactic: "none" }] }));
  const chosen = rules.chooseAiFormation(hand, {}, progress(6, 4, 6), () => .4, [{ id: "solo-gambler" }], { history });
  assert.deepEqual(chosen.filter(Boolean), hand);
  const leadingLane = chosen.findIndex(Boolean);
  assert.equal(chosen[leadingLane + 1], hand[1]);
  assert.equal(rules.getTacticBonus(chosen, leadingLane) + rules.getRallyBonus(chosen, leadingLane), 2);
  const resolved = rules.resolveProgress(chosen, history.at(-1).playerCards, progress(6, 4, 6));
  assert.equal(resolved.matchWinner, null, "legacy planner utilities cannot end the revised match before Round 8");
  assert.equal(rules.getProgressMatchWinner(resolved.progressAfter.player, resolved.progressAfter.ai, 8), "player");
});
