export const ELEMENTS = Object.freeze({
  ember: Object.freeze({ id: "ember", label: "Ember", icon: "🔥", beats: "gust" }),
  gust: Object.freeze({ id: "gust", label: "Gust", icon: "🍃", beats: "tide" }),
  tide: Object.freeze({ id: "tide", label: "Tide", icon: "💧", beats: "ember" }),
});

export const CLASS_FORMS = Object.freeze({
  "ember-knight": Object.freeze({
    id: "ember-knight",
    name: "Ember Knight",
    element: "ember",
    icon: "⚔",
    maxHealth: 48,
    summary: "Press the attack, kindle Burn, and finish fights before they grow dangerous.",
    passiveName: "First Spark",
    passive: "Your first Attack each turn also applies 1 Burn.",
    ultimateName: "Furnace Pounce",
    ultimate: "Deal 12 damage and apply 3 Burn.",
    starterCards: Object.freeze(["spark-slash", "kindled-guard"]),
  }),
  "gust-ranger": Object.freeze({
    id: "gust-ranger",
    name: "Gust Ranger",
    element: "gust",
    icon: "➶",
    maxHealth: 44,
    summary: "Cycle techniques quickly, create extra Energy, and answer changing intentions.",
    passiveName: "Three-Step Flow",
    passive: "Every third card played in a turn draws 1 card.",
    ultimateName: "Skybreak Sprint",
    ultimate: "Gain 2 Energy, draw 3 cards, and gain 6 Guard.",
    starterCards: Object.freeze(["breeze-cut", "leafscreen"]),
  }),
  "tide-warden": Object.freeze({
    id: "tide-warden",
    name: "Tide Warden",
    element: "tide",
    icon: "◆",
    maxHealth: 54,
    summary: "Build dependable Guard, preserve it between turns, and recover from costly hits.",
    passiveName: "Lingering Ward",
    passive: "Retain up to 3 unused Guard when your next turn begins.",
    ultimateName: "Moonwell Aegis",
    ultimate: "Gain 12 Guard and restore 4 Health.",
    starterCards: Object.freeze(["current-swipe", "pearl-guard"]),
  }),
});

