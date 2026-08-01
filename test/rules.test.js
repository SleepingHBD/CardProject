import test from "node:test";
import assert from "node:assert/strict";
import "../src/rules.js";

const {
  ELEMENT_EDGE_BONUS,
  LANE_WIN_POINTS,
  EXTRA_CARD_POINTS,
  TACTICS,
  TACTIC_BONUS,
  TROPHIES_PER_ELEMENT,
  buildTellClues,
  chooseAiCard,
  chooseAiCommitment,
  chooseAiCards,
  chooseTrophyReward,
  createAiTraits,
  compareCards,
  forecastMatchup,
  getFormationReward,
  getFormationRewardOptions,
  getTacticBonus,
  getPowerTier,
  getElementTrophyCounts,
  getTrophyProgress,
  hasCompletedElementSet,
  orderAiFormation,
  reshuffleDiscardPile,
  resolveClashes,
  scoreClash,
} = globalThis.ClawRules;

const card = (element, power = 5, tactic = "link") => ({
  element,
  power,
  tactic,
});

test("element advantage adds a two-point edge", () => {
  assert.equal(ELEMENT_EDGE_BONUS, 2);
  assert.equal(compareCards(card("ember"), card("gust")), "player");
  assert.equal(compareCards(card("gust"), card("tide")), "player");
  assert.equal(compareCards(card("tide"), card("ember")), "player");
  assert.equal(compareCards(card("gust"), card("ember")), "ai");
});

test("an elemental counter is strong but not an automatic win", () => {
  assert.equal(compareCards(card("ember", 3), card("gust", 9)), "ai");
  assert.deepEqual(
    scoreClash(card("ember", 3), card("gust", 9)),
    {
      player: {
        base: 3,
        edge: 2,
        tactic: 0,
        tacticName: "Link",
        total: 5,
      },
      ai: {
        base: 9,
        edge: 0,
        tactic: 0,
        tacticName: "Link",
        total: 9,
      },
    },
  );
});

test("same element compares power and can draw", () => {
  assert.equal(compareCards(card("ember", 8), card("ember", 4)), "player");
  assert.equal(compareCards(card("ember", 3), card("ember", 7)), "ai");
  assert.equal(compareCards(card("ember", 6), card("ember", 6)), "draw");
});

test("card Tactics reward different formation positions", () => {
  const formation = [
    card("ember", 5, "vanguard"),
    card("tide", 5, "link"),
    card("tide", 5, "finisher"),
  ];
  assert.equal(TACTIC_BONUS, 1);
  assert.equal(TACTICS.vanguard.label, "Vanguard");
  assert.equal(getTacticBonus(formation, 0), 1);
  assert.equal(getTacticBonus(formation, 1), 1);
  assert.equal(getTacticBonus(formation, 2), 1);
  assert.equal(
    getTacticBonus([card("ember", 5, "link"), card("gust", 5, "vanguard")], 1),
    0,
  );
  assert.equal(
    getTacticBonus([card("ember", 5, "vanguard"), card("ember", 5, "link")], 1),
    0,
  );
  assert.equal(compareCards(card("tide", 5), card("tide", 5), 1, 0), "player");
});

test("matchup forecasts identify counters and power duels", () => {
  assert.equal(forecastMatchup("ember", "gust"), "advantage");
  assert.equal(forecastMatchup("ember", "tide"), "danger");
  assert.equal(forecastMatchup("ember", "ember"), "power");
});

test("power tiers reveal useful ranges without exposing exact cards", () => {
  assert.deepEqual(getPowerTier(9), { key: "high", label: "High strength", range: "8-9" });
  assert.equal(getPowerTier(6).key, "steady");
  assert.equal(getPowerTier(3).key, "low");
});

test("one trophy from each element is not enough to win", () => {
  assert.equal(TROPHIES_PER_ELEMENT, 2);
  assert.equal(
    hasCompletedElementSet([card("ember"), card("gust"), card("tide")]),
    false,
  );
});

test("two trophies from every element complete the match set", () => {
  assert.equal(
    hasCompletedElementSet([
      card("ember"),
      card("ember"),
      card("gust"),
      card("gust"),
      card("tide"),
      card("tide"),
    ]),
    true,
  );
});

test("extra trophies from one element do not replace missing elements", () => {
  assert.equal(
    hasCompletedElementSet([
      card("ember"),
      card("ember"),
      card("ember"),
      card("gust"),
      card("gust"),
      card("tide"),
    ]),
    false,
  );
});

