import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import "../src/rules.js";

const source = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const rules = globalThis.ClawRules;
const fn = name => {
  const body = source.match(new RegExp(`(?:async )?function ${name}\\([\\s\\S]*?\\n\\}`))?.[0];
  assert.ok(body, `${name} exists`);
  return body;
};
const serializable = value => JSON.parse(JSON.stringify(value));
const functions = ["validateStoryEncounter", "takeStoryPuzzleCards", "configureStoryPuzzleDeal", "storyPuzzleOutcome", "startStoryEncounter", "returnToStory", "freshDeck", "refillHands", "drawCard", "prepareAiPlan", "completeRoundReward", "endGame", "startGame", "removeCard", "playRound"];

function fixture() {
  const events = [], messages = [], nodes = new Map(), scheduled = [], calls = [];
  const classes = new Set(["story-active"]);
  const classList = { add: (...values) => values.forEach(value => classes.add(value)), remove: (...values) => values.forEach(value => classes.delete(value)), toggle() {} };
  const node = () => ({ hidden: false, disabled: false, open: false, innerHTML: "", textContent: "", classList,
    querySelectorAll: () => [], showModal() { this.open = true; this.opens = (this.opens || 0) + 1; }, close() { this.open = false; } });
  const ui = Object.fromEntries(["gameShell", "battlefield", "mainMenuScreen", "resultDialog", "previousRoundsHistoryDialog", "difficultyDialog", "deckTransition", "menuButton", "clashEffects", "playerPlayZone", "aiPlayZone", "versusBadge", "playerCollection", "aiCollection", "playerHand"].map(key => [key, node()]));
  const state = { duelRunId: 0, difficulty: "instinct", playerHand: [], aiHand: [], deck: [], discardPile: [], playerWins: [], aiWins: [], previousRoundsHistory: [] };
  const context = {
    state, ui, storyEncounter: null, tutorial: { active: false }, scheduled, calls,
    DIFFICULTIES: { guided: {}, instinct: {}, blind: {} }, HAND_SIZE: 6, MAX_PLAY_SIZE: 3,
    DECK_COPIES_BY_RARITY: { common: 2, uncommon: 2, rare: 1, epic: 1, legendary: 1 },
    shuffle: cards => cards, Math, Date,
    reshuffleDiscardPile: rules.reshuffleDiscardPile,
    chooseAiCommitment: rules.chooseAiCommitment, chooseAiCards: rules.chooseAiCards, buildTellClues: rules.buildTellClues,
    createAiTraits: rules.createAiTraits,
    usesPersistentAiHabits: () => ["instinct", "blind"].includes(state.difficulty),
    getTrophyProgress: rules.getTrophyProgress,
    formationCardCount: cards => cards.filter(Boolean).length,
    selectedFormationCards: () => state.selectedCardIds.map(id => state.playerHand.find(card => card.instanceId === id)),
    getPlayerFormationLimit: () => 3,
    playedCardsMarkup: cards => cards.map(card => card.name).join(","), placeholder: text => text,
    animateClashes: async (player, ai) => rules.resolveClashes(player, ai),
    resolveRound: () => calls.push("resolve-round"),
    recordCompletedRound: () => calls.push("history"),
    getCompletedMatchWinner: () => null,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    document: {
      body: { classList },
      querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, node()); return nodes.get(selector); },
      dispatchEvent(event) { events.push(event); context.onDispatch?.(event); },
    },
    window: { setTimeout: callback => scheduled.push(callback) },
    audio: { startDuelMusic() {}, matchResult: won => calls.push(["match-audio", won]), roundResult: outcome => calls.push(["round-audio", outcome]), commit() {}, reveal() {} },
    stopTutorialMode() {}, clearCinematicRemains() {}, clearTrophyClaim() {}, closeGameMenu() {},
    closeDialog: dialog => { dialog.open = false; },
    setGameMenuVisibility() {}, renderGallery() {}, renderOpponentHabits() {}, renderPreviousRoundsHistory() {},
    renderOpponentTells() {}, renderFormationControls() {}, renderCollection() {}, renderHand() {}, renderRound() {}, renderRoundScore() {},
    setRoundAdvanceControls: (...args) => calls.push(["round-controls", ...args]),
    beginFormationBuilding: () => { state.locked = false; calls.push("building"); },
    setMessage: (...args) => messages.push(args),
    playDeckTransition: async () => {}, animateHandDraw: async () => {},
  };
  context.ClawStoryCombat = { isActive: () => Boolean(context.storyEncounter), isPuzzle: () => context.storyEncounter?.kind === "puzzle" };
  const library = source.slice(source.indexOf("const CARD_LIBRARY ="), source.indexOf("const HAND_SIZE ="));
  const puzzleCards = source.match(/const STORY_PUZZLE_CARDS = Object\.freeze\([\s\S]*?\n\}\);/)?.[0];
  runInNewContext([library, puzzleCards, ...functions.map(fn)].join("\n"), context);
  return { context, state, ui, events, nodes, scheduled, calls, messages, classes };
}

