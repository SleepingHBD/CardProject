const {
  ELEMENTS,
  buildTellClues,
  chooseAiCommitment,
  chooseAiCards,
  getChainBonus,
  getFocusBonus,
  getFormationReward,
  getPowerTier,
  hasWinningSet,
  resolveClashes,
  scoreClash,
} = globalThis.ClawRules;
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
const DIFFICULTIES = {
  guided: { label: "Guided" },
  veiled: { label: "Veiled" },
  blind: { label: "Blind" },
};
const state = {
  deck: [],
  playerHand: [],
  aiHand: [],
  playerWins: [],
  aiWins: [],
  aiPlan: [],
  aiTellClues: [],
  selectedCardIds: [],
  difficulty: null,
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
  commitmentHint: document.querySelector("#commitmentHint"),
  opponentTells: document.querySelector("#opponentTells"),
  matchupForecast: document.querySelector("#matchupForecast"),
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
  difficultyDialog: document.querySelector("#difficultyDialog"),
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

function prepareAiPlan() {
  const commitment = chooseAiCommitment(
    state.aiHand.length,
    state.playerWins,
    state.aiWins,
  );
  state.aiPlan = chooseAiCards(
    state.aiHand,
    commitment,
    state.playerWins,
    state.aiWins,
  );
  state.aiTellClues = buildTellClues(
    state.aiPlan.length,
    state.difficulty,
  );
  renderOpponentTells();
}

function renderOpponentTells() {
  const focus = getFocusBonus(state.aiPlan.length);
  const difficultyLabel = DIFFICULTIES[state.difficulty]?.label || "Veiled";
  ui.commitmentHint.textContent = `${difficultyLabel} · ${state.aiPlan.length} ${state.aiPlan.length === 1 ? "card" : "cards"} · ${focus ? `Focus +${focus}` : "No Focus"}`;
  const laneLabels = ["1", "2", "3"];
  ui.opponentTells.innerHTML = laneLabels.map((lane, index) => {
    const card = state.aiPlan[index];
    if (!card) {
      return `
        <div class="opponent-tell empty-tell">
          <span class="tell-lane">LANE ${lane}</span>
          <b>No card</b>
          <small>Empty</small>
        </div>
      `;
    }

    const element = ELEMENTS[card.element];
    const tier = getPowerTier(card.power);
    const clue = state.aiTellClues[index] || "sealed";
    const showsElement = clue === "full" || clue === "element";
    const showsPower = clue === "full" || clue === "power";
    const title = showsElement
      ? element.label
      : clue === "sealed"
        ? "Sealed card"
        : "Element hidden";
    const detail = showsPower
      ? `Power <em>${tier.range}</em>`
      : clue === "sealed"
        ? "No card clues"
        : "Power hidden";
    const accessibleClue = clue === "full"
      ? `${element.label}, power ${tier.range}`
      : clue === "element"
        ? `${element.label}, power hidden`
        : clue === "power"
          ? `element hidden, power ${tier.range}`
          : "card details sealed";
    return `
      <div class="opponent-tell clue-${clue}${showsElement ? ` element-${card.element}` : ""}" aria-label="Lane ${lane}: ${accessibleClue}">
        <span class="tell-lane">LANE ${lane}</span>
        <span class="tell-element" aria-hidden="true">${showsElement ? element.icon : "?"}</span>
        <b>${title}</b>
        <small>${detail}</small>
      </div>
    `;
  }).join("");
}

function renderMatchupForecast() {
  if (state.locked) {
    ui.matchupForecast.innerHTML = `
      <span class="forecast-instruction forecast-locked">
        Cards committed. Watch each lane.
      </span>
    `;
    return;
  }

  const selectedCards = state.selectedCardIds
    .map((instanceId) => state.playerHand.find((card) => card.instanceId === instanceId))
    .filter(Boolean);

  if (!selectedCards.length) {
    ui.matchupForecast.innerHTML = `
      <span class="forecast-instruction">
        Pick a card to preview its matchup.
      </span>
    `;
    return;
  }

  const labels = {
    favored: { icon: "+", title: "FAVORED", className: "advantage" },
    close: { icon: "≈", title: "CLOSE", className: "power" },
    risky: { icon: "!", title: "RISKY", className: "danger" },
  };
  const playerFocus = getFocusBonus(selectedCards.length);
  const opponentFocus = getFocusBonus(state.aiPlan.length);

  ui.matchupForecast.innerHTML = selectedCards.map((playerCard, index) => {
    const opponentCard = state.aiPlan[index];
    if (!opponentCard) {
      return `
        <span class="forecast-chip forecast-pressure">
          <i>${index + 1}</i>
          <b>◆ PRESSURE CARD</b>
          <small>Spent to win tied formations</small>
        </span>
      `;
    }
    const playerChain = getChainBonus(selectedCards, index);
    const opponentChain = getChainBonus(state.aiPlan, index);
    const clue = state.aiTellClues[index] || "sealed";
    const scoring = scoreClash(
      playerCard,
      opponentCard,
      playerChain,
      opponentChain,
      playerFocus,
      opponentFocus,
    );
    const knownPlayerScore = playerCard.power + playerFocus + playerChain;
    const knownBonuses = [];
    if (playerFocus) knownBonuses.push(`Focus +${playerFocus}`);
    if (playerChain) knownBonuses.push(`Chain +${playerChain}`);

    if (clue === "sealed") {
      return `
        <span class="forecast-chip forecast-sealed">
          <i>${index + 1}</i>
          <b>? SEALED MATCHUP</b>
          <small>You ${knownPlayerScore} before Element Edge</small>
        </span>
      `;
    }

    if (clue === "power") {
      const powerRange = getPowerTier(opponentCard.power).range;
      return `
        <span class="forecast-chip forecast-clue">
          <i>${index + 1}</i>
          <b>◆ POWER ${powerRange} · ELEMENT ?</b>
          <small>You ${knownPlayerScore} before Element Edge</small>
        </span>
      `;
    }

    if (clue === "element") {
      const elementRead = scoring.player.edge
        ? { icon: "+", title: "YOUR EDGE +2", className: "advantage" }
        : scoring.ai.edge
          ? { icon: "!", title: "FOE EDGE +2", className: "danger" }
          : { icon: "=", title: "SAME ELEMENT", className: "power" };
      if (scoring.player.edge) knownBonuses.push(`Edge +${scoring.player.edge}`);
      const bonusDetail = knownBonuses.length
        ? knownBonuses.join(" · ")
        : "No known bonus";
      return `
        <span class="forecast-chip forecast-${elementRead.className}">
          <i>${index + 1}</i>
          <b>${elementRead.icon} ${elementRead.title} · YOU ${scoring.player.total}</b>
          <small>${bonusDetail} · Foe power hidden</small>
        </span>
      `;
    }

    const [tierMin, tierMax] = getPowerTier(opponentCard.power).range
      .split("-")
      .map(Number);
    const opponentMin = tierMin
      + scoring.ai.edge
      + scoring.ai.chain
      + scoring.ai.focus;
    const opponentMax = tierMax
      + scoring.ai.edge
      + scoring.ai.chain
      + scoring.ai.focus;
    const outlook = scoring.player.total > opponentMax
      ? "favored"
      : scoring.player.total < opponentMin
        ? "risky"
        : "close";
    const copy = labels[outlook];
    const bonuses = [];
    if (scoring.player.focus) bonuses.push(`Focus +${scoring.player.focus}`);
    if (scoring.player.edge) bonuses.push(`Edge +${scoring.player.edge}`);
    if (scoring.player.chain) bonuses.push(`Chain +${scoring.player.chain}`);
    if (scoring.ai.edge) bonuses.push(`Foe edge +${scoring.ai.edge}`);
    if (!bonuses.length && scoring.ai.chain) {
      bonuses.push(`Foe chain +${scoring.ai.chain}`);
    }
    if (!bonuses.length && scoring.ai.focus) {
      bonuses.push(`Foe focus +${scoring.ai.focus}`);
    }
    const detail = bonuses.length ? bonuses.join(" · ") : "No bonuses";

    return `
      <span class="forecast-chip forecast-${copy.className}">
        <i>${index + 1}</i>
        <b>${copy.icon} ${copy.title} · ${scoring.player.total} vs ${opponentMin}-${opponentMax}</b>
        <small>${detail}</small>
      </span>
    `;
  }).join("");
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
      <span class="card-rarity">${card.rarity}</span>
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
  const focus = getFocusBonus(count);
  const focusLabel = focus ? `Focus +${focus}` : "No Focus";
  ui.selectionCount.textContent = count
    ? `${count} of ${MAX_PLAY_SIZE} · ${focusLabel}`
    : `0 of ${MAX_PLAY_SIZE} selected`;
  ui.playSelectedButton.disabled = state.locked || count === 0;
  ui.playSelectedButton.textContent = count === 1 ? "Commit 1 Card" : `Commit ${count} Cards`;
  renderMatchupForecast();
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
    const focus = getFocusBonus(count);
    const focusLabel = focus ? `Focus +${focus}` : "No Focus";
    const detail = count === 0
      ? "Fewer cards gain Focus; more cards win formation ties."
      : count > state.aiPlan.length
        ? `Pressure advantage: tied formations go to you. ${focusLabel}.`
        : count < state.aiPlan.length
          ? `${focusLabel}, but Professor Paws wins tied formations.`
          : `Equal commitment with ${focusLabel.toLowerCase()}; a tied formation stays a draw.`;
    setMessage(title, detail);
  }

  renderHand();
}

