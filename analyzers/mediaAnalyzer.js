/**
 * mediaAnalyzer.js
 * محلل الوسائط المتعددة
 * يقيم جودة واستخدام الصور والوسائط في المقالة
 */

(function(window) {
   'use strict';

   class MediaAnalyzer {
      constructor() {
         this.maxScore = 10;

         // كلمات مفتاحية لتصفية الوسائط غير المفيدة
         this.filterKeywords = [
            'flag', 'Flag', 'علم', 'logo', 'Logo', 'رمز',
            'Icon', 'icon', 'أيقونة', 'Symbol', 'symbol'
         ];

         // كلمات مفتاحية للصور غير الحرة
         this.nonFreeKeywords = [
            'Fair use', 'fair use', 'Fair_use',
            'Non-free', 'non-free', 'Nonfree', 'nonfree',
            'غير حر', 'غير_حر', 'fairuse', 'Fairuse'
         ];

         // أنماط أسماء الملفات العربية
         this.arabicPattern = /[\u0600-\u06FF]/;
         
         // أيقونات صندوق المعلومات التقنية (يجب استثناؤها)
         this.infoboxIconPatterns = [
            /Info_Simple/i,
            /Twemoji.*\.svg/i,
            /Fleche-defaut/i,
            /Arrow/i,
            /Edit-.*\.svg/i,
            /Pencil.*\.svg/i,
            /Question.*mark/i,
            /Nuvola/i,
            /Crystal/i,
            /OOjs.*icon/i
         ];
         
         // حد أقصى لحجم الأيقونات (بالبكسل)
         this.iconMaxSize = 30;
      }

      /**
       * فحص إذا كانت الصورة أيقونة تقنية يجب استثناؤها
       * @private
       */
      _isInfoboxIcon($img) {
         const src = $img.attr('src') || '';
         const width = parseInt($img.attr('width')) || 0;
         const height = parseInt($img.attr('height')) || 0;
         
         // فحص 1: الحجم - أيقونات صغيرة جداً (≤30px)
         if ((width > 0 && width <= this.iconMaxSize) || 
             (height > 0 && height <= this.iconMaxSize)) {
            return true;
         }
         
         // فحص 2: أنماط أسماء الملفات المعروفة
         const isKnownIcon = this.infoboxIconPatterns.some(pattern => pattern.test(src));
         if (isKnownIcon) {
            return true;
         }
         
         // فحص 3: أيقونات من مجلد commons/thumb مع أحجام صغيرة في اسم الملف
         // مثل: 20px-Info_Simple.svg.png, 8px-Arrow.png
         if (/\/\d{1,2}px-.*\.(svg|png)/i.test(src)) {
            return true;
         }
         
         return false;
      }

      /**
       * تحليل الوسائط في المقالة
       * @param {UnifiedArticleModel} articleModel 
       * @returns {Object}
       */
      analyze(articleModel) {
         const results = {
            score: 0,
            details: {},
            notes: []
         };

         console.log('[QUM MediaAnalyzer] Starting analysis:', {
            hasParsedContent: !!(articleModel.$parsedContent && articleModel.$parsedContent.length),
            hasArticleBody: !!(articleModel.$articleBody && articleModel.$articleBody.length),
            hasInfobox: !!(articleModel.$infobox && articleModel.$infobox.length),
            imagesInModel: articleModel.images ? articleModel.images.length : 0
         });

         // 1. تحليل صور صندوق المعلومات
         const infoboxImages = this._countInfoboxImages(articleModel);
         results.details.infoboxImages = infoboxImages;

         // 2. تحليل صور المقالة (محتوى فقط)
         const articleImages = this._countArticleImages(articleModel);
         results.details.articleImages = articleImages.count;
         results.details.decorativeImages = articleImages.decorative;
         results.details.informativeImages = articleImages.informative;

         // 3. كشف الوسائط المتعددة الأخرى
         const multimedia = this._detectMultimedia(articleModel);
         results.details.videos = multimedia.videos;
         results.details.audios = multimedia.audios;

         // 4. كشف صورة البداية المفقودة
         const hasLeadImage = this._hasLeadImage(articleModel);
         results.details.hasLeadImage = hasLeadImage;

         // 5. تصفية الوسائط غير المفيدة
         const filtered = this._filterNonInformationalMedia(articleModel);
         results.details.filteredOutImages = filtered.count;
         
         // 6. كشف الصور غير الحرة
         const nonFree = this._detectNonFreeImages(articleModel);
         results.details.nonFreeImagesCount = nonFree.count;

         // 7. فحص البيانات الوصفية في كومنز (تقديري)
         const commonsCheck = this._checkCommonsMetadata(articleModel);
         results.details.commonsLikelyCount = commonsCheck.commonsLikely;
         results.details.arabicDescriptionLikelyCount = commonsCheck.arabicDescriptionLikely;

         // 8. فحص جودة النص البديل (مع تصفية)
         const altTextQuality = this._checkAltTextQuality(articleModel);
         results.details.badAltTextCount = altTextQuality.count;
         // للتوافق مع الكود القديم
         results.details.imagesWithoutAlt = altTextQuality.count;

         // 9. عد الوسائط المصححة
         const correctedCount = this._countCorrectedArticleMedia(articleModel);
         results.details.articleMediaCountCorrected = correctedCount;

         // 10. حساب كثافة الوسائط
         const wordCount = articleModel.fullText ? articleModel.fullText.split(/\s+/).length : 0;
         results.details.mediaDensity = wordCount > 0 
            ? ((correctedCount / wordCount) * 100).toFixed(2)
            : 0;

         // 11. أمثلة على المشاكل
         results.details.examples = {
            filteredOut: filtered.examples,
            nonFreeImages: nonFree.examples,
            missingImages: commonsCheck.missingExamples,
            noArabicDescription: commonsCheck.noArabicExamples,
            badAltText: altTextQuality.examples
         };

         // 12. حساب النقاط
         results.score = this._calculateScore(results.details, articleModel);

         // 13. إنشاء الملاحظات
         results.notes = this._generateNotes(results.details, articleModel);

         return results;
      }

      /**
       * عد صور صندوق المعلومات (باستثناء الأيقونات التقنية)
       * @private
       */
      _countInfoboxImages(articleModel) {
         if (!articleModel.$parsedContent || !articleModel.$parsedContent.length) {
            return 0;
         }
         
         let count = 0;
         const self = this;
         
         articleModel.$parsedContent.find(`
            .infobox img,
            .infobox figure img,
            .infobox .mw-halign-center img
         `).each(function() {
            const $img = $(this);
            
            // استثناء الأيقونات التقنية
            if (!self._isInfoboxIcon($img)) {
               count++;
            }
         });
         
         return count;
      }

      /**
       * عد صور المقالة (باستثناء الصور الزخرفية والأيقونات التقنية)
       * @private
       */
      _countArticleImages(articleModel) {
         let informativeCount = 0;
         let decorativeCount = 0;

         if (!articleModel.$articleBody || !articleModel.$articleBody.length) {
            return { count: 0, informative: 0, decorative: 0 };
         }

         const self = this;
         
         // استنساخ المحتوى وإزالة القوالب
         const $content = articleModel.$articleBody.clone();
         $content.find('.navbox, .navbox-inner, .vertical-navbox, .sidebar, .mbox, .ambox, .tmbox, .fmbox, .ombox, .imbox, .infobox, .reflist, .references').remove();

         $content.find('img').each(function() {
            const $img = $(this);
            const width = parseInt($img.attr('width')) || 0;
            const height = parseInt($img.attr('height')) || 0;
            const src = $img.attr('src') || '';
            const cls = ($img.attr('class') || '').toLowerCase();
            const isMathImage = cls.includes('mwe-math') || $img.closest('.mwe-math-element, .mwe-math-fallback-image-inline, .mwe-math-fallback-image-display').length > 0;

            // استثناء الأيقونات التقنية أولاً
            if (self._isInfoboxIcon($img)) {
               return; // تخطي هذه الصورة تماماً
            }

            // استبعاد الأيقونات والأعلام الصغيرة
            const isSmallIcon = (width < 60 || height < 60) && !isMathImage;
            const isFlag = src.includes('Flag_of') || src.includes('علم_');
            const isIcon = src.includes('Icon-') || src.includes('أيقونة');

            if ((isSmallIcon || isFlag || isIcon) && !isMathImage) {
               decorativeCount++;
            } else {
               informativeCount++;
            }
         });

         return {
            count: informativeCount + decorativeCount,
            informative: informativeCount,
            decorative: decorativeCount
         };
      }

      /**
       * كشف الوسائط المتعددة
       * @private
       */
      _detectMultimedia(articleModel) {
         return {
            videos: articleModel.$articleBody.find('video').length,
            audios: articleModel.$articleBody.find('audio').length
         };
      }

      /**
       * كشف وجود صورة في بداية المقالة
       * @private
       */
      _hasLeadImage(articleModel) {
         if (!articleModel.$parsedContent || !articleModel.$parsedContent.length) {
            return false;
         }
         // التحقق من وجود صورة في أول 500 حرف
         const $firstParagraphs = articleModel.$parsedContent.find('p').slice(0, 3);
         const hasImageNearby = $firstParagraphs.find('img').length > 0 || 
                               (articleModel.$infobox && articleModel.$infobox.length && articleModel.$infobox.find('img').length > 0);
         
         return hasImageNearby;
      }

      /**
       * تصفية الوسائط غير المفيدة (أعلام، أيقونات، شعارات، أيقونات تقنية)
       * @private
       */
      _filterNonInformationalMedia(articleModel) {
         const filtered = [];
         const self = this;

         if (!articleModel.$articleBody || !articleModel.$articleBody.length) {
            console.warn('[QUM MediaAnalyzer] $articleBody not available for filtering');
            return { count: 0, examples: [] };
         }

         // استنساخ المحتوى وإزالة القوالب والعناصر غير المرغوبة
         const $content = articleModel.$articleBody.clone();
         
         // إزالة: القوالب الملاحية، الصناديق، الهوامش، صناديق المعلومات
         $content.find('.navbox, .navbox-inner, .vertical-navbox, .sidebar, .mbox, .ambox, .tmbox, .fmbox, .ombox, .imbox, .infobox, .reflist, .references').remove();

         $content.find('img').each(function() {
            const $img = $(this);
            const src = $img.attr('src') || '';
            const alt = $img.attr('alt') || '';
            const width = parseInt($img.attr('width')) || 0;
            const filename = src.split('/').pop();

            // فحص 1: الأيقونات التقنية
            if (self._isInfoboxIcon($img)) {
               filtered.push({
                  filename: filename.substring(0, 50),
                  reason: 'أيقونة تقنية'
               });
               return;
            }

            // فحص 2: الكلمات المفتاحية
            const matchesKeyword = self.filterKeywords.some(keyword => 
               filename.includes(keyword) || alt.includes(keyword) || src.includes(keyword)
            );

            // فحص 3: الحجم
            const tooSmall = width > 0 && width < 60;

            if (matchesKeyword || tooSmall) {
               filtered.push({
                  filename: filename.substring(0, 50),
                  reason: matchesKeyword ? 'كلمة مفتاحية' : 'صغير جداً'
               });
            }
         });

         console.log('[QUM MediaAnalyzer] Filtered images:', filtered.length);
         return {
            count: filtered.length,
            examples: filtered.slice(0, 5)
         };
      }

      /**
       * كشف الصور غير الحرة
       * @private
       */
      _detectNonFreeImages(articleModel) {
         const nonFree = [];
         const self = this;

         if (!articleModel.$articleBody || !articleModel.$articleBody.length) {
            console.warn('[QUM MediaAnalyzer] $articleBody not available for non-free detection');
            return { count: 0, examples: [] };
         }

         // استنساخ المحتوى وإزالة القوالب
         const $content = articleModel.$articleBody.clone();
         $content.find('.navbox, .navbox-inner, .vertical-navbox, .sidebar, .mbox, .ambox, .tmbox, .fmbox, .ombox, .imbox, .infobox, .reflist, .references').remove();

         $content.find('img').each(function() {
            const $img = $(this);
            const src = $img.attr('src') || '';
            const alt = $img.attr('alt') || '';
            const filename = src.split('/').pop();

            // فحص الكلمات المفتاحية للصور غير الحرة
            const isNonFree = self.nonFreeKeywords.some(keyword => 
               filename.includes(keyword) || alt.includes(keyword) || src.includes(keyword)
            );

            if (isNonFree) {
               nonFree.push(filename.substring(0, 60));
            }
         });

         console.log('[QUM MediaAnalyzer] Non-free images:', nonFree.length);
         return {
            count: nonFree.length,
            examples: nonFree.slice(0, 5)
         };
      }

      /**
       * فحص البيانات الوصفية في كومنز (تقديري - بدون استدعاء API)
       * @private
       */
      _checkCommonsMetadata(articleModel) {
         let commonsLikely = 0;
         let arabicDescriptionLikely = 0;
         const missingExamples = [];
         const noArabicExamples = [];
         const self = this;

         if (!articleModel.$articleBody || !articleModel.$articleBody.length) {
            console.warn('[QUM MediaAnalyzer] $articleBody not available for Commons check');
            return { 
               commonsLikely: 0, 
               arabicDescriptionLikely: 0, 
               missingExamples: [], 
               noArabicExamples: [] 
            };
         }

         // استنساخ المحتوى وإزالة القوالب
         const $content = articleModel.$articleBody.clone();
         $content.find('.navbox, .navbox-inner, .vertical-navbox, .sidebar, .mbox, .ambox, .tmbox, .fmbox, .ombox, .imbox, .infobox, .reflist, .references').remove();

         $content.find('img').each(function() {
            const $img = $(this);
            const src = $img.attr('src') || '';
            const alt = $img.attr('alt') || '';
            const filename = src.split('/').pop();

            // استثناء الأيقونات التقنية
            if (self._isInfoboxIcon($img)) {
               return; // تخطي
            }

            // تقدير: إذا كان المصدر يحتوي على "commons" أو "upload.wikimedia"
            const likelyFromCommons = src.includes('commons') || 
                                     src.includes('upload.wikimedia.org') ||
                                     filename.startsWith('File:') ||
                                     /\.(jpg|png|svg|jpeg|gif)$/i.test(filename);

            if (likelyFromCommons) {
               commonsLikely++;

               // تقدير: إذا كان اسم الملف أو النص البديل يحتوي على عربية
               if (self.arabicPattern.test(filename) || self.arabicPattern.test(alt)) {
                  arabicDescriptionLikely++;
               } else {
                  noArabicExamples.push(filename.substring(0, 50));
               }
            } else {
               missingExamples.push(filename.substring(0, 50));
            }
         });

         console.log('[QUM MediaAnalyzer] Commons metadata:', {
            commonsLikely,
            arabicDescriptionLikely
         });

         return {
            commonsLikely: commonsLikely,
            arabicDescriptionLikely: arabicDescriptionLikely,
            missingExamples: missingExamples.slice(0, 5),
            noArabicExamples: noArabicExamples.slice(0, 5)
         };
      }

      /**
       * فحص جودة الوصف أسفل الصورة (caption) من wikitext
       * @private
       */
      _checkImageCaptions(articleModel) {
         const missingCaptions = [];

         if (!articleModel.wikitext) {
            console.warn('[QUM MediaAnalyzer] wikitext not available for caption check');
            return { count: 0, examples: [] };
         }

         const wikitext = articleModel.wikitext;
         
         // نمط للكشف عن قوالب الصور في wikitext
         // مثال: [[ملف:صورة.jpg|تصغير|الوصف هنا]]
         // أو: [[File:image.jpg|thumb|Caption here]]
         const imagePattern = /\[\[(ملف|File|صورة|Image):([^\]]+?)\]\]/gi;
         
         const self = this;
         let match;
         
         while ((match = imagePattern.exec(wikitext)) !== null) {
            const fullMatch = match[0];
            const filename = match[2];
            
            // تخطي الصور المصفاة (أيقونات، أعلام، إلخ)
            const isFiltered = self.filterKeywords.some(keyword => 
               filename.includes(keyword)
            );
            
            // تخطي الصور الصغيرة جداً (مثل 20px، 30px)
            const hasSmallSize = /\d{1,2}px/.test(fullMatch);
            
            if (isFiltered || hasSmallSize) {
               continue;
            }
            
            // تقسيم المعاملات
            const parts = filename.split('|');
            const imageName = parts[0].trim();
            
            // البحث عن الوصف (caption)
            // الوصف عادة يكون آخر معامل ليس خياراً تنسيقياً
            const formatOptions = ['تصغير', 'thumb', 'thumbnail', 'يسار', 'يمين', 'left', 'right', 
                                  'وسط', 'center', 'إطار', 'frame', 'بلا إطار', 'frameless',
                                  'border', 'حدود', 'upright'];
            
            let caption = '';
            for (let i = parts.length - 1; i >= 1; i--) {
               const part = parts[i].trim();
               
               // تخطي خيارات التنسيق والأحجام
               const isFormatOption = formatOptions.some(opt => part === opt);
               const isSizeOption = /^\d+px$/.test(part);
               
               if (!isFormatOption && !isSizeOption && part.length > 0) {
                  caption = part;
                  break;
               }
            }
            
            // فحص الوصف
            if (!caption || caption.trim().length < 5) {
               missingCaptions.push({
                  filename: imageName.length > 50 ? imageName.substring(0, 50) + '...' : imageName,
                  caption: caption || '(مفقود)',
                  issue: caption ? 'قصير جداً (أقل من 5 أحرف)' : 'مفقود'
               });
            }
         }

         console.log('[QUM MediaAnalyzer] Images without proper captions:', missingCaptions.length);
         return {
            count: missingCaptions.length,
            examples: missingCaptions.slice(0, 5)
         };
      }

      /**
       * فحص جودة النص البديل (محسّن مع تصفية) - DEPRECATED
       * ملاحظة: تم استبداله بـ _checkImageCaptions
       * @private
       */
      _checkAltTextQuality(articleModel) {
         // استدعاء الفحص الجديد للوصف بدلاً من alt text
         return this._checkImageCaptions(articleModel);
      }

      /**
       * عد الوسائط المصححة (استثناء القوالب والهوامش والأيقونات التقنية)
       * @private
       */
      _countCorrectedArticleMedia(articleModel) {
         let count = 0;
         const self = this;

         // استنساخ المحتوى وإزالة العناصر غير المرغوبة
         const $content = articleModel.$parsedContent.clone();
         
         // إزالة: صندوق المعلومات، القوالب، الهوامش، الشريط الجانبي
         $content.find('.infobox, .navbox, .sidebar, .mbox, .reflist, .references').remove();

         // عد الصور المتبقية
         $content.find('img').each(function() {
            const $img = $(this);
            const src = $img.attr('src') || '';
            const width = parseInt($img.attr('width')) || 0;
            const filename = src.split('/').pop();

            // فحص 1: الأيقونات التقنية
            if (self._isInfoboxIcon($img)) {
               return; // تخطي
            }

            // فحص 2: استبعاد الأيقونات والأعلام
            const isFiltered = self.filterKeywords.some(keyword => 
               filename.includes(keyword) || src.includes(keyword)
            );
            const tooSmall = width > 0 && width < 60;

            if (!isFiltered && !tooSmall) {
               count++;
            }
         });

         return count;
      }

      /**
       * حساب النقاط
       * @private
       */
      _calculateScore(details, articleModel) {
         let score = 0;

         // صور المقالة (0-6)
         // تعديل: معايير أكثر واقعية للصور المطلوبة
         if (details.informativeImages >= 3) score += 6;  // كان >= 5
         else if (details.informativeImages >= 2) score += 5;  // كان >= 3
         else if (details.informativeImages >= 1) score += 4;  // كان >= 2

         // صور صندوق المعلومات (0-2)
         if (details.infoboxImages > 0) score += 2;

         // وسائط متعددة (0-2)
         if (details.videos > 0 || details.audios > 0) score += 2;

         // عقوبة للصور بدون وصف مناسب (تحديث: فقط للأعداد الكبيرة جداً >10)
         if (details.imagesWithoutAlt > 10) {
            score -= Math.min(1, (details.imagesWithoutAlt - 10) * 0.2);
         }

         return Math.max(0, Math.min(this.maxScore, score));
      }

      /**
       * إنشاء الملاحظات
       * @private
       */
      _generateNotes(details, articleModel) {
         const notes = [];

         // لا تعرض تحذيرات "المقالة طويلة" إذا كانت المقالة بذرة
         const templates = Array.isArray(articleModel.templates) ? articleModel.templates : [];
         const isStub = templates.some(t => /بذرة|stub/i.test(t));
         const textLen = articleModel.wikitextLength || articleModel.articleLength || 0;

         // لا توجد وسائط
         if (details.articleImages === 0 && details.infoboxImages === 0) {
            notes.push('المقالة لا تحتوي على أي صور. يُستحسن إضافة صور توضيحية من ويكيميديا كومنز.');
         }

         // صور فقط في صندوق المعلومات
         else if (details.articleImages === 0 && details.infoboxImages > 0) {
            notes.push('الصور موجودة فقط في صندوق المعلومات. يُفضل إضافة صور توضيحية في متن المقالة.');
         }

         // قلة الصور للمقالات الطويلة (معايير محدّثة أكثر واقعية)
         else if (!isStub && textLen > 15000 && details.informativeImages < 3) {
            notes.push('يُفضَّل إضافة مزيدٍ من الصور التوضيحية نظرًا لطول المقالة.');
         } else if (!isStub && textLen > 10000 && textLen <= 15000 && details.informativeImages < 2) {
            notes.push('يُفضَّل إضافة مزيدٍ من الصور التوضيحية نظرًا لطول المقالة.');
         }

         // صور بدون وصف مناسب (تحديث: فقط للأعداد الكبيرة جداً >10)
         if (details.imagesWithoutAlt > 10) {
            notes.push(`${details.imagesWithoutAlt} صورة بدون وصف مناسب أسفل الصورة. يُفضل إضافة وصف توضيحي للصور الرئيسية.`);
         }

         // نسبة الصور الزخرفية عالية (تحديث: فقط إذا كانت ضعف الصور التوضيحية)
         if (details.decorativeImages > (details.informativeImages * 2) && details.informativeImages > 0) {
            notes.push('عدد الصور الزخرفية (أيقونات وأعلام) أكثر بكثير من الصور التوضيحية. يُفضل التركيز على الصور المفيدة.');
         }

         // صور غير حرة (NEW)
         if (details.nonFreeImagesCount > 0) {
            notes.push(`تم اكتشاف ${details.nonFreeImagesCount} صورة غير حرة. يُفضل استبدالها بصور حرة من ويكيميديا كومنز.`);
         }

         // نص بديل سيئ (تحديث: فقط للأعداد الكبيرة جداً >10)
         if (details.badAltTextCount > 10) {
            notes.push(`${details.badAltTextCount} صورة بنص بديل قصير. يُفضل تحسين النصوص البديلة.`);
         }

         // صور بدون وصف عربي محتمل (تحديث: فقط إذا كانت أقل من 30%)
         if (details.commonsLikelyCount > 3 && details.arabicDescriptionLikelyCount < details.commonsLikelyCount * 0.3) {
            notes.push('معظم الصور تفتقر إلى وصف عربي. يُنصح بإضافة أوصاف عربية في ويكيميديا كومنز.');
         }

         // كثافة وسائط منخفضة (تحديث: إلغاء هذا التحذير - غير عادل للمقالات النصية)
         // الكثافة 0.5% تعني صورة لكل 200 كلمة وهو غير واقعي للمقالات العلمية/الطبية
         // const articleLen = articleModel.articleLength || 0;
         // if (details.mediaDensity < 0.5 && articleLen > 20000) {
         //    notes.push(`كثافة الوسائط منخفضة (${details.mediaDensity}%). يُفضل إضافة المزيد من الوسائط التوضيحية.`);
         // }

         return notes;
      }
   }

   // تصدير
   window.QualityUltraMax = window.QualityUltraMax || {};
   window.QualityUltraMax.MediaAnalyzer = MediaAnalyzer;

})(window);
