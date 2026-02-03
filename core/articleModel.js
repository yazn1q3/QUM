/**
 * articleModel.js
 * نموذج موحد للمقالة يجمع كل البيانات من DOM و API
 * يوفر واجهة قياسية لجميع المحللات
 */

(function(window) {
   'use strict';

   class UnifiedArticleModel {
      constructor(rawData) {
            // Validate input
            if (!rawData || typeof rawData !== 'object') {
               console.error('[QUM ArticleModel] Invalid rawData provided:', rawData);
               throw new Error('Invalid article data');
            }

            // احتفظ بالبيانات الخام لعمليات المحللات التي تحتاجها
            this.rawData = rawData;
         this.title = rawData.pageTitle || '';
         this.introWikitext = rawData.introWikitext || '';

         // handle different shapes returned by MediaWiki parse API
         // `text` may be a string or an object like {"*": "..."}
         const fullParse = rawData.fullParse || {};
         // parse.text may be a string or an object with a '*' key
         this.html = (typeof fullParse.text === 'string') ? fullParse.text : ((fullParse.text && fullParse.text['*']) || '');

         // استخدام rawWikitext (الكود الخام الكامل) إذا كان متاحاً، وإلا استخدم wikitext من parse API
         this.wikitext = rawData.rawWikitext || 
                        (typeof fullParse.wikitext === 'string') ? fullParse.wikitext : 
                        (fullParse.wikitext && fullParse.wikitext['*']) || '';

         this.sections = Array.isArray(fullParse.sections) ? fullParse.sections : [];
         this.images = Array.isArray(fullParse.images) ? fullParse.images : [];
         this.externallinks = Array.isArray(fullParse.externallinks) ? fullParse.externallinks : [];

         // categories and templates may come in different shapes; be defensive
         const categoriesArray = Array.isArray(fullParse.categories) ? fullParse.categories : [];
         
         // تخزين جميع التصنيفات مع معلومة الإخفاء
         this.allCategories = categoriesArray.map(c => {
            if (!c) return null;
            return {
               name: c.category || c.title || c['*'] || String(c),
               hidden: c.hidden !== undefined ? c.hidden : false
            };
         }).filter(c => c && c.name);
         
         // للتوافق مع الكود القديم: قائمة أسماء التصنيفات فقط
         this.categories = this.allCategories.map(c => c.name);

         const templatesArray = Array.isArray(fullParse.templates) ? fullParse.templates : [];
         this.templates = templatesArray.map(t => {
            if (!t) return '';
            return t.title || t['*'] || String(t);
         }).filter(Boolean);
         this.grammarRules = Array.isArray(rawData.grammarRules) ? rawData.grammarRules : [];
         
         // إنشاء DOM محلل
         this.$parsedContent = this._normalizeContent(this.html);
         
         // استخراج عناصر DOM المهمة
         this._extractDOMElements();
         
         // تنظيف النص
         this.cleanIntroText = this._extractCleanIntro();
         this.fullText = (this.$parsedContent && this.$parsedContent.length) ? this.$parsedContent.text() : '';
         this.articleLength = (this.fullText || '').trim().length;
         
         // حساب طول wikitext الفعلي (أكثر دقة من articleLength)
         this.wikitextLength = (this.wikitext || '').trim().length;
      }

      /**
       * تطبيع المحتوى وتغليفه في .mw-parser-output
       * @private
       */
      _normalizeContent(html) {
         if (!html || !window.$ || !$.fn) {
            console.warn('[QUM ArticleModel] jQuery not available or no HTML content');
            return $('<div class="mw-parser-output"></div>');
         }

         try {
            const $temp = $('<div>').html(html);
            let $content = $temp.find('.mw-parser-output').first();

            if (!$content.length) {
               $content = $('<div class="mw-parser-output"></div>').html(html);
            }

            return $content;
         } catch (error) {
            console.error('[QUM ArticleModel] Error normalizing content:', error);
            return $('<div class="mw-parser-output"></div>');
         }
      }

      /**
       * استخراج عناصر DOM المهمة
       * @private
       */
      _extractDOMElements() {
         if (!this.$parsedContent || !this.$parsedContent.length) {
            this.$infobox = $('<div>');
            this.$articleBody = $('<div>');
            this.$referencesSection = $('<ol>');
            return;
         }

         // صندوق المعلومات
         this.$infobox = this.$parsedContent.find('.infobox').first();
         
         // محتوى المقالة النظيف (بدون عناصر جانبية)
         this.$articleBody = this._getCleanArticleBody();
         
         // قسم المراجع
         this.$referencesSection = this.$parsedContent.find('ol.references');
      }

      /**
       * الحصول على محتوى المقالة النظيف
       * @private
       */
      _getCleanArticleBody() {
         if (!this.$parsedContent || !this.$parsedContent.length) {
            return $('<div>');
         }

         const $clone = this.$parsedContent.clone();
         
         // إزالة العناصر غير المقالية
         $clone.find(`
            .infobox,
            .navbox,
            .vertical-navbox,
            .sidebar,
            .sistersitebox,
            .mbox-small,
            .metadata,
            .ambox,
            .tmbox,
            .catlinks,
            .noprint,
            .mw-authority-control,
            .navbox-styles,
            table[role="navigation"],
            table[role="presentation"],
            .toc,
            .hatnote,
            .dablink,
            .reflist,
            #coordinates
         `).remove();

         // إزالة المحتوى بعد قسم المراجع
         const $refsHeading = $clone.find('h2').filter(function() {
            const text = $(this).text();
            return /مراجع|references|مصادر|ملاحظات|الهوامش|وصلات خارجية|external links/i.test(text);
         }).first();

         if ($refsHeading.length > 0) {
            $refsHeading.nextAll().remove();
            $refsHeading.remove();
         }

         return $clone;
      }

      /**
       * استخراج نص المقدمة النظيف
       * @private
       */
      _extractCleanIntro() {
         if (this.introWikitext) {
            let text = this.introWikitext;

            // إزالة التعليقات
            text = text.replace(/<!--[\s\S]*?-->/g, '');

            // إزالة القوالب بشكل تكراري (معالجة أفضل للقوالب المتداخلة)
            text = this._removeNestedTemplates(text);

            // إزالة الروابط الخارجية
            text = text.replace(/\[https?:\/\/[^\]]+\]/g, '');

            // إزالة الروابط الداخلية والحفاظ على النص
            text = text.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1');

            // إزالة المراجع
            text = text.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
            text = text.replace(/<ref[^>]*\/>/gi, '');

            // إزالة وسوم HTML
            text = text.replace(/<[^>]+>/g, '');

            // إزالة التنسيقات
            text = text.replace(/'{2,5}([^']+)'{2,5}/g, '$1');

            // إزالة أوامر خاصة
            text = text.replace(/__[A-Z]+__/g, '');

            // تنظيف المسافات
            text = text.replace(/\s+/g, ' ').trim();

            return text;
         }

         // احتياطي: استخراج من HTML
         if (!this.$parsedContent || !this.$parsedContent.length) {
            return '';
         }

         let introText = '';
         this.$parsedContent.find('> p, > div > p').each(function() {
            const $p = $(this);
            
            // تجاهل الفقرات في العناصر الجانبية
            if ($p.closest('.infobox, .navbox, .sidebar, .metadata, .ambox, .hatnote').length) {
               return true; // continue
            }
            
            // توقف عند أول عنوان
            if ($p.prevAll('h1, h2, h3, h4, h5, h6').length > 0) {
               return false; // break
            }
            
            const text = $p.text().trim();
            if (text.length > 0) {
               introText += text + ' ';
            }
         });

         return introText.trim();
      }

      /**
       * إزالة القوالب المتداخلة بشكل صحيح
       * @private
       */
      _removeNestedTemplates(text) {
         let maxIterations = 50;
         let iteration = 0;
         
         while (text.includes('{{') && iteration < maxIterations) {
            iteration++;
            
            let depth = 0;
            let start = -1;
            let newText = '';
            
            for (let i = 0; i < text.length; i++) {
               if (text[i] === '{' && text[i+1] === '{') {
                  if (depth === 0) {
                     start = i;
                  }
                  depth++;
                  i++; // skip next '{'
               } else if (text[i] === '}' && text[i+1] === '}') {
                  depth--;
                  if (depth === 0 && start !== -1) {
                     // وجدنا قالب كامل، نزيله
                     newText = text.substring(0, start) + text.substring(i + 2);
                     text = newText;
                     break;
                  }
                  i++; // skip next '}'
               }
            }
            
            // إذا لم نجد قالب كامل، نخرج
            if (newText === '') {
               break;
            }
         }
         
         // إزالة أي بقايا قوالب غير مكتملة
         text = text.replace(/\{\{[^}]*$/g, '');
         text = text.replace(/^[^{]*\}\}/g, '');
         
         return text;
      }

      /**
       * الحصول على عدد الكلمات
       */
      getWordCount() {
            const txt = (this.fullText || '').trim();
            if (!txt) return 0;
            return txt.split(/\s+/).filter(Boolean).length;
      }

      /**
       * الحصول على قائمة الروابط الداخلية
       */
      getInternalLinks() {
         const links = [];
         
         if (!this.$articleBody || !this.$articleBody.length) {
            return links;
         }
         
         this.$articleBody.find('a').each(function() {
            const href = $(this).attr('href');
            if (!href) return;
            
            const isWikiLink = href.startsWith('/wiki/') || 
                              href.startsWith('./') || 
                              href.includes('/w/index.php?title=');
            
            if (isWikiLink && !$(this).hasClass('new')) {
               if (!href.includes(':') || 
                   !href.match(/\/(ملف|صورة|File|Image|تصنيف|Category|ويكيبيديا|Wikipedia|قالب|Template|مساعدة|Help|بوابة|Portal):/i)) {
                  links.push(href);
               }
            }
         });

         return [...new Set(links)];
      }

      /**
       * الحصول على قائمة الروابط الحمراء
       */
      getRedLinks() {
         const redLinks = [];
         
         if (!this.$articleBody || !this.$articleBody.length) {
            return redLinks;
         }
         
         this.$articleBody.find('a.new').each(function() {
            redLinks.push($(this).attr('href'));
         });

         return redLinks;
      }

      /**
       * كشف نوع المقالة
       */
      detectArticleType() {
         const types = [];
         const templates = Array.isArray(this.templates) ? this.templates : [];
         const title = this.title || '';

         // طبية
         const medicalKeywords = ['طب', 'طبي', 'مرض', 'علاج', 'دواء', 'جراحة'];
         if (this.fullText && medicalKeywords.some(k => this.fullText.includes(k))) {
            types.push('medical');
         }

         // جغرافية
         if (this.$infobox && this.$infobox.length && this.$infobox.text().includes('إحداثيات')) {
            types.push('geographic');
         }

         // سيرة ذاتية
         const bioTemplates = templates.filter(t => 
            /صندوق معلومات شخص|معلومات شخصية|Infobox person/i.test(t)
         );
         if (bioTemplates.length > 0) {
            types.push('biography');
         }

         // رياضيات وهندسة (مواضيع كلاسيكية)
         const mathKeywords = ['رياضيات', 'رياضية', 'هندسة رياضية', 'معادلة', 'نظرية', 'برهان'];
         const mathCategories = this.categories.filter(c => /رياضيات|هندسة رياضية/i.test(c));
         if (mathCategories.length > 0 || mathKeywords.some(k => title.includes(k))) {
            types.push('mathematics');
         }

         // علوم كلاسيكية (فيزياء، كيمياء)
         const scienceKeywords = ['فيزياء', 'كيمياء', 'قانون', 'تفاعل'];
         const scienceCategories = this.categories.filter(c => /فيزياء|كيمياء/i.test(c));
         if (scienceCategories.length > 0 || scienceKeywords.some(k => title.includes(k))) {
            types.push('science');
         }

         // تاريخ
         const historyKeywords = ['تاريخ', 'تاريخي', 'معركة', 'حضارة', 'عصر'];
         const historyCategories = this.categories.filter(c => /تاريخ/i.test(c));
         if (historyCategories.length > 0 || historyKeywords.some(k => title.includes(k))) {
            types.push('history');
         }

         // فلسفة وأدب
         const philosophyKeywords = ['فلسفة', 'فيلسوف', 'أدب', 'شعر', 'قصيدة'];
         const philosophyCategories = this.categories.filter(c => /فلسفة|أدب/i.test(c));
         if (philosophyCategories.length > 0 || philosophyKeywords.some(k => title.includes(k))) {
            types.push('philosophy');
         }

         return types;
      }

      /**
       * تصدير كـ JSON
       */
      toJSON() {
         const sections = Array.isArray(this.sections) ? this.sections : [];
         const images = Array.isArray(this.images) ? this.images : [];
         const categories = Array.isArray(this.categories) ? this.categories : [];
         
         return {
            title: this.title,
            articleLength: this.articleLength,
            wordCount: this.getWordCount(),
            sectionsCount: sections.length,
            imagesCount: images.length,
            categoriesCount: categories.length,
            types: this.detectArticleType()
         };
      }
   }

   // تصدير
   window.QualityUltraMax = window.QualityUltraMax || {};
   window.QualityUltraMax.UnifiedArticleModel = UnifiedArticleModel;

   // توافق اسم قديم (ArticleModel)
   window.QualityUltraMax.ArticleModel = UnifiedArticleModel;

})(window);
