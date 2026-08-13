'use strict';
/* ============================================================
   FISH! — Fish catalog, rarities, mutations & locations
   Fish entry: [name, rarity, water, weather, time, minW, maxW, img]
   - weather: Any | Clear | Rainy | Stormy | Foggy | Moonrain
   - minW/maxW in kg, "-" = unknown (falls back to a default roll)
   ============================================================ */

const RARITIES = {
  Abundant:        { w:27.0,  xp:15, xpPerfect:23, val:1.4,  color:'#f5f5f5' },
  Common:          { w:25.0,  xp:15, xpPerfect:23, val:1.8,  color:'#4caf50' },
  Curious:         { w:18.0,  xp:20, xpPerfect:30, val:2.6,  color:'#42a5f5' },
  Elusive:         { w:11.0,  xp:20, xpPerfect:30, val:3.8,  color:'#9c27b0' },
  Fabled:          { w:4.4,   xp:35, xpPerfect:53, val:6.0,  color:'#ffd24a' },
  Mythic:          { w:2.5,   xp:45, xpPerfect:68, val:9.0,  color:'#f44336' },
  Exotic:          { w:0.085, xp:50, xpPerfect:75, val:15.0, color:'#b026ff' },
  Trash:           { w:9.0,   xp:10, xpPerfect:10, val:0.6,  color:'#8a8a8a' },
  Relic:           { w:2.5,   xp:25, xpPerfect:38, val:20.0, color:'#ff8c00' },
  Secret:          { w:0.01,  xp:60, xpPerfect:90, val:45.0, color:'#ff3d8a' },
  'Ultimate Secret':{ w:0.005, xp:70, xpPerfect:105, val:60.0, color:'#ffd24a' },
  StPaddys:        { w:0.02,  xp:100, xpPerfect:150, val:25.0, color:'#5ce07a' }
};

const MUTATIONS = [
  { name:'Cursed',        mult:1.1 },
  { name:'Sandy',         mult:1.2 },
  { name:'Stone',         mult:1.3 },
  { name:'Zebra',         mult:1.3 },
  { name:'Negative',      mult:1.5 },
  { name:'Albino',        mult:1.5 },
  { name:'Ghastly',       mult:1.5 },
  { name:'Glitched',      mult:1.5 },
  { name:'Tiger',         mult:1.6 },
  { name:'Camo',          mult:1.8 },
  { name:'Void',          mult:2.0 },
  { name:'Shadow',        mult:2.0 },
  { name:'Shiny',         mult:2.0 },
  { name:'Frozen',        mult:2.0 },
  { name:'Blessed',       mult:3.0 },
  { name:'Golden',        mult:3.0 },
  { name:'Galaxy',        mult:3.0 },
  { name:'Radioactive',   mult:3.0 },
  { name:'Rainbow',       mult:3.0 },
  { name:'Burning',       mult:4.0 },
  { name:'Electric',      mult:4.0 },
  { name:'Holographic',   mult:5.0 },
  { name:'Static',        mult:5.0 }
];

/* Special pool fishing areas: location name -> modifier */
const POOL_MODS = {
  'Strange Whirlpool': { mutation:1.5, luck:2,   desc:'1.5x mutations · 2x luck' },
  'Sandy Updraft':     { mut:['Sandy'],           desc:'1.9x chance of Sandy fish' },
  'Savanna Rift':      { mut:['Tiger','Zebra'],   desc:'1.9x chance of Tiger & Zebra' },
  'Shadow Chasm':      { mut:['Shadow'],          desc:'1.9x chance of Shadow fish' },
  'Sparkling Pool':    { mut:['Shiny'],           desc:'1.9x chance of Shiny fish' },
  'Ionized Fissure':   { mut:['Radioactive'],     desc:'1.9x chance of Radioactive fish' },
  'Celestial Chasm':   { mut:['Galaxy'],          desc:'1.9x chance of Galaxy fish' },
  'Midas Rift':        { mut:['Golden'],          desc:'1.9x chance of Gold fish' },
  'Occult Pool':       { mut:['Cursed'],          desc:'1.9x chance of Cursed fish' }
};

