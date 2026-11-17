import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import "../src/story-model.js";

const model = globalThis.ClawStoryModel;
const source = readFileSync(new URL("../src/story.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../story.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const packaging = readFileSync(new URL("../scripts/copy-static.js", import.meta.url), "utf8");
const plain = value => JSON.parse(JSON.stringify(value));

function makeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

function fixture({ savedState, storage = makeStorage(), blockedStorage = false, coarse = false } = {}) {
  if (savedState) storage.setItem(model.STORAGE_KEY, model.serialize(savedState));
  const nodes = new Map(), documentListeners = new Map(), globalListeners = new Map(), frames = new Map();
  const calls = [], starts = [], imageRequests = [];
  const layout = { stageMeasurements: 0, canvasDimensionWrites: 0 };
  let clock = 0, frameSerial = 0, combatActive = false, coarsePointer = coarse;
  const listen = (listeners, type, callback) => {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(callback);
  };
  const document = {
    hidden: false, activeElement: null,
    addEventListener: (type, callback) => listen(documentListeners, type, callback),
    dispatchEvent(event) { for (const callback of documentListeners.get(event.type) || []) callback(event); },
    querySelector: selector => nodes.get(selector) || null,
    querySelectorAll(selector) {
      if (selector === "[data-story-direction]") return controls;
      if (selector === "[data-story-direction].is-held") return controls.filter(node => node.classList.contains("is-held"));
      return [];
    },
    createElement: tag => node(tag),
  };
  function node(tag = "div") {
    const classes = new Set(), listeners = new Map();
    return {
      tagName: tag.toUpperCase(), hidden: false, disabled: false, textContent: "", value: "", dataset: {}, style: {}, children: [], parentElement: null, clientLeft: 0, clientTop: 0,
      classList: {
        add: (...names) => names.forEach(name => classes.add(name)),
        remove: (...names) => names.forEach(name => classes.delete(name)),
        contains: name => classes.has(name),
        toggle(name, enabled) { if (enabled ?? !classes.has(name)) classes.add(name); else classes.delete(name); },
      },
      addEventListener: (type, callback) => listen(listeners, type, callback),
      dispatchEvent(event) { event.target ||= this; for (const callback of listeners.get(event.type) || []) callback(event); },
      click() {
        if (this.disabled || this.hidden) return;
        this.dispatchEvent({ type: "click", target: this, detail: 0, preventDefault() { this.defaultPrevented = true; } });
      },
      focus() { document.activeElement = this; },
      closest(selector) { return selector.includes("select") && this.tagName === "SELECT" ? this : null; },
      getBoundingClientRect: () => ({ width: 1024, height: 640, x: 0, y: 0 }),
      replaceChildren(...children) {
        for (const child of this.children) child.parentElement = null;
        this.children = [];
        for (const child of children) this.append(child);
      },
      append(child) {
        if (child.parentElement) child.parentElement.children.splice(child.parentElement.children.indexOf(child), 1);
        this.children.push(child); child.parentElement = this;
      },
      insertBefore(child, reference) {
        if (child.parentElement) child.parentElement.children.splice(child.parentElement.children.indexOf(child), 1);
        const index = this.children.indexOf(reference);
        if (index < 0) throw new Error("insertBefore reference is not a child");
        this.children.splice(index, 0, child); child.parentElement = this;
      },
      querySelectorAll(selector) { return selector === "button" ? this.children.filter(child => child.tagName === "BUTTON") : []; },
      setPointerCapture() {},
    };
  }
  const ids = ["storyScreen", "mainMenuStoryButton", "mainMenuScreen", "storyCanvas", "storyStage", "storyObjective", "storyNearby", "storyPuzzleSeal", "storySaveStatus", "storyPosition", "storyInteractButton", "storyDifficulty", "storyBackButton", "storyResetButton", "storyLoading", "storyDialogue", "storyDialoguePortrait", "storyDialogueEyebrow", "storyDialogueTitle", "storyDialogueText", "storyDialogueNote", "storyDialogueActions", "storyControlsHint"];
  for (const id of ids) {
    const tag = id.endsWith("Button") || id === "mainMenuStoryButton" ? "button"
      : id === "storyCanvas" ? "canvas" : id === "storyDifficulty" ? "select" : "div";
    nodes.set(`#${id}`, node(tag));
  }
  nodes.get("#storyScreen").hidden = true;
  nodes.get("#storyDialogue").hidden = true;
  let bitmapWidth = 1024, bitmapHeight = 640;
  Object.defineProperties(nodes.get("#storyCanvas"), {
    width: { get: () => bitmapWidth, set(value) { bitmapWidth = value; layout.canvasDimensionWrites++; } },
    height: { get: () => bitmapHeight, set(value) { bitmapHeight = value; layout.canvasDimensionWrites++; } },
  });
  nodes.get("#storyStage").getBoundingClientRect = () => {
    layout.stageMeasurements++;
    return { width: 1024, height: 640, x: 0, y: 0 };
  };
  for (const selector of [".story-touch-controls", ".story-footer", ".story-save-tools"]) nodes.set(selector, node());
  nodes.get(".story-footer").append(nodes.get(".story-touch-controls"));
  nodes.get(".story-footer").append(nodes.get(".story-save-tools"));
  const paint = Object.fromEntries(["setTransform", "clearRect", "fillRect", "save", "translate", "restore", "beginPath", "ellipse", "fill", "stroke", "moveTo", "lineTo", "strokeRect", "arc", "strokeText", "fillText", "drawImage"].map(name => [name, () => {}]));
  nodes.get("#storyCanvas").getContext = () => paint;
  document.body = node("body");
  document.body.classList.add("main-menu-active");
  const controls = ["up", "left", "right", "down"].map(direction => {
    const control = node("button"); control.dataset.storyDirection = direction; return control;
  });
  const unavailable = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
  const context = {
    ClawStoryModel: model, document,
    localStorage: blockedStorage ? unavailable : storage,
    performance: { now: () => clock },
    requestAnimationFrame(callback) { const id = ++frameSerial; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    ResizeObserver: class { observe() {} },
    Image: class {
      complete = false; naturalWidth = 0; naturalHeight = 0;
      set src(value) { this.path = value; imageRequests.push(value); }
      get src() { return this.path; }
    },
    matchMedia: () => ({ matches: coarsePointer }),
    ClawAudio: { startMainMenuMusic: () => calls.push("map-music") },
    ClawStoryCombat: {
      isActive: () => combatActive,
      startEncounter(options) { combatActive = true; starts.push(plain(options)); return Promise.resolve(); },
    },
    showMainMenu() { calls.push("main-menu"); nodes.get("#mainMenuScreen").hidden = false; document.body.classList.add("main-menu-active"); },
    addEventListener: (type, callback) => listen(globalListeners, type, callback),
  };
  runInNewContext(source, context);
  const fire = (target, type, details = {}) => {
    const event = { type, target, preventDefault() { this.defaultPrevented = true; }, ...details };
    if (target === document) document.dispatchEvent(event);
    else if (target === context) for (const callback of globalListeners.get(type) || []) callback(event);
    else target.dispatchEvent(event);
    return event;
  };
  const position = () => ({ x: Number(nodes.get("#storyCanvas").dataset.positionX), y: Number(nodes.get("#storyCanvas").dataset.positionY) });
  const frame = (count = 1) => {
    for (let index = 0; index < count; index++) {
      const scheduled = [...frames.values()]; frames.clear(); clock += 50;
      for (const callback of scheduled) callback(clock);
    }
  };
  const click = element => {
    if (!element.disabled && !element.hidden) return fire(element, "click", { detail: 1 });
  };
  const get = id => nodes.get(`#${id}`);
  const choose = text => {
    const button = get("storyDialogueActions").children.find(value => value.textContent === text);
    assert.ok(button, `visible dialogue choice: ${text}`);
    click(button);
  };
  const key = (code, type = "keydown", target = document.activeElement || get("storyCanvas"), details = {}) => fire(document, type, { target, code, repeat: false, ...details });
  const returned = detail => { combatActive = false; fire(document, "prowl:story-return", { detail }); };
  const saved = () => JSON.parse(storage.getItem(model.STORAGE_KEY));
  return { context, nodes, document, controls, calls, starts, imageRequests, layout, storage, frames, get, click, choose, key, fire, frame, position, returned, saved, setCoarse: value => { coarsePointer = value; } };
}

function beside(id, difficulty = "instinct") {
  const target = model.interaction(id);
  return { ...model.createState(), x: target.x, y: target.y + 70, difficulty };
}

test("Story Preview is a separate menu entry with packaged model, world and artwork", () => {
  assert.match(html, /id="mainMenuStoryButton"[^>]*aria-controls="storyScreen"[\s\S]*?Story Preview/);
  assert.match(html, /id="storyScreen"[^>]*hidden/);
  assert.ok(html.indexOf("./src/story-model.js") < html.indexOf("./src/story.js"));
  assert.ok(html.indexOf("./src/game.js") < html.indexOf("./src/story.js"));
  for (const file of ["story-model.js", "story.js"]) assert.ok(packaging.includes(`cp("src/${file}", "dist/src/${file}")`));
  for (const file of ["willowgate-courtyard.png", "player-walk.png", "hareth.png", "lucan.png"]) {
    assert.ok(existsSync(new URL(`../assets/story/${file}`, import.meta.url)), file);
  }
});

test("the production story UI exposes no hidden teleport, victory or state-mutation shortcut", () => {
  const f = fixture();
  assert.deepEqual(Object.keys(f.context.ClawStoryPreview), ["show", "hide", "isVisible"]);
  assert.equal(Object.isFrozen(f.context.ClawStoryPreview), true);
  f.click(f.get("mainMenuStoryButton"));
  assert.equal(f.context.ClawStoryPreview.isVisible(), true);
  assert.equal(f.get("mainMenuScreen").hidden, true);
  assert.equal(f.document.body.classList.contains("story-active"), true);
  assert.deepEqual(f.position(), { x: 512, y: 520 });
  assert.equal(f.document.activeElement, f.get("storyCanvas"));
});

test("story artwork loads only on the first preview visit and never burdens ordinary game startup", () => {
  const f = fixture();
  assert.equal(f.imageRequests.length, 0, "loading the scripts does not request story PNGs");
  f.click(f.get("mainMenuStoryButton"));
  assert.deepEqual(f.imageRequests, [
    "./assets/story/willowgate-courtyard.png", "./assets/story/player-walk.png",
    "./assets/story/hareth.png", "./assets/story/lucan.png",
  ]);
  f.context.ClawStoryPreview.hide();
  f.click(f.get("mainMenuStoryButton"));
  f.fire(f.context, "resize");
  f.context.ClawStoryPreview.show();
  assert.equal(f.imageRequests.length, 4, "revisits and resizing reuse the same requested artwork");
});

test("actual keyboard handlers move, release, save and stop their animation loop", () => {
  const f = fixture(); f.context.ClawStoryPreview.show();
  f.key("ArrowRight"); f.frame(4);
  assert.ok(f.position().x > 524);
  f.key("ArrowRight", "keyup");
  const stopped = f.position(); f.frame(5);
  assert.deepEqual(f.position(), stopped);
  assert.equal(f.frames.size, 0);
  assert.equal(Math.round(f.saved().x), stopped.x);
  f.key("ArrowUp", "keydown", f.get("storyDifficulty"));
  assert.deepEqual(f.position(), stopped, "select controls do not move the world");
});

test("nearby interaction is required; distant input cannot open a resident or encounter", () => {
  const f = fixture(); f.context.ClawStoryPreview.show();
  f.key("KeyE"); f.click(f.get("storyInteractButton"));
  assert.equal(f.get("storyDialogue").hidden, true);
  assert.equal(f.starts.length, 0);
  assert.equal(f.get("storyInteractButton").disabled, true);
});

test("dialogue freezes both keyboard and pointer movement until explicitly closed", () => {
  const f = fixture({ savedState: beside("hareth") }); f.context.ClawStoryPreview.show();
  assert.equal(f.get("storyInteractButton").textContent, "Talk to Hareth");
  f.key("KeyE");
  assert.equal(f.get("storyDialogueTitle").textContent, "Hareth");
  assert.equal(f.get("storyDialogue").hidden, false);
  assert.equal(f.nodes.get(".story-touch-controls").hidden, true);
  const before = f.position();
  f.key("ArrowLeft");
  f.fire(f.controls[1], "pointerdown", { pointerId: 7 }); f.frame(4);
  assert.deepEqual(f.position(), before);
  assert.equal(f.frames.size, 0);
  f.key("Escape");
  assert.equal(f.get("storyDialogue").hidden, true);
  assert.equal(f.nodes.get(".story-touch-controls").hidden, false);
  f.key("ArrowLeft"); f.key("ArrowLeft", "keyup");
  assert.ok(f.position().x < before.x);
});

test("hidden dialogue-time footer controls retain their layout space without accepting pointers", () => {
  const rule = styles.replace(/\/\*[\s\S]*?\*\//g, "").match(/(?:^|\})\s*\.story-footer\s+\.story-touch-controls\[hidden\]\s*\{([^}]*)\}/);
  assert.ok(rule, "in-flow footer controls have their own hidden-state rule instead of disappearing from layout");
  assert.match(rule[1], /display\s*:\s*flex\s*!important\s*;/);
  assert.match(rule[1], /visibility\s*:\s*hidden\s*;/);
  assert.match(rule[1], /pointer-events\s*:\s*none\s*;/);
});

test("opening, navigating and closing dialogue never resize or remeasure the map canvas", () => {
  for (const coarse of [false, true]) {
    const f = fixture({ savedState: beside("hareth"), coarse }); f.context.ClawStoryPreview.show();
    const canvas = f.get("storyCanvas"), touch = f.nodes.get(".story-touch-controls");
    const dimensions = { width: canvas.width, height: canvas.height };
    const measurements = { ...f.layout }, parent = touch.parentElement, position = f.position();
    assert.ok(measurements.stageMeasurements > 0);
    assert.ok(measurements.canvasDimensionWrites > 0);
    for (const closeWithEscape of [false, true]) {
      f.key("KeyE");
      assert.equal(touch.hidden, true);
      f.key("ArrowDown");
      assert.equal(f.document.activeElement.textContent, "Not yet");
      f.key(closeWithEscape ? "Escape" : "KeyE");
      assert.equal(f.get("storyDialogue").hidden, true);
      assert.equal(touch.hidden, false);
      assert.equal(touch.parentElement, parent);
      assert.deepEqual({ width: canvas.width, height: canvas.height }, dimensions);
      assert.deepEqual(f.layout, measurements, "dialogue does not call sizeCanvas or rewrite the bitmap dimensions");
      assert.deepEqual(f.position(), position);
      assert.equal(f.starts.length, 0);
    }
  }
});

test("map sizing fits inside the stage frame and stays unchanged when dialogue opens or closes", () => {
  for (const [width, height] of [[1024, 640], [910, 535], [570, 260], [390, 520]]) {
    const f = fixture({ savedState: beside("hareth"), coarse: width < 700 });
    const stage = f.get("storyStage"), canvas = f.get("storyCanvas");
    stage.clientLeft = 2; stage.clientTop = 2;
    stage.getBoundingClientRect = () => {
      f.layout.stageMeasurements++;
      return { width, height, x: 0, y: 0 };
    };
    f.context.ClawStoryPreview.show();
    const cssWidth = Number.parseFloat(canvas.style.width), cssHeight = Number.parseFloat(canvas.style.height);
    assert.ok(cssWidth > 0 && cssHeight > 0, "canvas CSS dimensions are finite and positive");
    assert.ok(cssWidth <= width - 4, `canvas width fits inside the 2px frame at ${width}×${height}`);
    assert.ok(cssHeight <= height - 4, `canvas height fits inside the 2px frame at ${width}×${height}`);
    const dimensions = { width: canvas.width, height: canvas.height, cssWidth: canvas.style.width, cssHeight: canvas.style.height };
    const measurements = { ...f.layout };
    f.key("KeyE"); f.key("ArrowDown"); f.key("KeyE");
    assert.equal(f.get("storyDialogue").hidden, true);
    assert.deepEqual({ width: canvas.width, height: canvas.height, cssWidth: canvas.style.width, cssHeight: canvas.style.height }, dimensions);
    assert.deepEqual(f.layout, measurements);
  }
});

test("opening dialogue with E selects its first choice without also activating that choice", () => {
  for (const id of ["hareth", "lucan"]) {
    const f = fixture({ savedState: beside(id) }); f.context.ClawStoryPreview.show();
    const opened = f.key("KeyE");
    const [first] = f.get("storyDialogueActions").children;
    assert.equal(opened.defaultPrevented, true);
    assert.equal(f.get("storyDialogue").hidden, false);
    assert.equal(f.document.activeElement, first);
    assert.equal(f.starts.length, 0, "the key which opens dialogue cannot start the encounter too");
    f.key("KeyE", "keydown", first, { repeat: true });
    assert.equal(f.starts.length, 0, "holding the opening key cannot select the first choice");
    assert.equal(f.get("storyDialogue").hidden, false);
  }
});

test("all four dialogue arrow keys move the choice focus with wraparound without moving the player", () => {
  const f = fixture({ savedState: beside("hareth") }); f.context.ClawStoryPreview.show(); f.key("KeyE");
  const [first, second] = f.get("storyDialogueActions").children;
  const before = f.position();
  for (const [code, expected] of [
    ["ArrowRight", second], ["ArrowDown", first],
    ["ArrowLeft", second], ["ArrowUp", first],
  ]) {
    assert.equal(f.key(code).defaultPrevented, true);
    assert.equal(f.document.activeElement, expected, code);
  }
  f.key("KeyW"); f.key("KeyA"); f.key("KeyS"); f.key("KeyD"); f.frame(4);
  assert.deepEqual(f.position(), before);
  assert.equal(f.frames.size, 0);
  assert.equal(f.starts.length, 0);
});

test("E activates only the focused dialogue choice and ignores repeated keydown events", () => {
  const f = fixture({ savedState: beside("hareth") }); f.context.ClawStoryPreview.show(); f.key("KeyE");
  const first = f.document.activeElement;
  assert.equal(f.key("KeyE", "keydown", first, { repeat: true }).defaultPrevented, true);
  assert.equal(f.starts.length, 0);
  assert.equal(f.key("KeyE").defaultPrevented, true);
  f.key("KeyE"); f.key("KeyE", "keydown", first, { repeat: true });
  assert.equal(f.starts.length, 1, "a selected encounter starts exactly once");
  assert.equal(f.get("storyScreen").hidden, true);

  const cancelled = fixture({ savedState: beside("hareth") }); cancelled.context.ClawStoryPreview.show(); cancelled.key("KeyE");
  cancelled.key("ArrowDown"); cancelled.key("KeyE");
  assert.equal(cancelled.get("storyDialogue").hidden, true, "E selects Not yet after navigating to it");
  assert.equal(cancelled.starts.length, 0);
  assert.equal(cancelled.document.activeElement, cancelled.get("storyCanvas"));
});

test("dialogue navigation skips disabled and hidden choices and recovers when focus is elsewhere", () => {
  const f = fixture({ savedState: beside("hareth") }); f.context.ClawStoryPreview.show(); f.key("KeyE");
  const actions = f.get("storyDialogueActions"), [first, second] = actions.children;
  const hiddenChoice = f.document.createElement("button"); hiddenChoice.hidden = true;
  const disabledChoice = f.document.createElement("button"); disabledChoice.disabled = true;
  const unexpectedClicks = [];
  hiddenChoice.addEventListener("click", () => unexpectedClicks.push("hidden"));
  disabledChoice.addEventListener("click", () => unexpectedClicks.push("disabled"));
  actions.insertBefore(hiddenChoice, second); actions.insertBefore(disabledChoice, second);
  f.key("ArrowDown"); assert.equal(f.document.activeElement, second);
  f.key("ArrowDown"); assert.equal(f.document.activeElement, first);
  first.disabled = true;
  f.get("storyDialogueTitle").focus();
  f.key("ArrowLeft"); assert.equal(f.document.activeElement, second, "previous from outside picks last available choice");
  f.get("storyCanvas").focus();
  f.key("ArrowRight"); assert.equal(f.document.activeElement, second, "next from outside picks first available choice");
  f.get("storyDialogueTitle").focus();
  f.key("KeyE");
  assert.equal(f.get("storyDialogue").hidden, true, "E falls back to the first available choice");
  assert.equal(f.starts.length, 0);
  assert.deepEqual(unexpectedClicks, []);
});

test("dialogue keeps native Enter and Space button activation and traps Tab at its boundaries", () => {
  const f = fixture({ savedState: beside("hareth") }); f.context.ClawStoryPreview.show(); f.key("KeyE");
  const [first, last] = f.get("storyDialogueActions").children;
  for (const code of ["Enter", "Space"]) {
    assert.notEqual(f.key(code).defaultPrevented, true, "the browser retains native button activation");
    assert.equal(f.starts.length, 0, "keydown does not synthesize an extra native click");
  }
  assert.equal(f.key("Tab", "keydown", first, { shiftKey: true }).defaultPrevented, true);
  assert.equal(f.document.activeElement, last);
  assert.equal(f.key("Tab").defaultPrevented, true);
  assert.equal(f.document.activeElement, first);
  assert.notEqual(f.key("Tab").defaultPrevented, true, "ordinary forward Tab between choices remains native");
  f.get("storyDialogueTitle").focus();
  assert.equal(f.key("Tab").defaultPrevented, true);
  assert.equal(f.document.activeElement, first);
  f.get("storyDialogueTitle").focus();
  f.key("Tab", "keydown", f.document.activeElement, { shiftKey: true });
  assert.equal(f.document.activeElement, last);
  last.click();
  assert.equal(f.get("storyDialogue").hidden, true, "native button click still selects its action");
  assert.equal(f.starts.length, 0);
});

test("single-choice dialogue wraps safely, accepts E and can still close with Escape", () => {
  const f = fixture({ savedState: beside("gate") }); f.context.ClawStoryPreview.show(); f.key("KeyE");
  const [only] = f.get("storyDialogueActions").children;
  assert.equal(f.document.activeElement, only);
  for (const code of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Tab"]) {
    f.key(code); assert.equal(f.document.activeElement, only);
  }
  f.key("KeyE");
  assert.equal(f.get("storyDialogue").hidden, true);
  assert.equal(f.document.activeElement, f.get("storyCanvas"));
  f.key("KeyE");
  assert.equal(f.key("Escape").defaultPrevented, true);
  assert.equal(f.get("storyDialogue").hidden, true);
  assert.equal(f.get("storyScreen").hidden, false, "Escape closes only the dialogue, not the map");
  assert.equal(f.starts.length, 0);
});

test("returning from a hidden tab restores dialogue focus and empty choices fall back safely", () => {
  const f = fixture({ savedState: beside("hareth") }); f.context.ClawStoryPreview.show(); f.key("KeyE");
  const [first, second] = f.get("storyDialogueActions").children;
  const before = f.position();
  f.document.hidden = true; f.fire(f.document, "visibilitychange");
  f.get("storyCanvas").focus();
  f.document.hidden = false; f.fire(f.document, "visibilitychange");
  assert.equal(f.document.activeElement, first);
  assert.equal(f.get("storyDialogue").hidden, false);
  f.key("ArrowDown");
  assert.equal(f.document.activeElement, second);
  f.document.hidden = true; f.fire(f.document, "visibilitychange");
  f.document.hidden = false; f.fire(f.document, "visibilitychange");
  assert.equal(f.document.activeElement, second, "returning to the tab preserves the selected enabled choice");
  first.disabled = true; second.hidden = true;
  f.document.hidden = true; f.fire(f.document, "visibilitychange");
  f.document.hidden = false; f.fire(f.document, "visibilitychange");
  assert.equal(f.document.activeElement, f.get("storyDialogueTitle"));
  for (const code of ["ArrowRight", "ArrowLeft", "KeyE", "Tab"]) f.key(code);
  f.frame(3);
  assert.deepEqual(f.position(), before);
  assert.equal(f.starts.length, 0);
  assert.equal(f.get("storyDialogue").hidden, false);
  f.key("Escape");
  assert.equal(f.get("storyDialogue").hidden, true);
});

test("touch-direction handlers move, release capture safely and save the resulting position", () => {
  const f = fixture(); f.context.ClawStoryPreview.show();
  const down = f.controls.find(value => value.dataset.storyDirection === "down");
  f.fire(down, "pointerdown", { pointerId: 42 }); f.frame(3);
  assert.ok(f.position().y > 544);
  assert.equal(down.classList.contains("is-held"), true);
  f.fire(down, "pointercancel", { pointerId: 42 });
  f.fire(down, "lostpointercapture", { pointerId: 42 });
  const stopped = f.position(); f.frame(4);
  assert.equal(down.classList.contains("is-held"), false);
  assert.deepEqual(f.position(), stopped);
  assert.equal(Math.round(f.saved().y), stopped.y);
});

test("touch controls reparent across pointer layouts without losing their movement handlers", () => {
  const f = fixture({ coarse: true }); f.context.ClawStoryPreview.show();
  const touch = f.nodes.get(".story-touch-controls");
  assert.equal(touch.parentElement, f.get("storyStage"));
  assert.match(f.get("storyControlsHint").innerHTML, /Hold the arrows/);
  f.setCoarse(false); f.fire(f.context, "resize");
  assert.equal(touch.parentElement, f.nodes.get(".story-footer"));
  assert.match(f.get("storyControlsHint").innerHTML, /WASD/);
  f.setCoarse(true); f.fire(f.context, "resize");
  assert.equal(touch.parentElement, f.get("storyStage"));
  assert.equal(f.get("storyStage").children.filter(child => child === touch).length, 1);
  const right = f.controls.find(value => value.dataset.storyDirection === "right");
  f.fire(right, "pointerdown", { pointerId: 57 }); f.fire(right, "pointerup", { pointerId: 57 });
  assert.ok(f.position().x > 512);
});

test("releasing one of two opposite held directions resumes the remaining input", () => {
  const keyboard = fixture(); keyboard.context.ClawStoryPreview.show();
  keyboard.key("ArrowRight"); keyboard.key("ArrowLeft"); keyboard.frame(2);
  assert.equal(keyboard.frames.size, 0, "opposite directions cancel movement");
  keyboard.key("ArrowLeft", "keyup");
  const before = keyboard.position(); keyboard.frame(3);
  assert.ok(keyboard.position().x > before.x, "the still-held right key resumes movement");
  keyboard.key("ArrowRight", "keyup");

  const touch = fixture({ coarse: true }); touch.context.ClawStoryPreview.show();
  const right = touch.controls.find(value => value.dataset.storyDirection === "right");
  const left = touch.controls.find(value => value.dataset.storyDirection === "left");
  touch.fire(right, "pointerdown", { pointerId: 8 });
  touch.fire(left, "pointerdown", { pointerId: 9 }); touch.frame(2);
  touch.fire(left, "pointerup", { pointerId: 9 });
  const touchBefore = touch.position(); touch.frame(3);
  assert.ok(touch.position().x > touchBefore.x, "the remaining touch input resumes movement");
});

test("encounter launch preserves the map checkpoint and stops all exploration inputs", () => {
  const f = fixture({ savedState: beside("hareth", "blind") }); f.context.ClawStoryPreview.show();
  const before = f.position();
  f.key("KeyE"); f.choose("Duel Hareth");
  assert.equal(f.get("storyScreen").hidden, true);
  assert.deepEqual(f.starts, [{ id: "gate-duel", kind: "duel", difficulty: "blind" }]);
  f.key("ArrowRight"); f.fire(f.controls[2], "pointerdown", { pointerId: 9 }); f.frame(10);
  assert.deepEqual(f.position(), before);
  assert.deepEqual({ x: Math.round(f.saved().x), y: Math.round(f.saved().y) }, before);
  assert.equal(Object.hasOwn(f.saved(), "pendingEncounter"), false);
});

test("all valid duel outcomes return to the exact map position and only a win opens the gate", () => {
  for (const outcome of ["won", "lost", "draw", "retreated"]) {
    const f = fixture({ savedState: beside("hareth") }); f.context.ClawStoryPreview.show();
    const before = f.position();
    f.key("KeyE"); f.choose("Duel Hareth");
    f.returned({ id: "gate-duel", kind: "duel", outcome });
    assert.equal(f.get("storyScreen").hidden, false);
    assert.deepEqual(f.position(), before);
    assert.equal(f.saved().flags.duelWon, outcome === "won");
    assert.equal(f.saved().flags.puzzleWon, false);
    assert.equal(f.get("storyDialogueTitle").textContent, "Hareth");
    assert.ok(f.calls.includes("map-music"));
  }
});

test("duplicate, unsolicited and mismatched result events cannot award additional progress", () => {
  const f = fixture({ savedState: beside("hareth") }); f.context.ClawStoryPreview.show();
  f.returned({ id: "gate-duel", kind: "duel", outcome: "won" });
  assert.equal(f.saved().flags.duelWon, false, "unsolicited victory ignored");
  f.key("KeyE"); f.choose("Duel Hareth");
  for (const result of [{ id: "rally-puzzle", kind: "puzzle", outcome: "won" }, { id: "gate-duel", kind: "puzzle", outcome: "won" }, { id: "gate-duel", kind: "duel", outcome: "invalid" }]) {
    f.returned(result);
    assert.equal(f.get("storyScreen").hidden, true);
    assert.equal(f.saved().flags.duelWon, false);
  }
  f.returned({ id: "gate-duel", kind: "duel", outcome: "retreated" });
  const before = f.storage.getItem(model.STORAGE_KEY), text = f.get("storyDialogueText").textContent;
  f.returned({ id: "gate-duel", kind: "duel", outcome: "won" });
  assert.equal(f.storage.getItem(model.STORAGE_KEY), before);
  assert.equal(f.get("storyDialogueText").textContent, text);
});

test("an abandoned encounter's late startup failure cannot restore the map over a newer battle", async () => {
  for (const lateOutcome of ["reject", "resolve-false"]) {
    const f = fixture({ savedState: beside("hareth") }); f.context.ClawStoryPreview.show();
    const originalStart = f.context.ClawStoryCombat.startEncounter;
    let rejectFirst, resolveFirst, resolveSecond, count = 0;
    const firstOpening = new Promise((resolve, reject) => { resolveFirst = resolve; rejectFirst = reject; });
    const secondOpening = new Promise(resolve => { resolveSecond = resolve; });
    f.context.ClawStoryCombat.startEncounter = options => {
      originalStart(options);
      return ++count === 1 ? firstOpening : secondOpening;
    };
    const before = f.position();
    f.key("KeyE"); f.choose("Duel Hareth");
    f.returned({ id: "gate-duel", kind: "duel", outcome: "retreated" });
    f.choose("Return to courtyard");
    f.key("KeyE"); f.choose("Duel Hareth");
    assert.equal(f.starts.length, 2);
    assert.equal(f.get("storyScreen").hidden, true);
    if (lateOutcome === "reject") rejectFirst(new Error("old opening failed after retreat"));
    else resolveFirst(false);
    // Allow both the production .then and .catch callbacks to settle.
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    assert.equal(f.get("storyScreen").hidden, true, `${lateOutcome} belongs to the abandoned attempt, not the current battle`);
    assert.equal(f.get("storyDialogue").hidden, true);
    assert.deepEqual(f.position(), before);
    assert.equal(f.saved().flags.duelWon, false);
    resolveSecond(true);
    await Promise.resolve(); await Promise.resolve();
    f.returned({ id: "gate-duel", kind: "duel", outcome: "won" });
    assert.equal(f.get("storyScreen").hidden, false);
    assert.equal(f.saved().flags.duelWon, true, "the newer encounter still owns its return callback");
  }
});

test("the optional puzzle records its own stamp but never opens the required gate", () => {
  const f = fixture({ savedState: beside("lucan") }); f.context.ClawStoryPreview.show();
  f.key("Enter"); f.choose("Try Lucan’s puzzle");
  f.returned({ id: "rally-puzzle", kind: "puzzle", outcome: "won" });
  assert.equal(f.saved().flags.puzzleWon, true);
  assert.equal(f.saved().flags.duelWon, false);
  assert.match(f.get("storyPuzzleSeal").textContent, /cleared/);
});

test("reloading during an encounter returns to a safe saved map checkpoint, not a partial battle", () => {
  const storage = makeStorage();
  const first = fixture({ storage, savedState: beside("hareth", "guided") }); first.context.ClawStoryPreview.show();
  const before = first.position(); first.key("KeyE"); first.choose("Duel Hareth");
  const reloaded = fixture({ storage }); reloaded.context.ClawStoryPreview.show();
  assert.deepEqual(reloaded.position(), before);
  assert.equal(reloaded.starts.length, 0);
  assert.equal(reloaded.saved().flags.duelWon, false);
  assert.equal(reloaded.get("storyDifficulty").value, "guided");
  reloaded.key("KeyE"); reloaded.choose("Duel Hareth");
  assert.equal(reloaded.starts.length, 1, "retry remains possible after reloading");
});

test("leaving the map clears held controls, saves progress and restores the independent main menu", () => {
  const f = fixture(); f.context.ClawStoryPreview.show();
  f.key("KeyD"); f.frame(2);
  const before = f.position();
  f.click(f.get("storyBackButton"));
  assert.equal(f.get("storyScreen").hidden, true);
  assert.equal(f.frames.size, 0);
  assert.ok(f.calls.includes("main-menu"));
  assert.equal(f.get("mainMenuScreen").hidden, false);
  f.frame(3); assert.deepEqual(f.position(), before);
  f.click(f.get("mainMenuStoryButton"));
  assert.deepEqual(f.position(), before);
  assert.equal(f.document.activeElement, f.get("storyCanvas"));
});

test("reset requires its dialogue choice and never clears Normal Play preferences", () => {
  const state = beside("lucan"); state.flags.puzzleWon = true;
  const storage = makeStorage({ "projectProwl.boardThemeV2": "map" });
  const f = fixture({ storage, savedState: state }); f.context.ClawStoryPreview.show();
  f.click(f.get("storyResetButton")); f.choose("Keep my progress");
  assert.equal(f.saved().flags.puzzleWon, true);
  f.click(f.get("storyResetButton")); f.choose("Reset this area");
  assert.deepEqual(f.position(), { x: 512, y: 520 });
  assert.equal(f.saved().flags.puzzleWon, false);
  assert.equal(storage.getItem("projectProwl.boardThemeV2"), "map");
});

test("blocked storage and corrupted saves leave the courtyard playable with a clear warning", () => {
  const blocked = fixture({ blockedStorage: true }); blocked.context.ClawStoryPreview.show();
  assert.match(blocked.get("storySaveStatus").textContent, /cannot save/);
  blocked.key("ArrowRight"); blocked.key("ArrowRight", "keyup");
  assert.ok(blocked.position().x > 512);
  const storage = makeStorage({ [model.STORAGE_KEY]: "broken" });
  const corrupt = fixture({ storage }); corrupt.context.ClawStoryPreview.show();
  assert.deepEqual(corrupt.position(), { x: 512, y: 520 });
  assert.equal(corrupt.saved().flags.duelWon, false);
});

test("blur and document visibility stop walking instead of leaving a key stuck down", () => {
  const f = fixture(); f.context.ClawStoryPreview.show();
  f.key("KeyD"); f.frame(2);
  f.fire(f.context, "blur");
  const stopped = f.position(); f.frame(8);
  assert.deepEqual(f.position(), stopped);
  f.key("KeyD"); f.document.hidden = true; f.fire(f.document, "visibilitychange");
  const hidden = f.position(); f.frame(4);
  assert.deepEqual(f.position(), hidden);
  assert.equal(f.frames.size, 0);
});

test("walking through the earned gate completes and saves the area only once", () => {
  const initial = { ...model.createState(), x: 512, y: 145 };
  const locked = fixture({ savedState: initial }); locked.context.ClawStoryPreview.show();
  locked.key("ArrowUp"); locked.frame(25); locked.key("ArrowUp", "keyup");
  assert.equal(locked.saved().flags.areaComplete, false);
  const open = fixture({ savedState: { ...initial, flags: { duelWon: true, puzzleWon: false, areaComplete: false } } });
  open.context.ClawStoryPreview.show(); open.key("ArrowUp"); open.frame(20);
  assert.equal(open.saved().flags.areaComplete, true);
  assert.equal(open.get("storyDialogueTitle").textContent, "Beyond Willowgate");
  assert.equal(open.frames.size, 0, "completion stops walking and opens a single dialogue");
});