export const CARD_LIBRARY = Object.freeze({
  strike: Object.freeze({
    id: "strike", name: "Strike", element: null, type: "Attack", cost: 1,
    damage: 6, description: "Deal 6 damage.", upgrade: Object.freeze({ damage: 2 }),
  }),
  brace: Object.freeze({
    id: "brace", name: "Brace", element: null, type: "Guard", cost: 1,
    block: 5, description: "Gain 5 Guard.", upgrade: Object.freeze({ block: 3 }),
  }),
  feint: Object.freeze({
    id: "feint", name: "Feint", element: null, type: "Technique", cost: 1,
    damage: 4, draw: 1, description: "Deal 4 damage. Draw 1 card.",
    upgrade: Object.freeze({ damage: 2 }),
  }),
  fortify: Object.freeze({
    id: "fortify", name: "Fortify", element: null, type: "Guard", cost: 2,
    block: 11, description: "Gain 11 Guard.", upgrade: Object.freeze({ block: 4 }),
  }),
  "keen-strike": Object.freeze({
    id: "keen-strike", name: "Keen Strike", element: null, type: "Attack", cost: 1,
    damage: 8, description: "Deal 8 damage.", upgrade: Object.freeze({ damage: 3 }),
  }),

  "spark-slash": Object.freeze({
    id: "spark-slash", name: "Spark Slash", element: "ember", type: "Attack", cost: 1,
    damage: 5, burn: 1, description: "Deal 5 damage. Apply 1 Burn.",
    upgrade: Object.freeze({ damage: 2, burn: 1 }),
  }),
  "kindled-guard": Object.freeze({
    id: "kindled-guard", name: "Kindled Guard", element: "ember", type: "Guard", cost: 1,
    block: 5, prowl: 1, description: "Gain 5 Guard and 1 additional Prowl.",
    upgrade: Object.freeze({ block: 3 }),
  }),
  "searing-lunge": Object.freeze({
    id: "searing-lunge", name: "Searing Lunge", element: "ember", type: "Attack", cost: 2,
    damage: 10, burn: 2, description: "Deal 10 damage. Apply 2 Burn.",
    upgrade: Object.freeze({ damage: 3, burn: 1 }),
  }),
  "hearthguard": Object.freeze({
    id: "hearthguard", name: "Hearthguard", element: "ember", type: "Guard", cost: 1,
    block: 7, heal: 1, description: "Gain 7 Guard. Restore 1 Health.",
    upgrade: Object.freeze({ block: 2, heal: 1 }),
  }),
  "cinder-rush": Object.freeze({
    id: "cinder-rush", name: "Cinder Rush", element: "ember", type: "Attack", cost: 1,
    damage: 4, hits: 2, description: "Deal 4 damage twice.",
    upgrade: Object.freeze({ damage: 1, hits: 1 }),
  }),
  "stoke-the-coals": Object.freeze({
    id: "stoke-the-coals", name: "Stoke the Coals", element: "ember", type: "Technique", cost: 0,
    draw: 1, prowl: 1, exhaust: true,
    description: "Draw 1 card and gain 1 additional Prowl. Exhaust.",
    upgrade: Object.freeze({ draw: 1 }),
  }),

  "breeze-cut": Object.freeze({
    id: "breeze-cut", name: "Breeze Cut", element: "gust", type: "Attack", cost: 1,
    damage: 5, draw: 1, description: "Deal 5 damage. Draw 1 card.",
    upgrade: Object.freeze({ damage: 2 }),
  }),
  leafscreen: Object.freeze({
    id: "leafscreen", name: "Leafscreen", element: "gust", type: "Guard", cost: 1,
    block: 5, draw: 1, description: "Gain 5 Guard. Draw 1 card.",
    upgrade: Object.freeze({ block: 2 }),
  }),
  tailwind: Object.freeze({
    id: "tailwind", name: "Tailwind", element: "gust", type: "Technique", cost: 0,
    energy: 1, exhaust: true, description: "Gain 1 Energy. Exhaust.",
    upgrade: Object.freeze({ draw: 1 }),
  }),
  "whirlwind-volley": Object.freeze({
    id: "whirlwind-volley", name: "Whirlwind Volley", element: "gust", type: "Attack", cost: 2,
    damage: 4, hits: 3, description: "Deal 4 damage three times.",
    upgrade: Object.freeze({ damage: 1 }),
  }),
  crosswind: Object.freeze({
    id: "crosswind", name: "Crosswind", element: "gust", type: "Technique", cost: 2,
    damage: 6, block: 6, description: "Deal 6 damage and gain 6 Guard.",
    upgrade: Object.freeze({ damage: 2, block: 2 }),
  }),
  slipstream: Object.freeze({
    id: "slipstream", name: "Slipstream", element: "gust", type: "Technique", cost: 1,
    draw: 2, description: "Draw 2 cards.", upgrade: Object.freeze({ cost: -1 }),
  }),

  "current-swipe": Object.freeze({
    id: "current-swipe", name: "Current Swipe", element: "tide", type: "Attack", cost: 1,
    damage: 5, block: 2, description: "Deal 5 damage and gain 2 Guard.",
    upgrade: Object.freeze({ damage: 2, block: 2 }),
  }),
  "pearl-guard": Object.freeze({
    id: "pearl-guard", name: "Pearl Guard", element: "tide", type: "Guard", cost: 1,
    block: 8, description: "Gain 8 Guard.", upgrade: Object.freeze({ block: 3 }),
  }),
  undertow: Object.freeze({
    id: "undertow", name: "Undertow", element: "tide", type: "Attack", cost: 2,
    damage: 9, block: 4, description: "Deal 9 damage and gain 4 Guard.",
    upgrade: Object.freeze({ damage: 3, block: 2 }),
  }),
  moonwell: Object.freeze({
    id: "moonwell", name: "Moonwell", element: "tide", type: "Technique", cost: 2,
    block: 5, heal: 5, description: "Gain 5 Guard. Restore 5 Health.",
    upgrade: Object.freeze({ block: 2, heal: 2 }),
  }),
  "tidal-wall": Object.freeze({
    id: "tidal-wall", name: "Tidal Wall", element: "tide", type: "Guard", cost: 2,
    block: 13, description: "Gain 13 Guard.", upgrade: Object.freeze({ block: 5 }),
  }),
  "deep-breath": Object.freeze({
    id: "deep-breath", name: "Deep Breath", element: "tide", type: "Technique", cost: 1,
    block: 3, draw: 2, description: "Gain 3 Guard. Draw 2 cards.",
    upgrade: Object.freeze({ block: 2 }),
  }),
});

export const CLASS_REWARD_POOLS = Object.freeze({
  "ember-knight": Object.freeze(["searing-lunge", "hearthguard", "cinder-rush", "stoke-the-coals", "feint", "fortify", "keen-strike"]),
  "gust-ranger": Object.freeze(["tailwind", "whirlwind-volley", "crosswind", "slipstream", "feint", "fortify", "keen-strike"]),
  "tide-warden": Object.freeze(["undertow", "moonwell", "tidal-wall", "deep-breath", "feint", "fortify", "keen-strike"]),
});

