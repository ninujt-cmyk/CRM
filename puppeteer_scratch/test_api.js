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
  
  const newKeyData = await page.evaluate(async () => {
     // Wait for fetch to be available on window, just in case
     const res = await fetch('/api/keys', { 
         method: 'POST', 
         body: JSON.stringify({ label: 'Test CRM Bot Key' }), 
         headers: { 'Content-Type': 'application/json'} 
     });
     return res.json();
  });
  
  console.log("Created Key Data:", newKeyData);
  
  if (newKeyData && newKeyData.key) {
     const rawKey = newKeyData.key;
     
     // Test with Bearer instead of X-API-Key because the screenshot text says: 
     // "Keys authenticate requests to /api/v1/* via X-API-Key or Authorization: Bearer"
     // Let's test both to see which one works!
     
     console.log("\nTesting X-API-Key...");
     const res1 = await fetch('https://voice.unicornaisolution.com/api/v1/balance', { headers: { 'X-API-Key': rawKey } });
     console.log("Status:", res1.status, await res1.text());
     
     console.log("\nTesting Bearer...");
     const res2 = await fetch('https://voice.unicornaisolution.com/api/v1/balance', { headers: { 'Authorization': `Bearer ${rawKey}` } });
     console.log("Status:", res2.status, await res2.text());
  }
  
  await browser.close();
})();
