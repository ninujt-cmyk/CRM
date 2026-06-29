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
  
  // Try to find __NEXT_DATA__
  const nextData = await page.evaluate(() => {
    const script = document.getElementById('__NEXT_DATA__');
    return script ? script.textContent : null;
  });
  
  if (nextData) {
    const fs = require('fs');
    fs.writeFileSync('next_data_voices.json', nextData);
    console.log("Wrote next_data_voices.json");
  } else {
    // try to get from window variable or just dump HTML
    const html = await page.content();
    const fs = require('fs');
    fs.writeFileSync('scripts_new_page.html', html);
    console.log("Wrote scripts_new_page.html");
  }
  
  await browser.close();
})();
