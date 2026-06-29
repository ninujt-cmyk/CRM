const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Setup network interception to catch the API key response
  await page.setRequestInterception(true);
  
  let theApiKey = null;
  
  page.on('response', async (response) => {
    if (response.url().includes('/api/v1/keys') && response.request().method() === 'POST') {
      try {
        const json = await response.json();
        console.log("INTERCEPTED KEY RESPONSE:", json);
        if (json.key) theApiKey = json.key;
        if (json.apiKey) theApiKey = json.apiKey;
      } catch (e) {
        console.log("Could not parse response");
      }
    }
  });

  page.on('request', request => {
    request.continue();
  });

  await page.goto('https://voice.unicornaisolution.com/login', { waitUntil: 'networkidle2' });
  await page.type('input[type="email"]', 'demowork0112000@gmail.com');
  await page.type('input[type="password"]', 'demo@123');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  
  await page.goto('https://voice.unicornaisolution.com/integrations/v1-api?shop=demowork0112000.myshopify.com', { waitUntil: 'networkidle2' });
  
  console.log("Clicking Create...");
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const createBtn = btns.find(b => b.innerText.includes('Create API key') || b.innerText.includes('Create'));
    if (createBtn) createBtn.click();
  });
  
  await new Promise(r => setTimeout(r, 4000));
  
  console.log("FINAL EXTRACTED KEY:", theApiKey);
  
  // Let's also check localStorage or inputs just in case
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(i => i.value).filter(v => v.length > 20);
  });
  console.log("Input values > 20 chars:", inputs);
  
  await browser.close();
})();
