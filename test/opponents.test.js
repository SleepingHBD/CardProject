import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import "../src/rules.js";
import "../src/four-lane-rules.js";
import "../src/deckbuilding.js";
import "../src/opponents.js";

const normal = globalThis.ClawRules, four = globalThis.ClawFourLaneRules;
const decks = globalThis.ClawDeckbuilding, opponents = globalThis.ClawFourLaneOpponents;
const source = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const library = runInNewContext([
  source.slice(source.indexOf("const CARD_LIBRARY ="), source.indexOf("const HAND_SIZE =")),
  source.slice(source.indexOf("const FOUR_LANE_RALLY_CARDS ="), source.indexOf("const DIFFICULTIES =")),
  "[...CARD_LIBRARY, ...FOUR_LANE_CARDS]",
].join("\n"));
const catalog = decks.createCardCatalog(library), starters = decks.createStarterPresets(catalog);
const roster = opponents.createRoster(catalog);
const rng = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const gameFunction = name => {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1);
  return source.slice(start, source.indexOf("\n}", start) + 2);
};

test("four rivals have distinct legal decks, transparent costs and no exclusive stat advantages", () => {
  assert.equal(roster.length, 4);
  assert.equal(new Set(roster.map(rival => JSON.stringify(rival.deck.cards))).size, 4);
  assert.deepEqual(roster.map(rival => rival.name), ["Versatile Duelist", "Banner Captain", "Cycle Weaver", "Twilight Duelist"]);
  for (const rival of roster) {
    const report = decks.validateDeck(catalog, rival.deck);
    assert.ok(report.valid);
    assert.equal(report.summary.count, 24);
    assert.ok(report.summary.totalCost <= 120);
    assert.deepEqual(Object.values(report.summary.elementCounts), [8, 8, 8]);
    assert.equal(rival.deck, starters.find(deck => deck.id === rival.deckId));
    assert.ok(Object.isFrozen(rival) && Object.isFrozen(rival.habits));
    assert.ok(Object.values(rival.habits).every(Object.isFrozen));
    assert.ok(Object.isFrozen(rival.deck.cards));
    const cards = decks.buildDeckInstances(catalog, rival.deck, "opponent");
    assert.ok(cards.every(card => card.power === catalog.byKey[card.art].power));
  }
  const counts = id => decks.validateDeck(catalog, roster.find(rival => rival.id === id).deck).summary.roleCounts;
  assert.deepEqual(counts("balanced"), { vanguard: 7, link: 6, finisher: 6, rally: 5 });
  assert.equal(counts("rally").rally, 11);
  assert.equal(counts("link").link, 8);
  assert.equal(counts("finisher").finisher, 8);
  assert.ok(roster.every(rival => Object.values(counts(rival.id)).every(count => count > 0)));
});

test("random rival selection reaches all four and invalid selections cannot inject profiles", () => {
  for (const [roll, id] of [[-1, "balanced"], [0, "balanced"], [.25, "rally"], [.5, "link"], [.75, "finisher"], [1, "finisher"]]) {
    const rolls = [roll, 0, 0, 0];
    assert.equal(opponents.createEncounter(roster, "random", () => rolls.shift()).profile.id, id);
  }
  for (const id of ["__proto__", "constructor", "no-such-rival", {}, null]) {
    assert.throws(() => opponents.createEncounter(roster, id), RangeError);
  }
  assert.throws(() => opponents.createEncounter([...roster], "balanced"), TypeError);
  assert.throws(() => opponents.createEncounter(roster, "random", () => NaN), TypeError);
  assert.throws(() => opponents.createEncounter(roster, "balanced", () => Infinity), TypeError);
});

