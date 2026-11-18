import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('landing introduces Pulse and public status loads',async({page},info)=>{
 await page.goto('/'); await expect(page.getByRole('heading',{name:/Stay ahead/ })).toBeVisible();
 await expect(page.locator('.landing-hero > div').first()).toHaveCSS('opacity','1');
 const fonts=await page.evaluate(async()=>{await document.fonts.ready;return Array.from(document.fonts).filter(f=>['Sora','Manrope'].includes(f.family)).map(f=>({family:f.family,status:f.status}));});expect(fonts).toEqual(expect.arrayContaining([{family:'Sora',status:'loaded'},{family:'Manrope',status:'loaded'}]));
 await page.screenshot({path:info.outputPath('landing.png'),fullPage:true});
 await page.getByRole('link',{name:'Open dashboard'}).click(); await expect(page.getByRole('heading',{name:/Your web. In sync/})).toBeVisible();
 await page.goto('/status/acme'); await expect(page.getByRole('heading',{name:'Keeping you in the loop.'})).toBeVisible();
 await page.screenshot({path:info.outputPath('status.png'),fullPage:true});
});

test('sample dashboard range, search, keyboard chart and light theme work',async({page},info)=>{
 await page.goto('/dashboard'); await expect(page.getByText('Sample workspace',{exact:true})).toBeVisible();
 await expect(page.getByRole('table')).toContainText('Production API');
 await expect(page.getByRole('figure',{name:/Sample p95 response times/})).toBeVisible();
 expect(await page.evaluate(()=>innerWidth)).toBe(page.viewportSize()?.width);
 const before=await page.locator('.metric-card').last().locator('.metric-value').innerText();
 await page.screenshot({path:info.outputPath('dashboard.png'),fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:'7d',exact:true}).click();
 await expect(page.getByRole('button',{name:'7d',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.metric-card').last().locator('.metric-value')).not.toHaveText(before);
 await expect(page.locator('.chart-reading')).toContainText('Stacked');await page.locator('.timing-legend').getByRole('button',{name:/DNS/}).click();await expect(page.locator('.timing-legend').getByRole('button',{name:/DNS/})).toHaveAttribute('aria-pressed','true');await page.locator('.timing-legend').getByRole('button',{name:/DNS/}).click();await page.getByRole('button',{name:'Total response'}).click();await page.getByRole('button',{name:'Phase breakdown'}).click();await expect(page.locator('.chart-reading')).toContainText('Stacked');
 const chart=page.getByRole('group',{name:/Response time chart/});await chart.focus();await page.keyboard.press('ArrowRight');await expect(page.locator('.chart-reading')).toContainText('ms');
 if(info.project.name==='mobile')await page.getByRole('button',{name:'Open navigation'}).click();
 await page.getByRole('button',{name:/Search anything/}).click();await page.getByPlaceholder('Where would you like to go?').fill('Documentation');
 await page.getByRole('option',{name:'Documentation',exact:true}).click();await expect(page.getByRole('heading',{name:'Documentation',exact:true})).toBeVisible();
 await page.goto('/settings');await page.getByRole('button',{name:/Daylight/}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.goto('/dashboard');await expect(page.locator('html')).toHaveAttribute('data-theme','light');await page.screenshot({path:info.outputPath('dashboard-light.png'),fullPage:true});const lightResult=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(lightResult.violations).toEqual([]);
});

test('sample monitor keeps full URL, survives reload, and can be deleted',async({page})=>{
 await page.goto('/dashboard');await page.getByRole('button',{name:'Add monitor',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.getByLabel('Monitor name').fill('My test site');await dialog.getByLabel('Website URL').fill('https://example.com/health?region=in');
 await dialog.getByRole('button',{name:'Add monitor',exact:true}).click();await expect(page.getByRole('table')).toContainText('My test site');await page.reload();
 await page.getByRole('row').filter({hasText:'My test site'}).getByRole('link').first().click();
 await expect(page.getByRole('heading',{name:'Ready for its first heartbeat.'})).toBeVisible();await expect(page.locator('.detail-url')).toHaveText('https://example.com/health?region=in');
 await page.getByRole('tab',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Delete local monitor'}).click();await page.getByRole('dialog').getByRole('button',{name:'Delete monitor',exact:true}).click();await expect(page.getByRole('table')).not.toContainText('My test site');
});

test('landing and dashboard pass automated accessibility checks',async({page})=>{
 for(const route of ['/welcome','/dashboard']){await page.goto(route);await expect(page.getByRole('heading',{level:1})).toBeVisible();if(route==='/dashboard')await expect(page.getByRole('figure')).toBeVisible();const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations).toEqual([]);}
});

test('signal previews, primary action, and audience charts are interactive',async({page},info)=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:/Stay ahead/})).toBeVisible();await page.screenshot({path:info.outputPath('landing-hero.png'),animations:'disabled'});
 await page.getByRole('button',{name:/Performance/}).click();
 await expect(page.locator('.floating-stat-main > strong')).toHaveText('142ms');
 await page.getByRole('button',{name:/Visitors/}).click();
 await expect(page.locator('.floating-stat-main > strong')).toHaveText('248active');
 await page.getByRole('button',{name:'DNS: 8 milliseconds'}).click();
 await expect(page.locator('.phase-caption')).toContainText('Finding the address.');
 await expect(page.locator('.orb-satellite')).toHaveCSS('animation-name','none');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(page.viewportSize()?.width);
 await page.getByRole('button',{name:'Start monitoring',exact:true}).click();
 await expect(page).toHaveURL(/\/dashboard\?add=1/);
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.keyboard.press('Escape');
 await page.goto('/traffic');
 await expect(page.getByRole('heading',{name:'Audience mix'})).toBeVisible();
 await page.locator('.audience-style-toggle').getByRole('button',{name:'Donut',exact:true}).click();await expect(page.locator('.audience-style-toggle').getByRole('button',{name:'Donut',exact:true})).toHaveAttribute('aria-pressed','true');await page.locator('.audience-style-toggle').getByRole('button',{name:'Rings',exact:true}).click();
 await page.locator('.pages-chart-column button').first().focus();await expect(page.locator('.pages-chart-detail')).toContainText('12,447');
 await page.locator('.audience-controls').getByRole('button',{name:'Sources'}).click();
 await page.locator('.audience-legend button').first().focus();
 await expect(page.locator('.audience-label')).toHaveText('DIRECT');
 await expect(page.locator('.audience-value')).toHaveText('42%');
 const ring=await page.locator('.audience-donut svg').boundingBox();const arc=await page.locator('.audience-arc').first().boundingBox();
 expect(arc!.x).toBeGreaterThanOrEqual(ring!.x);expect(arc!.y).toBeGreaterThanOrEqual(ring!.y);expect(arc!.x+arc!.width).toBeLessThanOrEqual(ring!.x+ring!.width);expect(arc!.y+arc!.height).toBeLessThanOrEqual(ring!.y+ring!.height);
 await page.getByRole('heading',{name:'Traffic',exact:true}).click();
 await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
 await page.screenshot({path:info.outputPath('traffic.png'),fullPage:true,animations:'disabled'});
 const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations).toEqual([]);
});
