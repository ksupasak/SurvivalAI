/**
 * Survival Knowledge Base Service
 *
 * Loads and searches the survival knowledge base JSON data.
 * Provides full-text search across questions, answers, and tags
 * with relevance-based scoring.
 *
 * Supports multilingual queries via a keyword translation map —
 * non-English words are mapped to English equivalents before searching,
 * so queries in Thai, Spanish, Chinese, etc. can match English entries.
 */

import knowledgeData from '@/data/survival-knowledge.json';

export type KnowledgeEntry = {
  q: string;
  a: string;
  tags: string[];
  category: string;
};

// Flatten the category-keyed JSON into a flat array with category field
const rawData = knowledgeData as Record<string, { q: string; a: string; tags: string[] }[]>;
const entries: KnowledgeEntry[] = Object.entries(rawData).flatMap(
  ([category, items]) => items.map((item) => ({ ...item, category }))
);

// ─── Multilingual Keyword Map ────────────────────────────────────────────────
// Maps non-English survival keywords (substrings) → English search terms.
// Stored as an array of tuples to allow identical foreign-language keys
// across language sections. Substring matching handles agglutinative and
// non-space-separated languages like Thai, Chinese, Japanese, Korean.

const KEYWORD_ENTRIES: [string, string[]][] = [
  // ── WATER ─────────────────────────────────────────────────────────────────
  // Thai
  ['น้ำ', ['water']],
  ['น้ำดื่ม', ['water', 'drinking']],
  ['กรองน้ำ', ['water', 'filter', 'purify']],
  ['ทำน้ำสะอาด', ['water', 'purify', 'clean']],
  ['หาน้ำ', ['water', 'find', 'source']],
  ['น้ำฝน', ['water', 'rain', 'collect']],
  ['น้ำจืด', ['water', 'freshwater']],
  ['ต้มน้ำ', ['water', 'boil']],
  // Spanish / Portuguese
  ['agua', ['water']],
  ['purificar', ['purify', 'water']],
  ['filtrar', ['filter', 'water']],
  ['hervir', ['boil', 'water']],
  ['lluvia', ['rain', 'water']],
  ['água', ['water']],
  // French
  ['eau', ['water']],
  ['purifier', ['purify', 'water']],
  ['bouillir', ['boil', 'water']],
  // Chinese
  ['净水', ['water', 'purify']],
  ['饮水', ['water', 'drinking']],
  ['过滤水', ['water', 'filter']],
  ['雨水收集', ['water', 'rain', 'collect']],
  ['煮沸', ['water', 'boil']],
  ['找水', ['water', 'find', 'source']],
  // Japanese
  ['飲料水', ['water', 'drinking']],
  ['浄水', ['water', 'purify']],
  ['雨水', ['water', 'rain']],
  // Korean
  ['물', ['water']],
  ['식수', ['water', 'drinking']],
  ['정수', ['water', 'purify']],
  ['빗물', ['water', 'rain']],
  // Arabic
  ['ماء', ['water']],
  ['مياه', ['water']],
  ['تنقية المياه', ['purify', 'water']],
  ['غلي الماء', ['boil', 'water']],
  // Russian / Ukrainian
  ['вода', ['water']],
  ['очистка воды', ['water', 'purify']],
  ['кипятить воду', ['water', 'boil']],
  // German
  ['wasser', ['water']],
  ['trinkwasser', ['water', 'drinking']],
  ['wasserfilter', ['water', 'filter']],
  // Hindi
  ['पानी', ['water']],
  ['पीने का पानी', ['water', 'drinking']],
  // Italian / Dutch / Swedish
  ['acqua', ['water']],
  ['vatten', ['water']],
  // Turkish / Polish / Vietnamese / Indonesian
  ['içme suyu', ['water', 'drinking']],
  ['arıtma', ['water', 'purify']],
  ['woda', ['water']],
  ['nước', ['water']],
  ['lọc nước', ['water', 'filter']],
  ['air minum', ['water', 'drinking']],

  // ── FIRE ──────────────────────────────────────────────────────────────────
  // Thai
  ['ไฟ', ['fire']],
  ['ก่อไฟ', ['fire', 'start', 'build']],
  ['จุดไฟ', ['fire', 'light', 'ignite', 'start']],
  ['ไฟแช็ก', ['fire', 'lighter']],
  ['ไม้ขีด', ['fire', 'matches']],
  ['เปลวไฟ', ['fire', 'flame']],
  ['ถ่าน', ['fire', 'charcoal', 'ember']],
  // Spanish / Portuguese
  ['fuego', ['fire']],
  ['encender fuego', ['fire', 'start', 'ignite']],
  ['fósforos', ['fire', 'matches']],
  ['encendedor', ['fire', 'lighter']],
  ['fogo', ['fire']],
  ['acender', ['fire', 'start']],
  // French
  ['feu', ['fire']],
  ['allumer un feu', ['fire', 'light', 'start']],
  ['allumettes', ['fire', 'matches']],
  ['briquet', ['fire', 'lighter']],
  // Chinese
  ['火', ['fire']],
  ['生火', ['fire', 'start']],
  ['点火', ['fire', 'ignite']],
  ['火柴', ['fire', 'matches']],
  ['打火机', ['fire', 'lighter']],
  // Japanese
  ['焚き火', ['fire', 'campfire']],
  ['火おこし', ['fire', 'start']],
  ['マッチ', ['fire', 'matches']],
  ['ライター', ['fire', 'lighter']],
  // Korean
  ['불', ['fire']],
  ['불 피우기', ['fire', 'start']],
  ['성냥', ['fire', 'matches']],
  ['라이터', ['fire', 'lighter']],
  // Arabic
  ['نار', ['fire']],
  ['إشعال النار', ['fire', 'ignite', 'start']],
  ['كبريت', ['fire', 'matches']],
  ['ولاعة', ['fire', 'lighter']],
  // Russian / Ukrainian
  ['огонь', ['fire']],
  ['разжечь огонь', ['fire', 'start', 'ignite']],
  ['спички', ['fire', 'matches']],
  ['зажигалка', ['fire', 'lighter']],
  ['вогонь', ['fire']],
  // German
  ['feuer', ['fire']],
  ['feuer anzünden', ['fire', 'ignite', 'start']],
  ['streichhölzer', ['fire', 'matches']],
  ['feuerzeug', ['fire', 'lighter']],
  // Hindi
  ['आग', ['fire']],
  ['आग जलाना', ['fire', 'start']],
  ['माचिस', ['fire', 'matches']],
  // Italian / Dutch / Swedish
  ['fuoco', ['fire']],
  ['accendere fuoco', ['fire', 'start']],
  ['vuur', ['fire']],
  ['eld', ['fire']],
  ['tända eld', ['fire', 'ignite']],
  // Turkish / Polish / Vietnamese / Indonesian
  ['ateş', ['fire']],
  ['ateş yakmak', ['fire', 'start']],
  ['ogień', ['fire']],
  ['rozpalić ogień', ['fire', 'start']],
  ['lửa', ['fire']],
  ['nhóm lửa', ['fire', 'start']],
  ['api', ['fire']],
  ['menyalakan api', ['fire', 'start']],

  // ── SHELTER ───────────────────────────────────────────────────────────────
  // Thai
  ['ที่พัก', ['shelter']],
  ['ที่กำบัง', ['shelter', 'cover']],
  ['สร้างที่พัก', ['shelter', 'build', 'construct']],
  ['หลบภัย', ['shelter', 'emergency', 'escape']],
  ['เต็นท์', ['shelter', 'tent']],
  ['กระท่อม', ['shelter', 'hut']],
  ['หลังคา', ['shelter', 'roof']],
  ['ในป่า', ['wilderness', 'forest']],
  ['ป่า', ['forest', 'wilderness']],
  ['ฉุกเฉิน', ['emergency']],
  ['สร้าง', ['build', 'construct']],
  // Spanish / Portuguese
  ['refugio', ['shelter']],
  ['construir refugio', ['shelter', 'build']],
  ['tienda de campaña', ['tent', 'shelter']],
  ['cabaña', ['hut', 'shelter']],
  ['abrigo', ['shelter']],
  ['tenda', ['tent', 'shelter']],
  // French
  ['abri', ['shelter']],
  ['construire un abri', ['shelter', 'build']],
  ['tente', ['tent', 'shelter']],
  ['cabane', ['hut', 'shelter']],
  // Chinese
  ['庇护所', ['shelter']],
  ['搭建避难所', ['shelter', 'build']],
  ['帐篷', ['tent', 'shelter']],
  ['避难所', ['shelter', 'emergency']],
  ['建造', ['build', 'construct']],
  // Japanese
  ['シェルター', ['shelter']],
  ['シェルターを建てる', ['shelter', 'build']],
  ['テント', ['tent', 'shelter']],
  ['避難所', ['shelter', 'emergency']],
  // Korean
  ['대피소', ['shelter']],
  ['텐트', ['tent', 'shelter']],
  ['은신처', ['shelter', 'cover']],
  // Arabic
  ['مأوى', ['shelter']],
  ['بناء مأوى', ['shelter', 'build']],
  ['خيمة', ['tent', 'shelter']],
  ['ملجأ', ['shelter', 'emergency']],
  // Russian / Ukrainian
  ['укрытие', ['shelter']],
  ['построить укрытие', ['shelter', 'build']],
  ['палатка', ['tent', 'shelter']],
  ['убежище', ['shelter', 'emergency']],
  ['укриття', ['shelter']],
  ['намет', ['tent', 'shelter']],
  // German
  ['unterkunft', ['shelter']],
  ['unterstand bauen', ['shelter', 'build']],
  ['zelt', ['tent', 'shelter']],
  // Hindi
  ['आश्रय', ['shelter']],
  ['तंबू', ['tent', 'shelter']],
  ['जंगल', ['forest', 'wilderness']],
  // Italian / Dutch / Swedish
  ['rifugio', ['shelter']],
  ['tenda da campeggio', ['tent', 'shelter']],
  ['onderdak', ['shelter']],
  ['skydd', ['shelter']],
  ['tält', ['tent', 'shelter']],
  // Turkish / Polish / Vietnamese / Indonesian
  ['barınak', ['shelter']],
  ['çadır', ['tent', 'shelter']],
  ['schronienie', ['shelter']],
  ['namiot', ['tent', 'shelter']],
  ['nơi trú ẩn', ['shelter']],
  ['lều', ['tent', 'shelter']],
  ['tempat berlindung', ['shelter']],

  // ── FOOD / FORAGING ───────────────────────────────────────────────────────
  // Thai
  ['อาหาร', ['food']],
  ['หาอาหาร', ['food', 'forage', 'find']],
  ['พืชกินได้', ['food', 'plants', 'edible']],
  ['ล่าสัตว์', ['food', 'hunting', 'trap']],
  ['ดักสัตว์', ['food', 'trap', 'snare']],
  ['หาเห็ด', ['food', 'mushroom', 'forage']],
  ['ปลา', ['food', 'fish', 'fishing']],
  // Spanish / Portuguese
  ['comida', ['food']],
  ['buscar comida', ['food', 'forage']],
  ['plantas comestibles', ['food', 'edible', 'plants']],
  ['caza', ['food', 'hunting']],
  ['trampa', ['food', 'trap', 'snare']],
  ['pesca', ['food', 'fishing']],
  ['alimento', ['food']],
  ['forragear', ['food', 'forage']],
  // French
  ['nourriture', ['food']],
  ['chercher de la nourriture', ['food', 'forage']],
  ['plantes comestibles', ['food', 'edible', 'plants']],
  ['chasse', ['food', 'hunting']],
  ['piège', ['food', 'trap']],
  // Chinese
  ['食物', ['food']],
  ['觅食', ['food', 'forage']],
  ['可食用植物', ['food', 'edible', 'plants']],
  ['狩猎', ['food', 'hunting']],
  ['陷阱', ['food', 'trap']],
  ['捕鱼', ['food', 'fishing']],
  // Japanese
  ['食料', ['food']],
  ['食べ物', ['food']],
  ['採食', ['food', 'forage']],
  ['食用植物', ['food', 'edible', 'plants']],
  ['狩猟', ['food', 'hunting']],
  // Korean
  ['음식', ['food']],
  ['식용 식물', ['food', 'edible', 'plants']],
  ['사냥', ['food', 'hunting']],
  // Arabic
  ['طعام', ['food']],
  ['البحث عن طعام', ['food', 'forage']],
  ['نباتات صالحة للأكل', ['food', 'edible', 'plants']],
  ['صيد', ['food', 'hunting']],
  // Russian / Ukrainian
  ['еда', ['food']],
  ['пища', ['food']],
  ['поиск пищи', ['food', 'forage']],
  ['съедобные растения', ['food', 'edible', 'plants']],
  ['охота', ['food', 'hunting']],
  ['ловушка для дичи', ['food', 'trap']],
  ['їжа', ['food']],
  // German
  ['nahrung', ['food']],
  ['nahrungssuche', ['food', 'forage']],
  ['jagd', ['food', 'hunting']],
  ['essbare pflanzen', ['food', 'edible', 'plants']],
  // Hindi
  ['भोजन', ['food']],
  ['खाना', ['food']],
  ['खाद्य पौधे', ['food', 'edible', 'plants']],
  // Italian / Dutch / Swedish
  ['cibo', ['food']],
  ['foraggiare', ['food', 'forage']],
  ['voedsel', ['food']],
  ['mat', ['food']],
  ['jakt', ['food', 'hunting']],
  // Turkish / Polish / Vietnamese / Indonesian
  ['yiyecek', ['food']],
  ['avlanmak', ['food', 'hunting']],
  ['jedzenie', ['food']],
  ['polowanie', ['food', 'hunting']],
  ['thức ăn', ['food']],
  ['săn bắt', ['food', 'hunting']],
  ['makanan', ['food']],
  ['berburu', ['food', 'hunting']],

  // ── FIRST AID / MEDICAL ───────────────────────────────────────────────────
  // Thai
  ['ปฐมพยาบาล', ['first aid', 'medical']],
  ['รักษา', ['treat', 'medical', 'wound']],
  ['บาดแผล', ['wound', 'injury', 'first aid']],
  ['บาดเจ็บ', ['injury', 'wound', 'first aid']],
  ['เลือด', ['blood', 'bleeding', 'wound']],
  ['เลือดออก', ['bleeding', 'wound', 'tourniquet']],
  ['ป่วย', ['sick', 'illness', 'medical']],
  ['หัวใจหยุด', ['cpr', 'cardiac', 'heart']],
  ['กระดูกหัก', ['fracture', 'bone', 'splint']],
  ['งูกัด', ['snakebite', 'venom', 'bite']],
  ['ไฟไหม้ผิวหนัง', ['burn', 'wound']],
  ['ยา', ['medicine', 'medication']],
  // Spanish / Portuguese
  ['primeros auxilios', ['first aid']],
  ['herida', ['wound', 'injury']],
  ['hemorragia', ['bleeding']],
  ['fractura', ['fracture']],
  ['mordedura de serpiente', ['snakebite']],
  ['quemadura', ['burn']],
  ['primeiros socorros', ['first aid']],
  ['ferida', ['wound']],
  // French
  ['premiers secours', ['first aid']],
  ['blessure', ['wound', 'injury']],
  ['saignement', ['bleeding']],
  ['fracture', ['fracture']],
  ['brûlure', ['burn']],
  ['morsure de serpent', ['snakebite']],
  // Chinese
  ['急救', ['first aid']],
  ['伤口', ['wound']],
  ['出血', ['bleeding']],
  ['骨折', ['fracture']],
  ['烧伤', ['burn']],
  ['蛇咬伤', ['snakebite']],
  ['心肺复苏', ['cpr']],
  // Japanese
  ['応急処置', ['first aid']],
  ['出血', ['bleeding']],
  ['骨折', ['fracture']],
  ['熱傷', ['burn']],
  ['蛇に咬まれた', ['snakebite']],
  ['心肺蘇生', ['cpr']],
  // Korean
  ['응급처치', ['first aid']],
  ['부상', ['wound', 'injury']],
  ['출혈', ['bleeding']],
  ['골절', ['fracture']],
  ['화상', ['burn']],
  ['뱀에 물림', ['snakebite']],
  ['심폐소생술', ['cpr']],
  // Arabic
  ['إسعافات أولية', ['first aid']],
  ['جرح', ['wound']],
  ['نزيف', ['bleeding']],
  ['كسر', ['fracture']],
  ['حرق', ['burn']],
  ['لدغة ثعبان', ['snakebite']],
  // Russian / Ukrainian
  ['первая помощь', ['first aid']],
  ['рана', ['wound']],
  ['кровотечение', ['bleeding']],
  ['перелом', ['fracture']],
  ['ожог', ['burn']],
  ['укус змеи', ['snakebite']],
  ['перша допомога', ['first aid']],
  ['кровотеча', ['bleeding']],
  // German
  ['erste hilfe', ['first aid']],
  ['wunde', ['wound']],
  ['blutung', ['bleeding']],
  ['knochenbruch', ['fracture']],
  ['verbrennung', ['burn']],
  ['schlangenbiss', ['snakebite']],
  // Hindi
  ['प्राथमिक चिकित्सा', ['first aid']],
  ['घाव', ['wound']],
  ['रक्तस्राव', ['bleeding']],
  ['हड्डी टूटना', ['fracture']],
  ['जलना', ['burn']],
  // Italian / Dutch / Swedish
  ['primo soccorso', ['first aid']],
  ['ferita', ['wound']],
  ['emorragia', ['bleeding']],
  ['ehbo', ['first aid']],
  ['wond', ['wound']],
  ['bloeding', ['bleeding']],
  ['första hjälpen', ['first aid']],
  ['sår', ['wound']],
  ['blödning', ['bleeding']],
  // Turkish / Polish / Vietnamese / Indonesian
  ['ilk yardım', ['first aid']],
  ['yara', ['wound']],
  ['kanama', ['bleeding']],
  ['pierwsza pomoc', ['first aid']],
  ['rana', ['wound']],
  ['krwawienie', ['bleeding']],
  ['sơ cứu', ['first aid']],
  ['vết thương', ['wound']],
  ['chảy máu', ['bleeding']],
  ['pertolongan pertama', ['first aid']],
  ['luka', ['wound']],

  // ── NAVIGATION ────────────────────────────────────────────────────────────
  // Thai
  ['นำทาง', ['navigation', 'navigate']],
  ['เข็มทิศ', ['compass', 'navigation']],
  ['แผนที่', ['map', 'navigation']],
  ['ดาวเหนือ', ['north star', 'navigation', 'stars']],
  ['ทิศทาง', ['direction', 'navigation']],
  ['หลงทาง', ['lost', 'navigation', 'direction']],
  ['ทิศเหนือ', ['north', 'navigation', 'direction']],
  ['ดวงอาทิตย์', ['sun', 'navigation', 'direction']],
  // Spanish / Portuguese
  ['navegación', ['navigation']],
  ['brújula', ['compass']],
  ['orientación', ['navigation', 'direction']],
  ['estrella del norte', ['north star', 'navigation']],
  ['perdido', ['lost', 'navigation']],
  ['navegação', ['navigation']],
  ['bússola', ['compass']],
  // French
  ['boussole', ['compass']],
  ['orientation', ['navigation', 'direction']],
  ['étoile polaire', ['north star', 'navigation']],
  ['perdu', ['lost', 'navigation']],
  // Chinese
  ['导航', ['navigation']],
  ['指南针', ['compass']],
  ['地图', ['map', 'navigation']],
  ['北极星', ['north star', 'navigation']],
  ['方向', ['direction', 'navigation']],
  ['迷路', ['lost', 'navigation']],
  // Japanese
  ['ナビゲーション', ['navigation']],
  ['コンパス', ['compass']],
  ['地図', ['map', 'navigation']],
  ['北極星', ['north star', 'navigation']],
  ['道に迷った', ['lost', 'navigation']],
  // Korean
  ['내비게이션', ['navigation']],
  ['나침반', ['compass']],
  ['지도', ['map', 'navigation']],
  ['북극성', ['north star', 'navigation']],
  ['길을 잃었다', ['lost', 'navigation']],
  // Arabic
  ['ملاحة', ['navigation']],
  ['بوصلة', ['compass']],
  ['خريطة', ['map', 'navigation']],
  ['النجم القطبي', ['north star', 'navigation']],
  // Russian / Ukrainian
  ['навигация', ['navigation']],
  ['компас', ['compass']],
  ['карта', ['map', 'navigation']],
  ['полярная звезда', ['north star', 'navigation']],
  ['заблудился', ['lost', 'navigation']],
  ['навігація', ['navigation']],
  // German
  ['kompass', ['compass']],
  ['polarstern', ['north star', 'navigation']],
  ['verirrt', ['lost', 'navigation']],
  // Hindi
  ['कम्पास', ['compass']],
  ['नक्शा', ['map', 'navigation']],
  // Italian / Dutch / Swedish
  ['bussola', ['compass']],
  ['navigazione', ['navigation']],
  ['kompas', ['compass']],
  ['kompass', ['compass']],
  // Turkish / Polish / Vietnamese / Indonesian
  ['pusula', ['compass']],
  ['yönünü kaybetmek', ['lost', 'navigation']],
  ['kompas', ['compass']],
  ['la bàn', ['compass']],
  ['điều hướng', ['navigation']],

  // ── SIGNALING / RESCUE ────────────────────────────────────────────────────
  // Thai
  ['สัญญาณ', ['signal', 'signaling']],
  ['ขอความช่วยเหลือ', ['signal', 'rescue', 'sos']],
  ['ช่วยด้วย', ['help', 'rescue', 'sos']],
  ['ช่วยเหลือ', ['rescue', 'help', 'signal']],
  ['กู้ภัย', ['rescue', 'signal']],
  ['กระจก', ['mirror', 'signal']],
  ['ควัน', ['smoke', 'signal', 'fire']],
  // Spanish / Portuguese
  ['señal de socorro', ['signal', 'sos', 'rescue']],
  ['rescate', ['rescue']],
  ['socorro', ['sos', 'help', 'rescue']],
  ['señalizar', ['signal']],
  ['resgate', ['rescue']],
  // French
  ['secours', ['rescue', 'sos']],
  ['signalisation', ['signal']],
  ['sauvetage', ['rescue']],
  // Chinese
  ['求救信号', ['sos', 'rescue', 'signal']],
  ['救援', ['rescue']],
  ['信号镜', ['mirror', 'signal']],
  ['烟雾信号', ['smoke', 'signal']],
  // Japanese
  ['救助', ['rescue']],
  ['SOS信号', ['sos', 'signal']],
  ['のろし', ['smoke', 'signal']],
  // Korean
  ['구조', ['rescue']],
  ['조난 신호', ['sos', 'signal', 'rescue']],
  // Arabic
  ['إشارة', ['signal']],
  ['إنقاذ', ['rescue']],
  ['نداء استغاثة', ['sos', 'rescue']],
  // Russian / Ukrainian
  ['спасение', ['rescue']],
  ['сигнал бедствия', ['sos', 'signal', 'distress']],
  ['порятунок', ['rescue']],
  // German
  ['rettung', ['rescue']],
  ['notsignal', ['sos', 'signal']],
  // Hindi
  ['बचाव', ['rescue']],
  ['संकेत', ['signal']],
  // Italian / Dutch / Swedish
  ['segnale di soccorso', ['signal', 'sos', 'rescue']],
  ['soccorso', ['rescue']],
  ['reddingssignaal', ['signal', 'rescue']],
  ['räddningssignal', ['signal', 'rescue']],
  // Turkish / Polish / Vietnamese / Indonesian
  ['kurtarma sinyali', ['signal', 'rescue']],
  ['sygnał ratunkowy', ['signal', 'rescue']],
  ['tín hiệu cứu hộ', ['signal', 'rescue']],
  ['sinyal darurat', ['signal', 'rescue']],

  // ── NUCLEAR / RADIATION ───────────────────────────────────────────────────
  // Thai
  ['นิวเคลียร์', ['nuclear', 'radiation']],
  ['รังสี', ['radiation', 'nuclear']],
  ['กัมมันตภาพรังสี', ['radiation', 'nuclear', 'radioactive']],
  ['ระเบิดนิวเคลียร์', ['nuclear', 'bomb', 'explosion']],
  ['ฝุ่นกัมมันตรังสี', ['nuclear', 'fallout']],
  // Spanish / Portuguese
  ['radiación', ['radiation', 'nuclear']],
  ['radioactivo', ['radioactive', 'nuclear']],
  ['bomba nuclear', ['nuclear', 'bomb']],
  ['radiação nuclear', ['radiation', 'nuclear']],
  // French
  ['nucléaire', ['nuclear', 'radiation']],
  ['rayonnement', ['radiation']],
  ['radioactif', ['radioactive']],
  // Chinese
  ['核辐射', ['nuclear', 'radiation']],
  ['放射性', ['radioactive', 'nuclear']],
  ['核爆炸', ['nuclear', 'explosion']],
  ['核弹', ['nuclear', 'bomb']],
  // Japanese
  ['放射線', ['radiation', 'nuclear']],
  ['放射性', ['radioactive']],
  ['核爆発', ['nuclear', 'explosion']],
  // Korean
  ['방사선', ['radiation', 'nuclear']],
  ['방사성', ['radioactive']],
  ['핵폭탄', ['nuclear', 'bomb']],
  // Arabic
  ['نووي', ['nuclear', 'radiation']],
  ['إشعاع نووي', ['radiation', 'nuclear']],
  // Russian / Ukrainian
  ['ядерный', ['nuclear']],
  ['радиация', ['radiation', 'nuclear']],
  ['радиоактивный', ['radioactive']],
  ['ядерний', ['nuclear']],
  ['радіація', ['radiation']],
  // German
  ['nuklear', ['nuclear']],
  ['strahlung', ['radiation', 'nuclear']],
  ['radioaktiv', ['radioactive']],
  // Hindi
  ['परमाणु', ['nuclear']],
  ['विकिरण', ['radiation']],
  // Italian / Dutch / Swedish
  ['nucleare', ['nuclear']],
  ['radiazione', ['radiation']],
  ['nucleair', ['nuclear']],
  ['straling', ['radiation']],
  ['kärnvapen', ['nuclear']],
  ['strålning', ['radiation']],
  // Turkish / Polish / Vietnamese / Indonesian
  ['nükleer', ['nuclear']],
  ['radyasyon', ['radiation']],
  ['nuklearny', ['nuclear']],
  ['promieniowanie', ['radiation']],
  ['hạt nhân', ['nuclear']],
  ['phóng xạ', ['radiation']],
  ['nuklir', ['nuclear']],
  ['radiasi', ['radiation']],

  // ── CHEMICAL / BIOLOGICAL ─────────────────────────────────────────────────
  // Thai
  ['สารเคมี', ['chemical', 'hazmat']],
  ['แก๊สพิษ', ['chemical', 'gas', 'toxic']],
  ['สารพิษ', ['chemical', 'toxic', 'poison']],
  ['ชีวภาพ', ['biological', 'disease']],
  ['หน้ากากกันแก๊ส', ['gas mask', 'protection']],
  // Spanish / Portuguese
  ['agente químico', ['chemical']],
  ['gas tóxico', ['chemical', 'gas', 'toxic']],
  ['máscara de gas', ['gas mask', 'protection']],
  ['agente quimico', ['chemical']],
  // French
  ['chimique', ['chemical']],
  ['gaz toxique', ['chemical', 'gas', 'toxic']],
  ['masque à gaz', ['gas mask', 'protection']],
  // Chinese
  ['化学武器', ['chemical', 'weapon']],
  ['毒气', ['chemical', 'gas', 'toxic']],
  ['防毒面具', ['gas mask', 'protection']],
  // Japanese
  ['化学兵器', ['chemical', 'weapon']],
  ['毒ガス', ['chemical', 'gas', 'toxic']],
  ['防毒マスク', ['gas mask', 'protection']],
  // Korean
  ['화학 무기', ['chemical', 'weapon']],
  ['독가스', ['chemical', 'gas', 'toxic']],
  ['방독면', ['gas mask', 'protection']],
  // Arabic
  ['كيميائي', ['chemical']],
  ['غاز سام', ['chemical', 'gas', 'toxic']],
  ['قناع الغاز', ['gas mask', 'protection']],
  // Russian / Ukrainian
  ['химическое оружие', ['chemical', 'weapon']],
  ['ядовитый газ', ['chemical', 'gas', 'toxic']],
  ['противогаз', ['gas mask', 'protection']],
  ['хімічна зброя', ['chemical', 'weapon']],
  // German
  ['chemische waffe', ['chemical', 'weapon']],
  ['giftgas', ['chemical', 'gas', 'toxic']],
  ['gasmaske', ['gas mask', 'protection']],
  // Hindi
  ['रासायनिक', ['chemical']],
  ['जहरीली गैस', ['chemical', 'gas', 'toxic']],
  // Other
  ['gas tossico', ['chemical', 'gas']],
  ['gifgas', ['chemical', 'gas']],
  ['kimyasal silah', ['chemical', 'weapon']],
  ['gaz trujący', ['chemical', 'gas']],
  ['khí độc', ['chemical', 'gas']],
  ['gas beracun', ['chemical', 'gas']],

  // ── WAR ZONE / CONFLICT ───────────────────────────────────────────────────
  // Thai
  ['สงคราม', ['war', 'conflict', 'warzone']],
  ['ภัยสงคราม', ['war', 'warzone', 'conflict']],
  ['ระเบิด', ['explosion', 'bomb', 'mine']],
  ['ทุ่นระเบิด', ['landmine', 'mine', 'bomb']],
  ['การยิง', ['shooting', 'gunfire', 'combat']],
  ['ทหาร', ['military', 'soldier', 'combat']],
  ['อาวุธ', ['weapon', 'arms']],
  ['หลบหลีก', ['evade', 'escape', 'evasion']],
  // Spanish / Portuguese
  ['zona de guerra', ['warzone', 'conflict']],
  ['bomba', ['bomb', 'explosion']],
  ['mina terrestre', ['landmine', 'mine']],
  ['conflito armado', ['conflict', 'war']],
  // French
  ['zone de guerre', ['warzone', 'conflict']],
  ['bombe', ['bomb', 'explosion']],
  ['mine terrestre', ['landmine', 'mine']],
  // Chinese
  ['战区', ['warzone', 'conflict']],
  ['炸弹', ['bomb', 'explosion']],
  ['地雷', ['landmine', 'mine']],
  ['战争地带', ['warzone']],
  // Japanese
  ['戦場', ['warzone', 'battlefield']],
  ['爆弾', ['bomb', 'explosion']],
  ['地雷原', ['landmine', 'minefield']],
  // Korean
  ['전쟁 지역', ['warzone']],
  ['폭탄', ['bomb', 'explosion']],
  ['지뢰', ['landmine', 'mine']],
  // Arabic
  ['منطقة حرب', ['warzone']],
  ['قنبلة', ['bomb', 'explosion']],
  ['لغم أرضي', ['landmine', 'mine']],
  // Russian / Ukrainian
  ['зона боевых действий', ['warzone']],
  ['бомба', ['bomb', 'explosion']],
  ['мина', ['landmine', 'mine']],
  ['война', ['war', 'conflict']],
  ['мінне поле', ['landmine', 'minefield']],
  ['війна', ['war', 'conflict']],
  // German
  ['kriegsgebiet', ['warzone']],
  ['landmine', ['landmine', 'mine']],
  ['krieg', ['war', 'conflict']],
  // Hindi
  ['युद्ध', ['war', 'conflict']],
  ['बारूदी सुरंग', ['landmine', 'mine']],
  // Other
  ['zona di guerra', ['warzone']],
  ['mina anti-persona', ['landmine', 'mine']],
  ['oorlogszone', ['warzone']],
  ['savaş bölgesi', ['warzone']],
  ['strefa wojenna', ['warzone']],
  ['vùng chiến sự', ['warzone']],
  ['zona perang', ['warzone']],

  // ── PSYCHOLOGICAL / MENTAL ────────────────────────────────────────────────
  // Thai
  ['จิตใจ', ['psychological', 'mental', 'stress']],
  ['ความเครียด', ['stress', 'psychological', 'mental']],
  ['ตื่นตระหนก', ['panic', 'psychological', 'fear']],
  ['กลัว', ['fear', 'panic', 'psychological']],
  ['สติ', ['calm', 'mental', 'mindfulness']],
  ['ซึมเศร้า', ['depression', 'psychological', 'mental']],
  ['บาดแผลทางใจ', ['trauma', 'psychological', 'ptsd']],
  // Spanish / Portuguese
  ['psicológico', ['psychological', 'mental']],
  ['estrés', ['stress', 'psychological']],
  ['pánico', ['panic', 'psychological']],
  ['trauma psicológico', ['trauma', 'psychological']],
  // French
  ['psychologique', ['psychological', 'mental']],
  ['panique', ['panic', 'psychological']],
  ['trauma', ['trauma', 'psychological']],
  // Chinese
  ['心理', ['psychological', 'mental']],
  ['压力', ['stress', 'psychological']],
  ['恐慌', ['panic', 'psychological']],
  // Japanese
  ['心理的', ['psychological', 'mental']],
  ['パニック', ['panic', 'psychological']],
  ['ストレス', ['stress', 'psychological']],
  // Korean
  ['심리', ['psychological', 'mental']],
  ['패닉', ['panic', 'psychological']],
  ['스트레스', ['stress', 'psychological']],
  // Arabic
  ['نفسي', ['psychological', 'mental']],
  ['ذعر', ['panic', 'psychological']],
  // Russian / Ukrainian
  ['психологический', ['psychological', 'mental']],
  ['паника', ['panic', 'psychological']],
  ['стресс', ['stress', 'psychological']],
  ['психологічний', ['psychological', 'mental']],
  // German
  ['psychologisch', ['psychological', 'mental']],
  ['panik', ['panic', 'psychological']],
  // Other
  ['psicologico', ['psychological', 'mental']],
  ['panieken', ['panic', 'psychological']],
  ['psykologisk', ['psychological', 'mental']],
  ['psikolojik', ['psychological', 'mental']],
  ['psychologiczny', ['psychological', 'mental']],
  ['tâm lý', ['psychological', 'mental']],
  ['psikologis', ['psychological', 'mental']],

  // ── COMMUNICATION ─────────────────────────────────────────────────────────
  // Thai
  ['การสื่อสาร', ['communication', 'radio', 'signal']],
  ['วิทยุ', ['radio', 'communication']],
  ['โทรศัพท์ดาวเทียม', ['satellite', 'communication', 'phone']],
  ['มอร์ส', ['morse', 'communication', 'signal']],
  ['รหัสมอร์ส', ['morse code', 'communication']],
  // Spanish / Portuguese
  ['comunicación', ['communication']],
  ['radio de emergencia', ['radio', 'communication', 'emergency']],
  ['código morse', ['morse code', 'communication']],
  ['comunicação', ['communication']],
  // French
  ['communication radio', ['radio', 'communication']],
  ['code morse', ['morse code']],
  // Chinese
  ['通信', ['communication', 'radio']],
  ['无线电', ['radio', 'communication']],
  ['摩尔斯电码', ['morse code', 'communication']],
  // Japanese
  ['通信', ['communication']],
  ['無線', ['radio', 'communication']],
  ['モールス信号', ['morse code', 'communication']],
  // Korean
  ['통신', ['communication']],
  ['무선', ['radio', 'communication']],
  ['모스 부호', ['morse code', 'communication']],
  // Arabic
  ['اتصالات', ['communication']],
  ['راديو', ['radio', 'communication']],
  ['شفرة مورس', ['morse code', 'communication']],
  // Russian / Ukrainian
  ['связь', ['communication', 'radio']],
  ['рация', ['radio', 'communication']],
  ['азбука морзе', ['morse code', 'communication']],
  ['зв\'язок', ['communication']],
  // German
  ['kommunikation', ['communication']],
  ['morsecode', ['morse code', 'communication']],
  // Hindi
  ['संचार', ['communication']],
  ['रेडियो', ['radio', 'communication']],
  // Other
  ['comunicazione', ['communication']],
  ['communicatie', ['communication']],
  ['kommunikation', ['communication']],
  ['iletişim', ['communication']],
  ['komunikacja', ['communication']],
  ['liên lạc', ['communication']],
  ['komunikasi', ['communication']],
];

