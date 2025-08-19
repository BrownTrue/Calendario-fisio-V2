/* ======= Utilities ======= */
const EXAM_DATE_STR = "2025-09-24";
const TYPE_COLORS = {
  study: "bg-sky-500",
  consolidation: "bg-amber-500",
  simulation: "bg-fuchsia-500",
  pause: "bg-slate-400",
  exam: "bg-emerald-600",
};

const COUNTABLE_TYPES = new Set(["study", "consolidation", "simulation"]); // considered "study days" for progress

const qs = (sel, el = document) => el.querySelector(sel);
const qsa = (sel, el = document) => [...el.querySelectorAll(sel)];

const fmtDateLong = (d) =>
  d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/* ======= State ======= */
let currentMonth = new Date(); // today
currentMonth.setDate(1); // normalize to first day for rendering

// Completed days are stored as an object { "YYYY-MM-DD": true }
const STORAGE_KEY = "studyPlanCompletedDays";
const loadCompleted = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
};
const saveCompleted = (obj) => localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
let completedDays = loadCompleted();

/* ======= Elements ======= */
const todayBtn = qs("#todayBtn");
const prevBtn = qs("#prevMonth");
const nextBtn = qs("#nextMonth");
const monthLabelEl = qs("#currentMonthLabel");
const gridEl = qs("#calendarGrid");

// Stats
const completionPctEl = qs("#completionPct");
const completionCountEl = qs("#completionCount");
const progressBarEl = qs("#progressBar");
const countdownEl = qs("#countdown");

// Modal
const modalRoot = qs("#modalRoot");
const modalBackdrop = qs("#modalBackdrop");
const modalPanel = qs("#modalPanel");
const closeModalBtn = qs("#closeModal");
const modalTitle = qs("#modalTitle");
const modalDate = qs("#modalDate");
const typeBadge = qs("#typeBadge");
const ankiText = qs("#ankiText");
const sessionsList = qs("#sessionsList");
const toggleCompleteBtn = qs("#toggleComplete");
const unmarkCompleteBtn = qs("#unmarkComplete");

let modalOpenDate = null; // "YYYY-MM-DD"

