(function exposeFourLaneOpponents(global) {
  "use strict";
  const decks = global.ClawDeckbuilding;
  const rules = global.ClawFourLaneRules;
  const normal = global.ClawRules;
  const rosters = new WeakSet();
  const allIds = templates => templates.map(trait => trait.id);
  const definitions = [
    {
      id: "balanced", name: "Versatile Duelist", deckId: "balanced", role: null, theme: "Mixed roles",
      description: "An adaptable all-rounder that mixes openers, support and Finishers. Its playstyle varies with its habits, so it is less tied to one type of formation.",
      habits: { motive: allIds(normal.AI_MOTIVE_TRAITS), placement: allIds(rules.AI_PLACEMENT_TRAITS),
        commitment: allIds(normal.AI_COMMITMENT_TRAITS) },
    },
    {
      id: "rally", name: "Banner Captain", deckId: "rally", role: "rally", theme: "Vanguard + Rally",
      description: "A support-heavy rival built around adjacent Rally partnerships and Vanguard openers. Favours reinforcing key fighters while its habits shape placement and formation size.",
      habits: { motive: ["trophy-hunter", "power-seeker", "trophy-denier"],
        placement: ["left-flank", "centre-guard"],
        commitment: ["measured-planner", "full-formation", "score-reader"] },
    },
    {
      id: "link", name: "Cycle Weaver", deckId: "link", role: "link", theme: "Link combinations",
      description: "A combination-focused rival built around Link and mixed elements. Favours adjacent card combinations and pursuing trophies across Fire, Gust and Water.",
      habits: { motive: ["trophy-hunter", "counter-scholar", "trophy-denier"],
        placement: ["left-flank", "centre-guard", "right-flank"],
        commitment: ["measured-planner", "echo-tactician", "restless-dealer"] },
    },
    {
      id: "finisher", name: "Twilight Duelist", deckId: "finisher", role: "finisher", theme: "Finisher endings",
      description: "A Finisher-heavy rival focused on a strong rightmost threat. Its habits shape whether it commits a short formation or a wider push, and where it places its cards.",
      habits: { motive: ["trophy-hunter", "power-seeker", "momentum-rider"],
        placement: ["right-flank", "outer-guard"],
        commitment: ["solo-gambler", "measured-planner", "score-reader"] },
    },
  ];

  function createRoster(catalog) {
    const starters = decks.createStarterPresets(catalog);
    const roster = Object.freeze(definitions.map(definition => {
      const deck = starters.find(preset => preset.id === definition.deckId);
      if (!deck || !decks.validateDeck(catalog, deck).valid) throw new RangeError("A rival must use a legal constructed deck.");
      const habits = Object.freeze(Object.fromEntries(Object.entries(definition.habits)
        .map(([category, ids]) => [category, Object.freeze([...ids])])));
      // Validate every pool at startup; never let a misspelled habit reach a duel.
      rules.createAiTraits(() => 0, habits);
      return Object.freeze({ ...definition, deck, habits });
    }));
    rosters.add(roster);
    return roster;
  }

  function createEncounter(roster, selection = "random", random = Math.random) {
    if (!rosters.has(roster)) throw new TypeError("Use a validated rival roster.");
    let profile;
    if (selection === "random") {
      const roll = random();
      if (!Number.isFinite(roll)) throw new TypeError("A rival roll must be finite.");
      profile = roster[Math.floor(Math.min(.999999, Math.max(0, roll)) * roster.length)];
    } else profile = roster.find(rival => rival.id === selection);
    if (!profile) throw new RangeError("That rival is not available.");
    // One encounter snapshot survives restart/difficulty changes. It is never
    // regenerated during a round or influenced by the player's private deck.
    return Object.freeze({ profile, deck: profile.deck,
      traits: Object.freeze(rules.createAiTraits(random, profile.habits)) });
  }

  global.ClawFourLaneOpponents = Object.freeze({ createRoster, createEncounter });
})(globalThis);
