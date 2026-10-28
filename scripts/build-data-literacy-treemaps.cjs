// Builds the five topic treemap datasets from raw source figures.
// Usage: node scripts/build-data-literacy-treemaps.cjs public/data-literacy/assets/treemaps
const fs = require('fs');
const path = require('path');

const outDir = process.argv[2];
const PINK = ['#f8dce9', '#f5bad5', '#f294bf', '#ee6aa6', '#ec4594', '#e8237f'];
const YELLOW = ['#f7ee6d', '#fdd451', '#fcb441', '#f7962a', '#f37a22', '#f15d24'];
const GREEN = ['#d8efe1', '#b2e0c9', '#8fd1b2', '#6cc6a2', '#40bb8f', '#1db884'];

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
// [name, current, previous] -> leaf with % change
const pct = ([name, current, previous]) => ({ name, value: current, change: round(((current - previous) / previous) * 100) });
// [name, current, previous] -> leaf with percentage-point change
const pts = ([name, current, previous]) => ({ name, value: current, change: round(current - previous, 1) });

const write = (name, data) => fs.writeFileSync(path.join(outDir, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`);

// --- Sports: NFHS High School Athletics Participation Survey, combined boys + girls participants, 2024-25 vs 2023-24.
write('sports', {
  title: 'High School Sports',
  legendTitle: 'Change in participants (2023–24 to 2024–25)',
  colorDomain: [-6, 12],
  unit: '%',
  source: 'NFHS High School Athletics Participation Survey, 2023-24 and 2024-25. Value = combined boys and girls participants in 2024-25.',
  categories: [
    {
      name: 'Team sports',
      palette: PINK,
      children: [
        {
          name: 'Football',
          highlight: true,
          children: [
            ['11-player football', 1034425, 1035602],
            ['Flag football', 69672, 43954],
            ['8-player football', 22093, 26420],
            ['6-player', 6803, 6821],
            ['9-player', 6333, 5908],
          ].map(pct),
        },
        ...[
          ['Basketball', 896944, 903952],
          ['Soccer', 877956, 851378],
          ['Volleyball', 588771, 564380],
          ['Baseball', 473979, 473073],
          ['Fast-pitch softball', 338445, 345607],
          ['Lacrosse', 212988, 216205],
          ['Field hockey', 50856, 51896],
          ['Ice hockey', 41842, 42019],
          ['Water polo', 39779, 41087],
          ['Beach volleyball', 12481, 11585],
        ].map(pct),
      ],
    },
    {
      name: 'Individual sports',
      palette: YELLOW,
      children: [
        ['Outdoor track and field', 1158043, 1131348],
        ['Cross country', 433298, 432350],
        ['Wrestling', 374278, 356131],
        ['Tennis', 363388, 353601],
        ['Swimming and diving', 257405, 254973],
        ['Golf', 247742, 238010],
        ['Indoor track and field', 160377, 151714],
        ['Bowling', 59833, 61085],
        ['Weightlifting', 33355, 32863],
        ['Badminton', 19563, 19156],
        ['Gymnastics', 15131, 15196],
        ['Archery', 13018, 12456],
        ['Alpine skiing', 9411, 9995],
      ].map(pct),
    },
    {
      name: 'Spirit, esports and other',
      palette: GREEN,
      children: [
        ['Competitive spirit', 210509, 186151],
        // Unified Sports totals from the NFHS 2024-25 and 2023-24 press releases.
        ['Unified Sports', 70006, 51502],
        ['Dance', 32202, 22617],
        ['Esports', 30440, 27051],
        ['Bass fishing', 6968, 6651],
      ].map(pct),
    },
  ],
  annotations: [
    { target: "Basketball", text: ["Basketball still draws nearly","900,000 athletes but lost","7,000 in a year."], x: 70, y: 210 },
    { target: "Wrestling", text: ["Wrestling hit a record 374,000","athletes, with girls’ wrestling","up 15% in one year."], x: 72, y: 1430 },
    { target: "Esports", text: ["Esports grew 13%, to more","than 30,000 students."], x: 505, y: 1430 },
    { target: "Flag football", text: ["Flag football grew 59%","in a single year as","girls’ programs spread","to more states."], x: 1580, y: 1245 },
  ],
});

// --- Technology: Stack Overflow Developer Survey, all respondents, % who used each technology in the past year.
write('technology', {
  title: 'What Developers Use',
  legendTitle: 'Change in % of developers using it (2024 to 2025)',
  colorDomain: [-6, 18],
  unit: ' pts',
  source: 'Stack Overflow Developer Survey 2024 and 2025, all respondents. Value = % of respondents who used it in the past year.',
  categories: [
    {
      name: 'Languages',
      palette: PINK,
      children: [
        ['JavaScript', 66, 62.3],
        ['HTML/CSS', 61.9, 52.9],
        ['SQL', 58.6, 51],
        ['Python', 57.9, 51],
        ['Bash/Shell', 48.7, 33.9],
        ['TypeScript', 43.6, 38.5],
        ['Java', 29.4, 30.3],
        ['C#', 27.8, 27.1],
        ['C++', 23.5, 23],
        ['PowerShell', 23.2, 13.8],
        ['C', 22, 20.3],
        ['PHP', 18.9, 18.2],
        ['Go', 16.4, 13.5],
        ['Rust', 14.8, 12.6],
        ['Kotlin', 10.8, 9.4],
      ].map(pts),
    },
    {
      name: 'Tools and cloud',
      palette: YELLOW,
      children: [
        {
          name: 'Cloud platforms',
          highlight: true,
          children: [
            ['AWS', 43.3, 48],
            ['Microsoft Azure', 26.3, 27.8],
            ['Google Cloud', 24.6, 25.1],
            ['Cloudflare', 20.1, 15.1],
          ].map(pts),
        },
        ...[
          ['Docker', 71.1, 53.9],
          ['npm', 56.8, 49.6],
          ['Pip', 40.9, 32.4],
          ['Kubernetes', 28.5, 19.4],
          ['Homebrew', 25.7, 22.3],
          ['Vite', 25.4, 19.9],
          ['Make', 23.2, 20.8],
          ['Yarn', 21.1, 18.8],
          ['NuGet', 18.9, 16.1],
          ['Webpack', 18.4, 18.4],
        ].map(pts),
      ],
    },
    {
      name: 'Databases',
      palette: GREEN,
      children: [
        ['PostgreSQL', 55.6, 48.7],
        ['MySQL', 40.5, 40.3],
        ['SQLite', 37.5, 33.1],
        ['Microsoft SQL Server', 30.1, 25.3],
        ['Redis', 28, 20],
        ['MongoDB', 24, 24.8],
        ['MariaDB', 22.5, 17.2],
        ['Elasticsearch', 16.7, 12.5],
        ['Oracle', 10.6, 10.1],
        ['DynamoDB', 9.8, 7.9],
        ['BigQuery', 6.5, 4.8],
        ['Supabase', 6, 4],
        ['Cloud Firestore', 5.7, 5.4],
      ].map(pts),
    },
  ],
  annotations: [
    { target: "AWS", text: ["AWS is still the top cloud","platform but lost the most","ground, down nearly 5 points."], x: 70, y: 210 },
    { target: "Docker", text: ["Docker use jumped 17 points,","to 71% of developers."], x: 72, y: 1430 },
    { target: "MongoDB", text: ["MongoDB was the only","database here to lose users."], x: 505, y: 1430 },
    { target: "PostgreSQL", text: ["PostgreSQL is used by","more than half of","developers, well ahead","of MySQL at 41%."], x: 1580, y: 1245 },
  ],
});

// --- Geography: UN World Population Prospects 2024 estimates (via Wikipedia), 70 most populous countries, 1 July 2023 vs 2022.
const country = ([name, y2022, y2023]) => ({ name, value: round(y2023 / 1e6, 1), change: round(((y2023 - y2022) / y2022) * 100) });
write('geography', {
  title: 'Most Populous Countries',
  legendTitle: 'Annual population change (2022 to 2023)',
  colorDomain: [-1.5, 3],
  unit: '%',
  source: 'UN World Population Prospects 2024, via Wikipedia "List of countries by population (United Nations)". Value = population in millions, 1 July 2023. 70 most populous countries only.',
  categories: [
    {
      name: 'Asia',
      palette: PINK,
      children: [
        {
          name: 'East Asia',
          highlight: true,
          children: [
            ['China', 1425179569, 1422584933],
            ['Japan', 124997578, 124370947],
            ['South Korea', 51782512, 51748739],
            ['North Korea', 26329845, 26418204],
            ['Taiwan', 23420111, 23317145],
          ].map(country),
        },
        ...[
          ['India', 1425423212, 1438069596],
          ['Indonesia', 278830529, 281190067],
          ['Pakistan', 243700667, 247504495],
          ['Bangladesh', 169384897, 171466990],
          ['Philippines', 113964338, 114891199],
          ['Vietnam', 99680655, 100352192],
          ['Iran', 89524246, 90608707],
          ['Turkey', 87058473, 87270501],
          ['Thailand', 71735329, 71702435],
          ['Myanmar', 53756787, 54133798],
          ['Iraq', 44070551, 45074049],
          ['Afghanistan', 40578842, 41454761],
          ['Yemen', 38222876, 39390799],
          ['Uzbekistan', 34938955, 35652307],
          ['Malaysia', 34695493, 35126298],
          ['Saudi Arabia', 32175352, 32264292],
          ['Nepal', 29715436, 29964614],
          ['Syria', 22462173, 23594623],
          ['Sri Lanka', 22834965, 22971617],
          ['Kazakhstan', 20034609, 20330104],
        ].map(country),
      ],
    },
    {
      name: 'Africa',
      palette: YELLOW,
      children: [
        ['Nigeria', 223150896, 227882945],
        ['Ethiopia', 125384287, 128691692],
        ['Egypt', 112618250, 114535772],
        ['DR Congo', 102396968, 105789731],
        ['Tanzania', 64711821, 66617606],
        ['South Africa', 62378410, 63212384],
        ['Kenya', 54252461, 55339003],
        ['Sudan', 49383346, 50042791],
        ['Uganda', 47312719, 48656601],
        ['Algeria', 45477389, 46164219],
        ['Morocco', 37329064, 37712505],
        ['Angola', 35635029, 36749906],
        ['Ghana', 33149152, 33787914],
        ['Mozambique', 32656246, 33635160],
        ['Madagascar', 30437261, 31195932],
        ['Ivory Coast', 30395002, 31165654],
        ['Cameroon', 27632771, 28372687],
        ['Niger', 25311973, 26159867],
        ['Mali', 23072640, 23769127],
        ['Burkina Faso', 22509038, 23025776],
        ['Malawi', 20568728, 21104482],
        ['Zambia', 20152938, 20723965],
        ['Chad', 18455316, 19319064],
        ['Somalia', 17801897, 18358615],
      ].map(country),
    },
    {
      name: 'Americas, Europe and Oceania',
      legendLabel: 'Americas, Europe, Oceania',
      palette: GREEN,
      children: [
        ['United States', 341534046, 343477335],
        ['Brazil', 210306415, 211140729],
        ['Russia', 145579899, 145440500],
        ['Mexico', 128613117, 129739759],
        ['Germany', 84086227, 84548231],
        ['United Kingdom', 68179315, 68682962],
        ['France', 66277409, 66438822],
        ['Italy', 59619115, 59499453],
        ['Colombia', 51737944, 52321152],
        ['Spain', 47828382, 47911579],
        ['Argentina', 45407904, 45538401],
        ['Canada', 38821259, 39299105],
        ['Poland', 38385739, 38762844],
        ['Ukraine', 41048766, 37732836],
        ['Peru', 33475438, 33845617],
        ['Venezuela', 28213017, 28300854],
        ['Australia', 26200984, 26451124],
        ['Chile', 19553036, 19658835],
        ['Romania', 19166772, 19118479],
        ['Guatemala', 17847877, 18124838],
        ['Netherlands', 17904421, 18092524],
      ].map(country),
    },
  ],
  annotations: [
    { target: 'India', text: ['India passed China to become', 'the most populous country,', 'with 1.44 billion people.'], x: 70, y: 210 },
    { target: 'Ukraine', text: ['Ukraine lost 8% of its', 'population in one year as', 'people fled the war.'], x: 72, y: 1430 },
    { target: 'Chad', text: ['Chad and Niger grew fastest', 'in Africa, by 4.7% and 3.4%.'], x: 505, y: 1430 },
    { target: "United States", text: ["The United States is","the third most populous","country, with 343","million people."], x: 1580, y: 1245 },
  ],
});

// --- Stocks: 49 largest S&P 500 companies by market cap (stockanalysis.com, Alphabet counted once)
// with year-to-date return (finviz.com), both retrieved 28 Oct 2026. Value = market cap in $ billions.
const stock = ([name, cap, ytd]) => ({ name, value: cap, change: ytd });
write('stocks', {
  title: 'Largest S&P 500 Companies',
  legendTitle: 'Year-to-date return (as of Oct. 28, 2026)',
  colorDomain: [-30, 60],
  unit: '%',
  source: 'Market cap from stockanalysis.com S&P 500 list; YTD return from finviz.com screener; both retrieved 28 Oct 2026. Value = market cap in $ billions.',
  categories: [
    {
      name: 'Technology',
      palette: PINK,
      children: [
        {
          name: 'Semiconductors',
          highlight: true,
          children: [
            ['Nvidia', 5220, 16.46],
            ['Broadcom', 1660, 1.14],
            ['Micron', 1100, 241.18],
            ['AMD', 929.92, 167.65],
            ['Intel', 494.82, 157.13],
            ['Applied Materials', 329.8, 62.88],
            ['Lam Research', 316.43, 49.17],
            ['Texas Instruments', 280.53, 77.19],
          ].map(stock),
        },
        ...[
          ['Apple', 5030, 26.86],
          ['Microsoft', 3920, 9.37],
          ['Palantir', 464.51, 9.16],
          ['Cisco', 434, 43.26],
          ['Oracle', 427.59, -27.01],
          ['Palo Alto Networks', 324.29, 114.99],
          ['Dell', 314.03, 294.38],
          ['CrowdStrike', 271.97, 126.14],
          ['IBM', 238, -14.89],
        ].map(stock),
      ],
    },
    {
      name: 'Finance, health and industry',
      legendLabel: 'Finance, health, industry',
      palette: YELLOW,
      children: [
        ['Berkshire Hathaway', 1160, 7.84],
        ['Eli Lilly', 1150, 19.71],
        ['JPMorgan Chase', 899, 5.14],
        ['ExxonMobil', 750.07, 51.53],
        ['Visa', 748.32, 14.78],
        ['Johnson & Johnson', 653.3, 31.11],
        ['Mastercard', 536.99, 7.38],
        ['AbbVie', 507.96, 25.72],
        ['Chevron', 452.63, 51.31],
        ['UnitedHealth', 366.04, 23.69],
        ['Bank of America', 351.47, -7.53],
        ['Merck', 346.46, 33.39],
        ['Caterpillar', 329.04, 25.31],
        ['GE Aerospace', 312.34, -1.83],
        ['Morgan Stanley', 296.91, 6.97],
        ['Goldman Sachs', 279.51, 5.07],
        ['RTX', 265.54, 7.26],
        ['Thermo Fisher', 261.22, 21.93],
        ['Wells Fargo', 252.53, -9.74],
        ['Amgen', 243.64, 37.72],
        ['GE Vernova', 235.71, 35.13],
      ].map(stock),
    },
    {
      name: 'Consumer and communication',
      legendLabel: 'Consumer, communication',
      palette: GREEN,
      children: [
        ['Alphabet', 3950, 3.44],
        ['Amazon', 2730, 9.79],
        ['Tesla', 1590, -10.13],
        ['Meta', 1560, -7.43],
        ['Walmart', 944.83, 6.86],
        ['Costco', 436.23, 14.17],
        ['Coca-Cola', 394.36, 31.17],
        ['Procter & Gamble', 367.69, 10.76],
        ['Home Depot', 317.1, -7.54],
        ['Philip Morris', 316.56, 26.83],
        ['Netflix', 252.95, -34.19],
      ].map(stock),
    },
  ],
  annotations: [
    { target: 'Nvidia', text: ['Nvidia is the largest company', 'in the index, worth over', '$5 trillion.'], x: 70, y: 210 },
    { target: 'Netflix', text: ['Netflix is down 34% this', 'year, the worst among', 'these companies.'], x: 72, y: 1430 },
    { target: 'Dell', text: ['Dell’s stock has nearly', 'quadrupled this year.'], x: 505, y: 1430 },
    { target: "Tesla", text: ["Tesla is down 10% this","year, while Alphabet","is up 3%."], x: 1580, y: 1245 },
  ],
});

// --- Music: RIAA 2024 Year-End Revenue Statistics, US estimated retail value ($ millions), 2024 vs 2023.
write('music', {
  title: 'Music Revenue by Format',
  legendTitle: 'Change in revenue (2023 to 2024)',
  colorDomain: [-20, 10],
  unit: '%',
  source: 'RIAA 2024 Year-End Revenue Statistics. Value = US estimated retail revenue in $ millions, 2024.',
  categories: [
    {
      name: 'Streaming',
      palette: PINK,
      children: [
        ['Paid subscriptions', 10687.0, 10149.7],
        ['Limited-tier subscriptions', 998.3, 1021.4],
        {
          name: 'Ad-supported',
          highlight: true,
          children: [
            ['On-demand (ad-supported)', 1831.9, 1864.5],
            ['SoundExchange radio', 1054.0, 1004.8],
            ['Other ad-supported', 306.5, 317.7],
          ].map(pct),
        },
      ].map((d) => (Array.isArray(d) ? pct(d) : d)),
    },
    {
      name: 'Physical',
      palette: YELLOW,
      children: [
        ['Vinyl LPs', 1442.9, 1350.2],
        ['CDs', 541.1, 537.1],
        ['Other physical', 21.7, 14.0],
        ['Music video', 8.9, 10.7],
      ].map(pct),
    },
    {
      name: 'Downloads and licensing',
      legendLabel: 'Downloads, licensing',
      palette: GREEN,
      children: [
        ['Sync licensing', 412.6, 402.5],
        ['Album downloads', 166.7, 204.9],
        ['Single downloads', 162.4, 190.8],
        ['Other digital', 35.1, 28.1],
        ['Ringtones', 5.6, 10.5],
      ].map(pct),
    },
  ],
  annotations: [
    { target: 'Paid subscriptions', text: ['Paid subscriptions bring in', '60% of all US recorded', 'music revenue.'], x: 70, y: 210 },
    { target: "On-demand (ad-supported)", text: ["Ad-supported on-demand","streaming fell 2%, to","$1.8 billion."], x: 72, y: 1430 },
    { target: 'Album downloads', text: ['Album downloads fell 19%', 'and single downloads 15%.'], x: 505, y: 1430 },
    { target: "Vinyl LPs", text: ["Vinyl earned $1.4 billion,","its highest since 1984,","outselling CDs 44 million","to 33 million units."], x: 1580, y: 1245 },
  ],
});
