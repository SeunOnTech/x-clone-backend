/**
 * AI-Powered Post Creation with Contextual Awareness
 * [AI/ML: Jinadu integrates language models and prompt engineering]
 */

import { User, Post, CrisisType, CrisisPhase, Language, EmotionalTone, PostType } from '../types';
import { 
  getCrisisVocabulary, 
  selectLanguageForUser, 
  generateMixedLanguagePost,
  addEmotionalIntensifiers,
  generateHashtags
} from '../utils/language-mixer';
import { UserRepository } from '../repositories/user.repository';
import { PostRepository } from '../repositories/post.repository';

export class ContentGeneratorService {
  private userRepo: UserRepository;
  private postRepo: PostRepository;

  constructor() {
    this.userRepo = new UserRepository();
    this.postRepo = new PostRepository();
  }

  /**
   * Generate misinformation post based on crisis scenario
   */
  async generateMisinformationPost(
    author: User,
    crisisType: CrisisType,
    crisisPhase: CrisisPhase,
    crisisId: string
  ): Promise<Omit<Post, 'id' | 'createdAt' | 'updatedAt'>> {
    const language = selectLanguageForUser(
      author.personalityType,
      author.anxietyLevel,
      author.influenceScore
    );

    const emotionalTone = this.selectEmotionalTone(crisisPhase, author.anxietyLevel);
    const content = this.generateCrisisContent(crisisType, crisisPhase, language, author);
    const viralCoefficient = this.calculateInitialViralCoefficient(author, emotionalTone, crisisPhase);
    const emotionalWeight = this.calculateEmotionalWeight(emotionalTone, crisisPhase);
    const panicFactor = this.calculatePanicFactor(crisisType, crisisPhase, author.anxietyLevel);

    return {
      content,
      language,
      emotionalTone,
      postType: PostType.ORIGINAL,
      authorId: author.id,
      author,
      viralCoefficient,
      emotionalWeight,
      panicFactor,
      crisisId,
      isMisinformation: true,
      threatLevel: this.calculateThreatLevel(viralCoefficient, emotionalWeight, panicFactor),
      isKonfamResponse: false,
      likeCount: 0,
      retweetCount: 0,
      replyCount: 0,
      viewCount: 0,
    };
  }

  /**
   * Generate organic worried response to misinformation
   */
  async generateWorkedResponse(
    author: User,
    originalPost: Post
  ): Promise<Omit<Post, 'id' | 'createdAt' | 'updatedAt'>> {
    const language = selectLanguageForUser(
      author.personalityType,
      author.anxietyLevel,
      author.influenceScore
    );

    const templates = this.getWorriedResponseTemplates(language, author.personalityType);
    let content = templates[Math.floor(Math.random() * templates.length)];

    // Add personal touch based on anxiety level
    if (author.anxietyLevel > 70) {
      content = addEmotionalIntensifiers(content, EmotionalTone.PANIC, language);
    }

    return {
      content,
      language,
      emotionalTone: EmotionalTone.CONCERN,
      postType: PostType.REPLY,
      authorId: author.id,
      author,
      parentId: originalPost.id,
      viralCoefficient: 1.0,
      emotionalWeight: 0.6,
      panicFactor: author.anxietyLevel / 100,
      crisisId: originalPost.crisisId,
      isMisinformation: false,
      threatLevel: 0.0,
      isKonfamResponse: false,
      likeCount: 0,
      retweetCount: 0,
      replyCount: 0,
      viewCount: 0,
    };
  }

  /**
   * Generate bot amplification post (retweet with comment)
   */
  async generateBotAmplification(
    bot: User,
    targetPost: Post
  ): Promise<Omit<Post, 'id' | 'createdAt' | 'updatedAt'>> {
    const amplificationPhrases = [
      'This is serious!',
      'Everyone needs to see this',
      'Spread the word',
      'RT if this happened to you',
      'This is why we need change',
      '⚠️ IMPORTANT',
      'Don\'t ignore this',
      'This needs attention',
    ];

    const content = amplificationPhrases[Math.floor(Math.random() * amplificationPhrases.length)];

    return {
      content,
      language: Language.ENGLISH,
      emotionalTone: EmotionalTone.PANIC,
      postType: PostType.QUOTE_TWEET,
      authorId: bot.id,
      author: bot,
      parentId: targetPost.id,
      viralCoefficient: targetPost.viralCoefficient * 1.2,
      emotionalWeight: 0.8,
      panicFactor: targetPost.panicFactor,
      crisisId: targetPost.crisisId,
      isMisinformation: targetPost.isMisinformation,
      threatLevel: targetPost.threatLevel,
      isKonfamResponse: false,
      likeCount: 0,
      retweetCount: 0,
      replyCount: 0,
      viewCount: 0,
    };
  }

