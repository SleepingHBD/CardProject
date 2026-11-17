import test from "node:test";
import assert from "node:assert/strict";
import "../src/story-model.js";

const model = globalThis.ClawStoryModel;
const { MAP } = model;
const storageFixture = () => {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};
const march = (state, dx, dy, frames = 1) => {
  let completed = false;
  for (let frame = 0; frame < frames; frame++) completed = model.move(state, dx, dy, .05).completed || completed;
  return completed;
};

test("the courtyard model has the expected world, spawn, two NPCs and immutable map data", () => {
  const first = model.createState(), second = model.createState();
  assert.equal(MAP.width, 1024);
  assert.equal(MAP.height, 640);
  assert.deepEqual([first.x, first.y, first.facing, first.difficulty], [512, 520, "down", "instinct"]);
  assert.deepEqual(model.INTERACTABLES.map(value => value.id), ["hareth", "lucan", "gate"]);
  assert.ok(model.INTERACTABLES.every(Object.isFrozen));
  assert.ok(Object.isFrozen(MAP) && Object.isFrozen(MAP.gate));
  first.flags.duelWon = true;
  assert.equal(second.flags.duelWon, false, "fresh states never share flags");
});

test("movement is time-based and diagonals are not faster", () => {
  const straight = model.createState(), diagonal = model.createState();
  model.move(straight, 1, 0, .05);
  model.move(diagonal, 1, 1, .05);
  assert.equal(straight.x, 519.5);
  assert.equal(straight.facing, "right");
  assert.ok(Math.abs(Math.hypot(diagonal.x - 512, diagonal.y - 520) - 7.5) < 1e-9);
  model.move(straight, 0, -1, .05);
  assert.equal(straight.facing, "up");
});

test("long or invalid frames cannot teleport the character", () => {
  const state = model.createState();
  model.move(state, 1, 0, 20);
  assert.equal(state.x, 519.5);
  const snapshot = JSON.stringify(state);
  for (const input of [[1, 0, NaN], [Infinity, 0, .05], [1, 0, -2], [0, 0, .05]]) model.move(state, ...input);
  assert.equal(JSON.stringify(state), snapshot);
});

test("the player collides with the fountain and can slide around it", () => {
  const state = model.createState();
  march(state, 0, -1, 60);
  assert.ok(state.y >= 394 && state.y < 402);
  const blockedY = state.y;
  march(state, 1, -1, 22);
  assert.ok(state.x > 588);
  assert.ok(state.y < blockedY, "the player can turn around the fountain's side");
});

test("the buildings and NPCs are solid while nearby interaction remains reachable", () => {
  for (const target of model.INTERACTABLES.filter(value => value.kind === "npc")) {
    const state = model.createState({ ...model.createState(), x: target.x, y: target.y + 70 });
    assert.equal(model.nearestInteraction(state).id, target.id);
    march(state, 0, -1, 20);
    assert.ok(state.y >= target.y + target.radius + MAP.playerRadius);
  }
  const west = model.createState({ ...model.createState(), x: 180, y: 270 });
  march(west, 0, -1, 40);
  assert.ok(west.y >= 244, "workshop collision includes the player's radius");
});

test("map boundaries stay solid on every side", () => {
  const state = model.createState({ ...model.createState(), x: 60, y: 550 });
  march(state, -1, 0, 100);
  assert.ok(state.x >= MAP.inset + MAP.playerRadius);
  march(state, 0, 1, 100);
  assert.ok(state.y <= MAP.height - MAP.inset - MAP.playerRadius);
  march(state, 1, 0, 200);
  assert.ok(state.x <= MAP.width - MAP.inset - MAP.playerRadius);
});

test("the north gate blocks walking until the normal duel is won", () => {
  const state = model.createState({ ...model.createState(), x: 512, y: 200 });
  march(state, 0, -1, 70);
  assert.ok(state.y >= 140);
  assert.equal(state.flags.areaComplete, false);
  assert.equal(model.nearestInteraction(state).id, "gate");
  assert.equal(model.applyEncounterResult(state, { id: "gate-duel", kind: "duel", outcome: "won" }), true);
  assert.equal(march(state, 0, -1, 15), true);
  assert.ok(state.y <= 70);
  assert.equal(state.flags.areaComplete, true);
  assert.equal(model.move(state, 0, -1, .05).completed, false, "completion fires once");
});

test("opening the gate does not make the rest of the north wall passable", () => {
  const state = model.createState({ ...model.createState(), x: 400, y: 200, flags: { duelWon: true, puzzleWon: false, areaComplete: false } });
  march(state, 0, -1, 70);
  assert.ok(state.y >= 140);
  assert.equal(state.flags.areaComplete, false);
});

