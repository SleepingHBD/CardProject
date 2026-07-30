const {
  ELEMENTS,
  TACTICS,
  ELEMENT_EDGE_BONUS,
  buildTellClues,
  chooseAiCommitment,
  chooseAiCards,
  createAiTraits,
  getTacticBonus,
  getFocusBonus,
  getOverwhelmBonus,
  getFormationRewardOptions,
  getPowerTier,
  getElementTrophyCounts,
  getTrophyProgress,
  hasCompletedElementSet,
  reshuffleDiscardPile,
  resolveClashes,
  scoreClash,
  chooseTrophyReward,
  OVERWHELM_BONUS,
  TROPHIES_PER_ELEMENT,
} = globalThis.ClawRules;
const audio = globalThis.ClawAudio;

const CARD_LIBRARY = [
  ["ember", 8, "Sizzle Mittens", "Flame Yarn", "Never leaves a loose end.", "epic", "link", "sizzle-mittens"],
  ["ember", 6, "Candle Pounce", "Wax & Whack", "A bright idea with claws.", "rare", "vanguard", "candle-pounce"],
  ["ember", 5, "Toastie Toe Beans", "Cozy Forge", "Tiny paws, furnace heart.", "uncommon", "finisher", "toastie-toe-beans"],
  ["ember", 9, "Comet Claw", "Starfall Swipe", "Makes an entrance from orbit.", "legendary", "finisher", "comet-claw"],
  ["ember", 4, "Cinder Kit", "Hearth Hop", "Soot first. Questions later.", "common", "vanguard", "cinder-kit"],
  ["ember", 3, "Teapot Tabby", "Scalding Service", "Tea is served dangerously hot.", "common", "link", "teapot-tabby"],
  ["gust", 8, "Gale Groomer", "Captain's Roar", "Every breeze follows orders.", "epic", "link", "gale-groomer"],
  ["gust", 6, "Leafy Loaf", "Nap Cyclone", "Rest is a tactical maneuver.", "rare", "finisher", "leafy-loaf"],
  ["gust", 5, "Whisker Whirl", "Ribbon Twister", "Forecast: fabulous.", "uncommon", "link", "whisker-whirl"],
  ["gust", 9, "Sir Squall", "Galeguard Charge", "Even the wind rallies behind his shield.", "legendary", "vanguard", "sir-squall"],
  ["gust", 4, "Kitewhisker", "Banner Breeze", "Every gust deserves a flag.", "common", "vanguard", "kitewhisker"],
  ["gust", 3, "Dandelion Dash", "Seed Stampede", "All speed. Some direction.", "common", "finisher", "dandelion-dash"],
  ["tide", 8, "Puddle Pouncer", "Splash Ambush", "Dry socks are overrated.", "epic", "vanguard", "puddle-pouncer"],
  ["tide", 6, "Bubble Bengal", "Pearl Pop", "Elegance under pressure.", "rare", "link", "bubble-bengal"],
  ["tide", 5, "Moonpool Mouser", "Lunar Ripple", "The moon whispers. She listens.", "uncommon", "link", "moonpool-mouser"],
  ["tide", 9, "Empress Ebb", "Leviathan's Decree", "Even the moon waits for her command.", "legendary", "finisher", "empress-ebb"],
  ["tide", 4, "Wellwater Wisp", "Bucket Splash", "One pail. Zero dry paws.", "common", "vanguard", "wellwater-wisp"],
  ["tide", 3, "Mizzle Motley", "Ripple Rattle", "Three bells. No dry seats.", "common", "finisher", "mizzle-motley"],
].map(([element, power, name, move, lore, rarity, tactic, art], index) => ({
  id: `card-${index}`,
  element,
  power,
  name,
  move,
  lore,
  rarity,
  tactic,
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
const TUTORIAL_TOUR_STEPS = Object.freeze([
  Object.freeze({
    id: "round-score",
    concept: "Training Grounds Tour",
    title: "Track round wins",
    text:
      "This score records how many rounds you and Professor Paws have won during the current duel.",
    objective:
      "Round wins help explain who is performing better, but the score itself does not complete the match.",
    targets: Object.freeze(["#roundScore"]),
    anchor: "#roundScore",
    preferredSide: "bottom",
  }),
  Object.freeze({
    id: "trophy-progress",
    concept: "Training Grounds Tour",
    title: "Track trophy progress",
    text:
      "The elemental crests beside each duelist show the trophies collected from winning formations.",
    objective:
      "The real win condition is two Ember, two Gust, and two Tide trophies before Professor Paws.",
    targets: Object.freeze(["#playerCollection", "#aiCollection"]),
    anchor: "#playerCollection",
    preferredSide: "left",
  }),
  Object.freeze({
    id: "plan",
    concept: "Training Grounds Tour",
    title: "Read Professor Paws",
    text:
      "Professor’s Plan shows his committed lanes and any clues your difficulty allows. The tutorial reveals the full plan.",
    objective:
      "Check this panel before choosing cards. Harder modes conceal more information.",
    targets: Object.freeze([".tactics-board"]),
    anchor: ".tactics-board",
    preferredSide: "left",
  }),
  Object.freeze({
    id: "lane-matchups",
    concept: "Training Grounds Tour",
    title: "Each lane fights its match",
    text:
      "Cards do not combine into one 3v3 total. Lane 1 only clashes with Lane 1, Lane 2 with Lane 2, and Lane 3 with Lane 3.",
    objective:
      "Each paired lane calculates its own clash score. If one side commits more cards, unpaired cards create Pressure instead of attacking another lane.",
    targets: Object.freeze(["#aiPlayZone", "#playerPlayZone"]),
    anchor: "#playerPlayZone",
    preferredSide: "right",
  }),
  Object.freeze({
    id: "hand",
    concept: "Training Grounds Tour",
    title: "Choose from your hand",
    text:
      "These are the cards currently available to you. Every card has an element, printed Power, and a positional Tactic role.",
    objective:
      "During a lesson, drag a card toward the board or click it to place it in the next lane.",
    targets: Object.freeze(["#playerHand"]),
    anchor: "#playerHand",
    preferredSide: "top",
  }),
  Object.freeze({
    id: "lanes",
    concept: "Training Grounds Tour",
    title: "Build your formation",
    text:
      "You may commit up to three cards. They enter Lane 1, Lane 2, and Lane 3 in the order you place them.",
    objective:
      "Order matters because Vanguard, Link, and Finisher Tactics activate in different positions.",
    targets: Object.freeze(["#playerPlayZone"]),
    anchor: "#playerPlayZone",
    preferredSide: "right",
  }),
  Object.freeze({
    id: "forecast",
    concept: "Training Grounds Tour",
    title: "Preview before committing",
    text:
      "After placing a card, this forecast shows its active bonuses and expected lane total. The Commit button locks your formation.",
    objective:
      "Review the preview before committing. You can return a placed card to your hand and change the order first.",
    targets: Object.freeze(["#matchupForecast", "#playSelectedButton"]),
    anchor: "#matchupForecast",
    preferredSide: "left",
  }),
  Object.freeze({
    id: "references",
    concept: "Training Grounds Tour",
    title: "Help stays within reach",
    text:
      "The top bar opens the card archive, Duel Codex, Rulebook, and Menu. The draw-pile area contains the draggable Clash Score Guide.",
    objective:
      "Use these references whenever you need them. Begin Lesson 1 when you are ready.",
    targets: Object.freeze(["#clashScoreGuide", ".top-actions"]),
    anchor: ".top-actions",
    preferredSide: "bottom",
  }),
]);
const TUTORIAL_LESSONS = Object.freeze([
  Object.freeze({
    id: "element-edge",
    concept: "Lesson 1 · Elements",
    title: "Use Element Edge",
    intro:
      "Professor Paws committed Gust. Cinder Kit’s Ember element counters it and earns Element Edge +2.",
    objective:
      "Commit Cinder Kit. Its Ember element counters Gust and earns Element Edge +2.",
    introPages: Object.freeze([
      Object.freeze({
        title: "Element Edge follows the cycle",
        text:
          "Ember beats Gust, Gust beats Tide, and Tide beats Ember. A card that beats the opposing element earns Element Edge +2 when the lane is paired.",
        objective:
          "Element Edge strengthens the card’s total, but it does not guarantee victory. Printed Power and every other active bonus still matter.",
        visual: "element-cycle",
        targets: Object.freeze([]),
        unanchored: true,
      }),
      Object.freeze({
        title: "Find the +2 in the preview",
        text:
          "Professor Paws committed Gust. After you place the Ember card Cinder Kit, its bonus badge and forecast will include Element Edge +2.",
        objective:
          "Start the lesson, place Cinder Kit in Lane 1, and review its complete total before committing.",
        targets: Object.freeze(["#matchupForecast"]),
        anchor: "#matchupForecast",
        preferredSide: "left",
      }),
    ]),
    readyText:
      "Cinder Kit’s preview includes Element Edge +2 alongside Focus +2 and Vanguard +1.",
    readyObjective:
      "Compare Power 4 + bonuses 5 = total 9, then press the highlighted Commit button.",
    playerCards: Object.freeze(["cinder-kit", "kitewhisker", "wellwater-wisp"]),
    aiCards: Object.freeze(["dandelion-dash"]),
    expected: Object.freeze(["cinder-kit"]),
    aftermath:
      "Cinder Kit’s Power 4 gained Element Edge +2, Focus +2, and Vanguard +1 for a total of 9. The counter helped, but the final total decided the lane.",
  }),
  Object.freeze({
    id: "focus",
    concept: "Lesson 2 · Focus",
    title: "Do more with fewer cards",
    intro:
      "Committing one card grants Focus +2. Two cards receive Focus +1 each, while three cards receive no Focus.",
    objective:
      "Commit Sizzle Mittens alone. Its Focus lets it withstand Bubble Bengal’s Tide advantage.",
    playerCards: Object.freeze(["sizzle-mittens", "candle-pounce", "moonpool-mouser"]),
    aiCards: Object.freeze(["bubble-bengal", "teapot-tabby"]),
    expected: Object.freeze(["sizzle-mittens"]),
    aftermath:
      "Sizzle Mittens gained Focus +2 while each opposing card gained only Focus +1. That extra point overcame Bubble Bengal’s Element Edge.",
  }),
  Object.freeze({
    id: "tactics",
    concept: "Lesson 3 · Tactic roles",
    title: "Build a three-role formation",
    intro:
      "Vanguard earns +1 in Lane 1. Link earns +1 in Lane 2 or 3 when the card directly before the Link has a different element from the Link card. Finisher earns +1 as the last paired card in a two- or three-card formation.",
    objective:
      "Order Candle Pounce, Bubble Bengal, then Dandelion Dash to activate all three Tactics.",
    introPages: Object.freeze([
      Object.freeze({
        title: "Vanguard: commit it in Lane 1",
        text:
          "A Vanguard card gets Vanguard +1 only when it is committed in Lane 1. If you commit that Vanguard in Lane 2 or Lane 3, it still battles normally but receives no Vanguard bonus.",
        objective:
          "Look for the shield symbol on a card. Shield means Vanguard, and Vanguard means Lane 1.",
        targets: Object.freeze(["#playerHand"]),
        anchor: "#playerHand",
        preferredSide: "top",
      }),
      Object.freeze({
        title: "Link: check the card directly before it",
        text:
          "A Link card can earn Link +1 in Lane 2 or Lane 3. In Lane 2, the Link checks your card in Lane 1. In Lane 3, the Link checks your card in Lane 2. It gains +1 only when that preceding card has a different element from the Link card itself.",
        objective:
          "Link cannot activate in Lane 1 because no card comes before it. A Tide Link after Ember earns +1; a Tide Link after Tide earns no bonus.",
        targets: Object.freeze(["#playerHand", "#playerPlayZone"]),
        anchor: "#playerPlayZone",
        preferredSide: "right",
      }),
      Object.freeze({
        title: "Finisher: commit it last and face a card",
        text:
          "A Finisher gets Finisher +1 only when all three conditions are true: you commit at least two cards, the Finisher is your last committed card, and Professor Paws committed a card in that same lane.",
        objective:
          "With two cards, the Finisher belongs in Lane 2. With three cards, it belongs in Lane 3. A lone Finisher or an unpaired extra Finisher earns no bonus.",
        targets: Object.freeze(["#playerHand", "#playerPlayZone"]),
        anchor: "#playerPlayZone",
        preferredSide: "right",
      }),
      Object.freeze({
        title: "Placement decides whether Tactic +1 activates",
        text:
          "A Tactic role never prevents you from committing a card. It only decides whether that card earns Tactic +1. If its exact condition is not met, the card keeps its printed Power and other bonuses but receives no Tactic bonus.",
        objective:
          "During this lesson, the formation preview will show exactly which cards receive Tactic +1 before you commit.",
        targets: Object.freeze(["#playerPlayZone", "#matchupForecast"]),
        anchor: "#playerPlayZone",
        preferredSide: "right",
      }),
    ]),
    placementGuidance: Object.freeze([
      Object.freeze({
        title: "Lead with Vanguard",
        text:
          "Candle Pounce has the Vanguard role. Vanguard earns +1 only when committed in Lane 1.",
        objective: "Place Candle Pounce in Lane 1 to activate Vanguard +1.",
      }),
      Object.freeze({
        title: "Connect with Link",
        text:
          "Bubble Bengal is a Tide Link. In Lane 2, she checks the card directly before her: Candle Pounce in Lane 1. The card before the Link is Ember, which differs from Bubble Bengal’s Tide element, so Link +1 will activate. A Link can also activate in Lane 3 by checking Lane 2.",
        objective:
          "Place Bubble Bengal in Lane 2. Because the card directly before the Link has a different element from her Tide element, she receives Link +1.",
      }),
      Object.freeze({
        title: "Close with Finisher",
        text:
          "Dandelion Dash is a Finisher. You will commit three cards, he will be your last committed card in Lane 3, and Professor Paws has a card in Lane 3. All three Finisher conditions are met.",
        objective:
          "Place Dandelion Dash in Lane 3. Because he is last and faces an opposing card, he receives Finisher +1.",
      }),
    ]),
    readyText:
      "The preview shows why each bonus activated: Vanguard +1 for Lane 1, Link +1 because the card before the Link has a different element from the Link card, and Finisher +1 because Lane 3 is last and paired.",
    readyObjective:
      "Confirm all three Tactic +1 bonuses in the forecast, then commit the formation.",
    playerCards: Object.freeze(["candle-pounce", "bubble-bengal", "dandelion-dash"]),
    aiCards: Object.freeze(["teapot-tabby", "moonpool-mouser", "wellwater-wisp"]),
    expected: Object.freeze(["candle-pounce", "bubble-bengal", "dandelion-dash"]),
    aftermath:
      "Candle Pounce gained Vanguard +1 for being in Lane 1. Bubble Bengal gained Link +1 because the card before the Link had a different element from her Tide element. Dandelion Dash gained Finisher +1 because he was last in a three-card formation and faced Lane 3. Changing their order could disable these bonuses.",
    trophyChoice: true,
  }),
  Object.freeze({
    id: "overwhelm",
    concept: "Lesson 4 · Overwhelm",
    title: "Punish a lone commitment",
    intro:
      "When three cards face exactly one, Lane 1 gains Overwhelm +2. The larger formation spends more cards and receives no Focus.",
    objective:
      "Order Sir Squall, Moonpool Mouser, then Comet Claw. Watch Overwhelm strengthen Lane 1.",
    playerCards: Object.freeze(["sir-squall", "moonpool-mouser", "comet-claw"]),
    aiCards: Object.freeze(["gale-groomer"]),
    expected: Object.freeze(["sir-squall", "moonpool-mouser", "comet-claw"]),
    aftermath:
      "Sir Squall’s Lane 1 total included Overwhelm +2. The two unpaired cards created Pressure, but Pressure was not needed because Lane 1 won normally.",
  }),
  Object.freeze({
    id: "pressure",
    concept: "Lesson 5 · Pressure",
    title: "Break a tied round",
    intro:
      "Pressure is not a clash bonus. If lane wins are tied, the side that committed more cards wins the round.",
    objective:
      "Order Sizzle Mittens first and Bubble Bengal second. The paired clash will draw; Bubble Bengal will provide Pressure.",
    playerCards: Object.freeze(["sizzle-mittens", "bubble-bengal", "cinder-kit"]),
    aiCards: Object.freeze(["candle-pounce"]),
    expected: Object.freeze(["sizzle-mittens", "bubble-bengal"]),
    aftermath:
      "The only paired clash drew 9–9. Your extra card broke the tied round through Pressure and became the automatic trophy.",
    pressureTrophy: true,
  }),
]);

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
  pendingTrophyClaim: null,
  round: 1,
  locked: false,
  dealing: false,
  soundOn: true,
  clashStyle: readSavedClashStyle(),
  audioVolumes: readSavedAudioVolumes(),
};
const tutorial = {
  active: false,
  lessonIndex: 0,
  tourStep: 0,
  introStep: 0,
  phase: "idle",
  runId: 0,
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
  trophyClaim: document.querySelector("#trophyClaim"),
  trophyClaimOptions: document.querySelector("#trophyClaimOptions"),
  roundLabel: document.querySelector("#roundLabel"),
  roundScore: document.querySelector("#roundScore"),
  playerRoundScore: document.querySelector("#playerRoundScore"),
  aiRoundScore: document.querySelector("#aiRoundScore"),
  deckCount: document.querySelector("#deckCount"),
  deckStatusText: document.querySelector("#deckStatusText"),
  clashScoreGuide: document.querySelector("#clashScoreGuide"),
  clashScorePanel: document.querySelector("#clashScorePanel"),
  clashScoreDragHandle: document.querySelector("#clashScoreDragHandle"),
  clashScoreClose: document.querySelector("#clashScoreClose"),
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
  mainMenuTutorialButton: document.querySelector("#mainMenuTutorialButton"),
  mainMenuRulebookButton: document.querySelector("#mainMenuRulebookButton"),
  mainMenuSettingsButton: document.querySelector("#mainMenuSettingsButton"),
  gameMenuDialog: document.querySelector("#gameMenuDialog"),
  gameMenuTitle: document.querySelector("#gameMenuTitle"),
  gameMenuNote: document.querySelector("#gameMenuNote"),
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
  tutorialCoach: document.querySelector("#tutorialCoach"),
  tutorialCoachDragHandle: document.querySelector("#tutorialCoachDragHandle"),
  tutorialProgress: document.querySelector("#tutorialProgress"),
  tutorialConcept: document.querySelector("#tutorialConcept"),
  tutorialCoachTitle: document.querySelector("#tutorialCoachTitle"),
  tutorialVisual: document.querySelector("#tutorialVisual"),
  tutorialCoachText: document.querySelector("#tutorialCoachText"),
  tutorialObjective: document.querySelector("#tutorialObjective"),
  tutorialActionButton: document.querySelector("#tutorialActionButton"),
};
let draggedCardId = null;
let settingsReturnTarget = "main";
const clashScoreDrag = {
  pointerId: null,
  offsetX: 0,
  offsetY: 0,
};
const tutorialCoachDrag = {
  pointerId: null,
  offsetX: 0,
  offsetY: 0,
  anchorKey: null,
  manual: false,
};

function currentTutorialLesson() {
  return TUTORIAL_LESSONS[tutorial.lessonIndex] || null;
}

function currentTutorialIntroPages() {
  const lesson = currentTutorialLesson();
  if (!lesson) return [];
  return lesson.introPages || [{
    title: lesson.title,
    text: lesson.intro,
    objective: lesson.objective,
    targets: [".tactics-board"],
    anchor: ".tactics-board",
    preferredSide: "left",
  }];
}

function currentTutorialIntroPage() {
  return currentTutorialIntroPages()[tutorial.introStep] || null;
}

function currentTutorialTourStep() {
  return TUTORIAL_TOUR_STEPS[tutorial.tourStep] || null;
}

function createTutorialCard(art, side, index) {
  const template = CARD_LIBRARY.find((card) => card.art === art);
  if (!template) throw new Error(`Unknown tutorial card: ${art}`);
  return {
    ...template,
    instanceId: `tutorial-${tutorial.runId}-${tutorial.lessonIndex}-${side}-${index}`,
  };
}

function selectedTutorialTemplates() {
  return state.selectedCardIds
    .map((instanceId) => state.playerHand.find((card) => card.instanceId === instanceId)?.art)
    .filter(Boolean);
}

function isTutorialSelectionValid() {
  if (!tutorial.active || tutorial.phase !== "play") return true;
  const lesson = currentTutorialLesson();
  const selected = selectedTutorialTemplates();
  return Boolean(
    lesson
    && selected.length === lesson.expected.length
    && selected.every((art, index) => art === lesson.expected[index])
  );
}

function isTutorialSelectionPrefix() {
  if (!tutorial.active || tutorial.phase !== "play") return false;
  const lesson = currentTutorialLesson();
  const selected = selectedTutorialTemplates();
  return Boolean(
    lesson
    && selected.length <= lesson.expected.length
    && selected.every((art, index) => art === lesson.expected[index])
  );
}

function clearTutorialHighlights() {
  document.querySelectorAll(".tutorial-focus-target").forEach((element) => {
    element.classList.remove("tutorial-focus-target");
  });
  document.querySelectorAll(".tutorial-recommended-card").forEach((element) => {
    element.classList.remove("tutorial-recommended-card");
  });
}

function applyTutorialHighlights() {
  clearTutorialHighlights();
  if (!tutorial.active || ui.tutorialCoach.hidden) return;

  if (tutorial.phase === "tour") {
    currentTutorialTourStep()?.targets.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        element.classList.add("tutorial-focus-target");
      });
    });
    return;
  }

  if (tutorial.phase === "intro") {
    currentTutorialIntroPage()?.targets.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        element.classList.add("tutorial-focus-target");
      });
    });
    return;
  }

  if (tutorial.phase === "play") {
    if (isTutorialSelectionValid()) {
      ui.playSelectedButton.classList.add("tutorial-focus-target");
      ui.matchupForecast.classList.add("tutorial-focus-target");
      return;
    }

    const lesson = currentTutorialLesson();
    const selected = selectedTutorialTemplates();
    const prefixLength = isTutorialSelectionPrefix() ? selected.length : 0;
    const nextArt = lesson?.expected[prefixLength];
    const recommendedCard = nextArt
      ? ui.playerHand.querySelector(`[data-card-template="${nextArt}"]`)
      : null;
    recommendedCard?.classList.add("tutorial-recommended-card");
    ui.playerPlayZone
      .querySelector(".formation-slot.next-slot")
      ?.classList.add("tutorial-focus-target");
    return;
  }

  if (tutorial.phase === "claim") {
    ui.trophyClaim.classList.add("tutorial-focus-target");
    return;
  }

  if (tutorial.phase === "aftermath" || tutorial.phase === "complete") {
    ui.playerPlayZone.classList.add("tutorial-focus-target");
    ui.playerCollection.classList.add("tutorial-focus-target");
  }
}

