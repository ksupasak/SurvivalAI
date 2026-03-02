/**
 * Internationalization (i18n) Service
 *
 * Supports multiple languages for the SurvivalAI app.
 * Languages: English, Thai, Spanish, French, Chinese, Japanese, Korean, Arabic, Russian, German, Portuguese, Hindi
 */

import { useState, useEffect } from 'react';

export type SupportedLocale =
  | 'en' | 'th' | 'es' | 'fr' | 'zh' | 'ja'
  | 'ko' | 'ar' | 'ru' | 'de' | 'pt' | 'hi';

export interface LocaleInfo {
  code: SupportedLocale;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LOCALES: LocaleInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
];

// ─── Translation strings ────────────────────────────────────────────────────

type Translations = Record<string, Record<SupportedLocale, string>>;

const translations: Translations = {
  // ── Tab names ──────────────────────────────────────────────────────────
  tab_home: {
    en: 'Home', th: 'หน้าหลัก', es: 'Inicio', fr: 'Accueil',
    zh: '首页', ja: 'ホーム', ko: '홈', ar: 'الرئيسية',
    ru: 'Главная', de: 'Startseite', pt: 'Início', hi: 'होम',
  },
  tab_chat: {
    en: 'Chat', th: 'แชท', es: 'Chat', fr: 'Chat',
    zh: '聊天', ja: 'チャット', ko: '채팅', ar: 'محادثة',
    ru: 'Чат', de: 'Chat', pt: 'Chat', hi: 'चैट',
  },
  tab_calculator: {
    en: 'Calculator', th: 'คำนวณ', es: 'Calculadora', fr: 'Calculateur',
    zh: '计算器', ja: '計算機', ko: '계산기', ar: 'حاسبة',
    ru: 'Калькулятор', de: 'Rechner', pt: 'Calculadora', hi: 'कैलकुलेटर',
  },
  tab_morse: {
    en: 'Morse', th: 'มอร์ส', es: 'Morse', fr: 'Morse',
    zh: '摩尔斯', ja: 'モールス', ko: '모스', ar: 'مورس',
    ru: 'Морзе', de: 'Morse', pt: 'Morse', hi: 'मोर्स',
  },
  tab_notes: {
    en: 'Notes', th: 'บันทึก', es: 'Notas', fr: 'Notes',
    zh: '笔记', ja: 'ノート', ko: '노트', ar: 'ملاحظات',
    ru: 'Заметки', de: 'Notizen', pt: 'Notas', hi: 'नोट्स',
  },
  tab_seeking: {
    en: 'Seeking', th: 'ค้นหา', es: 'Búsqueda', fr: 'Recherche',
    zh: '求救', ja: '救助', ko: '구조', ar: 'استغاثة',
    ru: 'Поиск', de: 'Suche', pt: 'Busca', hi: 'खोज',
  },

  // ── Home screen ────────────────────────────────────────────────────────
  home_title: {
    en: 'SURVIVAL AI', th: 'SURVIVAL AI', es: 'SURVIVAL AI', fr: 'SURVIVAL AI',
    zh: 'SURVIVAL AI', ja: 'SURVIVAL AI', ko: 'SURVIVAL AI', ar: 'SURVIVAL AI',
    ru: 'SURVIVAL AI', de: 'SURVIVAL AI', pt: 'SURVIVAL AI', hi: 'SURVIVAL AI',
  },
  status_online: {
    en: 'Online', th: 'ออนไลน์', es: 'En línea', fr: 'En ligne',
    zh: '在线', ja: 'オンライン', ko: '온라인', ar: 'متصل',
    ru: 'Онлайн', de: 'Online', pt: 'Online', hi: 'ऑनलाइन',
  },
  status_offline: {
    en: 'Offline', th: 'ออฟไลน์', es: 'Sin conexión', fr: 'Hors ligne',
    zh: '离线', ja: 'オフライン', ko: '오프라인', ar: 'غير متصل',
    ru: 'Офлайн', de: 'Offline', pt: 'Offline', hi: 'ऑफलाइन',
  },
  battery: {
    en: 'Battery', th: 'แบตเตอรี่', es: 'Batería', fr: 'Batterie',
    zh: '电池', ja: 'バッテリー', ko: '배터리', ar: 'البطارية',
    ru: 'Батарея', de: 'Batterie', pt: 'Bateria', hi: 'बैटरी',
  },
  quick_actions: {
    en: 'QUICK ACTIONS', th: 'การดำเนินการด่วน', es: 'ACCIONES RÁPIDAS', fr: 'ACTIONS RAPIDES',
    zh: '快捷操作', ja: 'クイックアクション', ko: '빠른 작업', ar: 'إجراءات سريعة',
    ru: 'БЫСТРЫЕ ДЕЙСТВИЯ', de: 'SCHNELLAKTIONEN', pt: 'AÇÕES RÁPIDAS', hi: 'त्वरित कार्य',
  },
  sos_emergency: {
    en: 'SOS Emergency', th: 'SOS ฉุกเฉิน', es: 'SOS Emergencia', fr: 'SOS Urgence',
    zh: 'SOS紧急', ja: 'SOS緊急', ko: 'SOS 긴급', ar: 'SOS طوارئ',
    ru: 'SOS Экстренная', de: 'SOS Notfall', pt: 'SOS Emergência', hi: 'SOS आपातकाल',
  },
  ai_chat: {
    en: 'AI Chat', th: 'แชท AI', es: 'Chat AI', fr: 'Chat IA',
    zh: 'AI聊天', ja: 'AIチャット', ko: 'AI 채팅', ar: 'دردشة AI',
    ru: 'AI Чат', de: 'AI Chat', pt: 'Chat IA', hi: 'AI चैट',
  },
  supply_calc: {
    en: 'Supply Calc', th: 'คำนวณเสบียง', es: 'Calc Suministros', fr: 'Calc Fournitures',
    zh: '物资计算', ja: '物資計算', ko: '보급 계산', ar: 'حساب الإمدادات',
    ru: 'Расчет запасов', de: 'Vorräte Rechner', pt: 'Calc Suprimentos', hi: 'आपूर्ति गणना',
  },
  seeking_mode: {
    en: 'Seeking Mode', th: 'โหมดค้นหา', es: 'Modo Búsqueda', fr: 'Mode Recherche',
    zh: '求救模式', ja: '救助モード', ko: '구조 모드', ar: 'وضع الاستغاثة',
    ru: 'Режим поиска', de: 'Suchmodus', pt: 'Modo Busca', hi: 'खोज मोड',
  },
  emergency_info: {
    en: 'EMERGENCY INFO', th: 'ข้อมูลฉุกเฉิน', es: 'INFO EMERGENCIA', fr: 'INFO URGENCE',
    zh: '紧急信息', ja: '緊急情報', ko: '긴급 정보', ar: 'معلومات الطوارئ',
    ru: 'ЭКСТРЕННАЯ ИНФОРМАЦИЯ', de: 'NOTFALL-INFO', pt: 'INFO EMERGÊNCIA', hi: 'आपातकालीन जानकारी',
  },
  rule_of_threes: {
    en: 'Rule of 3s', th: 'กฎ 3 ข้อ', es: 'Regla de 3', fr: 'Règle des 3',
    zh: '三的法则', ja: '3の法則', ko: '3의 법칙', ar: 'قاعدة الثلاثات',
    ru: 'Правило тройки', de: 'Dreier-Regel', pt: 'Regra de 3', hi: '3 का नियम',
  },
  rule_air: {
    en: '3 min without air', th: '3 นาทีไม่มีอากาศ', es: '3 min sin aire', fr: '3 min sans air',
    zh: '3分钟无空气', ja: '3分間空気なし', ko: '3분 공기 없이', ar: '3 دقائق بدون هواء',
    ru: '3 мин без воздуха', de: '3 Min ohne Luft', pt: '3 min sem ar', hi: '3 मिनट हवा के बिना',
  },
  rule_shelter: {
    en: '3 hrs without shelter', th: '3 ชม.ไม่มีที่พัก', es: '3 hrs sin refugio', fr: '3 h sans abri',
    zh: '3小时无庇护', ja: '3時間シェルターなし', ko: '3시간 은신처 없이', ar: '3 ساعات بدون مأوى',
    ru: '3 часа без укрытия', de: '3 Std ohne Schutz', pt: '3 hrs sem abrigo', hi: '3 घंटे आश्रय के बिना',
  },
  rule_water: {
    en: '3 days without water', th: '3 วันไม่มีน้ำ', es: '3 días sin agua', fr: '3 jours sans eau',
    zh: '3天无水', ja: '3日間水なし', ko: '3일 물 없이', ar: '3 أيام بدون ماء',
    ru: '3 дня без воды', de: '3 Tage ohne Wasser', pt: '3 dias sem água', hi: '3 दिन पानी के बिना',
  },
  rule_food: {
    en: '3 weeks without food', th: '3 สัปดาห์ไม่มีอาหาร', es: '3 semanas sin comida', fr: '3 semaines sans nourriture',
    zh: '3周无食物', ja: '3週間食べ物なし', ko: '3주 음식 없이', ar: '3 أسابيع بدون طعام',
    ru: '3 недели без еды', de: '3 Wochen ohne Nahrung', pt: '3 semanas sem comida', hi: '3 सप्ताह भोजन के बिना',
  },
  language: {
    en: 'Language', th: 'ภาษา', es: 'Idioma', fr: 'Langue',
    zh: '语言', ja: '言語', ko: '언어', ar: 'اللغة',
    ru: 'Язык', de: 'Sprache', pt: 'Idioma', hi: 'भाषा',
  },

  // ── Chat screen ────────────────────────────────────────────────────────
  ai_assistant: {
    en: 'AI ASSISTANT', th: 'ผู้ช่วย AI', es: 'ASISTENTE IA', fr: 'ASSISTANT IA',
    zh: 'AI助手', ja: 'AIアシスタント', ko: 'AI 어시스턴트', ar: 'مساعد AI',
    ru: 'AI АССИСТЕНТ', de: 'AI ASSISTENT', pt: 'ASSISTENTE IA', hi: 'AI सहायक',
  },
  chat_welcome: {
    en: "I'm your survival assistant. Ask me anything about emergency preparedness, first aid, shelter, water purification, navigation, and more. I work offline using my built-in knowledge base.",
    th: "ฉันคือผู้ช่วยเอาชีวิตรอดของคุณ ถามฉันเกี่ยวกับการเตรียมพร้อมฉุกเฉิน ปฐมพยาบาล ที่พัก การกรองน้ำ การนำทาง และอื่นๆ ฉันทำงานแบบออฟไลน์โดยใช้ฐานความรู้ในตัว",
    es: "Soy tu asistente de supervivencia. Pregúntame sobre preparación para emergencias, primeros auxilios, refugio, purificación de agua, navegación y más. Funciono sin conexión usando mi base de conocimientos.",
    fr: "Je suis votre assistant de survie. Posez-moi des questions sur la préparation aux urgences, les premiers secours, l'abri, la purification d'eau, la navigation et plus. Je fonctionne hors ligne avec ma base de connaissances.",
    zh: "我是你的生存助手。问我关于紧急准备、急救、庇护所、水净化、导航等任何问题。我使用内置知识库离线工作。",
    ja: "私はあなたのサバイバルアシスタントです。緊急時の備え、応急処置、シェルター、浄水、ナビゲーションなどについて何でも聞いてください。内蔵の知識ベースでオフライン動作します。",
    ko: "저는 당신의 생존 도우미입니다. 비상 대비, 응급처치, 대피소, 정수, 항법 등에 대해 무엇이든 물어보세요. 내장 지식 데이터베이스로 오프라인에서 작동합니다.",
    ar: "أنا مساعدك للبقاء. اسألني عن الاستعداد للطوارئ والإسعافات الأولية والمأوى وتنقية المياه والملاحة والمزيد. أعمل بدون اتصال باستخدام قاعدة المعرفة المدمجة.",
    ru: "Я ваш помощник по выживанию. Спрашивайте о подготовке к чрезвычайным ситуациям, первой помощи, укрытии, очистке воды, навигации и многом другом. Я работаю офлайн, используя встроенную базу знаний.",
    de: "Ich bin dein Überlebensassistent. Frag mich alles über Notfallvorsorge, Erste Hilfe, Unterschlupf, Wasseraufbereitung, Navigation und mehr. Ich arbeite offline mit meiner integrierten Wissensdatenbank.",
    pt: "Sou seu assistente de sobrevivência. Pergunte-me sobre preparação para emergências, primeiros socorros, abrigo, purificação de água, navegação e mais. Funciono offline usando minha base de conhecimento.",
    hi: "मैं आपका जीवन रक्षा सहायक हूं। आपातकालीन तैयारी, प्राथमिक चिकित्सा, आश्रय, जल शोधन, नेविगेशन और अन्य के बारे में कुछ भी पूछें। मैं अपने अंतर्निर्मित ज्ञान आधार का उपयोग करके ऑफ़लाइन काम करता हूं।",
  },
  chat_placeholder: {
    en: 'Ask a survival question...', th: 'ถามคำถามเรื่องเอาชีวิตรอด...', es: 'Haz una pregunta de supervivencia...', fr: 'Posez une question de survie...',
    zh: '问一个生存问题...', ja: 'サバイバルの質問をする...', ko: '생존 질문하기...', ar: 'اسأل سؤال بقاء...',
    ru: 'Задайте вопрос о выживании...', de: 'Stell eine Überlebensfrage...', pt: 'Faça uma pergunta de sobrevivência...', hi: 'जीवन रक्षा प्रश्न पूछें...',
  },
  chat_error: {
    en: 'Sorry, I encountered an error processing your request. Please try again.',
    th: 'ขออภัย เกิดข้อผิดพลาดในการประมวลผลคำขอ กรุณาลองอีกครั้ง',
    es: 'Lo siento, encontré un error al procesar tu solicitud. Inténtalo de nuevo.',
    fr: "Désolé, j'ai rencontré une erreur. Veuillez réessayer.",
    zh: '抱歉，处理您的请求时出错。请重试。',
    ja: '申し訳ございません。エラーが発生しました。もう一度お試しください。',
    ko: '죄송합니다. 요청 처리 중 오류가 발생했습니다. 다시 시도해 주세요.',
    ar: 'عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.',
    ru: 'Извините, произошла ошибка. Пожалуйста, попробуйте снова.',
    de: 'Entschuldigung, ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
    pt: 'Desculpe, ocorreu um erro. Tente novamente.',
    hi: 'क्षमा करें, त्रुटि हुई। कृपया पुनः प्रयास करें।',
  },

  // ── Mode labels ────────────────────────────────────────────────────────
  mode_knowledge: {
    en: 'Knowledge Base', th: 'ฐานความรู้', es: 'Base de Conocimiento', fr: 'Base de Connaissances',
    zh: '知识库', ja: '知識ベース', ko: '지식 데이터베이스', ar: 'قاعدة المعرفة',
    ru: 'База знаний', de: 'Wissensdatenbank', pt: 'Base de Conhecimento', hi: 'ज्ञान आधार',
  },
  mode_offline_llm: {
    en: 'Offline LLM', th: 'LLM ออฟไลน์', es: 'LLM Sin Conexión', fr: 'LLM Hors Ligne',
    zh: '离线LLM', ja: 'オフラインLLM', ko: '오프라인 LLM', ar: 'LLM غير متصل',
    ru: 'Офлайн LLM', de: 'Offline LLM', pt: 'LLM Offline', hi: 'ऑफलाइन LLM',
  },
  mode_online: {
    en: 'Online', th: 'ออนไลน์', es: 'En Línea', fr: 'En Ligne',
    zh: '在线', ja: 'オンライン', ko: '온라인', ar: 'متصل',
    ru: 'Онлайн', de: 'Online', pt: 'Online', hi: 'ऑनलाइन',
  },
  mode_knowledge_desc: {
    en: 'Instant offline answers from 94+ survival entries. Always available.',
    th: 'คำตอบออฟไลน์ทันทีจาก 94+ รายการเอาชีวิตรอด พร้อมใช้งานเสมอ',
    es: 'Respuestas instantáneas de 94+ entradas de supervivencia. Siempre disponible.',
    fr: 'Réponses instantanées hors ligne de 94+ entrées de survie. Toujours disponible.',
    zh: '来自94+生存条目的即时离线回答。始终可用。',
    ja: '94+のサバイバル項目からの即時オフライン回答。常に利用可能。',
    ko: '94개 이상의 생존 항목에서 즉시 오프라인 답변. 항상 사용 가능.',
    ar: 'إجابات فورية من 94+ مدخل بقاء. متاح دائماً.',
    ru: 'Мгновенные офлайн-ответы из 94+ записей о выживании. Всегда доступно.',
    de: 'Sofortige Offline-Antworten aus 94+ Überlebenseinträgen. Immer verfügbar.',
    pt: 'Respostas offline instantâneas de 94+ entradas de sobrevivência. Sempre disponível.',
    hi: '94+ उत्तरजीविता प्रविष्टियों से तत्काल ऑफलाइन उत्तर। हमेशा उपलब्ध।',
  },
  mode_offline_llm_desc: {
    en: 'On-device AI model for advanced reasoning. Download required.',
    th: 'โมเดล AI บนอุปกรณ์สำหรับการใช้เหตุผลขั้นสูง ต้องดาวน์โหลด',
    es: 'Modelo AI en el dispositivo para razonamiento avanzado. Requiere descarga.',
    fr: "Modèle IA embarqué pour le raisonnement avancé. Téléchargement requis.",
    zh: '设备上的AI模型用于高级推理。需要下载。',
    ja: '高度な推論のためのオンデバイスAIモデル。ダウンロードが必要。',
    ko: '고급 추론을 위한 온디바이스 AI 모델. 다운로드 필요.',
    ar: 'نموذج AI على الجهاز للتحليل المتقدم. التحميل مطلوب.',
    ru: 'AI-модель на устройстве для продвинутых рассуждений. Требуется загрузка.',
    de: 'On-Device AI-Modell für fortgeschrittenes Denken. Download erforderlich.',
    pt: 'Modelo AI no dispositivo para raciocínio avançado. Download necessário.',
    hi: 'उन्नत तर्क के लिए ऑन-डिवाइस AI मॉडल। डाउनलोड आवश्यक।',
  },
  mode_online_desc: {
    en: 'ChatGPT-powered advanced AI. Requires internet and API key.',
    th: 'AI ขั้นสูงจาก ChatGPT ต้องใช้อินเทอร์เน็ตและ API key',
    es: 'IA avanzada con ChatGPT. Requiere internet y clave API.',
    fr: 'IA avancée alimentée par ChatGPT. Nécessite internet et clé API.',
    zh: '由ChatGPT驱动的高级AI。需要互联网和API密钥。',
    ja: 'ChatGPT搭載の高度AI。インターネットとAPIキーが必要。',
    ko: 'ChatGPT 기반 고급 AI. 인터넷과 API 키 필요.',
    ar: 'AI متقدم مدعوم بـ ChatGPT. يتطلب إنترنت ومفتاح API.',
    ru: 'Продвинутый AI на основе ChatGPT. Требуется интернет и API-ключ.',
    de: 'ChatGPT-basierte erweiterte KI. Internet und API-Schlüssel erforderlich.',
    pt: 'IA avançada com ChatGPT. Requer internet e chave API.',
    hi: 'ChatGPT-संचालित उन्नत AI। इंटरनेट और API कुंजी आवश्यक।',
  },

  // ── Quick topics ───────────────────────────────────────────────────────
  topic_water: {
    en: 'Water', th: 'น้ำ', es: 'Agua', fr: 'Eau',
    zh: '水', ja: '水', ko: '물', ar: 'ماء',
    ru: 'Вода', de: 'Wasser', pt: 'Água', hi: 'पानी',
  },
  topic_water_q: {
    en: 'How do I purify water in an emergency?', th: 'วิธีกรองน้ำในสถานการณ์ฉุกเฉิน?', es: '¿Cómo purifico agua en emergencia?', fr: "Comment purifier l'eau en urgence?",
    zh: '紧急情况下如何净化水？', ja: '緊急時の浄水方法は？', ko: '비상시 정수 방법은?', ar: 'كيف أنقي الماء في حالة طوارئ؟',
    ru: 'Как очистить воду в чрезвычайной ситуации?', de: 'Wie reinige ich Wasser im Notfall?', pt: 'Como purificar água em emergência?', hi: 'आपातकाल में पानी कैसे शुद्ध करें?',
  },
  topic_first_aid: {
    en: 'First Aid', th: 'ปฐมพยาบาล', es: 'Primeros Auxilios', fr: 'Premiers Secours',
    zh: '急救', ja: '応急処置', ko: '응급처치', ar: 'إسعافات أولية',
    ru: 'Первая помощь', de: 'Erste Hilfe', pt: 'Primeiros Socorros', hi: 'प्राथमिक चिकित्सा',
  },
  topic_first_aid_q: {
    en: 'What are the essential first aid steps for a bleeding wound?', th: 'ขั้นตอนปฐมพยาบาลสำหรับแผลเลือดออก?', es: '¿Cuáles son los pasos esenciales para una herida sangrante?', fr: 'Quelles sont les étapes essentielles pour une plaie saignante?',
    zh: '出血伤口的基本急救步骤是什么？', ja: '出血傷の基本的な応急処置は？', ko: '출혈 상처의 필수 응급처치 단계는?', ar: 'ما هي خطوات الإسعافات الأولية للجرح النازف؟',
    ru: 'Каковы основные шаги первой помощи при кровоточащей ране?', de: 'Was sind die wichtigsten Erste-Hilfe-Schritte bei Blutungen?', pt: 'Quais são os passos essenciais de primeiros socorros para ferimentos com sangramento?', hi: 'खून बहने वाले घाव के लिए प्राथमिक चिकित्सा के आवश्यक कदम क्या हैं?',
  },
  topic_shelter: {
    en: 'Shelter', th: 'ที่พัก', es: 'Refugio', fr: 'Abri',
    zh: '庇护所', ja: 'シェルター', ko: '대피소', ar: 'مأوى',
    ru: 'Укрытие', de: 'Unterkunft', pt: 'Abrigo', hi: 'आश्रय',
  },
  topic_shelter_q: {
    en: 'How do I build an emergency shelter in the wilderness?', th: 'วิธีสร้างที่พักฉุกเฉินในป่า?', es: '¿Cómo construyo un refugio de emergencia en la naturaleza?', fr: "Comment construire un abri d'urgence en pleine nature?",
    zh: '如何在野外搭建紧急庇护所？', ja: '野外で緊急シェルターの作り方は？', ko: '야생에서 비상 대피소를 만드는 방법은?', ar: 'كيف أبني مأوى طوارئ في البرية؟',
    ru: 'Как построить аварийное укрытие в дикой природе?', de: 'Wie baue ich eine Notunterkunft in der Wildnis?', pt: 'Como construir um abrigo de emergência na natureza?', hi: 'जंगल में आपातकालीन आश्रय कैसे बनाएं?',
  },
  topic_fire: {
    en: 'Fire', th: 'ไฟ', es: 'Fuego', fr: 'Feu',
    zh: '火', ja: '火', ko: '불', ar: 'نار',
    ru: 'Огонь', de: 'Feuer', pt: 'Fogo', hi: 'आग',
  },
  topic_fire_q: {
    en: 'How do I start a fire without matches or a lighter?', th: 'วิธีก่อไฟโดยไม่มีไม้ขีดหรือไฟแช็ก?', es: '¿Cómo enciendo fuego sin fósforos o encendedor?', fr: 'Comment allumer un feu sans allumettes ni briquet?',
    zh: '没有火柴或打火机如何生火？', ja: 'マッチやライターなしで火を起こす方法は？', ko: '성냥이나 라이터 없이 불을 피우는 방법은?', ar: 'كيف أشعل النار بدون كبريت أو ولاعة؟',
    ru: 'Как разжечь огонь без спичек или зажигалки?', de: 'Wie mache ich Feuer ohne Streichhölzer oder Feuerzeug?', pt: 'Como fazer fogo sem fósforos ou isqueiro?', hi: 'माचिस या लाइटर के बिना आग कैसे जलाएं?',
  },
  topic_navigation: {
    en: 'Navigation', th: 'นำทาง', es: 'Navegación', fr: 'Navigation',
    zh: '导航', ja: 'ナビゲーション', ko: '항법', ar: 'ملاحة',
    ru: 'Навигация', de: 'Navigation', pt: 'Navegação', hi: 'नेविगेशन',
  },
  topic_navigation_q: {
    en: 'How do I navigate without a compass or GPS?', th: 'วิธีนำทางโดยไม่มีเข็มทิศหรือ GPS?', es: '¿Cómo navego sin brújula ni GPS?', fr: 'Comment naviguer sans boussole ni GPS?',
    zh: '没有指南针或GPS如何导航？', ja: 'コンパスやGPSなしで方向を知る方法は？', ko: '나침반이나 GPS 없이 길을 찾는 방법은?', ar: 'كيف أتنقل بدون بوصلة أو GPS؟',
    ru: 'Как ориентироваться без компаса или GPS?', de: 'Wie navigiere ich ohne Kompass oder GPS?', pt: 'Como navegar sem bússola ou GPS?', hi: 'कंपास या GPS के बिना नेविगेट कैसे करें?',
  },
  topic_food: {
    en: 'Food', th: 'อาหาร', es: 'Comida', fr: 'Nourriture',
    zh: '食物', ja: '食料', ko: '식량', ar: 'طعام',
    ru: 'Еда', de: 'Nahrung', pt: 'Comida', hi: 'भोजन',
  },
  topic_food_q: {
    en: 'How do I find safe food in the wild?', th: 'วิธีหาอาหารที่ปลอดภัยในป่า?', es: '¿Cómo encuentro comida segura en la naturaleza?', fr: 'Comment trouver de la nourriture sûre dans la nature?',
    zh: '如何在野外找到安全的食物？', ja: '野外で安全な食べ物の見つけ方は？', ko: '야생에서 안전한 음식을 찾는 방법은?', ar: 'كيف أجد طعاماً آمناً في البرية؟',
    ru: 'Как найти безопасную еду в дикой природе?', de: 'Wie finde ich sichere Nahrung in der Wildnis?', pt: 'Como encontrar comida segura na natureza?', hi: 'जंगल में सुरक्षित भोजन कैसे खोजें?',
  },
  topic_nuclear: {
    en: 'Nuclear', th: 'นิวเคลียร์', es: 'Nuclear', fr: 'Nucléaire',
    zh: '核', ja: '核', ko: '핵', ar: 'نووي',
    ru: 'Ядерная', de: 'Nuklear', pt: 'Nuclear', hi: 'परमाणु',
  },
  topic_nuclear_q: {
    en: 'What should I do in a nuclear emergency?', th: 'ควรทำอย่างไรในสถานการณ์ฉุกเฉินนิวเคลียร์?', es: '¿Qué debo hacer en una emergencia nuclear?', fr: 'Que faire en cas d\'urgence nucléaire?',
    zh: '核紧急情况该怎么办？', ja: '核緊急事態の対処法は？', ko: '핵 비상시 어떻게 해야 하나요?', ar: 'ماذا أفعل في حالة طوارئ نووية؟',
    ru: 'Что делать при ядерной аварии?', de: 'Was tun bei einem Nuklearnotfall?', pt: 'O que fazer em emergência nuclear?', hi: 'परमाणु आपातकाल में क्या करना चाहिए?',
  },
  topic_war_zone: {
    en: 'War Zone', th: 'เขตสงคราม', es: 'Zona de Guerra', fr: 'Zone de Guerre',
    zh: '战区', ja: '戦争地帯', ko: '전쟁 지역', ar: 'منطقة حرب',
    ru: 'Зона войны', de: 'Kriegsgebiet', pt: 'Zona de Guerra', hi: 'युद्ध क्षेत्र',
  },
  topic_war_zone_q: {
    en: 'How do I stay safe in an active conflict or war zone?', th: 'วิธีอยู่อย่างปลอดภัยในเขตสงคราม?', es: '¿Cómo me mantengo seguro en zona de conflicto?', fr: 'Comment rester en sécurité en zone de conflit?',
    zh: '如何在战区保持安全？', ja: '紛争地帯での安全確保方法は？', ko: '전쟁 지역에서 안전하게 지내는 방법은?', ar: 'كيف أبقى آمناً في منطقة نزاع؟',
    ru: 'Как оставаться в безопасности в зоне конфликта?', de: 'Wie bleibe ich in einem Kriegsgebiet sicher?', pt: 'Como me manter seguro em zona de conflito?', hi: 'युद्ध क्षेत्र में सुरक्षित कैसे रहें?',
  },
  topic_signals: {
    en: 'Signals', th: 'สัญญาณ', es: 'Señales', fr: 'Signaux',
    zh: '信号', ja: '信号', ko: '신호', ar: 'إشارات',
    ru: 'Сигналы', de: 'Signale', pt: 'Sinais', hi: 'संकेत',
  },
  topic_signals_q: {
    en: 'How do I signal for rescue in an emergency?', th: 'วิธีส่งสัญญาณขอความช่วยเหลือในสถานการณ์ฉุกเฉิน?', es: '¿Cómo señalizo para rescate en emergencia?', fr: "Comment signaler pour être secouru en urgence?",
    zh: '紧急情况下如何发送求救信号？', ja: '緊急時の救助信号の出し方は？', ko: '비상시 구조 신호를 보내는 방법은?', ar: 'كيف أرسل إشارة استغاثة في حالة طوارئ؟',
    ru: 'Как подать сигнал о помощи в чрезвычайной ситуации?', de: 'Wie signalisiere ich im Notfall um Rettung?', pt: 'Como sinalizar para resgate em emergência?', hi: 'आपातकाल में बचाव के लिए संकेत कैसे दें?',
  },
  topic_mental_health: {
    en: 'Mental Health', th: 'สุขภาพจิต', es: 'Salud Mental', fr: 'Santé Mentale',
    zh: '心理健康', ja: 'メンタルヘルス', ko: '정신 건강', ar: 'صحة نفسية',
    ru: 'Психическое здоровье', de: 'Psychische Gesundheit', pt: 'Saúde Mental', hi: 'मानसिक स्वास्थ्य',
  },
  topic_mental_health_q: {
    en: 'How do I manage stress and panic in a survival situation?', th: 'วิธีจัดการความเครียดและความตื่นตระหนกในสถานการณ์เอาชีวิตรอด?', es: '¿Cómo manejo el estrés y pánico en supervivencia?', fr: 'Comment gérer le stress et la panique en situation de survie?',
    zh: '在生存情况下如何管理压力和恐慌？', ja: 'サバイバル状況でのストレスとパニック管理方法は？', ko: '생존 상황에서 스트레스와 공황을 어떻게 관리하나요?', ar: 'كيف أتعامل مع التوتر والذعر في حالة البقاء؟',
    ru: 'Как справиться со стрессом и паникой в ситуации выживания?', de: 'Wie bewältige ich Stress und Panik in einer Überlebenssituation?', pt: 'Como gerenciar estresse e pânico em sobrevivência?', hi: 'जीवन रक्षा स्थिति में तनाव और घबराहट कैसे प्रबंधित करें?',
  },

  // ── Settings / API key ────────────────────────────────────────────────
  settings_title: {
    en: 'SETTINGS', th: 'ตั้งค่า', es: 'CONFIGURACIÓN', fr: 'PARAMÈTRES',
    zh: '设置', ja: '設定', ko: '설정', ar: 'الإعدادات',
    ru: 'НАСТРОЙКИ', de: 'EINSTELLUNGEN', pt: 'CONFIGURAÇÕES', hi: 'सेटिंग्स',
  },
  online_ai_chatgpt: {
    en: 'Online AI (ChatGPT)', th: 'AI ออนไลน์ (ChatGPT)', es: 'IA En Línea (ChatGPT)', fr: 'IA En Ligne (ChatGPT)',
    zh: '在线AI (ChatGPT)', ja: 'オンラインAI (ChatGPT)', ko: '온라인 AI (ChatGPT)', ar: 'AI عبر الإنترنت (ChatGPT)',
    ru: 'Онлайн AI (ChatGPT)', de: 'Online AI (ChatGPT)', pt: 'IA Online (ChatGPT)', hi: 'ऑनलाइन AI (ChatGPT)',
  },
  api_key_description: {
    en: 'Enter your OpenAI API key to enable ChatGPT-powered responses. Get your key from platform.openai.com.',
    th: 'ใส่ OpenAI API key เพื่อเปิดใช้การตอบกลับจาก ChatGPT รับ key จาก platform.openai.com',
    es: 'Ingresa tu clave API de OpenAI para habilitar respuestas de ChatGPT. Obtén tu clave en platform.openai.com.',
    fr: 'Entrez votre clé API OpenAI pour activer les réponses ChatGPT. Obtenez votre clé sur platform.openai.com.',
    zh: '输入您的OpenAI API密钥以启用ChatGPT响应。从platform.openai.com获取密钥。',
    ja: 'OpenAI APIキーを入力してChatGPT応答を有効にします。platform.openai.comでキーを取得してください。',
    ko: 'OpenAI API 키를 입력하여 ChatGPT 응답을 활성화하세요. platform.openai.com에서 키를 받으세요.',
    ar: 'أدخل مفتاح OpenAI API لتفعيل ردود ChatGPT. احصل على المفتاح من platform.openai.com.',
    ru: 'Введите API-ключ OpenAI для включения ответов ChatGPT. Получите ключ на platform.openai.com.',
    de: 'Geben Sie Ihren OpenAI API-Schlüssel ein, um ChatGPT-Antworten zu aktivieren. Holen Sie sich Ihren Schlüssel auf platform.openai.com.',
    pt: 'Digite sua chave API OpenAI para ativar respostas ChatGPT. Obtenha sua chave em platform.openai.com.',
    hi: 'ChatGPT प्रतिक्रियाओं को सक्षम करने के लिए अपना OpenAI API कुंजी दर्ज करें। platform.openai.com से कुंजी प्राप्त करें।',
  },
  api_key_configured: {
    en: 'API Key Configured', th: 'กำหนด API Key แล้ว', es: 'Clave API Configurada', fr: 'Clé API Configurée',
    zh: 'API密钥已配置', ja: 'APIキー設定済み', ko: 'API 키 설정됨', ar: 'تم تكوين مفتاح API',
    ru: 'API-ключ настроен', de: 'API-Schlüssel konfiguriert', pt: 'Chave API Configurada', hi: 'API कुंजी कॉन्फ़िगर की गई',
  },
  remove_key: {
    en: 'Remove', th: 'ลบ', es: 'Eliminar', fr: 'Supprimer',
    zh: '删除', ja: '削除', ko: '삭제', ar: 'إزالة',
    ru: 'Удалить', de: 'Entfernen', pt: 'Remover', hi: 'हटाएं',
  },
  api_key_security_note: {
    en: 'Your API key is stored locally on this device only. It is never sent to our servers.',
    th: 'API key ของคุณถูกเก็บไว้ในอุปกรณ์นี้เท่านั้น ไม่ถูกส่งไปยังเซิร์ฟเวอร์ของเรา',
    es: 'Tu clave API se almacena localmente solo en este dispositivo. Nunca se envía a nuestros servidores.',
    fr: 'Votre clé API est stockée localement sur cet appareil uniquement. Elle n\'est jamais envoyée à nos serveurs.',
    zh: '您的API密钥仅存储在此设备上。绝不会发送到我们的服务器。',
    ja: 'APIキーはこのデバイスにのみローカルに保存されます。弊社サーバーに送信されることはありません。',
    ko: 'API 키는 이 기기에만 로컬로 저장됩니다. 당사 서버로 전송되지 않습니다.',
    ar: 'يتم تخزين مفتاح API محلياً على هذا الجهاز فقط. لا يتم إرساله أبداً إلى خوادمنا.',
    ru: 'Ваш API-ключ хранится только на этом устройстве. Он никогда не отправляется на наши серверы.',
    de: 'Ihr API-Schlüssel wird nur lokal auf diesem Gerät gespeichert. Er wird nie an unsere Server gesendet.',
    pt: 'Sua chave API é armazenada localmente apenas neste dispositivo. Nunca é enviada aos nossos servidores.',
    hi: 'आपकी API कुंजी केवल इस डिवाइस पर स्थानीय रूप से संग्रहीत है। यह कभी हमारे सर्वरों पर नहीं भेजी जाती।',
  },
  api_key_empty: {
    en: 'Please enter an API key', th: 'กรุณาใส่ API key', es: 'Ingrese una clave API', fr: 'Veuillez entrer une clé API',
    zh: '请输入API密钥', ja: 'APIキーを入力してください', ko: 'API 키를 입력하세요', ar: 'الرجاء إدخال مفتاح API',
    ru: 'Пожалуйста, введите API-ключ', de: 'Bitte geben Sie einen API-Schlüssel ein', pt: 'Digite uma chave API', hi: 'कृपया API कुंजी दर्ज करें',
  },
  api_key_invalid_format: {
    en: 'Invalid API key format. OpenAI keys start with "sk-"', th: 'รูปแบบ API key ไม่ถูกต้อง OpenAI key เริ่มด้วย "sk-"', es: 'Formato de clave API inválido. Las claves OpenAI comienzan con "sk-"', fr: 'Format de clé API invalide. Les clés OpenAI commencent par "sk-"',
    zh: 'API密钥格式无效。OpenAI密钥以"sk-"开头', ja: 'APIキー形式が無効です。OpenAIキーは"sk-"で始まります', ko: '잘못된 API 키 형식. OpenAI 키는 "sk-"로 시작합니다', ar: 'تنسيق مفتاح API غير صالح. مفاتيح OpenAI تبدأ بـ "sk-"',
    ru: 'Неверный формат API-ключа. Ключи OpenAI начинаются с "sk-"', de: 'Ungültiges API-Schlüssel-Format. OpenAI-Schlüssel beginnen mit "sk-"', pt: 'Formato de chave API inválido. Chaves OpenAI começam com "sk-"', hi: 'अमान्य API कुंजी प्रारूप। OpenAI कुंजियाँ "sk-" से शुरू होती हैं',
  },
  api_key_saved: {
    en: 'API key saved! Online mode is now active.', th: 'บันทึก API key แล้ว! โหมดออนไลน์พร้อมใช้งาน', es: '¡Clave API guardada! El modo en línea está activo.', fr: 'Clé API enregistrée! Le mode en ligne est actif.',
    zh: 'API密钥已保存！在线模式已激活。', ja: 'APIキーを保存しました！オンラインモードが有効です。', ko: 'API 키가 저장되었습니다! 온라인 모드가 활성화되었습니다.', ar: 'تم حفظ مفتاح API! الوضع عبر الإنترنت نشط الآن.',
    ru: 'API-ключ сохранен! Онлайн-режим активирован.', de: 'API-Schlüssel gespeichert! Online-Modus ist jetzt aktiv.', pt: 'Chave API salva! Modo online está ativo.', hi: 'API कुंजी सहेजी गई! ऑनलाइन मोड अब सक्रिय है।',
  },
  about_modes: {
    en: 'About Modes', th: 'เกี่ยวกับโหมด', es: 'Acerca de los Modos', fr: 'À propos des Modes',
    zh: '关于模式', ja: 'モードについて', ko: '모드 정보', ar: 'حول الأوضاع',
    ru: 'О режимах', de: 'Über Modi', pt: 'Sobre os Modos', hi: 'मोड के बारे में',
  },

  // ── General UI ─────────────────────────────────────────────────────────
  ok: {
    en: 'OK', th: 'ตกลง', es: 'OK', fr: 'OK',
    zh: '确定', ja: 'OK', ko: '확인', ar: 'موافق',
    ru: 'ОК', de: 'OK', pt: 'OK', hi: 'ठीक है',
  },
  cancel: {
    en: 'Cancel', th: 'ยกเลิก', es: 'Cancelar', fr: 'Annuler',
    zh: '取消', ja: 'キャンセル', ko: '취소', ar: 'إلغاء',
    ru: 'Отмена', de: 'Abbrechen', pt: 'Cancelar', hi: 'रद्द करें',
  },
  save: {
    en: 'Save', th: 'บันทึก', es: 'Guardar', fr: 'Enregistrer',
    zh: '保存', ja: '保存', ko: '저장', ar: 'حفظ',
    ru: 'Сохранить', de: 'Speichern', pt: 'Salvar', hi: 'सहेजें',
  },
  error: {
    en: 'Error', th: 'ข้อผิดพลาด', es: 'Error', fr: 'Erreur',
    zh: '错误', ja: 'エラー', ko: '오류', ar: 'خطأ',
    ru: 'Ошибка', de: 'Fehler', pt: 'Erro', hi: 'त्रुटि',
  },
  success: {
    en: 'Success', th: 'สำเร็จ', es: 'Éxito', fr: 'Succès',
    zh: '成功', ja: '成功', ko: '성공', ar: 'نجاح',
    ru: 'Успех', de: 'Erfolg', pt: 'Sucesso', hi: 'सफलता',
  },
  coming_soon: {
    en: 'Coming Soon', th: 'เร็วๆ นี้', es: 'Próximamente', fr: 'Bientôt',
    zh: '即将推出', ja: '近日公開', ko: '곧 출시', ar: 'قريباً',
    ru: 'Скоро', de: 'Kommt bald', pt: 'Em breve', hi: 'जल्द आ रहा है',
  },
  soon: {
    en: 'SOON', th: 'เร็วๆนี้', es: 'PRONTO', fr: 'BIENTÔT',
    zh: '即将', ja: '近日', ko: '곧', ar: 'قريباً',
    ru: 'СКОРО', de: 'BALD', pt: 'BREVE', hi: 'जल्द',
  },
  setup: {
    en: 'SETUP', th: 'ตั้งค่า', es: 'CONFIG', fr: 'CONFIG',
    zh: '设置', ja: '設定', ko: '설정', ar: 'إعداد',
    ru: 'НАСТР.', de: 'SETUP', pt: 'CONFIG', hi: 'सेटअप',
  },
  listening: {
    en: 'Listening...', th: 'กำลังฟัง...', es: 'Escuchando...', fr: 'Écoute en cours...',
    zh: '正在听...', ja: '聞いています...', ko: '듣는 중...', ar: 'جاري الاستماع...',
    ru: 'Слушаю...', de: 'Höre zu...', pt: 'Ouvindo...', hi: 'सुन रहा हूं...',
  },
  voice_input: {
    en: 'Voice Input', th: 'ป้อนเสียง', es: 'Entrada de Voz', fr: 'Entrée Vocale',
    zh: '语音输入', ja: '音声入力', ko: '음성 입력', ar: 'إدخال صوتي',
    ru: 'Голосовой ввод', de: 'Spracheingabe', pt: 'Entrada de Voz', hi: 'ध्वनि इनपुट',
  },
  voice_coming_soon: {
    en: 'Speech recognition requires @react-native-voice/voice. This feature is coming soon.',
    th: 'การรู้จำเสียงต้องใช้ @react-native-voice/voice ฟีเจอร์นี้จะมาเร็วๆ นี้',
    es: 'El reconocimiento de voz requiere @react-native-voice/voice. Esta función llegará pronto.',
    fr: 'La reconnaissance vocale nécessite @react-native-voice/voice. Cette fonctionnalité arrive bientôt.',
    zh: '语音识别需要@react-native-voice/voice。此功能即将推出。',
    ja: '音声認識には@react-native-voice/voiceが必要です。この機能は近日公開予定です。',
    ko: '음성 인식에는 @react-native-voice/voice가 필요합니다. 이 기능은 곧 출시됩니다.',
    ar: 'يتطلب التعرف على الصوت @react-native-voice/voice. هذه الميزة قادمة قريباً.',
    ru: 'Распознавание речи требует @react-native-voice/voice. Эта функция скоро появится.',
    de: 'Spracherkennung erfordert @react-native-voice/voice. Kommt bald.',
    pt: 'Reconhecimento de voz requer @react-native-voice/voice. Em breve.',
    hi: 'स्पीच रिकग्निशन के लिए @react-native-voice/voice आवश्यक है। यह सुविधा जल्द आ रही है।',
  },
  offline_llm_desc: {
    en: 'Offline LLM mode will allow on-device AI inference without internet. Download a model in Settings to enable.',
    th: 'โหมด LLM ออฟไลน์จะอนุญาตให้ใช้ AI บนอุปกรณ์โดยไม่ต้องใช้อินเทอร์เน็ต ดาวน์โหลดโมเดลในตั้งค่า',
    es: 'El modo LLM sin conexión permite inferencia AI sin internet. Descarga un modelo en Configuración.',
    fr: "Le mode LLM hors ligne permettra l'IA sur l'appareil sans internet. Téléchargez un modèle dans Paramètres.",
    zh: '离线LLM模式允许无需互联网的设备AI推理。在设置中下载模型以启用。',
    ja: 'オフラインLLMモードはインターネットなしでオンデバイスAI推論を可能にします。設定でモデルをダウンロードしてください。',
    ko: '오프라인 LLM 모드는 인터넷 없이 온디바이스 AI 추론을 가능하게 합니다. 설정에서 모델을 다운로드하세요.',
    ar: 'سيسمح وضع LLM بدون اتصال بالاستدلال AI على الجهاز. قم بتحميل النموذج في الإعدادات.',
    ru: 'Режим офлайн LLM позволит использовать AI на устройстве без интернета. Загрузите модель в Настройках.',
    de: 'Offline LLM ermöglicht KI-Inferenz ohne Internet. Laden Sie ein Modell in den Einstellungen herunter.',
    pt: 'Modo LLM offline permite IA no dispositivo sem internet. Baixe um modelo nas Configurações.',
    hi: 'ऑफलाइन LLM मोड इंटरनेट के बिना डिवाइस पर AI अनुमान की अनुमति देगा। सक्षम करने के लिए सेटिंग्स में मॉडल डाउनलोड करें।',
  },
  doc_library: {
    en: 'Document Library', th: 'คลังเอกสาร', es: 'Biblioteca de Documentos', fr: 'Bibliothèque de Documents',
    zh: '文档库', ja: 'ドキュメントライブラリ', ko: '문서 라이브러리', ar: 'مكتبة الوثائق',
    ru: 'Библиотека документов', de: 'Dokumentenbibliothek', pt: 'Biblioteca de Documentos', hi: 'दस्तावेज़ पुस्तकालय',
  },
  doc_library_desc: {
    en: 'Download government survival manuals to enhance AI knowledge. Coming soon:\n\n\u2022 FEMA guides\n\u2022 Red Cross manuals\n\u2022 WHO emergency health guides\n\u2022 Military survival manuals (FM 21-76)\n\u2022 Nuclear preparedness guides',
    th: 'ดาวน์โหลดคู่มือเอาชีวิตรอดจากรัฐบาลเพื่อเพิ่มความรู้ AI เร็วๆ นี้:\n\n\u2022 คู่มือ FEMA\n\u2022 คู่มือกาชาด\n\u2022 คู่มือสุขภาพฉุกเฉิน WHO\n\u2022 คู่มือเอาชีวิตรอดทหาร (FM 21-76)\n\u2022 คู่มือเตรียมพร้อมนิวเคลียร์',
    es: 'Descarga manuales de supervivencia gubernamentales. Próximamente:\n\n\u2022 Guías FEMA\n\u2022 Manuales Cruz Roja\n\u2022 Guías OMS\n\u2022 Manuales militares (FM 21-76)\n\u2022 Guías nucleares',
    fr: 'Téléchargez des manuels de survie gouvernementaux. Bientôt:\n\n\u2022 Guides FEMA\n\u2022 Manuels Croix-Rouge\n\u2022 Guides OMS\n\u2022 Manuels militaires (FM 21-76)\n\u2022 Guides nucléaires',
    zh: '下载政府生存手册以增强AI知识。即将推出:\n\n\u2022 FEMA指南\n\u2022 红十字手册\n\u2022 WHO紧急健康指南\n\u2022 军事生存手册(FM 21-76)\n\u2022 核准备指南',
    ja: '政府のサバイバルマニュアルをダウンロードしてAIの知識を強化。近日公開:\n\n\u2022 FEMAガイド\n\u2022 赤十字マニュアル\n\u2022 WHO緊急ガイド\n\u2022 軍事サバイバルマニュアル(FM 21-76)\n\u2022 核準備ガイド',
    ko: '정부 생존 매뉴얼을 다운로드하여 AI 지식을 강화하세요. 곧 출시:\n\n\u2022 FEMA 가이드\n\u2022 적십자 매뉴얼\n\u2022 WHO 건강 가이드\n\u2022 군사 생존 매뉴얼(FM 21-76)\n\u2022 핵 대비 가이드',
    ar: 'حمّل أدلة البقاء الحكومية. قريباً:\n\n\u2022 أدلة FEMA\n\u2022 أدلة الصليب الأحمر\n\u2022 أدلة WHO\n\u2022 أدلة البقاء العسكرية\n\u2022 أدلة الاستعداد النووي',
    ru: 'Загрузите правительственные руководства по выживанию. Скоро:\n\n\u2022 Руководства FEMA\n\u2022 Руководства Красного Креста\n\u2022 Руководства ВОЗ\n\u2022 Военные руководства (FM 21-76)\n\u2022 Руководства по ядерной безопасности',
    de: 'Laden Sie Überlebenshandbücher herunter. Kommt bald:\n\n\u2022 FEMA-Leitfäden\n\u2022 Rotes Kreuz\n\u2022 WHO-Leitfäden\n\u2022 Militärhandbücher (FM 21-76)\n\u2022 Nukleare Vorsorge',
    pt: 'Baixe manuais de sobrevivência governamentais. Em breve:\n\n\u2022 Guias FEMA\n\u2022 Manuais Cruz Vermelha\n\u2022 Guias OMS\n\u2022 Manuais militares (FM 21-76)\n\u2022 Guias nucleares',
    hi: 'AI ज्ञान बढ़ाने के लिए सरकारी उत्तरजीविता मैनुअल डाउनलोड करें। जल्द:\n\n\u2022 FEMA गाइड\n\u2022 रेड क्रॉस मैनुअल\n\u2022 WHO आपातकालीन गाइड\n\u2022 सैन्य उत्तरजीविता मैनुअल (FM 21-76)\n\u2022 परमाणु तैयारी गाइड',
  },

  // ── Calculator screen ──────────────────────────────────────────────────
  calc_title: {
    en: 'SURVIVAL CALCULATOR', th: 'คำนวณเอาชีวิตรอด', es: 'CALCULADORA DE SUPERVIVENCIA', fr: 'CALCULATEUR DE SURVIE',
    zh: '生存计算器', ja: 'サバイバル計算機', ko: '생존 계산기', ar: 'حاسبة البقاء',
    ru: 'КАЛЬКУЛЯТОР ВЫЖИВАНИЯ', de: 'ÜBERLEBENSRECHNER', pt: 'CALCULADORA DE SOBREVIVÊNCIA', hi: 'जीवन रक्षा कैलकुलेटर',
  },
  people: {
    en: 'People', th: 'จำนวนคน', es: 'Personas', fr: 'Personnes',
    zh: '人数', ja: '人数', ko: '인원', ar: 'أشخاص',
    ru: 'Людей', de: 'Personen', pt: 'Pessoas', hi: 'लोग',
  },
  days: {
    en: 'Days', th: 'จำนวนวัน', es: 'Días', fr: 'Jours',
    zh: '天数', ja: '日数', ko: '일수', ar: 'أيام',
    ru: 'Дней', de: 'Tage', pt: 'Dias', hi: 'दिन',
  },

  // ── Morse screen ───────────────────────────────────────────────────────
  morse_title: {
    en: 'MORSE CODE', th: 'รหัสมอร์ส', es: 'CÓDIGO MORSE', fr: 'CODE MORSE',
    zh: '摩尔斯电码', ja: 'モールス信号', ko: '모스 부호', ar: 'شفرة مورس',
    ru: 'КОД МОРЗЕ', de: 'MORSECODE', pt: 'CÓDIGO MORSE', hi: 'मोर्स कोड',
  },
  send: {
    en: 'SEND', th: 'ส่ง', es: 'ENVIAR', fr: 'ENVOYER',
    zh: '发送', ja: '送信', ko: '전송', ar: 'إرسال',
    ru: 'ОТПРАВИТЬ', de: 'SENDEN', pt: 'ENVIAR', hi: 'भेजें',
  },
  read: {
    en: 'READ', th: 'อ่าน', es: 'LEER', fr: 'LIRE',
    zh: '读取', ja: '読取', ko: '읽기', ar: 'قراءة',
    ru: 'ЧИТАТЬ', de: 'LESEN', pt: 'LER', hi: 'पढ़ें',
  },

  // ── Seeking screen ─────────────────────────────────────────────────────
  seeking_title: {
    en: 'SEEKING MODE', th: 'โหมดค้นหา', es: 'MODO BÚSQUEDA', fr: 'MODE RECHERCHE',
    zh: '求救模式', ja: '救助モード', ko: '구조 모드', ar: 'وضع الاستغاثة',
    ru: 'РЕЖИМ ПОИСКА', de: 'SUCHMODUS', pt: 'MODO BUSCA', hi: 'खोज मोड',
  },
  activate_beacon: {
    en: 'ACTIVATE BEACON', th: 'เปิดสัญญาณ', es: 'ACTIVAR BALIZA', fr: 'ACTIVER BALISE',
    zh: '启动信标', ja: 'ビーコン起動', ko: '비콘 활성화', ar: 'تفعيل المنارة',
    ru: 'ВКЛЮЧИТЬ МАЯК', de: 'LEUCHTFEUER AKTIVIEREN', pt: 'ATIVAR FAROL', hi: 'बीकन सक्रिय करें',
  },
  deactivate_beacon: {
    en: 'DEACTIVATE', th: 'ปิด', es: 'DESACTIVAR', fr: 'DÉSACTIVER',
    zh: '停用', ja: '停止', ko: '비활성화', ar: 'إيقاف',
    ru: 'ОТКЛЮЧИТЬ', de: 'DEAKTIVIEREN', pt: 'DESATIVAR', hi: 'निष्क्रिय करें',
  },

  // ── Profile screen ─────────────────────────────────────────────────────
  profile_title: {
    en: 'PERSONAL PROFILE', th: 'โปรไฟล์ส่วนตัว', es: 'PERFIL PERSONAL', fr: 'PROFIL PERSONNEL',
    zh: '个人档案', ja: '個人プロフィール', ko: '개인 프로필', ar: 'الملف الشخصي',
    ru: 'ЛИЧНЫЙ ПРОФИЛЬ', de: 'PERSÖNLICHES PROFIL', pt: 'PERFIL PESSOAL', hi: 'व्यक्तिगत प्रोफ़ाइल',
  },
  name: {
    en: 'Name', th: 'ชื่อ', es: 'Nombre', fr: 'Nom',
    zh: '姓名', ja: '名前', ko: '이름', ar: 'الاسم',
    ru: 'Имя', de: 'Name', pt: 'Nome', hi: 'नाम',
  },
  blood_type: {
    en: 'Blood Type', th: 'กรุ๊ปเลือด', es: 'Tipo de Sangre', fr: 'Groupe Sanguin',
    zh: '血型', ja: '血液型', ko: '혈액형', ar: 'فصيلة الدم',
    ru: 'Группа крови', de: 'Blutgruppe', pt: 'Tipo Sanguíneo', hi: 'रक्त प्रकार',
  },
  allergies: {
    en: 'Allergies', th: 'อาการแพ้', es: 'Alergias', fr: 'Allergies',
    zh: '过敏', ja: 'アレルギー', ko: '알레르기', ar: 'حساسية',
    ru: 'Аллергии', de: 'Allergien', pt: 'Alergias', hi: 'एलर्जी',
  },
  medications: {
    en: 'Medications', th: 'ยา', es: 'Medicamentos', fr: 'Médicaments',
    zh: '药物', ja: '薬', ko: '약물', ar: 'أدوية',
    ru: 'Лекарства', de: 'Medikamente', pt: 'Medicamentos', hi: 'दवाइयां',
  },
  conditions: {
    en: 'Medical Conditions', th: 'โรคประจำตัว', es: 'Condiciones Médicas', fr: 'Conditions Médicales',
    zh: '病史', ja: '持病', ko: '의료 상태', ar: 'حالات طبية',
    ru: 'Заболевания', de: 'Erkrankungen', pt: 'Condições Médicas', hi: 'चिकित्सा स्थितियां',
  },
  emergency_contact: {
    en: 'Emergency Contact', th: 'ผู้ติดต่อฉุกเฉิน', es: 'Contacto de Emergencia', fr: "Contact d'Urgence",
    zh: '紧急联系人', ja: '緊急連絡先', ko: '비상 연락처', ar: 'جهة اتصال الطوارئ',
    ru: 'Экстренный контакт', de: 'Notfallkontakt', pt: 'Contato de Emergência', hi: 'आपातकालीन संपर्क',
  },

  // ── Model Download ──────────────────────────────────────────────────────
  offline_ai_model: {
    en: 'Offline AI Model', th: 'โมเดล AI ออฟไลน์', es: 'Modelo AI Sin Conexión', fr: 'Modèle IA Hors Ligne',
    zh: '离线AI模型', ja: 'オフラインAIモデル', ko: '오프라인 AI 모델', ar: 'نموذج AI غير متصل',
    ru: 'Офлайн AI-модель', de: 'Offline AI-Modell', pt: 'Modelo AI Offline', hi: 'ऑफलाइन AI मॉडल',
  },
  model_download_desc: {
    en: 'Download an AI model for on-device inference. Works without internet.',
    th: 'ดาวน์โหลดโมเดล AI สำหรับการประมวลผลบนอุปกรณ์ ใช้งานได้โดยไม่ต้องเชื่อมต่ออินเทอร์เน็ต',
    es: 'Descarga un modelo AI para inferencia en el dispositivo. Funciona sin internet.',
    fr: "Téléchargez un modèle IA pour l'inférence sur l'appareil. Fonctionne sans internet.",
    zh: '下载AI模型用于设备端推理。无需互联网。',
    ja: 'オンデバイス推論用のAIモデルをダウンロード。インターネット不要。',
    ko: '온디바이스 추론을 위한 AI 모델 다운로드. 인터넷 불필요.',
    ar: 'حمّل نموذج AI للاستدلال على الجهاز. يعمل بدون إنترنت.',
    ru: 'Загрузите AI-модель для локального вывода. Работает без интернета.',
    de: 'Laden Sie ein AI-Modell für On-Device-Inferenz herunter. Funktioniert ohne Internet.',
    pt: 'Baixe um modelo AI para inferência no dispositivo. Funciona sem internet.',
    hi: 'ऑन-डिवाइस इनफरेंस के लिए AI मॉडल डाउनलोड करें। इंटरनेट के बिना काम करता है।',
  },
  model_ready: {
    en: 'Model Ready', th: 'โมเดลพร้อม', es: 'Modelo Listo', fr: 'Modèle Prêt',
    zh: '模型就绪', ja: 'モデル準備完了', ko: '모델 준비 완료', ar: 'النموذج جاهز',
    ru: 'Модель готова', de: 'Modell bereit', pt: 'Modelo Pronto', hi: 'मॉडल तैयार',
  },
  model_loading: {
    en: 'Loading model...', th: 'กำลังโหลดโมเดล...', es: 'Cargando modelo...', fr: 'Chargement du modèle...',
    zh: '正在加载模型...', ja: 'モデルを読み込み中...', ko: '모델 로딩 중...', ar: 'جاري تحميل النموذج...',
    ru: 'Загрузка модели...', de: 'Modell wird geladen...', pt: 'Carregando modelo...', hi: 'मॉडल लोड हो रहा है...',
  },
  download: {
    en: 'Download', th: 'ดาวน์โหลด', es: 'Descargar', fr: 'Télécharger',
    zh: '下载', ja: 'ダウンロード', ko: '다운로드', ar: 'تحميل',
    ru: 'Скачать', de: 'Herunterladen', pt: 'Baixar', hi: 'डाउनलोड',
  },
  downloading: {
    en: 'Downloading...', th: 'กำลังดาวน์โหลด...', es: 'Descargando...', fr: 'Téléchargement...',
    zh: '正在下载...', ja: 'ダウンロード中...', ko: '다운로드 중...', ar: 'جاري التحميل...',
    ru: 'Загрузка...', de: 'Herunterladen...', pt: 'Baixando...', hi: 'डाउनलोड हो रहा है...',
  },
  delete_model: {
    en: 'Delete Model', th: 'ลบโมเดล', es: 'Eliminar Modelo', fr: 'Supprimer le Modèle',
    zh: '删除模型', ja: 'モデルを削除', ko: '모델 삭제', ar: 'حذف النموذج',
    ru: 'Удалить модель', de: 'Modell löschen', pt: 'Excluir Modelo', hi: 'मॉडल हटाएं',
  },
  recommended: {
    en: 'RECOMMENDED', th: 'แนะนำ', es: 'RECOMENDADO', fr: 'RECOMMANDÉ',
    zh: '推荐', ja: 'おすすめ', ko: '추천', ar: 'موصى به',
    ru: 'РЕКОМЕНДОВАНО', de: 'EMPFOHLEN', pt: 'RECOMENDADO', hi: 'अनुशंसित',
  },
  ram: {
    en: 'RAM', th: 'แรม', es: 'RAM', fr: 'RAM',
    zh: '内存', ja: 'RAM', ko: 'RAM', ar: 'ذاكرة',
    ru: 'ОЗУ', de: 'RAM', pt: 'RAM', hi: 'रैम',
  },
  downloaded: {
    en: 'Downloaded', th: 'ดาวน์โหลดแล้ว', es: 'Descargado', fr: 'Téléchargé',
    zh: '已下载', ja: 'ダウンロード済み', ko: '다운로드됨', ar: 'تم التحميل',
    ru: 'Загружено', de: 'Heruntergeladen', pt: 'Baixado', hi: 'डाउनलोड किया गया',
  },
  select_model: {
    en: 'Select AI Model', th: 'เลือกโมเดล AI', es: 'Seleccionar Modelo AI', fr: 'Sélectionner Modèle IA',
    zh: '选择AI模型', ja: 'AIモデルを選択', ko: 'AI 모델 선택', ar: 'اختر نموذج AI',
    ru: 'Выберите AI-модель', de: 'AI-Modell auswählen', pt: 'Selecionar Modelo AI', hi: 'AI मॉडल चुनें',
  },
};

// ─── Current locale state ────────────────────────────────────────────────────

let currentLocale: SupportedLocale = 'en';
let listeners: Array<() => void> = [];

export function getLocale(): SupportedLocale {
  return currentLocale;
}

export function setLocale(locale: SupportedLocale): void {
  currentLocale = locale;
  // Notify all listeners
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

/**
 * Translate a key to the current locale.
 * Falls back to English if translation is missing.
 */
export function t(key: string): string {
  const entry = translations[key];
  if (!entry) return key;
  return entry[currentLocale] || entry.en || key;
}

/**
 * React hook that triggers re-render when locale changes.
 */
export function useLocale(): SupportedLocale {
  const [locale, setLocaleState] = useState<SupportedLocale>(currentLocale);

  useEffect(() => {
    const unsubscribe = subscribe(() => {
      setLocaleState(currentLocale);
    });
    return unsubscribe;
  }, []);

  return locale;
}
