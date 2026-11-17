(function exposeStoryModel(global) {
  "use strict";

  const STORAGE_KEY = "projectProwl.storyPreview.v1";
  const VERSION = 1;
  const FACINGS = Object.freeze(["down", "up", "left", "right"]);
  const DIFFICULTIES = Object.freeze(["guided", "instinct", "blind"]);
  const MAP = Object.freeze({
    id: "willowgate-courtyard", name: "Willowgate Courtyard",
    width: 1024, height: 640, speed: 150, playerRadius: 12, inset: 32,
    spawn: Object.freeze({ x: 512, y: 520 }),
    gate: Object.freeze({ x: 448, y: 0, width: 128, height: 128, completionY: 70 }),
  });
  const OBSTACLES = Object.freeze([
    Object.freeze({ id: "west-workshop", x: 64, y: 104, width: 280, height: 128 }),
    Object.freeze({ id: "east-building", x: 688, y: 104, width: 292, height: 120 }),
    Object.freeze({ id: "fountain", x: 438, y: 290, width: 148, height: 92 }),
  ]);
  const INTERACTABLES = Object.freeze([
    Object.freeze({
      id: "hareth", name: "Hareth", kind: "npc", encounterId: "gate-duel", encounterKind: "duel",
      x: 760, y: 240, radius: 20, interactionRadius: 74,
      portrait: "./assets/cards/hareth-hearthbeat.png",
    }),
    Object.freeze({
      id: "lucan", name: "Lucan", kind: "npc", encounterId: "rally-puzzle", encounterKind: "puzzle",
      x: 250, y: 275, radius: 20, interactionRadius: 74,
      portrait: "./assets/cards/lucan-cinderclay.png",
    }),
    Object.freeze({ id: "gate", name: "North Gate", kind: "gate", x: 512, y: 80, radius: 0, interactionRadius: 74 }),
  ]);

  function isRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function hasOnlyDataFields(value, fields) {
    if (!isRecord(value)) return false;
    const keys = Reflect.ownKeys(value);
    return keys.length === fields.length && keys.every(key => typeof key === "string" && fields.includes(key)
      && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value"));
  }

  // Validation covers the complete save schema; safePosition separately repairs
  // finite but out-of-bounds coordinates without throwing away earned progress.
  function validate(value) {
    try {
      return hasOnlyDataFields(value, ["version", "x", "y", "facing", "flags", "difficulty"])
        && value.version === VERSION && Number.isFinite(value.x) && Number.isFinite(value.y)
        && FACINGS.includes(value.facing) && DIFFICULTIES.includes(value.difficulty)
        && hasOnlyDataFields(value.flags, ["duelWon", "puzzleWon", "areaComplete"])
        && Object.values(value.flags).every(flag => typeof flag === "boolean")
        && (!value.flags.areaComplete || value.flags.duelWon);
    } catch {
      return false;
    }
  }

  function circleTouchesRect(x, y, rectangle, radius = MAP.playerRadius) {
    const closestX = Math.max(rectangle.x, Math.min(x, rectangle.x + rectangle.width));
    const closestY = Math.max(rectangle.y, Math.min(y, rectangle.y + rectangle.height));
    return (x - closestX) ** 2 + (y - closestY) ** 2 < radius ** 2;
  }

  function isBlocked(x, y, flags) {
    const edge = MAP.inset + MAP.playerRadius;
    if (x < edge || x > MAP.width - edge || y < edge || y > MAP.height - edge) return true;
    const gate = MAP.gate;
    const walls = flags.duelWon
      ? [{ x: 0, y: 0, width: gate.x, height: gate.height },
        { x: gate.x + gate.width, y: 0, width: MAP.width - gate.x - gate.width, height: gate.height }]
      : [{ x: 0, y: 0, width: MAP.width, height: gate.height }];
    if ([...walls, ...OBSTACLES].some(rectangle => circleTouchesRect(x, y, rectangle))) return true;
    return INTERACTABLES.some(target => target.radius > 0
      && Math.hypot(x - target.x, y - target.y) < MAP.playerRadius + target.radius);
  }

  function safePosition(state) {
    const edge = MAP.inset + MAP.playerRadius;
    state.x = Math.max(edge, Math.min(MAP.width - edge, state.x));
    state.y = Math.max(edge, Math.min(MAP.height - edge, state.y));
    if (isBlocked(state.x, state.y, state.flags)) {
      state.x = MAP.spawn.x;
      state.y = MAP.spawn.y;
    }
    return state;
  }

  function createState(saved = null) {
    return safePosition(validate(saved) ? {
      version: VERSION, x: saved.x, y: saved.y, facing: saved.facing,
      flags: { duelWon: saved.flags.duelWon, puzzleWon: saved.flags.puzzleWon, areaComplete: saved.flags.areaComplete },
      difficulty: saved.difficulty,
    } : {
      version: VERSION, x: MAP.spawn.x, y: MAP.spawn.y, facing: "down",
      flags: { duelWon: false, puzzleWon: false, areaComplete: false }, difficulty: "instinct",
    });
  }

  function move(state, dx, dy, dt) {
    if (!validate(state)) return { moved: false, completed: false };
    if (![dx, dy, dt].every(Number.isFinite) || dt <= 0 || (!dx && !dy)) return { moved: false, completed: false };
    const length = Math.hypot(dx, dy);
    const scale = MAP.speed * Math.min(.05, dt) / Math.max(1, length);
    if (Math.abs(dx) >= Math.abs(dy)) state.facing = dx < 0 ? "left" : "right";
    else state.facing = dy < 0 ? "up" : "down";
    const oldX = state.x, oldY = state.y;
    // Axis-separated collision keeps sliding along walls responsive. The capped
    // frame step is smaller than the player diameter, so thin edges are not skipped.
    if (!isBlocked(state.x + dx * scale, state.y, state.flags)) state.x += dx * scale;
    if (!isBlocked(state.x, state.y + dy * scale, state.flags)) state.y += dy * scale;
    const completed = !state.flags.areaComplete && state.flags.duelWon
      && state.x >= MAP.gate.x + MAP.playerRadius
      && state.x <= MAP.gate.x + MAP.gate.width - MAP.playerRadius
      && state.y <= MAP.gate.completionY;
    if (completed) state.flags.areaComplete = true;
    return { moved: state.x !== oldX || state.y !== oldY, completed };
  }

  function interaction(id) {
    return INTERACTABLES.find(target => target.id === id) || null;
  }

  function nearestInteraction(state) {
    if (!validate(state)) return null;
    let nearest = null, distance = Infinity;
    for (const target of INTERACTABLES) {
      const candidateDistance = Math.hypot(state.x - target.x, state.y - target.y);
      if (candidateDistance <= target.interactionRadius && candidateDistance < distance) {
        nearest = target;
        distance = candidateDistance;
      }
    }
    return nearest;
  }

  function applyEncounterResult(state, result) {
    if (!validate(state) || !result || result.outcome !== "won") return false;
    const flag = result.id === "gate-duel" && result.kind === "duel" ? "duelWon"
      : result.id === "rally-puzzle" && result.kind === "puzzle" ? "puzzleWon" : null;
    if (!flag || state.flags[flag]) return false;
    state.flags[flag] = true;
    return true;
  }

  function serialize(state) {
    if (!validate(state)) throw new TypeError("Cannot save an invalid courtyard state.");
    return JSON.stringify(createState(state));
  }

  function deserialize(raw) {
    if (typeof raw !== "string" || !raw || raw.length > 8192) return null;
    try {
      const parsed = JSON.parse(raw);
      return validate(parsed) ? createState(parsed) : null;
    } catch {
      return null;
    }
  }

  function load(storage) {
    try {
      const state = deserialize(storage.getItem(STORAGE_KEY));
      return { state: state || createState(), saved: Boolean(state), available: true };
    } catch {
      return { state: createState(), saved: false, available: false };
    }
  }

  function save(storage, state) {
    try {
      storage.setItem(STORAGE_KEY, serialize(state));
      return true;
    } catch {
      return false;
    }
  }

  function reset(storage) {
    try {
      storage.removeItem(STORAGE_KEY);
      return true;
    } catch {
      return false;
    }
  }

  global.ClawStoryModel = Object.freeze({
    VERSION, STORAGE_KEY, MAP, OBSTACLES, INTERACTABLES, FACINGS, DIFFICULTIES,
    createState, validate, move, nearestInteraction, interaction, applyEncounterResult,
    serialize, deserialize, load, save, reset,
  });
})(globalThis);
