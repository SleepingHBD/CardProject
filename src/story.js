(function exposeStoryPreview(global) {
  "use strict";

  const model = global.ClawStoryModel;
  const screen = document.querySelector("#storyScreen");
  const entry = document.querySelector("#mainMenuStoryButton");
  if (!model || !screen || !entry) return;

  const ui = {
    canvas: document.querySelector("#storyCanvas"),
    stage: document.querySelector("#storyStage"),
    objective: document.querySelector("#storyObjective"),
    nearby: document.querySelector("#storyNearby"),
    seal: document.querySelector("#storyPuzzleSeal"),
    save: document.querySelector("#storySaveStatus"),
    position: document.querySelector("#storyPosition"),
    interact: document.querySelector("#storyInteractButton"),
    difficulty: document.querySelector("#storyDifficulty"),
    back: document.querySelector("#storyBackButton"),
    reset: document.querySelector("#storyResetButton"),
    loading: document.querySelector("#storyLoading"),
    dialogue: document.querySelector("#storyDialogue"),
    portrait: document.querySelector("#storyDialoguePortrait"),
    eyebrow: document.querySelector("#storyDialogueEyebrow"),
    title: document.querySelector("#storyDialogueTitle"),
    text: document.querySelector("#storyDialogueText"),
    note: document.querySelector("#storyDialogueNote"),
    actions: document.querySelector("#storyDialogueActions"),
    touch: document.querySelector(".story-touch-controls"),
    footer: document.querySelector(".story-footer"),
    saveTools: document.querySelector(".story-save-tools"),
    controlHint: document.querySelector("#storyControlsHint"),
  };
  const context = ui.canvas.getContext("2d");
  const directions = Object.freeze({
    up: { x: 0, y: -1 }, left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }, down: { x: 0, y: 1 },
  });
  const keyDirections = Object.freeze({
    ArrowUp: "up", KeyW: "up", ArrowLeft: "left", KeyA: "left",
    ArrowRight: "right", KeyD: "right", ArrowDown: "down", KeyS: "down",
  });
  const heldKeys = new Set();
  const heldPointers = new Map();
  const images = Object.create(null);
  const camera = { x: 0, y: 0, width: 1024, height: 640 };
  let storage = null;
  try { storage = global.localStorage; } catch { /* The area remains playable without storage. */ }
  const loaded = model.load(storage);
  let world = loaded.state;
  let saveAvailable = loaded.available;
  let phase = "hidden";
  let frame = 0;
  let previousFrame = 0;
  let lastSaveAt = 0;
  let previousSaved = loaded.saved ? model.serialize(world) : "";
  let nearestId = null;
  let walking = false;
  let dialogueClose = null;
  let pendingEncounter = null;
  let artworkRequested = false;

  function active() { return phase === "walking" && !screen.hidden && !document.hidden; }

  function saveProgress(force = false) {
    const snapshot = model.serialize(world);
    if (!force && snapshot === previousSaved) return;
    saveAvailable = model.save(storage, world);
    if (saveAvailable) previousSaved = snapshot;
    lastSaveAt = performance.now();
    ui.save.textContent = saveAvailable
      ? "Progress saved in this browser. Leaving a duel returns you to before that encounter."
      : "This browser cannot save progress. You can still play for this session.";
    ui.save.classList.toggle("is-warning", !saveAvailable);
  }

  function stopLoop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    previousFrame = 0;
  }

  function clearInput() {
    heldKeys.clear();
    heldPointers.clear();
    document.querySelectorAll("[data-story-direction].is-held").forEach(button => button.classList.remove("is-held"));
    walking = false;
    stopLoop();
  }

  function inputVector() {
    let x = 0, y = 0;
    for (const code of heldKeys) {
      const direction = directions[keyDirections[code]];
      if (direction) { x += direction.x; y += direction.y; }
    }
    for (const name of heldPointers.values()) { x += directions[name].x; y += directions[name].y; }
    return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
  }

  function updateStatus() {
    ui.objective.textContent = world.flags.areaComplete
      ? "Courtyard complete. You can revisit the residents or return to the main menu."
      : world.flags.duelWon
        ? "The north gate is open. Follow the path through the archway."
        : "Meet Hareth and earn passage through the north gate.";
    ui.seal.textContent = world.flags.puzzleWon ? "✦ Lucan’s challenge cleared" : "Lucan’s challenge · optional";
    ui.seal.classList.toggle("is-complete", world.flags.puzzleWon);
    ui.difficulty.value = world.difficulty;
    ui.position.value = `${Math.round(world.x)}, ${Math.round(world.y)}`;
    ui.canvas.dataset.positionX = String(Math.round(world.x));
    ui.canvas.dataset.positionY = String(Math.round(world.y));
    ui.canvas.dataset.facing = world.facing;
    ui.canvas.dataset.gateOpen = String(world.flags.duelWon);
    ui.canvas.dataset.areaComplete = String(world.flags.areaComplete);
    const target = model.nearestInteraction(world);
    if (nearestId !== (target?.id || null)) {
      nearestId = target?.id || null;
      ui.nearby.textContent = target
        ? target.id === "gate" ? "North Gate · press E or Interact" : `${target.name} · press E or Interact`
        : "Walk toward someone to talk.";
    }
    ui.interact.disabled = phase !== "walking" || !target;
    ui.interact.textContent = target && target.kind === "npc" ? `Talk to ${target.name}` : "Interact";
  }

  function followPlayer() {
    camera.x = Math.max(0, Math.min(model.MAP.width - camera.width, world.x - camera.width / 2));
    camera.y = Math.max(0, Math.min(model.MAP.height - camera.height, world.y - camera.height / 2));
  }

  function drawGate() {
    const gate = model.MAP.gate;
    if (world.flags.duelWon) {
      context.save();
      context.strokeStyle = "#f6d489";
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(489, 100); context.lineTo(512, 83); context.lineTo(535, 100);
      context.stroke();
      context.restore();
      return;
    }
    context.save();
    context.fillStyle = "#5a3826";
    context.strokeStyle = "#30251c";
    context.lineWidth = 4;
    context.fillRect(gate.x + 6, 40, gate.width - 12, gate.height - 40);
    context.strokeRect(gate.x + 6, 40, gate.width - 12, gate.height - 40);
    context.strokeStyle = "#916747";
    context.lineWidth = 2;
    for (let x = gate.x + 22; x < gate.x + gate.width - 7; x += 18) {
      context.beginPath(); context.moveTo(x, 42); context.lineTo(x, gate.height - 2); context.stroke();
    }
    context.fillStyle = "#b28d48";
    context.fillRect(gate.x + 3, 63, gate.width - 6, 9);
    context.fillRect(gate.x + 3, 106, gate.width - 6, 8);
    context.fillStyle = "#342a22";
    for (const x of [gate.x + 12, gate.x + gate.width - 12]) for (const y of [67, 110]) {
      context.beginPath(); context.arc(x, y, 2.5, 0, Math.PI * 2); context.fill();
    }
    context.restore();
  }

  function drawActor(actor, timestamp) {
    const isPlayer = actor.id === "player";
    const image = images[actor.id];
    const height = isPlayer ? 70 : 79;
    // Generated artwork has transparent breathing room; preserve the source
    // aspect ratio instead of squeezing a full sprite into a narrow column.
    const width = image?.naturalWidth && image?.naturalHeight
      ? height * (image.naturalWidth / image.naturalHeight)
      : height;
    context.save();
    context.fillStyle = "#342b253d";
    context.beginPath(); context.ellipse(actor.x, actor.y - 2, width * .32, 8, 0, 0, Math.PI * 2); context.fill();
    if (image?.complete && image.naturalWidth) {
      if (isPlayer) {
        const row = ["down", "left", "right", "up"].indexOf(world.facing);
        const column = walking ? Math.floor(timestamp / 140) % 4 : 0;
        const sw = image.naturalWidth / 4, sh = image.naturalHeight / 4;
        context.drawImage(image, column * sw, Math.max(0, row) * sh, sw, sh, actor.x - width / 2, actor.y - height + 5, width, height);
      } else {
        context.drawImage(image, actor.x - width / 2, actor.y - height + 5, width, height);
      }
    }
    if (!isPlayer) {
      context.font = '900 13px "Nunito", sans-serif';
      context.textAlign = "center";
      context.lineWidth = 4;
      context.strokeStyle = "#fbebc8";
      context.strokeText(actor.name, actor.x, actor.y - height - 3);
      context.fillStyle = "#3b3022";
      context.fillText(actor.name, actor.x, actor.y - height - 3);
      if (nearestId === actor.id && phase === "walking") {
        context.fillStyle = "#3f3026";
        context.strokeStyle = "#f7df9c";
        context.lineWidth = 2;
        context.beginPath(); context.arc(actor.x + 32, actor.y - height + 9, 11, 0, Math.PI * 2); context.fill(); context.stroke();
        context.fillStyle = "#f7e5b7";
        context.font = '900 11px "Nunito", sans-serif';
        context.fillText("E", actor.x + 32, actor.y - height + 13);
      }
    }
    context.restore();
  }

  function draw(timestamp = performance.now()) {
    if (screen.hidden || !context) return;
    followPlayer();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
    context.fillStyle = "#b8b38a";
    context.fillRect(0, 0, ui.canvas.width, ui.canvas.height);
    context.save();
    context.translate(-camera.x, -camera.y);
    const background = images.background;
    if (background?.complete && background.naturalWidth) {
      context.drawImage(background, 0, 0, model.MAP.width, model.MAP.height);
    }
    drawGate();
    const actors = model.INTERACTABLES.filter(target => target.kind === "npc").map(target => ({ ...target }));
    actors.push({ id: "player", name: "You", x: world.x, y: world.y });
    actors.sort((a, b) => a.y - b.y).forEach(actor => drawActor(actor, timestamp));
    context.restore();
    updateStatus();
  }

  function sizeCanvas() {
    if (screen.hidden) return;
    const overlayControls = Boolean(global.matchMedia?.("(pointer: coarse), (max-width: 700px), (max-height: 600px)").matches);
    screen.classList.toggle("has-touch-controls", overlayControls);
    ui.stage.classList.toggle("has-touch-controls", overlayControls);
    if (overlayControls && ui.touch.parentElement !== ui.stage) ui.stage.append(ui.touch);
    else if (!overlayControls && ui.touch.parentElement !== ui.footer) ui.footer.insertBefore(ui.touch, ui.saveTools);
    ui.controlHint.innerHTML = overlayControls
      ? "Hold the arrows to walk <span>·</span> Interact near someone"
      : "<b>WASD / arrows</b> walk <span>·</span> <b>E / Space</b> interact";
    const bounds = ui.stage.getBoundingClientRect();
    // Fit inside the stage's symmetric frame, not its border box. An oversized
    // canvas makes even overflow:hidden scroll a few pixels when focus moves.
    const width = bounds.width - 2 * ui.stage.clientLeft;
    const height = bounds.height - 2 * ui.stage.clientTop;
    if (width <= 0 || height <= 0) return;
    const ratio = width / height;
    if (height < 380 && ratio > 1.2) {
      camera.height = 360;
      camera.width = Math.min(model.MAP.width, Math.round(camera.height * ratio));
    } else if (width < 640 && ratio < 1.2) {
      camera.width = Math.min(480, model.MAP.width);
      camera.height = Math.min(model.MAP.height, Math.round(camera.width / ratio));
      camera.width = Math.min(camera.width, Math.round(camera.height * ratio));
    } else {
      camera.width = model.MAP.width;
      camera.height = model.MAP.height;
    }
    ui.canvas.width = camera.width;
    ui.canvas.height = camera.height;
    const scale = Math.min(width / camera.width, height / camera.height);
    ui.canvas.style.width = `${Math.floor(camera.width * scale)}px`;
    ui.canvas.style.height = `${Math.floor(camera.height * scale)}px`;
    ui.canvas.style.aspectRatio = `${camera.width} / ${camera.height}`;
    draw();
  }

  function finishArea() {
    saveProgress(true);
    openDialogue({
      title: "Beyond Willowgate", eyebrow: "FIRST AREA COMPLETE",
      portrait: "./assets/characters/rookie.webp",
      text: "The bar is lifted, and the courtyard falls quiet behind you. Beyond the archway, the road bends toward the river. This is where the first playable preview ends.",
      note: world.flags.puzzleWon ? "You also cleared Lucan’s optional challenge. Your progress is saved." : "Lucan’s optional challenge is still waiting if you would like to return.",
      choices: [{ label: "Stay in the courtyard", action: closeDialogue }, { label: "Return to Main Menu", secondary: true, action: leave }],
    });
  }

  function tick(timestamp) {
    frame = 0;
    if (!active()) return;
    const dt = previousFrame ? Math.min(.05, (timestamp - previousFrame) / 1000) : 1 / 60;
    previousFrame = timestamp;
    const vector = inputVector();
    const result = model.move(world, vector.x, vector.y, dt);
    walking = result.moved;
    draw(timestamp);
    if (result.completed) { finishArea(); return; }
    if (result.moved && timestamp - lastSaveAt > 2000) saveProgress();
    if (vector.x || vector.y) frame = requestAnimationFrame(tick);
    else previousFrame = 0;
  }

  function startLoop() {
    if (!frame && active()) frame = requestAnimationFrame(tick);
  }

  function nudge(name, distance = 20) {
    if (!active()) return;
    const direction = directions[name];
    let remaining = distance;
    let completed = false;
    while (remaining > 0) {
      const step = Math.min(remaining, 6);
      const result = model.move(world, direction.x, direction.y, step / model.MAP.speed);
      completed ||= result.completed;
      remaining -= step;
      if (!result.moved || completed) break;
    }
    draw();
    if (completed) finishArea();
  }

  function closeDialogue() {
    ui.dialogue.hidden = true;
    ui.touch.hidden = false;
    dialogueClose = null;
    if (phase !== "battle" && phase !== "hidden") phase = "walking";
    ui.canvas.focus({ preventScroll: true });
    draw();
  }

  function dialogueButtons() {
    return [...ui.actions.querySelectorAll("button")].filter(button => !button.disabled && !button.hidden);
  }

  function openDialogue({ title, text, note = "", eyebrow = "WILLOWGATE", portrait = "./assets/characters/rookie.webp", choices, onClose = closeDialogue }) {
    clearInput();
    phase = "dialogue";
    ui.title.textContent = title;
    ui.text.textContent = text;
    ui.note.textContent = note;
    ui.note.hidden = !note;
    ui.eyebrow.textContent = eyebrow;
    ui.portrait.src = portrait;
    ui.portrait.hidden = !portrait;
    ui.actions.replaceChildren();
    for (const choice of choices) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = choice.label;
      if (choice.secondary) button.className = "story-secondary";
      button.addEventListener("click", choice.action);
      ui.actions.append(button);
    }
    dialogueClose = onClose;
    ui.dialogue.hidden = false;
    ui.touch.hidden = true;
    (dialogueButtons()[0] || ui.title).focus({ preventScroll: true });
    draw();
  }

  function beginEncounter(target) {
    if (phase !== "dialogue" || pendingEncounter) return;
    const combat = global.ClawStoryCombat;
    if (!combat || combat.isActive()) return;
    saveProgress(true);
    pendingEncounter = { id: target.encounterId, kind: target.encounterKind };
    const attempt = pendingEncounter;
    clearInput();
    phase = "battle";
    ui.dialogue.hidden = true;
    dialogueClose = null;
    screen.hidden = true;
    document.body.classList.remove("story-active");
    try {
      const started = combat.startEncounter({ ...attempt, difficulty: world.difficulty });
      Promise.resolve(started).then(result => { if (result === false) encounterStartFailed(attempt); }).catch(() => encounterStartFailed(attempt));
    } catch { encounterStartFailed(attempt); }
  }

  function encounterStartFailed(attempt) {
    if (phase !== "battle" || pendingEncounter !== attempt) return;
    pendingEncounter = null;
    restoreScreen();
    openDialogue({ title: "The encounter could not begin", text: "Your courtyard progress is safe. Return to the map and try again.", choices: [{ label: "Return to courtyard", action: closeDialogue }] });
  }

  function interact() {
    if (!active()) return;
    const target = model.nearestInteraction(world);
    if (!target) return;
    saveProgress();
    if (target.id === "hareth") {
      openDialogue({
        title: "Hareth", eyebrow: "AT THE NORTHERN WATCH", portrait: target.portrait,
        text: world.flags.duelWon
          ? "“A good showing. I’ve lifted the bar for you. The northern path is yours—unless you fancy another practice bout first.”"
          : "“The north gate stays barred until I know a traveller can hold their ground. A practice bout, if you’re willing. No grudges either way.”",
        note: `Normal duel · ${world.difficulty[0].toUpperCase() + world.difficulty.slice(1)} · Collect two trophies of every element. Habits are randomised as usual.`,
        choices: [{ label: world.flags.duelWon ? "Duel Hareth again" : "Duel Hareth", action: () => beginEncounter(target) }, { label: "Not yet", secondary: true, action: closeDialogue }],
      });
    } else if (target.id === "lucan") {
      openDialogue({
        title: "Lucan", eyebrow: "BESIDE THE WORKSHOP", portrait: target.portrait,
        text: world.flags.puzzleWon
          ? "“You found a neat way through. There’s always another arrangement worth trying, if you’d like another look.”"
          : "“The kiln needs a moment. I’ve set out a little tactical exercise while we wait. Think you can find a way through?”",
        note: "Optional puzzle · Win one round using no more than two cards. The opponent’s fixed formation is fully revealed. Any valid solution counts.",
        choices: [{ label: world.flags.puzzleWon ? "Try the puzzle again" : "Try Lucan’s puzzle", action: () => beginEncounter(target) }, { label: "Maybe later", secondary: true, action: closeDialogue }],
      });
    } else {
      openDialogue({
        title: "The North Gate", eyebrow: world.flags.duelWon ? "THE WAY IS OPEN" : "BARRED FOR NOW", portrait: "./assets/characters/rookie.webp",
        text: world.flags.duelWon ? "The bar has been lifted. Walk north through the archway to leave the courtyard." : "The heavy bar is still in place. Hareth is keeping watch on the eastern side of the courtyard.",
        choices: [{ label: "Return to courtyard", action: closeDialogue }],
      });
    }
  }

  function restoreScreen() {
    document.querySelector("#mainMenuScreen").hidden = true;
    document.body.classList.remove("main-menu-active");
    document.body.classList.add("story-active");
    screen.hidden = false;
    phase = "walking";
    global.ClawAudio?.startMainMenuMusic?.();
    ui.dialogue.hidden = true;
    ui.touch.hidden = false;
    nearestId = null;
    sizeCanvas();
    ui.canvas.focus({ preventScroll: true });
    updateStatus();
    draw();
  }

  function show() {
    if (global.ClawStoryCombat?.isActive()) return;
    loadStoryArtwork();
    pendingEncounter = null;
    clearInput();
    restoreScreen();
    saveProgress();
  }

  function leave() {
    if (phase === "battle") return;
    saveProgress(true);
    clearInput();
    phase = "hidden";
    ui.dialogue.hidden = true;
    dialogueClose = null;
    screen.hidden = true;
    document.body.classList.remove("story-active");
    if (typeof global.showMainMenu === "function") global.showMainMenu();
    else {
      document.querySelector("#mainMenuScreen").hidden = false;
      document.body.classList.add("main-menu-active");
    }
    entry.focus({ preventScroll: true });
  }

  function confirmReset() {
    if (phase === "battle") return;
    openDialogue({
      title: "Reset this area?", eyebrow: "STORY PREVIEW PROGRESS",
      text: "This returns you to the courtyard entrance and clears only this area’s duel, puzzle and gate progress. Your Normal Play settings are not changed.",
      choices: [{ label: "Keep my progress", action: closeDialogue }, { label: "Reset this area", secondary: true, action: () => {
        model.reset(storage);
        world = model.createState();
        previousSaved = "";
        nearestId = null;
        closeDialogue();
        saveProgress(true);
        sizeCanvas();
      } }],
    });
  }

  function returnedFromEncounter(event) {
    if (!pendingEncounter || phase !== "battle") return;
    const result = event.detail;
    if (!result || result.id !== pendingEncounter.id || result.kind !== pendingEncounter.kind
      || !["won", "lost", "draw", "retreated"].includes(result.outcome)) return;
    const encounter = pendingEncounter;
    pendingEncounter = null;
    model.applyEncounterResult(world, result);
    saveProgress(true);
    restoreScreen();
    const target = model.INTERACTABLES.find(value => value.encounterId === encounter.id);
    let text;
    if (encounter.kind === "duel") {
      text = result.outcome === "won"
        ? "“Well held,” Hareth says, swinging the bar clear. “The northern path is open. Safe travels.”"
        : result.outcome === "retreated"
          ? "Hareth rests his drumsticks. “We can finish another time. The courtyard isn’t going anywhere.”"
          : "Hareth offers a small nod. “A practice bout, remember. Take your time; I’ll be here when you’re ready for another.”";
    } else {
      text = result.outcome === "won"
        ? "Lucan sets a small clay seal on the bench. “A tidy solution. That one’s yours.” Your optional challenge is marked complete."
        : result.outcome === "retreated"
          ? "Lucan covers his work. “No hurry. The exercise will be here when you return.”"
          : "Lucan leaves the arrangement in place. “Not quite this time. You’re welcome to try another approach.”";
    }
    openDialogue({ title: target?.name || "Back in the courtyard", portrait: target?.portrait, eyebrow: "BACK IN WILLOWGATE", text, choices: [{ label: "Return to courtyard", action: closeDialogue }] });
  }

  function onKeyDown(event) {
    if (screen.hidden || phase === "hidden" || phase === "battle") return;
    if (phase === "dialogue") {
      const buttons = dialogueButtons();
      if (event.code === "Escape") {
        event.preventDefault();
        dialogueClose?.();
      } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
        event.preventDefault();
        const previous = event.code === "ArrowUp" || event.code === "ArrowLeft";
        const current = buttons.indexOf(document.activeElement);
        const next = current < 0 ? previous ? buttons.length - 1 : 0
          : (current + (previous ? -1 : 1) + buttons.length) % buttons.length;
        buttons[next]?.focus({ preventScroll: true });
      } else if (event.code === "KeyE") {
        event.preventDefault();
        if (!event.repeat) {
          const selected = buttons.includes(document.activeElement) ? document.activeElement : buttons[0];
          selected?.click();
        }
      } else if (event.code === "Tab") {
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && (document.activeElement === first || !buttons.includes(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !buttons.includes(document.activeElement))) { event.preventDefault(); first?.focus(); }
      }
      return;
    }
    if (event.target.closest?.("select, input, textarea, [contenteditable]")) return;
    const name = keyDirections[event.code];
    if (name) {
      event.preventDefault();
      if (!heldKeys.has(event.code)) { heldKeys.add(event.code); nudge(name, 12); startLoop(); }
    } else if (["KeyE", "Enter", "Space"].includes(event.code) && !event.repeat && event.target.tagName !== "BUTTON") {
      event.preventDefault();
      interact();
    } else if (event.code === "Escape") { event.preventDefault(); leave(); }
  }

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", event => {
    if (!heldKeys.has(event.code)) return;
    heldKeys.delete(event.code);
    if (!heldKeys.size && !heldPointers.size) { walking = false; stopLoop(); draw(); saveProgress(); }
    else startLoop();
  });
  document.querySelectorAll("[data-story-direction]").forEach(button => {
    button.addEventListener("pointerdown", event => {
      if (!active()) return;
      event.preventDefault();
      const name = button.dataset.storyDirection;
      heldPointers.set(event.pointerId, name);
      button.classList.add("is-held");
      button.setPointerCapture?.(event.pointerId);
      nudge(name, 24);
      startLoop();
    });
    const release = event => {
      heldPointers.delete(event.pointerId);
      button.classList.remove("is-held");
      if (!heldPointers.size && !heldKeys.size) { walking = false; stopLoop(); draw(); saveProgress(); }
      else startLoop();
    };
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
    button.addEventListener("click", event => { if (event.detail === 0) { nudge(button.dataset.storyDirection, 24); saveProgress(); } });
  });
  ui.interact.addEventListener("click", interact);
  ui.back.addEventListener("click", leave);
  ui.reset.addEventListener("click", confirmReset);
  ui.canvas.addEventListener("pointerdown", () => ui.canvas.focus({ preventScroll: true }));
  ui.difficulty.addEventListener("change", () => {
    if (model.DIFFICULTIES.includes(ui.difficulty.value)) { world.difficulty = ui.difficulty.value; saveProgress(); }
  });
  entry.addEventListener("click", show);
  document.addEventListener("prowl:story-return", returnedFromEncounter);
  global.addEventListener("blur", () => { clearInput(); if (!screen.hidden) { saveProgress(); draw(); } });
  global.addEventListener("pagehide", () => saveProgress());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { clearInput(); saveProgress(); }
    else if (!screen.hidden) {
      draw();
      const buttons = dialogueButtons();
      const focusTarget = phase === "dialogue"
        ? buttons.includes(document.activeElement) ? document.activeElement : buttons[0] || ui.title
        : ui.canvas;
      focusTarget.focus({ preventScroll: true });
    }
  });
  global.addEventListener("resize", sizeCanvas, { passive: true });
  global.addEventListener("orientationchange", sizeCanvas, { passive: true });
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(sizeCanvas).observe(ui.stage);

  function loadImage(key, path) {
    const image = new Image();
    images[key] = image;
    image.onload = () => {
      if (key === "background") ui.loading.hidden = true;
      draw();
    };
    image.onerror = () => {
      if (key === "background") {
        ui.loading.textContent = "The courtyard artwork could not load. Refresh the preview to try again.";
      }
      draw();
    };
    image.src = path;
  }
  function loadStoryArtwork() {
    if (artworkRequested) return;
    artworkRequested = true;
    loadImage("background", "./assets/story/willowgate-courtyard.png");
    loadImage("player", "./assets/story/player-walk.png");
    loadImage("hareth", "./assets/story/hareth.png");
    loadImage("lucan", "./assets/story/lucan.png");
  }
  if (!loaded.available) {
    ui.save.textContent = "This browser cannot save progress. You can still play for this session.";
    ui.save.classList.add("is-warning");
  }
  global.ClawStoryPreview = Object.freeze({ show, hide: leave, isVisible: () => !screen.hidden });
})(globalThis);
