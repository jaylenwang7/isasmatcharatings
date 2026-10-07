// Best first, in Isa's words. Each tier's colors live in index.css under [data-tier]:
// they fade from vivid ceremonial green to oxidized brown, the way matcha does as it gets worse
export const TIERS = [
  { letter: 'S', description: 'This matcha is good af - the best of the best, would go out of my way for it' },
  { letter: 'A', description: 'Would be happy to have this matcha any day of the week' },
  { letter: 'B', description: 'Solid choice, would be happy to get this at a cafe' },
  { letter: 'C', description: 'Decent matcha when you need to order something at a cafe' },
  { letter: 'D', description: 'Bruh, lackluster, would not recommend' },
  { letter: 'F', description: 'Would avoid and maybe not even finish' },
];

export const TIER_RANK = Object.fromEntries(TIERS.map((tier, index) => [tier.letter, index]));
