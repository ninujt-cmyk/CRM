const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.goto('https://voice.unicornaisolution.com/login', { waitUntil: 'networkidle2' });
  await page.type('input[type="email"]', 'demowork0112000@gmail.com');
  await page.type('input[type="password"]', 'demo@123');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  
  await page.goto('https://voice.unicornaisolution.com/playground?shop=demowork0112000.myshopify.com&agent=new', { waitUntil: 'networkidle2' });
  
  // click on the Choose Voice tab
  // find the tab button
  const tabs = await page.$$('button[role="tab"]');
  for (let tab of tabs) {
    const text = await page.evaluate(el => el.textContent, tab);
    if (text.includes('Choose Voice')) {
      await tab.click();
      break;
    }
  }
  
  await new Promise(r => setTimeout(r, 2000));
  
  const html = await page.evaluate(() => {
    const voiceContainer = document.querySelector('[role="tabpanel"]');
    return voiceContainer ? voiceContainer.innerHTML : document.body.innerHTML;
  });
  
  require('fs').writeFileSync('playground_voices_tab.html', html);
  console.log("Wrote playground_voices_tab.html");
  
  await browser.close();
})();