function playedCardsMarkup(cards, side, clashCount = cards.length) {
  return `
    <div class="played-cards ${side}-formation">
      ${cards.map((card, index) => `
        <div class="clash-card${index >= clashCount ? " result-pressure" : ""}" data-clash-index="${index}">
          ${cardMarkup(card, false, index)}
          <span class="lane-result" aria-hidden="true">${index >= clashCount ? "PRESSURE" : ""}</span>
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
    const laneScore = resolution.lanes[index];
    const playerLane = playerLanes[index];
    const aiLane = aiLanes[index];
    if (!playerLane || !aiLane) continue;

    setMessage(
      `Clash ${index + 1} of ${resolution.results.length}!`,
      `${playerCards[index].name} scores ${laneScore.player.total} against ${laneScore.ai.total}.`,
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
    playerLane.querySelector(".lane-result").textContent = `${winner === "player" ? "WIN" : winner === "ai" ? "LOSS" : "DRAW"} ${laneScore.player.total}–${laneScore.ai.total}`;
    aiLane.querySelector(".lane-result").textContent = `${winner === "ai" ? "WIN" : winner === "player" ? "LOSS" : "DRAW"} ${laneScore.ai.total}–${laneScore.player.total}`;
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
  const clashCount = Math.min(playerCards.length, state.aiPlan.length);
  ui.playerPlayZone.innerHTML = playedCardsMarkup(
    playerCards,
    "player",
    clashCount,
  );
  ui.aiPlayZone.innerHTML = placeholder(`Revealing Professor Paws' ${state.aiPlan.length}-card plan...`);
  setMessage("The sealed formation opens...", "Professor Paws committed this plan before your choice.");
  audio.commit(playerCards.length);

  window.setTimeout(async () => {
    const aiCards = state.aiPlan
      .map((card) => removeCard(state.aiHand, card.instanceId))
      .filter(Boolean);
    ui.aiPlayZone.innerHTML = playedCardsMarkup(aiCards, "ai", clashCount);
    setMessage(
      `${playerCards.length} cards against ${aiCards.length}!`,
      `${clashCount} ${clashCount === 1 ? "lane will clash" : "lanes will clash"}; extra cards create Pressure.`,
    );
    audio.reveal(aiCards.length);
    const resolution = await animateClashes(playerCards, aiCards);
    resolveRound(playerCards, aiCards, resolution);
  }, 700);
}

function resolveRound(playerCards, aiCards, resolution = resolveClashes(playerCards, aiCards)) {
  const { results, score, winner, decidedBy } = resolution;
  const reward = getFormationReward(playerCards, aiCards, resolution);
  ui.versusBadge.className = "versus-badge";

  if (reward.winner === "player" && reward.card) state.playerWins.push(reward.card);
  if (reward.winner === "ai" && reward.card) state.aiWins.push(reward.card);

  const clashWord = results.length === 1 ? "clash" : "clashes";
  ui.versusBadge.textContent = `${score.player}–${score.ai}`;

  if (winner === "player") {
    if (decidedBy === "pressure") {
      setMessage(
        `Your Pressure breaks the ${score.player}–${score.ai} tie!`,
        `${reward.card.name}, your first extra card, becomes the round trophy.`,
      );
    } else {
      setMessage(
        `You win ${score.player} of ${results.length} ${clashWord}!`,
        `Lane ${reward.lane + 1}'s ${reward.card.name} becomes your round trophy.`,
      );
    }
    ui.versusBadge.classList.add("win");
    audio.roundResult("win");
  } else if (winner === "ai") {
    if (decidedBy === "pressure") {
      setMessage(
        `Professor Paws' Pressure breaks the ${score.ai}–${score.player} tie.`,
        `${reward.card.name}, the first extra card, becomes the professor's trophy.`,
      );
    } else {
      setMessage(
        `Professor Paws wins ${score.ai} of ${results.length} ${clashWord}.`,
        `The professor claims ${reward.card.name} from lane ${reward.lane + 1}.`,
      );
    }
    ui.versusBadge.classList.add("lose");
    audio.roundResult("loss");
  } else {
    const drawDetail = score.draw
      ? `${score.draw} ${score.draw === 1 ? "lane ends" : "lanes end"} in a draw. No trophy is claimed.`
      : "The formation is evenly matched, so no trophy is claimed.";
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
      if (winner === "player") return endGame("player");
      if (winner === "ai") return endGame("ai");
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
  prepareAiPlan();
  ui.clashEffects.innerHTML = "";
  ui.battlefield.classList.remove("is-clashing");
  ui.playerPlayZone.innerHTML = placeholder("Choose up to 3 cards");
  ui.aiPlayZone.innerHTML = placeholder("Formation sealed");
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

function showDifficultyChooser() {
  state.locked = true;
  if (!ui.difficultyDialog.open) ui.difficultyDialog.showModal();
}

function startGame() {
  state.deck = freshDeck();
  state.playerHand = [];
  state.aiHand = [];
  state.playerWins = [];
  state.aiWins = [];
  state.aiPlan = [];
  state.aiTellClues = [];
  state.selectedCardIds = [];
  state.round = 1;
  state.locked = false;
  ui.clashEffects.innerHTML = "";
  ui.battlefield.classList.remove("is-clashing");
  drawToHand(state.playerHand);
  drawToHand(state.aiHand);
  prepareAiPlan();
  ui.playerPlayZone.innerHTML = placeholder("Choose up to 3 cards");
  ui.aiPlayZone.innerHTML = placeholder("Formation sealed");
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
  showDifficultyChooser();
});
document.querySelectorAll("[data-difficulty]").forEach((button) => {
  button.addEventListener("click", () => {
    const difficulty = button.dataset.difficulty;
    if (!DIFFICULTIES[difficulty]) return;
    state.difficulty = difficulty;
    ui.difficultyDialog.close();
    startGame();
  });
});
ui.difficultyDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
});
ui.soundButton.addEventListener("click", () => {
  state.soundOn = !state.soundOn;
  audio.setEnabled(state.soundOn);
  ui.soundButton.innerHTML = `<span aria-hidden="true">${state.soundOn ? "♪" : "×"}</span>`;
  ui.soundButton.setAttribute("aria-label", state.soundOn ? "Mute sound" : "Unmute sound");
});

renderGallery();
showDifficultyChooser();
