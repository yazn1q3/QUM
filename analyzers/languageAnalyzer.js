/**
 * languageAnalyzer.js
 * تحليل لغوي عميق لنصوص مقالات ويكيبيديا العربية
 * 
 * يقوم بتحليل شامل للغة المقالة بما في ذلك:
 * - كشف أنماط الترجمة الآلية
 * - كشف الأسلوب الضعيف
 * - كشف الأخطاء النحوية والإملائية
 * - تحليل بنية الفقرات والجمل
 * 
 * @module languageAnalyzer
 * @version 1.0.0
 */

(function(window) {
   'use strict';

   class LanguageAnalyzer {
      constructor() {
         // أنماط الترجمة الآلية
         this.machineTranslationPatterns = [
            /\bتم\s+\w+/g,
            /\bقام\s+ب/g,
            /\bحوالي\s+\d+/g,
            /\bوفقًا\s+ل/g,
            /\bوفقاً\s+ل/g,
            /\bفي\s+سنة\s+\d+/g,
            /\bفي\s+عام\s+\d+/g,
            /\bيُذكر\s+أن/g,
            /\bيذكر\s+أن/g,
            /\bكما\s+يلي/g,
            /\bالجدير\s+بالذكر/g,
            /\bمن\s+الجدير\s+بالذكر/g,
            /\bعلى\s+سبيل\s+المثال/g,
            /\bبشكل\s+خاص/g,
            /\bبصفة\s+خاصة/g
         ];

         // كلمات حشو لغوي
         this.fillerPatterns = [
            /\bبشكل\s+عام/g,
            /\bبصورة\s+عامة/g,
            /\bبصفة\s+عامة/g,
            /\bمن\s+ناحية\s+أخرى/g,
            /\bمن\s+جهة\s+أخرى/g,
            /\bفي\s+الواقع/g,
            /\bفي\s+الحقيقة/g,
            /\bبطبيعة\s+الحال/g,
            /\bفي\s+نهاية\s+المطاف/g,
            /\bفي\s+نهاية\s+الأمر/g,
            /\bكما\s+هو\s+معروف/g,
            /\bكما\s+هو\s+واضح/g
         ];

         // تراكيب الجمل الضعيفة
         this.weakConstructionPatterns = [
            /^في\s+\w+/,      // تبدأ بـ "في"
            /^على\s+\w+/,     // تبدأ بـ "على"
            /^من\s+\w+/,      // تبدأ بـ "من"
            /^عند\s+\w+/,     // تبدأ بـ "عند"
            /^وفقًا\s+/,      // تبدأ بـ "وفقاً"
            /^وفقاً\s+/,
            /^حسب\s+/,        // تبدأ بـ "حسب"
            /^بحسب\s+/
         ];

         // حدود الجمل
         this.sentenceLengthLimits = {
            tooShort: 20,
            tooLong: 200,
            ideal: { min: 40, max: 120 }
         };

         // حدود الفقرات
         this.paragraphLimits = {
            minLength: 50,
            idealMin: 100
         };

         // أنماط الجمل التي تبدأ بحروف الجر
         this.prepositionStartPatterns = [
            /^في\s+/,
            /^من\s+/,
            /^على\s+/,
            /^إلى\s+/,
            /^عن\s+/,
            /^حتى\s+/,
            /^لدى\s+/,
            /^عند\s+/,
            /^نحو\s+/,
            /^حسب\s+/,
            /^بحسب\s+/,
            /^وفقًا\s+لـ/,
            /^وفقاً\s+لـ/,
            /^بناءً\s+على/,
            /^بناء\s+على/,
            /^في\s+عام\s+/,
            /^في\s+سنة\s+/
         ];

         // أنماط ضعف السرد
         this.narrativeWeaknessPatterns = [
            // افتتاحيات سردية مبالغ فيها
            /تدور\s+القصة\s+حول/g,
            /وتبدأ\s+الأحداث/g,
            /وتدور\s+أحداث/g,
            /كان\s+يا\s+ما\s+كان/g,
            /في\s+قديم\s+الزمان/g,
            // أسلوب مطوّل
            /من\s+الجدير\s+بالذكر/g,
            /يجدر\s+بالذكر/g,
            /كما\s+يلي/g,
            /يمكن\s+القول\s+بأن/g,
            /يُذكر\s+أن/g,
            /يذكر\s+أن/g,
            /من\s+المعروف\s+أن/g,
            /كما\s+هو\s+معروف/g,
            // تراكيب حشو
            /بشكل\s+عام/g,
            /بصورة\s+عامة/g,
            /من\s+ناحية\s+أخرى/g,
            /من\s+جهة\s+أخرى/g,
            /بالإضافة\s+إلى\s+ذلك/g,
            /بالإضافة\s+لذلك/g,
            /علاوة\s+على\s+ذلك/g,
            /فضلاً\s+عن\s+ذلك/g,
            /في\s+الواقع/g,
            /في\s+الحقيقة/g,
            /بطبيعة\s+الحال/g
         ];

         // حد التشابه للكشف عن التكرار
         this.redundancySimilarityThreshold = 0.85;
         this.redundancyMinLength = 30;
      }

      /**
       * التحليل اللغوي الرئيسي
       * @param {Object} articleData - بيانات المقالة
       * @returns {Object} نتائج التحليل اللغوي
       */
      analyze(articleModel) {
         // استخراج البيانات النصية
         const articleData = this._extractTextData(articleModel);

         // التحقق من صحة المدخلات
         if (!this._validateInput(articleData)) {
            return this._getEmptyResult();
         }

         const fullText = articleData.fullText || '';
         const introText = articleData.introText || '';
         const grammarRules = articleData.grammarRules || [];

         // تحليل الجمل
         const sentences = this._segmentSentences(fullText);
         const sentenceAnalysis = this._analyzeSentences(sentences);

         // تحليل الفقرات
         const paragraphAnalysis = this._analyzeParagraphs(fullText);

         // كشف أنماط الترجمة الآلية
         const mtSignals = this._detectMachineTranslation(fullText, sentences);

         // كشف الأسلوب الضعيف
         const styleSignals = this._detectWeakStyle(fullText, sentences);

         // تطبيق قواعد النحو
         const grammarViolations = this._applyGrammarRules(fullText, grammarRules);

         // تحليل علامات الترقيم
         const punctuationAnalysis = this._analyzePunctuation(fullText);

         // كشف الجمل التي تبدأ بحروف الجر
         const prepositionAnalysis = this._detectPrepositionStart(sentences);

         // كشف ضعف السرد
         const narrativeAnalysis = this._detectNarrativeWeakness(fullText);

         // كشف التكرار والتشابه
         const redundancyAnalysis = this._detectRedundancy(sentences);

         // جمع الأمثلة
         const examples = this._collectExamples(
            sentences,
            mtSignals.phrases,
            grammarViolations.ruleHits,
            sentenceAnalysis.longSentences,
            prepositionAnalysis.examples,
            narrativeAnalysis.examples,
            redundancyAnalysis.examples
         );

         // بناء النتيجة النهائية
         return {
            machineTranslationSignals: mtSignals.count,
            weakStyleSignals: styleSignals.count,
            grammarViolations: grammarViolations.count,
            longSentences: sentenceAnalysis.longCount,
            shortSentences: sentenceAnalysis.shortCount,
            avgSentenceLength: sentenceAnalysis.avgLength,
            paragraphCount: paragraphAnalysis.total,
            emptyParagraphs: paragraphAnalysis.empty,
            nonStandardParagraphs: paragraphAnalysis.nonStandard,
            punctuationScore: punctuationAnalysis.score,
            fillerWordsCount: styleSignals.fillerCount,
            sentenceCount: sentences.length,
            prepositionStartSentences: prepositionAnalysis.count,
            narrativeWeaknessSignals: narrativeAnalysis.count,
            redundantSentences: redundancyAnalysis.count,
            examples: examples
         };
      }

      /**
       * استخراج البيانات النصية من نموذج المقالة
       * @private
       */
      _extractTextData(articleModel) {
         if (!articleModel) {
            return {};
         }

         return {
            introText: articleModel.intro?.wikitext || articleModel.intro?.text || '',
            fullText: articleModel.wikitext || this._extractFullText(articleModel),
            grammarRules: articleModel.grammarRules || []
         };
      }

      /**
       * استخراج النص الكامل من نموذج المقالة
       * @private
       */
      _extractFullText(articleModel) {
         let fullText = '';

         // المقدمة
         if (articleModel.intro) {
            fullText += articleModel.intro.wikitext || articleModel.intro.text || '';
         }

         // الأقسام
         if (articleModel.sections && Array.isArray(articleModel.sections)) {
            articleModel.sections.forEach(section => {
               if (section.content) {
                  fullText += '\n\n' + section.content;
               }
            });
         }

         return fullText;
      }

      /**
       * التحقق من صحة المدخلات
       * @private
       */
      _validateInput(articleData) {
         if (!articleData || typeof articleData !== 'object') {
            return false;
         }

         // يجب أن يكون هناك نص كامل على الأقل
         return !!(articleData.fullText && typeof articleData.fullText === 'string' && articleData.fullText.length > 0);
      }

      /**
       * تقسيم النص إلى جمل
       * @private
       */
      _segmentSentences(text) {
         if (!text || typeof text !== 'string') {
            return [];
         }

         // تنظيف النص من Wiki markup
         let cleanText = this._cleanWikiMarkup(text);

         // تقسيم الجمل باستخدام علامات الترقيم
         // نستخدم regex يدعم العربية والإنجليزية
         const sentenceDelimiters = /[.!؟?]+(?:\s+|$)/g;
         
         let sentences = cleanText.split(sentenceDelimiters);

         // تنظيف وتصفية الجمل
         sentences = sentences
            .map(s => s.trim())
            .filter(s => s.length > 0)
            .filter(s => !this._isListItem(s))
            .filter(s => !this._isReference(s))
            .filter(s => !this._isTemplateOrTag(s));

         return sentences;
      }

      /**
       * تنظيف Wiki markup من النص
       * @private
       */
      _cleanWikiMarkup(text) {
         return text
            // إزالة القوالب
            .replace(/\{\{[^}]*\}\}/g, '')
            // إزالة الجداول بالكامل (wiki table markup)
            .replace(/\{\|[\s\S]*?\|\}/g, '')
            // إزالة صفوف الجداول المتبقية (|-, |+, |})
            .replace(/^\s*\|-.*$/gm, '')
            .replace(/^\s*\|\+.*$/gm, '')
            .replace(/^\s*\|\}.*$/gm, '')
            // إزالة خلايا الجداول (| text أو || text أو ! text)
            .replace(/^\s*[|!]+[^|\n]*$/gm, '')
            .replace(/\|\|[^|\n]*/g, '')
            // إزالة HTML tables
            .replace(/<table[\s\S]*?<\/table>/gi, '')
            // إزالة HTML table elements (tr, td, th)
            .replace(/<\/?t[rdh][^>]*>/gi, '')
            // إزالة الروابط الداخلية (الاحتفاظ بالنص فقط)
            .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
            // إزالة الروابط الخارجية
            .replace(/\[https?:\/\/[^\s\]]+\s*([^\]]*)\]/g, '$1')
            // إزالة المراجع
            .replace(/<ref[^>]*>.*?<\/ref>/gi, '')
            .replace(/<ref[^>]*\/>/gi, '')
            // إزالة العناوين
            .replace(/^=+.*?=+$/gm, '')
            // إزالة القوائم
            .replace(/^[*#:;]+/gm, '')
            // إزالة HTML tags المتبقية
            .replace(/<[^>]+>/g, '')
            // تنظيف المسافات المتعددة
            .replace(/\s+/g, ' ')
            .trim();
      }

      /**
       * فحص إذا كان السطر عنصر قائمة
       * @private
       */
      _isListItem(text) {
         return /^[\*\#\:\;]/.test(text);
      }

      /**
       * فحص إذا كان النص مرجعاً
       * @private
       */
      _isReference(text) {
         return /<ref/i.test(text) || text.startsWith('[') && text.endsWith(']');
      }

      /**
       * فحص إذا كان النص قالباً أو وسماً
       * @private
       */
      _isTemplateOrTag(text) {
         return text.startsWith('{{') || text.startsWith('<') || text.startsWith('|');
      }

      /**
       * تحليل الجمل
       * @private
       */
      _analyzeSentences(sentences) {
         if (!sentences || sentences.length === 0) {
            return {
               avgLength: 0,
               longCount: 0,
               shortCount: 0,
               longSentences: []
            };
         }

         let totalLength = 0;
         let longCount = 0;
         let shortCount = 0;
         const longSentences = [];

         sentences.forEach(sentence => {
            const length = sentence.length;
            totalLength += length;

            if (length > this.sentenceLengthLimits.tooLong) {
               longCount++;
               longSentences.push({
                  text: sentence.substring(0, 150) + (sentence.length > 150 ? '...' : ''),
                  length: length
               });
            } else if (length < this.sentenceLengthLimits.tooShort) {
               shortCount++;
            }
         });

         return {
            avgLength: Math.round(totalLength / sentences.length),
            longCount: longCount,
            shortCount: shortCount,
            longSentences: longSentences.slice(0, 5) // أول 5 أمثلة فقط
         };
      }

      /**
       * تحليل الفقرات
       * @private
       */
      _analyzeParagraphs(text) {
         if (!text || typeof text !== 'string') {
            return {
               total: 0,
               empty: 0,
               nonStandard: 0
            };
         }

         // تقسيم النص إلى فقرات
         const paragraphs = text
            .split(/\n\s*\n/)
            .map(p => p.trim())
            .filter(p => p.length > 0);

         let emptyCount = 0;
         let nonStandardCount = 0;

         paragraphs.forEach(paragraph => {
            // فقرات فارغة أو قصيرة جداً
            if (paragraph.length < this.paragraphLimits.minLength) {
               emptyCount++;
            }

            // فقرات تبدأ بتركيب ضعيف
            const startsWithWeakConstruction = this.weakConstructionPatterns.some(
               pattern => pattern.test(paragraph)
            );

            if (startsWithWeakConstruction) {
               nonStandardCount++;
            }
         });

         return {
            total: paragraphs.length,
            empty: emptyCount,
            nonStandard: nonStandardCount
         };
      }

      /**
       * كشف أنماط الترجمة الآلية
       * @private
       */
      _detectMachineTranslation(text, sentences) {
         if (!text) {
            return { count: 0, phrases: [] };
         }

         const detectedPhrases = [];
         let totalSignals = 0;

         // فحص الأنماط الشائعة للترجمة الآلية
         this.machineTranslationPatterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) {
               totalSignals += matches.length;
               matches.slice(0, 3).forEach(match => {
                  if (!detectedPhrases.includes(match)) {
                     detectedPhrases.push(match);
                  }
               });
            }
         });

         // فحص الجمل التي تبدأ بأنماط ضعيفة
         sentences.forEach(sentence => {
            this.weakConstructionPatterns.forEach(pattern => {
               if (pattern.test(sentence)) {
                  totalSignals++;
               }
            });
         });

         return {
            count: totalSignals,
            phrases: detectedPhrases.slice(0, 10) // أول 10 أمثلة
         };
      }

      /**
       * كشف الأسلوب الضعيف
       * @private
       */
      _detectWeakStyle(text, sentences) {
         if (!text) {
            return { count: 0, fillerCount: 0 };
         }

         let weakStyleCount = 0;
         let fillerCount = 0;

         // كشف كلمات الحشو
         this.fillerPatterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) {
               fillerCount += matches.length;
               weakStyleCount += matches.length;
            }
         });

         // كشف التكرار المفرط لكلمات معينة
         const commonWords = this._countCommonWords(text);
         const excessiveRepetition = Object.values(commonWords).filter(count => count > 15);
         weakStyleCount += excessiveRepetition.length * 2;

         // كشف الجمل ذات البنية الضعيفة
         sentences.forEach(sentence => {
            // جمل طويلة جداً بدون فواصل
            if (sentence.length > 250 && !sentence.includes('،') && !sentence.includes(',')) {
               weakStyleCount++;
            }

            // جمل تبدأ بـ "و" بكثرة
            if (/^و\s+\w+/.test(sentence)) {
               weakStyleCount += 0.5;
            }
         });

         return {
            count: Math.round(weakStyleCount),
            fillerCount: fillerCount
         };
      }

      /**
       * عد الكلمات الشائعة
       * @private
       */
      _countCommonWords(text) {
         const words = text
            .replace(/[^\u0600-\u06FF\s]/g, '') // الاحتفاظ بالعربية فقط
            .split(/\s+/)
            .filter(word => word.length > 3); // كلمات أطول من 3 أحرف

         const wordCount = {};

         words.forEach(word => {
            wordCount[word] = (wordCount[word] || 0) + 1;
         });

         return wordCount;
      }

      /**
       * تطبيق قواعد النحو والإملاء
       * @private
       */
      _applyGrammarRules(text, grammarRules) {
         if (!text || !grammarRules || !Array.isArray(grammarRules)) {
            return { count: 0, ruleHits: [] };
         }

         // تعطيل ميزة الأخطاء النحوية مؤقتاً بسبب مشاكل في العد والأسماء
         // سيتم تفعيلها لاحقاً بعد حل المشاكل
         console.log('[LanguageAnalyzer] Grammar checking temporarily disabled');
         
         return {
            count: 0,
            ruleHits: []
         };
      }

      /**
       * فحص أمان نمط regex
       * @private
       */
      _isSafePattern(pattern) {
         // تجنب الأنماط التي قد تسبب Catastrophic Backtracking
         const dangerousPatterns = [
            /\([^)]*\)\+\+/,           // Nested quantifiers
            /\([^)]*\)\*\*/,
            /\([^)]*\)\+\*/,
            /\(.*\)\+\(/,
            /\{0,999\}/                // Excessive ranges
         ];

         return !dangerousPatterns.some(dangerous => dangerous.test(pattern));
      }

      /**
       * تحليل علامات الترقيم
       * @private
       */
      _analyzePunctuation(text) {
         if (!text) {
            return { score: 0, ratio: 0 };
         }

         // عد علامات الترقيم الصحيحة
         const arabicPunctuation = (text.match(/[،؛؟]/g) || []).length;
         const englishPunctuation = (text.match(/[,;?!.]/g) || []).length;
         const totalPunctuation = arabicPunctuation + englishPunctuation;

         // حساب نسبة علامات الترقيم العربية
         const arabicRatio = totalPunctuation > 0 
            ? (arabicPunctuation / totalPunctuation) * 100 
            : 0;

         // تقييم الجودة
         let score = 0;
         if (arabicRatio > 70) {
            score = 100; // ممتاز
         } else if (arabicRatio > 50) {
            score = 75;  // جيد
         } else if (arabicRatio > 30) {
            score = 50;  // مقبول
         } else {
            score = 25;  // ضعيف
         }

         return {
            score: score,
            ratio: Math.round(arabicRatio),
            arabicCount: arabicPunctuation,
            englishCount: englishPunctuation
         };
      }

      /**
       * جمع الأمثلة للعرض
       * @private
       */
      _collectExamples(sentences, mtPhrases, grammarHits, longSentences, prepExamples, narrativeExamples, redundancyExamples) {
         return {
            longSentences: longSentences.slice(0, 3),
            machineTranslationPhrases: mtPhrases.slice(0, 8),
            grammarRuleHits: grammarHits.map(hit => ({
               name: hit.name,
               count: hit.count,
               examples: hit.examples
            })).slice(0, 5),
            prepositionStartSentences: (prepExamples || []).slice(0, 3),
            narrativeWeakness: (narrativeExamples || []).slice(0, 3),
            redundantSentences: (redundancyExamples || []).slice(0, 3)
         };
      }

      /**
       * إرجاع نتيجة فارغة
       * @private
       */
      _getEmptyResult() {
         return {
            machineTranslationSignals: 0,
            weakStyleSignals: 0,
            grammarViolations: 0,
            longSentences: 0,
            shortSentences: 0,
            avgSentenceLength: 0,
            paragraphCount: 0,
            emptyParagraphs: 0,
            nonStandardParagraphs: 0,
            punctuationScore: 0,
            fillerWordsCount: 0,
            sentenceCount: 0,
            prepositionStartSentences: 0,
            narrativeWeaknessSignals: 0,
            redundantSentences: 0,
            examples: {
               longSentences: [],
               machineTranslationPhrases: [],
               grammarRuleHits: [],
               prepositionStartSentences: [],
               narrativeWeakness: [],
               redundantSentences: []
            }
         };
      }

      /**
       * كشف الجمل التي تبدأ بحروف الجر
       * @private
       */
      _detectPrepositionStart(sentences) {
         if (!sentences || sentences.length === 0) {
            return { count: 0, examples: [] };
         }

         const examples = [];
         let count = 0;

         sentences.forEach(sentence => {
            // فحص إذا كانت الجملة تبدأ بحرف جر
            const startsWithPreposition = this.prepositionStartPatterns.some(
               pattern => pattern.test(sentence)
            );

            if (startsWithPreposition) {
               count++;
               if (examples.length < 3) {
                  examples.push(sentence.substring(0, 80) + (sentence.length > 80 ? '...' : ''));
               }
            }
         });

         return { count, examples };
      }

      /**
       * كشف ضعف السرد والأسلوب المطول
       * @private
       */
      _detectNarrativeWeakness(text) {
         if (!text || typeof text !== 'string') {
            return { count: 0, examples: [] };
         }

         const examples = [];
         let totalCount = 0;

         // فحص كل نمط من أنماط ضعف السرد
         this.narrativeWeaknessPatterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) {
               totalCount += matches.length;
               
               // إضافة أمثلة
               matches.slice(0, 3 - examples.length).forEach(match => {
                  if (examples.length < 3) {
                     // البحث عن الجملة الكاملة التي تحتوي على هذا النمط
                     const contextStart = Math.max(0, text.indexOf(match) - 20);
                     const contextEnd = Math.min(text.length, text.indexOf(match) + match.length + 60);
                     const context = text.substring(contextStart, contextEnd).trim();
                     examples.push(context + '...');
                  }
               });
            }
         });

         return { count: totalCount, examples };
      }

      /**
       * كشف التكرار والتشابه بين الجمل
       * @private
       */
      _detectRedundancy(sentences) {
         if (!sentences || sentences.length < 2) {
            return { count: 0, examples: [] };
         }

         const examples = [];
         let redundantCount = 0;

         // تصفية الجمل القصيرة
         const validSentences = sentences.filter(s => s.length >= this.redundancyMinLength);

         if (validSentences.length < 2) {
            return { count: 0, examples: [] };
         }

         // تطبيع الجمل للمقارنة
         const normalizedSentences = validSentences.map(s => this._normalizeSentence(s));

         // مقارنة كل جملة مع الجمل التالية فقط (تجنب O(n²) الكامل)
         for (let i = 0; i < validSentences.length - 1 && examples.length < 3; i++) {
            for (let j = i + 1; j < validSentences.length && examples.length < 3; j++) {
               const similarity = this._calculateSimilarity(
                  normalizedSentences[i],
                  normalizedSentences[j]
               );

               if (similarity >= this.redundancySimilarityThreshold) {
                  redundantCount++;
                  examples.push({
                     s1: validSentences[i].substring(0, 70) + (validSentences[i].length > 70 ? '...' : ''),
                     s2: validSentences[j].substring(0, 70) + (validSentences[j].length > 70 ? '...' : ''),
                     similarity: Math.round(similarity * 100)
                  });
               }
            }
         }

         return { count: redundantCount, examples };
      }

      /**
       * تطبيع الجملة للمقارنة (إزالة التشكيل والترقيم)
       * @private
       */
      _normalizeSentence(sentence) {
         return sentence
            // إزالة التشكيل
            .replace(/[\u064B-\u065F]/g, '')
            // إزالة علامات الترقيم
            .replace(/[.,،؛:;!؟?()[\]{}«»""'']/g, ' ')
            // توحيد المسافات
            .replace(/\s+/g, ' ')
            // تحويل إلى أحرف صغيرة (للغة الإنجليزية إن وجدت)
            .toLowerCase()
            .trim();
      }

      /**
       * حساب نسبة التشابه بين جملتين باستخدام Levenshtein Distance
       * @private
       */
      _calculateSimilarity(str1, str2) {
         if (!str1 || !str2) return 0;
         if (str1 === str2) return 1;

         const len1 = str1.length;
         const len2 = str2.length;

         // تجنب المعالجة على جمل طويلة جداً
         if (len1 > 500 || len2 > 500) {
            return this._simpleWordOverlap(str1, str2);
         }

         // حساب Levenshtein distance
         const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(0));

         for (let i = 0; i <= len1; i++) matrix[0][i] = i;
         for (let j = 0; j <= len2; j++) matrix[j][0] = j;

         for (let j = 1; j <= len2; j++) {
            for (let i = 1; i <= len1; i++) {
               const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
               matrix[j][i] = Math.min(
                  matrix[j - 1][i] + 1,      // deletion
                  matrix[j][i - 1] + 1,      // insertion
                  matrix[j - 1][i - 1] + cost // substitution
               );
            }
         }

         const distance = matrix[len2][len1];
         const maxLength = Math.max(len1, len2);
         return 1 - (distance / maxLength);
      }

      /**
       * حساب التشابه البسيط بناءً على تداخل الكلمات (للجمل الطويلة)
       * @private
       */
      _simpleWordOverlap(str1, str2) {
         const words1 = new Set(str1.split(/\s+/));
         const words2 = new Set(str2.split(/\s+/));

         let overlap = 0;
         words1.forEach(word => {
            if (words2.has(word)) overlap++;
         });

         const union = words1.size + words2.size - overlap;
         return union > 0 ? overlap / union : 0;
      }
   }

   // تصدير الوحدة
   window.QualityUltraMax = window.QualityUltraMax || {};
   window.QualityUltraMax.LanguageAnalyzer = LanguageAnalyzer;

})(window);
