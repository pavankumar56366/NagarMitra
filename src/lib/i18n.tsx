import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "te", label: "తెలుగు" },
  { code: "kn", label: "ಕನ್ನಡ" },
  { code: "ta", label: "தமிழ்" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

const STORAGE_KEY = "nagarmitra.lang";

type Dict = Record<string, string>;

const en: Dict = {
  "app.name": "NagarMitra",
  "app.tagline": "Your city partner for clean streets",
  "auth.worker.tagline": "Field crew sign-in",
  "auth.persona.title": "How are you using NagarMitra?",
  "auth.persona.help": "Pick one to continue. You can switch later by signing out.",
  "auth.persona.citizen": "I am a resident",
  "auth.persona.citizen.help": "Report waste and track it until it is cleared",
  "auth.persona.worker": "I am a field worker",
  "auth.session.signedInAs": "You are already signed in as",
  "auth.session.continue": "Continue",
  "auth.session.switch": "Use another account",
  "language.label": "Language",

  "nav.home": "Home",
  "nav.segregate": "Segregate",
  "nav.report": "Report",
  "nav.reports": "Reports",
  "nav.profile": "Profile",

  "home.greeting.morning": "Good morning",
  "home.greeting.afternoon": "Good afternoon",
  "home.greeting.evening": "Good evening",
  "home.resident": "Resident",
  "home.report.title": "Report Waste",
  "home.report.help": "Capture a photo and send it to the ward",
  "home.segregate.title": "Segregate Household Waste",
  "home.segregate.help": "Find the right bin for what is in your hand",
  "home.active": "Active reports",
  "home.resolved": "Resolved",
  "home.recent": "Recent reports",
  "home.seeAll": "See all",
  "home.empty": "You have not reported anything yet. Your reports will show up here.",

  "profile.title": "Profile",
  "profile.changePhoto": "Tap the photo to change it",
  "profile.reports": "Reports",
  "profile.signOut": "Sign out",
};

const hi: Dict = {
  "app.tagline": "स्वच्छ सड़कों के लिए आपका शहर साथी",
  "auth.worker.tagline": "फील्ड टीम साइन-इन",
  "auth.persona.title": "आप NagarMitra का उपयोग कैसे कर रहे हैं?",
  "auth.persona.help": "जारी रखने के लिए एक चुनें। साइन आउट करके बाद में बदल सकते हैं।",
  "auth.persona.citizen": "मैं एक निवासी हूँ",
  "auth.persona.citizen.help": "कचरे की शिकायत करें और सफाई होने तक ट्रैक करें",
  "auth.persona.worker": "मैं एक फील्ड कर्मचारी हूँ",
  "auth.session.signedInAs": "आप पहले से साइन इन हैं",
  "auth.session.continue": "जारी रखें",
  "auth.session.switch": "दूसरा खाता उपयोग करें",
  "language.label": "भाषा",
  "nav.home": "होम",
  "nav.segregate": "पृथक्करण",
  "nav.report": "शिकायत",
  "nav.reports": "शिकायतें",
  "nav.profile": "प्रोफ़ाइल",
  "home.greeting.morning": "सुप्रभात",
  "home.greeting.afternoon": "नमस्कार",
  "home.greeting.evening": "शुभ संध्या",
  "home.resident": "निवासी",
  "home.report.title": "कचरे की शिकायत करें",
  "home.report.help": "फोटो खींचें और वार्ड को भेजें",
  "home.segregate.title": "घरेलू कचरा पृथक्करण",
  "home.segregate.help": "जानें कौन सा कचरा किस डिब्बे में जाए",
  "home.active": "सक्रिय शिकायतें",
  "home.resolved": "हल हो गईं",
  "home.recent": "हाल की शिकायतें",
  "home.seeAll": "सभी देखें",
  "home.empty": "आपने अभी कोई शिकायत नहीं की है। आपकी शिकायतें यहाँ दिखेंगी।",
  "profile.title": "प्रोफ़ाइल",
  "profile.changePhoto": "फोटो बदलने के लिए उस पर टैप करें",
  "profile.reports": "शिकायतें",
  "profile.signOut": "साइन आउट",
};

const te: Dict = {
  "app.tagline": "శుభ్రమైన వీధుల కోసం మీ నగర భాగస్వామి",
  "auth.worker.tagline": "ఫీల్డ్ సిబ్బంది సైన్-ఇన్",
  "auth.persona.title": "మీరు NagarMitra ను ఎలా ఉపయోగిస్తున్నారు?",
  "auth.persona.help": "కొనసాగించడానికి ఒకటి ఎంచుకోండి. సైన్ అవుట్ చేసి తర్వాత మార్చవచ్చు.",
  "auth.persona.citizen": "నేను నివాసిని",
  "auth.persona.citizen.help": "చెత్తను నివేదించి, తొలగించే వరకు ట్రాక్ చేయండి",
  "auth.persona.worker": "నేను ఫీల్డ్ కార్మికుడిని",
  "auth.session.signedInAs": "మీరు ఇప్పటికే సైన్ ఇన్ అయ్యారు",
  "auth.session.continue": "కొనసాగించు",
  "auth.session.switch": "మరో ఖాతా వాడండి",
  "language.label": "భాష",
  "nav.home": "హోమ్",
  "nav.segregate": "వేరుచేయడం",
  "nav.report": "నివేదించు",
  "nav.reports": "నివేదికలు",
  "nav.profile": "ప్రొఫైల్",
  "home.greeting.morning": "శుభోదయం",
  "home.greeting.afternoon": "నమస్కారం",
  "home.greeting.evening": "శుభ సాయంత్రం",
  "home.resident": "నివాసి",
  "home.report.title": "చెత్తను నివేదించండి",
  "home.report.help": "ఫోటో తీసి వార్డుకు పంపండి",
  "home.segregate.title": "గృహ చెత్త వేరుచేయడం",
  "home.segregate.help": "మీ చేతిలో ఉన్నది ఏ బిన్‌లో వేయాలో తెలుసుకోండి",
  "home.active": "సక్రియ నివేదికలు",
  "home.resolved": "పరిష్కరించబడ్డాయి",
  "home.recent": "ఇటీవలి నివేదికలు",
  "home.seeAll": "అన్నీ చూడండి",
  "home.empty": "మీరు ఇంకా ఏమీ నివేదించలేదు. మీ నివేదికలు ఇక్కడ కనిపిస్తాయి.",
  "profile.title": "ప్రొఫైల్",
  "profile.changePhoto": "ఫోటో మార్చడానికి దానిపై నొక్కండి",
  "profile.reports": "నివేదికలు",
  "profile.signOut": "సైన్ అవుట్",
};

const kn: Dict = {
  "app.tagline": "ಸ್ವಚ್ಛ ಬೀದಿಗಳಿಗಾಗಿ ನಿಮ್ಮ ನಗರ ಸಂಗಾತಿ",
  "auth.worker.tagline": "ಕ್ಷೇತ್ರ ಸಿಬ್ಬಂದಿ ಸೈನ್-ಇನ್",
  "auth.persona.title": "ನೀವು NagarMitra ಅನ್ನು ಹೇಗೆ ಬಳಸುತ್ತಿದ್ದೀರಿ?",
  "auth.persona.help": "ಮುಂದುವರಿಯಲು ಒಂದನ್ನು ಆಯ್ಕೆ ಮಾಡಿ. ಸೈನ್ ಔಟ್ ಮಾಡಿ ನಂತರ ಬದಲಾಯಿಸಬಹುದು.",
  "auth.persona.citizen": "ನಾನು ನಿವಾಸಿ",
  "auth.persona.citizen.help": "ಕಸವನ್ನು ವರದಿ ಮಾಡಿ ಮತ್ತು ತೆರವಾಗುವವರೆಗೆ ಟ್ರ್ಯಾಕ್ ಮಾಡಿ",
  "auth.persona.worker": "ನಾನು ಕ್ಷೇತ್ರ ಕಾರ್ಮಿಕ",
  "auth.session.signedInAs": "ನೀವು ಈಗಾಗಲೇ ಸೈನ್ ಇನ್ ಆಗಿದ್ದೀರಿ",
  "auth.session.continue": "ಮುಂದುವರಿಸಿ",
  "auth.session.switch": "ಬೇರೆ ಖಾತೆ ಬಳಸಿ",
  "language.label": "ಭಾಷೆ",
  "nav.home": "ಮುಖಪುಟ",
  "nav.segregate": "ಬೇರ್ಪಡಿಸಿ",
  "nav.report": "ವರದಿ",
  "nav.reports": "ವರದಿಗಳು",
  "nav.profile": "ಪ್ರೊಫೈಲ್",
  "home.greeting.morning": "ಶುಭೋದಯ",
  "home.greeting.afternoon": "ನಮಸ್ಕಾರ",
  "home.greeting.evening": "ಶುಭ ಸಂಜೆ",
  "home.resident": "ನಿವಾಸಿ",
  "home.report.title": "ಕಸ ವರದಿ ಮಾಡಿ",
  "home.report.help": "ಫೋಟೋ ತೆಗೆದು ವಾರ್ಡ್‌ಗೆ ಕಳುಹಿಸಿ",
  "home.segregate.title": "ಮನೆಯ ಕಸ ಬೇರ್ಪಡಿಸುವಿಕೆ",
  "home.segregate.help": "ನಿಮ್ಮ ಕೈಯಲ್ಲಿರುವುದು ಯಾವ ಬಿನ್‌ಗೆ ಸೇರುತ್ತದೆ ಎಂದು ತಿಳಿಯಿರಿ",
  "home.active": "ಸಕ್ರಿಯ ವರದಿಗಳು",
  "home.resolved": "ಪರಿಹಾರವಾಗಿದೆ",
  "home.recent": "ಇತ್ತೀಚಿನ ವರದಿಗಳು",
  "home.seeAll": "ಎಲ್ಲವನ್ನೂ ನೋಡಿ",
  "home.empty": "ನೀವು ಇನ್ನೂ ಏನನ್ನೂ ವರದಿ ಮಾಡಿಲ್ಲ. ನಿಮ್ಮ ವರದಿಗಳು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.",
  "profile.title": "ಪ್ರೊಫೈಲ್",
  "profile.changePhoto": "ಫೋಟೋ ಬದಲಾಯಿಸಲು ಅದನ್ನು ಒತ್ತಿ",
  "profile.reports": "ವರದಿಗಳು",
  "profile.signOut": "ಸೈನ್ ಔಟ್",
};

const ta: Dict = {
  "app.tagline": "சுத்தமான தெருக்களுக்கு உங்கள் நகர நண்பன்",
  "auth.worker.tagline": "கள பணியாளர் உள்நுழைவு",
  "auth.persona.title": "நீங்கள் NagarMitra-வை எப்படி பயன்படுத்துகிறீர்கள்?",
  "auth.persona.help": "தொடர ஒன்றைத் தேர்வுசெய்யுங்கள். வெளியேறி பின்னர் மாற்றலாம்.",
  "auth.persona.citizen": "நான் ஒரு குடியிருப்பாளர்",
  "auth.persona.citizen.help": "கழிவுகளைப் பற்றி புகாரளித்து சுத்தமாகும் வரை கண்காணிக்கவும்",
  "auth.persona.worker": "நான் ஒரு கள பணியாளர்",
  "auth.session.signedInAs": "நீங்கள் ஏற்கனவே உள்நுழைந்துள்ளீர்கள்",
  "auth.session.continue": "தொடரவும்",
  "auth.session.switch": "வேறு கணக்கைப் பயன்படுத்து",
  "language.label": "மொழி",
  "nav.home": "முகப்பு",
  "nav.segregate": "பிரிக்க",
  "nav.report": "புகார்",
  "nav.reports": "புகார்கள்",
  "nav.profile": "சுயவிவரம்",
  "home.greeting.morning": "காலை வணக்கம்",
  "home.greeting.afternoon": "வணக்கம்",
  "home.greeting.evening": "மாலை வணக்கம்",
  "home.resident": "குடியிருப்பாளர்",
  "home.report.title": "கழிவு புகார்",
  "home.report.help": "புகைப்படம் எடுத்து வார்டுக்கு அனுப்புங்கள்",
  "home.segregate.title": "வீட்டுக் கழிவு பிரிப்பு",
  "home.segregate.help": "உங்கள் கையில் இருப்பது எந்தத் தொட்டிக்கு என்று அறியுங்கள்",
  "home.active": "செயலில் உள்ள புகார்கள்",
  "home.resolved": "தீர்க்கப்பட்டது",
  "home.recent": "சமீபத்திய புகார்கள்",
  "home.seeAll": "அனைத்தையும் பார்",
  "home.empty": "நீங்கள் இன்னும் எதையும் புகாரளிக்கவில்லை. உங்கள் புகார்கள் இhere காட்டப்படும்.",
  "profile.title": "சுயவிவரம்",
  "profile.changePhoto": "படத்தை மாற்ற அதைத் தட்டுங்கள்",
  "profile.reports": "புகார்கள்",
  "profile.signOut": "வெளியேறு",
};

const DICTS: Record<LanguageCode, Dict> = { en, hi, te, kn, ta };

type I18nValue = {
  lang: LanguageCode;
  setLang: (l: LanguageCode) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

function isLang(v: string | null): v is LanguageCode {
  return !!v && LANGUAGES.some((l) => l.code === v);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) setLangState(stored);
  }, []);

  const setLang = useCallback((l: LanguageCode) => {
    setLangState(l);
    window.localStorage.setItem(STORAGE_KEY, l);
    document.documentElement.lang = l;
  }, []);

  const t = useCallback(
    (key: string) => DICTS[lang]?.[key] ?? en[key] ?? key,
    [lang],
  );

  const value = useMemo<I18nValue>(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  return { lang: "en", setLang: () => {}, t: (key: string) => en[key] ?? key };
}
