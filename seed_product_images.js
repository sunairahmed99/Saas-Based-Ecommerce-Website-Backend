/**
 * Re-seed product images: category-matched URLs (validated at runtime).
 * Run: npm run seed:images
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";
import Product from "./Models/ProductSchema.js";

dotenv.config();
dns.setServers(["8.8.8.8", "8.8.4.4"]);
dns.setDefaultResultOrder("ipv4first");

const P = (id) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop`;

const U = (id) =>
  `https://images.unsplash.com/${id}?w=600&auto=format&fit=crop&q=80`;

/** Candidate URLs per category — only working ones are kept at runtime */
const CANDIDATES = {
  cookingOil: [P(1099680), P(3373716), P(4198018), P(33783)],
  hairDryer: [P(3992213), P(3993449)],
  photoFrame: [P(1128318), P(1005638)],
  curtain: [P(276583), P(1454806)],
  bedSheet: [P(298345), P(1454806), P(1457984)],
  diningTable: [P(1080721), P(1571463)],
  studyTable: [P(3730760), P(195329), P(667838)],
  bookshelf: [P(159711), P(256450), P(1370295), U("photo-1497633762265-9d179a990aa6")],
  sofa: [P(1866149), P(1350789)],
  bed: [P(1648776), P(1549181)],
  videoGame: [P(442576), P(3165335)],
  mousePad: [P(5477698), P(2115257)],
  console: [P(442576), P(3165335)],
  monitor: [P(777001), P(1714208)],
  vrHeadset: [P(3861969), P(3607028)],
  loofah: [P(4046312), P(4467687)],
  towel: [P(461462), P(1454806)],
  blender: [P(4493655), P(4226769)],
  vitamin: [P(1128984), P(4039001)],
  paperShredder: [P(4480505), P(4386431)],
  carElectronics: [P(3802508), P(3802508)],
  faceMask: [P(3993253), P(3786127)],
  lehenga: [P(1926769), P(1536619)],
  babyClothing: [P(3608205), U("photo-1602810318383-e386cc2a3ccf")],
  firstAid: [U("photo-1584515979956-d9f6e5d09982"), U("photo-1584017911766-d451b3d0e843")],
  sleepingBag: [P(1061640), P(1687845)],
  backpack: [U("photo-1553062407-98eeb64c6a62"), U("photo-1565026057447-bc90a3dceb87")],
  handbag: [U("photo-1565026057447-bc90a3dceb87"), P(1152077)],
  luggage: [U("photo-1565026057447-bc90a3dceb87"), U("photo-1565538810643-b5bdb714032a")],
  wallet: [P(1152077), U("photo-1565026057447-bc90a3dceb87")],
  shoes: [U("photo-1542291026-7eec264c27ff"), U("photo-1460353581641-37baddab0fa2"), P(2529148)],
  sandals: [P(2529148), U("photo-1542291026-7eec264c27ff")],
  boots: [U("photo-1549298916-b41d501d3772"), P(2529148)],
  sneakers: [U("photo-1542291026-7eec264c27ff"), P(2529148)],
  wedges: [U("photo-1543163521-1bf539c55dd2"), P(336372)],
  tshirt: [U("photo-1521572163474-6864f9cf17ab"), P(6311392)],
  shirt: [U("photo-1594938298603-c8148c4dae35"), P(6311392)],
  jacket: [U("photo-1591047139829-d91aecb6caea"), P(6311392)],
  trousers: [P(6311392), U("photo-1473966602550-3603fa3b7a3b")],
  ethnic: [P(1926769), P(1536619)],
  uniform: [P(6311392), P(1926769)],
  romper: [P(3608205), U("photo-1602810318383-e386cc2a3ccf")],
  phone: [P(1092644), P(788946), U("photo-1511704900639-cec375c9a2c8")],
  laptop: [P(1181244), P(18105), P(7975)],
  tablet: [P(1181244), P(1092644)],
  watch: [U("photo-1523275335684-37898b6baf30"), U("photo-1524805444758-089113d48a6d")],
  headset: [P(3394650), U("photo-1505740420928-5e560c06d30e"), P(1649771)],
  earphone: [P(1649771), P(4392286), P(3394650)],
  camera: [P(225250), P(90946), U("photo-1516035069370-29a1b244cc20")],
  tv: [P(777001), P(1714208)],
  keyboard: [P(2115257), P(5477698)],
  mouse: [P(5477698), P(2115257)],
  hub: [P(2115257), U("photo-1593640408182-31c70c8268f5")],
  guitar: [U("photo-1510915361894-db8b60106cb1")],
  violin: [U("photo-1465847899084-d164df4dedc6")],
  drum: [U("photo-1465847899084-d164df4dedc6")],
  book: [U("photo-1497633762265-9d179a990aa6"), U("photo-1495640388908-05fa85288e61")],
  toy: [U("photo-1559251606-c623743a6d76"), U("photo-1566576721346-d4a3b4eaeb55")],
  garden: [U("photo-1585320806297-9794b3e4eeae"), P(1419648)],
  sunglasses: [U("photo-1572635196237-14b3f281503f"), U("photo-1511499767150-a48a237f0083")],
  jewelry: [U("photo-1599643478518-a784e5dc4c8f"), U("photo-1611591437281-460bfbe1220a")],
  health: [U("photo-1584515979956-d9f6e5d09982"), U("photo-1603398938378-e54eab446dde")],
  baby: [P(3608205), U("photo-1602810318383-e386cc2a3ccf")],
  pet: [U("photo-1576201836106-db1758fd1c97"), P(1108099)],
  tool: [U("photo-1504148455328-c376907d081c"), U("photo-1581244277943-fe4a9c777189")],
  motorcycle: [U("photo-1558981806-ec527fa84c39"), P(3802508)],
  stationery: [U("photo-1456513080510-7bf3a84b82f8"), U("photo-1531346878377-a5be20888e57")],
  art: [U("photo-1513364776144-60967b0f800f"), U("photo-1584992236310-6edddc08acff")],
  homeDecor: [U("photo-1586023492125-27b2c045efd7"), U("photo-1505691938895-1758d7feb511")],
  kitchen: [U("photo-1556911220-e15b29be8c8f"), P(4493655)],
  generic: [
    U("photo-1560343090-f0409e92791a"),
    U("photo-1526170375885-4d8ecf77b99f"),
    U("photo-1505740420928-5e560c06d30e"),
    P(442576),
    P(1092644),
  ],
};

