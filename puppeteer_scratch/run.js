const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  // Go to login page
  await page.goto('https://voice.unicornaisolution.com/login', { waitUntil: 'networkidle2' });
  
  // Wait for email input
  await page.waitForSelector('input[type="email"]');
  
  // Fill credentials
  await page.type('input[type="email"]', 'demowork0112000@gmail.com');
  await page.type('input[type="password"]', 'demo@123');
  
  // Click login
  await page.click('button[type="submit"]');
  
  // Wait for navigation
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  
  // Go to API docs page
  await page.goto('https://voice.unicornaisolution.com/integrations/v1-api?shop=demowork0112000.myshopify.com', { waitUntil: 'networkidle2' });
  
  // Extract text
  const text = await page.evaluate(() => document.body.innerText);
  console.log("--------- PAGE TEXT ---------");
  console.log(text.substring(0, 3000));
  
  await browser.close();
})();
