const sleep = ms => new Promise(r => setTimeout(r, ms));


async function getImagePageURLsFromGalleryPage(url) {
  console.debug("pageurl", url);
  const res = await fetch(url);

  const html = await res.text();

  let parser = new DOMParser();
  let doc = parser.parseFromString(html, "text/html");
  let img = await doc.querySelector("#img");

  return Array.from(
    doc.querySelectorAll('a[href^="https://e-hentai.org/s/"')
  ).map((el) => {
    let url = el.getAttribute("href");
    return url;
  });
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
  console.debug(tmp[0]);

  const max_page_nb = tmp[0];

  //return;
  let url = new URL(tab.url);

  url.hash = "";
  url.search = "";

  for (let i = 1; i <= max_page_nb; i++) {
    let page_url = url.toString() + "?p=" + i;

    let urls = await getImagePageURLsFromGalleryPage(page_url);

    for (const url of urls) {
      const resp = await fetch(url);
      const html = await resp.text();

      let parser = new DOMParser();
      let doc = parser.parseFromString(html, "text/html");
      let img = await doc.querySelector("#img");
      let src = img.src;

      console.debug(counter, src);

      const fetch_ret = await fetch(img.src);
      const ext = img.src.split(".").slice(-1);
      zip.file(counter + "." + ext, fetch_ret.arrayBuffer(), {
        binary: "uint8Array",
      });
      counter++;
    }
    sleep(5000);
  }

  let blob = await zip.generateAsync({ type: "blob" }, (meta) => {
    browser.browserAction.setBadgeText({
      text: "" + Math.floor(meta.percent),
      tabId: tab.id,
    });
  });
  browser.browserAction.setBadgeText({
    text: "",
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
