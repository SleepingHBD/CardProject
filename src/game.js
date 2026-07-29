const {
  ELEMENTS,
  buildTellClues,
  chooseAiCommitment,
  chooseAiCards,
  createAiTraits,
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
  ["gust", 8, "Gale Groomer", "Captain's Roar", "Every breeze follows orders.", "epic", "gale-groomer"],
  ["gust", 6, "Leafy Loaf", "Nap Cyclone", "Rest is a tactical maneuver.", "rare", "leafy-loaf"],
  ["gust", 5, "Whisker Whirl", "Ribbon Twister", "Forecast: fabulous.", "uncommon", "whisker-whirl"],
  ["gust", 9, "Sir Squall", "Galeguard Charge", "Even the wind rallies behind his shield.", "legendary", "sir-squall"],
  ["gust", 4, "Kitewhisker", "Banner Breeze", "Every gust deserves a flag.", "common", "kitewhisker"],
  ["gust", 3, "Dandelion Dash", "Seed Stampede", "All speed. Some direction.", "common", "dandelion-dash"],
  ["tide", 8, "Puddle Pouncer", "Splash Ambush", "Dry socks are overrated.", "epic", "puddle-pouncer"],
  ["tide", 6, "Bubble Bengal", "Pearl Pop", "Elegance under pressure.", "rare", "bubble-bengal"],
  ["tide", 5, "Moonpool Mouser", "Lunar Ripple", "The moon whispers. She listens.", "uncommon", "moonpool-mouser"],
  ["tide", 9, "Empress Ebb", "Leviathan's Decree", "Even the moon waits for her command.", "legendary", "empress-ebb"],
  ["tide", 4, "Wellwater Wisp", "Bucket Splash", "One pail. Zero dry paws.", "common", "wellwater-wisp"],
  ["tide", 3, "Mizzle Motley", "Ripple Rattle", "Three bells. No dry seats.", "common", "mizzle-motley"],
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
  instinct: { label: "Instinct" },
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
const CLASH_STYLES = Object.freeze(["cinematic", "classic"]);
const CLASH_STYLE_STORAGE_KEY = "projectProwl.clashStyle";
const AUDIO_VOLUME_STORAGE_KEY = "projectProwl.audioVolumes";
const DEFAULT_AUDIO_VOLUMES = Object.freeze({
  master: 0.72,
  music: 0.12,
  effects: 1,
});

function readSavedClashStyle() {
  try {
    const savedStyle = window.localStorage.getItem(CLASH_STYLE_STORAGE_KEY);
    return CLASH_STYLES.includes(savedStyle) ? savedStyle : "cinematic";
  } catch {
    return "cinematic";
  }
}

function normalizedAudioVolumes(volumes = {}) {
  return Object.fromEntries(
    Object.entries(DEFAULT_AUDIO_VOLUMES).map(([key, fallback]) => {
      const value = Number(volumes[key]);
      return [key, Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback];
    }),
  );
}

function readSavedAudioVolumes() {
  try {
    const savedVolumes = JSON.parse(
      window.localStorage.getItem(AUDIO_VOLUME_STORAGE_KEY) || "{}",
    );
    return normalizedAudioVolumes(savedVolumes);
  } catch {
    return { ...DEFAULT_AUDIO_VOLUMES };
  }
}

const state = {
  deck: [],
  discardPile: [],
  playerHand: [],
  aiHand: [],
  playerWins: [],
  aiWins: [],
  aiPlan: [],
  aiTellClues: [],
  aiTraits: [],
  previousPlayerCommitment: null,
  previousAiCommitment: null,
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
  dealing: false,
  soundOn: true,
  clashStyle: readSavedClashStyle(),
  audioVolumes: readSavedAudioVolumes(),
};

const ui = {
  gameShell: document.querySelector(".game-shell"),
  playerHand: document.querySelector("#playerHand"),
  playerPlayZone: document.querySelector("#playerPlayZone"),
  aiPlayZone: document.querySelector("#aiPlayZone"),
  battlefield: document.querySelector(".battlefield"),
  clashEffects: document.querySelector("#clashEffects"),
  playerCollection: document.querySelector("#playerCollection"),
  aiCollection: document.querySelector("#aiCollection"),
  turnMessage: document.querySelector("#turnMessage"),
  commitmentHint: document.querySelector("#commitmentHint"),
  opponentHabits: document.querySelector("#opponentHabits"),
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
  mainMenuScreen: document.querySelector("#mainMenuScreen"),
  mainMenuPlayButton: document.querySelector("#mainMenuPlayButton"),
  mainMenuRulebookButton: document.querySelector("#mainMenuRulebookButton"),
  mainMenuSettingsButton: document.querySelector("#mainMenuSettingsButton"),
  gameMenuDialog: document.querySelector("#gameMenuDialog"),
  settingsDialog: document.querySelector("#settingsDialog"),
  settingsStatus: document.querySelector("#settingsStatus"),
  audioSettingsStatus: document.querySelector("#audioSettingsStatus"),
  settingsTabs: document.querySelectorAll("[data-settings-panel]"),
  settingsPanels: document.querySelectorAll(".settings-panel"),
  audioVolumeInputs: document.querySelectorAll("[data-audio-volume]"),
  menuButton: document.querySelector("#menuButton"),
  resumeGameButton: document.querySelector("#resumeGameButton"),
  restartGameButton: document.querySelector("#restartGameButton"),
  changeDifficultyButton: document.querySelector("#changeDifficultyButton"),
  gameSettingsButton: document.querySelector("#gameSettingsButton"),
  returnMainMenuButton: document.querySelector("#returnMainMenuButton"),
  deckTransition: document.querySelector("#deckTransition"),
  deckTransitionLabel: document.querySelector("#deckTransitionLabel"),
  soundButton: document.querySelector("#soundButton"),
};
let draggedCardId = null;
let settingsReturnTarget = "main";

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
    Math.random,
    state.aiTraits,
    {
      player: state.previousPlayerCommitment,
      ai: state.previousAiCommitment,
    },
  );
  state.aiPlan = chooseAiCards(
    state.aiHand,
    commitment,
    state.playerWins,
    state.aiWins,
    Math.random,
    state.aiTraits,
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
  const concealsCommitment = state.difficulty === "instinct";
  ui.commitmentHint.textContent = concealsCommitment
    ? "Instinct · Commitment and Focus concealed"
    : `${difficultyLabel} · ${state.aiPlan.length} ${state.aiPlan.length === 1 ? "card" : "cards"} · ${focus ? `Focus +${focus}` : "No Focus"}`;
  const showsHabits = state.difficulty === "instinct" && state.aiTraits.length;
  ui.opponentHabits.hidden = !showsHabits;
  ui.opponentHabits.innerHTML = showsHabits
    ? state.aiTraits.map((trait) => `
        <div class="opponent-habit">
          <b>${trait.label}</b>
          <span>${trait.description}</span>
        </div>
      `).join("")
    : "";
  const laneLabels = ["1", "2", "3"];
  ui.opponentTells.innerHTML = laneLabels.map((lane, index) => {
    if (concealsCommitment) {
      return `
        <div class="opponent-tell clue-sealed possible-tell" aria-label="Lane ${lane}: occupancy and card details concealed">
          <span class="tell-lane">LANE ${lane}</span>
          <span class="tell-element" aria-hidden="true">?</span>
          <b>Possible card</b>
          <small>Occupancy hidden</small>
        </div>
      `;
    }
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
        ${state.dealing ? "New cards are being dealt." : "Cards committed. Watch each lane."}
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
  const concealsCommitment = state.difficulty === "instinct";
  ui.matchupForecast.style.gridTemplateColumns = `repeat(${selectedCards.length}, minmax(0, 1fr))`;

  ui.matchupForecast.innerHTML = selectedCards.map((playerCard, index) => {
    const opponentCard = state.aiPlan[index];
    const playerChain = getChainBonus(selectedCards, index);
    const knownPlayerScore = playerCard.power + playerFocus + playerChain;
    const knownBonusTotal = playerFocus + playerChain;
    const knownBonuses = [];
    if (playerFocus) knownBonuses.push(`Focus +${playerFocus}`);
    if (playerChain) knownBonuses.push(`Chain +${playerChain}`);
    const knownBonusDetail = knownBonuses.length
      ? knownBonuses.join(" · ")
      : "No known bonus";

    if (concealsCommitment) {
      return `
        <span class="forecast-chip forecast-sealed">
          <i>${index + 1}</i>
          <b>? POSSIBLE CLASH · ${knownPlayerScore}–${knownPlayerScore + 2}</b>
          <span class="forecast-equation">
            <em>${playerCard.power} BASE</em><span>+</span><strong>${knownBonusTotal}–${knownBonusTotal + 2} IF PAIRED</strong>
          </span>
          <small>${knownBonusDetail} · Foe presence and Element Edge hidden</small>
        </span>
      `;
    }

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
  const focus = getFocusBonus(selectedCards.length);
  const chain = getChainBonus(selectedCards, index);
  const knownBonus = focus + chain;
  if (state.difficulty === "instinct") {
    return {
      text: `+${knownBonus}–${knownBonus + 2}`,
      label: `If paired, bonus ranges from plus ${knownBonus} to plus ${knownBonus + 2}; opposing card presence and Element Edge are hidden`,
      pressure: false,
    };
  }

  const opponentCard = state.aiPlan[index];
  if (!opponentCard) {
    return {
      text: "P",
      label: "Pressure card; it does not receive a lane bonus",
      pressure: true,
    };
  }

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
    : state.difficulty === "instinct"
      ? `${focusLabel}. Professor Paws' commitment stays concealed until the reveal.`
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

async function playDeckTransition(phase) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isEnding = phase === "ending";
  const duration = reducedMotion ? 100 : isEnding ? 1350 : 1200;

  ui.deckTransitionLabel.textContent = isEnding
    ? "Collecting and shuffling..."
    : "Shuffling the deck...";
  ui.deckTransition.className = `deck-transition ${isEnding ? "is-ending" : "is-opening"}`;
  ui.deckTransition.hidden = false;
  ui.gameShell.classList.toggle("cards-gathering", isEnding);
  void ui.deckTransition.offsetWidth;
  ui.deckTransition.classList.add("is-active");
  audio.deckShuffle(isEnding);

  await delay(duration);

  ui.deckTransition.classList.remove("is-active");
  ui.gameShell.classList.remove("cards-gathering");
  ui.deckTransition.hidden = true;
}

async function animateHandDraw(drawCount, openingHand = false) {
  if (drawCount <= 0) {
    ui.playerHand.classList.remove("waiting-for-deal");
    return;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const handCards = [...ui.playerHand.querySelectorAll(".game-card")];
  const cardsToAnimate = openingHand ? handCards : handCards.slice(-drawCount);
  const stagger = reducedMotion ? 0 : 90;
  const animationDuration = reducedMotion ? 80 : 620;

  cardsToAnimate.forEach((card, index) => {
    card.style.setProperty("--deal-index", index);
    card.classList.add("hand-draw-card");
    window.setTimeout(() => audio.cardDeal(index), index * stagger);
  });
  ui.playerHand.classList.remove("waiting-for-deal");

  await delay(animationDuration + Math.max(0, cardsToAnimate.length - 1) * stagger);
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

function createCinematicCardCopy(card, className) {
  const copy = card.cloneNode(true);
  copy.classList.add("cinematic-card-copy", ...className.split(/\s+/));
  copy.removeAttribute("data-card-id");
  copy.removeAttribute("aria-label");
  copy.removeAttribute("aria-pressed");
  copy.setAttribute("aria-hidden", "true");
  copy.setAttribute("tabindex", "-1");
  copy.disabled = true;
  return copy;
}

function createDefeatEffect(lane, winningElement, { aftermath = false } = {}) {
  const card = lane.querySelector(".game-card");
  if (!card) return null;

  const effect = document.createElement("span");
  effect.className = `defeat-effect defeat-${winningElement}`;
  if (aftermath) effect.classList.add("aftermath-remains");
  effect.setAttribute("aria-hidden", "true");

  if (winningElement === "ember") {
    effect.append(
      createCinematicCardCopy(card, "ember-burning-card"),
      createCinematicCardCopy(card, "ember-charred-remains"),
    );
    const heatWave = document.createElement("span");
    heatWave.className = "ember-heat-wave";
    effect.append(heatWave);
  } else if (winningElement === "gust") {
    const vortex = document.createElement("span");
    vortex.className = "tornado-vortex";
    effect.append(vortex);
    for (let index = 1; index <= 6; index += 1) {
      effect.append(createCinematicCardCopy(card, `tornado-fragment fragment-${index}`));
    }
  } else {
    effect.append(
      createCinematicCardCopy(card, "tide-soaking-card"),
      createCinematicCardCopy(card, "tide-pulp-remains"),
    );
    const waterSheet = document.createElement("span");
    waterSheet.className = "tide-water-sheet";
    const inkBleed = document.createElement("span");
    inkBleed.className = "tide-ink-bleed";
    effect.append(waterSheet, inkBleed);
  }

  const particleCount = winningElement === "tide" ? 12 : winningElement === "gust" ? 14 : 16;
  const particles = document.createElement("span");
  particles.className = "defeat-particles";
  for (let index = 0; index < particleCount; index += 1) {
    const particle = document.createElement("i");
    particle.style.setProperty("--particle-index", index);
    particle.style.setProperty(
      "--particle-left",
      `${8 + index * (84 / Math.max(1, particleCount - 1))}%`,
    );
    particles.append(particle);
  }
  effect.append(particles);
  lane.classList.add("cinematic-defeat", `defeated-by-${winningElement}`);
  lane.append(effect);
  return effect;
}

function restoreCinematicAftermathRemains(playerCards, aiCards, resolution) {
  if (
    state.clashStyle !== "cinematic"
    || window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) return;

  ui.battlefield.querySelectorAll(".defeat-effect").forEach((effect) => effect.remove());
  ui.battlefield.querySelectorAll(".cinematic-defeat").forEach((lane) => {
    lane.classList.remove(
      "cinematic-defeat",
      "defeated-by-ember",
      "defeated-by-gust",
      "defeated-by-tide",
    );
  });

  const playerLanes = [...ui.playerPlayZone.querySelectorAll(".clash-card")];
  const aiLanes = [...ui.aiPlayZone.querySelectorAll(".clash-card")];

  resolution.results.forEach((winner, index) => {
    if (winner === "draw") return;
    const winningCard = winner === "player" ? playerCards[index] : aiCards[index];
    const losingLane = winner === "player" ? aiLanes[index] : playerLanes[index];
    if (winningCard && losingLane) {
      createDefeatEffect(losingLane, winningCard.element, { aftermath: true });
    }
  });
}

async function enterCinematicStage() {
  ui.battlefield.classList.add("cinematic-focus");
  await delay(260);
}

async function leaveCinematicStage() {
  await delay(120);
  ui.battlefield.classList.remove("cinematic-focus", "is-clashing");
}

function clearCinematicRemains() {
  ui.battlefield.querySelectorAll(".defeat-effect").forEach((effect) => effect.remove());
  ui.battlefield.querySelectorAll(".cinematic-defeat").forEach((lane) => {
    lane.classList.remove(
      "cinematic-defeat",
      "defeated-by-ember",
      "defeated-by-gust",
      "defeated-by-tide",
    );
  });
}

async function animateClashes(playerCards, aiCards) {
  const resolution = resolveClashes(playerCards, aiCards);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cinematic = state.clashStyle === "cinematic" && !reducedMotion;
  const strikeDuration = reducedMotion ? 80 : cinematic ? 820 : 540;
  const collisionDelay = reducedMotion ? 20 : cinematic ? 340 : 225;
  const pauseDuration = reducedMotion ? 30 : cinematic ? 1450 : 180;
  const playerLanes = [...ui.playerPlayZone.querySelectorAll(".clash-card")];
  const aiLanes = [...ui.aiPlayZone.querySelectorAll(".clash-card")];

  await delay(reducedMotion ? 30 : 220);
  if (cinematic) await enterCinematicStage();

  try {
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
      audio.clashImpact(
        playerCards[index].element,
        aiCards[index].element,
        winner,
        cinematic,
      );

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

      if (cinematic && winner !== "draw") {
        const losingLane = winner === "player" ? aiLane : playerLane;
        const element = ELEMENTS[winningCard.element];
        const defeatCopy = {
          ember: "sears the opposing card down to a blackened husk.",
          gust: "whips the opposing card through a tearing tornado.",
          tide: "soaks the opposing card until its ink runs into pulp.",
        }[winningCard.element];
        setMessage(
          `${element.label} claims Lane ${index + 1}!`,
          `${winningCard.name} ${defeatCopy}`,
        );
        createDefeatEffect(losingLane, winningCard.element);
        const losingLaneRect = losingLane.getBoundingClientRect();
        const destructionPan = Math.max(
          -0.6,
          Math.min(
            0.6,
            ((losingLaneRect.left + losingLaneRect.width / 2) / window.innerWidth) * 1.2 - 0.6,
          ),
        );
        audio.cardDestruction(winningCard.element, destructionPan);
      } else if (cinematic) {
        setMessage(
          `Lane ${index + 1} holds in a draw!`,
          "The cards recoil from an evenly matched impact.",
        );
      }

      impact.classList.add("impact-fade");
      ui.battlefield.classList.remove("is-clashing");
      await delay(cinematic && winner === "draw" ? 720 : pauseDuration);
    }

    if (cinematic) await delay(220);
  } finally {
    if (cinematic) await leaveCinematicStage();
  }

  return resolution;
}

function playRound() {
  if (state.locked || state.selectedCardIds.length === 0) return;

  setRoundAdvanceControls(false);
  ui.menuButton.disabled = true;
  const playerCards = state.selectedCardIds
    .map((instanceId) => removeCard(state.playerHand, instanceId))
    .filter(Boolean);
  if (!playerCards.length) {
    ui.menuButton.disabled = false;
    return;
  }

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
    state.previousPlayerCommitment = playerCards.length;
    state.previousAiCommitment = aiCards.length;
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
  restoreCinematicAftermathRemains(playerCards, aiCards, resolution);
  state.pendingMatchWinner = getCompletedMatchWinner(winner);
  setRoundAdvanceControls(true, Boolean(state.pendingMatchWinner));
  ui.menuButton.disabled = false;
}

async function nextRound() {
  clearCinematicRemains();
  state.pendingMatchWinner = null;
  setRoundAdvanceControls(false);
  const previousHandSize = state.playerHand.length;
  const reshuffled = refillHands();
  const drawnCardCount = Math.max(0, state.playerHand.length - previousHandSize);

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
  state.locked = true;
  state.dealing = true;
  ui.menuButton.disabled = true;
  state.selectedCardIds = [];
  prepareAiPlan();
  ui.clashEffects.innerHTML = "";
  ui.battlefield.classList.remove("is-clashing");
  ui.playerPlayZone.innerHTML = placeholder("Choose up to 3 cards");
  ui.aiPlayZone.innerHTML = placeholder("Formation sealed");
  ui.versusBadge.textContent = "VS";
  ui.versusBadge.className = "versus-badge";
  setMessage(
    reshuffled ? "The discard pile has been reshuffled!" : "Drawing your next hand...",
    reshuffled
      ? "Your spent cards are back in the draw pile. New cards are being dealt."
      : `${drawnCardCount} ${drawnCardCount === 1 ? "card is" : "cards are"} joining your hand.`,
  );
  renderHand();
  renderRound();
  renderRoundScore();
  await animateHandDraw(drawnCardCount);
  state.locked = false;
  state.dealing = false;
  ui.menuButton.disabled = false;
  setMessage(
    reshuffled ? "The discard pile has been reshuffled!" : "Build your formation.",
    reshuffled
      ? "Your spent cards are back in the draw pile. Build your next formation."
      : "Drag a card into the glowing lane, or click a card to place it.",
  );
  renderHand();
}

async function endGame(winner) {
  state.locked = true;
  ui.menuButton.disabled = true;
  const won = winner === "player";
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
  await playDeckTransition("ending");
  audio.matchResult(won);
  if (!ui.resultDialog.open) ui.resultDialog.showModal();
}

function setGameMenuVisibility(inGame) {
  ui.menuButton.hidden = !inGame;
}

function closeDialog(dialog) {
  if (dialog.open) dialog.close();
}

function saveClashStyle(clashStyle) {
  try {
    window.localStorage.setItem(CLASH_STYLE_STORAGE_KEY, clashStyle);
    return true;
  } catch {
    return false;
  }
}

function saveAudioVolumes(audioVolumes) {
  try {
    window.localStorage.setItem(
      AUDIO_VOLUME_STORAGE_KEY,
      JSON.stringify(audioVolumes),
    );
    return true;
  } catch {
    return false;
  }
}

function renderAudioSettings(saved = true) {
  ui.audioVolumeInputs.forEach((input) => {
    const volumeKey = input.dataset.audioVolume;
    const percentage = Math.round((state.audioVolumes[volumeKey] || 0) * 100);
    input.value = percentage;
    const output = document.querySelector(`#${input.id}Value`);
    if (output) output.textContent = `${percentage}%`;
  });
  ui.audioSettingsStatus.textContent = saved
    ? "Audio levels are saved for this browser."
    : "Audio levels are set for this session. Browser storage is unavailable.";
}

function renderSettings(clashSaved = true, audioSaved = true) {
  document.querySelectorAll('input[name="clashStyle"]').forEach((option) => {
    option.checked = option.value === state.clashStyle;
  });
  const styleLabel = state.clashStyle === "cinematic" ? "Cinematic" : "Classic";
  ui.settingsStatus.textContent = clashSaved
    ? `${styleLabel} clashes are selected and saved for this browser.`
    : `${styleLabel} clashes are selected for this session. Browser storage is unavailable.`;
  renderAudioSettings(audioSaved);
}

function showSettingsPanel(panelName) {
  ui.settingsTabs.forEach((tab) => {
    const selected = tab.dataset.settingsPanel === panelName;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-selected", String(selected));
  });
  ui.settingsPanels.forEach((panel) => {
    panel.hidden = panel.id !== `${panelName}SettingsPanel`;
  });
}

function openSettings(returnTarget) {
  settingsReturnTarget = returnTarget;
  if (ui.gameMenuDialog.open) ui.gameMenuDialog.close();
  renderSettings();
  showSettingsPanel("audio");
  if (!ui.settingsDialog.open) ui.settingsDialog.showModal();
}

function showMainMenu() {
  state.locked = true;
  audio.startMainMenuMusic();
  closeDialog(ui.gameMenuDialog);
  closeDialog(ui.difficultyDialog);
  closeDialog(ui.resultDialog);
  setGameMenuVisibility(false);
  ui.mainMenuScreen.hidden = false;
  document.body.classList.add("main-menu-active");
}

function showDifficultyChooser() {
  state.locked = true;
  ui.mainMenuScreen.hidden = true;
  document.body.classList.remove("main-menu-active");
  closeDialog(ui.gameMenuDialog);
  setGameMenuVisibility(false);
  if (!ui.difficultyDialog.open) ui.difficultyDialog.showModal();
}

async function startGame() {
  audio.startDuelMusic();
  clearCinematicRemains();
  state.deck = freshDeck();
  state.discardPile = [];
  state.playerHand = [];
  state.aiHand = [];
  state.playerWins = [];
  state.aiWins = [];
  state.aiPlan = [];
  state.aiTellClues = [];
  state.aiTraits = state.difficulty === "instinct" ? createAiTraits() : [];
  state.previousPlayerCommitment = null;
  state.previousAiCommitment = null;
  state.selectedCardIds = [];
  state.playerRoundWins = 0;
  state.aiRoundWins = 0;
  state.pendingMatchWinner = null;
  state.round = 1;
  state.locked = true;
  state.dealing = true;
  setGameMenuVisibility(true);
  ui.menuButton.disabled = true;
  setRoundAdvanceControls(false);
  ui.clashEffects.innerHTML = "";
  ui.battlefield.classList.remove("is-clashing");
  refillHands();
  prepareAiPlan();
  ui.playerPlayZone.innerHTML = placeholder("Choose up to 3 cards");
  ui.aiPlayZone.innerHTML = placeholder("Formation sealed");
  ui.versusBadge.textContent = "VS";
  ui.versusBadge.className = "versus-badge";
  setMessage("The deck is shuffling...", "Professor Paws is preparing the opening deal.");
  renderCollection(ui.playerCollection, []);
  renderCollection(ui.aiCollection, []);
  renderHand();
  ui.playerHand.classList.add("waiting-for-deal");
  renderRound();
  renderRoundScore();
  await playDeckTransition("opening");
  setMessage("Drawing your opening hand...", "Six cards are being dealt for the first round.");
  await animateHandDraw(state.playerHand.length, true);
  state.locked = false;
  state.dealing = false;
  ui.menuButton.disabled = false;
  setMessage("Build your formation.", "Drag a card into the glowing lane, or click a card to place it.");
  renderHand();
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
    clearCinematicRemains();
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
ui.mainMenuPlayButton.addEventListener("click", showDifficultyChooser);
ui.mainMenuRulebookButton.addEventListener("click", () => ui.rulebookDialog.showModal());
ui.mainMenuSettingsButton.addEventListener("click", () => openSettings("main"));
ui.menuButton.addEventListener("click", () => {
  if (!ui.menuButton.disabled && !ui.gameMenuDialog.open) {
    ui.gameMenuDialog.showModal();
    ui.menuButton.setAttribute("aria-expanded", "true");
  }
});
ui.resumeGameButton.addEventListener("click", () => ui.gameMenuDialog.close());
ui.restartGameButton.addEventListener("click", () => {
  ui.gameMenuDialog.close();
  startGame();
});
ui.changeDifficultyButton.addEventListener("click", showDifficultyChooser);
ui.gameSettingsButton.addEventListener("click", () => openSettings("game"));
ui.returnMainMenuButton.addEventListener("click", showMainMenu);
ui.gameMenuDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  ui.gameMenuDialog.close();
});
ui.gameMenuDialog.addEventListener("close", () => {
  ui.menuButton.setAttribute("aria-expanded", "false");
});
document.querySelectorAll("[data-close-settings]").forEach((button) => {
  button.addEventListener("click", () => ui.settingsDialog.close());
});
ui.settingsTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    showSettingsPanel(tab.dataset.settingsPanel);
  });
});
document.querySelectorAll('input[name="clashStyle"]').forEach((option) => {
  option.addEventListener("change", () => {
    if (!option.checked || !CLASH_STYLES.includes(option.value)) return;
    state.clashStyle = option.value;
    renderSettings(saveClashStyle(state.clashStyle));
  });
});
ui.audioVolumeInputs.forEach((input) => {
  input.addEventListener("input", () => {
    const volumeKey = input.dataset.audioVolume;
    state.audioVolumes = normalizedAudioVolumes({
      ...state.audioVolumes,
      [volumeKey]: Number(input.value) / 100,
    });
    audio.setVolumes(state.audioVolumes);
    renderAudioSettings(saveAudioVolumes(state.audioVolumes));
  });
  input.addEventListener("change", () => {
    if (input.dataset.audioVolume !== "music") audio.buttonPress();
  });
});
ui.settingsDialog.addEventListener("close", () => {
  const returnTarget = settingsReturnTarget;
  settingsReturnTarget = null;
  if (
    returnTarget === "game"
    && !ui.menuButton.hidden
    && !ui.gameMenuDialog.open
    && !ui.resultDialog.open
  ) {
    ui.gameMenuDialog.showModal();
    ui.menuButton.setAttribute("aria-expanded", "true");
  }
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

document.addEventListener("click", (event) => {
  const button = event.target.closest?.("button");
  if (!button || button.disabled || button.classList.contains("game-card")) return;
  audio.buttonPress();
}, { capture: true });

renderGallery();
audio.setVolumes(state.audioVolumes);
renderSettings(
  saveClashStyle(state.clashStyle),
  saveAudioVolumes(state.audioVolumes),
);
showMainMenu();
