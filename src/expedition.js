import {
  CARD_LIBRARY,
  CLASS_FORMS,
  ELEMENTS,
  ENEMIES,
  RELICS,
  TALENTS,
  bondRank,
  bondReward,
  cardDefinition,
  createRun,
  elementEdge,
  intentLabel,
  randomItem,
  shuffle,
  uniqueRewardChoices,
} from "./expedition-rules.js";

const PROFILE_KEY = "projectProwl.expeditionProfile";
const RUN_KEY = "projectProwl.expeditionRun";
const DB_NAME = "projectProwlExpedition";
const DB_STORE = "assets";
const PORTRAIT_KEY = "petPortrait";
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const PROWL_MAX = 10;

const ui = Object.fromEntries(
  [...document.querySelectorAll("[id]")].map((element) => [element.id, element]),
);

let profile = readJson(PROFILE_KEY);
let run = readJson(RUN_KEY);
let portraitUrl = "";
let sourceImage = null;
let selectedClassId = profile?.classId || "ember-knight";
let activeDecisionActions = new Map();
let saveTimer = null;

const NODE_DETAILS = {
  battle: { icon: "⚔", label: "Battle" },
  elite: { icon: "♜", label: "Elite battle" },
  boss: { icon: "♛", label: "Final guardian" },
  event: { icon: "?", label: "Road event" },
  camp: { icon: "♨", label: "Campfire" },
  shop: { icon: "¤", label: "Travelling shop" },
};

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function announceSave(message = "Saved locally") {
  clearTimeout(saveTimer);
  ui.saveIndicator.textContent = message;
  saveTimer = setTimeout(() => {
    ui.saveIndicator.textContent = "Saved locally";
  }, 1500);
}

function saveProfile() {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  announceSave();
}

function saveRun() {
  if (run) localStorage.setItem(RUN_KEY, JSON.stringify(run));
  else localStorage.removeItem(RUN_KEY);
  announceSave();
}

function openPortraitDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storePortrait(blob) {
  const database = await openPortraitDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(DB_STORE, "readwrite");
    transaction.objectStore(DB_STORE).put(blob, PORTRAIT_KEY);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function loadPortrait() {
  const database = await openPortraitDatabase();
  const blob = await new Promise((resolve, reject) => {
    const request = database.transaction(DB_STORE).objectStore(DB_STORE).get(PORTRAIT_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  database.close();
  if (portraitUrl) URL.revokeObjectURL(portraitUrl);
  portraitUrl = blob ? URL.createObjectURL(blob) : "";
  return portraitUrl;
}

function showScreen(screen) {
  document.querySelectorAll(".app-screen").forEach((candidate) => {
    candidate.hidden = candidate !== screen;
  });
  window.scrollTo({ top: 0, behavior: "instant" });
}

function classForm() {
  return CLASS_FORMS[profile?.classId || selectedClassId] || CLASS_FORMS["ember-knight"];
}

function talentValue(key) {
  return (run?.talents || []).reduce((total, talentId) => {
    const talent = (TALENTS[run.classId] || []).find((item) => item.id === talentId);
    return total + (talent?.[key] || 0);
  }, 0);
}

function hasRelic(id) {
  return run?.relics?.includes(id);
}

function elementMarkup(elementId) {
  const element = ELEMENTS[elementId];
  return element ? `${element.icon} ${element.label}` : "◇ Neutral";
}

function createChampionCard({ compact = false } = {}) {
  const form = classForm();
  const card = document.createElement("article");
  card.className = `champion-card${compact ? " compact" : ""}`;
  card.dataset.element = form.element;
  card.innerHTML = `
    <div class="champion-card-crown"><span>${form.icon}</span></div>
    <div class="champion-portrait">
      ${portraitUrl ? `<img src="${portraitUrl}" alt="${escapeHtml(profile.name)}">` : '<span class="champion-silhouette" aria-hidden="true">♞</span>'}
    </div>
    <div class="champion-nameplate">
      <strong>${escapeHtml(profile.name)}</strong>
      <span>${form.name}</span>
    </div>
    <div class="champion-card-stats">
      <span><b>${run?.maxHealth || form.maxHealth}</b> health</span>
      <span>${elementMarkup(form.element)}</span>
    </div>`;
  return card;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
  })[character]);
}

function renderClassChoices() {
  ui.classChoices.replaceChildren();
  Object.values(CLASS_FORMS).forEach((form) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "class-choice";
    button.dataset.classId = form.id;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(form.id === selectedClassId));
    button.style.setProperty("--class-color", `var(--${form.element})`);
    button.innerHTML = `
      <span class="class-choice-icon" aria-hidden="true">${form.icon}</span>
      <strong>${form.name}</strong>
      <small>${form.summary}</small>
      <small><b>${form.passiveName}:</b> ${form.passive}</small>`;
    ui.classChoices.append(button);
  });
}

