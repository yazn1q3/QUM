/**
 * panelRenderer.js
 * واجهة المستخدم الرئيسية - عرض لوحة النتائج
 */

(function(window) {
   'use strict';

   class PanelRenderer {
      constructor() {
         this.panelId = 'qum-analysis-panel';
         this.overlayId = 'qum-overlay';
      }
      render(result) {
         this._removeExisting();
         this._injectStyles();
         
         const $overlay = this._createOverlay();
         const $panel = this._createPanel(result);
        

         $('body').append($overlay);
         $('body').append($panel);
         
         this._attachEvents($overlay, $panel, result);
         
         if (this._isDarkModeEnabled()) {
            $panel.addClass('qum-dark-mode');
         }
      }


      _removeExisting() {
         $(`#${this.panelId}, #${this.overlayId}`).remove();
      }


      _createOverlay() {
         return $('<div>')
            .attr('id', this.overlayId)
            .addClass('qum-overlay');
      }


      _createPanel(result) {
         const $panel = $('<div>')
            .attr('id', this.panelId)
            .addClass('qum-panel');

         const $header = this._createHeader(result);
         $panel.append($header);

         const $summary = this._createSummary(result);
         $panel.append($summary);

         const $scoresTable = this._createScoresTable(result);
         $panel.append($scoresTable);

         const $notes = this._createNotes(result);
         $panel.append($notes);

         return $panel;
      }


      _createHeader(result) {
         const $header = $('<div>').addClass('qum-header');
         
         const version = window.QualityUltraMax.VERSION || '3.0';
         const $title = $('<h2>').html(`📊 لوحة تحليل جودة المقالة <span class="qum-version">v${version}</span>`);
         $header.append($title);
         
         const $buttons = $('<div>').addClass('qum-buttons');
         $buttons.append('<button id="qum-dark-toggle" title="تبديل الوضع الداكن">🌓</button>');
         $buttons.append('<button id="qum-copy" title="نسخ التقرير">📋</button>');
         $buttons.append('<button id="qum-close" title="إغلاق">×</button>');
         
         $header.append($buttons);
         
         return $header;
      }

      _createSummary(result) {
         const $summary = $('<div>')
            .addClass('qum-summary')
            .addClass(`qum-${result.levelClass}`);
         
         const articleTitle = mw?.config?.get('wgPageName')?.replace(/_/g, ' ') || 'المقالة';
         const namespace = mw?.config?.get('wgNamespaceNumber') || 0;
         
         if (namespace === 2) {
            $summary.append(`<div class="qum-sandbox-notice">
               <strong>💡 ملاحظة:</strong> هذا التحليل لمسودة في صفحة مستخدم. يمكنك استخدام النتائج لتحسين المقالة قبل نشرها في النطاق الرئيسي.
            </div>`);
         }
         
         $summary.append(`<h2 class="qum-article-title">📖 ${articleTitle}</h2>`);
         
         $summary.append(`<h3>${result.level} — المجموع ${parseFloat(result.total).toFixed(1)} / 100</h3>`);
         
         const $progressBar = $('<div>').addClass('qum-progress-container');
         const $progress = $('<div>')
            .addClass('qum-progress')
            .css('width', `${result.total}%`);
         $progressBar.append($progress);
         $summary.append($progressBar);
         
         return $summary;
      }


      _createScoresTable(result) {
         const $table = $('<table>').addClass('qum-table');
         
         const $thead = $('<thead>');
         $thead.append(`
            <tr>
               <th>المحور</th>
               <th>النقاط</th>
               <th>التفاصيل</th>
            </tr>
         `);
         $table.append($thead);
         
         const $tbody = $('<tbody>');
         
         $tbody.append(this._createScoreRow(
            '🏗️ البنية',
            result.scores.structure,
            25,
            this._getStructureDetails(result.details.structure)
         ));
         
         $tbody.append(this._createScoreRow(
            '📚 المصادر',
            result.scores.references,
            25,
            this._getReferencesDetails(result.details.references, result.scores.references)
         ));
         
         $tbody.append(this._createScoreRow(
            '🧹 الصيانة',
            result.scores.maintenance,
            15,
            this._getMaintenanceDetails(result.details.maintenance)
         ));
         
         $tbody.append(this._createScoreRow(
            '🔗 الروابط',
            result.scores.links,
            15,
            this._getLinksDetails(result.details.links)
         ));
         
         $tbody.append(this._createScoreRow(
            '🖼️ الوسائط',
            result.scores.media,
            10,
            this._getMediaDetails(result.details.media)
         ));
         
         if (result.details.language) {
            $tbody.append(this._createScoreRow(
               '✍️ اللغة والأسلوب',
               result.scores.language,
               10,
               this._getLanguageDetails(result.details.language)
            ));
         }
         
         if (result.details.revision) {
            $tbody.append(this._createScoreRow(
               '⚖️ استقرار المقالة',
               result.details.revision.details.stabilityScore || 0,
               10,
               this._getRevisionDetails(result.details.revision)
            ));
         }
         
         if (result.details.wikidataIntegration) {
            $tbody.append(this._createScoreRow(
               '🌐 تكامل ويكي بيانات',
               result.details.wikidataIntegration.details.crossProjectScore || 0,
               10,
               this._getWikidataIntegrationDetails(result.details.wikidataIntegration)
            ));
         }
         
         $table.append($tbody);
         
         return $table;
      }


      _createScoreRow(title, score, maxScore, details) {
         const percentage = ((score / maxScore) * 100).toFixed(0);
         
         return $('<tr>').append([
            $('<td>').text(title),
            $('<td>').html(`<strong>${score}</strong> / ${maxScore}`),
            $('<td>').addClass('qum-details').html(details)
         ]);
      }


      _getStructureDetails(structure) {
         if (!structure || !structure.details) {
            return '<em>لا توجد بيانات متاحة</em>';
         }
         
         const details = structure.details;
         const introLength = details.intro?.length || 0;
         const introPercent = details.intro?.percentageOfArticle || 0;
         const h2Count = details.sections?.levelCounts?.h2 || 0;
         const h3Count = details.sections?.levelCounts?.h3 || 0;
         const missingSections = Array.isArray(details.missingSections) ? details.missingSections : [];
         
         return `
            <strong>المقدمة:</strong> ${introLength} حرفًا (${introPercent}%)<br>
            <strong>الأقسام:</strong> H2: ${h2Count} | H3: ${h3Count}<br>
            <strong>الأقسام المفقودة:</strong> ${missingSections.length > 0 ? missingSections.join('، ') : 'لا يوجد'}
         `;
      }


      _getReferencesDetails(refs, actualScoreFromResult) {
         if (!refs || !refs.details) {
            return '<em>لا توجد بيانات متاحة</em>';
         }
         
         const details = refs.details;
         let html = `
            <strong>المراجع:</strong> ${details.totalRefs || 0}<br>
            <strong>مسماة/مكررة:</strong> ${details.namedRefs || 0} / ${details.repeatedRefs || 0}<br>
            <strong>روابط عارية:</strong> ${details.bareUrls || 0}<br>
            <strong>سنوات حديثة:</strong> ${details.recentYears || 0}
         `;

         if (details.referenceCountCategory) {
            const categoryLabels = {
               'under10': 'أقل من 10',
               'between10and20': 'بين 10 و 20',
               'between20and50': 'بين 20 و 50',
               'above50': 'أكثر من 50'
            };
            html += `<br><strong>تصنيف عدد المراجع:</strong> ${categoryLabels[details.referenceCountCategory] || details.referenceCountCategory}`;
         }

         if (details.referenceTypes) {
            html += '<br><br><strong>أنواع المراجع:</strong><ul class="qum-reference-types-list">';
            html += `<li>الكتب: ${details.referenceTypes.book || 0}</li>`;
            html += `<li>الدوريات: ${details.referenceTypes.journal || 0}</li>`;
            html += `<li>الأخبار: ${details.referenceTypes.news || 0}</li>`;
            html += `<li>الويب: ${details.referenceTypes.web || 0}</li>`;
            html += `<li>الأرشيف: ${details.referenceTypes.archive || 0}</li>`;
            html += `<li>ويكي بيانات: ${details.referenceTypes.wikidata || 0}</li>`;
            
            if (details.referenceTypes.empty && details.referenceTypes.empty > 0) {
               html += `<li class="qum-empty-refs-warning">⚠️ مراجع فارغة: ${details.referenceTypes.empty}</li>`;
            }
            
            html += '</ul>';
            
            if (details.multiTypeStatistics && details.multiTypeStatistics.hasInflation && details.multiTypeStatistics.inflationCount > 0) {
               const stats = details.multiTypeStatistics;
               html += '<div class="qum-info-box">';
               html += `<strong>ℹ️ توضيح:</strong> مجموع الأنواع (${stats.totalClassifications}) أكبر من عدد المراجع (${stats.totalReferences})<br>`;
               html += '<span class="qum-info-box-small-text">السبب: المرجع الواحد قد يُصنف بأكثر من نوع</span>';
               if (stats.inflationReasons && stats.inflationReasons.length > 0) {
                  html += '<ul class="qum-info-box-list">';
                  stats.inflationReasons.forEach(reason => {
                     if (reason.type === 'archive') {
                        const percentage = Math.round((reason.count / stats.totalReferences) * 100);
                        html += `<li>${reason.count} مرجع (${percentage}%) يحتوي على روابط أرشيف</li>`;
                     } else if (reason.type === 'multi-type') {
                        html += `<li>${reason.reason}</li>`;
                     }
                  });
                  html += '</ul>';
               }
               html += '</div>';
            }
         }

         if (details.referenceLanguages) {
            html += '<br><strong>لغات المصادر:</strong><ul class="qum-reference-types-list">';
            html += `<li>العربية: ${details.referenceLanguages.ar || 0}</li>`;
            html += `<li>الإنجليزية: ${details.referenceLanguages.en || 0}</li>`;
            html += `<li>لغات أخرى: ${details.referenceLanguages.other || 0}</li>`;
            html += '</ul>';
         }

         if (details.wikidataCitationsCount !== undefined) {
            html += `<br><strong>استشهادات ويكي بيانات:</strong> ${details.wikidataCitationsCount}`;
         }

         if (details.incompleteReferencesCount !== undefined) {
            html += `<br><strong>مراجع ناقصة:</strong> ${details.incompleteReferencesCount}`;
            
            if (details.incompleteReferences && details.incompleteReferences.length > 0) {
               html += '<ul class="qum-incomplete-refs-list">';
               details.incompleteReferences.slice(0, 3).forEach(ref => {
                  if (!ref) return;
                  html += '<li>';
                  html += `<strong>النوع:</strong> ${ref.type || 'غير محدد'}<br>`;
                  html += `<strong>الحقول الناقصة:</strong> ${Array.isArray(ref.missing) ? ref.missing.join('، ') : 'غير محدد'}<br>`;
                  const snippet = ref.snippet || '';
                  html += `<strong>مقتطف:</strong> ${this._escapeHtml(snippet.substring(0, 80))}${snippet.length > 80 ? '...' : ''}`;
                  html += '</li>';
               });
               html += '</ul>';
            }
         }

         const actualScore = parseFloat(actualScoreFromResult) || parseFloat(refs.score) || 0;
         
         console.log('[PanelRenderer] refs object:', refs);
         console.log('[PanelRenderer] actualScoreFromResult:', actualScoreFromResult);
         console.log('[PanelRenderer] actualScore (final):', actualScore);
         
         html += '<div class="qum-scoring-breakdown">';
         html += '<strong>📊 تفصيل التقييم:</strong><br>';
         html += '<ul class="qum-scoring-list">';
         
         const totalRefs = details.totalRefs || 0;
         let refScore = 0;
         if (totalRefs === 0) refScore = 0;
         else if (totalRefs === 1) refScore = 3;
         else if (totalRefs <= 3) refScore = 7;
         else if (totalRefs <= 7) refScore = 11;
         else if (totalRefs <= 15) refScore = 14;
         else refScore = 15;
         html += `<li><strong>عدد المراجع (أساسي):</strong> ${refScore}/15 (${totalRefs} مرجع)</li>`;
         
         const totalCitations = (details.completeCitations || 0) + (details.incompleteCitations || 0);
         let qualityScore = 0;
         if (totalCitations > 0) {
            const qualityRatio = (details.completeCitations || 0) / totalCitations;
            if (qualityRatio >= 0.8) qualityScore = 4;
            else if (qualityRatio >= 0.6) qualityScore = 3;
            else if (qualityRatio >= 0.4) qualityScore = 2;
            else qualityScore = 1;
            html += `<li><strong>جودة القوالب:</strong> ${qualityScore}/4 (${(qualityRatio * 100).toFixed(0)}% كاملة)</li>`;
         } else {
            html += `<li><strong>جودة القوالب:</strong> 0/4 (لا توجد قوالب استشهاد)</li>`;
         }
         
         const recentYears = details.recentYears || 0;
         let recencyScore = 0;
         if (recentYears >= 5) recencyScore = 3;
         else if (recentYears >= 3) recencyScore = 2;
         else if (recentYears >= 1) recencyScore = 1;
         html += `<li><strong>حداثة المصادر:</strong> ${recencyScore}/3 (${recentYears} مصدر حديث 2015-2025)</li>`;
         
         const reliableCount = details.reliableSourcesCount || 0;
         let reliabilityScore = 0;
         if (reliableCount >= 5) reliabilityScore = 3;
         else if (reliableCount >= 2) reliabilityScore = 2;
         else if (reliableCount >= 1) reliabilityScore = 1;
         html += `<li><strong>موثوقية المصادر:</strong> ${reliabilityScore}/3 (${reliableCount} مصدر موثوق)</li>`;
         
         let penalties = 0;
         if (details.bareUrls > 0) {
            const bareUrlPenalty = Math.min(6, details.bareUrls * 2);
            penalties += bareUrlPenalty;
            html += `<li><strong>⚠️ عقوبة روابط عارية:</strong> -${bareUrlPenalty} (${details.bareUrls} رابط)</li>`;
         }
         if (!details.hasReferencesSection && totalRefs > 0) {
            penalties += 2;
            html += `<li><strong>⚠️ عقوبة عدم وجود قسم مراجع:</strong> -2</li>`;
         }
         
         const basicCalculation = refScore + qualityScore + recencyScore + reliabilityScore - penalties;
         const bonusAndAdjustments = actualScore - basicCalculation;
         
         console.log('[PanelRenderer] Scoring breakdown:', {
            actualScore,
            basicCalculation,
            bonusAndAdjustments,
            refScore,
            qualityScore,
            recencyScore,
            reliabilityScore,
            penalties
         });
         
         if (bonusAndAdjustments > 0.1) {
            html += `<li><strong>✨ مكافآت إضافية:</strong> +${bonusAndAdjustments.toFixed(1)} `;
            html += '<span class="qum-bonus-text">(تنوع لغوي، كتب/دوريات، فئة المراجع، استشهادات ويكي بيانات)</span></li>';
         } else if (bonusAndAdjustments < -0.1) {
            html += `<li><strong>⚠️ خصومات إضافية:</strong> ${bonusAndAdjustments.toFixed(1)} `;
            html += '<span class="qum-bonus-text">(مراجع ناقصة، سيطرة مواقع الويب)</span></li>';
         }
         
         html += '</ul>';
         html += `<div class="qum-final-score-box">`;
         html += `<strong class="qum-final-score-text">المجموع النهائي: ${actualScore.toFixed(1)} / 25</strong>`;
         html += `</div>`;
         html += '</div>';

         return html;
      }


      _getMaintenanceDetails(maintenance) {
         if (!maintenance || !maintenance.details) {
            return '<em>لا توجد بيانات متاحة</em>';
         }
         
         const details = maintenance.details;
         let html = `
            <strong>قوالب صيانة:</strong> ${details.maintenanceTemplates || 0}<br>
            <strong>التصنيفات:</strong> ${details.categories || 0}
         `;

         if (details.categoryList && Array.isArray(details.categoryList) && details.categoryList.length > 0) {
            html += '<div class="qum-category-box">';
            html += '<strong>📂 قائمة التصنيفات:</strong><br>';
            html += '<ul class="qum-category-list">';
            
            details.categoryList.forEach(cat => {
               const cleanName = cat.replace(/^(تصنيف|Category):/i, '');
               html += `<li>${this._escapeHtml(cleanName)}</li>`;
            });
            
            html += '</ul></div>';
         }

         if (details.maintenanceCategoryList && Array.isArray(details.maintenanceCategoryList) && details.maintenanceCategoryList.length > 0) {
            html += '<div class="qum-maintenance-category-box">';
            html += '<strong>🔧 تصنيفات (مخفية):</strong><br>';
            html += '<ul class="qum-category-list">';
            
            details.maintenanceCategoryList.forEach(cat => {
               const cleanName = cat.replace(/^(تصنيف|Category):/i, '');
               html += `<li>${this._escapeHtml(cleanName)}</li>`;
            });
            
            html += '</ul></div>';
         }

         return html;
      }


      _getLinksDetails(links) {
         if (!links || !links.details) {
            return '<em>لا توجد بيانات متاحة</em>';
         }
         
         const details = links.details;
         
         let html = `
            <strong>روابط داخلية:</strong> ${details.internalLinks || 0}<br>
            <strong>روابط حمراء:</strong> ${details.redLinks || 0}<br>
            <strong>كثافة:</strong> ${details.linkDensity || 0}%
         `;
         
         if (details.duplicateLinksInSections !== undefined) {
            html += `<br><strong>🔄 وصلات مكررة في الفقرات/القوائم:</strong> ${details.duplicateLinksInSections || 0}`;
            
            if (details.duplicateLinksInSections > 0 && details.duplicateLinksExamples && details.duplicateLinksExamples.length > 0) {
               html += '<br><strong>أمثلة:</strong>';
               html += '<ul class="qum-details-list">';
               details.duplicateLinksExamples.forEach(ex => {
                  html += `<li>`;
                  const sectionName = ex.section || 'المقدمة';
                  const sectionClass = sectionName === 'المقدمة' ? ' class="qum-section-intro"' : '';
                  html += `<strong${sectionClass}>${this._escapeHtml(sectionName)}:</strong> `;
                  html += `<span class="qum-link-text">${this._escapeHtml(ex.link)}</span> `;
                  html += `<span class="qum-count-text">(×${ex.count})</span>`;
                  if (ex.context) {
                     html += `<br><span class="qum-context-text">${this._escapeHtml(ex.context)}</span>`;
                  }
                  html += `</li>`;
               });
               html += '</ul>';
            }
         }
         
         if (details.yearLinksInTables !== undefined) {
            html += `<br><strong>📅 وصلات سنوات مكررة في الجداول:</strong> ${details.yearLinksInTables || 0}`;
            
            if (details.yearLinksInTables > 0 && details.yearLinksInTablesExamples && details.yearLinksInTablesExamples.length > 0) {
               html += '<br><strong>أمثلة:</strong>';
               html += '<ul class="qum-details-list">';
               details.yearLinksInTablesExamples.forEach(ex => {
                  html += `<li>`;
                  html += `<strong>${this._escapeHtml(ex.section)}:</strong> `;
                  html += `<span class="qum-link-year">${this._escapeHtml(ex.link)}</span> `;
                  html += `<span class="qum-count-text">(×${ex.count})</span>`;
                  if (ex.context) {
                     html += `<br><span class="qum-context-text">${this._escapeHtml(ex.context)}</span>`;
                  }
                  html += `</li>`;
               });
               html += '</ul>';
            }
         }
         
         if ((details.duplicateLinksInSections > 0) || (details.yearLinksInTables > 0)) {
            html += '<br><div class="qum-note-box">';
            html += '<strong>✅ ملاحظة:</strong> التكرارات تُحسب كالتالي:<br>';
            html += '• <strong>الفقرات والقوائم:</strong> تكرار داخل نفس العنصر فقط<br>';
            html += '• <strong>الجداول - السنوات:</strong> تُعد عبر الجدول بأكمله<br>';
            html += '• <strong>الجداول - الروابط العادية:</strong> تُعد داخل الخلية فقط';
            html += '<br><em class="qum-note-em">💡 حسب <a href="https://ar.wikipedia.org/wiki/ويكيبيديا:دليل_الأسلوب/وصلات" target="_blank" class="qum-note-link">دليل الأسلوب</a>: "لا تربط نفس الكلمة أكثر من مرة واحدة"</em>';
            html += '</div>';
         }
         
         return html;
      }


      _getMediaDetails(media) {
         if (!media || !media.details) {
            return '<em>لا توجد بيانات متاحة</em>';
         }
         
         const details = media.details;
         let html = `
            <strong>صور المقالة:</strong> ${details.articleImages || 0}<br>
            <strong>صور إعلامية:</strong> ${details.informativeImages || 0}<br>
            <strong>صور زخرفية:</strong> ${details.decorativeImages || 0}<br>
            <strong>صور صندوق المعلومات:</strong> ${details.infoboxImages || 0}<br>
            <strong>عدد الوسائط المصحح:</strong> ${details.articleMediaCountCorrected || 0}<br>
            <strong>فيديو/صوت:</strong> ${(details.videos || 0) + (details.audios || 0)}
         `;

         if (details.mediaDensity !== undefined) {
            html += `<br><br><strong>كثافة الوسائط:</strong> ${details.mediaDensity}%`;
         }

         html += '<br><br><strong>🔍 جودة الوسائط:</strong><br>';
         html += `• صور غير حرة: ${details.nonFreeImagesCount || 0}<br>`;
         html += `• صور مصفاة (أعلام/أيقونات): ${details.filteredOutImages || 0}<br>`;
         html += `• صور بدون وصف مناسب: ${details.badAltTextCount || 0}<br>`;
         html += `• صور محتملة من كومنز: ${details.commonsLikelyCount || 0}<br>`;
         html += `• صور بوصف عربي محتمل: ${details.arabicDescriptionLikelyCount || 0}`;

         if (details.examples && details.examples.filteredOut && details.examples.filteredOut.length > 0) {
            html += '<br><br><strong>أمثلة على الوسائط المصفاة:</strong>';
            html += '<ul class="qum-details-list">';
            details.examples.filteredOut.forEach(ex => {
               html += `<li class="qum-code-item"><code class="qum-code-text">${this._escapeHtml(ex.filename)}</code> - ${this._escapeHtml(ex.reason)}</li>`;
            });
            html += '</ul>';
         }

         if (details.examples && details.examples.nonFreeImages && details.examples.nonFreeImages.length > 0) {
            html += '<br><strong>أمثلة على الصور غير الحرة:</strong>';
            html += '<ul class="qum-details-list">';
            details.examples.nonFreeImages.forEach(ex => {
               html += `<li class="qum-code-item"><code class="qum-code-text">${this._escapeHtml(ex)}</code></li>`;
            });
            html += '</ul>';
         }

         if (details.examples && details.examples.noArabicDescription && details.examples.noArabicDescription.length > 0) {
            html += '<br><strong>صور (كومنز) بدون وصف عربي:</strong>';
            html += '<ul class="qum-details-list">';
            details.examples.noArabicDescription.forEach(ex => {
               html += `<li class="qum-code-item"><code class="qum-code-text">${this._escapeHtml(ex)}</code></li>`;
            });
            html += '<br><strong>الرجاء إضافة وصف داخل صفحة الملف في ويكيميديا كومنز.</strong>';
            html += '</ul>';
         }

         if (details.examples && details.examples.badAltText && details.examples.badAltText.length > 0) {
            html += '<br><br><strong>أمثلة على الصور بدون وصف مناسب:</strong>';
            html += '<ul class="qum-details-list">';
            details.examples.badAltText.forEach(ex => {
               html += '<li class="qum-media-example-item">';
               html += `<strong>الملف:</strong> <code class="qum-code-text">${this._escapeHtml(ex.filename)}</code><br>`;
               const caption = ex.caption || ex.alt || '(مفقود)';
               html += `<strong>الوصف الحالي:</strong> "${this._escapeHtml(caption)}"<br>`;
               html += `<strong>المشكلة:</strong> ${this._escapeHtml(ex.issue)}`;
               html += '</li>';
            });
            html += '</ul>';
         }

         return html;
      }


      _getLanguageDetails(language) {
         if (!language) {
            return '<em>لا توجد بيانات متاحة</em>';
         }
         
         let html = `
            <strong>الجمل:</strong> ${language.sentenceCount || 0} (متوسط: ${language.avgSentenceLength || 0} حرف)<br>
            <strong>أنماط ترجمة آلية:</strong> ${language.machineTranslationSignals || 0}<br>
         `;

         if (language.narrativeWeaknessSignals > 0) {
            html += `<strong>ضعف السرد:</strong> ${language.narrativeWeaknessSignals}`;
            if (language.examples && language.examples.narrativeWeakness && language.examples.narrativeWeakness.length > 0) {
               html += '<ul class="qum-details-list-small">';
               language.examples.narrativeWeakness.slice(0, 3).forEach(ex => {
                  let example = ex || '';
                  example = example.replace(/<math[^>]*>[\s\S]*?<\/math>/gi, '[صيغة رياضية]');
                  example = example.replace(/\{\{[^}]+\}\}/g, '');
                  example = example.trim();
                  if (example.length > 0 && example !== '[صيغة رياضية]') {
                     html += `<li>${this._escapeHtml(example.substring(0, 60))}${example.length > 60 ? '...' : ''}</li>`;
                  }
               });
               html += '</ul>';
            } else {
               html += '<br>';
            }
         }

         if (language.prepositionStartSentences > 0) {
            html += `<strong>جمل تبدأ بحروف جر:</strong> ${language.prepositionStartSentences}`;
            if (language.examples && language.examples.prepositionStartSentences && language.examples.prepositionStartSentences.length > 0) {
               html += '<ul class="qum-details-list-small">';
               language.examples.prepositionStartSentences.slice(0, 3).forEach(ex => {
                  html += `<li>${this._escapeHtml(ex)}</li>`;
               });
               html += '</ul>';
            } else {
               html += '<br>';
            }
         }

         if (language.redundantSentences > 0) {
            html += `<strong>جمل متكررة/متشابهة:</strong> ${language.redundantSentences}`;
            if (language.examples && language.examples.redundantSentences && language.examples.redundantSentences.length > 0) {
               html += '<ul class="qum-details-list-small">';
               language.examples.redundantSentences.slice(0, 3).forEach(ex => {
                  if (!ex) return;
                  const s1 = ex.s1 || '';
                  const s2 = ex.s2 || '';
                  const similarity = ex.similarity || 0;
                  html += `<li>تشابه ${similarity}%: "${this._escapeHtml(s1)}" ≈ "${this._escapeHtml(s2)}"</li>`;
               });
               html += '</ul>';
            } else {
               html += '<br>';
            }
         }

         if (language.examples && language.examples.grammarRuleHits && language.examples.grammarRuleHits.length > 0) {
            const validRules = language.examples.grammarRuleHits
               .filter(hit => hit && hit.name && hit.name.trim() !== '' && hit.name !== 'قاعدة مجهولة');
            
            const totalViolations = validRules.reduce((sum, hit) => sum + (hit.count || 0), 0);
            
            html += `<strong>أخطاء نحوية:</strong> ${totalViolations}`;
            
            const topRules = validRules.slice(0, 5);
            
            if (topRules.length > 0) {
               html += '<ul class="qum-details-list-small">';
               topRules.forEach(hit => {
                  html += `<li><strong>${this._escapeHtml(hit.name)}</strong>: ${hit.count || 0} مرات`;
                  
                  if (hit.examples && Array.isArray(hit.examples) && hit.examples.length > 0) {
                     const validExamples = hit.examples.filter(ex => ex && ex.length > 0 && ex.length < 50);
                     if (validExamples.length > 0) {
                        html += '<br><span class="qum-grammar-example">مثال: ';
                        html += validExamples.slice(0, 2).map(ex => `"${this._escapeHtml(ex)}"`).join('، ');
                        html += '</span>';
                     }
                  }
                  
                  html += '</li>';
               });
               if (validRules.length > 5) {
                  html += `<li class="qum-grammar-more"><em>و ${validRules.length - 5} قواعد أخرى...</em></li>`;
               }
               html += '</ul>';
            } else {
               html += ' (تفاصيل غير متاحة)<br>';
            }
         } else {
            html += `<strong>أخطاء نحوية:</strong> ${language.grammarViolations || 0}`;
            html += ' (تفاصيل غير متاحة)<br>';
         }

         html += `<strong>كلمات حشو:</strong> ${language.fillerWordsCount}<br>`;

         html += `<strong>درجة الترقيم:</strong> ${language.punctuationScore}/100`;

         return html;
      }


      _getRevisionDetails(revision) {
         if (!revision || !revision.details) {
            return '<em class="qum-no-data">لا تتوفر بيانات كافية عن الاستقرار</em>';
         }

         const details = revision.details;
         let html = '';

         html += `<strong>درجة الاستقرار:</strong> ${details.stabilityScore || 0} / 10<br>`;

         html += `<strong>تقدير التعديلات (آخر 90 يوم):</strong> ${details.estimatedEditsLast90Days || 0}<br>`;

         html += `<strong>تقدير عدد المحررين:</strong> ${details.estimatedUniqueEditors || 0}<br>`;

         html += `<strong>وجود حروب تحرير:</strong> ${details.hasEditWars ? '⚠️ نعم' : '✅ لا'}<br>`;

         html += `<strong>حماية الصفحة:</strong> `;
         if (details.hasProtection) {
            html += '🔒 نعم';
            if (details.protectionLevel) {
               const levelLabels = {
                  'sysop': ' (كلياً - إداريين فقط)',
                  'autoconfirmed': ' (جزئياً - مؤكدين تلقائياً)',
                  'extendedconfirmed': ' (ممتدة - مؤكدين ممتدين)',
                  'templateeditor': ' (قوالب - محررو قوالب)',
                  'unknown': ' (نوع غير محدد)'
               };
               html += levelLabels[details.protectionLevel] || ` (${details.protectionLevel})`;
            }
            
            if (details.protectionExpiry && details.protectionExpiry !== 'infinity' && details.protectionExpiry !== 'infinite') {
               try {
                  const expiryDate = new Date(details.protectionExpiry);
                  const now = new Date();
                  
                  if (expiryDate > now) {
                     const options = { year: 'numeric', month: 'long', day: 'numeric' };
                     const formattedDate = expiryDate.toLocaleDateString('ar-EG', options);
                     html += `<br><span class="qum-protection-expiry">⏰ تنتهي في: ${formattedDate}</span>`;
                     
                     const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
                     if (daysLeft <= 7) {
                        html += ` <span class="qum-protection-days-warning">(${daysLeft} يوم متبقي)</span>`;
                     } else if (daysLeft <= 30) {
                        html += ` <span class="qum-protection-days-info">(${daysLeft} يوم متبقي)</span>`;
                     }
                  }
               } catch (e) {
                  console.warn('[PanelRenderer] Failed to parse protection expiry:', details.protectionExpiry);
               }
            } else if (details.protectionExpiry === 'infinity' || details.protectionExpiry === 'infinite') {
               html += '<br><span class="qum-protection-permanent">♾️ حماية دائمة</span>';
            }
         } else {
            html += 'لا';
         }
         html += '<br>';

         if (details.isCurrentEvent) {
            html += `<strong>حدث جاري/متطور:</strong> <span class="qum-current-event">📰 نعم</span>`;
            html += '<br><span class="qum-current-event-warning">⚠️ المعلومات قد تتغير بسرعة</span><br>';
         }

         html += `<strong>إشارات عدم الاستقرار:</strong> ${details.revisionSignalsCount || 0}`;

         if (details.largeEditsCount > 0) {
            html += `<br><br><strong>أقسام غير متوازنة:</strong> ${details.largeEditsCount}`;
            if (details.examples && details.examples.largeEdits && details.examples.largeEdits.length > 0) {
               html += '<ul class="qum-details-list">';
               details.examples.largeEdits.forEach(ex => {
                  if (!ex) return;
                  html += '<li>';
                  html += `<strong>${this._escapeHtml(ex.section || 'غير محدد')}</strong><br>`;
                  html += `المشكلة: ${ex.issue || 'غير محدد'} (${ex.length || 0} حرف)`;
                  html += '</li>';
               });
               html += '</ul>';
            }
         }

         if (details.examples && details.examples.instabilitySignals && details.examples.instabilitySignals.length > 0) {
            html += '<br><strong>تفاصيل إشارات عدم الاستقرار:</strong>';
            html += '<ul class="qum-details-list">';
            details.examples.instabilitySignals.forEach(signal => {
               html += `<li>${this._escapeHtml(signal)}</li>`;
            });
            html += '</ul>';
         }

         return html;
      }


      _getWikidataIntegrationDetails(integration) {
         if (!integration || !integration.details) {
            return '<em class="qum-no-data">لا تتوفر بيانات حول تكامل ويكي بيانات والمشاريع الشقيقة.</em>';
         }

         const details = integration.details;
         let html = '';

         html += `<strong>درجة التكامل:</strong> ${details.crossProjectScore || 0} / 10<br>`;

         html += `<strong>ربط ويكي بيانات:</strong> `;
         if (details.linkedToWikidata) {
            html += '✅ نعم';
            if (details.wikidataItemId) {
               html += ` (${this._escapeHtml(details.wikidataItemId)})`;
            }
         } else {
            html += '❌ لا';
         }
         html += '<br>';

         html += `<strong>استخدام قوالب الوصلات بين اللغوية:</strong> `;
         html += details.usesInterwikiTemplate ? '✅ نعم' : '❌ لا';
         html += ` (عدد الوصلات: ${details.interwikiLinksCount || 0})<br>`;

         html += `<strong>صناديق المشاريع الشقيقة:</strong> ${details.sisterProjectBoxesCount || 0}<br>`;

         html += `<strong>إشارات التكامل:</strong> ${details.crossProjectSignalsCount || 0}`;

         if (details.examples && details.examples.interwikiLinks && details.examples.interwikiLinks.length > 0) {
            html += '<br><br><strong>أمثلة على الوصلات بين اللغوية:</strong>';
            html += '<ul class="qum-details-list">';
            details.examples.interwikiLinks.forEach(ex => {
               if (!ex) return;
               html += '<li>';
               html += `<strong>${this._escapeHtml(ex.template || 'غير محدد')}</strong><br>`;
               html += `<code class="qum-code-text">${this._escapeHtml(ex.snippet || '')}</code>`;
               html += '</li>';
            });
            html += '</ul>';
         }

         if (details.examples && details.examples.sisterBoxes && details.examples.sisterBoxes.length > 0) {
            html += '<br><strong>أمثلة على صناديق المشاريع:</strong>';
            html += '<ul class="qum-details-list">';
            details.examples.sisterBoxes.forEach(ex => {
               if (!ex) return;
               html += '<li>';
               html += `<strong>${this._escapeHtml(ex.project || 'غير محدد')}</strong><br>`;
               html += `<code class="qum-code-text">${this._escapeHtml(ex.snippet || '')}</code>`;
               html += '</li>';
            });
            html += '</ul>';
         }

         if (details.examples && details.examples.wikidataHints && details.examples.wikidataHints.length > 0) {
            html += '<br><strong>إشارات ويكي بيانات المستخدمة:</strong>';
            html += '<ul class="qum-details-list">';
            details.examples.wikidataHints.forEach(hint => {
               html += `<li>{{${this._escapeHtml(hint)}}}</li>`;
            });
            html += '</ul>';
         }

         return html;
      }


      _createNotes(result) {
         const $notesSection = $('<div>').addClass('qum-notes-section');
         
         $notesSection.append('<h3>💡 ملاحظات واقتراحات تحسين</h3>');
         
         const notes = Array.isArray(result.notes) ? result.notes : [];
         
         if (notes.length > 0) {
            const $list = $('<ul>').addClass('qum-notes-list');
            notes.forEach(note => {
               const $noteItem = $(`<li>${this._escapeHtml(note)}</li>`);
               
               if (note.includes('خطأ لغوي محتمل') && result.details?.grammar?.details?.errors) {
                  const errors = result.details.grammar.details.errors;
                  console.log('[PanelRenderer] Grammar errors found:', errors.length, errors);
                  if (errors && errors.length > 0) {
                     const collapseId = 'qum-grammar-errors-' + Math.random().toString(36).substr(2, 9);
                     
                     const $collapseBtn = $('<button>')
                        .addClass('qum-collapse-btn')
                        .attr('data-target', collapseId)
                        .text(`عرض الأخطاء (${errors.length})`);
                     
                     const $collapseContent = $('<div>')
                        .attr('id', collapseId)
                        .addClass('qum-collapse-content');
                     
                     const $errorList = $('<ol>').addClass('qum-error-list');
                     
                     errors.forEach(error => {
                        const $errorItem = $('<li>').addClass('qum-error-item');
                        
                        $errorItem.append(
                           $('<strong>').text(error.rule || 'خطأ لغوي').addClass('qum-error-rule')
                        );
                        
                        if (error.match && error.match.length > 0) {
                           $errorItem.append(
                              $('<span>').text(`الخطأ: "${error.match}"`).addClass('qum-error-match')
                           );
                        }
                        
                        if (error.context && error.context.length > 0 && error.context !== error.match) {
                           $errorItem.append(
                              $('<span>').text(`السياق: "...${error.context}..."`).addClass('qum-error-context')
                           );
                        }
                        
                        if (error.description && error.description !== error.rule) {
                           $errorItem.append(
                              $('<span>').text(`💡 ${error.description}`).addClass('qum-error-description')
                           );
                        }
                        
                        $errorList.append($errorItem);
                     });
                     
                     $collapseContent.append($errorList);
                     $noteItem.append($collapseBtn, $collapseContent);
                     
                     $collapseBtn.on('click', function() {
                        const $content = $('#' + collapseId);
                        const isVisible = $content.is(':visible');
                        
                        $content.slideToggle(200);
                        $(this).text(isVisible ? `عرض الأخطاء (${errors.length})` : `إخفاء الأخطاء (${errors.length})`);
                     });
                  }
               }
               
               $list.append($noteItem);
            });
            $notesSection.append($list);
         } else {
            $notesSection.append('<p>لا توجد ملاحظات كبيرة. المقالة في حالة جيدة.</p>');
         }
         
         return $notesSection;
      }


      _attachEvents($overlay, $panel, result) {
         $('#qum-close, #' + this.overlayId).on('click', () => {
            this._removeExisting();
         });
         
         $('#qum-copy').on('click', () => {
            this._copyReport(result);
         });
         
         $('#qum-dark-toggle').on('click', () => {
            this._toggleDarkMode($panel);
         });
      }


      _copyReport(result) {
         const scoringEngine = new window.QualityUltraMax.ScoringEngine();
         const reportText = scoringEngine.generateTextReport(result);
         
         if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(reportText).then(() => {
               mw.notify('تم نسخ التقرير ✓', { type: 'success' });
            }).catch(() => {
               this._fallbackCopy(reportText);
            });
         } else {
            this._fallbackCopy(reportText);
         }
      }


      _fallbackCopy(text) {
         prompt('انسخ النص التالي:', text);
      }


      _toggleDarkMode($panel) {
         $panel.toggleClass('qum-dark-mode');
         const isDark = $panel.hasClass('qum-dark-mode');
         localStorage.setItem('qum-dark-mode', isDark ? '1' : '0');
      }


      _isDarkModeEnabled() {
         return localStorage.getItem('qum-dark-mode') === '1';
      }


      _escapeHtml(str) {
         return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
      }


      _injectStyles() {
         if ($('#qum-styles').length > 0) return;
         
         this._loadExternalStylesheet();
      }


      _loadExternalStylesheet() {
         const baseUrl = 'https://ar.wikipedia.org/w/index.php?title=مستخدم:ماهر_سامي/QUM/ui/';
         const cssUrl = baseUrl + 'panelStyles.css&action=raw&ctype=text/css';
         
         const $link = $('<link>')
            .attr('id', 'qum-styles')
            .attr('rel', 'stylesheet')
            .attr('type', 'text/css')
            .attr('href', cssUrl);
         
         $('head').append($link);
      }
   }

   window.QualityUltraMax = window.QualityUltraMax || {};
   window.QualityUltraMax.PanelRenderer = PanelRenderer;

})(window);
