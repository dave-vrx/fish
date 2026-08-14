'use strict';
/* ============================================================
   FISH! — Gear, Boats, Enchantments, Items & Potions
   ============================================================ */

const RODS = [
  { id:'stick',       name:'Stick and String',     emoji:'🥢', cost:0,        src:'Default Rod',        luck:-50, str:0, exp:0, att:0,   big:0,    maxW:5,       unlock:null },
  { id:'sunleaf',     name:'Sunleaf Rod',          emoji:'🎋', cost:0,        src:'Sell Shops',         luck:10,  str:5, exp:10, att:25,  big:15,   maxW:250,     unlock:null },
  { id:'toy',         name:'Toy Rod',              emoji:'🧸', cost:750,      src:'Coconut Bay',        luck:0,   str:0, exp:0, att:0,   big:0,    maxW:15,      unlock:null },
  { id:'sturdy',      name:'Sturdy Wooden Rod',    emoji:'🪵', cost:2000,     src:'Coconut Bay',        luck:15,  str:0, exp:5, att:20,  big:0,    maxW:30,      unlock:null },
  { id:'slim',        name:'Slim Rod',             emoji:'🎣', cost:10000,    src:'Coconut Bay',        luck:20,  str:10,exp:10, att:25,  big:20,   maxW:500,     unlock:null },
  { id:'telescopic',  name:'Telescopic Rod',       emoji:'🔭', cost:15000,    src:'Coconut Bay',        luck:10,  str:15,exp:15, att:10,  big:5,    maxW:2005,    unlock:null },
  { id:'metallic',    name:'Metallic Rod',         emoji:'🔩', cost:15000,    src:'Coconut Bay',        luck:0,   str:55,exp:55, att:10,  big:10,   maxW:1000,    unlock:null },
  { id:'darkwood',    name:'Darkwood Rod',         emoji:'🌳', cost:25000,    src:'Tanglewood',         luck:30,  str:10,exp:10, att:30,  big:5,    maxW:1800,    unlock:null },
  { id:'speedy',      name:'Speedy Rod',           emoji:'⚡', cost:55000,    src:'Crescent Isle',      luck:1,   str:5, exp:5, att:60,  big:0,    maxW:1500,    unlock:null },
  { id:'fortunate',   name:'Fortunate Rod',        emoji:'🍀', cost:75000,    src:'Crescent Isle',      luck:100, str:10,exp:5, att:10,  big:65,   maxW:1500,    unlock:null },
  { id:'alien',       name:'Alien Rod',            emoji:'👽', cost:200000,   src:'Alien Quest',        luck:55,  str:10,exp:10, att:45,  big:30,   maxW:32000,   unlock:null },
  { id:'rustfang',    name:'Rustfang Rod',         emoji:'🦴', cost:250000,   src:'Luxian Dunes',       luck:70,  str:20,exp:20, att:25,  big:35,   maxW:35000,   unlock:null },
  { id:'runesteel',   name:'Runesteel Rod',        emoji:'🗿', cost:700000,   src:'Vlad',               luck:90,  str:25,exp:20, att:30,  big:40,   maxW:100000,  unlock:null },
  { id:'pharaoh',     name:'Rod of the Pharaoh',   emoji:'🐪', cost:750000,   src:'Luxian Dunes',       luck:222, str:20,exp:40, att:-10, big:35,   maxW:100000,  unlock:null },
  { id:'perpetuity',  name:'Rod of Perpetuity',    emoji:'♾️', cost:0,        src:'Reach level 500',    luck:150, str:30,exp:30, att:50,  big:10,   maxW:500000,  unlock:'lvl500' },
  { id:'leviathan',   name:'Leviathan Rod',        emoji:'🦈', cost:1000000,  src:"Tomina's Crafting",  luck:500, str:20,exp:20, att:25,  big:35,   maxW:100000,  unlock:null }
];

const LINES = [
  { id:'basic',      name:'Basic Line',          emoji:'🧵', cost:0,      src:'Default Line',           luck:0, str:0,  exp:0, att:0, big:0  },
  { id:'aquamarine', name:'Aquamarine Line',     emoji:'💠', cost:100,    src:'Coconut Bay',            luck:0, str:0,  exp:0, att:5, big:0  },
  { id:'carbon',     name:'Carbon Line',         emoji:'🖤', cost:1000,   src:'Coconut Bay',            luck:0, str:7,  exp:7, att:0, big:0  },
  { id:'heavy',      name:'Heavy Duty Line',     emoji:'⛓️', cost:4000,   src:'Crescent Isle',          luck:0, str:10, exp:10, att:0, big:10 },
  { id:'flavored',   name:'Flavored Line',       emoji:'🍭', cost:10000,  src:'Tanglewood',             luck:0, str:0,  exp:0, att:0, big:30 },
  { id:'lucky',      name:'Lucky Line',          emoji:'🍀', cost:10000,  src:'Crescent Isle',          luck:30,str:0,  exp:0, att:0, big:0  },
  { id:'diamond',    name:'Diamond Line',        emoji:'💎', cost:25000,  src:'Luxian Dunes',           luck:25,str:15, exp:15, att:10, big:0  },
  { id:'cerberus',   name:'Fur of Cerberus',     emoji:'🔥', cost:35000,  src:'Vlad',                   luck:25,str:-5, exp:-15, att:20, big:10 },
  { id:'midas',      name:'Midas Line',          emoji:'🪙', cost:50000,  src:'Twilight Realm',         luck:60,str:15, exp:10, att:15, big:5  },
  { id:'ethereal',   name:'Ethereal Line',       emoji:'🌌', cost:0,      src:'Quest: Our Ship... It\'s Broken!', luck:75,str:-5, exp:-15, att:20, big:20, unlock:'quest_alien' }
];

