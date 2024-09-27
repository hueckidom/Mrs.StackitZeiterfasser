const { app, BrowserWindow, ipcMain } = require("electron");

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 320,
    height: 350,
    autoHideMenuBar: true,
    icon: "logo.png",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile("index.html");
  // setTimeout(() => {
  //   requestAction("beginn pause");
  // }, 2000);

  ipcMain.handle("fetch-times", async (event, moreData) => {
    return await getTimes();
  });

  ipcMain.handle("fetch-stamp-status", async (event, moreData) => {
    const status = await getAvailableStampItems();
    return status;
  });

  ipcMain.handle("kommen-action", async (event, moreData) => {
    await requestAction("kommen");
  });

  ipcMain.handle("gehen-action", async (event, moreData) => {
    await requestAction("gehen");
  });

  ipcMain.handle("pause-gehen-action", async (event, moreData) => {
    await requestAction("ende pause");
  });

  ipcMain.handle("pause-kommen-action", async (event, moreData) => {
    await requestAction("beginn pause");
  });
}

async function launchAuthSite(url) {
  return new Promise(async (resolve) => {
    const browser = await puppeteer.launch({
      headless: false,
      executablePath: EDGE_PATH,
      height: 1000,
      width: 1000,
      args: [
        "--disable-infobars",
        "--disable-extensions",
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],
      ignoreDefaultArgs: ["--enable-automation"],
    });

    const page = await browser.newPage();
    await page.goto(url);

    browser.on("disconnected", () => {
      resolve();
    });
  });
}

async function launchStampSite(
  url = "https://hrportalsgesprod.launchpad.cfapps.eu20.hana.ondemand.com/site#TimeEntry-change",
  headless = true
) {
  const edgePaths = await import("edge-paths");
  const puppeteer = await import("puppeteer-core");

  const EDGE_PATH = edgePaths.getEdgePath();
  let browser = await puppeteer.launch({
    headless,
    executablePath: EDGE_PATH,
    args: [
      "--disable-infobars",
      "--disable-extensions",
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  });

  const page = await browser.newPage();
  await page.goto(url);
  try {
    await page.waitForSelector("#application-TimeEntry-change", {
      timeout: 300000,
    });
  } catch (err) {
    const currentURL = page.url();
    if (currentURL.includes("federation.auth")) {
      browser.close();
      await launchAuthSite(url);

      return launchStampSite(url);
    }
  }

  return { page, browser };
}

async function clickStampItem(page, action) {
  const iframeElementHandle = await page.$("#application-TimeEntry-change");
  const frame = await iframeElementHandle.contentFrame();
  await frame.waitForNavigation({ waitUntil: "networkidle0" });

  console.log("=== Iframe loaded ===");

  await frame.waitForSelector("#__xmlview0--favList-listUl", {
    timeout: 600000,
  });
  console.log("=== Trying to click ===");
  await clickAction(frame, action);
  await clickOk(frame);
  // await page.close();
}

async function requestAction(action) {
  try {
    const { page, browser } = await launchStampSite();
    await clickStampItem(page, action);
    await wait(2000);
    await browser.close();
  } catch (error) {
    console.error(error);
  }
}

async function wait(sec = 500) {
  return new Promise((resolve) => setTimeout(() => resolve(null), sec));
}

async function clickOk(frame) {
  console.log("=== klicking ok ===");
  await frame.waitForSelector("#__button0", {
    timeout: 34000,
  });
  await frame.click(`#__button0`);
}

async function getAvailableStampItems() {
  try {
    const { page, browser } = await launchStampSite();

    console.log("=== selecting iframe ====");
    const iframeElementHandle = await page.$("#application-TimeEntry-change");
    const frame = await iframeElementHandle.contentFrame();
    console.log("=== selecting idle ====");

    await frame.waitForNavigation({ waitUntil: "networkidle0" });
    await frame.waitForSelector("#__xmlview0--favList-listUl", {
      timeout: 600000,
    });
    console.log("=== Got the list ====");

    const listItems = await frame.evaluate(() => {
      const ul = document.getElementById("__xmlview0--favList-listUl"); // Replace with your <ul> ID
      const liElements = ul.getElementsByTagName("li");
      return Array.from(liElements).map((li) => li.innerText);
    });
    console.log("=== Here ist the list ====", listItems);
    await browser.close();

    return listItems;
  } catch (error) {
    console.error(error);
  }
}

async function clickAction(frame, textToMatch) {
  const listItems = await frame.evaluate(() => {
    const ul = document.getElementById("__xmlview0--favList-listUl");
    const liElements = ul.getElementsByTagName("li");
    return Array.from(liElements).map((li) => ({
      text: li.innerText,
      id: li.id,
    }));
  });

  console.log("li", listItems);

  const item = listItems.find((o) =>
    o.text.toLowerCase().includes(textToMatch.toLowerCase())
  );

  if (item) {
    await frame.click(`li[id="${item.id}"]`);
  }

  return item;
}

async function getTimes() {
  const { page, browser } = await launchStampSite();
  console.log("=== selecting iframe ====");
  const iframeElementHandle = await page.$("#application-TimeEntry-change");
  const frame = await iframeElementHandle.contentFrame();
  console.log("=== selecting idle ====");

  await frame.waitForNavigation({ waitUntil: "networkidle0" });
  await frame.click("#__xmlview0--overview");

  await frame.waitForSelector(
    "#__identifier2-__xmlview0--idEventsTable-0-title",
    {
      timeout: 600000,
    }
  );
  console.log("=== checking times ====");

  const listItems = await frame.evaluate(() => {
    const ul = document.getElementById("__xmlview0--idEventsTable-listUl");
    const tbody = ul.getElementsByTagName("tbody");
    const trElements = tbody[0].getElementsByTagName("tr");

    return Array.from(trElements).map((tr) => {
      const trText = tr.innerText;
      const parts = trText.split("\t");
      const dateTime = parts[3].split("\n");
      return {
        status: parts[1],
        date: dateTime[1],
        time: dateTime[2],
      };
    });
  });

  console.log("items", listItems);
  await browser.close();
  return listItems;
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
