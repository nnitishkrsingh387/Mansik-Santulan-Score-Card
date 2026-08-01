// ===== Config =====
const API_BASE_URL = "http://127.0.0.1:8000";
// The model's score is treated as roughly 0–10 for the gauge visual.
// If your model's actual scale differs, adjust GAUGE_MIN / GAUGE_MAX below.
const GAUGE_MIN = 0;
const GAUGE_MAX = 10;
const GAUGE_ARC_LENGTH = 283; // matches the stroke-dasharray on the gauge path

// ===== Element refs =====
const form = document.getElementById("predict-form");
const submitBtn = document.getElementById("submit-btn");
const formError = document.getElementById("form-error");

const countrySelect = document.getElementById("Country");
const countryOtherInput = document.getElementById("CountryOther");

const usageRange = document.getElementById("Avg_Daily_Usage_Hours");
const usageOut = document.getElementById("Avg_Daily_Usage_Hours-out");

const stressPicker = document.getElementById("Stress_Level");
let selectedStress = null;

const resultEmpty = document.getElementById("result-empty");
const resultLoading = document.getElementById("result-loading");
const resultFilled = document.getElementById("result-filled");
const resultErrorBox = document.getElementById("result-error");
const resultErrorMsg = document.getElementById("result-error-msg");

const gaugeFill = document.getElementById("gauge-fill");
const gaugeNeedle = document.getElementById("gauge-needle");
const gaugeScoreEl = document.getElementById("gauge-score");
const resultTag = document.getElementById("result-tag");
const resultNote = document.getElementById("result-note");

const resetBtn = document.getElementById("reset-btn");
const errorResetBtn = document.getElementById("error-reset-btn");

// ===== Small interactions =====

// Show/hide free-text country field
countrySelect.addEventListener("change", () => {
  const isOther = countrySelect.value === "__other__";
  countryOtherInput.classList.toggle("hidden-field", !isOther);
  countryOtherInput.required = isOther;
  if (isOther) countryOtherInput.focus();
});

// Live-update the usage hours readout
usageRange.addEventListener("input", () => {
  usageOut.textContent = Number(usageRange.value).toFixed(1);
});

// Stress level picker (acts like a required radio group)
stressPicker.addEventListener("click", (e) => {
  const btn = e.target.closest(".stress-opt");
  if (!btn) return;
  stressPicker.querySelectorAll(".stress-opt").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  selectedStress = btn.dataset.value;
  clearFieldError(stressPicker);
});

// Reset flows
resetBtn.addEventListener("click", showEmptyState);
errorResetBtn.addEventListener("click", showEmptyState);

function showEmptyState() {
  toggle(resultEmpty, true);
  toggle(resultLoading, false);
  toggle(resultFilled, false);
  toggle(resultErrorBox, false);
}

function toggle(el, show) {
  el.classList.toggle("hidden-field", !show);
}

// ===== Validation helpers =====
function markFieldError(fieldEl) {
  const wrapper = fieldEl.closest(".field") || fieldEl;
  wrapper.classList.add("invalid");
}
function clearFieldError(fieldEl) {
  const wrapper = fieldEl.closest(".field") || fieldEl;
  wrapper.classList.remove("invalid");
}
function clearAllFieldErrors() {
  document.querySelectorAll(".field.invalid").forEach((f) => f.classList.remove("invalid"));
}

function showFormError(message) {
  formError.textContent = message;
  toggle(formError, true);
}
function hideFormError() {
  toggle(formError, false);
}