test("trophy progress caps each element at two slots", () => {
  const trophies = [
    card("ember"),
    card("ember"),
    card("ember"),
    card("gust"),
    card("tide"),
  ];
  assert.deepEqual(
    getElementTrophyCounts(trophies),
    { ember: 3, gust: 1, tide: 1 },
  );
  assert.equal(getTrophyProgress(trophies), 4);
});

test("discard pile reshuffles only when the draw pile is empty", () => {
  const drawPile = [];
  const discardPile = ["ember", "gust", "tide"];
  assert.equal(reshuffleDiscardPile(drawPile, discardPile, () => 0), true);
  assert.equal(discardPile.length, 0);
  assert.deepEqual([...drawPile].sort(), ["ember", "gust", "tide"]);

  const waitingDiscard = ["another"];
  assert.equal(reshuffleDiscardPile(drawPile, waitingDiscard, () => 0), false);
  assert.deepEqual(waitingDiscard, ["another"]);
});

test("AI returns a valid card from its hand", () => {
  const hand = [card("ember", 2), card("gust", 9), card("tide", 4)];
  assert.ok(hand.includes(chooseAiCard(hand, [], [], () => 0.5)));
});

test("AI values elements still missing from its two-trophy goal", () => {
  const ember = card("ember", 9);
  const tide = card("tide", 3);
  const aiTrophies = [card("ember"), card("ember"), card("gust")];

  assert.equal(
    chooseAiCard([ember, tide], [], aiTrophies, () => 0.5),
    tide,
  );
});

test("AI can choose up to three unique cards", () => {
  const hand = [
    card("ember", 2),
    card("gust", 9),
    card("tide", 4),
    card("ember", 7),
  ];
  const chosen = chooseAiCards(hand, 3, [], [], () => 0.5);

  assert.equal(chosen.length, 3);
  assert.equal(new Set(chosen).size, 3);
  assert.ok(chosen.every((selected) => hand.includes(selected)));
});

test("AI selection cannot exceed its available hand", () => {
  const hand = [card("ember", 2), card("gust", 9)];
  assert.equal(chooseAiCards(hand, 3, [], [], () => 0.5).length, 2);
  assert.deepEqual(chooseAiCards([], 3, [], [], () => 0.5), []);
});

test("AI independently chooses commitments from one to three cards", () => {
  assert.equal(chooseAiCommitment(6, [], [], () => 0.1), 1);
  assert.equal(chooseAiCommitment(6, [], [], () => 0.5), 2);
  assert.equal(chooseAiCommitment(6, [], [], () => 0.9), 3);
  assert.equal(chooseAiCommitment(1, [], [], () => 0.9), 1);
});

test("Guided tells reveal both clues and preserve empty lanes", () => {
  assert.deepEqual(
    buildTellClues(2, "guided", () => 0.9),
    ["full", "full", "empty"],
  );
});

test("invalid difficulty falls back to Guided tells", () => {
  assert.deepEqual(
    buildTellClues(2, "unknown"),
    ["full", "full", "empty"],
  );
});

test("Blind tells conceal card details and commitment count", () => {
  assert.deepEqual(
    buildTellClues(2, "blind", () => 0.2),
    ["sealed", "sealed", "sealed"],
  );
});

test("Instinct tells conceal card details and commitment count", () => {
  assert.deepEqual(
    buildTellClues(2, "instinct", () => 0.2),
    ["sealed", "sealed", "sealed"],
  );
});

test("Instinct creates one motive, formation, and commitment habit", () => {
  const rolls = [0, 0.99, 0.99];
  const traits = createAiTraits(() => rolls.shift());

  assert.equal(traits.length, 3);
  assert.deepEqual(
    traits.map((trait) => trait.category),
    ["motive", "formation", "commitment"],
  );
  assert.deepEqual(
    traits.map((trait) => trait.id),
    ["trophy-hunter", "late-striker", "restless-dealer"],
  );
});

test("an element loyalist visibly favors its known element", () => {
  const ember = card("ember", 5);
  const gust = card("gust", 5);
  const traits = [{
    id: "element-loyalist",
    category: "motive",
    element: "gust",
  }];

  assert.equal(
    chooseAiCard([ember, gust], [], [], () => 0.5, null, traits),
    gust,
  );
});

test("formation habits influence where the strongest chosen card appears", () => {
  const hand = [card("ember", 4), card("gust", 9), card("tide", 6)];
  const lateStriker = [{ id: "late-striker", category: "formation" }];
  const chosen = chooseAiCards(hand, 3, [], [], () => 0.5, lateStriker);

  assert.equal(chosen.at(-1).power, 9);
});

