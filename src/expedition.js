import {
  CARD_LIBRARY,
  CLASS_FORMS,
  DEFAULT_PERSONALITY_ID,
  ELEMENTS,
  ENEMIES,
  PET_PERSONALITIES,
  RELICS,
  TALENTS,
  bondRank,
  bondReward,
  cardDefinition,
  createRun,
  commandBonuses,
  effectiveCommandCost,
  elementEdge,
  evaluateCommandPlan,
  intentLabel,
  personalityDefinition,
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
let selectedPersonalityId = profile?.personalityId || DEFAULT_PERSONALITY_ID;
let activeDecisionActions = new Map();
let saveTimer = null;
let resolvingCommands = false;

const NODE_DETAILS = {
  battle: { icon: "⚔", label: "Battle" },
  elite: { icon: "♜", label: "Elite battle" },
  boss: { icon: "♛", label: "Final guardian" },
  event: { icon: "?", label: "Road event" },
  camp: { icon: "♨", label: "Campfire" },
  shop: { icon: "¤", label: "Travelling shop" },
};

const CLASS_CREST_PATHS = Object.freeze({
  "knight-helm": `
    <path class="crest-source crest-helm" transform="translate(56 58) scale(.78)" d="M258.094 18.5c-74.34 0-138.073 62.498-156.188 148.438 52.758-7.697 102.23-22.044 153.938-45.094l4.125-1.813 3.967 2.064c49.424 25.667 97.648 41.026 150.657 46.406-17.66-86.744-81.71-150-156.5-150zm1.28 122.156c-57.41 25.148-112.883 39.993-172.53 47 6.724 32.847 6.91 65.935-.5 98.938 89.29 41.602 231.648 43.154 340.594-.125-10.762-32.516-11.727-65.66-1.188-98.408-59.03-4.235-112.628-20.06-166.375-47.406zm-13.5 33.125h18.72v127.75h-18.72V173.78zm-58.78 11.19h18.687v101.655h-18.686V184.97zm115.72 0H321.5v101.655h-18.688V184.97zm-171.72 14.905h18.687v79.28h-18.686zm227.72 0H377.5v79.28h-18.688v-79.28zm38.748 116.75c-14.302 4.282-28.96 7.873-43.78 10.844l-19.22 64.06c26.114-17.337 48.002-43.31 63-74.905zm-277.53 2.875c13.95 28.257 33.448 51.85 56.562 68.53l-17.688-58.905c-13.397-2.61-26.387-5.826-38.875-9.625zm213.156 11.656c-51.63 8.175-104.745 8.588-153.72 1.438l20.845 69.5c18 8.52 37.49 13.187 57.78 13.187 18.588 0 36.507-3.92 53.22-11.124zm-195.5 47.156c-19.436 21.562-36.416 44.367-48.594 72.157 70.233-8.736 133.743 14.684 168.03 50.75 39.684-35.607 103.71-55.685 170.876-44.25-15.08-29.372-33.32-51.982-53.938-74-31.187 31.75-71.53 51-115.968 51-46.568 0-88.65-21.142-120.406-55.658z"/>
    <path class="crest-element-mark crest-flame" transform="translate(207 30) scale(.19)" d="M245.05 15.514c34.29 48.815-23.535 320.54-90.302 136.72C106.796 325.11 38.956 332.518 38.876 252.55c-71.6 79.31 43.824 220.767 87.376 243.935h52.127c-45.92-40.016-76.784-78-82.176-135.968 47.312 9.423 71.855 20.96 81.263-62.048 60.736 86.59 100.944-49.376 137.184-107.12-1.647 40.32-3.343 93.456 22.848 129.888 8.736 12.143 33.232 16.11 54.736 15.807-9.92 16.08-44.848 69.376-17.008 89.2s33.072-.384 25.856 16.176c-13.264 20.88-22.992 39.375-59.072 54.063h56.064c59.44-18.72 111.807-91.663 94.607-135.535-22.015 18.657-43.774 30.897-61.294 29.537 49.12-72.08 37.84-145.903 14.752-221.342-20.224 72.383-33.488 82.495-54.576 99.52 29.104-68.657-85.44-214.448-146.51-253.15z"/>`,
  "recurve-bow": `
    <path class="crest-source crest-bow" transform="translate(70 65) scale(.73)" d="m89.594 18.094-10.75 10.75.03.03 27.532 333.563-83.03 92.938 33.25 33.25 90.155-80.563 336.19 24.907.186.186.156-.156h.032v-.03l10.562-10.564c-1.676-1.676-3.122-3.437-4.687-5.156-21.332-25.55-25.416-63.24-35.47-109.125-8.323-37.99-21.225-81.042-53.094-125.03l-38.062 50.81c.005.008-.005.026 0 .032 28.988 36.074 46.027 67.766 59.72 96.25 15.017 31.247 26.122 59 44.467 83.688L165.314 391.5 337.53 237.594l64.376-85.97-41.53-41.53-85.907 64.312L122.81 344.094 98.156 45.25c24.68 18.33 52.425 29.426 83.656 44.438 28.49 13.693 60.2 30.72 96.282 59.718l50.812-38.062c-43.99-31.86-87.04-44.736-125.03-53.063C157.987 48.224 120.3 44.113 94.75 22.78c-1.72-1.564-3.48-3.01-5.156-4.686m317.03.312c-3.385.028-6.862.406-10.28.97-4.558.75-8.992 1.837-12.813 3.093-3.82 1.254-6.776 2.302-9.717 4.624a7.18 7.18 0 0 0-2.72 6.187l5.032 62.345a7.18 7.18 0 0 0 2.063 4.53l33.656 33.626a7.18 7.18 0 0 0 4.5 2.095l62.344 5.03a7.18 7.18 0 0 0 6.218-2.718c2.335-2.944 3.367-5.895 4.625-9.718 1.26-3.824 2.343-8.255 3.095-12.814.752-4.56 1.18-9.198.875-13.625-.305-4.425-1.012-8.99-4.844-12.81L422.78 23.343c-3.822-3.824-8.384-4.54-12.81-4.844a44 44 0 0 0-3.345-.094zm.126 14.375a30 30 0 0 1 2.25.064c2.404.165 3.74.915 3.72.78l65.655 65.657c-.138-.023.616 1.318.78 3.72.19 2.746-.062 6.526-.686 10.313-.626 3.786-1.595 7.62-2.595 10.656-.412 1.25-.524 1.272-.938 2.186l-54.78-4.375-29.938-29.936-4.376-54.813c.913-.41.94-.495 2.187-.905 3.037-.998 6.872-1.97 10.658-2.594 2.84-.466 5.662-.728 8.062-.75zm-47.97 120.44-18.936 31.593-204.5 204.468-8.844-.655-1.188-14.563 201.875-201.906 31.594-18.937z"/>
    <path class="crest-element-mark crest-leaf" transform="translate(370 112) rotate(42) scale(.14) translate(-256 -256)" d="M92.239 26.432c-4.705.09-9.496.87-14.37 2.473-19.773 6.506-41.557 59.364-7.411 112.912 9.221 14.46-41 39.289-31.803 67.056 12.387 37.399 99.437 19.933 112.104 42.211 6.44 11.328-79.773 49.284-49.663 81.625 37.951 40.763 76.062 14.109 138.553 23.864 24.685 3.853-26.357 63.343 11.031 86.498 39.948 24.739 118.742 1.986 160.846-20.254a20577 20577 0 0 0-30.19-36.098c-33.45 10.371-71.807 15.824-106.036 13.664 36.092-6.615 65.118-14.246 94.8-27.025-21.566-25.637-43.299-51.22-65.357-76.479-36.846 7.379-103.783 18.406-166.793 13.88 8.83-1.316 110.772-14.937 154.935-27.38a3178 3178 0 0 0-24.357-27.318 6823 6823 0 0 0-27.935-35.486 6486 6486 0 0 0-15.413-19.34l-.115.658c-31.187 1.8-90.154 3.052-142.9-10.709 7.477.02 92.983 1.716 132.031-3.637-16.65-20.699-32.746-40.434-46.473-56.795-7.035-8.385-13.392-15.81-19.011-22.209l.05-.056c25.401 23.275 50.132 47.542 74.329 72.506 15.57-24.254 32.931-56.653 41.664-80.655 1.469 29.363-15.963 66.66-27.586 95.325 22.456 23.61 44.458 47.79 66.125 72.287 20.118-23.976 44.105-60.316 54.869-83.707-3.957 26.047-31.834 67.188-44.936 94.982 25.142 28.669 49.84 57.727 74.266 86.8 13.506-17.48 28.29-40.286 35.822-57.296 1.32 21.671-14.607 49.312-24.892 70.281l-.05-.014c9.624 11.49 19.211 22.974 28.766 34.428 3.016-2.12 5.604-4.173 7.582-6.095 31.459-30.573 36.26-79.699 17.842-116.51-12.519-25.021-70.096-8.654-77.265-23.846-9.068-19.214 51.563-76.204 28.146-104.902-16.456-20.168-75.04 1.983-85.264-16.182-16.343-29.04 28.13-74.832-21.763-99.244-26.468-12.95-46.397 5.349-88.338 44.103-21.236 19.623-62.13-63.165-113.828-64.312a49 49 0 0 0-2.012-.004m345.39 402.365-13.982 11.336 36.848 45.444 13.98-11.336-36.845-45.444z"/>`,
  "shell-shield": `
    <path class="crest-source crest-shield" transform="translate(88 55) scale(.66 .78)" d="M256 16c25 24 100 72 150 72v96c0 96-75 240-150 312-75-72-150-216-150-312V88c50 0 125-48 150-72Z"/>
    <path class="crest-element-mark crest-drop" transform="translate(188 162) scale(.27)" d="M406.043 316c24.11 96.443-50.59 180-150 180s-174.405-82.38-150-180c15-60 90-150 150-300 60 150 135 240 150 300Z"/>
    <path class="crest-waterline" d="M185 356c35-22 70-22 105 0s70 22 105 0M201 393c27-17 55-17 82 0s55 17 82 0"/>`,
});

function classCrestMarkup(form, extraClass = "") {
  return `
    <svg class="class-crest-svg ${extraClass}" data-element="${form.element}" viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      <circle class="crest-shadow" cx="256" cy="264" r="226"/>
      <circle class="crest-field" cx="256" cy="248" r="226"/>
      <circle class="crest-inner-ring" cx="256" cy="248" r="204"/>
      ${CLASS_CREST_PATHS[form.crest]}
    </svg>`;
}

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

function petPersonality() {
  return personalityDefinition(profile?.personalityId || selectedPersonalityId);
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
    <div class="champion-card-crown">${classCrestMarkup(form)}</div>
    <div class="champion-portrait">
      ${portraitUrl ? `<img src="${portraitUrl}" alt="${escapeHtml(profile.name)}">` : '<span class="champion-silhouette" aria-hidden="true">♞</span>'}
      <span class="champion-personality-ribbon">${petPersonality().icon} ${petPersonality().name}</span>
    </div>
    <div class="champion-nameplate">
      <strong>${escapeHtml(profile.name)}</strong>
      <span>${form.name} · ${petPersonality().name}</span>
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
      <span class="class-choice-crest">${classCrestMarkup(form)}</span>
      <strong>${form.name}</strong>
      <small>${form.summary}</small>
      <small><b>${form.passiveName}:</b> ${form.passive}</small>`;
    ui.classChoices.append(button);
  });
}

function renderPersonalityChoices() {
  ui.personalityChoices.replaceChildren();
  Object.values(PET_PERSONALITIES).forEach((personality) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "personality-choice";
    button.dataset.personalityId = personality.id;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(personality.id === selectedPersonalityId));
    button.innerHTML = `
      <span class="personality-icon" aria-hidden="true">${personality.icon}</span>
      <span><strong>${personality.name}</strong><small>${personality.title}</small></span>
      <p>${personality.description}</p>`;
    ui.personalityChoices.append(button);
  });
}

function updateCreatorPreview() {
  const form = CLASS_FORMS[selectedClassId];
  const name = ui.petNameInput.value.trim() || "Your Pet";
  ui.creatorChampionCard.dataset.element = form.element;
  ui.creatorClassIcon.innerHTML = classCrestMarkup(form);
  ui.creatorCardName.textContent = name;
  ui.creatorCardClass.textContent = `${form.name} · ${personalityDefinition(selectedPersonalityId).name}`;
  ui.creatorPersonalityRibbon.textContent = `${personalityDefinition(selectedPersonalityId).icon} ${personalityDefinition(selectedPersonalityId).name}`;
  ui.creatorCardHealth.textContent = form.maxHealth;
  ui.creatorCardElement.textContent = elementMarkup(form.element);
  document.querySelectorAll(".class-choice").forEach((button) => {
    button.setAttribute("aria-checked", String(button.dataset.classId === selectedClassId));
  });
  document.querySelectorAll(".personality-choice").forEach((button) => {
    button.setAttribute("aria-checked", String(button.dataset.personalityId === selectedPersonalityId));
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
    const identityChanged = (existing.classId && existing.classId !== selectedClassId)
      || (existing.personalityId && existing.personalityId !== selectedPersonalityId);
    profile = {
      version: 2,
      name,
      classId: selectedClassId,
      personalityId: selectedPersonalityId,
      bondXp: existing.bondXp || 0,
      runs: existing.runs || 0,
      wins: existing.wins || 0,
    };
    if (identityChanged && run) {
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
  selectedPersonalityId = profile?.personalityId || selectedPersonalityId || DEFAULT_PERSONALITY_ID;
  ui.petNameInput.value = profile?.name || "";
  ui.saveChampionButton.textContent = profile ? "Save champion" : "Create champion";
  renderClassChoices();
  renderPersonalityChoices();
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
    <div class="hub-stat"><b>${petPersonality().icon} ${petPersonality().name}</b><span>Personality</span></div>
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
    commandQueue: [],
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

function currentPlan() {
  run.combat.commandQueue ||= [];
  return run.combat.commandQueue;
}

function evaluateCurrentPlan(entries = currentPlan()) {
  const combat = run.combat;
  const enemy = ENEMIES[combat.enemyId];
  return evaluateCommandPlan(entries, {
    classId: classForm().id,
    personalityId: petPersonality().id,
    baseEnergy: combat.energy,
    enemyElement: enemy.element,
    attackBonus: talentValue("attackBonus"),
    firstAttackBonus: hasRelic("smouldering-collar") && !combat.firstAttackBattle ? 2 : 0,
    guardBonus: talentValue("guardBonus"),
    healBonus: talentValue("healBonus"),
    burnBonus: talentValue("burnBonus"),
  });
}

function queueCard(index) {
  if (resolvingCommands || currentPlan().length >= 3) return;
  const combat = run.combat;
  const entry = combat.hand[index];
  if (!entry) return;
  const proposedPlan = [...currentPlan(), entry];
  if (!evaluateCurrentPlan(proposedPlan).valid) return;
  currentPlan().push(combat.hand.splice(index, 1)[0]);
  saveRun();
  renderCombat();
}

function removeQueuedCommand(index) {
  if (resolvingCommands) return;
  const returnedEntries = currentPlan().splice(index);
  run.combat.hand.push(...returnedEntries);
  saveRun();
  renderCombat();
}

function clearCommandPlan() {
  if (resolvingCommands || !currentPlan().length) return;
  run.combat.hand.push(...currentPlan());
  run.combat.commandQueue = [];
  saveRun();
  renderCombat();
}

function resolveCommand(entry, index, plannedEntries) {
  const combat = run.combat;
  const card = cardDefinition(entry);
  const bonus = commandBonuses(plannedEntries, index, {
    classId: classForm().id,
    personalityId: petPersonality().id,
  });
  combat.cardsPlayed += 1;
  combat.prowl = Math.min(PROWL_MAX, combat.prowl + 1 + (card.prowl || 0) + bonus.prowl);

  const enemy = ENEMIES[combat.enemyId];
  const form = classForm();
  let damagePerHit = card.damage || 0;
  const isAttack = Boolean(card.damage);
  if (isAttack) {
    damagePerHit += elementEdge(card.element, enemy.element);
    damagePerHit += talentValue("attackBonus");
    if (hasRelic("smouldering-collar") && !combat.firstAttackBattle) damagePerHit += 2;
    const hits = card.hits || 1;
    const totalDamage = dealDamageToEnemy(damagePerHit * hits + bonus.damage).damage;
    addCombatLog(`${profile.name} uses ${card.name} for ${totalDamage} damage${hits > 1 ? ` across ${hits} hits` : ""}.`);
    if (form.id === "ember-knight" && !combat.firstAttackTurn) combat.enemyBurn += 1 + talentValue("burnBonus");
    combat.firstAttackTurn = true;
    combat.firstAttackBattle = true;
  }
  if (card.block) {
    const block = card.block + (card.type === "Guard" ? talentValue("guardBonus") : 0) + bonus.block;
    combat.playerGuard += block;
    addCombatLog(`${profile.name}'s ${card.name} grants ${block} Guard.`);
  } else if (bonus.block) {
    combat.playerGuard += bonus.block;
    addCombatLog(`${profile.name}'s plan grants ${bonus.block} Guard.`);
  }
  if (card.burn || bonus.burn) {
    const burn = (card.burn || 0) + bonus.burn + talentValue("burnBonus");
    combat.enemyBurn += burn;
    addCombatLog(`${profile.name} applies ${burn} Burn.`);
  }
  if (card.heal || bonus.heal) {
    const healing = (card.heal || 0) + bonus.heal + (card.heal ? talentValue("healBonus") : 0);
    run.hp = Math.min(run.maxHealth, run.hp + healing);
    addCombatLog(`${profile.name} restores ${healing} Health.`);
  }
  if (card.draw || bonus.draw) drawCards((card.draw || 0) + bonus.draw);
  if (bonus.labels.length) addCombatLog(`${profile.name}'s chain: ${bonus.labels.join(" · ")}.`);
  if (form.id === "gust-ranger" && combat.cardsPlayed % 3 === 0) {
    drawCards(1);
    addCombatLog(`${profile.name}'s Three-Step Flow draws a card.`);
  }
  (card.exhaust ? combat.exhaustPile : combat.discardPile).push(entry);
  return { card, damaged: isAttack, guarded: Boolean(card.block || bonus.block) };
}