export const TALENTS = Object.freeze({
  "ember-knight": Object.freeze([
    Object.freeze({ id: "tempered-claws", name: "Tempered Claws", description: "All Attacks deal +1 damage.", attackBonus: 1 }),
    Object.freeze({ id: "long-fuse", name: "Long Fuse", description: "Whenever you apply Burn, apply 1 more.", burnBonus: 1 }),
    Object.freeze({ id: "forge-heart", name: "Forge Heart", description: "Gain 6 maximum Health and heal 6.", maxHealth: 6 }),
  ]),
  "gust-ranger": Object.freeze([
    Object.freeze({ id: "razor-breeze", name: "Razor Breeze", description: "All Attacks deal +1 damage.", attackBonus: 1 }),
    Object.freeze({ id: "headwind", name: "Headwind", description: "Begin each battle with 5 Guard.", startingGuard: 5 }),
    Object.freeze({ id: "open-sky", name: "Open Sky", description: "Draw 1 additional card on your first turn.", openingDraw: 1 }),
  ]),
  "tide-warden": Object.freeze([
    Object.freeze({ id: "deep-shell", name: "Deep Shell", description: "Every Guard card grants +2 Guard.", guardBonus: 2 }),
    Object.freeze({ id: "restoring-rain", name: "Restoring Rain", description: "Healing cards restore 1 additional Health.", healBonus: 1 }),
    Object.freeze({ id: "steadfast-current", name: "Steadfast Current", description: "Retain up to 2 more Guard between turns.", retainBonus: 2 }),
  ]),
});

export const RELICS = Object.freeze({
  "smouldering-collar": Object.freeze({ id: "smouldering-collar", icon: "◈", name: "Smouldering Collar", description: "Your first Attack each battle deals +2 damage." }),
  "featherstep-boots": Object.freeze({ id: "featherstep-boots", icon: "❧", name: "Featherstep Boots", description: "Draw 1 additional card on your first turn." }),
  "moonwell-charm": Object.freeze({ id: "moonwell-charm", icon: "☾", name: "Moonwell Charm", description: "Begin each battle with 5 Guard." }),
  "merchant-bell": Object.freeze({ id: "merchant-bell", icon: "¤", name: "Merchant Bell", description: "Gain 10 additional Coins after every battle." }),
  "nine-lives-knot": Object.freeze({ id: "nine-lives-knot", icon: "⌘", name: "Nine-Lives Knot", description: "Gain 5 maximum Health when found." }),
});

export const ENEMIES = Object.freeze({
  "moss-rat": Object.freeze({
    id: "moss-rat", name: "Moss Rat Marauder", icon: "🐀", element: "gust", maxHealth: 24, coins: 14,
    intents: Object.freeze([
      Object.freeze({ type: "attack", value: 6 }),
      Object.freeze({ type: "guard", value: 5 }),
      Object.freeze({ type: "attack", value: 8 }),
    ]),
  }),
  "cinder-crow": Object.freeze({
    id: "cinder-crow", name: "Cinder Crow", icon: "🐦", element: "ember", maxHealth: 26, coins: 15,
    intents: Object.freeze([
      Object.freeze({ type: "attack", value: 5 }),
      Object.freeze({ type: "attack-burn", value: 4, burn: 2 }),
      Object.freeze({ type: "guard", value: 6 }),
    ]),
  }),
  "brook-boar": Object.freeze({
    id: "brook-boar", name: "Brook Boar", icon: "🐗", element: "tide", maxHealth: 31, coins: 17,
    intents: Object.freeze([
      Object.freeze({ type: "guard", value: 6 }),
      Object.freeze({ type: "attack", value: 8 }),
      Object.freeze({ type: "attack", value: 10 }),
    ]),
  }),
  "lantern-lynx": Object.freeze({
    id: "lantern-lynx", name: "Lantern Lynx", icon: "🐈", element: "ember", maxHealth: 33, coins: 18,
    intents: Object.freeze([
      Object.freeze({ type: "attack", value: 7 }),
      Object.freeze({ type: "strength", value: 2 }),
      Object.freeze({ type: "attack", value: 6 }),
    ]),
  }),
  "iron-mastiff": Object.freeze({
    id: "iron-mastiff", name: "Iron Mastiff", icon: "🐕", element: "ember", maxHealth: 45, coins: 28, elite: true,
    intents: Object.freeze([
      Object.freeze({ type: "guard", value: 8 }),
      Object.freeze({ type: "attack", value: 10 }),
      Object.freeze({ type: "strength", value: 2 }),
      Object.freeze({ type: "attack", value: 12 }),
    ]),
  }),
  "tempest-stag": Object.freeze({
    id: "tempest-stag", name: "Tempest Stag", icon: "🦌", element: "gust", maxHealth: 46, coins: 29, elite: true,
    intents: Object.freeze([
      Object.freeze({ type: "attack", value: 8 }),
      Object.freeze({ type: "guard", value: 9 }),
      Object.freeze({ type: "attack", value: 13 }),
    ]),
  }),
  "cycle-lion": Object.freeze({
    id: "cycle-lion", name: "Lion of the Severed Cycle", icon: "🦁", element: "tide", maxHealth: 72, coins: 60, boss: true,
    intents: Object.freeze([
      Object.freeze({ type: "attack", value: 8, element: "tide" }),
      Object.freeze({ type: "guard", value: 10, element: "gust" }),
      Object.freeze({ type: "attack-burn", value: 7, burn: 2, element: "ember" }),
      Object.freeze({ type: "attack", value: 13, element: "tide" }),
    ]),
  }),
});

