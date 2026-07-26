const { ELEMENTS, chooseAiCard, compareCards, hasWinningSet } = globalThis.ClawRules;

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

const HAND_SIZE = 5;
const state = {
  deck: [],
  playerHand: [],
  aiHand: [],
  playerWins: [],
  aiWins: [],
  round: 1,
  locked: false,
  soundOn: true,
};

const ui = {
  playerHand: document.querySelector("#playerHand"),
  playerPlayZone: document.querySelector("#playerPlayZone"),
  aiPlayZone: document.querySelector("#aiPlayZone"),
  playerCollection: document.querySelector("#playerCollection"),
  aiCollection: document.querySelector("#aiCollection"),
  turnMessage: document.querySelector("#turnMessage"),
  roundLabel: document.querySelector("#roundLabel"),
  roundPips: document.querySelector("#roundPips"),
  deckCount: document.querySelector("#deckCount"),
  deckStatusText: document.querySelector("#deckStatusText"),
  versusBadge: document.querySelector("#versusBadge"),
  howDialog: document.querySelector("#howDialog"),
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

function cardMarkup(card, interactive = false) {
  const element = ELEMENTS[card.element];
  return `
    <button
      class="game-card element-${card.element} rarity-${card.rarity}"
      ${interactive ? `data-card-id="${card.instanceId}" aria-label="Play ${card.name}, ${element.label}, power ${card.power}"` : "disabled"}
      style="--card-accent:${COLOR_MAP[card.color]}"
      type="button"
    >
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
    .map((card) => cardMarkup(card, !state.locked))
    .join("");

  ui.playerHand.querySelectorAll("[data-card-id]").forEach((button) => {
    button.addEventListener("click", () => playRound(button.dataset.cardId));
  });
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

function tone(frequency, duration = 0.08) {
  if (!state.soundOn) return;
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gain.gain.setValueAtTime(0.06, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  } catch {
    // Sound is optional; browsers may decline audio contexts.
  }
}

function removeCard(hand, instanceId) {
  const index = hand.findIndex((card) => card.instanceId === instanceId);
  return index >= 0 ? hand.splice(index, 1)[0] : null;
}

function playRound(instanceId) {
  if (state.locked) return;
  const playerCard = removeCard(state.playerHand, instanceId);
  if (!playerCard) return;

  state.locked = true;
  renderHand();
  ui.playerPlayZone.innerHTML = cardMarkup(playerCard);
  ui.aiPlayZone.innerHTML = placeholder("Professor is thinking...");
  setMessage("Professor Paws is pondering...", "A tactical tail twitch is underway.");
  tone(440);

  window.setTimeout(() => {
    const chosenAiCard = chooseAiCard(
      state.aiHand,
      state.playerWins,
      state.aiWins,
    );
    const aiCard = removeCard(state.aiHand, chosenAiCard.instanceId);
    ui.aiPlayZone.innerHTML = cardMarkup(aiCard);
    resolveRound(playerCard, aiCard);
  }, 650);
}

function resolveRound(playerCard, aiCard) {
  const winner = compareCards(playerCard, aiCard);
  ui.versusBadge.className = "versus-badge";

  if (winner === "player") {
    state.playerWins.push(playerCard);
    setMessage("You take the trick!", `${ELEMENTS[playerCard.element].label} carries the round.`);
    ui.versusBadge.textContent = "WIN";
    ui.versusBadge.classList.add("win");
    tone(660, 0.14);
  } else if (winner === "ai") {
    state.aiWins.push(aiCard);
    setMessage("Professor Paws wins this one.", "Shake it off — every great cat lands on their feet.");
    ui.versusBadge.textContent = "PAW";
    ui.versusBadge.classList.add("lose");
    tone(240, 0.16);
  } else {
    setMessage("A whisker-close draw!", "Same element, same power. No card is claimed.");
    ui.versusBadge.textContent = "TIE";
    tone(380, 0.12);
  }

  renderCollection(ui.playerCollection, state.playerWins);
  renderCollection(ui.aiCollection, state.aiWins);
  renderRound();

  window.setTimeout(() => {
    if (hasWinningSet(state.playerWins)) return endGame("player");
    if (hasWinningSet(state.aiWins)) return endGame("ai");
    nextRound();
  }, 1350);
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
  ui.playerPlayZone.innerHTML = placeholder("Choose a card");
  ui.aiPlayZone.innerHTML = placeholder("Waiting...");
  ui.versusBadge.textContent = "VS";
  ui.versusBadge.className = "versus-badge";
  setMessage("Your turn!", "Pick a card to outsmart Professor Paws.");
  renderHand();
  renderRound();
}

function endGame(winner) {
  state.locked = true;
  const won = winner === "player";
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
  state.round = 1;
  state.locked = false;
  drawToHand(state.playerHand);
  drawToHand(state.aiHand);
  ui.playerPlayZone.innerHTML = placeholder("Choose a card");
  ui.aiPlayZone.innerHTML = placeholder("Waiting...");
  ui.versusBadge.textContent = "VS";
  ui.versusBadge.className = "versus-badge";
  setMessage("Your turn!", "Pick a card to outsmart Professor Paws.");
  renderCollection(ui.playerCollection, []);
  renderCollection(ui.aiCollection, []);
  renderHand();
  renderRound();
}

document.querySelector("#howButton").addEventListener("click", () => ui.howDialog.showModal());
document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => ui.howDialog.close());
});
document.querySelector("#playAgainButton").addEventListener("click", () => {
  ui.resultDialog.close();
  startGame();
});
ui.soundButton.addEventListener("click", () => {
  state.soundOn = !state.soundOn;
  ui.soundButton.innerHTML = `<span aria-hidden="true">${state.soundOn ? "♪" : "×"}</span>`;
  ui.soundButton.setAttribute("aria-label", state.soundOn ? "Mute sound" : "Unmute sound");
});

startGame();
