const {
  ELEMENTS,
  buildTellClues,
  chooseAiCommitment,
  chooseAiCards,
  getChainBonus,
  getFocusBonus,
  getFormationReward,
  getPowerTier,
  getElementTrophyCounts,
  getTrophyProgress,
  hasCompletedElementSet,
  reshuffleDiscardPile,
  resolveClashes,
  scoreClash,
  TROPHIES_PER_ELEMENT,
} = globalThis.ClawRules;
const audio = globalThis.ClawAudio;

const CARD_LIBRARY = [
  ["ember", 8, "Sizzle Mittens", "Flame Yarn", "Never leaves a loose end.", "epic", "sizzle-mittens"],
  ["ember", 6, "Candle Pounce", "Wax & Whack", "A bright idea with claws.", "rare", "candle-pounce"],
  ["ember", 5, "Toastie Toe Beans", "Cozy Forge", "Tiny paws, furnace heart.", "uncommon", "toastie-toe-beans"],
  ["ember", 9, "Comet Claw", "Starfall Swipe", "Makes an entrance from orbit.", "legendary", "comet-claw"],
  ["ember", 4, "Cinder Kit", "Hearth Hop", "Soot first. Questions later.", "common", "cinder-kit"],
  ["ember", 3, "Teapot Tabby", "Scalding Service", "Tea is served dangerously hot.", "common", "teapot-tabby"],
  ["gust", 8, "Breeze Biscuit", "Leaf Rider", "No map. Excellent balance.", "epic", "breeze-biscuit"],
  ["gust", 6, "Leafy Loaf", "Nap Cyclone", "Rest is a tactical maneuver.", "rare", "leafy-loaf"],
  ["gust", 5, "Whisker Whirl", "Ribbon Twister", "Forecast: fabulous.", "uncommon", "whisker-whirl"],
  ["gust", 9, "Gale Groomer", "Captain's Roar", "Every breeze follows orders.", "legendary", "gale-groomer"],
  ["gust", 4, "Kitewhisker", "Banner Breeze", "Every gust deserves a flag.", "common", "kitewhisker"],
  ["gust", 3, "Dandelion Dash", "Seed Stampede", "All speed. Some direction.", "common", "dandelion-dash"],
  ["tide", 8, "Puddle Pouncer", "Splash Ambush", "Dry socks are overrated.", "epic", "puddle-pouncer"],
  ["tide", 6, "Bubble Bengal", "Pearl Pop", "Elegance under pressure.", "rare", "bubble-bengal"],
  ["tide", 5, "Moonpool Mouser", "Lunar Ripple", "The moon whispers. She listens.", "uncommon", "moonpool-mouser"],
  ["tide", 9, "Captain Catfish", "Big Catch", "The tale gets bigger each time.", "legendary", "captain-catfish"],
  ["tide", 4, "Wellwater Wisp", "Bucket Splash", "One pail. Zero dry paws.", "common", "wellwater-wisp"],
  ["tide", 3, "Drizzle Socks", "Cloud Hop", "Rainy with a chance of zoomies.", "common", "drizzle-socks"],
].map(([element, power, name, move, lore, rarity, art], index) => ({
  id: `card-${index}`,
  element,
  power,
  name,
  move,
  lore,
  rarity,
  art,
}));

