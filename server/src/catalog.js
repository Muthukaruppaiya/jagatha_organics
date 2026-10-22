export const CATALOG_VERSION = '2026-10-drive-images';

export const categories = [
  { slug: 'no-sugar-no-jaggery', name: 'No Sugar No Jaggery', blurb: 'Bars, cutlets, and laddus made without sugar or jaggery.', sortOrder: 1 },
  { slug: 'laddu', name: 'Healthy Laddus', blurb: 'Millet, seed, and lentil laddus.', sortOrder: 2 },
  { slug: 'nutri-bar', name: 'Nutri Bar', blurb: 'Choco nutribars made with traditional rice and millets.', sortOrder: 3 },
  { slug: 'halwa', name: 'Halwa', blurb: 'Dry fruit halwa.', sortOrder: 4 },
  { slug: 'snacks', name: 'Snacks', blurb: 'Traditional rice and millet murukku, mixture, and karasev.', sortOrder: 5 },
  { slug: 'energy-delight', name: 'Energy Delight Laddu', blurb: 'Herb, root, and millet energy laddus.', sortOrder: 6 },
  { slug: 'health-mix', name: 'Health Mix', blurb: 'Kanji and health mixes from rice, millets, and black ulundhu.', sortOrder: 7 },
  { slug: 'malt', name: 'Malt', blurb: 'Millet, dry fruit, and nut malts.', sortOrder: 8 },
];

const packs = (small, medium, large) => [
  { label: '200g', grams: 200, price: small[0], compare: small[1] },
  { label: '400g', grams: 400, price: medium[0], compare: medium[1] },
  { label: '800g', grams: 800, price: large[0], compare: large[1] },
];

const tiers = {
  laddu: packs([27500, 33000], [55000, 66000], [110000, 132000]),
  bar: packs([29000, 35000], [58000, 70000], [116000, 140000]),
  snack: packs([22000, 27000], [44000, 54000], [88000, 108000]),
  malt: packs([35000, 39500], [70000, 79000], [140000, 158000]),
};

const p = (slug, name, category, tier, description, featured = false) => ({
  slug,
  name,
  category,
  variants: tiers[tier],
  description,
  featured,
});

