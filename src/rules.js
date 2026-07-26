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

global.ClawRules = Object.freeze({
  ELEMENTS,
  compareCards,
  hasWinningSet,
  chooseAiCard,
});
})(globalThis);
