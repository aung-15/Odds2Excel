(() => {
  "use strict";

  const FIELD_KEYS = [
    "w1", "draw", "w2",
    "over15", "under15",
    "over25", "under25",
    "over35", "under35",
    "bttsYes", "bttsNo"
  ];

  const COLUMNS = [
    { key: "match", label: "Match" },
    { key: "w1", label: "1 (Home Win)" },
    { key: "draw", label: "X (Draw)" },
    { key: "w2", label: "2 (Away Win)" },
    { key: "over15", label: "Over 1.5" },
    { key: "under15", label: "Under 1.5" },
    { key: "over25", label: "Over 2.5" },
    { key: "under25", label: "Under 2.5" },
    { key: "over35", label: "Over 3.5" },
    { key: "under35", label: "Under 3.5" },
    { key: "bttsYes", label: "BTTS Yes" },
    { key: "bttsNo", label: "BTTS No" }
  ];

  let matches = [];
  let nextId = 1;

  const matchListEl = document.getElementById("matchList");
  const template = document.getElementById("matchCardTemplate");
  const previewHeadRow = document.getElementById("previewHeadRow");
  const previewBody = document.getElementById("previewBody");
  const showProbabilityEl = document.getElementById("showProbability");

  function createMatch() {
    const id = nextId++;
    const data = { id, home: "", away: "" };
    FIELD_KEYS.forEach((k) => (data[k] = ""));
    matches.push(data);
    renderMatchCard(data);
    renderPreview();
  }

  function renderMatchCard(data) {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".match-card");
    card.dataset.id = data.id;

    const homeInput = card.querySelector(".home-input");
    const awayInput = card.querySelector(".away-input");
    const pasteInput = card.querySelector(".paste-input");
    const parseBtn = card.querySelector(".parse-btn");
    const removeBtn = card.querySelector(".remove-btn");
    const noteEl = card.querySelector(".parse-note");

    homeInput.addEventListener("input", () => {
      data.home = homeInput.value;
      renderPreview();
    });
    awayInput.addEventListener("input", () => {
      data.away = awayInput.value;
      renderPreview();
    });

    card.querySelectorAll(".f").forEach((input) => {
      const field = input.dataset.field;
      input.value = data[field] || "";
      input.addEventListener("input", () => {
        data[field] = input.value.trim();
        renderPreview();
      });
    });

    parseBtn.addEventListener("click", () => {
      const result = parseOddsText(pasteInput.value, data.home, data.away);
      let filled = 0;
      Object.keys(result).forEach((key) => {
        if (result[key] !== null && result[key] !== undefined) {
          data[key] = result[key];
          const fieldInput = card.querySelector(`.f[data-field="${key}"]`);
          if (fieldInput) fieldInput.value = result[key];
          filled++;
        }
      });
      noteEl.textContent = filled
        ? `Filled ${filled} field(s) automatically. Please double-check them against the source before exporting.`
        : "Couldn't confidently match any markets in that text — fill the fields in manually.";
      renderPreview();
    });

    removeBtn.addEventListener("click", () => {
      matches = matches.filter((m) => m.id !== data.id);
      card.remove();
      renderPreview();
    });

    const screenshotInput = card.querySelector(".screenshot-input");
    const uploadStatus = card.querySelector(".upload-status");

    screenshotInput.addEventListener("change", async () => {
      const file = screenshotInput.files[0];
      if (!file) return;

      uploadStatus.textContent = "Extracting odds from screenshot...";
      try {
        const formData = new FormData();
        formData.append("screenshot", file);
        const resp = await fetch("/api/extract", { method: "POST", body: formData });
        const payload = await resp.json();
        if (!resp.ok) throw new Error(payload.error || "Extraction failed.");

        const extractedMatches = payload.matches || [];
        if (extractedMatches.length === 0) {
          uploadStatus.textContent = "No odds markets were recognized in that screenshot.";
          return;
        }

        applyExtractedMatch(data, card, extractedMatches[0]);
        for (let i = 1; i < extractedMatches.length; i++) {
          const newData = { id: nextId++, home: "", away: "" };
          FIELD_KEYS.forEach((k) => (newData[k] = ""));
          matches.push(newData);
          renderMatchCard(newData);
          const newCard = matchListEl.querySelector(`.match-card[data-id="${newData.id}"]`);
          applyExtractedMatch(newData, newCard, extractedMatches[i]);
        }

        uploadStatus.textContent = `Extracted ${extractedMatches.length} match(es) — double-check the values before exporting.`;
        renderPreview();
      } catch (e) {
        uploadStatus.textContent = `Error: ${e.message}`;
      } finally {
        screenshotInput.value = "";
      }
    });

    matchListEl.appendChild(node);
  }

  function applyExtractedMatch(targetData, targetCard, extracted) {
    const targetHomeInput = targetCard.querySelector(".home-input");
    const targetAwayInput = targetCard.querySelector(".away-input");

    if (extracted.home) {
      targetData.home = extracted.home;
      targetHomeInput.value = extracted.home;
    }
    if (extracted.away) {
      targetData.away = extracted.away;
      targetAwayInput.value = extracted.away;
    }
    FIELD_KEYS.forEach((key) => {
      const value = extracted[key];
      if (value !== undefined && value !== null && value !== "") {
        targetData[key] = String(value);
        const fieldInput = targetCard.querySelector(`.f[data-field="${key}"]`);
        if (fieldInput) fieldInput.value = value;
      }
    });
  }

  // Best-effort parser for odds text copied from a betting site.
  // Handles both "Label   Value" on one line and label/value split across lines,
  // by normalizing all whitespace (including newlines) to single spaces first.
  function parseOddsText(rawText, home, away) {
    const result = {};
    if (!rawText || !rawText.trim()) return result;

    const flat = rawText.replace(/\s+/g, " ").trim();

    const totalPattern = /(Over|Under)\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/gi;
    let m;
    while ((m = totalPattern.exec(flat)) !== null) {
      const side = m[1].toLowerCase();
      const line = m[2];
      const odds = m[3];
      if (line === "1.5") result[side === "over" ? "over15" : "under15"] = odds;
      else if (line === "2.5") result[side === "over" ? "over25" : "under25"] = odds;
      else if (line === "3.5") result[side === "over" ? "over35" : "under35"] = odds;
    }

    const bttsMatch = flat.match(
      /Both\s+Teams\s+To\s+Score[\s\S]{0,60}?Yes\s+(\d+(?:\.\d+)?)[\s\S]{0,60}?No\s+(\d+(?:\.\d+)?)/i
    );
    if (bttsMatch) {
      result.bttsYes = bttsMatch[1];
      result.bttsNo = bttsMatch[2];
    }

    const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (home && home.trim()) {
      const homeRe = new RegExp(escapeRe(home.trim()) + "\\D{0,12}?(\\d+\\.\\d+)", "i");
      const hm = flat.match(homeRe);
      if (hm) result.w1 = hm[1];
    }
    if (away && away.trim()) {
      const awayRe = new RegExp(escapeRe(away.trim()) + "\\D{0,12}?(\\d+\\.\\d+)", "i");
      const am = flat.match(awayRe);
      if (am) result.w2 = am[1];
    }
    const drawMatch = flat.match(/Draw\D{0,12}?(\d+\.\d+)/i);
    if (drawMatch) result.draw = drawMatch[1];

    return result;
  }

  function toProbability(oddsStr) {
    const odds = parseFloat(oddsStr);
    if (!odds || odds <= 0) return "";
    return (100 / odds).toFixed(1) + "%";
  }

  function renderPreview() {
    const showProb = showProbabilityEl.checked;

    previewHeadRow.innerHTML = "";
    COLUMNS.forEach((col) => {
      const th = document.createElement("th");
      th.textContent = col.label;
      previewHeadRow.appendChild(th);
      if (showProb && col.key !== "match") {
        const thP = document.createElement("th");
        thP.textContent = col.label + " %";
        previewHeadRow.appendChild(thP);
      }
    });

    previewBody.innerHTML = "";

    if (matches.length === 0) {
      const tr = document.createElement("tr");
      tr.className = "empty-row";
      const td = document.createElement("td");
      td.colSpan = showProb ? COLUMNS.length * 2 - 1 : COLUMNS.length;
      td.textContent = 'No matches yet — click "+ Add Match" to start.';
      tr.appendChild(td);
      previewBody.appendChild(tr);
      return;
    }

    matches.forEach((data) => {
      const tr = document.createElement("tr");
      const matchLabel = [data.home, data.away].filter(Boolean).join(" vs ") || "Untitled match";

      COLUMNS.forEach((col) => {
        const td = document.createElement("td");
        if (col.key === "match") {
          td.textContent = matchLabel;
        } else {
          td.textContent = data[col.key] || "";
        }
        tr.appendChild(td);

        if (showProb && col.key !== "match") {
          const tdP = document.createElement("td");
          tdP.textContent = data[col.key] ? toProbability(data[col.key]) : "";
          tr.appendChild(tdP);
        }
      });

      previewBody.appendChild(tr);
    });
  }

  function exportToExcel() {
    if (matches.length === 0) {
      alert("Add at least one match before exporting.");
      return;
    }

    const showProb = showProbabilityEl.checked;
    const header = [];
    COLUMNS.forEach((col) => {
      header.push(col.label);
      if (showProb && col.key !== "match") header.push(col.label + " %");
    });

    const rows = [header];
    matches.forEach((data) => {
      const matchLabel = [data.home, data.away].filter(Boolean).join(" vs ") || "Untitled match";
      const row = [];
      COLUMNS.forEach((col) => {
        if (col.key === "match") {
          row.push(matchLabel);
        } else {
          const raw = data[col.key];
          const num = raw ? parseFloat(raw) : "";
          row.push(num === "" || Number.isNaN(num) ? "" : num);
          if (showProb) {
            row.push(raw ? toProbability(raw) : "");
          }
        }
      });
      rows.push(row);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet["!cols"] = header.map((h) => ({ wch: Math.max(12, h.length + 2) }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Odds");

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `odds-table-${today}.xlsx`);
  }

  document.getElementById("addMatchBtn").addEventListener("click", createMatch);
  document.getElementById("exportBtn").addEventListener("click", exportToExcel);
  showProbabilityEl.addEventListener("change", renderPreview);

  createMatch();
  createMatch();
})();