function commandAnimation(result) {
  ui.playerCombatant.dataset.action = result.damaged ? "attack" : result.guarded ? "guard" : "technique";
  if (result.damaged) ui.enemyCombatant.dataset.reaction = "hit";
  return new Promise((resolve) => setTimeout(() => {
    delete ui.playerCombatant.dataset.action;
    delete ui.enemyCombatant.dataset.reaction;
    resolve();
  }, 340));
}

async function resolveCommandPlan() {
  if (resolvingCommands) return;
  const combat = run.combat;
  const plannedEntries = [...currentPlan()];
  resolvingCommands = true;
  combat.commandQueue = [];
  if (!plannedEntries.length) addCombatLog(`${profile.name} waits and watches.`);

  for (let index = 0; index < plannedEntries.length; index += 1) {
    const entry = plannedEntries[index];
    const card = cardDefinition(entry);
    combat.energy = Math.max(0, combat.energy - effectiveCommandCost(card, index, petPersonality().id)) + (card.energy || 0);
    const result = resolveCommand(entry, index, plannedEntries);
    renderCombat();
    await commandAnimation(result);
    if (combat.enemyHealth <= 0) {
      resolvingCommands = false;
      finishCombat(true);
      return;
    }
  }

  combat.discardPile.push(...combat.hand);
  combat.hand = [];
  resolvingCommands = false;
  enemyTurn();
}

