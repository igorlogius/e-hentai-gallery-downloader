const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let downloadedIds = new Set();

async function setToStorage(id, value) {
  let obj = {};
  obj[id] = value;
  return browser.storage.local.set(obj);
}

async function getFromStorage(type, id, fallback) {
  let tmp = await browser.storage.local.get(id);
  return typeof tmp[id] === type ? tmp[id] : fallback;
}

async function getImagePageURLsFromGalleryPage(url) {
  //console.debug("pageurl", url);
  const res = await fetch(url);
  const html = await res.text();

  let parser = new DOMParser();
  let doc = parser.parseFromString(html, "text/html");
  let img = await doc.querySelector("#img");

  const ret = Array.from(
    doc.querySelectorAll('a[href^="https://e-hentai.org/s/"')
  ).map((el) => {
    return el.getAttribute("href");
  });
  //console.debug(url, ret);
  return ret;
}

browser.browserAction.onClicked.addListener(async (tab) => {
  browser.browserAction.disable(tab.od);

  const zip = new JSZip();

  let counter = 1;

  let tmp = await browser.tabs.executeScript({
    code: `
            Array.from(document.querySelectorAll('table.ptt a[href]')).filter( (e) => {return !isNaN(parseInt(e.innerText)) }).slice(-1)[0].innerText;
        `,
  });
  //console.debug(tmp[0]);

  const max_page_nb = parseInt(tmp[0]);

  let url = new URL(tab.url);
  url.hash = "";
  url.search = "";

  await browser.browserAction.disable(tab.id);

  let parser = new DOMParser();

  for (let i = 0; i < max_page_nb; i++) {
    let page_url = url.toString() + "?p=" + i;

    //console.debug('page_url', page_url);

    let urls = await getImagePageURLsFromGalleryPage(page_url);

    //console.debug(JSON.stringify(urls,null,4));

    for (const url of urls) {
      const resp = await fetch(url);
      const html = await resp.text();

      let doc = await parser.parseFromString(html, "text/html");
      let img = await doc.querySelector("#img");
      let src = img.src;

      console.debug(counter, src);

      const fetch_ret = await fetch(img.src);
      const ext = img.src.split(".").slice(-1);
      zip.file(counter + "." + ext, fetch_ret.arrayBuffer(), {
        binary: "uint8Array",
      });
      counter++;
      browser.browserAction.setBadgeText({
        text: "" + Math.floor((counter / (max_page_nb * 40) / 2) * 100),
        tabId: tab.id,
      });

      await sleep(1000);
    }
  }

  let blob = await zip.generateAsync({ type: "blob" }, (meta) => {
    browser.browserAction.setBadgeText({
      text: "" + Math.floor(50 + meta.percent / 2),
      tabId: tab.id,
    });
  });
  await browser.browserAction.setBadgeText({
    text: "✅",
    tabId: tab.id,
  });

  tmp = tab.url.split("https://e-hentai.org/g/")[1].split("/")[0];
  if (!downloadedIds.has(tmp)) {
    downloadedIds.add(tmp);
    setToStorage("downloadedIds", downloadedIds);
  }
  saveAs(blob, tab.title + ".cbz");
  browser.browserAction.enable(tab.id);
});

const filter = {
  properties: ["url"],
};

function handleUpdated(tabId, changeInfo, tabInfo) {
  if (
    typeof changeInfo.url === "string" &&
    changeInfo.url.startsWith("https://e-hentai.org/g/")
  ) {
    browser.browserAction.enable(tabId);
    const tmp = changeInfo.url
      .split("https://e-hentai.org/g/")[1]
      .split("/")[0];
    if (downloadedIds.has(tmp)) {
      browser.browserAction.setBadgeText({
        text: "✅",
        tabId,
      });
    }
  } else {
    browser.browserAction.setBadgeText({ text: "", tabId });
    browser.browserAction.disable(tabId);
  }
}

(async () => {
  downloadedIds = await getFromStorage("object", "downloadedIds", new Set());

  browser.tabs.onUpdated.addListener(handleUpdated, filter);

  browser.browserAction.disable();

  browser.browserAction.setBadgeBackgroundColor({ color: "white" });

  browser.menus.create({
    title: "Clear Downloaded History Markers",
    contexts: ["browser_action"],
    onclick: async (tab, info) => {
      downloadedIds.clear();
      setToStorage("downloadedIds", downloadedIds);

      Array.from(await browser.tabs.query({})).forEach((t) => {
        if (
          typeof t.url === "string" &&
          t.url.startsWith("https://e-hentai.org/g/")
        ) {
          browser.browserAction.setBadgeText({
            text: "",
            tabId: t.id,
          });
        }
      });
    },
  });
})();