function updateCreatorPreview() {
  const form = CLASS_FORMS[selectedClassId];
  const name = ui.petNameInput.value.trim() || "Your Pet";
  ui.creatorChampionCard.dataset.element = form.element;
  ui.creatorClassIcon.textContent = form.icon;
  ui.creatorCardName.textContent = name;
  ui.creatorCardClass.textContent = form.name;
  ui.creatorCardHealth.textContent = form.maxHealth;
  ui.creatorCardElement.textContent = elementMarkup(form.element);
  document.querySelectorAll(".class-choice").forEach((button) => {
    button.setAttribute("aria-checked", String(button.dataset.classId === selectedClassId));
  });
}

function updateCropPreview() {
  const x = `${ui.cropX.value}%`;
  const y = `${ui.cropY.value}%`;
  const zoom = Number(ui.cropZoom.value) / 100;
  [ui.petPhotoPreview, ui.creatorCardPhoto].forEach((image) => {
    image.style.objectPosition = `${x} ${y}`;
    image.style.transform = `scale(${zoom})`;
  });
}

function showSourceImage(image, url) {
  sourceImage = image;
  [ui.petPhotoPreview, ui.creatorCardPhoto].forEach((preview) => {
    preview.src = url;
    preview.hidden = false;
  });
  ui.photoPlaceholder.hidden = true;
  ui.creatorCardPlaceholder.hidden = true;
  ui.cropControls.hidden = false;
  ui.photoButtonLabel.textContent = "Choose a different photo";
  updateCropPreview();
}

async function handlePhotoSelection(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > MAX_PHOTO_BYTES) {
    ui.creatorStatus.textContent = "Please choose a PNG, JPG or WebP image no larger than 12 MB.";
    event.target.value = "";
    return;
  }
  const temporaryUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    showSourceImage(image, temporaryUrl);
    ui.creatorStatus.textContent = "Use the controls to frame your pet's face clearly.";
  };
  image.onerror = () => {
    URL.revokeObjectURL(temporaryUrl);
    ui.creatorStatus.textContent = "That image could not be read. Please try another file.";
  };
  image.src = temporaryUrl;
}

function cropPortraitBlob() {
  return new Promise((resolve, reject) => {
    if (!sourceImage) {
      resolve(null);
      return;
    }
    const size = 768;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d", { alpha: false });
    const zoom = Number(ui.cropZoom.value) / 100;
    const baseScale = Math.max(size / sourceImage.naturalWidth, size / sourceImage.naturalHeight);
    const scale = baseScale * zoom;
    const width = sourceImage.naturalWidth * scale;
    const height = sourceImage.naturalHeight * scale;
    const x = (size - width) * (Number(ui.cropX.value) / 100);
    const y = (size - height) * (Number(ui.cropY.value) / 100);
    context.fillStyle = "#171012";
    context.fillRect(0, 0, size, size);
    context.drawImage(sourceImage, x, y, width, height);
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Portrait export failed")), "image/webp", .86);
  });
}

async function saveChampion() {
  const name = ui.petNameInput.value.trim();
  if (!name) {
    ui.creatorStatus.textContent = "Give your champion a name before continuing.";
    ui.petNameInput.focus();
    return;
  }
  if (!sourceImage && !portraitUrl) {
    ui.creatorStatus.textContent = "Choose a pet photo before continuing.";
    ui.petPhotoInput.focus();
    return;
  }
  ui.saveChampionButton.disabled = true;
  ui.creatorStatus.textContent = "Forging your champion card…";
  try {
    const croppedPortrait = await cropPortraitBlob();
    if (croppedPortrait) {
      await storePortrait(croppedPortrait);
      await loadPortrait();
    }
    const existing = profile || {};
    const classChanged = existing.classId && existing.classId !== selectedClassId;
    profile = {
      version: 1,
      name,
      classId: selectedClassId,
      bondXp: existing.bondXp || 0,
      runs: existing.runs || 0,
      wins: existing.wins || 0,
    };
    if (classChanged && run) {
      run = null;
      saveRun();
    }
    saveProfile();
    renderHub();
  } catch (error) {
    console.error(error);
    ui.creatorStatus.textContent = "The portrait could not be saved. Please try again.";
  } finally {
    ui.saveChampionButton.disabled = false;
  }
}