/* location : [fish, ...] */
const FISH_DATA = {

  'Coconut Bay': [
    ['Bream','Abundant','Freshwater','Any','Day','1','6','https://static.wikitide.net/fishwikiwiki/thumb/8/8c/Bream.webp/120px-Bream.webp.png'],
    ['Roach','Abundant','Freshwater','Any','Evening','0.2','2','https://static.wikitide.net/fishwikiwiki/thumb/9/99/Roach.webp/120px-Roach.webp.png'],
    ['Goldfish','Abundant','Freshwater','Clear','Any','0.5','2','https://static.wikitide.net/fishwikiwiki/thumb/4/4f/Goldfish.webp/120px-Goldfish.webp.png'],
    ['Mackerel','Abundant','Saltwater','Foggy','Any','0.2','2.5','https://static.wikitide.net/fishwikiwiki/thumb/6/6d/Mackerel.webp/120px-Mackerel.webp.png'],
    ['Needlefish','Abundant','Saltwater','Stormy','Any','0.9','11','https://static.wikitide.net/fishwikiwiki/thumb/5/59/Needlefish.webp/120px-Needlefish.webp.png'],
    ['Carp','Common','Freshwater','Any','Morning','2','45','https://static.wikitide.net/fishwikiwiki/thumb/a/af/Carp.webp/120px-Carp.webp.png'],
    ['Black Shark Minnow','Common','Freshwater','Rainy','Any','1','6','https://static.wikitide.net/fishwikiwiki/thumb/d/d6/Black_Sharkminnow.webp/120px-Black_Sharkminnow.webp.png'],
    ['Boxfish','Common','Saltwater','Any','Any','0.4','4','https://static.wikitide.net/fishwikiwiki/thumb/f/fa/Boxfish.webp/120px-Boxfish.webp.png'],
    ['Gulper Eel','Common','Saltwater','Any','Any','1','20','https://static.wikitide.net/fishwikiwiki/thumb/c/ca/Gulper_Eel.webp/120px-Gulper_Eel.webp.png'],
    ['John Dory','Common','Saltwater','Any','Any','1','8','https://static.wikitide.net/fishwikiwiki/thumb/9/9a/John_Dory.webp/120px-John_Dory.webp.png'],
    ['Lionfish','Curious','Saltwater','Any','Night','0.1','1.5','https://static.wikitide.net/fishwikiwiki/thumb/3/3a/Lionfish.webp/120px-Lionfish.webp.png'],
    ['Northern Pufferfish','Curious','Saltwater','Any','Day','0.4','2','https://static.wikitide.net/fishwikiwiki/thumb/e/e1/Nothern_Pufferfish.webp/120px-Nothern_Pufferfish.webp.png'],
    ['Red Melon Discus','Curious','Freshwater','Foggy','Any','0.0','0.6','https://static.wikitide.net/fishwikiwiki/thumb/e/e6/Red_Melon_Discus.webp/120px-Red_Melon_Discus.webp.png'],
    ['Alligator Gar','Elusive','Freshwater','Stormy','Any','10','80','https://static.wikitide.net/fishwikiwiki/thumb/9/9c/Alligator_Gar.webp/120px-Alligator_Gar.webp.png'],
    ['Salween Rita Catfish','Elusive','Freshwater','Any','Night','1','8','https://static.wikitide.net/fishwikiwiki/thumb/6/6a/Salween_Rita_Catfish.webp/120px-Salween_Rita_Catfish.webp.png'],
    ['European Anglerfish','Elusive','Saltwater','Any','Night','7','40','https://static.wikitide.net/fishwikiwiki/thumb/d/d4/European_Anglerfish.webp/120px-European_Anglerfish.webp.png'],
    ['Hogfish','Elusive','Saltwater','Any','Any','1','15','https://static.wikitide.net/fishwikiwiki/thumb/8/82/Hogfish.webp/120px-Hogfish.webp.png'],
    ['Goliath Tigerfish','Fabled','Freshwater','Any','Any','20','100','https://static.wikitide.net/fishwikiwiki/thumb/7/78/Goliath_Tigerfish.webp/120px-Goliath_Tigerfish.webp.png'],
    ['Frilled Shark','Fabled','Saltwater','Any','Any','15','220','https://static.wikitide.net/fishwikiwiki/thumb/f/f5/Frilled_Shark.webp/120px-Frilled_Shark.webp.png'],
    ['Blind Bladefish','Mythic','Freshwater','Any','Any','4.24','6.8','https://static.wikitide.net/fishwikiwiki/thumb/4/41/Blind_Bladefish.webp/120px-Blind_Bladefish.webp.png'],
    ['Red Dartfin','Mythic','Saltwater','Any','Any','1','24.7','https://static.wikitide.net/fishwikiwiki/thumb/b/b3/Red_Dartfin.webp/120px-Red_Dartfin.webp.png'],
    ['Spineback Ray','Exotic','Saltwater','Any','Any','1500','6000','https://static.wikitide.net/fishwikiwiki/thumb/2/20/Spineback_Ray.webp/120px-Spineback_Ray.webp.png'],
    ['Dragonfly Fish','Exotic','Freshwater','Any','Any','2','69.6','https://static.wikitide.net/fishwikiwiki/thumb/2/2e/Dragonfly_Fish.webp/120px-Dragonfly_Fish.webp.png']
  ],

  'Open Sea': [
    ['Herring','Abundant','Saltwater','Any','Any','0.3','1.1','https://static.wikitide.net/fishwikiwiki/thumb/e/e6/Herring.webp/120px-Herring.webp.png'],
    ['Haddock','Abundant','Saltwater','Any','Any','0.9','11','https://static.wikitide.net/fishwikiwiki/thumb/9/96/Haddock.webp/120px-Haddock.webp.png'],
    ['Cod','Common','Saltwater','Any','Morning','5','22','https://static.wikitide.net/fishwikiwiki/thumb/c/c0/Cod.webp/120px-Cod.webp.png'],
    ['Atlantic Salmon','Common','Saltwater','Any','Evening','3','6','https://static.wikitide.net/fishwikiwiki/thumb/b/be/Atlantic_Salmon.webp/120px-Atlantic_Salmon.webp.png'],
    ['Pollock','Common','Saltwater','Rainy','Any','0.5','21','https://static.wikitide.net/fishwikiwiki/thumb/0/03/Pollock.webp/120px-Pollock.webp.png'],
    ['Halibut','Curious','Saltwater','Stormy','Any','13','70','https://static.wikitide.net/fishwikiwiki/thumb/9/9a/Halibut.webp/120px-Halibut.webp.png'],
    ['Crab','Curious','Saltwater','Any','Night','0.4','2','https://static.wikitide.net/fishwikiwiki/thumb/5/5b/Crab.webp/120px-Crab.webp.png'],
    ['Mahi-Mahi','Curious','Saltwater','Any','Day','7','15','https://static.wikitide.net/fishwikiwiki/thumb/f/f0/Mahi-Mahi.webp/120px-Mahi-Mahi.webp.png'],
    ['Flying Fish','Curious','Saltwater','Clear','Any','0.4','1.5','https://static.wikitide.net/fishwikiwiki/thumb/9/9a/Flying_Fish.webp/120px-Flying_Fish.webp.png'],
    ['Albacore Tuna','Curious','Saltwater','Rainy','Any','10','30','https://static.wikitide.net/fishwikiwiki/thumb/9/90/Albacore_Tuna.webp/120px-Albacore_Tuna.webp.png'],
    ['Sailfish','Elusive','Saltwater','Any','Morning','50','100','https://static.wikitide.net/fishwikiwiki/thumb/1/1e/Sailfish.webp/120px-Sailfish.webp.png'],
    ['Blobfish','Elusive','Saltwater','Any','Morning','1.5','15','https://static.wikitide.net/fishwikiwiki/thumb/b/b6/Blobfish.webp/120px-Blobfish.webp.png'],
    ['Common Stingray','Elusive','Saltwater','Any','Night','0.8','35','https://static.wikitide.net/fishwikiwiki/thumb/0/01/Common_Stingray.webp/120px-Common_Stingray.webp.png'],
    ['Seahorse','Elusive','Saltwater','Rainy','Evening','0.0','0.1','https://static.wikitide.net/fishwikiwiki/thumb/5/56/Seahorse.webp/120px-Seahorse.webp.png'],
    ['Sunfish','Elusive','Saltwater','Any','Day','234','1023','https://static.wikitide.net/fishwikiwiki/thumb/e/e1/Sunfish.webp/120px-Sunfish.webp.png'],
    ['Plankfish','Elusive','Saltwater','Any','Any','-','-','https://static.wikitide.net/fishwikiwiki/thumb/f/f7/Plankfish.webp/120px-Plankfish.webp.png'],
    ['Oarfish','Fabled','Saltwater','Any','Any','90','300','https://static.wikitide.net/fishwikiwiki/thumb/0/0e/Oarfish.webp/120px-Oarfish.webp.png'],
    ['Manta Ray','Fabled','Saltwater','Any','Day','55.5','1555','https://static.wikitide.net/fishwikiwiki/thumb/f/fb/Manta_Ray.webp/120px-Manta_Ray.webp.png'],
    ['Bombfish','Fabled','Saltwater','Any','Any','-','-','https://static.wikitide.net/fishwikiwiki/thumb/2/22/Bombfish.webp/120px-Bombfish.webp.png'],
    ['Great White Shark','Mythic','Saltwater','Any','Any','489','1457','https://static.wikitide.net/fishwikiwiki/thumb/3/39/Great_White_Shark.webp/120px-Great_White_Shark.webp.png'],
    ['Giant Squid','Mythic','Saltwater','Any','Any','89','512','https://static.wikitide.net/fishwikiwiki/thumb/1/1a/Giant_Squid.webp/120px-Giant_Squid.webp.png'],
    ['Abyssal Serpentfish','Exotic','Saltwater, Swampwater','Any','Night','100','3100','https://static.wikitide.net/fishwikiwiki/thumb/5/51/Abyssal_Serpentfish.webp/120px-Abyssal_Serpentfish.webp.png'],
    ['Baby Megalodon','Exotic','Saltwater','Any','Any','35000','120000','https://static.wikitide.net/fishwikiwiki/thumb/9/98/Baby_Megalodon.webp/120px-Baby_Megalodon.webp.png'],
    ['Three-Headed Salmon','Exotic','Saltwater','Any','Any','-','-','https://static.wikitide.net/fishwikiwiki/thumb/4/47/Three-Headed_Salmon.webp/120px-Three-Headed_Salmon.webp.png']
  ],

  'Crescent Isle': [
    ['Ocean Perch','Abundant','Saltwater','Stormy','Any','0.5','7','https://static.wikitide.net/fishwikiwiki/thumb/7/7e/Ocean_Perch.webp/120px-Ocean_Perch.webp.png'],
    ['Tarpon','Abundant','Saltwater','Foggy','Any','10','200','https://static.wikitide.net/fishwikiwiki/thumb/3/3f/Tarpon.webp/120px-Tarpon.webp.png'],
    ['Black Scorpionfish','Common','Saltwater','Any','Evening','0.3','2.2','https://static.wikitide.net/fishwikiwiki/thumb/e/e3/Black_Scorpionfish.webp/120px-Black_Scorpionfish.webp.png'],
    ['Snook','Common','Saltwater','Rainy','Any','1','22','https://static.wikitide.net/fishwikiwiki/thumb/a/af/Snook.webp/120px-Snook.webp.png'],
    ['Lionfish','Curious','Saltwater','Any','Night','0.1','1.5','https://static.wikitide.net/fishwikiwiki/thumb/3/3a/Lionfish.webp/120px-Lionfish.webp.png'],
    ['Clownfish','Curious','Saltwater','Any','Day','0.1','1','https://static.wikitide.net/fishwikiwiki/thumb/d/d1/Clownfish.webp/120px-Clownfish.webp.png'],
    ['Regal Blue Tang','Curious','Saltwater','Any','Morning','0.0','0.5','https://static.wikitide.net/fishwikiwiki/thumb/1/11/Regal_Blue_Tang.webp/120px-Regal_Blue_Tang.webp.png'],
    ['Parrotfish','Elusive','Saltwater','Clear','Day','0.2','8','https://static.wikitide.net/fishwikiwiki/thumb/8/88/Parrotfish.webp/120px-Parrotfish.webp.png'],
    ['Permit','Elusive','Saltwater','Stormy','Any','0.2','36','https://static.wikitide.net/fishwikiwiki/thumb/b/be/Permit.webp/120px-Permit.webp.png'],
    ['Hammerhead Shark','Fabled','Saltwater','Any','Evening','80','450','https://static.wikitide.net/fishwikiwiki/thumb/4/4b/Hammerhead_Shark.webp/120px-Hammerhead_Shark.webp.png'],
    ['Brickfish','Fabled','Saltwater','Any','Any','-','-','https://static.wikitide.net/fishwikiwiki/thumb/1/15/Brickfish.webp/120px-Brickfish.webp.png'],
    ['Armored Brutefish','Mythic','Saltwater','Any','Any','-','-','https://static.wikitide.net/fishwikiwiki/thumb/b/b4/Armored_Brutefish.webp/120px-Armored_Brutefish.webp.png'],
    ['Celestial Whitefin','Exotic','Saltwater','Any','Any','500','1500','https://static.wikitide.net/fishwikiwiki/thumb/0/07/Celestial_Whitefin.webp/120px-Celestial_Whitefin.webp.png']
  ],

  'Volcanic Depths': [
    ['Flame Guppy','Abundant','Lava','Any','Any','0.1','0.2','https://static.wikitide.net/fishwikiwiki/thumb/4/48/Flame_Guppy.webp/120px-Flame_Guppy.webp.png'],
    ['Magma Carp','Abundant','Lava','Any','Any','1','5','https://static.wikitide.net/fishwikiwiki/thumb/8/8b/Magma_Carp.webp/120px-Magma_Carp.webp.png'],
    ['Ashscale Trout','Common','Lava','Any','Any','1','10','https://static.wikitide.net/fishwikiwiki/thumb/f/fc/Ashscale_Trout.webp/120px-Ashscale_Trout.webp.png'],
    ['Basalt Eel','Common','Lava','Any','Any','0.2','1.2','https://static.wikitide.net/fishwikiwiki/thumb/1/15/Basalt_Eel.webp/120px-Basalt_Eel.webp.png'],
    ['Cinderfin','Curious','Lava','Any','Any','0.2','1.2','https://static.wikitide.net/fishwikiwiki/thumb/0/0e/Cinderfin.webp/120px-Cinderfin.webp.png'],
    ['Obsidian Fish','Curious','Lava','Any','Any','3','6.7','https://static.wikitide.net/fishwikiwiki/thumb/4/4b/Obsidian_Fish.webp/120px-Obsidian_Fish.webp.png'],
    ['Crystal Pike','Elusive','Lava','Any','Any','1','9','https://static.wikitide.net/fishwikiwiki/thumb/0/05/Crystal_Pike.webp/120px-Crystal_Pike.webp.png'],
    ['Molten Angler','Elusive','Lava','Any','Any','20','30','https://static.wikitide.net/fishwikiwiki/thumb/2/24/Molten_Angler.webp/120px-Molten_Angler.webp.png'],
    ['Ifrit Barracuda','Fabled','Lava','Any','Any','50','105','https://static.wikitide.net/fishwikiwiki/thumb/3/36/Ifrit_Barracuda.webp/120px-Ifrit_Barracuda.webp.png'],
    ['Pyrite Snapper','Fabled','Lava','Any','Any','100','140','https://static.wikitide.net/fishwikiwiki/thumb/6/6a/Pyrite_Snapper.webp/120px-Pyrite_Snapper.webp.png'],
    ['Igneous Stingray','Mythic','Lava','Any','Any','-','-','https://static.wikitide.net/fishwikiwiki/thumb/6/6f/Igneous_Stingray.webp/120px-Igneous_Stingray.webp.png'],
    ['Red Demonfish','Mythic','Lava','Any','Any','-','237.8','https://static.wikitide.net/fishwikiwiki/thumb/a/ae/Red_Demonfish.webp/120px-Red_Demonfish.webp.png'],
    ['Hellmaw Grouper','Exotic','Lava','Any','Any','700','2000','https://static.wikitide.net/fishwikiwiki/thumb/b/b6/Hellmaw_Grouper.webp/120px-Hellmaw_Grouper.webp.png']
  ],

  'Luxian Dunes': [
    ['Ide','Abundant','Freshwater','Any','Morning','1','5','https://static.wikitide.net/fishwikiwiki/thumb/a/a2/Ide.webp/120px-Ide.webp.png'],
    ['Tench','Abundant','Freshwater','Any','Night','1','4','https://static.wikitide.net/fishwikiwiki/thumb/6/63/Tench.webp/120px-Tench.webp.png'],
    ['Perch','Abundant','Freshwater','Stormy','Any','0.1','2','https://static.wikitide.net/fishwikiwiki/thumb/8/83/Perch.webp/120px-Perch.webp.png'],
    ['GiltHead Bream','Abundant','Saltwater','Clear','Any','0.5','6','https://static.wikitide.net/fishwikiwiki/thumb/2/23/GiltHead_Bream.webp/120px-GiltHead_Bream.webp.png'],
    ['Tilefish','Abundant','Saltwater','Any','Any','2','55','https://static.wikitide.net/fishwikiwiki/thumb/d/d2/Tilefish.webp/120px-Tilefish.webp.png'],
    ['Rainbow Trout','Common','Freshwater','Foggy','Any','1','5','https://static.wikitide.net/fishwikiwiki/thumb/f/f7/Rainbow_Trout.webp/120px-Rainbow_Trout.webp.png'],
    ['Eel','Common','Freshwater','Any','Night','3','8','https://static.wikitide.net/fishwikiwiki/thumb/3/35/Eel.webp/120px-Eel.webp.png'],
    ['Bluefish','Common','Saltwater','Rainy','Any','0.5','14','https://static.wikitide.net/fishwikiwiki/thumb/8/8c/Bluefish.webp/120px-Bluefish.webp.png'],
    ['Hawaiian Triggerfish','Common','Saltwater','Any','Any','1','5','https://static.wikitide.net/fishwikiwiki/thumb/7/78/Hawaiian_Triggerfish.webp/120px-Hawaiian_Triggerfish.webp.png'],
    ['John Dory','Common','Saltwater','Any','Any','1','8','https://static.wikitide.net/fishwikiwiki/thumb/9/9a/John_Dory.webp/120px-John_Dory.webp.png'],
    ['Barracuda','Curious','Saltwater','Any','Morning','1','23','https://static.wikitide.net/fishwikiwiki/thumb/5/5d/Barracuda.webp/120px-Barracuda.webp.png'],
    ['Snow Yellow Discus','Curious','Freshwater','Foggy','Any','0.1','0.3','https://static.wikitide.net/fishwikiwiki/thumb/f/fa/Snow_Yellow_Discus.webp/120px-Snow_Yellow_Discus.webp.png'],
    ['Amberjack','Curious','Saltwater','Any','Any','0.5','90','https://static.wikitide.net/fishwikiwiki/thumb/c/c1/Amberjack.webp/120px-Amberjack.webp.png'],
    ['Goonch Catfish','Elusive','Freshwater','Rainy','Any','20','90','https://static.wikitide.net/fishwikiwiki/thumb/b/bb/Goonch_Catfish.webp/120px-Goonch_Catfish.webp.png'],
    ['Siamese Giant Carp','Elusive','Freshwater','Any','Morning','38','167','https://static.wikitide.net/fishwikiwiki/thumb/8/89/Siamese_Giant_Carp.webp/120px-Siamese_Giant_Carp.webp.png'],
    ['Wahoo','Elusive','Saltwater','Any','Any','5','100','https://static.wikitide.net/fishwikiwiki/thumb/a/aa/Wahoo.webp/120px-Wahoo.webp.png'],
    ['Ironfin Stalker','Fabled','Freshwater','Any','Any','25','55','https://static.wikitide.net/fishwikiwiki/thumb/1/18/Ironfin_Stalker.webp/120px-Ironfin_Stalker.webp.png'],
    ['Pinnate Batfish','Fabled','Saltwater','Any','Any','0.1','5','https://static.wikitide.net/fishwikiwiki/thumb/9/95/Pinnate_Batfish.webp/120px-Pinnate_Batfish.webp.png'],
    ['Ancient Warriorfish','Mythic','Freshwater','Any','Any','-','-','https://static.wikitide.net/fishwikiwiki/thumb/2/23/Ancient_Warriorfish.webp/120px-Ancient_Warriorfish.webp.png'],
    ['Humpback Gar','Mythic','Saltwater','Any','Any','-','-','https://static.wikitide.net/fishwikiwiki/thumb/b/b0/Humpback_Gar.webp/120px-Humpback_Gar.webp.png'],
    ['Shellonodon','Exotic','Saltwater','Any','Any','32000','40000','https://static.wikitide.net/fishwikiwiki/thumb/8/8b/Shellonodon.webp/120px-Shellonodon.webp.png'],
    ['Royal Bananafish','Exotic','Freshwater','Any','Any','6.6','-','https://static.wikitide.net/fishwikiwiki/thumb/7/7a/Royal_Bananafish.webp/120px-Royal_Bananafish.webp.png']
  ],

  'Tanglewood': [
    ['Bluegill Sunfish','Abundant','Swampwater','Clear','Any','0.1','2.5','https://static.wikitide.net/fishwikiwiki/thumb/7/72/Bluegill_Sunfish.webp/120px-Bluegill_Sunfish.webp.png'],
    ['Mudskipper','Abundant','Swampwater','Any','Day','-','-','https://static.wikitide.net/fishwikiwiki/thumb/b/bc/Mudskipper.webp/120px-Mudskipper.webp.png'],
    ['Bowfin','Common','Swampwater','Any','Evening','1','10','https://static.wikitide.net/fishwikiwiki/thumb/a/a9/Bowfin.webp/120px-Bowfin.webp.png'],
    ['Channel Catfish','Common','Swampwater','Foggy','Any','0.5','26','https://static.wikitide.net/fishwikiwiki/thumb/f/f6/Channel_Catfish.webp/120px-Channel_Catfish.webp.png'],
    ['Cottonmouth Snake','Curious','Swampwater','Clear','Any','0.3','4.5','https://static.wikitide.net/fishwikiwiki/thumb/4/4c/Cottonmouth_Snake.webp/120px-Cottonmouth_Snake.webp.png'],
    ['Frog','Curious','Swampwater','Rainy','Any','0.1','0.8','https://static.wikitide.net/fishwikiwiki/thumb/f/fb/Frog.webp/120px-Frog.webp.png'],
    ['Alligator Snapping Turtle','Elusive','Swampwater','Any','Any','10','113','https://static.wikitide.net/fishwikiwiki/thumb/8/8b/Alligator_Snapping_Turtle.webp/120px-Alligator_Snapping_Turtle.webp.png'],
    ['Soft Shelled Turtle','Elusive','Swampwater','Any','Morning','-','-','https://static.wikitide.net/fishwikiwiki/thumb/0/0d/Soft_Shelled_Turtle.webp/120px-Soft_Shelled_Turtle.webp.png'],
    ['American Alligator','Fabled','Swampwater','Any','Night','100','450','https://static.wikitide.net/fishwikiwiki/thumb/1/1d/American_Alligator.webp/120px-American_Alligator.webp.png'],
    ['Giant Gharial','Fabled','Swampwater','Any','Any','150','900','https://static.wikitide.net/fishwikiwiki/thumb/7/76/Giant_Gharial.webp/120px-Giant_Gharial.webp.png'],
    ['Venomous Watcher','Mythic','Swampwater','Any','Any','-','-','https://static.wikitide.net/fishwikiwiki/thumb/8/87/Venomous_Watcher.webp/120px-Venomous_Watcher.webp.png'],
    ['Dreadshell Colossus','Exotic','Swampwater','Any','Any','26000','50000','https://static.wikitide.net/fishwikiwiki/thumb/2/2d/Dreadshell_Colossus.webp/120px-Dreadshell_Colossus.webp.png']
  ],

  /* Index tab "Pyramid" = the Twilight Realm / Nile waters */
  'Twilight Realm': [
    ['Barbel','Abundant','Freshwater','Any','Any','2.0','11.9','https://static.wikitide.net/fishwikiwiki/thumb/1/1c/Barbel.webp/120px-Barbel.webp.png'],
    ['Grayling','Abundant','Freshwater','Any','Morning','0.5','2','https://static.wikitide.net/fishwikiwiki/thumb/3/31/Grayling.webp/120px-Grayling.webp.png'],
    ['Zander','Common','Freshwater','Clear','Any','2.0','9.5','https://static.wikitide.net/fishwikiwiki/thumb/7/78/Zander.webp/120px-Zander.webp.png'],
    ['Pangasius','Common','Freshwater','Foggy','Any','0.0022','29.9','https://static.wikitide.net/fishwikiwiki/thumb/6/64/Pangasius.webp/120px-Pangasius.webp.png'],
    ['Largemouth Bass','Common','Freshwater','Any','Day','1.5','3.3','https://static.wikitide.net/fishwikiwiki/thumb/8/8f/Largemouth_Bass.webp/120px-Largemouth_Bass.webp.png'],
    ['Pike','Common','Freshwater','Foggy','Any','2.0','15.3','https://static.wikitide.net/fishwikiwiki/thumb/1/14/Pike.webp/120px-Pike.webp.png'],
    ['Tilapia','Common','Any','Any','Any','1.0','3.0','https://static.wikitide.net/fishwikiwiki/thumb/6/69/Tilapia.webp/120px-Tilapia.webp.png'],
    ['Blue Diamond Discus','Curious','Freshwater','Foggy','Any','0.1','1.5','https://static.wikitide.net/fishwikiwiki/thumb/7/7b/Blue_Diamond_Discus.webp/120px-Blue_Diamond_Discus.webp.png'],
    ['African Lungfish','Curious','Any','Any','Any','1.2','7.6','https://static.wikitide.net/fishwikiwiki/thumb/c/c5/African_Lungfish.webp/120px-African_Lungfish.webp.png'],
    ['African Pike','Curious','Any','Any','Any','5.1','9.6','https://static.wikitide.net/fishwikiwiki/thumb/0/09/African_Pike.webp/120px-African_Pike.webp.png'],
    ['Arowana','Curious','Any','Any','Any','1.0','8.7','https://static.wikitide.net/fishwikiwiki/thumb/7/79/Arowana.webp/120px-Arowana.webp.png'],
    ['Knife Fish','Curious','Any','Any','Any','3.8','7.9','https://static.wikitide.net/fishwikiwiki/thumb/4/43/Knife_Fish.webp/120px-Knife_Fish.webp.png'],
    ['High-Fin Banded Shark','Elusive','Freshwater','Stormy','Any','3.2','13.3','https://static.wikitide.net/fishwikiwiki/thumb/3/37/High-Fin_Banded_Shark.webp/120px-High-Fin_Banded_Shark.webp.png'],
    ['Wels Catfish','Elusive','Freshwater','Clear','Any','7.2','14.9','https://static.wikitide.net/fishwikiwiki/thumb/d/d4/Wels_Catfish.webp/120px-Wels_Catfish.webp.png'],
    ['Bichir','Elusive','Any','Any','Any','1','3','https://static.wikitide.net/fishwikiwiki/thumb/a/a4/Bichir.webp/120px-Bichir.webp.png'],
    ['Electric Catfish','Elusive','Any','Any','Any','6.5','50.9','https://static.wikitide.net/fishwikiwiki/thumb/7/7a/Electric_Catfish.webp/120px-Electric_Catfish.webp.png'],
    ['Nile Perch','Elusive','Any','Any','Any','56.2','385.2','https://static.wikitide.net/fishwikiwiki/thumb/f/f3/Nile_Perch.webp/120px-Nile_Perch.webp.png'],
    ['Tiger Shovelnose Catfish','Elusive','Any','Any','Any','4.3','6.0','https://static.wikitide.net/fishwikiwiki/thumb/8/83/Tiger_Shovelnose_Catfish.webp/120px-Tiger_Shovelnose_Catfish.webp.png'],
    ['Elephant Fish','Fabled','Any','Any','Any','0.5','1.5','https://static.wikitide.net/fishwikiwiki/thumb/7/73/Elephant_Fish.webp/120px-Elephant_Fish.webp.png'],
    ['Mirage Fish','Mythic','Any','Any','Any','215.8','299.5','https://static.wikitide.net/fishwikiwiki/thumb/8/86/Mirage_Fish.webp/120px-Mirage_Fish.webp.png'],
    ['Sarcophagus','Exotic','Any','Any','Any','3476.4','6963.9','https://static.wikitide.net/fishwikiwiki/thumb/3/3c/Sarcophagus.webp/120px-Sarcophagus.webp.png']
  ],

  'Trash': [
    ['Broken Umbrella','Trash','Any','Any','Any','0.5','2','https://static.wikitide.net/fishwikiwiki/thumb/2/2f/Broken_Umbrella.webp/120px-Broken_Umbrella.webp.png'],
    ['Bald Doll','Trash','Any','Any','Any','0.5','2','https://static.wikitide.net/fishwikiwiki/thumb/f/fd/Bald_Doll.webp/120px-Bald_Doll.webp.png'],
    ['Lost Shoe','Trash','Any','Any','Any','0.5','2','https://static.wikitide.net/fishwikiwiki/thumb/b/be/Lost_Shoe.webp/120px-Lost_Shoe.webp.png'],
    ['Old Book','Trash','Any','Any','Any','0.5','2','https://static.wikitide.net/fishwikiwiki/thumb/b/bc/Old_Book.webp/120px-Old_Book.webp.png'],
    ['Old Cooking Pot','Trash','Any','Any','Any','0.5','2','https://static.wikitide.net/fishwikiwiki/thumb/b/be/Old_Cooking_Pot.webp/120px-Old_Cooking_Pot.webp.png'],
    ['Leather Wallet','Trash','Any','Any','Any','0.5','2','https://static.wikitide.net/fishwikiwiki/thumb/7/7e/Leather_Wallet.webp/120px-Leather_Wallet.webp.png'],
    ['Plastic Bag','Trash','Saltwater, Freshwater, Swampwater','Any','Any','0.5','2','https://static.wikitide.net/fishwikiwiki/thumb/e/e8/Plastic_Bag.webp/120px-Plastic_Bag.webp.png'],
    ['Rubber Duck','Trash','Any','Any','Any','0.5','2','https://static.wikitide.net/fishwikiwiki/thumb/9/9c/Rubber_Duck.webp/120px-Rubber_Duck.webp.png'],
    ['Rusty Tin Can','Trash','Any','Any','Any','0.5','2','https://static.wikitide.net/fishwikiwiki/thumb/8/8f/Rusty_Tin_Can.webp/120px-Rusty_Tin_Can.webp.png'],
    ['Seaweed','Trash','Saltwater, Freshwater, Swampwater','Any','Any','0.5','2','https://static.wikitide.net/fishwikiwiki/thumb/9/9a/Seaweed.webp/120px-Seaweed.webp.png']
  ],

  'Relics': [
    ['Old Relic Piece','Relic','Any','Any','Any','5','5','https://static.wikitide.net/fishwikiwiki/thumb/2/2c/Old_Relic_Piece.webp/120px-Old_Relic_Piece.webp.png'],
    ['Mossy Relic','Relic','Any','Any','Any','5','5','https://static.wikitide.net/fishwikiwiki/thumb/8/85/Mossy_Relic.webp/120px-Mossy_Relic.webp.png'],
    ['Powerful Relic','Relic','Any','Any','Any','5','5','https://static.wikitide.net/fishwikiwiki/thumb/e/e6/Powerful_Relic.webp/120px-Powerful_Relic.webp.png'],
    ['Mysterious Red Gem','Relic','Any','Any','Moonrain','5','5','https://static.wikitide.net/fishwikiwiki/thumb/c/ce/Mysterious_Red_Gem.webp/120px-Mysterious_Red_Gem.webp.png'],
    ['Ghastly Skull','Relic','Any','Any','Foggy','5','5','https://static.wikitide.net/fishwikiwiki/thumb/c/c8/Ghastly_Skull.webp/120px-Ghastly_Skull.webp.png'],
    ['Dimensional Dongle','Relic','Any','Any','Foggy','5','5','https://static.wikitide.net/fishwikiwiki/thumb/8/85/Dimensional_Dongle.webp/120px-Dimensional_Dongle.webp.png'],
    ['Fuel Compositor','Relic','Any','Any','Foggy','5','5','https://static.wikitide.net/fishwikiwiki/thumb/5/5f/Fuel_Compositor.webp/120px-Fuel_Compositor.webp.png']
  ],

  'Secret Fish': [
    ['Wabubu','Secret','Any','Any','Any','0.5','5.5','https://static.wikitide.net/fishwikiwiki/thumb/d/d0/Wabubu.webp/120px-Wabubu.webp.png'],
    ['Steve','Secret','Any','Any','Any','0.5','8.8','https://static.wikitide.net/fishwikiwiki/thumb/0/03/Steve.webp/120px-Steve.webp.png'],
    ['Decimated Fih','Secret','Any','Any','Any','0.5','4','https://static.wikitide.net/fishwikiwiki/thumb/1/19/Decimated_Fih.webp/120px-Decimated_Fih.webp.png'],
    ['Decimated Shak','Secret','Any','Any','Any','872.1','999.9','https://static.wikitide.net/fishwikiwiki/thumb/f/f9/Decimatedshak.webp/120px-Decimatedshak.webp.png'],
    ['Pedro','Secret','Coconut Bay/Freshwater','Any','Any','1.1','1.4','https://static.wikitide.net/fishwikiwiki/thumb/2/2d/Pedro.webp/120px-Pedro.webp.png'],
    ['Outrageously Long Eel','Secret','Coconut Bay/Saltwater','Any','Any','1.0','-','https://static.wikitide.net/fishwikiwiki/thumb/c/c9/Outrageously_Long_Eel.webp/120px-Outrageously_Long_Eel.webp.png'],
    ['Missing ID','Secret','Crescent Isle','Any','Any','1.2','-','https://static.wikitide.net/fishwikiwiki/thumb/9/94/Missing_ID.webp/120px-Missing_ID.webp.png'],
    ['Volcanic Cube','Secret','Volcanic Depths','Any','Any','-','523.0','https://static.wikitide.net/fishwikiwiki/thumb/9/97/Volcanic_Cube.webp/120px-Volcanic_Cube.webp.png'],
    ['Luxian Camelshark','Secret','Luxian Dunes/Saltwater','Any','Any','7718.7','8702.3','https://static.wikitide.net/fishwikiwiki/thumb/9/91/Luxian_Camelshark.webp/120px-Luxian_Camelshark.webp.png'],
    ['Ragtime Frog','Secret','Tanglewood','Any','Any','0.5','3.5','https://static.wikitide.net/fishwikiwiki/thumb/d/d3/RagtimeFrog.webp/120px-RagtimeFrog.webp.png'],
    ['Bacty Fish','Secret','Twilight Realm','Any','Any','-','23.0','https://static.wikitide.net/fishwikiwiki/thumb/a/ad/Bacty_Fish.webp/120px-Bacty_Fish.webp.png'],
    ['The Turt','Ultimate Secret','Any','Any','Any','356.2','490.5','https://static.wikitide.net/fishwikiwiki/thumb/c/c1/TheTurt.webp/120px-TheTurt.webp.png'],
    ['Crab of Duality','Ultimate Secret','Any','Any','Any','150','350','https://static.wikitide.net/fishwikiwiki/thumb/0/00/Crab_of_Duality.webp/120px-Crab_of_Duality.webp.png'],
    ['Catfish Emperor','Ultimate Secret','Any','Any','Any','275.8','746.8','https://static.wikitide.net/fishwikiwiki/thumb/1/10/Catfish_Emperor.webp/120px-Catfish_Emperor.webp.png']
  ],

  'Event Fish': [
    ['Shamrock Shark','Exotic','Lucky Pool','Any','Any','213.1','892.4','https://static.wikitide.net/fishwikiwiki/thumb/8/8d/Shamrock_Shark.webp/120px-Shamrock_Shark.webp.png'],
    ['Pink Egg Pattern Minnow','Curious','Any','Any','Any','0.1','0.9','https://static.wikitide.net/fishwikiwiki/thumb/d/de/Pink_Egg_Pattern_Minnow.webp/120px-Pink_Egg_Pattern_Minnow.webp.png'],
    ['Blue Egg Pattern Minnow','Elusive','Any','Any','Any','0.1','0.9','https://static.wikitide.net/fishwikiwiki/thumb/3/32/Blue_Egg_Pattern_Minnow.webp/120px-Blue_Egg_Pattern_Minnow.webp.png'],
    ['Easter Basket','Elusive','Any','Any','Any','4','6','https://static.wikitide.net/fishwikiwiki/thumb/c/cd/Easter_Basket.webp/120px-Easter_Basket.webp.png'],
    ['Daisy Perch','Fabled','Any','Any','Any','2','8','https://static.wikitide.net/fishwikiwiki/thumb/f/f8/Daisy_Perch.webp/120px-Daisy_Perch.webp.png'],
    ['Eggshell Catfish','Fabled','Any','Any','Any','15','35','https://static.wikitide.net/fishwikiwiki/thumb/7/77/Eggshell_Catfish.webp/120px-Eggshell_Catfish.webp.png'],
    ['Carrot Fish','Mythic','Any','Any','Any','25','75','https://static.wikitide.net/fishwikiwiki/thumb/7/73/Carrot_Fish.webp/120px-Carrot_Fish.webp.png'],
    ['Bloomfish','Exotic','Any','Any','Any','100','500','https://static.wikitide.net/fishwikiwiki/thumb/9/98/Bloomfish.webp/120px-Bloomfish.webp.png'],
    ['Easter Bunnyfish','Exotic','Any','Any','Any','5','55','https://static.wikitide.net/fishwikiwiki/thumb/f/f3/Easter_Bunnyfish.webp/120px-Easter_Bunnyfish.webp.png']
  ],

  'Leviathan': [
    ['Giant Cleanerfish','Elusive','Any','Any','Any','5.0','9.9','https://static.wikitide.net/fishwikiwiki/thumb/d/d4/Giant_Cleanerfish.webp/120px-Giant_Cleanerfish.webp.png'],
    ['Leviathan Dorsal Spike','Fabled','Any','Any','Any','-','10','https://static.wikitide.net/fishwikiwiki/thumb/7/75/Leviathan_Dorsal_Spike.webp/120px-Leviathan_Dorsal_Spike.webp.png'],
    ['Leviathan Scale','Mythic','Any','Any','Any','-','9.5','https://static.wikitide.net/fishwikiwiki/thumb/d/df/Leviathan_Scale.webp/120px-Leviathan_Scale.webp.png'],
    ['Leviathan Eye','Exotic','Any','Any','Any','-','10','https://static.wikitide.net/fishwikiwiki/thumb/4/4b/Leviathan_Eye.webp/120px-Leviathan_Eye.webp.png']
  ]
};