/* ======= Stats & Countdown ======= */
function computeStats() {
  const allDates = Object.keys(studyPlan).sort();
  const totalStudyDays = allDates.filter((d) => COUNTABLE_TYPES.has(studyPlan[d].type)).length;
  const done = allDates.filter((d) => COUNTABLE_TYPES.has(studyPlan[d].type) && completedDays[d]).length;

  const pct = totalStudyDays ? Math.round((done / totalStudyDays) * 100) : 0;
  completionPctEl.textContent = `${pct}%`;
  completionCountEl.textContent = `${done} / ${totalStudyDays} giorni studio`;
  progressBarEl.style.width = `${pct}%`;

  // Countdown
  const today = new Date();
  const exam = new Date(EXAM_DATE_STR + "T00:00:00");
  // floor difference in days (local)
  const msPerDay = 24 * 60 * 60 * 1000;
  const deltaDays = Math.max(0, Math.ceil((exam - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / msPerDay));
  countdownEl.textContent = `${deltaDays} giorni`;
}

/* ======= Calendar Rendering ======= */
function setMonthLabel(date) {
  const label = date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  monthLabelEl.textContent = label.charAt(0).toUpperCase() + label.slice(1);
}

function renderCalendar(date) {
  setMonthLabel(date);
  gridEl.innerHTML = "";

  const year = date.getFullYear();
  const month = date.getMonth(); // 0-11
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Determine how many leading blanks (Mon=0 ... Sun=6)
  let startIdx = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = lastDayOfMonth.getDate();

  // Previous month's trailing days (for a full grid)
  const prevMonthLastDate = new Date(year, month, 0).getDate();

  // Create 6 rows x 7 cols = 42 cells for consistency
  const totalCells = 42;
  for (let i = 0; i < totalCells; i++) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className =
      "relative aspect-square w-full rounded-xl p-2 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:hover:bg-slate-700/50";
    cell.setAttribute("data-cell-index", String(i));

    let cellDay, cellMonthOffset = 0;
    if (i < startIdx) {
      // preceding days
      cellDay = prevMonthLastDate - (startIdx - i - 1);
      cellMonthOffset = -1;
    } else if (i >= startIdx + daysInMonth) {
      // next month days
      cellDay = i - (startIdx + daysInMonth) + 1;
      cellMonthOffset = +1;
    } else {
      // current month day
      cellDay = i - startIdx + 1;
      cellMonthOffset = 0;
    }

    const cellDate = new Date(year, month + cellMonthOffset, cellDay);
    const cellYMD = ymd(cellDate);

    // Style for outside-month days
    const isOutside = cellMonthOffset !== 0;
    cell.classList.toggle("opacity-60", isOutside);

    // Header (number + today indicator)
    const header = document.createElement("div");
    header.className = "flex items-center justify-between";
    const dayNum = document.createElement("span");
    dayNum.className = "text-sm font-semibold";
    dayNum.textContent = String(cellDay);
    header.appendChild(dayNum);

    // Today chip
    const todayStr = ymd(new Date());
    if (cellYMD === todayStr) {
      const todayChip = document.createElement("span");
      todayChip.className = "rounded-full border border-sky-500 px-2 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-300";
      todayChip.textContent = "Oggi";
      header.appendChild(todayChip);
    } else {
      header.appendChild(document.createElement("span"));
    }
    cell.appendChild(header);

    // Event dot / type badge
    if (studyPlan[cellYMD]) {
      const { type, title } = studyPlan[cellYMD];
      const dot = document.createElement("div");
      dot.className = `mt-2 inline-flex items-center gap-2`;
      dot.innerHTML = `
        <span class="h-2.5 w-2.5 rounded-full ${TYPE_COLORS[type] || "bg-slate-400"}"></span>
        <span class="line-clamp-2 text-xs font-medium">${title}</span>
      `;
      cell.appendChild(dot);

      // Completed check
      if (completedDays[cellYMD]) {
        const check = document.createElement("div");
        check.className =
          "absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border border-emerald-600 bg-white text-[12px] font-bold text-emerald-700 dark:bg-slate-900";
        check.textContent = "✓";
        check.title = "Completato";
        cell.appendChild(check);
      }

      // Click handler opens modal
      cell.addEventListener("click", () => openModal(cellYMD));
      cell.classList.add("cursor-pointer");
      cell.setAttribute("aria-label", `${title} — ${type}`);
    } else {
      // No event: disable click for outside months; inside current month still focusable but inert
      if (isOutside) {
        cell.disabled = true;
        cell.classList.add("cursor-not-allowed");
      }
    }

    gridEl.appendChild(cell);
  }
}

