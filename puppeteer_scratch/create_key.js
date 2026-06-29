const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto('https://voice.unicornaisolution.com/login', { waitUntil: 'networkidle2' });
  await page.type('input[type="email"]', 'demowork0112000@gmail.com');
  await page.type('input[type="password"]', 'demo@123');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  
  await page.goto('https://voice.unicornaisolution.com/integrations/v1-api?shop=demowork0112000.myshopify.com', { waitUntil: 'networkidle2' });
  
  console.log("On API page. Waiting for 3 seconds to load...");
  await new Promise(r => setTimeout(r, 3000));
  
  // Find the button that contains "Create API key" or "Create"
  console.log("Clicking create key button...");
  const clicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const createBtn = btns.find(b => b.innerText.includes('Create API key') || b.innerText.includes('Create'));
    if (createBtn) {
      createBtn.click();
      return true;
    }
    return false;
  });
  
  console.log("Clicked:", clicked);
  
  await new Promise(r => setTimeout(r, 2000)); // wait for key to generate
  
  // Scrape page text again to find the key (usually looks like uai_... or just a long string)
  const text = await page.evaluate(() => document.body.innerText);
  console.log("Page Text after click:", text.substring(0, 3000));
  
  // also look for new elements
  const allText = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*'))
      .filter(e => e.children.length === 0)
      .map(e => e.innerText)
      .join('\n');
  });
  console.log("Deep text snippet:", allText.substring(0, 2000));
  
  await browser.close();
})();
