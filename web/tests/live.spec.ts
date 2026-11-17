import { test,expect } from '@playwright/test';
const base='http://127.0.0.1:8000';

test('live account saves a real monitor, assertions, groups, deployment and maintenance',async({page,request})=>{
 const email=`browser-${crypto.randomUUID()}@example.com`,password='local-browser-test-password';
 await page.goto('/');await page.getByRole('button',{name:'Connect live',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.getByRole('button',{name:'Create account',exact:true}).click();await dialog.getByLabel('Email',{exact:true}).fill(email);await dialog.getByLabel('Password',{exact:true}).fill(password);await dialog.getByRole('button',{name:'Create account',exact:true}).last().click();
 await expect(page.getByText('Live workspace',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Add monitor',exact:true}).click();await page.getByRole('dialog').getByLabel('Monitor name').fill('Browser real monitor');await page.getByRole('dialog').getByLabel('Website URL').fill('https://example.com/health?region=in');await page.getByRole('dialog').getByRole('button',{name:'Add monitor',exact:true}).click();
 await expect(page.getByRole('table')).toContainText('Browser real monitor');await page.getByRole('row').filter({hasText:'Browser real monitor'}).getByRole('link').first().click();await page.getByRole('tab',{name:'Settings',exact:true}).click();await expect(page.getByLabel('Complete URL')).toHaveValue('https://example.com/health?region=in');
 await page.getByLabel('Group',{exact:true}).fill('Staging');await page.getByLabel('Tags, separated by commas').fill('API, Critical');await page.getByLabel('Expected HTTP codes').fill('200,404');await page.getByLabel('Enable public status page and badge').check();await page.getByRole('button',{name:'Save configuration'}).click();await expect(page.getByRole('status').filter({hasText:'Changes saved.'})).toBeVisible();
 await page.getByLabel('Version or commit').fill('v2-browser');await page.getByLabel('Release notes').fill('Browser release verification');await page.getByRole('button',{name:'Record deployment'}).click();
 const begin=new Date(Date.now()+60000),end=new Date(Date.now()+3600000);const local=(d:Date)=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
 await page.getByLabel('Start (your local time)').fill(local(begin));await page.getByLabel('End (your local time)').fill(local(end));await page.getByRole('button',{name:'Schedule maintenance'}).click();await expect(page.locator('.resource-row')).toContainText(['Scheduled maintenance']);
 await page.reload();await page.getByRole('tab',{name:'Overview',exact:true}).click();await expect(page.getByText('v2-browser',{exact:true}).first()).toBeVisible();
 await page.getByRole('tab',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Delete monitor and all data'}).click();await page.getByRole('dialog').getByRole('button',{name:'Delete monitor',exact:true}).click();await expect(page.getByRole('table')).not.toContainText('Browser real monitor');
 const auth=await request.post(`${base}/api/auth/login`,{data:{email,password}});expect(auth.ok()).toBeTruthy();
});

test('controlled chaos opens and resolves an incident live',async({page})=>{
 test.setTimeout(60000);await page.goto('/');await page.getByRole('button',{name:'Connect live',exact:true}).click();await page.getByRole('button',{name:'Try the live chaos demo'}).click();await expect(page.getByText('Live chaos demo',{exact:true})).toBeVisible();await expect(page.getByRole('table')).toContainText('Pulse chaos target');await page.getByRole('button',{name:'Break it',exact:true}).click();
 await expect(page.getByRole('table').getByText('Down',{exact:true})).toBeVisible({timeout:25000});
 await page.getByRole('button',{name:'Recover',exact:true}).click();await expect(page.getByRole('table').getByText('Operational',{exact:true})).toBeVisible({timeout:20000});
});

test('the real tracker sends private paths, handles SPA changes, and respects DNT',async({browser,request})=>{
 const email=`tracker-${crypto.randomUUID()}@example.com`,password='tracker-browser-test-password';
 const auth=await request.post(`${base}/api/auth/register`,{data:{email,password}});expect(auth.status()).toBe(201);
 const headers={Authorization:'Bearer '+(await auth.json()).access_token};
 const created=await request.post(`${base}/api/sites`,{headers,data:{name:'Disposable browser tracker test',url:'https://example.com/'}});expect(created.status()).toBe(201);
 const site=await created.json(),script=await (await request.get(`${base}/t.js`)).text();
 const context=await browser.newContext();
 async function installRoutes(ctx:typeof context){await ctx.route('https://example.com/**',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><title>Tracker test</title><script defer src="https://api.pulse.test/t.js" data-key="${site.site_key}"></script></head><body><h1>Tracker browser test</h1></body></html>`}));await ctx.route('https://api.pulse.test/t.js',route=>route.fulfill({contentType:'text/javascript',body:script}));await ctx.route('https://api.pulse.test/ingest',async route=>{const response=await request.post(`${base}/ingest`,{headers:{Origin:route.request().headers().origin||'', 'Content-Type':'text/plain'},data:route.request().postData()||''});await route.fulfill({status:response.status(),body:await response.text()});});}
 try{await installRoutes(context);const page=await context.newPage();await page.goto('https://example.com/__tracker_test?secret=do-not-store');await expect.poll(async()=>{const r=await request.get(`${base}/api/sites/${site.id}/traffic`,{headers});return (await r.json()).page_views;}).toBeGreaterThanOrEqual(1);await page.evaluate(()=>history.pushState({},'', '/spa-test?secret=removed'));await expect.poll(async()=>{const r=await request.get(`${base}/api/sites/${site.id}/traffic`,{headers});return (await r.json()).page_views;}).toBeGreaterThanOrEqual(2);const traffic=await (await request.get(`${base}/api/sites/${site.id}/traffic`,{headers})).json();expect(traffic.top_pages.some((p:{name:string})=>p.name.includes('?'))).toBe(false);
 const dnt=await browser.newContext();await dnt.addInitScript(()=>Object.defineProperty(navigator,'doNotTrack',{value:'1'}));await installRoutes(dnt);const privatePage=await dnt.newPage();await privatePage.goto('https://example.com/dnt-test');expect(await privatePage.evaluate(()=>sessionStorage.getItem('pulse-session'))).toBeNull();await dnt.close();
 }finally{await context.close();await request.delete(`${base}/api/sites/${site.id}`,{headers});}
});
