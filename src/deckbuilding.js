(function exposeDeckbuilding(global) {
  "use strict";

  // Experimental Four-Lane construction rules; Normal Play is independent.
  const VERSION = 1;
  const DECK_SIZE = 24;
  const MAX_DECK_COST = 120;
  const MIN_CARDS_PER_ELEMENT = 4;
  const MAX_INPUT_CARDS = 64;
  const MAX_NAME_LENGTH = 48;
  const MAX_SAVED_DECKS = 12;
  const STORAGE_KEY = "projectProwl.fourLaneDecksV1";
  const ELEMENTS = Object.freeze(["ember", "gust", "tide"]);
  const ROLES = Object.freeze(["vanguard", "link", "finisher", "rally"]);
  const COPY_LIMITS = Object.freeze({ common: 2, uncommon: 2, rare: 1, epic: 1, legendary: 1 });
  const RARITY_COST_BONUS = Object.freeze({ common: 0, uncommon: 0, rare: 1, epic: 4, legendary: 6 });
  const ELEMENT_NAMES = Object.freeze({ ember: "Fire", gust: "Gust", tide: "Water" });
  const KEY_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  const catalogs = new WeakSet();
  let deckSerial = 0;

  function createCardCatalog(library) {
    if (!Array.isArray(library) || !library.length || library.length > 256) {
      throw new TypeError("A card catalog must contain 1–256 card definitions.");
    }
    const byKey = Object.create(null);
    const cards = Array.from(library, card => {
      if (!card || typeof card.art !== "string" || card.art.length > 80 || !KEY_PATTERN.test(card.art)
        || !ELEMENTS.includes(card.element) || !ROLES.includes(card.tactic)
        || typeof card.rarity !== "string" || !Object.hasOwn(COPY_LIMITS, card.rarity) || !Number.isInteger(card.power)
        || card.power < 1 || card.power > 9 || typeof card.name !== "string" || !card.name.trim()) {
        throw new TypeError("Invalid canonical card definition.");
      }
      if (Object.hasOwn(byKey, card.art)) throw new TypeError(`Duplicate card key: ${card.art}`);
      // Art slugs are stable across renames and library reordering; card-N IDs are not.
      // Only canonical presentation fields survive; runtime state cannot enter a template.
      const template = {
        key: card.art, art: card.art, name: card.name, element: card.element,
        power: card.power, tactic: card.tactic, rarity: card.rarity,
        cost: card.power + RARITY_COST_BONUS[card.rarity], copyLimit: COPY_LIMITS[card.rarity],
      };
      for (const field of ["id", "move", "lore", "artworkSource"]) {
        if (typeof card[field] === "string") template[field] = card[field];
      }
      byKey[card.art] = Object.freeze(template);
      return byKey[card.art];
    });
    const catalog = Object.freeze({ cards: Object.freeze(cards), byKey: Object.freeze(byKey) });
    catalogs.add(catalog);
    return catalog;
  }

  function requireCatalog(catalog) {
    if (!catalogs.has(catalog)) throw new TypeError("Use a catalog created from the game's card library.");
  }

  function validateDeck(catalog, definition) {
    requireCatalog(catalog);
    const errors = [];
    const add = (code, message, key) => errors.push(Object.freeze({ code, message, ...(key ? { key } : {}) }));
    const summary = {
      count: 0, totalCost: 0,
      elementCounts: { ember: 0, gust: 0, tide: 0 },
      roleCounts: { vanguard: 0, link: 0, finisher: 0, rally: 0 },
      rarityCounts: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
      copies: Object.create(null),
    };
    const finish = () => {
      for (const value of Object.values(summary)) if (value && typeof value === "object") Object.freeze(value);
      return Object.freeze({ valid: !errors.length, errors: Object.freeze(errors), summary: Object.freeze(summary) });
    };
    if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
      add("invalid-definition", "A deck must be a deck definition, not a list of card objects.");
      return finish();
    }
    if (!Object.hasOwn(definition, "version") || definition.version !== VERSION) add("unsupported-version", "This deck uses an unsupported format.");
    if (!Object.hasOwn(definition, "name") || typeof definition.name !== "string" || !definition.name.trim() || definition.name.length > MAX_NAME_LENGTH) {
      add("invalid-name", `Name your deck using 1–${MAX_NAME_LENGTH} characters.`);
    }
    if (!Object.hasOwn(definition, "cards") || !Array.isArray(definition.cards)) {
      add("invalid-cards", "The deck must contain a list of card identifiers.");
      return finish();
    }
    summary.count = definition.cards.length;
    if (summary.count > MAX_INPUT_CARDS) {
      add("input-too-large", "This deck contains too many entries to import.");
      return finish();
    }
    // An indexed loop also rejects sparse arrays rather than silently skipping holes.
    for (let index = 0; index < summary.count; index++) {
      const key = definition.cards[index];
      if (typeof key !== "string" || !Object.hasOwn(catalog.byKey, key)) {
        add("unknown-card", `Card ${index + 1} is not in this mode's collection.`);
        continue;
      }
      const card = catalog.byKey[key];
      summary.copies[key] = (summary.copies[key] || 0) + 1;
      summary.totalCost += card.cost;
      summary.elementCounts[card.element]++;
      summary.roleCounts[card.tactic]++;
      summary.rarityCounts[card.rarity]++;
    }
    if (summary.count !== DECK_SIZE) add("deck-size", `Choose exactly ${DECK_SIZE} cards (${summary.count} selected).`);
    if (summary.totalCost > MAX_DECK_COST) {
      add("over-budget", `Your deck costs ${summary.totalCost}; the limit is ${MAX_DECK_COST}.`);
    }
    for (const [key, count] of Object.entries(summary.copies)) {
      const card = catalog.byKey[key];
      if (count > card.copyLimit) add("copy-limit", `${card.name} allows at most ${card.copyLimit} ${card.copyLimit === 1 ? "copy" : "copies"}.`, key);
    }
    for (const element of ELEMENTS) {
      if (summary.elementCounts[element] < MIN_CARDS_PER_ELEMENT) {
        add("element-minimum", `Include at least ${MIN_CARDS_PER_ELEMENT} ${ELEMENT_NAMES[element]} cards.`, element);
      }
    }
    return finish();
  }

  function buildDeckInstances(catalog, definition, owner) {
    const report = validateDeck(catalog, definition);
    if (!report.valid) throw new RangeError(report.errors.map(error => error.message).join(" "));
    if (owner !== "player" && owner !== "opponent") throw new TypeError("A deck owner must be player or opponent.");
    const serial = ++deckSerial;
    const copies = Object.create(null);
    // Return an unshuffled mutable runtime deck. The game's existing shuffle,
    // The duel's hand and discard lifecycle owns these runtime instances.
    return definition.cards.map(key => {
      const template = catalog.byKey[key];
      const copy = copies[key] = (copies[key] || 0) + 1;
      return { ...template, templateId: key, instanceId: `${owner}-deck-${serial}-${key}-${copy}` };
    });
  }

  function getDeckTips(catalog, definition) {
    const report = validateDeck(catalog, definition);
    if (!report.valid) return Object.freeze([]);
    const { summary } = report, tips = [];
    const remaining = MAX_DECK_COST - summary.totalCost;
    if (remaining >= 8) tips.push(`${remaining} cost unused. You can afford upgrades, if they fit your strategy.`);
    const scarce = ELEMENTS.filter(element => summary.elementCounts[element] === MIN_CARDS_PER_ELEMENT);
    if (scarce.length) tips.push(`Only ${scarce.map(element => `${MIN_CARDS_PER_ELEMENT} ${ELEMENT_NAMES[element]} cards`).join(" and ")}. Finishing those elements may take longer.`);
    if (summary.roleCounts.finisher > 8) tips.push("Only a Finisher committed last in a formation of at least two cards earns its role bonus. Earlier Finishers still use their normal Power and elemental edge.");
    return Object.freeze(tips);
  }

  const PRESETS = Object.freeze([
    {
      id: "balanced", name: "Balanced Formation",
      description: "All four roles and eight cards per element. Adapt your lane order to the trophies you still need.",
      cards: [
        "toastie-toe-beans", "teapot-tabby", "shazmir-ashveil", "beacon-burmilla", "cinder-kit", "candle-pounce", "charmae-emberhem", "toastie-toe-beans",
        "belfry-bobtail", "kitewhisker", "aakith-wayfinder", "aakith-wayfinder", "whisker-whirl", "leafy-loaf", "whisker-whirl", "jiawen-barleybreeze",
        "isai-tidebind", "sajrin-shellwright", "moatgate-mau", "isai-tidebind", "wellwater-wisp", "wellwater-wisp", "moonpool-mouser", "bubble-bengal",
      ],
    },
    {
      id: "rally", name: "Rally Company",
      description: "Rally support strengthens the preceding lane. A few Links and Finishers offer alternative formations.",
      cards: [
        "beacon-burmilla", "cinder-kit", "candle-pounce", "charmae-emberhem", "hareth-hearthbeat", "toastie-toe-beans", "flaskfoot-felix", "teapot-tabby",
        "hidayn-windbrace", "hidayn-windbrace", "kitewhisker", "jiawen-barleybreeze", "jiawen-barleybreeze", "megwyn-windwhistle", "aakith-wayfinder", "aakith-wayfinder",
        "deshone-dewguard", "isai-tidebind", "isai-tidebind", "sajrin-shellwright", "moatgate-mau", "siewen-rainkeeper", "siewen-rainkeeper", "moonpool-mouser",
      ],
    },
    {
      id: "link", name: "Element Weavers",
      description: "Alternate elements for Link bonuses. Rally and defensive openings help secure the elements you need.",
      cards: [
        "hareth-hearthbeat", "shazmir-ashveil", "shazmir-ashveil", "teapot-tabby", "flaskfoot-felix", "beacon-burmilla", "cinder-kit", "charmae-emberhem",
        "aakith-wayfinder", "windlass-whiskers", "windlass-whiskers", "belfry-bobtail", "belfry-bobtail", "kitewhisker", "jiawen-barleybreeze", "megwyn-windwhistle",
        "siewen-rainkeeper", "rivertow-ragdoll", "wellwater-wisp", "riptide-rook", "moonpool-mouser", "moonpool-mouser", "isai-tidebind", "sajrin-shellwright",
      ],
    },
    {
      id: "finisher", name: "Last Light",
      description: "Finish a two-to-four-card formation with a Finisher. Links and Rally support keep the earlier lanes competitive.",
      cards: [
        "lucan-cinderclay", "lucan-cinderclay", "toastie-toe-beans", "toastie-toe-beans", "flaskfoot-felix", "beacon-burmilla", "beacon-burmilla", "hareth-hearthbeat",
        "dandelion-dash", "belfry-bobtail", "belfry-bobtail", "aakith-wayfinder", "whisker-whirl", "whisker-whirl", "windlass-whiskers", "hidayn-windbrace",
        "sajrin-shellwright", "deshone-dewguard", "moatgate-mau", "moatgate-mau", "bubble-bengal", "isai-tidebind", "isai-tidebind", "moonpool-mouser",
      ],
    },
  ].map(preset => Object.freeze({ ...preset, version: VERSION, cards: Object.freeze(preset.cards) })));

  function createStarterPresets(catalog) {
    requireCatalog(catalog);
    for (const preset of PRESETS) {
      const report = validateDeck(catalog, preset);
      if (!report.valid) throw new RangeError(`Invalid starter deck ${preset.id}: ${report.errors.map(error => error.message).join(" ")}`);
    }
    return PRESETS;
  }

  function copyDefinition(definition) {
    // Saved metadata can never override card stats or become runtime card data.
    return Object.freeze({ version: VERSION, name: definition.name.trim(), cards: Object.freeze([...definition.cards]) });
  }

  function createDeckStore(catalog, storage) {
    const starters = createStarterPresets(catalog);
    const starterId = preset => `starter:${preset.id}`;
    const defaultId = starterId(starters[0]);
    const validId = id => typeof id === "string" && id.length <= 80 && /^custom-[a-z0-9-]+$/.test(id);
    let saved = [], selectedId = defaultId, storageAvailable = Boolean(storage), notice = "";
    const resolve = id => starters.find(preset => starterId(preset) === id) || saved.find(deck => deck.id === id);
    const fallbackNotice = "Decks are available for this session only. This browser could not store them for your next visit.";
    try {
      const raw = storage?.getItem(STORAGE_KEY);
      if (raw != null) {
        if (typeof raw !== "string" || raw.length > 64000) throw new TypeError("Invalid saved deck data.");
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.decks)) throw new TypeError("Unsupported saved decks.");
        const seen = new Set();
        let skipped = parsed.decks.length > MAX_SAVED_DECKS;
        for (const deck of parsed.decks.slice(0, MAX_SAVED_DECKS)) {
          if (!deck || !validId(deck.id) || seen.has(deck.id) || !validateDeck(catalog, deck).valid) { skipped = true; continue; }
          seen.add(deck.id);
          saved.push(Object.freeze({ id: deck.id, ...copyDefinition(deck) }));
        }
        if (resolve(parsed.selectedId)) selectedId = parsed.selectedId;
        else if (parsed.selectedId !== defaultId) skipped = true;
        if (skipped) notice = "Some saved decks were invalid and were not loaded. Your valid decks are still available.";
      }
    } catch {
      notice = "Saved decks could not be loaded. Starter decks are still available.";
      // Reading may fail even when the storage object was obtainable.
      try { storage?.getItem(STORAGE_KEY); } catch { storageAvailable = false; notice = fallbackNotice; }
    }
    if (!storage) notice = fallbackNotice;

    const snapshot = () => Object.freeze({ selectedId, decks: Object.freeze([...saved]), storageAvailable, notice });
    const persist = () => {
      try {
        if (!storage) throw new Error("Storage unavailable.");
        storage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, selectedId, decks: saved }));
        storageAvailable = true;
        notice = "";
      } catch { storageAvailable = false; notice = fallbackNotice; }
      return snapshot();
    };
    return Object.freeze({
      snapshot,
      getDeck(id = selectedId) { return resolve(id) || null; },
      select(id) {
        if (!resolve(id)) throw new RangeError("That deck is no longer available.");
        selectedId = id;
        return persist();
      },
      save(definition, id = null) {
        const report = validateDeck(catalog, definition);
        if (!report.valid) throw new RangeError(report.errors.map(error => error.message).join(" "));
        if (id !== null && (!validId(id) || !saved.some(deck => deck.id === id))) throw new RangeError("That saved deck is no longer available.");
        if (id === null && saved.length >= MAX_SAVED_DECKS) throw new RangeError(`You can save up to ${MAX_SAVED_DECKS} decks. Delete a saved deck before creating another.`);
        if (id === null) {
          // Incrementing serial prevents same-millisecond collisions without relying on UUID support.
          do { id = `custom-${Date.now().toString(36)}-${(++deckSerial).toString(36)}`; } while (resolve(id));
        }
        const deck = Object.freeze({ id, ...copyDefinition(definition) });
        const index = saved.findIndex(value => value.id === id);
        if (index < 0) saved.push(deck); else saved[index] = deck;
        selectedId = id;
        persist();
        return deck;
      },
      remove(id) {
        if (!validId(id)) throw new RangeError("Starter decks cannot be deleted.");
        if (!saved.some(deck => deck.id === id)) return false;
        saved = saved.filter(deck => deck.id !== id);
        if (selectedId === id) selectedId = defaultId;
        persist();
        return true;
      },
    });
  }

  global.ClawDeckbuilding = Object.freeze({
    VERSION, DECK_SIZE, MAX_DECK_COST, MIN_CARDS_PER_ELEMENT, MAX_NAME_LENGTH, MAX_SAVED_DECKS, STORAGE_KEY,
    ELEMENTS, ROLES, COPY_LIMITS, RARITY_COST_BONUS,
    createCardCatalog, validateDeck, getDeckTips, buildDeckInstances, createStarterPresets, createDeckStore,
  });
})(globalThis);
