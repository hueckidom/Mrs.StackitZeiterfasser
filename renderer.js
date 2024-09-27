const { ipcRenderer } = require("electron");

const STATUS_GEHEN = "Gehen";
const STATUS_KOMMEN = "Kommen";
const STATUS_BEGIN_PAUSE = "Beginn Pause";
const STATUS_ENDE_PAUSE = "Ende Pause";

let statuses;
let kommenTime;
let kommenPauseTime;

let kommenInterval;
let pauseKommenInterval;

let totalKommen = 0;
let totalPause = 0;

let times = [];

const startTimer = (elementId, startTime) => {
  const updateTimer = () => {
    const now = new Date().getTime();
    const elapsed = now - startTime;
    const hours = Math.floor(elapsed / (1000 * 60 * 60));
    const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);
    document.getElementById(
      elementId
    ).innerText = `${hours}h ${minutes}m ${seconds}s`;
  };
  return setInterval(updateTimer, 1000);
};

const endTimer = (elementId) => {
  document.getElementById(elementId).innerText = "";
};

const redrawView = () => {
  const elements = ["gehen", "kommen", "pause-gehen", "pause-kommen"];
  elements.forEach(
    (id) => (document.getElementById(id).style.display = "none")
  );

  if (statuses.includes(STATUS_GEHEN)) {
    document.getElementById("gehen").style.display = "block";
  }
  if (statuses.includes(STATUS_KOMMEN)) {
    document.getElementById("kommen").style.display = "block";
  }
  if (statuses.includes(STATUS_BEGIN_PAUSE)) {
    document.getElementById("pause-kommen").style.display = "block";
  }
  if (statuses.includes(STATUS_ENDE_PAUSE)) {
    document.getElementById("pause-gehen").style.display = "block";
  }
};

const saveStatus = (newStatus) => {
  statuses = newStatus;
  localStorage.setItem("currentStatus", JSON.stringify(statuses));
};

const saveTime = (key, time) => {
  localStorage.setItem(key, time);
};

const getTime = (key) => {
  return localStorage.getItem(key);
};

const clearTime = (key) => {
  localStorage.removeItem(key);
};

const initStatus = () => {
  statuses = localStorage.getItem("currentStatus")
    ? JSON.parse(localStorage.getItem("currentStatus"))
    : [];
};

const todayFormatted = () => {
  const now = new Date();
  const currentTime = now.toLocaleTimeString("en-US", { hour12: false });
  return currentTime;
};

const initView = async () => {
  showStatusLoading();
  try {
    initStatus();

    if (!statuses.length) {
      statuses = await ipcRenderer.invoke("fetch-stamp-status", {
        ...moreData(),
      });
      saveStatus(statuses);
    }

    const savedKommenTime = getTime("kommenTime");
    if (savedKommenTime) {
      kommenTime = parseInt(savedKommenTime, 10);
      kommenInterval = startTimer("kommenTimeDisplay", kommenTime);
    }

    const savedKommenPauseTime = getTime("kommenPauseTime");
    if (savedKommenPauseTime) {
      kommenPauseTime = parseInt(savedKommenPauseTime, 10);
      pauseKommenInterval = startTimer(
        "pauseKommenTimeDisplay",
        kommenPauseTime
      );
    }

    redrawView();
  } catch (error) {
    console.error("Error fetching stamp status:", error);
  } finally {
    hideStatusLoading();
  }
};

const moreData = () => ({});

const showLoading = () => {
  document.getElementById("loading").style.display = "flex";
};

const hideLoading = () => {
  document.getElementById("loading").style.display = "none";
};

const showStatusLoading = () => {
  document.getElementById("loadingStatus").style.display = "flex";
  document.getElementById("statusAbholen").style.display = "none";
};

const hideStatusLoading = () => {
  document.getElementById("loadingStatus").style.display = "none";
  document.getElementById("statusAbholen").style.display = "block";
};

const stopTimes = () => {
  if (pauseKommenInterval) {
    clearInterval(pauseKommenInterval);
  }

  if (kommenInterval) {
    clearInterval(kommenInterval);
  }

  clearTime("kommenPauseTime");
  clearTime("kommenTime");

  endTimer("kommenTimeDisplay");
  endTimer("pauseKommenTimeDisplay");
};

document.getElementById("close-dialog").addEventListener("click", () => {
  document.getElementById("settings-dialog").style.display = "none";
});

document.getElementById("settings-btn").addEventListener("click", () => {
  document.getElementById("settings-dialog").style.display = "flex";
});

document.getElementById("statusAbholen").addEventListener("click", async () => {
  showStatusLoading();
  try {
    stopTimes();

    fetchTimes();

    statuses = await ipcRenderer.invoke("fetch-stamp-status", {
      ...moreData(),
    });
    saveStatus(statuses);
    redrawView();

    document.getElementById("close-dialog").style.display = "block";
  } catch (error) {
    console.error("Error fetching stamp status:", error);
  } finally {
    hideStatusLoading();
  }
});

document.getElementById("gehen").addEventListener("click", async () => {
  showLoading();
  await ipcRenderer.invoke("gehen-action", {
    ...moreData(),
  });

  statuses = [];
  statuses.push(STATUS_KOMMEN);
  saveStatus(statuses);

  if (kommenInterval) {
    clearInterval(kommenInterval);
  }

  endTimer("kommenTimeDisplay");
  clearTime("kommenTime");

  times.push({
    status: STATUS_GEHEN,
    time: todayFormatted(),
  });
  drawTimesTable(times);

  redrawView();
  hideLoading();
});

