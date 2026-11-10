
const $ = (id) => document.getElementById(id);

const defaults = {
  rpm: 2350,
  cht: 188,
  egt: 620,
  pressure: 38,
  temp: 72
};

const ranges = [
  { key: "rpm", name: "RPM", min: 2000, max: 2600, unit: "rpm", weight: 0.18, precision: 0 },
  { key: "cht", name: "CHT", min: 100, max: 200, unit: "°C", weight: 0.24, precision: 0 },
  { key: "egt", name: "EGT", min: 500, max: 700, unit: "°C", weight: 0.24, precision: 0 },
  { key: "pressure", name: "Pressure", min: 25, max: 45, unit: "psi", weight: 0.20, precision: 1 },
  { key: "temp", name: "Temperature", min: 60, max: 90, unit: "°C", weight: 0.14, precision: 0 }
];

let values = { ...defaults };
let running = true;
let tick = 0;

const clamp = (v, min, max) =>
  Math.max(min, Math.min(max, v));

const fmt = (v, p = 0) =>
  Number(v).toFixed(p);

function applyMode() {
  const mode = $("modeSelect").value;
  values = { ...defaults };

  if (mode === "overheat") {
    values.cht = 214;
    values.egt = 735;
    values.temp = 96;
  }

  if (mode === "vibration") {
    values.rpm = 2680;
    values.egt = 715;
  }

  if (mode === "lowpressure") {
    values.pressure = 18;
  }

  if (mode === "mixed") {
    values.cht = 216;
    values.egt = 730;
    values.pressure = 19;
    values.temp = 95;
    values.rpm = 2680;
  }

  if (mode === "mission") {
    values.rpm = 2200;
    values.cht = 166;
    values.egt = 580;
    values.pressure = 40;
    values.temp = 69;
  }

  render();
}

function scoreFor(p, v) {
  if (v >= p.min && v <= p.max) {
    const mid = (p.min + p.max) / 2;
    const half = (p.max - p.min) / 2;

    return clamp(
      100 - Math.abs(v - mid) / half * 18,
      82,
      100
    );
  }

  const distance =
    v < p.min ? p.min - v : v - p.max;

  return clamp(
    75 - distance / Math.max(1, p.max - p.min) * 100,
    0,
    74
  );
}

function statusFor(p, v) {
  const margin = (p.max - p.min) * 0.05;

  if (v < p.min || v > p.max) {
    const severity =
      (v < p.min ? p.min - v : v - p.max) /
      (p.max - p.min);

    return severity > 0.12
      ? {
          label: "Critical",
          cls: "critical",
          reason: "Outside safe range"
        }
      : {
          label: "Warning",
          cls: "warning",
          reason: "Outside reference range"
        };
  }

  if (
    v < p.min + margin ||
    v > p.max - margin
  ) {
    return {
      label: "Warning",
      cls: "warning",
      reason: "Near range limit"
    };
  }

  return {
    label: "Normal",
    cls: "normal",
    reason: "Within range"
  };
}