test("all 207 allowed placement-habit combinations are canonical, persistent and appropriate to their rival's deck", () => {
  let checked = 0;
  for (const rival of roster) {
    const { motive, placement, commitment } = rival.habits;
    const combinations = new Set();
    for (let m = 0; m < motive.length; m++) for (let f = 0; f < placement.length; f++) for (let c = 0; c < commitment.length; c++) {
      const rolls = [(m + .1) / motive.length, (f + .1) / placement.length, (c + .1) / commitment.length, .9];
      const encounter = opponents.createEncounter(roster, rival.id, () => rolls.shift());
      assert.ok(Object.isFrozen(encounter) && Object.isFrozen(encounter.traits));
      assert.deepEqual(encounter.traits.map(trait => trait.category), ["motive", "placement", "commitment"]);
      assert.deepEqual(encounter.traits.map(trait => trait.id), [motive[m], placement[f], commitment[c]]);
      assert.ok(encounter.traits.every(Object.isFrozen));
      assert.ok(encounter.traits.every(trait => trait.label && trait.description));
      assert.doesNotMatch(encounter.traits[2].description, /3 cards for maximum/);
      if (motive[m] === "element-loyalist") assert.equal(encounter.traits[0].element, "tide");
      combinations.add(encounter.traits.map(trait => trait.id).join("/"));
      const before = JSON.stringify(encounter);
      const hand = decks.buildDeckInstances(catalog, encounter.deck, "opponent").slice(c % 5, c % 5 + 7);
      const plan = four.chooseAiFormation(hand, [], [], rng(100 + checked), encounter.traits,
        { cardLibrary: library, history: [] }, rival.role);
      const committed = plan.filter(Boolean);
      assert.equal(plan.length, 4);
      assert.ok(committed.length >= 1 && committed.length <= 4);
      assert.equal(new Set(committed).size, committed.length);
      assert.ok(committed.every(card => hand.includes(card)));
      assert.equal(JSON.stringify(encounter), before);
      checked++;
    }
    assert.equal(combinations.size, motive.length * placement.length * commitment.length);
  }
  assert.equal(checked, 207);
});

test("rival habit pools reject typos, empty pools and duplicates rather than creating missing habits", () => {
  const valid = roster[1].habits;
  for (const placement of [[], ["left-flnk"], ["left-flank", "left-flank"], new Array(1), null]) {
    assert.throws(() => four.createAiTraits(() => 0, { ...valid, placement }), RangeError);
  }
  assert.throws(() => four.createAiTraits(() => 0, { ...valid, formation: ["strong-opener"] }), RangeError);
  for (const element of ["ember", "gust", "tide"]) {
    const roll = decks.ELEMENTS.indexOf(element) / 3;
    const values = [0, 0, 0, roll];
    const traits = four.createAiTraits(() => values.shift(), { ...valid, motive: ["element-loyalist"] });
    assert.equal(traits[0].element, element);
    assert.ok(traits[0].label.includes(normal.ELEMENTS[element].label));
  }
  assert.equal(normal.createAiTraits(() => 0)[2].description, "Often commits 1 card to conserve cards, accepting a less reliable formation.");
});

test("deck preferences activate their own role instead of merely committing a card with that label", () => {
  const hand = [
    { power: 8, element: "ember", tactic: "finisher" }, { power: 8, element: "tide", tactic: "vanguard" },
    { power: 6, element: "gust", tactic: "link" }, { power: 5, element: "tide", tactic: "rally" },
    { power: 4, element: "ember", tactic: "rally" }, { power: 3, element: "gust", tactic: "finisher" },
    { power: 5, element: "ember", tactic: "link" },
  ];
  const info = { cardLibrary: hand, history: [1, 1, 1].map(count => ({ playerCards: hand.slice(0, count) })) };
  for (const role of ["rally", "link", "finisher"]) {
    const activations = cards => cards.reduce((sum, card, lane) => sum + (!card ? 0 : role === "rally"
      ? four.getRallyBonus(cards, lane) : card.tactic === role ? four.getTacticBonus(cards, lane) : 0), 0);
    let neutral = 0, preferred = 0;
    for (let seed = 0; seed < 32; seed++) {
      neutral += activations(four.chooseAiFormation(hand, {}, {}, rng(seed), [], info));
      const chosen = four.chooseAiFormation(hand, {}, {}, rng(seed), [], info, role);
      preferred += activations(chosen);
      if (activations(chosen) && role === "link") assert.ok(chosen.some((card, lane) => card?.tactic === "link"
        && chosen[lane - 1] && card.element !== chosen[lane - 1].element));
      if (activations(chosen) && role === "finisher") assert.equal(chosen.filter(Boolean).at(-1).tactic, "finisher");
    }
    assert.ok(preferred > neutral, `${role} favors genuinely active bonuses across paired seeds`);
  }
  assert.deepEqual(four.chooseAiFormation(hand, {}, {}, rng(3), [], info, "__proto__"),
    four.chooseAiFormation(hand, {}, {}, rng(3), [], info));
});

test("Rally chains cannot amplify support and Finisher preferences cannot force a bonus on a single card", () => {
  for (const role of ["rally", "finisher", "link"]) {
    const hand = [{ element: "ember", power: 6, tactic: role }];
    const plan = four.chooseAiFormation(hand, [], [], rng(1), [], {}, role);
    assert.equal(plan.length, 4);
    assert.deepEqual(plan.filter(Boolean), hand);
    const lane = plan.findIndex(Boolean);
    assert.equal(four.getTacticBonus(plan, lane) + four.getRallyBonus(plan, lane), 0);
  }
  const chain = Array.from({ length: 4 }, (_, index) => ({ element: "tide", power: 4, tactic: "rally", id: index }));
  assert.deepEqual(chain.map((_, lane) => four.getRallyBonus(chain, lane)), [1, 1, 1, 0]);
});