function renderCreator() {
  selectedClassId = profile?.classId || selectedClassId;
  ui.petNameInput.value = profile?.name || "";
  ui.saveChampionButton.textContent = profile ? "Save champion" : "Create champion";
  renderClassChoices();
  updateCreatorPreview();
  if (portraitUrl) {
    [ui.petPhotoPreview, ui.creatorCardPhoto].forEach((image) => {
      image.src = portraitUrl;
      image.hidden = false;
      image.style.transform = "none";
      image.style.objectPosition = "center";
    });
    ui.photoPlaceholder.hidden = true;
    ui.creatorCardPlaceholder.hidden = true;
    ui.cropControls.hidden = true;
    ui.photoButtonLabel.textContent = "Choose a different photo";
  }
  showScreen(ui.creatorScreen);
}

function renderHub() {
  ui.hubPetName.textContent = profile.name;
  ui.hubChampionMount.replaceChildren(createChampionCard());
  const rank = bondRank(profile.bondXp);
  ui.hubStats.innerHTML = `
    <div class="hub-stat"><b>${rank}</b><span>Bond rank</span></div>
    <div class="hub-stat"><b>${profile.bondXp}</b><span>Bond XP</span></div>
    <div class="hub-stat"><b>${profile.runs}</b><span>Runs begun</span></div>
    <div class="hub-stat"><b>${profile.wins}</b><span>Expeditions won</span></div>`;
  ui.startRunButton.textContent = run ? "Resume expedition" : "Begin expedition";
  showScreen(ui.hubScreen);
}

function startOrResumeRun() {
  if (!run) {
    run = createRun(profile);
    profile.runs += 1;
    saveProfile();
    saveRun();
  }
  if (run.combat) renderCombat();
  else if (run.pendingReward?.length) showNextReward();
  else if (run.pendingNode?.type === "camp") showCamp();
  else if (run.pendingNode?.type === "shop") showShop();
  else if (run.pendingNode?.type === "event") showEvent(run.pendingNode.eventId);
  else renderMap();
}

function runVitalsMarkup() {
  return `
    <span class="vital-chip">♥ <b>${run.hp}</b> / ${run.maxHealth}</span>
    <span class="vital-chip">¤ <b>${run.coins}</b> coins</span>
    <span class="vital-chip">Level <b>${run.level}</b></span>
    <span class="vital-chip"><b>${run.deck.length}</b> cards</span>`;
}

function renderMap() {
  ui.mapRunVitals.innerHTML = runVitalsMarkup();
  ui.mapChampionMount.replaceChildren(createChampionCard({ compact: true }));
  const items = [
    ...(run.relics.length ? run.relics.map((id) => `${RELICS[id].icon} ${RELICS[id].name}`) : ["No relics found yet"]),
    ...(run.talents.length ? run.talents.map((id) => `✦ ${(TALENTS[run.classId] || []).find((item) => item.id === id)?.name}`) : ["No talents learned yet"]),
  ];
  ui.satchelList.innerHTML = items.map((item) => `<div class="satchel-item">${escapeHtml(item)}</div>`).join("");
  ui.routeMap.replaceChildren();
  run.map.forEach((stage, stageIndex) => {
    const stageElement = document.createElement("div");
    stageElement.className = "route-stage";
    const label = document.createElement("span");
    label.className = "route-stage-label";
    label.textContent = stageIndex === run.map.length - 1 ? "Guardian" : `Step ${stageIndex + 1}`;
    stageElement.append(label);
    stage.forEach((node) => {
      const detail = NODE_DETAILS[node.type];
      const button = document.createElement("button");
      const completed = run.completedNodes.includes(node.id);
      button.type = "button";
      button.className = `route-node ${node.type}${completed ? " completed" : ""}${stageIndex === run.stage ? " current" : ""}`;
      button.disabled = completed || stageIndex !== run.stage;
      button.dataset.nodeId = node.id;
      button.innerHTML = `<span aria-hidden="true">${completed ? "✓" : detail.icon}</span><small>${completed ? "Complete" : detail.label}</small>`;
      stageElement.append(button);
    });
    ui.routeMap.append(stageElement);
  });
  showScreen(ui.mapScreen);
}

function findNode(nodeId) {
  return run.map.flat().find((node) => node.id === nodeId);
}

function chooseNode(node) {
  run.pendingNode = node;
  saveRun();
  if (["battle", "elite", "boss"].includes(node.type)) beginCombat(node);
  else if (node.type === "camp") showCamp();
  else if (node.type === "shop") showShop();
  else showEvent(node.eventId);
}

function completeCurrentNode() {
  const node = run.pendingNode;
  if (node && !run.completedNodes.includes(node.id)) run.completedNodes.push(node.id);
  run.pendingNode = null;
  run.stage = Math.min(run.stage + 1, run.map.length);
  run.depth += 1;
}

function makeCombatCard(entry) {
  return { id: entry.id, upgraded: Boolean(entry.upgraded) };
}