function render() {
  const ids = {
    rpm: "rpmValue",
    cht: "chtValue",
    egt: "egtValue",
    pressure: "pressureValue",
    temp: "tempValue"
  };

  Object.entries(ids).forEach(([key, id]) => {
    $(id).textContent = fmt(
      values[key],
      key === "pressure" ? 1 : 0
    );
  });

  const tbody = $("statusRows");
  tbody.innerHTML = "";

  let weighted = 0;
  let critical = 0;
  let warnings = 0;

  ranges.forEach((p) => {
    const v = values[p.key];
    const s = statusFor(p, v);

    weighted += scoreFor(p, v) * p.weight;

    if (s.cls === "critical") critical++;
    if (s.cls === "warning") warnings++;

    const tr = document.createElement("tr");

    [
      p.name,
      `${fmt(v, p.precision)} ${p.unit}`,
      `${p.min} - ${p.max}`,
      null,
      s.reason
    ].forEach((value, i) => {
      const td = document.createElement("td");

      if (i === 3) {
        const pill = document.createElement("span");
        pill.className = `status-pill ${s.cls}`;
        pill.textContent = s.label;
        td.appendChild(pill);
      } else {
        td.textContent = value;
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  // Health Index calculation
  const hi = Math.round(weighted);

  $("healthValue").textContent = `${hi} / 100`;
  $("healthMeter").style.width = `${hi}%`;

  $("healthMeter").style.background =
    hi >= 80 ? "#14a765" :
    hi >= 60 ? "#d99a14" :
    "#d33a3a";

  $("healthBadge").textContent =
    hi >= 85 ? "Good" :
    hi >= 65 ? "Fair" : "Poor";

  $("healthBadge").style.background =
    hi >= 85 ? "#c9efd1" :
    hi >= 65 ? "#fff0c7" : "#ffe0df";

  $("healthBadge").style.color =
    hi >= 85 ? "#078143" :
    hi >= 65 ? "#976100" : "#bd2828";

  // Engine power calculation
  const rpm = values.rpm;
  const torque = clamp(
    Number($("torqueInput").value) || 120,
    0,
    500
  );

  const power = (2 * Math.PI * rpm * torque) / 60000;

  $("powerRpm").textContent = `${fmt(rpm)} rpm`;
  $("powerValue").textContent = `${power.toFixed(2)} kW`;

  // Overall engine status
  const card = $("overallCard");
  card.className = "overall-card";

  if (critical > 0) {
    card.classList.add("critical");
    $("overallIcon").textContent = "!";
    $("overallStatus").textContent = "CRITICAL";

    $("overallReason").textContent =
      `${critical} parameter${critical > 1 ? "s are" : " is"} outside the reference range.`;

    $("overallHint").textContent =
      "Investigate the simulated fault before continuing.";

  } else if (warnings > 0) {
    card.classList.add("warning");
    $("overallIcon").textContent = "!";
    $("overallStatus").textContent = "WARNING";

    $("overallReason").textContent =
      `${warnings} parameter${warnings > 1 ? "s are" : " is"} near or outside the reference range.`;

    $("overallHint").textContent =
      "Monitor the readings and inspect the affected parameter.";

  } else {
    $("overallIcon").textContent = "✓";
    $("overallStatus").textContent = "NORMAL";

    $("overallReason").textContent =
      "All parameters are within the reference range.";

    $("overallHint").textContent =
      "Engine is operating as expected.";
  }

  $("twinMode").textContent =
    $("modeSelect").selectedOptions[0].text.toUpperCase();
}

function updateClock() {
  $("clock").textContent =
    new Date().toLocaleTimeString("en-GB");
}

function advance() {
  if (!running) return;

  tick++;

  const mode = $("modeSelect").value;

  if (mode === "normal") {
    values.rpm = clamp(
      defaults.rpm +
        Math.round(
          Math.sin(tick / 4) * 35 +
          (Math.random() - 0.5) * 10
        ),
      2000,
      2600
    );

    values.cht = clamp(
      defaults.cht + Math.round(Math.sin(tick / 13) * 3),
      100,
      200
    );

    values.egt = clamp(
      defaults.egt + Math.round(Math.sin(tick / 8) * 7),
      500,
      700
    );

    values.pressure = clamp(
      defaults.pressure + Math.sin(tick / 9) * 1.4,
      25,
      45
    );

    values.temp = clamp(
      defaults.temp + Math.round(Math.sin(tick / 10) * 2),
      60,
      90
    );

  } else if (mode === "mission") {
    const phase = (tick % 60) / 60;
    const wave = Math.sin(phase * Math.PI);

    values.rpm = 2200 + Math.round(280 * wave);
    values.cht = 166 + Math.round(22 * wave);
    values.egt = 580 + Math.round(70 * wave);
    values.pressure = 40 - 3 * wave;
    values.temp = 69 + Math.round(8 * wave);

  } else {
    if (mode === "overheat") {
      values.cht = 214 + Math.round(Math.sin(tick / 3) * 3);
      values.egt = 735 + Math.round(Math.sin(tick / 4) * 8);
      values.temp = 96 + Math.round(Math.sin(tick / 5) * 2);
    }

    if (mode === "vibration") {
      values.rpm = 2680 + Math.round(Math.sin(tick * 2) * 22);
      values.egt = 715 + Math.round(Math.sin(tick / 3) * 8);
    }

    if (mode === "lowpressure") {
      values.pressure = 18 + Math.sin(tick / 3) * 1.2;
    }

    if (mode === "mixed") {
      values.cht = 216 + Math.round(Math.sin(tick / 3) * 3);
      values.egt = 730 + Math.round(Math.sin(tick / 4) * 7);
      values.pressure = 19 + Math.sin(tick / 3);
      values.temp = 95 + Math.round(Math.sin(tick / 5) * 2);
      values.rpm = 2680 + Math.round(Math.sin(tick * 2) * 20);
    }
  }

  render();
}

// Mode selector
$("modeSelect").addEventListener("change", () => {
  tick = 0;
  applyMode();
});

// Torque control
$("torqueInput").addEventListener("input", render);

// Pause / resume
$("toggleBtn").addEventListener("click", () => {
  running = !running;

  $("toggleBtn").textContent =
    running ? "Ⅱ Pause simulation" : "▶ Resume simulation";

  $("liveLabel").textContent =
    running ? "Live Data" : "Paused";

  $("twinMode").textContent =
    running ? "SIMULATION ACTIVE" : "SIMULATION PAUSED";
});

// Reset dashboard
$("resetBtn").addEventListener("click", () => {
  tick = 0;
  $("modeSelect").value = "normal";
  $("torqueInput").value = 120;
  running = true;

  $("toggleBtn").textContent = "Ⅱ Pause simulation";
  $("liveLabel").textContent = "Live Data";

  applyMode();
});

// Start dashboard
applyMode();
updateClock();

setInterval(updateClock, 1000);
setInterval(advance, 1000);
