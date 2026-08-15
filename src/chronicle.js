(() => {
  const STORAGE_KEY = "projectProwl.chroniclePage";
  const screen = document.querySelector("#worldChronicleScreen");
  const openButton = document.querySelector("#mainMenuChronicleButton");

  if (!screen || !openButton) return;

  const mainMenu = document.querySelector("#mainMenuScreen");
  const pages = [...screen.querySelectorAll("[data-chronicle-page]")];
  const contents = screen.querySelector("#chronicleContents");
  const contentsButton = screen.querySelector("#chronicleContentsButton");
  const contentsClose = screen.querySelector("#chronicleContentsClose");
  const closeButton = screen.querySelector("#chronicleCloseButton");
  const previousButton = screen.querySelector("#chroniclePreviousButton");
  const nextButton = screen.querySelector("#chronicleNextButton");
  const progressLabel = screen.querySelector("#chronicleProgressLabel");
  const progressCount = screen.querySelector("#chronicleProgressCount");
  const contentsEntries = [...screen.querySelectorAll("[data-chronicle-target]")];
  let currentPage = loadSavedPage();
  let returnFocusTarget = openButton;

  function loadSavedPage() {
    try {
      const savedPage = Number.parseInt(window.localStorage.getItem(STORAGE_KEY), 10);
      return Number.isInteger(savedPage) && savedPage >= 0 && savedPage < pages.length
        ? savedPage
        : 0;
    } catch {
      return 0;
    }
  }

  function saveCurrentPage() {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(currentPage));
    } catch {
      // The chronicle remains fully usable when storage is unavailable.
    }
  }

  function pageTitle(index) {
    return pages[index]?.dataset.title || `Entry ${index + 1}`;
  }

  function renderPage(direction = "") {
    pages.forEach((page, index) => {
      page.hidden = index !== currentPage;
      page.classList.remove("is-turning-forward", "is-turning-backward");
      if (index === currentPage) {
        page.scrollTop = 0;
        page.querySelectorAll(".chronicle-leaf").forEach((leaf) => {
          leaf.scrollTop = 0;
        });
      }
    });

    const activePage = pages[currentPage];
    if (direction && activePage) {
      void activePage.offsetWidth;
      activePage.classList.add(`is-turning-${direction}`);
    }

    const title = pageTitle(currentPage);
    progressLabel.textContent = title;
    progressCount.textContent = `Entry ${currentPage + 1} of ${pages.length}`;
    previousButton.disabled = currentPage === 0;
    nextButton.disabled = currentPage === pages.length - 1;
    previousButton.setAttribute(
      "aria-label",
      currentPage === 0 ? "No previous entry" : `Previous entry: ${pageTitle(currentPage - 1)}`,
    );
    nextButton.setAttribute(
      "aria-label",
      currentPage === pages.length - 1 ? "End of public chronicle" : `Next entry: ${pageTitle(currentPage + 1)}`,
    );

    contentsEntries.forEach((entry) => {
      const isCurrent = Number(entry.dataset.chronicleTarget) === currentPage;
      if (isCurrent) entry.setAttribute("aria-current", "page");
      else entry.removeAttribute("aria-current");
    });

    saveCurrentPage();
  }

  function goToPage(index) {
    const nextPage = Math.max(0, Math.min(pages.length - 1, index));
    if (nextPage === currentPage) {
      setContentsOpen(false);
      return;
    }

    const direction = nextPage > currentPage ? "forward" : "backward";
    currentPage = nextPage;
    renderPage(direction);
    setContentsOpen(false);
  }

  function setContentsOpen(open) {
    contents.hidden = !open;
    contentsButton.setAttribute("aria-expanded", String(open));
    if (open) {
      const currentEntry = contents.querySelector('[aria-current="page"]');
      requestAnimationFrame(() => (currentEntry || contentsClose).focus());
    } else if (document.activeElement && contents.contains(document.activeElement)) {
      contentsButton.focus();
    }
  }

  function openChronicle() {
    returnFocusTarget = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : openButton;
    currentPage = loadSavedPage();
    renderPage();
    setContentsOpen(false);
    screen.hidden = false;
    openButton.setAttribute("aria-expanded", "true");
    document.body.classList.add("chronicle-active");
    if (mainMenu) mainMenu.inert = true;
    requestAnimationFrame(() => screen.focus());
  }

  function closeChronicle() {
    setContentsOpen(false);
    screen.hidden = true;
    openButton.setAttribute("aria-expanded", "false");
    document.body.classList.remove("chronicle-active");
    if (mainMenu) mainMenu.inert = false;
    requestAnimationFrame(() => returnFocusTarget?.focus());
  }

  function focusableControls() {
    return [...screen.querySelectorAll("button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])")]
      .filter((element) => !element.closest("[hidden]"));
  }

  function handleChronicleKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!contents.hidden) setContentsOpen(false);
      else closeChronicle();
      return;
    }

    if (contents.hidden && event.key === "ArrowLeft") {
      event.preventDefault();
      goToPage(currentPage - 1);
      return;
    }

    if (contents.hidden && event.key === "ArrowRight") {
      event.preventDefault();
      goToPage(currentPage + 1);
      return;
    }

    if (contents.hidden && event.key === "Home") {
      event.preventDefault();
      goToPage(0);
      return;
    }

    if (contents.hidden && event.key === "End") {
      event.preventDefault();
      goToPage(pages.length - 1);
      return;
    }

    if (event.key !== "Tab") return;
    const focusable = focusableControls();
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  openButton.addEventListener("click", openChronicle);
  closeButton.addEventListener("click", closeChronicle);
  contentsButton.addEventListener("click", () => setContentsOpen(contents.hidden));
  contentsClose.addEventListener("click", () => setContentsOpen(false));
  previousButton.addEventListener("click", () => goToPage(currentPage - 1));
  nextButton.addEventListener("click", () => goToPage(currentPage + 1));
  contentsEntries.forEach((entry) => {
    entry.addEventListener("click", () => goToPage(Number(entry.dataset.chronicleTarget)));
  });
  screen.addEventListener("keydown", handleChronicleKeydown);

  renderPage();
})();
