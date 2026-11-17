import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('landing introduces Pulse and public status loads',async({page},info)=>{
 await page.goto('/welcome'); await expect(page.getByRole('heading',{name:/Big on signals/})).toBeVisible();
 await expect(page.locator('.landing-hero > div').first()).toHaveCSS('opacity','1');
 await page.screenshot({path:info.outputPath('landing.png'),fullPage:true});
 await page.getByRole('link',{name:'Open dashboard'}).click(); await expect(page.getByRole('heading',{name:/A good day/})).toBeVisible();
 await page.goto('/status/acme'); await expect(page.getByRole('heading',{name:'Keeping you in the loop.'})).toBeVisible();
 await page.screenshot({path:info.outputPath('status.png'),fullPage:true});
});

test('sample dashboard range, search, keyboard chart and light theme work',async({page},info)=>{
 await page.goto('/'); await expect(page.getByText('Sample workspace',{exact:true})).toBeVisible();
 await expect(page.getByRole('table')).toContainText('Production API');
 await expect(page.getByRole('figure',{name:/Sample p95 response times/})).toBeVisible();
 expect(await page.evaluate(()=>innerWidth)).toBe(page.viewportSize()?.width);
 const before=await page.locator('.metric-card').last().locator('.metric-value').innerText();
 await page.screenshot({path:info.outputPath('dashboard.png'),fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:'7d',exact:true}).click();
 await expect(page.getByRole('button',{name:'7d',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.metric-card').last().locator('.metric-value')).not.toHaveText(before);
 await page.getByRole('button',{name:'Phase breakdown'}).click();await expect(page.locator('.chart-reading')).toContainText('Stacked');await page.getByRole('button',{name:'Total response'}).click();
 const chart=page.getByRole('group',{name:/Response time chart/});await chart.focus();await page.keyboard.press('ArrowRight');await expect(page.locator('.chart-reading')).toContainText('ms');
 if(info.project.name==='mobile')await page.getByRole('button',{name:'Open navigation'}).click();
 await page.getByRole('button',{name:/Search anything/}).click();await page.getByPlaceholder('Where would you like to go?').fill('Documentation');
 await page.getByRole('option',{name:'Documentation',exact:true}).click();await expect(page.getByRole('heading',{name:'Documentation',exact:true})).toBeVisible();
 await page.goto('/settings');await page.getByRole('button',{name:/Daylight/}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-theme','light');await page.screenshot({path:info.outputPath('dashboard-light.png'),fullPage:true});
});

test('sample monitor keeps full URL, survives reload, and can be deleted',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Add monitor',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.getByLabel('Monitor name').fill('My test site');await dialog.getByLabel('Website URL').fill('https://example.com/health?region=in');
 await dialog.getByRole('button',{name:'Add monitor',exact:true}).click();await expect(page.getByRole('table')).toContainText('My test site');await page.reload();
 await page.getByRole('row').filter({hasText:'My test site'}).getByRole('link').first().click();
 await expect(page.getByRole('heading',{name:'Ready for its first heartbeat.'})).toBeVisible();await expect(page.locator('.detail-url')).toHaveText('https://example.com/health?region=in');
 await page.getByRole('tab',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Delete local monitor'}).click();await page.getByRole('dialog').getByRole('button',{name:'Delete monitor',exact:true}).click();await expect(page.getByRole('table')).not.toContainText('My test site');
});

test('landing and dashboard pass automated accessibility checks',async({page})=>{
 for(const route of ['/welcome','/']){await page.goto(route);await expect(page.getByRole('heading',{level:1})).toBeVisible();if(route==='/')await expect(page.getByRole('figure')).toBeVisible();const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations).toEqual([]);}
});
