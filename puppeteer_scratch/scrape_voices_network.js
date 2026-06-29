const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.goto('https://voice.unicornaisolution.com/login', { waitUntil: 'networkidle2' });
  await page.type('input[type="email"]', 'demowork0112000@gmail.com');
  await page.type('input[type="password"]', 'demo@123');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  
  const responses = [];
  page.on('response', async (res) => {
    try {
      const url = res.url();
      if (url.includes('api') || url.includes('json') || url.includes('trpc')) {
        const text = await res.text();
        if (text.includes('Vinay') || text.includes('Kashish') || text.includes('Askar')) {
          responses.push({ url, text });
        }
      }
    } catch (e) {}
  });

  await page.goto('https://voice.unicornaisolution.com/scripts/new', { waitUntil: 'networkidle0' });
  
  // wait 2 seconds
  await new Promise(r => setTimeout(r, 2000));
  
  const fs = require('fs');
  fs.writeFileSync('voices_network_dump.json', JSON.stringify(responses, null, 2));
  console.log("Wrote voices_network_dump.json");
  
  await browser.close();
})();