function getTutorialCoachAnchorContext() {
  if (!tutorial.active) return null;

  if (tutorial.phase === "tour") {
    const tourStep = currentTutorialTourStep();
    return tourStep
      ? {
          element: document.querySelector(tourStep.anchor),
          key: `tour:${tourStep.id}`,
          preferredSide: tourStep.preferredSide,
        }
      : null;
  }

  const lesson = currentTutorialLesson();
  if (!lesson) return null;

  if (tutorial.phase === "intro") {
    const introPage = currentTutorialIntroPage();
    if (introPage?.unanchored) {
      return {
        element: null,
        key: `lesson:${lesson.id}:intro:${tutorial.introStep}`,
        unanchored: true,
      };
    }
    return {
      element: document.querySelector(introPage?.anchor || ".tactics-board"),
      key: `lesson:${lesson.id}:intro:${tutorial.introStep}`,
      preferredSide: introPage?.preferredSide || "left",
    };
  }

  if (tutorial.phase === "play") {
    const selected = selectedTutorialTemplates();
    if (isTutorialSelectionValid()) {
      return {
        element: ui.matchupForecast,
        key: `lesson:${lesson.id}:formation-ready`,
        preferredSide: "left",
      };
    }
    if (selected.length && !isTutorialSelectionPrefix()) {
      return {
        element: ui.playerPlayZone,
        key: `lesson:${lesson.id}:wrong-order:${selected.join("-")}`,
        preferredSide: "right",
      };
    }
    const nextArt = lesson.expected[selected.length];
    const recommendedCard = nextArt
      ? ui.playerHand.querySelector(`[data-card-template="${nextArt}"]`)
      : null;
    return {
      element: recommendedCard || ui.playerPlayZone,
      key: `lesson:${lesson.id}:next-card:${selected.length}`,
      preferredSide: recommendedCard ? "top" : "right",
    };
  }

  if (tutorial.phase === "claim") {
    return {
      element: ui.trophyClaim,
      key: `lesson:${lesson.id}:claim`,
      preferredSide: "left",
    };
  }

  if (tutorial.phase === "aftermath") {
    return {
      element: ui.playerPlayZone,
      key: `lesson:${lesson.id}:aftermath`,
      preferredSide: "right",
    };
  }

  if (tutorial.phase === "complete") {
    return {
      element: ui.playerCollection,
      key: `lesson:${lesson.id}:complete`,
      preferredSide: "left",
    };
  }

  return null;
}

