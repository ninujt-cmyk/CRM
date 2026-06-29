const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  await page.goto('https://voice.unicornaisolution.com/login', { waitUntil: 'networkidle2' });
  await page.type('input[type="email"]', 'demowork0112000@gmail.com');
  await page.type('input[type="password"]', 'demo@123');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  
  await page.goto('https://voice.unicornaisolution.com/integrations/v1-api', { waitUntil: 'networkidle2' });
  
  // Let's just find the first key in the UI since the API endpoint failed.
  const existingKey = await page.evaluate(() => {
     // Look for the "ae4c1eb4abd5" key shown in the logs
     const rows = document.querySelectorAll('tr');
     for (const row of rows) {
        if (row.innerText.includes('CRM Integration')) {
           // We only have the ID 'ae4c1eb4abd5', not the full key. The UI says "Each key is shown in full only once when created."
           // So we CANNOT use an existing key. We MUST create one.
           return null; 
        }
     }
     return null;
  });
  
  console.log("Existing Key:", existingKey);
  await browser.close();
})();