const BOBBERS = [
  { id:'basic',       name:'Basic Bobber',       emoji:'🟠', cost:0,      src:'Default Bobber',          luck:0, str:0, exp:0, att:0, big:0  },
  { id:'paulie',      name:"Paulie's Bobber",    emoji:'🪚', cost:0,      src:"Quest: Paulie's Lost Saw", luck:0, str:0, exp:5, att:5, big:0, unlock:'quest_paulie' },
  { id:'blue',        name:'Blue Bobber',        emoji:'🔵', cost:100,    src:'Coconut Bay',             luck:5, str:0, exp:0, att:0, big:0  },
  { id:'dud',         name:'Dud Bobber',         emoji:'🥚', cost:1000,   src:'Crescent Isle',           luck:5, str:0, exp:5, att:0, big:0  },
  { id:'feline',      name:'Feline Bobber',      emoji:'🐱', cost:2000,   src:'Tanglewood',              luck:5, str:0, exp:0, att:0, big:10 },
  { id:'ornamental',  name:'Ornamental Bobber',  emoji:'🎀', cost:10000,  src:'Luxian Dunes',            luck:10,str:5, exp:0, att:10, big:0 },
  { id:'lucky',       name:'Lucky Bobber',       emoji:'🪬', cost:10000,  src:'Luxian Dunes',            luck:40,str:0, exp:0, att:0, big:0  },
  { id:'slime',       name:'Rainbow Slime Bobber', emoji:'🫧', cost:35000, src:'Vlad',                   luck:30,str:10, exp:0, att:10, big:10 },
  { id:'pyramid',     name:'Pyramid Bobber',     emoji:'🔺', cost:50000,  src:'Twilight Realm',          luck:50,str:10, exp:0, att:10, big:10 },
  { id:'undying',     name:'Undying Heart',      emoji:'❤️‍🔥', cost:0,     src:'Quest: Undying Love',     luck:50,str:20, exp:20, att:10, big:5, unlock:'quest_undying' }
];

/* star ratings → numbers (maxSpeed, accel, toughness, boost) */
const BOATS = [
  { id:'surf',       name:'Surfboard',        emoji:'🏄', cost:800,      tier:1, seats:1,  speed:1, accel:2, tough:1,  boost:0.5 },
  { id:'canoe',      name:'Canoe',            emoji:'🛶', cost:2000,     tier:1, seats:4,  speed:1, accel:2, tough:1,  boost:0.5 },
  { id:'rowboat',    name:'Rowboat',          emoji:'🚣', cost:3000,     tier:1, seats:6,  speed:1, accel:2, tough:1,  boost:0.5 },
  { id:'enthusiast', name:'Enthusiast Boat',  emoji:'🚤', cost:15000,    tier:3, seats:3,  speed:2, accel:2, tough:1,  boost:0.5 },
  { id:'dingy',      name:'Dingy',            emoji:'⛵', cost:30000,    tier:3, seats:6,  speed:2, accel:2, tough:1,  boost:0.5 },
  { id:'yacht',      name:'Lil Yacht',        emoji:'🛥️', cost:200000,   tier:4, seats:6,  speed:3, accel:3, tough:2.5,boost:1   },
  { id:'luxury',     name:'Luxury Speedboat', emoji:'🏎️', cost:1000000,  tier:5, seats:7,  speed:4, accel:4, tough:2.5,boost:5   },
  { id:'manta',      name:'Manta',            emoji:'🐋', cost:4000000,  tier:5, seats:7,  speed:4, accel:4, tough:2.5,boost:5   },
  { id:'stego',      name:'Stego III',        emoji:'🦖', cost:null,     tier:4, seats:6,  speed:3, accel:3, tough:2.5,boost:1, src:'Roulette (1% — $50,000 a spin)' },
  { id:'galleon',    name:'Galleon',          emoji:'⛴️', cost:8000000,  tier:3, seats:11, speed:2, accel:2, tough:1,  boost:0.5, unlock:'quest_galleon' },
  { id:'skull',      name:'Skullcrusher',     emoji:'💀', cost:0,        tier:5, seats:4,  speed:4, accel:4, tough:2.5,boost:5, src:'Secret code: SKULL', unlock:'code_skull' }
];

