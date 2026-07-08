const { chromium } = require("playwright");
function cleanProducts(products = []) {
  return products.filter((p) => p && p.name && p.image && p.url);
}
async function scrapeAlta(page, keyword) {
  try {
    await page.goto(
      `https://alta.ge/search/${encodeURIComponent(keyword)}`,
      {
        waitUntil: "networkidle",
        timeout: 60000,
      }
    );

    await page.waitForTimeout(3000);

    const products = await page.evaluate(() => {
      const raw =
        window.__NEXT_DATA__ ||
        document.querySelector("#__NEXT_DATA__")?.textContent;

      if (!raw) return [];

      const parsed =
        typeof raw === "string" ? JSON.parse(raw) : raw;

      const items =
        parsed?.props?.pageProps?.initialSearchData?.products || [];

      return items.map((p) => ({
        shop: "alta.ge",
        name: p.name,
        price: p.price ? p.price + " ₾" : "იხილე საიტზე",
        oldPrice: p.previousPrice ? p.previousPrice + " ₾" : null,
        image: p.imageUrl,
        url: p.route ? "https://alta.ge/" + p.route : null,
      }));
    });

    return cleanProducts(products);
  } catch (err) {
    console.log("❌ ALTA ERROR:", err.message);
    return [];
  }
}async function scrapeExtra(page, keyword) {
  try {
    await page.goto(
      `https://extra.ge/search?k=${encodeURIComponent(keyword)}`,
      { waitUntil: "domcontentloaded", timeout: 60000 }
    );

    await page.waitForSelector("app-product-card", { timeout: 20000 });

    const products = await page.evaluate(() => {
      const cards = document.querySelectorAll("app-product-card");

      return Array.from(cards).map((card) => {
        const name = card.querySelector("h3")?.textContent?.trim();

        const price = card
          .querySelector("[id^='discountPrice'], [id^='productPrice']")
          ?.textContent?.trim();

        const image = card.querySelector("img")?.src;

        const link = card
          .querySelector("a[href*='/product/']")
          ?.getAttribute("href");

        return {
          shop: "extra.ge",
          name,
          price,
          image,
          url: link ? "https://extra.ge" + link : null,
        };
      });
    });

    return cleanProducts(products);
  } catch (err) {
    console.log("❌ EXTRA ERROR:", err.message);
    return [];
  }
}async function scrapeKontakt(page, keyword, context) {
  try {
    await page.goto("https://kontakt.ge", {
      waitUntil: "networkidle",
    });

    const data = await page.evaluate(async (keyword) => {
      const url =
        "https://kontakt.ge/kontaktcatalog/multisearch/search/" +
        `?query=${encodeURIComponent(keyword)}&limit=20&offset=0&categories=0&fields=true&filters=true&lang=ka`;

      const res = await fetch(url);
      return await res.json();
    }, keyword);

    const items = data?.results?.items || [];

    const products = await Promise.all(
      items.map(async (p) => {
        let price = p.price || null;
        let newPrice = null;

        if ((!price || !newPrice) && p.url) {
          const productPage = await context.newPage();

          try {
            await productPage.goto(p.url, {
              waitUntil: "domcontentloaded",
              timeout: 30000,
            });

            const result = await productPage.evaluate(() => {
              let salePrice = null;
              let normalPrice = null;

              const sale = document.querySelector(
                ".prodItem__prices b:not(.simple-price)"
              );
              if (sale) salePrice = sale.innerText.trim();

              const simple = document.querySelector(".simple-price");
              if (simple) normalPrice = simple.innerText.trim();

              const dataPrice = document.querySelector("[data-price-amount]");
              if (!salePrice && !normalPrice && dataPrice) {
                normalPrice = dataPrice.getAttribute("data-price-amount");
              }

              return {
                price: salePrice || normalPrice,
                newPrice: salePrice || null,
              };
            });

            price = result.price;
            newPrice = result.newPrice;
          } catch (e) {
            price = null;
            newPrice = null;
          }

          await productPage.close();
        }

        return {
          shop: "kontakt.ge",
          name: p.name,
          price: price ? price + " ₾" : "N/A",
          newPrice: newPrice ? newPrice + " ₾" : null,
          image: p.picture,
          url: p.url,
        };
      })
    );

    return cleanProducts(products);
  } catch (err) {
    console.log("❌ KONTAKT ERROR:", err.message);
    return [];
  }
}async function scrapeZoommer(page, keyword) {
  try {
    await page.goto("https://zoommer.ge");

    const data = await page.evaluate(async (keyword) => {
      const url = `https://zoommer.ge/api/proxy/v1/Products/v3?Name=${encodeURIComponent(
        keyword
      )}&Page=1&Limit=20&NotInStock=true`;

      const res = await fetch(url);
      return await res.json();
    }, keyword);

    const items = data?.products || [];

    const products = items.map((p) => ({
      shop: "zoommer.ge",
      name: p.name,
      price: p.price ? p.price + " ₾" : "N/A",
      image: p.imageUrl,
      url: p.route ? "https://zoommer.ge/" + p.route : null,
    }));

    return cleanProducts(products);
  } catch (err) {
    console.log("❌ ZOOMMER ERROR:", err.message);
    return [];
  }
}
module.exports = {
  scrapeAlta,
  scrapeExtra,
  scrapeKontakt,
  scrapeZoommer,
};