export const products = [
  p('dry-fruits-nut-seeds-cutlet-2', 'Dryfruits Nuts Seeds Cutlet', 'no-sugar-no-jaggery', 'bar', 'A cutlet of dry fruits, nuts, and seeds. No sugar and no jaggery added.', true),
  p('9-seeds-laddu-2', '9 Seeds Biotin Laddu', 'no-sugar-no-jaggery', 'bar', 'A seed-heavy laddu made with nine seeds. No sugar and no jaggery added.', true),
  p('moringa-protein-bar', 'Moringa Protein Bar', 'no-sugar-no-jaggery', 'bar', 'Moringa protein bar pressed with nuts and seeds. No sugar and no jaggery added.', true),
  p('avarampoo-protein-bar-2', 'Avarampoo Protein Bar', 'no-sugar-no-jaggery', 'bar', 'Avarampoo protein bar made with nuts and seeds. No sugar and no jaggery added.'),
  p('curry-leaves-protein-bar-2', 'Curry Leaves Protein Bar', 'no-sugar-no-jaggery', 'bar', 'Curry leaves protein bar with a nut and seed base. No sugar and no jaggery added.'),
  p('mudavattukaal-protein-bar', 'Mudavatukal Protein Bar', 'no-sugar-no-jaggery', 'bar', 'Mudavatukal protein bar made with nuts and seeds. No sugar and no jaggery added.'),
  p('amla-protein-bar-2', 'Amla Protein Bar', 'no-sugar-no-jaggery', 'bar', 'Amla protein bar with a nut and seed base. No sugar and no jaggery added.'),
  p('pirandai-protein-bar', 'Pirandai Protein Bar', 'no-sugar-no-jaggery', 'bar', 'Pirandai protein bar made with nuts and seeds. No sugar and no jaggery added.'),

  p('navadhanya-laddu-2', 'Navadhanya Laddu', 'laddu', 'laddu', 'Nine grains and lentils ground into a laddu for everyday snacking.', true),
  p('black-ulundhu-laddu', 'Black Ulundhu Laddu', 'laddu', 'laddu', 'Black urad laddu, slow-roasted and rolled the way home kitchens make it.'),
  p('9-millets-laddu-2', '9 Millets Laddu', 'laddu', 'laddu', 'A laddu built on nine millets, with a warm grain flavour and a soft crumble.'),
  p('peanut-laddu-2', 'Peanut Laddu', 'laddu', 'laddu', 'Roasted peanut laddu with a coarse, nutty bite.', true),
  p('black-sesame-laddu-2', 'Black Sesame Laddu', 'laddu', 'laddu', 'Black sesame laddu with a deep, toasted flavour.'),
  p('white-sesame-laddu', 'White Sesame Laddu', 'laddu', 'laddu', 'White sesame laddu, toasted so the seeds stay fragrant.'),

  p('karuppu-kavuni-choco-nutribar', 'Karuppu-kavuni Choco Nutribar', 'nutri-bar', 'bar', 'Choco nutribar made with Karuppu Kavuni rice.'),
  p('mappillai-samba-choco-nutribar', 'Mappillai-samba Choco Nutribar', 'nutri-bar', 'bar', 'Choco nutribar made with Mappillai Samba rice.'),
  p('choco-ragi-nutribar', 'Choco Ragi Nutribar', 'nutri-bar', 'bar', 'Choco nutribar made with ragi.'),
  p('hemoglobin-booster-nutribar', 'Hemoglobin Booster Nutribar', 'nutri-bar', 'bar', 'Nutribar made with Rathasali rice, black ulundhu, ragi, and nuts.'),
  p('poongar-choco-nutribar', 'Poongar Choco Nutribar', 'nutri-bar', 'bar', 'Choco nutribar made with Poongar rice.'),
  p('bone-joint-strength-nutribar', 'Bone & Joint Strength Nutribar', 'nutri-bar', 'bar', 'Nutribar from the Jagatha nutri bar range.'),

  p('abc-dryfruits-halwa', 'ABC Dryfruits Halwa', 'halwa', 'bar', 'Apple, beetroot, and carrot halwa with dry fruits.'),
  p('moringa-dryfruits-halwa', 'Moringa Dryfruits Halwa', 'halwa', 'bar', 'Moringa halwa with dry fruits.'),

  p('mappillai-samba-murukku-2', 'Mappillai-samba Murukku', 'snacks', 'snack', 'Crisp murukku made with Mappillai Samba rice.', true),
  p('varagu-millet-ribbon-pakoda', 'Varagu Ribbon Pakoda', 'snacks', 'snack', 'Ribbon pakoda made with varagu (kodo) millet. Thin, salty, and crisp.'),
  p('kambu-ragi-millet-mixture', 'Kambu Ragi Mixture', 'snacks', 'snack', 'A mixture of kambu and ragi, fried the traditional snack way.'),
  p('poongar-rice-karasev', 'Poongar Rice Karasev', 'snacks', 'snack', 'Fine karasev made with Poongar rice.'),

  p('ashwagandha-badam', 'Ashwagandha Root Badam Energy Delight', 'energy-delight', 'bar', 'Ashwagandha root and almond energy laddu.', true),
  p('athimadhuram-cashew', 'Athimadhuram Root Cashew Energy Delight', 'energy-delight', 'bar', 'Athimadhuram root and cashew energy laddu.'),
  p('pirandai-ragi', 'Pirandai Ragi Energy Delight', 'energy-delight', 'bar', 'Pirandai with ragi, rolled into an energy laddu.'),
  p('mudakathan-varagu', 'Mudakathan Varagu Energy Delight', 'energy-delight', 'bar', 'Mudakathan leaves with varagu millet.'),
  p('choco-kambu', 'Choco Kambu Energy Delight', 'energy-delight', 'bar', 'Cocoa with kambu (pearl millet).'),
  p('keezhanelli-kuthiraivalli', 'Keezhanelli Kuthiraivalli Energy Delight', 'energy-delight', 'bar', 'Keezhanelli with kuthiraivalli (barnyard millet).'),
  p('karisalankanni-samai', 'Karisalankanni Samai Energy Delight', 'energy-delight', 'bar', 'Karisalankanni greens with samai (little millet).'),
  p('rose-flower-cholam', 'Rose Cholam Energy Delight', 'energy-delight', 'bar', 'Dried rose with cholam (sorghum).'),

  p('karuppu-kavuni-weightloss-kanji-mix', 'Karuppu-kavuni Weightloss Kanji Mix', 'health-mix', 'malt', 'Kanji mix made with Karuppu Kavuni rice.', true),
  p('mappillai-samba-health-mix', 'Mappillai-samba Health Mix', 'health-mix', 'malt', 'Health mix made with Mappillai Samba rice.'),
  p('black-ulundhu-health-mix', 'Black Ulundhu Health Mix', 'health-mix', 'malt', 'Health mix made with black ulundhu.'),
  p('ragi-black-ulundhu-health-mix', 'Ragi Black Ulundhu Health Mix', 'health-mix', 'malt', 'Health mix made with ragi and black ulundhu.'),

  p('multi-millet-black-ulundhu-choco-malt', 'Multi Millet Black Ulundhu Choco Malt', 'malt', 'malt', 'Choco malt made with millets and black ulundhu.'),
  p('dryfruits-nuts-protein-pro-choco-malt', 'DryfruitsNuts Protein Pro Choco Malt', 'malt', 'malt', 'Choco malt made with dry fruits and nuts.', true),
  p('dryfruits-nuts-protein-pro-elachi', 'DryfruitsNuts Protein Pro Elachi Flavour', 'malt', 'malt', 'Elachi-flavoured malt made with dry fruits and nuts.'),
  p('navagraha-balance-malt', 'Navagraha Balance Malt (Astro Malt)', 'malt', 'malt', 'Navagraha balance malt from the Jagatha malt range.'),
  p('abc-malt', 'ABC Malt', 'malt', 'malt', 'A malt mix of grains, millets, nuts, and legumes. Stir it into warm milk.', true),
];