function getRectOverlapArea(first, second) {
  const width = Math.max(
    0,
    Math.min(first.right, second.right) - Math.max(first.left, second.left),
  );
  const height = Math.max(
    0,
    Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top),
  );
  return width * height;
}

function getTutorialCoachCandidate(side, anchorRect, panelRect, gap, margin) {
  const centerX = anchorRect.left + anchorRect.width / 2;
  const centerY = anchorRect.top + anchorRect.height / 2;
  let left = centerX - panelRect.width / 2;
  let top = centerY - panelRect.height / 2;

  if (side === "right") left = anchorRect.right + gap;
  if (side === "left") left = anchorRect.left - panelRect.width - gap;
  if (side === "bottom") top = anchorRect.bottom + gap;
  if (side === "top") top = anchorRect.top - panelRect.height - gap;

  left = Math.min(
    Math.max(margin, left),
    Math.max(margin, window.innerWidth - panelRect.width - margin),
  );
  top = Math.min(
    Math.max(margin, top),
    Math.max(margin, window.innerHeight - panelRect.height - margin),
  );

  const rect = {
    left,
    top,
    right: left + panelRect.width,
    bottom: top + panelRect.height,
  };
  return {
    side,
    left,
    top,
    overlap: getRectOverlapArea(rect, anchorRect),
  };
}

