const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.goto('https://voice.unicornaisolution.com/login', { waitUntil: 'networkidle2' });
  await page.type('input[type="email"]', 'demowork0112000@gmail.com');
  await page.type('input[type="password"]', 'demo@123');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  
  await page.goto('https://voice.unicornaisolution.com/scripts/new', { waitUntil: 'networkidle2' });
  
  // wait for any react re-renders
  await new Promise(r => setTimeout(r, 3000));
  
  // click "Choose Voice" tab if it exists
  try {
    const tabs = await page.$$('button, a, div[role="tab"]');
    for (const tab of tabs) {
      const text = await page.evaluate(el => el.textContent, tab);
      if (text && text.includes('Choose Voice')) {
        await tab.click();
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  } catch (e) {}

  const html = await page.content();
  const fs = require('fs');
  fs.writeFileSync('full_page_dom.html', html);
  console.log("Wrote full_page_dom.html");
  
  await browser.close();
})();