  /**
   * Generate Konfam fact-checking response
   */
  async generateKonfamResponse(
    konfamAccount: User,
    misinformationPost: Post,
    verificationData: any,
    responseLanguage: Language
  ): Promise<Omit<Post, 'id' | 'createdAt' | 'updatedAt'>> {
    const content = this.generateFactCheckContent(
      misinformationPost,
      verificationData,
      responseLanguage
    );

    return {
      content,
      language: responseLanguage,
      emotionalTone: EmotionalTone.FACTUAL,
      postType: PostType.REPLY,
      authorId: konfamAccount.id,
      author: konfamAccount,
      parentId: misinformationPost.id,
      viralCoefficient: 2.0, // Konfam responses are boosted
      emotionalWeight: 0.3,
      panicFactor: 0.0,
      crisisId: misinformationPost.crisisId,
      isMisinformation: false,
      threatLevel: 0.0,
      isKonfamResponse: true,
      likeCount: 0,
      retweetCount: 0,
      replyCount: 0,
      viewCount: 0,
    };
  }

  /**
   * Generate crisis content based on type and phase
   */
  private generateCrisisContent(
    crisisType: CrisisType,
    phase: CrisisPhase,
    language: Language,
    author: User
  ): string {
    const vocabulary = getCrisisVocabulary(crisisType, language);
    const basePhrase = vocabulary[Math.floor(Math.random() * vocabulary.length)];

    // Add context based on phase
    const contextualAdditions = this.getPhaseContextAdditions(phase, language);
    const addition = contextualAdditions[Math.floor(Math.random() * contextualAdditions.length)];

    let content = `${basePhrase}. ${addition}`;

    // Add hashtags if influencer
    if (author.influenceScore > 3) {
      const hashtags = generateHashtags(crisisType, language);
      content += ` ${hashtags.slice(0, 2).join(' ')}`;
    }

    return content;
  }

  /**
   * Get contextual additions based on crisis phase
   */
  private getPhaseContextAdditions(phase: CrisisPhase, language: Language): string[] {
    const additions: { [key in CrisisPhase]?: string[] } = {
      [CrisisPhase.INITIAL_SPARK]: [
        'Is this happening to anyone else?',
        'Just happened to me now',
        'What is going on?',
        'Can someone explain this?',
      ],
      [CrisisPhase.ORGANIC_SPREAD]: [
        'My friend just confirmed this happened to them too',
        'This is spreading fast',
        'Multiple people reporting same issue',
        'Something is definitely wrong',
      ],
      [CrisisPhase.PEAK_PANIC]: [
        'This is getting out of hand!',
        'Everyone needs to check their accounts NOW',
        'This is serious, please share',
        'We need answers immediately',
      ],
    };

    return additions[phase] || ['Please help'];
  }

  /**
   * Get worried response templates
   */
  private getWorriedResponseTemplates(language: Language, personality: string): string[] {
    const templates: { [key in Language]?: string[] } = {
      [Language.ENGLISH]: [
        'Oh no, this is happening to me too!',
        'Should I be worried about my account?',
        'Has anyone contacted customer service?',
        'This is exactly what happened to my friend',
        'What should we do about this?',
      ],
      [Language.PIDGIN]: [
        'Chai! E don happen to me too o',
        'Abeg make I worry?',
        'Anybody don call customer service?',
        'Na the same thing happen to my guy',
        'Wetin we go do now?',
      ],
    };

    return templates[language] || templates[Language.ENGLISH]!;
  }

