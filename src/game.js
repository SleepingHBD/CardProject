const {
  ELEMENTS,
  TACTICS,
  AI_MOTIVE_TRAITS,
  AI_FORMATION_TRAITS,
  AI_COMMITMENT_TRAITS,
  ELEMENT_EDGE_BONUS,
  buildTellClues,
  chooseAiCommitment,
  chooseAiCards,
  createAiTraits,
  getTacticBonus,
  getFormationRewardOptions,
  getPowerTier,
  getElementTrophyCounts,
  getTrophyProgress,
  hasCompletedElementSet,
  reshuffleDiscardPile,
  resolveClashes,
  scoreClash,
  chooseTrophyReward,
  LANE_WIN_POINTS,
  EXTRA_CARD_POINTS,
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
  ["ember", 4, "Flaskfoot Felix", "Final Formula", "One last drop. What could go wrong?", "common", "finisher", "flaskfoot-felix"],
  ["ember", 5, "Beacon Burmilla", "Cresset Charge", "Where the beacon leads, brave paws follow.", "uncommon", "vanguard", "beacon-burmilla"],
  ["gust", 8, "Gale Groomer", "Captain's Roar", "Every breeze follows orders.", "epic", "link", "gale-groomer"],
  ["gust", 6, "Leafy Loaf", "Nap Cyclone", "Rest is a tactical maneuver.", "rare", "finisher", "leafy-loaf"],
  ["gust", 5, "Whisker Whirl", "Ribbon Twister", "Forecast: fabulous.", "uncommon", "link", "whisker-whirl"],
  ["gust", 9, "Sir Squall", "Galeguard Charge", "Even the wind rallies behind his shield.", "legendary", "vanguard", "sir-squall"],
  ["gust", 4, "Kitewhisker", "Banner Breeze", "Every gust deserves a flag.", "common", "vanguard", "kitewhisker"],
  ["gust", 3, "Dandelion Dash", "Seed Stampede", "All speed. Some direction.", "common", "finisher", "dandelion-dash"],
  ["gust", 4, "Windlass Whiskers", "Pulley Puff", "If it has a rope, he can move it.", "common", "link", "windlass-whiskers"],
  ["gust", 5, "Belfry Bobtail", "Last Toll", "The final bell is always the loudest.", "uncommon", "finisher", "belfry-bobtail"],
  ["tide", 8, "Puddle Pouncer", "Splash Ambush", "Dry socks are overrated.", "epic", "vanguard", "puddle-pouncer"],
  ["tide", 6, "Bubble Bengal", "Pearl Pop", "Elegance with every ripple.", "rare", "link", "bubble-bengal"],
  ["tide", 5, "Moonpool Mouser", "Lunar Ripple", "The moon whispers. She listens.", "uncommon", "link", "moonpool-mouser"],
  ["tide", 9, "Empress Ebb", "Leviathan's Decree", "Even the moon waits for her command.", "legendary", "finisher", "empress-ebb"],
  ["tide", 4, "Wellwater Wisp", "Bucket Splash", "One pail. Zero dry paws.", "common", "vanguard", "wellwater-wisp"],
  ["tide", 3, "Mizzle Motley", "Ripple Rattle", "Three bells. No dry seats.", "common", "finisher", "mizzle-motley"],
  ["tide", 4, "Rivertow Ragdoll", "Crosscurrent Tow", "No paw gets left on the wrong bank.", "common", "link", "rivertow-ragdoll"],
  ["tide", 5, "Moatgate Mau", "Floodgate First", "First paw on the lever. Last one to flinch.", "uncommon", "vanguard", "moatgate-mau"],
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
const DECK_COPIES_BY_RARITY = Object.freeze({
  common: 2,
  uncommon: 2,
  rare: 1,
  epic: 1,
  legendary: 1,
});
const DIFFICULTIES = {
  guided: { label: "Guided" },
  instinct: { label: "Instinct" },
  blind: { label: "Blind" },
};
const concealsOpponentFormation = (difficulty = state.difficulty) =>
  difficulty === "instinct" || difficulty === "blind";
const usesPersistentAiHabits = (difficulty = state.difficulty) =>
  difficulty === "instinct" || difficulty === "blind";
const ELEMENT_SORT_ORDER = { ember: 0, gust: 1, tide: 2 };
const RARITY_SORT_ORDER = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
const ARCHIVE_SORT_SUMMARIES = {
  element: "Ember, Gust, then Tide; Common through Legendary within each element.",
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
const TUTORIAL_MODES = Object.freeze(["complete", "tour", "lesson"]);
const TUTORIAL_SECTION_NAMES = Object.freeze([
  "Element Edge",
  "Formation Roles",
  "Round Points",
  "Round Points",
  "Round Points",
  "Trophies & Card Flow",
  "Instinct Practice",
]);
const TUTORIAL_TOUR_STEPS = Object.freeze([
  Object.freeze({
    id: "trophy-progress",
    concept: "Training Grounds Tour",
    title: "Know the match goal",
    text:
      "The elemental crests beneath each duelist icon track the trophies they have collected from winning rounds.",
    objective:
      "Win the match by collecting two Ember, two Gust, and two Tide trophies before Professor Paws.",
    targets: Object.freeze(["#playerCollection", "#aiCollection"]),
    anchor: "#playerCollection",
    preferredSide: "left",
  }),
  Object.freeze({
    id: "round-score",
    concept: "Training Grounds Tour",
    title: "Track round wins",
    text:
      "This display records how many rounds you and Professor Paws have won during the current duel.",
    objective:
      "Rounds Won shows duel performance, but it does not complete the match. Only the six required trophies do.",
    targets: Object.freeze(["#roundScore"]),
    anchor: "#roundScore",
    preferredSide: "bottom",
  }),
  Object.freeze({
    id: "plan",
    concept: "Training Grounds Tour",
    title: "Read Professor Paws",
    text:
      "This panel gives you the rival information allowed by your difficulty. Guided shows live plan clues, Instinct shows his habits, and Blind conceals both.",
    objective:
      "Use Guided's current clues, Instinct's visible habits, or Blind's Previous Rounds History while his current plan remains hidden.",
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
      "When your card faces one of Professor Paws’ cards in the same lane, compare their Clash Totals. Winning that lane earns 2 Round Points. A card with no opposing card earns 1 Round Point instead.",
    targets: Object.freeze(["#aiPlayZone", "#playerPlayZone"]),
    anchor: "#playerPlayZone",
    preferredSide: "right",
  }),
  Object.freeze({
    id: "hand",
    concept: "Training Grounds Tour",
    title: "Choose from your hand",
    text:
      "These are the cards currently available to you. Every card has an element, printed Power, and a Formation Role.",
    objective:
      "During a scenario, drag a card toward the board or click it to place it in the next lane.",
    targets: Object.freeze(["#playerHand"]),
    anchor: "#playerHand",
    preferredSide: "top",
  }),
  Object.freeze({
    id: "lanes",
    concept: "Training Grounds Tour",
    title: "Build your formation",
    text:
      "Your chosen cards enter Lane 1, Lane 2, and Lane 3 in the order you place them. In every mode, you may stop after one, two, or three cards.",
    objective:
      "Order matters because Vanguard, Link, and Finisher Role bonuses activate under different conditions.",
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
    id: "history",
    concept: "Training Grounds Tour",
    title: "Review completed rounds",
    text:
      "Previous Rounds History records both revealed formations, every lane result, Round Points, trophy progress, and the claimed trophy after each round.",
    objective:
      "It is available in every difficulty. In Blind, compare several completed rounds to identify Professor Paws' hidden habits yourself.",
    targets: Object.freeze(["#previousRoundsHistoryButton"]),
    anchor: "#previousRoundsHistoryButton",
    preferredSide: "top",
  }),
  Object.freeze({
    id: "references",
    concept: "Training Grounds Tour",
    title: "Help stays within reach",
    text:
      "The top bar opens the card archive, Duel Codex, Rulebook, and Menu. Previous Rounds History stays beside the draw pile.",
    objective:
      "Use the Duel Codex for quick scoring reminders, the Rulebook for full explanations, and Previous Rounds History to review completed plays.",
    targets: Object.freeze(["#howButton", "#previousRoundsHistoryButton", ".top-actions"]),
    anchor: ".top-actions",
    preferredSide: "bottom",
  }),
]);
const TUTORIAL_LESSON_LIBRARY = Object.freeze([
  Object.freeze({
    id: "element-edge",
    concept: "Elements",
    title: "Use Element Edge",
    intro:
      "Professor Paws committed Gust. Teapot Tabby’s Ember element beats it and earns Element Edge +2.",
    objective:
      "Commit Teapot Tabby. Ember beats Gust, so the card earns Element Edge +2.",
    introPages: Object.freeze([
      Object.freeze({
        title: "Element Edge follows the cycle",
        text:
          "Ember beats Gust, Gust beats Tide, and Tide beats Ember. A card that beats the opposing element earns Element Edge +2 when it faces a card in the same lane.",
        objective:
          "Element Edge strengthens the card’s total, but it does not guarantee victory. Printed Power and every other active bonus still matter.",
        visual: "element-cycle",
        targets: Object.freeze([]),
        unanchored: true,
      }),
      Object.freeze({
        title: "Find the +2 in the preview",
        text:
          "Professor Paws committed Gust. After you place the Ember card Teapot Tabby, its bonus badge and forecast will include Element Edge +2.",
        objective:
          "Start the scenario, place Teapot Tabby in Lane 1, and review its complete total before committing.",
        targets: Object.freeze(["#matchupForecast"]),
        anchor: "#matchupForecast",
        preferredSide: "left",
      }),
    ]),
    readyText:
      "Teapot Tabby’s preview includes Element Edge +2. No Role bonus is active in this lane.",
    readyObjective:
      "Compare Power 3 + Element Edge 2 = Clash Total 5, then press the highlighted Commit button.",
    playerCards: Object.freeze(["teapot-tabby", "kitewhisker", "wellwater-wisp"]),
    aiCards: Object.freeze(["dandelion-dash"]),
    expected: Object.freeze(["teapot-tabby"]),
    aftermath:
      "Teapot Tabby’s Power 3 gained Element Edge +2 for a Clash Total of 5. No Role bonus was involved. Winning that lane supplied the round’s 2 Round Points and an Ember trophy.",
  }),
  Object.freeze({
    id: "commitment-one-vs-two",
    concept: "Round Points · Scenario 1 of 3",
    title: "One card against two",
    intro:
      "When your card faces one of Professor Paws’ cards in the same lane, winning that lane earns 2 Round Points. Any card with no opponent in its lane earns 1 Round Point. In this scenario, your one card faces the first of the professor’s two cards.",
    objective:
      "Play Sir Squall. His lane victory will earn 2 Round Points against the professor's 1 Round Point from his extra card.",
    playerCards: Object.freeze(["sir-squall", "moonpool-mouser", "comet-claw"]),
    aiCards: Object.freeze(["empress-ebb", "bubble-bengal"]),
    expected: Object.freeze(["sir-squall"]),
    aftermath:
      "Sir Squall won Lane 1 for 2 Round Points. Professor Paws' extra card added 1 Round Point, so your one-card formation won the round 2–1.",
  }),
  Object.freeze({
    id: "commitment-one-vs-three",
    concept: "Round Points · Scenario 2 of 3",
    title: "Know when one card is not enough",
    intro:
      "One card can defeat two by winning the lane where both sides played a card: 2 Round Points beat the extra card's 1 Round Point. Against three cards, one lane victory meets 2 Round Points from two extra cards and the round draws.",
    objective:
      "Play Sir Squall again. Watch the Round Points become tied 2–2 against three cards.",
    playerCards: Object.freeze(["sir-squall", "bubble-bengal", "moonpool-mouser"]),
    aiCards: Object.freeze(["empress-ebb", "bubble-bengal", "moonpool-mouser"]),
    expected: Object.freeze(["sir-squall"]),
    aftermath:
      "Sir Squall still won Lane 1 for 2 Round Points, but Professor Paws' two extra cards supplied 2 Round Points. Round Points were tied 2–2, producing a draw and no trophy.",
  }),
  Object.freeze({
    id: "tactics",
    concept: "Formation Roles",
    title: "Build a three-role formation",
    intro:
      "Vanguard earns +1 in Lane 1. Link earns +1 in Lane 2 or 3 when the card directly before the Link has a different element from the Link card. To gain Finisher +1, commit the Finisher as the final card in a two- or three-card formation. The bonus activates only if Professor Paws also committed a card to the Finisher's lane.",
    objective:
      "Order Candle Pounce, Bubble Bengal, then Dandelion Dash to activate all three Formation Role bonuses.",
    introPages: Object.freeze([
      Object.freeze({
        title: "Vanguard: commit it in Lane 1",
        text:
          "A Vanguard card gets Vanguard +1 only when it is committed in Lane 1. If you commit that Vanguard in Lane 2 or Lane 3, it still battles normally but receives no Vanguard bonus.",
        objective:
          "Look for the shield symbol. A Vanguard may be committed in any lane, but it earns Vanguard +1 only in Lane 1.",
        targets: Object.freeze(["#playerHand", "#playerPlayZone"]),
        anchor: "#playerPlayZone",
        preferredSide: "right",
      }),
      Object.freeze({
        title: "Link: check the card directly before it",
        text:
          "A Link card can earn Link +1 in Lane 2 or Lane 3. It gains +1 only when the card committed directly before the Link has a different element from the Link card itself.",
        objective:
          "For example, a Tide Link committed after an Ember card earns +1; a Tide Link committed after another Tide card earns no bonus.",
        targets: Object.freeze(["#playerHand", "#playerPlayZone"]),
        anchor: "#playerPlayZone",
        preferredSide: "right",
      }),
      Object.freeze({
        title: "Finisher: commit it last and face a card",
        text:
          "To gain Finisher +1, commit the Finisher as the final card in a two- or three-card formation. The bonus activates only if Professor Paws also committed a card to the Finisher's lane.",
        objective:
          "With two cards, the Finisher belongs in Lane 2. With three cards, it belongs in Lane 3. A lone Finisher or a Finisher with no opposing card earns no bonus.",
        targets: Object.freeze(["#playerHand", "#playerPlayZone"]),
        anchor: "#playerPlayZone",
        preferredSide: "right",
      }),
      Object.freeze({
        title: "Placement decides whether Role +1 activates",
        text:
          "A Formation Role never prevents you from committing a card. It only decides whether that card earns Role +1. If its exact condition is not met, the card keeps its printed Power and other bonuses but receives no Role bonus.",
        objective:
          "During this scenario, the formation preview will show exactly which cards receive Role +1 before you commit.",
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
          "Bubble Bengal is a Tide Link. Candle Pounce was committed directly before her. The card before the Link is Ember, which differs from Bubble Bengal’s Tide element, so Link +1 will activate.",
        objective:
          "Place Bubble Bengal in Lane 2. Because the card directly before the Link has a different element from her Tide element, she receives Link +1.",
      }),
      Object.freeze({
        title: "Close with Finisher",
        text:
          "Dandelion Dash is a Finisher. You will commit him last in a three-card formation, and Professor Paws committed a card to his lane, so Finisher +1 will activate.",
        objective:
          "Place Dandelion Dash in Lane 3. Because he is your final card and Professor Paws committed a card to that lane, he receives Finisher +1.",
      }),
    ]),
    readyText:
      "The preview shows why each bonus activated: Vanguard +1 for Lane 1, Link +1 because the card before the Link has a different element from the Link card, and Finisher +1 because Dandelion Dash is your final card and Professor Paws committed a card to his lane.",
    readyObjective:
      "Confirm all three Role +1 bonuses in the forecast, then commit the formation.",
    playerCards: Object.freeze(["candle-pounce", "bubble-bengal", "dandelion-dash"]),
    aiCards: Object.freeze(["teapot-tabby", "moonpool-mouser", "wellwater-wisp"]),
    expected: Object.freeze(["candle-pounce", "bubble-bengal", "dandelion-dash"]),
    aftermath:
      "Candle Pounce gained Vanguard +1 for being in Lane 1. Bubble Bengal gained Link +1 because the card before the Link had a different element from her Tide element. Dandelion Dash gained Finisher +1 because he was last in a three-card formation and Professor Paws committed a card to his lane. Changing their order could disable these bonuses.",
    trophyChoice: true,
  }),
  Object.freeze({
    id: "extra-card-points",
    concept: "Round Points · Scenario 3 of 3",
    title: "Break a tied round",
    intro:
      "Every extra card with no opposing card adds 1 Round Point. It does not change any card's Clash Total.",
    objective:
      "Order Comet Claw first and Bubble Bengal second. The two Comet Claws will draw; Bubble Bengal will provide the winning Round Point as an extra card.",
    playerCards: Object.freeze(["comet-claw", "bubble-bengal", "cinder-kit"]),
    aiCards: Object.freeze(["comet-claw"]),
    expected: Object.freeze(["comet-claw", "bubble-bengal"]),
    aftermath:
      "The Comet Claws faced each other in Lane 1 and drew for 0 Round Points. Bubble Bengal had no opposing card, added 1 Round Point, and became the automatic trophy from your 1–0 Round Points win.",
    extraCardTrophy: true,
  }),
  Object.freeze({
    id: "trophies-card-flow",
    concept: "Trophies & Card Flow",
    title: "Claim a trophy and follow the cards",
    intro:
      "Winning a round earns one trophy. When several lane-winning cards qualify, you choose which one leaves circulation as your trophy.",
    objective:
      "Commit Candle Pounce, then Bubble Bengal. Both will win their lanes, so you must choose one as your trophy.",
    introPages: Object.freeze([
      Object.freeze({
        title: "A round awards one trophy",
        text:
          "Win a round and one qualifying card becomes a trophy. If several of your cards won contested lanes, you choose one. If extra cards decide the round, your first extra card becomes the trophy automatically. A drawn round awards no trophy.",
        objective:
          "Watch the elemental crests: the chosen trophy moves there and counts toward the match goal.",
        targets: Object.freeze(["#playerCollection", "#aiCollection"]),
        anchor: "#playerCollection",
        preferredSide: "left",
      }),
      Object.freeze({
        title: "The other cards return later",
        text:
          "The trophy leaves circulation. Every other committed card enters the discard pile. Hands refill from the draw pile, and the discard pile reshuffles when the draw pile runs out.",
        objective:
          "This cycle rewards planning: a claimed card is secured, while discarded cards may return in a later hand.",
        targets: Object.freeze(["#deckStatusText", "#playerHand"]),
        anchor: "#deckStatusText",
        preferredSide: "top",
      }),
    ]),
    readyText:
      "Candle Pounce and Bubble Bengal are both projected to win their lanes, giving you two possible trophy choices.",
    readyObjective:
      "Commit the formation, then choose which lane-winning card becomes your one trophy.",
    playerCards: Object.freeze(["candle-pounce", "bubble-bengal", "cinder-kit"]),
    aiCards: Object.freeze(["teapot-tabby", "wellwater-wisp"]),
    expected: Object.freeze(["candle-pounce", "bubble-bengal"]),
    aftermath:
      "Candle Pounce won Lane 1 and Bubble Bengal won Lane 2. The round still awarded only one trophy: the card you selected. The other committed cards entered the training discard pile.",
  }),
  Object.freeze({
    id: "instinct-practice",
    concept: "Instinct Practice",
    title: "Read habits without seeing the plan",
    intro:
      "Instinct hides Professor Paws’ cards and formation size. His three known habits are useful clues, but they describe tendencies rather than promises.",
    objective:
      "Use the three visible habits to build any two- or three-card formation you believe can handle his likely plan.",
    introPages: Object.freeze([
      Object.freeze({
        title: "Habits replace exact tells",
        text:
          "In Instinct, Professor Paws’ card details and commitment count stay sealed. You always see one motive habit, one formation habit, and one commitment habit.",
        objective:
          "Read all three together. Each habit answers a different question: what he favors, how he orders it, and how many cards he tends to commit.",
        targets: Object.freeze(["#opponentHabits"]),
        anchor: "#opponentHabits",
        preferredSide: "left",
      }),
      Object.freeze({
        title: "Turn clues into a prediction",
        text:
          "Power Seeker favors high-Power cards. Strong Opener places his highest-Power card in Lane 1. Full Formation usually commits three cards.",
        objective:
          "Expect a strong three-card formation with its biggest threat first—but remember that habits never reveal the elements.",
        targets: Object.freeze(["#opponentHabits", "#playerHand"]),
        anchor: "#opponentHabits",
        preferredSide: "left",
      }),
    ]),
    readyText:
      "Your formation is valid. Before committing, compare its Roles and elements with the habits you were given.",
    readyObjective:
      "Commit when your two- or three-card answer feels ready. This scenario does not reveal a prescribed solution.",
    playerCards: Object.freeze([
      "candle-pounce",
      "bubble-bengal",
      "dandelion-dash",
      "comet-claw",
      "sir-squall",
      "moonpool-mouser",
    ]),
    aiCards: Object.freeze(["sir-squall", "empress-ebb", "comet-claw"]),
    expected: Object.freeze([]),
    freeChoice: true,
    minCards: 2,
    maxCards: 3,
    difficulty: "instinct",
    aiTraits: Object.freeze([
      AI_MOTIVE_TRAITS.find((trait) => trait.id === "power-seeker"),
      AI_FORMATION_TRAITS.find((trait) => trait.id === "strong-opener"),
      AI_COMMITMENT_TRAITS.find((trait) => trait.id === "full-formation"),
    ]),
    aftermath:
      "Full Formation correctly warned you to expect three cards. Power Seeker and Strong Opener suggested a high-Power card in Lane 1, but they did not reveal any elements. That uncertainty is the heart of Instinct: habits guide a prediction without guaranteeing the result.",
  }),
]);
const TUTORIAL_LESSONS = Object.freeze([
  TUTORIAL_LESSON_LIBRARY[0],
  TUTORIAL_LESSON_LIBRARY[3],
  TUTORIAL_LESSON_LIBRARY[1],
  TUTORIAL_LESSON_LIBRARY[2],
  TUTORIAL_LESSON_LIBRARY[4],
  TUTORIAL_LESSON_LIBRARY[5],
  TUTORIAL_LESSON_LIBRARY[6],
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
  previousRoundsHistory: [],
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
  mode: "complete",
  entryLessonIndex: 0,
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
  tacticsTitle: document.querySelector("#tacticsTitle"),
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
  previousRoundsHistoryButton: document.querySelector("#previousRoundsHistoryButton"),
  previousRoundsHistoryCount: document.querySelector("#previousRoundsHistoryCount"),
  previousRoundsHistoryDialog: document.querySelector("#previousRoundsHistoryDialog"),
  previousRoundsHistoryList: document.querySelector("#previousRoundsHistoryList"),
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
  difficultyBackButton: document.querySelector("#difficultyBackButton"),
  tutorialMenuDialog: document.querySelector("#tutorialMenuDialog"),
  tutorialMenuOptions: document.querySelector("#tutorialMenuOptions"),
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
  tutorialBackButton: document.querySelector("#tutorialBackButton"),
  tutorialActionButton: document.querySelector("#tutorialActionButton"),
  tutorialCompletionActions: document.querySelector("#tutorialCompletionActions"),
  tutorialRetryButton: document.querySelector("#tutorialRetryButton"),
  tutorialMenuButton: document.querySelector("#tutorialMenuButton"),
  tutorialMainMenuButton: document.querySelector("#tutorialMainMenuButton"),
};
let draggedCardId = null;
let settingsReturnTarget = "main";
let difficultyReturnTarget = "main";
let difficultyPreviousLockedState = true;
const tutorialCoachDrag = {
  pointerId: null,
  offsetX: 0,
  offsetY: 0,
  anchorKey: null,
  manual: false,
};

function focusTutorialHeading() {
  window.requestAnimationFrame(() => {
    if (!ui.tutorialCoach.hidden) {
      ui.tutorialCoachTitle.focus({ preventScroll: true });
    }
  });
}

function getPlayerFormationLimit() {
  if (tutorial.active && tutorial.phase !== "tour") {
    const lesson = currentTutorialLesson();
    return lesson?.freeChoice
      ? lesson.maxCards || MAX_PLAY_SIZE
      : lesson?.expected.length || MAX_PLAY_SIZE;
  }
  return Math.min(MAX_PLAY_SIZE, state.playerHand.length);
}

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

function currentTutorialSectionName() {
  if (tutorial.mode === "tour") return "Training Grounds Tour";
  return TUTORIAL_SECTION_NAMES[tutorial.lessonIndex] || "Tutorial Section";
}

function tutorialSectionScenarioIndexes(lessonIndex = tutorial.lessonIndex) {
  const sectionName = TUTORIAL_SECTION_NAMES[lessonIndex];
  if (!sectionName) return [];
  return TUTORIAL_SECTION_NAMES.reduce((indexes, name, index) => {
    if (name === sectionName) indexes.push(index);
    return indexes;
  }, []);
}

function tutorialContinuesCurrentSection() {
  const indexes = tutorialSectionScenarioIndexes();
  return indexes.indexOf(tutorial.lessonIndex) < indexes.length - 1;
}

function adjacentTutorialLessonIndex(direction) {
  if (tutorial.mode !== "lesson") {
    return tutorial.lessonIndex + direction;
  }
  const indexes = tutorialSectionScenarioIndexes();
  const position = indexes.indexOf(tutorial.lessonIndex);
  return indexes[position + direction];
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
  if (!lesson) return false;
  if (lesson.freeChoice) {
    return selected.length >= (lesson.minCards || 1)
      && selected.length <= (lesson.maxCards || MAX_PLAY_SIZE);
  }
  return selected.length === lesson.expected.length
    && selected.every((art, index) => art === lesson.expected[index]);
}

function isTutorialSelectionPrefix() {
  if (!tutorial.active || tutorial.phase !== "play") return false;
  const lesson = currentTutorialLesson();
  const selected = selectedTutorialTemplates();
  if (!lesson) return false;
  if (lesson.freeChoice) {
    return selected.length <= (lesson.maxCards || MAX_PLAY_SIZE);
  }
  return selected.length <= lesson.expected.length
    && selected.every((art, index) => art === lesson.expected[index]);
}

function clearTutorialHighlights() {
  document.querySelectorAll(".tutorial-highlight-target").forEach((element) => {
    element.classList.remove("tutorial-highlight-target");
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
        element.classList.add("tutorial-highlight-target");
      });
    });
    return;
  }

  if (tutorial.phase === "intro") {
    currentTutorialIntroPage()?.targets.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        element.classList.add("tutorial-highlight-target");
      });
    });
    return;
  }

  if (tutorial.phase === "play") {
    if (isTutorialSelectionValid()) {
      ui.playSelectedButton.classList.add("tutorial-highlight-target");
      ui.matchupForecast.classList.add("tutorial-highlight-target");
      return;
    }

    const lesson = currentTutorialLesson();
    const selected = selectedTutorialTemplates();
    if (lesson?.freeChoice) {
      ui.playerHand.classList.add("tutorial-highlight-target");
      ui.playerPlayZone
        .querySelector(".formation-slot.next-slot")
        ?.classList.add("tutorial-highlight-target");
      return;
    }
    const prefixLength = isTutorialSelectionPrefix() ? selected.length : 0;
    const nextArt = lesson?.expected[prefixLength];
    const recommendedCard = nextArt
      ? ui.playerHand.querySelector(`[data-card-template="${nextArt}"]`)
      : null;
    recommendedCard?.classList.add("tutorial-recommended-card");
    ui.playerPlayZone
      .querySelector(".formation-slot.next-slot")
      ?.classList.add("tutorial-highlight-target");
    return;
  }

  if (tutorial.phase === "claim") {
    ui.trophyClaim.classList.add("tutorial-highlight-target");
    return;
  }

  if (tutorial.phase === "aftermath" || tutorial.phase === "complete") {
    ui.playerPlayZone.classList.add("tutorial-highlight-target");
    ui.playerCollection.classList.add("tutorial-highlight-target");
  }
}

