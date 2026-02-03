/**
 * revisionAnalyzer.js
 * محلل استقرار المقالة والمراجعات
 * يقيم استقرار المقالة بناءً على إشارات تحريرية ومؤشرات الاستقرار
 */

(function(window) {
   'use strict';

   class RevisionAnalyzer {
      constructor() {
         this.maxScore = 10;

         // قوالب الصيانة التي تدل على قلة المراجعين
         this.lowQualityTemplates = [
            'غير مراجعة',
            'يتيمة',
            'تنظيف',
            'بذرة',
            'مصدر',
            'لا مصدر',
            'مراجع',
            'توضيح'
         ];

         // قوالب حروب التحرير
         this.editWarTemplates = [
            'تعارض تحرير',
            'خلاف تحريري',
            'نزاع محايد'
         ];

         // قوالب الأحداث الجارية
         this.currentEventTemplates = [
            'حدث جاري',
            'حدث حالي',
            'أحداث جارية',
            'Current event',
            'حدث متطور',
            'في الأخبار',
            'Breaking news',
            'عرضة للتغيير',
            'معلومات متغيرة'
         ];

         // كلمات مفتاحية للاسترجاع
         this.revertKeywords = [
            'Reverted',
            'استرجاع',
            'تراجع',
            'تراجع عن تعديل',
            'Undid',
            'Revert'
         ];

         // كلمات مفتاحية للحماية
         this.protectionKeywords = [
            'هذه الصفحة محمية',
            'صفحة محمية',
            'محمية كلياً',
            'محمية جزئياً',
            'padlock',
            'قفل'
         ];
      }

      /**
       * تحليل استقرار المقالة
       * @param {UnifiedArticleModel} articleModel 
       * @param {Object} articleData - بيانات المقالة الخام (تحتوي على revisionStats)
       * @param {jQuery} $parsedArticle - المقالة المحللة
       * @returns {Object}
       */
      analyze(articleModel, articleData, $parsedArticle) {
         const results = {
            score: 0,
            details: {},
            notes: []
         };

         // استخراج بيانات المراجعات الحقيقية من articleData
         const revisionStats = articleData?.revisionStats || null;
         const protectionInfo = articleData?.protectionInfo || null;
         
         console.log('[QUM RevisionAnalyzer] Analyzing with data:', {
            hasRevisionStats: !!revisionStats,
            revisionStats: revisionStats,
            hasProtectionInfo: !!protectionInfo,
            protectionInfo: protectionInfo
         });

         // 1. تقدير التعديلات في آخر 90 يوم (استخدام API إن وُجد)
         const estimatedEdits = this._estimateRecentEdits($parsedArticle, articleModel, revisionStats);
         results.details.estimatedEditsLast90Days = estimatedEdits;

         // 2. تقدير عدد المحررين الفريدين (استخدام API إن وُجد)
         const estimatedEditors = this._estimateUniqueEditors(articleModel, $parsedArticle, revisionStats);
         results.details.estimatedUniqueEditors = estimatedEditors;

         console.log('[QUM RevisionAnalyzer] Calculated stats:', {
            edits: estimatedEdits,
            editors: estimatedEditors,
            usedRealData: !!revisionStats
         });

         // 3. كشف التعديلات الكبيرة غير المتوازنة
         const largeEdits = this._detectLargeEdits(articleModel);
         results.details.largeEditsCount = largeEdits.count;

         // 4. كشف حروب التحرير
         const editWars = this._detectEditWars($parsedArticle, articleModel);
         results.details.hasEditWars = editWars;

         // 4.5. كشف الأحداث الجارية
         const currentEvent = this._detectCurrentEvent($parsedArticle, articleModel);
         results.details.isCurrentEvent = currentEvent;

         // 5. كشف الحماية
         const protection = this._detectProtection($parsedArticle, protectionInfo);
         results.details.hasProtection = protection.hasProtection;
         results.details.protectionLevel = protection.protectionLevel;
         results.details.protectionType = protection.protectionType;
         results.details.protectionExpiry = protection.protectionExpiry;

         // 6. حساب عدد إشارات عدم الاستقرار
         const revisionSignals = this._countRevisionSignals(results.details);
         results.details.revisionSignalsCount = revisionSignals;

         // 7. الأمثلة
         results.details.examples = {
            largeEdits: largeEdits.examples,
            instabilitySignals: this._collectInstabilitySignals(results.details)
         };

         // 8. حساب درجة الاستقرار
         results.details.stabilityScore = this._calculateStabilityScore(results.details);
         results.score = results.details.stabilityScore;

         // 9. إنشاء الملاحظات
         results.notes = this._generateNotes(results.details, articleModel);

         return results;
      }

      /**
       * تقدير عدد التعديلات الأخيرة
       * @private
       * @param {jQuery} $parsedArticle
       * @param {UnifiedArticleModel} articleModel
       * @param {Object} revisionStats - بيانات المراجعات من API (إن وُجدت)
       * @returns {number}
       */
      _estimateRecentEdits($parsedArticle, articleModel, revisionStats = null) {
         // إذا كانت لدينا بيانات حقيقية من API، نستخدمها
         if (revisionStats && typeof revisionStats.editCount === 'number') {
            console.log('[QUM RevisionAnalyzer] Using real edit count from API:', revisionStats.editCount);
            return revisionStats.editCount;
         }

         console.log('[QUM RevisionAnalyzer] No API data, using estimation');

         // وإلا نستخدم التقدير المبني على المؤشرات
         const articleLength = articleModel.articleLength || 0;
         const sectionCount = articleModel.sections ? articleModel.sections.length : 0;
         const hasReferences = articleModel.sections && articleModel.sections.some(s => 
            s.line && (s.line.includes('مراجع') || s.line.includes('References') || s.line.includes('المصادر'))
         );
         const hasInfobox = articleModel.wikitext && articleModel.wikitext.includes('{{صندوق معلومات');
         
         // حساب "نقاط النشاط" بناءً على مؤشرات متعددة
         let activityScore = 0;
         
         // طول المقالة (مقالات أطول = تعديلات أكثر عادة)
         if (articleLength > 10000) activityScore += 30;
         else if (articleLength > 5000) activityScore += 20;
         else if (articleLength > 2000) activityScore += 10;
         else if (articleLength > 1000) activityScore += 5;
         
         // عدد الأقسام (بنية أفضل = محررون أكثر)
         if (sectionCount > 8) activityScore += 15;
         else if (sectionCount > 5) activityScore += 10;
         else if (sectionCount > 3) activityScore += 5;
         
         // وجود مراجع (مقالات موثقة = محررون جادون)
         if (hasReferences) activityScore += 10;
         
         // وجود صندوق معلومات (مقالات منظمة = نشاط أعلى)
         if (hasInfobox) activityScore += 5;

         // تحويل نقاط النشاط إلى تقدير واقعي للتعديلات
         // معظم المقالات تحصل على 5-30 تعديل في 90 يوم
         let estimatedEdits;
         if (activityScore >= 50) {
            estimatedEdits = 25 + Math.floor((activityScore - 50) / 4); // 25-35 تعديل (نشطة جداً)
         } else if (activityScore >= 30) {
            estimatedEdits = 15 + Math.floor((activityScore - 30) / 3); // 15-25 تعديل (نشطة)
         } else if (activityScore >= 15) {
            estimatedEdits = 8 + Math.floor((activityScore - 15) / 2); // 8-15 تعديل (متوسطة)
         } else if (activityScore >= 5) {
            estimatedEdits = 5 + Math.floor((activityScore - 5) / 2); // 5-8 تعديلات (قليلة)
         } else {
            estimatedEdits = Math.max(2, activityScore); // 2-5 تعديلات (نادرة)
         }

         console.log('[QUM RevisionAnalyzer] Estimated edits:', estimatedEdits, 'from activity score:', activityScore);
         return estimatedEdits;
      }

      /**
       * تقدير عدد المحررين الفريدين
       * @private
       * @param {UnifiedArticleModel} articleModel
       * @param {jQuery} $parsedArticle
       * @param {Object} revisionStats - بيانات المراجعات من API (إن وُجدت)
       * @returns {number}
       */
      _estimateUniqueEditors(articleModel, $parsedArticle, revisionStats = null) {
         // إذا كانت لدينا بيانات حقيقية من API، نستخدمها
         if (revisionStats && typeof revisionStats.uniqueEditors === 'number') {
            console.log('[QUM RevisionAnalyzer] Using real unique editors from API:', revisionStats.uniqueEditors);
            return revisionStats.uniqueEditors;
         }

         console.log('[QUM RevisionAnalyzer] No API data, using estimation for editors');

         // وإلا نستخدم التقدير المبني على المؤشرات
         const pageHtml = $parsedArticle ? $parsedArticle.html() : '';
         
         // عد قوالب الصيانة (مقالات ضعيفة = محررون قليلون)
         let maintenanceCount = 0;
         this.lowQualityTemplates.forEach(template => {
            if (pageHtml.includes(template)) {
               maintenanceCount++;
            }
         });

         // جمع مؤشرات الجودة
         const articleLen = articleModel.articleLength || 0;
         const sectionCount = articleModel.sections ? articleModel.sections.length : 0;
         const hasReferences = articleModel.sections && articleModel.sections.some(s => 
            s.line && (s.line.includes('مراجع') || s.line.includes('References') || s.line.includes('المصادر'))
         );
         const hasInfobox = articleModel.wikitext && articleModel.wikitext.includes('{{صندوق معلومات');
         const hasCategories = articleModel.wikitext && articleModel.wikitext.includes('[[تصنيف:');

         // حساب نقاط المساهمة
         let contributionScore = 0;
         
         // طول المقالة
         if (articleLen > 10000) contributionScore += 4;
         else if (articleLen > 5000) contributionScore += 3;
         else if (articleLen > 2000) contributionScore += 2;
         else if (articleLen > 1000) contributionScore += 1;
         
         // عدد الأقسام
         if (sectionCount > 8) contributionScore += 3;
         else if (sectionCount > 5) contributionScore += 2;
         else if (sectionCount > 3) contributionScore += 1;
         
         // مؤشرات الجودة
         if (hasReferences) contributionScore += 2;
         if (hasInfobox) contributionScore += 1;
         if (hasCategories) contributionScore += 1;
         
         // خصم نقاط لقوالب الصيانة
         contributionScore -= maintenanceCount * 2;
         contributionScore = Math.max(0, contributionScore);

         // تحويل النقاط إلى تقدير واقعي للمحررين
         // معظم المقالات يحررها 1-5 محررين، والمقالات الممتازة قد تصل 8-12
         let estimatedEditors;
         if (contributionScore >= 12) {
            estimatedEditors = Math.min(12, 8 + Math.floor((contributionScore - 12) / 3)); // 8-12 (استثنائية)
         } else if (contributionScore >= 9) {
            estimatedEditors = 6 + Math.floor((contributionScore - 9) / 2); // 6-7 (جيدة جداً)
         } else if (contributionScore >= 6) {
            estimatedEditors = 4 + Math.floor((contributionScore - 6) / 2); // 4-5 (جيدة)
         } else if (contributionScore >= 3) {
            estimatedEditors = 2 + Math.floor((contributionScore - 3) / 2); // 2-3 (متوسطة)
         } else {
            estimatedEditors = Math.max(1, contributionScore); // 1-2 (ضعيفة)
         }

         console.log('[QUM RevisionAnalyzer] Estimated editors:', estimatedEditors, 'from contribution score:', contributionScore);
         return Math.round(estimatedEditors);
      }

      /**
       * كشف التعديلات الكبيرة غير المتوازنة
       * @private
       */
      _detectLargeEdits(articleModel) {
         const examples = [];
         let count = 0;

         if (!articleModel.sections || articleModel.sections.length === 0) {
            return { count: 0, examples: [] };
         }

         // فحص طول الأقسام
         const sections = Array.isArray(articleModel.sections) ? articleModel.sections : [];
         sections.forEach(section => {
            if (!section.line) return;

            // تقدير طول القسم بناءً على المحتوى
            const sectionText = section.content || '';
            const sectionLength = sectionText.length;

            // قسم كبير جداً (أكثر من 4000 حرف)
            if (sectionLength > 4000) {
               count++;
               if (examples.length < 3) {
                  examples.push({
                     section: section.line,
                     issue: 'قسم كبير جداً',
                     length: sectionLength
                  });
               }
            }
            // قسم صغير جداً (أقل من 80 حرف) - باستثناء المقدمة والمراجع
            else if (sectionLength > 0 && sectionLength < 80 && 
                     !section.line.includes('مراجع') && 
                     !section.line.includes('References') &&
                     !section.line.includes('وصلات خارجية')) {
               count++;
               if (examples.length < 3) {
                  examples.push({
                     section: section.line,
                     issue: 'قسم صغير جداً',
                     length: sectionLength
                  });
               }
            }
         });

         return { count, examples };
      }

      /**
       * كشف حروب التحرير
       * @private
       */
      _detectEditWars($parsedArticle, articleModel) {
         const pageHtml = $parsedArticle ? $parsedArticle.html() : '';
         const pageText = $parsedArticle ? $parsedArticle.text() : '';

         // فحص قوالب حروب التحرير
         for (const template of this.editWarTemplates) {
            if (pageHtml.includes(template)) {
               return true;
            }
         }

         // فحص كلمات الاسترجاع
         for (const keyword of this.revertKeywords) {
            if (pageText.includes(keyword)) {
               return true;
            }
         }

         return false;
      }

      /**
       * كشف الأحداث الجارية
       * @private
       */
      _detectCurrentEvent($parsedArticle, articleModel) {
         const pageHtml = $parsedArticle ? $parsedArticle.html() : '';
         const pageText = $parsedArticle ? $parsedArticle.text() : '';
         const wikitext = articleModel ? articleModel.wikitext : '';

         // فحص قوالب الأحداث الجارية في HTML والنص
         for (const template of this.currentEventTemplates) {
            if (pageHtml.includes(template) || pageText.includes(template)) {
               return true;
            }
         }

         // فحص في الويكي تكست
         if (wikitext) {
            for (const template of this.currentEventTemplates) {
               if (wikitext.includes(template)) {
                  return true;
               }
            }
         }

         return false;
      }

      /**
       * كشف حماية الصفحة
       * @private
       */
      _detectProtection($parsedArticle, protectionInfo) {
         if (protectionInfo && protectionInfo.hasProtection) {
            return {
               hasProtection: true,
               protectionLevel: protectionInfo.protectionLevel,
               protectionType: protectionInfo.protectionType,
               protectionExpiry: protectionInfo.protectionExpiry || null
            };
         }

         const pageHtml = $parsedArticle ? $parsedArticle.html() : '';
         const pageText = $parsedArticle ? $parsedArticle.text() : '';

         for (const keyword of this.protectionKeywords) {
            if (pageHtml.includes(keyword) || pageText.includes(keyword)) {
               return {
                  hasProtection: true,
                  protectionLevel: 'unknown',
                  protectionType: 'unknown',
                  protectionExpiry: null
               };
            }
         }

         if ($parsedArticle && $parsedArticle.find('.mw-indicators-protection').length > 0) {
            return {
               hasProtection: true,
               protectionLevel: 'unknown',
               protectionType: 'unknown',
               protectionExpiry: null
            };
         }

         return {
            hasProtection: false,
            protectionLevel: null,
            protectionType: null,
            protectionExpiry: null
         };
      }

      /**
       * حساب عدد إشارات عدم الاستقرار
       * @private
       */
      _countRevisionSignals(details) {
         let count = 0;

         if (details.estimatedEditsLast90Days > 40) count++;
         if (details.estimatedUniqueEditors < 2) count++;
         if (details.largeEditsCount > 3) count++;
         if (details.hasEditWars) count++;
         if (details.hasProtection) count++;
         if (details.isCurrentEvent) count++;

         return count;
      }

      /**
       * جمع إشارات عدم الاستقرار
       * @private
       */
      _collectInstabilitySignals(details) {
         const signals = [];

         if (details.estimatedEditsLast90Days > 40) {
            signals.push('عدد كبير من التعديلات الأخيرة (أكثر من 40)');
         }

         if (details.estimatedUniqueEditors < 2) {
            signals.push('عدد قليل من المحررين (أقل من 2)');
         }

         if (details.largeEditsCount > 3) {
            signals.push(`عدد كبير من الأقسام غير المتوازنة (${details.largeEditsCount})`);
         }

         if (details.hasEditWars) {
            signals.push('إشارات إلى حروب تحرير');
         }

         if (details.hasProtection) {
            signals.push('الصفحة محمية');
         }

         if (details.isCurrentEvent) {
            signals.push('المقالة عن حدث جاري أو متطور');
         }

         return signals;
      }

      /**
       * حساب درجة الاستقرار
       * @private
       */
      _calculateStabilityScore(details) {
         let score = 10; // البدء من الدرجة الكاملة

         // خصم بناءً على عدد التعديلات
         if (details.estimatedEditsLast90Days > 40) {
            score -= 2;
         }

         // خصم على قلة المحررين
         if (details.estimatedUniqueEditors < 2) {
            score -= 1;
         }

         // خصم على التعديلات الكبيرة غير المتوازنة
         if (details.largeEditsCount > 3) {
            score -= 2;
         }

         // خصم كبير على حروب التحرير
         if (details.hasEditWars) {
            score -= 3;
         }

         // خصم على الحماية
         if (details.hasProtection) {
            score -= 1;
         }

         // خصم كبير على الأحداث الجارية
         if (details.isCurrentEvent) {
            score -= 2;
         }

         // التأكد من بقاء النقاط في النطاق المقبول
         return Math.max(0, Math.min(this.maxScore, score));
      }

      /**
       * إنشاء الملاحظات
       * @private
       */
      _generateNotes(details, articleModel) {
         const notes = [];

         // تعديلات كثيرة
         if (details.estimatedEditsLast90Days > 40) {
            notes.push(`المقالة تشهد نشاطاً تحريرياً كثيفاً (تقدير: ${details.estimatedEditsLast90Days} تعديل في آخر 90 يوم). قد يشير هذا إلى مقالة نشطة أو غير مستقرة.`);
         } else if (details.estimatedEditsLast90Days < 10) {
            notes.push('المقالة تشهد نشاطاً تحريرياً قليلاً. قد تحتاج إلى مزيد من التطوير والتحديث.');
         }

         // محررون قليلون
         if (details.estimatedUniqueEditors < 2) {
            notes.push('المقالة يبدو أنها من إنشاء محرر واحد أو عدد قليل جداً من المحررين. يُفضل تعاون عدة محررين لتحسين الجودة.');
         } else if (details.estimatedUniqueEditors >= 5) {
            notes.push('المقالة تبدو أنها من تطوير عدة محررين، مما يدل على تعاون جيد ومراجعة متعددة.');
         }

         // أقسام غير متوازنة
         if (details.largeEditsCount > 3) {
            notes.push(`تحتوي المقالة على ${details.largeEditsCount} قسم/أقسام غير متوازنة (كبيرة جداً أو صغيرة جداً). يُنصح بمراجعة توزيع المحتوى.`);
         }

         // حروب تحرير
         if (details.hasEditWars) {
            notes.push('⚠️ تم اكتشاف إشارات إلى حروب تحرير أو خلافات تحريرية. قد تحتاج المقالة إلى وساطة أو مراجعة محايدة.');
         }

         // حماية
         if (details.hasProtection) {
            let protectionNote = '🔒 الصفحة محمية. هذا قد يشير إلى حروب تحرير سابقة أو محتوى حساس.';
            
            if (details.protectionExpiry && details.protectionExpiry !== 'infinity' && details.protectionExpiry !== 'infinite') {
               try {
                  const expiryDate = new Date(details.protectionExpiry);
                  const now = new Date();
                  
                  if (expiryDate > now) {
                     const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
                     const options = { year: 'numeric', month: 'long', day: 'numeric' };
                     const formattedDate = expiryDate.toLocaleDateString('ar-EG', options);
                     
                     if (daysLeft <= 7) {
                        protectionNote += ` ⚠️ ستنتهي الحماية قريباً في ${formattedDate} (${daysLeft} يوم متبقي).`;
                     } else if (daysLeft <= 30) {
                        protectionNote += ` الحماية ستنتهي في ${formattedDate} (${daysLeft} يوم متبقي).`;
                     } else {
                        protectionNote += ` الحماية مؤقتة وتنتهي في ${formattedDate}.`;
                     }
                  }
               } catch (e) {
                  console.warn('[RevisionAnalyzer] Failed to parse protection expiry:', details.protectionExpiry);
               }
            } else if (details.protectionExpiry === 'infinity' || details.protectionExpiry === 'infinite') {
               protectionNote += ' الحماية دائمة.';
            }
            
            notes.push(protectionNote);
         }

         // أحداث جارية
         if (details.isCurrentEvent) {
            notes.push('📰 المقالة تتحدث عن حدث جاري أو متطور. المعلومات قد تكون عرضة لتغييرات سريعة وكبيرة، ويُنصح بمراجعة المقالة بشكل دوري للتأكد من دقة وحداثة المعلومات.');
         }

         // استقرار جيد
         if (details.stabilityScore >= 8 && !details.hasEditWars) {
            notes.push('✅ المقالة تبدو مستقرة وذات جودة تحريرية جيدة.');
         }

         return notes;
      }
   }

   // تصدير
   window.QualityUltraMax = window.QualityUltraMax || {};
   window.QualityUltraMax.RevisionAnalyzer = RevisionAnalyzer;

})(window);
