const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.goto('https://voice.unicornaisolution.com/login', { waitUntil: 'networkidle2' });
  await page.type('input[type="email"]', 'demowork0112000@gmail.com');
  await page.type('input[type="password"]', 'demo@123');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  
  // Intercept fetch calls on the next page
  await page.evaluateOnNewDocument(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;
      response.clone().text().then(text => {
        window.__FETCH_LOGS = window.__FETCH_LOGS || [];
        window.__FETCH_LOGS.push({ url, text });
      }).catch(() => {});
      return response;
    };
  });

  await page.goto('https://voice.unicornaisolution.com/scripts/new', { waitUntil: 'networkidle0' });
  
  // wait 5 seconds for things to load
  await new Promise(r => setTimeout(r, 5000));
  
  const fetchLogs = await page.evaluate(() => window.__FETCH_LOGS || []);
  const fs = require('fs');
  fs.writeFileSync('fetch_logs.json', JSON.stringify(fetchLogs, null, 2));
  console.log("Wrote fetch_logs.json");
  
  await browser.close();
})();
