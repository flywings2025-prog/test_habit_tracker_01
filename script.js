// SECTION: Data & persistence
const STORAGE_KEY = "habitGroveState_v1";

const DEFAULT_HABITS = [
  { id: "water", name: "Drink 6 glasses of water" },
  { id: "move", name: "Move your body for 20 minutes" },
  { id: "read", name: "Read for 10 minutes" },
];

// Load & save helpers
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("Could not load habit data", e);
    return null;
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Could not save habit data", e);
  }
}

// Today's date key (YYYY-MM-DD)
function getTodayKey() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(dateKey) {
  const d = new Date(dateKey);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// Initialize state shape
function createInitialState() {
  const today = getTodayKey();
  const habits = DEFAULT_HABITS.map((h, index) => ({
    id: h.id,
    name: h.name,
    createdAt: today,
    order: index,
  }));

  return {
    habits,
    // completions[date][habitId] = true/false
    completions: {},
    points: 0,
  };
}

// Global state (mutable in memory)
let state = loadState() || createInitialState();

// Ensure completions object exists
if (!state.completions) state.completions = {};

// SECTION: DOM references
const todayLabelEl = document.getElementById("today-label");
const habitListEl = document.getElementById("habit-list");
const addHabitForm = document.getElementById("add-habit-form");
const habitNameInput = document.getElementById("habit-name-input");
const clearTodayButton = document.getElementById("clear-today");

const pointsValueEl = document.getElementById("points-value");
const levelValueEl = document.getElementById("level-value");
const levelProgressEl = document.getElementById("level-progress");
const levelCaptionEl = document.getElementById("level-caption");

const historyHabitSelectEl = document.getElementById("history-habit-select");
const historyListEl = document.getElementById("history-list");

const calendarGridEl = document.getElementById("calendar-grid");

// SECTION: Levels & scoring
const LEVELS = [
  { label: "Seedling", threshold: 0 },
  { label: "Sprout", threshold: 40 },
  { label: "Sapling", threshold: 120 },
  { label: "Young tree", threshold: 260 },
  { label: "Grove guardian", threshold: 480 },
];

function getLevelInfo(points) {
  let current = LEVELS[0];
  let next = null;

  for (let i = 0; i < LEVELS.length; i++) {
    if (points >= LEVELS[i].threshold) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || null;
    }
  }

  if (!next) {
    return {
      label: current.label,
      progressPercent: 100,
      caption: "You reached the top tier – keep the grove thriving!",
    };
  }

  const span = next.threshold - current.threshold;
  const into = points - current.threshold;
  const pct = Math.min(100, Math.round((into / span) * 100));

  return {
    label: current.label,
    progressPercent: pct,
    caption: `${next.threshold - points} points until ${next.label}.`,
  };
}

// SECTION: Rendering helpers
function renderTodayLabel() {
  const today = new Date();
  const formatted = today.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  todayLabelEl.textContent = `Today · ${formatted}`;
}

function ensureDateEntry(dateKey) {
  if (!state.completions[dateKey]) {
    state.completions[dateKey] = {};
  }
}

function isHabitDoneOnDate(habitId, dateKey) {
  const day = state.completions[dateKey];
  return day ? Boolean(day[habitId]) : false;
}

function toggleHabitForToday(habitId, done) {
  const todayKey = getTodayKey();
  ensureDateEntry(todayKey);

  const alreadyDone = Boolean(state.completions[todayKey][habitId]);

  state.completions[todayKey][habitId] = done;

  if (!alreadyDone && done) {
    state.points += 5; // reward per completion
  } else if (alreadyDone && !done) {
    state.points = Math.max(0, state.points - 5);
  }

  saveState(state);
  renderPointsAndLevel();
  renderHistory();
  renderCalendar();
}

