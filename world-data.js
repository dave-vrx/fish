'use strict';
/* ============================================================
   FISH! — Quests, Titles, Codes, World layout & Fishing pools
   ============================================================ */

/* Quests. req: [{fish:Name | rarity:Rarity | trash:true, count:n}] */
const QUESTS = [
  { id:'rusco_salmon',  name:"Rusco's Meal",             giver:'Rusco · Coconut Bay',        req:[{fish:'Atlantic Salmon'}],          coins:500,  xp:500, emoji:'🍽️' },
  { id:'rusco_hogfish', name:'Hungry for Hogfish',       giver:'Rusco · Coconut Bay',        req:[{fish:'Hogfish'}],                   coins:500,  xp:500, emoji:'🐷' },
  { id:'rusco_mahi',    name:'Mahi-Mahi?',               giver:'Rusco · Coconut Bay',        req:[{fish:'Mahi-Mahi'}],                 coins:500,  xp:500, emoji:'🐠' },
  { id:'lestat_blob',   name:'Blood of the Blob',        giver:'Lestat · Luxian Dunes',      req:[{fish:'Blobfish'}],                  coins:500,  xp:500, items:{speedP:5},  emoji:'🩸' },
  { id:'tommy_fly',     name:'Learning to Fly',          giver:'Tommy · Crescent Isle',      req:[{fish:'Flying Fish',count:10}],      coins:500,  xp:500, items:{scrap:5},   emoji:'🪽' },
  { id:'diana_letter',  name:'A Simple Letter',          giver:'Diana · Luxian Dunes',       req:[{fish:'Great White Shark'}],         coins:1000, xp:500, emoji:'✉️' },
  { id:'grimbee_trash', name:'Tanglewood Cleanup',       giver:'Grimbee · Tanglewood',       req:[{rarity:'Trash',count:10}],          coins:1000, xp:500, items:{scrap:10},  emoji:'🧹' },
  { id:'harrison_gator',name:'See you later, alligator!',giver:'Harrison · Luxian Crypt',    req:[{fish:'American Alligator'}],        title:'Archaeologist', xp:500, emoji:'🐊' },
  { id:'detective',     name:"The Detective's Apprentice",giver:'Hemlock · Lighthouse',      req:[{fish:'Halibut'}],                   coins:500,  xp:500, title:'Junior Detective', emoji:'🕵️' },
  { id:'breakin',       name:'The Break-in',             giver:'Oga · Luxian Dunes Pyramid', req:[{fish:'Bombfish'},{fish:'Mudskipper'},{fish:'Flame Guppy'}], coins:500, xp:500, unlock:'twilight', emoji:'🧨' },
  { id:'guardian',      name:'Guardian of the Realms',   giver:'Kuzo · Twilight Realm',      req:[{fish:'Tiger Shovelnose Catfish',count:10}], coins:40000, xp:500, emoji:'🏺' },
  { id:'onguard',       name:'On Guard!',                giver:'Kuzo · Twilight Realm',      req:[{fish:'Haddock'},{fish:'Albacore Tuna'},{fish:'Soft Shelled Turtle'},{fish:'Pinnate Batfish'}], coins:50000, xp:500, emoji:'🛡️' },
  { id:'harey',         name:'A Harey Situation',        giver:'Briar · Twilight Realm',     req:[{fish:'Bichir',count:2},{fish:'Nile Perch'}], xp:500, emoji:'🐰' },
  { id:'properintro',   name:'Proper Introduction',      giver:'Tobii · Twilight Realm',     req:[{fish:'Sailfish'}],                  coins:50000, xp:500, items:{luckP:10}, emoji:'🤝' },
  { id:'proveit',       name:'Prove it!',                giver:'Rexie · Coconut Bay',        req:[{fish:'Elephant Fish'}],             xp:500, emoji:'🐘' },
  { id:'skullscare',    name:'Skull Scare',              giver:'Wimblor · Crescent Isle',    req:[{fish:'Frog',count:5},{fish:'Black Scorpionfish'},{fish:'Cinderfin'}], coins:500, xp:500, emoji:'💀' },
  { id:'ominousegg',    name:'An Ominous Egg',           giver:'Lucia · Crescent Isle',      req:[{fish:'Leviathan Eye'}],             xp:1500, items:{egg:1}, emoji:'🥚' },
  { id:'paulie',        name:"Paulie's Lost Saw",        giver:'Paulie · Coconut Bay',       req:[{trash:true,count:1}],               xp:200, bobber:'paulie', emoji:'🪚' },
  { id:'undying',       name:'Undying Love',             giver:'Elessa · Twilight Realm',    req:[{fish:'Leviathan Eye'}], lvl:100,   xp:500, bobber:'undying', emoji:'❤️‍🔥' },
  { id:'galleon',       name:'The Footlocker',           giver:'Shipwreck · Ice Wall',       req:[{rarity:'Relic',count:3}],           xp:500, unlock:'boat_galleon', emoji:'⚓' },
  { id:'alien',         name:"Our Ship... It's Broken!", giver:'Lil\' Kevin · Luxian Dunes', req:[{fish:'Mudskipper'},{fish:'Humpback Gar'},{fish:'Mahi-Mahi'}], xp:500, unlock:'quest_alien', emoji:'👽' },
  { id:'sunleaf',       name:'Sunleaf Delivery',         giver:'Sunleaf · Any Dock',         req:[{fish:'Sunfish'}],                   coins:1000, xp:500, emoji:'📦' }
];

