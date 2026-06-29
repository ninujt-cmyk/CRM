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
      if (!url.includes('.js') && !url.includes('.css') && !url.includes('.svg') && !url.includes('.png')) {
        const type = res.headers()['content-type'] || '';
        if (type.includes('json') || type.includes('text/x-component') || url.includes('api')) {
          const text = await res.text();
          responses.push({ url, type, text: text.substring(0, 1000) });
        }
      }
    } catch (e) {}
  });

  await page.goto('https://voice.unicornaisolution.com/scripts/new', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 4000));
  
  const fs = require('fs');
  fs.writeFileSync('all_network_dump.json', JSON.stringify(responses, null, 2));
  console.log("Wrote all_network_dump.json");
  
  await browser.close();
})();
