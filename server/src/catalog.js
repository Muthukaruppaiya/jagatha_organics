export const categories = [
  { slug: 'laddu', name: 'Laddu', blurb: 'Nut and millet laddus, rolled in small batches.', sortOrder: 1 },
  { slug: 'no-sugar-no-jaggery', name: 'No Sugar No Jaggery', blurb: 'Bars and laddus made without sugar or jaggery.', sortOrder: 2 },
  { slug: 'energy-delight', name: 'Energy Delight', blurb: 'Herb, millet, and nut bites for the afternoon.', sortOrder: 3 },
  { slug: 'snacks', name: 'Snacks', blurb: 'Traditional rice and millet murukku, sev, and malt.', sortOrder: 4 },
  { slug: 'gift-boxes', name: 'Gift Boxes', blurb: 'Assorted boxes for families and festivals.', sortOrder: 5 },
];

const tiers = {
  laddu: [
    { label: '200g', grams: 200, price: 27500, compare: 33000 },
    { label: '400g', grams: 400, price: 55000, compare: 66000 },
    { label: '800g', grams: 800, price: 110000, compare: 132000 },
  ],
  bar: [
    { label: '200g', grams: 200, price: 29000, compare: 35000 },
    { label: '400g', grams: 400, price: 58000, compare: 70000 },
    { label: '800g', grams: 800, price: 116000, compare: 140000 },
  ],
  snack: [
    { label: '200g', grams: 200, price: 22000, compare: 27000 },
    { label: '400g', grams: 400, price: 44000, compare: 54000 },
    { label: '800g', grams: 800, price: 88000, compare: 108000 },
  ],
  malt: [
    { label: '200g', grams: 200, price: 35000, compare: 39500 },
    { label: '400g', grams: 400, price: 70000, compare: 79000 },
    { label: '800g', grams: 800, price: 140000, compare: 158000 },
  ],
  gift888: [
    { label: '600g', grams: 600, price: 88800, compare: 105000 },
    { label: '1200g', grams: 1200, price: 177700, compare: 210000 },
  ],
  gift799: [
    { label: '600g', grams: 600, price: 79900, compare: 100000 },
    { label: '1200g', grams: 1200, price: 159900, compare: 200000 },
  ],
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
  p('peanut-laddu-2', 'Peanut Laddu', 'laddu', 'laddu', 'Roasted peanut laddu with a coarse, nutty bite. A bestseller from the Jagatha shelf.', true),
  p('white-sesame-laddu', 'White Sesame Laddu', 'laddu', 'laddu', 'White sesame laddu, toasted so the seeds stay fragrant and crisp at the edge.'),
  p('black-sesame-laddu-2', 'Black Sesame Laddu', 'laddu', 'laddu', 'Black sesame laddu with a deeper, toasted flavour than the white sesame batch.'),
  p('black-ulundhu-laddu', 'Black Ulundhu Laddu', 'laddu', 'laddu', 'Black urad laddu, slow-roasted and rolled the way home kitchens still make it.'),
  p('navadhanya-laddu-2', 'Navadhanya Laddu', 'laddu', 'laddu', 'Nine grains and lentils ground into a laddu for everyday snacking.', true),
  p('9-millets-laddu-2', '9 Millets Laddu', 'laddu', 'laddu', 'A laddu built on nine millets, with a warm grain flavour and a soft crumble.'),

  p('9-seeds-laddu-2', '9 Seeds / Biotin Laddu', 'no-sugar-no-jaggery', 'bar', 'A seed-heavy laddu from the no-sugar, no-jaggery range. Crunchy, not syrupy.'),
  p('dry-fruits-nut-seeds-cutlet-2', 'Dry Fruits Nut Seeds Cutlet', 'no-sugar-no-jaggery', 'bar', 'A cutlet of dry fruits, nuts, and seeds. No sugar and no jaggery added.'),
  p('moringa-protein-bar', 'Moringa Protein Bar', 'no-sugar-no-jaggery', 'bar', 'A moringa protein bar from the no-sugar shelf, pressed with nuts and seeds.', true),
  p('amla-protein-bar-2', 'Amla Protein Bar', 'no-sugar-no-jaggery', 'bar', 'Amla protein bar with a tart fruit note and a dense nut base.'),
  p('avarampoo-protein-bar-2', 'Avarampoo Protein Bar', 'no-sugar-no-jaggery', 'bar', 'Avarampoo protein bar, made without sugar or jaggery.'),
  p('curry-leaves-protein-bar-2', 'Curry Leaves Protein Bar', 'no-sugar-no-jaggery', 'bar', 'Curry-leaf protein bar. Savoury herbs against a sweet-nut base, with no added sugar.'),
  p('mudavattukaal-protein-bar', 'Mudavattukaal Protein Bar', 'no-sugar-no-jaggery', 'bar', 'Mudavattukaal protein bar from the no-sugar, no-jaggery collection.'),

  p('ashwagandha-badam', 'Ashwagandha Badam', 'energy-delight', 'bar', 'Ashwagandha and almond bites from the Energy Delight range.', true),
  p('athimadhuram-cashew', 'Athimadhuram Cashew', 'energy-delight', 'bar', 'Liquorice-root and cashew bites, gently sweet and nutty.'),
  p('pirandai-ragi', 'Pirandai Ragi', 'energy-delight', 'bar', 'Pirandai with ragi millet, rolled into a snack-size bite.'),
  p('mudakathan-varagu', 'Mudakathan Varagu', 'energy-delight', 'bar', 'Mudakathan leaves with varagu millet, in the Energy Delight line.'),
  p('choco-ragi', 'Choco Ragi', 'energy-delight', 'bar', 'Cocoa and ragi millet, for a chocolate note without a candy-bar texture.'),
  p('choco-kambu', 'Choco Kambu', 'energy-delight', 'bar', 'Cocoa with pearl millet, finished as a firm energy bite.'),
  p('rose-flower-cholam', 'Rose Flower Cholam', 'energy-delight', 'bar', 'Dried rose with sorghum millet. Floral, not perfumed.'),
  p('karisalankanni-samai', 'Karisalankanni Samai', 'energy-delight', 'bar', 'Karisalankanni greens with little millet.'),
  p('keezhanelli-kuthiraivalli', 'Keezhanelli Kuthiraivalli', 'energy-delight', 'bar', 'Keezhanelli with barnyard millet, from the Energy Delight shelf.'),
  p('joint-strength-balls', 'Joint Strength Balls', 'energy-delight', 'bar', 'A herb-and-millet ball from the Energy Delight range.'),

  p('mappillai-samba-murukku-2', 'Mappillai Samba Rice Murukku', 'snacks', 'snack', 'Crisp murukku made with Mappillai Samba rice. A tea-time snack with a grain flavour.', true),
  p('karuppu-kavuni-rice-murukku', 'Karuppu Kavuni Rice Murukku', 'snacks', 'snack', 'Murukku from black Kavuni rice, darker and toastier than the usual rice batch.'),
  p('thinai-millet-murukku', 'Thinai Millet Murukku', 'snacks', 'snack', 'Foxtail millet murukku, light and crisp.'),
  p('kambu-ragi-millet-mixture', 'Kambu Ragi Millet Mixture', 'snacks', 'snack', 'A mixture of pearl millet and ragi, fried the traditional snack way.'),
  p('varagu-millet-ribbon-pakoda', 'Varagu Millet Ribbon Pakoda', 'snacks', 'snack', 'Ribbon pakoda made with kodo millet. Thin, salty, and crisp.', true),
  p('poongar-rice-karasev', 'Poongar Rice Karasev', 'snacks', 'snack', 'Fine karasev from Poongar rice.'),
  p('kichili-samba-rice-ribbon-snacks', 'Kichili-Samba Rice Ribbon Snacks', 'snacks', 'snack', 'Ribbon snacks made with Kichili Samba rice.'),
  p('kaatuyanam-rice-crunchy-sev', 'Kaatuyanam Rice Crunchy Sev', 'snacks', 'snack', 'Crunchy sev from Kaatuyanam rice.'),
  p('thooyamalli-rice-ribbon-twist', 'Thooyamalli Rice Ribbon Twist', 'snacks', 'snack', 'A twisted ribbon snack made with Thooyamalli rice.'),
  p('abc-malt', 'ABC Malt', 'snacks', 'malt', 'A malt mix of grains, millets, nuts, and legumes. Stir it into warm milk.', true),

  p('biotin-gift-box', 'Biotin Gift Box', 'gift-boxes', 'gift888', 'An assorted box with dry-fruit nut seed cutlet, 9 seeds biotin laddu, curry leaves protein bar, and amla protein bar.', true),
  p('bone-muscle-strengthen-gift-box', 'Bone & Muscle Strengthen Gift Box', 'gift-boxes', 'gift888', 'A gift box of herb and millet snacks from the Jagatha assortment.'),
  p('energy-enrichment-gift-box', 'Energy Enrichment Gift Box', 'gift-boxes', 'gift888', 'A mixed box from the Energy Delight and millet range, packed for gifting.'),
  p('herbals-millets-gift-box', 'Herbals & Millets Gift Box', 'gift-boxes', 'gift888', 'Herbal bites and millet snacks together in one gift box.'),
  p('strength-builder-gift-box', 'Strength Builder Gift Box', 'gift-boxes', 'gift888', 'A larger assortment of laddus and bars, boxed for sharing.'),
  p('healthy-weight-gain-gift-box', 'Healthy Weight Gain Gift Box', 'gift-boxes', 'gift799', 'A family box of laddus, bars, and snacks from the Jagatha shelf.'),
  p('kids-special-snack-gift-box', 'Kids Special Snack Gift Box', 'gift-boxes', 'gift799', 'A milder assortment of snacks and sweets, boxed for children and families.'),
  p('sweet-snacks-gift-box', 'Sweet & Snacks Gift Box', 'gift-boxes', 'gift799', 'Sweets and savoury snacks packed together, for a house visit or a festival.'),
  p('mixed-laddu-box', 'Mixed Laddu Box', 'gift-boxes', 'laddu', 'A mix of the laddu shelf in one box. Same pack sizes as the single laddus.'),
  p('mixed-protein-bars-2', 'Mixed Protein Bars', 'gift-boxes', 'bar', 'A mix of the no-sugar protein bars, sold in the same 200g, 400g, and 800g packs.'),
];
