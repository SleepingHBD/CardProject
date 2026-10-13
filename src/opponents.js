(function exposeFourLaneOpponents(global) {
  "use strict";
  const decks = global.ClawDeckbuilding;
  const rosters = new WeakSet();
  const definitions = [
    {
      id: "balanced", name: "Versatile Duelist", deckId: "balanced", role: null, theme: "Mixed roles",
      description: "An adaptable all-rounder with all four roles. Its balanced deck can contest the shared lane, support nearby fighters or spread its threats across the board.",
    },
    {
      id: "rally", name: "Banner Captain", deckId: "rally", role: "rally", theme: "Vanguard + Rally",
      description: "A support-heavy deck built around adjacent Rally partnerships and Vanguard openers. Reinforcing a key fighter can make the shared battle lane difficult to win.",
    },
    {
      id: "link", name: "Cycle Weaver", deckId: "link", role: "link", theme: "Link combinations",
      description: "A combination-focused deck built around Link and mixed elements. Adjacent card combinations help it contest lanes while collecting complete elemental sets.",
    },
    {
      id: "finisher", name: "Twilight Duelist", deckId: "finisher", role: "finisher", theme: "Finisher endings",
      description: "A Finisher-heavy deck with a strong rightmost threat. Supporting its closing fighter gives it flexible options for a compact formation or a wider attack.",
    },
  ];

  function createRoster(catalog) {
    const starters = decks.createStarterPresets(catalog);
    const roster = Object.freeze(definitions.map(definition => {
      const deck = starters.find(preset => preset.id === definition.deckId);
      if (!deck || !decks.validateDeck(catalog, deck).valid) throw new RangeError("A rival must use a legal constructed deck.");
      return Object.freeze({ ...definition, deck });
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
    // Keep the same rival and deck on restart. WIP strategy comes from the
    // public hands and shared battle lane, not randomly generated habits.
    return Object.freeze({ profile, deck: profile.deck,
      traits: Object.freeze([]) });
  }

  global.ClawFourLaneOpponents = Object.freeze({ createRoster, createEncounter });
})(globalThis);