function positionTutorialCoach() {
  const context = getTutorialCoachAnchorContext();
  if (!context || ui.tutorialCoach.hidden) return;

  const newAnchor = tutorialCoachDrag.anchorKey !== context.key;
  if (newAnchor) {
    tutorialCoachDrag.anchorKey = context.key;
    tutorialCoachDrag.manual = false;
  }

  if (tutorialCoachDrag.manual) {
    ui.tutorialCoach.classList.remove("is-anchored");
    ui.tutorialCoach.removeAttribute("data-anchor-side");
    const panelRect = ui.tutorialCoach.getBoundingClientRect();
    moveTutorialCoach(panelRect.left, panelRect.top);
    return;
  }

  if (context.unanchored) {
    ui.tutorialCoach.classList.remove("is-anchored");
    ui.tutorialCoach.removeAttribute("data-anchor-side");
    const panelRect = ui.tutorialCoach.getBoundingClientRect();
    moveTutorialCoach(
      (window.innerWidth - panelRect.width) / 2,
      (window.innerHeight - panelRect.height) / 2,
    );
    return;
  }

  if (!context.element) return;

  let anchorRect = context.element.getBoundingClientRect();
  if (
    newAnchor
    && (anchorRect.bottom < 68 || anchorRect.top > window.innerHeight - 44)
  ) {
    context.element.scrollIntoView({ block: "center", inline: "nearest" });
    anchorRect = context.element.getBoundingClientRect();
  }

  const panelRect = ui.tutorialCoach.getBoundingClientRect();
  const preferredOrder = [
    context.preferredSide,
    "right",
    "left",
    "bottom",
    "top",
  ].filter((side, index, sides) => side && sides.indexOf(side) === index);
  const candidates = preferredOrder.map((side, order) => ({
    ...getTutorialCoachCandidate(side, anchorRect, panelRect, 16, 8),
    order,
  }));
  candidates.sort((first, second) =>
    first.overlap - second.overlap || first.order - second.order);
  const chosen = candidates[0];
  const position = moveTutorialCoach(chosen.left, chosen.top);
  const anchorCenterX = anchorRect.left + anchorRect.width / 2;
  const anchorCenterY = anchorRect.top + anchorRect.height / 2;
  const arrowX = Math.min(
    Math.max(26, anchorCenterX - position.left),
    Math.max(26, panelRect.width - 26),
  );
  const arrowY = Math.min(
    Math.max(26, anchorCenterY - position.top),
    Math.max(26, panelRect.height - 26),
  );
  ui.tutorialCoach.style.setProperty("--tutorial-arrow-x", `${arrowX}px`);
  ui.tutorialCoach.style.setProperty("--tutorial-arrow-y", `${arrowY}px`);
  ui.tutorialCoach.dataset.anchorSide = chosen.side;
  ui.tutorialCoach.classList.add("is-anchored");
}

function renderTutorialVisual(type = null) {
  if (type !== "element-cycle") {
    ui.tutorialVisual.hidden = true;
    ui.tutorialVisual.innerHTML = "";
    return;
  }

  ui.tutorialVisual.hidden = false;
  ui.tutorialVisual.innerHTML = `
    <div
      class="element-edge-cycle"
      role="img"
      aria-label="Element Edge cycle: Ember beats Gust, Gust beats Tide, and Tide beats Ember. A winning elemental counter adds two points."
    >
      <svg class="element-cycle-arrows" viewBox="0 0 320 190" aria-hidden="true">
        <defs>
          <marker id="element-cycle-arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z"></path>
          </marker>
        </defs>
        <path d="M 186 46 C 228 65, 250 91, 261 124"></path>
        <path d="M 232 151 C 189 169, 131 169, 88 151"></path>
        <path d="M 59 124 C 70 90, 94 64, 135 46"></path>
      </svg>
      <span class="element-cycle-beats beats-ember-gust" aria-hidden="true">BEATS</span>
      <span class="element-cycle-beats beats-gust-tide" aria-hidden="true">BEATS</span>
      <span class="element-cycle-beats beats-tide-ember" aria-hidden="true">BEATS</span>
      <div class="element-cycle-node cycle-ember">
        <i aria-hidden="true">${ELEMENTS.ember.icon}</i>
        <b>EMBER</b>
      </div>
      <div class="element-cycle-node cycle-gust">
        <i aria-hidden="true">${ELEMENTS.gust.icon}</i>
        <b>GUST</b>
      </div>
      <div class="element-cycle-node cycle-tide">
        <i aria-hidden="true">${ELEMENTS.tide.icon}</i>
        <b>TIDE</b>
      </div>
      <div class="element-cycle-edge" aria-hidden="true">
        <b>+${ELEMENT_EDGE_BONUS}</b>
        <span>EDGE</span>
      </div>
    </div>
  `;
}

function renderTutorialCoach() {
  renderTutorialVisual();
  if (!tutorial.active) {
    ui.tutorialCoach.hidden = true;
    clearTutorialHighlights();
    return;
  }
  if (tutorial.phase === "clashing") {
    ui.tutorialCoach.hidden = true;
    clearTutorialHighlights();
    return;
  }

  if (tutorial.phase === "tour") {
    const tourStep = currentTutorialTourStep();
    if (!tourStep) return;
    const finalTourStep = tutorial.tourStep === TUTORIAL_TOUR_STEPS.length - 1;
    ui.tutorialCoach.hidden = false;
    ui.tutorialProgress.textContent =
      `Tour ${tutorial.tourStep + 1} of ${TUTORIAL_TOUR_STEPS.length}`;
    ui.tutorialConcept.textContent = tourStep.concept;
    ui.tutorialCoachTitle.textContent = tourStep.title;
    ui.tutorialCoachText.textContent = tourStep.text;
    ui.tutorialObjective.textContent = tourStep.objective;
    ui.tutorialActionButton.hidden = false;
    ui.tutorialActionButton.textContent = finalTourStep ? "Begin Lesson 1" : "Next";
    window.requestAnimationFrame(() => {
      applyTutorialHighlights();
      positionTutorialCoach();
    });
    return;
  }

  const lesson = currentTutorialLesson();
  if (!lesson) return;
  const selected = selectedTutorialTemplates();
  const validFormation = isTutorialSelectionValid();
  const prefixFormation = isTutorialSelectionPrefix();
  const finalLesson = tutorial.lessonIndex === TUTORIAL_LESSONS.length - 1;

  ui.tutorialCoach.hidden = false;
  ui.tutorialProgress.textContent = `Lesson ${tutorial.lessonIndex + 1} of ${TUTORIAL_LESSONS.length}`;
  ui.tutorialConcept.textContent = lesson.concept;
  ui.tutorialActionButton.hidden = false;

  if (tutorial.phase === "intro") {
    const introPages = currentTutorialIntroPages();
    const introPage = currentTutorialIntroPage();
    const finalIntroPage = tutorial.introStep === introPages.length - 1;
    if (introPages.length > 1) {
      ui.tutorialProgress.textContent =
        `Lesson ${tutorial.lessonIndex + 1}/${TUTORIAL_LESSONS.length} · Step ${tutorial.introStep + 1}/${introPages.length}`;
    }
    ui.tutorialCoachTitle.textContent = introPage.title;
    renderTutorialVisual(introPage.visual);
    ui.tutorialCoachText.textContent = introPage.text;
    ui.tutorialObjective.textContent = introPage.objective;
    ui.tutorialActionButton.textContent = finalIntroPage ? "Start Lesson" : "Next";
  } else if (tutorial.phase === "play") {
    ui.tutorialActionButton.hidden = true;
    if (validFormation) {
      ui.tutorialCoachTitle.textContent = "Formation ready";
      ui.tutorialCoachText.textContent =
        lesson.readyText
        || "The highlighted forecast shows the bonuses currently included in each lane total.";
      ui.tutorialObjective.textContent =
        lesson.readyObjective
        || "Review the preview, then press the highlighted Commit button.";
    } else if (selected.length && !prefixFormation) {
      ui.tutorialCoachTitle.textContent = "Try a different order";
      ui.tutorialCoachText.textContent =
        `Required order: ${lesson.expected.map((art) => CARD_LIBRARY.find((card) => card.art === art)?.name).join(" → ")}.`;
      ui.tutorialObjective.textContent =
        "Click a placed card to return it to your hand, then follow the highlighted card.";
    } else {
      const placementGuidance = lesson.placementGuidance?.[selected.length];
      ui.tutorialCoachTitle.textContent = placementGuidance?.title || lesson.title;
      ui.tutorialCoachText.textContent = placementGuidance?.text || lesson.intro;
      const nextArt = lesson.expected[selected.length];
      const nextCard = CARD_LIBRARY.find((card) => card.art === nextArt);
      ui.tutorialObjective.textContent = placementGuidance?.objective || (nextCard
        ? `Place ${nextCard.name} into Lane ${selected.length + 1}.`
        : lesson.objective);
    }
  } else if (tutorial.phase === "claim") {
    ui.tutorialCoachTitle.textContent = "Choose a winning trophy";
    ui.tutorialCoachText.textContent = lesson.aftermath;
    ui.tutorialObjective.textContent =
      "Choose Ember, Tide, or Gust below. In a real match, choose an element you still need.";
    ui.tutorialActionButton.hidden = true;
  } else if (tutorial.phase === "aftermath") {
    ui.tutorialCoachTitle.textContent = "Lesson complete";
    ui.tutorialCoachText.textContent = lesson.aftermath;
    ui.tutorialObjective.textContent =
      "Study the totals on the cards, then continue when you are ready.";
    ui.tutorialActionButton.textContent = "Next Lesson";
  } else {
    ui.tutorialCoachTitle.textContent = "Training complete";
    ui.tutorialCoachText.textContent =
      `${lesson.aftermath} In a real duel, collect two Ember, two Gust, and two Tide trophies before Professor Paws.`;
    ui.tutorialObjective.textContent =
      "Trophies leave circulation. Other committed cards enter the discard pile, and that pile reshuffles when the draw pile empties.";
    ui.tutorialActionButton.textContent = finalLesson ? "Finish Training" : "Continue";
  }

  window.requestAnimationFrame(() => {
    applyTutorialHighlights();
    positionTutorialCoach();
  });
}

