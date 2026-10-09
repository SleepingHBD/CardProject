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
  assert.match(lobby, /2 trophies of your card's element/);
  assert.match(lobby, /each earn 1 trophy of their own element/);
  assert.match(lobby, /6 Fire, 6 Gust and 6 Water trophies/);
  assert.match(lobby, /Unlike Normal Play, trophies are awarded automatically for individual lanes/);
  assert.match(lobby, /all committed cards stay in their owner's deck cycle/);
  assert.doesNotMatch(lobby, /\bprogress\b/i);
  assert.match(css, /content: "TROPHIES · 6 EACH"/);
  assert.doesNotMatch(css, /content: "PROGRESS/);
  assert.match(deck, /Adapt your lane order to the trophies you still need/);
  assert.match(html, /Work in progress/);
});

test("split lanes award both sides their own winning elements, independent of a round winner", () => {
  const result = rules.resolveProgress([card("ember", 9), card("gust", 3)],
    [card("ember", 3), card("gust", 9), card("tide", 3)]);
  assert.deepEqual(result.progressGains, { player: progress(2), ai: progress(0, 2, 1) });
  assert.deepEqual(result.laneProgress, { player: [2, 0], ai: [0, 2, 1] });
  assert.equal(result.matchWinner, null);
  assert.deepEqual(rules.getFormationRewardOptions(), []);
});

test("goals cap individually at six, clipping shared-element wins in lane order", () => {
  const result = rules.resolveProgress([card("ember", 9), card("ember", 9), card("gust", 3), card("tide", 3)],
    [card("ember", 3)], progress(5, 6, 5));
  assert.deepEqual(result.laneProgress.player, [1, 0, 0, 0]);
  assert.deepEqual(result.progressAfter.player, progress(6, 6, 5));
  assert.equal(result.matchWinner, null, "the third extra remains capped even when earlier extras earned zero");
  assert.equal(result.score.player, 1, "summaries count actual progress, not raw lane points");
});

test("a card of a completed element can still deny progress without earning more", () => {
  const result = rules.resolveProgress([card("ember", 9)], [card("gust", 3)], progress(6));
  assert.equal(result.results[0], "player");
  assert.deepEqual(result.progressGains, { player: progress(), ai: progress() });
  assert.deepEqual(result.progressAfter.player, progress(6));
});

test("ties earn nothing; all lanes resolve before a simultaneous completion draw", () => {
  const tied = rules.resolveProgress([card("tide")], [card("tide")]);
  assert.deepEqual(tied.progressGains, { player: progress(), ai: progress() });
  const result = rules.resolveProgress([card("ember", 9), card("tide", 3)],
    [card("ember", 3), card("tide", 9)], progress(4, 6, 6), progress(6, 6, 4));
  assert.deepEqual(result.results, ["player", "ai"]);
  assert.deepEqual(result.progressAfter, { player: progress(6, 6, 6), ai: progress(6, 6, 6) });
  assert.equal(result.matchWinner, "draw");
});

test("missing one element cannot be replaced by excess progress in another", () => {
  assert.equal(rules.getProgressMatchWinner(progress(100, 100, 5), progress()), null);
  assert.equal(rules.getProgressMatchWinner(progress(6, 6, 6), progress()), "player");
  assert.equal(rules.getProgressMatchWinner(progress(), progress(6, 6, 6)), "ai");
  assert.deepEqual(rules.getElementProgress({ ember: -1, gust: 2.9, tide: NaN }), progress(0, 2));
});

test("10,000 seeded formations agree with an independent scoring oracle and side reversal", () => {
  let seed = 74329;
  const roll = n => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) % n;
  const elements = ["ember", "gust", "tide"], roles = ["vanguard", "link", "finisher", "rally"];
  const beats = { ember: "gust", gust: "tide", tide: "ember" };
  const oracle = (a, b, pa, pb) => {
    const values = (cards, other) => cards.map((c, i) => c.power
      + (c.tactic === "vanguard" && i === 0 || c.tactic === "link" && i > 0 && cards[i - 1].element !== c.element
        || c.tactic === "finisher" && cards.length >= 2 && i === cards.length - 1 ? 1 : 0)
      + Number(cards[i + 1]?.tactic === "rally") + (other[i] && beats[c.element] === other[i].element ? 2 : 0));
    const aa = values(a, b), bb = values(b, a), out = [{ ...pa }, { ...pb }], credited = [[], []];
    for (const [side, cards, other] of [[0, a, b], [1, b, a]]) cards.forEach((c, i) => {
      const raw = i < other.length ? (side === 0 ? aa[i] > bb[i] : bb[i] > aa[i]) ? 2 : 0
        : i < other.length + 2 ? 1 : 0;
      const gain = Math.min(raw, 6 - out[side][c.element]);
      out[side][c.element] += gain; credited[side][i] = gain;
    });
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
  return { innerHTML: "", textContent: "", title: "", attributes: {}, setAttribute(key, value) { this.attributes[key] = value; } };
}

test("board results distinguish capped extras from completed elements and keep combat bonuses separate", () => {
  const cards = [card("ember", 9), card("ember", 4), card("gust", 4), card("tide", 4)];
  const result = rules.resolveProgress(cards, [card("ember", 3)], progress(5, 0, 0));
  const lanes = cards.map(() => {
    const label = node(), badge = node();
    label.innerHTML = "WIN 9–3";
    badge.innerHTML = "BONUS +2";
    return { label, badge, querySelector: selector => selector === ".lane-result" ? label : badge };
  });
  const context = { ELEMENTS: normal.ELEMENTS, getExtraCardLanePoints: rules.getExtraCardLanePoints,
    ui: { playerPlayZone: { querySelectorAll: () => lanes }, aiPlayZone: { querySelectorAll: () => [] } } };
  runInNewContext(fn("renderProgressLaneResults"), context);
  context.renderProgressLaneResults(cards, [card("ember", 3)], result);
  assert.match(lanes[0].label.innerHTML, /\+1 FIRE TROPHY/);
  assert.equal(lanes[0].badge.innerHTML, "BONUS +2");
  assert.equal(lanes[1].label.textContent, "COMPLETE +0");
  assert.match(lanes[1].badge.attributes["aria-label"], /already complete/);
  assert.equal(lanes[2].label.textContent, "EXTRA +1 GUST");
  assert.equal(lanes[3].label.textContent, "CAP +0");
});

test("live completion records detached progress, recycles every card, skips trophy claims and permits duel draws", () => {
  const a = [card("ember", 9), card("tide", 3)], b = [card("ember", 3), card("tide", 9)];
  const resolution = rules.resolveProgress(a, b, progress(4, 6, 6), progress(6, 6, 4));
  const state = { gameMode: "four-lane", round: 8, difficulty: "blind", playerWins: [], aiWins: [],
    previousRoundsHistory: [], discardPile: [], aiDiscardPile: [], playerRoundWins: 0, aiRoundWins: 0 };
  const calls = {}, context = { state, structuredClone, ELEMENTS: normal.ELEMENTS,
    getElementTrophyCounts: normal.getElementTrophyCounts,
    ui: { versusBadge: node(), playerCollection: {}, aiCollection: {}, menuButton: { disabled: true } },
    clearTrophyClaim: () => { calls.clear = true; }, renderPreviousRoundsHistory() {},
    renderProgressLaneResults() {}, renderCollection() {}, renderRound() {}, renderRoundScore() {},
    renderAftermathBreakdown() {}, restoreCinematicAftermathRemains() {},
    setRoundAdvanceControls: (show, final) => { calls.advance = [show, final]; },
    setMessage: (title, detail) => { calls.message = [title, detail]; }, audio: { roundResult: result => { calls.audio = result; } } };
  runInNewContext(["snapshotHistoryCard", "recordCompletedRound", "completeProgressRound"].map(fn).join("\n"), context);
  context.completeProgressRound(a, b, resolution);
  assert.equal(state.pendingMatchWinner, "draw");
  assert.deepEqual(calls.advance, [true, true]);
  assert.deepEqual(state.discardPile, a); assert.deepEqual(state.aiDiscardPile, b);
  assert.equal(state.playerWins.length + state.aiWins.length, 0);
  assert.equal(state.playerRoundWins + state.aiRoundWins, 0);
  assert.equal(calls.audio, "draw"); assert.match(calls.message[0], /duel drawn/);
  assert.equal(context.ui.versusBadge.className, "versus-badge has-score progress-round-summary");
  assert.match(context.ui.versusBadge.innerHTML, /Trophies earned this round/);
  assert.match(context.ui.versusBadge.innerHTML, /<small>You<\/small><b>\+2<\/b>/);
  assert.match(context.ui.versusBadge.innerHTML, /<small>Opponent<\/small><b>\+2<\/b>/);
  assert.equal(context.ui.menuButton.disabled, false);
  const entry = state.previousRoundsHistory[0];
  assert.equal(entry.trophy, null); assert.equal(entry.matchWinner, "draw");
  assert.deepEqual(entry.progressAfter, resolution.progressAfter);
  resolution.progressAfter.player.ember = 0; state.playerProgress.gust = 0;
  assert.deepEqual(entry.progressAfter.player, progress(6, 6, 6), "history cannot be changed by later rounds");
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

test("progress counters and totals use six per element, while Normal Play still renders trophies", () => {
  const target = node(), context = { ELEMENTS: normal.ELEMENTS, duelRules: () => rules,
    isFourLaneMode: () => true, state: { playerProgress: progress(6, 3, 1), aiProgress: progress(), playerRoundWins: 4, aiRoundWins: 2 },
    ui: { playerCollection: target, playerRoundScore: node(), aiRoundScore: node(), roundScore: node() }, tutorial: { active: false },
    getElementTrophyCounts: normal.getElementTrophyCounts, getTrophyProgress: normal.getTrophyProgress, TROPHIES_PER_ELEMENT: 2 };
  runInNewContext(["renderElementProgress", "renderCollection", "renderRoundScore"].map(fn).join("\n"), context);
  context.renderCollection(target, []); context.renderRoundScore();
  assert.match(target.innerHTML, /6<small>\/6<\/small>/);
  assert.match(target.attributes["aria-label"], /Fire 6 of 6 trophies, Gust 3 of 6 trophies, Water 1 of 6 trophies/);
  assert.match(target.innerHTML, /title="Fire trophies: 6 \/ 6"/);
  assert.match(context.ui.roundScore.attributes["aria-label"], /Total trophies:.*Collect 6 trophies of each element/);
  assert.equal(context.ui.playerRoundScore.textContent, 10);
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
  assert.deepEqual(chosen, hand);
});
