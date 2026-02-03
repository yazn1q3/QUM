/**
 * grammarAnalyzer.js
 * محلل اللغة والأخطاء النحوية
 * يستخدم قواعد المجتمع لكشف الأخطاء اللغوية
 */

(function(window) {
   'use strict';

   class GrammarAnalyzer {
      constructor() {
         this.maxScore = 5; // جزء من نقاط البنية
      }

      analyze(articleModel) {
         const results = {
            score: 0,
            details: {},
            notes: []
         };

         const firstParagraphs = this._getFirstParagraphs(articleModel, 3);
         const grammarRules = Array.isArray(articleModel.grammarRules) ? articleModel.grammarRules : [];
         
         console.log('[GrammarAnalyzer] Text length:', firstParagraphs.length, 'Rules count:', grammarRules.length);
         
         const errors = this._detectErrors(firstParagraphs, grammarRules);

         console.log('[GrammarAnalyzer] Detected errors:', errors.length);
         if (errors.length > 0) {
            console.log('[GrammarAnalyzer] Sample errors:', errors.slice(0, 3));
         }

         results.details.errorCount = errors.length;
         results.details.errors = errors; // حفظ جميع الأخطاء

         const templates = Array.isArray(articleModel.templates) ? articleModel.templates : [];
         const hasTranslationTemplate = templates.some(t => 
            t.includes('ترجمة آلية') || t.includes('Translated')
         );
         results.details.hasTranslationTemplate = hasTranslationTemplate;

         // حساب النقاط
         let score = this.maxScore;

         if (errors.length === 0) {
            score = this.maxScore;
         } else if (errors.length <= 2) {
            score = 3;
         } else if (errors.length <= 5) {
            score = 2;
         } else if (errors.length <= 10) {
            score = 1;
         } else {
            score = 0;
         }

         if (hasTranslationTemplate) {
            score -= 2;
         }

         results.score = Math.max(0, Math.min(this.maxScore, score));

         // حفظ تفاصيل الأخطاء في details (لا داعي للتكرار - محذوف)
         // results.details.errors = errors;
         // results.details.errorCount = errors.length;

         // الملاحظات
         if (errors.length > 0) {
            results.notes.push(`📝 تم رصد ${errors.length} خطأ لغوي محتمل في بداية المقال. يُستحسن المراجعة اللغوية.`);
         }

         if (hasTranslationTemplate) {
            results.notes.push('⚠️ المقالة تحتوي على قالب ترجمة آلية. يجب مراجعتها وتحسين الصياغة.');
         }

         return results;
      }

      _getFirstParagraphs(articleModel, count) {
         let result = '';
         let found = 0;

         if (!articleModel.$parsedContent || !articleModel.$parsedContent.length) {
            return result;
         }

         articleModel.$parsedContent.find('p').each(function() {
            const txt = $(this).text().trim();
            if (txt.length >= 30) {
               result += ' ' + txt;
               found++;
            }
            if (found >= count) {
               return false;
            }
         });

         return result;
      }

      _detectErrors(text, rules) {
         const errors = [];
         const MAX_ERRORS_PER_RULE = 3; // حد أقصى لكل قاعدة (مخفض)
         const MAX_TOTAL_ERRORS = 20; // حد أقصى إجمالي (مخفض)

         if (!Array.isArray(rules) || !text || text.length < 50) {
            console.log('[GrammarAnalyzer] Skipping - insufficient text or rules');
            return errors;
         }

         const seenMatches = new Set(); // لتجنب التكرار

         rules.forEach(rule => {
            if (!rule || !rule.pattern) {
               return;
            }

            try {
               const matches = text.match(rule.pattern);
               if (matches && matches.length > 0) {
                  // حد أقصى لكل قاعدة لتجنب التكرار المفرط
                  const limitedMatches = matches.slice(0, MAX_ERRORS_PER_RULE);
                  
                  limitedMatches.forEach(match => {
                     // تنظيف النص المطابق
                     const cleanMatch = match.trim();
                     
                     // تخطي المطابقات الفارغة أو القصيرة جداً
                     if (!cleanMatch || cleanMatch.length === 0) {
                        return;
                     }
                     
                     // تجنب إضافة نفس النص المطابق مرتين
                     const matchKey = `${rule.name || rule.description}_${cleanMatch}`;
                     
                     if (!seenMatches.has(matchKey) && errors.length < MAX_TOTAL_ERRORS) {
                        seenMatches.add(matchKey);
                        
                        // البحث عن سياق أوسع للكلمة (20 حرف قبل و20 بعد)
                        const matchIndex = text.indexOf(match);
                        const contextStart = Math.max(0, matchIndex - 20);
                        const contextEnd = Math.min(text.length, matchIndex + match.length + 20);
                        const context = text.substring(contextStart, contextEnd).trim();
                        
                        errors.push({
                           rule: rule.name || rule.description || 'خطأ لغوي',
                           match: cleanMatch,
                           context: context.length > 0 ? context : cleanMatch,
                           description: rule.description || rule.name || 'خطأ لغوي',
                           suggestion: rule.suggestion || 'يرجى المراجعة'
                        });
                     }
                  });
               }
            } catch (error) {
               console.warn('[GrammarAnalyzer] Invalid rule pattern:', rule.name);
            }
         });

         console.log('[GrammarAnalyzer] Final errors count:', errors.length);
         return errors;
      }
   }

   window.QualityUltraMax = window.QualityUltraMax || {};
   window.QualityUltraMax.GrammarAnalyzer = GrammarAnalyzer;

})(window);
