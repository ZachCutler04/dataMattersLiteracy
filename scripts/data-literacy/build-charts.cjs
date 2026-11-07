// Builds the five topic chart datasets (a treemap and a matching line chart per topic) from sources.json.
// Usage: node scripts/data-literacy/build-charts.cjs
const fs = require('fs');
const path = require('path');

const sources = JSON.parse(fs.readFileSync(path.join(__dirname, 'sources.json'), 'utf8'));
const outDir = path.join(__dirname, '../../public/data-literacy/assets/treemaps');

const PINK = ['#f8dce9', '#f5bad5', '#f294bf', '#ee6aa6', '#ec4594', '#e8237f'];
const YELLOW = ['#f7ee6d', '#fdd451', '#fcb441', '#f7962a', '#f37a22', '#f15d24'];
const GREEN = ['#d8efe1', '#b2e0c9', '#8fd1b2', '#6cc6a2', '#40bb8f', '#1db884'];
const TREND_NOTE = 'Dashed = trend of the last 8 data points; shaded band is a fixed-width illustration, not a statistical interval.';

const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const pctChange = (now, then) => round(((now - then) / then) * 100);
const leaf = (name, value, change) => ({ name, value: round(value, 2), change });
const write = (name, data) => fs.writeFileSync(path.join(outDir, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`);

// --- Sports: NFHS participation by sport, 2015-16 vs 2025-26.
function buildSports() {
  const { bySport, total } = sources.sports;
  const sport = (name, label = name) => leaf(label, bySport[name][2025], pctChange(bySport[name][2025], bySport[name][2015]));
  const years = Object.keys(total).map(Number);
  const series = (name, values) => ({ name, points: years.map((y) => [y, values[y] ?? null]) });
  return {
    title: 'High School Sports',
    legendTitle: 'Change in participants (2015–16 to 2025–26)',
    colorDomain: [-60, 60],
    unit: '%',
    source: `${sources.sports.source}. Value = boys and girls participants in 2025-26.`,
    categories: [
      {
        name: 'Team sports',
        palette: PINK,
        children: [
          sport('Football (11-player)', '11-player football'), sport('Flag football'), sport('Football (8-player)', '8-player football'),
          sport('Football (6-player)', '6-player'), sport('Football (9-player)', '9-player'), sport('Basketball'), sport('Soccer'),
          sport('Volleyball'), sport('Baseball'), sport('Softball', 'Fast-pitch softball'), sport('Lacrosse'), sport('Field hockey'),
          sport('Ice hockey'), sport('Water polo'),
        ],
      },
      {
        name: 'Individual sports',
        palette: YELLOW,
        children: [
          sport('Outdoor track and field'), sport('Cross country'), sport('Wrestling'), sport('Tennis'), sport('Swimming and diving'),
          sport('Golf'), sport('Indoor track and field'), sport('Bowling'), sport('Weightlifting'), sport('Badminton'),
          sport('Gymnastics'), sport('Archery'), sport('Alpine skiing'),
        ],
      },
      {
        name: 'Spirit and dance',
        palette: GREEN,
        children: [sport('Competitive spirit'), sport('Dance')],
      },
    ],
    annotations: [
      { target: 'Competitive spirit', text: ['Competitive spirit (cheer)', 'doubled, to 260,000 athletes.'] },
      { target: 'Wrestling', text: ['Wrestling added 120,000', 'athletes, up 45%.'] },
      { target: 'Swimming and diving', text: ['Swimming and diving', 'lost 18% of its athletes.'] },
      { target: 'Basketball', text: ['Basketball has 74,000 fewer', 'players than ten years ago.'] },
    ],
    line: {
      title: 'High school sports participation',
      yLabel: 'Participants',
      xLabel: 'School year (fall)',
      scale: 'log',
      series: [
        series('All sports', total),
        series('Flag football', bySport['Flag football']),
        series('Wrestling', bySport.Wrestling),
        series('Swimming and diving', bySport['Swimming and diving']),
      ],
      note: [`Data: ${sources.sports.source}.`, TREND_NOTE],
    },
  };
}

// --- Technology: Pew, % of US adults who use each platform, 2021 vs 2026.
function buildTechnology() {
  const { surveys } = sources.technology;
  const latest = (name) => [...surveys].reverse().find((s) => s.values[name] != null).values[name];
  const in2021 = (name) => surveys.find((s) => s.date.startsWith('2021')).values[name] ?? 0;
  const platform = (name) => leaf(name, latest(name), latest(name) - in2021(name));
  const series = (name) => ({
    name,
    points: surveys.filter((s) => s.values[name] != null).map((s) => {
      const [y, m, d] = s.date.split('-').map(Number);
      return [round(y + (m - 1) / 12 + d / 365, 2), s.values[name]];
    }),
  });
  return {
    title: 'Social Media Use',
    legendTitle: 'Change in % of US adults using it (2021 to 2026)',
    colorDomain: [-15, 15],
    unit: '%',
    source: `${sources.technology.source}. Value = % of US adults who say they ever use the platform in the latest survey (2026, or 2025 for Threads and Bluesky). Platforms launched after 2021 count as 0% in 2021. Pinterest is left out because it has no 2025-26 data.`,
    categories: [
      {
        name: 'Video and photo sharing',
        palette: PINK,
        children: ['YouTube', 'Instagram', 'TikTok', 'Snapchat'].map(platform),
      },
      {
        name: 'Social networks and messaging',
        legendLabel: 'Networks and messaging',
        palette: YELLOW,
        children: ['Facebook', 'WhatsApp', 'LinkedIn', 'Reddit', 'X (Twitter)', 'Nextdoor'].map(platform),
      },
      {
        name: 'Launched since 2022',
        palette: GREEN,
        children: ['Threads', 'Bluesky', 'Truth Social'].map(platform),
      },
    ],
    annotations: [
      { target: 'Instagram', text: ['Instagram now reaches half', 'of US adults, up from 40%.'] },
      { target: 'X (Twitter)', text: ['X (Twitter) lost users, falling', 'from 23% to 18% of adults.'] },
      { target: 'YouTube', text: ['YouTube reaches 84% of', 'US adults.'] },
      { target: 'Threads', text: ['Threads reached 8% of', 'adults within two years', 'of launching.'] },
    ],
    line: {
      title: 'Social media use',
      yLabel: '% of US adults using it',
      scale: 'linear',
      yDomain: [0, 100],
      unit: '%',
      series: [series('Facebook'), series('Instagram'), series('TikTok'), series('X (Twitter)')],
      note: [`Data: ${sources.technology.source}.`, TREND_NOTE],
    },
  };
}

// --- Geography: World Bank population, 2014 vs 2024, the 70 most populous countries.
const COUNTRY_NAMES = {
  'Russian Federation': 'Russia', 'Egypt, Arab Rep.': 'Egypt', 'Congo, Dem. Rep.': 'DR Congo', 'Viet Nam': 'Vietnam',
  'Iran, Islamic Rep.': 'Iran', Turkiye: 'Turkey', 'Korea, Rep.': 'South Korea', 'Yemen, Rep.': 'Yemen',
  'Venezuela, RB': 'Venezuela', "Korea, Dem. People's Rep.": 'North Korea', 'Syrian Arab Republic': 'Syria',
  'Somalia, Fed. Rep.': 'Somalia', "Cote d'Ivoire": 'Ivory Coast',
};
const NORTH_AFRICA = ['DZA', 'EGY', 'MAR', 'LBY', 'TUN'];
const CENTRAL_ASIA_AND_TURKEY = ['UZB', 'KAZ', 'TUR', 'TKM', 'KGZ', 'TJK'];
function continent(id, rawRegion) {
  const region = rawRegion.trim();
  if (region === 'Sub-Saharan Africa' || NORTH_AFRICA.includes(id)) return 'Africa';
  if (['AUS', 'NZL', 'PNG'].includes(id)) return 'Americas, Europe and Oceania';
  if (CENTRAL_ASIA_AND_TURKEY.includes(id) || /East Asia|South Asia|Middle East/.test(region)) return 'Asia';
  return 'Americas, Europe and Oceania';
}
function buildGeography() {
  const { countries, world } = sources.geography;
  const top = Object.entries(countries)
    .filter(([, c]) => c.population[2024] && c.population[2014])
    .sort((a, b) => b[1].population[2024] - a[1].population[2024])
    .slice(0, 70);
  const name = (c) => COUNTRY_NAMES[c.name] ?? c.name;
  const group = (label) => top.filter(([id, c]) => continent(id, c.region) === label)
    .map(([, c]) => leaf(name(c), c.population[2024] / 1e6, pctChange(c.population[2024], c.population[2014])));
  const years = Object.keys(world).map(Number).sort((a, b) => a - b);
  const series = (label, values) => ({ name: label, points: years.map((y) => [y, values[y] ?? null]) });
  return {
    title: 'Most Populous Countries',
    legendTitle: 'Population change (2014 to 2024)',
    colorDomain: [-45, 45],
    unit: '%',
    source: `${sources.geography.source}. Value = population in millions, 2024. 70 most populous countries only.`,
    categories: [
      { name: 'Asia', palette: PINK, children: group('Asia') },
      { name: 'Africa', palette: YELLOW, children: group('Africa') },
      { name: 'Americas, Europe and Oceania', legendLabel: 'Americas, Europe, Oceania', palette: GREEN, children: group('Americas, Europe and Oceania') },
    ],
    annotations: [
      { target: 'India', text: ['India passed China as the', 'most populous country,', 'with 1.45 billion people.'] },
      { target: 'Italy', text: ['Italy, Japan and Poland', 'all lost population.'] },
      { target: 'Somalia', text: ['Somalia’s population grew', '43% in ten years.'] },
      { target: 'Venezuela', text: ['Venezuela shrank 6% as', 'millions emigrated.'] },
    ],
    line: {
      title: 'Population',
      yLabel: 'Population',
      scale: 'log',
      series: [
        series('World', world),
        series('Nigeria', countries.NGA.population),
        series('Japan', countries.JPN.population),
        series('Ukraine', countries.UKR.population),
      ],
      note: [`Data: ${sources.geography.source}.`, TREND_NOTE],
    },
  };
}

// --- Stocks: largest S&P 500 companies by market cap, colored by one-year return.
const COMPANY = {
  AAPL: 'Apple', NVDA: 'Nvidia', MSFT: 'Microsoft', GOOGL: 'Alphabet', AMZN: 'Amazon', META: 'Meta', TSLA: 'Tesla',
  AVGO: 'Broadcom', 'BRK-B': 'Berkshire Hathaway', LLY: 'Eli Lilly', WMT: 'Walmart', JPM: 'JPMorgan Chase', V: 'Visa',
  MU: 'Micron', AMD: 'AMD', XOM: 'ExxonMobil', JNJ: 'Johnson & Johnson', MA: 'Mastercard', ABBV: 'AbbVie', COST: 'Costco',
  CVX: 'Chevron', KO: 'Coca-Cola', PLTR: 'Palantir', PG: 'Procter & Gamble', CSCO: 'Cisco', ORCL: 'Oracle', MRK: 'Merck',
  UNH: 'UnitedHealth', HD: 'Home Depot', BAC: 'Bank of America', GE: 'GE Aerospace', PM: 'Philip Morris', INTC: 'Intel',
  MS: 'Morgan Stanley', AMAT: 'Applied Materials', NFLX: 'Netflix', GS: 'Goldman Sachs', TMO: 'Thermo Fisher',
  PANW: 'Palo Alto Networks', RTX: 'RTX', CAT: 'Caterpillar', TXN: 'Texas Instruments', WFC: 'Wells Fargo',
  LRCX: 'Lam Research', AMGN: 'Amgen', LIN: 'Linde', IBM: 'IBM', CRWD: 'CrowdStrike', ANET: 'Arista Networks',
  AXP: 'American Express', DELL: 'Dell', GILD: 'Gilead', GEV: 'GE Vernova', DIS: 'Disney',
};
const SECTORS = {
  Technology: ['AAPL', 'NVDA', 'MSFT', 'AVGO', 'MU', 'AMD', 'PLTR', 'CSCO', 'ORCL', 'INTC', 'AMAT', 'PANW', 'TXN', 'LRCX', 'IBM', 'CRWD', 'ANET', 'DELL'],
  'Finance, health and industry': ['BRK-B', 'LLY', 'JPM', 'V', 'XOM', 'JNJ', 'MA', 'ABBV', 'CVX', 'MRK', 'UNH', 'BAC', 'GE', 'MS', 'GS', 'TMO', 'RTX', 'CAT', 'WFC', 'AMGN', 'LIN', 'AXP', 'GILD', 'GEV'],
  'Consumer and communication': ['GOOGL', 'AMZN', 'META', 'TSLA', 'WMT', 'COST', 'KO', 'PG', 'HD', 'PM', 'NFLX', 'DIS'],
};
function oneYearReturn(monthly) {
  const [lastMonth, lastClose] = monthly[monthly.length - 1];
  const [y, m] = lastMonth.split('-').map(Number);
  const yearAgo = `${y - 1}-${String(m).padStart(2, '0')}`;
  const base = [...monthly].reverse().find(([month]) => month <= yearAgo);
  return pctChange(lastClose, base[1]);
}
function yearEndSeries(name, monthly) {
  const byYear = {};
  monthly.forEach(([month, close]) => { byYear[Number(month.slice(0, 4))] = close; });
  const [lastMonth] = monthly[monthly.length - 1];
  return {
    name,
    points: Object.entries(byYear).map(([year, close]) => [
      Number(year) === Number(lastMonth.slice(0, 4)) ? round(Number(year) + (Number(lastMonth.slice(5)) - 0.5) / 12, 2) : Number(year) + 1,
      close,
    ]),
  };
}
function buildStocks() {
  const { companies, index, asOf } = sources.stocks;
  const sector = (tickers) => tickers.map((t) => leaf(COMPANY[t], companies[t].capBillions, oneYearReturn(companies[t].monthly)));
  return {
    title: 'Largest S&P 500 Companies',
    legendTitle: 'Share price change over the past year',
    colorDomain: [-60, 60],
    unit: '%',
    source: `${sources.stocks.source}. Value = market cap in $ billions on ${asOf}; color = change in share price over the 12 months to ${asOf.slice(0, 7)}.`,
    categories: [
      { name: 'Technology', palette: PINK, children: sector(SECTORS.Technology) },
      { name: 'Finance, health and industry', legendLabel: 'Finance, health, industry', palette: YELLOW, children: sector(SECTORS['Finance, health and industry']) },
      { name: 'Consumer and communication', legendLabel: 'Consumer, communication', palette: GREEN, children: sector(SECTORS['Consumer and communication']) },
    ],
    annotations: [
      { target: 'Micron', text: ['Micron’s share price nearly', 'tripled in a year.'] },
      { target: 'Eli Lilly', text: ['Eli Lilly shares rose 26%,', 'making it a $1.2 trillion company.'] },
      { target: 'Alphabet', text: ['Alphabet is worth $3.5 trillion', 'but its shares fell 11%.'] },
      { target: 'Netflix', text: ['Netflix is down 41%', 'over the past year.'] },
    ],
    line: {
      title: 'Share prices',
      yLabel: 'Share price (US$)',
      scale: 'log',
      series: [
        yearEndSeries(`${index.name} index`, index.monthly),
        yearEndSeries('Nvidia', companies.NVDA.monthly),
        yearEndSeries('Netflix', companies.NFLX.monthly),
        yearEndSeries('Intel', companies.INTC.monthly),
      ],
      note: [`Data: Yahoo Finance, year-end closing prices adjusted for splits; latest point is ${asOf}.`, TREND_NOTE],
    },
  };
}

// --- Music: RIAA revenue by format, 2014 vs 2024.
function buildMusic() {
  const { formats, byYear } = sources.music;
  const value = (year, format) => byYear[year][formats.indexOf(format)] ?? 0;
  const sum = (year, list) => list.reduce((total, format) => total + value(year, format), 0);
  // Limited-tier and other ad-supported streaming were only split out from 2016, so fold them into their 2014 parents.
  const GROUPS = {
    'Paid subscriptions': ['Paid subscriptions', 'Limited-tier subscriptions'],
    'Ad-supported streaming': ['Ad-supported on-demand'],
    'Digital radio': ['SoundExchange', 'Other ad-supported'],
    'Download singles': ['Download singles'],
    'Download albums': ['Download albums'],
    Ringtones: ['Ringtones'],
    'Other downloads': ['Other digital'],
    CDs: ['CDs'],
    'Vinyl records': ['Vinyl (LP/EP)'],
    'Music videos': ['Music video'],
    'Other physical': ['Other physical'],
    'Sync licensing': ['Sync licensing'],
  };
  const format = (name) => leaf(name, sum(2024, GROUPS[name]), pctChange(sum(2024, GROUPS[name]), sum(2014, GROUPS[name])));
  const years = Object.keys(byYear).map(Number);
  const series = (name, list) => ({ name, points: years.map((y) => [y, round(sum(y, list))]) });
  return {
    title: 'Music Revenue by Format',
    legendTitle: 'Change in revenue (2014 to 2024)',
    colorDomain: [-90, 90],
    unit: '%',
    source: `${sources.music.source}. Value = US revenue in $ millions, 2024.`,
    categories: [
      { name: 'Streaming', palette: PINK, children: ['Paid subscriptions', 'Ad-supported streaming', 'Digital radio'].map(format) },
      { name: 'Downloads', palette: YELLOW, children: ['Download singles', 'Download albums', 'Ringtones', 'Other downloads'].map(format) },
      { name: 'Physical and licensing', legendLabel: 'Physical, licensing', palette: GREEN, children: ['CDs', 'Vinyl records', 'Music videos', 'Other physical', 'Sync licensing'].map(format) },
    ],
    annotations: [
      { target: 'Paid subscriptions', text: ['Paid subscriptions grew', 'more than 14-fold and now', 'bring in two-thirds of revenue.'] },
      { target: 'Download albums', text: ['Album downloads fell 86%', 'and singles 88%.'] },
      { target: 'Vinyl records', text: ['Vinyl revenue grew 4.6 times,', 'while CDs fell 70%.'] },
      { target: 'Sync licensing', text: ['Licensing music for film, TV', 'and ads more than doubled.'] },
    ],
    line: {
      title: 'Music revenue by format',
      yLabel: 'US revenue ($ millions)',
      scale: 'log',
      series: [
        series('All formats', ['Total']),
        series('Streaming', ['Paid subscriptions', 'Limited-tier subscriptions', 'Ad-supported on-demand', 'SoundExchange', 'Other ad-supported']),
        series('Vinyl records', ['Vinyl (LP/EP)']),
        series('Downloads', ['Download singles', 'Download albums', 'Ringtones', 'Other digital']),
      ],
      note: [`Data: ${sources.music.source}.`, TREND_NOTE],
    },
  };
}

write('sports', buildSports());
write('technology', buildTechnology());
write('geography', buildGeography());
write('stocks', buildStocks());
write('music', buildMusic());
console.log('wrote 5 datasets to', outDir);
