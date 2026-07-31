(function exposeClawRules(global) {
const ELEMENTS = {
  ember: { icon: "🔥", beats: "gust", label: "Ember" },
  gust: { icon: "🍃", beats: "tide", label: "Gust" },
  tide: { icon: "💧", beats: "ember", label: "Tide" },
};

const ELEMENT_EDGE_BONUS = 2;
const TACTIC_BONUS = 1;
const MAX_COMMITMENT = 3;
const TROPHIES_PER_ELEMENT = 2;
const TACTICS = Object.freeze({
  vanguard: Object.freeze({
    icon: "shield",
    label: "Vanguard",
    description: "Vanguard: +1 when committed in Lane 1.",
  }),
  link: Object.freeze({
    icon: "chain",
    label: "Link",
    description: "Link: +1 in Lane 2 or 3 when the card directly before the Link has a different element from the Link card.",
  }),
  finisher: Object.freeze({
    icon: "sword",
    label: "Finisher",
    description: "Finisher: +1 when committed last in a 2- or 3-card formation and facing an opposing card in the same lane.",
  }),
});
const DIFFICULTY_MODES = Object.freeze(["guided", "instinct", "blind"]);
const AI_MOTIVE_TRAITS = Object.freeze([
  Object.freeze({
    id: "trophy-hunter",
    category: "motive",
    label: "Trophy Hunter",
    description: "Favors elements he still needs as trophies.",
  }),
  Object.freeze({
    id: "counter-scholar",
    category: "motive",
    label: "Counter Scholar",
    description: "Favors the element that beats your latest trophy.",
  }),
  Object.freeze({
    id: "power-seeker",
    category: "motive",
    label: "Power Seeker",
    description: "Favors the highest-Power cards in his hand.",
  }),
  Object.freeze({
    id: "element-loyalist",
    category: "motive",
    label: "Element Loyalist",
    description: "Often favors a particular element.",
  }),
  Object.freeze({
    id: "trophy-denier",
    category: "motive",
    label: "Trophy Denier",
    description: "Counters elements where you have 1/2 trophies.",
  }),
  Object.freeze({
    id: "momentum-rider",
    category: "motive",
    label: "Momentum Rider",
    description: "Favors his latest trophy's element.",
  }),
]);
const AI_FORMATION_TRAITS = Object.freeze([
  Object.freeze({
    id: "tactic-planner",
    category: "formation",
    label: "Role Planner",
    description: "Usually orders his cards to activate as many Formation Roles as possible.",
  }),
  Object.freeze({
    id: "strong-opener",
    category: "formation",
    label: "Strong Opener",
    description: "Places his highest-Power card in Lane 1.",
  }),
  Object.freeze({
    id: "late-striker",
    category: "formation",
    label: "Late Striker",
    description: "Highest-Power card goes in his last played lane.",
  }),
]);
const AI_COMMITMENT_TRAITS = Object.freeze([
  Object.freeze({
    id: "solo-gambler",
    category: "commitment",
    label: "Solo Gambler",
    description: "Often commits 1 card to conserve his hand, accepting a less reliable formation.",
  }),
  Object.freeze({
    id: "measured-planner",
    category: "commitment",
    label: "Measured Planner",
    description: "Usually commits 2 cards, balancing reliability against card cost.",
  }),
  Object.freeze({
    id: "full-formation",
    category: "commitment",
    label: "Full Formation",
    description: "Usually commits 3 cards for maximum lane coverage and a chance to earn extra-card points.",
  }),
  Object.freeze({
    id: "score-reader",
    category: "commitment",
    label: "Trophy Reader",
    description: "Commits more cards when behind in trophies; fewer when ahead.",
  }),
  Object.freeze({
    id: "echo-tactician",
    category: "commitment",
    label: "Echo Tactician",
    description: "Often matches your last round's card count.",
  }),
  Object.freeze({
    id: "restless-dealer",
    category: "commitment",
    label: "Restless Dealer",
    description: "Usually changes his last round's card count.",
  }),
]);

const LANE_WIN_POINTS = 2;
const EXTRA_CARD_POINTS = 1;

function buildTellClues(
  cardCount,
  difficulty = "guided",
) {
  const safeDifficulty = DIFFICULTY_MODES.includes(difficulty)
    ? difficulty
    : "guided";
  const safeCount = Math.min(MAX_COMMITMENT, Math.max(0, cardCount));

  return Array.from({ length: MAX_COMMITMENT }, (_, index) => {
    if (safeDifficulty === "instinct" || safeDifficulty === "blind") return "sealed";
    if (index >= safeCount) return "empty";
    if (safeDifficulty === "guided") return "full";
    return "sealed";
  });
}

function pickRandom(items, random) {
  const roll = Math.min(0.999999, Math.max(0, random()));
  return items[Math.floor(roll * items.length)];
}

function createAiTraits(random = Math.random) {
  const motiveTemplate = pickRandom(AI_MOTIVE_TRAITS, random);
  const formationTemplate = pickRandom(AI_FORMATION_TRAITS, random);
  const commitmentTemplate = pickRandom(AI_COMMITMENT_TRAITS, random);
  let motive = { ...motiveTemplate };

  if (motive.id === "element-loyalist") {
    const element = pickRandom(Object.keys(ELEMENTS), random);
    motive = {
      ...motive,
      element,
      label: `${ELEMENTS[element].label} Loyalist`,
      description: `Favors ${ELEMENTS[element].label} cards whenever he has them.`,
    };
  }

  return [
    Object.freeze(motive),
    Object.freeze({ ...formationTemplate }),
    Object.freeze({ ...commitmentTemplate }),
  ];
}

function hasAiTrait(traits, id) {
  return traits.some((trait) => trait.id === id);
}

function getTacticBonus(
  cards,
  index,
  opponentCommitmentCount = cards.length,
) {
  const card = cards[index];
  if (!card || !TACTICS[card.tactic]) return 0;

  if (card.tactic === "vanguard") {
    return index === 0 ? TACTIC_BONUS : 0;
  }
  if (card.tactic === "link") {
    return index > 0
      && cards[index - 1]?.element !== card.element
      ? TACTIC_BONUS
      : 0;
  }
  return cards.length > 1
    && index === cards.length - 1
    && index < opponentCommitmentCount
    ? TACTIC_BONUS
    : 0;
}

function scoreClash(
  playerCard,
  aiCard,
  playerTactic = 0,
  aiTactic = 0,
) {
  const playerEdge = ELEMENTS[playerCard.element].beats === aiCard.element
    ? ELEMENT_EDGE_BONUS
    : 0;
  const aiEdge = ELEMENTS[aiCard.element].beats === playerCard.element
    ? ELEMENT_EDGE_BONUS
    : 0;

  return {
    player: {
      base: playerCard.power,
      edge: playerEdge,
      tactic: playerTactic,
      tacticName: TACTICS[playerCard.tactic]?.label || "Role",
      total: playerCard.power
        + playerEdge
        + playerTactic,
    },
    ai: {
      base: aiCard.power,
      edge: aiEdge,
      tactic: aiTactic,
      tacticName: TACTICS[aiCard.tactic]?.label || "Role",
      total: aiCard.power
        + aiEdge
        + aiTactic,
    },
  };
}

function compareCards(
  playerCard,
  aiCard,
  playerTactic = 0,
  aiTactic = 0,
) {
  const scoring = scoreClash(
    playerCard,
    aiCard,
    playerTactic,
    aiTactic,
  );
  if (scoring.player.total === scoring.ai.total) return "draw";
  return scoring.player.total > scoring.ai.total ? "player" : "ai";
}

function forecastMatchup(playerElement, opponentElement) {
  if (playerElement === opponentElement) return "power";
  return ELEMENTS[playerElement].beats === opponentElement ? "advantage" : "danger";
}

function getPowerTier(power) {
  if (power >= 8) return { key: "high", label: "High strength", range: "8-9" };
  if (power >= 5) return { key: "steady", label: "Steady strength", range: "5-6" };
  return { key: "low", label: "Low strength", range: "3-4" };
}

function getElementTrophyCounts(cards) {
  return cards.reduce(
    (counts, card) => {
      if (Object.hasOwn(counts, card.element)) counts[card.element] += 1;
      return counts;
    },
    Object.fromEntries(Object.keys(ELEMENTS).map((element) => [element, 0])),
  );
}

function getTrophyProgress(cards) {
  const counts = getElementTrophyCounts(cards);
  return Object.keys(ELEMENTS).reduce(
    (progress, element) => progress + Math.min(counts[element], TROPHIES_PER_ELEMENT),
    0,
  );
}

function hasCompletedElementSet(cards) {
  const counts = getElementTrophyCounts(cards);
  return Object.keys(ELEMENTS).every(
    (element) => counts[element] >= TROPHIES_PER_ELEMENT,
  );
}

function reshuffleDiscardPile(drawPile, discardPile, random = Math.random) {
  if (drawPile.length || !discardPile.length) return false;

  for (let index = discardPile.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [discardPile[index], discardPile[swapIndex]] = [
      discardPile[swapIndex],
      discardPile[index],
    ];
  }
  drawPile.push(...discardPile);
  discardPile.length = 0;
  return true;
}

function chooseAiCard(
  hand,
  playerWins,
  aiWins,
  random = Math.random,
  previousCard = null,
  traits = [],
) {
  if (hand.length === 1) return hand[0];

  const aiTrophyCounts = getElementTrophyCounts(aiWins);
  const playerTrophyCounts = getElementTrophyCounts(playerWins);
  const missingElements = Object.keys(ELEMENTS).filter(
    (element) => aiTrophyCounts[element] < TROPHIES_PER_ELEMENT,
  );
  const threatenedElements = Object.keys(ELEMENTS).filter(
    (element) => playerTrophyCounts[element] === TROPHIES_PER_ELEMENT - 1,
  );
  const latestAiTrophyElement = aiWins.at(-1)?.element;

  const scored = hand.map((card) => {
    let score = card.power * 0.35 + random() * 3;
    if (missingElements.includes(card.element)) {
      score += 2.5 + (TROPHIES_PER_ELEMENT - aiTrophyCounts[card.element]);
      if (hasAiTrait(traits, "trophy-hunter")) score += 3;
    }

    const playerElements = playerWins.map((won) => won.element);
    const likelyPlayerElement = playerElements.at(-1);
    if (likelyPlayerElement && ELEMENTS[card.element].beats === likelyPlayerElement) {
      score += 2;
      if (hasAiTrait(traits, "counter-scholar")) score += 3;
    }
    if (
      previousCard
      && card.tactic === "link"
      && previousCard.element !== card.element
    ) {
      score += 1.25;
      if (hasAiTrait(traits, "tactic-planner")) score += 2.25;
    }
    if (hasAiTrait(traits, "power-seeker")) score += card.power * 0.5;

    const loyalist = traits.find((trait) => trait.id === "element-loyalist");
    if (loyalist?.element === card.element) score += 3.25;
    if (
      hasAiTrait(traits, "trophy-denier")
      && threatenedElements.some(
        (element) => ELEMENTS[card.element].beats === element,
      )
    ) {
      score += 3;
    }
    if (
      hasAiTrait(traits, "momentum-rider")
      && latestAiTrophyElement === card.element
    ) {
      score += 3;
    }

    return { card, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].card;
}

function getCardPermutations(cards) {
  if (cards.length < 2) return [[...cards]];
  return cards.flatMap((card, index) =>
    getCardPermutations(cards.filter((_, cardIndex) => cardIndex !== index))
      .map((remainder) => [card, ...remainder]));
}

function orderAiFormation(cards, random = Math.random, traits = []) {
  if (cards.length < 2) return [...cards];
  const strongestPower = Math.max(...cards.map((card) => card.power));
  const tacticWeight = hasAiTrait(traits, "tactic-planner") ? 5 : 0.9;

  return getCardPermutations(cards)
    .map((formation) => {
      const tacticScore = formation.reduce(
        (total, _, index) =>
          total + getTacticBonus(formation, index, formation.length),
        0,
      );
      let score = tacticScore * tacticWeight + random() * 1.2;
      if (
        hasAiTrait(traits, "strong-opener")
        && formation[0].power === strongestPower
      ) score += 4.5;
      if (
        hasAiTrait(traits, "late-striker")
        && formation.at(-1).power === strongestPower
      ) score += 4.5;
      return { formation, score };
    })
    .sort((a, b) => b.score - a.score)[0].formation;
}

function chooseAiCards(
  hand,
  count,
  playerWins,
  aiWins,
  random = Math.random,
  traits = [],
) {
  const available = [...hand];
  const chosen = [];
  const safeCount = Math.min(Math.max(1, count), available.length, 3);

  while (chosen.length < safeCount) {
    const card = chooseAiCard(
      available,
      playerWins,
      aiWins,
      random,
      chosen.at(-1) || null,
      traits,
    );
    chosen.push(card);
    available.splice(available.indexOf(card), 1);
  }

  return orderAiFormation(chosen, random, traits);
}

function chooseAiCommitment(
  handLength,
  playerWins,
  aiWins,
  random = Math.random,
  traits = [],
  previousCommitments = {},
) {
  const maximum = Math.min(MAX_COMMITMENT, handLength);
  if (maximum <= 1) return maximum;

  const roll = random();
  const trophyGap = getTrophyProgress(playerWins) - getTrophyProgress(aiWins);
  const previousPlayerCommitment = previousCommitments.player;
  const previousAiCommitment = previousCommitments.ai;
  const hasValidPreviousPlayerCommitment = Number.isInteger(previousPlayerCommitment)
    && previousPlayerCommitment >= 1
    && previousPlayerCommitment <= MAX_COMMITMENT;
  const hasValidPreviousAiCommitment = Number.isInteger(previousAiCommitment)
    && previousAiCommitment >= 1
    && previousAiCommitment <= MAX_COMMITMENT;
  let commitment;
  if (hasAiTrait(traits, "solo-gambler")) {
    commitment = roll < 0.52 ? 1 : roll < 0.9 ? 2 : 3;
  } else if (hasAiTrait(traits, "measured-planner")) {
    commitment = roll < 0.1 ? 1 : roll < 0.82 ? 2 : 3;
  } else if (hasAiTrait(traits, "full-formation")) {
    commitment = roll < 0.06 ? 1 : roll < 0.35 ? 2 : 3;
  } else if (hasAiTrait(traits, "score-reader")) {
    if (trophyGap > 0) {
      commitment = roll < 0.1 ? 1 : roll < 0.3 ? 2 : 3;
    } else if (trophyGap < 0) {
      commitment = roll < 0.65 ? 1 : roll < 0.9 ? 2 : 3;
    } else {
      commitment = roll < 0.15 ? 1 : roll < 0.85 ? 2 : 3;
    }
  } else if (
    hasAiTrait(traits, "echo-tactician")
    && hasValidPreviousPlayerCommitment
  ) {
    commitment = roll < 0.72
      ? previousPlayerCommitment
      : roll < 0.82
        ? 1
        : roll < 0.92
          ? 2
          : 3;
  } else if (
    hasAiTrait(traits, "restless-dealer")
    && hasValidPreviousAiCommitment
  ) {
    if (roll < 0.76) {
      const alternatives = [1, 2, 3].filter(
        (count) => count !== previousAiCommitment,
      );
      commitment = alternatives[
        Math.min(alternatives.length - 1, Math.floor((roll / 0.76) * alternatives.length))
      ];
    } else {
      commitment = previousAiCommitment;
    }
  } else {
    commitment = roll < 0.2 ? 1 : roll < 0.75 ? 2 : 3;
    if (trophyGap >= 2) commitment += 1;
    if (trophyGap <= -2) commitment -= 1;
  }
  return Math.min(maximum, Math.max(1, commitment));
}

function resolveClashes(playerCards, aiCards) {
  const playerCommitment = Math.min(playerCards.length, MAX_COMMITMENT);
  const aiCommitment = Math.min(aiCards.length, MAX_COMMITMENT);
  const clashCount = Math.min(playerCommitment, aiCommitment);
  const lanes = playerCards.slice(0, clashCount).map((playerCard, index) => {
    const aiCard = aiCards[index];
    const playerTactic = getTacticBonus(playerCards, index, aiCommitment);
    const aiTactic = getTacticBonus(aiCards, index, playerCommitment);
    const scoring = scoreClash(
      playerCard,
      aiCard,
      playerTactic,
      aiTactic,
    );
    const winner = scoring.player.total === scoring.ai.total
      ? "draw"
      : scoring.player.total > scoring.ai.total
        ? "player"
        : "ai";
    return { winner, ...scoring };
  });
  const results = lanes.map((lane) => lane.winner);
  const laneWins = results.reduce(
    (totals, winner) => {
      totals[winner] += 1;
      return totals;
    },
    { player: 0, ai: 0, draw: 0 },
  );
  const extraCardPoints = {
    player: Math.max(0, playerCommitment - aiCommitment)
      * EXTRA_CARD_POINTS,
    ai: Math.max(0, aiCommitment - playerCommitment)
      * EXTRA_CARD_POINTS,
  };
  const lanePoints = {
    player: laneWins.player * LANE_WIN_POINTS,
    ai: laneWins.ai * LANE_WIN_POINTS,
  };
  const score = {
    player: lanePoints.player + extraCardPoints.player,
    ai: lanePoints.ai + extraCardPoints.ai,
    draw: laneWins.draw,
  };

  let winner = "draw";
  let decidedBy = "draw";
  if (score.player !== score.ai) {
    winner = score.player > score.ai ? "player" : "ai";
    const winnerLanePoints = lanePoints[winner];
    const loser = winner === "player" ? "ai" : "player";
    decidedBy = winnerLanePoints <= lanePoints[loser]
      ? "extra-cards"
      : "clashes";
  }

  return {
    results,
    score,
    laneWins,
    lanePoints,
    extraCardPoints,
    lanes,
    winner,
    decidedBy,
    commitments: { player: playerCommitment, ai: aiCommitment },
  };
}

function getFormationRewardOptions(playerCards, aiCards, resolution) {
  const { results, score } = resolution;
  const winner = resolution.winner || (
    score.player > score.ai ? "player" : score.ai > score.player ? "ai" : "draw"
  );
  if (winner === "draw") return [];

  const winningCards = winner === "player" ? playerCards : aiCards;
  if (resolution.decidedBy === "extra-cards") {
    const rewardIndex = Math.min(playerCards.length, aiCards.length);
    const card = winningCards[rewardIndex] || winningCards[0] || null;
    return card ? [{ winner, card, lane: rewardIndex, fixed: true }] : [];
  }

  return results.flatMap((laneWinner, lane) =>
    laneWinner === winner && winningCards[lane]
      ? [{ winner, card: winningCards[lane], lane, fixed: false }]
      : []);
}

function getFormationReward(
  playerCards,
  aiCards,
  resolution,
  selectedCard = null,
) {
  const options = getFormationRewardOptions(playerCards, aiCards, resolution);
  if (!options.length) {
    return { winner: "draw", card: null, lane: -1, fixed: false };
  }
  return options.find((option) => option.card === selectedCard) || options[0];
}

function chooseTrophyReward(options, collectedCards = []) {
  if (!options.length) return null;
  const counts = getElementTrophyCounts(collectedCards);
  return [...options].sort((left, right) => {
    const leftNeeded = counts[left.card.element] < TROPHIES_PER_ELEMENT ? 1 : 0;
    const rightNeeded = counts[right.card.element] < TROPHIES_PER_ELEMENT ? 1 : 0;
    return rightNeeded - leftNeeded
      || counts[left.card.element] - counts[right.card.element]
      || left.card.power - right.card.power
      || left.lane - right.lane;
  })[0];
}

global.ClawRules = Object.freeze({
  ELEMENTS,
  TACTICS,
  ELEMENT_EDGE_BONUS,
  TACTIC_BONUS,
  LANE_WIN_POINTS,
  EXTRA_CARD_POINTS,
  MAX_COMMITMENT,
  TROPHIES_PER_ELEMENT,
  DIFFICULTY_MODES,
  AI_MOTIVE_TRAITS,
  AI_FORMATION_TRAITS,
  AI_COMMITMENT_TRAITS,
  buildTellClues,
  createAiTraits,
  compareCards,
  forecastMatchup,
  getTacticBonus,
  getPowerTier,
  getFormationReward,
  getFormationRewardOptions,
  getElementTrophyCounts,
  getTrophyProgress,
  hasCompletedElementSet,
  reshuffleDiscardPile,
  chooseAiCard,
  chooseAiCards,
  chooseAiCommitment,
  chooseTrophyReward,
  orderAiFormation,
  resolveClashes,
  scoreClash,
});
})(globalThis);