test("Tactic Planner orders cards to activate positional Tactics", () => {
  const cards = [
    card("ember", 4, "vanguard"),
    card("gust", 9, "link"),
    card("tide", 6, "finisher"),
  ];
  const ordered = orderAiFormation(
    cards,
    () => 0.5,
    [{ id: "tactic-planner", category: "formation" }],
  );

  assert.deepEqual(ordered.map((entry) => entry.tactic), [
    "vanguard",
    "link",
    "finisher",
  ]);
  assert.equal(
    ordered.reduce(
      (total, _, index) => total + getTacticBonus(ordered, index),
      0,
    ),
    3,
  );
});

test("Trophy Denier favors counters to elements the player nearly completes", () => {
  const gust = card("gust", 5);
  const tide = card("tide", 5);
  const traits = [{ id: "trophy-denier", category: "motive" }];

  assert.equal(
    chooseAiCard(
      [gust, tide],
      [card("ember")],
      [],
      () => 0.5,
      null,
      traits,
    ),
    tide,
  );
});

test("Momentum Rider favors the element of the professor's latest trophy", () => {
  const ember = card("ember", 5);
  const gust = card("gust", 5);
  const traits = [{ id: "momentum-rider", category: "motive" }];

  assert.equal(
    chooseAiCard(
      [ember, gust],
      [],
      [card("gust")],
      () => 0.5,
      null,
      traits,
    ),
    gust,
  );
});

test("commitment habits create distinct card-count tendencies", () => {
  const soloGambler = [{ id: "solo-gambler", category: "commitment" }];
  const measuredPlanner = [{ id: "measured-planner", category: "commitment" }];
  const fullFormation = [{ id: "full-formation", category: "commitment" }];

  assert.equal(
    chooseAiCommitment(6, [], [], () => 0.5, soloGambler),
    1,
  );
  assert.equal(
    chooseAiCommitment(6, [], [], () => 0.5, measuredPlanner),
    2,
  );
  assert.equal(
    chooseAiCommitment(6, [], [], () => 0.5, fullFormation),
    3,
  );
});

test("Trophy Reader adjusts commitment to the public trophy score", () => {
  const scoreReader = [{ id: "score-reader", category: "commitment" }];

  assert.equal(
    chooseAiCommitment(6, [card("ember")], [], () => 0.5, scoreReader),
    3,
  );
  assert.equal(
    chooseAiCommitment(6, [], [card("ember")], () => 0.5, scoreReader),
    1,
  );
  assert.equal(
    chooseAiCommitment(6, [], [], () => 0.5, scoreReader),
    2,
  );
});

test("Echo Tactician often mirrors the player's previous commitment", () => {
  const echoTactician = [{ id: "echo-tactician", category: "commitment" }];

  assert.equal(
    chooseAiCommitment(
      6,
      [],
      [],
      () => 0.5,
      echoTactician,
      { player: 3, ai: 1 },
    ),
    3,
  );
});

test("Restless Dealer usually changes its previous commitment", () => {
  const restlessDealer = [{ id: "restless-dealer", category: "commitment" }];

  assert.notEqual(
    chooseAiCommitment(
      6,
      [],
      [],
      () => 0.2,
      restlessDealer,
      { player: 1, ai: 2 },
    ),
    2,
  );
});

test("Round Points use two per lane win and one per extra card", () => {
  assert.equal(LANE_WIN_POINTS, 2);
  assert.equal(EXTRA_CARD_POINTS, 1);
  assert.equal(
    scoreClash(card("ember", 4), card("ember", 5)).player.total,
    4,
  );
});

test("extra-card scoring is symmetric across every commitment pairing", () => {
  for (let playerCount = 1; playerCount <= 3; playerCount += 1) {
    for (let aiCount = 1; aiCount <= 3; aiCount += 1) {
      const playerCards = Array.from(
        { length: playerCount },
        () => card("ember", 5, "link"),
      );
      const aiCards = Array.from(
        { length: aiCount },
        () => card("ember", 5, "link"),
      );
      const resolution = resolveClashes(playerCards, aiCards);
      const playerExtraCardPoints = Math.max(0, playerCount - aiCount);
      const aiExtraCardPoints = Math.max(0, aiCount - playerCount);
      const expectedWinner = playerExtraCardPoints
        ? "player"
        : aiExtraCardPoints
          ? "ai"
          : "draw";

      assert.deepEqual(
        resolution.extraCardPoints,
        { player: playerExtraCardPoints, ai: aiExtraCardPoints },
      );
      assert.deepEqual(
        resolution.score,
        {
          player: playerExtraCardPoints,
          ai: aiExtraCardPoints,
          draw: Math.min(playerCount, aiCount),
        },
      );
      assert.equal(resolution.winner, expectedWinner);
      assert.equal(
        resolution.decidedBy,
        expectedWinner === "draw" ? "draw" : "extra-cards",
      );
    }
  }
});

