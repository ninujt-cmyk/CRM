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
  
  await new Promise(r => setTimeout(r, 2000));
  
  // Click Create API key
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const createBtn = btns.find(b => b.innerText.includes('Create API key') || b.innerText.includes('Create'));
    if (createBtn) createBtn.click();
  });
  
  await new Promise(r => setTimeout(r, 2000));
  
  // Look for the toast or text that contains the key.
  // The key probably starts with a common prefix, or is the longest string on the page without spaces
  const textElements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*'))
      .filter(e => e.children.length === 0 && e.innerText && e.innerText.trim().length > 15 && !e.innerText.includes(' '))
      .map(e => e.innerText.trim());
  });
  
  console.log("Possible API Keys:", textElements);

  // We can also just pull all network responses and look for JSON with a key
  
  await browser.close();
})();