function beginCombat(node) {
  const enemy = ENEMIES[node.enemyId];
  const firstDrawBonus = talentValue("openingDraw") + (hasRelic("featherstep-boots") ? 1 : 0);
  const startingGuard = talentValue("startingGuard") + (hasRelic("moonwell-charm") ? 5 : 0);
  run.combat = {
    enemyId: enemy.id,
    enemyHealth: enemy.maxHealth,
    enemyGuard: 0,
    enemyBurn: 0,
    enemyStrength: 0,
    intentIndex: 0,
    playerGuard: startingGuard,
    playerBurn: 0,
    energy: 3,
    turn: 1,
    prowl: 0,
    cardsPlayed: 0,
    firstAttackTurn: false,
    firstAttackBattle: false,
    drawPile: shuffle(run.deck.map(makeCombatCard)),
    discardPile: [],
    exhaustPile: [],
    hand: [],
    log: [`${enemy.name} blocks the road.`],
  };
  drawCards(5 + firstDrawBonus);
  saveRun();
  renderCombat();
}

function drawCards(count) {
  const combat = run.combat;
  for (let index = 0; index < count; index += 1) {
    if (!combat.drawPile.length) {
      if (!combat.discardPile.length) break;
      combat.drawPile = shuffle(combat.discardPile);
      combat.discardPile = [];
      combat.log.push("The discarded techniques return to the draw pile.");
    }
    if (combat.hand.length >= 10) break;
    combat.hand.push(combat.drawPile.pop());
  }
}

function addCombatLog(message) {
  run.combat.log.push(message);
  run.combat.log = run.combat.log.slice(-8);
}

function dealDamageToEnemy(amount) {
  const combat = run.combat;
  const absorbed = Math.min(combat.enemyGuard, amount);
  combat.enemyGuard -= absorbed;
  const damage = Math.max(0, amount - absorbed);
  combat.enemyHealth = Math.max(0, combat.enemyHealth - damage);
  return { damage, absorbed };
}

function dealDamageToPlayer(amount) {
  const combat = run.combat;
  const absorbed = Math.min(combat.playerGuard, amount);
  combat.playerGuard -= absorbed;
  const damage = Math.max(0, amount - absorbed);
  run.hp = Math.max(0, run.hp - damage);
  return { damage, absorbed };
}

function playCard(index) {
  const combat = run.combat;
  const entry = combat.hand[index];
  const card = cardDefinition(entry);
  if (!card || card.cost > combat.energy) return;
  combat.energy -= card.cost;
  combat.hand.splice(index, 1);
  combat.cardsPlayed += 1;
  combat.prowl = Math.min(PROWL_MAX, combat.prowl + 1 + (card.prowl || 0));

  const enemy = ENEMIES[combat.enemyId];
  const form = classForm();
  let damagePerHit = card.damage || 0;
  const isAttack = Boolean(card.damage);
  if (isAttack) {
    damagePerHit += elementEdge(card.element, enemy.element);
    damagePerHit += talentValue("attackBonus");
    if (hasRelic("smouldering-collar") && !combat.firstAttackBattle) damagePerHit += 2;
    const hits = card.hits || 1;
    let totalDamage = 0;
    for (let hit = 0; hit < hits; hit += 1) totalDamage += dealDamageToEnemy(damagePerHit).damage;
    addCombatLog(`${card.name} deals ${totalDamage} damage${hits > 1 ? ` across ${hits} hits` : ""}.`);
    if (form.id === "ember-knight" && !combat.firstAttackTurn) combat.enemyBurn += 1 + talentValue("burnBonus");
    combat.firstAttackTurn = true;
    combat.firstAttackBattle = true;
  }
  if (card.block) {
    const block = card.block + (card.type === "Guard" ? talentValue("guardBonus") : 0);
    combat.playerGuard += block;
    addCombatLog(`${card.name} grants ${block} Guard.`);
  }
  if (card.burn) {
    const burn = card.burn + talentValue("burnBonus");
    combat.enemyBurn += burn;
    addCombatLog(`${card.name} applies ${burn} Burn.`);
  }
  if (card.heal) {
    const healing = card.heal + talentValue("healBonus");
    run.hp = Math.min(run.maxHealth, run.hp + healing);
    addCombatLog(`${card.name} restores ${healing} Health.`);
  }
  if (card.energy) combat.energy += card.energy;
  if (card.draw) drawCards(card.draw);
  if (form.id === "gust-ranger" && combat.cardsPlayed % 3 === 0) {
    drawCards(1);
    addCombatLog("Three-Step Flow draws a card.");
  }
  (card.exhaust ? combat.exhaustPile : combat.discardPile).push(entry);
  if (combat.enemyHealth <= 0) {
    finishCombat(true);
    return;
  }
  saveRun();
  renderCombat();
}

