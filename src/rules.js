(function exposeClawRules(global) {
const ELEMENTS = {
  ember: { icon: "🔥", beats: "gust", label: "Ember" },
  gust: { icon: "🍃", beats: "tide", label: "Gust" },
  tide: { icon: "💧", beats: "ember", label: "Tide" },
};

function compareCards(playerCard, aiCard) {
  if (playerCard.element === aiCard.element) {
    if (playerCard.power === aiCard.power) return "draw";
    return playerCard.power > aiCard.power ? "player" : "ai";
  }

  return ELEMENTS[playerCard.element].beats === aiCard.element ? "player" : "ai";
}

function hasWinningSet(cards) {
  const elements = new Set(cards.map((card) => card.element));
  if (elements.size === 3) return true;

  return Object.keys(ELEMENTS).some((element) => {
    const colors = new Set(
      cards.filter((card) => card.element === element).map((card) => card.color),
    );
    return colors.size >= 3;
  });
}

function chooseAiCard(hand, playerWins, aiWins, random = Math.random) {
  if (hand.length === 1) return hand[0];

  const missingElements = Object.keys(ELEMENTS).filter(
    (element) => !aiWins.some((card) => card.element === element),
  );

  const scored = hand.map((card) => {
    let score = card.power * 0.35 + random() * 3;
    if (missingElements.includes(card.element)) score += 3;

    const playerElements = playerWins.map((won) => won.element);
    const likelyPlayerElement = playerElements.at(-1);
    if (likelyPlayerElement && ELEMENTS[card.element].beats === likelyPlayerElement) {
      score += 2;
    }

    return { card, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].card;
}

function chooseAiCards(hand, count, playerWins, aiWins, random = Math.random) {
  const available = [...hand];
  const chosen = [];
  const safeCount = Math.min(Math.max(1, count), available.length, 3);

  while (chosen.length < safeCount) {
    const card = chooseAiCard(available, playerWins, aiWins, random);
    chosen.push(card);
    available.splice(available.indexOf(card), 1);
  }

  return chosen;
}

function resolveClashes(playerCards, aiCards) {
  const results = playerCards.slice(0, 3).map((playerCard, index) => {
    const aiCard = aiCards[index];
    return aiCard ? compareCards(playerCard, aiCard) : "draw";
  });
  const score = results.reduce(
    (totals, winner) => {
      totals[winner] += 1;
      return totals;
    },
    { player: 0, ai: 0, draw: 0 },
  );

  return { results, score };
}

global.ClawRules = Object.freeze({
  ELEMENTS,
  compareCards,
  hasWinningSet,
  chooseAiCard,
  chooseAiCards,
  resolveClashes,
});
})(globalThis);