export const banners = [
  {
    title: 'Biotin Gift Box',
    subtitle: 'Hair and skin care combo: dry fruit cutlet, 9 seeds biotin laddu, curry leaves protein bar, and amla protein bar.',
    buttonLabel: 'Shop the set',
    link: '/shop/no-sugar-no-jaggery',
    image: '/banner-images/biotin-gift-box.png',
    productSlug: '',
    variantLabel: '',
  },
  {
    title: '9 Seeds Biotin Laddu',
    subtitle: 'A seed-heavy laddu made with nine seeds. No sugar and no jaggery added.',
    buttonLabel: 'Order now',
    link: '',
    image: '/media/no-sugar-no-jaggery/9-seeds-laddu-2-1.jpg',
    productSlug: '9-seeds-laddu-2',
    variantLabel: '200g',
  },
  {
    title: 'DryfruitsNuts Protein Pro Choco Malt',
    subtitle: 'Choco malt made with dry fruits and nuts.',
    buttonLabel: 'Order now',
    link: '',
    image: '/media/malt/dryfruits-nuts-protein-pro-choco-malt-1.jpg',
    productSlug: 'dryfruits-nuts-protein-pro-choco-malt',
    variantLabel: '200g',
  },
  {
    title: 'Karuppu-kavuni Weightloss Kanji Mix',
    subtitle: 'Kanji mix made with Karuppu Kavuni rice.',
    buttonLabel: 'Order now',
    link: '',
    image: '/media/health-mix/karuppu-kavuni-weightloss-kanji-mix-1.jpg',
    productSlug: 'karuppu-kavuni-weightloss-kanji-mix',
    variantLabel: '200g',
  },
];
