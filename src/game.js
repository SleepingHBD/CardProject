const { ELEMENTS, chooseAiCards, hasWinningSet, resolveClashes } = globalThis.ClawRules;
const audio = globalThis.ClawAudio;

const CARD_LIBRARY = [
  ["ember", "red", 8, "Sizzle Mittens", "Flame Yarn", "Never leaves a loose end.", "epic", "sizzle-mittens"],
  ["ember", "orange", 6, "Candle Pounce", "Wax & Whack", "A bright idea with claws.", "rare", "candle-pounce"],
  ["ember", "gold", 4, "Toastie Toe Beans", "Cozy Forge", "Tiny paws, furnace heart.", "uncommon", "toastie-toe-beans"],
  ["ember", "violet", 9, "Comet Claw", "Starfall Swipe", "Makes an entrance from orbit.", "legendary", "comet-claw"],
  ["ember", "teal", 3, "Teapot Tabby", "Scalding Service", "Tea is served dangerously hot.", "common", "teapot-tabby"],
  ["gust", "green", 8, "Breeze Biscuit", "Leaf Rider", "No map. Excellent balance.", "epic", "breeze-biscuit"],
  ["gust", "teal", 6, "Leafy Loaf", "Nap Cyclone", "Rest is a tactical maneuver.", "rare", "leafy-loaf"],
  ["gust", "gold", 5, "Whisker Whirl", "Ribbon Twister", "Forecast: fabulous.", "uncommon", "whisker-whirl"],
  ["gust", "violet", 9, "Gale Groomer", "Captain's Roar", "Every breeze follows orders.", "legendary", "gale-groomer"],
  ["gust", "red", 3, "Dandelion Dash", "Seed Stampede", "All speed. Some direction.", "common", "dandelion-dash"],
  ["tide", "blue", 8, "Puddle Pouncer", "Splash Ambush", "Dry socks are overrated.", "epic", "puddle-pouncer"],
  ["tide", "teal", 6, "Bubble Bengal", "Pearl Pop", "Elegance under pressure.", "rare", "bubble-bengal"],
  ["tide", "violet", 5, "Moonpool Mouser", "Lunar Ripple", "The moon whispers. She listens.", "uncommon", "moonpool-mouser"],
  ["tide", "gold", 9, "Captain Catfish", "Big Catch", "The tale gets bigger each time.", "legendary", "captain-catfish"],
  ["tide", "red", 3, "Drizzle Socks", "Cloud Hop", "Rainy with a chance of zoomies.", "common", "drizzle-socks"],
].map(([element, color, power, name, move, lore, rarity, art], index) => ({
  id: `card-${index}`,
  element,
  color,
  power,
  name,
  move,
  lore,
  rarity,
  art,
}));

const COLOR_MAP = {
  red: "#f06449",
  orange: "#ed9347",
  gold: "#e9b93f",
  green: "#54ad71",
  teal: "#43a8a0",
  blue: "#4387d9",
  violet: "#8a68bc",
};

const HAND_SIZE = 6;
const MAX_PLAY_SIZE = 3;
const state = {
  deck: [],
  playerHand: [],
  aiHand: [],
  playerWins: [],
  aiWins: [],
  selectedCardIds: [],
  round: 1,
  locked: false,
  soundOn: true,
};

const ui = {
  playerHand: document.querySelector("#playerHand"),
  playerPlayZone: document.querySelector("#playerPlayZone"),
  aiPlayZone: document.querySelector("#aiPlayZone"),
  battlefield: document.querySelector(".battlefield"),
  clashEffects: document.querySelector("#clashEffects"),
  playerCollection: document.querySelector("#playerCollection"),
  aiCollection: document.querySelector("#aiCollection"),
  turnMessage: document.querySelector("#turnMessage"),
  selectionCount: document.querySelector("#selectionCount"),
  playSelectedButton: document.querySelector("#playSelectedButton"),
  roundLabel: document.querySelector("#roundLabel"),
  roundPips: document.querySelector("#roundPips"),
  deckCount: document.querySelector("#deckCount"),
  deckStatusText: document.querySelector("#deckStatusText"),
  versusBadge: document.querySelector("#versusBadge"),
  howDialog: document.querySelector("#howDialog"),
  galleryDialog: document.querySelector("#galleryDialog"),
  galleryButton: document.querySelector("#galleryButton"),
  cardGallery: document.querySelector("#cardGallery"),
  resultDialog: document.querySelector("#resultDialog"),
  soundButton: document.querySelector("#soundButton"),
};

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function freshDeck() {
  return shuffle(
    [...CARD_LIBRARY, ...CARD_LIBRARY].map((card, index) => ({
      ...card,
      instanceId: `${card.id}-${index}-${Date.now()}`,
    })),
  );
}

