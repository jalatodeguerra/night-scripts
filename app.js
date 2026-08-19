(function () {
  "use strict";

  const DONE_KEY = "night-scripts-done";
  const FILTERS_KEY = "night-scripts-filters-open";
  const $ = (id) => document.getElementById(id);
  const archive = $("archive");
  const listEl = $("list");
  const emptyEl = $("empty");
  const searchEl = $("search");
  const continentEl = $("continent");
  const countryEl = $("country");
  const countEl = $("filter-count");
  const topbar = document.querySelector(".topbar");
  const filtersToggle = $("filters-toggle");
  const reader = $("reader");
  const readerBody = $("reader-body");
  const copyStatus = $("copy-status");
  const chips = Array.from(document.querySelectorAll("[data-filter]"));
  const progressChips = Array.from(document.querySelectorAll("[data-progress]"));

  let stories = [];
  let filter = "all";
  let progress = "all";
  let continent = "";
  let country = "";
  let query = "";
  let lastFocus = null;
  let copyTimer = 0;
  let doneIds = new Set();

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function loadDone() {
    try {
      const raw = localStorage.getItem(DONE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      doneIds = new Set(parsed.filter((id) => typeof id === "string"));
    } catch (err) {
      doneIds = new Set();
    }
  }

  function saveDone() {
    try {
      localStorage.setItem(DONE_KEY, JSON.stringify(Array.from(doneIds)));
    } catch (err) {
      // Private mode or quota — keep the in-memory set.
    }
  }

  function isDone(id) {
    return doneIds.has(id);
  }

  function setDone(id, on) {
    if (!id) return;
    if (on) doneIds.add(id);
    else doneIds.delete(id);
    saveDone();
    const card = listEl.querySelector('[data-id="' + id + '"]');
    if (card) {
      card.classList.toggle("is-done", on);
      const box = card.querySelector('input[data-done="' + id + '"]');
      if (box) box.checked = on;
    }
    const readerBox = reader.querySelector('input[data-done="' + id + '"]');
    if (readerBox) readerBox.checked = on;
    updateCount();
    if (progress !== "all" && !storyIdFromHash()) renderList();
  }

  function storyIdFromHash() {
    const match = location.hash.match(/^#\/story\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  function matchesFilter(story) {
    if (filter === "all") return true;
    if (filter === "true-crime") return story.kind === "true-crime";
    if (filter === "creepypasta") return story.kind === "creepypasta";
    if (filter === "cryptid") return story.kind === "cryptid";
    if (filter === "conspiracy") return story.kind === "conspiracy";
    return story.kind === "folklore" || story.kind === "urban-legend";
  }

  function matchesPlace(story) {
    if (continent && story.continent !== continent) return false;
    if (country && story.countryShort !== country) return false;
    return true;
  }

  function matchesProgress(story) {
    if (progress === "all") return true;
    if (progress === "done") return isDone(story.id);
    return !isDone(story.id);
  }

  function matchesQuery(story) {
    if (!query) return true;
    const hay = [
      story.title,
      story.country,
      story.countryShort,
      story.continent,
      story.hook,
      story.story,
      story.kindLabel,
      story.year,
      story.id,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(query);
  }

  function visibleStories() {
    return stories.filter(
      (story) =>
        matchesFilter(story) &&
        matchesPlace(story) &&
        matchesProgress(story) &&
        matchesQuery(story)
    );
  }

  function openRandomStory() {
    const pool = visibleStories();
    const list = pool.length ? pool : stories;
    if (!list.length) return;
    const current = storyIdFromHash();
    const choices =
      list.length > 1 ? list.filter((story) => story.id !== current) : list;
    const pick = choices[Math.floor(Math.random() * choices.length)];
    lastFocus = pick.id;
    location.hash = "#/story/" + encodeURIComponent(pick.id);
  }

  function uniqueSorted(values) {
    return Array.from(new Set(values.filter(Boolean))).sort(function (a, b) {
      return a.localeCompare(b);
    });
  }

  function continentsInData() {
    return uniqueSorted(stories.map((story) => story.continent));
  }

  function countriesInData(forContinent) {
    return uniqueSorted(
      stories
        .filter((story) => !forContinent || story.continent === forContinent)
        .map((story) => story.countryShort)
    );
  }

  function fillSelect(select, allLabel, values, current) {
    const keep = values.indexOf(current) !== -1 ? current : "";
    select.innerHTML =
      '<option value="">' +
      esc(allLabel) +
      "</option>" +
      values
        .map(function (value) {
          return '<option value="' + esc(value) + '">' + esc(value) + "</option>";
        })
        .join("");
    select.value = keep;
    return keep;
  }

  function populatePlaceFilters() {
    fillSelect(continentEl, "All continents", continentsInData(), continent);
    country = fillSelect(
      countryEl,
      "All countries",
      countriesInData(continent),
      country
    );
  }

  function updateCount() {
    if (!countEl) return;
    const total = stories.length;
    const todo = stories.filter((story) => !isDone(story.id)).length;
    countEl.textContent = todo + " of " + total + " to do";
  }

  function doneMarkup(id, extraClass) {
    const checked = isDone(id) ? " checked" : "";
    return (
      '<label class="done-check' +
      (extraClass ? " " + extraClass : "") +
      '" data-done-wrap>' +
      '<input type="checkbox" data-done="' +
      esc(id) +
      '"' +
      checked +
      ">" +
      "<span>Done</span>" +
      "</label>"
    );
  }

  function handleDoneClick(event) {
    const wrap = event.target.closest("[data-done-wrap]");
    if (!wrap) return false;
    event.preventDefault();
    event.stopPropagation();
    const input = wrap.querySelector("input[data-done]");
    if (!input) return true;
    const id = input.getAttribute("data-done");
    const next = !isDone(id);
    input.checked = next;
    setDone(id, next);
    return true;
  }

  function renderList() {
    const shown = visibleStories();
    listEl.innerHTML = shown
      .map((story) => {
        const crime = story.kind === "true-crime";
        const countryLabel =
          story.countryShort ||
          story.country.split("(")[0].split(" — ")[0].trim();
        return (
          '<article class="card' +
          (crime ? " is-crime" : "") +
          (isDone(story.id) ? " is-done" : "") +
          '" data-id="' +
          esc(story.id) +
          '">' +
          doneMarkup(story.id) +
          '<a class="card-main" href="#/story/' +
          encodeURIComponent(story.id) +
          '">' +
          '<div class="card-meta">' +
          '<span class="pill">' +
          esc(story.kindLabel) +
          "</span>" +
          "<span>" +
          esc(countryLabel) +
          "</span>" +
          "</div>" +
          "<h2>" +
          esc(story.title) +
          "</h2>" +
          '<p class="hook">' +
          esc(story.hook) +
          "</p>" +
          "</a>" +
          "</article>"
        );
      })
      .join("");
    emptyEl.hidden = shown.length !== 0;
    updateCount();
  }

  function sourceMarkup(source) {
    const urlMatch = String(source).match(/^(https?:\/\/\S+)/i);
    if (!urlMatch) return "<li>" + esc(source) + "</li>";
    const url = urlMatch[1];
    const note = String(source).slice(url.length).trim();
    return (
      "<li><a href=\"" +
      esc(url) +
      '" target="_blank" rel="noopener noreferrer">' +
      esc(url) +
      "</a>" +
      (note ? " " + esc(note) : "") +
      "</li>"
    );
  }

  function renderReader(story) {
    if (!story) {
      readerBody.innerHTML =
        '<p class="missing">This story is not in the archive.</p>';
      return;
    }
    const crime = story.kind === "true-crime";
    const kindClass = crime ? "kind-blood" : "kind-gold";
    const kickerBits = [story.kindLabel, story.country];
    if (story.year) kickerBits.push(story.year);
    const paragraphs = (story.story || "")
      .split(/\n\n+/)
      .map((p) => "<p>" + esc(p) + "</p>")
      .join("");
    const sources = (story.sources || []).map(sourceMarkup).join("");
    const beats = (story.beats || [])
      .map(function (beat) {
        return "<li>" + esc(beat) + "</li>";
      })
      .join("");
    const beatsBlock = beats
      ? '<div class="beats"><p class="beats-label">Beats</p><ol>' + beats + "</ol></div>"
      : "";
    readerBody.innerHTML =
      '<p class="reader-kicker"><span class="' +
      kindClass +
      '">' +
      esc(story.kindLabel) +
      "</span> · " +
      esc(kickerBits.slice(1).join(" · ")) +
      "</p>" +
      "<h1>" +
      esc(story.title) +
      "</h1>" +
      doneMarkup(story.id, "reader-done") +
      (story.hook
        ? '<section class="resume"><p class="resume-label">Summary</p><p>' +
          esc(story.hook) +
          "</p></section>"
        : "") +
      '<div class="story-body">' +
      '<p class="story-label">Story</p>' +
      paragraphs +
      "</div>" +
      beatsBlock +
      '<button type="button" class="copy-btn' +
      (crime ? " is-crime" : "") +
      '" data-copy="1">Copy story</button>' +
      '<div class="notes">' +
      "<details><summary>Must-keep</summary><p class=\"note-body\">" +
      esc(story.mustKeep) +
      "</p></details>" +
      "<details><summary>Sensitivity</summary><p class=\"note-body\">" +
      esc(story.sensitivity) +
      "</p></details>" +
      "<details><summary>Sources</summary><ul>" +
      sources +
      "</ul></details>" +
      '<details class="script-block"><summary>Script</summary>' +
      (story.script
        ? '<div class="note-body script-body">' +
          (story.script || "")
            .split(/\n\n+/)
            .map(function (p) {
              return "<p>" + esc(p) + "</p>";
            })
            .join("") +
          "</div>"
        : '<p class="note-body script-empty">No script yet.</p>') +
      "</details>" +
      "</div>";
  }

  function showToast(message) {
    copyStatus.textContent = message;
    copyStatus.classList.add("is-on");
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copyStatus.classList.remove("is-on");
    }, 1800);
  }

  async function copyStory(story) {
    const text = story.story || "";
    try {
      await navigator.clipboard.writeText(text);
      showToast("Story copied");
    } catch (err) {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand("copy");
        showToast("Story copied");
      } catch (fallbackErr) {
        showToast("Copy failed");
      }
      document.body.removeChild(area);
    }
  }

  function applyRoute() {
    const id = storyIdFromHash();
    const story = id ? stories.find((item) => item.id === id) : null;
    if (id) {
      archive.hidden = true;
      archive.setAttribute("aria-hidden", "true");
      reader.hidden = false;
      document.body.style.overflow = "hidden";
      renderReader(story);
      reader.scrollTop = 0;
      const back = $("back");
      if (back) back.focus();
    } else {
      archive.hidden = false;
      archive.removeAttribute("aria-hidden");
      reader.hidden = true;
      readerBody.innerHTML = "";
      document.body.style.overflow = "";
      renderList();
      if (lastFocus) {
        const card = listEl.querySelector('[data-id="' + lastFocus + '"]');
        if (card) {
          const link = card.querySelector(".card-main") || card;
          link.focus();
        }
        lastFocus = null;
      }
    }
  }

  function setChipState(group, active) {
    group.forEach((chip) => {
      const on = chip === active;
      chip.classList.toggle("is-on", on);
      chip.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      filter = chip.getAttribute("data-filter") || "all";
      setChipState(chips, chip);
      if (!storyIdFromHash()) renderList();
    });
  });

  progressChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      progress = chip.getAttribute("data-progress") || "all";
      setChipState(progressChips, chip);
      if (!storyIdFromHash()) renderList();
    });
  });

  searchEl.addEventListener("input", () => {
    query = searchEl.value.trim().toLowerCase();
    if (!storyIdFromHash()) renderList();
  });

  continentEl.addEventListener("change", () => {
    continent = continentEl.value;
    country = fillSelect(
      countryEl,
      "All countries",
      countriesInData(continent),
      country
    );
    if (!storyIdFromHash()) renderList();
  });

  countryEl.addEventListener("change", () => {
    country = countryEl.value;
    if (!storyIdFromHash()) renderList();
  });

  listEl.addEventListener("click", (event) => {
    if (handleDoneClick(event)) return;
    const card = event.target.closest("[data-id]");
    if (card) lastFocus = card.getAttribute("data-id");
  });

  listEl.addEventListener("pointerdown", (event) => {
    if (event.target.closest("[data-done-wrap]")) event.stopPropagation();
  });

  reader.addEventListener("click", (event) => {
    if (handleDoneClick(event)) return;
    const button = event.target.closest("[data-copy]");
    if (!button) return;
    const id = storyIdFromHash();
    const story = stories.find((item) => item.id === id);
    if (story) copyStory(story);
  });

  window.addEventListener("hashchange", applyRoute);

  async function loadStories() {
    try {
      const response = await fetch("stories.json");
      if (!response.ok) throw new Error("fetch failed");
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("bad json");
      return data;
    } catch (err) {
      const raw = $("stories-data").textContent;
      return JSON.parse(raw);
    }
  }

  function filtersOpen() {
    try {
      const raw = localStorage.getItem(FILTERS_KEY);
      if (raw === "0") return false;
      if (raw === "1") return true;
    } catch (err) {}
    return window.matchMedia("(min-width: 720px)").matches;
  }

  function applyFiltersOpen(open) {
    if (!topbar || !filtersToggle) return;
    topbar.classList.toggle("is-collapsed", !open);
    filtersToggle.setAttribute("aria-expanded", open ? "true" : "false");
    filtersToggle.textContent = open ? "Hide filters" : "Filters";
    try {
      localStorage.setItem(FILTERS_KEY, open ? "1" : "0");
    } catch (err) {}
  }

  if (filtersToggle) {
    applyFiltersOpen(filtersOpen());
    filtersToggle.addEventListener("click", () => {
      const open = filtersToggle.getAttribute("aria-expanded") !== "true";
      applyFiltersOpen(open);
    });
  }

  const randomBtn = $("random-story");
  const randomReaderBtn = $("random-story-reader");
  if (randomBtn) randomBtn.addEventListener("click", openRandomStory);
  if (randomReaderBtn) randomReaderBtn.addEventListener("click", openRandomStory);

  loadDone();
  loadStories()
    .then((data) => {
      stories = data;
      populatePlaceFilters();
      updateCount();
      applyRoute();
    })
    .catch(() => {
      emptyEl.hidden = false;
      emptyEl.textContent = "The archive would not open.";
    });
})();