function configureGameMenu() {
  ui.gameMenuTitle.textContent = tutorial.active ? "Training is paused" : "The duel is paused";
  ui.gameMenuNote.textContent = tutorial.active
    ? "Resume this lesson, restart the complete tutorial, adjust settings, or return to the main menu."
    : "Restarting, changing difficulty, or returning to the main menu will end this duel.";
  ui.resumeGameButton.textContent = tutorial.active ? "Resume Training" : "Resume Duel";
  ui.restartGameButton.textContent = tutorial.active ? "Restart Tutorial" : "Restart Duel";
  ui.changeDifficultyButton.hidden = tutorial.active;
}

function stopTutorialMode() {
  if (tutorial.active) tutorial.runId += 1;
  tutorial.active = false;
  tutorial.phase = "idle";
  tutorialCoachDrag.anchorKey = null;
  tutorialCoachDrag.manual = false;
  ui.tutorialCoach.hidden = true;
  ui.tutorialCoach.classList.remove("is-anchored", "is-dragging");
  ui.tutorialCoach.removeAttribute("data-anchor-side");
  document.body.classList.remove("tutorial-active");
  clearTutorialHighlights();
  configureGameMenu();
}

function startTutorialTour() {
  if (!tutorial.active) return;
  const previewLesson = TUTORIAL_LESSONS[0];
  clearCinematicRemains();
  clearTrophyClaim();
  tutorial.lessonIndex = 0;
  tutorial.tourStep = 0;
  tutorial.phase = "tour";
  state.round = 1;
  state.locked = true;
  state.dealing = false;
  state.selectedCardIds = [];
  state.deck = [];
  state.discardPile = [];
  state.playerHand = previewLesson.playerCards.map((art, cardIndex) =>
    createTutorialCard(art, "tour-player", cardIndex));
  state.aiHand = previewLesson.aiCards.map((art, cardIndex) =>
    createTutorialCard(art, "tour-ai", cardIndex));
  state.aiPlan = [...state.aiHand];
  state.aiTellClues = state.aiPlan.map(() => "full");
  setRoundAdvanceControls(false);
  ui.menuButton.disabled = false;
  ui.clashEffects.innerHTML = "";
  ui.battlefield.classList.remove("is-clashing");
  ui.aiPlayZone.innerHTML = tutorialOpponentLaneGuideMarkup();
  ui.versusBadge.textContent = "VS";
  ui.versusBadge.className = "versus-badge";
  setMessage("Training Grounds Tour", "Learn where the game keeps its most important information.");
  renderOpponentTells();
  renderHand();
  renderFormationBuilder();
  ui.matchupForecast.style.gridTemplateColumns = "";
  ui.matchupForecast.innerHTML = `
    <span class="forecast-instruction">
      Place a card during a lesson to preview its bonuses and expected lane total here.
    </span>
  `;
  renderRound();
  renderRoundScore();
  renderTutorialCoach();
}

function advanceTutorialTour() {
  if (!tutorial.active || tutorial.phase !== "tour") return;
  if (tutorial.tourStep >= TUTORIAL_TOUR_STEPS.length - 1) {
    loadTutorialLesson(0);
    return;
  }
  tutorial.tourStep += 1;
  const tourStep = currentTutorialTourStep();
  setMessage(tourStep.title, tourStep.objective);
  renderTutorialCoach();
}

function loadTutorialLesson(index) {
  const lesson = TUTORIAL_LESSONS[index];
  if (!tutorial.active || !lesson) return;

  clearCinematicRemains();
  clearTrophyClaim();
  tutorial.lessonIndex = index;
  tutorial.introStep = 0;
  tutorial.phase = "intro";
  state.round = index + 1;
  state.locked = true;
  state.dealing = false;
  state.selectedCardIds = [];
  state.deck = [];
  state.discardPile = [];
  state.playerHand = lesson.playerCards.map((art, cardIndex) =>
    createTutorialCard(art, "player", cardIndex));
  state.aiHand = lesson.aiCards.map((art, cardIndex) =>
    createTutorialCard(art, "ai", cardIndex));
  state.aiPlan = [...state.aiHand];
  state.aiTellClues = state.aiPlan.map(() => "full");
  setRoundAdvanceControls(false);
  ui.menuButton.disabled = false;
  ui.clashEffects.innerHTML = "";
  ui.battlefield.classList.remove("is-clashing");
  ui.playerPlayZone.innerHTML = placeholder("Lesson formation");
  ui.aiPlayZone.innerHTML = placeholder("Training plan sealed");
  ui.versusBadge.textContent = "VS";
  ui.versusBadge.className = "versus-badge";
  setMessage(lesson.title, "Read your coach’s instructions, then begin the lesson.");
  renderOpponentTells();
  renderHand();
  renderRound();
  renderRoundScore();
  renderTutorialCoach();
}

function beginTutorialLesson() {
  if (!tutorial.active || tutorial.phase !== "intro") return;
  tutorial.phase = "play";
  state.locked = false;
  const lesson = currentTutorialLesson();
  setMessage(lesson.title, lesson.objective);
  renderHand();
  renderTutorialCoach();
}

function advanceTutorialIntro() {
  if (!tutorial.active || tutorial.phase !== "intro") return;
  const introPages = currentTutorialIntroPages();
  if (tutorial.introStep >= introPages.length - 1) {
    beginTutorialLesson();
    return;
  }
  tutorial.introStep += 1;
  const introPage = currentTutorialIntroPage();
  setMessage(introPage.title, introPage.objective);
  renderTutorialCoach();
}

function finishTutorialLesson() {
  state.locked = true;
  ui.menuButton.disabled = false;
  ui.selectionCount.hidden = true;
  ui.playSelectedButton.hidden = true;
  ui.nextRoundButton.hidden = true;
  ui.nextRoundButton.disabled = true;
  tutorial.phase = tutorial.lessonIndex === TUTORIAL_LESSONS.length - 1
    ? "complete"
    : "aftermath";
  renderTutorialCoach();
}

function completeTutorialTrophyClaim(reward) {
  if (!tutorial.active || tutorial.phase !== "claim" || !reward?.card) return;
  state.playerWins.push(reward.card);
  clearTrophyClaim();
  renderCollection(ui.playerCollection, state.playerWins);
  setMessage(
    `${reward.card.name} becomes your training trophy!`,
    "A normal duel asks you to collect two trophies from each element.",
  );
  finishTutorialLesson();
}

function resolveTutorialRound(playerCards, aiCards, resolution) {
  const lesson = currentTutorialLesson();
  const { results, score, winner, decidedBy } = resolution;
  ui.versusBadge.textContent = `${score.player}–${score.ai}`;
  ui.versusBadge.className = "versus-badge";

  if (winner === "player") {
    state.playerRoundWins += 1;
    ui.versusBadge.classList.add("win");
    audio.roundResult("win");
  } else if (winner === "ai") {
    state.aiRoundWins += 1;
    ui.versusBadge.classList.add("lose");
    audio.roundResult("loss");
  } else {
    audio.roundResult("draw");
  }

  const resultLabel = decidedBy === "pressure"
    ? `Pressure breaks the ${score.player}–${score.ai} tie!`
    : winner === "player"
      ? `You win ${score.player} of ${results.length} clashes!`
      : winner === "ai"
        ? `Professor Paws wins ${score.ai} of ${results.length} clashes.`
        : "The lesson ends in a draw.";
  setMessage(resultLabel, lesson.aftermath);
  renderAftermathBreakdown(playerCards, resolution);
  restoreCinematicAftermathRemains(playerCards, aiCards, resolution);
  renderRoundScore();

  const rewardOptions = getFormationRewardOptions(playerCards, aiCards, resolution);
  if (lesson.trophyChoice && rewardOptions.length > 1) {
    showTrophyClaim(rewardOptions, playerCards, aiCards, resolution);
    tutorial.phase = "claim";
    ui.menuButton.disabled = false;
    renderTutorialCoach();
    return;
  }

  if (lesson.pressureTrophy && rewardOptions[0]?.card) {
    state.playerWins.push(rewardOptions[0].card);
    renderCollection(ui.playerCollection, state.playerWins);
  }
  finishTutorialLesson();
}

