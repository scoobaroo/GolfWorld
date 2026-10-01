import { expect, test, type Page } from '@playwright/test';

// Exercise the real app/SDK boundary without credentials, paid traffic, or third-party results.
const sdk = String.raw`
const places = [
 {id:'ca',name:'River Springs Drive',address:'Rivercrest, Manitoba, Canada',country:'ca',lat:49.9980668,lon:-97.0479472},
 {id:'us',name:'Golf course',address:'San Francisco, USA',country:'us',lat:37.7749,lon:-122.4194},
 {id:'tw',name:'台北101',address:'台北市信義區信義路五段7號',country:'tw',lat:25.0338352,lon:121.5644995}
];
window.googleTest = {widgets:0,hold:false,pending:[],release(){this.hold=false;this.pending.splice(0).forEach(finish=>finish());}};
class Basic extends HTMLElement {
 constructor(options) { super(); this.options=options; this.includedRegionCodes=options.includedRegionCodes; }
 connectedCallback() {
  window.googleTest.widgets++;
  this.innerHTML='<input role="combobox" aria-label="Address or golf course"><div role="listbox" aria-label="Google address suggestions"></div><small>Google Maps · Test fixture</small>';
  this.input=this.querySelector('input'); this.list=this.querySelector('[role=listbox]');
  this.input.placeholder=this.options.placeholder;
  this.input.addEventListener('input',()=>{
   this.list.replaceChildren();
   if(this.input.value==='denied') {this.dispatchEvent(new Event('gmp-error'));return;}
   for(const place of places.filter(p=>this.includedRegionCodes.includes(p.country))) {
    const option=document.createElement('button'); option.setAttribute('role','option'); option.textContent=place.name+' '+place.address;
    const select=()=>{this.input.value='';this.list.replaceChildren();this.dispatchEvent(Object.assign(new Event('gmp-select'),{place:{id:place.id}}));};
    option.addEventListener('click',select); this.list.append(option);
   }
  });
  this.input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();this.list.querySelector('button')?.click();}});
 }
 set disabled(value) {this._disabled=value;if(this.input)this.input.disabled=value;}
 get disabled() {return this._disabled;}
}
class Details extends HTMLElement {
 connectedCallback() {
  const id=this.querySelector('gmp-place-details-place-request').getAttribute('place');const place=places.find(p=>p.id===id);
  const finish=()=>{
   this.place={id,location:{lat:()=>place.lat,lng:()=>place.lon}};
   this.textContent=place.name+' · '+place.address+' · Google Maps · Test fixture';
   this.dispatchEvent(new Event('gmp-load'));this.dispatchEvent(new Event('gmp-load'));
  }; if(window.googleTest.hold)window.googleTest.pending.push(finish);else setTimeout(finish,5);
 }
}
customElements.define('gmp-basic-place-autocomplete',Basic);customElements.define('gmp-place-details-compact',Details);
window.google={maps:{importLibrary:async()=>({BasicPlaceAutocompleteElement:Basic})}};
window.golfworldGoogleReady();
`;
async function setup(page: Page): Promise<void> {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ status: 204 }));
  await page.route('https://maps.googleapis.com/**', (route) => route.fulfill({ contentType: 'application/javascript', body: sdk }));
  await page.route('**/api/geo/neighborhood?**', (route) => {
    const params = new URL(route.request().url()).searchParams;
    return route.fulfill({ json: { origin: { lat: Number(params.get('lat')), lon: Number(params.get('lon')) }, radius: 350,
      features: [], source: 'OpenStreetMap', fetchedAt: new Date().toISOString(), truncated: false } });
  });
  await page.goto('/'); await expect(page.locator('main[data-world-ready="true"]')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Global map', exact: true }).click();
}
test('Google suggestions select and travel in all regions without persisting provider data', async ({ page }) => {
  let searches = 0; let travels = 0;
  page.on('request', (request) => { if (request.url().includes('/api/geo/search')) searches++; if (request.url().includes('/api/geo/neighborhood')) travels++; });
  await setup(page);
  for (const [country, query, label] of [['CA', 'River Springs Dr', 'River Springs Drive'], ['US', 'Golf course', 'Golf course'], ['TW', '台北市信義區信義路五段7號', '台北101']]) {
    await page.getByLabel('Search region', { exact: true }).selectOption(country);
    const input = page.getByRole('combobox', { name: 'Address or golf course' }); await input.fill(query);
    const options = page.getByRole('listbox', { name: 'Google address suggestions' }).getByRole('option');
    await expect(options).toHaveCount(1); await expect(options).toContainText([label]); await options.first().click();
    await expect(page.getByRole('dialog', { name: 'In-world phone' })).not.toBeVisible();
    await expect(page.locator('.geo-info')).toContainText('Selected Google location');
    await page.getByRole('button', { name: 'Global map', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Travel to Selected Google location' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Capture building or area', exact: true })).toBeDisabled();
    await expect(input).toBeEnabled();
    expect(await page.evaluate(() => localStorage.getItem('golfworld.geo.v1'))).toBeNull();
  }
  expect(searches).toBe(0); expect(travels).toBe(3);
  await page.reload(); await expect(page.locator('main[data-world-ready="true"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play Meadow Run' })).toBeVisible();
});
test('keyboard selection and closing the map ignore a late resolution; denied requests can retry', async ({ page }) => {
  await setup(page); const input = page.getByRole('combobox', { name: 'Address or golf course' });
  await expect(input).toBeVisible();
  // Events from a closed shadow input are retargeted to the custom element.
  for (const code of ['KeyP', 'Space', 'ArrowDown', 'Escape']) {
    const prevented = await page.evaluate((keyCode) => {
      const event = new KeyboardEvent('keydown', { code: keyCode, bubbles: true, composed: true, cancelable: true });
      document.querySelector('gmp-basic-place-autocomplete')!.dispatchEvent(event);
      return event.defaultPrevented;
    }, code);
    expect(prevented).toBe(false); await expect(page.getByRole('dialog', { name: 'In-world phone' })).toBeVisible();
  }
  await input.focus();
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', bubbles: true })));
  await expect(page.getByRole('dialog', { name: 'In-world phone' })).toBeVisible();
  await page.evaluate(() => { (window as unknown as { googleTest: { hold: boolean } }).googleTest.hold = true; });
  await input.fill('River Springs Dr'); await input.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'Finding the selected' })).toBeVisible();
  await page.getByRole('button', { name: 'Phone home', exact: true }).click();
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.evaluate(() => { (window as unknown as { googleTest: { release(): void } }).googleTest.release(); });
  await expect(page.locator('.geo-info')).toHaveCount(0);
  await input.fill('denied'); await expect(page.getByRole('alert')).toContainText('Google suggestions are unavailable');
  await page.getByRole('button', { name: 'Retry Google search' }).click();
  await expect(input).toBeVisible(); await input.fill('River Springs Dr'); await input.press('Enter');
  await expect(page.locator('.geo-info')).toContainText('Selected Google location');
});
test('SDK failure is recoverable and never falls back silently to Photon', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ status: 204 }));
  await page.route('https://maps.googleapis.com/**', (route) => route.abort());
  await page.goto('/'); await expect(page.locator('main[data-world-ready="true"]')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Global map', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Google address search could not load');
  await page.route('https://maps.googleapis.com/**', (route) => route.fulfill({ contentType: 'application/javascript', body: sdk }));
  await page.getByRole('button', { name: 'Retry Google search' }).click();
  await expect(page.getByRole('combobox', { name: 'Address or golf course' })).toBeVisible();
});