const NORMAL_ENEMIES = Object.freeze(["moss-rat", "cinder-crow", "brook-boar", "lantern-lynx"]);
const ELITE_ENEMIES = Object.freeze(["iron-mastiff", "tempest-stag"]);

export function randomItem(items, random = Math.random) {
  return items[Math.floor(random() * items.length)];
}

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function elementEdge(attacker, defender) {
  return attacker && defender && ELEMENTS[attacker]?.beats === defender ? 2 : 0;
}

export function createStarterDeck(classId) {
  const form = CLASS_FORMS[classId] || CLASS_FORMS["ember-knight"];
  return [
    ...Array.from({ length: 4 }, () => ({ id: "strike", upgraded: false })),
    ...Array.from({ length: 4 }, () => ({ id: "brace", upgraded: false })),
    ...form.starterCards.map((id) => ({ id, upgraded: false })),
  ];
}

export function cardDefinition(entry) {
  const base = CARD_LIBRARY[entry?.id];
  if (!base) return null;
  if (!entry.upgraded) return { ...base };
  const upgraded = { ...base };
  Object.entries(base.upgrade || {}).forEach(([key, value]) => {
    upgraded[key] = Math.max(key === "cost" ? 0 : -Infinity, (upgraded[key] || 0) + value);
  });
  upgraded.name = `${base.name}+`;
  return upgraded;
}

export function createExpeditionMap(random = Math.random) {
  const opening = shuffle(NORMAL_ENEMIES, random).slice(0, 2);
  const middleEnemy = randomItem(NORMAL_ENEMIES, random);
  const lateEnemy = randomItem(NORMAL_ENEMIES.filter((id) => id !== middleEnemy), random);
  const elite = randomItem(ELITE_ENEMIES, random);
  return [
    opening.map((enemyId, index) => ({ id: `0-${index}`, type: "battle", enemyId })),
    [
      { id: "1-0", type: "event", eventId: "moon-shrine" },
      { id: "1-1", type: "battle", enemyId: middleEnemy },
    ],
    [
      { id: "2-0", type: "camp" },
      { id: "2-1", type: "shop" },
    ],
    [
      { id: "3-0", type: "battle", enemyId: lateEnemy },
      { id: "3-1", type: "elite", enemyId: elite },
    ],
    [
      { id: "4-0", type: "camp" },
      { id: "4-1", type: "event", eventId: "old-bridge" },
    ],
    [{ id: "5-0", type: "boss", enemyId: "cycle-lion" }],
  ];
}

export function createRun(profile, random = Math.random) {
  const form = CLASS_FORMS[profile.classId] || CLASS_FORMS["ember-knight"];
  return {
    version: 1,
    classId: form.id,
    stage: 0,
    depth: 0,
    hp: form.maxHealth,
    maxHealth: form.maxHealth,
    level: 1,
    coins: 0,
    deck: createStarterDeck(form.id),
    relics: [],
    talents: [],
    map: createExpeditionMap(random),
    completedNodes: [],
    pendingNode: null,
    pendingReward: null,
    combat: null,
  };
}

export function bondRank(bondXp = 0) {
  return Math.max(1, Math.floor(Math.max(0, bondXp) / 100) + 1);
}

export function bondReward(depth, completed = false) {
  return Math.max(10, depth * 10) + (completed ? 50 : 0);
}

export function intentLabel(intent, enemyStrength = 0, enemyElement = null, playerElement = null) {
  if (!intent) return "Watching carefully";
  const intentElement = intent.element || enemyElement;
  const edge = intent.type.startsWith("attack") ? elementEdge(intentElement, playerElement) : 0;
  if (intent.type === "attack") return `Attack for ${intent.value + enemyStrength + edge}${edge ? " · Edge +2" : ""}`;
  if (intent.type === "attack-burn") return `Attack for ${intent.value + enemyStrength + edge} and apply ${intent.burn} Burn${edge ? " · Edge +2" : ""}`;
  if (intent.type === "guard") return `Gain ${intent.value} Guard`;
  if (intent.type === "strength") return `Gain ${intent.value} Strength`;
  return "Unknown intention";
}

export function uniqueRewardChoices(classId, count = 3, random = Math.random) {
  return shuffle(CLASS_REWARD_POOLS[classId] || CLASS_REWARD_POOLS["ember-knight"], random)
    .slice(0, count);
}
