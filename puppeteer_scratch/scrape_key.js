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
  
  // Wait for the API key to render (often in a code block, input field, or specific div)
  // Let's just dump the innerText of the body and look for something that looks like an API key.
  const text = await page.evaluate(() => document.body.innerText);
  console.log("Page Text:", text.substring(0, 2000));
  
  // also look for inputs
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(i => i.value);
  });
  console.log("Inputs:", inputs);
  
  await browser.close();
})();