test("only matching won encounter results award progress, and repeated events are idempotent", () => {
  const state = model.createState();
  for (const outcome of ["lost", "draw", "retreated", "invalid", null]) {
    assert.equal(model.applyEncounterResult(state, { id: "gate-duel", kind: "duel", outcome }), false);
    assert.equal(model.applyEncounterResult(state, { id: "rally-puzzle", kind: "puzzle", outcome }), false);
  }
  assert.equal(model.applyEncounterResult(state, { id: "gate-duel", kind: "puzzle", outcome: "won" }), false);
  assert.equal(model.applyEncounterResult(state, { id: "unknown", kind: "duel", outcome: "won" }), false);
  assert.equal(model.applyEncounterResult(state, { id: "rally-puzzle", kind: "puzzle", outcome: "won" }), true);
  assert.equal(state.flags.puzzleWon, true);
  assert.equal(state.flags.duelWon, false, "the optional puzzle never opens the gate");
  assert.equal(model.applyEncounterResult(state, { id: "rally-puzzle", kind: "puzzle", outcome: "won" }), false);
});

test("interactions are local and do not require exact pixel alignment or facing", () => {
  const state = model.createState();
  assert.equal(model.nearestInteraction(state), null);
  state.x = 760; state.y = 306; state.facing = "down";
  assert.equal(model.nearestInteraction(state), model.interaction("hareth"));
  state.y = 315;
  assert.equal(model.nearestInteraction(state), null);
  assert.equal(model.interaction("missing"), null);
});

test("save round trips preserve position, difficulty and completed progress without aliases", () => {
  const state = model.createState();
  state.x = 630; state.y = 450; state.facing = "left"; state.difficulty = "blind";
  state.flags.puzzleWon = true;
  const copy = model.deserialize(model.serialize(state));
  assert.deepEqual(copy, state);
  copy.flags.puzzleWon = false;
  assert.equal(state.flags.puzzleWon, true);
  assert.equal(Object.hasOwn(copy, "activeEncounter"), false);
});

test("unsafe saved positions recover safely while retaining legitimate progress", () => {
  const base = model.createState();
  base.flags.duelWon = true;
  const insideFountain = model.deserialize(JSON.stringify({ ...base, x: 512, y: 320 }));
  assert.deepEqual([insideFountain.x, insideFountain.y], [512, 520]);
  assert.equal(insideFountain.flags.duelWon, true);
  const outside = model.deserialize(JSON.stringify({ ...base, x: 1e9, y: 1e9 }));
  assert.deepEqual([outside.x, outside.y], [980, 596]);
  const closedGate = model.deserialize(JSON.stringify({ ...model.createState(), x: 512, y: 60 }));
  assert.deepEqual([closedGate.x, closedGate.y], [512, 520]);
});

test("malformed, extra-field and prototype-polluted saves are rejected", () => {
  const normal = model.createState();
  for (const raw of [null, "", "not json", "[]", "null", "{}", "x".repeat(8193),
    JSON.stringify({ ...normal, version: 2 }), JSON.stringify({ ...normal, difficulty: "open" }),
    JSON.stringify({ ...normal, x: null }), JSON.stringify({ ...normal, y: "520" }),
    JSON.stringify({ ...normal, facing: "north" }), JSON.stringify({ ...normal, flags: { ...normal.flags, areaComplete: true } }),
    JSON.stringify({ ...normal, flags: { ...normal.flags, injected: true } }),
    JSON.stringify({ ...normal, pendingBattle: "gate-duel" }),
    JSON.stringify(normal).replace('"version":1', '"version":1,"__proto__":{"polluted":true}')]) {
    assert.equal(model.deserialize(raw), null, String(raw).slice(0, 100));
  }
  const inherited = Object.create({ inherited: true });
  Object.assign(inherited, normal);
  assert.equal(model.validate(inherited), false);
  const accessor = { ...normal };
  Object.defineProperty(accessor, "x", { enumerable: true, get() { throw new Error("getter must not run"); } });
  assert.equal(model.validate(accessor), false);
  assert.equal({}.polluted, undefined);
  assert.throws(() => model.serialize({ ...normal, x: Infinity }), TypeError);
});

test("storage helpers handle unavailable storage, corrupted data, save, load and explicit reset", () => {
  const storage = storageFixture();
  assert.deepEqual(model.load(storage), { state: model.createState(), saved: false, available: true });
  const state = model.createState(); state.flags.puzzleWon = true;
  assert.equal(model.save(storage, state), true);
  assert.deepEqual(model.load(storage), { state, saved: true, available: true });
  assert.equal(model.reset(storage), true);
  assert.equal(storage.values.has(model.STORAGE_KEY), false);
  storage.values.set(model.STORAGE_KEY, "corrupted");
  assert.equal(model.load(storage).saved, false);
  const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("full"); }, removeItem() { throw new Error("blocked"); } };
  assert.equal(model.load(blocked).available, false);
  assert.equal(model.save(blocked, state), false);
  assert.equal(model.reset(blocked), false);
  assert.equal(model.save(storage, { ...state, x: NaN }), false);
});
