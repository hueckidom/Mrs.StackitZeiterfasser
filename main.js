const { app, BrowserWindow, ipcMain } = require("electron");

let myUserName = "";
let myPassword = "";

function setCreds(creds) {
  myUserName = creds.username;
  myPassword = creds.password;
}

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 320,
    height: 350,
    autoHideMenuBar:true,
    icon: 'logo.png',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
  });

  mainWindow.loadFile("index.html");

  ipcMain.handle("fetch-stamp-status", async (event, creds) => {
    setCreds(creds);
    const status = await getAvailableStampItems();
    return status;
  });

  ipcMain.handle("kommen-action", async (event, creds) => {
    setCreds(creds);
    await requestAction("kommen");
  });

  ipcMain.handle("gehen-action", async (event, creds) => {
    setCreds(creds);
    await requestAction("gehen");
  });

  ipcMain.handle("pause-gehen-action", async (event, creds) => {
    setCreds(creds);
    await requestAction("ende pause");
  });

  ipcMain.handle("pause-kommen-action", async (event, creds) => {
    setCreds(creds);
    await requestAction("beginn pause");
  });
}

async function launchStampSite(headless = false) {
  const edgePaths = await import("edge-paths");
  const puppeteer = await import("puppeteer-core");

  const EDGE_PATH = edgePaths.getEdgePath();
  const browser = await puppeteer.launch({
    headless,
    executablePath: EDGE_PATH,
    height: 500,
    width: 700,
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
  await page.goto(
    "https://hrportalsgesprod.launchpad.cfapps.eu20.hana.ondemand.com/"
  );
  await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 30000 });

  const isClickSuccess = await clickNavigationBooking(page);

  if (!isClickSuccess) {
    await doAuth(page);
    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 30000 });
  }

  await reClickNavigationItem(page);

  return { page, browser };
}

async function clickStampItem(page, action) {
  await page.waitForSelector("#application-TimeEntry-change");
  const iframeElementHandle = await page.$("#application-TimeEntry-change");
  const frame = await iframeElementHandle.contentFrame();
  await frame.waitForNavigation({ waitUntil: "networkidle0" });

  console.log("=== Iframe loaded ===");

  await frame.waitForSelector("#__xmlview0--favList-listUl");
  console.log("=== Trying to click ===");
  await clickAction(frame, action);
  await clickOk(frame);
  // await page.close();
}

async function requestAction(action) {
  try {
    const { page, browser } = await launchStampSite();
    await clickStampItem(page, action);
    // await browser.close();
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
    timeout: 14000,
  });
  await frame.click(`#__button0`);
}

async function getAvailableStampItems() {
  try {
    const { page, browser } = await launchStampSite();
    await page.waitForSelector("#application-TimeEntry-change", {
      timeout: 14000,
    });
    console.log("=== selecting iframe ====");
    const iframeElementHandle = await page.$("#application-TimeEntry-change");
    const frame = await iframeElementHandle.contentFrame();
    console.log("=== selecting idle ====");

    await frame.waitForNavigation({ waitUntil: "networkidle0" });
    await frame.waitForSelector("#__xmlview0--favList-listUl");
    console.log("=== Got the list ====");

    const listItems = await frame.evaluate(() => {
      const ul = document.getElementById("__xmlview0--favList-listUl"); // Replace with your <ul> ID
      const liElements = ul.getElementsByTagName("li");
      return Array.from(liElements).map((li) => li.innerText);
    });
    console.log("=== Here ist the list ====", listItems);
    // await browser.close();

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

  const item = listItems.find((o) =>
    o.text.toLowerCase().includes(textToMatch)
  );

  if (item) {
    await frame.click(`li[id="${item.id}"]`);
  }

  return item;
}

async function doAuth(page) {
  console.log("== Doing auth ===");
  await page.waitForSelector('button[type="submit"]');
  await page.type("#Ecom_User_ID", myUserName);
  await page.type("#Ecom_Password", myPassword);
  await page.click('button[type="submit"]');
  await wait(500);
}

// trying to click the
async function clickNavigationBooking(page) {
  try {
    const currentURL = page.url();
    if (currentURL.includes("federation.auth")) {
      console.log("== Oh my good, auth ===");
      return false;
    }

    const isVisible = await page.evaluate(() => {
      const element = document.getElementById("__tile2");
      const aElement = element.querySelector("a");
      return aElement.id;
    });

    if (isVisible) {
      console.log("== Oh its visible ===", isVisible);
      await page.click(`#${isVisible}`);
      return true;
    }

    await wait();
    console.log("== Recheck nav ===");

    return clickNavigationBooking(page);
  } catch (error) {
    console.error("Error on checklist:", error);
  }
}

async function reClickNavigationItem(page) {
  try {
    console.log("== clicking nav item ===");
    const isVisible = await page.evaluate(() => {
      const element = document.getElementById("__tile10");
      return element && element.offsetParent !== null;
    });

    if (isVisible) {
      await page.click("#__tile10");

      return true;
    }

    await wait();

    return reClickNavigationItem(page);
  } catch (error) {
    console.error("Error on checklist:", error);
  }
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