// Build a lookup map for faster search (deduplicated)
const MULTILINGUAL_KEYWORDS = new Map<string, string[]>();
for (const [keyword, translations] of KEYWORD_ENTRIES) {
  const key = keyword.toLowerCase();
  const existing = MULTILINGUAL_KEYWORDS.get(key);
  if (existing) {
    const merged = [...new Set([...existing, ...translations])];
    MULTILINGUAL_KEYWORDS.set(key, merged);
  } else {
    MULTILINGUAL_KEYWORDS.set(key, translations);
  }
}

// ─── Multilingual Query Translation ──────────────────────────────────────────

/**
 * Extracts English keywords from a query that may contain non-English words.
 * Uses substring matching so it works for languages without word separators
 * (Thai, Chinese, Japanese, Korean).
 */
function extractEnglishKeywords(query: string): string[] {
  const queryLower = query.toLowerCase();
  const keywords: string[] = [];

  for (const [keyword, englishTerms] of MULTILINGUAL_KEYWORDS) {
    if (queryLower.includes(keyword)) {
      keywords.push(...englishTerms);
    }
  }

  return [...new Set(keywords)];
}

/**
 * Search the knowledge base by matching query words against tags and question text.
 * Returns the top 5 results scored by relevance.
 *
 * Supports multilingual queries — non-English words are mapped to English
 * equivalents via MULTILINGUAL_KEYWORDS before searching.
 *
 * Scoring:
 * - Exact tag match: 3 points per matching tag
 * - Partial tag match (tag contains query word): 2 points
 * - Question text contains query word: 1 point per occurrence
 * - Answer text contains query word: 0.5 points
 */
