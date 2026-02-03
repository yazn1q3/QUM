/**
 * main.js
 * Quality Ultra-Max v3.2 - المنسق الرئيسي
 * نظام تحليل جودة مقالات ويكيبيديا - عربي
 * v3.2: تحسينات كشف البذور وتخصيص الملاحظات حسب حجم المقالة
 */

(function(window, $, mw) {
   'use strict';

   // التأكد من وجود namespace
   window.QualityUltraMax = window.QualityUltraMax || {};
   window.QualityUltraMax.VERSION = '3.2';

   /**
    * المنسق الرئيسي لـ Quality Ultra-Max
    */
   class QualityUltraMaxOrchestrator {
      constructor() {
         console.log(`[QUM v${window.QualityUltraMax.VERSION}] Initializing orchestrator...`);
         this.modules = {
            dataFetcher: null,
            scoringEngine: null,
            analyzers: {},
            panelRenderer: null
         };
         
         this.isInitialized = false;
         this.isAnalyzing = false;
      }

      /**
       * تهيئة النظام
       */
      init() {
         if (this.isInitialized) {
            console.warn('[QUM] Already initialized');
            return;
         }

         // التحقق من المتطلبات
         if (!this._checkRequirements()) {
            console.error('[QUM] Requirements not met');
            return;
         }

         // تحميل الوحدات
         this._loadModules();

         // إضافة زر التشغيل
         this._injectButton();

         this.isInitialized = true;
         console.log('[QUM] Quality Ultra-Max v3 initialized ✓');
      }

      /**
       * التحقق من المتطلبات
       * @private
       */
      _checkRequirements() {
         const namespace = mw.config.get('wgNamespaceNumber');
         
         // السماح بالعمل في: المقالات (0) + صفحات المستخدم/الملاعب (2))
         var allowedNamespaces = [0, 2];
         if (!allowedNamespaces.includes(namespace)) {
            console.log('[QUM] Not in allowed namespaces (current: ' + namespace + ')');
            return false;
         }

         // التحقق من jQuery
         if (!$ || !$.fn) {
            console.error('[QUM] jQuery not available');
            return false;
         }

         // التحقق من mw.Api
         if (!mw || !mw.Api) {
            console.error('[QUM] MediaWiki API not available');
            return false;
         }

         console.log('[QUM] All requirements met ✓');
         console.log('[QUM] Page:', mw.config.get('wgPageName'));
         console.log('[QUM] Skin:', mw.config.get('skin'));
         
         return true;
      }

      /**
       * تحميل الوحدات
       * @private
       */
      _loadModules() {
         const QUM = window.QualityUltraMax;

         // Core modules
         this.modules.dataFetcher = new QUM.DataFetcher();
         this.modules.scoringEngine = new QUM.ScoringEngine();

         // Analyzers
         this.modules.analyzers = {
            media: new QUM.MediaAnalyzer(),
            reference: new QUM.ReferenceAnalyzer(),
            structure: new QUM.StructureAnalyzer(),
            link: new QUM.LinkAnalyzer(),
            grammar: new QUM.GrammarAnalyzer(),
            maintenance: new QUM.MaintenanceAnalyzer(),
            language: new QUM.LanguageAnalyzer(),
            revision: new QUM.RevisionAnalyzer(),
            wikidataIntegration: new QUM.WikidataIntegrationAnalyzer()
         };

         // UI
         this.modules.panelRenderer = new QUM.PanelRenderer();

         console.log('[QUM] All modules loaded ✓');
      }

      /**
       * إضافة زر التشغيل
       * @private
       */
      _injectButton() {
         const buttonHtml = `
            <li id="qum-button-container" class="mw-list-item">
               <a href="#" id="qum-analyze-btn" title="تحليل جودة المقالة">
                  <span>📊 تحليل الجودة</span>
               </a>
            </li>
         `;

         let injected = false;

         // Vector 2022
         if ($('#p-views ul').length) {
            $('#p-views ul').append(buttonHtml);
            injected = true;
            console.log('[QUM] Button injected into #p-views (Vector 2022)');
         }
         // Vector 2010 / Legacy
         else if ($('#p-cactions ul').length) {
            $('#p-cactions ul').append(buttonHtml);
            injected = true;
            console.log('[QUM] Button injected into #p-cactions (Vector Legacy)');
         }
         // Fallback 1
         else if ($('.vector-menu-content-list').first().length) {
            $('.vector-menu-content-list').first().append(buttonHtml);
            injected = true;
            console.log('[QUM] Button injected into .vector-menu-content-list');
         }
         // Fallback 2 - Monobook
         else if ($('#p-cactions').length) {
            $('<li id="qum-button-container" class="mw-list-item"><a href="#" id="qum-analyze-btn" title="تحليل جودة المقالة">📊 تحليل الجودة</a></li>')
               .appendTo('#p-cactions ul, #p-cactions');
            injected = true;
            console.log('[QUM] Button injected into #p-cactions (Monobook)');
         }
         // Fallback 3 - Any page actions
         else if ($('#ca-history').length) {
            $('<li id="qum-button-container" class="mw-list-item"><a href="#" id="qum-analyze-btn" title="تحليل جودة المقالة">📊 تحليل الجودة</a></li>')
               .insertAfter('#ca-history');
            injected = true;
            console.log('[QUM] Button injected after #ca-history');
         }

         if (!injected) {
            console.error('[QUM] Failed to inject button - no suitable container found');
            console.log('[QUM] Available containers:', {
               'p-views': $('#p-views').length,
               'p-cactions': $('#p-cactions').length,
               'vector-menu': $('.vector-menu-content-list').length,
               'ca-history': $('#ca-history').length
            });
            return;
         }

         // ربط الحدث
         $('#qum-analyze-btn').on('click', (e) => {
            e.preventDefault();
            this.analyze();
         });

         console.log('[QUM] Button injected and event bound ✓');
      }

      /**
       * بدء التحليل
       */
      async analyze() {
    if (this.isAnalyzing) {
        mw.notify('التحليل قيد التنفيذ...', { type: 'warn' });
        return;
    }

    this.isAnalyzing = true;
    const $button = $('#qum-analyze-btn span');
    const originalText = $button.text();

    try {
        // تحديث نص الزر
        $button.text('⏳ جارٍ التحليل...');

        // عرض مؤشر التقدم
        this._showProgressIndicator();
        
        // رسالة خاصة لصفحات المستخدم/الملاعب
        const namespace = mw.config.get('wgNamespaceNumber');
        if (namespace === 2) {
           this._updateProgress('📝 تحليل مسودة في الملعب... جارٍ جمع البيانات', 10);
        } else {
           this._updateProgress('جارٍ جمع بيانات المقالة...', 10);
        }

        // الخطوة 1: جمع البيانات
        const pageTitle = mw.config.get('wgPageName');
        const data = await this.modules.dataFetcher.fetchAll(pageTitle);

        // تحديث المؤشر
        this._updateProgress('تم جمع البيانات، جارٍ بناء نموذج المقالة...', 25);

        // الخطوة 2: بناء نموذج المقالة
        console.log('[QUM] Building article model with data:', {
            hasFullParse: !!data.fullParse,
            hasIntro: !!data.introWikitext,
            pageTitle: data.pageTitle
        });
        
        const articleModel = new window.QualityUltraMax.UnifiedArticleModel(data);
        
        console.log('[QUM] Article model created:', {
            sections: articleModel.sections?.length || 0,
            images: articleModel.images?.length || 0,
            categories: articleModel.categories?.length || 0,
            templates: articleModel.templates?.length || 0,
            articleLength: articleModel.articleLength,
            hasParsedContent: !!(articleModel.$parsedContent && articleModel.$parsedContent.length)
        });

        this._updateProgress('جارٍ تحليل المقالة...', 40);

        // الخطوة 3: تشغيل المحللات
        const analysisResults = await this._runAnalyzers(articleModel);

        this._updateProgress('جارٍ حساب النتيجة النهائية...', 85);

        // الخطوة 4: حساب النتيجة النهائية
        console.log('[QUM] Calculating final score...');
        console.log('[QUM] Analysis results:', Object.keys(analysisResults));
        
        const finalResult = this.modules.scoringEngine.calculateFinalScore(analysisResults);
        console.log('[QUM] Final score calculated:', finalResult.total);
        
        // التحقق من صحة النتيجة
        if (!finalResult || typeof finalResult.total !== 'number') {
            throw new Error('نتيجة التقييم غير صالحة');
        }

        this._updateProgress('جارٍ عرض النتائج...', 95);

        // الخطوة 5: عرض النتائج
        console.log('[QUM] Rendering panel...');
        console.log('[QUM] Final result structure:', {
            total: finalResult.total,
            level: finalResult.level,
            hasScores: !!finalResult.scores,
            hasDetails: !!finalResult.details,
            notesCount: Array.isArray(finalResult.notes) ? finalResult.notes.length : 0
        });
        
        this.modules.panelRenderer.render(finalResult);
        console.log('[QUM] Panel rendered successfully');

        this._updateProgress('تم التحليل بنجاح ✓', 100);

        // إخفاء المؤشر بعد ثانية
        setTimeout(() => this._hideProgressIndicator(), 1000);

        console.log('[QUM] Analysis complete:', finalResult);

        } catch (error) {
            console.error('[QUM] Analysis error:', error);

            this._updateProgress('❌ حدث خطأ: ' + error.message, 0, true);
            
            setTimeout(() => this._hideProgressIndicator(), 3000);

        } finally {
            this.isAnalyzing = false;
            $button.text(originalText);
        }
    }


      /**
       * عرض مؤشر التقدم
       * @private
       */
      _showProgressIndicator() {
         // إزالة المؤشر القديم إن وجد
         $('#qum-progress-indicator').remove();

         const $indicator = $('<div>')
            .attr('id', 'qum-progress-indicator')
            .addClass('qum-progress-indicator')
            .html(`
               <div class="qum-progress-box">
                  <div class="qum-progress-header">
                     <span class="qum-progress-icon">⚙️</span>
                     <span class="qum-progress-title">تحليل جودة المقالة</span>
                  </div>
                  <div class="qum-progress-text">جارٍ التحضير...</div>
                  <div class="qum-progress-bar-container">
                     <div class="qum-progress-bar" style="width: 0%"></div>
                  </div>
                  <div class="qum-progress-percentage">0%</div>
               </div>
            `);

         $('body').append($indicator);
         
         // إضافة الأنماط إن لم تكن موجودة
         if (!$('#qum-progress-styles').length) {
            this._injectProgressStyles();
         }
      }

      /**
       * تحديث مؤشر التقدم
       * @private
       */
      _updateProgress(text, percentage, isError = false) {
         const $indicator = $('#qum-progress-indicator');
         if (!$indicator.length) return;

         $indicator.find('.qum-progress-text').text(text);
         $indicator.find('.qum-progress-bar').css('width', percentage + '%');
         $indicator.find('.qum-progress-percentage').text(Math.round(percentage) + '%');
         
         const $bar = $indicator.find('.qum-progress-bar');
         $bar.removeClass('qum-progress-error');
         
         if (isError) {
            $bar.addClass('qum-progress-error');
         } else if (percentage === 100) {
            $bar.css('background', 'linear-gradient(90deg, #10b981 0%, #059669 100%)');
         }
      }

      /**
       * إخفاء مؤشر التقدم
       * @private
       */
      _hideProgressIndicator() {
         $('#qum-progress-indicator').fadeOut(400, function() {
            $(this).remove();
         });
      }

      /**
       * إضافة أنماط مؤشر التقدم
       * @private
       */
      _injectProgressStyles() {
         const styles = `
            <style id="qum-progress-styles">
               .qum-progress-indicator {
                  position: fixed;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);
                  z-index: 999999;
                  animation: qum-fade-in 0.3s ease-in-out;
               }

               @keyframes qum-fade-in {
                  from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
                  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
               }

               .qum-progress-box {
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  padding: 25px 30px;
                  border-radius: 12px;
                  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                  min-width: 400px;
                  color: white;
               }

               .qum-progress-header {
                  display: flex;
                  align-items: center;
                  gap: 10px;
                  margin-bottom: 15px;
               }

               .qum-progress-icon {
                  font-size: 24px;
                  animation: qum-spin 2s linear infinite;
               }

               @keyframes qum-spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
               }

               .qum-progress-title {
                  font-size: 18px;
                  font-weight: bold;
               }

               .qum-progress-text {
                  font-size: 14px;
                  margin-bottom: 12px;
                  opacity: 0.95;
                  min-height: 20px;
               }

               .qum-progress-bar-container {
                  background: rgba(255, 255, 255, 0.2);
                  border-radius: 10px;
                  height: 20px;
                  overflow: hidden;
                  margin-bottom: 8px;
               }

               .qum-progress-bar {
                  height: 100%;
                  background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
                  border-radius: 10px;
                  transition: width 0.4s ease-out, background 0.3s ease;
                  box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
               }

               .qum-progress-bar.qum-progress-error {
                  background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%) !important;
               }

               .qum-progress-percentage {
                  text-align: center;
                  font-size: 14px;
                  font-weight: bold;
                  opacity: 0.9;
               }
            </style>
         `;

         $('head').append(styles);
      }

      /**
       * تشغيل جميع المحللات
       * @private
       */
      async _runAnalyzers(articleModel) {
         const results = {};
         const totalAnalyzers = 9;
         let completedAnalyzers = 0;

         const updateAnalyzerProgress = (analyzerName) => {
            completedAnalyzers++;
            const progress = 40 + (completedAnalyzers / totalAnalyzers) * 40; // 40% to 80%
            this._updateProgress(`تحليل ${analyzerName}... (${completedAnalyzers}/${totalAnalyzers})`, progress);
         };

         // تشغيل المحللات
         try {
            console.log('[QUM] Running analyzers...');
            
            try {
               results.mediaAnalysis = this.modules.analyzers.media?.analyze(articleModel) || { score: 0, details: {}, notes: [] };
               updateAnalyzerProgress('الوسائط');
               console.log('[QUM] ✓ Media analyzer complete');
            } catch (e) {
               console.error('[QUM] ✗ Media analyzer failed:', e);
               results.mediaAnalysis = { score: 0, details: {}, notes: ['خطأ في تحليل الوسائط'] };
               updateAnalyzerProgress('الوسائط');
            }
            
            try {
               results.referenceAnalysis = this.modules.analyzers.reference?.analyze(articleModel) || { score: 0, details: {}, notes: [] };
               updateAnalyzerProgress('المراجع');
               console.log('[QUM] ✓ Reference analyzer complete');
            } catch (e) {
               console.error('[QUM] ✗ Reference analyzer failed:', e);
               results.referenceAnalysis = { score: 0, details: {}, notes: ['خطأ في تحليل المراجع'] };
               updateAnalyzerProgress('المراجع');
            }
            
            try {
               results.structureAnalysis = this.modules.analyzers.structure?.analyze(articleModel) || { score: 0, details: {}, notes: [] };
               updateAnalyzerProgress('البنية');
               console.log('[QUM] ✓ Structure analyzer complete');
            } catch (e) {
               console.error('[QUM] ✗ Structure analyzer failed:', e);
               results.structureAnalysis = { score: 0, details: {}, notes: ['خطأ في تحليل البنية'] };
               updateAnalyzerProgress('البنية');
            }
            
            try {
               results.linkAnalysis = this.modules.analyzers.link?.analyze(articleModel) || { score: 0, details: {}, notes: [] };
               updateAnalyzerProgress('الروابط');
               console.log('[QUM] ✓ Link analyzer complete');
            } catch (e) {
               console.error('[QUM] ✗ Link analyzer failed:', e);
               results.linkAnalysis = { score: 0, details: {}, notes: ['خطأ في تحليل الروابط'] };
               updateAnalyzerProgress('الروابط');
            }
            
            try {
               results.grammarAnalysis = this.modules.analyzers.grammar?.analyze(articleModel) || { score: 0, details: {}, notes: [] };
               updateAnalyzerProgress('النحو');
               console.log('[QUM] ✓ Grammar analyzer complete');
            } catch (e) {
               console.error('[QUM] ✗ Grammar analyzer failed:', e);
               results.grammarAnalysis = { score: 0, details: {}, notes: ['خطأ في تحليل النحو'] };
               updateAnalyzerProgress('النحو');
            }
            
            try {
               results.maintenanceAnalysis = this.modules.analyzers.maintenance?.analyze(articleModel) || { score: 0, details: {}, notes: [] };
               updateAnalyzerProgress('الصيانة');
               console.log('[QUM] ✓ Maintenance analyzer complete');
            } catch (e) {
               console.error('[QUM] ✗ Maintenance analyzer failed:', e);
               results.maintenanceAnalysis = { score: 0, details: {}, notes: ['خطأ في تحليل الصيانة'] };
               updateAnalyzerProgress('الصيانة');
            }
            
            try {
               results.languageAnalysis = this.modules.analyzers.language?.analyze(articleModel) || { score: 0, details: {}, notes: [] };
               updateAnalyzerProgress('اللغة');
               console.log('[QUM] ✓ Language analyzer complete');
            } catch (e) {
               console.error('[QUM] ✗ Language analyzer failed:', e);
               results.languageAnalysis = { score: 0, details: {}, notes: ['خطأ في التحليل اللغوي'] };
               updateAnalyzerProgress('اللغة');
            }
            
            // تحليل استقرار المقالة والمراجعات
            try {
               results.revisionAnalysis = this.modules.analyzers.revision?.analyze(
                  articleModel,
                  articleModel.rawData,
                  articleModel.$parsedContent
               ) || { score: 0, details: {}, notes: [] };
               updateAnalyzerProgress('المراجعات');
               console.log('[QUM] ✓ Revision analyzer complete');
            } catch (e) {
               console.error('[QUM] ✗ Revision analyzer failed:', e);
               results.revisionAnalysis = { score: 0, details: {}, notes: ['خطأ في تحليل المراجعات'] };
               updateAnalyzerProgress('المراجعات');
            }
            
            // تحليل تكامل ويكي بيانات والمشاريع الشقيقة
            try {
               results.wikidataIntegrationAnalysis = this.modules.analyzers.wikidataIntegration?.analyze(
                  articleModel,
                  articleModel.rawData,
                  articleModel.$parsedContent
               ) || { score: 0, details: {}, notes: [] };
               updateAnalyzerProgress('ويكي بيانات');
               console.log('[QUM] ✓ Wikidata analyzer complete');
            } catch (e) {
               console.error('[QUM] ✗ Wikidata analyzer failed:', e);
               results.wikidataIntegrationAnalysis = { score: 0, details: {}, notes: ['خطأ في تحليل ويكي بيانات'] };
               updateAnalyzerProgress('ويكي بيانات');
            }

         } catch (error) {
            console.error('[QUM] Analyzer error:', error);
            throw new Error('فشل تشغيل المحللات: ' + error.message);
         }

         return results;
      }

      /**
       * إعادة تهيئة
       */
      reset() {
         this.isInitialized = false;
         this.isAnalyzing = false;
         $('#qum-button-container').remove();
         $('#qum-styles').remove();
         console.log('[QUM] Reset complete');
      }
   }

   /**
    * التحقق من تحميل جميع الوحدات المطلوبة
    */
   function areAllModulesLoaded() {
      const QUM = window.QualityUltraMax || {};
      const required = [
         'DataFetcher',
         'ScoringEngine',
         'MediaAnalyzer',
         'ReferenceAnalyzer',
         'StructureAnalyzer',
         'LinkAnalyzer',
         'GrammarAnalyzer',
         'MaintenanceAnalyzer',
         'LanguageAnalyzer',
         'RevisionAnalyzer',
         'WikidataIntegrationAnalyzer',
         'PanelRenderer'
      ];

      const missing = required.filter(module => !QUM[module]);
      
      if (missing.length > 0) {
         console.log('[QUM] Waiting for modules:', missing.join(', '));
         return false;
      }

      // Check for ArticleModel
      if (!QUM.UnifiedArticleModel && !QUM.ArticleModel) {
         console.log('[QUM] Waiting for ArticleModel');
         return false;
      }

      return true;
   }

   /**
    * محاولة التهيئة
    */
   function tryInitialize() {
      // السماح بالعمل في: المقالات (0) + صفحات المستخدم/الملاعب (2)
      const namespace = mw.config.get('wgNamespaceNumber');
      const allowedNamespaces = [0, 2];
      if (!allowedNamespaces.includes(namespace)) {
         console.log('[QUM] Not in allowed namespaces (NS=' + namespace + ')');
         return false;
      }

      // إذا كان النطاق 2 (صفحة مستخدم)، تحقق من أن الاسم يحتوي على "ملعب"
      if (namespace === 2) {
         const pageName = mw.config.get('wgPageName') || '';
         const pageTitle = mw.config.get('wgTitle') || '';
         
         // كلمات مفتاحية تدل على صفحة ملعب/مسودة
         const sandboxKeywords = ['ملعب', 'ملعبي', 'sandbox', 'draft', 'مسودة'];
         
         // تحقق من وجود أي من الكلمات المفتاحية في العنوان
         const isSandbox = sandboxKeywords.some(keyword => {
            return pageName.toLowerCase().includes(keyword.toLowerCase()) ||
                   pageTitle.toLowerCase().includes(keyword.toLowerCase());
         });
         
         if (!isSandbox) {
            console.log('[QUM] User namespace page is not a sandbox/draft page. Tool disabled.');
            console.log('[QUM] Page name:', pageName);
            return false;
         }
         
         console.log('[QUM] ✓ Sandbox/draft page detected in user namespace');
      }

      if (!areAllModulesLoaded()) {
         return false;
      }

      // تجنب التهيئة المتكررة
      if (window.QualityUltraMax.Orchestrator) {
         console.log('[QUM] Already initialized');
         return true;
      }

      console.log('[QUM] All modules loaded. Initializing...');
      
      try {
         const orchestrator = new QualityUltraMaxOrchestrator();
         orchestrator.init();

         // تصدير للوصول الخارجي
         window.QualityUltraMax.Orchestrator = orchestrator;
         console.log('[QUM] Initialization complete ✓');
         return true;
      } catch (error) {
         console.error('[QUM] Initialization error:', error);
         return false;
      }
   }

   /**
    * Bootloader: use mw.loader with polling mechanism
    */
   mw.loader.using(['mediawiki.api', 'mediawiki.util']).then(function() {
      console.log('[QUM] MediaWiki dependencies loaded');

      // محاولة التهيئة الفورية
      if (tryInitialize()) {
         return;
      }

      // إذا فشلت، نستخدم polling
      let attempts = 0;
      const maxAttempts = 30; // 30 * 500ms = 15 seconds

      const pollInterval = setInterval(function() {
         attempts++;
         
         if (tryInitialize()) {
            clearInterval(pollInterval);
            return;
         }

         if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            console.error('[QUM] Failed to initialize after', attempts, 'attempts');
            console.error('[QUM] Some modules may not have loaded correctly');
         }
      }, 500);

      // أيضاً نستمع لـ hook كخطة احتياطية
      mw.hook('wikipage.content').add(function() {
         setTimeout(tryInitialize, 100);
      });

   }).catch(function(err) {
      console.error('[QUM] Failed to load required MediaWiki modules:', err);
   });

})(window, jQuery, mediaWiki);