function useUltimate() {
  const combat = run.combat;
  if (combat.prowl < PROWL_MAX || resolvingCommands) return;
  const form = classForm();
  combat.prowl = 0;
  if (form.id === "ember-knight") {
    const damage = dealDamageToEnemy(12 + elementEdge("ember", ENEMIES[combat.enemyId].element)).damage;
    combat.enemyBurn += 3 + talentValue("burnBonus");
    addCombatLog(`${profile.name}'s Furnace Pounce deals ${damage} damage and engulfs the enemy in Burn.`);
  } else if (form.id === "gust-ranger") {
    combat.energy += 2;
    combat.playerGuard += 6;
    drawCards(3);
    addCombatLog(`${profile.name}'s Skybreak Sprint grants 2 Energy, 6 Guard and 3 cards.`);
  } else {
    combat.playerGuard += 12 + talentValue("guardBonus");
    run.hp = Math.min(run.maxHealth, run.hp + 4 + talentValue("healBonus"));
    addCombatLog(`${profile.name}'s Moonwell Aegis grants 12 Guard and restores Health.`);
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

function beginPlayerTurn() {
  const combat = run.combat;
  combat.turn += 1;
  combat.energy = 3;
  combat.commandQueue = [];
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
  combat.commandQueue ||= [];
  const enemy = ENEMIES[combat.enemyId];
  const form = classForm();
  const personality = petPersonality();
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
  ui.enemyPattern.textContent = `Pattern ${combat.intentIndex % enemy.intents.length + 1} of ${enemy.intents.length}`;
  ui.enemyIntent.textContent = intentLabel(intent, combat.enemyStrength, enemy.element, form.element);
  ui.playerElementIcon.textContent = ELEMENTS[form.element].icon;
  ui.combatPetName.textContent = profile.name;
  ui.combatPersonality.textContent = `${personality.icon} ${personality.title}`;
  ui.playerStatus.textContent = `Guard ${combat.playerGuard} · Burn ${combat.playerBurn}`;
  ui.combatPetPhoto.src = portraitUrl;
  ui.combatPetPhoto.alt = `${profile.name}, your champion`;
  ui.playerHealthFill.style.width = `${Math.max(0, run.hp / run.maxHealth) * 100}%`;
  ui.playerHealthText.textContent = `${run.hp} / ${run.maxHealth} Health`;
  ui.passiveReminder.innerHTML = `
    <strong>${personality.icon} ${personality.name}:</strong> ${personality.description}<br>
    <strong>${form.passiveName}:</strong> ${form.passive}`;
  ui.combatLog.innerHTML = combat.log.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
  ui.combatLog.scrollTop = ui.combatLog.scrollHeight;
  ui.prowlGaugeFill.style.width = `${combat.prowl / PROWL_MAX * 100}%`;
  ui.ultimateName.textContent = `${profile.name}'s ${form.ultimateName}`;
  ui.ultimateCharge.textContent = combat.prowl >= PROWL_MAX ? "Ready" : `${combat.prowl} / ${PROWL_MAX} Prowl`;
  ui.ultimateButton.disabled = combat.prowl < PROWL_MAX || resolvingCommands;
  ui.energyCount.textContent = evaluateCurrentPlan().remainingEnergy;
  ui.drawCount.textContent = combat.drawPile.length;
  ui.discardCount.textContent = combat.discardPile.length;
  renderCommandPlan();
  renderHand();
  showScreen(ui.combatScreen);
}

function renderCommandPlan() {
  const plan = currentPlan();
  const evaluation = evaluateCurrentPlan();
  ui.commandQueue.replaceChildren();
  for (let index = 0; index < 3; index += 1) {
    const entry = plan[index];
    if (!entry) {
      const slot = document.createElement("div");
      slot.className = "command-slot empty";
      slot.innerHTML = `<b>${index + 1}</b><span>${index === 0 ? "Opener" : index === 1 ? "Follow-up" : "Finish"}</span>`;
      ui.commandQueue.append(slot);
      continue;
    }
    const step = evaluation.steps[index];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "command-slot filled";
    button.dataset.queueIndex = index;
    button.dataset.element = step.card.element || "neutral";
    button.disabled = resolvingCommands;
    const bonusText = step.bonus.labels.length ? step.bonus.labels.join(" · ") : "No chain bonus yet";
    button.innerHTML = `
      <b>${index + 1}</b>
      <span><strong>${escapeHtml(step.card.name)}</strong><small>${escapeHtml(bonusText)}</small></span>
      <i>${step.cost}⚡</i>`;
    button.setAttribute("aria-label", `Remove ${step.card.name} from position ${index + 1}`);
    ui.commandQueue.append(button);
  }

  if (!plan.length) {
    ui.planForecast.textContent = `${profile.name} is waiting for a plan. Passing will discard the hand.`;
  } else {
    const parts = [];
    if (evaluation.totals.damage) parts.push(`${evaluation.totals.damage} damage`);
    if (evaluation.totals.block) parts.push(`${evaluation.totals.block} Guard`);
    if (evaluation.totals.burn) parts.push(`${evaluation.totals.burn} Burn`);
    if (evaluation.totals.heal) parts.push(`${evaluation.totals.heal} healing`);
    if (evaluation.totals.draw) parts.push(`draw ${evaluation.totals.draw}`);
    parts.push(`${evaluation.totals.prowl} Prowl`);
    ui.planForecast.textContent = `Forecast before enemy Guard: ${parts.join(" · ")}.`;
  }
  ui.clearPlanButton.disabled = !plan.length || resolvingCommands;
  ui.endTurnButton.disabled = resolvingCommands || !evaluation.valid;
  ui.endTurnButton.textContent = plan.length ? `Unleash ${plan.length}-command plan` : "Pass turn";
}

function renderHand() {
  const combat = run.combat;
  const planIndex = currentPlan().length;
  ui.combatHand.replaceChildren();
  combat.hand.forEach((entry, index) => {
    const card = cardDefinition(entry);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "technique-card";
    button.dataset.cardIndex = index;
    button.dataset.element = card.element || "neutral";
    const proposedPlan = [...currentPlan(), entry];
    button.disabled = resolvingCommands || planIndex >= 3 || !evaluateCurrentPlan(proposedPlan).valid;
    const symbol = card.type === "Attack" ? "⚔" : card.type === "Guard" ? "⬟" : "✦";
    const plannedCost = effectiveCommandCost(card, planIndex, petPersonality().id);
    button.innerHTML = `
      <span class="technique-card-heading"><b>${escapeHtml(card.name)}</b><i class="energy-cost">${plannedCost}</i></span>
      <span class="technique-art" aria-hidden="true">${symbol}</span>
      <span><p>${escapeHtml(card.description)}</p><small>${elementMarkup(card.element)} · ${card.type} · Position ${Math.min(3, planIndex + 1)}</small></span>`;
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
  ui.personalityChoices.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-personality-id]");
    if (!choice) return;
    selectedPersonalityId = choice.dataset.personalityId;
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
    if (card && !card.disabled) queueCard(Number(card.dataset.cardIndex));
  });
  ui.commandQueue.addEventListener("click", (event) => {
    const command = event.target.closest("[data-queue-index]");
    if (command && !command.disabled) removeQueuedCommand(Number(command.dataset.queueIndex));
  });
  ui.clearPlanButton.addEventListener("click", clearCommandPlan);
  ui.endTurnButton.addEventListener("click", resolveCommandPlan);
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
  if (!profile.personalityId) {
    profile.personalityId = DEFAULT_PERSONALITY_ID;
    profile.version = 2;
    saveProfile();
  }
  if (run && !run.personalityId) {
    run.personalityId = profile.personalityId;
    saveRun();
  }
  if (run?.classId !== profile.classId || (run && run.personalityId !== profile.personalityId)) {
    run = null;
    saveRun();
  }
  renderHub();
}

initialise();
