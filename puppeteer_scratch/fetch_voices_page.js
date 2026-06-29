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
  const responses = [];
  page.on('response', async (res) => {
    try {
      const url = res.url();
      if (url.includes('api') || url.includes('json') || url.includes('trpc') || url.includes('voices')) {
        const text = await res.text();
        responses.push({ url, text: text.substring(0, 1000) });
      }
    } catch (e) {}
  });

  await page.goto('https://voice.unicornaisolution.com/voices?shop=demowork0112000.myshopify.com', { waitUntil: 'networkidle0' });
  
  await new Promise(r => setTimeout(r, 4000));
  
  const fs = require('fs');
  fs.writeFileSync('voices_network_dump2.json', JSON.stringify(responses, null, 2));
  
  const html = await page.content();
  fs.writeFileSync('voices_page_html.html', html);
  
  console.log("Wrote files.");
  
  await browser.close();
})();