function computeStreak(habitId) {
  const todayKey = getTodayKey();
  let streak = 0;
  let cursor = new Date(todayKey);

  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    const day = state.completions[key];
    if (!day || !day[habitId]) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function renderHabitList() {
  const todayKey = getTodayKey();
  ensureDateEntry(todayKey);

  habitListEl.innerHTML = "";

  state.habits
    .slice()
    .sort((a, b) => a.order - b.order)
    .forEach((habit) => {
      const li = document.createElement("li");
      li.className = "habit-item";

      const main = document.createElement("div");
      main.className = "habit-main";

      const checkboxWrapper = document.createElement("label");
      checkboxWrapper.className = "habit-checkbox";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = isHabitDoneOnDate(habit.id, todayKey);

      const visual = document.createElement("div");
      visual.className = "check-visual";
      visual.textContent = input.checked ? "✓" : "";

      input.addEventListener("change", () => {
        visual.textContent = input.checked ? "✓" : "";
        toggleHabitForToday(habit.id, input.checked);
        // Re-render streak & history since they depend on completion
        renderHabitList();
      });

      checkboxWrapper.appendChild(input);
      checkboxWrapper.appendChild(visual);

      const meta = document.createElement("div");
      meta.className = "habit-meta";

      const nameEl = document.createElement("p");
      nameEl.className = "habit-name";
      nameEl.textContent = habit.name;

      const streakEl = document.createElement("p");
      streakEl.className = "habit-streak";
      const streak = computeStreak(habit.id);
      streakEl.textContent = streak
        ? `${streak} day streak`
        : "No streak yet – start today";

      meta.appendChild(nameEl);
      meta.appendChild(streakEl);

      main.appendChild(checkboxWrapper);
      main.appendChild(meta);

      const right = document.createElement("div");
      right.className = "habit-points-pill";
      right.textContent = "+5 pts";

      li.appendChild(main);
      li.appendChild(right);

      habitListEl.appendChild(li);
    });
}

function renderPointsAndLevel() {
  pointsValueEl.textContent = state.points;
  const info = getLevelInfo(state.points);
  levelValueEl.textContent = info.label;
  levelProgressEl.style.width = `${info.progressPercent}%`;
  levelCaptionEl.textContent = info.caption;
}

function renderHistoryOptions() {
  historyHabitSelectEl.innerHTML = "";
  state.habits
    .slice()
    .sort((a, b) => a.order - b.order)
    .forEach((habit) => {
      const option = document.createElement("option");
      option.value = habit.id;
      option.textContent = habit.name;
      historyHabitSelectEl.appendChild(option);
    });
}

function renderHistory() {
  const selectedHabitId = historyHabitSelectEl.value || state.habits[0]?.id;
  if (!selectedHabitId) return;

  historyListEl.innerHTML = "";

  const keys = Object.keys(state.completions).sort().reverse();

  keys.forEach((dateKey) => {
    const done = isHabitDoneOnDate(selectedHabitId, dateKey);
    const li = document.createElement("li");
    li.className = "history-item";

    const dateEl = document.createElement("span");
    dateEl.className = "history-date";
    dateEl.textContent = formatDateLabel(dateKey);

    const statusEl = document.createElement("span");
    statusEl.className = "history-status";
    statusEl.textContent = done ? "Done" : "Missed";
    statusEl.classList.add(done ? "done" : "missed");

    li.appendChild(dateEl);
    li.appendChild(statusEl);

    historyListEl.appendChild(li);
  });
}

function buildCalendarRange(daysBack = 28) {
  const today = new Date(getTodayKey());
  const days = [];
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ key, date: d });
  }
  return days;
}

function getDateCompletionQuality(dateKey) {
  const day = state.completions[dateKey];
  if (!day) return "";

  const totalHabits = state.habits.length;
  if (!totalHabits) return "";

  let doneCount = 0;
  state.habits.forEach((habit) => {
    if (day[habit.id]) doneCount += 1;
  });

  if (doneCount === 0) return "missed";
  if (doneCount === totalHabits) return "done";
  return "partial";
}

function renderCalendar() {
  calendarGridEl.innerHTML = "";

  const days = buildCalendarRange(28);

  // Weekday labels row
  const weekdayFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
  });

  days.forEach((cell) => {
    const div = document.createElement("div");
    div.className = "calendar-day";

    const weekday = weekdayFormatter.format(cell.date)[0];
    const dayNum = cell.date.getDate();

    const quality = getDateCompletionQuality(cell.key);
    if (quality) {
      div.classList.add(quality);
    }

    const label = document.createElement("div");
    label.className = "calendar-day-label";
    label.textContent = dayNum;

    const tiny = document.createElement("div");
    tiny.style.fontSize = "0.6rem";
    tiny.style.color = "var(--color-text-soft)";
    tiny.textContent = weekday;

    div.appendChild(label);
    div.appendChild(tiny);

    calendarGridEl.appendChild(div);
  });
}

// SECTION: Event handlers
addHabitForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = habitNameInput.value.trim();
  if (!name) return;

  const id = `habit_${Date.now()}`;
  const order = state.habits.length
    ? Math.max(...state.habits.map((h) => h.order || 0)) + 1
    : 0;

  state.habits.push({
    id,
    name,
    createdAt: getTodayKey(),
    order,
  });

  habitNameInput.value = "";
  saveState(state);

  renderHabitList();
  renderHistoryOptions();
  renderHistory();
});

historyHabitSelectEl.addEventListener("change", () => {
  renderHistory();
});

clearTodayButton.addEventListener("click", () => {
  const todayKey = getTodayKey();
  if (!state.completions[todayKey]) return;

  const day = state.completions[todayKey];
  Object.keys(day).forEach((habitId) => {
    if (day[habitId]) {
      // removing a done state removes points
      state.points = Math.max(0, state.points - 5);
    }
  });

  state.completions[todayKey] = {};
  saveState(state);

  renderPointsAndLevel();
  renderHabitList();
  renderHistory();
  renderCalendar();
});

// SECTION: Initial render
renderTodayLabel();
renderHabitList();
renderPointsAndLevel();
renderHistoryOptions();
renderHistory();
renderCalendar();
