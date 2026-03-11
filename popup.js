const statusDot = document.getElementById("status-indicator");

const bars = {
  1: {
    bar: document.getElementById("progress1-bar"),
    text: document.getElementById("progress1-text"),
  },
  2: {
    bar: document.getElementById("progress2-bar"),
    text: document.getElementById("progress2-text"),
  },
  3: {
    bar: document.getElementById("progress3-bar"),
    text: document.getElementById("progress3-text"),
  },
};

const d1 = {
  input: document.getElementById("delay1"),
  display: document.getElementById("delay1-val"),
};

const d2 = {
  input: document.getElementById("delay2"),
  display: document.getElementById("delay2-val"),
};

const d3 = {
  input: document.getElementById("delay3"),
  display: document.getElementById("delay3-val"),
};

function updateStatus(state) {
  if (statusDot) statusDot.className = "status-dot " + state;
}

function resetBars() {
  Object.values(bars).forEach((obj) => {
    obj.bar.style.width = "0%";
    obj.text.textContent = "0%";
  });
}

async function getPesquisas() {
  const resp = await fetch("pesquisas.json");
  return await resp.json();
}

function bindAction(id, action, status = null) {
  const btn = document.getElementById(id);

  if (!btn) return;

  btn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action });

    if (status) updateStatus(status);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  [d1, d2, d3].forEach((d) => {
    if (!d.input) return;

    d.display.textContent = d.input.value;

    d.input.addEventListener("input", () => {
      d.display.textContent = d.input.value;

      chrome.runtime.sendMessage({
        action: "UPDATE_DELAY",
        delay: d.input.value * 1000,
      });
    });
  });

  chrome.runtime.sendMessage({ action: "GET_PROGRESS" }, (state) => {
    if (!state || !state.total) return;

    const percent = Math.round((state.feitas / state.total) * 100);

    const b = bars[state.lvl];

    if (b) {
      b.bar.style.width = percent + "%";
      b.text.textContent = percent + "%";
    }
  });
});

/* START */

async function startLvl(lvl, config) {
  config.pesquisas = await getPesquisas();

  resetBars();

  chrome.runtime.sendMessage({
    action: `START_LVL${lvl}`,
    config,
  });

  updateStatus("active");
}

document.getElementById("start1").onclick = () => {
  startLvl(1, {
    web: document.getElementById("web1").value,
    mobile: document.getElementById("mobile1").value,
    delayMs: d1.input.value * 1000,
  });
};

document.getElementById("start2").onclick = () => {
  startLvl(2, {
    web: document.getElementById("web2").value,
    mobile: document.getElementById("mobile2").value,
    delayMs: d2.input.value * 1000,
  });
};

document.getElementById("start3").onclick = () => {
  startLvl(3, {
    web: 0,
    mobile: document.getElementById("mobile3").value,
    delayMs: d3.input.value * 1000,
  });
};

/* ACTION BUTTONS */

bindAction("pause", "PAUSE", "paused");
bindAction("pause2", "PAUSE", "paused");
bindAction("pause3", "PAUSE", "paused");

bindAction("resume", "RESUME", "active");
bindAction("resume2", "RESUME", "active");
bindAction("resume3", "RESUME", "active");

bindAction("cancel", "CANCEL", "stopped");
bindAction("cancel2", "CANCEL", "stopped");
bindAction("cancel3", "CANCEL", "stopped");

/* ESCUTAR PROGRESSO */

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "UPDATE_PROGRESS") {
    const percent = msg.total ? Math.round((msg.feitas / msg.total) * 100) : 0;

    const b = bars[msg.lvl];

    if (!b) return;

    b.bar.style.width = percent + "%";
    b.text.textContent = percent + "%";
  }

  if (msg.action === "FINISHED") {
    const b = bars[msg.lvl];

    if (!b) return;

    b.bar.style.width = "100%";
    b.text.textContent = "Concluído";

    updateStatus("ready");
  }
});