test("the story combat API exposes only controlled encounter entry and status", () => {
  assert.match(source, /globalThis\.ClawStoryCombat = Object\.freeze\(\{[\s\S]*?startEncounter: startStoryEncounter/);
  assert.match(source, /isActive: \(\) => Boolean\(storyEncounter\)/);
  const { context } = fixture();
  for (const options of [null, {}, { id: "unknown", kind: "duel" }, { id: "rally-puzzle", kind: "duel" }, { id: "gate-duel", kind: "duel", difficulty: "open" }]) {
    assert.throws(() => context.validateStoryEncounter(options));
  }
  assert.deepEqual(serializable(context.validateStoryEncounter({ id: "gate-duel", kind: "duel" })), { id: "gate-duel", kind: "duel", difficulty: "instinct", outcome: null });
});

test("the gate trial uses a complete ordinary deal and randomized habits with the original trophy goal", async () => {
  const { context, state, nodes, classes } = fixture();
  await context.startStoryEncounter({ id: "gate-duel", kind: "duel" });
  assert.equal(state.playerHand.length, 6);
  assert.equal(state.aiHand.length, 6);
  assert.equal(state.deck.length, 48);
  assert.equal(state.aiTraits.length, 3);
  assert.equal(new Set([...state.playerHand, ...state.aiHand, ...state.deck].map(card => card.instanceId)).size, 60);
  assert.equal(context.storyEncounter.kind, "duel");
  assert.equal(state.difficulty, "instinct");
  assert.equal(nodes.get("#storyScreen").hidden, true);
  assert.equal(classes.has("story-active"), false);
  assert.equal(rules.TROPHIES_PER_ELEMENT, 2);
  assert.equal(state.pendingMatchWinner, null);
});

test("story entry rejects a second simultaneous encounter rather than replacing the active duel", async () => {
  const { context, state } = fixture();
  await context.startStoryEncounter({ id: "gate-duel", kind: "duel" });
  const hand = [...state.playerHand];
  await assert.rejects(context.startStoryEncounter({ id: "rally-puzzle", kind: "puzzle" }));
  assert.deepEqual(serializable(state.playerHand), serializable(hand));
  assert.equal(context.storyEncounter.id, "gate-duel");
});

test("a failed opening returns to the map once and leaves future encounters available", async () => {
  const { context, state, events, ui } = fixture();
  context.playDeckTransition = async () => { throw new Error("Opening failed"); };
  await assert.rejects(context.startStoryEncounter({ id: "gate-duel", kind: "duel" }), /Opening failed/);
  assert.equal(context.storyEncounter, null);
  assert.equal(context.ClawStoryCombat.isActive(), false);
  assert.equal(state.locked, true);
  assert.equal(ui.resultDialog.open, false);
  assert.equal(events.length, 1);
  assert.deepEqual(serializable(events[0].detail), { id: "gate-duel", kind: "duel", outcome: "retreated" });
  context.playDeckTransition = async () => {};
  await context.startStoryEncounter({ id: "gate-duel", kind: "duel" });
  assert.equal(context.ClawStoryCombat.isActive(), true);
});

test("a stale failed opening cannot retreat a newer encounter", async () => {
  const { context, events } = fixture();
  let rejectOpening;
  context.playDeckTransition = () => new Promise((resolve, reject) => { rejectOpening = reject; });
  const first = context.startStoryEncounter({ id: "rally-puzzle", kind: "puzzle" });
  context.returnToStory("retreated");
  context.playDeckTransition = async () => {};
  await context.startStoryEncounter({ id: "gate-duel", kind: "duel" });
  rejectOpening(new Error("Old opening failed"));
  await assert.rejects(first, /Old opening failed/);
  assert.equal(context.storyEncounter.id, "gate-duel");
  assert.equal(context.ClawStoryCombat.isActive(), true);
  assert.equal(events.length, 1);
});

test("the puzzle deals canonical, distinct owned cards without changing their statistics", async () => {
  const { context, state } = fixture();
  await context.startStoryEncounter({ id: "rally-puzzle", kind: "puzzle", difficulty: "blind" });
  assert.deepEqual(Array.from(state.playerHand, card => card.art), ["candle-pounce", "lucan-cinderclay", "bubble-bengal", "kitewhisker", "leafy-loaf", "teapot-tabby"]);
  assert.deepEqual(Array.from(state.aiPlan, card => card.art), ["sizzle-mittens", "teapot-tabby"]);
  assert.deepEqual(Array.from(state.aiPlan, card => card.power), [8, 3]);
  assert.equal(state.deck.length, 52);
  assert.equal(state.aiTraits.length, 0);
  assert.equal(state.difficulty, "guided");
  assert.ok(state.aiTellClues.every(clue => clue === "full"));
  assert.equal(new Set([...state.playerHand, ...state.aiHand, ...state.deck].map(card => card.instanceId)).size, 60);
});

test("every winning puzzle solution within two cards passes, including different valid combinations", async () => {
  const { context, state } = fixture();
  await context.startStoryEncounter({ id: "rally-puzzle", kind: "puzzle" });
  let wins = 0;
  const winningNames = [];
  for (const first of state.playerHand) {
    assert.notEqual(context.storyPuzzleOutcome([first], rules.resolveClashes([first], state.aiPlan)), "won");
    for (const second of state.playerHand.filter(card => card !== first)) {
      const cards = [first, second], result = rules.resolveClashes(cards, state.aiPlan);
      assert.equal(context.storyPuzzleOutcome(cards, result), result.winner === "player" ? "won" : result.winner === "draw" ? "draw" : "lost");
      if (result.winner === "player") { wins++; winningNames.push(cards.map(card => card.art).join(",")); }
      for (const third of state.playerHand.filter(card => !cards.includes(card))) {
        const three = [...cards, third];
        assert.notEqual(context.storyPuzzleOutcome(three, rules.resolveClashes(three, state.aiPlan)), "won");
      }
    }
  }
  assert.ok(wins > 1);
  assert.ok(winningNames.includes("candle-pounce,lucan-cinderclay"));
  assert.ok(winningNames.includes("bubble-bengal,lucan-cinderclay"));
});

test("a puzzle result appears only after real scoring and its ordinary trophy lifecycle", async () => {
  const { context, state, ui, nodes } = fixture();
  await context.startStoryEncounter({ id: "rally-puzzle", kind: "puzzle" });
  const cards = state.playerHand.slice(0, 2), ai = [...state.aiPlan];
  const resolution = rules.resolveClashes(cards, ai);
  const reward = rules.getFormationRewardOptions(cards, ai, resolution)[0];
  await context.completeRoundReward(reward, cards, ai, resolution);
  assert.equal(context.storyEncounter.outcome, "won");
  assert.equal(state.playerWins[0].art, "lucan-cinderclay");
  assert.equal(state.discardPile.length, 3);
  assert.equal(nodes.get("#resultTitle").textContent, "Puzzle cleared!");
  assert.equal(nodes.get("#playAgainButton").textContent, "Return to Courtyard");
  assert.equal(ui.resultDialog.open, true);
});

test("puzzle ending audio follows the objective result rather than just winning the round", async () => {
  for (const [winner, outcome, cardCount, expected] of [
    ["player", "won", 2, ["match-audio", true]],
    ["player", "lost", 3, ["match-audio", false]],
    ["ai", "lost", 2, ["match-audio", false]],
    ["draw", "draw", 2, ["round-audio", "draw"]],
  ]) {
    const { context, calls } = fixture();
    await context.startStoryEncounter({ id: "rally-puzzle", kind: "puzzle" });
    context.storyEncounter.outcome = outcome;
    context.storyEncounter.puzzleCardCount = cardCount;
    await context.endGame(winner);
    assert.deepEqual(calls.at(-1), expected);
  }
});

test("leaving reports one retreat and never awards a story victory", async () => {
  const { context, state, events } = fixture();
  await context.startStoryEncounter({ id: "gate-duel", kind: "duel" });
  context.onDispatch = () => assert.equal(context.returnToStory("won"), false);
  const before = serializable(state.playerWins);
  assert.equal(context.returnToStory(), true);
  assert.equal(context.returnToStory("won"), false);
  assert.equal(context.storyEncounter, null);
  assert.deepEqual(serializable(state.playerWins), before);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "prowl:story-return");
  assert.deepEqual(serializable(events[0].detail), { id: "gate-duel", kind: "duel", outcome: "retreated" });
});

test("normal full-match results return the correct story outcome without completing it early", async () => {
  for (const [winner, outcome] of [["player", "won"], ["ai", "lost"], ["draw", "draw"]]) {
    const { context, events, ui } = fixture();
    await context.startStoryEncounter({ id: "gate-duel", kind: "duel" });
    assert.equal(events.length, 0);
    await context.endGame(winner);
    assert.equal(context.storyEncounter.outcome, outcome);
    assert.equal(events.length, 0, "showing a result does not yet resume the map");
    assert.equal(ui.resultDialog.open, true);
    context.returnToStory(context.storyEncounter.outcome);
    assert.equal(events[0].detail.outcome, outcome);
  }
});

test("starting ordinary free play clears encounter context and restores the original result flow", async () => {
  const { context, state, nodes, events } = fixture();
  await context.startStoryEncounter({ id: "rally-puzzle", kind: "puzzle" });
  state.difficulty = "blind";
  await context.startGame();
  assert.equal(context.storyEncounter, null);
  assert.equal(state.difficulty, "blind");
  assert.equal(state.aiHand.length, 6);
  assert.equal(state.deck.length, 48);
  assert.equal(state.aiTraits.length, 3);
  assert.equal(nodes.get("#playAgainButton").textContent, "Play again");
  assert.equal(events.length, 0);
});

test("a retreat invalidates a delayed clash before it can mutate the opponent or finish the round", async () => {
  const { context, state, scheduled, calls, events } = fixture();
  await context.startStoryEncounter({ id: "gate-duel", kind: "duel" });
  state.selectedCardIds = state.playerHand.slice(0, 2).map(card => card.instanceId);
  const aiHand = [...state.aiHand];
  context.playRound();
  assert.equal(scheduled.length, 1);
  context.returnToStory("retreated");
  await scheduled[0]();
  assert.deepEqual(serializable(state.aiHand), serializable(aiHand));
  assert.equal(calls.includes("resolve-round"), false);
  assert.equal(events.length, 1);
});

test("a stale ending transition cannot reopen results over the returned map", async () => {
  const { context, ui, events } = fixture();
  await context.startStoryEncounter({ id: "gate-duel", kind: "duel" });
  let release;
  context.playDeckTransition = () => new Promise(resolve => { release = resolve; });
  const ending = context.endGame("player");
  context.returnToStory("retreated");
  release();
  await ending;
  assert.equal(ui.resultDialog.open, false);
  assert.equal(events.length, 1);
});

test("story puzzle presentation reveals the fixed cards but does not prescribe a winning placement", () => {
  assert.match(fn("renderOpponentTells"), /Lucan's Fixed Formation/);
  assert.match(fn("renderOpponentTells"), /card\.power.*cardRoleDefinition\(card\)\.label/);
  assert.match(fn("renderMatchupForecast"), /No predicted outcome is shown/);
  assert.doesNotMatch(fn("storyPuzzleOutcome"), /candle-pounce|lucan-cinderclay|expected|template/);
  assert.match(source, /ui\.resultDialog\.addEventListener\("cancel"[\s\S]*?returnToStory\(storyEncounter\.outcome/);
  assert.match(source, /startGame\(storyEncounter \? \{ storyEncounter \} : \{\}\)/);
});