/* Enchantments (name, rarity, special, luck, str, exp, att, big, maxW, xp%) */
const ENCHANTS = [
  ['Big Catch Boost','Common','',0,0,0,0,10,0,0],
  ['Curious','Common','',0,0,0,5,0,0,5],
  ['Expert','Common','',0,0,10,0,0,0,0],
  ['Lazy','Common','',10,10,75,-75,10,0,0],
  ['Lucky','Common','',15,0,0,0,0,0,0],
  ['Pocket Watcher','Common','Earn 5% of fish value on catch',0,0,0,0,0,0,0],
  ['Powerful','Common','',0,10,0,0,0,0,0],
  ['Reinforced','Common','',0,0,0,0,0,400,0],
  ['Speedy','Common','',0,0,0,10,0,0,0],
  ['Trash Wrangler','Common','',-100,0,0,20,0,0,0],
  ['Day Walker','Uncommon','Stats active during daytime',50,0,0,0,0,0,0],
  ['Fog Dweller','Uncommon','Stats active during fog',50,0,0,0,0,0,0],
  ['Impatient','Uncommon','',-30,0,0,30,0,0,0],
  ['Night Stalker','Uncommon','Stats active at night',0,0,0,35,0,0,0],
  ['Power Grip','Uncommon','',0,15,15,0,0,0,0],
  ['Rain Lover','Uncommon','Stats active during rain/storms',50,0,0,0,0,0,0],
  ['Student','Uncommon','',0,0,5,0,0,0,12],
  ['Tubby Chaser','Uncommon','',0,0,0,0,5,1000,0],
  ['Undecided','Uncommon','',5,5,5,5,5,5,0],
  ['Unstable','Uncommon','1.5x mutation rate',10,-10,-10,0,0,0,0],
  ['All-Rounder','Rare','',10,10,10,10,10,100,0],
  ['Demon Hunter','Rare','15% chance to convert fish to Cursed',0,10,0,0,0,0,0],
  ['Dimensional Line','Rare','30% chance to catch a fish from any biome',0,0,10,0,0,0,0],
  ['Enlightened','Rare','',0,0,10,0,0,0,35],
  ['Light-Speed Reels','Rare','',0,0,0,40,0,0,0],
  ['Luck Sacrifice','Rare','',-60,0,0,60,0,0,0],
  ['Mouth-Watering','Rare','',0,0,0,25,30,0,0],
  ['Notoriously Big','Rare','',0,0,0,0,10,50000,0],
  ['Patient','Rare','',100,0,0,-40,0,0,0],
  ['The Night Watcher','Rare','Stats active at night',30,10,10,30,30,25000,0],
  ['BIG BOYS ONLY','Epic','',0,0,0,0,65,100000,0],
  ['Double Up!!','Epic','25% chance to catch 2 fish at once',20,0,0,0,0,0,0],
  ['Luck of the Chosen','Epic','',100,0,0,0,10,0,0],
  ['Master of Balance','Epic','',20,20,20,20,20,400,0],
  ['Money Maker','Epic','Earn an extra 20% of the fish\'s value on catch',0,0,0,0,20,0,0],
  ['Mutator','Epic','2x mutation rate',30,0,0,0,0,0,0],
  ['Shiny Hunter','Epic','20% chance to convert fish to Shiny',80,0,0,0,0,0,0],
  ['Son of Kriptan','Epic','Stats active during daytime',50,10,10,50,50,50000,0],
  ['Speed Demon','Epic','5% chance to convert fish to Cursed',0,0,0,60,0,0,0],
  ['God\'s Own Luck','Legendary','',250,0,0,0,0,0,0],
  ['Messenger of the Heavens','Legendary','',0,0,0,100,0,0,0],
  ['Strongest Angler','Legendary','',20,85,85,10,20,1000000,0]
].map((e,i)=>({
  id:'ench'+i, name:e[0], rarity:e[1], fx:e[2],
  luck:e[3], str:e[4], exp:e[5], att:e[6], big:e[7], maxW:e[8], xp:e[9]
}));

const ENCHANT_RARITY_W = { Common:50, Uncommon:25, Rare:15, Epic:8, Legendary:2 };
const RELIC_POINTS = { 'Old Relic Piece':1, 'Mossy Relic':3, 'Powerful Relic':6 };
const ENCHANT_PITY = 200;

/* consumables & materials */
const ITEMS = {
  scrap:   { name:'Scrap Metal',    emoji:'⚙️', sell:20 },
  speedP:  { name:'Speed Potion',   emoji:'🧪', sell:150 },
  luckP:   { name:'Luck Potion',    emoji:'🍀', sell:150 },
  relicOld:{ name:'Old Relic Piece', emoji:'🏺', sell:250 },
  relicMos:{ name:'Mossy Relic',    emoji:'🪨', sell:750 },
  relicPow:{ name:'Powerful Relic', emoji:'💫', sell:1500 },
  egg:     { name:'Leviathan Egg',  emoji:'🥚', sell:0 }
};