test("multi-card formations resolve from left to right", () => {
  const playerCards = [
    card("ember", 5),
    card("tide", 4),
    card("gust", 8),
  ];
  const aiCards = [
    card("gust", 9),
    card("tide", 6),
    card("ember", 2),
  ];
  const resolution = resolveClashes(playerCards, aiCards);

  assert.deepEqual(resolution.results, ["ai", "ai", "player"]);
  assert.deepEqual(resolution.score, { player: 2, ai: 4, draw: 0 });
  assert.deepEqual(resolution.laneWins, { player: 1, ai: 2, draw: 0 });
  assert.deepEqual(
    resolution.lanes.map((lane) => [lane.player.total, lane.ai.total]),
    [[7, 9], [5, 7], [9, 5]],
  );
});

test("a normal formation win offers every lane-winning card as a trophy", () => {
  const playerCards = [card("ember"), card("gust"), card("tide")];
  const aiCards = [card("gust"), card("tide"), card("ember")];
  const resolution = resolveClashes(playerCards, aiCards);
  const options = getFormationRewardOptions(playerCards, aiCards, resolution);

  assert.equal(options.length, 3);
  assert.deepEqual(
    getFormationReward(playerCards, aiCards, resolution, playerCards[2]),
    {
      winner: "player",
      card: playerCards[2],
      lane: 2,
      fixed: false,
    },
  );
});

test("Professor Paws chooses a needed trophy element over raw power", () => {
  const emberReward = {
    winner: "ai",
    card: card("ember", 9, "finisher"),
    lane: 0,
    fixed: false,
  };
  const tideReward = {
    winner: "ai",
    card: card("tide", 4, "vanguard"),
    lane: 1,
    fixed: false,
  };

  assert.equal(
    chooseTrophyReward(
      [emberReward, tideReward],
      [card("ember"), card("ember")],
    ),
    tideReward,
  );
});

test("an evenly split formation awards no trophy", () => {
  const playerCards = [card("ember", 5), card("gust", 5)];
  const aiCards = [card("gust", 5), card("ember", 5)];
  const resolution = resolveClashes(playerCards, aiCards);

  assert.deepEqual(
    getFormationReward(playerCards, aiCards, resolution),
    { winner: "draw", card: null, lane: -1, fixed: false },
  );
});

test("one won lane beats one opposing extra card", () => {
  const playerCards = [card("ember", 5, "vanguard")];
  const aiCards = [card("gust", 5), card("tide", 8)];
  const resolution = resolveClashes(playerCards, aiCards);

  assert.equal(resolution.lanes[0].winner, "player");
  assert.deepEqual(resolution.lanePoints, { player: 2, ai: 0 });
  assert.deepEqual(resolution.extraCardPoints, { player: 0, ai: 1 });
  assert.deepEqual(resolution.score, { player: 2, ai: 1, draw: 0 });
  assert.equal(resolution.winner, "player");
  assert.equal(resolution.decidedBy, "clashes");
});

test("an unopposed Finisher still adds only one extra-card Round Point", () => {
  const playerCards = [
    card("ember", 5, "vanguard"),
    card("tide", 9, "finisher"),
  ];
  const aiCards = [card("gust", 5, "vanguard")];
  const resolution = resolveClashes(playerCards, aiCards);

  assert.equal(getTacticBonus(playerCards, 1), 1);
  assert.equal(resolution.lanes.length, 1);
  assert.deepEqual(resolution.extraCardPoints, { player: 1, ai: 0 });
  assert.deepEqual(resolution.score, { player: 3, ai: 0, draw: 0 });
});

test("one won lane meets two opposing extra cards in a round draw", () => {
  const playerCards = [card("ember", 5, "vanguard")];
  const aiCards = [
    card("gust", 5),
    card("tide", 8),
    card("ember", 8),
  ];
  const resolution = resolveClashes(playerCards, aiCards);

  assert.equal(resolution.lanes[0].winner, "player");
  assert.deepEqual(resolution.extraCardPoints, { player: 0, ai: 2 });
  assert.deepEqual(resolution.score, { player: 2, ai: 2, draw: 0 });
  assert.equal(resolution.winner, "draw");
  assert.equal(resolution.decidedBy, "draw");
  assert.deepEqual(
    getFormationReward(playerCards, aiCards, resolution),
    { winner: "draw", card: null, lane: -1, fixed: false },
  );
});

