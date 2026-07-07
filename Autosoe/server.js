const express = require("express");
const cors = require("cors");
const path = require("path");
const { chromium } = require("playwright");
const {
  scrapeAlta,
  scrapeExtra,
  scrapeKontakt,
  scrapeZoommer,
  scrapeEE,
} = require("./scraping");
const app = express();
const PORT = 3000;
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/shop", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "shop-result.html"));
});
app.get("/api/products", async (req, res) => {
  const keyword = req.query.q;

  if (!keyword) return res.json([]);

  console.log("\n🔍 SEARCH:", keyword);

  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
  });

  const pages = await Promise.all([
    context.newPage(),
    context.newPage(),
    context.newPage(),
    context.newPage(),
    context.newPage(),
  ]);

  const [altaPage, extraPage, kontaktPage, zoommerPage, eePage] =
    pages;

  const run = (p) =>
    Promise.race([
      p,
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("timeout")), 30000)
      ),
    ]);

  try {
    const results = await Promise.allSettled([
      run(scrapeAlta(altaPage, keyword)),
      run(scrapeExtra(extraPage, keyword)),
      run(scrapeKontakt(kontaktPage, keyword, context)),
      run(scrapeZoommer(zoommerPage, keyword)),
      run(scrapeEE(eePage, keyword)),
    ]);

    const allProducts = results
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => r.value || []);

    console.log("✅ TOTAL PRODUCTS:", allProducts.length);

    res.json(allProducts);
  } catch (err) {
    console.log("❌ GLOBAL ERROR:", err.message);
    res.json([]);
  } finally {
    for (const p of pages) {
      try {
        await p.close();
      } catch {}
    }
    await browser.close();
  }
});
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});