const HAND_SIZE = 6;
const MAX_PLAY_SIZE = 3;
const DIFFICULTIES = {
  guided: { label: "Guided" },
  veiled: { label: "Veiled" },
  blind: { label: "Blind" },
};
const ELEMENT_SORT_ORDER = { ember: 0, gust: 1, tide: 2 };
const RARITY_SORT_ORDER = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
const ARCHIVE_SORT_SUMMARIES = {
  element: "Grouped by Ember, Gust, then Tide.",
  rarity: "Legendary cards first, then Epic, Rare, Uncommon, and Common.",
  power: "Highest base power first.",
  name: "Alphabetical from A to Z.",
};
const state = {
  deck: [],
  discardPile: [],
  playerHand: [],
  aiHand: [],
  playerWins: [],
  aiWins: [],
  aiPlan: [],
  aiTellClues: [],
  selectedCardIds: [],
  difficulty: null,
  archiveSort: "element",
  archiveElements: Object.keys(ELEMENT_SORT_ORDER),
  archiveRarities: Object.keys(RARITY_SORT_ORDER),
  playerRoundWins: 0,
  aiRoundWins: 0,
  pendingMatchWinner: null,
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
  nextRoundButton: document.querySelector("#nextRoundButton"),
  roundLabel: document.querySelector("#roundLabel"),
  roundScore: document.querySelector("#roundScore"),
  playerRoundScore: document.querySelector("#playerRoundScore"),
  aiRoundScore: document.querySelector("#aiRoundScore"),
  deckCount: document.querySelector("#deckCount"),
  deckStatusText: document.querySelector("#deckStatusText"),
  versusBadge: document.querySelector("#versusBadge"),
  howDialog: document.querySelector("#howDialog"),
  rulebookDialog: document.querySelector("#rulebookDialog"),
  galleryDialog: document.querySelector("#galleryDialog"),
  galleryButton: document.querySelector("#galleryButton"),
  cardGallery: document.querySelector("#cardGallery"),
  galleryIntro: document.querySelector("#galleryIntro"),
  archiveSort: document.querySelector("#archiveSort"),
  archiveSortSummary: document.querySelector("#archiveSortSummary"),
  archiveFilters: document.querySelector("#archiveFilters"),
  archiveResetFilters: document.querySelector("#archiveResetFilters"),
  resultDialog: document.querySelector("#resultDialog"),
  difficultyDialog: document.querySelector("#difficultyDialog"),
  soundButton: document.querySelector("#soundButton"),
};
let draggedCardId = null;

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

function drawCard() {
  const reshuffled = reshuffleDiscardPile(state.deck, state.discardPile);
  return {
    card: state.deck.pop() || null,
    reshuffled,
  };
}

