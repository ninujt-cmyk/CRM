const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto('https://voice.unicornaisolution.com/login', { waitUntil: 'networkidle2' });
  await page.type('input[type="email"]', 'demowork0112000@gmail.com');
  await page.type('input[type="password"]', 'demo@123');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  console.log("Logged in. URL is now:", page.url());
  const cookies = await page.cookies();
  console.log("Cookies:", cookies);
  await page.goto('https://voice.unicornaisolution.com/integrations/v1-api', { waitUntil: 'networkidle2' });
  const content = await page.content();
  console.log("API Page Content snippet:", content.substring(0, 1500));
  await browser.close();
})();
