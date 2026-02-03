/**
 * structureAnalyzer.js
 * محلل البنية والتنظيم
 * يقيم جودة تنظيم المقالة وبنيتها
 */

(function(window) {
   'use strict';

   class StructureAnalyzer {
      constructor() {
         this.maxScore = 30;
      }

      /**
       * تحليل البنية
       * @param {UnifiedArticleModel} articleModel 
       * @returns {Object}
       */
      analyze(articleModel) {
         const results = {
            score: 0,
            details: {},
            notes: []
         };

         // 1. تحليل المقدمة
         const intro = this._analyzeIntro(articleModel);
         results.details.intro = intro;

         // 2. تحليل الأقسام
         const sections = this._analyzeSections(articleModel);
         results.details.sections = sections;

         // 3. كشف الأقسام المفقودة
         const missingSections = this._detectMissingSections(articleModel);
         results.details.missingSections = missingSections;

         // 4. كشف الأقسام الفارغة
         const emptySections = this._detectEmptySections(articleModel);
         results.details.emptySections = emptySections;

         // 5. تقييم التوازن البنيوي
         const balance = this._assessBalance(articleModel);
         results.details.balance = balance;

         // 6. كشف نمط البذرة
         const isStub = this._isStubLike(articleModel);
         results.details.isStub = isStub;

         // 7. حساب النقاط
         results.score = this._calculateScore(results.details, articleModel);

         // 8. إنشاء الملاحظات
         results.notes = this._generateNotes(results.details, articleModel);

         return results;
      }

      /**
       * تحليل المقدمة
       * @private
       */
      _analyzeIntro(articleModel) {
         const introText = articleModel.cleanIntroText || '';
         const introLen = introText.length;
         const articleLen = articleModel.wikitextLength || articleModel.articleLength || 1;

         // حساب النسبة المثالية بناءً على طول المقالة
         // للمقالات الكبيرة، النسبة المثالية أقل
         let idealMin, idealMax;
         
         if (articleLen > 50000) {
            // مقالات ضخمة جداً (50k+): 3-8%
            idealMin = articleLen * 0.03;
            idealMax = articleLen * 0.08;
         } else if (articleLen > 20000) {
            // مقالات كبيرة جداً (20k-50k): 5-12%
            idealMin = articleLen * 0.05;
            idealMax = articleLen * 0.12;
         } else if (articleLen > 10000) {
            // مقالات كبيرة (10k-20k): 7-15%
            idealMin = articleLen * 0.07;
            idealMax = articleLen * 0.15;
         } else if (articleLen > 5000) {
            // مقالات متوسطة (5k-10k): 10-20%
            idealMin = articleLen * 0.10;
            idealMax = articleLen * 0.20;
         } else {
            // مقالات صغيرة (<5k): 15-25%
            idealMin = articleLen * 0.15;
            idealMax = articleLen * 0.25;
         }
         
         const isOptimalLength = introLen >= idealMin && introLen <= idealMax;
         const percentage = (introLen / articleLen) * 100;

         // تقسيم الجمل
         const sentences = introText
            .split(/[\.!\؟\?؛;]+/)
            .map(s => s.trim())
            .filter(s => s.length > 0);

         let maxSentenceLen = 0;
         let longSentences = 0;

         sentences.forEach(s => {
            if (s.length > maxSentenceLen) maxSentenceLen = s.length;
            // تحديث: 300 حرف بدلاً من 200 للجمل العلمية مع مصطلحات طبية
            if (s.length > 300) longSentences++;
         });

         return {
            length: introLen,
            sentenceCount: sentences.length,
            maxSentenceLen,
            longSentences,
            isOptimalLength,
            percentageOfArticle: percentage.toFixed(1),
            idealRange: `${(idealMin / articleLen * 100).toFixed(0)}-${(idealMax / articleLen * 100).toFixed(0)}%`
         };
      }

      /**
       * تحليل الأقسام
       * @private
       */
      _analyzeSections(articleModel) {
         const sections = Array.isArray(articleModel.sections) ? articleModel.sections : [];
         
         const levelCounts = {
            h2: 0,
            h3: 0,
            h4: 0,
            h5: 0,
            h6: 0
         };

         sections.forEach(section => {
            const level = parseInt(section.level);
            if (level === 2) levelCounts.h2++;
            else if (level === 3) levelCounts.h3++;
            else if (level === 4) levelCounts.h4++;
            else if (level === 5) levelCounts.h5++;
            else if (level === 6) levelCounts.h6++;
         });

         const structuralDepth = 
            (levelCounts.h2 > 0 ? 1 : 0) +
            (levelCounts.h3 > 0 ? 1 : 0) +
            (levelCounts.h4 > 0 ? 1 : 0);

         return {
            total: sections.length,
            levelCounts,
            structuralDepth
         };
      }

      /**
       * كشف الأقسام المفقودة المهمة
       * @private
       */
      _detectMissingSections(articleModel) {
         const sections = Array.isArray(articleModel.sections) ? articleModel.sections : [];
         const sectionNames = sections.map(s => s.line);
         const missing = [];

         // فحص الأقسام حسب نوع المقالة
         const articleTypes = articleModel.detectArticleType();

         // مراجع
         if (!sectionNames.some(n => /مراجع|references|مصادر/i.test(n))) {
            missing.push('مراجع');
         }

         // روابط خارجية (للمقالات المتوسطة والطويلة فقط)
         const articleLen = articleModel.wikitextLength || articleModel.articleLength || 0;
         if (articleLen > 5000) {
            if (!sectionNames.some(n => /وصلات خارجية|external links|روابط خارجية/i.test(n))) {
               missing.push('وصلات خارجية');
            }
         }

         // انظر أيضاً (للمقالات الطويلة فقط)
         if (articleLen > 8000) {
            if (!sectionNames.some(n => /انظر أيضا|انظر أيضً|see also/i.test(n))) {
               missing.push('انظر أيضاً');
            }
         }

         // أقسام خاصة بالسير الذاتية
         if (articleTypes.includes('biography')) {
            if (!sectionNames.some(n => /حياته|نشأته|سيرته|early life|biography/i.test(n))) {
               missing.push('قسم الحياة المبكرة');
            }
         }

         return missing;
      }

      /**
       * كشف الأقسام الفارغة
       * @private
       */
      _detectEmptySections(articleModel) {
         const emptySections = [];

         // لا يمكن الفحص دون محتوى مُحلل
         if (!articleModel.$parsedContent || !articleModel.$parsedContent.length) {
            return emptySections;
         }

         // أقسام خاصة بطبيعتها قصيرة تُستثنى من التحذير
         const specialSections = [
            'انظر أيضا', 'انظر أيضً', 'انظر أيضاً', 'see also',
            'وصلات خارجية', 'روابط خارجية', 'external links',
            'مراجع', 'مصادر', 'references',
            'تعليقات'
         ];

         // تنظيف عنوان القسم من نصوص واجهة التحرير والرموز غير المرئية
         const cleanSectionTitle = (title) => title
            .replace(/\[عدل\]/g, '')
            .replace(/\[تحرير\]/g, '')
            .replace(/[\u200e\u200f\ufeff]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

         // تحليل بيانات API لتحديد إن كان الـ H2 يحوي أقسام فرعية لاحقة
         const sectionsMeta = Array.isArray(articleModel.sections) ? articleModel.sections : [];
         const h2WithChildren = new Set();
         if (sectionsMeta.length) {
            for (let i = 0; i < sectionsMeta.length; i++) {
               const s = sectionsMeta[i];
               if (parseInt(s.level) === 2) {
                  let hasChild = false;
                  for (let j = i + 1; j < sectionsMeta.length; j++) {
                     const nxt = sectionsMeta[j];
                     const lvl = parseInt(nxt.level);
                     if (lvl === 2) break;
                     if (lvl >= 3) { hasChild = true; break; }
                  }
                  if (hasChild) {
                     h2WithChildren.add(cleanSectionTitle((s.line || '').toLowerCase()));
                  }
               }
            }
         }

         // فحص كل H2 في DOM (يدعم الحاوية .mw-heading2)
         const $h2Nodes = articleModel.$parsedContent.find('.mw-parser-output .mw-heading2 > h2').length
            ? articleModel.$parsedContent.find('.mw-parser-output .mw-heading2 > h2')
            : articleModel.$parsedContent.find('.mw-parser-output h2');

         $h2Nodes.each(function() {
            const $h2 = $(this);
            const headingText = cleanSectionTitle($h2.text().trim());

            // استثناء الأقسام الخاصة بطبيعتها
            if (specialSections.some(s => headingText.toLowerCase().includes(s.toLowerCase()))) {
               return; // continue
            }

            // تخطّي إن كان لهذا القسم أقسام فرعية (H3+)
            if (h2WithChildren.has(headingText.toLowerCase())) {
               return;
            }

            // نطاق المحتوى التابع لهذا الـ H2 حتى العنوان التالي
            const nextSelector = articleModel.$parsedContent.find('.mw-parser-output .mw-heading2').length ? '.mw-heading2' : 'h2';
            const $content = $h2.parent('.mw-heading2').length
               ? $h2.parent('.mw-heading2').nextUntil(nextSelector)
               : $h2.nextUntil(nextSelector);

            // إن وُجدت عناوين فرعية مباشرة داخل النطاق، تخطّي
            if (
               $content.find('h3, h4, h5, h6').length > 0 ||
               $content.filter('h3, h4, h5, h6').length > 0 ||
               $content.find('.mw-headline').length > 0
            ) {
               return;
            }

            // اعتبار وجود كتل محتوى دلالية/وسائط كمؤشر محتوى حتى لو كان النص قصيرًا
            const hasSemanticBlocks = $content.find('p, ul, ol, li, table, tbody, thead, tfoot, tr, td, th, blockquote, dl, dt, dd, .thumb, .gallery, figure, img, .infobox').length > 0;
            // استثناء خاص: وجود {{مفصلة}} عادة يُرسم كـ .hatnote
            const hasHatnote = $content.find('.hatnote').length > 0 || $content.find('[role="note"].hatnote').length > 0 || $content.children('.hatnote').length > 0;
            if (hasHatnote) {
               return;
            }
            // تساهل إضافي: فقرة تحوي روابط داخلية/خارجية كإشارة محتوى تمهيدي
            const hasLinkedParagraph = $content.find('p a[href]').length >= 2;
            if (hasLinkedParagraph) {
               return;
            }

            // كشف مصادر موثوقة داخل القسم
            const htmlChunk = $content.html() || '';
            const hasRefsMarkup = /<ref[\s\S]*?>[\s\S]*?<\/ref>/i.test(htmlChunk)
               || /\{\{\s*cite\b/i.test(htmlChunk)
               || /\{\{\s*(استشهاد|استشهاد\s+مختصر|استشهاد\s+بويب|اقتباس\s+مضمن|مرجع\s+ويب|مرجع\s+كتاب|مرجع\s+مجلة)\b/i.test(htmlChunk);
            const hasCitationElems = $content.find('sup.reference, ol.references, .reflist, .citation, sup a[href*="#cite"], a[href^="#cite_note"], a[rel="citation"], span.reference').length > 0;
            const hasReliableLinks = $content.find(
               'a[href*="doi.org"], a[href*="pubmed"], a[href*="nature.com"], a[href*="sciencedirect.com"], a[href*="jstor.org"], a[rel="citation"]'
            ).length > 0;
            const hasSources = hasRefsMarkup || hasCitationElems || hasReliableLinks;

            // وجود مصادر داخل القسم يحصّنه حتى لو قصير
            if (hasSources) {
               return;
            }

            // تقدير طول المحتوى الفعلي
            // تنقية النطاق من عناصر غير محتوى
            const sanitized = $content.clone();
            sanitized.find('.mw-editsection, .navbar, #toc, .toctitle').remove();
            const rawText = sanitized.text().trim();
            const plain = rawText
               .replace(/<ref[\s\S]*?<\/ref>/gi, ' ')
               .replace(/\[\d+\]/g, ' ')
               .replace(/\s+/g, ' ')
               .trim();
            const wordCount = plain.length ? plain.split(/\s+/).filter(Boolean).length : 0;

            // إذا وُجدت كتل محتوى دلالية (قوائم/جداول/صور/صندوق معلومات)، لا تعتبره فارغًا
            if (hasSemanticBlocks && (wordCount >= 10 || $content.children().length >= 3)) {
               return;
            }

            // اعتبار القسم فارغ/قصير فقط إذا كان قصيرًا جدًا ولا يحتوي مصادر
            if (rawText.length < 350 && wordCount < 50) {
               emptySections.push(headingText);
               return;
            }
         });

         return emptySections;
      }

      /**
       * تصنيف حجم المقالة
       * @private
       */
      _categorizeArticleSize(articleLen) {
         if (articleLen < 2500) return 'stub';        // بذرة: أقل من 2500 حرف
         if (articleLen < 7000) return 'short';       // قصيرة: 2500-7000 حرف
         if (articleLen < 20000) return 'medium';     // متوسطة: 7000-20000 حرف
         return 'long';                               // طويلة: أكثر من 20000 حرف
      }

      /**
       * تقييم التوازن البنيوي
       * @private
       */
      _assessBalance(articleModel) {
         const sections = Array.isArray(articleModel.sections) ? articleModel.sections : [];
         const articleLen = articleModel.wikitextLength || articleModel.articleLength || 0;
         // FIX: Use parseInt and == instead of === for type-safe comparison
         const h2Count = sections.filter(s => parseInt(s.level) == 2).length;
         const sizeCategory = this._categorizeArticleSize(articleLen);
         const templates = Array.isArray(articleModel.templates) ? articleModel.templates : [];
         const hasStubTemplate = templates.some(t => /بذرة|stub/i.test(t));

         console.log('[StructureAnalyzer] _assessBalance:', {
            articleLen,
            sizeCategory,
            totalSections: sections.length,
            h2Count,
            hasStubTemplate,
            sampleLevels: sections.slice(0, 3).map(s => ({ level: s.level, type: typeof s.level }))
         });

         let isBalanced = true;
         let issue = null;

         // البذور والمقالات القصيرة جداً لا تحتاج تقييم توازن
         // articleLen يشمل HTML والقوالب، لذلك الحد أعلى من النص النظيف
         if (hasStubTemplate || sizeCategory === 'stub' || sizeCategory === 'short') {
            return {
               isBalanced: true,
               issue: null,
               sizeCategory
            };
         }

         // تقييم التوازن للمقالات المتوسطة والطويلة فقط
         if (sizeCategory === 'long' && h2Count < 3) {
            isBalanced = false;
            issue = 'مقالة طويلة بدون أقسام كافية';
            console.log('[StructureAnalyzer] Balance check failed: long article with h2Count < 3');
         } else if (sizeCategory === 'medium' && h2Count < 2) {
            isBalanced = false;
            issue = 'يُفضل إضافة أقسام إضافية لتنظيم المحتوى';
            console.log('[StructureAnalyzer] Balance check failed: medium article with h2Count < 2');
         }

         console.log('[StructureAnalyzer] Balance result:', { isBalanced, issue });

         return {
            isBalanced,
            issue,
            sizeCategory
         };
      }

      /**
       * كشف نمط البذرة
       * @private
       */
      _isStubLike(articleModel) {
         const sections = Array.isArray(articleModel.sections) ? articleModel.sections : [];
         const articleLen = articleModel.wikitextLength || articleModel.articleLength || 0;
         const templates = Array.isArray(articleModel.templates) ? articleModel.templates : [];
         
         // 1. فحص قالب البذرة مباشرة
         const hasStubTemplate = templates.some(t => /بذرة|stub/i.test(t));
         if (hasStubTemplate) return true;
         
         // 2. مقالة قصيرة جداً بدون أقسام أو بقسم واحد
         if (sections.length <= 1 && articleLen < 1500) return true;
         
         // 3. مقالة قصيرة حتى لو كان بها عدة أقسام (غالباً أقسام فارغة)
         if (articleLen < 2000 && sections.length <= 4) return true;
         
         return false;
      }

      /**
       * حساب النقاط
       * @private
       */
      _calculateScore(details, articleModel) {
         let score = 0;
         const articleLen = articleModel.wikitextLength || articleModel.articleLength || 0;

         console.log('[StructureAnalyzer] Starting score calculation');
         console.log('[StructureAnalyzer] Article length:', articleLen);
         console.log('[StructureAnalyzer] Is stub:', details.isStub);

         // المقدمة (0-10)
         let introScore = 0;
         if (details.intro.isOptimalLength) {
            introScore = 10;
         } else if (details.intro.length >= 400) {
            introScore = 8;
         } else if (details.intro.length >= 300) {
            introScore = 6;
         } else if (details.intro.length >= 200) {
            introScore = 4;
         } else if (details.intro.length >= 150) {
            introScore = 2;
         }
         score += introScore;
         console.log('[StructureAnalyzer] Intro score:', introScore, '(length:', details.intro.length, ')');

         // البنية (0-12)
         let structureScore = 0;
         if (details.isStub) {
            structureScore = 0;
            console.log('[StructureAnalyzer] Structure score: 0 (stub article)');
         } else if (articleLen < 2500) {
            structureScore = 6;
            console.log('[StructureAnalyzer] Structure score: 6 (short article < 2500)');
         } else {
            const h2Count = details.sections.levelCounts.h2;
            if (h2Count >= 4) structureScore += 10;
            else if (h2Count >= 3) structureScore += 8;
            else if (h2Count >= 2) structureScore += 6;
            else if (h2Count === 1) structureScore += 3;
            console.log('[StructureAnalyzer] H2 sections score:', structureScore, '(H2 count:', h2Count, ')');

            const depthScore = details.sections.structuralDepth >= 3 ? 2 : (details.sections.structuralDepth === 2 ? 1 : 0);
            structureScore += depthScore;
            console.log('[StructureAnalyzer] Depth bonus:', depthScore, '(depth:', details.sections.structuralDepth, ')');
         }
         score += structureScore;

         // الأقسام المهمة (0-3)
         const expectedSections = ['مراجع', 'وصلات خارجية', 'انظر أيضاً'];
         const presentCount = expectedSections.filter(s => !details.missingSections.includes(s)).length;
         score += presentCount;
         console.log('[StructureAnalyzer] Essential sections score:', presentCount, '/3');

         // التوازن (0-3)
         const balanceScore = details.balance.isBalanced ? 3 : 0;
         score += balanceScore;
         console.log('[StructureAnalyzer] Balance score:', balanceScore, '(balanced:', details.balance.isBalanced, ')');

         // عقوبة للأقسام الفارغة
         let emptyPenalty = 0;
         if (details.emptySections.length > 0) {
            emptyPenalty = Math.min(3, details.emptySections.length);
            score -= emptyPenalty;
            console.log('[StructureAnalyzer] Empty sections penalty:', -emptyPenalty, '(count:', details.emptySections.length, ')');
         }

         // عقوبة للجمل الطويلة
         let longSentencePenalty = 0;
         if (details.intro.longSentences > 0 && !articleModel.detectArticleType().includes('medical')) {
            longSentencePenalty = Math.min(2, details.intro.longSentences);
            score -= longSentencePenalty;
            console.log('[StructureAnalyzer] Long sentences penalty:', -longSentencePenalty, '(count:', details.intro.longSentences, ')');
         }

         const finalScore = Math.max(0, Math.min(this.maxScore, score));
         console.log('[StructureAnalyzer] Final structure score:', finalScore, '/', this.maxScore);

         return finalScore;
      }

      /**
       * إنشاء الملاحظات
       * @private
       */
      _generateNotes(details, articleModel) {
         const notes = [];
         const articleLen = articleModel.wikitextLength || articleModel.articleLength || 0;
         const sizeCategory = details.balance.sizeCategory || 'short';

         // Debug logging
         console.log('[StructureAnalyzer] _generateNotes:', {
            isStub: details.isStub,
            sizeCategory: sizeCategory,
            isBalanced: details.balance.isBalanced,
            issue: details.balance.issue,
            articleLen: articleLen
         });

         // ملاحظات خاصة بالبذور
         if (details.isStub) {
            notes.push('🚧 المقالة في مرحلة البذرة. يجب توسيعها وإضافة أقسام منظمة.');
            // للبذور: تجنب الملاحظات التفصيلية الأخرى
            return notes;
         }

         // ملاحظات المقدمة
         if (!details.intro.isOptimalLength) {
            const percentage = parseFloat(details.intro.percentageOfArticle);
            const idealRange = details.intro.idealRange || '10-20%';
            
            if (details.intro.length < 100) {
               notes.push(`📝 المقدمة قصيرة جدًا (${details.intro.length} حرفًا). يجب توسيعها لتلخص موضوع المقالة.`);
            } else if (details.intro.length < 150 && sizeCategory !== 'short') {
               notes.push(`المقدمة قصيرة نسبيًا (${details.intro.percentageOfArticle}% من المقالة). المثالي: ${idealRange}.`);
            } else if (percentage > parseFloat(idealRange.split('-')[1]) && sizeCategory === 'long') {
               notes.push(`المقدمة طويلة نسبيًا (${details.intro.percentageOfArticle}% من المقالة). المثالي: ${idealRange}.`);
            }
         }

         // ملاحظات التوازن البنيوي (للمقالات المتوسطة والطويلة فقط)
         if (!details.balance.isBalanced && sizeCategory !== 'short') {
            notes.push(`⚖️ ${details.balance.issue}. يُستحسن إعادة تنظيم البنية.`);
         }

         // الأقسام المفقودة
         if (details.missingSections.length > 0) {
            notes.push(`📂 أقسام مفقودة مهمة: ${details.missingSections.join('، ')}`);
         }

         // الأقسام القصيرة جدًا بلا مصادر (أكثر أهمية للمقالات المتوسطة والطويلة)
         if (details.emptySections.length > 0 && sizeCategory !== 'short') {
            notes.push(`⚠️ أقسام قصيرة جدًا بلا مصادر: ${details.emptySections.slice(0, 3).join('، ')}`);
         }

         // الجمل الطويلة
         if (details.intro.longSentences > 0) {
            notes.push(`📏 ${details.intro.longSentences} جملة طويلة جدًا في المقدمة (أكثر من 300 حرف). يُفضل تقسيمها للوضوح.`);
         }

         return notes;
      }
   }

   // تصدير
   window.QualityUltraMax = window.QualityUltraMax || {};
   window.QualityUltraMax.StructureAnalyzer = StructureAnalyzer;

})(window);
