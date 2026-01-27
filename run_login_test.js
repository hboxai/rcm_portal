const { runScenario } = require('./skills/rcm-testing-agent/scripts/test_engine.js');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Wrap page to match the API expected by test_engine.js
  const browserWrapper = {
    navigate: async (url) => {
      console.log(`Navigating to ${url}`);
      await page.goto(url);
    },
    act: async (params) => {
      console.log(`Acting: ${params.kind} on ${params.ref}`);
      if (params.kind === 'type') {
        await page.fill(params.ref, params.text);
      } else if (params.kind === 'click') {
        await page.click(params.ref);
      } else if (params.kind === 'wait') {
        await page.waitForSelector(params.ref, { timeout: params.timeMs });
      }
    },
    snapshot: async () => {
      return await page.content();
    },
    screenshot: async (params) => {
      console.log(`Taking screenshot: ${params.path}`);
      await page.screenshot({ path: params.path });
    }
  };

  const loginScenario = {
    id: "login_smoke",
    name: "Login Smoke Test",
    steps: [
      { action: "navigate", url: "http://localhost:5174/login" },
      { action: "type", selector: "input[name='email']", text: "HBilling_RCM@hbox.ai" },
      { action: "type", selector: "input[name='password']", text: "Admin@2025" },
      { action: "click", selector: "button[type='submit']" },
      { action: "wait", selector: "h1", timeout: 15000 }
    ]
  };

  try {
    await runScenario(loginScenario, browserWrapper);
    console.log("SUCCESS: Login test passed.");
  } catch (error) {
    console.error("FAILURE: Login test failed.");
    console.error(error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