function refillHands() {
  let reshuffled = false;
  let drewCard = true;

  while (
    drewCard
    && (state.playerHand.length < HAND_SIZE || state.aiHand.length < HAND_SIZE)
  ) {
    drewCard = false;
    for (const hand of [state.playerHand, state.aiHand]) {
      if (hand.length >= HAND_SIZE) continue;
      const draw = drawCard();
      reshuffled ||= draw.reshuffled;
      if (draw.card) {
        hand.push(draw.card);
        drewCard = true;
      }
    }
  }
  return reshuffled;
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
    ui.matchupForecast.style.gridTemplateColumns = "";
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
    ui.matchupForecast.style.gridTemplateColumns = "";
    ui.matchupForecast.innerHTML = `
      <span class="forecast-instruction">
        Drag a card into Lane 1, or click a card below. Its bonus math will appear here.
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
  ui.matchupForecast.style.gridTemplateColumns = `repeat(${selectedCards.length}, minmax(0, 1fr))`;

  ui.matchupForecast.innerHTML = selectedCards.map((playerCard, index) => {
    const opponentCard = state.aiPlan[index];
    if (!opponentCard) {
      return `
        <span class="forecast-chip forecast-pressure">
          <i>${index + 1}</i>
          <b>◆ PRESSURE CARD</b>
          <span class="forecast-equation"><strong>NO DUEL TOTAL</strong></span>
          <small>Spent only to win a tied formation</small>
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
    const knownBonusTotal = playerFocus + playerChain;
    const knownBonuses = [];
    if (playerFocus) knownBonuses.push(`Focus +${playerFocus}`);
    if (playerChain) knownBonuses.push(`Chain +${playerChain}`);
    const knownBonusDetail = knownBonuses.length
      ? knownBonuses.join(" · ")
      : "No known bonus";

    if (clue === "sealed") {
      return `
        <span class="forecast-chip forecast-sealed">
          <i>${index + 1}</i>
          <b>? SEALED · TOTAL ${knownPlayerScore}–${knownPlayerScore + 2}</b>
          <span class="forecast-equation">
            <em>${playerCard.power} BASE</em><span>+</span><strong>${knownBonusTotal}–${knownBonusTotal + 2} BONUS</strong>
          </span>
          <small>${knownBonusDetail} · Element Edge hidden</small>
        </span>
      `;
    }

    if (clue === "power") {
      const powerRange = getPowerTier(opponentCard.power).range;
      return `
        <span class="forecast-chip forecast-clue">
          <i>${index + 1}</i>
          <b>◆ FOE ${powerRange} · YOUR TOTAL ${knownPlayerScore}–${knownPlayerScore + 2}</b>
          <span class="forecast-equation">
            <em>${playerCard.power} BASE</em><span>+</span><strong>${knownBonusTotal}–${knownBonusTotal + 2} BONUS</strong>
          </span>
          <small>${knownBonusDetail} · Element Edge hidden</small>
        </span>
      `;
    }

    if (clue === "element") {
      const elementRead = scoring.player.edge
        ? { icon: "+", title: "YOUR EDGE +2", className: "advantage" }
        : scoring.ai.edge
          ? { icon: "!", title: "FOE EDGE +2", className: "danger" }
          : { icon: "=", title: "SAME ELEMENT", className: "power" };
      if (scoring.player.edge) knownBonuses.push(`Element Edge +${scoring.player.edge}`);
      const totalBonus = scoring.player.focus + scoring.player.edge + scoring.player.chain;
      const bonusDetail = knownBonuses.length ? knownBonuses.join(" · ") : "No bonuses";
      return `
        <span class="forecast-chip forecast-${elementRead.className}">
          <i>${index + 1}</i>
          <b>${elementRead.icon} ${elementRead.title} · TOTAL ${scoring.player.total}</b>
          <span class="forecast-equation">
            <em>${playerCard.power} BASE</em><span>+</span><strong>${totalBonus} BONUS</strong><span>=</span><strong>${scoring.player.total}</strong>
          </span>
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
    const playerBonus = getBonusBreakdown(scoring.player);

    return `
      <span class="forecast-chip forecast-${copy.className}">
        <i>${index + 1}</i>
        <b>${copy.icon} ${copy.title} · TOTAL ${scoring.player.total} vs ${opponentMin}-${opponentMax}</b>
        <span class="forecast-equation">
          <em>${playerCard.power} BASE</em><span>+</span><strong>${playerBonus.total} BONUS</strong><span>=</span><strong>${scoring.player.total}</strong>
        </span>
        <small>${playerBonus.label}</small>
      </span>
    `;
  }).join("");
}

function renderAftermathBreakdown(playerCards, resolution) {
  ui.matchupForecast.style.gridTemplateColumns = `repeat(${Math.max(1, resolution.lanes.length)}, minmax(0, 1fr))`;
  ui.matchupForecast.innerHTML = resolution.lanes.map((lane, index) => {
    const bonus = getBonusBreakdown(lane.player);
    const outcome = lane.winner === "player" ? "WIN" : lane.winner === "ai" ? "LOSS" : "DRAW";
    const className = lane.winner === "player"
      ? "advantage"
      : lane.winner === "ai"
        ? "danger"
        : "power";
    return `
      <span class="forecast-chip forecast-${className} aftermath-chip">
        <i>${index + 1}</i>
        <b>${outcome} · ${lane.player.total} vs ${lane.ai.total}</b>
        <span class="forecast-equation">
          <em>${playerCards[index].power} BASE</em><span>+</span><strong>${bonus.total} BONUS</strong><span>=</span><strong>${lane.player.total} TOTAL</strong>
        </span>
        <small>${bonus.label}</small>
      </span>
    `;
  }).join("");
}

function cardMarkup(
  card,
  interactive = false,
  selectedIndex = -1,
  displayMode = "default",
  formationBonus = null,
) {
  const element = ELEMENTS[card.element];
  const isSelected = selectedIndex >= 0;
  const isFormationCard = displayMode === "formation";
  const isPlayedCard = displayMode === "played";
  const isPressureCard = displayMode === "pressure";
  const interactionLabel = isFormationCard
    ? `Remove ${card.name} from lane ${selectedIndex + 1}`
    : `Add ${card.name}, ${element.label}, power ${card.power} to the next lane`;
  const formationBonusBadge = isFormationCard && formationBonus
    ? `
      <span class="card-bonus-badge preview-badge${formationBonus.pressure ? " pressure-badge" : ""}" aria-label="${formationBonus.label}">
        <small>${formationBonus.pressure ? "ROLE" : "BONUS"}</small>
        <b>${formationBonus.text}</b>
      </span>
    `
    : "";
  const resolvedBonusBadge = isPlayedCard || isPressureCard
    ? `
      <span class="card-bonus-badge${isPressureCard ? " pressure-badge" : ""}" aria-label="${isPressureCard ? "Pressure card; no lane bonus" : "Bonus not yet resolved"}">
        <small>${isPressureCard ? "ROLE" : "BONUS"}</small>
        <b>${isPressureCard ? "P" : "+?"}</b>
      </span>
    `
    : "";
  return `
    <button
      class="game-card element-${card.element} rarity-${card.rarity} art-${card.art}${isFormationCard ? " selected formation-card" : ""}"
      ${interactive ? `data-card-id="${card.instanceId}" draggable="true" aria-label="${interactionLabel}" aria-pressed="${isSelected}"` : "disabled"}
      type="button"
    >
      ${formationBonusBadge}
      ${resolvedBonusBadge}
      <span class="card-art">
        <img src="./assets/cards/${card.art}.webp" alt="" draggable="false" />
        <span class="art-vignette" aria-hidden="true"></span>
        <span class="card-element" aria-hidden="true">${element.icon}</span>
        <span class="card-power"><small>POWER</small><b>${card.power}</b></span>
      </span>
      <span class="card-info">
        <strong>${card.name}</strong>
        <small>${element.label}</small>
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
    .filter((card) => !state.selectedCardIds.includes(card.instanceId))
    .map((card) => cardMarkup(card, !state.locked))
    .join("");

  bindCardInteractions(ui.playerHand);
  ui.playerHand.ondragover = (event) => {
    if (state.locked || !state.selectedCardIds.includes(draggedCardId)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    ui.playerHand.classList.add("return-drop-target");
  };
  ui.playerHand.ondragleave = () => ui.playerHand.classList.remove("return-drop-target");
  ui.playerHand.ondrop = (event) => {
    event.preventDefault();
    ui.playerHand.classList.remove("return-drop-target");
    const instanceId = event.dataTransfer.getData("text/plain") || draggedCardId;
    if (state.selectedCardIds.includes(instanceId)) toggleCardSelection(instanceId);
  };
  if (!state.locked) renderFormationBuilder();
  updateSelectionControls();
}

function bindCardInteractions(container) {
  const isPlayerHand = container === ui.playerHand;

  container.querySelectorAll("[data-card-id]").forEach((button) => {
    if (isPlayerHand) {
      button.addEventListener("pointerenter", (event) => {
        if (event.pointerType !== "touch") audio.cardHover();
      });
    }
    button.addEventListener("click", () => toggleCardSelection(button.dataset.cardId));
    button.addEventListener("dragstart", (event) => {
      draggedCardId = button.dataset.cardId;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", draggedCardId);
      button.classList.add("is-dragging");
    });
    button.addEventListener("dragend", () => {
      draggedCardId = null;
      button.classList.remove("is-dragging");
      document.querySelectorAll(".formation-slot.drag-over").forEach((slot) => {
        slot.classList.remove("drag-over");
      });
    });
  });
}

function getFormationBonusPreview(selectedCards, index) {
  const playerCard = selectedCards[index];
  const opponentCard = state.aiPlan[index];
  if (!opponentCard) {
    return {
      text: "P",
      label: "Pressure card; it does not receive a lane bonus",
      pressure: true,
    };
  }

  const focus = getFocusBonus(selectedCards.length);
  const chain = getChainBonus(selectedCards, index);
  const knownBonus = focus + chain;
  const clue = state.aiTellClues[index] || "sealed";
  const edgeKnown = clue === "full" || clue === "element";
  const edge = edgeKnown && ELEMENTS[playerCard.element].beats === opponentCard.element ? 2 : 0;
  const knownParts = [];
  if (focus) knownParts.push(`Focus +${focus}`);
  if (chain) knownParts.push(`Chain +${chain}`);
  if (edge) knownParts.push(`Element Edge +${edge}`);

  if (!edgeKnown) {
    return {
      text: `+${knownBonus}–${knownBonus + 2}`,
      label: `Bonus ranges from plus ${knownBonus} to plus ${knownBonus + 2}; Element Edge is hidden`,
      pressure: false,
    };
  }

  const total = knownBonus + edge;
  return {
    text: `+${total}`,
    label: `Total bonus plus ${total}: ${knownParts.length ? knownParts.join(", ") : "No bonuses"}`,
    pressure: false,
  };
}

function renderFormationBuilder() {
  const selectedCards = state.selectedCardIds
    .map((instanceId) => state.playerHand.find((card) => card.instanceId === instanceId))
    .filter(Boolean);

  ui.playerPlayZone.innerHTML = `
    <div class="formation-builder" aria-label="Your formation lanes">
      ${Array.from({ length: MAX_PLAY_SIZE }, (_, index) => {
        const card = selectedCards[index];
        const isNextSlot = index === selectedCards.length;
        if (card) {
          const bonusPreview = getFormationBonusPreview(selectedCards, index);
          return `
            <div class="formation-slot filled-slot" data-drop-lane="${index}">
              <span class="filled-lane-label">LANE ${index + 1}</span>
              ${cardMarkup(card, true, index, "formation", bonusPreview)}
            </div>
          `;
        }
        return `
          <div
            class="formation-slot empty-slot${isNextSlot ? " next-slot" : " waiting-slot"}"
            data-drop-lane="${index}"
            aria-label="Lane ${index + 1}${isNextSlot ? ", available for your next card" : ", waiting for the previous lane"}"
          >
            <span>LANE ${index + 1}</span>
            <b>${isNextSlot ? "DROP CARD" : "WAITING"}</b>
            <small>${isNextSlot ? "or click one below" : `Fill lane ${index}`}</small>
          </div>
        `;
      }).join("")}
    </div>
  `;

  bindCardInteractions(ui.playerPlayZone);
  ui.playerPlayZone.querySelectorAll("[data-drop-lane]").forEach((slot) => {
    const laneIndex = Number(slot.dataset.dropLane);
    slot.addEventListener("dragover", (event) => {
      if (state.locked || laneIndex > state.selectedCardIds.length) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      slot.classList.add("drag-over");
    });
    slot.addEventListener("dragleave", (event) => {
      if (!slot.contains(event.relatedTarget)) slot.classList.remove("drag-over");
    });
    slot.addEventListener("drop", (event) => {
      event.preventDefault();
      slot.classList.remove("drag-over");
      const instanceId = event.dataTransfer.getData("text/plain") || draggedCardId;
      placeCardInLane(instanceId, laneIndex);
    });
  });
}

function placeCardInLane(instanceId, laneIndex) {
  if (state.locked || !state.playerHand.some((card) => card.instanceId === instanceId)) return;
  const currentIndex = state.selectedCardIds.indexOf(instanceId);
  if (currentIndex < 0 && state.selectedCardIds.length >= MAX_PLAY_SIZE) {
    setMessage("Three-card limit reached.", "Return a card to your hand before adding another.");
    audio.denied();
    return;
  }

  if (currentIndex >= 0) state.selectedCardIds.splice(currentIndex, 1);
  const targetIndex = Math.min(Math.max(0, laneIndex), state.selectedCardIds.length);
  state.selectedCardIds.splice(targetIndex, 0, instanceId);
  draggedCardId = null;
  audio.cardFlip(true, targetIndex + 1);
  updateFormationMessage();
  renderHand();
}

function updateFormationMessage() {
  const count = state.selectedCardIds.length;
  const title = count === 0
    ? "Build your formation."
    : `${count} ${count === 1 ? "card" : "cards"} placed in formation.`;
  const focus = getFocusBonus(count);
  const focusLabel = focus ? `Focus +${focus}` : "No Focus";
  const detail = count === 0
    ? "Drag a card into the glowing lane, or click a card to place it."
    : count > state.aiPlan.length
      ? `Pressure advantage: tied formations go to you. ${focusLabel}.`
      : count < state.aiPlan.length
        ? `${focusLabel}, but Professor Paws wins tied formations.`
        : `Equal commitment with ${focusLabel.toLowerCase()}; a tied formation stays a draw.`;
  setMessage(title, detail);
}

function updateSelectionControls() {
  const count = state.selectedCardIds.length;
  const focus = getFocusBonus(count);
  const focusLabel = focus ? `Focus +${focus}` : "No Focus";
  ui.selectionCount.textContent = count
    ? `${count} of ${MAX_PLAY_SIZE} placed · ${focusLabel}`
    : `0 of ${MAX_PLAY_SIZE} placed`;
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

  if (changed) updateFormationMessage();

  renderHand();
}

function playedCardsMarkup(cards, side, clashCount = cards.length) {
  return `
    <div class="played-cards ${side}-formation">
      ${cards.map((card, index) => `
        <div class="clash-card${index >= clashCount ? " result-pressure" : ""}" data-clash-index="${index}">
          ${cardMarkup(card, false, index, index >= clashCount ? "pressure" : "played")}
          <span class="lane-result">${index >= clashCount ? "PRESSURE" : ""}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderGallery() {
  const sortedCards = CARD_LIBRARY.filter((card) =>
    state.archiveElements.includes(card.element)
    && state.archiveRarities.includes(card.rarity));
  if (state.archiveSort === "rarity") {
    sortedCards.sort((a, b) =>
      RARITY_SORT_ORDER[b.rarity] - RARITY_SORT_ORDER[a.rarity]
      || b.power - a.power
      || a.name.localeCompare(b.name));
  } else if (state.archiveSort === "power") {
    sortedCards.sort((a, b) =>
      b.power - a.power
      || a.name.localeCompare(b.name));
  } else if (state.archiveSort === "name") {
    sortedCards.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    sortedCards.sort((a, b) =>
      ELEMENT_SORT_ORDER[a.element] - ELEMENT_SORT_ORDER[b.element]);
  }

  ui.galleryIntro.textContent = sortedCards.length === CARD_LIBRARY.length
    ? `All ${CARD_LIBRARY.length} cards currently available in the game.`
    : `Showing ${sortedCards.length} of ${CARD_LIBRARY.length} cards.`;
  ui.archiveSort.value = state.archiveSort;
  ui.archiveSortSummary.textContent = ARCHIVE_SORT_SUMMARIES[state.archiveSort];
  ui.archiveFilters.querySelectorAll("[data-archive-filter]").forEach((checkbox) => {
    const selectedValues = checkbox.dataset.archiveFilter === "element"
      ? state.archiveElements
      : state.archiveRarities;
    checkbox.checked = selectedValues.includes(checkbox.value);
  });
  ui.archiveResetFilters.disabled =
    state.archiveElements.length === Object.keys(ELEMENT_SORT_ORDER).length
    && state.archiveRarities.length === Object.keys(RARITY_SORT_ORDER).length;
  ui.cardGallery.setAttribute(
    "aria-label",
    `Showing ${sortedCards.length} of ${CARD_LIBRARY.length} available cards. ${ARCHIVE_SORT_SUMMARIES[state.archiveSort]}`,
  );
  ui.cardGallery.innerHTML = sortedCards.length
    ? sortedCards.map((card) => cardMarkup(card)).join("")
    : `
      <div class="archive-empty">
        <b>No cards match these filters.</b>
        <span>Turn on at least one element and one rarity, or choose “Show all cards.”</span>
      </div>
    `;
}

function renderCollection(target, cards) {
  const counts = getElementTrophyCounts(cards);
  const progress = getTrophyProgress(cards);
  target.setAttribute(
    "aria-label",
    `${progress} of 6 trophy slots filled. Ember ${Math.min(counts.ember, TROPHIES_PER_ELEMENT)} of 2, Gust ${Math.min(counts.gust, TROPHIES_PER_ELEMENT)} of 2, Tide ${Math.min(counts.tide, TROPHIES_PER_ELEMENT)} of 2.`,
  );
  target.innerHTML = Object.entries(ELEMENTS).map(([elementKey, element]) => {
    const filledCount = Math.min(counts[elementKey], TROPHIES_PER_ELEMENT);
    const overflow = Math.max(0, counts[elementKey] - TROPHIES_PER_ELEMENT);
    return `
      <span class="trophy-goal element-${elementKey}" title="${element.label}: ${filledCount} of ${TROPHIES_PER_ELEMENT} trophies">
        <b aria-hidden="true">${element.icon}</b>
        <span class="trophy-slots" aria-hidden="true">
          ${Array.from(
            { length: TROPHIES_PER_ELEMENT },
            (_, index) => `<i class="${index < filledCount ? "filled" : ""}"></i>`,
          ).join("")}
        </span>
        ${overflow ? `<small aria-label="${overflow} additional ${element.label} trophies">+${overflow}</small>` : ""}
      </span>
    `;
  }).join("");
}

function renderRound() {
  ui.roundLabel.textContent = `ROUND ${state.round}`;
  if (state.deck.length === 0 && state.discardPile.length > 0) {
    ui.deckStatusText.innerHTML = `<strong>${state.discardPile.length}</strong> discarded cards ready to reshuffle`;
  } else if (state.deck.length === 0 && state.discardPile.length === 0) {
    ui.deckStatusText.innerHTML = "<strong>All active cards are in play</strong>";
  } else {
    const discardCopy = state.discardPile.length
      ? ` · ${state.discardPile.length} discarded`
      : "";
    ui.deckStatusText.innerHTML = `<strong id="deckCount">${state.deck.length}</strong> cards in draw pile${discardCopy}`;
    ui.deckCount = document.querySelector("#deckCount");
  }
}

function renderRoundScore() {
  ui.playerRoundScore.textContent = state.playerRoundWins;
  ui.aiRoundScore.textContent = state.aiRoundWins;
  ui.roundScore.setAttribute(
    "aria-label",
    `Round score: You ${state.playerRoundWins}, Professor Paws ${state.aiRoundWins}`,
  );
}

function setRoundAdvanceControls(visible, finalMatch = false) {
  ui.selectionCount.hidden = visible;
  ui.playSelectedButton.hidden = visible;
  ui.nextRoundButton.hidden = !visible;
  ui.nextRoundButton.disabled = !visible;
  ui.nextRoundButton.textContent = finalMatch ? "View Results" : "Next Round";
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

function getBonusBreakdown(scoring) {
  const parts = [];
  if (scoring.focus) parts.push(`Focus +${scoring.focus}`);
  if (scoring.edge) parts.push(`Element Edge +${scoring.edge}`);
  if (scoring.chain) parts.push(`Chain +${scoring.chain}`);
  return {
    total: scoring.focus + scoring.edge + scoring.chain,
    label: parts.length ? parts.join(", ") : "No bonuses",
  };
}

function revealClashScore(lane, scoring, outcome, opposingTotal) {
  const bonus = getBonusBreakdown(scoring);
  const badge = lane.querySelector(".card-bonus-badge");
  const result = lane.querySelector(".lane-result");
  const explanation = `${scoring.base} base + ${bonus.total} bonus = ${scoring.total}. ${bonus.label}.`;

  if (badge) {
    badge.innerHTML = `<small>BONUS</small><b>+${bonus.total}</b>`;
    badge.classList.add("is-resolved");
    badge.setAttribute("aria-label", `Total bonus plus ${bonus.total}: ${bonus.label}`);
    badge.title = explanation;
  }
  if (result) {
    result.innerHTML = `<b>${outcome} ${scoring.total}–${opposingTotal}</b><small>BONUS +${bonus.total}</small>`;
    result.setAttribute("aria-label", `${outcome}. ${explanation} Opponent total ${opposingTotal}.`);
    result.title = explanation;
  }
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
    revealClashScore(
      playerLane,
      laneScore.player,
      winner === "player" ? "WIN" : winner === "ai" ? "LOSS" : "DRAW",
      laneScore.ai.total,
    );
    revealClashScore(
      aiLane,
      laneScore.ai,
      winner === "ai" ? "WIN" : winner === "player" ? "LOSS" : "DRAW",
      laneScore.player.total,
    );
    impact.classList.add("impact-fade");
    ui.battlefield.classList.remove("is-clashing");

    await delay(pauseDuration);
  }

  return resolution;
}

function playRound() {
  if (state.locked || state.selectedCardIds.length === 0) return;

  setRoundAdvanceControls(false);
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

function getCompletedMatchWinner(roundWinner) {
  const playerCompletedSet = hasCompletedElementSet(state.playerWins);
  const aiCompletedSet = hasCompletedElementSet(state.aiWins);

  if (playerCompletedSet && aiCompletedSet) {
    if (roundWinner === "player" || roundWinner === "ai") return roundWinner;
    const playerProgress = getTrophyProgress(state.playerWins);
    const aiProgress = getTrophyProgress(state.aiWins);
    if (playerProgress > aiProgress) return "player";
    if (aiProgress > playerProgress) return "ai";
    return null;
  }

  if (playerCompletedSet) return "player";
  if (aiCompletedSet) return "ai";
  return null;
}

function resolveRound(playerCards, aiCards, resolution = resolveClashes(playerCards, aiCards)) {
  const { results, score, winner, decidedBy } = resolution;
  const reward = getFormationReward(playerCards, aiCards, resolution);
  ui.versusBadge.className = "versus-badge";

  if (reward.winner === "player" && reward.card) state.playerWins.push(reward.card);
  if (reward.winner === "ai" && reward.card) state.aiWins.push(reward.card);
  state.discardPile.push(
    ...playerCards.filter((card) => card !== reward.card),
    ...aiCards.filter((card) => card !== reward.card),
  );

  const clashWord = results.length === 1 ? "clash" : "clashes";
  ui.versusBadge.textContent = `${score.player}–${score.ai}`;

  if (winner === "player") {
    state.playerRoundWins += 1;
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
    state.aiRoundWins += 1;
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
  renderRoundScore();
  renderAftermathBreakdown(playerCards, resolution);
  state.pendingMatchWinner = getCompletedMatchWinner(winner);
  setRoundAdvanceControls(true, Boolean(state.pendingMatchWinner));
}

function nextRound() {
  state.pendingMatchWinner = null;
  setRoundAdvanceControls(false);
  const reshuffled = refillHands();

  if (!state.playerHand.length || !state.aiHand.length) {
    const playerProgress = getTrophyProgress(state.playerWins);
    const aiProgress = getTrophyProgress(state.aiWins);
    const winner = playerProgress === aiProgress
      ? (state.playerRoundWins >= state.aiRoundWins ? "player" : "ai")
      : (playerProgress > aiProgress ? "player" : "ai");
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
  setMessage(
    reshuffled ? "The discard pile has been reshuffled!" : "Build your formation.",
    reshuffled
      ? "Your spent cards are back in the draw pile. Build your next formation."
      : "Drag a card into the glowing lane, or click a card to place it.",
  );
  renderHand();
  renderRound();
  renderRoundScore();
}

function endGame(winner) {
  state.locked = true;
  const won = winner === "player";
  audio.matchResult(won);
  document.querySelector("#resultEyebrow").textContent = won ? "MATCH COMPLETE" : "A NOBLE DUEL";
  document.querySelector("#resultTitle").textContent = won
    ? "A purr-fect victory!"
    : "Professor Paws prevails!";
  const resultSummary = won
    ? "You claimed two trophies from every element."
    : "Professor Paws completed all six elemental trophy slots first.";
  document.querySelector("#resultText").textContent =
    `${resultSummary} Final round score: ${state.playerRoundWins}–${state.aiRoundWins}.`;
  document.querySelector("#resultRounds").textContent = state.round;
  document.querySelector("#resultCards").textContent = getTrophyProgress(state.playerWins);
  window.setTimeout(() => ui.resultDialog.showModal(), 250);
}

function showDifficultyChooser() {
  state.locked = true;
  if (!ui.difficultyDialog.open) ui.difficultyDialog.showModal();
}

function startGame() {
  state.deck = freshDeck();
  state.discardPile = [];
  state.playerHand = [];
  state.aiHand = [];
  state.playerWins = [];
  state.aiWins = [];
  state.aiPlan = [];
  state.aiTellClues = [];
  state.selectedCardIds = [];
  state.playerRoundWins = 0;
  state.aiRoundWins = 0;
  state.pendingMatchWinner = null;
  state.round = 1;
  state.locked = false;
  setRoundAdvanceControls(false);
  ui.clashEffects.innerHTML = "";
  ui.battlefield.classList.remove("is-clashing");
  refillHands();
  prepareAiPlan();
  ui.playerPlayZone.innerHTML = placeholder("Choose up to 3 cards");
  ui.aiPlayZone.innerHTML = placeholder("Formation sealed");
  ui.versusBadge.textContent = "VS";
  ui.versusBadge.className = "versus-badge";
  setMessage("Build your formation.", "Drag a card into the glowing lane, or click a card to place it.");
  renderCollection(ui.playerCollection, []);
  renderCollection(ui.aiCollection, []);
  renderHand();
  renderRound();
  renderRoundScore();
}

document.querySelector("#howButton").addEventListener("click", () => ui.howDialog.showModal());
document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => ui.howDialog.close());
});
document.querySelector("#rulebookButton").addEventListener("click", () => ui.rulebookDialog.showModal());
document.querySelectorAll("[data-close-rulebook]").forEach((button) => {
  button.addEventListener("click", () => ui.rulebookDialog.close());
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
ui.archiveSort.addEventListener("change", () => {
  if (!ARCHIVE_SORT_SUMMARIES[ui.archiveSort.value]) return;
  state.archiveSort = ui.archiveSort.value;
  renderGallery();
});
ui.archiveFilters.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-archive-filter]");
  if (!checkbox) return;
  const stateKey = checkbox.dataset.archiveFilter === "element"
    ? "archiveElements"
    : "archiveRarities";
  state[stateKey] = checkbox.checked
    ? [...new Set([...state[stateKey], checkbox.value])]
    : state[stateKey].filter((value) => value !== checkbox.value);
  renderGallery();
});
ui.archiveFilters.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-filter-action]");
  if (!actionButton) return;
  const stateKey = actionButton.dataset.filterKind === "element"
    ? "archiveElements"
    : "archiveRarities";
  const allValues = actionButton.dataset.filterKind === "element"
    ? Object.keys(ELEMENT_SORT_ORDER)
    : Object.keys(RARITY_SORT_ORDER);
  state[stateKey] = actionButton.dataset.filterAction === "all" ? allValues : [];
  renderGallery();
});
ui.archiveResetFilters.addEventListener("click", () => {
  state.archiveElements = Object.keys(ELEMENT_SORT_ORDER);
  state.archiveRarities = Object.keys(RARITY_SORT_ORDER);
  renderGallery();
});
ui.playSelectedButton.addEventListener("click", playRound);
ui.nextRoundButton.addEventListener("click", () => {
  ui.nextRoundButton.disabled = true;
  if (state.pendingMatchWinner) {
    const winner = state.pendingMatchWinner;
    state.pendingMatchWinner = null;
    endGame(winner);
    return;
  }
  audio.roundAdvance();
  nextRound();
});
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
