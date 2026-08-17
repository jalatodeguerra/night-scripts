(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const archive = $("archive");
  const listEl = $("list");
  const emptyEl = $("empty");
  const searchEl = $("search");
  const reader = $("reader");
  const readerBody = $("reader-body");
  const copyStatus = $("copy-status");
  const chips = Array.from(document.querySelectorAll(".chip"));

  let stories = [];
  let filter = "all";
  let query = "";
  let lastFocus = null;
  let copyTimer = 0;

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function storyIdFromHash() {
    const match = location.hash.match(/^#\/story\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  function matchesFilter(story) {
    if (filter === "all") return true;
    if (filter === "true-crime") return story.kind === "true-crime";
    return story.kind === "folklore" || story.kind === "urban-legend";
  }

  function matchesQuery(story) {
    if (!query) return true;
    const hay = [
      story.title,
      story.country,
      story.hook,
      story.kindLabel,
      story.year,
      story.id,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(query);
  }

  function visibleStories() {
    return stories.filter((story) => matchesFilter(story) && matchesQuery(story));
  }

  function renderList() {
    const shown = visibleStories();
    listEl.innerHTML = shown
      .map((story) => {
        const crime = story.kind === "true-crime";
        const country = story.country.split("(")[0].split(" — ")[0].trim();
        const meta = [country, story.duration].filter(Boolean).join(" · ");
        return (
          '<a class="card' +
          (crime ? " is-crime" : "") +
          '" href="#/story/' +
          encodeURIComponent(story.id) +
          '" data-id="' +
          esc(story.id) +
          '">' +
          '<div class="card-meta">' +
          '<span class="pill">' +
          esc(story.kindLabel) +
          "</span>" +
          "<span>" +
          esc(meta) +
          "</span>" +
          "</div>" +
          "<h2>" +
          esc(story.title) +
          "</h2>" +
          '<p class="hook">' +
          esc(story.hook) +
          "</p>" +
          "</a>"
        );
      })
      .join("");
    emptyEl.hidden = shown.length !== 0;
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
        '<p class="missing">This script is not in the archive.</p>';
      return;
    }
    const crime = story.kind === "true-crime";
    const kindClass = crime ? "kind-blood" : "kind-gold";
    const kickerBits = [story.kindLabel, story.country];
    if (story.year) kickerBits.push(story.year);
    const paragraphs = story.script
      .split(/\n\n+/)
      .map((p) => "<p>" + esc(p) + "</p>")
      .join("");
    const sources = (story.sources || []).map(sourceMarkup).join("");
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
      '<p class="hook-block' +
      (crime ? " is-crime" : "") +
      '">' +
      esc(story.hook) +
      "</p>" +
      '<p class="script-label">Script</p>' +
      '<div class="script">' +
      paragraphs +
      "</div>" +
      '<button type="button" class="copy-btn' +
      (crime ? " is-crime" : "") +
      '" data-copy="1">Copy script</button>' +
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

  async function copyScript(story) {
    const text = story.script || "";
    try {
      await navigator.clipboard.writeText(text);
      showToast("Script copied");
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
        showToast("Script copied");
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
        if (card) card.focus();
        lastFocus = null;
      }
    }
  }

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      filter = chip.getAttribute("data-filter") || "all";
      chips.forEach((other) => {
        const on = other === chip;
        other.classList.toggle("is-on", on);
        other.setAttribute("aria-pressed", on ? "true" : "false");
      });
      if (!storyIdFromHash()) renderList();
    });
  });

  searchEl.addEventListener("input", () => {
    query = searchEl.value.trim().toLowerCase();
    if (!storyIdFromHash()) renderList();
  });

  listEl.addEventListener("click", (event) => {
    const card = event.target.closest("[data-id]");
    if (card) lastFocus = card.getAttribute("data-id");
  });

  reader.addEventListener("click", (event) => {
    const button = event.target.closest("[data-copy]");
    if (!button) return;
    const id = storyIdFromHash();
    const story = stories.find((item) => item.id === id);
    if (story) copyScript(story);
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

  loadStories()
    .then((data) => {
      stories = data;
      applyRoute();
    })
    .catch(() => {
      emptyEl.hidden = false;
      emptyEl.textContent = "The archive would not open.";
    });
})();
