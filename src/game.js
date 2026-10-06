const {
  ELEMENTS,
  TACTICS,
  AI_MOTIVE_TRAITS,
  AI_FORMATION_TRAITS,
  AI_COMMITMENT_TRAITS,
  ELEMENT_EDGE_BONUS,
  getPowerTier,
  getElementTrophyCounts,
  getTrophyProgress,
  hasCompletedElementSet,
  reshuffleDiscardPile,
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
  ["tide", 8, "Riptide Rook", "Anchorbreaker", "Small paws. Heavy anchor.", "epic", "vanguard", "riptide-rook"],
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
// Exclusive to Four-Lane Mode; never included in Normal Play's freshDeck().
const FOUR_LANE_RALLY_CARDS = Object.freeze([
  ["ember", 6, "Hareth", "Kindling Cadence", "A steady beat. A braver formation.", "rare", "hareth-hearthbeat"],
  ["gust", 6, "Megwyn", "Second Wind Serenade", "One melody lifts every paw.", "rare", "megwyn-windwhistle"],
  ["tide", 6, "Deshone", "Springwater Resolve", "Keeps weary paws in the fight.", "rare", "deshone-dewguard"],
  ["ember", 5, "Charmae", "Golden Mend", "Every stitch steadies the banner.", "uncommon", "charmae-emberhem"],
  ["gust", 5, "Aakith", "Windward Route", "No paw left wandering.", "uncommon", "aakith-wayfinder"],
  ["tide", 5, "Sajrin", "Shellward Shelter", "Built to weather the worst.", "uncommon", "sajrin-shellwright"],
  ["ember", 4, "Lucan", "Kilnkindle", "Small cups. Warm company.", "common", "lucan-cinderclay"],
  ["gust", 4, "Jyawaye", "Harvest Breeze", "The wind lends a working paw.", "common", "jiawen-barleybreeze"],
  ["tide", 4, "Siewen", "Rainshare", "Every drop is worth sharing.", "common", "siewen-rainkeeper"],
].map(([element, power, name, move, lore, rarity, art]) => Object.freeze({
  id: `four-lane-${art}`,
  element,
  power,
  name,
  move,
  lore,
  rarity,
  tactic: "rally",
  art,
  artworkSource: `./assets/cards/four-lane/${art}.png`,
})));
const FOUR_LANE_UNCOMMON_CARDS = Object.freeze([
  ["ember", 5, "Shazmir", "Ashen Flourish", "A little flourish. A lot of fire.", "link", "shazmir-ashveil"],
  ["gust", 5, "Hidayn", "Firstwind Descent", "First to land. Ready to stand.", "vanguard", "hidayn-windbrace"],
  ["tide", 5, "Isai", "Closing Current", "One last wave. No way back.", "finisher", "isai-tidebind"],
].map(([element, power, name, move, lore, tactic, art]) => Object.freeze({
  id: `four-lane-${art}`,
  element,
  power,
  name,
  move,
  lore,
  rarity: "uncommon",
  tactic,
  art,
  artworkSource: `./assets/cards/four-lane/${art}.png`,
})));
const FOUR_LANE_CARDS = Object.freeze([
  ...FOUR_LANE_RALLY_CARDS,
  ...FOUR_LANE_UNCOMMON_CARDS,
]);
const FOUR_LANE_ROLES = Object.freeze({
  rally: Object.freeze({
    icon: "banner",
    label: "Rally",
    description: "Rally: Gives +1 Power to the card committed directly before it. In Lane 1, Rally gives no bonus.",
  }),
});
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
  element: "Fire, Gust, then Water; Common through Legendary within each element.",
  rarity: "Legendary cards first, then Epic, Rare, Uncommon, and Common.",
  power: "Highest base power first.",
  name: "Alphabetical from A to Z.",
};
const CLASH_STYLES = Object.freeze(["cinematic", "classic"]);
const CLASH_STYLE_STORAGE_KEY = "projectProwl.clashStyle";
// Keep the photographic collection available for later, but do not expose it yet.
const PHOTOGRAPHIC_ARTWORK_ENABLED = false;
const ARTWORK_STYLES = Object.freeze(
  PHOTOGRAPHIC_ARTWORK_ENABLED ? ["illustrated", "photographic"] : ["illustrated"],
);
const ARTWORK_STYLE_STORAGE_KEY = "projectProwl.artworkStyle";
const BOARD_THEMES = Object.freeze(["map", "tabletop"]);
// The previous key auto-saved Map for everyone, so start a fresh preference with Tabletop as default.
const BOARD_THEME_STORAGE_KEY = "projectProwl.boardThemeV2";
const PHOTOGRAPHIC_CARD_ART = Object.freeze({
  "teapot-tabby": "./assets/cards/photographic/teapot-tabby-bell.jpg",
  "cinder-kit": "./assets/cards/photographic/cinder-shiopan.png",
});
const PHOTOGRAPHIC_CARD_NAMES = Object.freeze({
  "teapot-tabby": "Peasant Bell",
  "cinder-kit": "Cinder Shiopan",
});
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
      "The elemental crests at the edges of the board track the trophies collected from winning rounds.",
    objective:
      "Win the match by collecting two Fire, two Gust, and two Water trophies before the opponent.",
    targets: Object.freeze(["#playerCollection", "#aiCollection"]),
    anchor: "#playerCollection",
    preferredSide: "left",
  }),
  Object.freeze({
    id: "round-score",
    concept: "Training Grounds Tour",
    title: "Track round wins",
    text:
      "This display records how many rounds you and the opponent have won during the current duel.",
    objective:
      "Rounds Won shows duel performance, but it does not complete the match. Only the six required trophies do.",
    targets: Object.freeze(["#roundScore"]),
    anchor: "#roundScore",
    preferredSide: "bottom",
  }),
  Object.freeze({
    id: "plan",
    concept: "Training Grounds Tour",
    title: "Read the opponent",
    text:
      "This panel gives you the opponent information allowed by your difficulty. Guided shows live plan clues, Instinct shows the opponent's habits, and Blind conceals both.",
    objective:
      "Use Guided's current clues, Instinct's visible habits, or Blind's Previous Rounds History while the opponent's current plan remains hidden.",
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
      "When your card faces one of the opponent's cards in the same lane, compare their Clash Totals. Winning that lane earns 2 Round Points. A card with no opposing card earns 1 Round Point instead.",
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
      "It is available in every difficulty. In Blind, compare several completed rounds to identify the opponent's hidden habits yourself.",
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
      "The opponent committed Gust. Teapot Tabby’s Fire element beats it and earns Element Edge +2.",
    objective:
      "Commit Teapot Tabby. Fire beats Gust, so the card earns Element Edge +2.",
    introPages: Object.freeze([
      Object.freeze({
        title: "Element Edge follows the cycle",
        text:
          "Fire beats Gust, Gust beats Water, and Water beats Fire. A card that beats the opposing element earns Element Edge +2 when it faces a card in the same lane.",
        objective:
          "Element Edge strengthens the card’s total, but it does not guarantee victory. Printed Power and every other active bonus still matter.",
        visual: "element-cycle",
        targets: Object.freeze([]),
        unanchored: true,
      }),
      Object.freeze({
        title: "Find the +2 in the preview",
        text:
          "The opponent committed Gust. After you place the Fire card Teapot Tabby, its bonus badge and forecast will include Element Edge +2.",
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
      "Teapot Tabby’s Power 3 gained Element Edge +2 for a Clash Total of 5. No Role bonus was involved. Winning that lane supplied the round’s 2 Round Points and a Fire trophy.",
  }),
  Object.freeze({
    id: "commitment-one-vs-two",
    concept: "Round Points · Scenario 1 of 3",
    title: "One card against two",
    intro:
      "When your card faces one of the opponent's cards in the same lane, winning that lane earns 2 Round Points. Any card with no opposing card in its lane earns 1 Round Point. In this scenario, your one card faces the first of the opponent's two cards.",
    objective:
      "Play Sir Squall. Winning his lane will earn 2 Round Points against the opponent's 1 Round Point from an extra card.",
    playerCards: Object.freeze(["sir-squall", "moonpool-mouser", "comet-claw"]),
    aiCards: Object.freeze(["empress-ebb", "bubble-bengal"]),
    expected: Object.freeze(["sir-squall"]),
    aftermath:
      "Sir Squall won Lane 1 for 2 Round Points. The opponent's extra card added 1 Round Point, so your one-card formation won the round 2–1.",
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
      "Sir Squall still won Lane 1 for 2 Round Points, but the opponent's two extra cards supplied 2 Round Points. Round Points were tied 2–2, producing a draw and no trophy.",
  }),
  Object.freeze({
    id: "tactics",
    concept: "Formation Roles",
    title: "Build a three-role formation",
    intro:
      "Vanguard earns +1 in Lane 1. Link earns +1 in Lane 2 or 3 when the card directly before the Link has a different element from the Link card. Finisher earns +1 when committed as the final card in a two- or three-card formation.",
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
          "For example, a Water Link committed after a Fire card earns +1; a Water Link committed after another Water card earns no bonus.",
        targets: Object.freeze(["#playerHand", "#playerPlayZone"]),
        anchor: "#playerPlayZone",
        preferredSide: "right",
      }),
      Object.freeze({
        title: "Finisher: commit it last",
        text:
          "To gain Finisher +1, commit the Finisher as the final card in a two- or three-card formation. The opponent does not need to commit a card to that lane for the Role to activate.",
        objective:
          "With two cards, commit the Finisher second in Lane 2. With three cards, commit it third in Lane 3. A lone Finisher earns no bonus.",
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
          "Bubble Bengal is a Water Link. Candle Pounce was committed directly before her. The card before the Link is Fire, which differs from Bubble Bengal’s Water element, so Link +1 will activate.",
        objective:
          "Place Bubble Bengal in Lane 2. Because the card directly before the Link has a different element from her Water element, she receives Link +1.",
      }),
      Object.freeze({
        title: "Close with Finisher",
        text:
          "Dandelion Dash is a Finisher. Commit him last in this three-card formation to activate Finisher +1.",
        objective:
          "Place Dandelion Dash in Lane 3. Because he is your final card in a three-card formation, he receives Finisher +1.",
      }),
    ]),
    readyText:
      "The preview shows why each bonus activated: Vanguard +1 for Lane 1, Link +1 because the card before the Link has a different element from the Link card, and Finisher +1 because Dandelion Dash is your final card in a three-card formation.",
    readyObjective:
      "Confirm all three Role +1 bonuses in the forecast, then commit the formation.",
    playerCards: Object.freeze(["candle-pounce", "bubble-bengal", "dandelion-dash"]),
    aiCards: Object.freeze(["teapot-tabby", "moonpool-mouser", "wellwater-wisp"]),
    expected: Object.freeze(["candle-pounce", "bubble-bengal", "dandelion-dash"]),
    aftermath:
      "Candle Pounce gained Vanguard +1 for being in Lane 1. Bubble Bengal gained Link +1 because the card before the Link had a different element from her Water element. Dandelion Dash gained Finisher +1 because he was last in a three-card formation. Changing their order could disable these bonuses.",
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
      "Instinct hides the opponent's cards and formation size. The three known habits are useful clues, but they describe tendencies rather than promises.",
    objective:
      "Use the three visible habits to build any two- or three-card formation you believe can handle the opponent's likely plan.",
    introPages: Object.freeze([
      Object.freeze({
        title: "Habits replace exact tells",
        text:
          "In Instinct, the opponent's card details and commitment count stay sealed. You always see one motive habit, one formation habit, and one commitment habit.",
        objective:
          "Read all three together. Each habit answers a different question: what the opponent favors, how they order cards, and how many cards they tend to commit.",
        targets: Object.freeze(["#opponentHabits"]),
        anchor: "#opponentHabits",
        preferredSide: "left",
      }),
      Object.freeze({
        title: "Turn clues into a prediction",
        text:
          "Power Seeker favors high-Power cards. Strong Opener places his highest-Power committed card in Lane 1. Full Formation usually commits three cards.",
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

function readSavedArtworkStyle() {
  try {
    const savedStyle = window.localStorage.getItem(ARTWORK_STYLE_STORAGE_KEY);
    return ARTWORK_STYLES.includes(savedStyle) ? savedStyle : "illustrated";
  } catch {
    return "illustrated";
  }
}

function readSavedBoardTheme() {
  try {
    const savedTheme = window.localStorage.getItem(BOARD_THEME_STORAGE_KEY);
    return BOARD_THEMES.includes(savedTheme) ? savedTheme : "tabletop";
  } catch {
    return "tabletop";
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
  gameMode: "normal",
  aiDeck: [],
  aiDiscardPile: [],
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
  artworkStyle: readSavedArtworkStyle(),
  boardTheme: readSavedBoardTheme(),
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
  mainMenuFourLaneButton: document.querySelector("#mainMenuFourLaneButton"),
  fourLanePreviewScreen: document.querySelector("#fourLanePreviewScreen"),
  fourLanePreviewTitle: document.querySelector("#fourLanePreviewTitle"),
  fourLaneDeckPage: document.querySelector("#fourLaneDeckPage"),
  fourLaneRivalPage: document.querySelector("#fourLaneRivalPage"),
  fourLaneDeckChoiceTitle: document.querySelector("#fourLaneDeckChoiceTitle"),
  fourLaneRivalTitle: document.querySelector("#fourLaneRivalTitle"),
  fourLaneDeckStep: document.querySelector("#fourLaneDeckStep"),
  fourLaneRivalStep: document.querySelector("#fourLaneRivalStep"),
  fourLaneConfirmDeckButton: document.querySelector("#fourLaneConfirmDeckButton"),
  fourLaneChangeDeckButton: document.querySelector("#fourLaneChangeDeckButton"),
  fourLaneConfirmedDeckName: document.querySelector("#fourLaneConfirmedDeckName"),
  fourLaneConfirmedDeckSummary: document.querySelector("#fourLaneConfirmedDeckSummary"),
  fourLaneReturnButton: document.querySelector("#fourLaneReturnButton"),
  fourLaneCardGallery: document.querySelector("#fourLaneCardGallery"),
  fourLaneStartButton: document.querySelector("#fourLaneStartButton"),
  fourLaneRulesDialog: document.querySelector("#fourLaneRulesDialog"),
  mainMenuRulebookButton: document.querySelector("#mainMenuRulebookButton"),
  mainMenuSettingsButton: document.querySelector("#mainMenuSettingsButton"),
  mainMenuFullscreenButton: document.querySelector("#mainMenuFullscreenButton"),
  gameMenuOverlay: document.querySelector("#gameMenuOverlay"),
  gameMenuDialog: document.querySelector("#gameMenuDialog"),
  gameMenuTitle: document.querySelector("#gameMenuTitle"),
  gameMenuNote: document.querySelector("#gameMenuNote"),
  settingsDialog: document.querySelector("#settingsDialog"),
  settingsStatus: document.querySelector("#settingsStatus"),
  artworkSettingsTab: document.querySelector("#artworkSettingsTab"),
  artworkSettingsStatus: document.querySelector("#artworkSettingsStatus"),
  boardSettingsStatus: document.querySelector("#boardSettingsStatus"),
  audioSettingsStatus: document.querySelector("#audioSettingsStatus"),
  settingsTabs: document.querySelectorAll("[data-settings-panel]"),
  settingsPanels: document.querySelectorAll(".settings-panel"),
  audioVolumeInputs: document.querySelectorAll("[data-audio-volume]"),
  menuButton: document.querySelector("#menuButton"),
  resumeGameButton: document.querySelector("#resumeGameButton"),
  restartGameButton: document.querySelector("#restartGameButton"),
  changeDifficultyButton: document.querySelector("#changeDifficultyButton"),
  gameSettingsButton: document.querySelector("#gameSettingsButton"),
  gameFullscreenButton: document.querySelector("#gameFullscreenButton"),
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
const touchFirstInput = window.matchMedia?.("(hover: none) and (pointer: coarse)");
let settingsReturnTarget = "main";
let difficultyReturnTarget = "main";
let pendingDuelMode = "normal";
let difficultyPreviousLockedState = true;
let fourLanePreviewBackground = [];
let gameMenuPreviousFocus = null;
const constructedDecks = globalThis.ClawDeckbuilding;
const fourLaneDeckCatalog = constructedDecks.createCardCatalog([...CARD_LIBRARY, ...FOUR_LANE_CARDS]);
const fourLaneStarterDecks = constructedDecks.createStarterPresets(fourLaneDeckCatalog);
let browserDeckStorage;
try { browserDeckStorage = window.localStorage; } catch { /* Session-only decks remain usable. */ }
const fourLaneDeckStore = constructedDecks.createDeckStore(fourLaneDeckCatalog, browserDeckStorage);
let matchFourLaneDeck = fourLaneStarterDecks[0];
let confirmedFourLaneDeck = null;
const fourLaneOpponents = globalThis.ClawFourLaneOpponents;
const fourLaneOpponentRoster = fourLaneOpponents.createRoster(fourLaneDeckCatalog);
let selectedFourLaneOpponent = "random";
let matchFourLaneOpponent = fourLaneOpponents.createEncounter(fourLaneOpponentRoster, "balanced");
const fourLaneDeckEditor = globalThis.ClawDeckEditor.createController({
  catalog: fourLaneDeckCatalog, store: fourLaneDeckStore,
  cardMarkup: card => cardMarkup(card, false, -1, "four-lane-preview"),
  artworkSource: cardArtworkSource,
  onOpen() { ui.fourLanePreviewScreen.hidden = true; },
  onClose() { ui.fourLanePreviewScreen.hidden = false; document.querySelector("#fourLaneDeckEditorButton").focus({ preventScroll: true }); },
});
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

function isFourLaneMode() {
  return state.gameMode === "four-lane";
}

function duelRules() {
  return isFourLaneMode() ? globalThis.ClawFourLaneRules : globalThis.ClawRules;
}

function getMaxPlaySize() {
  return isFourLaneMode() ? 4 : MAX_PLAY_SIZE;
}

function cardRoleDefinition(card, mode = state.gameMode) {
  const roles = mode === "four-lane" ? globalThis.ClawFourLaneRules.TACTICS : TACTICS;
  return roles[card.tactic] || FOUR_LANE_ROLES[card.tactic] || TACTICS.link;
}

function getTacticBonus(...args) { return duelRules().getTacticBonus(...args); }
function getRallyBonus(cards, index) { return isFourLaneMode() ? duelRules().getRallyBonus(cards, index) : 0; }
function scoreClash(...args) { return duelRules().scoreClash(...args); }
function resolveClashes(...args) { return duelRules().resolveClashes(...args); }
function getFormationRewardOptions(...args) { return duelRules().getFormationRewardOptions(...args); }
function buildTellClues(...args) { return duelRules().buildTellClues(...args); }
function chooseAiCommitment(...args) { return duelRules().chooseAiCommitment(...args); }
function chooseAiCards(...args) { return duelRules().chooseAiCards(...args); }
function createAiTraits(...args) { return duelRules().createAiTraits(...args); }

function getExtraCardPoints(cardCount, opposingCount) {
  return isFourLaneMode() ? duelRules().getExtraCardPoints(cardCount, opposingCount)
    : Math.max(0, cardCount - opposingCount) * EXTRA_CARD_POINTS;
}

function getExtraCardLanePoints(index, opposingCount) {
  return isFourLaneMode() ? duelRules().getExtraCardLanePoints(index, opposingCount)
    : index >= opposingCount ? EXTRA_CARD_POINTS : 0;
}

function renderDuelMode() {
  document.body.dataset.duelMode = state.gameMode;
  document.querySelector(".arena").setAttribute("aria-label", `${isFourLaneMode() ? "Four" : "Three"}-lane dueling table`);
  document.querySelector("#gameTitle").textContent = isFourLaneMode() ? "Four-Lane Duel · WIP" : "Trial of the Elements";
  document.querySelector(".rules-strip .rule-chip.gust").innerHTML = isFourLaneMode()
    ? "<b>EXTRA</b> Extra cards add 1 Round Point each, up to 2 per side per round"
    : "<b>EXTRA</b> Every extra card with no opposing card adds 1 Round Point";
  document.querySelector(".rules-strip .rule-chip.tide").innerHTML = isFourLaneMode()
    ? "<b>TROPHY</b> Claim a lane-winning card; if you won no lanes, claim your first extra card"
    : "<b>TROPHY</b> A round win awards one played card";
  renderGallery();
  renderFourLaneRivalInfo();
}

function renderFourLaneRivalInfo() {
  const info = document.querySelector("#fourLaneRivalInfo");
  const visible = isFourLaneMode() && state.difficulty !== "blind";
  info.hidden = !visible;
  info.textContent = visible ? `${matchFourLaneOpponent.profile.name} · ${matchFourLaneOpponent.deck.name}` : "";
}

function getPlayerFormationLimit() {
  if (tutorial.active && tutorial.phase !== "tour") {
    const lesson = currentTutorialLesson();
    return lesson?.freeChoice
      ? lesson.maxCards || MAX_PLAY_SIZE
      : lesson?.expected.length || MAX_PLAY_SIZE;
  }
  return Math.min(getMaxPlaySize(), state.playerHand.length);
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
      aria-label="Element Edge cycle: Fire beats Gust, Gust beats Water, and Water beats Fire. A card whose element beats its opponent adds Element Edge plus two to that card's Clash Total."
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
        <b>${ELEMENTS.ember.label.toUpperCase()}</b>
      </div>
      <div class="element-cycle-node cycle-gust">
        <i aria-hidden="true">${ELEMENTS.gust.icon}</i>
        <b>${ELEMENTS.gust.label.toUpperCase()}</b>
      </div>
      <div class="element-cycle-node cycle-tide">
        <i aria-hidden="true">${ELEMENTS.tide.icon}</i>
        <b>${ELEMENTS.tide.label.toUpperCase()}</b>
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
        `Required order: ${lesson.expected.map((art) => {
          const card = CARD_LIBRARY.find((candidate) => candidate.art === art);
          return card ? cardDisplayName(card) : "Unknown card";
        }).join(" → ")}.`;
      ui.tutorialObjective.textContent =
        "Click a placed card to return it to your hand, then follow the highlighted card.";
    } else {
      const placementGuidance = lesson.placementGuidance?.[selected.length];
      ui.tutorialCoachTitle.textContent = placementGuidance?.title || lesson.title;
      ui.tutorialCoachText.textContent = placementGuidance?.text || lesson.intro;
      const nextArt = lesson.expected[selected.length];
      const nextCard = CARD_LIBRARY.find((card) => card.art === nextArt);
      ui.tutorialObjective.textContent = placementGuidance?.objective || (nextCard
        ? `Place ${cardDisplayName(nextCard)} into Lane ${selected.length + 1}.`
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
      "In a real duel, collect two Fire, two Gust, and two Water trophies before the opponent.";
    ui.tutorialActionButton.textContent = finalLesson ? "Finish Training" : "Continue";
  }

  [ui.tutorialCoachTitle, ui.tutorialCoachText, ui.tutorialObjective].forEach((copyTarget) => {
    copyTarget.textContent = artworkAdjustedCopy(copyTarget.textContent);
  });

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
      ? `Build any ${lesson.minCards || 1}- or ${lesson.maxCards || MAX_PLAY_SIZE}-card formation using the opponent's habits as clues.`
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
    `${cardDisplayName(reward.card)} becomes your training trophy!`,
    "A normal duel asks you to collect two trophies from each element.",
  );
  finishTutorialLesson();
}

function resolveTutorialRound(playerCards, aiCards, resolution) {
  const lesson = currentTutorialLesson();
  const { score, winner, decidedBy, extraCardPoints } = resolution;
  ui.versusBadge.textContent = `${score.player}–${score.ai}`;
  ui.versusBadge.className = "versus-badge has-score";

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
        ? `The opponent's ${extraCardPoints.ai === 1 ? "extra card wins" : "extra cards win"} ${score.ai}–${score.player}.`
        : `The opponent wins with ${score.ai}–${score.player} Round Points.`
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
  state.gameMode = "normal";
  renderDuelMode();
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
  closeGameMenu({ restoreFocus: false });
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

function freshPersonalDeck(side) {
  const definition = side === "player" ? matchFourLaneDeck : matchFourLaneOpponent.deck;
  return shuffle(constructedDecks.buildDeckInstances(fourLaneDeckCatalog, definition, side));
}

function drawCard() {
  const reshuffled = reshuffleDiscardPile(state.deck, state.discardPile);
  return {
    card: state.deck.pop() || null,
    reshuffled,
  };
}

function refillHands(openingHand = false) {
  if (isFourLaneMode()) {
    const rules = duelRules();
    const amount = openingHand ? rules.HAND_SIZE : rules.ROUND_DRAW;
    const player = rules.replenishHand(state.deck, state.discardPile, state.playerHand, amount);
    const opponent = rules.replenishHand(state.aiDeck, state.aiDiscardPile, state.aiHand, amount);
    return player.reshuffled || opponent.reshuffled;
  }
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
  if (isFourLaneMode()) {
    state.aiPlan = duelRules().chooseAiFormation(
      state.aiHand,
      state.playerWins,
      state.aiWins,
      Math.random,
      state.aiTraits,
      { history: state.previousRoundsHistory, cardLibrary: [...CARD_LIBRARY, ...FOUR_LANE_CARDS] },
      matchFourLaneOpponent.profile.role,
    );
    state.aiTellClues = buildTellClues(state.aiPlan.length, state.difficulty);
    return;
  }
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
    ? "Opponent's Habits"
    : "Opponent's Plan";
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
  const aiExtraPoints = getExtraCardPoints(state.aiPlan.length, playerCardCount);
  const playerExtraPoints = getExtraCardPoints(playerCardCount, state.aiPlan.length);
  const formationStatus = playerCardCount === 0
    ? `Build 1–${getMaxPlaySize()} cards`
    : aiExtraCards
      ? `${aiExtraCards} opposing extra ${aiExtraCards === 1 ? "card adds" : "cards add"} ${aiExtraPoints} Round ${aiExtraPoints === 1 ? "Point" : "Points"}${aiExtraCards > aiExtraPoints ? " (the 2-point cap)" : ""}`
      : playerExtraCards
        ? `Your ${playerExtraCards} extra ${playerExtraCards === 1 ? "card adds" : "cards add"} ${playerExtraPoints} Round ${playerExtraPoints === 1 ? "Point" : "Points"}${playerExtraCards > playerExtraPoints ? " (the 2-point cap)" : ""}`
        : "Equal formation size";
  ui.commitmentHint.textContent =
    `${difficultyLabel} · ${state.aiPlan.length} ${state.aiPlan.length === 1 ? "card" : "cards"} · ${formationStatus}`;
  const laneLabels = Array.from({ length: getMaxPlaySize() }, (_, index) => String(index + 1));
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
        ? `Place one to ${isFourLaneMode() ? "four" : "three"} cards. Study completed rounds to infer the opponent's hidden habits.`
        : `Place one to ${isFourLaneMode() ? "four" : "three"} cards. The opponent's formation stays hidden until the clash.`
      : `Place one to ${isFourLaneMode() ? "four" : "three"} cards in order, review the forecast, then commit when ready.`,
  );
}

function getKnownPlayerTacticBonus(cards, index) {
  return getTacticBonus(cards, index);
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
    const playerRally = getRallyBonus(selectedCards, index);
    const knownPlayerScore = playerCard.power
      + playerTactic + playerRally;
    const knownBonusTotal = playerTactic + playerRally;
    const knownBonuses = [];
    if (playerTactic) {
      knownBonuses.push(`${cardRoleDefinition(playerCard).label} +${playerTactic}`);
    }
    if (playerRally) knownBonuses.push(`Rally received +${playerRally}`);
    const knownBonusDetail = knownBonuses.length
      ? knownBonuses.join(" · ")
      : "No known bonus";

    if (concealsCommitment) {
      const roleWarning = `${cardRoleDefinition(playerCard).label} is fully known`;
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
      const points = getExtraCardLanePoints(index, state.aiPlan.length);
      return `
        <span class="forecast-chip forecast-extra-card">
          <i>${index + 1}</i>
          <b>◆ EXTRA CARD +${points}</b>
          <span class="forecast-equation"><strong>+${points} ROUND ${points === 1 ? "POINT" : "POINTS"}</strong></span>
          <small>${points ? "No opposing card; adds 1 Round Point instead of clashing" : "No opposing card; the 2-point extra-card cap is already reached"}</small>
        </span>
      `;
    }
    const opponentTactic = getTacticBonus(state.aiPlan, index);
    const clue = state.aiTellClues[index] || "sealed";
    const scoring = scoreClash(
      playerCard,
      opponentCard,
      playerTactic,
      opponentTactic,
      playerRally,
      getRallyBonus(state.aiPlan, index),
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
      + scoring.ai.tactic + (scoring.ai.rally || 0);
    const opponentMax = tierMax
      + scoring.ai.edge
      + scoring.ai.tactic + (scoring.ai.rally || 0);
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
      <small>Opponent: ${resolution.laneWins.ai} won ${resolution.laneWins.ai === 1 ? "lane" : "lanes"} × ${LANE_WIN_POINTS} + ${resolution.extraCardPoints.ai} from extra ${resolution.extraCardPoints.ai === 1 ? "card" : "cards"}</small>
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

function cardUsesPhotographicArtwork(cardArt) {
  return PHOTOGRAPHIC_ARTWORK_ENABLED
    && state.artworkStyle === "photographic"
    && Boolean(PHOTOGRAPHIC_CARD_ART[cardArt]);
}

function cardDisplayName(card) {
  return PHOTOGRAPHIC_ARTWORK_ENABLED && state.artworkStyle === "photographic"
    ? PHOTOGRAPHIC_CARD_NAMES[card.art] || card.name
    : card.name;
}

function artworkAdjustedCopy(copy = "") {
  if (!PHOTOGRAPHIC_ARTWORK_ENABLED || state.artworkStyle !== "photographic") return copy;
  return Object.entries(PHOTOGRAPHIC_CARD_NAMES).reduce((adjustedCopy, [cardArt, displayName]) => {
    const originalName = CARD_LIBRARY.find((card) => card.art === cardArt)?.name;
    return originalName ? adjustedCopy.replaceAll(originalName, displayName) : adjustedCopy;
  }, String(copy));
}

function cardArtworkSource(cardArt) {
  return cardUsesPhotographicArtwork(cardArt)
    ? PHOTOGRAPHIC_CARD_ART[cardArt]
    : `./assets/cards/${cardArt}.webp`;
}

function updateDisplayedCardArtwork() {
  document.documentElement.dataset.cardArtwork = state.artworkStyle;
  document.querySelectorAll(".game-card[data-card-template]").forEach((cardElement) => {
    if (cardElement.dataset.cardPreview === "four-lane") return;
    const cardArt = cardElement.dataset.cardTemplate;
    const card = [...CARD_LIBRARY, ...FOUR_LANE_CARDS].find((candidate) => candidate.art === cardArt);
    const usesPhotograph = cardUsesPhotographicArtwork(cardArt);
    const image = cardElement.querySelector(".card-art img");
    if (image) image.src = card?.artworkSource || cardArtworkSource(cardArt);
    if (card) {
      const displayName = cardDisplayName(card);
      const name = cardElement.querySelector(".card-info > strong");
      if (name) name.textContent = displayName;
      if (cardElement.hasAttribute("aria-label")) {
        cardElement.setAttribute(
          "aria-label",
          [card.name, PHOTOGRAPHIC_CARD_NAMES[cardArt]]
            .filter(Boolean)
            .reduce((label, knownName) => label.replaceAll(knownName, displayName), cardElement.getAttribute("aria-label")),
        );
      }
    }
    cardElement.classList.toggle("uses-photographic-art", usesPhotograph);
  });
}

function cardMarkup(
  card,
  interactive = false,
  selectedIndex = -1,
  displayMode = "default",
  formationBonus = null,
  extraCardPoints = null,
) {
  const element = ELEMENTS[card.element];
  const isFourLanePreview = displayMode === "four-lane-preview";
  const rarityLabel = card.rarity.charAt(0).toUpperCase() + card.rarity.slice(1);
  const tactic = cardRoleDefinition(card, isFourLanePreview ? "four-lane" : state.gameMode);
  const isSelected = selectedIndex >= 0;
  const isFormationCard = displayMode === "formation";
  const isPlayedCard = displayMode === "played";
  const isExtraCard = displayMode === "extra-card";
  const extraPoints = isExtraCard ? extraCardPoints ?? EXTRA_CARD_POINTS : 0;
  const displayName = cardDisplayName(card);
  const interactionLabel = isFormationCard
    ? `Remove ${displayName} from lane ${selectedIndex + 1}`
    : `Add ${displayName}, ${element.label}, power ${card.power}, ${tactic.label} Formation Role to the next lane`;
  const formationBonusBadge = isFormationCard && formationBonus
    ? `
      <span class="card-bonus-badge preview-badge${formationBonus.extraCard ? " extra-card-badge" : ""}" aria-label="${formationBonus.label}" title="${formationBonus.label}">
        <small>${formationBonus.extraCard ? formationBonus.text === "+0" ? "CAP" : "EXTRA" : "BONUS"}</small>
        <b>${formationBonus.text}</b>
      </span>
    `
    : "";
  const resolvedBonusBadge = isPlayedCard || isExtraCard
    ? `
      <span class="card-bonus-badge${isExtraCard ? " extra-card-badge" : ""}" aria-label="${isExtraCard ? extraPoints ? `Extra card with no opposing card; adds ${extraPoints} Round Point` : "Extra card; adds 0 Round Points because the 2-point extra-card cap is reached" : "Bonus not yet resolved"}">
        <small>${isExtraCard ? extraPoints ? "EXTRA" : "CAP" : "BONUS"}</small>
        <b>${isExtraCard ? `+${extraPoints}` : "+?"}</b>
      </span>
    `
    : "";
  return `
    <button
      class="game-card element-${card.element} rarity-${card.rarity} art-${card.art}${cardUsesPhotographicArtwork(card.art) ? " uses-photographic-art" : ""}${isFormationCard ? " selected formation-card" : ""}"
      data-card-template="${card.art}"
      ${isFourLanePreview ? `data-card-preview="four-lane" aria-label="${displayName}, ${element.label}, ${rarityLabel}, Power ${card.power}, ${tactic.label} role, preview only"` : ""}
      ${interactive ? `data-card-id="${card.instanceId}" draggable="true" aria-label="${interactionLabel}" aria-pressed="${isSelected}"` : "disabled"}
      type="button"
    >
      ${formationBonusBadge}
      ${resolvedBonusBadge}
      <span class="card-art">
        <img src="${card.artworkSource || cardArtworkSource(card.art)}" alt="" draggable="false" ${isFourLanePreview ? 'loading="lazy" decoding="async" width="1254" height="1254"' : ""} />
        <span class="art-vignette" aria-hidden="true"></span>
        <span class="card-element" aria-hidden="true">${element.icon}</span>
        <span class="card-power"><small>POWER</small><b>${card.power}</b></span>
      </span>
      <span class="card-info">
        <strong>${displayName}</strong>
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
    <div class="formation-builder tutorial-lane-guide" aria-label="Opponent's formation lanes">
      ${Array.from({ length: MAX_PLAY_SIZE }, (_, index) => {
        const isCommitted = index < commitmentCount;
        return `
          <div
            class="formation-slot empty-slot${isCommitted ? "" : " waiting-slot"}"
            aria-label="Opponent lane ${index + 1}, ${isCommitted ? "committed card sealed" : "no card committed"}"
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
    button.draggable = !touchFirstInput?.matches;
    button.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "touch") {
        button.draggable = false;
      } else if (!touchFirstInput?.matches) {
        button.draggable = true;
      }
    });
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

touchFirstInput?.addEventListener?.("change", () => {
  document.querySelectorAll(".game-card[data-card-id]").forEach((card) => {
    card.draggable = !touchFirstInput.matches;
  });
});

function getFormationBonusPreview(selectedCards, index) {
  const playerCard = selectedCards[index];
  const tactic = getKnownPlayerTacticBonus(selectedCards, index);
  const rally = getRallyBonus(selectedCards, index);
  const knownBonus = tactic + rally;
  if (concealsOpponentFormation()) {
    return {
      text: `+${knownBonus}`,
      label: `Known bonus plus ${knownBonus}; ${cardRoleDefinition(playerCard).label} is fully known${rally ? "; Rally received +1" : ""}; Element Edge is revealed at clash`,
      extraCard: false,
    };
  }

  const opponentCard = state.aiPlan[index];
  if (!opponentCard) {
    const points = getExtraCardLanePoints(index, state.aiPlan.length);
    return {
      text: `+${points}`,
      label: points ? `Extra card with no opposing card; adds ${points} Round Point instead of clashing`
        : "Extra card; adds 0 Round Points because the 2-point extra-card cap is reached",
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
  if (tactic) knownParts.push(`${cardRoleDefinition(playerCard).label} +${tactic}`);
  if (rally) knownParts.push(`Rally received +${rally}`);
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
      ${Array.from({ length: getMaxPlaySize() }, (_, index) => {
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
  const playerExtraPoints = getExtraCardPoints(count, state.aiPlan.length);
  const aiExtraPoints = getExtraCardPoints(state.aiPlan.length, count);
  const detail = concealsOpponentFormation()
    ? count === 0
      ? state.difficulty === "instinct" && tutorial.active && currentTutorialLesson()?.freeChoice
        ? `Choose ${currentTutorialLesson().minCards || 1}–${currentTutorialLesson().maxCards || MAX_PLAY_SIZE} cards. The opponent's commitment habit is your only clue to their hidden formation size.`
        : state.difficulty === "instinct"
          ? `Choose one to ${isFourLaneMode() ? "four" : "three"} cards. The opponent's commitment habit is your clue to their hidden formation size.`
          : `Choose one to ${isFourLaneMode() ? "four" : "three"} cards. Use Previous Rounds History to infer the opponent's hidden formation habits.`
      : tutorial.active
        && currentTutorialLesson()?.freeChoice
        && count < (currentTutorialLesson().minCards || 1)
        ? `Place at least ${currentTutorialLesson().minCards || 1} cards for this practice formation.`
      : state.difficulty === "blind"
        ? "Your formation is ready. The opponent's current cards, formation size, and habits remain concealed."
        : "Your current formation is ready to commit. The opponent's cards and formation size remain concealed."
    : count === 0
      ? `Choose one to ${isFourLaneMode() ? "four" : "three"} cards using the opponent's visible plan.`
      : playerExtraCards
        ? `Your ${playerExtraCards} extra ${playerExtraCards === 1 ? "card adds" : "cards add"} ${playerExtraPoints} Round ${playerExtraPoints === 1 ? "Point" : "Points"}${playerExtraCards > playerExtraPoints ? " (the 2-point cap)" : ""}.`
        : aiExtraCards
          ? `The opponent has ${aiExtraCards} extra ${aiExtraCards === 1 ? "card" : "cards"} worth ${aiExtraPoints} Round ${aiExtraPoints === 1 ? "Point" : "Points"}${aiExtraCards > aiExtraPoints ? " (the 2-point cap)" : ""}.`
          : "Equal formation sizes mean there are no extra cards. Round Points come only from winning a lane where your card faces one of the opponent's cards.";
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
  if (isFourLaneMode() && state.locked && !state.dealing) {
    ui.selectionCount.textContent = "Formation committed";
    ui.playSelectedButton.textContent = "Resolving lanes…";
  }
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
      ${cards.map((card, index) => {
        const points = getExtraCardLanePoints(index, clashCount);
        return `
        <div class="clash-card${index >= clashCount ? " result-extra-card" : ""}" data-clash-index="${index}">
          ${cardMarkup(card, false, index, index >= clashCount ? "extra-card" : "played", null, points)}
          <span class="lane-result">${index >= clashCount ? points ? `EXTRA +${points}` : "CAP +0" : ""}</span>
        </div>
      `; }).join("")}
    </div>
  `;
}

function renderGallery() {
  const library = isFourLaneMode() ? [...CARD_LIBRARY, ...FOUR_LANE_CARDS] : CARD_LIBRARY;
  const sortedCards = library.filter((card) =>
    state.archiveElements.includes(card.element)
    && state.archiveRarities.includes(card.rarity));
  if (state.archiveSort === "rarity") {
    sortedCards.sort((a, b) =>
      RARITY_SORT_ORDER[b.rarity] - RARITY_SORT_ORDER[a.rarity]
      || b.power - a.power
      || cardDisplayName(a).localeCompare(cardDisplayName(b)));
  } else if (state.archiveSort === "power") {
    sortedCards.sort((a, b) =>
      b.power - a.power
      || cardDisplayName(a).localeCompare(cardDisplayName(b)));
  } else if (state.archiveSort === "name") {
    sortedCards.sort((a, b) => cardDisplayName(a).localeCompare(cardDisplayName(b)));
  } else {
    sortedCards.sort((a, b) =>
      ELEMENT_SORT_ORDER[a.element] - ELEMENT_SORT_ORDER[b.element]
      || RARITY_SORT_ORDER[a.rarity] - RARITY_SORT_ORDER[b.rarity]
      || a.power - b.power
      || cardDisplayName(a).localeCompare(cardDisplayName(b)));
  }

  ui.galleryIntro.textContent = sortedCards.length === library.length
    ? `All ${library.length} cards available in ${isFourLaneMode() ? "Four-Lane Mode" : "Normal Play"}.`
    : `Showing ${sortedCards.length} of ${library.length} cards.`;
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
    `Showing ${sortedCards.length} of ${library.length} available cards. ${ARCHIVE_SORT_SUMMARIES[state.archiveSort]}`,
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
    `${progress} of 6 trophy slots filled. Fire ${Math.min(counts.ember, TROPHIES_PER_ELEMENT)} of 2, Gust ${Math.min(counts.gust, TROPHIES_PER_ELEMENT)} of 2, Water ${Math.min(counts.tide, TROPHIES_PER_ELEMENT)} of 2.`,
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
  ui.deckStatusText.removeAttribute("title");
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
  if (isFourLaneMode()) {
    const rules = duelRules();
    const discardCopy = state.discardPile.length ? ` · ${state.discardPile.length} discarded` : "";
    ui.deckStatusText.innerHTML = `<strong id="deckCount">${state.deck.length}</strong> cards in draw pile${discardCopy}`;
    ui.deckStatusText.title = `${state.playerHand.length}/${rules.HAND_SIZE} cards in hand; ${state.discardPile.length} discarded. Draw up to ${rules.ROUND_DRAW} next round without exceeding ${rules.HAND_SIZE}. Only your own empty deck reshuffles.`;
    ui.deckCount = document.querySelector("#deckCount");
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
    `${tutorial.active ? "Training rounds won" : "Rounds won"}: You ${state.playerRoundWins}, Opponent ${state.aiRoundWins}`,
  );
}

function snapshotHistoryCard(card) {
  if (!card) return null;
  return {
    name: card.name,
    art: card.art,
    element: card.element,
    power: card.power,
    tactic: card.tactic,
  };
}

function recordCompletedRound(reward, playerCards, aiCards, resolution) {
  if (!resolution) return;
  state.previousRoundsHistory.push({
    round: state.round,
    mode: state.gameMode || "normal",
    difficulty: state.difficulty,
    playerCards: playerCards.map(snapshotHistoryCard),
    aiCards: aiCards.map(snapshotHistoryCard),
    winner: resolution.winner,
    score: { ...resolution.score },
    extraCardPoints: { ...resolution.extraCardPoints },
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
    <span class="history-progress" aria-label="${label}: Fire ${counts.ember}, Gust ${counts.gust}, Water ${counts.tide}">
      <b>${label}</b>
      ${Object.entries(ELEMENTS).map(([key, element]) =>
        `<i class="element-${key}">${element.icon} ${counts[key]}</i>`).join("")}
    </span>
  `;
}

function historyExtraCardLanePoints(entry, side, index) {
  const opposingCards = side === "player" ? entry.aiCards : entry.playerCards;
  // Store earned points, rather than reinterpreting an old round with today's
  // rules. Older in-memory entries can recover that number from their score.
  const laneWins = entry.laneResults.filter(lane => lane.winner === side).length;
  const points = entry.extraCardPoints?.[side] ?? Math.max(0, entry.score[side] - laneWins * 2);
  return index >= opposingCards.length && index < opposingCards.length + points ? 1 : 0;
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
  const tactic = cardRoleDefinition(card, entry.mode);
  const outcome = isExtra
    ? historyExtraCardLanePoints(entry, side, index) ? "Extra +1 Round Point" : "Extra +0 · Cap reached"
    : side === "player"
      ? lane?.winner === "draw" ? "Draw" : lane?.winner === "player" ? "Win" : "Loss"
      : "";
  const outcomeClass = isExtra ? "extra" : outcome.toLowerCase();
  const outcomeLabel = outcome ? ` ${outcome}.` : "";
  const finalTotal = (side === "player" ? lane?.playerTotal : lane?.aiTotal) ?? card.power;
  const bonus = isExtra ? 0 : Math.max(0, finalTotal - card.power);
  const powerLabel = bonus > 0
    ? `Base Power ${card.power}, bonus ${bonus}, clash total ${finalTotal}`
    : `Base Power ${card.power}`;

  return `
    <article
      class="history-lane-cell${outcomeClass ? ` history-cell-${outcomeClass}` : ""} history-element-${card.element}"
      title="${cardDisplayName(card)}"
      aria-label="Lane ${index + 1}, ${element.label}, ${powerLabel}, ${tactic.label}.${outcomeLabel}"
    >
      <div class="history-cell-stats">
        <span class="history-cell-element" title="${element.label}" aria-label="${element.label}">${element.icon}</span>
        <strong class="history-cell-power" title="${powerLabel}" aria-label="${powerLabel}">${card.power}${bonus > 0 ? ` <small class="history-cell-bonus">+${bonus}</small>` : ""}</strong>
        <span class="history-cell-role" title="${tactic.label}: ${tactic.description}" aria-label="${tactic.label}">
          <svg class="tactic-icon" aria-hidden="true"><use href="#tactic-icon-${tactic.icon}"></use></svg>
        </span>
      </div>
      ${outcome ? `<span class="history-cell-outcome">${outcome}</span>` : ""}
    </article>
  `;
}

function historyFormationGridMarkup(entry) {
  const indexes = Array.from({ length: entry.mode === "four-lane" ? 4 : 3 }, (_, index) => index);
  const laneHeaders = indexes
    .map((index) => `<div class="history-grid-lane">LANE ${index + 1}</div>`)
    .join("");
  const rowMarkup = (side, label) => {
    return `
      <div class="history-grid-side">
        <strong>${label}</strong>
      </div>
      ${indexes.map((index) => historyLaneCellMarkup(entry, side, index)).join("")}
    `;
  };
  return `
    <div class="history-lane-grid${entry.mode === "four-lane" ? " history-four-lanes" : ""}">
      <div class="history-grid-corner" aria-hidden="true"></div>
      ${laneHeaders}
      ${rowMarkup("ai", "OPPONENT")}
      ${rowMarkup("player", "YOU")}
    </div>
  `;
}

function historyLaneCalculationMarkup(entry, side, index) {
  const cards = side === "player" ? entry.playerCards : entry.aiCards;
  const opposingCards = side === "player" ? entry.aiCards : entry.playerCards;
  const card = cards[index];
  if (!card) return `<span aria-label="No card">—</span>`;
  if (!opposingCards[index]) return historyExtraCardLanePoints(entry, side, index)
    ? "Extra card: <b>+1 Round Point</b>" : "Extra card: <b>+0 Round Points</b> · 2-point cap reached";
  const lane = entry.laneResults[index];
  const total = side === "player" ? lane.playerTotal : lane.aiTotal;
  const bonus = total - card.power;
  return `Power ${card.power} + bonus ${bonus} = <b>${total}</b>`;
}

function historyRoundDetailsMarkup(entry) {
  const lanes = Array.from({ length: Math.max(entry.playerCards.length, entry.aiCards.length) }, (_, index) => index);
  const trophyCard = entry.trophy?.card;
  const trophyTactic = trophyCard ? cardRoleDefinition(trophyCard, entry.mode) : null;
  return `
    <details class="history-details">
      <summary>Details</summary>
      <div class="history-details-content">
        <p class="history-detail-context">${entry.mode === "four-lane" ? "Four-Lane Mode · " : ""}${DIFFICULTIES[entry.difficulty]?.label || "Training"}</p>
        <div class="history-progress-before">
          <span class="history-progress-label">Trophies before this round</span>
          ${historyProgressMarkup(entry.trophyProgressBefore.player, "You")}
          ${historyProgressMarkup(entry.trophyProgressBefore.ai, "Opponent")}
        </div>
        <table class="history-calculation-table">
          <caption>Lane calculations</caption>
          <thead><tr><th scope="col">Lane</th><th scope="col">You</th><th scope="col">Opponent</th></tr></thead>
          <tbody>${lanes.map((index) => `
            <tr>
              <th scope="row">${index + 1}</th>
              <td>${historyLaneCalculationMarkup(entry, "player", index)}</td>
              <td>${historyLaneCalculationMarkup(entry, "ai", index)}</td>
            </tr>
          `).join("")}</tbody>
        </table>
        ${trophyCard ? `<p class="history-detail-trophy">Claimed card: <b>${cardDisplayName(trophyCard)}</b> · Lane ${entry.trophy.lane + 1} · Power ${trophyCard.power} · ${trophyTactic.label}</p>` : ""}
      </div>
    </details>
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
          ? "You lost"
          : "Draw";
      const trophyElement = entry.trophy ? ELEMENTS[entry.trophy.card.element] : null;
      const trophyOwner = entry.trophy?.winner === "player" ? "You claimed" : "Opponent claimed";
      return `
        <article class="previous-round-entry">
          <header>
            <h3 class="history-entry-heading">
              <span class="history-round-number">ROUND <strong>${entry.round}</strong></span>
              <span class="history-round-result history-round-result-${entry.winner}">${winnerLabel}</span>
            </h3>
            <span class="history-scoreline" aria-label="Round Points: You ${entry.score.player}, Opponent ${entry.score.ai}">
              <b>${entry.score.player}</b>
              <i aria-hidden="true">–</i>
              <b>${entry.score.ai}</b>
              <small>Round Points</small>
            </span>
          </header>
          ${historyFormationGridMarkup(entry)}
          <footer class="history-trophy">
            ${entry.trophy
              ? `<span>${trophyOwner}</span><strong class="history-trophy-element"><span aria-hidden="true">${trophyElement.icon}</span> ${trophyElement.label}</strong>`
              : `<span>No trophy claimed</span>`}
          </footer>
          ${historyRoundDetailsMarkup(entry)}
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
        aria-label="Claim ${cardDisplayName(card)} from Lane ${option.lane + 1} as your trophy${needed ? "; this element is still needed" : "; this element is already complete"}"
      >
        <i aria-hidden="true">${element.icon}</i>
        <span><b>${cardDisplayName(card)}</b><small>Lane ${option.lane + 1} · ${needed ? "NEEDED" : "EXTRA"}</small></span>
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
  ui.turnMessage.innerHTML = `<strong>${artworkAdjustedCopy(title)}</strong><span>${artworkAdjustedCopy(detail)}</span>`;
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
  if (scoring.rally) parts.push(`Rally received +${scoring.rally}`);
  return {
    total: scoring.edge
      + scoring.tactic + (scoring.rally || 0),
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

// These six adjoining regions start as one card and buckle into a damp pile.
// Percentage geometry keeps the same silhouette at every board/card size.
const WATER_PAPER_FOLDS = Object.freeze([
  { clip: "polygon(0 0,54% 0,44% 27%,0 37%)", x: "-5%", y: "12%", angle: "-13deg", crease: "128deg", depth: ".29" },
  { clip: "polygon(54% 0,100% 0,100% 36%,70% 42%,44% 27%)", x: "4%", y: "15%", angle: "16deg", crease: "38deg", depth: ".26" },
  { clip: "polygon(0 37%,44% 27%,51% 61%,19% 68%,0 61%)", x: "-2%", y: "9%", angle: "9deg", crease: "155deg", depth: ".25" },
  { clip: "polygon(44% 27%,70% 42%,100% 36%,100% 71%,74% 77%,51% 61%)", x: "3%", y: "11%", angle: "-11deg", crease: "65deg", depth: ".31" },
  { clip: "polygon(0 61%,19% 68%,51% 61%,44% 100%,0 100%)", x: "-4%", y: "10%", angle: "-8deg", crease: "115deg", depth: ".28" },
  { clip: "polygon(51% 61%,74% 77%,100% 71%,100% 100%,44% 100%)", x: "2%", y: "8%", angle: "12deg", crease: "28deg", depth: ".24" },
]);

function createWaterDefeatEffect(card, { aftermath = false } = {}) {
  const effect = document.createElement("span");
  effect.className = `defeat-effect defeat-tide${aftermath ? " aftermath-remains" : ""}`;
  effect.setAttribute("aria-hidden", "true");

  const puddle = document.createElement("span");
  puddle.className = "water-puddle";
  puddle.innerHTML = `<svg viewBox="0 0 200 70" aria-hidden="true" focusable="false">
    <path fill="#285766" opacity=".32" d="M12 36C1 24 32 17 49 19C67 5 93 9 111 14C137 8 154 18 170 22C191 20 202 36 184 44C192 56 160 60 144 55C120 66 103 58 87 59C55 63 41 54 28 53C5 55 1 42 12 36Z"/>
    <path fill="#5aa5b8" opacity=".62" d="M17 32C25 22 47 27 61 19C80 10 98 19 115 20C137 14 153 28 170 28C191 29 184 40 172 44C148 55 134 47 119 52C91 56 77 48 58 51C33 50 8 42 17 32Z"/>
    <path fill="none" stroke="#c4e5df" stroke-width="2" stroke-linecap="round" opacity=".7" d="M29 33Q42 28 58 31M134 41Q153 45 169 37M68 48Q81 52 94 49"/>
  </svg>`;
  effect.append(puddle);

  const pulp = document.createElement("span");
  pulp.className = "water-pulp-body";
  pulp.innerHTML = `<svg viewBox="0 0 160 80" aria-hidden="true" focusable="false">
    <path fill="#818c7e" stroke="#3e5958" stroke-width="1.8" stroke-linejoin="round" d="M9 34C15 22 28 15 41 19L53 14C64 12 75 19 85 14C96 7 110 19 117 21C138 17 144 32 150 37L147 52C138 61 126 63 114 61C96 67 78 63 64 66L48 61C33 63 22 54 14 56L7 45Z"/>
    <path fill="#b0b7a1" d="M13 33Q30 13 48 25Q53 36 42 39L20 44ZM65 24Q85 10 100 22Q111 35 99 41L85 32ZM115 28Q137 22 145 39L120 44L106 37Z"/>
    <path fill="#4c6764" d="M20 44Q41 39 52 45L66 65L47 59Q32 63 20 50ZM51 27Q66 23 71 37L88 49L75 57L58 39ZM99 41Q112 35 123 46L136 54L114 60L100 52Z"/>
    <path fill="none" stroke="#d0d2b7" stroke-opacity=".75" stroke-width="1.4" stroke-linecap="round" d="M28 24Q45 21 43 33L28 42M72 25Q85 21 87 32L99 42M120 31Q136 29 137 40M60 46L76 57L88 51"/>
    <path fill="none" stroke="#31585b" stroke-opacity=".55" stroke-width="2" stroke-linecap="round" d="M15 51Q24 48 34 53M94 60L106 57M130 47L140 50"/>
  </svg>`;
  effect.append(pulp);

  if (!aftermath) {
    const soakingCard = createCinematicCardCopy(card, "water-soaking-card");
    const runningInk = createCinematicCardCopy(card, "water-running-ink");
    effect.append(soakingCard, runningInk);
  }

  WATER_PAPER_FOLDS.forEach((fold, index) => {
    const paper = createCinematicCardCopy(card, "water-paper-fold");
    paper.style.setProperty("--fold-clip", fold.clip);
    paper.style.setProperty("--fold-x", fold.x);
    paper.style.setProperty("--fold-y", fold.y);
    paper.style.setProperty("--fold-angle", fold.angle);
    paper.style.setProperty("--crease-angle", fold.crease);
    paper.style.setProperty("--fold-depth", fold.depth);
    paper.style.setProperty("--fold-layer", index + 3);
    effect.append(paper);
  });

  // After a board rerender, keep only settled paper and water, never replay a splash.
  if (aftermath) return effect;

  const surge = document.createElement("span");
  surge.className = "water-surge";
  surge.innerHTML = `<svg viewBox="0 0 220 260" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <g class="water-breaking-crest">
    <path class="water-wave-body" fill="#28799b" stroke="#244f67" stroke-width="2" stroke-linejoin="round" d="M8 220C25 205 33 183 31 158C25 118 32 80 57 58C83 34 119 31 147 47C173 63 180 92 167 114C160 127 148 133 134 131C151 121 154 109 149 99C142 85 122 83 111 96C97 114 104 133 122 151C151 181 174 198 210 197L218 229C184 246 140 244 107 245C58 251 25 244 8 236Z"/>
    <path fill="#56b7cc" d="M19 221C39 184 27 131 47 94C65 62 105 46 138 59C160 68 169 85 163 100C157 86 138 75 123 80C101 85 91 101 91 119C94 152 138 181 164 193C113 186 86 167 72 143C81 177 99 204 135 220C76 236 42 231 19 221Z"/>
    <path fill="#1e5579" d="M35 160C42 194 62 214 94 227C134 241 181 236 209 225L212 232Q159 253 104 243Q57 248 21 232ZM104 122C108 145 134 160 150 173C143 151 160 154 167 143C147 151 121 143 104 122Z"/>
    <path class="water-foam" fill="#e0f0e6" d="M50 72C60 46 99 31 127 40C150 45 169 62 173 81C177 102 163 124 147 127C151 119 156 114 155 107C151 111 148 106 149 99C143 101 142 93 137 90C131 95 128 88 123 89C117 98 112 92 108 102C103 102 101 109 99 114C96 95 103 81 119 77C133 72 148 77 157 86C155 66 133 51 111 51C87 49 67 60 50 72Z"/>
    <path class="water-flow-lines" fill="none" stroke="#b6e5e3" stroke-width="3" stroke-linecap="round" d="M44 165C39 117 59 83 87 72M56 181C57 149 62 122 77 101M119 185Q148 209 183 213"/>
    </g>
    <path fill="none" stroke="#eff5e5" stroke-width="3" stroke-linecap="round" d="M27 228Q48 235 63 230M83 237Q98 242 114 236M165 230L177 229M190 221L199 218"/>
  </svg>`;
  effect.append(surge);

  // The crest rolls over into a separate falling sheet, rather than shrinking
  // a rigid wave icon. Irregular tongues sweep down the actual card surface.
  const sheet = document.createElement("span");
  sheet.className = "water-drench-sheet";
  sheet.innerHTML = `<svg viewBox="0 0 200 170" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path fill="#62baca" stroke="#326f85" stroke-width="1.4" stroke-linejoin="round" d="M12 12Q33 2 53 13Q78 24 99 10Q130 1 149 16Q169 25 188 13C180 46 190 61 181 89C176 107 187 117 174 135C164 151 167 162 159 164C148 158 160 135 149 115C139 101 145 81 135 70C124 84 140 117 128 139C120 155 113 164 106 159C102 139 114 124 103 104C96 83 97 58 85 60C74 79 93 104 84 128C76 143 81 166 69 168C54 158 63 132 53 118C42 99 51 80 40 70C30 93 36 110 27 116C15 106 25 80 16 64C8 43 15 29 12 12Z"/>
    <path fill="#d8eee4" d="M16 15Q41 9 57 22Q80 34 101 20Q126 8 148 25Q167 35 183 21L181 35Q161 46 147 36Q125 21 105 33Q84 45 57 33Q35 21 16 28Z"/>
    <path fill="none" stroke="#c6e9e3" stroke-width="4" stroke-linecap="round" d="M35 35Q24 56 31 74M64 43Q69 60 66 84Q63 104 71 120M116 43Q109 63 118 84M163 48Q173 77 165 94Q158 110 167 121"/>
    <path fill="none" stroke="#2d88a1" stroke-width="3" stroke-linecap="round" d="M50 41Q43 59 52 72M94 41Q87 66 99 84M142 41Q131 57 141 80"/>
  </svg>`;
  effect.append(sheet);

  const splash = document.createElement("span");
  splash.className = "water-impact-splash";
  splash.innerHTML = `<svg viewBox="0 0 220 110" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path fill="#6cbdcd" stroke="#347c96" stroke-width="1.2" stroke-linejoin="round" d="M13 76C38 73 42 48 27 35C54 39 52 65 69 74C75 60 59 30 51 17C78 28 85 57 96 72C110 59 111 23 126 8C127 40 119 59 126 72C143 61 158 36 175 35C161 52 150 67 154 77C178 77 186 56 207 53C192 72 184 83 212 88C179 110 48 113 9 90Z"/>
    <path fill="#e4f0e5" d="M15 84Q51 78 41 51Q59 68 71 82L82 80Q79 58 68 44Q87 53 97 82L109 82Q121 65 123 40Q132 66 127 82L140 85Q154 65 166 57Q158 80 160 87Q184 86 191 73Q188 88 202 91Q163 103 116 98Q64 105 15 92Z"/>
    <path fill="none" stroke="#f4f5de" stroke-width="2" stroke-linecap="round" d="M41 91L61 94M80 93L94 91M141 94L158 96M174 91L184 89"/>
  </svg>`;
  effect.append(splash);

  const droplets = document.createElement("span");
  droplets.className = "water-droplets";
  for (let index = 0; index < 12; index += 1) {
    const droplet = document.createElement("i");
    const direction = index % 2 === 0 ? -1 : 1;
    droplet.style.setProperty("--drop-x", `${direction * (22 + (index % 4) * 7)}cqw`);
    droplet.style.setProperty("--drop-rise", `${-20 - (index % 3) * 6}cqh`);
    droplet.style.setProperty("--drop-fall", `${24 + (index % 4) * 6}cqh`);
    droplet.style.setProperty("--drop-delay", `${165 + index * 9}ms`);
    droplet.style.setProperty("--drop-size", `${4 + index % 3}%`);
    droplet.style.left = `${33 + (index % 6) * 6}%`;
    droplets.append(droplet);
  }
  effect.append(droplets);
  return effect;
}

const FIRE_CHAR_FRAGMENTS = Object.freeze([
  { clip: "polygon(12% 43%,34% 46%,43% 63%,27% 77%,10% 68%,18% 57%)", x: "-8%", y: "24%", angle: "-19deg" },
  { clip: "polygon(57% 49%,77% 41%,89% 59%,79% 74%,59% 68%,65% 59%)", x: "7%", y: "23%", angle: "17deg" },
  { clip: "polygon(36% 65%,49% 60%,65% 71%,58% 85%,38% 80%,43% 73%)", x: "0%", y: "13%", angle: "-7deg" },
]);

function createFireDefeatEffect(card, { aftermath = false } = {}) {
  const effect = document.createElement("span");
  effect.className = `defeat-effect defeat-ember${aftermath ? " aftermath-remains" : ""}`;
  effect.setAttribute("aria-hidden", "true");

  const ashes = document.createElement("span");
  ashes.className = "fire-ash-bed";
  ashes.innerHTML = `<svg viewBox="0 0 200 70" aria-hidden="true" focusable="false">
    <path fill="#3b302a" opacity=".2" d="M17 39Q40 25 71 30Q97 19 135 28Q171 24 188 42Q165 56 128 51Q82 60 52 49Q23 53 17 39Z"/>
    <g fill="#302824" stroke="#51423a" stroke-width="1" stroke-linejoin="round">
      <path d="M27 33L42 27L49 37L38 46L23 42Z"/><path d="M64 36L80 30L92 39L81 48L61 44Z"/>
      <path d="M116 29L133 23L148 36L137 46L119 43Z"/><path d="M154 40L165 34L177 40L170 49L157 48Z"/>
      <path d="M48 50L55 46L65 52L57 57Z"/><path d="M100 49L108 44L117 51L110 58Z"/>
    </g>
    <g fill="#84756a"><path d="M15 44L21 41L24 46Z"/><path d="M78 55L84 52L88 56Z"/><path d="M146 54L152 50L158 55Z"/><path d="M181 36L186 34L190 38Z"/></g>
  </svg>`;
  effect.append(ashes);

  FIRE_CHAR_FRAGMENTS.forEach((fragment, index) => {
    const paper = createCinematicCardCopy(card, "fire-char-fragment");
    paper.style.setProperty("--char-clip", fragment.clip);
    paper.style.setProperty("--char-x", fragment.x);
    paper.style.setProperty("--char-y", fragment.y);
    paper.style.setProperty("--char-angle", fragment.angle);
    paper.style.setProperty("--char-layer", index + 3);
    effect.append(paper);
  });
  if (aftermath) return effect;

  // The darker copy is burned slightly later, exposing a narrow charred edge.
  effect.append(
    createCinematicCardCopy(card, "fire-paper-char"),
    createCinematicCardCopy(card, "fire-paper-face"),
  );

  const heat = document.createElement("span");
  heat.className = "fire-contact-heat";
  effect.append(heat);

  // Broad flames behind the paper become visible through its burn holes;
  // foreground curls share their base so this reads as one engulfing fire.
  const flameShapes = [
    ["M13 98C-2 78 7 60 19 49C29 39 31 20 26 2C47 20 45 37 40 49C48 43 51 34 51 26C62 45 53 61 49 70C64 80 53 99 40 100Z", "M18 97C5 82 13 65 24 56C33 47 36 34 34 22C47 42 33 55 35 67C42 60 45 52 45 45C54 66 44 73 49 85C49 96 34 102 18 97Z", "M24 96C17 88 19 78 28 69C33 64 34 57 34 51C43 66 32 71 34 81C39 79 40 75 41 72C46 87 38 98 24 96Z"],
    ["M10 99C-4 78 12 65 12 48C12 34 3 23 6 9C14 28 31 30 29 50C41 40 48 22 42 0C63 24 54 42 46 57C39 71 60 77 52 93C46 105 23 101 10 99Z", "M16 99C4 80 24 72 20 56C30 66 38 49 41 32C49 51 32 65 35 77C42 72 46 65 45 59C59 77 48 97 37 100Z", "M23 99C16 91 25 79 29 71C38 83 33 88 40 85C44 98 32 103 23 99Z"],
    ["M8 96C-3 74 15 65 24 55C35 43 19 30 26 18C38 39 48 30 43 4C65 24 50 44 42 56C53 59 49 72 53 79C64 103 31 107 8 96Z", "M15 96C9 79 30 68 34 60C39 50 31 42 33 37C47 48 36 64 39 72C46 68 45 62 46 60C60 78 48 101 33 101Z", "M24 97C18 85 34 82 32 71C45 81 39 87 42 92C41 102 30 101 24 97Z"],
  ];
  const flameBanks = [
    { className: "fire-flame-envelope", positions: [5, 26, 48, 73, 94], widths: [32, 38, 35, 42, 30], heights: [80, 96, 87, 99, 74] },
    { className: "fire-burn-front", positions: [5, 34, 65, 94], widths: [35, 48, 46, 34], heights: [85, 68, 96, 76] },
  ];
  flameBanks.forEach((bank, bankIndex) => {
    const flames = document.createElement("span");
    flames.className = bank.className;
    bank.positions.forEach((position, index) => {
      const flame = document.createElement("span");
      flame.className = "fire-tongue";
      flame.style.left = `${position}%`;
      flame.style.width = `${bank.widths[index]}%`;
      flame.style.height = `${bank.heights[index]}%`;
      flame.style.bottom = `${index % 3 * 3}%`;
      flame.style.setProperty("--flame-sway", `${index % 2 === 0 ? -9 : 11}deg`);
      flame.style.setProperty("--flame-cycle", `${160 + (index + bankIndex) % 4 * 19}ms`);
      const [outer, body, core] = flameShapes[(index + bankIndex) % flameShapes.length];
      flame.innerHTML = `<svg viewBox="0 0 60 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path fill="#a73119" stroke="#87321d" stroke-width=".7" stroke-linejoin="round" d="${outer}"/>
        <path fill="#f26c20" d="${body}"/>
        <path fill="#ffd479" d="${core}"/>
        <path fill="#fff0b2" d="M28 98C23 92 28 84 32 80C32 88 38 89 36 94L33 99Z"/>
      </svg>`;
      flames.append(flame);
    });
    effect.append(flames);
  });

  const smoke = document.createElement("span");
  smoke.className = "fire-smoke";
  for (let index = 0; index < 3; index += 1) {
    const wisp = document.createElement("i");
    wisp.style.left = `${5 + index * 27}%`;
    wisp.style.setProperty("--smoke-drift", `${index % 2 === 0 ? -9 : 12}cqw`);
    wisp.style.setProperty("--smoke-delay", `${200 + index * 70}ms`);
    wisp.innerHTML = `<svg viewBox="0 0 90 120" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path fill="#51493f" fill-opacity=".65" d="M22 118C5 100 8 82 29 74C52 65 61 54 50 43C40 35 23 40 21 29C17 17 35 10 54 12C37 15 31 24 41 29C62 34 77 48 64 66C54 79 33 79 31 94C29 104 41 111 43 120Z"/>
      <path fill="#897d68" fill-opacity=".42" d="M30 116C16 103 21 88 40 81C61 73 73 59 67 46C82 64 63 82 47 88C31 95 31 103 41 115ZM42 31C28 27 27 21 39 17C31 26 53 27 55 37Z"/>
    </svg>`;
    smoke.append(wisp);
  }
  effect.append(smoke);

  const debris = document.createElement("span");
  debris.className = "fire-debris";
  for (let index = 0; index < 16; index += 1) {
    const fleck = document.createElement("i");
    fleck.className = index < 7 ? "fire-spark" : "fire-ash";
    fleck.style.left = `${12 + index % 7 * 12}%`;
    fleck.style.top = `${60 - index % 4 * 12}%`;
    fleck.style.setProperty("--fleck-x", `${(index % 2 === 0 ? -1 : 1) * (14 + index % 4 * 8)}cqw`);
    fleck.style.setProperty("--fleck-rise", `${-24 - index % 3 * 10}cqh`);
    fleck.style.setProperty("--fleck-delay", `${index < 7 ? 120 + index * 9 : 370 + (index - 7) * 22}ms`);
    debris.append(fleck);
  }
  effect.append(debris);
  return effect;
}

// Shared jagged edges partition the whole card exactly once. Unlike overlapping
// cutouts, these shreds can pull apart without duplicating the character/artwork.
const GUST_PAPER_SHREDS = Object.freeze([
  { clip: "polygon(0 0,46% 0,41% 9%,50% 17%,48% 26%,41% 30%,29% 22%,15% 28%,0 24%)", pivot: "25% 14%", tearX: "-9%", tearY: "2%", orbitX: "18%", orbitY: "8%", spin: "65deg", x: "-22%", y: "45%", angle: "-27deg" },
  { clip: "polygon(46% 0,100% 0,100% 23%,88% 29%,75% 24%,62% 32%,48% 26%,50% 17%,41% 9%)", pivot: "73% 16%", tearX: "8%", tearY: "3%", orbitX: "26%", orbitY: "18%", spin: "125deg", x: "23%", y: "42%", angle: "24deg" },
  { clip: "polygon(0 24%,15% 28%,29% 22%,41% 30%,48% 26%,43% 38%,53% 45%,53% 55%,44% 51%,29% 57%,13% 47%,0 52%)", pivot: "26% 40%", tearX: "-14%", tearY: "1%", orbitX: "-28%", orbitY: "-8%", spin: "-58deg", x: "-14%", y: "36%", angle: "17deg" },
  { clip: "polygon(48% 26%,62% 32%,75% 24%,88% 29%,100% 23%,100% 50%,80% 57%,66% 48%,53% 55%,53% 45%,43% 38%)", pivot: "73% 40%", tearX: "13%", tearY: "-1%", orbitX: "10%", orbitY: "-12%", spin: "92deg", x: "16%", y: "34%", angle: "-19deg" },
  { clip: "polygon(0 52%,13% 47%,29% 57%,44% 51%,53% 55%,45% 63%,51% 68%,47% 75%,42% 80%,29% 74%,12% 81%,0 75%)", pivot: "26% 65%", tearX: "-12%", tearY: "4%", orbitX: "-18%", orbitY: "-40%", spin: "-78deg", x: "-24%", y: "28%", angle: "-12deg" },
  { clip: "polygon(53% 55%,66% 48%,80% 57%,100% 50%,100% 73%,91% 78%,78% 72%,64% 79%,47% 75%,51% 68%,45% 63%)", pivot: "73% 65%", tearX: "15%", tearY: "3%", orbitX: "-32%", orbitY: "-14%", spin: "-138deg", x: "26%", y: "29%", angle: "31deg" },
  { clip: "polygon(0 75%,12% 81%,29% 74%,42% 80%,47% 75%,43% 85%,54% 91%,49% 100%,0 100%)", pivot: "25% 88%", tearX: "-7%", tearY: "7%", orbitX: "12%", orbitY: "-48%", spin: "118deg", x: "-6%", y: "23%", angle: "-22deg" },
  { clip: "polygon(47% 75%,64% 79%,78% 72%,91% 78%,100% 73%,100% 100%,49% 100%,54% 91%,43% 85%)", pivot: "73% 87%", tearX: "9%", tearY: "8%", orbitX: "-12%", orbitY: "-42%", spin: "-112deg", x: "8%", y: "24%", angle: "15deg" },
]);

function createGustDefeatEffect(card, { aftermath = false } = {}) {
  const effect = document.createElement("span");
  effect.className = `defeat-effect defeat-gust${aftermath ? " aftermath-remains" : ""}`;
  effect.setAttribute("aria-hidden", "true");

  const bed = document.createElement("span");
  bed.className = "gust-paper-bed";
  bed.innerHTML = `<svg viewBox="0 0 200 50" aria-hidden="true" focusable="false">
    <path fill="#4b402e" opacity=".16" d="M13 30Q54 20 99 24Q151 19 188 31Q151 43 101 38Q49 44 13 30Z"/>
    <g fill="#dbcfab" stroke="#968765" stroke-width=".8" stroke-linejoin="round">
      <path d="M28 29L40 26L48 30L37 34L23 32Z"/><path d="M67 37L76 31L83 34L78 40Z"/>
      <path d="M134 29L144 24L151 28L146 34Z"/><path d="M161 36L170 32L178 36L167 39Z"/>
    </g>
  </svg>`;
  effect.append(bed);

  GUST_PAPER_SHREDS.forEach((shred, index) => {
    const paper = document.createElement("span");
    paper.className = "gust-paper-shred";
    paper.style.setProperty("--shred-clip", shred.clip);
    paper.style.setProperty("--shred-pivot", shred.pivot);
    paper.style.setProperty("--tear-x", shred.tearX);
    paper.style.setProperty("--tear-y", shred.tearY);
    paper.style.setProperty("--orbit-x", shred.orbitX);
    paper.style.setProperty("--orbit-y", shred.orbitY);
    paper.style.setProperty("--shred-spin", shred.spin);
    paper.style.setProperty("--shred-x", shred.x);
    paper.style.setProperty("--shred-y", shred.y);
    paper.style.setProperty("--shred-angle", shred.angle);
    paper.style.setProperty("--shred-layer", index + 3);
    const fibre = document.createElement("span");
    fibre.className = "gust-paper-fibre";
    paper.append(fibre, createCinematicCardCopy(card, "gust-paper-face"));
    effect.append(paper);
  });
  // A rerender restores settled scraps only; it must never restart the wind.
  if (aftermath) return effect;

  const wind = document.createElement("span");
  wind.className = "gust-windfield";
  wind.innerHTML = `<svg viewBox="0 0 200 260" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path class="gust-funnel-body" fill="#649553" fill-opacity=".32" d="M18 51C51 31 149 24 183 43C178 71 143 91 154 122C159 147 131 170 129 190C130 211 104 236 100 250C89 224 71 216 70 192C68 167 44 150 50 122C54 94 27 86 18 51Z"/>
    <g fill="#83b16b" fill-opacity=".68" stroke="#456f3b" stroke-opacity=".78" stroke-width="1" stroke-linejoin="round">
      <path class="gust-wind-band" d="M9 68C22 30 127 12 178 34C196 43 197 60 182 68C161 80 104 85 71 81C127 70 180 63 174 54C155 34 59 49 9 68Z"/>
      <path class="gust-wind-band" d="M18 128C32 91 132 65 169 87C200 109 140 137 67 133C120 120 170 113 160 104C137 90 64 105 18 128Z"/>
      <path class="gust-wind-band" d="M44 179C60 146 130 126 152 145C174 167 128 190 77 189C119 173 151 165 139 157C121 148 79 166 44 179Z"/>
      <path class="gust-wind-band" d="M70 222C82 196 115 181 132 193C154 210 113 241 100 251C112 219 134 218 121 212C110 205 89 217 70 222Z"/>
    </g>
    <g class="gust-flow-lines" fill="none" stroke="#d0e8ad" stroke-opacity=".92" stroke-width="3.5" stroke-linecap="round">
      <path d="M24 51C65 20 167 22 181 45C194 68 127 81 86 79"/>
      <path d="M34 113C82 81 161 78 174 100C187 121 137 133 85 134"/>
      <path d="M59 164C91 142 139 135 149 154C159 170 127 187 91 187"/>
      <path d="M81 214Q114 190 130 202Q140 216 108 239"/>
    </g>
  </svg>`;
  effect.append(wind);

  // These near-side currents cross in front of the paper; the rear funnel sits
  // behind it, so the shreds move through the vortex instead of under an icon.
  const frontWind = document.createElement("span");
  frontWind.className = "gust-frontwind";
  frontWind.innerHTML = `<svg viewBox="0 0 200 260" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <g fill="#91bf72" fill-opacity=".78" stroke="#527d41" stroke-opacity=".68" stroke-width="1" stroke-linejoin="round">
      <path class="gust-front-band" d="M14 62C38 84 139 98 187 66C179 98 96 126 37 98C17 89 12 73 14 62Z"/>
      <path class="gust-front-band" d="M33 125C67 142 136 145 165 125C164 151 119 176 70 159C44 151 34 139 33 125Z"/>
      <path class="gust-front-band" d="M57 180C77 190 119 189 142 178C138 201 106 216 83 204C67 197 59 189 57 180Z"/>
      <path class="gust-front-band" d="M79 224Q100 232 122 218Q120 241 100 249Q83 242 79 224Z"/>
    </g>
    <g class="gust-speed-lines" fill="none" stroke="#e0efc4" stroke-width="3.5" stroke-linecap="round">
      <path d="M16 69C52 107 150 108 182 79M38 135C75 166 139 161 160 141M63 188Q104 219 137 187M84 231Q103 249 119 230"/>
    </g>
  </svg>`;
  effect.append(frontWind);

  const dust = document.createElement("span");
  dust.className = "gust-paper-dust";
  for (let index = 0; index < 18; index += 1) {
    const fleck = document.createElement("i");
    fleck.style.left = `${31 + index % 5 * 9}%`;
    fleck.style.top = `${35 + index % 4 * 11}%`;
    fleck.style.setProperty("--dust-x", `${(index % 2 === 0 ? -1 : 1) * (24 + index % 4 * 8)}cqw`);
    fleck.style.setProperty("--dust-y", `${-20 - index % 3 * 13}cqh`);
    fleck.style.setProperty("--dust-delay", `${170 + index * 13}ms`);
    dust.append(fleck);
  }
  effect.append(dust);
  return effect;
}

function createDefeatEffect(lane, winningElement, { aftermath = false } = {}) {
  const card = lane.querySelector(".game-card");
  if (!card) return null;

  if (winningElement === "tide") {
    const waterEffect = createWaterDefeatEffect(card, { aftermath });
    lane.classList.add("cinematic-defeat", "defeated-by-tide");
    lane.append(waterEffect);
    return waterEffect;
  }

  if (winningElement === "ember") {
    const fireEffect = createFireDefeatEffect(card, { aftermath });
    lane.classList.add("cinematic-defeat", "defeated-by-ember");
    lane.append(fireEffect);
    return fireEffect;
  }

  if (winningElement === "gust") {
    const gustEffect = createGustDefeatEffect(card, { aftermath });
    lane.classList.add("cinematic-defeat", "defeated-by-gust");
    lane.append(gustEffect);
    return gustEffect;
  }
  return null;
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
        `${cardDisplayName(playerCards[index])} scores ${laneScore.player.total} against ${laneScore.ai.total}.`,
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
          `${cardDisplayName(winningCard)} ${defeatCopy}`,
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
  ui.aiPlayZone.innerHTML = placeholder(`Revealing the opponent's ${state.aiPlan.length}-card plan...`);
  setMessage("The sealed formation opens...", "The opponent committed this plan before your choice.");
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
      `${clashCount} ${clashCount === 1 ? "lane will clash" : "lanes will clash"}; every extra card adds 1 Round Point${isFourLaneMode() ? ", up to 2 per side per round" : ""}.`,
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
  state.discardPile.push(...playerCards.filter((card) => card !== reward?.card));
  (isFourLaneMode() ? state.aiDiscardPile : state.discardPile)
    .push(...aiCards.filter((card) => card !== reward?.card));

  if (claimMessage && reward?.card) {
    setMessage(
      `${cardDisplayName(reward.card)} becomes your trophy!`,
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
  ui.versusBadge.className = "versus-badge has-score";

  ui.versusBadge.textContent = `${score.player}–${score.ai}`;

  if (winner === "player") {
    state.playerRoundWins += 1;
    if (rewardOptions[0]?.fixed) {
      reward = rewardOptions[0] || null;
      setMessage(
        `Your extra cards win the round, ${score.player}–${score.ai} Round Points!`,
        `${cardDisplayName(reward.card)}, your first extra card, becomes the round trophy.`,
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
        `Lane ${reward.lane + 1}'s ${cardDisplayName(reward.card)} becomes your round trophy.`,
      );
    }
    ui.versusBadge.classList.add("win");
    audio.roundResult("win");
  } else if (winner === "ai") {
    state.aiRoundWins += 1;
    reward = rewardOptions[0]?.fixed
      ? rewardOptions[0] || null
      : chooseTrophyReward(rewardOptions, state.aiWins);
    if (reward?.fixed) {
      setMessage(
        `The opponent's extra cards win ${score.ai}–${score.player}.`,
        `${cardDisplayName(reward.card)}, the first extra card, becomes the opponent's trophy.`,
      );
    } else {
      setMessage(
        `The opponent wins with ${score.ai}–${score.player} Round Points.`,
        `The opponent claims ${cardDisplayName(reward.card)} from lane ${reward.lane + 1}.`,
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
    : "The opponent prevails!";
  const resultSummary = won
    ? "You claimed two trophies from every element."
    : "The opponent completed all six elemental trophy slots first.";
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

function isGameMenuOpen() {
  return !ui.gameMenuOverlay.hidden;
}

function openGameMenu() {
  if (isGameMenuOpen()) return;
  gameMenuPreviousFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  configureGameMenu();
  ui.gameMenuOverlay.hidden = false;
  ui.menuButton.setAttribute("aria-expanded", "true");
  ui.resumeGameButton.focus({ preventScroll: true });
}

function closeGameMenu({ restoreFocus = true } = {}) {
  if (!isGameMenuOpen()) return;
  ui.gameMenuOverlay.hidden = true;
  ui.menuButton.setAttribute("aria-expanded", "false");

  const focusTarget = gameMenuPreviousFocus;
  gameMenuPreviousFocus = null;
  if (restoreFocus && focusTarget?.isConnected && !focusTarget.hidden) {
    focusTarget.focus({ preventScroll: true });
  }
}

function trapGameMenuFocus(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeGameMenu();
    return;
  }
  if (event.key !== "Tab") return;

  const focusable = [...ui.gameMenuDialog.querySelectorAll("button:not([disabled]):not([hidden])")];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function fullscreenAvailable() {
  const root = document.documentElement;
  const standardAvailable = typeof root.requestFullscreen === "function"
    && document.fullscreenEnabled !== false;
  return standardAvailable || typeof root.webkitRequestFullscreen === "function";
}

function renderFullscreenControls(statusMessage = "") {
  const active = Boolean(fullscreenElement());
  const available = fullscreenAvailable();
  const label = active ? "Exit Fullscreen" : "Fullscreen";
  const defaultTitle = active
    ? "Return to the normal browser window"
    : "Hide the browser controls and use the whole screen";

  [ui.mainMenuFullscreenButton, ui.gameFullscreenButton].forEach((button) => {
    button.hidden = !available;
    button.textContent = label;
    button.disabled = !available;
    button.setAttribute("aria-pressed", String(active));
    button.title = available
      ? statusMessage || defaultTitle
      : "This browser does not allow webpages to enter fullscreen";
  });
}

async function toggleFullscreen() {
  try {
    if (fullscreenElement()) {
      if (typeof document.exitFullscreen === "function") {
        await document.exitFullscreen();
      } else if (typeof document.webkitExitFullscreen === "function") {
        await Promise.resolve(document.webkitExitFullscreen());
      }
    } else {
      const root = document.documentElement;
      if (typeof root.requestFullscreen === "function") {
        await root.requestFullscreen({ navigationUI: "hide" });
      } else if (typeof root.webkitRequestFullscreen === "function") {
        await Promise.resolve(root.webkitRequestFullscreen());
      }
    }
    renderFullscreenControls();
    return true;
  } catch {
    renderFullscreenControls("Fullscreen was blocked. Tap the button to try again.");
    return false;
  }
}

async function toggleGameFullscreen() {
  const reopenMenuOnFailure = isGameMenuOpen();
  closeGameMenu({ restoreFocus: false });
  const fullscreenChanged = await toggleFullscreen();

  if (reopenMenuOnFailure && !fullscreenChanged && !isGameMenuOpen()) {
    openGameMenu();
  }
}

function saveClashStyle(clashStyle) {
  try {
    window.localStorage.setItem(CLASH_STYLE_STORAGE_KEY, clashStyle);
    return true;
  } catch {
    return false;
  }
}

function saveArtworkStyle(artworkStyle) {
  try {
    const enabledStyle = ARTWORK_STYLES.includes(artworkStyle) ? artworkStyle : "illustrated";
    window.localStorage.setItem(ARTWORK_STYLE_STORAGE_KEY, enabledStyle);
    return true;
  } catch {
    return false;
  }
}

function saveBoardTheme(boardTheme) {
  try {
    window.localStorage.setItem(BOARD_THEME_STORAGE_KEY, boardTheme);
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

function renderArtworkSettings(saved = true) {
  if (!ARTWORK_STYLES.includes(state.artworkStyle)) state.artworkStyle = "illustrated";
  ui.artworkSettingsTab.hidden = !PHOTOGRAPHIC_ARTWORK_ENABLED;
  document.querySelectorAll('input[name="artworkStyle"]').forEach((option) => {
    option.checked = option.value === state.artworkStyle;
    option.disabled = !PHOTOGRAPHIC_ARTWORK_ENABLED;
  });
  const photographicCount = Object.keys(PHOTOGRAPHIC_CARD_ART).length;
  const portraitVerb = photographicCount === 1 ? "has" : "have";
  if (state.artworkStyle === "photographic") {
    ui.artworkSettingsStatus.textContent = saved
      ? `Photographic artwork is saved. ${photographicCount} of ${CARD_LIBRARY.length} cards currently ${portraitVerb} a real pet portrait; the remaining cards use illustrated artwork.`
      : `Photographic artwork is active for this session. ${photographicCount} of ${CARD_LIBRARY.length} cards currently ${portraitVerb} a real pet portrait; browser storage is unavailable.`;
  } else {
    ui.artworkSettingsStatus.textContent = saved
      ? "Illustrated card artwork is selected and saved for this browser."
      : "Illustrated card artwork is selected for this session. Browser storage is unavailable.";
  }
  updateDisplayedCardArtwork();
  renderGallery();
  renderPreviousRoundsHistory();
  if (tutorial.active) renderTutorialCoach();
}

function renderBoardSettings(saved = true) {
  document.documentElement.dataset.boardTheme = state.boardTheme;
  document.querySelectorAll('input[name="boardTheme"]').forEach((option) => {
    option.checked = option.value === state.boardTheme;
  });
  const themeLabel = state.boardTheme === "tabletop" ? "Tabletop" : "Map";
  ui.boardSettingsStatus.textContent = saved
    ? `${themeLabel} is selected and saved for this browser.`
    : `${themeLabel} is selected for this session. Browser storage is unavailable.`;
}

function renderSettings(clashSaved = true, audioSaved = true, artworkSaved = true, boardSaved = true) {
  document.querySelectorAll('input[name="clashStyle"]').forEach((option) => {
    option.checked = option.value === state.clashStyle;
  });
  const styleLabel = state.clashStyle === "cinematic" ? "Cinematic" : "Classic";
  ui.settingsStatus.textContent = clashSaved
    ? `${styleLabel} clashes are selected and saved for this browser.`
    : `${styleLabel} clashes are selected for this session. Browser storage is unavailable.`;
  renderArtworkSettings(artworkSaved);
  renderBoardSettings(boardSaved);
  renderAudioSettings(audioSaved);
}

function showSettingsPanel(panelName) {
  const available = [...ui.settingsTabs].some((tab) => (
    tab.dataset.settingsPanel === panelName && !tab.hidden
  ));
  if (!available) panelName = "audio";
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
  closeGameMenu({ restoreFocus: false });
  renderSettings();
  showSettingsPanel("audio");
  if (!ui.settingsDialog.open) ui.settingsDialog.showModal();
}

function showMainMenu() {
  hideFourLanePreview();
  state.locked = true;
  stopTutorialMode();
  audio.startMainMenuMusic();
  closeGameMenu({ restoreFocus: false });
  closeDialog(ui.difficultyDialog);
  closeDialog(ui.tutorialMenuDialog);
  closeDialog(ui.resultDialog);
  closeDialog(ui.previousRoundsHistoryDialog);
  closeDialog(ui.fourLaneRulesDialog);
  setGameMenuVisibility(false);
  ui.mainMenuScreen.hidden = false;
  document.body.classList.add("main-menu-active");
}

function hideFourLanePreview() {
  fourLaneDeckEditor.close(true);
  ui.fourLanePreviewScreen.hidden = true;
  fourLanePreviewBackground.forEach(({ element, inert }) => { element.inert = inert; });
  fourLanePreviewBackground = [];
}

function renderFourLaneCards() {
  ui.fourLaneCardGallery.innerHTML = FOUR_LANE_CARDS.map((card) => `
    <div class="four-lane-card-item" role="listitem">
      ${cardMarkup(card, false, -1, "four-lane-preview")}
    </div>
  `).join("");
}

function renderFourLaneOpponents() {
  const choices = [{ id: "random", name: "Random Rival", theme: "Mystery matchup",
    description: "Face one of the four rival decks. Recommended for Blind." }, ...fourLaneOpponentRoster];
  document.querySelector("#fourLaneRivalOptions").innerHTML = choices.map(rival => `
    <label class="four-lane-rival-option${rival.id === "random" ? " is-random" : ""}">
      <input type="radio" name="fourLaneRival" value="${rival.id}" ${selectedFourLaneOpponent === rival.id ? "checked" : ""}>
      <span><b>${rival.name}</b><small>${rival.theme}</small><span>${rival.description}</span></span>
    </label>
  `).join("");
}

function showFourLaneLobbyStep(step = "deck") {
  const choosingRival = step === "rival" && Boolean(confirmedFourLaneDeck);
  ui.fourLaneDeckPage.hidden = choosingRival;
  ui.fourLaneRivalPage.hidden = !choosingRival;
  ui.fourLaneDeckStep.removeAttribute("aria-current");
  ui.fourLaneRivalStep.removeAttribute("aria-current");
  (choosingRival ? ui.fourLaneRivalStep : ui.fourLaneDeckStep).setAttribute("aria-current", "step");
  if (choosingRival) {
    const summary = constructedDecks.validateDeck(fourLaneDeckCatalog, confirmedFourLaneDeck).summary;
    ui.fourLaneConfirmedDeckName.textContent = confirmedFourLaneDeck.name;
    ui.fourLaneConfirmedDeckSummary.textContent = `${summary.count} cards · ${summary.totalCost}/${constructedDecks.MAX_DECK_COST} cost · `
      + constructedDecks.ELEMENTS.map(element => `${ELEMENTS[element].label} ${summary.elementCounts[element]}`).join(" · ");
  } else {
    confirmedFourLaneDeck = null;
  }
  ui.fourLanePreviewScreen.scrollTop = 0;
  (choosingRival ? ui.fourLaneRivalTitle : ui.fourLaneDeckChoiceTitle).focus({ preventScroll: true });
}

function confirmFourLaneDeck() {
  const selected = fourLaneDeckEditor.getSelectedDeck();
  if (!constructedDecks.validateDeck(fourLaneDeckCatalog, selected).valid) return;
  // Confirmation locks the deck for the rival/difficulty steps, not the save file.
  confirmedFourLaneDeck = Object.freeze({ version: selected.version, name: selected.name, cards: Object.freeze([...selected.cards]) });
  showFourLaneLobbyStep("rival");
}

function showFourLanePreview(step = "deck") {
  showMainMenu();
  ui.mainMenuScreen.hidden = true;
  fourLanePreviewBackground = [...document.querySelectorAll(".topbar, body > main")]
    .map((element) => ({ element, inert: element.inert }));
  fourLanePreviewBackground.forEach(({ element }) => { element.inert = true; });
  ui.fourLanePreviewScreen.hidden = false;
  fourLaneDeckEditor.renderLobby();
  renderFourLaneOpponents();
  renderFourLaneCards();
  showFourLaneLobbyStep(step);
}

function leaveFourLanePreview() {
  showMainMenu();
  ui.mainMenuFourLaneButton.focus({ preventScroll: true });
}

function showTutorialMenu() {
  showMainMenu();
  if (!ui.tutorialMenuDialog.open) ui.tutorialMenuDialog.showModal();
}

function showDifficultyChooser(returnTarget = "main") {
  pendingDuelMode = returnTarget === "four-lane" || (returnTarget === "game" && isFourLaneMode()) ? "four-lane" : "normal";
  if (returnTarget === "four-lane") {
    if (!confirmedFourLaneDeck || !constructedDecks.validateDeck(fourLaneDeckCatalog, confirmedFourLaneDeck).valid) return;
    // Immutable snapshot: restarting/changing difficulty keeps this match's deck,
    // even if the saved selection is changed in a later lobby visit.
    matchFourLaneDeck = confirmedFourLaneDeck;
    matchFourLaneOpponent = fourLaneOpponents.createEncounter(fourLaneOpponentRoster, selectedFourLaneOpponent);
    hideFourLanePreview();
  }
  document.querySelector("#difficultyIntro").textContent =
    `Build one to ${pendingDuelMode === "four-lane" ? "four" : "three"} cards and review completed rounds in Previous Rounds History. Guided reveals live clues, Instinct reveals habits, and Blind conceals both.`;
  document.querySelector(".instinct-option em").textContent =
    `Build one to ${pendingDuelMode === "four-lane" ? "four" : "three"} cards directly and read the opponent's behavior.`;
  difficultyReturnTarget = returnTarget;
  difficultyPreviousLockedState = state.locked;
  stopTutorialMode();
  state.locked = true;
  ui.mainMenuScreen.hidden = true;
  document.body.classList.remove("main-menu-active");
  closeGameMenu({ restoreFocus: false });
  setGameMenuVisibility(false);
  if (!ui.difficultyDialog.open) ui.difficultyDialog.showModal();
}

function leaveDifficultyChooser() {
  closeDialog(ui.difficultyDialog);
  if (difficultyReturnTarget === "game") {
    state.locked = difficultyPreviousLockedState;
    setGameMenuVisibility(true);
    openGameMenu();
    return;
  }
  if (difficultyReturnTarget === "four-lane") {
    showFourLanePreview("rival");
    return;
  }
  showMainMenu();
}

async function startGame() {
  stopTutorialMode();
  audio.startDuelMusic();
  clearCinematicRemains();
  hideFourLanePreview();
  ui.mainMenuScreen.hidden = true;
  document.body.classList.remove("main-menu-active");
  renderDuelMode();
  state.deck = isFourLaneMode() ? freshPersonalDeck("player") : freshDeck();
  state.aiDeck = isFourLaneMode() ? freshPersonalDeck("opponent") : [];
  state.aiDiscardPile = [];
  state.discardPile = [];
  state.playerHand = [];
  state.aiHand = [];
  state.playerWins = [];
  state.aiWins = [];
  state.aiPlan = [];
  state.aiTellClues = [];
  state.aiTraits = isFourLaneMode() ? [...matchFourLaneOpponent.traits]
    : usesPersistentAiHabits() ? createAiTraits() : [];
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
  refillHands(true);
  prepareAiPlan();
  if (isFourLaneMode()) renderOpponentTells();
  renderFormationControls();
  ui.playerPlayZone.innerHTML = placeholder("Preparing formation");
  ui.aiPlayZone.innerHTML = placeholder("Formation sealed");
  ui.versusBadge.textContent = "VS";
  ui.versusBadge.className = "versus-badge";
  setMessage("The deck is shuffling...", "The opponent is preparing the opening deal.");
  renderCollection(ui.playerCollection, []);
  renderCollection(ui.aiCollection, []);
  renderHand();
  ui.playerHand.classList.add("waiting-for-deal");
  renderRound();
  renderRoundScore();
  await playDeckTransition("opening");
  setMessage("Drawing your opening hand...", `${isFourLaneMode() ? "Seven" : "Six"} cards are being dealt for the first round.`);
  await animateHandDraw(state.playerHand.length, true);
  state.dealing = false;
  ui.menuButton.disabled = false;
  beginFormationBuilding();
}

document.querySelector("#howButton").addEventListener("click", () => (isFourLaneMode() ? ui.fourLaneRulesDialog : ui.howDialog).showModal());
document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => ui.howDialog.close());
});
document.querySelector("#rulebookButton").addEventListener("click", () => (isFourLaneMode() ? ui.fourLaneRulesDialog : ui.rulebookDialog).showModal());
document.querySelectorAll("[data-close-four-lane-rules]").forEach(button => {
  button.addEventListener("click", () => ui.fourLaneRulesDialog.close());
});
document.querySelectorAll("[data-close-rulebook]").forEach((button) => {
  button.addEventListener("click", () => ui.rulebookDialog.close());
});
ui.previousRoundsHistoryButton.addEventListener("click", () => {
  renderPreviousRoundsHistory();
  if (!ui.previousRoundsHistoryDialog.open) {
    ui.previousRoundsHistoryDialog.showModal();
    ui.previousRoundsHistoryList.scrollTop = 0;
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
    renderGallery();
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
  if (isFourLaneMode()) showFourLanePreview();
  else showDifficultyChooser("main");
});
ui.mainMenuPlayButton.addEventListener("click", () => showDifficultyChooser("main"));
ui.mainMenuTutorialButton.addEventListener("click", showTutorialMenu);
ui.mainMenuFourLaneButton.addEventListener("click", () => showFourLanePreview());
ui.fourLaneReturnButton.addEventListener("click", leaveFourLanePreview);
ui.fourLaneConfirmDeckButton.addEventListener("click", confirmFourLaneDeck);
ui.fourLaneChangeDeckButton.addEventListener("click", () => showFourLaneLobbyStep("deck"));
ui.fourLaneStartButton.addEventListener("click", () => showDifficultyChooser("four-lane"));
document.querySelector("#fourLaneRivalOptions").addEventListener("change", (event) => {
  const input = event.target;
  if (!input.matches('input[name="fourLaneRival"]') || !input.checked) return;
  if (input.value === "random" || fourLaneOpponentRoster.some(rival => rival.id === input.value)) {
    selectedFourLaneOpponent = input.value;
  }
});
ui.fourLanePreviewScreen.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  event.preventDefault();
  if (!ui.fourLaneRivalPage.hidden) showFourLaneLobbyStep("deck");
  else leaveFourLanePreview();
});
ui.mainMenuRulebookButton.addEventListener("click", () => ui.rulebookDialog.showModal());
ui.mainMenuSettingsButton.addEventListener("click", () => openSettings("main"));
ui.mainMenuFullscreenButton.addEventListener("click", toggleFullscreen);
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
  if (!ui.menuButton.disabled && !isGameMenuOpen()) openGameMenu();
});
ui.resumeGameButton.addEventListener("click", () => closeGameMenu());
ui.restartGameButton.addEventListener("click", () => {
  closeGameMenu({ restoreFocus: false });
  if (tutorial.active) {
    startTutorial(tutorial.mode, tutorial.entryLessonIndex);
  } else {
    startGame();
  }
});
ui.changeDifficultyButton.addEventListener("click", () => showDifficultyChooser("game"));
ui.gameSettingsButton.addEventListener("click", () => openSettings("game"));
ui.gameFullscreenButton.addEventListener("click", toggleGameFullscreen);
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
ui.gameMenuOverlay.addEventListener("keydown", trapGameMenuFocus);
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
document.querySelectorAll('input[name="artworkStyle"]').forEach((option) => {
  option.addEventListener("change", () => {
    if (option.disabled || !option.checked || !ARTWORK_STYLES.includes(option.value)) return;
    state.artworkStyle = option.value;
    renderArtworkSettings(saveArtworkStyle(state.artworkStyle));
  });
});
document.querySelectorAll('input[name="boardTheme"]').forEach((option) => {
  option.addEventListener("change", () => {
    if (!option.checked || !BOARD_THEMES.includes(option.value)) return;
    state.boardTheme = option.value;
    renderBoardSettings(saveBoardTheme(state.boardTheme));
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
    && !isGameMenuOpen()
    && !ui.resultDialog.open
  ) {
    openGameMenu();
  }
});
document.querySelectorAll("[data-difficulty]").forEach((button) => {
  button.addEventListener("click", () => {
    const difficulty = button.dataset.difficulty;
    if (!DIFFICULTIES[difficulty]) return;
    state.difficulty = difficulty;
    state.gameMode = pendingDuelMode;
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

document.addEventListener("fullscreenchange", () => renderFullscreenControls());
document.addEventListener("webkitfullscreenchange", () => renderFullscreenControls());
document.addEventListener("fullscreenerror", () => {
  renderFullscreenControls("Fullscreen was blocked. Tap the button to try again.");
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
  saveArtworkStyle(state.artworkStyle),
  saveBoardTheme(state.boardTheme),
);
renderFullscreenControls();
showMainMenu();