test("rival identity and habits are scrubbed in Blind and removed on returning to Normal Play", () => {
  const info = {}, habits = {};
  const context = { document: { querySelector: () => info }, state: { gameMode: "four-lane", difficulty: "instinct",
    aiTraits: opponents.createEncounter(roster, "link", rng(1)).traits },
    matchFourLaneOpponent: opponents.createEncounter(roster, "link", rng(1)),
    ui: { opponentHabits: habits }, isFourLaneMode: () => context.state.gameMode === "four-lane" };
  runInNewContext([gameFunction("renderFourLaneRivalInfo"), gameFunction("renderOpponentHabits")].join("\n"), context);
  for (const difficulty of ["guided", "instinct", "blind"]) {
    context.state.difficulty = difficulty;
    context.renderFourLaneRivalInfo(); context.renderOpponentHabits();
    assert.equal(info.hidden, difficulty === "blind");
    assert.equal(habits.hidden, difficulty !== "instinct");
    if (difficulty === "blind") { assert.equal(info.textContent, ""); assert.equal(habits.innerHTML, ""); }
    else assert.match(info.textContent, /Cycle Weaver · Element Weavers/);
  }
  context.state.gameMode = "normal"; context.state.difficulty = "guided";
  context.renderFourLaneRivalInfo();
  assert.equal(info.hidden, true); assert.equal(info.textContent, "");
});

test("rival selection is frozen at lobby launch, not regenerated by restart or difficulty changes", () => {
  let rolls = 0;
  const context = {
    constructedDecks: decks, fourLaneDeckCatalog: catalog,
    confirmedFourLaneDeck: Object.freeze({ ...starters[1], cards: Object.freeze([...starters[1].cards]) }),
    fourLaneDeckEditor: { getSelectedDeck: () => starters[1] },
    fourLaneOpponents: { createEncounter: (...args) => { rolls++; return opponents.createEncounter(...args, rng(5)); } },
    fourLaneOpponentRoster: roster, selectedFourLaneOpponent: "link",
    isFourLaneMode: () => true, hideFourLanePreview() {}, stopTutorialMode() {}, closeGameMenu() {}, setGameMenuVisibility() {},
    state: { locked: false }, document: { querySelector: () => ({}), body: { classList: { remove() {} } } },
    ui: { mainMenuScreen: {}, difficultyDialog: { open: true } },
  };
  runInNewContext(gameFunction("showDifficultyChooser"), context);
  context.showDifficultyChooser("four-lane");
  const encounter = context.matchFourLaneOpponent, ownDeck = context.matchFourLaneDeck;
  assert.equal(encounter.profile.id, "link");
  assert.equal(rolls, 1);
  context.selectedFourLaneOpponent = "finisher";
  context.showDifficultyChooser("game");
  assert.equal(context.matchFourLaneOpponent, encounter);
  assert.equal(context.matchFourLaneDeck, ownDeck);
  assert.equal(rolls, 1);
  const start = source.indexOf("async function startGame()");
  const startSource = source.slice(start, source.indexOf('\ndocument.querySelector("#howButton")', start));
  assert.match(startSource, /state\.aiTraits = isFourLaneMode\(\) \? \[\.\.\.matchFourLaneOpponent\.traits\]/);
  assert.doesNotMatch(startSource, /createEncounter/);
  context.showDifficultyChooser("four-lane");
  assert.equal(context.matchFourLaneOpponent.profile.id, "finisher");
  assert.equal(rolls, 2);
});

test("the planner is never given the player's selected deck, private cards or current placement", () => {
  const info = { history: [], cardLibrary: library };
  for (const key of ["playerHand", "playerDeck", "selectedCardIds", "playerFormation", "matchFourLaneDeck"]) {
    Object.defineProperty(info, key, { get() { throw Error(`Private field read: ${key}`); } });
  }
  for (const rival of roster) {
    const encounter = opponents.createEncounter(roster, rival.id, rng(6));
    const hand = decks.buildDeckInstances(catalog, encounter.deck, "opponent").slice(0, 7);
    const plan = four.chooseAiFormation(hand, [], [], rng(7), encounter.traits, info, rival.role);
    assert.equal(plan.length, 4);
    assert.ok(plan.filter(Boolean).length >= 1);
  }
  assert.doesNotMatch(gameFunction("prepareAiPlan"), /state\.(playerHand|selectedCardIds|deck)|matchFourLaneDeck/);
});

