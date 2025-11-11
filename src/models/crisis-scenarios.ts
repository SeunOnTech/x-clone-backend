/**
 * Structured Templates for Different Crisis Types
 * Pre-configured scenarios for realistic demonstrations
 */

import { CrisisType, Language, EmotionalTone } from '../types';

export interface CrisisScenario {
  type: CrisisType;
  title: string;
  description: string;
  narrativeArc: {
    initialSpark: string[];
    escalation: string[];
    peakClaims: string[];
    resolution: string[];
  };
  keyHashtags: string[];
  targetedLanguages: Language[];
  estimatedDuration: number; // minutes
  expectedVirality: number; // 1-10
  konfamResponseTemplates: string[];
}

/**
 * Scenario 1: Bank Account Freeze Panic
 */
export const ACCOUNT_FREEZE_SCENARIO: CrisisScenario = {
  type: CrisisType.ACCOUNT_FREEZE,
  title: 'Mass Account Freeze Rumor',
  description: 'False claims that the bank is freezing customer accounts without notice',
  narrativeArc: {
    initialSpark: [
      'Just tried to make a transfer and my account is blocked. What is happening?',
      'My account was frozen this morning. No explanation from the bank.',
      'Cannot access my funds. Account shows as restricted.',
      'Anyone else experiencing account issues today?',
    ],
    escalation: [
      'This is the 5th person I know whose account was frozen today!',
      'My colleague just confirmed same thing happened to them',
      'This is not isolated. Something is seriously wrong.',
      'I heard it\'s affecting thousands of accounts',
      'My sister in Abuja says same thing happening there',
    ],
    peakClaims: [
      'BREAKING: Bank freezing all accounts over ₦500k balance',
      'They are doing this to avoid paying customers!',
      'This is a liquidity crisis. Get your money out NOW',
      'Government ordered banks to freeze accounts. This is serious!',
      'Bank is about to collapse. They are restricting withdrawals.',
    ],
    resolution: [
      'Just spoke to bank. No account freeze. System glitch resolved.',
      'My account is working fine now. False alarm',
      'Konfam verified all systems operational',
      'This was misinformation. Bank confirmed no issues.',
    ],
  },
  keyHashtags: ['#AccountFrozen', '#BankingCrisis', '#ProtectCustomers'],
  targetedLanguages: [Language.ENGLISH, Language.PIDGIN, Language.YORUBA],
  estimatedDuration: 35,
  expectedVirality: 9,
  konfamResponseTemplates: [
    '✅ VERIFIED: No accounts have been frozen. All systems operational. This is misinformation.',
    '✅ FACT CHECK: Bank confirms all customer accounts remain active. Normal transactions continue.',
    '✅ We have verified with the bank: No account restrictions in place. Your funds are safe.',
  ],
};

/**
 * Scenario 2: ATM Network Outage
 */
export const ATM_OUTAGE_SCENARIO: CrisisScenario = {
  type: CrisisType.ATM_OUTAGE,
  title: 'ATM Network Collapse Scare',
  description: 'Viral posts claiming all ATMs are down nationwide',
  narrativeArc: {
    initialSpark: [
      'ATM machine not dispensing cash. Tried 3 different locations.',
      'No ATM is working in Lekki. What is happening?',
      'Tried to withdraw, machine says unavailable.',
      'ATM swallowed my card and gave no cash',
    ],
    escalation: [
      'All ATMs in Lagos showing out of service',
      'Friend in PH says ATMs down there too',
      'This is nationwide. None of the ATMs are working',
      'Is there a network outage or cash shortage?',
      'People queuing at banks because ATMs are down',
    ],
    peakClaims: [
      'Bank has shut down ALL ATMs. This is intentional!',
      'They are trying to force people to go cashless',
      'No cash in any ATM across Nigeria. This is planned',
      'Bank cannot fulfill withdrawal demands. They are broke!',
      'Government ordered ATM shutdown. Currency crisis incoming',
    ],
    resolution: [
      'ATMs back online. Was temporary network issue',
      'Just withdrew successfully. Service restored',
      'Bank confirmed temporary outage. Fixed now',
      'Konfam verified: 98% ATM uptime. No shutdown',
    ],
  },
  keyHashtags: ['#ATMOutage', '#NoATM', '#CashCrisis'],
  targetedLanguages: [Language.ENGLISH, Language.PIDGIN, Language.HAUSA],
  estimatedDuration: 30,
  expectedVirality: 8,
  konfamResponseTemplates: [
    '✅ VERIFIED: ATM network operational. 98% uptime. Localized issues being resolved.',
    '✅ Bank confirms: No ATM shutdown. Normal service across all locations.',
    '✅ Real-time check shows ATMs functioning. Report any specific issues to support.',
  ],
};

/**
 * Scenario 3: Unauthorized Deductions
 */