function drawToHand(hand) {
  while (hand.length < HAND_SIZE && state.deck.length) {
    hand.push(state.deck.pop());
  }
}

function cardMarkup(card, interactive = false, selectedIndex = -1) {
  const element = ELEMENTS[card.element];
  const isSelected = selectedIndex >= 0;
  return `
    <button
      class="game-card element-${card.element} rarity-${card.rarity} art-${card.art}${isSelected ? " selected" : ""}"
      ${interactive ? `data-card-id="${card.instanceId}" aria-label="${isSelected ? "Deselect" : "Select"} ${card.name}, ${element.label}, power ${card.power}" aria-pressed="${isSelected}"` : "disabled"}
      style="--card-accent:${COLOR_MAP[card.color]}"
      type="button"
    >
      ${isSelected ? `<span class="selection-order" aria-hidden="true">${selectedIndex + 1}</span>` : ""}
      <span class="card-art">
        <img src="./assets/cards/${card.art}.webp" alt="" draggable="false" />
        <span class="art-vignette" aria-hidden="true"></span>
        <span class="card-element" aria-hidden="true">${element.icon}</span>
        <span class="card-rarity">${card.rarity}</span>
        <span class="card-power"><small>POWER</small><b>${card.power}</b></span>
      </span>
      <span class="card-info">
        <strong>${card.name}</strong>
        <small>${element.label} · ${card.color} guild</small>
      </span>
      <span class="card-ability">
        <i aria-hidden="true">✦</i>
        <span><b>${card.move}</b><small>${card.lore}</small></span>
      </span>
    </button>
  `;
}

function placeholder(label) {
  return `<div class="card-placeholder"><span class="paw">◆</span><small>${label}</small></div>`;
}

function renderHand() {
  ui.playerHand.innerHTML = state.playerHand
    .map((card) => cardMarkup(card, !state.locked, state.selectedCardIds.indexOf(card.instanceId)))
    .join("");

  ui.playerHand.querySelectorAll("[data-card-id]").forEach((button) => {
    button.addEventListener("click", () => toggleCardSelection(button.dataset.cardId));
  });
  updateSelectionControls();
}

function updateSelectionControls() {
  const count = state.selectedCardIds.length;
  ui.selectionCount.textContent = `${count} of ${MAX_PLAY_SIZE} selected`;
  ui.playSelectedButton.disabled = state.locked || count === 0;
  ui.playSelectedButton.textContent = count === 1 ? "Commit 1 Card" : `Commit ${count} Cards`;
}

function toggleCardSelection(instanceId) {
  if (state.locked) return;
  const selectedIndex = state.selectedCardIds.indexOf(instanceId);
  let changed = false;

  if (selectedIndex >= 0) {
    state.selectedCardIds.splice(selectedIndex, 1);
    changed = true;
    audio.cardFlip(false, selectedIndex + 1);
  } else if (state.selectedCardIds.length < MAX_PLAY_SIZE) {
    state.selectedCardIds.push(instanceId);
    changed = true;
    audio.cardFlip(true, state.selectedCardIds.length);
  } else {
    setMessage("Three-card limit reached.", "Deselect a card before choosing another.");
    audio.denied();
  }

  if (changed) {
    const count = state.selectedCardIds.length;
    const title = count === 0
      ? "Build your formation."
      : `${count} ${count === 1 ? "card" : "cards"} in formation.`;
    const detail = count === MAX_PLAY_SIZE
      ? "Formation full. Commit when ready."
      : "Cards clash from left to right in the numbered order.";
    setMessage(title, detail);
  }

  renderHand();
}