test("the larger commitment adds an extra-card point to a split lane score", () => {
  const playerCards = [card("ember", 5), card("gust", 5)];
  const aiCards = [
    card("gust", 6),
    card("ember", 5),
    card("tide", 7),
  ];
  const resolution = resolveClashes(playerCards, aiCards);

  assert.deepEqual(resolution.laneWins, { player: 1, ai: 1, draw: 0 });
  assert.deepEqual(resolution.lanePoints, { player: 2, ai: 2 });
  assert.deepEqual(resolution.extraCardPoints, { player: 0, ai: 1 });
  assert.deepEqual(resolution.score, { player: 2, ai: 3, draw: 0 });
  assert.equal(resolution.winner, "ai");
  assert.equal(resolution.decidedBy, "extra-cards");
  assert.deepEqual(
    getFormationReward(playerCards, aiCards, resolution),
    {
      winner: "ai",
      card: aiCards[2],
      lane: 2,
      fixed: true,
    },
  );
});

test("equal commitments still draw when Round Points are tied", () => {
  const playerCards = [card("ember", 5), card("gust", 5)];
  const aiCards = [card("gust", 6), card("ember", 5)];
  const resolution = resolveClashes(playerCards, aiCards);

  assert.equal(resolution.winner, "draw");
  assert.equal(resolution.decidedBy, "draw");
});

test("scripted tutorial lessons demonstrate their intended rule outcomes", () => {
  const elementLesson = resolveClashes(
    [card("ember", 3, "link")],
    [card("gust", 3, "finisher")],
  );
  assert.equal(elementLesson.winner, "player");
  assert.equal(elementLesson.lanes[0].player.edge, 2);
  assert.equal(elementLesson.lanes[0].player.tactic, 0);
  assert.equal(elementLesson.lanes[0].player.total, 5);
  assert.deepEqual(elementLesson.score, { player: 2, ai: 0, draw: 0 });

  const oneVsTwoCommitmentScenario = resolveClashes(
    [card("gust", 9, "vanguard")],
    [card("tide", 9, "finisher"), card("tide", 6, "link")],
  );
  assert.equal(oneVsTwoCommitmentScenario.lanes[0].winner, "player");
  assert.deepEqual(
    oneVsTwoCommitmentScenario.score,
    { player: 2, ai: 1, draw: 0 },
  );
  assert.equal(oneVsTwoCommitmentScenario.winner, "player");

  const oneVsThreeCommitmentScenario = resolveClashes(
    [card("gust", 9, "vanguard")],
    [
      card("tide", 9, "finisher"),
      card("tide", 6, "link"),
      card("tide", 5, "link"),
    ],
  );
  assert.deepEqual(
    oneVsThreeCommitmentScenario.score,
    { player: 2, ai: 2, draw: 0 },
  );
  assert.equal(oneVsThreeCommitmentScenario.winner, "draw");

  const tacticLesson = resolveClashes(
    [
      card("ember", 6, "vanguard"),
      card("tide", 6, "link"),
      card("gust", 3, "finisher"),
    ],
    [
      card("ember", 3, "link"),
      card("tide", 5, "link"),
      card("tide", 4, "vanguard"),
    ],
  );
  assert.deepEqual(tacticLesson.results, ["player", "player", "player"]);
  assert.deepEqual(
    tacticLesson.lanes.map((lane) => lane.player.tactic),
    [1, 1, 1],
  );

  const extraCardLesson = resolveClashes(
    [card("ember", 9, "finisher"), card("tide", 6, "link")],
    [card("ember", 9, "finisher")],
  );
  assert.equal(extraCardLesson.lanes[0].winner, "draw");
  assert.deepEqual(extraCardLesson.extraCardPoints, { player: 1, ai: 0 });
  assert.deepEqual(extraCardLesson.score, { player: 1, ai: 0, draw: 1 });
  assert.equal(extraCardLesson.winner, "player");
  assert.equal(extraCardLesson.decidedBy, "extra-cards");

  const trophyAndCardFlowLesson = resolveClashes(
    [card("ember", 6, "vanguard"), card("tide", 6, "link")],
    [card("ember", 3, "link"), card("tide", 4, "vanguard")],
  );
  assert.deepEqual(trophyAndCardFlowLesson.results, ["player", "player"]);
  const trophyOptions = getFormationRewardOptions(
    [card("ember", 6, "vanguard"), card("tide", 6, "link")],
    [card("ember", 3, "link"), card("tide", 4, "vanguard")],
    trophyAndCardFlowLesson,
  );
  assert.equal(trophyOptions.length, 2);
  assert.equal(trophyOptions.every((option) => option.fixed === false), true);
});