test("all starter-vs-rival matches conserve 24 cards per owner, complete and preserve habits", () => {
  let matches = 0, reshuffles = 0;
  for (const playerDeck of starters) for (const rival of roster) for (let trial = 0; trial < 6; trial++) {
    const seed = 8000 + matches * 131;
    const encounter = opponents.createEncounter(roster, rival.id, rng(seed));
    const traitsBefore = JSON.stringify(encounter.traits);
    const sides = [playerDeck, encounter.deck].map((definition, index) => {
      const random = rng(seed + index * 8191), deck = [];
      const discard = decks.buildDeckInstances(catalog, definition, index ? "opponent" : "player");
      normal.reshuffleDiscardPile(deck, discard, random);
      const side = { deck, discard, hand: [], progress: four.createProgress(), random };
      four.replenishHand(deck, discard, side.hand, 7, random);
      return side;
    });
    const decisions = [rng(seed + 31001), rng(seed + 41001)], history = [];
    let finished = false;
    for (let round = 0; round < 150; round++) {
      const plays = [
        four.chooseAiFormation(sides[0].hand, sides[1].progress, sides[0].progress, decisions[0], [],
          { history: history.map(value => ({ playerCards: value.aiCards, aiCards: value.playerCards, laneProgress: { player: value.laneProgress?.ai, ai: value.laneProgress?.player } })), cardLibrary: library }),
        four.chooseAiFormation(sides[1].hand, sides[0].progress, sides[1].progress, decisions[1], encounter.traits,
          { history, cardLibrary: library }, rival.role),
      ];
      const result = four.resolveProgress(...plays, sides[0].progress, sides[1].progress);
      assert.ok(result.extraCardPoints.player <= Math.min(2, result.laneWins.player));
      assert.ok(result.extraCardPoints.ai <= Math.min(2, result.laneWins.ai));

      sides.forEach((side, index) => {
        const committed = plays[index].filter(Boolean);
        assert.equal(plays[index].length, 4);
        assert.ok(committed.every(card => side.hand.includes(card)));
        assert.equal(new Set(committed).size, committed.length);
        side.hand = side.hand.filter(card => !committed.includes(card));
        side.discard.push(...committed);
        side.progress = { ...result.progressAfter[(index === 0 ? "player" : "ai")] };

        const all = [...side.deck, ...side.discard, ...side.hand];
        assert.equal(all.length, 24);
        assert.equal(new Set(all.map(card => card.instanceId)).size, 24);
        assert.ok(all.every(card => card.instanceId.startsWith(index ? "opponent-" : "player-")));
      });
      const snapshot = cards => cards.map(card => card
        ? { element: card.element, power: card.power, tactic: card.tactic, art: card.art } : null);
      history.push({ playerCards: snapshot(plays[0]), aiCards: snapshot(plays[1]), laneProgress: result.laneProgress });
      if (sides.some(side => four.getProgressTotal(side.progress) === 18)) { finished = true; break; }
      sides.forEach(side => {
        reshuffles += Number(four.replenishHand(side.deck, side.discard, side.hand, four.ROUND_DRAW, side.random).reshuffled);
        assert.ok(side.hand.length >= 1 && side.hand.length <= 7);
      });
    }
    assert.ok(finished, `${playerDeck.name} versus ${rival.name}, trial ${trial}, must finish`);
    assert.equal(JSON.stringify(encounter.traits), traitsBefore);
    matches++;
  }
  assert.equal(matches, 96);
  assert.ok(reshuffles > 0);
});

test("rival selection is accessible, packaged before the game and separate from Normal Play", () => {
  assert.match(page, /<fieldset[^>]*id="fourLaneRivalChoice"[^>]*aria-describedby="fourLaneRivalHelp"/);
  assert.match(gameFunction("renderFourLaneOpponents"), /type="radio" name="fourLaneRival"/);
  assert.ok(page.indexOf("./src/deckbuilding.js") < page.indexOf("./src/opponents.js"));
  assert.ok(page.indexOf("./src/opponents.js") < page.indexOf("./src/game.js"));
  const packaging = readFileSync(new URL("../scripts/copy-static.js", import.meta.url), "utf8");
  assert.ok(packaging.includes('cp("src/opponents.js", "dist/src/opponents.js")'));
  assert.doesNotMatch(gameFunction("freshDeck"), /ClawDeckbuilding|fourLaneOpponent|FOUR_LANE_CARDS/);
  assert.match(source, /let selectedFourLaneOpponent = "random"/);
  assert.match(gameFunction("cardMarkup"), /cardRoleDefinition\(card, isFourLanePreview \? "four-lane" : state\.gameMode\)/);
  assert.match(source, /prepareAiPlan\(\);\s+if \(isFourLaneMode\(\)\) renderOpponentTells\(\);\s+renderFormationControls\(\)/);
});