// ===== Build payload matching the StudentData Pydantic model =====
function collectPayload() {
  const errors = [];
  clearAllFieldErrors();

  const age = Number(form.Age.value);
  if (!form.Age.value || age < 10 || age > 100) {
    errors.push("Age must be between 10 and 100.");
    markFieldError(form.Age);
  }

  const gender = form.Gender.value;
  if (!gender) { errors.push("Please select a gender."); markFieldError(form.Gender); }

  let country = countrySelect.value;
  if (!country) { errors.push("Please select a country."); markFieldError(countrySelect); }
  if (country === "__other__") {
    country = countryOtherInput.value.trim();
    if (!country) { errors.push("Please type your country."); markFieldError(countryOtherInput); }
  }

  const academicLevel = form.Academic_Level.value;
  if (!academicLevel) { errors.push("Please select an academic level."); markFieldError(form.Academic_Level); }

  const platform = form.Most_Used_Platform.value;
  if (!platform) { errors.push("Please select your most used platform."); markFieldError(form.Most_Used_Platform); }

  const purpose = form.Purpose_Of_Use.value;
  if (!purpose) { errors.push("Please select your main purpose of use."); markFieldError(form.Purpose_Of_Use); }

  const usageHours = Number(usageRange.value);

  const dailyUnlocks = Number(form.Daily_Unlocks.value);
  if (form.Daily_Unlocks.value === "" || dailyUnlocks < 0) {
    errors.push("Daily unlocks can't be negative.");
    markFieldError(form.Daily_Unlocks);
  }

  const studyHours = Number(form.Study_Hours.value);
  if (form.Study_Hours.value === "" || studyHours < 0 || studyHours > 24) {
    errors.push("Study hours must be between 0 and 24.");
    markFieldError(form.Study_Hours);
  }

  const activityHours = Number(form.Physical_Activity_Hours.value);
  if (form.Physical_Activity_Hours.value === "" || activityHours < 0 || activityHours > 24) {
    errors.push("Physical activity hours must be between 0 and 24.");
    markFieldError(form.Physical_Activity_Hours);
  }

  const sleepHours = Number(form.Sleep_Hours_Per_Night.value);
  if (form.Sleep_Hours_Per_Night.value === "" || sleepHours < 0 || sleepHours > 24) {
    errors.push("Sleep hours must be between 0 and 24.");
    markFieldError(form.Sleep_Hours_Per_Night);
  }

  if (!selectedStress) {
    errors.push("Please pick a stress level.");
    markFieldError(stressPicker);
  }

  if (errors.length) return { errors };

  return {
    payload: {
      Age: age,
      Gender: gender,
      Country: country,
      Academic_Level: academicLevel,
      Most_Used_Platform: platform,
      Purpose_Of_Use: purpose,
      Avg_Daily_Usage_Hours: usageHours,
      Daily_Unlocks: dailyUnlocks,
      Study_Hours: studyHours,
      Physical_Activity_Hours: activityHours,
      Sleep_Hours_Per_Night: sleepHours,
      Stress_Level: selectedStress,
    },
  };
}

// ===== Submit =====
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideFormError();

  const { errors, payload } = collectPayload();
  if (errors) {
    showFormError(errors[0] + (errors.length > 1 ? ` (+${errors.length - 1} more)` : ""));
    return;
  }

  setLoading(true);
  toggle(resultEmpty, false);
  toggle(resultErrorBox, false);
  toggle(resultFilled, false);
  toggle(resultLoading, true);

  try {
    const response = await fetch(`${API_BASE_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let detail = `Request failed with status ${response.status}.`;
      try {
        const errBody = await response.json();
        if (errBody?.detail) {
          detail = Array.isArray(errBody.detail)
            ? errBody.detail.map((d) => d.msg).join(" ")
            : String(errBody.detail);
        }
      } catch (_) { /* body wasn't JSON, keep default message */ }
      throw new Error(detail);
    }

    const data = await response.json();
    renderResult(data.predicted_mental_health_score);
  } catch (err) {
    const isNetworkError = err instanceof TypeError;
    resultErrorMsg.textContent = isNetworkError
      ? "Can't reach the API. Make sure the FastAPI server is running on " + API_BASE_URL + "."
      : err.message || "Something went wrong while scoring your answers.";
    toggle(resultLoading, false);
    toggle(resultErrorBox, true);
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.classList.toggle("is-loading", isLoading);
}

// ===== Render result =====
function renderResult(score) {
  toggle(resultLoading, false);
  toggle(resultFilled, true);

  const clamped = Math.max(GAUGE_MIN, Math.min(GAUGE_MAX, score));
  const fraction = (clamped - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN);

  // Animate the arc fill
  gaugeFill.style.strokeDasharray = `${GAUGE_ARC_LENGTH}`;
  gaugeFill.style.strokeDashoffset = `${GAUGE_ARC_LENGTH}`;
  // Animate the needle from -90deg (left) to +90deg (right) across the arc
  const angle = -90 + fraction * 180;
  gaugeNeedle.setAttribute("transform", "rotate(-90 110 110)");

  requestAnimationFrame(() => {
    gaugeFill.style.strokeDashoffset = `${GAUGE_ARC_LENGTH * (1 - fraction)}`;
    gaugeNeedle.setAttribute("transform", `rotate(${angle} 110 110)`);
  });

  animateNumber(gaugeScoreEl, score);

  const { label, note } = interpretScore(clamped, GAUGE_MAX);
  resultTag.textContent = label;
  resultNote.textContent = note;
}

function animateNumber(el, target) {
  const duration = 900;
  const start = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = (target * eased).toFixed(2);
    if (t < 1) requestAnimationFrame(frame);
    else el.textContent = Number(target).toFixed(2);
  }
  requestAnimationFrame(frame);
}

function interpretScore(score, max) {
  const pct = score / max;
  if (pct >= 0.7) {
    return { label: "Looking steady", note: "Your habits line up with a healthier balance right now." };
  }
  if (pct >= 0.4) {
    return { label: "Somewhere in the middle", note: "A few small shifts in sleep, screens, or stress could help." };
  }
  return { label: "Worth paying attention to", note: "Your answers suggest real strain — consider talking to someone you trust." };
}
