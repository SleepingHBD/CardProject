(function exposeClawRules(global) {
const ELEMENTS = {
  ember: { icon: "🔥", beats: "gust", label: "Ember" },
  gust: { icon: "🍃", beats: "tide", label: "Gust" },
  tide: { icon: "💧", beats: "ember", label: "Tide" },
};

const ELEMENT_EDGE_BONUS = 2;
const CHAIN_BONUS = 1;
const MAX_COMMITMENT = 3;
const TROPHIES_PER_ELEMENT = 2;
const DIFFICULTY_MODES = Object.freeze(["guided", "veiled", "instinct", "blind"]);
const AI_MOTIVE_TRAITS = Object.freeze([
  Object.freeze({
    id: "trophy-hunter",
    category: "motive",
    label: "Trophy Hunter",
    description: "Favors elements it still needs as trophies.",
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
    description: "Favors the highest-Power cards in its hand.",
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
    description: "Favors its latest trophy's element.",
  }),
]);
const AI_FORMATION_TRAITS = Object.freeze([
  Object.freeze({
    id: "chain-weaver",
    category: "formation",
    label: "Chain Weaver",
    description: "Changes elements between lanes to earn Chain +1.",
  }),
  Object.freeze({
    id: "strong-opener",
    category: "formation",
    label: "Strong Opener",
    description: "Places its highest-Power card in Lane 1.",
  }),
  Object.freeze({
    id: "late-striker",
    category: "formation",
    label: "Late Striker",
    description: "Highest-Power card goes in its last played lane.",
  }),
]);
const AI_COMMITMENT_TRAITS = Object.freeze([
  Object.freeze({
    id: "focus-keeper",
    category: "commitment",
    label: "Focus Keeper",
    description: "Usually commits 1 card (Focus +2); sometimes 2 (Focus +1).",
  }),
  Object.freeze({
    id: "measured-planner",
    category: "commitment",
    label: "Measured Planner",
    description: "Usually commits 2 cards (Focus +1).",
  }),
  Object.freeze({
    id: "pressure-gambler",
    category: "commitment",
    label: "Pressure Gambler",
    description: "Usually commits 3 cards to threaten Pressure.",
  }),
  Object.freeze({
    id: "score-reader",
    category: "commitment",
    label: "Score Reader",
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
    description: "Usually changes its last round's card count.",
  }),
]);

function getFocusBonus(commitmentCount) {
  if (commitmentCount <= 0) return 0;
  return Math.max(0, MAX_COMMITMENT - commitmentCount);
}

function buildTellClues(
  cardCount,
  difficulty = "veiled",
  random = Math.random,
) {
  const safeDifficulty = DIFFICULTY_MODES.includes(difficulty)
    ? difficulty
    : "veiled";
  const safeCount = Math.min(MAX_COMMITMENT, Math.max(0, cardCount));

  return Array.from({ length: MAX_COMMITMENT }, (_, index) => {
    if (safeDifficulty === "instinct") return "sealed";
    if (index >= safeCount) return "empty";
    if (safeDifficulty === "guided") return "full";
    if (safeDifficulty === "blind") return "sealed";
    return random() < 0.5 ? "element" : "power";
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
      description: `Favors ${ELEMENTS[element].label} cards whenever it has them.`,
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

function getChainBonus(cards, index) {
  if (index <= 0 || !cards[index - 1] || !cards[index]) return 0;
  return cards[index - 1].element === cards[index].element ? 0 : CHAIN_BONUS;
}

function scoreClash(
  playerCard,
  aiCard,
  playerChain = 0,
  aiChain = 0,
  playerFocus = 0,
  aiFocus = 0,
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
      chain: playerChain,
      focus: playerFocus,
      total: playerCard.power + playerEdge + playerChain + playerFocus,
    },
    ai: {
      base: aiCard.power,
      edge: aiEdge,
      chain: aiChain,
      focus: aiFocus,
      total: aiCard.power + aiEdge + aiChain + aiFocus,
    },
  };
}

function compareCards(
  playerCard,
  aiCard,
  playerChain = 0,
  aiChain = 0,
  playerFocus = 0,
  aiFocus = 0,
) {
  const scoring = scoreClash(
    playerCard,
    aiCard,
    playerChain,
    aiChain,
    playerFocus,
    aiFocus,
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
    if (previousCard && previousCard.element !== card.element) {
      score += 1.25;
      if (hasAiTrait(traits, "chain-weaver")) score += 2.25;
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

function moveStrongestCard(cards, targetIndex) {
  if (cards.length < 2) return cards;
  const strongestIndex = cards.reduce(
    (bestIndex, card, index) => (
      card.power > cards[bestIndex].power ? index : bestIndex
    ),
    0,
  );
  const [strongest] = cards.splice(strongestIndex, 1);
  cards.splice(targetIndex, 0, strongest);
  return cards;
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

  if (hasAiTrait(traits, "strong-opener") && random() < 0.75) {
    moveStrongestCard(chosen, 0);
  } else if (hasAiTrait(traits, "late-striker") && random() < 0.75) {
    moveStrongestCard(chosen, chosen.length - 1);
  }

  return chosen;
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
  if (hasAiTrait(traits, "focus-keeper")) {
    commitment = roll < 0.62 ? 1 : roll < 0.92 ? 2 : 3;
  } else if (hasAiTrait(traits, "measured-planner")) {
    commitment = roll < 0.15 ? 1 : roll < 0.85 ? 2 : 3;
  } else if (hasAiTrait(traits, "pressure-gambler")) {
    commitment = roll < 0.1 ? 1 : roll < 0.35 ? 2 : 3;
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
    commitment = roll < 0.3 ? 1 : roll < 0.72 ? 2 : 3;
    if (trophyGap >= 2) commitment += 1;
    if (trophyGap <= -2) commitment -= 1;
  }
  return Math.min(maximum, Math.max(1, commitment));
}

function resolveClashes(playerCards, aiCards) {
  const playerCommitment = Math.min(playerCards.length, MAX_COMMITMENT);
  const aiCommitment = Math.min(aiCards.length, MAX_COMMITMENT);
  const clashCount = Math.min(playerCommitment, aiCommitment);
  const playerFocus = getFocusBonus(playerCommitment);
  const aiFocus = getFocusBonus(aiCommitment);
  const lanes = playerCards.slice(0, clashCount).map((playerCard, index) => {
    const aiCard = aiCards[index];
    const playerChain = getChainBonus(playerCards, index);
    const aiChain = getChainBonus(aiCards, index);
    const scoring = scoreClash(
      playerCard,
      aiCard,
      playerChain,
      aiChain,
      playerFocus,
      aiFocus,
    );
    const winner = scoring.player.total === scoring.ai.total
      ? "draw"
      : scoring.player.total > scoring.ai.total
        ? "player"
        : "ai";
    return { winner, ...scoring };
  });
  const results = lanes.map((lane) => lane.winner);
  const score = results.reduce(
    (totals, winner) => {
      totals[winner] += 1;
      return totals;
    },
    { player: 0, ai: 0, draw: 0 },
  );

  let winner = "draw";
  let decidedBy = "draw";
  if (score.player !== score.ai) {
    winner = score.player > score.ai ? "player" : "ai";
    decidedBy = "clashes";
  } else if (playerCommitment !== aiCommitment) {
    winner = playerCommitment > aiCommitment ? "player" : "ai";
    decidedBy = "pressure";
  }

  return {
    results,
    score,
    lanes,
    winner,
    decidedBy,
    commitments: { player: playerCommitment, ai: aiCommitment },
    focus: { player: playerFocus, ai: aiFocus },
  };
}

function getFormationReward(playerCards, aiCards, resolution) {
  const { results, score } = resolution;
  const winner = resolution.winner || (
    score.player > score.ai ? "player" : score.ai > score.player ? "ai" : "draw"
  );
  if (winner === "draw") return { winner, card: null, lane: -1 };

  let rewardIndex = results.indexOf(winner);
  if (resolution.decidedBy === "pressure") {
    rewardIndex = Math.min(playerCards.length, aiCards.length);
  }
  const winningCards = winner === "player" ? playerCards : aiCards;
  return {
    winner,
    card: winningCards[rewardIndex] || winningCards[0] || null,
    lane: rewardIndex,
  };
}

global.ClawRules = Object.freeze({
  ELEMENTS,
  ELEMENT_EDGE_BONUS,
  CHAIN_BONUS,
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
  getChainBonus,
  getFocusBonus,
  getPowerTier,
  getFormationReward,
  getElementTrophyCounts,
  getTrophyProgress,
  hasCompletedElementSet,
  reshuffleDiscardPile,
  chooseAiCard,
  chooseAiCards,
  chooseAiCommitment,
  resolveClashes,
  scoreClash,
});
})(globalThis);