function getTutorialCoachAnchorContext() {
  if (!tutorial.active) return null;

  if (tutorial.phase === "section-complete") {
    return {
      element: null,
      key: `section-complete:${tutorial.mode}:${tutorial.entryLessonIndex}`,
      unanchored: true,
    };
  }

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
    if (lesson.freeChoice) {
      return {
        element: ui.opponentHabits,
        key: `lesson:${lesson.id}:free-choice:${selected.length}`,
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
      aria-label="Element Edge cycle: Ember beats Gust, Gust beats Tide, and Tide beats Ember. A card whose element beats its opponent adds Element Edge plus two to that card's Clash Total."
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

  ui.tutorialCompletionActions.hidden = true;

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
    ui.tutorialObjective.textContent = finalTourStep && tutorial.mode === "tour"
      ? "Use these references whenever you need them, then finish the tour when you are ready."
      : tourStep.objective;
    ui.tutorialBackButton.hidden =
      tutorial.tourStep === 0 && tutorial.mode === "complete";
    ui.tutorialBackButton.disabled = false;
    ui.tutorialActionButton.hidden = false;
    ui.tutorialActionButton.textContent = finalTourStep
      ? tutorial.mode === "tour"
        ? "Finish Tour"
        : "Begin Element Edge"
      : "Next";
    window.requestAnimationFrame(() => {
      applyTutorialHighlights();
      positionTutorialCoach();
    });
    return;
  }

  if (tutorial.phase === "section-complete") {
    const sectionName = currentTutorialSectionName();
    ui.tutorialCoach.hidden = false;
    ui.tutorialProgress.textContent = "SECTION COMPLETE";
    ui.tutorialConcept.textContent = "Practice complete";
    ui.tutorialCoachTitle.textContent = `${sectionName} complete`;
    ui.tutorialCoachText.textContent =
      `You completed the ${sectionName} section without needing to replay the full training path.`;
    ui.tutorialObjective.textContent =
      "Retry this section for more practice, choose another section, or return to the main menu.";
    ui.tutorialBackButton.hidden = true;
    ui.tutorialActionButton.hidden = true;
    ui.tutorialCompletionActions.hidden = false;
    ui.tutorialRetryButton.textContent =
      tutorial.mode === "tour" ? "Retry Tour" : "Retry Section";
    clearTutorialHighlights();
    window.requestAnimationFrame(positionTutorialCoach);
    return;
  }

  const lesson = currentTutorialLesson();
  if (!lesson) return;
  const selected = selectedTutorialTemplates();
  const validFormation = isTutorialSelectionValid();
  const prefixFormation = isTutorialSelectionPrefix();
  const finalLesson = tutorial.lessonIndex === TUTORIAL_LESSONS.length - 1;

  ui.tutorialCoach.hidden = false;
  ui.tutorialProgress.textContent = tutorial.mode === "lesson"
    ? "SECTION PRACTICE"
    : `Lesson ${tutorial.lessonIndex + 1} of ${TUTORIAL_LESSONS.length}`;
  ui.tutorialConcept.textContent = lesson.concept;
  ui.tutorialBackButton.hidden = true;
  ui.tutorialBackButton.disabled = false;
  ui.tutorialActionButton.hidden = false;

  if (tutorial.phase === "intro") {
    const introPages = currentTutorialIntroPages();
    const introPage = currentTutorialIntroPage();
    const finalIntroPage = tutorial.introStep === introPages.length - 1;
    if (introPages.length > 1) {
      ui.tutorialProgress.textContent = tutorial.mode === "lesson"
        ? `Step ${tutorial.introStep + 1} of ${introPages.length}`
        : `Lesson ${tutorial.lessonIndex + 1}/${TUTORIAL_LESSONS.length} · Step ${tutorial.introStep + 1}/${introPages.length}`;
    }
    ui.tutorialCoachTitle.textContent = introPage.title;
    renderTutorialVisual(introPage.visual);
    ui.tutorialCoachText.textContent = introPage.text;
    ui.tutorialObjective.textContent = introPage.objective;
    ui.tutorialBackButton.hidden = false;
    ui.tutorialActionButton.textContent = finalIntroPage ? "Start Scenario" : "Next";
  } else if (tutorial.phase === "play") {
    ui.tutorialActionButton.hidden = true;
    ui.tutorialBackButton.hidden = false;
    if (validFormation) {
      ui.tutorialCoachTitle.textContent = "Formation ready";
      ui.tutorialCoachText.textContent =
        lesson.readyText
        || "The highlighted forecast shows the bonuses currently included in each lane total.";
      ui.tutorialObjective.textContent =
        lesson.readyObjective
        || "Review the preview, then press the highlighted Commit button.";
    } else if (lesson.freeChoice) {
      ui.tutorialCoachTitle.textContent = lesson.title;
      ui.tutorialCoachText.textContent = lesson.intro;
      ui.tutorialObjective.textContent =
        `Choose ${lesson.minCards || 1} or ${lesson.maxCards || MAX_PLAY_SIZE} cards in any order. Read all three habits before you commit.`;
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
    ui.tutorialCoachText.textContent =
      "You won the round with more than one eligible lane-winning card. A round awards exactly one trophy.";
    ui.tutorialObjective.textContent =
      "Choose one of the highlighted lane-winning cards below. In a real match, prefer an element you still need.";
    ui.tutorialActionButton.hidden = true;
  } else if (tutorial.phase === "aftermath") {
    ui.tutorialCoachTitle.textContent = "Scenario complete";
    ui.tutorialCoachText.textContent = lesson.aftermath;
    ui.tutorialObjective.textContent =
      "Study the totals on the cards, then continue when you are ready.";
    ui.tutorialActionButton.textContent = tutorial.mode === "lesson"
      ? tutorialContinuesCurrentSection()
        ? "Next Scenario"
        : "Finish Section"
      : finalLesson
        ? "Review Training"
        : "Next Scenario";
  } else {
    ui.tutorialCoachTitle.textContent = "Training complete";
    ui.tutorialCoachText.textContent =
      "You toured the interface, practised Element Edge and Roles, scored different formation sizes, claimed trophies, followed card flow, and made an independent Instinct read.";
    ui.tutorialObjective.textContent =
      "In a real duel, collect two Ember, two Gust, and two Tide trophies before Professor Paws.";
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
    ? tutorial.mode === "complete"
      ? "Resume this scenario, restart the complete training path, adjust settings, or return to the main menu."
      : "Resume this section, restart it from the beginning, adjust settings, or return to the main menu."
    : "Restarting, changing difficulty, or returning to the main menu will end this duel.";
  ui.resumeGameButton.textContent = tutorial.active ? "Resume Training" : "Resume Duel";
  ui.restartGameButton.textContent = tutorial.active
    ? tutorial.mode === "complete" ? "Restart Tutorial" : "Restart Section"
    : "Restart Duel";
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

function startTutorialTour(initialStep = 0) {
  if (!tutorial.active) return;
  const previewLesson = TUTORIAL_LESSONS[0];
  clearCinematicRemains();
  clearTrophyClaim();
  tutorial.lessonIndex = 0;
  tutorial.tourStep = Math.min(
    Math.max(0, initialStep),
    TUTORIAL_TOUR_STEPS.length - 1,
  );
  tutorial.phase = "tour";
  state.round = 1;
  state.locked = true;
  state.dealing = false;
  state.selectedCardIds = [];
  state.deck = [];
  state.difficulty = "guided";
  state.aiTraits = [];
  state.playerHand = previewLesson.playerCards.map((art, cardIndex) =>
    createTutorialCard(art, "tour-player", cardIndex));
  state.aiHand = previewLesson.aiCards.map((art, cardIndex) =>
    createTutorialCard(art, "tour-ai", cardIndex));
  state.aiPlan = [...state.aiHand];
  state.aiTellClues = buildTellClues(state.aiPlan.length, state.difficulty);
  setRoundAdvanceControls(false);
  ui.menuButton.disabled = false;
  ui.clashEffects.innerHTML = "";
  ui.battlefield.classList.remove("is-clashing");
  ui.aiPlayZone.innerHTML = tutorialOpponentLaneGuideMarkup();
  ui.versusBadge.textContent = "VS";
  ui.versusBadge.className = "versus-badge";
  const tourStep = currentTutorialTourStep();
  setMessage(tourStep.title, tourStep.objective);
  renderOpponentTells();
  renderFormationControls();
  renderHand();
  renderFormationBuilder();
  ui.matchupForecast.style.gridTemplateColumns = "";
  ui.matchupForecast.innerHTML = `
    <span class="forecast-instruction">
      Place a card during a scenario to preview its bonuses and expected lane total here.
    </span>
  `;
  renderRound();
  renderRoundScore();
  renderTutorialCoach();
  focusTutorialHeading();
}

function advanceTutorialTour() {
  if (!tutorial.active || tutorial.phase !== "tour") return;
  if (tutorial.tourStep >= TUTORIAL_TOUR_STEPS.length - 1) {
    if (tutorial.mode === "tour") {
      state.locked = true;
      tutorial.phase = "section-complete";
      renderTutorialCoach();
      focusTutorialHeading();
      return;
    }
    loadTutorialLesson(0);
    return;
  }
  tutorial.tourStep += 1;
  const tourStep = currentTutorialTourStep();
  setMessage(tourStep.title, tourStep.objective);
  renderTutorialCoach();
  focusTutorialHeading();
}

function loadTutorialLesson(index) {
  const lesson = TUTORIAL_LESSONS[index];
  if (!tutorial.active || !lesson) return;

  clearCinematicRemains();
  clearTrophyClaim();
  tutorial.lessonIndex = index;
  tutorial.introStep = 0;
  tutorial.phase = "intro";
  const sectionLessonIndexes = tutorialSectionScenarioIndexes(index);
  state.round = tutorial.mode === "lesson"
    ? sectionLessonIndexes.indexOf(index) + 1
    : index + 1;
  state.locked = true;
  state.dealing = false;
  state.selectedCardIds = [];
  state.difficulty = lesson.difficulty || "guided";
  state.aiTraits = lesson.aiTraits ? [...lesson.aiTraits] : [];
  state.playerHand = lesson.playerCards.map((art, cardIndex) =>
    createTutorialCard(art, "player", cardIndex));
  state.aiHand = lesson.aiCards.map((art, cardIndex) =>
    createTutorialCard(art, "ai", cardIndex));
  state.aiPlan = [...state.aiHand];
  state.aiTellClues = buildTellClues(state.aiPlan.length, state.difficulty);
  setRoundAdvanceControls(false);
  ui.menuButton.disabled = false;
  ui.clashEffects.innerHTML = "";
  ui.battlefield.classList.remove("is-clashing");
  ui.aiPlayZone.innerHTML = tutorialOpponentLaneGuideMarkup(state.aiPlan.length);
  ui.versusBadge.textContent = "VS";
  ui.versusBadge.className = "versus-badge";
  setMessage(lesson.title, "Read your coach’s instructions, then begin the scenario.");
  renderOpponentTells();
  renderFormationControls();
  renderHand();
  renderFormationBuilder();
  renderRound();
  renderRoundScore();
  renderTutorialCoach();
  focusTutorialHeading();
}

function beginTutorialLesson() {
  if (!tutorial.active || tutorial.phase !== "intro") return;
  const lesson = currentTutorialLesson();
  state.selectedCardIds = [];
  state.locked = false;
  tutorial.phase = "play";
  renderFormationControls();
  renderOpponentTells();
  renderHand();
  renderFormationBuilder();
  setMessage(
    lesson.title,
    lesson.freeChoice
      ? `Build any ${lesson.minCards || 1}- or ${lesson.maxCards || MAX_PLAY_SIZE}-card formation using Professor Paws’ habits as clues.`
      : `Build the scripted ${lesson.expected.length}-card formation shown by your coach.`,
  );
  renderTutorialCoach();
  focusTutorialHeading();
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
  focusTutorialHeading();
}

function retreatTutorialInstruction() {
  if (!tutorial.active) return;

  if (tutorial.phase === "tour") {
    if (tutorial.tourStep > 0) {
      tutorial.tourStep -= 1;
      const tourStep = currentTutorialTourStep();
      setMessage(tourStep.title, tourStep.objective);
      renderTutorialCoach();
      focusTutorialHeading();
    } else if (tutorial.mode === "tour") {
      showTutorialMenu();
    }
    return;
  }

  if (tutorial.phase === "intro") {
    if (tutorial.introStep > 0) {
      tutorial.introStep -= 1;
      const introPage = currentTutorialIntroPage();
      setMessage(introPage.title, introPage.objective);
      renderTutorialCoach();
      focusTutorialHeading();
      return;
    }
    if (tutorial.mode === "lesson") {
      const previousLessonIndex = adjacentTutorialLessonIndex(-1);
      if (previousLessonIndex !== undefined) {
        loadTutorialLesson(previousLessonIndex);
      } else {
        showTutorialMenu();
      }
    } else if (tutorial.lessonIndex === 0) {
      startTutorialTour(TUTORIAL_TOUR_STEPS.length - 1);
    } else {
      loadTutorialLesson(tutorial.lessonIndex - 1);
    }
    return;
  }

  if (tutorial.phase === "play") {
    state.selectedCardIds = [];
    tutorial.phase = "intro";
    tutorial.introStep = currentTutorialIntroPages().length - 1;
    state.locked = true;
    const introPage = currentTutorialIntroPage();
    setMessage(introPage.title, introPage.objective);
    renderFormationControls();
    renderHand();
    renderFormationBuilder();
    renderTutorialCoach();
    focusTutorialHeading();
  }
}

function finishTutorialLesson() {
  state.locked = true;
  ui.menuButton.disabled = false;
  ui.selectionCount.hidden = true;
  ui.playSelectedButton.hidden = true;
  ui.nextRoundButton.hidden = true;
  ui.nextRoundButton.disabled = true;
  tutorial.phase = "aftermath";
  renderTutorialCoach();
  focusTutorialHeading();
}

function recordTutorialRoundReward(reward, playerCards, aiCards, resolution) {
  recordCompletedRound(reward, playerCards, aiCards, resolution);
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
  renderCollection(ui.playerCollection, state.playerWins);
  renderCollection(ui.aiCollection, state.aiWins);
  renderRound();
}

function completeTutorialTrophyClaim(reward) {
  if (!tutorial.active || tutorial.phase !== "claim" || !reward?.card) return;
  const pending = state.pendingTrophyClaim;
  if (!pending) return;
  clearTrophyClaim();
  recordTutorialRoundReward(
    reward,
    pending.playerCards,
    pending.aiCards,
    pending.resolution,
  );
  setMessage(
    `${reward.card.name} becomes your training trophy!`,
    "A normal duel asks you to collect two trophies from each element.",
  );
  finishTutorialLesson();
}

function resolveTutorialRound(playerCards, aiCards, resolution) {
  const lesson = currentTutorialLesson();
  const { score, winner, decidedBy, extraCardPoints } = resolution;
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

  const resultLabel = winner === "player"
    ? decidedBy === "extra-cards"
      ? `Your ${extraCardPoints.player === 1 ? "extra card wins" : "extra cards win"} the round, ${score.player}–${score.ai} Round Points!`
      : `You win with ${score.player}–${score.ai} Round Points!`
    : winner === "ai"
      ? decidedBy === "extra-cards"
        ? `Professor Paws' ${extraCardPoints.ai === 1 ? "extra card wins" : "extra cards win"} ${score.ai}–${score.player}.`
        : `Professor Paws wins with ${score.ai}–${score.player} Round Points.`
      : `Round Points are tied ${score.player}–${score.ai}.`;
  setMessage(resultLabel, lesson.aftermath);
  renderAftermathBreakdown(playerCards, resolution);
  restoreCinematicAftermathRemains(playerCards, aiCards, resolution);
  renderRoundScore();

  const rewardOptions = getFormationRewardOptions(playerCards, aiCards, resolution);
  if (winner === "player" && rewardOptions.length > 1 && !rewardOptions[0].fixed) {
    showTrophyClaim(rewardOptions, playerCards, aiCards, resolution);
    tutorial.phase = "claim";
    ui.menuButton.disabled = false;
    renderTutorialCoach();
    return;
  }

  const reward = winner === "ai"
    ? chooseTrophyReward(rewardOptions, state.aiWins)
    : rewardOptions[0] || null;
  recordTutorialRoundReward(reward, playerCards, aiCards, resolution);
  finishTutorialLesson();
}

async function startTutorial(mode = "complete", lessonIndex = 0) {
  const selectedMode = TUTORIAL_MODES.includes(mode) ? mode : "complete";
  const selectedLessonIndex = Math.min(
    Math.max(0, Number(lessonIndex) || 0),
    TUTORIAL_LESSONS.length - 1,
  );
  const runId = tutorial.runId + 1;
  tutorial.runId = runId;
  tutorial.active = true;
  tutorial.mode = selectedMode;
  tutorial.entryLessonIndex = selectedMode === "lesson" ? selectedLessonIndex : 0;
  tutorial.lessonIndex = tutorial.entryLessonIndex;
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
  state.deck = [];
  state.discardPile = [];
  state.previousRoundsHistory = [];
  state.aiTraits = [];
  state.locked = true;
  state.dealing = true;
  renderOpponentHabits();
  renderPreviousRoundsHistory();

  audio.startDuelMusic();
  clearCinematicRemains();
  closeDialog(ui.gameMenuDialog);
  closeDialog(ui.difficultyDialog);
  closeDialog(ui.tutorialMenuDialog);
  closeDialog(ui.resultDialog);
  closeDialog(ui.previousRoundsHistoryDialog);
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
  const sectionName = selectedMode === "tour"
    ? "Training Grounds Tour"
    : TUTORIAL_SECTION_NAMES[tutorial.entryLessonIndex];
  setMessage(
    "Entering the Training Grounds...",
    selectedMode === "complete"
      ? "Begin with an interface tour, then complete five sections across seven scenarios."
      : `Preparing the ${sectionName} section.`,
  );
  await playDeckTransition("opening");
  if (!tutorial.active || tutorial.runId !== runId) return;
  state.dealing = false;
  if (selectedMode === "lesson") {
    loadTutorialLesson(tutorial.entryLessonIndex);
  } else {
    startTutorialTour();
  }
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

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function freshDeck() {
  const deckStamp = Date.now();
  return shuffle(CARD_LIBRARY.flatMap((card) =>
    Array.from(
      { length: DECK_COPIES_BY_RARITY[card.rarity] || 1 },
      (_, copyIndex) => ({
        ...card,
        instanceId: `${card.id}-${copyIndex}-${deckStamp}`,
      }),
    )));
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
}

function renderOpponentHabits() {
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
}

function renderOpponentTells() {
  const difficultyLabel = DIFFICULTIES[state.difficulty]?.label || "Guided";
  const concealsCommitment = concealsOpponentFormation();
  ui.tacticsTitle.textContent = state.difficulty === "instinct"
    ? "Professor's Habits"
    : "Professor's Plan";
  renderOpponentHabits();

  if (concealsCommitment) {
    ui.commitmentHint.textContent = state.difficulty === "instinct"
      ? "Instinct · Formation size and cards concealed"
      : "Blind · Current formation and habits concealed";
    ui.opponentTells.innerHTML = "";
    ui.opponentTells.hidden = true;
    return;
  }

  const playerCardCount = state.selectedCardIds.length;
  const aiExtraCards = Math.max(0, state.aiPlan.length - playerCardCount);
  const playerExtraCards = Math.max(0, playerCardCount - state.aiPlan.length);
  const formationStatus = playerCardCount === 0
    ? "Build 1–3 cards"
    : aiExtraCards
      ? `${aiExtraCards} opposing extra ${aiExtraCards === 1 ? "card adds" : "cards add"} ${aiExtraCards} Round ${aiExtraCards === 1 ? "Point" : "Points"}`
      : playerExtraCards
        ? `Your ${playerExtraCards} extra ${playerExtraCards === 1 ? "card adds" : "cards add"} ${playerExtraCards} Round ${playerExtraCards === 1 ? "Point" : "Points"}`
        : "Equal formation size";
  ui.commitmentHint.textContent =
    `${difficultyLabel} · ${state.aiPlan.length} ${state.aiPlan.length === 1 ? "card" : "cards"} · ${formationStatus}`;
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
    const showsFullClue = clue === "full";
    const title = showsFullClue
      ? element.label
      : "Sealed card";
    const detail = showsFullClue
      ? `Power <em>${tier.range}</em>`
      : "No card clues";
    const accessibleClue = showsFullClue
      ? `${element.label}, power ${tier.range}`
      : "card details sealed";
    return `
      <div class="opponent-tell clue-${clue}${showsFullClue ? ` element-${card.element}` : ""}" aria-label="Lane ${lane}: ${accessibleClue}">
        <span class="tell-lane">LANE ${lane}</span>
        <span class="tell-element" aria-hidden="true">${showsFullClue ? element.icon : "?"}</span>
        <b>${title}</b>
        <small>${detail}</small>
      </div>
    `;
  }).join("");
}

function renderFormationControls() {
  if (state.dealing) {
    ui.opponentTells.hidden = true;
    ui.matchupForecast.hidden = true;
    ui.selectionCount.hidden = true;
    ui.playSelectedButton.hidden = true;
    return;
  }
  ui.opponentTells.hidden = concealsOpponentFormation();
  ui.matchupForecast.hidden = false;
  if (ui.nextRoundButton.hidden && ui.trophyClaim.hidden) {
    ui.selectionCount.hidden = false;
    ui.playSelectedButton.hidden = false;
  }
}

function beginFormationBuilding() {
  state.selectedCardIds = [];
  state.locked = false;
  renderOpponentTells();
  renderFormationControls();
  renderHand();
  renderFormationBuilder();
  const hidesFormation = concealsOpponentFormation();
  setMessage(
    state.difficulty === "instinct"
      ? "Read the habits. Build your formation."
      : state.difficulty === "blind"
        ? "Study Previous Rounds History. Build your formation."
        : "Study the plan. Build your formation.",
    hidesFormation
      ? state.difficulty === "blind"
        ? "Place one to three cards. His current formation and hidden habits are revealed only through completed rounds."
        : "Place one to three cards. Professor Paws' formation stays hidden until the clash."
      : "Place one to three cards in order, review the forecast, then commit when ready.",
  );
}

function getKnownPlayerTacticBonus(cards, index) {
  const card = cards[index];
  if (concealsOpponentFormation() && card?.tactic === "finisher") return 0;
  return getTacticBonus(
    cards,
    index,
    concealsOpponentFormation() ? MAX_PLAY_SIZE : state.aiPlan.length,
  );
}

function renderMatchupForecast() {
  if (state.locked) {
    ui.matchupForecast.style.gridTemplateColumns = "";
    const lockedMessage = tutorial.active && tutorial.phase === "intro"
      ? "Place a card after the scenario begins to reveal its active bonuses and expected lane total."
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
  const concealsCommitment = concealsOpponentFormation();
  ui.matchupForecast.style.gridTemplateColumns = `repeat(${selectedCards.length}, minmax(0, 1fr))`;

  ui.matchupForecast.innerHTML = selectedCards.map((playerCard, index) => {
    const opponentCard = state.aiPlan[index];
    const playerTactic = getKnownPlayerTacticBonus(selectedCards, index);
    const knownPlayerScore = playerCard.power
      + playerTactic;
    const knownBonusTotal = playerTactic;
    const knownBonuses = [];
    if (playerTactic) {
      knownBonuses.push(`${TACTICS[playerCard.tactic].label} +${playerTactic}`);
    }
    const knownBonusDetail = knownBonuses.length
      ? knownBonuses.join(" · ")
      : "No known bonus";

    if (concealsCommitment) {
      const roleWarning = playerCard.tactic !== "finisher"
        ? `${TACTICS[playerCard.tactic].label} is fully known`
        : selectedCards.length < 2
          ? "Finisher needs a two- or three-card formation"
          : index !== selectedCards.length - 1
            ? "Finisher is not your final card"
            : "Finisher +1 depends on a hidden opposing card";
      return `
        <span class="forecast-chip forecast-sealed">
          <i>${index + 1}</i>
          <b>YOUR KNOWN TOTAL · ${knownPlayerScore}</b>
          <span class="forecast-equation">
            <em>${playerCard.power} BASE</em><span>+</span><strong>${knownBonusTotal} KNOWN ROLE</strong><span>=</span><strong>${knownPlayerScore}</strong>
          </span>
          <small>${knownBonusDetail} · ${roleWarning} · Opposing card and Element Edge revealed at clash</small>
        </span>
      `;
    }

    if (!opponentCard) {
      return `
        <span class="forecast-chip forecast-extra-card">
          <i>${index + 1}</i>
          <b>◆ EXTRA CARD +${EXTRA_CARD_POINTS}</b>
          <span class="forecast-equation"><strong>+${EXTRA_CARD_POINTS} ROUND POINT</strong></span>
          <small>No opposing card; adds 1 Round Point instead of clashing</small>
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

    const [tierMin, tierMax] = getPowerTier(opponentCard.power).range
      .split("-")
      .map(Number);
    const opponentMin = tierMin
      + scoring.ai.edge
      + scoring.ai.tactic;
    const opponentMax = tierMax
      + scoring.ai.edge
      + scoring.ai.tactic;
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
  const summary = `
    <span class="forecast-chip round-points-summary">
      <b>ROUND POINTS · ${resolution.score.player}–${resolution.score.ai}</b>
      <span class="forecast-equation">
        <em>${resolution.laneWins.player} LANE ${resolution.laneWins.player === 1 ? "WIN" : "WINS"} × ${LANE_WIN_POINTS}</em>
        <span>+</span>
        <strong>${resolution.extraCardPoints.player} FROM EXTRA ${resolution.extraCardPoints.player === 1 ? "CARD" : "CARDS"}</strong>
      </span>
      <small>Professor: ${resolution.laneWins.ai} won ${resolution.laneWins.ai === 1 ? "lane" : "lanes"} × ${LANE_WIN_POINTS} + ${resolution.extraCardPoints.ai} from extra ${resolution.extraCardPoints.ai === 1 ? "card" : "cards"}</small>
    </span>
  `;
  const laneBreakdown = resolution.lanes.map((lane, index) => {
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
  ui.matchupForecast.innerHTML = summary + laneBreakdown;
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
  const isExtraCard = displayMode === "extra-card";
  const interactionLabel = isFormationCard
    ? `Remove ${card.name} from lane ${selectedIndex + 1}`
    : `Add ${card.name}, ${element.label}, power ${card.power}, ${tactic.label} Formation Role to the next lane`;
  const formationBonusBadge = isFormationCard && formationBonus
    ? `
      <span class="card-bonus-badge preview-badge${formationBonus.extraCard ? " extra-card-badge" : ""}" aria-label="${formationBonus.label}">
        <small>${formationBonus.extraCard ? "EXTRA" : "BONUS"}</small>
        <b>${formationBonus.text}</b>
      </span>
    `
    : "";
  const resolvedBonusBadge = isPlayedCard || isExtraCard
    ? `
      <span class="card-bonus-badge${isExtraCard ? " extra-card-badge" : ""}" aria-label="${isExtraCard ? `Extra card with no opposing card; adds ${EXTRA_CARD_POINTS} Round Point` : "Bonus not yet resolved"}">
        <small>${isExtraCard ? "EXTRA" : "BONUS"}</small>
        <b>${isExtraCard ? `+${EXTRA_CARD_POINTS}` : "+?"}</b>
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

function tutorialOpponentLaneGuideMarkup(commitmentCount = MAX_PLAY_SIZE) {
  return `
    <div class="formation-builder tutorial-lane-guide" aria-label="Professor Paws’ formation lanes">
      ${Array.from({ length: MAX_PLAY_SIZE }, (_, index) => {
        const isCommitted = index < commitmentCount;
        return `
          <div
            class="formation-slot empty-slot${isCommitted ? "" : " waiting-slot"}"
            aria-label="Professor Paws lane ${index + 1}, ${isCommitted ? "committed card sealed" : "no card committed"}"
          >
            <span>LANE ${index + 1}</span>
            <b>${isCommitted ? "SEALED" : "EMPTY"}</b>
            <small>${isCommitted ? `FACES YOUR LANE ${index + 1}` : "NO CARD COMMITTED"}</small>
          </div>
        `;
      }).join("")}
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
  const tactic = getKnownPlayerTacticBonus(selectedCards, index);
  const knownBonus = tactic;
  if (concealsOpponentFormation()) {
    const finisherUnknown = playerCard.tactic === "finisher"
      && selectedCards.length > 1
      && index === selectedCards.length - 1;
    const roleDetail = playerCard.tactic !== "finisher"
      ? `${TACTICS[playerCard.tactic].label} is fully known`
      : selectedCards.length < 2
        ? "Finisher needs a two- or three-card formation"
        : index !== selectedCards.length - 1
          ? "Finisher is not your final card"
          : "Finisher depends on a hidden opposing card";
    return {
      text: `+${knownBonus}`,
      label: finisherUnknown
        ? `Known bonus plus ${knownBonus}; Finisher and Element Edge are revealed at clash`
        : `Known bonus plus ${knownBonus}; ${roleDetail}; Element Edge is revealed at clash`,
      extraCard: false,
    };
  }

  const opponentCard = state.aiPlan[index];
  if (!opponentCard) {
    return {
      text: `+${EXTRA_CARD_POINTS}`,
      label: `Extra card with no opposing card; adds ${EXTRA_CARD_POINTS} Round Point instead of clashing`,
      extraCard: true,
    };
  }

  const clue = state.aiTellClues[index] || "sealed";
  const edgeKnown = clue === "full";
  const edge = edgeKnown
    && ELEMENTS[playerCard.element].beats === opponentCard.element
    ? ELEMENT_EDGE_BONUS
    : 0;
  const knownParts = [];
  if (tactic) knownParts.push(`${TACTICS[playerCard.tactic].label} +${tactic}`);
  if (edge) knownParts.push(`Element Edge +${edge}`);

  if (!edgeKnown) {
    return {
      text: `+${knownBonus}–${knownBonus + ELEMENT_EDGE_BONUS}`,
      label: `Bonus ranges from plus ${knownBonus} to plus ${knownBonus + ELEMENT_EDGE_BONUS}; Element Edge is hidden`,
      extraCard: false,
    };
  }

  const total = knownBonus + edge;
  return {
    text: `+${total}`,
    label: `Total bonus plus ${total}: ${knownParts.length ? knownParts.join(", ") : "No bonuses"}`,
    extraCard: false,
  };
}

function renderFormationBuilder() {
  const selectedCards = state.selectedCardIds
    .map((instanceId) => state.playerHand.find((card) => card.instanceId === instanceId))
    .filter(Boolean);
  const commitmentLimit = getPlayerFormationLimit();

  ui.playerPlayZone.innerHTML = `
    <div class="formation-builder" aria-label="Your formation lanes">
      ${Array.from({ length: MAX_PLAY_SIZE }, (_, index) => {
        const card = selectedCards[index];
        const isLockedSlot = (state.locked || commitmentLimit === 0) && !card;
        const isNextSlot = !state.locked
          && index < commitmentLimit
          && index === selectedCards.length;
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
            class="formation-slot empty-slot${isNextSlot ? " next-slot" : " waiting-slot"}${isLockedSlot ? " locked-slot" : ""}"
            data-drop-lane="${index}"
            aria-label="Lane ${index + 1}${isLockedSlot ? ", unavailable" : isNextSlot ? ", available for your next card" : ", waiting for the previous lane"}"
          >
            <span>LANE ${index + 1}</span>
            <b>${isLockedSlot ? "LOCKED" : isNextSlot ? "DROP CARD" : "WAITING"}</b>
            <small>${isLockedSlot ? "FORMATION UNAVAILABLE" : isNextSlot ? "or click one below" : `Fill lane ${index}`}</small>
          </div>
        `;
      }).join("")}
    </div>
  `;

  bindCardInteractions(ui.playerPlayZone);
  ui.playerPlayZone.querySelectorAll("[data-drop-lane]").forEach((slot) => {
    const laneIndex = Number(slot.dataset.dropLane);
    slot.addEventListener("dragover", (event) => {
      if (
        state.locked
        || laneIndex >= getPlayerFormationLimit()
        || laneIndex > state.selectedCardIds.length
      ) return;
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
  const commitmentLimit = getPlayerFormationLimit();
  const currentIndex = state.selectedCardIds.indexOf(instanceId);
  if (currentIndex < 0 && state.selectedCardIds.length >= commitmentLimit) {
    setMessage(
      `${commitmentLimit}-card formation limit reached.`,
      "Return a card to your hand before adding another.",
    );
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
  const playerExtraCards = Math.max(0, count - state.aiPlan.length);
  const aiExtraCards = Math.max(0, state.aiPlan.length - count);
  const detail = concealsOpponentFormation()
    ? count === 0
      ? state.difficulty === "instinct" && tutorial.active && currentTutorialLesson()?.freeChoice
        ? `Choose ${currentTutorialLesson().minCards || 1}–${currentTutorialLesson().maxCards || MAX_PLAY_SIZE} cards. His commitment habit is your only clue to his hidden formation size.`
        : state.difficulty === "instinct"
          ? "Choose one to three cards. His commitment habit is your clue to his hidden formation size."
          : "Choose one to three cards. Use Previous Rounds History to infer his hidden formation habits."
      : tutorial.active
        && currentTutorialLesson()?.freeChoice
        && count < (currentTutorialLesson().minCards || 1)
        ? `Place at least ${currentTutorialLesson().minCards || 1} cards for this practice formation.`
      : state.difficulty === "blind"
        ? "Your formation is ready. Professor Paws' current cards, formation size, and habits remain concealed."
        : "Your current formation is ready to commit. Professor Paws' cards and formation size remain concealed."
    : count === 0
      ? "Choose one to three cards using Professor Paws' visible plan."
      : playerExtraCards
        ? `Your ${playerExtraCards} extra ${playerExtraCards === 1 ? "card adds" : "cards add"} ${playerExtraCards} Round ${playerExtraCards === 1 ? "Point" : "Points"}.`
        : aiExtraCards
          ? `Professor Paws has ${aiExtraCards} extra ${aiExtraCards === 1 ? "card" : "cards"} worth ${aiExtraCards} Round ${aiExtraCards === 1 ? "Point" : "Points"}.`
          : "Equal formation sizes mean there are no extra cards. Round Points come only from winning a lane where your card faces one of Professor Paws’ cards.";
  setMessage(title, detail);
  renderOpponentTells();
}

function updateSelectionControls() {
  const count = state.selectedCardIds.length;
  const tutorialFormationReady = !tutorial.active || isTutorialSelectionValid();
  const lesson = tutorial.active ? currentTutorialLesson() : null;
  const minimumCards = lesson?.freeChoice
    ? lesson.minCards || 1
    : lesson?.expected.length || 1;
  const formationLimit = getPlayerFormationLimit();
  const readiness = tutorialFormationReady
    ? "ready"
    : count >= minimumCards
      ? "adjust the order"
      : `${minimumCards - count} more needed`;
  ui.selectionCount.textContent = count
    ? `${count} ${count === 1 ? "card" : "cards"} placed · ${readiness} · up to ${formationLimit}`
    : minimumCards === formationLimit
      ? `0 placed · choose ${minimumCards} ${minimumCards === 1 ? "card" : "cards"}`
      : `0 placed · choose ${minimumCards}–${formationLimit} cards`;
  ui.playSelectedButton.disabled = state.locked
    || count < 1
    || count > getPlayerFormationLimit()
    || !tutorialFormationReady;
  ui.playSelectedButton.textContent = count === 1
    ? "Commit 1 Card"
    : `Commit ${count || 0} Cards`;
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
  } else if (state.selectedCardIds.length < getPlayerFormationLimit()) {
    state.selectedCardIds.push(instanceId);
    changed = true;
    audio.cardFlip(true, state.selectedCardIds.length);
  } else {
    setMessage(
      `${getPlayerFormationLimit()}-card formation limit reached.`,
      "Deselect a card before choosing another.",
    );
    audio.denied();
  }

  if (changed) updateFormationMessage();

  renderHand();
}

function playedCardsMarkup(cards, side, clashCount = cards.length) {
  return `
    <div class="played-cards ${side}-formation">
      ${cards.map((card, index) => `
        <div class="clash-card${index >= clashCount ? " result-extra-card" : ""}" data-clash-index="${index}">
          ${cardMarkup(card, false, index, index >= clashCount ? "extra-card" : "played")}
          <span class="lane-result">${index >= clashCount ? "EXTRA +1" : ""}</span>
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
      ELEMENT_SORT_ORDER[a.element] - ELEMENT_SORT_ORDER[b.element]
      || RARITY_SORT_ORDER[a.rarity] - RARITY_SORT_ORDER[b.rarity]
      || a.power - b.power
      || a.name.localeCompare(b.name));
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
  if (tutorial.active && tutorial.phase === "tour") {
    ui.roundLabel.textContent = "INTERFACE TOUR";
  } else if (tutorial.active && tutorial.mode === "lesson") {
    const sectionScenarios = tutorialSectionScenarioIndexes();
    const sectionScenarioPosition =
      sectionScenarios.indexOf(tutorial.lessonIndex) + 1;
    const sectionName = currentTutorialSectionName().toUpperCase();
    ui.roundLabel.textContent = sectionScenarios.length > 1
      ? `${sectionName} ${sectionScenarioPosition} / ${sectionScenarios.length}`
      : sectionName;
  } else if (tutorial.active) {
    ui.roundLabel.textContent =
      `LESSON ${tutorial.lessonIndex + 1} / ${TUTORIAL_LESSONS.length}`;
  } else {
    ui.roundLabel.textContent = `ROUND ${state.round}`;
  }
  if (tutorial.active) {
    ui.deckStatusText.innerHTML = tutorial.phase === "tour"
      ? "<strong>Training tour</strong> &middot; interface overview"
      : `<strong>Training deck</strong> &middot; ${state.discardPile.length} ${state.discardPile.length === 1 ? "card" : "cards"} in the training discard pile`;
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
    `${tutorial.active ? "Training rounds won" : "Rounds won"}: You ${state.playerRoundWins}, Professor Paws ${state.aiRoundWins}`,
  );
}

function snapshotHistoryCard(card) {
  if (!card) return null;
  return {
    name: card.name,
    element: card.element,
    power: card.power,
    tactic: card.tactic,
  };
}

function recordCompletedRound(reward, playerCards, aiCards, resolution) {
  if (!resolution) return;
  state.previousRoundsHistory.push({
    round: state.round,
    difficulty: state.difficulty,
    playerCards: playerCards.map(snapshotHistoryCard),
    aiCards: aiCards.map(snapshotHistoryCard),
    winner: resolution.winner,
    score: { ...resolution.score },
    laneResults: resolution.lanes.map((lane) => ({
      winner: lane.winner,
      playerTotal: lane.player.total,
      aiTotal: lane.ai.total,
    })),
    trophy: reward?.card
      ? {
          winner: reward.winner,
          lane: reward.lane,
          card: snapshotHistoryCard(reward.card),
        }
      : null,
    trophyProgressBefore: {
      player: { ...getElementTrophyCounts(state.playerWins) },
      ai: { ...getElementTrophyCounts(state.aiWins) },
    },
  });
  renderPreviousRoundsHistory();
}

function historyProgressMarkup(counts, label) {
  return `
    <span class="history-progress" aria-label="${label}: Ember ${counts.ember}, Gust ${counts.gust}, Tide ${counts.tide}">
      <b>${label}</b>
      ${Object.entries(ELEMENTS).map(([key, element]) =>
        `<i class="element-${key}">${element.icon} ${counts[key]}</i>`).join("")}
    </span>
  `;
}

function historyLaneCellMarkup(entry, side, index) {
  const cards = side === "player" ? entry.playerCards : entry.aiCards;
  const opposingCards = side === "player" ? entry.aiCards : entry.playerCards;
  const card = cards[index];
  if (!card) {
    return `<div class="history-lane-empty" aria-label="Lane ${index + 1}, no card">—</div>`;
  }

  const lane = entry.laneResults[index];
  const isExtra = index >= opposingCards.length;
  const element = ELEMENTS[card.element];
  const tactic = TACTICS[card.tactic] || TACTICS.link;
  const outcome = isExtra
    ? "EXTRA"
    : lane?.winner === "draw"
      ? "DRAW"
      : lane?.winner === side
        ? "WIN"
        : "LOSS";
  const finalTotal = side === "player" ? lane?.playerTotal : lane?.aiTotal;
  const bonus = isExtra ? 0 : Math.max(0, (finalTotal || card.power) - card.power);
  const scoreLabel = isExtra
    ? "Unopposed card, plus 1 Round Point"
    : `Power ${card.power}, bonus plus ${bonus}, clash total ${finalTotal}`;

  return `
    <article
      class="history-lane-cell history-cell-${outcome.toLowerCase()} history-element-${card.element}"
      title="${card.name}"
      aria-label="Lane ${index + 1}, ${outcome}, ${element.label}, power ${card.power}, ${tactic.label}. ${scoreLabel}."
    >
      <em>${outcome}</em>
      <span class="history-cell-element" title="${element.label}" aria-label="${element.label}">${element.icon}</span>
      <strong class="history-cell-power" title="Power ${card.power}" aria-label="Power ${card.power}">${card.power}</strong>
      <span class="history-cell-role" title="${tactic.label}: ${tactic.description}" aria-label="${tactic.label}">
        <svg class="tactic-icon" aria-hidden="true"><use href="#tactic-icon-${tactic.icon}"></use></svg>
      </span>
      <span class="history-cell-math">
        ${isExtra ? `<b>+1 RP</b>` : `<small>+${bonus}</small><i aria-hidden="true">→</i><b>${finalTotal}</b>`}
      </span>
    </article>
  `;
}

function historyFormationGridMarkup(entry) {
  const laneHeaders = [0, 1, 2]
    .map((index) => `<div class="history-grid-lane">LANE ${index + 1}</div>`)
    .join("");
  const rowMarkup = (side, label) => {
    const cards = side === "player" ? entry.playerCards : entry.aiCards;
    return `
      <div class="history-grid-side">
        <strong>${label}</strong>
        <small>${cards.length} ${cards.length === 1 ? "CARD" : "CARDS"}</small>
      </div>
      ${[0, 1, 2].map((index) => historyLaneCellMarkup(entry, side, index)).join("")}
    `;
  };
  return `
    <div class="history-lane-grid">
      <div class="history-grid-corner">FORMATION</div>
      ${laneHeaders}
      ${rowMarkup("ai", "PAWS")}
      ${rowMarkup("player", "YOU")}
    </div>
  `;
}

function renderPreviousRoundsHistory() {
  const count = state.previousRoundsHistory.length;
  ui.previousRoundsHistoryCount.textContent = count;
  ui.previousRoundsHistoryCount.setAttribute(
    "aria-label",
    `${count} completed ${count === 1 ? "round" : "rounds"}`,
  );
  if (!count) {
    ui.previousRoundsHistoryList.innerHTML = `
      <div class="previous-rounds-history-empty">
        <strong>No completed rounds yet.</strong>
        <span>The first entry will appear after the clash and trophy decision.</span>
      </div>
    `;
    return;
  }

  ui.previousRoundsHistoryList.innerHTML = [...state.previousRoundsHistory]
    .reverse()
    .map((entry) => {
      const winnerLabel = entry.winner === "player"
        ? "You won"
        : entry.winner === "ai"
          ? "Professor Paws won"
          : "Draw";
      const trophyElement = entry.trophy ? ELEMENTS[entry.trophy.card.element] : null;
      const trophyTactic = entry.trophy
        ? TACTICS[entry.trophy.card.tactic] || TACTICS.link
        : null;
      const trophyOwner = entry.trophy?.winner === "player" ? "You claimed" : "Professor Paws claimed";
      const trophyLabel = entry.trophy
        ? `${trophyOwner} ${trophyElement.label}, power ${entry.trophy.card.power}, ${trophyTactic.label}`
        : "No trophy was claimed";
      return `
        <article class="previous-round-entry">
          <header>
            <div>
              <div class="history-entry-labels">
                <span class="history-round-number">ROUND <strong>${entry.round}</strong></span>
                <span class="history-mode">${DIFFICULTIES[entry.difficulty]?.label || "Training"}</span>
              </div>
              <h3 class="history-scoreline">
                <span>YOU</span>
                <b>${entry.score.player}</b>
                <i aria-hidden="true">–</i>
                <b>${entry.score.ai}</b>
                <span>PAWS</span>
                <small>ROUND POINTS</small>
              </h3>
            </div>
            <b class="history-round-result history-round-result-${entry.winner}">${winnerLabel}</b>
          </header>
          <div class="history-progress-before">
            <span class="history-progress-label">TROPHIES BEFORE</span>
            ${historyProgressMarkup(entry.trophyProgressBefore.player, "You")}
            ${historyProgressMarkup(entry.trophyProgressBefore.ai, "Professor")}
          </div>
          ${historyFormationGridMarkup(entry)}
          <footer class="history-trophy">
            <span aria-hidden="true">◆</span>
            ${entry.trophy
              ? `<strong>${trophyOwner}</strong>
                <span
                  class="history-trophy-summary history-element-${entry.trophy.card.element}"
                  title="${entry.trophy.card.name}: ${trophyLabel}"
                  aria-label="${trophyLabel}"
                >
                  <b>${trophyElement.icon}</b>
                  <b>${entry.trophy.card.power}</b>
                  <svg class="tactic-icon" aria-hidden="true"><use href="#tactic-icon-${trophyTactic.icon}"></use></svg>
                </span>`
              : `<strong>${trophyLabel}</strong>`}
          </footer>
        </article>
      `;
    })
    .join("");
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
  if (scoring.edge) parts.push(`Element Edge +${scoring.edge}`);
  if (scoring.tactic) {
    parts.push(`${scoring.tacticName || "Role"} +${scoring.tactic}`);
  }
  return {
    total: scoring.edge
      + scoring.tactic,
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
  const selectedCount = state.selectedCardIds.length;
  if (
    state.locked
    || selectedCount < 1
    || selectedCount > getPlayerFormationLimit()
  ) return;
  if (tutorial.active && !isTutorialSelectionValid()) {
    const lesson = currentTutorialLesson();
    setMessage(
      lesson?.freeChoice ? "Complete your formation first." : "That formation does not match the scenario.",
      lesson?.freeChoice
        ? `Commit between ${lesson.minCards || 1} and ${lesson.maxCards || MAX_PLAY_SIZE} cards.`
        : "Follow the highlighted order, then commit again.",
    );
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
      `${clashCount} ${clashCount === 1 ? "lane will clash" : "lanes will clash"}; every extra card adds 1 Round Point.`,
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
  recordCompletedRound(reward, playerCards, aiCards, resolution);
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

  ui.versusBadge.textContent = `${score.player}–${score.ai}`;

  if (winner === "player") {
    state.playerRoundWins += 1;
    if (decidedBy === "extra-cards") {
      reward = rewardOptions[0] || null;
      setMessage(
        `Your extra cards win the round, ${score.player}–${score.ai} Round Points!`,
        `${reward.card.name}, your first extra card, becomes the round trophy.`,
      );
    } else if (rewardOptions.length > 1) {
      awaitsPlayerClaim = true;
      setMessage(
        `You win with ${score.player}–${score.ai} Round Points!`,
        "Choose which lane-winning card becomes your trophy.",
      );
    } else {
      reward = rewardOptions[0] || null;
      setMessage(
        `You win with ${score.player}–${score.ai} Round Points!`,
        `Lane ${reward.lane + 1}'s ${reward.card.name} becomes your round trophy.`,
      );
    }
    ui.versusBadge.classList.add("win");
    audio.roundResult("win");
  } else if (winner === "ai") {
    state.aiRoundWins += 1;
    reward = decidedBy === "extra-cards"
      ? rewardOptions[0] || null
      : chooseTrophyReward(rewardOptions, state.aiWins);
    if (decidedBy === "extra-cards") {
      setMessage(
        `Professor Paws' extra cards win ${score.ai}–${score.player}.`,
        `${reward.card.name}, the first extra card, becomes the professor's trophy.`,
      );
    } else {
      setMessage(
        `Professor Paws wins with ${score.ai}–${score.player} Round Points.`,
        `The professor claims ${reward.card.name} from lane ${reward.lane + 1}.`,
      );
    }
    ui.versusBadge.classList.add("lose");
    audio.roundResult("loss");
  } else {
    const drawDetail = score.draw
      ? `${score.draw} ${score.draw === 1 ? "lane ended" : "lanes ended"} in a draw. Round Points finish tied ${score.player}–${score.ai}.`
      : `Round Points are tied ${score.player}–${score.ai}. No trophy is claimed.`;
    setMessage("Round Points are tied!", drawDetail);
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
  renderFormationControls();
  ui.clashEffects.innerHTML = "";
  ui.battlefield.classList.remove("is-clashing");
  ui.playerPlayZone.innerHTML = placeholder("Preparing formation");
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
  state.dealing = false;
  ui.menuButton.disabled = false;
  beginFormationBuilding();
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
    `${resultSummary} Final rounds won: ${state.playerRoundWins}–${state.aiRoundWins}.`;
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
  closeDialog(ui.tutorialMenuDialog);
  closeDialog(ui.resultDialog);
  closeDialog(ui.previousRoundsHistoryDialog);
  setGameMenuVisibility(false);
  ui.mainMenuScreen.hidden = false;
  document.body.classList.add("main-menu-active");
}

function showTutorialMenu() {
  showMainMenu();
  if (!ui.tutorialMenuDialog.open) ui.tutorialMenuDialog.showModal();
}

function showDifficultyChooser(returnTarget = "main") {
  difficultyReturnTarget = returnTarget;
  difficultyPreviousLockedState = state.locked;
  stopTutorialMode();
  state.locked = true;
  ui.mainMenuScreen.hidden = true;
  document.body.classList.remove("main-menu-active");
  closeDialog(ui.gameMenuDialog);
  setGameMenuVisibility(false);
  if (!ui.difficultyDialog.open) ui.difficultyDialog.showModal();
}

function leaveDifficultyChooser() {
  closeDialog(ui.difficultyDialog);
  if (difficultyReturnTarget === "game") {
    state.locked = difficultyPreviousLockedState;
    setGameMenuVisibility(true);
    if (!ui.gameMenuDialog.open) ui.gameMenuDialog.showModal();
    ui.menuButton.setAttribute("aria-expanded", "true");
    return;
  }
  showMainMenu();
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
  state.aiTraits = usesPersistentAiHabits() ? createAiTraits() : [];
  state.previousRoundsHistory = [];
  renderOpponentHabits();
  renderPreviousRoundsHistory();
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
  renderFormationControls();
  ui.playerPlayZone.innerHTML = placeholder("Preparing formation");
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
  state.dealing = false;
  ui.menuButton.disabled = false;
  beginFormationBuilding();
}

document.querySelector("#howButton").addEventListener("click", () => ui.howDialog.showModal());
document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => ui.howDialog.close());
});
document.querySelector("#rulebookButton").addEventListener("click", () => ui.rulebookDialog.showModal());
document.querySelectorAll("[data-close-rulebook]").forEach((button) => {
  button.addEventListener("click", () => ui.rulebookDialog.close());
});
ui.previousRoundsHistoryButton.addEventListener("click", () => {
  renderPreviousRoundsHistory();
  if (!ui.previousRoundsHistoryDialog.open) {
    ui.previousRoundsHistoryDialog.showModal();
  }
});
document.querySelectorAll("[data-close-previous-rounds-history]").forEach((button) => {
  button.addEventListener("click", () => ui.previousRoundsHistoryDialog.close());
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
ui.tutorialCoachDragHandle.addEventListener("keydown", (event) => {
  if (!tutorial.active || ui.tutorialCoach.hidden) return;
  if (event.key === "Home") {
    tutorialCoachDrag.manual = false;
    tutorialCoachDrag.anchorKey = null;
    ui.tutorialCoach.style.removeProperty("left");
    ui.tutorialCoach.style.removeProperty("top");
    ui.tutorialCoach.style.removeProperty("right");
    ui.tutorialCoach.style.removeProperty("bottom");
    positionTutorialCoach();
    event.preventDefault();
    return;
  }

  const directions = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  const direction = directions[event.key];
  if (!direction) return;
  const distance = event.shiftKey ? 48 : 24;
  const panelRect = ui.tutorialCoach.getBoundingClientRect();
  tutorialCoachDrag.manual = true;
  tutorialCoachDrag.anchorKey = null;
  ui.tutorialCoach.classList.remove("is-anchored");
  ui.tutorialCoach.removeAttribute("data-anchor-side");
  moveTutorialCoach(
    panelRect.left + direction[0] * distance,
    panelRect.top + direction[1] * distance,
  );
  event.preventDefault();
});
window.addEventListener("resize", () => {
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
  showDifficultyChooser("main");
});
ui.mainMenuPlayButton.addEventListener("click", () => showDifficultyChooser("main"));
ui.mainMenuTutorialButton.addEventListener("click", showTutorialMenu);
ui.mainMenuRulebookButton.addEventListener("click", () => ui.rulebookDialog.showModal());
ui.mainMenuSettingsButton.addEventListener("click", () => openSettings("main"));
ui.tutorialMenuOptions.addEventListener("click", (event) => {
  const option = event.target.closest("[data-tutorial-path], [data-tutorial-lesson]");
  if (!option) return;
  if (option.dataset.tutorialLesson !== undefined) {
    startTutorial("lesson", Number(option.dataset.tutorialLesson));
    return;
  }
  startTutorial(option.dataset.tutorialPath);
});
document.querySelectorAll("[data-close-tutorial-menu]").forEach((button) => {
  button.addEventListener("click", () => closeDialog(ui.tutorialMenuDialog));
});
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
    startTutorial(tutorial.mode, tutorial.entryLessonIndex);
  } else {
    startGame();
  }
});
ui.changeDifficultyButton.addEventListener("click", () => showDifficultyChooser("game"));
ui.gameSettingsButton.addEventListener("click", () => openSettings("game"));
ui.returnMainMenuButton.addEventListener("click", showMainMenu);
ui.tutorialBackButton.addEventListener("click", retreatTutorialInstruction);
ui.tutorialRetryButton.addEventListener("click", () => {
  startTutorial(tutorial.mode, tutorial.entryLessonIndex);
});
ui.tutorialMenuButton.addEventListener("click", showTutorialMenu);
ui.tutorialMainMenuButton.addEventListener("click", showMainMenu);
ui.tutorialActionButton.addEventListener("click", () => {
  if (!tutorial.active) return;
  if (tutorial.phase === "tour") {
    advanceTutorialTour();
  } else if (tutorial.phase === "intro") {
    advanceTutorialIntro();
  } else if (tutorial.phase === "aftermath") {
    if (tutorial.mode === "lesson" && !tutorialContinuesCurrentSection()) {
      tutorial.phase = "section-complete";
      renderTutorialCoach();
      focusTutorialHeading();
    } else if (
      tutorial.mode === "complete"
      && tutorial.lessonIndex === TUTORIAL_LESSONS.length - 1
    ) {
      tutorial.phase = "complete";
      renderTutorialCoach();
      focusTutorialHeading();
    } else {
      loadTutorialLesson(adjacentTutorialLessonIndex(1));
    }
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
  leaveDifficultyChooser();
});
ui.difficultyBackButton.addEventListener("click", leaveDifficultyChooser);
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
renderPreviousRoundsHistory();
audio.setVolumes(state.audioVolumes);
renderSettings(
  saveClashStyle(state.clashStyle),
  saveAudioVolumes(state.audioVolumes),
);
showMainMenu();
