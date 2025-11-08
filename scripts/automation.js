import fs from "fs-extra";
import xlsx from "xlsx";
import puppeteer from "puppeteer";

const EXCEL_PATH = "./data/data.xlsx";
const OUTPUT_DIR = "./output";
const BASE_URL = "https://www.sngpl.com.pk/onlineapp/pages/index.jsp";

async function readExcelReferences() {
  const workbook = xlsx.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);

  return rows
    .map(
      (r) =>
        r["Reference No"] ||
        r["Reference"] ||
        r["Ref"] ||
        r["reference no"] ||
        r["RefNo"]
    )
    .filter(Boolean);
}

async function handleAlertAndReload(page, ref) {
  page.on("dialog", async (dialog) => {
    const message = dialog.message();
    console.log(`⚠️ Alert detected for ${ref}: ${message}`);
    await dialog.dismiss();

    if (message.toLowerCase().includes("incorrect")) {
      console.log(`🔁 Reloading page for ${ref} due to incorrect captcha...`);
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#refNo", { timeout: 10000 });
      await page.type("#refNo", ref.toString(), { delay: 100 });
      console.log(`✅ Reference reinserted: ${ref}`);
    }
  });
}

async function captureWithJsPDF(page, ref) {
  console.log(`📄 Acknowledge page loaded for ${ref}`);
  await page.waitForSelector("body", { timeout: 60000 });

  // Wait for all images to load
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.images).map(
        (img) =>
          img.complete ||
          new Promise((res) => {
            img.onload = img.onerror = res;
          })
      )
    )
  );
  await page.setViewport({ width: 1200, height: 1024, deviceScaleFactor: 1 });
  await page.evaluate(() => {
    document.body.style.zoom = "0.8";
  });

  console.log("🖼️ All images loaded. Preparing full-width capture...");

  // Inject jsPDF + html2canvas
  await page.addScriptTag({
    url: "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  });
  await page.addScriptTag({
    url: "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
  });

  // Extract customer name + ID
  const { customerName, customerId } = await page.evaluate(() => {
    const table = document.querySelector("form#acknowledgeform table");
    let name = "Unknown";
    let id = "Unknown";

    if (table) {
      const rows = table.querySelectorAll("tr");
      rows.forEach((tr) => {
        const text = tr.innerText || "";
        if (text.includes("Customer Name")) {
          const tds = tr.querySelectorAll("td");
          if (tds[0]) name = tds[0].innerText.trim();
        }
        if (text.includes("Customer ID")) {
          const tds = tr.querySelectorAll("td");
          if (tds[1]) id = tds[1].innerText.trim();
        }
      });
    }
    return { customerName: name || "Unknown", customerId: id || "Unknown" };
  });

  const safeName = customerName
    .replace(/[<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, "_");
  const pdfPath = `${OUTPUT_DIR}/${safeName}_${ref}.pdf`;

  const pdfBase64 = await page.evaluate(async () => {
    const { jsPDF } = window.jspdf;
    const A4_WIDTH = 595.28; // pt
    const A4_HEIGHT = 841.89; // pt
    const body = document.body;
    const pageHeightPx = 1200; // px per screenshot, adjust for smaller slices
    const scale = 2; // for better resolution

    const totalHeight = body.scrollHeight;
    const slices = Math.ceil(totalHeight / pageHeightPx);

    const pdf = new jsPDF("p", "pt", "a4");

    for (let i = 0; i < slices; i++) {
      window.scrollTo(0, i * pageHeightPx);
      await new Promise((res) => setTimeout(res, 500)); // wait for scroll/render

      const canvas = await html2canvas(body, {
        scale,
        useCORS: true,
        windowWidth: body.scrollWidth,
        windowHeight: pageHeightPx,
        y: i * pageHeightPx,
      });

      const imgData = canvas.toDataURL("image/jpeg", 1.0);

      const imgWidth = A4_WIDTH;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);
    }

    return pdf.output("datauristring");
  });

  const base64Data = pdfBase64.split(",")[1];
  await fs.writeFile(pdfPath, Buffer.from(base64Data, "base64"));

  console.log(`💾 Saved full-width (correct) PDF for ${ref}: ${pdfPath}`);
  await page.close();
  console.log(`🚪 Closed tab for ${ref}`);
}

async function processReferences(references, browser, existingPages = []) {
  const pages = [];

  for (let i = 0; i < references.length; i++) {
    const ref = references[i];
    console.log(`🟦 Processing tab ${i + 1}: ${ref}`);

    try {
      let page;

      // 🪄 Reuse existing tab if available
      if (existingPages[i]) {
        page = existingPages[i];
        console.log(`♻️ Reusing existing tab for ${ref}`);
        await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      } else {
        if (i > 0) await new Promise((r) => setTimeout(r, 700));
        page = await browser.newPage();
        await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      }

      await handleAlertAndReload(page, ref);
      await page.waitForSelector("#refNo", { timeout: 10000 });

      // 🔒 Disable CAPTCHA and submit before typing
      await page.evaluate(() => {
        const captcha = document.querySelector("#kaptchafield1");
        const submitBtn = document.querySelector("input[type='submit']");
        if (captcha) captcha.disabled = true;
        if (submitBtn) submitBtn.disabled = true;
      });

      await page.evaluate(() => (document.querySelector("#refNo").value = ""));
      await page.type("#refNo", ref.toString(), { delay: 100 });
      console.log(`✅ Reference inserted: ${ref}`);

      // 🔓 Re-enable CAPTCHA and submit after insertion
      await page.evaluate(() => {
        const captcha = document.querySelector("#kaptchafield1");
        const submitBtn = document.querySelector("input[type='submit']");
        if (captcha) captcha.disabled = false;
        if (submitBtn) submitBtn.disabled = false;
      });

      // ✅ Listen for acknowledge.jsp once per page
      page.removeAllListeners("framenavigated");
      // Listen for manual reload (back to form page)
      page.on("framenavigated", async (frame) => {
        const url = frame.url();

        // If user manually reloads to the main page or the same form
        if (url.includes(BASE_URL)) {
          console.log(
            `♻️ Tab for ${ref} manually reloaded — auto-inserting ref again...`
          );

          try {
            await page.waitForSelector("#refNo", { timeout: 15000 });
            await page.evaluate(() => {
              const captcha = document.querySelector("#kaptchafield1");
              const submitBtn = document.querySelector("input[type='submit']");
              if (captcha) captcha.disabled = true;
              if (submitBtn) submitBtn.disabled = true;
            });

            await page.evaluate(
              () => (document.querySelector("#refNo").value = "")
            );
            await page.type("#refNo", ref.toString(), { delay: 100 });
            console.log(`✅ Reinserted reference after reload: ${ref}`);

            await page.evaluate(() => {
              const captcha = document.querySelector("#kaptchafield1");
              const submitBtn = document.querySelector("input[type='submit']");
              if (captcha) captcha.disabled = false;
              if (submitBtn) submitBtn.disabled = false;
            });
          } catch (err) {
            console.error(
              `⚠️ Could not reinsert ref after reload for ${ref}: ${err.message}`
            );
          }
        }

        // Handle acknowledge page PDF capture
        if (url.includes("acknowledge.jsp")) {
          try {
            await captureWithJsPDF(page, ref);
          } catch (err) {
            console.error(`❌ Error saving PDF for ${ref}:`, err.message);
          }
        }
      });

      pages.push(page);
    } catch (err) {
      console.error(`❌ Failed for ${ref}:`, err.message);
    }
  }

  return pages;
}

async function runAutomation() {
  await fs.ensureDir(OUTPUT_DIR);
  let references = await readExcelReferences();

  console.log(`📘 Found ${references.length} references.`);
  if (references.length === 0) {
    console.error("❌ No references found in Excel file!");
    return;
  }

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--start-maximized"],
  });

  // 🔄 Store current open pages
  let openPages = await processReferences(references, browser);

  // 🧠 Setup refresh listener
  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.on("line", async (input) => {
    if (input.toLowerCase() === "refresh") {
      console.log("🔄 Refreshing all references...");
      const newRefs = await readExcelReferences();

      // 🧹 Close extra pages if fewer references now
      if (newRefs.length < openPages.length) {
        const extra = openPages.slice(newRefs.length);
        for (const p of extra) await p.close();
        openPages = openPages.slice(0, newRefs.length);
      }

      // 🔁 Reload or open new pages as needed
      openPages = await processReferences(newRefs, browser, openPages);
      references = newRefs;
      console.log("✅ Refresh complete.");
    }
  });

  console.log(
    "\n✅ All tabs open. Please manually fill CAPTCHA and click Submit on each tab."
  );
  console.log(
    "💾 Once the acknowledge page loads, it will save full-page-width PDF automatically and close that tab."
  );
  if (references.length > 5) {
    console.log(
      "\n🔄 You can type 'refresh' in the terminal anytime to reload all references without opening new tabs."
    );
  }
}

runAutomation().catch((err) => console.error("Error:", err));