document.getElementById("pause-gehen").addEventListener("click", async () => {
  showLoading();
  await ipcRenderer.invoke("pause-gehen-action", {
    ...moreData(),
  });

  statuses = [];
  statuses.push(STATUS_GEHEN);
  statuses.push(STATUS_BEGIN_PAUSE);

  saveStatus(statuses);

  if (pauseKommenInterval) {
    clearInterval(pauseKommenInterval);
  }

  endTimer("pauseKommenTimeDisplay");
  clearTime("kommenPauseTime");

  times.push({
    status: STATUS_ENDE_PAUSE,
    time: todayFormatted(),
  });
  drawTimesTable(times);

  redrawView();
  hideLoading();
});

document.getElementById("kommen").addEventListener("click", async () => {
  showLoading();
  await ipcRenderer.invoke("kommen-action", {
    ...moreData(),
  });

  statuses = [];
  statuses.push(STATUS_GEHEN);
  statuses.push(STATUS_BEGIN_PAUSE);
  saveStatus(statuses);

  kommenTime = new Date().getTime();
  saveTime("kommenTime", kommenTime);
  if (kommenInterval) {
    clearInterval(kommenInterval);
  }
  kommenInterval = startTimer("kommenTimeDisplay", kommenTime);

  times.push({
    status: STATUS_KOMMEN,
    time: todayFormatted(),
  });
  drawTimesTable(times);

  redrawView();
  hideLoading();
});

document.getElementById("pause-kommen").addEventListener("click", async () => {
  showLoading();
  await ipcRenderer.invoke("pause-kommen-action", {
    ...moreData(),
  });

  statuses = [];
  statuses.push(STATUS_ENDE_PAUSE);
  saveStatus(statuses);

  kommenPauseTime = new Date().getTime();
  saveTime("kommenPauseTime", kommenPauseTime);
  if (pauseKommenInterval) {
    clearInterval(pauseKommenInterval);
  }
  pauseKommenInterval = startTimer("pauseKommenTimeDisplay", kommenPauseTime);

  times.push({
    status: STATUS_BEGIN_PAUSE,
    time: todayFormatted(),
  });
  drawTimesTable(times);

  redrawView();
  hideLoading();
});

document.addEventListener("DOMContentLoaded", initView);

const fetchTimes = async () => {
  times = await ipcRenderer.invoke("fetch-times", {
    ...moreData(),
  });
  // example times = [ {status:"Kommen", time:"07:39:29"},{status:"Gehen", time:"09:39:29"},{status:"Kommen", time:"10:39:29"}   ]
  if (times.length > 0) {
    // latest entry

    const kommenGehen = times.filter(
      (o) => o.status === STATUS_KOMMEN || o.status === STATUS_GEHEN
    );

    if (kommenGehen[kommenGehen.length - 1]?.status === STATUS_KOMMEN) {
      const timeParts = kommenGehen[kommenGehen.length - 1].time.split(":");
      const kommenTime = new Date().setHours(
        timeParts[0],
        timeParts[1],
        timeParts[2]
      );

      if (kommenInterval) {
        clearInterval(kommenInterval);
      }
      kommenInterval = startTimer("kommenTimeDisplay", kommenTime);
      saveTime("kommenTime", kommenTime);
    }

    const pauseGehen = times.filter(
      (o) => o.status === STATUS_BEGIN_PAUSE || o.status === STATUS_ENDE_PAUSE
    );

    if (pauseGehen[pauseGehen.length - 1]?.status === STATUS_BEGIN_PAUSE) {
      const timePParts = pauseGehen[pauseGehen.length - 1].time.split(":");
      const pauseTime = new Date().setHours(
        timePParts[0],
        timePParts[1],
        timePParts[2]
      );

      if (pauseKommenInterval) {
        clearInterval(pauseKommenInterval);
      }
      pauseKommenInterval = startTimer("pauseKommenTimeDisplay", pauseTime);
      saveTime("pauseTime", pauseTime);
    }

    // === Calc totals
    totalKommen = 0;
    totalPause = 0;
    let lastKommenTime = null;

    times.forEach(({ status, time }) => {
      const timeParts = time.split(":");
      const timeInSeconds =
        parseInt(timeParts[0]) * 3600 +
        parseInt(timeParts[1]) * 60 +
        parseInt(timeParts[2]);

      if (status === STATUS_KOMMEN) {
        lastKommenTime = timeInSeconds;
      } else if (status === STATUS_GEHEN && lastKommenTime !== null) {
        totalKommen += timeInSeconds - lastKommenTime;
        lastKommenTime = null;
      } else if (status === STATUS_ENDE_PAUSE) {
        totalPause += timeInSeconds;
      }
    });

    document.getElementById("total-kommen").innerText =
      "Toal Anwesend : " + formatTime(totalKommen);
    document.getElementById("total-pause").innerText =
      "Total Pause : " + formatTime(totalPause);

    drawTimesTable(times);
  }
};

const drawTimesTable = (times) => {
  const container = document.getElementById("timesGrid");
  container.innerHTML = "";

  const table = document.createElement("table");
  table.className = "times-table";

  const header = table.createTHead();
  const headerRow = header.insertRow();
  const statusHeader = headerRow.insertCell();
  const timeHeader = headerRow.insertCell();
  statusHeader.innerText = "Type";
  timeHeader.innerText = "Zeit";

  // Create table body
  const tbody = table.createTBody();
  times.forEach(({ status, time }) => {
    const row = tbody.insertRow();
    const statusCell = row.insertCell();
    const timeCell = row.insertCell();
    statusCell.innerText = status;
    timeCell.innerText = time;
  });

  // Append the table to the container
  container.appendChild(table);
};

const formatTime = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
};
