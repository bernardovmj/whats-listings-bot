const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode         = require('qrcode-terminal');
const fs             = require('fs');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin  = require('puppeteer-extra-plugin-stealth');
puppeteerExtra.use(StealthPlugin());
const jsdom      = require('jsdom');


const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: puppeteerExtra
});
const SEEN_FILE = './seen.json';
const GROUP_ID  = '120363417492239950@g.us';   // your “House hunting” ID

let seen = fs.existsSync(SEEN_FILE)
  ? JSON.parse(fs.readFileSync(SEEN_FILE))
  : [];

// 1️⃣ Show QR the first time
client.on('qr', qr => qrcode.generate(qr, { small: true }));

// 2️⃣ When WhatsApp is ready, start polling
client.on('ready', () => {
  console.log('✅ Bot is online');
  checkListings();
  setInterval(checkListings, 60 * 60 * 1000); // every hour
});

// 3️⃣ Scrape & notify new listings without API key
async function checkListings() {
  try {
    const url = 'https://www.funda.nl/koop/amsterdam/'; // adjust with your filters in the URL
    const browser = await puppeteerExtra.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const html = await page.content();
    await browser.close();

    const dom = new jsdom.JSDOM(html);
    const items = Array.from(dom.window.document.querySelectorAll('.search-result'));
    const newOnes = items.map(el => {
      const link = el.querySelector('a')?.href;
      const title = el.querySelector('.search-result__header-title')?.textContent.trim();
      const price = el.querySelector('.search-result__price')?.textContent.trim();
      return { id: link, title, price, url: link };
    }).filter(l => l.id && !seen.includes(l.id));

    for (let l of newOnes) {
      const msg = `🏠 *${l.title}*\nPrice: ${l.price}\n${l.url}`;
      await client.sendMessage(GROUP_ID, msg);
      seen.push(l.id);
    }
    fs.writeFileSync(SEEN_FILE, JSON.stringify(seen));
    console.log(`🚀 Sent ${newOnes.length} new listing(s)`);
  } catch (e) {
    console.error('Error checking listings:', e.message);
  }
}

// 4️⃣ Start the client
client.initialize();