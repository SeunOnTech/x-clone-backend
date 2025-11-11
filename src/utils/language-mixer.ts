/**
 * Multilingual Content Generation in English, Pidgin, Yoruba, Hausa
 * [AI/ML: Jinadu implements translation and code-switching logic]
 */

import { Language, EmotionalTone } from '../types';

/**
 * Banking crisis vocabulary in multiple Nigerian languages
 */
export const CRISIS_VOCABULARY = {
  // Account freeze phrases
  accountFreeze: {
    english: [
      'My account is frozen',
      'Cannot access my funds',
      'Account blocked without notice',
      'Money locked in my account',
      'Unable to withdraw',
    ],
    pidgin: [
      'Dem don freeze my account o',
      'I no fit touch my money',
      'Bank lock my account just like that',
      'My money dey inside but I no fit comot am',
      'Wetin I go do now? Account don freeze',
    ],
    yoruba: [
      'Wọn ti pa account mi',
      'Emi ko le wo owo mi',
      'Bank ti duro account mi',
      'Owo mi wa ninu sugbon ko si anfani',
      'Mo fe gba owo mi ṣugbọn ko ṣiṣẹ',
    ],
    hausa: [
      'Sun toshe account dina',
      'Ba zan iya samun kuɗina ba',
      'Banki ya toshe account ba tare da sanarwa ba',
      'Kuɗina na ciki amma ba zan iya cire shi ba',
      'Me zan yi yanzu? Account ya toshe',
    ],
  },

  // ATM issues
  atmOutage: {
    english: [
      'ATM not dispensing cash',
      'All ATMs showing error',
      'Cannot withdraw from any machine',
      'ATM swallowed my card',
      'Network error on all ATMs',
    ],
    pidgin: [
      'ATM no dey give money',
      'All the machine dem don scatter',
      'E chop my card o',
      'No ATM dey work for this area',
      'Wetin dey happen? ATM no gree work',
    ],
    yoruba: [
      'ATM ko funmi ni owo',
      'Gbogbo awọn ẹrọ ti bajẹ',
      'ATM gba kaadi mi',
      'Ko si ATM ti o n ṣiṣẹ ni agbegbe yii',
      'Kini n ṣẹlẹ? ATM ko ṣiṣẹ',
    ],
    hausa: [
      'ATM baya fitar da kuɗi',
      'Duk injunan sun ɓace',
      'ATM ya haɗiye katin',
      'Babu ATM mai aiki a wannan yanki',
      'Me ke faruwa? ATM baya aiki',
    ],
  },

  // Unauthorized deductions
  unauthorizedDeduction: {
    english: [
      'Money deducted from my account',
      'Strange charges I did not make',
      'Unknown debit alert',
      'Someone is stealing from my account',
      'Fraudulent transaction on my account',
    ],
    pidgin: [
      'Dem don thief money for my account',
      'Money dey comot from my account anyhow',
      'I see alert wey I no do',
      'Who dey collect my money?',
      'This bank don start again o',
    ],
    yoruba: [
      'Wọn ti ja owo kuro ninu account mi',
      'Owo ti n lọ lati account mi lai mọ',
      'Mo ri alert ti emi ko ṣe',
      'Tani n ja owo mi?',
      'Bank yii ti bẹrẹ rẹ lẹẹkansi',
    ],
    hausa: [
      'An cire kuɗi daga account dina',
      'Kuɗi na fita ba tare da izini ba',
      'Na ga alert da ban yi ba',
      'Wanene ke ɗaukar kuɗina?',
      'Wannan banki ya sake farawa',
    ],
  },

  // System issues
  systemMaintenance: {
    english: [
      'Banking app not working',
      'Cannot login to mobile banking',
      'System under maintenance for hours',
      'All online services down',
      'Website keeps crashing',
    ],
    pidgin: [
      'Banking app no dey work',
      'I no fit login since morning',
      'The thing don dey do maintenance since',
      'Everything don off',
      'Website dey hang everytime',
    ],
    yoruba: [
      'App ẹrọ banki ko ṣiṣẹ',
      'Emi ko le wọle si mobile banking',
      'Eto naa wa labẹ atunṣe fun wakati pupọ',
      'Gbogbo awọn iṣẹ ori ayelujara ti bajẹ',
      'Website n parun nigbagbogbo',
    ],
    hausa: [
      'Banking app baya aiki',
      'Ba zan iya shiga mobile banking ba',
      'Tsarin yana ƙarƙashin gyara don sa\'o\'i masu yawa',
      'Duk ayyukan yanar gizo sun ɓace',
      'Gidan yanar gizon yana rushewa koyaushe',
    ],
  },

  // Panic expressions
  panic: {
    english: [
      'This is serious!',
      'What is going on?',
      'Is this happening to everyone?',
      'Should I be worried?',
      'This is getting out of hand',
    ],
    pidgin: [
      'This one tire person o!',
      'Wetin dey sup?',
      'Na only me?',
      'Make I worry?',
      'E don pass ordinary',
    ],
    yoruba: [
      'Eyi burú gan!',
      'Kini n ṣẹlẹ?',
      'Ṣe o n ṣẹlẹ fun gbogbo eniyan?',
      'Ṣe mo gbọdọ ṣaniyan?',
      'Eyi ti pọju',
    ],
    hausa: [
      'Wannan ya yi tsanani!',
      'Me ke faruwa?',
      'Shin wannan yana faruwa da kowa?',
      'Shin in damu?',
      'Wannan ya wuce gona da iri',
    ],
  },

  // Reassurance (for Konfam responses)
  reassurance: {
    english: [
      'All systems are operational',
      'Your funds are safe',
      'This is misinformation',
      'We have verified this claim as false',
      'Please ignore unverified reports',
    ],
    pidgin: [
      'Everything dey work normal',
      'Your money safe',
      'Na lie be that',
      'We don check, e no true',
      'Make una no mind fake gist',
    ],
    yoruba: [
      'Gbogbo eto n ṣiṣẹ daradara',
      'Owo rẹ wa lailewu',
      'Eyi jẹ alaye eke',
      'A ti ṣayẹwo pe eyi jẹ irọ',
      'Jọwọ foju fo awọn iroyin ti a ko ṣayẹwo',
    ],
    hausa: [
      'Duk tsarin suna aiki lafiya',
      'Kuɗin ku suna lafiya',
      'Wannan ƙarya ce',
      'Mun tabbatar cewa wannan ƙarya ce',
      'Don Allah ku yi watsi da rahoton da ba a tabbatar ba',
    ],
  },
};

