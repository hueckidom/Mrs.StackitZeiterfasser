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

const displayForceAuthView = () => {
  document.getElementById("statusAbholen").style.display = "none";
  document.getElementById("settings-dialog").style.display = "flex";
  document.getElementById("close-dialog").style.display = "none";
};

const initView = async () => {
  loadAuthData();

  if (!getUserName() && !getPassword()) {
    displayForceAuthView();
    return;
  }

  showStatusLoading();
  try {
    initStatus();

    if (!statuses.length) {
      statuses = await ipcRenderer.invoke("fetch-stamp-status", {
        ...credentials(),
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

const getUserName = () => {
  return document.getElementById("username").value;
};

const getPassword = () => {
  return document.getElementById("password").value;
};

const credentials = () => ({
  username: getUserName(),
  password: getPassword(),
});

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

document.getElementById("close-dialog").addEventListener("click", () => {
  document.getElementById("settings-dialog").style.display = "none";
});

document.getElementById("settings-btn").addEventListener("click", () => {
  document.getElementById("settings-dialog").style.display = "flex";
});

document.getElementById("statusAbholen").addEventListener("click", async () => {
  showStatusLoading();
  try {
    statuses = await ipcRenderer.invoke("fetch-stamp-status", {
      ...credentials(),
    });
    saveStatus(statuses);
    redrawView();

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
    ...credentials(),
  });

  statuses = [];
  statuses.push(STATUS_KOMMEN);
  saveStatus(statuses);

  if (kommenInterval) {
    clearInterval(kommenInterval);
  }

  endTimer("kommenTimeDisplay");
  clearTime("kommenTime");

  redrawView();
  hideLoading();
});

document.getElementById("pause-gehen").addEventListener("click", async () => {
  showLoading();
  await ipcRenderer.invoke("pause-gehen-action", {
    ...credentials(),
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

  redrawView();
  hideLoading();
});

document.getElementById("kommen").addEventListener("click", async () => {
  showLoading();
  await ipcRenderer.invoke("kommen-action", {
    ...credentials(),
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

  redrawView();
  hideLoading();
});

document.getElementById("pause-kommen").addEventListener("click", async () => {
  showLoading();
  await ipcRenderer.invoke("pause-kommen-action", {
    ...credentials(),
  });

  statuses = [];
  statuses.push(STATUS_GEHEN);
  statuses.push(STATUS_ENDE_PAUSE);
  saveStatus(statuses);

  kommenPauseTime = new Date().getTime();
  saveTime("kommenPauseTime", kommenPauseTime);
  if (pauseKommenInterval) {
    clearInterval(pauseKommenInterval);
  }
  pauseKommenInterval = startTimer("pauseKommenTimeDisplay", kommenPauseTime);

  redrawView();
  hideLoading();
});

document.addEventListener("DOMContentLoaded", initView);

function encrypt(data) {
  return btoa(data); //lol
}

function decrypt(data) {
  return atob(data); //lol
}

document.getElementById("username").addEventListener("blur", function () {
  const username = document.getElementById("username").value;
  localStorage.setItem("encryptedUsername", encrypt(username));

  if (getUserName() && getPassword()) {
    document.getElementById("statusAbholen").style.display = "block";
  }
});

document.getElementById("password").addEventListener("blur", function () {
  const password = document.getElementById("password").value;
  localStorage.setItem("encryptedPassword", encrypt(password));

  if (getUserName() && getPassword()) {
    document.getElementById("statusAbholen").style.display = "block";
  }
});

const loadAuthData = () => {
  const encryptedUsername = localStorage.getItem("encryptedUsername");
  const encryptedPassword = localStorage.getItem("encryptedPassword");

  if (encryptedUsername) {
    document.getElementById("username").value = decrypt(encryptedUsername);
  }

  if (encryptedPassword) {
    document.getElementById("password").value = decrypt(encryptedPassword);
  }
};