const TITLES = [
  { name:'Apprentice Angler',  how:'Catch 10 fishes',          type:'catch', n:10 },
  { name:'Seasoned Angler',    how:'Catch 100 fishes',         type:'catch', n:100 },
  { name:'Master Angler',      how:'Catch 500 fishes',         type:'catch', n:500 },
  { name:'Ascendant Angler',   how:'Catch 2000 fishes',        type:'catch', n:2000 },
  { name:'Transcendent Angler',how:'Catch 5000 fishes',        type:'catch', n:5000 },
  { name:'Divine Angler',      how:'Catch 10000 fishes',       type:'catch', n:10000 },
  { name:'Excited!',           how:'Reach level 10!',          type:'level', n:10 },
  { name:'Expert',             how:'Reach level 50!',          type:'level', n:50 },
  { name:'Aura Farmer',        how:'Reach level 100!',         type:'level', n:100 },
  { name:'Fish Fear Me',       how:'Reach level 200!',         type:'level', n:200 },
  { name:'Straw Hat Pirate!',  how:'Reach level 500!',         type:'level', n:500 },
  { name:'God of the Waters',  how:'Reach level 1000!',        type:'level', n:1000 },
  { name:'Salesman',           how:'Sell 10 fishes!',          type:'sell', n:10 },
  { name:'Sunleaf Affiliate',  how:'Sell 100 fishes!',         type:'sell', n:100 },
  { name:'Business Man',       how:'Sell 1000 fishes!',        type:'sell', n:1000 },
  { name:'Sunleaf Shareholder',how:'Sell 3000 fishes!',        type:'sell', n:3000 },
  { name:'CEO',                how:'Sell 10000 fishes!',       type:'sell', n:10000 },
  { name:'Bounty Hunter',      how:'Turn in 50 Bounties',      type:'bounty', n:50 },
  { name:'Nuts for Coconuts!', how:'Complete the Coconut Bay Index!', type:'index', loc:'Coconut Bay' },
  { name:'Patriotic Researcher',how:'Complete the Crescent Isle Index!', type:'index', loc:'Crescent Isle' },
  { name:'Through the Fire and Flames', how:'Complete the Volcanic Depths Index!', type:'index', loc:'Volcanic Depths' },
  { name:"Anubis' Disciple",   how:'Complete the Luxian Dunes Index!', type:'index', loc:'Luxian Dunes' },
  { name:'Ghostbuster',        how:'Complete the Tanglewood Index!', type:'index', loc:'Tanglewood' },
  { name:'Triple T',           how:'Complete the Twilight Realm Index!', type:'index', loc:'Twilight Realm' },
  { name:'Honorary Glorpingus',how:'Help Glorpingo find his wife!', type:'quest', q:'tommy_fly', bonus:true },
  { name:'Pastrami Enjoyer',   how:'Help Celly find her keys!',  type:'quest', q:'breakin', bonus:true },
  { name:'Junior Detective',   how:"Hemlock's Apprentice",       type:'quest', q:'detective' },
  { name:'Archaeologist',      how:'Helped out Harrison!',       type:'quest', q:'harrison_gator' },
  { name:'Transporter',        how:'Complete Sunleaf Delivery',  type:'quest', q:'sunleaf' },
  { name:'BETA TESTER',        how:'Redeem the secret SKULL code', type:'code', bonus:true, color:'#ffd166' },
  { name:'PINKFONG!',          how:'Redeem the secret PINKFONG code', type:'code', bonus:true, color:'#ff65b7' },
  { name:'WITCHY',             how:'Redeem the secret WITCHY code', type:'code', bonus:true, color:'#d9bd70' },
  { name:'CREATOR',            how:'Redeem the secret DAVEVR code', type:'code', bonus:true, color:'#ffffff', size:'large' }
];

