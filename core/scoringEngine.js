/**
 * scoringEngine.js
 * محرك التقييم المركزي
 * يجمع نتائج المحللات ويحسب النقاط النهائية
 */

(function(window) {
   'use strict';

   class ScoringEngine {
      constructor() {
         // الأوزان القياسية
         this.weights = {
            structure: 0.25,    // 25%
            references: 0.25,   // 25%
            maintenance: 0.15,  // 15%
            links: 0.15,        // 15%
            media: 0.10,        // 10%
            language: 0.10      // 10% - التحليل اللغوي
         };

         // مستويات الجودة
         this.qualityLevels = [
            { min: 90, label: '💎 مقالة مميزة', class: 'featured' },
            { min: 80, label: '🌟 مقالة جيدة', class: 'good' },
            { min: 65, label: '✅ مقالة متقدمة', class: 'advanced' },
            { min: 50, label: '⚠️ مقالة بداية', class: 'start' },
            { min: 30, label: '📝 بذرية متطورة', class: 'stub-plus' },
            { min: 0, label: '🚨 بذرة', class: 'stub' }
         ];
      }

      /**
       * حساب النقاط النهائية
       * @param {Object} analysisResults - نتائج جميع المحللات
       * @returns {Object}
       */
      calculateFinalScore(analysisResults) {
         // Defensive: ensure all required analyses exist
         const structureAnalysis = analysisResults.structureAnalysis || { score: 0, details: {}, notes: [] };
         const referenceAnalysis = analysisResults.referenceAnalysis || { score: 0, details: {}, notes: [] };
         const mediaAnalysis = analysisResults.mediaAnalysis || { score: 0, details: {}, notes: [] };
         const linkAnalysis = analysisResults.linkAnalysis || { score: 0, details: {}, notes: [] };
         const grammarAnalysis = analysisResults.grammarAnalysis || { score: 0, details: {}, notes: [] };
         const maintenanceAnalysis = analysisResults.maintenanceAnalysis || { score: 0, details: {}, notes: [] };
         const languageAnalysis = analysisResults.languageAnalysis || { score: 0, details: {}, notes: [] };

         // حساب نقاط التحليل اللغوي
         const languageScore = languageAnalysis ? this._calculateLanguageScore(languageAnalysis) : 10;

         // حساب نقاط المراجع مع المعايير المتقدمة
         const referencesScore = this._calculateReferencesScore(referenceAnalysis);

         // حساب نقاط الوسائط مع المعايير المتقدمة
         const mediaScore = this._calculateMediaScore(mediaAnalysis);

         // حساب النقاط الموزونة
         const scores = {
            structure: this._normalizeScore(structureAnalysis.score, 25),
            references: this._normalizeScore(referencesScore, 25),
            maintenance: this._normalizeScore(maintenanceAnalysis.score, 15),
            links: this._normalizeScore(linkAnalysis.score, 15),
            media: this._normalizeScore(mediaScore, 10),
            language: this._normalizeScore(languageScore, 10)
         };

         // المجموع النهائي
         const total = Object.values(scores).reduce((sum, score) => sum + score, 0);
         const normalizedTotal = this._clamp(parseFloat(total.toFixed(2)), 0, 100);

         // تحديد مستوى الجودة
         const qualityLevel = this._getQualityLevel(normalizedTotal);

         // جمع جميع الملاحظات
         const allNotes = this._collectNotes(analysisResults);

         const details = {
            structure: structureAnalysis,
            references: referenceAnalysis,
            media: mediaAnalysis,
            links: linkAnalysis,
            grammar: grammarAnalysis,
            maintenance: maintenanceAnalysis,
            language: languageAnalysis
         };

         // Include optional analyzers if present in the results
         if (analysisResults.revisionAnalysis) details.revision = analysisResults.revisionAnalysis;
         if (analysisResults.wikidataIntegrationAnalysis) details.wikidataIntegration = analysisResults.wikidataIntegrationAnalysis;

         return {
            total: normalizedTotal,
            level: qualityLevel.label,
            levelClass: qualityLevel.class,
            scores: scores,
            details: details,
            notes: allNotes,
            timestamp: Date.now()
         };
      }

      /**
       * تطبيع النقاط إلى الحد الأقصى المطلوب
       * @private
       */
      _normalizeScore(score, maxScore) {
         const normalized = this._clamp(score, 0, maxScore);
         return parseFloat(normalized.toFixed(1));
      }

      /**
       * تقييد القيمة ضمن نطاق
       * @private
       */
      _clamp(value, min, max) {
         return Math.max(min, Math.min(max, value));
      }

      /**
       * تحديد مستوى الجودة بناءً على النقاط
       * @private
       */
      _getQualityLevel(score) {
         for (const level of this.qualityLevels) {
            if (score >= level.min) {
               return level;
            }
         }
         return this.qualityLevels[this.qualityLevels.length - 1];
      }

      /**
       * جمع جميع الملاحظات من المحللات
       * @private
       */
      _collectNotes(analysisResults) {
         const notes = [];

         // ملاحظات البنية
         if (analysisResults.structureAnalysis?.notes && Array.isArray(analysisResults.structureAnalysis.notes)) {
            notes.push(...analysisResults.structureAnalysis.notes);
         }

         // ملاحظات المراجع
         if (analysisResults.referenceAnalysis?.notes && Array.isArray(analysisResults.referenceAnalysis.notes)) {
            notes.push(...analysisResults.referenceAnalysis.notes);
         }

         // ملاحظات الوسائط
         if (analysisResults.mediaAnalysis?.notes && Array.isArray(analysisResults.mediaAnalysis.notes)) {
            notes.push(...analysisResults.mediaAnalysis.notes);
         }

         // ملاحظات الروابط
         if (analysisResults.linkAnalysis?.notes && Array.isArray(analysisResults.linkAnalysis.notes)) {
            notes.push(...analysisResults.linkAnalysis.notes);
         }

         // ملاحظات اللغة
         if (analysisResults.grammarAnalysis?.notes && Array.isArray(analysisResults.grammarAnalysis.notes)) {
            notes.push(...analysisResults.grammarAnalysis.notes);
         }

         // ملاحظات الصيانة
         if (analysisResults.maintenanceAnalysis?.notes && Array.isArray(analysisResults.maintenanceAnalysis.notes)) {
            notes.push(...analysisResults.maintenanceAnalysis.notes);
         }

         // ملاحظات التحليل اللغوي
         if (analysisResults.languageAnalysis?.notes && Array.isArray(analysisResults.languageAnalysis.notes)) {
            notes.push(...analysisResults.languageAnalysis.notes);
         }

         // إزالة التكرارات والحفاظ على الترتيب الأصلي
         const seen = new Set();
         const uniqueNotes = [];
         for (const n of notes) {
            const key = typeof n === 'string' ? n.trim() : JSON.stringify(n);
            if (!seen.has(key)) {
               seen.add(key);
               uniqueNotes.push(n);
            }
         }

         return uniqueNotes;
      }

      /**
       * حساب نقاط التحليل اللغوي
       * @private
       */
      _calculateLanguageScore(languageAnalysis) {
         let score = 10; // النقاط الكاملة

         // خصم نقاط على أنماط الترجمة الآلية
         if (languageAnalysis.machineTranslationSignals > 0) {
            const mtPenalty = Math.min(languageAnalysis.machineTranslationSignals * 0.1, 2);
            score -= mtPenalty;
         }

         // خصم نقاط على الأسلوب الضعيف
         if (languageAnalysis.weakStyleSignals > 0) {
            const stylePenalty = Math.min(languageAnalysis.weakStyleSignals * 0.1, 2);
            score -= stylePenalty;
         }

         // خصم نقاط على الأخطاء النحوية
         if (languageAnalysis.grammarViolations > 0) {
            const grammarPenalty = Math.min(languageAnalysis.grammarViolations * 0.15, 2);
            score -= grammarPenalty;
         }

         // خصم على الجمل الطويلة جداً
         if (languageAnalysis.longSentences > 5) {
            const longSentencePenalty = Math.min((languageAnalysis.longSentences - 5) * 0.2, 1.5);
            score -= longSentencePenalty;
         }

         // خصم على الفقرات الضعيفة
         if (languageAnalysis.emptyParagraphs > 2) {
            const emptyParaPenalty = Math.min((languageAnalysis.emptyParagraphs - 2) * 0.3, 1);
            score -= emptyParaPenalty;
         }

         // خصم على كثرة كلمات الحشو
         if (languageAnalysis.fillerWordsCount > 10) {
            const fillerPenalty = Math.min((languageAnalysis.fillerWordsCount - 10) * 0.05, 1);
            score -= fillerPenalty;
         }

         // خصم على الجمل التي تبدأ بحروف الجر
         if (languageAnalysis.prepositionStartSentences > 0) {
            const prepPenalty = Math.min(languageAnalysis.prepositionStartSentences * 0.08, 1.5);
            score -= prepPenalty;
         }

         // خصم على ضعف السرد
         if (languageAnalysis.narrativeWeaknessSignals > 0) {
            const narrativePenalty = Math.min(languageAnalysis.narrativeWeaknessSignals * 0.12, 1.5);
            score -= narrativePenalty;
         }

         // خصم على التكرار والتشابه
         if (languageAnalysis.redundantSentences > 0) {
            const redundancyPenalty = Math.min(languageAnalysis.redundantSentences * 0.25, 2);
            score -= redundancyPenalty;
         }

         // مكافأة على جودة علامات الترقيم
         if (languageAnalysis.punctuationScore > 70) {
            score += 0.5;
         }

         return Math.max(0, Math.min(10, score));
      }

      /**
       * حساب نقاط المراجع مع المعايير المتقدمة
       * @private
       */
      _calculateReferencesScore(referenceAnalysis) {
         if (!referenceAnalysis || typeof referenceAnalysis.score !== 'number') {
            return 0;
         }

         // البدء بالنقاط الأساسية من المحلل
         let score = referenceAnalysis.score;

         const details = referenceAnalysis.details || {};

         // سطر تشخيصي
         console.log('[ScoringEngine] _calculateReferencesScore - Base score:', score);

         // 1) خصم إضافي على المراجع الناقصة
         if (details.incompleteReferencesCount > 0) {
            const incompletePenalty = Math.min(details.incompleteReferencesCount * 0.15, 2);
            score -= incompletePenalty;
            console.log('[ScoringEngine] Applied incomplete penalty:', -incompletePenalty, 'New score:', score);
         }

         // 2) مكافأة على المصادر القوية (كتب ودوريات)
         if (details.referenceTypes) {
            const bookBonus = Math.min((details.referenceTypes.book || 0) * 0.2, 1);
            const journalBonus = Math.min((details.referenceTypes.journal || 0) * 0.2, 1);
            const totalBonus = bookBonus + journalBonus;
            if (totalBonus > 0) {
               score += totalBonus;
               console.log('[ScoringEngine] Applied book/journal bonus:', totalBonus, 'New score:', score);
            }
         }

         // 3) خصم إذا كانت مواقع الويب تسيطر على المصادر
         if (details.referenceTypes) {
            const web = details.referenceTypes.web || 0;
            const book = details.referenceTypes.book || 0;
            const journal = details.referenceTypes.journal || 0;
            const news = details.referenceTypes.news || 0;

            if (web > (book + journal + news)) {
               score -= 0.5;
               console.log('[ScoringEngine] Applied web dominance penalty:', -0.5, 'New score:', score);
            }
         }

         // 4) مكافأة على استخدام استشهادات ويكي بيانات
         if (details.wikidataCitationsCount > 0) {
            const wikidataBonus = Math.min(0.25 * details.wikidataCitationsCount, 1);
            score += wikidataBonus;
            console.log('[ScoringEngine] Applied wikidata bonus:', wikidataBonus, 'New score:', score);
         }

         // 5) خصم/مكافأة حسب فئة عدد المراجع
         if (details.referenceCountCategory) {
            let categoryAdjustment = 0;
            switch (details.referenceCountCategory) {
               case 'under10':
                  categoryAdjustment = -2;
                  break;
               case 'between10and20':
                  categoryAdjustment = -1;
                  break;
               case 'between20and50':
                  categoryAdjustment = 0;
                  break;
               case 'above50':
                  categoryAdjustment = 0.5;
                  break;
            }
            if (categoryAdjustment !== 0) {
               score += categoryAdjustment;
               console.log('[ScoringEngine] Applied category adjustment:', categoryAdjustment, 'New score:', score);
            }
         }

         // 6) مكافأة على التنوع اللغوي في المصادر
         if (details.referenceLanguages) {
            const ar = details.referenceLanguages.ar || 0;
            const en = details.referenceLanguages.en || 0;
            const other = details.referenceLanguages.other || 0;

            // إذا كان هناك مصادر بلغتين على الأقل
            const languagesUsed = (ar > 0 ? 1 : 0) + (en > 0 ? 1 : 0) + (other > 0 ? 1 : 0);
            if (languagesUsed >= 2) {
               score += 0.5;
               console.log('[ScoringEngine] Applied language diversity bonus:', 0.5, 'New score:', score);
            }
         }

         // التأكد من بقاء النقاط في النطاق المقبول
         const finalScore = Math.max(0, Math.min(25, score));
         console.log('[ScoringEngine] Final references score:', finalScore);
         
         // حفظ النقاط النهائية في referenceAnalysis لاستخدامها في panelRenderer
         referenceAnalysis.finalScore = finalScore;
         
         return finalScore;
      }

      /**
       * حساب نقاط الوسائط مع المعايير المتقدمة
       * @private
       */
      _calculateMediaScore(mediaAnalysis) {
         if (!mediaAnalysis || !mediaAnalysis.details) {
            return 0;
         }

         let score = 0;
         const details = mediaAnalysis.details;

         // 1) النقاط الأساسية بناءً على الصور الإعلامية وصندوق المعلومات (0-7)
         const informativeImages = details.informativeImages || 0;
         const infoboxImages = details.infoboxImages || 0;

         if (informativeImages >= 5) {
            score += 5;
         } else if (informativeImages >= 3) {
            score += 4;
         } else if (informativeImages >= 1) {
            score += 3;
         }

         // مكافأة على صور صندوق المعلومات
         if (infoboxImages > 0) {
            score += 2;
         }

         // 2) مكافأة على الوسائط المتعددة (فيديو أو صوت)
         if ((details.videos || 0) > 0 || (details.audios || 0) > 0) {
            score += 1;
         }

         // 3) مكافأة على كثافة الوسائط المناسبة
         const mediaDensity = parseFloat(details.mediaDensity) || 0;
         const correctedCount = details.articleMediaCountCorrected || 0;

         if (correctedCount > 0) {
            if (mediaDensity >= 0.3 && mediaDensity <= 1.5) {
               score += 1;
            } else if (mediaDensity > 1.5) {
               score += 1.5;
            }
         }

         // 4) خصم على الصور غير الحرة
         if (details.nonFreeImagesCount > 0) {
            const nonFreePenalty = Math.min(details.nonFreeImagesCount * 0.3, 2);
            score -= nonFreePenalty;
         }

         // 5) خصم على جودة النص البديل السيئة
         if (details.badAltTextCount > 0) {
            const altTextPenalty = Math.min(details.badAltTextCount * 0.2, 2);
            score -= altTextPenalty;
         }

         // 6) مكافأة على الأوصاف العربية في كومنز
         const commonsLikely = details.commonsLikelyCount || 0;
         const arabicDescLikely = details.arabicDescriptionLikelyCount || 0;

         if (commonsLikely > 0 && arabicDescLikely >= commonsLikely / 2) {
            score += 0.5;
         }

         // 7) خصم إذا كانت الصور المصفاة (أعلام/أيقونات) أكثر من الصور الإعلامية
         const filteredOut = details.filteredOutImages || 0;
         if (filteredOut > informativeImages) {
            score -= 1;
         }

         // التأكد من بقاء النقاط في النطاق المقبول (0-10)
         return Math.max(0, Math.min(10, score));
      }

      /**
       * إنشاء تقرير نصي مفصل للنسخ
       */
      generateTextReport(result) {
         if (!result) {
            return 'لا توجد نتائج متاحة';
         }
         
         const notes = Array.isArray(result.notes) ? result.notes : [];
         const lines = [];
         
         // العنوان واسم المقال
         lines.push('═══════════════════════════════════════════════');
         lines.push('📊 تقرير تحليل جودة المقالة - QUM v3.1');
         lines.push('═══════════════════════════════════════════════');
         
         // اسم المقال
         const articleTitle = mw?.config?.get('wgPageName')?.replace(/_/g, ' ') || 'المقالة';
         lines.push(`📖 المقالة: ${articleTitle}`);
         lines.push(`📅 تاريخ التحليل: ${new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
         lines.push('');
         
         // النتيجة الإجمالية
         lines.push('═══════════════════════════════════════════════');
         lines.push('🎯 النتيجة الإجمالية');
         lines.push('═══════════════════════════════════════════════');
         lines.push(`المجموع: ${parseFloat(result.total || 0).toFixed(1)} / 100`);
         lines.push(`التقييم: ${result.level || 'غير محدد'}`);
         lines.push('');
         
         // جدول النقاط المفصل
         lines.push('═══════════════════════════════════════════════');
         lines.push('📈 تفصيل النقاط');
         lines.push('═══════════════════════════════════════════════');
         lines.push('');
         
         // البنية
         lines.push('🏗️  البنية: ' + (result.scores?.structure || 0) + ' / 25');
         if (result.details?.structure?.details) {
            const s = result.details.structure.details;
            lines.push('   • المقدمة: ' + (s.intro?.length || 0) + ' حرفًا (' + (s.intro?.percentageOfArticle || 0) + '%)');
            lines.push('   • الأقسام: H2: ' + (s.sections?.levelCounts?.h2 || 0) + ' | H3: ' + (s.sections?.levelCounts?.h3 || 0));
            const missing = s.missingSections || [];
            lines.push('   • الأقسام المفقودة: ' + (missing.length > 0 ? missing.join('، ') : 'لا يوجد'));
         }
         lines.push('');
         
         // المراجع
         lines.push('📚 المصادر: ' + (result.scores?.references || 0) + ' / 25');
         if (result.details?.references?.details) {
            const r = result.details.references.details;
            lines.push('   • المراجع: ' + (r.totalRefs || 0));
            lines.push('   • مسماة/مكررة: ' + (r.namedRefs || 0) + ' / ' + (r.repeatedRefs || 0));
            lines.push('   • روابط عارية: ' + (r.bareUrls || 0));
            lines.push('   • سنوات حديثة: ' + (r.recentYears || 0));
            if (r.referenceTypes) {
               lines.push('   • الكتب: ' + (r.referenceTypes.book || 0) + ' | الدوريات: ' + (r.referenceTypes.journal || 0));
               lines.push('   • الأخبار: ' + (r.referenceTypes.news || 0) + ' | الويب: ' + (r.referenceTypes.web || 0));
            }
         }
         lines.push('');
         
         // الصيانة
         lines.push('🧹 الصيانة: ' + (result.scores?.maintenance || 0) + ' / 15');
         if (result.details?.maintenance?.details) {
            const m = result.details.maintenance.details;
            lines.push('   • قوالب صيانة: ' + (m.maintenanceTemplates || 0));
            lines.push('   • التصنيفات: ' + (m.categories || 0));
            if (m.categoryList && m.categoryList.length > 0) {
               lines.push('   • أمثلة: ' + m.categoryList.slice(0, 3).join('، ') + (m.categoryList.length > 3 ? '...' : ''));
            }
         }
         lines.push('');
         
         // الروابط
         lines.push('🔗 الروابط: ' + (result.scores?.links || 0) + ' / 15');
         if (result.details?.links?.details) {
            const l = result.details.links.details;
            lines.push('   • روابط داخلية: ' + (l.internalLinks || 0));
            lines.push('   • روابط حمراء: ' + (l.redLinks || 0));
            lines.push('   • كثافة: ' + (l.linkDensity || 0) + '%');
         }
         lines.push('');
         
         // الوسائط
         lines.push('🖼️  الوسائط: ' + (result.scores?.media || 0) + ' / 10');
         if (result.details?.media?.details) {
            const md = result.details.media.details;
            lines.push('   • صور المقالة: ' + (md.articleImages || 0));
            lines.push('   • صور إعلامية: ' + (md.informativeImages || 0));
            lines.push('   • صور صندوق المعلومات: ' + (md.infoboxImages || 0));
            lines.push('   • عدد الوسائط المصحح: ' + (md.articleMediaCountCorrected || 0));
            lines.push('   • كثافة الوسائط: ' + (md.mediaDensity || 0) + '%');
            lines.push('   • صور بدون وصف مناسب: ' + (md.badAltTextCount || 0));
            lines.push('   • صور غير حرة: ' + (md.nonFreeImagesCount || 0));
         }
         lines.push('');
         
         // اللغة والأسلوب
         if (result.details?.language) {
            lines.push('✍️  اللغة والأسلوب: ' + (result.scores?.language || 0) + ' / 10');
            const lang = result.details.language;
            lines.push('   • الجمل: ' + (lang.sentenceCount || 0) + ' (متوسط: ' + (lang.avgSentenceLength || 0) + ' حرف)');
            lines.push('   • أنماط ترجمة آلية: ' + (lang.machineTranslationSignals || 0));
            lines.push('   • أخطاء نحوية: ' + (lang.grammarViolations || 0));
            lines.push('   • كلمات حشو: ' + (lang.fillerWordsCount || 0));
            lines.push('   • درجة الترقيم: ' + (lang.punctuationScore || 0) + '/100');
            lines.push('');
         }
         
         // استقرار المقالة
         if (result.details?.revision) {
            lines.push('⚖️  استقرار المقالة: ' + (result.details.revision.details.stabilityScore || 0) + ' / 10');
            const rev = result.details.revision.details;
            lines.push('   • تقدير التعديلات (آخر 90 يوم): ' + (rev.estimatedEditsLast90Days || 0));
            lines.push('   • تقدير عدد المحررين: ' + (rev.estimatedUniqueEditors || 0));
            lines.push('   • حروب تحرير: ' + (rev.hasEditWars ? 'نعم' : 'لا'));
            
            // تفاصيل الحماية
            if (rev.hasProtection) {
               let protectionText = '   • حماية الصفحة: نعم';
               
               if (rev.protectionLevel) {
                  const levelLabels = {
                     'sysop': ' (كلياً - إداريين فقط)',
                     'autoconfirmed': ' (جزئياً - مؤكدين تلقائياً)',
                     'extendedconfirmed': ' (ممتدة - مؤكدين ممتدين)',
                     'templateeditor': ' (قوالب - محررو قوالب)'
                  };
                  protectionText += levelLabels[rev.protectionLevel] || ` (${rev.protectionLevel})`;
               }
               
               lines.push(protectionText);
               
               // تاريخ انتهاء الحماية
               if (rev.protectionExpiry && rev.protectionExpiry !== 'infinity' && rev.protectionExpiry !== 'infinite') {
                  try {
                     const expiryDate = new Date(rev.protectionExpiry);
                     const now = new Date();
                     
                     if (expiryDate > now) {
                        const formattedDate = expiryDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
                        const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
                        lines.push(`   • تنتهي الحماية في: ${formattedDate} (${daysLeft} يوم متبقي)`);
                     }
                  } catch (e) {
                     // تجاهل أخطاء التحليل
                  }
               } else if (rev.protectionExpiry === 'infinity' || rev.protectionExpiry === 'infinite') {
                  lines.push('   • نوع الحماية: دائمة');
               }
            } else {
               lines.push('   • حماية الصفحة: لا');
            }
            
            // الأحداث الجارية
            if (rev.isCurrentEvent) {
               lines.push('   • حدث جاري/متطور: نعم');
               lines.push('   • تحذير: المعلومات قد تتغير بسرعة');
            }
            
            lines.push('');
         }
         
         // تكامل ويكي بيانات
         if (result.details?.wikidataIntegration) {
            lines.push('🌐 تكامل ويكي بيانات: ' + (result.details.wikidataIntegration.details.crossProjectScore || 0) + ' / 10');
            const wd = result.details.wikidataIntegration.details;
            lines.push('   • ربط ويكي بيانات: ' + (wd.linkedToWikidata ? 'نعم' : 'لا'));
            lines.push('   • الوصلات بين اللغوية: ' + (wd.interwikiLinksCount || 0));
            lines.push('   • صناديق المشاريع الشقيقة: ' + (wd.sisterProjectBoxesCount || 0));
            lines.push('');
         }
         
         // الملاحظات
         lines.push('═══════════════════════════════════════════════');
         lines.push('💡 ملاحظات واقتراحات تحسين');
         lines.push('═══════════════════════════════════════════════');
         
         if (notes.length > 0) {
            notes.forEach((note, i) => {
               // تنظيف الملاحظات من HTML tags
               const cleanNote = note.replace(/<[^>]+>/g, '').trim();
               lines.push(`${i + 1}. ${cleanNote}`);
            });
         } else {
            lines.push('✓ لا توجد ملاحظات كبيرة. المقالة في حالة جيدة.');
         }
         
         lines.push('');
         lines.push('═══════════════════════════════════════════════');
         lines.push('تم إنشاء هذا التقرير بواسطة QUM v3.1');
         lines.push('═══════════════════════════════════════════════');

         return lines.join('\n');
      }

      /**
       * تحديث الأوزان (إن لزم الأمر)
       */
      setWeights(newWeights) {
         this.weights = { ...this.weights, ...newWeights };
      }
   }

   // تصدير
   window.QualityUltraMax = window.QualityUltraMax || {};
   window.QualityUltraMax.ScoringEngine = ScoringEngine;

})(window);