function useUltimate() {
  const combat = run.combat;
  if (combat.prowl < PROWL_MAX) return;
  const form = classForm();
  combat.prowl = 0;
  if (form.id === "ember-knight") {
    const damage = dealDamageToEnemy(12 + elementEdge("ember", ENEMIES[combat.enemyId].element)).damage;
    combat.enemyBurn += 3 + talentValue("burnBonus");
    addCombatLog(`Furnace Pounce deals ${damage} damage and engulfs the enemy in Burn.`);
  } else if (form.id === "gust-ranger") {
    combat.energy += 2;
    combat.playerGuard += 6;
    drawCards(3);
    addCombatLog("Skybreak Sprint grants 2 Energy, 6 Guard and 3 cards.");
  } else {
    combat.playerGuard += 12 + talentValue("guardBonus");
    run.hp = Math.min(run.maxHealth, run.hp + 4 + talentValue("healBonus"));
    addCombatLog("Moonwell Aegis grants 12 Guard and restores Health.");
  }
  if (combat.enemyHealth <= 0) finishCombat(true);
  else {
    saveRun();
    renderCombat();
  }
}

function enemyTurn() {
  const combat = run.combat;
  const enemy = ENEMIES[combat.enemyId];
  combat.enemyGuard = 0;
  if (combat.enemyBurn > 0) {
    const burnDamage = dealDamageToEnemy(combat.enemyBurn).damage;
    addCombatLog(`Burn sears ${enemy.name} for ${burnDamage}.`);
    combat.enemyBurn = Math.max(0, combat.enemyBurn - 1);
    if (combat.enemyHealth <= 0) {
      finishCombat(true);
      return;
    }
  }
  const intent = enemy.intents[combat.intentIndex % enemy.intents.length];
  const intentElement = intent.element || enemy.element;
  if (intent.type.startsWith("attack")) {
    const power = intent.value + combat.enemyStrength + elementEdge(intentElement, classForm().element);
    const result = dealDamageToPlayer(power);
    addCombatLog(`${enemy.name} attacks for ${result.damage} damage${result.absorbed ? ` (${result.absorbed} blocked)` : ""}.`);
    if (intent.type === "attack-burn") combat.playerBurn += intent.burn;
  } else if (intent.type === "guard") {
    combat.enemyGuard += intent.value;
    addCombatLog(`${enemy.name} gains ${intent.value} Guard.`);
  } else if (intent.type === "strength") {
    combat.enemyStrength += intent.value;
    addCombatLog(`${enemy.name} gains ${intent.value} Strength.`);
  }
  combat.intentIndex += 1;
  if (run.hp <= 0) {
    finishCombat(false);
    return;
  }
  beginPlayerTurn();
}

function endPlayerTurn() {
  const combat = run.combat;
  combat.discardPile.push(...combat.hand);
  combat.hand = [];
  enemyTurn();
}

function beginPlayerTurn() {
  const combat = run.combat;
  combat.turn += 1;
  combat.energy = 3;
  combat.cardsPlayed = 0;
  combat.firstAttackTurn = false;
  if (classForm().id === "tide-warden") {
    combat.playerGuard = Math.min(combat.playerGuard, 3 + talentValue("retainBonus"));
  } else {
    combat.playerGuard = 0;
  }
  if (combat.playerBurn > 0) {
    const result = dealDamageToPlayer(combat.playerBurn);
    addCombatLog(`Burn deals ${result.damage} damage to ${profile.name}.`);
    combat.playerBurn = Math.max(0, combat.playerBurn - 1);
    if (run.hp <= 0) {
      finishCombat(false);
      return;
    }
  }
  drawCards(5);
  saveRun();
  renderCombat();
}

function finishCombat(victory) {
  const enemy = ENEMIES[run.combat.enemyId];
  if (!victory) {
    run.combat = null;
    endRun(false);
    return;
  }
  run.coins += enemy.coins + (hasRelic("merchant-bell") ? 10 : 0);
  run.level += 1;
  run.combat = null;
  completeCurrentNode();
  if (enemy.boss) {
    endRun(true);
    return;
  }
  const rewardQueue = [];
  if ([2, 4].includes(run.level)) rewardQueue.push("talent");
  if (enemy.elite) rewardQueue.push("relic");
  rewardQueue.push("card");
  run.pendingReward = rewardQueue;
  saveRun();
  showNextReward();
}