const RULES = [
  { test: (t) => /cooking oil|olive oil|vegetable oil|canola/.test(t), pool: "cookingOil" },
  { test: (t) => /hair dryer|hairdryer/.test(t), pool: "hairDryer" },
  { test: (t) => /photo frame|picture frame/.test(t), pool: "photoFrame" },
  { test: (t) => /curtain|drape/.test(t), pool: "curtain" },
  { test: (t) => /bed sheet|bedsheet|bed linen/.test(t), pool: "bedSheet" },
  { test: (t) => /dining table/.test(t), pool: "diningTable" },
  { test: (t) => /study table|desk\b|office table/.test(t), pool: "studyTable" },
  { test: (t) => /bookshelf|book shelf/.test(t), pool: "bookshelf" },
  { test: (t) => /\bsofas?\b|settee|couch/.test(t), pool: "sofa" },
  { test: (t) => /\bbed\b|mattress/.test(t) && !/bed sheet|bedsheet/.test(t), pool: "bed" },
  { test: (t) => /video game|gaming console|\bconsole\b/.test(t), pool: "console" },
  { test: (t) => /gaming monitor|monitor\b|display\b/.test(t), pool: "monitor" },
  { test: (t) => /vr headset|virtual reality/.test(t), pool: "vrHeadset" },
  { test: (t) => /mouse pad|mousepad/.test(t), pool: "mousePad" },
  { test: (t) => /loofah|bath sponge/.test(t), pool: "loofah" },
  { test: (t) => /\btowel\b|bath linen/.test(t), pool: "towel" },
  { test: (t) => /blender|mixer\b|juicer/.test(t), pool: "blender" },
  { test: (t) => /vitamin|supplement|protein powder/.test(t), pool: "vitamin" },
  { test: (t) => /paper shredder|shredder/.test(t), pool: "paperShredder" },
  { test: (t) => /car electronic|dash cam|car charger/.test(t), pool: "carElectronics" },
  { test: (t) => /face mask|surgical mask/.test(t), pool: "faceMask" },
  { test: (t) => /lehenga|saree|sari\b/.test(t), pool: "lehenga" },
  { test: (t) => /baby cloth|infant wear|kids cloth/.test(t), pool: "babyClothing" },
  { test: (t) => /first aid/.test(t), pool: "firstAid" },
  { test: (t) => /sleeping bag/.test(t), pool: "sleepingBag" },
  { test: (t) => /school bag|schoolbag|backpack/.test(t), pool: "backpack" },
  { test: (t) => /handbag|purse|clutch/.test(t), pool: "handbag" },
  { test: (t) => /trolley bag|travel bag|luggage|suitcase/.test(t), pool: "luggage" },
  { test: (t) => /\bwallet\b/.test(t), pool: "wallet" },
  { test: (t) => /mirrorless|dslr|instant camera|action cam|security camera/.test(t), pool: "camera" },
  { test: (t) => /gaming headset|headset|headphone|earbud|earphone|sports earphone/.test(t), pool: "headset" },
  { test: (t) => /modern wireless|wireless ear|wireless audio|bluetooth audio/.test(t), pool: "earphone" },
  { test: (t) => /school shoe|sneaker|trainer|footwear|\bshoe\b|\bshoes\b|\bboot\b/.test(t), pool: "shoes" },
  { test: (t) => /sandal|flip.?flop|slipper/.test(t), pool: "sandals" },
  { test: (t) => /wedge|heel/.test(t), pool: "wedges" },
  { test: (t) => /5g phone|android phone|iphone|smartphone|\bphone\b|mobile/.test(t), pool: "phone" },
  { test: (t) => /laptop|macbook|chromebook|2-in-1/.test(t), pool: "laptop" },
  { test: (t) => /kids tablet|\btablet\b|ipad/.test(t), pool: "tablet" },
  { test: (t) => /smartwatch|fitness tracker|\bwatch\b/.test(t), pool: "watch" },
  { test: (t) => /oled tv|smart tv|\btv\b|television/.test(t), pool: "tv" },
  { test: (t) => /keyboard/.test(t), pool: "keyboard" },
  { test: (t) => /computer mouse|\bmouse\b/.test(t) && !/mouse pad|mousepad/.test(t), pool: "mouse" },
  { test: (t) => /usb hub/.test(t), pool: "hub" },
  { test: (t) => /formal shirt|dress shirt|\bshirt\b/.test(t), pool: "shirt" },
  { test: (t) => /t-?shirt|tee\b/.test(t), pool: "tshirt" },
  { test: (t) => /jacket|blazer|coat/.test(t), pool: "jacket" },
  { test: (t) => /kurti|kurta|ethnic/.test(t), pool: "ethnic" },
  { test: (t) => /trouser|pant\b|jeans/.test(t), pool: "trousers" },
  { test: (t) => /frock|dress|gown/.test(t), pool: "ethnic" },
  { test: (t) => /uniform|romper/.test(t), pool: "uniform" },
  { test: (t) => /guitar/.test(t), pool: "guitar" },
  { test: (t) => /violin/.test(t), pool: "violin" },
  { test: (t) => /\bdrum/.test(t), pool: "drum" },
  { test: (t) => /\bbook/.test(t), pool: "book" },
  { test: (t) => /doll|toy/.test(t), pool: "toy" },
  { test: (t) => /garden|planter|soil/.test(t), pool: "garden" },
  { test: (t) => /sunglass|aviator|wayfarer/.test(t), pool: "sunglasses" },
  { test: (t) => /necklace|bracelet|jewel/.test(t), pool: "jewelry" },
  { test: (t) => /nebulizer|blood pressure|thermometer|pulse oximeter|oximeter/.test(t), pool: "health" },
  { test: (t) => /diaper|stroller/.test(t), pool: "baby" },
  { test: (t) => /leash|collar/.test(t), pool: "pet" },
  { test: (t) => /engine oil|motorcycle/.test(t), pool: "motorcycle" },
  { test: (t) => /drill|power tool|hand tool/.test(t), pool: "tool" },
  { test: (t) => /notebook|stapler|planner|stationery/.test(t), pool: "stationery" },
  { test: (t) => /paint|craft|knitting/.test(t), pool: "art" },
  { test: (t) => /candle|vase|decor|lamp\b/.test(t), pool: "homeDecor" },
  { test: (t) => /cookware|pan\b|pot\b|kitchen/.test(t), pool: "kitchen" },
  { test: (t) => /\bbag\b/.test(t), pool: "backpack" },
];