export function searchKnowledge(query: string): KnowledgeEntry[] {
  // Split English words from query
  const rawWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 1);

  // Extract translated English keywords from multilingual content
  const translatedKeywords = extractEnglishKeywords(query);

  // Combine and deduplicate
  const queryWords = [...new Set([...rawWords, ...translatedKeywords])];

  if (queryWords.length === 0) {
    return [];
  }

  const scored = entries.map((entry) => {
    let score = 0;
    const questionLower = entry.q.toLowerCase();
    const answerLower = entry.a.toLowerCase();

    for (const word of queryWords) {
      // Check tags for exact match (highest relevance)
      for (const tag of entry.tags) {
        const tagLower = tag.toLowerCase();
        if (tagLower === word) {
          score += 3;
        } else if (tagLower.includes(word) || word.includes(tagLower)) {
          score += 2;
        }
      }

      // Check question text
      if (questionLower.includes(word)) {
        score += 1;
      }

      // Check answer text (lower weight)
      if (answerLower.includes(word)) {
        score += 0.5;
      }
    }

    return { entry, score };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => item.entry);
}

/**
 * Get all knowledge entries in a specific category.
 */
export function getCategory(category: string): KnowledgeEntry[] {
  return entries.filter(
    (entry) => entry.category.toLowerCase() === category.toLowerCase()
  );
}

/**
 * Get a list of all unique categories in the knowledge base.
 */
export function getCategories(): string[] {
  const categorySet = new Set(entries.map((entry) => entry.category));
  return Array.from(categorySet).sort();
}
