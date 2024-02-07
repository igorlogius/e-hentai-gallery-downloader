const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  } else {
    browser.browserAction.setBadgeText({ text: "", tabId });
    browser.browserAction.disable(tabId);
  }
}

browser.tabs.onUpdated.addListener(handleUpdated, filter);

browser.browserAction.disable();

browser.browserAction.setBadgeBackgroundColor({ color: "white" });