let IMAGES = {};

const urlCache = new Map();

const isUrlOk = async (url) => {
  if (urlCache.has(url)) return urlCache.get(url);
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    const ok = res.status === 200;
    urlCache.set(url, ok);
    return ok;
  } catch {
    urlCache.set(url, false);
    return false;
  }
};

const buildValidatedPools = async () => {
  const allValid = [];
  const pools = {};

  for (const [key, urls] of Object.entries(CANDIDATES)) {
    const valid = [];
    for (const url of urls) {
      if (await isUrlOk(url)) valid.push(url);
    }
    if (valid.length) {
      pools[key] = valid;
      allValid.push(...valid);
    }
  }

  const uniqueFallback = [...new Set(allValid)];
  if (!pools.generic?.length) {
    pools.generic = uniqueFallback.length ? uniqueFallback : [P(442576)];
  }

  for (const key of Object.keys(CANDIDATES)) {
    if (!pools[key]?.length) {
      pools[key] = pools.generic;
      console.warn(`Pool "${key}" has no valid URLs — using generic fallback.`);
    }
  }

  return pools;
};

const hashIndex = (str, length) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % length;
};

const categoryFromName = (pname) => {
  const parts = String(pname || "").split(" - ");
  return parts.length > 1 ? parts[parts.length - 1].trim() : String(pname || "");
};

