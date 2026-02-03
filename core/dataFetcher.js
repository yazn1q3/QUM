/**
 * dataFetcher.js
 * مسؤول عن جلب جميع البيانات من MediaWiki API
 * يوفر واجهة موحدة لجلب محتوى المقالة وبياناتها
 */

(function(window) {
   'use strict';

   class DataFetcher {
      constructor() {
         this.api = new mw.Api();
         this.cache = new Map();
      }

      /**
       * جلب المقدمة (القسم 0) بشكل منفصل
       * @param {string} pageTitle 
       * @returns {Promise<string>}
       */
      async fetchIntro(pageTitle) {
         const cacheKey = `intro_${pageTitle}`;
         if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
         }

         try {
            const result = await this.api.get({
               action: 'parse',
               page: pageTitle,
               prop: 'wikitext',
               section: 0,
               formatversion: 2
            });

            const wikitext = result?.parse?.wikitext || '';
            this.cache.set(cacheKey, wikitext);
            return wikitext;
         } catch (error) {
            console.warn('فشل جلب المقدمة:', error);
            return '';
         }
      }

      /**
       * جلب الصفحة الكاملة المحللة
       * @param {string} pageTitle 
       * @returns {Promise<Object>}
       */
      async fetchFullPage(pageTitle) {
         const cacheKey = `full_${pageTitle}`;
         if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
         }

         try {
            const result = await this.api.get({
               action: 'parse',
               page: pageTitle,
               prop: 'text|wikitext|sections|images|externallinks|categories|templates',
               disablelimitreport: 1,
               disableeditsection: 1,
               disabletoc: 1,
               formatversion: 2
            });

            const parsed = result?.parse || null;
            this.cache.set(cacheKey, parsed);
            return parsed;
         } catch (error) {
            console.error('فشل جلب الصفحة الكاملة:', error);
            return null;
         }
      }

      /**
       * جلب معلومات ويكي بيانات
       * @param {string} pageTitle
       * @returns {Promise<Object>}
       */
      async fetchWikidataInfo(pageTitle) {
         const cacheKey = `wikidata_${pageTitle}`;
         if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
         }

         try {
            const result = await this.api.get({
               action: 'query',
               titles: pageTitle,
               prop: 'pageprops|info',
               ppprop: 'wikibase_item',
               inprop: 'url',
               formatversion: 2
            });

            const page = result?.query?.pages?.[0];
            const wikidataInfo = {
               hasWikidataLink: false,
               wikidataItemId: null,
               canonicalUrl: null
            };

            if (page && !page.missing) {
               // معرف ويكي بيانات من pageprops
               if (page.pageprops && page.pageprops.wikibase_item) {
                  wikidataInfo.hasWikidataLink = true;
                  wikidataInfo.wikidataItemId = page.pageprops.wikibase_item;
               }
               
               // URL الكنسوني
               if (page.canonicalurl) {
                  wikidataInfo.canonicalUrl = page.canonicalurl;
               }
            }

            this.cache.set(cacheKey, wikidataInfo);
            return wikidataInfo;
         } catch (error) {
            console.error('[DataFetcher] فشل جلب معلومات ويكي بيانات:', error);
            return {
               hasWikidataLink: false,
               wikidataItemId: null,
               canonicalUrl: null
            };
         }
      }

      /**
       * جلب معلومات حماية الصفحة
       * @param {string} pageTitle
       * @returns {Promise<Object>}
       */
      async fetchPageProtection(pageTitle) {
         const cacheKey = `protection_${pageTitle}`;
         if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
         }

         try {
            const result = await this.api.get({
               action: 'query',
               titles: pageTitle,
               prop: 'info',
               inprop: 'protection',
               formatversion: 2
            });

            const page = result?.query?.pages?.[0];
            const protection = {
               hasProtection: false,
               protectionType: null,
               protectionLevel: null,
               protectionDetails: []
            };

            if (page && page.protection && page.protection.length > 0) {
               protection.hasProtection = true;
               protection.protectionDetails = page.protection.map(p => ({
                  type: p.type,
                  level: p.level,
                  expiry: p.expiry
               }));
               
               const editProtection = page.protection.find(p => p.type === 'edit');
               if (editProtection) {
                  protection.protectionType = 'edit';
                  protection.protectionLevel = editProtection.level;
                  protection.protectionExpiry = editProtection.expiry;
               }
            }

            this.cache.set(cacheKey, protection);
            return protection;
         } catch (error) {
            console.error('فشل جلب معلومات الحماية:', error);
            return {
               hasProtection: false,
               protectionType: null,
               protectionLevel: null,
               protectionDetails: []
            };
         }
      }

      /**
       * جلب قواعد الأخطاء النحوية
       * @returns {Promise<Array>}
       */
      async fetchGrammarRules() {
         const cacheKey = 'grammar_rules';
         if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
         }

         try {
            console.log('[DataFetcher] Fetching grammar rules from MediaWiki:Ar_gram_errors.json');
            
            const result = await this.api.get({
               action: 'query',
               prop: 'revisions',
               titles: 'MediaWiki:Ar_gram_errors.json',
               rvprop: 'content',
               rvslots: 'main',
               formatversion: 2
            });

            const page = result?.query?.pages?.[0];
            if (!page || page.missing || !page.revisions?.[0]) {
               console.warn('[DataFetcher] Could not fetch Ar_gram_errors.json, using defaults');
               return this.getDefaultGrammarRules();
            }

            const content = page.revisions[0].slots.main.content;
            console.log('[DataFetcher] Raw content length:', content.length);
            
            // محاولة تحليل JSON
            let rules;
            try {
               rules = JSON.parse(content);
            } catch (parseError) {
               console.warn('[DataFetcher] Failed to parse JSON:', parseError.message);
               return this.getDefaultGrammarRules();
            }
            
            // rules قد تكون Object أو Array
            let list = [];

            if (Array.isArray(rules)) {
               list = rules;
            } else if (typeof rules === "object" && rules !== null) {
               list = Object.values(rules);
            } else {
               console.warn('[DataFetcher] Invalid grammar rules format:', typeof rules);
               return this.getDefaultGrammarRules();
            }

            // معالجة القواعد وتحويلها إلى RegExp
            const processedRules = list.map((rule, index) => {
               try {
                  // التأكد من أن القاعدة لديها pattern
                  if (!rule.pattern && !rule[0]) {
                     return null;
                  }
                  
                  // إذا كانت القاعدة عبارة عن array [pattern, replacement, name]
                  if (Array.isArray(rule)) {
                     const [pattern, replacement, name] = rule;
                     
                     // إنشاء اسم وصفي للقاعدة
                     let ruleName = name;
                     if (!ruleName && replacement) {
                        // استخدام أول 30 حرف من النمط + الاستبدال
                        const patternPreview = String(pattern).substring(0, 30).replace(/[\\^$.*+?()[\]{}|]/g, '');
                        ruleName = `${patternPreview} → ${replacement}`;
                     }
                     if (!ruleName) {
                        ruleName = `نمط ${index + 1}`;
                     }
                     
                     return {
                        name: ruleName,
                        pattern: new RegExp(pattern, 'g'),
                        description: replacement ? `الصحيح: ${replacement}` : '',
                        suggestion: replacement || ''
                     };
                  }
                  
                  // إذا كانت القاعدة object
                  let ruleName = rule.name || rule.description;
                  if (!ruleName && rule.pattern) {
                     const patternPreview = String(rule.pattern).substring(0, 30).replace(/[\\^$.*+?()[\]{}|]/g, '');
                     ruleName = patternPreview || `نمط ${index + 1}`;
                  }
                  
                  return {
                     name: ruleName || `نمط ${index + 1}`,
                     pattern: new RegExp(rule.pattern, rule.flags || 'g'),
                     description: rule.description || rule.suggestion || '',
                     suggestion: rule.suggestion || rule.replacement || ''
                  };
               } catch (e) {
                  console.warn('[DataFetcher] Invalid grammar rule:', rule, e.message);
                  return null;
               }
            }).filter(Boolean);

            console.log('[DataFetcher] Processed grammar rules:', processedRules.length);
            
            if (processedRules.length === 0) {
               console.warn('[DataFetcher] No valid rules found, using defaults');
               return this.getDefaultGrammarRules();
            }

            this.cache.set(cacheKey, processedRules);
            return processedRules;
         } catch (error) {
            console.error('[DataFetcher] فشل جلب قواعد النحو:', error);
            return this.getDefaultGrammarRules();
         }
      }

      /**
       * جلب معلومات المراجعات (آخر 90 يوم)
       * @param {string} pageTitle 
       * @returns {Promise<Object>}
       */
      async fetchRevisionStats(pageTitle) {
         const cacheKey = `revisions_${pageTitle}`;
         if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
         }

         try {
            // حساب التواريخ (آخر 90 يوم)
            const now = new Date();
            const ninetyDaysAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
            
            // تنسيق التواريخ بصيغة ISO (MediaWiki يتطلب هذه الصيغة)
            const rvstart = now.toISOString();
            const rvend = ninetyDaysAgo.toISOString();

            console.log('[QUM DataFetcher] Fetching revision stats:', {
               pageTitle,
               rvstart,
               rvend
            });

            const result = await this.api.get({
               action: 'query',
               prop: 'revisions',
               titles: pageTitle,
               rvprop: 'timestamp|user|comment',
               rvlimit: 'max',
               rvstart: rvstart,
               rvend: rvend,
               formatversion: 2
            });

            console.log('[QUM DataFetcher] Revision API response:', result);

            const page = result?.query?.pages?.[0];
            if (!page || page.missing) {
               console.warn('[QUM DataFetcher] Page not found or missing');
               return { editCount: 0, uniqueEditors: 0, editors: [] };
            }

            const revisions = page.revisions || [];
            const editCount = revisions.length;
            
            // حساب المحررين الفريدين
            const editorsSet = new Set();
            revisions.forEach(rev => {
               if (rev.user) {
                  editorsSet.add(rev.user);
               }
            });

            const stats = {
               editCount: editCount,
               uniqueEditors: editorsSet.size,
               editors: Array.from(editorsSet),
               revisions: revisions
            };

            console.log('[QUM DataFetcher] Revision stats calculated:', {
               editCount: stats.editCount,
               uniqueEditors: stats.uniqueEditors
            });

            this.cache.set(cacheKey, stats);
            return stats;
         } catch (error) {
            console.error('[QUM DataFetcher] فشل جلب معلومات المراجعات:', error);
            // في حالة الفشل، نعيد null ليستخدم المحلل التقدير
            return null;
         }
      }

      /**
       * جلب wikitext الخام للصفحة (لكشف القوالب والمراجع)
       * @param {string} pageTitle 
       * @returns {Promise<string>}
       */
      async fetchRawWikitext(pageTitle) {
         const cacheKey = `raw_wikitext_${pageTitle}`;
         if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
         }

         try {
            console.log('[QUM DataFetcher] Fetching raw wikitext for:', pageTitle);
            
            const result = await this.api.get({
               action: 'query',
               prop: 'revisions',
               titles: pageTitle,
               rvprop: 'content',
               rvslots: 'main',
               formatversion: 2
            });

            const page = result?.query?.pages?.[0];
            if (!page || page.missing || !page.revisions?.[0]) {
               console.warn('[QUM DataFetcher] Could not fetch raw wikitext');
               return '';
            }

            const wikitext = page.revisions[0].slots.main.content || '';
            
            console.log('[QUM DataFetcher] Raw wikitext fetched:', {
               length: wikitext.length,
               hasTemplates: wikitext.includes('{{'),
               hasReferences: wikitext.includes('<ref')
            });
            
            this.cache.set(cacheKey, wikitext);
            return wikitext;
         } catch (error) {
            console.error('[QUM DataFetcher] Failed to fetch raw wikitext:', error);
            return '';
         }
      }

      /**
       * جلب جميع البيانات المطلوبة بشكل متوازي
       * @param {string} pageTitle 
       * @returns {Promise<Object>}
       */
      async fetchAll(pageTitle) {
         try {
            const [introWikitext, fullParse, grammarRules, revisionStats, rawWikitext, protectionInfo, wikidataInfo] = await Promise.all([
               this.fetchIntro(pageTitle),
               this.fetchFullPage(pageTitle),
               this.fetchGrammarRules(),
               this.fetchRevisionStats(pageTitle),
               this.fetchRawWikitext(pageTitle),
               this.fetchPageProtection(pageTitle),
               this.fetchWikidataInfo(pageTitle)
            ]);

            if (!fullParse) {
               throw new Error('فشل في جلب بيانات المقالة');
            }

            return {
               pageTitle,
               introWikitext,
               fullParse,
               grammarRules,
               revisionStats,
               rawWikitext,
               protectionInfo,
               wikidataInfo,
               fetchedAt: Date.now()
            };
         } catch (error) {
            console.error('خطأ في fetchAll:', error);
            throw error;
         }
      }

      /**
       * Backwards-compatible alias: fetch -> fetchAll
       * @param {string} pageTitle
       * @returns {Promise<Object>}
       */
      async fetch(pageTitle) {
         return this.fetchAll(pageTitle);
      }

      /**
       * قواعد نحوية افتراضية
       * @returns {Array}
       */
      getDefaultGrammarRules() {
         return [
            { name: 'خطأ إملائي: هاذا', pattern: /هاذا/g, description: 'يجب كتابة: هذا' },
            { name: 'خطأ إملائي: هاذه', pattern: /هاذه/g, description: 'يجب كتابة: هذه' },
            { name: 'خطأ إملائي: ذالك', pattern: /ذالك/g, description: 'يجب كتابة: ذلك' },
            { name: 'خطأ إملائي: لذالك', pattern: /لذالك/g, description: 'يجب كتابة: لذلك' },
            { name: 'خطأ إملائي: مسؤلية', pattern: /مسؤلية/g, description: 'يجب كتابة: مسؤولية' },
            { name: 'خطأ إملائي: إست', pattern: /إست(?!ان|قبل)/g, description: 'يجب كتابة: است' },
            { name: 'خطأ إملائي: الى', pattern: /\sالى\s/g, description: 'يجب كتابة: إلى' },
            { name: 'خطأ إملائي: حفض', pattern: /حفض/g, description: 'يجب كتابة: حفظ' },
            { name: 'خطأ إملائي: معضم', pattern: /معضم/g, description: 'يجب كتابة: معظم' },
            { name: 'تعبير عامي', pattern: /كده|كدا|كدة|علشان|عشان/g, description: 'تجنب التعبيرات العامية' },
            { name: 'حشو لغوي', pattern: /جداً جداً/g, description: 'تكرار غير ضروري' },
            { name: 'ترجمة ركيكة', pattern: /هو كان|كانت هي/g, description: 'صياغة ركيكة (ترجمة حرفية)' },
            { name: 'ترقيم خاطئ', pattern: / ,/g, description: 'لا توضع مسافة قبل الفاصلة' },
            { name: 'ترقيم زائد', pattern: /!!/g, description: 'علامة تعجب واحدة تكفي' }
         ];
      }

      /**
       * مسح الذاكرة المؤقتة
       */
      clearCache() {
         this.cache.clear();
      }
   }

   // تصدير للاستخدام العام
   window.QualityUltraMax = window.QualityUltraMax || {};
   window.QualityUltraMax.DataFetcher = DataFetcher;

})(window);
