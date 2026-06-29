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
  await new Promise(r => setTimeout(r, 4000));
  
  // click "Choose Voice" tab
  await page.evaluate(() => {
    const tabs = document.querySelectorAll('button, a, div[role="tab"]');
    for (const tab of tabs) {
      if (tab.textContent.includes('Choose Voice')) {
        tab.click();
      }
    }
  });
  
  await new Promise(r => setTimeout(r, 2000));
  
  // Find React Fiber nodes
  const voices = await page.evaluate(() => {
    const results = [];
    // Traverse DOM to find elements that look like voice cards
    // The screenshot shows names like "Vinay", "Kashish"
    const elements = document.querySelectorAll('*');
    for (const el of elements) {
      if (el.textContent && (el.textContent.includes('Vinay') || el.textContent.includes('Kashish')) && el.textContent.length < 200) {
        // Try to get React props
        for (const key in el) {
          if (key.startsWith('__reactProps$')) {
            results.push({
              tag: el.tagName,
              text: el.textContent,
              props: el[key]
            });
          }
        }
      }
    }
    return results;
  });
  
  const fs = require('fs');
  // just write stringified to avoid circular JSON
  fs.writeFileSync('react_voices.json', JSON.stringify(voices, (key, val) => {
    if (key === 'children' || key === 'parent' || key === '_owner') return undefined;
    return val;
  }, 2));
  console.log("Wrote react_voices.json");
  
  await browser.close();
})();