const resolvePoolKey = (pname) => {
  const category = categoryFromName(pname);
  const text = `${pname} ${category}`.toLowerCase();
  for (const rule of RULES) {
    if (rule.test(text)) return rule.pool;
  }
  return "generic";
};

const pickImages = (pname) => {
  const poolKey = resolvePoolKey(pname);
  const pool = IMAGES[poolKey] || IMAGES.generic;
  const idx = hashIndex(pname, pool.length);
  return {
    poolKey,
    pimage1: pool[idx],
    pimage2: pool[(idx + 1) % pool.length],
    pimage3: pool[(idx + 2) % pool.length],
  };
};

const seedProductImages = async () => {
  try {
    if (!process.env.DB) {
      console.error("No DB connection string in .env");
      process.exit(1);
    }

    console.log("Validating image URLs (may take ~1 min)...");
    IMAGES = await buildValidatedPools();
    const totalUrls = Object.values(IMAGES).reduce((n, arr) => n + arr.length, 0);
    console.log(`Ready with ${Object.keys(IMAGES).length} pools, ${totalUrls} valid URLs.`);

    await mongoose.connect(process.env.DB);
    const products = await Product.find({}).select("pname");
    console.log(`Updating ${products.length} products...`);

    const bulkOps = products.map((product) => {
      const { pimage1, pimage2, pimage3 } = pickImages(product.pname);
      return {
        updateOne: {
          filter: { _id: product._id },
          update: { $set: { pimage1, pimage2, pimage3 } },
        },
      };
    });

    for (let i = 0; i < bulkOps.length; i += 200) {
      await Product.bulkWrite(bulkOps.slice(i, i + 200));
    }

    const samples = [
      "Zenith Lite - Formal Cooking Oil",
      "Zenith Elite - Rugged Hair Dryers",
      "Omega Max - Vintage Photo Frames",
      "Vertex Ultra - Modern Curtains",
      "Stratos Signature - Urban Bed Sheets",
      "Zenith Max - Rugged Dining Tables",
      "Vanguard Ultra - Classic Sofas",
      "Nova Pro - Casual Gaming Headsets",
      "Eco Pro - Classic DSLR Cameras",
      "Eco Max - Modern Wireless",
    ];
    console.log("\nSample mappings:");
    for (const name of samples) {
      const { poolKey, pimage1 } = pickImages(name);
      console.log(`  [${poolKey}] ${name}`);
    }

    console.log(`\nDone. Updated ${bulkOps.length} products.`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
};

seedProductImages();