/**
 * Generate mixed-language content (code-switching)
 */
export function generateMixedLanguagePost(
  baseLanguage: Language,
  emotionalTone: EmotionalTone,
  crisisType: string
): string {
  const templates = getMixedLanguageTemplates(baseLanguage, crisisType);
  const template = templates[Math.floor(Math.random() * templates.length)];
  
  return template;
}

/**
 * Get code-switching templates (common in Nigerian social media)
 */
function getMixedLanguageTemplates(baseLanguage: Language, crisisType: string): string[] {
  if (baseLanguage === Language.PIDGIN || baseLanguage === Language.MIXED) {
    return [
      'Abeg, wetin dey happen? My account don freeze o. Is this happening to everyone?',
      'I just received alert say dem deduct money from my account. This is not fair at all!',
      'Guys, make una check una account o. Something dey fishy for this bank.',
      'Omo, this ATM machine no gree give me money. Na wa o! What is going on?',
      'I don tire for this bank matter o. Every day na one story or the other.',
    ];
  }
  
  if (baseLanguage === Language.YORUBA) {
    return [
      'Please, kini n ṣẹlẹ? My account has been frozen. Ṣe ẹyin naa?',
      'Mo kan ri alert pe wọn ti ja owo mi. This is not acceptable!',
      'Ẹ wo account yin o. Something is wrong pẹlu bank yii.',
      'ATM yi ko funmi ni owo. What kind of thing is this?',
      'Bank yii ti n ṣe wahala pupọ. Every time na problem.',
    ];
  }
  
  return [
    'Please, what is happening? I cannot access my account!',
    'Just got a debit alert for transaction I did not authorize.',
    'Can someone explain what is going on with this bank?',
    'ATM not dispensing. Is this a general issue?',
    'This is becoming too much. What is the bank doing about it?',
  ];
}

/**
 * Select appropriate language based on user personality and context
 */
export function selectLanguageForUser(
  userPersonality: string,
  anxietyLevel: number,
  influenceScore: number
): Language {
  // High anxiety users tend to use more emotional Pidgin
  if (anxietyLevel > 70) {
    return Math.random() > 0.3 ? Language.PIDGIN : Language.MIXED;
  }
  
  // Influencers tend to use English for wider reach
  if (influenceScore > 5) {
    return Math.random() > 0.7 ? Language.ENGLISH : Language.MIXED;
  }
  
  // Distribute languages realistically
  const rand = Math.random();
  if (rand < 0.4) return Language.ENGLISH;
  if (rand < 0.7) return Language.PIDGIN;
  if (rand < 0.85) return Language.MIXED;
  if (rand < 0.95) return Language.YORUBA;
  return Language.HAUSA;
}

/**
 * Get crisis-specific vocabulary
 */