async function startTutorial() {
  tutorial.runId += 1;
  tutorial.active = true;
  tutorial.lessonIndex = 0;
  tutorial.tourStep = 0;
  tutorial.introStep = 0;
  tutorial.phase = "opening";
  state.difficulty = "guided";
  state.playerWins = [];
  state.aiWins = [];
  state.playerRoundWins = 0;
  state.aiRoundWins = 0;
  state.pendingMatchWinner = null;
  state.pendingTrophyClaim = null;
  state.locked = true;
  state.dealing = true;

  audio.startDuelMusic();
  clearCinematicRemains();
  closeDialog(ui.gameMenuDialog);
  closeDialog(ui.difficultyDialog);
  closeDialog(ui.resultDialog);
  ui.mainMenuScreen.hidden = true;
  document.body.classList.remove("main-menu-active");
  document.body.classList.add("tutorial-active");
  setGameMenuVisibility(true);
  configureGameMenu();
  ui.menuButton.disabled = true;
  ui.tutorialCoach.style.removeProperty("left");
  ui.tutorialCoach.style.removeProperty("top");
  ui.tutorialCoach.style.removeProperty("right");
  ui.tutorialCoach.style.removeProperty("bottom");
  tutorialCoachDrag.anchorKey = null;
  tutorialCoachDrag.manual = false;
  ui.tutorialCoach.classList.remove("is-anchored", "is-dragging");
  ui.tutorialCoach.removeAttribute("data-anchor-side");
  ui.tutorialCoach.hidden = true;
  renderCollection(ui.playerCollection, []);
  renderCollection(ui.aiCollection, []);
  setMessage(
    "Entering the Training Grounds...",
    "Begin with a quick interface tour, then complete five scripted lessons.",
  );
  await playDeckTransition("opening");
  state.dealing = false;
  startTutorialTour();
}

function clampClashScorePosition(left, top) {
  const margin = 8;
  const panelRect = ui.clashScorePanel.getBoundingClientRect();
  return {
    left: Math.min(
      Math.max(margin, left),
      Math.max(margin, window.innerWidth - panelRect.width - margin),
    ),
    top: Math.min(
      Math.max(margin, top),
      Math.max(margin, window.innerHeight - panelRect.height - margin),
    ),
  };
}

function moveClashScorePanel(left, top) {
  const position = clampClashScorePosition(left, top);
  ui.clashScorePanel.style.left = `${position.left}px`;
  ui.clashScorePanel.style.top = `${position.top}px`;
  ui.clashScorePanel.style.right = "auto";
}

function stopClashScoreDrag(event) {
  if (event.pointerId !== clashScoreDrag.pointerId) return;
  if (ui.clashScoreDragHandle.hasPointerCapture(event.pointerId)) {
    ui.clashScoreDragHandle.releasePointerCapture(event.pointerId);
  }
  clashScoreDrag.pointerId = null;
  ui.clashScorePanel.classList.remove("is-dragging");
}

function clampTutorialCoachPosition(left, top) {
  const margin = 8;
  const panelRect = ui.tutorialCoach.getBoundingClientRect();
  return {
    left: Math.min(
      Math.max(margin, left),
      Math.max(margin, window.innerWidth - panelRect.width - margin),
    ),
    top: Math.min(
      Math.max(margin, top),
      Math.max(margin, window.innerHeight - panelRect.height - margin),
    ),
  };
}

function moveTutorialCoach(left, top) {
  const position = clampTutorialCoachPosition(left, top);
  ui.tutorialCoach.style.left = `${position.left}px`;
  ui.tutorialCoach.style.top = `${position.top}px`;
  ui.tutorialCoach.style.right = "auto";
  ui.tutorialCoach.style.bottom = "auto";
  return position;
}

function stopTutorialCoachDrag(event) {
  if (event.pointerId !== tutorialCoachDrag.pointerId) return;
  if (ui.tutorialCoachDragHandle.hasPointerCapture(event.pointerId)) {
    ui.tutorialCoachDragHandle.releasePointerCapture(event.pointerId);
  }
  tutorialCoachDrag.pointerId = null;
  ui.tutorialCoach.classList.remove("is-dragging");
}

