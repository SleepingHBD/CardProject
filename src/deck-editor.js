(function exposeDeckEditor(global) {
  "use strict";
  const api = global.ClawDeckbuilding;
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

  function createController({ catalog, store, cardMarkup, artworkSource, onOpen, onClose, root = document }) {
    const ids = ["fourLaneDeckSelect", "fourLaneDeckSummary", "fourLaneDeckStorageNotice", "fourLaneDeckEditorButton",
      "deckEditorScreen", "deckEditorTitle", "deckEditorReturnButton", "deckEditorName", "deckEditorLoad", "deckEditorNewButton",
      "deckEditorSaveButton", "deckEditorSaveCopyButton", "deckEditorDeleteButton", "deckEditorStats", "deckEditorErrors",
      "deckEditorStatus", "deckEditorSearch", "deckEditorElement", "deckEditorRole", "deckEditorRarity", "deckEditorResetFilters",
      "deckEditorCollection", "deckEditorResults", "deckEditorSelected", "deckEditorSelectedCount", "deckEditorSelectedDetails",
      "deckEditorConfirm", "deckEditorConfirmTitle", "deckEditorConfirmText", "deckEditorConfirmCancel", "deckEditorConfirmProceed"];
    const ui = Object.fromEntries(ids.map(id => [id, root.querySelector(`#${id}`)]));
    if (Object.values(ui).some(element => !element)) throw new Error("The deck editor interface is incomplete.");
    const starters = api.createStarterPresets(catalog);
    const roles = global.ClawFourLaneRules.TACTICS;
    const elements = global.ClawRules.ELEMENTS;
    const sort = (a, b) => api.ELEMENTS.indexOf(a.element) - api.ELEMENTS.indexOf(b.element)
      || Object.keys(api.COPY_LIMITS).indexOf(a.rarity) - Object.keys(api.COPY_LIMITS).indexOf(b.rarity)
      || a.power - b.power || a.name.localeCompare(b.name);
    const cards = [...catalog.cards].sort(sort);
    let draft = null, editingId = null, loadedId = "", baseline = "", confirmAction = null, confirmFocus = null;
    const serialized = () => JSON.stringify(draft);
    const dirty = () => draft && serialized() !== baseline;
    const currentReport = () => api.validateDeck(catalog, draft);
    const say = text => { ui.deckEditorStatus.textContent = text; };
    const option = (id, name) => { const element = root.createElement("option"); element.value = id; element.textContent = name; return element; };
    function populate(select, selected) {
      const presets = root.createElement("optgroup"); presets.label = "Starter decks";
      starters.forEach(preset => presets.append(option(`starter:${preset.id}`, preset.name)));
      const saved = root.createElement("optgroup"); saved.label = "Your saved decks";
      store.snapshot().decks.forEach(deck => saved.append(option(deck.id, deck.name)));
      select.replaceChildren(presets, ...(saved.children.length ? [saved] : []));
      select.value = selected;
      if (select === ui.deckEditorLoad && !selected) {
        const placeholder = option("", "Unsaved deck"); placeholder.disabled = true;
        select.prepend(placeholder); select.value = "";
      }
    }
    function renderLobby() {
      const snapshot = store.snapshot(), deck = store.getDeck(), report = api.validateDeck(catalog, deck);
      populate(ui.fourLaneDeckSelect, snapshot.selectedId);
      ui.fourLaneDeckSummary.textContent = `${report.summary.count} cards · ${report.summary.totalCost}/${api.MAX_DECK_COST} cost · `
        + api.ELEMENTS.map(element => `${elements[element].label} ${report.summary.elementCounts[element]}`).join(" · ");
      ui.fourLaneDeckStorageNotice.textContent = snapshot.notice;
      ui.fourLaneDeckStorageNotice.hidden = !snapshot.notice;
    }
    function renderCollection() {
      const summary = currentReport().summary;
      const search = ui.deckEditorSearch.value.trim().toLocaleLowerCase();
      const filtered = cards.filter(card => (!search || card.name.toLocaleLowerCase().includes(search))
        && (!ui.deckEditorElement.value || card.element === ui.deckEditorElement.value)
        && (!ui.deckEditorRole.value || card.tactic === ui.deckEditorRole.value)
        && (!ui.deckEditorRarity.value || card.rarity === ui.deckEditorRarity.value));
      ui.deckEditorResults.textContent = `${filtered.length} of ${cards.length} cards`;
      ui.deckEditorCollection.innerHTML = filtered.length ? filtered.map(card => {
        const copies = summary.copies[card.key] || 0;
        const reason = copies >= card.copyLimit ? "Copy limit reached" : summary.count >= api.DECK_SIZE ? "Remove a card first to swap it"
          : summary.totalCost + card.cost > api.MAX_DECK_COST ? "Not enough deck budget" : "";
        return `<article class="deck-catalog-card${copies ? " is-in-deck" : ""}" data-deck-card="${card.key}">
          ${cardMarkup(card)}
          <div class="deck-card-cost"><span>Cost <b>${card.cost}</b></span><span>${copies}/${card.copyLimit} copies</span></div>
          <p class="deck-card-role">${escape(roles[card.tactic].description)}</p>
          <div class="deck-card-controls">
            <button type="button" data-deck-remove="${card.key}" aria-label="Remove ${escape(card.name)}" ${copies ? "" : "disabled"}>−</button>
            <span aria-hidden="true">${copies}</span>
            <button type="button" data-deck-add="${card.key}" aria-label="Add ${escape(card.name)}" title="${reason || `Add ${escape(card.name)}`}" ${reason ? "disabled" : ""}>+</button>
          </div>
        </article>`;
      }).join("") : '<p class="deck-empty">No cards match these filters. Try resetting them.</p>';
    }
    function renderSummary() {
      const report = currentReport(), { summary } = report;
      ui.deckEditorStats.innerHTML = `<div class="deck-stat-totals"><span><b>${summary.count}/${api.DECK_SIZE}</b> Cards</span>
        <span><b>${summary.totalCost}/${api.MAX_DECK_COST}</b> Cost</span></div>
        <div class="deck-element-counts">${api.ELEMENTS.map(element => `<span class="${summary.elementCounts[element] < api.MIN_CARDS_PER_ELEMENT ? "is-short" : ""}">${elements[element].icon} ${elements[element].label} <b>${summary.elementCounts[element]}</b><small>min. ${api.MIN_CARDS_PER_ELEMENT}</small></span>`).join("")}</div>
        <p class="deck-role-counts">${api.ROLES.map(role => `${roles[role].label} ${summary.roleCounts[role]}`).join(" · ")}</p>`;
      ui.deckEditorErrors.replaceChildren(...report.errors.map(error => { const item = root.createElement("li"); item.textContent = error.message; return item; }));
      ui.deckEditorErrors.hidden = report.valid;
      ui.deckEditorSaveButton.disabled = !report.valid;
      ui.deckEditorSaveCopyButton.hidden = !editingId;
      ui.deckEditorSaveCopyButton.disabled = !report.valid;
      ui.deckEditorDeleteButton.hidden = !editingId;
      ui.deckEditorSelectedCount.textContent = String(summary.count);
      const chosen = cards.filter(card => summary.copies[card.key]);
      ui.deckEditorSelected.innerHTML = chosen.length ? chosen.map(card => `<div class="deck-selected-row">
        <img src="${escape(card.artworkSource || artworkSource(card.art))}" alt="" loading="lazy" />
        <span><b>${escape(card.name)}</b><small>${elements[card.element].label} · Power ${card.power} · ${roles[card.tactic].label} · Cost ${card.cost}</small></span>
        <b class="deck-selected-copies">×${summary.copies[card.key]}</b>
        <button type="button" data-deck-remove="${card.key}" aria-label="Remove ${escape(card.name)} from your deck">−</button>
      </div>`).join("") : '<p class="deck-empty">Your deck is empty. Add cards from the collection.</p>';
    }
    function refresh() { renderSummary(); renderCollection(); }
    function load(id) {
      const deck = store.getDeck(id);
      if (!deck) return;
      draft = { version: api.VERSION, name: deck.name, cards: [...deck.cards] };
      editingId = id.startsWith("custom-") ? id : null;
      loadedId = id;
      baseline = serialized();
      ui.deckEditorName.value = draft.name;
      populate(ui.deckEditorLoad, id);
      refresh(); say(editingId ? "Editing a saved deck. Save to update it, or save a new copy." : "Starter decks remain unchanged. Save your edits as your own deck.");
    }
    function confirm(title, text, label, action) {
      confirmAction = action; confirmFocus = root.activeElement;
      ui.deckEditorConfirmTitle.textContent = title; ui.deckEditorConfirmText.textContent = text;
      ui.deckEditorConfirmProceed.textContent = label;
      ui.deckEditorConfirm.showModal(); ui.deckEditorConfirmCancel.focus();
    }
    function discardThen(action) {
      if (!dirty()) { action(); return; }
      confirm("Discard unsaved changes?", "Your last saved deck will stay intact. The edits on this screen have not been saved.", "Discard changes", action);
    }
    function close(force = false) {
      if (ui.deckEditorScreen.hidden) return;
      const leave = () => { ui.deckEditorScreen.hidden = true; draft = null; editingId = null; if (onClose) onClose(); };
      if (force) {
        confirmAction = null;
        if (ui.deckEditorConfirm.open) ui.deckEditorConfirm.close();
        leave();
      } else discardThen(leave);
    }
    function open() {
      if (onOpen) onOpen();
      ui.deckEditorScreen.hidden = false;
      ui.deckEditorSearch.value = ""; ui.deckEditorElement.value = ""; ui.deckEditorRole.value = ""; ui.deckEditorRarity.value = "";
      ui.deckEditorSelectedDetails.open = global.innerWidth >= 780;
      load(store.snapshot().selectedId);
      ui.deckEditorScreen.scrollTop = 0; ui.deckEditorTitle.focus({ preventScroll: true });
    }
    function save(copy = false) {
      if (!currentReport().valid) return;
      try {
        const deck = store.save(draft, copy ? null : editingId);
        editingId = deck.id; loadedId = deck.id; draft = { version: deck.version, name: deck.name, cards: [...deck.cards] }; baseline = serialized();
        ui.deckEditorName.value = draft.name;
        populate(ui.deckEditorLoad, deck.id); renderLobby(); renderSummary();
        say(store.snapshot().storageAvailable ? `Saved “${deck.name}” and selected it for your next duel.` : store.snapshot().notice);
      } catch (error) { say(error.message); }
    }
    function changeCard(event) {
      const button = event.target.closest("[data-deck-add], [data-deck-remove]");
      if (!button || button.disabled || !draft) return;
      const key = button.dataset.deckAdd || button.dataset.deckRemove;
      const card = catalog.byKey[key]; if (!card) return;
      if (button.dataset.deckAdd) {
        const summary = currentReport().summary;
        if (draft.cards.length >= api.DECK_SIZE || (summary.copies[key] || 0) >= card.copyLimit || summary.totalCost + card.cost > api.MAX_DECK_COST) return;
        draft.cards.push(key);
      } else {
        const index = draft.cards.indexOf(key); if (index < 0) return;
        draft.cards.splice(index, 1);
      }
      const action = button.dataset.deckAdd ? "data-deck-add" : "data-deck-remove";
      const container = ui.deckEditorSelected.contains(button) ? ui.deckEditorSelected : ui.deckEditorCollection;
      refresh(); say(`${card.name} ${action === "data-deck-add" ? "added" : "removed"}.`);
      const next = container.querySelector(`[${action}="${key}"]:not(:disabled)`)
        || ui.deckEditorCollection.querySelector(`[data-deck-remove="${key}"]:not(:disabled)`);
      if (next) next.focus({ preventScroll: true });
      else ui.deckEditorTitle.focus({ preventScroll: true });
    }
    ui.fourLaneDeckSelect.addEventListener("change", () => { store.select(ui.fourLaneDeckSelect.value); renderLobby(); });
    ui.fourLaneDeckEditorButton.addEventListener("click", open);
    ui.deckEditorReturnButton.addEventListener("click", () => close());
    ui.deckEditorName.addEventListener("input", () => { draft.name = ui.deckEditorName.value; renderSummary(); });
    ui.deckEditorLoad.addEventListener("change", () => {
      const id = ui.deckEditorLoad.value;
      ui.deckEditorLoad.value = loadedId;
      discardThen(() => load(id));
    });
    ui.deckEditorNewButton.addEventListener("click", () => discardThen(() => {
      draft = { version: api.VERSION, name: "My Deck", cards: [] }; editingId = null; loadedId = ""; baseline = serialized();
      ui.deckEditorName.value = draft.name; populate(ui.deckEditorLoad, ""); refresh(); say("Choose 24 cards. At least four of each element are required.");
    }));
    ui.deckEditorSaveButton.addEventListener("click", () => save());
    ui.deckEditorSaveCopyButton.addEventListener("click", () => save(true));
    ui.deckEditorDeleteButton.addEventListener("click", () => {
      if (!editingId) return;
      const id = editingId, name = store.getDeck(id).name;
      confirm("Delete this saved deck?", `Delete “${name}” from this browser? This cannot be undone. Starter decks will remain available.`, "Delete deck", () => {
        store.remove(id); renderLobby(); load(store.snapshot().selectedId); say(`Deleted “${name}”.`);
      });
    });
    [ui.deckEditorCollection, ui.deckEditorSelected].forEach(element => element.addEventListener("click", changeCard));
    ui.deckEditorSearch.addEventListener("input", renderCollection);
    [ui.deckEditorElement, ui.deckEditorRole, ui.deckEditorRarity].forEach(element => element.addEventListener("change", renderCollection));
    ui.deckEditorResetFilters.addEventListener("click", () => {
      ui.deckEditorSearch.value = ""; ui.deckEditorElement.value = ""; ui.deckEditorRole.value = ""; ui.deckEditorRarity.value = ""; renderCollection();
    });
    ui.deckEditorConfirmProceed.addEventListener("click", () => { const action = confirmAction; confirmAction = null; ui.deckEditorConfirm.close(); action?.(); });
    ui.deckEditorConfirmCancel.addEventListener("click", () => { confirmAction = null; ui.deckEditorConfirm.close(); confirmFocus?.focus({ preventScroll: true }); });
    ui.deckEditorConfirm.addEventListener("cancel", () => { confirmAction = null; confirmFocus?.focus({ preventScroll: true }); });
    ui.deckEditorScreen.addEventListener("keydown", event => {
      if (ui.deckEditorConfirm.open) return;
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key !== "Tab") return;
      const focusable = [...ui.deckEditorScreen.querySelectorAll('button:not(:disabled), input, select, summary, [tabindex="0"]')]
        .filter(element => element.getClientRects().length && !element.closest("[hidden]"));
      if (event.shiftKey && (root.activeElement === focusable[0] || root.activeElement === ui.deckEditorTitle)) {
        event.preventDefault(); focusable.at(-1)?.focus();
      } else if (!event.shiftKey && root.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0]?.focus(); }
    });
    renderLobby();
    return Object.freeze({ open, close, renderLobby, getSelectedDeck: () => store.getDeck() });
  }
  global.ClawDeckEditor = Object.freeze({ createController });
})(globalThis);