export function getCrisisVocabulary(crisisType: string, language: Language): string[] {
  const categoryMap: { [key: string]: keyof typeof CRISIS_VOCABULARY } = {
    ACCOUNT_FREEZE: 'accountFreeze',
    ATM_OUTAGE: 'atmOutage',
    UNAUTHORIZED_DEDUCTION: 'unauthorizedDeduction',
    SYSTEM_MAINTENANCE: 'systemMaintenance',
    DATA_BREACH: 'accountFreeze', // Use similar vocabulary
    GENERAL_PANIC: 'panic',
  };
  
  const category = categoryMap[crisisType] || 'panic';
  const vocabSet = CRISIS_VOCABULARY[category];
  
  const languageMap: { [key in Language]?: keyof typeof vocabSet } = {
    [Language.ENGLISH]: 'english',
    [Language.PIDGIN]: 'pidgin',
    [Language.YORUBA]: 'yoruba',
    [Language.HAUSA]: 'hausa',
  };
  
  const langKey = languageMap[language] || 'english';
  return vocabSet[langKey] || vocabSet.english;
}

/**
 * Generate Konfam response in specified language
 */
export function generateKonfamResponse(
  language: Language,
  claimText: string,
  verificationData: any
): string {
  const responses = CRISIS_VOCABULARY.reassurance;
  
  const languageMap: { [key in Language]?: keyof typeof responses } = {
    [Language.ENGLISH]: 'english',
    [Language.PIDGIN]: 'pidgin',
    [Language.YORUBA]: 'yoruba',
    [Language.HAUSA]: 'hausa',
  };
  
  const langKey = languageMap[language] || 'english';
  const templates = responses[langKey];
  
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Add emotional intensifiers based on tone
 */
export function addEmotionalIntensifiers(
  text: string,
  tone: EmotionalTone,
  language: Language
): string {
  const intensifiers: { [key in EmotionalTone]?: string[] } = {
    [EmotionalTone.PANIC]: ['!!!', '😱', '⚠️', '🚨'],
    [EmotionalTone.ANGER]: ['!!!', '😡', '💢'],
    [EmotionalTone.CONCERN]: ['...', '🤔', '😟'],
    [EmotionalTone.REASSURING]: ['✅', '✓', '👍'],
  };
  
  const emoticons = intensifiers[tone] || [];
  if (emoticons.length === 0) return text;
  
  const intensifier = emoticons[Math.floor(Math.random() * emoticons.length)];
  
  // Add intensifier based on emotional weight
  return Math.random() > 0.5 ? `${text} ${intensifier}` : text;
}

/**
 * Translate key phrases for multilingual support
 * [AI/ML: Jinadu would integrate actual translation APIs here]
 */
export function translatePhrase(phrase: string, targetLanguage: Language): string {
  // Placeholder for AI translation service
  // In production, this would call OpenAI, Google Translate, or custom model
  
  const commonTranslations: { [key: string]: { [key in Language]?: string } } = {
    'account frozen': {
      [Language.PIDGIN]: 'account don freeze',
      [Language.YORUBA]: 'account ti pa',
      [Language.HAUSA]: 'an toshe account',
    },
    'cannot withdraw': {
      [Language.PIDGIN]: 'I no fit comot money',
      [Language.YORUBA]: 'Emi ko le gba owo',
      [Language.HAUSA]: 'Ba zan iya cire kuɗi ba',
    },
    'what is happening': {
      [Language.PIDGIN]: 'wetin dey sup',
      [Language.YORUBA]: 'kini n ṣẹlẹ',
      [Language.HAUSA]: 'me ke faruwa',
    },
  };
  
  const lowerPhrase = phrase.toLowerCase();
  if (commonTranslations[lowerPhrase]?.[targetLanguage]) {
    return commonTranslations[lowerPhrase][targetLanguage]!;
  }
  
  return phrase; // Fallback to original
}

/**
 * Generate hashtags based on crisis and language
 */
export function generateHashtags(crisisType: string, language: Language): string[] {
  const baseHashtags = [
    '#BankAlert',
    '#NigerianBanks',
    '#CustomerService',
  ];
  
  const crisisHashtags: { [key: string]: string[] } = {
    ACCOUNT_FREEZE: ['#AccountFrozen', '#UnfreezeMyAccount', '#BankingIssues'],
    ATM_OUTAGE: ['#ATMNotWorking', '#NoATM', '#CashWithdrawal'],
    UNAUTHORIZED_DEDUCTION: ['#FraudAlert', '#UnauthorizedDebit', '#BankFraud'],
    SYSTEM_MAINTENANCE: ['#SystemDown', '#AppNotWorking', '#TechnicalIssues'],
    DATA_BREACH: ['#DataBreach', '#AccountSecurity', '#BankingSecurity'],
  };
  
  const specific = crisisHashtags[crisisType] || [];
  const selected = [...baseHashtags, ...specific].slice(0, 3);
  
  return selected;
}