export const UNAUTHORIZED_DEDUCTION_SCENARIO: CrisisScenario = {
  type: CrisisType.UNAUTHORIZED_DEDUCTION,
  title: 'Mass Fraud Alert Panic',
  description: 'Claims of widespread unauthorized debits from accounts',
  narrativeArc: {
    initialSpark: [
      'Just got debit alert for transaction I did not make',
      '₦50,000 deducted from my account. I did not authorize this!',
      'Strange charges appearing on my account',
      'Someone is making withdrawals from my account',
    ],
    escalation: [
      'Multiple unauthorized debits. This is fraud!',
      'My friend got debit alert too. Same amount',
      'This is happening to many people. Pattern is clear',
      'Bank database has been hacked. Our details are compromised',
      'They are stealing from customer accounts',
    ],
    peakClaims: [
      'ALERT: Mass fraud attack on customer accounts ongoing',
      'Hackers have access to bank database. Change your pins NOW',
      'Bank is covering up massive security breach',
      'Everyone should move their money out immediately',
      'This is the biggest banking fraud in Nigerian history',
    ],
    resolution: [
      'Bank reversed the charge. Was a system error',
      'All duplicate charges being reversed automatically',
      'No fraud. Technical glitch during system update',
      'Konfam confirmed: No security breach. Reversal in progress',
    ],
  },
  keyHashtags: ['#BankFraud', '#UnauthorizedDebit', '#ProtectYourMoney'],
  targetedLanguages: [Language.ENGLISH, Language.PIDGIN],
  estimatedDuration: 40,
  expectedVirality: 10,
  konfamResponseTemplates: [
    '✅ VERIFIED: No security breach. Duplicate charges being reversed. Your account is secure.',
    '✅ Bank confirms: System error caused duplicate transactions. All reversals processed within 24hrs.',
    '✅ We have verified: No unauthorized access. Technical glitch affecting small number of transactions.',
  ],
};

/**
 * Scenario 4: System Maintenance Failure
 */
export const SYSTEM_MAINTENANCE_SCENARIO: CrisisScenario = {
  type: CrisisType.SYSTEM_MAINTENANCE,
  title: 'Mobile App Meltdown',
  description: 'Panic over extended mobile banking downtime',
  narrativeArc: {
    initialSpark: [
      'Mobile banking app not loading since morning',
      'Cannot login to app. Keep getting error',
      'Website also down. What is going on?',
      'App says under maintenance but been hours now',
    ],
    escalation: [
      'App down for over 6 hours. This is unacceptable',
      'No communication from bank about when it will be fixed',
      'People cannot pay bills or make transfers',
      'Businesses cannot process payments. Losing money',
      'This extended downtime is suspicious',
    ],
    peakClaims: [
      'Bank systems have crashed completely. They cannot recover',
      'This is not maintenance. They have been hacked',
      'All customer data might be compromised during this outage',
      'Bank is hiding something. Why no updates?',
      'Switch to another bank. This one is unreliable',
    ],
    resolution: [
      'App back online. Maintenance completed',
      'Bank apologized for extended downtime. Systems restored',
      'All services working normally now',
      'Konfam verified: Scheduled maintenance took longer than planned. No data breach',
    ],
  },
  keyHashtags: ['#AppDown', '#BankingApp', '#SystemFailure'],
  targetedLanguages: [Language.ENGLISH, Language.PIDGIN],
  estimatedDuration: 25,
  expectedVirality: 6,
  konfamResponseTemplates: [
    '✅ CONFIRMED: Scheduled maintenance extended due to technical issue. No security concerns.',
    '✅ Bank confirms: System upgrade taking longer than expected. Service restoration in progress.',
    '✅ VERIFIED: No data breach. Maintenance-related downtime. All systems secure.',
  ],
};

/**
 * Scenario 5: Data Breach Rumor
 */
export const DATA_BREACH_SCENARIO: CrisisScenario = {
  type: CrisisType.DATA_BREACH,
  title: 'Customer Data Leak Scare',
  description: 'False reports of customer information being sold on dark web',
  narrativeArc: {
    initialSpark: [
      'Received suspicious call with my BVN details. How did they get this?',
      'Someone messaged me with my account number and phone',
      'My personal information is being used by fraudsters',
      'Bank must have leaked customer data',
    ],
    escalation: [
      'Multiple customers reporting same thing',
      'Fraudsters have detailed information only bank would have',
      'This is a massive data breach',
      'Our information is on the dark web',
      'Bank is not admitting to the breach',
    ],
    peakClaims: [
      'CONFIRMED: Bank customer database leaked online',
      'Millions of records exposed. BVN, account numbers, everything',
      'Change all your passwords and pins immediately',
      'Bank is liable for damages. Class action lawsuit incoming',
      'This is the worst security breach in Nigerian banking',
    ],
    resolution: [
      'No data breach confirmed. Phishing attack targeted customers',
      'Bank security audit shows no compromise',
      'Fraudsters using social engineering, not leaked data',
      'Konfam verified: No breach. Enhanced security measures activated',
    ],
  },
  keyHashtags: ['#DataBreach', '#BankingSecurity', '#ProtectYourData'],
  targetedLanguages: [Language.ENGLISH],
  estimatedDuration: 45,
  expectedVirality: 9,
  konfamResponseTemplates: [
    '✅ VERIFIED: No data breach detected. Bank security systems intact. Phishing attempts reported.',
    '✅ Security audit confirms: No unauthorized access to customer data. Beware of phishing scams.',
    '✅ FACT CHECK: Claims of data breach are FALSE. Bank systems secure. Report suspicious activity.',
  ],
};

/**
 * All available scenarios
 */
export const ALL_SCENARIOS: CrisisScenario[] = [
  ACCOUNT_FREEZE_SCENARIO,
  ATM_OUTAGE_SCENARIO,
  UNAUTHORIZED_DEDUCTION_SCENARIO,
  SYSTEM_MAINTENANCE_SCENARIO,
  DATA_BREACH_SCENARIO,
];

/**
 * Get scenario by crisis type
 */
export function getScenarioByType(type: CrisisType): CrisisScenario | undefined {
  return ALL_SCENARIOS.find(s => s.type === type);
}

/**
 * Get random scenario
 */
export function getRandomScenario(): CrisisScenario {
  return ALL_SCENARIOS[Math.floor(Math.random() * ALL_SCENARIOS.length)]!;
}

/**
 * Get scenario narrative for specific phase
 */
export function getPhaseNarrative(
  scenario: CrisisScenario,
  phase: 'initialSpark' | 'escalation' | 'peakClaims' | 'resolution'
): string[] {
  return scenario.narrativeArc[phase];
}