function renderCombat() {
  const combat = run.combat;
  if (!combat) {
    renderMap();
    return;
  }
  const enemy = ENEMIES[combat.enemyId];
  const form = classForm();
  const intent = enemy.intents[combat.intentIndex % enemy.intents.length];
  ui.combatNodeLabel.textContent = enemy.boss ? "Final guardian" : enemy.elite ? "Elite encounter" : "Road encounter";
  ui.combatTitle.textContent = enemy.name;
  ui.turnSeal.textContent = `Turn ${combat.turn}`;
  ui.enemyElementIcon.textContent = ELEMENTS[intent.element || enemy.element].icon;
  ui.enemyName.textContent = enemy.name;
  ui.enemyStatus.textContent = `Guard ${combat.enemyGuard} · Burn ${combat.enemyBurn} · Strength ${combat.enemyStrength}`;
  ui.enemyPortrait.textContent = enemy.icon;
  ui.enemyHealthFill.style.width = `${Math.max(0, combat.enemyHealth / enemy.maxHealth) * 100}%`;
  ui.enemyHealthText.textContent = `${combat.enemyHealth} / ${enemy.maxHealth} Health`;
  ui.enemyIntent.textContent = intentLabel(intent, combat.enemyStrength, enemy.element, form.element);
  ui.playerElementIcon.textContent = ELEMENTS[form.element].icon;
  ui.combatPetName.textContent = profile.name;
  ui.playerStatus.textContent = `Guard ${combat.playerGuard} · Burn ${combat.playerBurn}`;
  ui.combatPetPhoto.src = portraitUrl;
  ui.combatPetPhoto.alt = `${profile.name}, your champion`;
  ui.playerHealthFill.style.width = `${Math.max(0, run.hp / run.maxHealth) * 100}%`;
  ui.playerHealthText.textContent = `${run.hp} / ${run.maxHealth} Health`;
  ui.passiveReminder.innerHTML = `<strong>${form.passiveName}:</strong> ${form.passive}`;
  ui.combatLog.innerHTML = combat.log.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
  ui.combatLog.scrollTop = ui.combatLog.scrollHeight;
  ui.prowlGaugeFill.style.width = `${combat.prowl / PROWL_MAX * 100}%`;
  ui.ultimateName.textContent = form.ultimateName;
  ui.ultimateCharge.textContent = combat.prowl >= PROWL_MAX ? "Ready" : `${combat.prowl} / ${PROWL_MAX} Prowl`;
  ui.ultimateButton.disabled = combat.prowl < PROWL_MAX;
  ui.energyCount.textContent = combat.energy;
  ui.drawCount.textContent = combat.drawPile.length;
  ui.discardCount.textContent = combat.discardPile.length;
  renderHand();
  showScreen(ui.combatScreen);
}

function renderHand() {
  const combat = run.combat;
  ui.combatHand.replaceChildren();
  combat.hand.forEach((entry, index) => {
    const card = cardDefinition(entry);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "technique-card";
    button.dataset.cardIndex = index;
    button.dataset.element = card.element || "neutral";
    button.disabled = card.cost > combat.energy;
    const symbol = card.type === "Attack" ? "⚔" : card.type === "Guard" ? "⬟" : "✦";
    button.innerHTML = `
      <span class="technique-card-heading"><b>${escapeHtml(card.name)}</b><i class="energy-cost">${card.cost}</i></span>
      <span class="technique-art" aria-hidden="true">${symbol}</span>
      <span><p>${escapeHtml(card.description)}</p><small>${elementMarkup(card.element)} · ${card.type}</small></span>`;
    ui.combatHand.append(button);
  });
  if (!combat.hand.length) ui.combatHand.innerHTML = "<p>Your hand is empty. End the turn to draw again.</p>";
}

function setDecision({ eyebrow, title, copy, options }) {
  ui.decisionEyebrow.textContent = eyebrow;
  ui.decisionTitle.textContent = title;
  ui.decisionCopy.textContent = copy;
  ui.decisionOptions.replaceChildren();
  activeDecisionActions = new Map();
  options.forEach((option, index) => {
    const key = String(index);
    activeDecisionActions.set(key, option.action);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "decision-option";
    button.dataset.decisionKey = key;
    button.disabled = Boolean(option.disabled);
    button.innerHTML = `
      <span class="decision-option-icon" aria-hidden="true">${option.icon || "✦"}</span>
      <strong>${escapeHtml(option.title)}</strong>
      <span>${escapeHtml(option.description)}</span>
      ${option.note ? `<small>${escapeHtml(option.note)}</small>` : ""}`;
    ui.decisionOptions.append(button);
  });
  showScreen(ui.decisionScreen);
}

function showNextReward() {
  const reward = run.pendingReward?.[0];
  if (!reward) {
    run.pendingReward = null;
    saveRun();
    renderMap();
    return;
  }
  saveRun();
  if (reward === "talent") showTalentReward();
  else if (reward === "relic") showRelicReward();
  else showCardReward();
}

function advanceReward() {
  run.pendingReward?.shift();
  saveRun();
  showNextReward();
}

