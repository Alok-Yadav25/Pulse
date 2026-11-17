import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests',fullyParallel:false,workers:1,expect:{timeout:10000},
 use:{baseURL:'http://127.0.0.1:4173',trace:'retain-on-failure',reducedMotion:'reduce',screenshot:'only-on-failure'},
 projects:[
  {name:'chromium',testIgnore:'**/live.spec.ts',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},
  {name:'mobile',testIgnore:'**/live.spec.ts',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}},
  {name:'live',testMatch:'**/live.spec.ts',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},
 ],
 webServer:[
  {command:'npm run preview -- --port 4173',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI},
  {command:process.env.CI?'cd ../backend && uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1 --no-access-log':'cd ../backend && .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1 --no-access-log',url:'http://127.0.0.1:8000/healthz',reuseExistingServer:!process.env.CI,env:{MAX_USERS:'100',...(process.env.BROWSER_DATABASE_URL?{DATABASE_URL:process.env.BROWSER_DATABASE_URL}:{})}},
 ],
});
