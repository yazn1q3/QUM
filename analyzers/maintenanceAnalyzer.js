/**
 * maintenanceAnalyzer.js
 * محلل الصيانة والتصنيفات
 * يقيم حالة الصيانة والتنظيم التصنيفي
 */

(function(window) {
   'use strict';

   class MaintenanceAnalyzer {
      constructor() {
         this.maxScore = 20;
      }

      analyze(articleModel) {
         const results = {
            score: 0,
            details: {},
            notes: []
         };

         // 1. عد قوالب الصيانة
         const maintenanceTemplates = this._countMaintenanceTemplates(articleModel);
         results.details.maintenanceTemplates = maintenanceTemplates;

         // 2. عد التصنيفات (بدون التصنيفات المخفية)
         const categoriesData = this._countVisibleCategories(articleModel);
         results.details.categories = categoriesData.count;
         results.details.categoryList = categoriesData.list;
         results.details.maintenanceCategoryList = categoriesData.maintenanceList;
         results.details.categoryListSource = categoriesData.source;

         // 3. كشف قوالب محددة
         const specificTemplates = this._detectSpecificTemplates(articleModel);
         results.details.hasOrphanTemplate = specificTemplates.orphan;
         results.details.hasStubTemplate = specificTemplates.stub;
         results.details.hasCleanupTemplate = specificTemplates.cleanup;

         // سياق إضافي: عدد الأقسام (لضبط ضوضاء الملاحظات في المقالات الكبيرة)
         results.details.sectionCount = Array.isArray(articleModel.sections) ? articleModel.sections.length : 0;

         // 4. حساب النقاط
         results.score = this._calculateScore(results.details);

         // 5. الملاحظات
         results.notes = this._generateNotes(results.details);

         return results;
      }

      _countMaintenanceTemplates(articleModel) {
         if (!articleModel.$parsedContent || !articleModel.$parsedContent.length) {
            return 0;
         }
         
         // العثور على جميع قوالب الصيانة
         const $maintenanceBoxes = articleModel.$parsedContent.find(`
            .ambox,
            .cleanup,
            .mw-maintenance,
            .metadata
         `);
         
         // استثناء قوالب البذرة
         let count = 0;
         $maintenanceBoxes.each((i, box) => {
            const $box = $(box);
            const boxText = $box.text() || '';
            const boxHtml = $box.html() || '';
            
            // تجاهل إذا كان قالب بذرة
            const isStub = /بذرة|stub/i.test(boxText) || /بذرة|stub/i.test(boxHtml);
            if (!isStub) {
               count++;
            }
         });
         
         return count;
      }

      _countVisibleCategories(articleModel) {
         console.log('[MaintenanceAnalyzer] === بدء عد التصنيفات ===');
         console.log('[MaintenanceAnalyzer] allCategories exists?', !!articleModel.allCategories);
         console.log('[MaintenanceAnalyzer] allCategories is array?', Array.isArray(articleModel.allCategories));
         
         // استخدام البيانات من API مباشرة إذا كانت متوفرة
         if (Array.isArray(articleModel.allCategories) && articleModel.allCategories.length > 0) {
            console.log('[MaintenanceAnalyzer] استخدام allCategories من API');
            console.log('[MaintenanceAnalyzer] جميع التصنيفات:', articleModel.allCategories);
            
            const visibleCategories = [];
            const maintenanceCategories = [];
            
            articleModel.allCategories.forEach(c => {
               const isHidden = c.hidden === true || c.hidden === '';
               console.log(`[MaintenanceAnalyzer] تصنيف: "${c.name}", مخفي: ${isHidden}, قيمة hidden: ${JSON.stringify(c.hidden)}`);
               
               if (isHidden) {
                  maintenanceCategories.push(c.name);
               } else {
                  visibleCategories.push(c.name);
               }
            });
            
            console.log(`[MaintenanceAnalyzer] إجمالي التصنيفات: ${articleModel.allCategories.length}`);
            console.log(`[MaintenanceAnalyzer] التصنيفات الظاهرة: ${visibleCategories.length}`);
            console.log(`[MaintenanceAnalyzer] تصنيفات الصيانة: ${maintenanceCategories.length}`);
            console.log('[MaintenanceAnalyzer] قائمة الظاهرة:', visibleCategories);
            console.log('[MaintenanceAnalyzer] قائمة الصيانة:', maintenanceCategories);
            
            return {
               count: visibleCategories.length,
               list: visibleCategories,
               maintenanceList: maintenanceCategories,
               source: 'api'
            };
         }
         
         // احتياطي: إذا لم تكن البيانات متوفرة
         console.warn('[MaintenanceAnalyzer] استخدام categories الاحتياطية');
         console.log('[MaintenanceAnalyzer] categories:', articleModel.categories);
         
         if (!Array.isArray(articleModel.categories)) {
            return { count: 0, list: [], maintenanceList: [], source: 'fallback' };
         }
         
         return {
            count: articleModel.categories.length,
            list: articleModel.categories,
            maintenanceList: [],
            source: 'fallback'
         };
      }

      _detectSpecificTemplates(articleModel) {
         const templates = Array.isArray(articleModel.templates) ? articleModel.templates : [];
         return {
            orphan: templates.some(t => /يتيم|orphan/i.test(t)),
            stub: templates.some(t => /بذرة|stub/i.test(t)),
            cleanup: templates.some(t => /تنظيف|cleanup/i.test(t))
         };
      }

      _calculateScore(details) {
         let score = 0;

         // قوالب الصيانة (0-12)
         if (details.maintenanceTemplates === 0) score += 12;
         else if (details.maintenanceTemplates === 1) score += 8;
         else if (details.maintenanceTemplates === 2) score += 5;
         else if (details.maintenanceTemplates <= 4) score += 2;

         // التصنيفات (0-8)
         if (details.categories >= 5) score += 8;
         else if (details.categories >= 3) score += 6;
         else if (details.categories >= 1) score += 4;

         return Math.max(0, Math.min(this.maxScore, score));
      }

      _generateNotes(details) {
         const notes = [];

         if (details.maintenanceTemplates > 0) {
            notes.push(`🧹 المقالة تحتوي على ${details.maintenanceTemplates} قالب صيانة. يجب معالجة المشاكل المذكورة.`);
         }

         // لا نعرض ملاحظات التصنيفات إلا إذا كان مصدر العد موثوقًا (API)
         const categorySource = details.categoryListSource || details.categorySource || details.source || 'fallback';
         const isLargeBySections = (details.sectionCount || 0) >= 8;
         if (categorySource === 'api' && !isLargeBySections) {
            if (details.categories === 0) {
               notes.push('📂 المقالة غير مُصنفة. يجب إضافة تصنيفات مناسبة.');
            } else if (details.categories < 3) {
               notes.push('عدد التصنيفات قليل. يُفضل إضافة تصنيفات أكثر تحديدًا.');
            }
         }

         if (details.hasOrphanTemplate) {
            notes.push('المقالة يتيمة (لا توجد مقالات تشير إليها). يجب ربطها بمقالات أخرى.');
         }

         if (details.hasStubTemplate) {
            notes.push('🚧 المقالة في مرحلة البذرة. يجب توسيعها وإضافة أقسام منظمة.');
         }

         return notes;
      }
   }

   window.QualityUltraMax = window.QualityUltraMax || {};
   window.QualityUltraMax.MaintenanceAnalyzer = MaintenanceAnalyzer;

})(window);