function showCardReward() {
  const choices = uniqueRewardChoices(run.classId);
  setDecision({
    eyebrow: "Victory reward",
    title: "Learn a new technique",
    copy: "Add one card to this run's deck, or keep the deck lean and take 12 Coins.",
    options: [
      ...choices.map((cardId) => {
        const card = CARD_LIBRARY[cardId];
        return {
          icon: card.type === "Attack" ? "⚔" : card.type === "Guard" ? "⬟" : "✦",
          title: card.name,
          description: card.description,
          note: `${card.cost} Energy · ${elementMarkup(card.element)}`,
          action: () => {
            run.deck.push({ id: card.id, upgraded: false });
            advanceReward();
          },
        };
      }),
      {
        icon: "¤", title: "Skip reward", description: "Take 12 Coins instead of adding a card.",
        action: () => { run.coins += 12; advanceReward(); },
      },
    ],
  });
}

function showTalentReward() {
  const choices = (TALENTS[run.classId] || []).filter((talent) => !run.talents.includes(talent.id)).slice(0, 3);
  setDecision({
    eyebrow: `Champion level ${run.level}`,
    title: "Choose a lasting talent",
    copy: "This talent lasts until the expedition ends.",
    options: choices.map((talent) => ({
      icon: "✦", title: talent.name, description: talent.description,
      action: () => {
        run.talents.push(talent.id);
        if (talent.maxHealth) {
          run.maxHealth += talent.maxHealth;
          run.hp += talent.maxHealth;
        }
        advanceReward();
      },
    })),
  });
}

function showRelicReward() {
  const available = Object.values(RELICS).filter((relic) => !run.relics.includes(relic.id));
  const relic = randomItem(available);
  setDecision({
    eyebrow: "Elite reward",
    title: `You found ${relic.name}`,
    copy: relic.description,
    options: [{
      icon: relic.icon, title: "Take the relic", description: "Relics remain active for the rest of this run.",
      action: () => {
        run.relics.push(relic.id);
        if (relic.id === "nine-lives-knot") { run.maxHealth += 5; run.hp += 5; }
        advanceReward();
      },
    }],
  });
}

function finishRoadChoice() {
  completeCurrentNode();
  saveRun();
  renderMap();
}

function showCamp() {
  const heal = Math.max(1, Math.ceil(run.maxHealth * .3));
  const upgradeable = run.deck.map((entry, index) => ({ entry, index })).filter(({ entry }) => !entry.upgraded);
  setDecision({
    eyebrow: "Campfire",
    title: "Rest beneath the old watchtower",
    copy: "There is time for one preparation before moving on.",
    options: [
      {
        icon: "♥", title: "Rest", description: `Restore up to ${heal} Health.`,
        action: () => { run.hp = Math.min(run.maxHealth, run.hp + heal); finishRoadChoice(); },
      },
      {
        icon: "⌁", title: "Train", description: "Choose one card to upgrade permanently for this run.",
        disabled: !upgradeable.length,
        action: showUpgradeChoice,
      },
    ],
  });
}

function showUpgradeChoice() {
  const choices = run.deck.map((entry, index) => ({ entry, index })).filter(({ entry }) => !entry.upgraded).slice(0, 9);
  setDecision({
    eyebrow: "Campfire training",
    title: "Choose a technique to improve",
    copy: "The upgraded version remains in your deck for this expedition.",
    options: choices.map(({ entry, index }) => {
      const card = cardDefinition(entry);
      return {
        icon: "⌁", title: card.name, description: card.description,
        action: () => { run.deck[index].upgraded = true; finishRoadChoice(); },
      };
    }),
  });
}

function showShop() {
  const offers = uniqueRewardChoices(run.classId);
  setDecision({
    eyebrow: "Travelling merchant",
    title: "The Bellkeeper's wagon",
    copy: `You have ${run.coins} Coins. Buy as much as you can afford, then leave.`,
    options: [
      ...offers.map((cardId) => ({
        icon: "▣", title: CARD_LIBRARY[cardId].name, description: CARD_LIBRARY[cardId].description, note: "30 Coins",
        disabled: run.coins < 30,
        action: () => { run.coins -= 30; run.deck.push({ id: cardId, upgraded: false }); saveRun(); showShop(); },
      })),
      {
        icon: "♥", title: "Warm broth", description: "Restore 12 Health.", note: "25 Coins",
        disabled: run.coins < 25 || run.hp >= run.maxHealth,
        action: () => { run.coins -= 25; run.hp = Math.min(run.maxHealth, run.hp + 12); saveRun(); showShop(); },
      },
      { icon: "➜", title: "Leave the wagon", description: "Continue along the road.", action: finishRoadChoice },
    ],
  });
}