const CODES = [
  { code:'1MVISITS',  reward:'5x Scrap Metal',                  active:true,  items:{scrap:5} },
  { code:'FISHLAUNCH',reward:'3x Speed Potion + 3x Luck Potion', active:false, items:{speedP:3,luckP:3} },
  { code:'STPADDYS',  reward:'5x Luck Potion + 25x Token',       active:false, items:{luckP:5} },
  { code:'LEVIATHAN', reward:'5x Speed Potion + 5x Mossy Relic', active:false, items:{speedP:5,relicMos:5} },
  { code:'MAKESHIP',  reward:'Vlad Autopet',                     active:false, items:{autopet:'vlad'} },
  { code:'SKULL',     reward:'Skullcrusher boat + BETA TESTER title', active:true, hidden:true, boats:['skull'], titles:['BETA TESTER'], badges:['betaTester'] },
  { code:'PINKFONG',  reward:'Pinkfong boat + PINKFONG! title', active:true, hidden:true, boats:['pinkfong'], titles:['PINKFONG!'], badges:['pinkfong'] },
  { code:'WITCHY',    reward:'Moonlit Sleep Token vessel + WITCHY title', active:true, hidden:true, boats:['witchy'], titles:['WITCHY'], badges:['witchy'], avatar:{gender:'female',skin:'fair',hair:'long',hairColor:'black',outfit:'violet',special:'witchy'} },
  { code:'DAVETEST',  reward:'Golden Beta Skiff + BETA TESTER title', active:true, hidden:true, boats:['davetest'], titles:['BETA TESTER'], badges:['daveTest'] },
  { code:'DAVEVR',    reward:'Creator yacht + CREATOR title', active:true, hidden:true, boats:['creator'], titles:['CREATOR'], badges:['creator'], equipTitle:'CREATOR', avatar:{gender:'male',skin:'fair',hair:'long',hairColor:'blonde',outfit:'gold',special:'creator'} }
];

/* Autopets — auto-sell your catches (toggle in Menu) */
const AUTOPETS = {
  vlad:{ name:'Vlad Autopet',  emoji:'🧛', how:'Redeemed the MAKESHIP code' },
  levi:{ name:'Leviathan Autopet', emoji:'🦈', how:'Hatched from the ominous egg quest' }
};

/* World size (world units) */
const WORLD_W = 4000, WORLD_H = 2700;

/* Islands: id, name, x, y, radius, water, theme, unlock, desc */
const ISLANDS = [
  { id:'coconut',   name:'Coconut Bay',    x:650,  y:620,  r:340, water:'Freshwater', theme:'tropical', desc:'Your home dock. Freshwater ponds & warm coastal waters.', spawn:true },
  { id:'crescent',  name:'Crescent Isle',  x:1750, y:480,  r:330, water:'Saltwater',  theme:'tropical', desc:'Honey-scented tropical isle. Gear shops & the Enchanting Altar.' },
  { id:'volcanic',  name:'Volcanic Depths',x:430,  y:1800, r:350, water:'Lava',       theme:'volcanic', desc:'Molten seas beyond the caldera. Requires Level 50.', unlock:'volcanic' },
  { id:'luxian',    name:'Luxian Dunes',   x:1780, y:1780, r:370, water:'Freshwater', theme:'desert',   desc:'Golden desert oasis — relics, pyramids & mystery.' },
  { id:'tanglewood',name:'Tanglewood',     x:2920, y:1030, r:330, water:'Swampwater', theme:'swamp',    desc:'Murky swamp waters crawling with gators & ghosts.' },
  { id:'twilight',  name:'Twilight Realm', x:3250, y:2050, r:340, water:'Any',        theme:'twilight', desc:'The land beyond the Pyramid. Unlock: The Break-in.', unlock:'twilight' },
  { id:'altar',     name:'The Altar',      x:2250, y:330,  r:95,  water:'Saltwater',  theme:'rock',     desc:'Enchant your rod here using relics.' }
];

/* Special fishing pools (circle areas) — POOL_MODS in fish-data.js */
const POOLS = [
  { name:'Strange Whirlpool', x:1180, y:1150, r:120 },
  { name:'Sandy Updraft',     x:320,  y:1080, r:95  },
  { name:'Savanna Rift',      x:2100, y:1180, r:95  },
  { name:'Shadow Chasm',      x:2650, y:2300, r:95  },
  { name:'Sparkling Pool',    x:2450, y:700,  r:95  },
  { name:'Ionized Fissure',   x:3200, y:1500, r:95  },
  { name:'Celestial Chasm',   x:3600, y:500,  r:95  },
  { name:'Midas Rift',        x:1000, y:2250, r:95  },
  { name:'Occult Pool',       x:2050, y:2350, r:95  }
];

/* Leviathan spawn area (active during even-hour UTC windows) */
const LEVIATHAN_SPOT = { name:'Leviathan Spawn', x:2520, y:1600, r:170 };

/* Open sea (anywhere else on the map) */
const OPEN_SEA = { name:'Open Sea', water:'Saltwater' };

const WEATHER_POOL = ['Clear','Clear','Rainy','Rainy','Stormy','Foggy','Moonrain','Ancient Tide'];
const TIME_POOL = ['Morning','Morning','Day','Day','Day','Day','Evening','Evening','Night','Night'];

const TIME_ICONS = { Morning:'🌅', Day:'☀️', Evening:'🌇', Night:'🌙' };
const WEATHER_ICONS = { Clear:'🌤️', Rainy:'🌧️', Stormy:'⛈️', Foggy:'🌫️', Moonrain:'🌕', 'Ancient Tide':'🌊' };
