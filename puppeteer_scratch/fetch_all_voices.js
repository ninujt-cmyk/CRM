const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.goto('https://voice.unicornaisolution.com/login', { waitUntil: 'networkidle2' });
  await page.type('input[type="email"]', 'demowork0112000@gmail.com');
  await page.type('input[type="password"]', 'demo@123');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  
  const allVoices = {};
  
  page.on('response', async (res) => {
    try {
      const url = res.url();
      if (url.includes('/api/') && url.includes('voice')) {
        const text = await res.text();
        allVoices[url] = JSON.parse(text);
      }
    } catch (e) {}
  });

  console.log("Visiting voices...");
  await page.goto('https://voice.unicornaisolution.com/voices?shop=demowork0112000.myshopify.com', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 3000));
  
  console.log("Visiting playground...");
  await page.goto('https://voice.unicornaisolution.com/playground?shop=demowork0112000.myshopify.com&agent=new', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 3000));
  
  console.log("Visiting test-call...");
  await page.goto('https://voice.unicornaisolution.com/test-call?shop=demowork0112000.myshopify.com', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 3000));

  fs.writeFileSync('all_voices_apis.json', JSON.stringify(allVoices, null, 2));
  console.log("Wrote all_voices_apis.json");
  
  await browser.close();
})();