function showEvent(eventId) {
  if (eventId === "moon-shrine") {
    setDecision({
      eyebrow: "Road event",
      title: "The Moonlit Shrine",
      copy: "A weathered cat statue holds a bowl of silver rainwater. The old magic is faint, but kind.",
      options: [
        {
          icon: "☾", title: "Drink from the bowl", description: "Gain 5 maximum Health and restore 5 Health.",
          action: () => { run.maxHealth += 5; run.hp += 5; finishRoadChoice(); },
        },
        {
          icon: "¤", title: "Search the offerings", description: "Take 35 Coins left by forgotten travellers.",
          action: () => { run.coins += 35; finishRoadChoice(); },
        },
      ],
    });
    return;
  }
  setDecision({
    eyebrow: "Road event",
    title: "The Old Rope Bridge",
    copy: "A relic glints beneath a broken plank. Reaching it means crossing where the bridge is weakest.",
    options: [
      {
        icon: "◈", title: "Risk the crossing", description: "Lose 7 Health and find a random relic.",
        disabled: run.hp <= 7,
        action: () => {
          run.hp -= 7;
          const available = Object.values(RELICS).filter((relic) => !run.relics.includes(relic.id));
          const relic = randomItem(available);
          if (relic) {
            run.relics.push(relic.id);
            if (relic.id === "nine-lives-knot") { run.maxHealth += 5; run.hp += 5; }
          }
          finishRoadChoice();
        },
      },
      {
        icon: "♥", title: "Take the river path", description: "Avoid the bridge and restore 6 Health beside the water.",
        action: () => { run.hp = Math.min(run.maxHealth, run.hp + 6); finishRoadChoice(); },
      },
    ],
  });
}

function endRun(completed) {
  const depth = run.depth;
  const reward = bondReward(depth, completed);
  profile.bondXp += reward;
  if (completed) profile.wins += 1;
  saveProfile();
  const finalRun = run;
  run = null;
  saveRun();
  ui.endingEyebrow.textContent = completed ? "Expedition complete" : "The road claims another attempt";
  ui.endingTitle.textContent = completed ? "The Broken Cycle yields" : `${profile.name} returns to camp`;
  ui.endingCopy.textContent = completed
    ? "Your champion defeated the final guardian. The next road will rearrange its dangers, but your Bond remains."
    : "The run is over, but nothing permanent was lost. A new route and new rewards await.";
  ui.endingTally.innerHTML = `
    <span class="vital-chip">Steps cleared <b>${depth}</b></span>
    <span class="vital-chip">Bond XP earned <b>+${reward}</b></span>
    <span class="vital-chip">Cards collected <b>${Math.max(0, finalRun.deck.length - 10)}</b></span>
    <span class="vital-chip">Relics found <b>${finalRun.relics.length}</b></span>`;
  showScreen(ui.endingScreen);
}

function abandonRun() {
  if (!run) return;
  endRun(false);
}

function bindEvents() {
  ui.petPhotoInput.addEventListener("change", handlePhotoSelection);
  [ui.cropX, ui.cropY, ui.cropZoom].forEach((input) => input.addEventListener("input", updateCropPreview));
  ui.petNameInput.addEventListener("input", updateCreatorPreview);
  ui.classChoices.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-class-id]");
    if (!choice) return;
    selectedClassId = choice.dataset.classId;
    updateCreatorPreview();
  });
  ui.saveChampionButton.addEventListener("click", saveChampion);
  ui.startRunButton.addEventListener("click", startOrResumeRun);
  ui.editChampionButton.addEventListener("click", renderCreator);
  ui.routeMap.addEventListener("click", (event) => {
    const button = event.target.closest("[data-node-id]");
    if (button && !button.disabled) chooseNode(findNode(button.dataset.nodeId));
  });
  ui.combatHand.addEventListener("click", (event) => {
    const card = event.target.closest("[data-card-index]");
    if (card && !card.disabled) playCard(Number(card.dataset.cardIndex));
  });
  ui.endTurnButton.addEventListener("click", endPlayerTurn);
  ui.ultimateButton.addEventListener("click", useUltimate);
  ui.decisionOptions.addEventListener("click", (event) => {
    const option = event.target.closest("[data-decision-key]");
    if (!option || option.disabled) return;
    activeDecisionActions.get(option.dataset.decisionKey)?.();
  });
  ui.abandonRunButton.addEventListener("click", abandonRun);
  ui.returnHubButton.addEventListener("click", renderHub);
  ui.expeditionHelpButton.addEventListener("click", () => ui.expeditionHelpDialog.showModal());
  ui.closeExpeditionHelp.addEventListener("click", () => ui.expeditionHelpDialog.close());
}

async function initialise() {
  bindEvents();
  try {
    await loadPortrait();
  } catch (error) {
    console.warn("Portrait storage is unavailable in this browser.", error);
  }
  if (!profile || !portraitUrl) {
    if (!portraitUrl) profile = null;
    renderCreator();
    return;
  }
  if (run?.classId !== profile.classId) {
    run = null;
    saveRun();
  }
  renderHub();
}

initialise();