/* ======= Modal ======= */
function openModal(dateStr) {
  modalOpenDate = dateStr;
  const data = studyPlan[dateStr];
  if (!data) return;

  // Fill content
  modalTitle.textContent = data.title;
  const d = new Date(dateStr + "T00:00:00");
  modalDate.textContent = fmtDateLong(d);
  typeBadge.textContent = labelForType(data.type);
  typeBadge.className =
    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset " +
    (data.type === "study" ? "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-900/20 dark:text-sky-200 dark:ring-sky-800/60"
      : data.type === "consolidation" ? "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:ring-amber-800/60"
      : data.type === "simulation" ? "bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200 dark:bg-fuchsia-900/20 dark:text-fuchsia-200 dark:ring-fuchsia-800/60"
      : data.type === "pause" ? "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700"
      : "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-800/60");

  ankiText.textContent = data.anki || "—";

  sessionsList.innerHTML = "";
  (data.sessions || []).forEach((s) => {
    const li = document.createElement("li");
    li.className = "rounded-xl border border-slate-200 p-3 dark:border-slate-700";
    li.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="text-sm font-semibold">${escapeHTML(s.time || "")}</span>
        <span class="text-xs rounded-lg bg-slate-100 px-2 py-1 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-100">${escapeHTML(s.topic || "")}</span>
      </div>
      <p class="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">${escapeHTML(s.details || "")}</p>
    `;
    sessionsList.appendChild(li);
  });

  // Buttons state
  const isDone = !!completedDays[dateStr];
  toggleCompleteBtn.classList.toggle("hidden", isDone);
  unmarkCompleteBtn.classList.toggle("hidden", !isDone);
  toggleCompleteBtn.textContent = COUNTABLE_TYPES.has(data.type) ? "✓ Segna come completato" : "✓ Segna come completato (facoltativo)";

  // Show modal with animations
  modalRoot.classList.remove("hidden");
  animateIn(modalBackdrop, "backdrop");
  animateIn(modalPanel, "modal");
}

function closeModal() {
  animateOut(modalBackdrop, "backdrop", () => modalRoot.classList.add("hidden"));
  animateOut(modalPanel, "modal");
  modalOpenDate = null;
}

function labelForType(type) {
  switch (type) {
    case "study": return "Studio";
    case "consolidation": return "Consolidamento";
    case "simulation": return "Simulazione";
    case "pause": return "Pausa";
    case "exam": return "Esame";
    default: return type;
  }
}

/* ======= Completion Toggle ======= */
function markCompleted(dateStr, value) {
  if (value) completedDays[dateStr] = true;
  else delete completedDays[dateStr];
  saveCompleted(completedDays);
  computeStats();
  renderCalendar(currentMonth);
  if (modalOpenDate === dateStr) {
    toggleCompleteBtn.classList.toggle("hidden", !!value);
    unmarkCompleteBtn.classList.toggle("hidden", !value);
  }
}

/* ======= Animations (no external libs) ======= */
function animateIn(el, kind) {
  const enter = kind === "backdrop" ? "backdrop-enter" : "modal-enter";
  const active = kind === "backdrop" ? "backdrop-enter-active" : "modal-enter-active";
  el.classList.add(enter);
  requestAnimationFrame(() => {
    el.classList.add(active);
    el.classList.remove(enter);
  });
}

function animateOut(el, kind, onEnd) {
  const exit = kind === "backdrop" ? "backdrop-exit" : "modal-exit";
  const active = kind === "backdrop" ? "backdrop-exit-active" : "modal-exit-active";
  el.classList.add(exit);
  // Force reflow
  void el.offsetWidth;
  el.classList.add(active);
  const totalMs = 220;
  setTimeout(() => {
    el.classList.remove(exit, active);
    if (onEnd) onEnd();
  }, totalMs);
}

/* ======= Helpers ======= */
function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

/* ======= Event Listeners ======= */
prevBtn.addEventListener("click", () => {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
  renderCalendar(currentMonth);
});
nextBtn.addEventListener("click", () => {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  renderCalendar(currentMonth);
});
todayBtn.addEventListener("click", () => {
  currentMonth = new Date();
  currentMonth.setDate(1);
  renderCalendar(currentMonth);
});

modalBackdrop.addEventListener("click", closeModal);
closeModalBtn.addEventListener("click", closeModal);

toggleCompleteBtn.addEventListener("click", () => {
  if (modalOpenDate) markCompleted(modalOpenDate, true);
});
unmarkCompleteBtn.addEventListener("click", () => {
  if (modalOpenDate) markCompleted(modalOpenDate, false);
});

/* ======= Initial Render ======= */
computeStats();
renderCalendar(currentMonth);
setInterval(computeStats, 1000 * 60 * 60); // refresh countdown hourly

// If today has an event and it's this month, optionally highlight cell (accessibility)
(function highlightTodayCell() {
  const t = new Date();
  if (t.getFullYear() === currentMonth.getFullYear() && t.getMonth() === currentMonth.getMonth()) {
    const id = ymd(t);
    // Add a subtle ring on the "today" cell
    qsa("#calendarGrid > button").forEach((btn) => {
      const idx = Number(btn.getAttribute("data-cell-index"));
      // Not necessary to compute; just add ring if it contains "Oggi"
      if (btn.textContent.includes("Oggi")) {
        btn.classList.add("ring-2", "ring-sky-500");
      }
    });
    // If today is exam day, open modal automatically
    if (id === EXAM_DATE_STR && studyPlan[id]) openModal(id);
  }
})();