function closeClashScoreGuide() {
  ui.clashScoreGuide.removeAttribute("open");
  window.requestAnimationFrame(() => {
    ui.clashScoreGuide.querySelector("summary").focus();
  });
}

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
  const formationBonus = focus
    ? `Focus +${focus}`
    : state.aiPlan.length === MAX_PLAY_SIZE
      ? `Overwhelm +${OVERWHELM_BONUS} against 1 card`
      : "No Focus";
  const difficultyLabel = DIFFICULTIES[state.difficulty]?.label || "Veiled";
  const concealsCommitment = state.difficulty === "instinct";
  ui.commitmentHint.textContent = concealsCommitment
    ? "Instinct · Commitment and formation bonus concealed"
    : `${difficultyLabel} · ${state.aiPlan.length} ${state.aiPlan.length === 1 ? "card" : "cards"} · ${formationBonus}`;
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
    const lockedMessage = tutorial.active && tutorial.phase === "intro"
      ? "Place a card after the lesson begins to reveal its active bonuses and expected lane total."
      : state.dealing
        ? "New cards are being dealt."
        : "Cards committed. Watch each lane.";
    ui.matchupForecast.innerHTML = `
      <span class="forecast-instruction forecast-locked">
        ${lockedMessage}
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
    const playerTactic = getTacticBonus(
      selectedCards,
      index,
      concealsCommitment ? MAX_PLAY_SIZE : state.aiPlan.length,
    );
    const playerOverwhelm = concealsCommitment
      ? 0
      : getOverwhelmBonus(selectedCards.length, state.aiPlan.length, index);
    const aiOverwhelm = concealsCommitment
      ? 0
      : getOverwhelmBonus(state.aiPlan.length, selectedCards.length, index);
    const knownPlayerScore = playerCard.power
      + playerFocus
      + playerTactic
      + playerOverwhelm;
    const knownBonusTotal = playerFocus + playerTactic + playerOverwhelm;
    const knownBonuses = [];
    if (playerFocus) knownBonuses.push(`Focus +${playerFocus}`);
    if (playerTactic) {
      knownBonuses.push(`${TACTICS[playerCard.tactic].label} +${playerTactic}`);
    }
    if (playerOverwhelm) knownBonuses.push(`Overwhelm +${playerOverwhelm}`);
    const knownBonusDetail = knownBonuses.length
      ? knownBonuses.join(" · ")
      : "No known bonus";

    if (concealsCommitment) {
      const couldOverwhelm = selectedCards.length === MAX_PLAY_SIZE && index === 0;
      const maximumHiddenBonus = knownBonusTotal
        + ELEMENT_EDGE_BONUS
        + (couldOverwhelm ? OVERWHELM_BONUS : 0);
      const hiddenWarning = selectedCards.length === 1 && index === 0
        ? `A 3-card foe may gain Overwhelm +${OVERWHELM_BONUS}`
        : couldOverwhelm
          ? `Overwhelm +${OVERWHELM_BONUS} activates if the foe commits 1`
          : "Foe presence and Element Edge hidden";
      return `
        <span class="forecast-chip forecast-sealed">
          <i>${index + 1}</i>
          <b>? POSSIBLE CLASH · ${knownPlayerScore}–${playerCard.power + maximumHiddenBonus}</b>
          <span class="forecast-equation">
            <em>${playerCard.power} BASE</em><span>+</span><strong>${knownBonusTotal}–${maximumHiddenBonus} IF IT CLASHES</strong>
          </span>
          <small>${knownBonusDetail} · ${hiddenWarning}</small>
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
    const opponentTactic = getTacticBonus(
      state.aiPlan,
      index,
      selectedCards.length,
    );
    const clue = state.aiTellClues[index] || "sealed";
    const scoring = scoreClash(
      playerCard,
      opponentCard,
      playerTactic,
      opponentTactic,
      playerFocus,
      opponentFocus,
      playerOverwhelm,
      aiOverwhelm,
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
      const totalBonus = getBonusBreakdown(scoring.player).total;
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
      + scoring.ai.tactic
      + scoring.ai.focus
      + scoring.ai.overwhelm;
    const opponentMax = tierMax
      + scoring.ai.edge
      + scoring.ai.tactic
      + scoring.ai.focus
      + scoring.ai.overwhelm;
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
  const tactic = TACTICS[card.tactic] || TACTICS.link;
  const isSelected = selectedIndex >= 0;
  const isFormationCard = displayMode === "formation";
  const isPlayedCard = displayMode === "played";
  const isPressureCard = displayMode === "pressure";
  const interactionLabel = isFormationCard
    ? `Remove ${card.name} from lane ${selectedIndex + 1}`
    : `Add ${card.name}, ${element.label}, power ${card.power}, ${tactic.label} Tactic to the next lane`;
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
      data-card-template="${card.art}"
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
        <small title="${tactic.description}">${element.label} · <svg class="tactic-icon" aria-hidden="true"><use href="#tactic-icon-${tactic.icon}"></use></svg> ${tactic.label}</small>
      </span>
      <span class="card-ability">
        <i aria-hidden="true" title="${tactic.description}"><svg class="tactic-icon"><use href="#tactic-icon-${tactic.icon}"></use></svg></i>
        <span><b>${card.move}</b><small>${card.lore}</small></span>
      </span>
      <span class="card-rarity">${card.rarity}</span>
    </button>
  `;
}

function placeholder(label) {
  return `<div class="card-placeholder"><span class="paw">◆</span><small>${label}</small></div>`;
}

function tutorialOpponentLaneGuideMarkup() {
  return `
    <div class="formation-builder tutorial-lane-guide" aria-label="Professor Paws’ formation lanes">
      ${Array.from({ length: MAX_PLAY_SIZE }, (_, index) => `
        <div class="formation-slot empty-slot">
          <span>LANE ${index + 1}</span>
          <b>SEALED</b>
          <small>FACES YOUR LANE ${index + 1}</small>
        </div>
      `).join("")}
    </div>
  `;
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
  if (tutorial.active) window.requestAnimationFrame(applyTutorialHighlights);
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
  const tactic = getTacticBonus(
    selectedCards,
    index,
    state.difficulty === "instinct" ? MAX_PLAY_SIZE : state.aiPlan.length,
  );
  const knownOverwhelm = state.difficulty === "instinct"
    ? 0
    : getOverwhelmBonus(selectedCards.length, state.aiPlan.length, index);
  const knownBonus = focus + tactic + knownOverwhelm;
  if (state.difficulty === "instinct") {
    const couldOverwhelm = selectedCards.length === MAX_PLAY_SIZE && index === 0;
    const maximumBonus = knownBonus
      + ELEMENT_EDGE_BONUS
      + (couldOverwhelm ? OVERWHELM_BONUS : 0);
    const overwhelmDetail = couldOverwhelm
      ? `; includes Overwhelm +${OVERWHELM_BONUS} if Professor Paws commits 1 card`
      : "";
    return {
      text: `+${knownBonus}–${maximumBonus}`,
      label: `If paired, bonus ranges from plus ${knownBonus} to plus ${maximumBonus}${overwhelmDetail}; opposing card presence and Element Edge are hidden`,
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
  const edge = edgeKnown
    && ELEMENTS[playerCard.element].beats === opponentCard.element
    ? ELEMENT_EDGE_BONUS
    : 0;
  const knownParts = [];
  if (focus) knownParts.push(`Focus +${focus}`);
  if (tactic) knownParts.push(`${TACTICS[playerCard.tactic].label} +${tactic}`);
  if (knownOverwhelm) knownParts.push(`Overwhelm +${knownOverwhelm}`);
  if (edge) knownParts.push(`Element Edge +${edge}`);

  if (!edgeKnown) {
    return {
      text: `+${knownBonus}–${knownBonus + ELEMENT_EDGE_BONUS}`,
      label: `Bonus ranges from plus ${knownBonus} to plus ${knownBonus + ELEMENT_EDGE_BONUS}; ${knownOverwhelm ? `includes Overwhelm +${knownOverwhelm}; ` : ""}Element Edge is hidden`,
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
  const playerOverwhelm = getOverwhelmBonus(count, state.aiPlan.length);
  const opponentOverwhelm = getOverwhelmBonus(state.aiPlan.length, count);
  const detail = count === 0
    ? "Drag a card into the glowing lane, or click a card to place it."
    : state.difficulty === "instinct"
      ? count === MAX_PLAY_SIZE
        ? `No Focus. Overwhelm +${OVERWHELM_BONUS} activates if Professor Paws committed 1 card; his commitment stays concealed.`
        : count === 1
          ? `${focusLabel}. Beware: a 3-card enemy formation gains Overwhelm +${OVERWHELM_BONUS}; his commitment stays concealed.`
          : `${focusLabel}. Professor Paws' commitment stays concealed until the reveal.`
    : playerOverwhelm
      ? `Overwhelm +${playerOverwhelm} strengthens Lane 1, and your extra cards create Pressure.`
      : opponentOverwhelm
        ? `Professor Paws gains Overwhelm +${opponentOverwhelm} in Lane 1. Your ${focusLabel} can still beat it.`
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
  const overwhelmActive = getOverwhelmBonus(count, state.aiPlan.length) > 0;
  const formationLabel = focus
    ? `Focus +${focus}`
    : count === MAX_PLAY_SIZE
      ? state.difficulty === "instinct"
        ? `Overwhelm +${OVERWHELM_BONUS} if the foe committed 1`
        : overwhelmActive
          ? `Overwhelm +${OVERWHELM_BONUS} active`
          : "No Focus"
      : "No Focus";
  ui.selectionCount.textContent = count
    ? `${count} of ${MAX_PLAY_SIZE} placed · ${formationLabel}`
    : `0 of ${MAX_PLAY_SIZE} placed`;
  const tutorialFormationReady = !tutorial.active || isTutorialSelectionValid();
  ui.playSelectedButton.disabled = state.locked || count === 0 || !tutorialFormationReady;
  ui.playSelectedButton.textContent = count === 1 ? "Commit 1 Card" : `Commit ${count} Cards`;
  renderMatchupForecast();
  if (tutorial.active) renderTutorialCoach();
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
  ui.roundLabel.textContent = tutorial.active && tutorial.phase === "tour"
    ? "INTERFACE TOUR"
    : tutorial.active
      ? `LESSON ${tutorial.lessonIndex + 1} / ${TUTORIAL_LESSONS.length}`
      : `ROUND ${state.round}`;
  if (tutorial.active) {
    ui.deckStatusText.innerHTML = tutorial.phase === "tour"
      ? "<strong>Training tour</strong> &middot; interface overview"
      : "<strong>Training deck</strong> &middot; scripted lesson";
    return;
  }
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
    `${tutorial.active ? "Training score" : "Round score"}: You ${state.playerRoundWins}, Professor Paws ${state.aiRoundWins}`,
  );
}

function setRoundAdvanceControls(visible, finalMatch = false) {
  ui.trophyClaim.hidden = true;
  ui.selectionCount.hidden = visible;
  ui.playSelectedButton.hidden = visible;
  ui.nextRoundButton.hidden = !visible;
  ui.nextRoundButton.disabled = !visible;
  ui.nextRoundButton.textContent = finalMatch ? "View Results" : "Next Round";
}

function clearTrophyClaim() {
  state.pendingTrophyClaim = null;
  ui.trophyClaim.hidden = true;
  ui.trophyClaimOptions.innerHTML = "";
  ui.playerPlayZone.querySelectorAll(".claimable-trophy").forEach((lane) => {
    lane.classList.remove("claimable-trophy");
  });
}

