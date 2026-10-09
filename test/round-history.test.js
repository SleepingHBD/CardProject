import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import "../src/rules.js";
import "../src/four-lane-rules.js";

const gameSource = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const styleSource = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const { ELEMENTS, TACTICS, resolveClashes, getFormationRewardOptions, getElementTrophyCounts } = globalThis.ClawRules;
const functions = ["cardRoleDefinition", "progressGainMarkup", "snapshotHistoryCard", "recordCompletedRound", "historyProgressMarkup", "historyExtraCardLanePoints", "historyLaneCellMarkup", "historyFormationGridMarkup", "historyLaneCalculationMarkup", "historyRoundDetailsMarkup", "renderPreviousRoundsHistory"]
  .map((name) => gameSource.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}`))?.[0]);
assert.ok(functions.every(Boolean), "all history helpers must be loaded from the implementation");

const card = (element, power, tactic = "link") => ({ element, power, tactic, art: "qa-card", name: "QA Card" });
function fixture() {
  const state = { round: 1, difficulty: "blind", previousRoundsHistory: [], playerWins: [], aiWins: [] };
  const context = {
    ELEMENTS, TACTICS, state, getElementTrophyCounts, structuredClone,
    isFourLaneMode: () => state.gameMode === "four-lane",
    ClawFourLaneRules: globalThis.ClawFourLaneRules,
    FOUR_LANE_ROLES: globalThis.ClawFourLaneRules.TACTICS,
    DIFFICULTIES: { blind: { label: "Blind" }, instinct: { label: "Instinct" }, guided: { label: "Guided" } },
    cardDisplayName: (value) => value.name,
    ui: {
      previousRoundsHistoryCount: { setAttribute() {} },
      previousRoundsHistoryList: { innerHTML: "" },
    },
  };
  runInNewContext(functions.join("\n"), context);
  return context;
}
function record(context, playerCards, aiCards) {
  const resolution = resolveClashes(playerCards, aiCards);
  const reward = getFormationRewardOptions(playerCards, aiCards, resolution)[0] || null;
  context.recordCompletedRound(reward, playerCards, aiCards, resolution);
  return context.state.previousRoundsHistory.at(-1);
}

test("round headers always describe the result from the player's perspective", () => {
  for (const [playerPower, aiPower, expected] of [[9, 3, "You won"], [3, 9, "You lost"], [5, 5, "Draw"]]) {
    const context = fixture();
    record(context, [card("ember", playerPower)], [card("ember", aiPower)]);
    const markup = context.ui.previousRoundsHistoryList.innerHTML;
    const header = markup.match(/<header>([\s\S]*?)<\/header>/)?.[1];
    assert.match(header, new RegExp(`>${expected}<`));
    assert.doesNotMatch(header, /Opponent won|history-mode|Blind|history-progress/);
    assert.equal((header.match(/history-round-result /g) || []).length, 1);
    assert.match(header, /aria-label="Round Points: You \d, Opponent \d"/);
  }
});

test("contested lanes show exactly one result, attached to your card rather than both sides", () => {
  for (const [playerPower, aiPower, expected] of [[9, 3, "Win"], [3, 9, "Loss"], [5, 5, "Draw"]]) {
    const context = fixture();
    const entry = record(context, [card("ember", playerPower)], [card("ember", aiPower)]);
    const player = context.historyLaneCellMarkup(entry, "player", 0);
    const opponent = context.historyLaneCellMarkup(entry, "ai", 0);
    assert.match(player, new RegExp(`class="history-cell-outcome">${expected}<`));
    assert.doesNotMatch(opponent, /history-cell-outcome|history-cell-(?:win|loss|draw)/);
    for (const markup of [player, opponent]) {
      assert.match(markup, /history-cell-element/);
      assert.match(markup, /history-cell-power/);
      assert.match(markup, /history-cell-role/);
      assert.doesNotMatch(markup, /history-cell-math|bonus plus/);
    }
  }
});

test("every formation-size pairing distinguishes extra cards from lane wins", () => {
  for (let playerCount = 1; playerCount <= 3; playerCount++) {
    for (let aiCount = 1; aiCount <= 3; aiCount++) {
      const context = fixture();
      const player = Array.from({ length: playerCount }, () => card("ember", 5));
      const opponent = Array.from({ length: aiCount }, () => card("ember", 5));
      const entry = record(context, player, opponent);
      const grid = context.historyFormationGridMarkup(entry);
      assert.equal((grid.match(/>Extra \+1 Round Point</g) || []).length, Math.abs(playerCount - aiCount));
      assert.equal((grid.match(/>Draw</g) || []).length, Math.min(playerCount, aiCount));
      assert.equal((grid.match(/class="history-lane-empty"/g) || []).length, 6 - playerCount - aiCount);
      for (const side of ["player", "ai"]) {
        const own = side === "player" ? playerCount : aiCount;
        const other = side === "player" ? aiCount : playerCount;
        for (let index = other; index < own; index++) {
          assert.equal(context.historyLaneCalculationMarkup(entry, side, index), "Extra card: <b>+1 Round Point</b>");
          assert.doesNotMatch(context.historyLaneCellMarkup(entry, side, index), /history-cell-bonus/);
        }
      }
    }
  }
});

test("card Power shows earned role, element, and stacked bonuses beside the base number", () => {
  const scenarios = [
    [card("gust", 4, "vanguard"), card("gust", 5), "player", 1],
    [card("ember", 5), card("gust", 5), "player", 2],
    [card("tide", 5, "vanguard"), card("ember", 5, "vanguard"), "player", 3],
    [card("ember", 5), card("tide", 5, "vanguard"), "ai", 3],
  ];
  for (const [player, opponent, side, expectedBonus] of scenarios) {
    const context = fixture();
    const entry = record(context, [player], [opponent]);
    const basePower = side === "player" ? player.power : opponent.power;
    const markup = context.historyLaneCellMarkup(entry, side, 0);
    assert.match(markup, new RegExp(`>${basePower} <small class="history-cell-bonus">\\+${expectedBonus}<\\/small><\\/strong>`));
    assert.match(markup, new RegExp(`Base Power ${basePower}, bonus ${expectedBonus}, clash total ${basePower + expectedBonus}`));
    assert.ok(styleSource.includes('.history-cell-bonus {'), "bonus has its own smaller style");
  }
});

test("zero bonuses stay hidden and the screenshot's 4 plus 1 correctly explains its draw", () => {
  const context = fixture();
  const entry = record(context,
    [card("gust", 4, "vanguard"), card("gust", 4, "vanguard")],
    [card("gust", 5), card("gust", 5)],
  );
  assert.match(context.historyLaneCellMarkup(entry, "player", 0), /history-cell-bonus">\+1/);
  assert.match(context.historyLaneCellMarkup(entry, "player", 0), /history-cell-outcome">Draw/);
  assert.match(context.historyLaneCellMarkup(entry, "player", 1), /history-cell-outcome">Loss/);
  assert.doesNotMatch(context.historyLaneCellMarkup(entry, "player", 1), /history-cell-bonus/);
  assert.doesNotMatch(context.historyLaneCellMarkup(entry, "ai", 0), /history-cell-bonus/);
  assert.doesNotMatch(context.historyLaneCellMarkup(entry, "ai", 1), /history-cell-bonus/);
});

test("calculations and earlier trophies live only inside initially collapsed native Details", () => {
  const context = fixture();
  context.state.playerWins = [card("tide", 3)];
  context.state.aiWins = [card("gust", 4), card("gust", 5)];
  const entry = record(context, [card("tide", 5, "vanguard")], [card("ember", 5, "vanguard")]);
  const markup = context.ui.previousRoundsHistoryList.innerHTML;
  const summary = markup.slice(0, markup.indexOf('<details class="history-details">'));
  assert.doesNotMatch(summary, /history-progress-before|Lane calculations|Power 5 \+ bonus/);
  assert.match(markup, /<details class="history-details">\s*<summary>Details<\/summary>/);
  assert.match(markup, /You: Fire 0, Gust 0, Water 1/);
  assert.match(markup, /Opponent: Fire 0, Gust 2, Water 0/);
  assert.equal(context.historyLaneCalculationMarkup(entry, "player", 0), "Power 5 + bonus 3 = <b>8</b>");
  assert.equal(context.historyLaneCalculationMarkup(entry, "ai", 0), "Power 5 + bonus 1 = <b>6</b>");
  const footer = markup.match(/<footer class="history-trophy">([\s\S]*?)<\/footer>/)?.[1];
  assert.match(footer, /You claimed/);
  assert.match(footer, /Water/);
  assert.doesNotMatch(footer, /Power|tactic-icon|QA Card/);
  assert.match(markup, /Claimed card: <b>QA Card<\/b> · Lane 1 · Power 5 · Vanguard/);
});

test("history rendering keeps newest rounds first, does not mutate records, and handles empty history", () => {
  const context = fixture();
  context.renderPreviousRoundsHistory();
  assert.match(context.ui.previousRoundsHistoryList.innerHTML, /No completed rounds yet/);
  record(context, [card("gust", 3)], [card("gust", 9)]);
  context.state.round = 2;
  record(context, [card("ember", 5)], [card("ember", 5)]);
  const before = JSON.stringify(context.state.previousRoundsHistory);
  context.renderPreviousRoundsHistory();
  const markup = context.ui.previousRoundsHistoryList.innerHTML;
  assert.ok(markup.indexOf("ROUND <strong>2") < markup.indexOf("ROUND <strong>1"));
  assert.equal(context.ui.previousRoundsHistoryCount.textContent, 2);
  assert.equal(JSON.stringify(context.state.previousRoundsHistory), before);
  assert.match(markup, /No trophy claimed/);
});

test("history icons have definite dimensions and reopening starts at the newest round", () => {
  assert.match(styleSource, /\.history-cell-role \.tactic-icon \{\s*width: calc\(var\(--history-stat-size\) \* \.82\);\s*height: calc\(var\(--history-stat-size\) \* \.82\);/);
  assert.match(gameSource, /ui\.previousRoundsHistoryDialog\.showModal\(\);\s*ui\.previousRoundsHistoryList\.scrollTop = 0;/);
});

test("four-lane history retains Lane 4, Rally symbols and received bonuses", () => {
  const context = fixture();
  context.state.gameMode = "four-lane";
  const player = [card("gust", 5), card("tide", 5), card("ember", 5, "link"), card("gust", 4, "rally")];
  const opponent = Array.from({ length: 4 }, () => card("gust", 5, "vanguard"));
  const resolution = globalThis.ClawFourLaneRules.resolveProgress(player, opponent);
  const reward = globalThis.ClawFourLaneRules.getFormationRewardOptions(player, opponent, resolution)[0];
  context.recordCompletedRound(reward, player, opponent, resolution);
  const markup = context.ui.previousRoundsHistoryList.innerHTML;
  assert.match(markup, /history-four-lanes/);
  assert.match(markup, /LANE 4/);
  assert.match(markup, /#tactic-icon-banner/);
  assert.match(context.historyLaneCellMarkup(context.state.previousRoundsHistory[0], "player", 2), /history-cell-bonus">\+4/);
  assert.doesNotMatch(context.historyLaneCellMarkup(context.state.previousRoundsHistory[0], "player", 3), /history-cell-bonus/);
  assert.equal((markup.match(/class="history-grid-lane"/g) || []).length, 4);
});

test("four-lane history awards no unopposed trophies after losing the only battle", () => {
  for (const larger of ["player", "ai"]) {
    const context = fixture(); context.state.gameMode = "four-lane";
    const weak = Array.from({ length: 4 }, () => card("gust", 3)), strong = [card("gust", 9)];
    const player = larger === "player" ? weak : strong, opponent = larger === "player" ? strong : weak;
    const result = globalThis.ClawFourLaneRules.resolveProgress(player, opponent);
    assert.equal(result.winner, larger === "player" ? "ai" : "player");
    context.recordCompletedRound(null, player, opponent, result);
    const entry = context.state.previousRoundsHistory[0];
    assert.equal(entry.extraCardPoints[larger], 0);
    assert.equal(entry.trophy, null);
    assert.match(context.ui.previousRoundsHistoryList.innerHTML, /Trophies earned/);
    assert.doesNotMatch(context.ui.previousRoundsHistoryList.innerHTML, /No trophy claimed|Round Points/);
    assert.match(context.historyLaneCellMarkup(entry, larger, 3), /Unopposed \+0 Gust/);
    assert.match(context.historyLaneCalculationMarkup(entry, larger, 3), /\+0 Gust trophies/);
    assert.equal((context.historyFormationGridMarkup(entry).match(/>Unopposed \+1 Gust</g) || []).length, 0);
    result.extraCardPoints[larger] = 1;
    assert.equal(entry.extraCardPoints[larger], 0, "history snapshots, rather than aliases, earned points");
    result.laneProgress[larger][1] = 1;
    assert.equal(entry.laneProgress[larger][1], 0, "credited lane progress is snapshotted, not reinterpreted");
  }
});

test("sparse WIP history preserves physical lanes and explains unlocked or unrewarded cards", () => {
  const context = fixture(); context.state.gameMode = "four-lane";
  const player = [card("ember", 3), null, card("tide", 9), card("gust", 4)];
  const opponent = [null, card("gust", 5), card("tide", 3), null];
  const result = globalThis.ClawFourLaneRules.resolveProgress(player, opponent);
  context.recordCompletedRound(null, player, opponent, result);
  const entry = context.state.previousRoundsHistory[0];
  assert.equal(entry.playerCards[1], null);
  assert.equal(entry.aiCards[0], null);
  assert.equal(entry.laneResults[0], null);
  assert.match(context.historyLaneCellMarkup(entry, "player", 2), /history-cell-outcome">Win/);
  assert.match(context.historyLaneCellMarkup(entry, "player", 0), /Unopposed \+1 Fire/);
  assert.match(context.historyLaneCellMarkup(entry, "player", 3), /Unopposed \+0 Gust/);
  assert.match(context.historyLaneCalculationMarkup(entry, "player", 0), /Unlocked by a lane win/);
  assert.match(context.historyLaneCalculationMarkup(entry, "player", 3), /unlocks were used/);
  assert.match(context.historyLaneCalculationMarkup(entry, "ai", 1), /No lane victory/);
  assert.equal((context.historyFormationGridMarkup(entry).match(/class="history-lane-empty"/g) || []).length, 3);
  assert.equal(JSON.stringify(entry).includes("undefined"), false);
});

test("four-lane history calls automatic gains trophies, including singular and zero gains", () => {
  const context = fixture(); context.state.gameMode = "four-lane";
  const player = [card("ember", 9), card("tide", 3)], opponent = [card("ember", 3)];
  const result = globalThis.ClawFourLaneRules.resolveProgress(player, opponent);
  context.recordCompletedRound(null, player, opponent, result);
  const entry = context.state.previousRoundsHistory[0];
  assert.match(context.historyLaneCalculationMarkup(entry, "player", 0), /\+2 Fire trophies/);
  assert.match(context.historyLaneCalculationMarkup(entry, "player", 1), /\+1 Water trophy<\/b>/);
  assert.match(context.historyLaneCalculationMarkup(entry, "ai", 0), /\+0 Fire trophies/);
  assert.match(context.historyRoundDetailsMarkup(entry), /Trophies before this round \(6 per element\)/);
  const markup = context.ui.previousRoundsHistoryList.innerHTML;
  assert.match(markup, /aria-label="Trophies earned: You 3, Opponent 0"/);
  assert.match(markup, /No trophies earned/);
  assert.doesNotMatch(markup.replace(/<[^>]*>/g, " "), /\bprogress\b|Round Points/i);
  context.state.gameMode = "normal";
  context.renderPreviousRoundsHistory();
  assert.match(context.ui.previousRoundsHistoryList.innerHTML, /Trophies earned/);
});