function playedCardsMarkup(cards, side) {
  return `
    <div class="played-cards ${side}-formation">
      ${cards.map((card, index) => `
        <div class="clash-card" data-clash-index="${index}">
          ${cardMarkup(card, false, index)}
          <span class="lane-result" aria-hidden="true"></span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderGallery() {
  ui.cardGallery.innerHTML = CARD_LIBRARY
    .map((card) => cardMarkup(card))
    .join("");
}

function renderCollection(target, cards) {
  target.innerHTML = cards
    .map((card) => {
      const element = ELEMENTS[card.element];
      return `<span class="won-token" title="${card.name}: ${element.label}, ${card.color}" style="background:${COLOR_MAP[card.color]}">${element.icon}</span>`;
    })
    .join("");
}

function renderRound() {
  ui.roundLabel.textContent = `ROUND ${state.round}`;
  if (state.deck.length === 0 && state.playerHand.length > 0) {
    const cardWord = state.playerHand.length === 1 ? "card" : "cards";
    ui.deckStatusText.innerHTML = `<strong>Final hand:</strong> ${state.playerHand.length} ${cardWord} left to play`;
  } else if (state.deck.length === 0) {
    ui.deckStatusText.innerHTML = "<strong>No cards remain</strong>";
  } else {
    ui.deckStatusText.innerHTML = `<strong id="deckCount">${state.deck.length}</strong> cards left in the draw pile`;
    ui.deckCount = document.querySelector("#deckCount");
  }
  const pipCount = Math.min(7, Math.max(5, state.round));
  ui.roundPips.innerHTML = Array.from(
    { length: pipCount },
    (_, index) => `<i class="${index === Math.min(state.round - 1, pipCount - 1) ? "active" : ""}"></i>`,
  ).join("");
}

function setMessage(title, detail) {
  ui.turnMessage.innerHTML = `<strong>${title}</strong><span>${detail}</span>`;
}

function removeCard(hand, instanceId) {
  const index = hand.findIndex((card) => card.instanceId === instanceId);
  return index >= 0 ? hand.splice(index, 1)[0] : null;
}

function delay(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function animateClashes(playerCards, aiCards) {
  const resolution = resolveClashes(playerCards, aiCards);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const strikeDuration = reducedMotion ? 80 : 540;
  const collisionDelay = reducedMotion ? 20 : 225;
  const pauseDuration = reducedMotion ? 30 : 180;
  const playerLanes = [...ui.playerPlayZone.querySelectorAll(".clash-card")];
  const aiLanes = [...ui.aiPlayZone.querySelectorAll(".clash-card")];

  await delay(reducedMotion ? 30 : 220);

  for (let index = 0; index < resolution.results.length; index += 1) {
    const winner = resolution.results[index];
    const playerLane = playerLanes[index];
    const aiLane = aiLanes[index];
    if (!playerLane || !aiLane) continue;

    setMessage(
      `Clash ${index + 1} of ${resolution.results.length}!`,
      `${playerCards[index].name} faces ${aiCards[index].name}.`,
    );

    playerLane.classList.add("clashing");
    aiLane.classList.add("clashing");
    audio.clashApproach(playerCards[index].element, aiCards[index].element);

    await delay(collisionDelay);

    const winningCard = winner === "player"
      ? playerCards[index]
      : winner === "ai"
        ? aiCards[index]
        : playerCards[index];
    const impact = document.createElement("span");
    const playerRect = playerLane.getBoundingClientRect();
    const aiRect = aiLane.getBoundingClientRect();
    const battlefieldRect = ui.battlefield.getBoundingClientRect();
    const impactX = (
      (playerRect.left + playerRect.width / 2)
      + (aiRect.left + aiRect.width / 2)
    ) / 2 - battlefieldRect.left;

    impact.className = `clash-impact element-${winningCard.element}${winner === "draw" ? " draw-impact" : ""}`;
    impact.style.left = `${impactX}px`;
    impact.innerHTML = `<i>${winner === "draw" ? "✦" : ELEMENTS[winningCard.element].icon}</i>`;
    ui.clashEffects.append(impact);

    ui.battlefield.classList.remove("is-clashing");
    void ui.battlefield.offsetWidth;
    ui.battlefield.classList.add("is-clashing");
    audio.clashImpact(playerCards[index].element, aiCards[index].element, winner);

    await delay(strikeDuration - collisionDelay);

    playerLane.classList.remove("clashing");
    aiLane.classList.remove("clashing");
    playerLane.classList.add(winner === "player" ? "result-win" : winner === "ai" ? "result-loss" : "result-draw");
    aiLane.classList.add(winner === "ai" ? "result-win" : winner === "player" ? "result-loss" : "result-draw");
    playerLane.querySelector(".lane-result").textContent = winner === "player" ? "WIN" : winner === "ai" ? "LOSS" : "DRAW";
    aiLane.querySelector(".lane-result").textContent = winner === "ai" ? "WIN" : winner === "player" ? "LOSS" : "DRAW";
    impact.classList.add("impact-fade");
    ui.battlefield.classList.remove("is-clashing");

    await delay(pauseDuration);
  }

  return resolution;
}

function playRound() {
  if (state.locked || state.selectedCardIds.length === 0) return;

  const playerCards = state.selectedCardIds
    .map((instanceId) => removeCard(state.playerHand, instanceId))
    .filter(Boolean);
  if (!playerCards.length) return;

  state.locked = true;
  state.selectedCardIds = [];
  renderHand();
  ui.playerPlayZone.innerHTML = playedCardsMarkup(playerCards, "player");
  ui.aiPlayZone.innerHTML = placeholder(`Choosing ${playerCards.length} ${playerCards.length === 1 ? "card" : "cards"}...`);
  setMessage("Professor Paws is arranging a counterplay...", "Cards will clash from left to right.");
  audio.commit(playerCards.length);

  window.setTimeout(async () => {
    const chosenAiCards = chooseAiCards(
      state.aiHand,
      playerCards.length,
      state.playerWins,
      state.aiWins,
    );
    const aiCards = chosenAiCards
      .map((card) => removeCard(state.aiHand, card.instanceId))
      .filter(Boolean);
    ui.aiPlayZone.innerHTML = playedCardsMarkup(aiCards, "ai");
    setMessage("Formations revealed!", "Brace for the first clash.");
    audio.reveal(aiCards.length);
    const resolution = await animateClashes(playerCards, aiCards);
    resolveRound(playerCards, aiCards, resolution);
  }, 700);
}

function resolveRound(playerCards, aiCards, resolution = resolveClashes(playerCards, aiCards)) {
  const { results, score } = resolution;
  ui.versusBadge.className = "versus-badge";

  playerCards.forEach((playerCard, index) => {
    const aiCard = aiCards[index];
    if (!aiCard) return;
    const winner = results[index];

    if (winner === "player") state.playerWins.push(playerCard);
    if (winner === "ai") state.aiWins.push(aiCard);
  });

  const clashWord = playerCards.length === 1 ? "clash" : "clashes";
  ui.versusBadge.textContent = `${score.player}–${score.ai}`;

  if (score.player > score.ai) {
    setMessage(`You win ${score.player} of ${playerCards.length} ${clashWord}!`, "Your formation earns the stronger round.");
    ui.versusBadge.classList.add("win");
    audio.roundResult("win");
  } else if (score.ai > score.player) {
    setMessage(`Professor Paws wins ${score.ai} of ${playerCards.length} ${clashWord}.`, "Reorder your next formation and counter the professor.");
    ui.versusBadge.classList.add("lose");
    audio.roundResult("loss");
  } else {
    const drawDetail = score.draw
      ? `${score.draw} ${score.draw === 1 ? "lane ends" : "lanes end"} in a draw.`
      : "The formation is evenly matched.";
    setMessage("The round is evenly split!", drawDetail);
    audio.roundResult("draw");
  }

  renderCollection(ui.playerCollection, state.playerWins);
  renderCollection(ui.aiCollection, state.aiWins);
  renderRound();

  window.setTimeout(() => {
    const playerCompletedSet = hasWinningSet(state.playerWins);
    const aiCompletedSet = hasWinningSet(state.aiWins);

    if (playerCompletedSet && aiCompletedSet) {
      if (score.player > score.ai) return endGame("player");
      if (score.ai > score.player) return endGame("ai");
      if (state.playerWins.length > state.aiWins.length) return endGame("player");
      if (state.aiWins.length > state.playerWins.length) return endGame("ai");
    } else if (playerCompletedSet) {
      return endGame("player");
    } else if (aiCompletedSet) {
      return endGame("ai");
    }

    nextRound();
  }, 1650);
}

function nextRound() {
  drawToHand(state.playerHand);
  drawToHand(state.aiHand);

  if (!state.playerHand.length || !state.aiHand.length) {
    const winner = state.playerWins.length >= state.aiWins.length ? "player" : "ai";
    endGame(winner);
    return;
  }

  state.round += 1;
  state.locked = false;
  state.selectedCardIds = [];
  ui.clashEffects.innerHTML = "";
  ui.battlefield.classList.remove("is-clashing");
  ui.playerPlayZone.innerHTML = placeholder("Choose up to 3 cards");
  ui.aiPlayZone.innerHTML = placeholder("Waiting...");
  ui.versusBadge.textContent = "VS";
  ui.versusBadge.className = "versus-badge";
  setMessage("Build your formation.", "Select one to three cards in the order you want them to clash.");
  renderHand();
  renderRound();
}

function endGame(winner) {
  state.locked = true;
  const won = winner === "player";
  audio.matchResult(won);
  document.querySelector("#resultEyebrow").textContent = won ? "MATCH COMPLETE" : "A NOBLE DUEL";
  document.querySelector("#resultTitle").textContent = won
    ? "A purr-fect victory!"
    : "Professor Paws prevails!";
  document.querySelector("#resultText").textContent = won
    ? "You mastered the meadow's three elements."
    : "The professor's whiskers were one step ahead. Fancy a rematch?";
  document.querySelector("#resultRounds").textContent = state.round;
  document.querySelector("#resultCards").textContent = state.playerWins.length;
  window.setTimeout(() => ui.resultDialog.showModal(), 250);
}

function startGame() {
  state.deck = freshDeck();
  state.playerHand = [];
  state.aiHand = [];
  state.playerWins = [];
  state.aiWins = [];
  state.selectedCardIds = [];
  state.round = 1;
  state.locked = false;
  ui.clashEffects.innerHTML = "";
  ui.battlefield.classList.remove("is-clashing");
  drawToHand(state.playerHand);
  drawToHand(state.aiHand);
  ui.playerPlayZone.innerHTML = placeholder("Choose up to 3 cards");
  ui.aiPlayZone.innerHTML = placeholder("Waiting...");
  ui.versusBadge.textContent = "VS";
  ui.versusBadge.className = "versus-badge";
  setMessage("Build your formation.", "Select one to three cards in the order you want them to clash.");
  renderCollection(ui.playerCollection, []);
  renderCollection(ui.aiCollection, []);
  renderHand();
  renderRound();
}

document.querySelector("#howButton").addEventListener("click", () => ui.howDialog.showModal());
document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => ui.howDialog.close());
});
ui.galleryButton.addEventListener("click", () => {
  if (ui.galleryDialog.open) {
    ui.galleryDialog.close();
    ui.galleryButton.setAttribute("aria-expanded", "false");
  } else {
    ui.galleryDialog.showModal();
    ui.galleryButton.setAttribute("aria-expanded", "true");
  }
});
document.querySelector("[data-close-gallery]").addEventListener("click", () => {
  ui.galleryDialog.close();
});
ui.galleryDialog.addEventListener("close", () => {
  ui.galleryButton.setAttribute("aria-expanded", "false");
});
ui.playSelectedButton.addEventListener("click", playRound);
document.querySelector("#playAgainButton").addEventListener("click", () => {
  ui.resultDialog.close();
  startGame();
});
ui.soundButton.addEventListener("click", () => {
  state.soundOn = !state.soundOn;
  audio.setEnabled(state.soundOn);
  ui.soundButton.innerHTML = `<span aria-hidden="true">${state.soundOn ? "♪" : "×"}</span>`;
  ui.soundButton.setAttribute("aria-label", state.soundOn ? "Mute sound" : "Unmute sound");
});

renderGallery();
startGame();