function showTrophyClaim(options, playerCards, aiCards, resolution) {
  state.pendingTrophyClaim = {
    options,
    playerCards,
    aiCards,
    resolution,
  };
  ui.selectionCount.hidden = true;
  ui.playSelectedButton.hidden = true;
  ui.nextRoundButton.hidden = true;
  ui.nextRoundButton.disabled = true;
  ui.trophyClaim.hidden = false;
  const trophyCounts = getElementTrophyCounts(state.playerWins);
  ui.trophyClaimOptions.innerHTML = options.map((option) => {
    const card = option.card;
    const element = ELEMENTS[card.element];
    const needed = trophyCounts[card.element] < TROPHIES_PER_ELEMENT;
    return `
      <button
        class="trophy-claim-option element-${card.element}"
        data-trophy-card="${card.instanceId}"
        type="button"
        aria-label="Claim ${card.name} from Lane ${option.lane + 1} as your trophy${needed ? "; this element is still needed" : "; this element is already complete"}"
      >
        <i aria-hidden="true">${element.icon}</i>
        <span><b>${card.name}</b><small>Lane ${option.lane + 1} · ${needed ? "NEEDED" : "EXTRA"}</small></span>
      </button>
    `;
  }).join("");
  options.forEach((option) => {
    ui.playerPlayZone
      .querySelector(`[data-clash-index="${option.lane}"]`)
      ?.classList.add("claimable-trophy");
  });
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
  if (scoring.tactic) {
    parts.push(`${scoring.tacticName || "Tactic"} +${scoring.tactic}`);
  }
  if (scoring.overwhelm) parts.push(`Overwhelm +${scoring.overwhelm}`);
  return {
    total: scoring.focus
      + scoring.edge
      + scoring.tactic
      + (scoring.overwhelm || 0),
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
  if (scoring.overwhelm) {
    let callout = lane.querySelector(".overwhelm-callout");
    if (!callout) {
      callout = document.createElement("span");
      callout.className = "overwhelm-callout";
      lane.append(callout);
    }
    callout.textContent = `OVERWHELM +${scoring.overwhelm}`;
    callout.setAttribute(
      "aria-label",
      `Overwhelm bonus plus ${scoring.overwhelm}`,
    );
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
  if (tutorial.active && !isTutorialSelectionValid()) {
    setMessage("That formation does not match the lesson.", "Follow the highlighted order, then commit again.");
    audio.denied();
    renderTutorialCoach();
    return;
  }

  const tutorialRunId = tutorial.active ? tutorial.runId : null;
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
  if (tutorial.active) {
    tutorial.phase = "clashing";
    renderTutorialCoach();
  }

  window.setTimeout(async () => {
    if (tutorialRunId !== null && (!tutorial.active || tutorial.runId !== tutorialRunId)) return;
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
    if (tutorialRunId !== null) {
      if (!tutorial.active || tutorial.runId !== tutorialRunId) return;
      resolveTutorialRound(playerCards, aiCards, resolution);
    } else {
      resolveRound(playerCards, aiCards, resolution);
    }
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

function completeRoundReward(
  reward,
  playerCards,
  aiCards,
  resolution,
  claimMessage = null,
) {
  clearTrophyClaim();
  if (reward?.winner === "player" && reward.card) {
    state.playerWins.push(reward.card);
  }
  if (reward?.winner === "ai" && reward.card) {
    state.aiWins.push(reward.card);
  }
  state.discardPile.push(
    ...playerCards.filter((card) => card !== reward?.card),
    ...aiCards.filter((card) => card !== reward?.card),
  );

  if (claimMessage && reward?.card) {
    setMessage(
      `${reward.card.name} becomes your trophy!`,
      claimMessage,
    );
  }
  renderCollection(ui.playerCollection, state.playerWins);
  renderCollection(ui.aiCollection, state.aiWins);
  renderRound();
  renderRoundScore();
  state.pendingMatchWinner = getCompletedMatchWinner(resolution.winner);
  setRoundAdvanceControls(true, Boolean(state.pendingMatchWinner));
  ui.menuButton.disabled = false;
}

function resolveRound(playerCards, aiCards, resolution = resolveClashes(playerCards, aiCards)) {
  const { results, score, winner, decidedBy } = resolution;
  const rewardOptions = getFormationRewardOptions(
    playerCards,
    aiCards,
    resolution,
  );
  let reward = null;
  let awaitsPlayerClaim = false;
  ui.versusBadge.className = "versus-badge";

  const clashWord = results.length === 1 ? "clash" : "clashes";
  ui.versusBadge.textContent = `${score.player}–${score.ai}`;

  if (winner === "player") {
    state.playerRoundWins += 1;
    if (decidedBy === "pressure") {
      reward = rewardOptions[0] || null;
      setMessage(
        `Your Pressure breaks the ${score.player}–${score.ai} tie!`,
        `${reward.card.name}, your first extra card, becomes the round trophy.`,
      );
    } else if (rewardOptions.length > 1) {
      awaitsPlayerClaim = true;
      setMessage(
        `You win ${score.player} of ${results.length} ${clashWord}!`,
        "Choose which lane-winning card becomes your trophy.",
      );
    } else {
      reward = rewardOptions[0] || null;
      setMessage(
        `You win ${score.player} of ${results.length} ${clashWord}!`,
        `Lane ${reward.lane + 1}'s ${reward.card.name} becomes your round trophy.`,
      );
    }
    ui.versusBadge.classList.add("win");
    audio.roundResult("win");
  } else if (winner === "ai") {
    state.aiRoundWins += 1;
    reward = decidedBy === "pressure"
      ? rewardOptions[0] || null
      : chooseTrophyReward(rewardOptions, state.aiWins);
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

  renderAftermathBreakdown(playerCards, resolution);
  restoreCinematicAftermathRemains(playerCards, aiCards, resolution);
  renderRoundScore();

  if (awaitsPlayerClaim) {
    showTrophyClaim(rewardOptions, playerCards, aiCards, resolution);
    ui.menuButton.disabled = false;
    return;
  }

  completeRoundReward(reward, playerCards, aiCards, resolution);
}

async function nextRound() {
  clearCinematicRemains();
  clearTrophyClaim();
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
  configureGameMenu();
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
  stopTutorialMode();
  audio.startMainMenuMusic();
  closeDialog(ui.gameMenuDialog);
  closeDialog(ui.difficultyDialog);
  closeDialog(ui.resultDialog);
  setGameMenuVisibility(false);
  ui.mainMenuScreen.hidden = false;
  document.body.classList.add("main-menu-active");
}

function showDifficultyChooser() {
  stopTutorialMode();
  state.locked = true;
  ui.mainMenuScreen.hidden = true;
  document.body.classList.remove("main-menu-active");
  closeDialog(ui.gameMenuDialog);
  setGameMenuVisibility(false);
  if (!ui.difficultyDialog.open) ui.difficultyDialog.showModal();
}

async function startGame() {
  stopTutorialMode();
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
  state.pendingTrophyClaim = null;
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
ui.clashScoreDragHandle.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || event.target.closest("button")) return;
  const panelRect = ui.clashScorePanel.getBoundingClientRect();
  clashScoreDrag.pointerId = event.pointerId;
  clashScoreDrag.offsetX = event.clientX - panelRect.left;
  clashScoreDrag.offsetY = event.clientY - panelRect.top;
  ui.clashScoreDragHandle.setPointerCapture(event.pointerId);
  ui.clashScorePanel.classList.add("is-dragging");
  event.preventDefault();
});
ui.clashScoreDragHandle.addEventListener("pointermove", (event) => {
  if (event.pointerId !== clashScoreDrag.pointerId) return;
  moveClashScorePanel(
    event.clientX - clashScoreDrag.offsetX,
    event.clientY - clashScoreDrag.offsetY,
  );
});
ui.clashScoreDragHandle.addEventListener("pointerup", stopClashScoreDrag);
ui.clashScoreDragHandle.addEventListener("pointercancel", stopClashScoreDrag);
ui.clashScoreDragHandle.addEventListener("lostpointercapture", () => {
  clashScoreDrag.pointerId = null;
  ui.clashScorePanel.classList.remove("is-dragging");
});
ui.clashScoreClose.addEventListener("pointerdown", (event) => {
  event.stopPropagation();
  closeClashScoreGuide();
});
ui.clashScoreClose.addEventListener("click", (event) => {
  event.stopPropagation();
  if (ui.clashScoreGuide.open) closeClashScoreGuide();
});
ui.tutorialCoachDragHandle.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  const panelRect = ui.tutorialCoach.getBoundingClientRect();
  tutorialCoachDrag.manual = true;
  tutorialCoachDrag.pointerId = event.pointerId;
  tutorialCoachDrag.offsetX = event.clientX - panelRect.left;
  tutorialCoachDrag.offsetY = event.clientY - panelRect.top;
  ui.tutorialCoach.classList.remove("is-anchored");
  ui.tutorialCoach.removeAttribute("data-anchor-side");
  ui.tutorialCoachDragHandle.setPointerCapture(event.pointerId);
  ui.tutorialCoach.classList.add("is-dragging");
  event.preventDefault();
});
ui.tutorialCoachDragHandle.addEventListener("pointermove", (event) => {
  if (event.pointerId !== tutorialCoachDrag.pointerId) return;
  moveTutorialCoach(
    event.clientX - tutorialCoachDrag.offsetX,
    event.clientY - tutorialCoachDrag.offsetY,
  );
});
ui.tutorialCoachDragHandle.addEventListener("pointerup", stopTutorialCoachDrag);
ui.tutorialCoachDragHandle.addEventListener("pointercancel", stopTutorialCoachDrag);
ui.tutorialCoachDragHandle.addEventListener("lostpointercapture", () => {
  tutorialCoachDrag.pointerId = null;
  ui.tutorialCoach.classList.remove("is-dragging");
});
window.addEventListener("resize", () => {
  if (ui.clashScoreGuide.open) {
    const panelRect = ui.clashScorePanel.getBoundingClientRect();
    moveClashScorePanel(panelRect.left, panelRect.top);
  }
  if (tutorial.active && !ui.tutorialCoach.hidden) {
    positionTutorialCoach();
  }
});
ui.playSelectedButton.addEventListener("click", playRound);
ui.trophyClaimOptions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-trophy-card]");
  const pending = state.pendingTrophyClaim;
  if (!button || !pending) return;
  const reward = pending.options.find(
    (option) => option.card.instanceId === button.dataset.trophyCard,
  );
  if (!reward) return;
  if (tutorial.active) {
    completeTutorialTrophyClaim(reward);
    return;
  }
  const { playerCards, aiCards, resolution } = pending;
  completeRoundReward(
    reward,
    playerCards,
    aiCards,
    resolution,
    `Claimed from Lane ${reward.lane + 1}. Review the clash, then continue when ready.`,
  );
});
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
ui.mainMenuTutorialButton.addEventListener("click", startTutorial);
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
  if (tutorial.active) {
    startTutorial();
  } else {
    startGame();
  }
});
ui.changeDifficultyButton.addEventListener("click", showDifficultyChooser);
ui.gameSettingsButton.addEventListener("click", () => openSettings("game"));
ui.returnMainMenuButton.addEventListener("click", showMainMenu);
ui.tutorialActionButton.addEventListener("click", () => {
  if (!tutorial.active) return;
  if (tutorial.phase === "tour") {
    advanceTutorialTour();
  } else if (tutorial.phase === "intro") {
    advanceTutorialIntro();
  } else if (tutorial.phase === "aftermath") {
    loadTutorialLesson(tutorial.lessonIndex + 1);
  } else if (tutorial.phase === "complete") {
    showMainMenu();
  }
});
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
