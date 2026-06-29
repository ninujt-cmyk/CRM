const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  console.log("Navigating to login...");
  await page.goto('https://voice.unicornaisolution.com/login', { waitUntil: 'networkidle2' });

  // Look for email input
  console.log("Typing credentials...");
  await page.type('input[type="email"]', 'demowork0112000@gmail.com');
  await page.type('input[type="password"]', 'demo@123');
  
  // Submit
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  
  console.log("Logged in. URL is now:", page.url());
  
  // Take a screenshot of dashboard
  await page.screenshot({ path: 'unicorn_dashboard.png' });
  
  // Try to go to API integrations page
  await page.goto('https://voice.unicornaisolution.com/integrations/v1-api', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: 'unicorn_api.png' });
  
  const content = await page.content();
  console.log("API Page Content snippet:", content.substring(0, 1000));
  
  await browser.close();
})();