  /**
   * Generate fact-check content
   */
  private generateFactCheckContent(
    post: Post,
    verificationData: any,
    language: Language
  ): string {
    const templates: { [key in Language]?: string[] } = {
      [Language.ENGLISH]: [
        '✅ VERIFIED: All banking systems are operational. Your funds are safe.',
        '✅ FACT CHECK: This claim is FALSE. Our systems show 98% uptime.',
        '✅ CONFIRMED: No accounts have been frozen. This is misinformation.',
        '✅ VERIFIED: All ATMs are functioning normally. Please check https://verify.konfam.ng',
      ],
      [Language.PIDGIN]: [
        '✅ WE DON CHECK: Everything dey work normal. Your money safe.',
        '✅ FACT CHECK: This thing na lie. System dey work well.',
        '✅ CONFIRMED: No account freeze. Na fake news be that.',
        '✅ VERIFIED: All ATM dey work. Make una no panic.',
      ],
    };

    const languageTemplates = templates[language] || templates[Language.ENGLISH]!;
    return languageTemplates[Math.floor(Math.random() * languageTemplates.length)];
  }

  /**
   * Select emotional tone based on phase and anxiety
   */
  private selectEmotionalTone(phase: CrisisPhase, anxietyLevel: number): EmotionalTone {
    if (phase === CrisisPhase.PEAK_PANIC) {
      return EmotionalTone.PANIC;
    }

    if (phase === CrisisPhase.ORGANIC_SPREAD && anxietyLevel > 70) {
      return EmotionalTone.PANIC;
    }

    if (anxietyLevel > 60) {
      return Math.random() > 0.5 ? EmotionalTone.CONCERN : EmotionalTone.ANGER;
    }

    return EmotionalTone.CONCERN;
  }

  /**
   * Calculate initial viral coefficient
   */
  private calculateInitialViralCoefficient(
    author: User,
    tone: EmotionalTone,
    phase: CrisisPhase
  ): number {
    let coefficient = 1.0;

    // Author influence
    coefficient *= author.influenceScore;

    // Emotional amplification
    if (tone === EmotionalTone.PANIC) coefficient *= 1.5;
    if (tone === EmotionalTone.ANGER) coefficient *= 1.3;

    // Phase multiplier
    const phaseMultipliers: { [key in CrisisPhase]?: number } = {
      [CrisisPhase.INITIAL_SPARK]: 1.2,
      [CrisisPhase.BOT_AMPLIFICATION]: 2.0,
      [CrisisPhase.PEAK_PANIC]: 2.5,
    };

    coefficient *= phaseMultipliers[phase] || 1.0;

    return Math.min(coefficient, 10.0);
  }

  /**
   * Calculate emotional weight
   */
  private calculateEmotionalWeight(tone: EmotionalTone, phase: CrisisPhase): number {
    const toneWeights: { [key in EmotionalTone]: number } = {
      [EmotionalTone.PANIC]: 0.9,
      [EmotionalTone.ANGER]: 0.8,
      [EmotionalTone.CONCERN]: 0.6,
      [EmotionalTone.NEUTRAL]: 0.3,
      [EmotionalTone.REASSURING]: 0.2,
      [EmotionalTone.FACTUAL]: 0.1,
    };

    return toneWeights[tone];
  }

  /**
   * Calculate panic factor
   */
  private calculatePanicFactor(
    crisisType: CrisisType,
    phase: CrisisPhase,
    authorAnxiety: number
  ): number {
    const crisisMultipliers: { [key in CrisisType]: number } = {
      [CrisisType.ACCOUNT_FREEZE]: 0.9,
      [CrisisType.UNAUTHORIZED_DEDUCTION]: 0.95,
      [CrisisType.DATA_BREACH]: 0.85,
      [CrisisType.ATM_OUTAGE]: 0.7,
      [CrisisType.SYSTEM_MAINTENANCE]: 0.5,
      [CrisisType.GENERAL_PANIC]: 0.6,
    };

    const phaseMultipliers: { [key in CrisisPhase]?: number } = {
      [CrisisPhase.PEAK_PANIC]: 1.0,
      [CrisisPhase.ORGANIC_SPREAD]: 0.7,
      [CrisisPhase.BOT_AMPLIFICATION]: 0.8,
    };

    const basePanic = crisisMultipliers[crisisType];
    const phaseFactor = phaseMultipliers[phase] || 0.5;
    const anxietyFactor = authorAnxiety / 100;

    return Math.min(basePanic * phaseFactor * anxietyFactor, 1.0);
  }

  /**
   * Calculate initial threat level
   */
  private calculateThreatLevel(
    viralCoefficient: number,
    emotionalWeight: number,
    panicFactor: number
  ): number {
    return Math.min(
      (viralCoefficient / 10) * 0.4 + emotionalWeight * 0.3 + panicFactor * 0.3,
      1.0
    );
  }
}