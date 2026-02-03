/**
 * referenceAnalyzer.js
 * محلل المراجع والمصادر
 * يقيم جودة وموثوقية المصادر المستخدمة
 */
(function(window) {
   'use strict';

   class ReferenceAnalyzer {
      constructor() {
         this.maxScore = 25;
         
         this.referenceTypePatterns = {
            book: [
               /\{\{\s*استشهاد\s+بكتاب/gi,
               /\{\{\s*استشهاد\s+مختصر/gi,
               /\{\{\s*cite\s+book/gi,
               /\{\{\s*مرجع\s+كتاب/gi,
               /ISBN[\s:-]*\d{9,13}[\dXx]?/gi,
               /\b(كتاب|مؤلف|تأليف|الطبعة|الناشر|دار\s+النشر|منشورات|مطبعة|الجزء|المجلد)\b/gi
            ],
            journal: [
               /\{\{\s*استشهاد\s+بدورية/gi,
               /\{\{\s*استشهاد\s+بمجلة/gi,
               /\{\{\s*cite\s+journal/gi,
               /\{\{\s*مرجع\s+دورية/gi,
               /DOI[\s:-]*10\.\d+/gi,
               /ISSN[\s:-]*\d{4}-?\d{3}[\dXx]/gi
            ],
            news: [
               /\{\{\s*استشهاد\s+بخبر/gi,
               /\{\{\s*استشهاد\s+بصحيفة/gi,
               /\{\{\s*cite\s+news/gi,
               /\{\{\s*مرجع\s+خبر/gi
            ],
            web: [
               /\{\{\s*استشهاد\s+بويب/gi,      
               /\{\{\s*استشهاد\s+ويب/gi,
               /\{\{\s*استشهاد\s+إلكتروني/gi,
               /\{\{\s*cite\s+web/gi,
               /\{\{\s*مرجع\s+ويب/gi
         ],
         archive: [
            /\{\{\s*استشهاد\s+أرشيف/gi,
            /\{\{\s*استشهاد\s+أرشيف\s+الإنترنت/gi,
            /\{\{\s*cite\s+archive/gi
         ],
         wikidata: [
            /\{\{\s*استشهاد\s+بويكي\s*بيانات/gi,
            /\{\{\s*cite\s+Q\d+/gi
         ]
      };
         this.languageTLDs = {
            ar: ['.sa', '.eg', '.ae', '.sy', '.jo', '.iq', '.kw', '.qa', '.bh', '.om', '.ye', '.lb', '.ps', '.ma', '.tn', '.dz', '.ly', '.sd', '.mr'],
            en: ['.uk', '.us', '.au', '.nz', '.ca', '.ie'],
            fr: ['.fr', '.be', '.ch'],
            de: ['.de', '.at'],
            es: ['.es', '.mx', '.ar', '.co', '.cl', '.pe'],
            other: []
         };
         this.arabicPublishers = [
            'الجزيرة', 'العربية', 'bbc عربي', 'سكاي نيوز عربية',
            'الشرق الأوسط', 'الأهرام', 'اليوم السابع', 'الحياة',
            'العرب', 'الخليج', 'البيان', 'الاتحاد', 'الرياض',
            'دار النفائس', 'دار الكتاب العربي', 'دار العلم للملايين',
            'الهيئة المصرية', 'مكتبة الأنجلو', 'دار الشروق', 'دار البصائر',
            'رابطة العالم الإسلامي', 'الموسوعة العربية', 'دار الفرقان'
         ];
         this.englishPublishers = [
            'BBC', 'CNN', 'Reuters', 'Guardian', 'Telegraph',
            'Times', 'Washington Post', 'New York Times',
            'Nature', 'Science', 'Britannica', 'Oxford', 'Cambridge',
            'Routledge', 'Springer', 'Wiley', 'Elsevier', 'JSTOR'
         ];
         this.turkishPublishers = [
            'İstanbul', 'Ankara', 'Türk Tarih', 'Osmanlı',
            'Turkish Historical', 'Başbakanlık'
         ];
         this.languageKeywords = {
            ar: ['القاهرة', 'بيروت', 'دمشق', 'الرياض', 'عَمَّان', 'بغداد', 'مكة', 'المدينة', 
                 'الطبعة', 'تحقيق', 'ترجمة', 'الجزء', 'المجلد', 'الناشر'],
            en: ['New York', 'London', 'Oxford', 'Cambridge', 'Press', 'Publishing', 
                 'University', 'Edition', 'Volume', 'translated', 'edited'],
            tr: ['İstanbul', 'Ankara', 'Yayınları', 'Baskı', 'Çeviri', 'Osmanlı', 'Türk'],
            fa: ['تهران', 'اصفهان', 'چاپ', 'انتشارات', 'ترجمه'],
            ot: ['استانبول', 'قسطنطينية', 'دولت', 'مطبعة']  
         };
      }

      analyze(articleModel) {
         const results = {
            score: 0,
            details: {},
            notes: []
         };
         const refCounts = this._countReferences(articleModel);
         results.details.totalRefs = refCounts.total;
         results.details.namedRefs = refCounts.named;
         results.details.repeatedRefs = refCounts.repeated;
         const bareUrls = this._detectBareUrls(articleModel);
         results.details.bareUrls = bareUrls;
         const citationQuality = this._analyzeCitationTemplates(articleModel);
         results.details.incompleteCitations = citationQuality.incomplete;
         results.details.completeCitations = citationQuality.complete;
         const publicationYears = this._extractPublicationYears(articleModel);
         results.details.recentYears = publicationYears.recent;
         results.details.allYears = publicationYears.all;
         const hasRefSection = this._hasReferencesSection(articleModel);
         results.details.hasReferencesSection = hasRefSection;
         const reliability = this._assessSourceReliability(articleModel);
         results.details.reliableSourcesCount = reliability.count;
         const referenceTypes = this._classifyReferenceTypes(articleModel, refCounts.total);
         results.details.referenceTypes = referenceTypes;
         const multiTypeStats = this._calculateMultiTypeStatistics(referenceTypes, refCounts.total);
         results.details.multiTypeStatistics = multiTypeStats;
         const referenceLanguages = this._detectReferenceLanguages(articleModel);
         results.details.referenceLanguages = referenceLanguages;
         const refCountCategory = this._categorizeReferenceCount(refCounts.total);
         results.details.referenceCountCategory = refCountCategory;
         const wikidataCitations = this._detectWikidataCitations(articleModel);
         results.details.wikidataCitationsCount = wikidataCitations;
         const incompleteRefs = this._detectIncompleteReferences(articleModel);
         results.details.incompleteReferencesCount = incompleteRefs.count;
         results.details.incompleteReferences = incompleteRefs.examples;
         results.score = this._calculateScore(results.details, articleModel);
         results.notes = this._generateNotes(results.details, articleModel);
         return results;
      }

      _countReferences(articleModel) {
         const html = articleModel.html || '';
         const wikitext = articleModel.wikitext || '';
         console.log('[ReferenceAnalyzer] 🔍 Starting reference count');

         if (!html && !wikitext) {
            console.log('[ReferenceAnalyzer] ⚠️ No source available');
            return { total: 0, named: 0, repeated: 0 };
         }
         if (html && (/cite_note-/i.test(html) || /cite&#95;note-/i.test(html))) {
            console.log('[ReferenceAnalyzer]   📊 Detected rendered HTML (cite_note format)');
            const $html = $(html);
            const htmlDecoded = $html.html() || html;
            
            const citeNotePattern = /<li\s+id\s*=\s*["']cite_note-([^"']+)["']/gi;
            const uniqueRefs = new Set();
            let match;
            
            while ((match = citeNotePattern.exec(htmlDecoded)) !== null) {
               const refId = match[1].toLowerCase().trim();
               uniqueRefs.add(refId);
            }
            
            const citeRefBackPattern = /<a\s+href\s*=\s*["']#cite_ref-([^"']+)["']/gi;
            const backlinks = [];
            while ((match = citeRefBackPattern.exec(htmlDecoded)) !== null) {
               backlinks.push(match[1].toLowerCase().trim());
            }
            
            const repeated = Math.max(0, backlinks.length - uniqueRefs.size);
            
            console.log('[ReferenceAnalyzer] ✅ HTML counts:', {
               uniqueRefs: uniqueRefs.size,
               backlinks: backlinks.length,
               repeated: repeated
            });
            
            return {
               total: uniqueRefs.size,
               named: uniqueRefs.size, 
               repeated: repeated
            };
         }
         
         const source = wikitext || html;
         console.log('[ReferenceAnalyzer]   📊 Parsing wikitext/raw HTML');
         
         const uniqueRefs = new Set(); 
         let unnamedCount = 0;         
         let repeatedCount = 0;        
         
         const namedDefPattern = /<ref\s+[^>]*name\s*=\s*["']?([^"'\s/>]+)["']?[^>]*>[\s\S]*?<\/ref>/gi;
         let match2;
         
         while ((match2 = namedDefPattern.exec(source)) !== null) {
            const refName = match2[1].toLowerCase().trim();
            const refContent = match2[0];
            
            const isEmpty = /<ref[^>]*>\s*<\/ref>/i.test(refContent);
            if (!isEmpty) {
               uniqueRefs.add(refName);
            }
         }
         
         const repeatedRefPattern = /<ref\s+[^>]*name\s*=\s*["']?([^"'\s/>]+)["']?[^>]*\/>/gi;
         while ((match2 = repeatedRefPattern.exec(source)) !== null) {
            repeatedCount++;
         }
         
         const unnamedPattern = /<ref(?:\s+(?!name)[^>]*)?>[\s\S]*?<\/ref>/gi;
         const unnamedMatches = source.match(unnamedPattern) || [];
         
         unnamedMatches.forEach((ref) => {
            
            const isEmpty = /<ref[^>]*>\s*<\/ref>/i.test(ref);
            if (!isEmpty) {
               unnamedCount++;
            }
         });
         
         const totalUnique = uniqueRefs.size + unnamedCount;
         
         console.log('[ReferenceAnalyzer] ✅ Wikitext counts:', {
            uniqueNamed: uniqueRefs.size,
            unnamed: unnamedCount,
            totalUnique: totalUnique,
            repeated: repeatedCount
         });
         
         return {
            total: totalUnique,
            named: uniqueRefs.size,
            repeated: repeatedCount
         };
      }

      _detectBareUrls(articleModel) {
         if (!articleModel.$parsedContent || !articleModel.$parsedContent.length) {
            return 0;
         }

         const $content = articleModel.$parsedContent.clone();
         
         
         $content.find('.infobox, .navbox, .sidebar, .metadata, .ambox').remove();
         
         
         $content.find('.reflist, .references, ol.references, .mw-references-wrap').remove();
         $content.find('sup.reference, .mw-cite-backlink, cite').remove();
         
         $content.find('h2, h3, h4').each(function() {
            const headingText = $(this).text().trim();
            
            if (/مراجع|references|مصادر|ملاحظات|الهوامش|منابع|kaynaklar|sources|notes|bibliography/i.test(headingText)) {
               
               const level = this.tagName.toLowerCase();
               const $nextHeading = $(this).nextAll(level).first();
               
               if ($nextHeading.length > 0) {
                  $(this).nextUntil($nextHeading).addBack().remove();
               } else {
                  $(this).remove();
               }
            }
         });
         
         
         $content.find('div').each(function() {
            const $div = $(this);
            const classes = $div.attr('class') || '';
            if (/refbegin|refend|reflist|references|mw-references/i.test(classes)) {
               $div.remove();
            }
         });
         
         let bareUrlCount = 0;
         $content.find('a.external').each(function() {
            const $link = $(this);
            const href = $link.attr('href') || '';
            const text = $link.text().trim();
            
            if ($link.closest('.reference, .citation, sup, cite, .reflist, .references').length > 0) {
               return; 
            }
            
            if ($link.closest('[role="note"], [role="doc-footnote"]').length > 0) {
               return;
            }
            const isBareUrl = text === href || 
                            /^https?:\/\//i.test(text) ||
                            text === '' || 
                            /^\[\d+\]$/.test(text) ||
                            (href && !text);
            
            if (isBareUrl) {
               console.log('[ReferenceAnalyzer] Bare URL detected:', {
                  href: href.substring(0, 60),
                  text: text || '(empty)',
                  reason: text === href ? 'text=href' : 
                         /^https?:\/\//i.test(text) ? 'starts with http' :
                         /^\[\d+\]$/.test(text) ? 'reference number' : 'no descriptive text'
               });
               bareUrlCount++;
            }
         });
         
         return bareUrlCount;
      }

      _analyzeCitationTemplates(articleModel) {
         const html = articleModel.html;
         
         if (!html || html.length === 0) {
            return { complete: 0, incomplete: 0 };
         }
         
         const citePattern = /\{\{\s*(cite|استشهاد)\s+([^}]+)\}\}/gi;
         const citations = html.match(citePattern) || [];

         let complete = 0;
         let incomplete = 0;

          citations.forEach(cite => {
            const hasTitle = /title\s*=|عنوان\s*=/i.test(cite);
            const hasAuthor = /author\s*=|مؤلف\s*=|last\s*=|الأخير\s*=/i.test(cite);
            const hasDate = /date\s*=|تاريخ\s*=|year\s*=|سنة\s*=/i.test(cite);
            const hasUrl = /url\s*=|مسار\s*=/i.test(cite);

            const essentialCount = [hasTitle, hasAuthor, hasDate].filter(Boolean).length;
            
            if (essentialCount >= 2) {
               complete++;
            } else {
               incomplete++;
            }
         });

         return { complete, incomplete };
      }

      _extractPublicationYears(articleModel) {
         const html = articleModel.html;
         const text = articleModel.fullText;

         if (!html || html.length === 0) {
            return { all: 0, recent: 0 };
         }

         const pubYearPattern = /(year|سنة|date|تاريخ)\s*=\s*(\d{4})/gi;
         const matches = html.match(pubYearPattern) || [];
         
         const years = matches
            .map(match => {
               const yearMatch = match.match(/\d{4}/);
               return yearMatch ? parseInt(yearMatch[0]) : null;
            })
            .filter(year => year && year >= 1900 && year <= 2025);

         const recentYears = years.filter(year => year >= 2015).length;

         return {
            all: years.length,
            recent: recentYears
         };
      }

      
      _hasReferencesSection(articleModel) {
         const sections = Array.isArray(articleModel.sections) ? articleModel.sections : [];
         return sections.some(s => 
            /مراجع|references|مصادر|ملاحظات|الهوامش/i.test(s.line)
         );
      }

      _assessSourceReliability(articleModel) {
         const html = articleModel.html;
         
         if (!html || html.length === 0) {
            console.warn('[ReferenceAnalyzer] No HTML content for reliability assessment');
            return { count: 0 };
         }
         
         
         const reliableDomains = [
            'britannica.com', 'archive.org',
            
            'nature.com', 'science.org', 'sciencedirect.com', 'cell.com',
            'plos.org', 'nih.gov', 'ncbi.nlm.nih.gov', 'pubmed',
            
            'nejm.org', 'thelancet.com', 'bmj.com', 'jamanetwork.com',
            
            'who.int', 'cdc.gov', 'nhs.uk', 'mayoclinic.org',
            'health.gov', 'medlineplus.gov',
            
            'jstor.org', 'springer.com', 'cambridge.org', 'oxford',
            'wiley.com', 'elsevier.com', 'tandfonline.com', 'sagepub.com',
            
            'bbc.com', 'reuters.com', 'apnews.com',
            'aljazeera.net', 'alarabiya.net', 'aawsat.com',
            
            '.gov', '.edu'
         ];

         
         const $html = $(html);
         const $refs = $html.find('li[id^="cite_note-"]');
         let reliableCount = 0;
         
         $refs.each((index, ref) => {
            const refHtml = $(ref).html() || '';
            const refText = refHtml.toLowerCase();
            
            const isReliable = reliableDomains.some(domain => {
               return refText.includes(domain.toLowerCase());
            });
            
            if (isReliable) {
               reliableCount++;
            }
         });

         return { count: reliableCount };
      }

      _calculateScore(details, articleModel) {
         let score = 0;

         if (details.totalRefs === 0) {
            score += 0;
         } else if (details.totalRefs === 1) {
            score += 3;
         } else if (details.totalRefs <= 3) {
            score += 7;
         } else if (details.totalRefs <= 7) {
            score += 11;
         } else if (details.totalRefs <= 15) {
            score += 14;
         } else {
            score += 15;
         }

         const totalCitations = details.completeCitations + details.incompleteCitations;
         if (totalCitations > 0) {
            const qualityRatio = details.completeCitations / totalCitations;
            if (qualityRatio >= 0.8) score += 4;
            else if (qualityRatio >= 0.6) score += 3;
            else if (qualityRatio >= 0.4) score += 2;
            else score += 1;
         }

         if (details.recentYears >= 5) score += 3;
         else if (details.recentYears >= 3) score += 2;
         else if (details.recentYears >= 1) score += 1;

         if (details.reliableSourcesCount >= 5) score += 3;
         else if (details.reliableSourcesCount >= 2) score += 2;
         else if (details.reliableSourcesCount >= 1) score += 1;

         
         if (details.bareUrls > 0) {
            score -= Math.min(6, details.bareUrls * 2);
         }

         if (!details.hasReferencesSection && details.totalRefs > 0) {
            score -= 2;
         }

         return Math.max(0, Math.min(this.maxScore, score));
      }

      _classifyReferenceTypes(articleModel, totalRefs) {
         const html = articleModel.html || '';
         const wikitext = articleModel.wikitext || '';
         
         console.log('[QUM ReferenceAnalyzer] Classifying reference types:', {
            hasHtml: !!html,
            hasWikitext: !!wikitext,
            htmlLength: html.length,
            wikitextLength: wikitext.length
         });
         
         const types = {
            book: 0,
            journal: 0,
            news: 0,
            web: 0,
            archive: 0,
            wikidata: 0,
            empty: 0,
            unknown: 0
         };

         
         if (wikitext && wikitext.length > 100) {
            console.log('[QUM ReferenceAnalyzer] Using wikitext for classification');
            
            
            Object.keys(this.referenceTypePatterns).forEach(type => {
               this.referenceTypePatterns[type].forEach(pattern => {
                  const matches = wikitext.match(pattern);
                  if (matches) {
                     types[type] += matches.length;
                  }
               });
               
               if (types[type] > 0) {
                  console.log(`[QUM ReferenceAnalyzer] Found ${types[type]} ${type} references in wikitext`);
               }
            });
            
            
            const refPattern = /<ref[^>]*>[\s\S]*?<\/ref>/gi;
            const allRefs = wikitext.match(refPattern) || [];
            
            const archiveIndicators = [
               /archive-?url\s*=/i,
               /archiveurl\s*=/i,
               /مسار[\s-]*أرشيف\s*=/i,
               /تاريخ[\s-]*أرشيف\s*=/i,
               /https?:\/\/(web\.)?archive\.org/i,
               /\{\{Webarchive/i,
               /\{\{وب أرشيف/i,
               /wayback/i
            ];
            
            let archiveRefCount = 0;
            allRefs.forEach(ref => {
               
               const hasArchive = archiveIndicators.some(pattern => pattern.test(ref));
               if (hasArchive) {
                  archiveRefCount++;
               }
            });
            
            types.archive += archiveRefCount;
            if (archiveRefCount > 0) {
               console.log(`[QUM ReferenceAnalyzer] Found ${archiveRefCount} refs with archive in wikitext`);
            }
         }
         
      
      
      else if (html && html.length > 0) {
         console.log('[QUM ReferenceAnalyzer] Using HTML content analysis');
         
         try {
            
            const htmlDecoded = html.replace(/&#95;/g, '_').replace(/&#x5F;/gi, '_');
            
            
            const refPattern = /<li\s+id\s*=\s*["']cite_note-([^"']+)["'][^>]*>(.*?)<\/li>/gis;
            let refMatches = [...htmlDecoded.matchAll(refPattern)];
            
            
            const groupListPattern = /<ol\s+[^>]*class\s*=\s*["'][^"']*references[^"']*["'][^>]*data-mw-group\s*=\s*["']([^"']+)["'][^>]*>(.*?)<\/ol>/gis;
            const groupMatches = [...htmlDecoded.matchAll(groupListPattern)];
            
            groupMatches.forEach((groupMatch) => {
               const groupName = groupMatch[1];
               const groupContent = groupMatch[2];
               console.log(`[QUM ReferenceAnalyzer] Found reference group: "${groupName}"`);
               
               
               const groupRefMatches = [...groupContent.matchAll(refPattern)];
               refMatches = refMatches.concat(groupRefMatches);
            });
            
            console.log(`[QUM ReferenceAnalyzer] Analyzing ${refMatches.length} reference items (including groups)`);
            
            refMatches.forEach((match) => {
               const refId = match[1];
               const refHtml = match[2];
               
               
               let refHtmlClean = refHtml.replace(/<sup[^>]*class\s*=\s*["']?[^"']*mw-cite-backlink[^"']*["']?[^>]*>.*?<\/sup>/gis, '');
               refHtmlClean = refHtmlClean.replace(/<a[^>]*href\s*=\s*["']#cite_ref-[^"']+["'][^>]*>.*?<\/a>/gis, '');
               
               
               const refText = refHtmlClean.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim();
               
               
               let hasArchive = false;
               if (refHtml.includes('archive.org') || refHtml.includes('web.archive.org') || 
                   /wayback|أرشيف|archived/i.test(refText)) {
                  types.archive++;
                  hasArchive = true;
               }
               
               
               if (!refText || refText.length < 5) {
                  if (/https?:\/\//i.test(refHtml)) {
                     types.web++;
                  }
                  return; 
               }
               
               
               let classified = false;
               
               
               const bookIndicators = [
                  /ISBN[\s:-]*\d{9,13}[\dXx]?/i,
                  /[،,]\s*ص\s*\.?\s*\d+/i,
                  /[،,]\s*ج\s*\.?\s*\d+/i,
                  /:\s*\d+\/\d+/i,
                  /(ط|طبعة)\s*\d+/i,
                  /الناشر|دار\s+النشر|منشورات|مطبعة/i,
                  /تحقيق|ترجمة|تأليف|المجلد|الجزء/i,
                  /\b(press|publisher|publishing|edition|volume)\b/i
               ];
               
               if (bookIndicators.some(p => p.test(refText))) {
                  types.book++;
                  classified = true;
               }
               
               
               const journalIndicators = [
                  /DOI[\s:-]*10\.\d+/i,
                  /ISSN[\s:-]*\d{4}/i,
                  /مجلة|دورية|journal/i,
                  /\b(مجلد|عدد|vol|issue|no)\b/i
               ];
               
               if (!classified && journalIndicators.some(p => p.test(refText))) {
                  types.journal++;
                  classified = true;
               }
               
               
               const newsIndicators = [
                  /الجزيرة|العربية|bbc|cnn|reuters/i,
                  /الأهرام|اليوم السابع|الشرق الأوسط/i,
                  /صحيفة|جريدة|newspaper/i
               ];
               
               if (!classified && newsIndicators.some(p => p.test(refText))) {
                  types.news++;
                  classified = true;
               }
               
               
               if (!classified && /https?:\/\//i.test(refHtml)) {
                  types.web++;
                  classified = true;
               }
               
               
               if (!classified) {
                  types.unknown++;
               }
            });
            
            console.log('[QUM ReferenceAnalyzer] HTML classification results:', types);
         } catch (e) {
            console.error('[QUM ReferenceAnalyzer] HTML analysis failed:', e);
         }
      }

         
         const needsHybridCheck = (wikitext && wikitext.length > 100) && 
                                  (types.web === 0 || types.archive === 0) && 
                                  html && html.length > 0;
         
         if (needsHybridCheck) {
            console.log('[QUM ReferenceAnalyzer] 🔄 Applying Hybrid Fallback (wikitext had gaps)');
            
            try {
               const htmlDecoded = html.replace(/&#95;/g, '_').replace(/&#x5F;/gi, '_');
               const refPattern = /<li\s+id\s*=\s*["']cite_note-([^"']+)["'][^>]*>(.*?)<\/li>/gis;
               const refMatches = [...htmlDecoded.matchAll(refPattern)];
               
               
               refMatches.forEach((match) => {
                  const refHtml = match[2];
                  
                  if (types.archive === 0) {
                     if (refHtml.includes('archive.org') || refHtml.includes('web.archive.org')) {
                        types.archive++;
                     }
                  }
                  
                  if (types.web === 0) {
                     if (/https?:\/\//i.test(refHtml)) {
                        types.web++;
                     }
                  }
               });
               
               console.log('[QUM ReferenceAnalyzer] 🔄 Hybrid result: web=' + types.web + ', archive=' + types.archive);
            } catch (e) {
               console.error('[QUM ReferenceAnalyzer] Hybrid fallback failed:', e);
            }
         }
         console.log('[QUM ReferenceAnalyzer] 📊 Final classification:', types);         return types;
      }

      _calculateMultiTypeStatistics(referenceTypes, totalRefs) {
         const totalClassifications = Object.keys(referenceTypes).reduce((sum, key) => {
            return key !== 'unknown' && key !== 'empty' ? sum + referenceTypes[key] : sum;
         }, 0);
         
         const inflationCount = totalClassifications - totalRefs;
         const inflationRatio = totalRefs > 0 ? (inflationCount / totalRefs * 100).toFixed(1) : 0;
         
         
         const inflationReasons = [];
         
         if (referenceTypes.archive > totalRefs * 0.3) {
            const archivePercentage = ((referenceTypes.archive / totalRefs) * 100).toFixed(0);
            inflationReasons.push({
               type: 'archive',
               count: referenceTypes.archive,
               reason: `روابط أرشيف (${archivePercentage}% من المراجع تحتوي على روابط archive.org)`
            });
         }
         
         if (referenceTypes.book > 0 && referenceTypes.journal > 0) {
            inflationReasons.push({
               type: 'multi-type',
               reason: 'بعض المراجع تحتوي على أكثر من نوع واحد (مثلاً: كتاب + دورية)'
            });
         }
         
         return {
            totalReferences: totalRefs,
            totalClassifications: totalClassifications,
            inflationCount: Math.max(0, inflationCount),
            inflationRatio: parseFloat(inflationRatio),
            hasInflation: inflationCount > 0,
            inflationReasons: inflationReasons,
            explanation: inflationCount > 0 
               ? `مجموع التصنيفات (${totalClassifications}) أكبر من عدد المراجع (${totalRefs}) لأن المرجع الواحد قد يحتوي على أكثر من نوع` 
               : 'كل مرجع له تصنيف واحد فقط'
         };
      }

      _detectReferenceLanguages(articleModel) {
         const html = articleModel.html || '';
         
         const languages = {
            ar: 0,
            en: 0,
            tr: 0,     
            fa: 0,    
            ot: 0,    
            other: 0
         };

         if (!html || html.length === 0) {
            console.log('[ReferenceAnalyzer] No HTML content available');
            return { ar: 0, en: 0, other: 0 }; 
         }

         const $html = $(html);
         let $refItems = $();
         
         
         $refItems = $html.find('ol.references li');
         console.log(`[ReferenceAnalyzer] Found ${$refItems.length} items in ol.references`);
         
                
         if ($refItems.length === 0) {
            $refItems = $html.find('.mw-references-wrap li');
            console.log(`[ReferenceAnalyzer] Found ${$refItems.length} items in .mw-references-wrap`);
         }
         
         
         if ($refItems.length === 0) {
            $refItems = $html.find('.reflist li');
            console.log(`[ReferenceAnalyzer] Found ${$refItems.length} items in .reflist`);
         }
         
         
         $html.find('h2, h3, h4').each(function() {
            const headingText = $(this).text().trim();
            if (/ثبت\s*المراجع|فهرست\s*المراجع|قائمة\s*المراجع|المصادر\s*الكاملة|bibliography|kaynak/i.test(headingText)) {
               const $nextHeading = $(this).nextAll('h2, h3, h4').first();
               let $section = $nextHeading.length 
                  ? $(this).nextUntil($nextHeading)
                  : $(this).nextAll();
               
               const $bibliographyItems = $section.find('ul li, ol li');
               if ($bibliographyItems.length > 0) {
                  console.log(`[ReferenceAnalyzer] Found ${$bibliographyItems.length} items in bibliography: "${headingText}"`);
                  $refItems = $refItems.add($bibliographyItems);
               }
            }
         });
         
         console.log(`[ReferenceAnalyzer] Total references to analyze: ${$refItems.length}`);

         if ($refItems.length > 0) {
            $refItems.each((index, item) => {
               const $item = $(item);
               
               let $refContent = $item.find('.reference-text');
               if ($refContent.length === 0) {
                  
                  $refContent = $item.clone();
                  $refContent.find('.mw-cite-backlink, sup.reference').remove();
               }
               
               const refText = $refContent.text().trim();
               const refHtml = $refContent.html();
               
               
               if (!refText || refText.length < 5) {
                  return; // continue
               }
               
               let classified = false;
               let detectedLang = null;
               
               console.log(`[ReferenceAnalyzer] Ref #${index + 1}: ${refText.substring(0, 80)}`);
               
               
               const langMatch = refHtml.match(/[|]\s*(language|لغة|dil)\s*=\s*([^|}\n<]+)/i);
               if (langMatch) {
                  const lang = langMatch[2].toLowerCase().trim();
                  if (/^(ar|arabic|عرب)/i.test(lang)) {
                     detectedLang = 'ar';
                  } else if (/^(en|english|إنجليز)/i.test(lang)) {
                     detectedLang = 'en';
                  } else if (/^(tr|turkish|türk|تركي)/i.test(lang)) {
                     detectedLang = 'tr';
                  } else if (/^(fa|persian|فارسي)/i.test(lang)) {
                     detectedLang = 'fa';
                  } else if (/^(ota|ottoman|عثماني)/i.test(lang)) {
                     detectedLang = 'ot';
                  } else if (lang && lang !== 'none') {
                     detectedLang = 'other';
                  }
                  
                  if (detectedLang) {
                     languages[detectedLang]++;
                     classified = true;
                     console.log(`  → ${detectedLang.toUpperCase()} (language field: ${lang})`);
                  }
               }
               
               
               if (!classified) {
                  const $externalLinks = $refContent.find('a.external, a[href^="http"]');
                  if ($externalLinks.length > 0) {
                     const url = $externalLinks.first().attr('href') || '';
                     const urlMatch = url.match(/https?:\/\/([^\/]+)/i);
                     if (urlMatch) {
                        const domain = urlMatch[1].toLowerCase();
                        
                        const arTLDs = ['.sa', '.eg', '.ae', '.sy', '.jo', '.iq', '.kw', '.qa', 
                                        '.bh', '.om', '.ye', '.lb', '.ps', '.ma', '.tn', '.dz', 
                                        '.ly', '.sd', '.mr'];
                        const arDomains = ['aljazeera', 'alarabiya', 'aawsat', 'ahram', 'youm7', 
                                           'masress', 'albawaba', 'alarab', 'dct.gov', 'visitabudhabi'];
                        
                        const trTLDs = ['.tr'];
                        const trDomains = ['turk', 'istanbul', 'ankara', 'hurriyet', 'sabah'];
                        
                        const faTLDs = ['.ir'];
                        const faDomains = ['iran', 'tehran', 'farsi'];
                        
                        if (arTLDs.some(tld => domain.endsWith(tld)) || arDomains.some(d => domain.includes(d))) {
                           detectedLang = 'ar';
                        } else if (trTLDs.some(tld => domain.endsWith(tld)) || trDomains.some(d => domain.includes(d))) {
                           detectedLang = 'tr';
                        } else if (faTLDs.some(tld => domain.endsWith(tld)) || faDomains.some(d => domain.includes(d))) {
                           detectedLang = 'fa';
                        } else if (/\.(uk|us|au|nz|ca)$/i.test(domain)) {
                           detectedLang = 'en';
                        } else if (/\.(fr|de|es|it|pt|ru|cn|jp|kr)$/i.test(domain)) {
                           detectedLang = 'other';
                        }
                        
                        if (detectedLang) {
                           languages[detectedLang]++;
                           classified = true;
                           console.log(`  → ${detectedLang.toUpperCase()} (domain: ${domain})`);
                        }
                     }
                  }
               }
               
               
               if (!classified) {
                  for (const pub of this.arabicPublishers) {
                     if (new RegExp(pub, 'i').test(refText)) {
                        detectedLang = 'ar';
                        console.log(`  → AR (publisher: ${pub})`);
                        break;
                     }
                  }
                  
                  if (!detectedLang) {
                     for (const pub of this.englishPublishers) {
                        if (new RegExp(pub, 'i').test(refText)) {
                           detectedLang = 'en';
                           console.log(`  → EN (publisher: ${pub})`);
                           break;
                        }
                     }
                  }
                  
                  if (!detectedLang) {
                     for (const pub of this.turkishPublishers) {
                        if (new RegExp(pub, 'i').test(refText)) {
                           detectedLang = 'tr';
                           console.log(`  → TR (publisher: ${pub})`);
                           break;
                        }
                     }
                  }
                  
                  if (!detectedLang) {
                     for (const [lang, keywords] of Object.entries(this.languageKeywords)) {
                        for (const keyword of keywords) {
                           if (new RegExp(keyword, 'i').test(refText)) {
                              detectedLang = lang;
                              console.log(`  → ${lang.toUpperCase()} (keyword: ${keyword})`);
                              break;
                           }
                        }
                        if (detectedLang) break;
                     }
                  }
                  
                  if (detectedLang) {
                     languages[detectedLang]++;
                     classified = true;
                  }
               }
               
               
               if (!classified) {
                  const arabicChars = (refText.match(/[\u0600-\u06FF]/g) || []).length;
                  const latinChars = (refText.match(/[a-zA-Z]/g) || []).length;
                  const cyrillicChars = (refText.match(/[\u0400-\u04FF]/g) || []).length;
                  const totalChars = arabicChars + latinChars + cyrillicChars;
                  
                  if (totalChars >= 10) {  
                     const arabicRatio = arabicChars / totalChars;
                     const latinRatio = latinChars / totalChars;
                     
                     if (arabicRatio >= 0.4) {  
                        const persianChars = (refText.match(/[پچژگ]/g) || []).length;
                        if (persianChars > 0) {
                           detectedLang = 'fa';
                           console.log(`  → FA (${persianChars} Persian chars, ${Math.round(arabicRatio * 100)}% Arabic script)`);
                        } else {
                           detectedLang = 'ar';
                           console.log(`  → AR (${Math.round(arabicRatio * 100)}% Arabic script)`);
                        }
                     } else if (latinRatio >= 0.4) {  
                        const turkishChars = (refText.match(/[ışğüöçİŞĞÜÖÇ]/g) || []).length;
                        if (turkishChars > 0) {
                           detectedLang = 'tr';
                           console.log(`  → TR (${turkishChars} Turkish chars, ${Math.round(latinRatio * 100)}% Latin script)`);
                        } else {
                           detectedLang = 'en';
                           console.log(`  → EN (${Math.round(latinRatio * 100)}% Latin script)`);
                        }
                     } else if (cyrillicChars > 0) {
                        detectedLang = 'other';
                        console.log(`  → OTHER (${Math.round((cyrillicChars/totalChars) * 100)}% Cyrillic)`);
                     } else {
                        detectedLang = 'other';
                        console.log(`  → OTHER (unknown script, ${totalChars} chars)`);
                     }
                     
                     if (detectedLang) {
                        languages[detectedLang]++;
                        classified = true;
                     }
                  } else if (totalChars > 0) {
                     console.log(`  → SKIPPED (too short: ${totalChars} chars)`);
                  }
               }
               
               if (!classified) {
                  console.log(`  → UNCLASSIFIED (skipped)`);
               }
            });
         } else {
            console.log('[ReferenceAnalyzer] No reference list found in HTML');
         }

         
         const finalLangs = {
            ar: languages.ar,
            en: languages.en,
            other: languages.other + languages.tr + languages.fa + languages.ot
         };
         
         const total = finalLangs.ar + finalLangs.en + finalLangs.other;
         console.log(`[ReferenceAnalyzer] Final language distribution:`, finalLangs, `(Total: ${total})`);
         console.log(`[ReferenceAnalyzer] Detailed breakdown:`, languages);

         return finalLangs;
      }

      _categorizeReferenceCount(totalRefs) {
         if (totalRefs < 10) {
            return 'under10';
         } else if (totalRefs >= 10 && totalRefs <= 20) {
            return 'between10and20';
         } else if (totalRefs > 20 && totalRefs <= 50) {
            return 'between20and50';
         } else {
            return 'above50';
         }
      }

      _detectWikidataCitations(articleModel) {
         const html = articleModel.html || '';
         const wikitext = articleModel.wikitext || '';
         let count = 0;

         console.log('[ReferenceAnalyzer] 🔍 Detecting Wikidata citations...');

         
         this.referenceTypePatterns.wikidata.forEach(pattern => {
            if (wikitext) {
               const wikitextMatches = wikitext.match(pattern);
               if (wikitextMatches) {
                  console.log(`[ReferenceAnalyzer]   Found ${wikitextMatches.length} matches in wikitext:`, wikitextMatches.slice(0, 3));
                  count += wikitextMatches.length;
               }
            }
            
            if (count === 0 && html) {
               const htmlMatches = html.match(pattern);
               if (htmlMatches) {
                  console.log(`[ReferenceAnalyzer]   Found ${htmlMatches.length} matches in HTML:`, htmlMatches.slice(0, 3));
                  count += htmlMatches.length;
               }
            }
         });

         console.log(`[ReferenceAnalyzer] ✅ Total Wikidata citations: ${count}`);
         return count;
      }

      _detectIncompleteReferences(articleModel) {
         const html = articleModel.html;
         
         if (!html || html.length === 0) {
            return { count: 0, examples: [] };
         }
         
         const citePattern = /\{\{\s*(cite|استشهاد)\s+([^}]+)\}\}/gi;
         const citations = [];
         let match;
         
         while ((match = citePattern.exec(html)) !== null) {
            citations.push(match[0]);
         }

         const incompleteExamples = [];
         let incompleteCount = 0;

         citations.forEach(cite => {
            const hasTitle = /[|]?\s*(title|عنوان)\s*=/i.test(cite);
            const hasPublisher = /[|]?\s*(publisher|ناشر|work|عمل)\s*=/i.test(cite);
            const hasDate = /[|]?\s*(date|تاريخ|year|سنة)\s*=/i.test(cite);
            const hasUrl = /[|]?\s*(url|مسار)\s*=/i.test(cite);
            const missingFields = [];
            if (!hasTitle) missingFields.push('العنوان');
            if (!hasPublisher) missingFields.push('الناشر');
            if (!hasDate) missingFields.push('التاريخ');
            if (!hasUrl) missingFields.push('الرابط');

            if (missingFields.length >= 2) {
               incompleteCount++;
               
               if (incompleteExamples.length < 3) {
                  // استخراج نوع الاستشهاد
                  const typeMatch = cite.match(/\{\{\s*(cite|استشهاد)\s+(\w+)/i);
                  const type = typeMatch ? typeMatch[2] : 'unknown';
                  
                  incompleteExamples.push({
                     type: type,
                     missing: missingFields,
                     snippet: cite.substring(0, 80) + '...'
                  });
               }
            }
         });

         return {
            count: incompleteCount,
            examples: incompleteExamples
         };
      }

      _generateNotes(details, articleModel) {
         const notes = [];

         const articleLen = articleModel.articleLength || 0;
         const isStub = articleLen < 1500;
         
         if (details.multiTypeStatistics && details.multiTypeStatistics.hasInflation) {
            const stats = details.multiTypeStatistics;
            if (stats.inflationCount > 0) { // أي تضخم، حتى لو رقم واحد
               let note = `ℹ️ مجموع أنواع المراجع (${stats.totalClassifications}) أكبر من عدد المراجع (${stats.totalReferences}) - هذا طبيعي لأن:`;
               
               if (stats.inflationReasons && stats.inflationReasons.length > 0) {
                  stats.inflationReasons.forEach(reason => {
                     if (reason.type === 'archive') {
                        note += `\n   • ${reason.count} مرجع يحتوي على روابط أرشيف إضافية`;
                     } else if (reason.type === 'multi-type') {
                        note += `\n   • ${reason.reason}`;
                     }
                  });
               } else {
                  
                  note += `\n   • المرجع الواحد قد يُصنف تحت أكثر من نوع`;
               }
               
               notes.push(note);
            }
         }
         
         if (details.totalRefs === 0) {
            notes.push('⚠️ المقالة بدون مراجع. يجب إضافة مصادر موثوقة لدعم المحتوى.');
         } else if (details.totalRefs < 3 && !isStub) {
            notes.push('عدد المراجع قليل جدًا. يُفضل إضافة مزيد من المصادر الموثوقة.');
         } else if (details.totalRefs >= 3 && details.totalRefs < 5 && articleLen > 3000) {
            notes.push('عدد المراجع مقبول، لكن يمكن تحسينه بإضافة مصادر إضافية.');
         } else if (details.totalRefs >= 5 && details.totalRefs < 7 && articleLen > 5000) {
            notes.push('عدد المراجع جيد. يمكن إضافة مصادر إضافية لتعزيز المحتوى.');
         }

         if (details.bareUrls > 0) {
            notes.push(`🔗 ${details.bareUrls} رابط خارجي عاري (بدون تنسيق). يُفضل تحويلها إلى استشهادات كاملة.`);
         }

         if (details.incompleteCitations > 0) {
            notes.push(`📋 ${details.incompleteCitations} قالب استشهاد ناقص. يُستحسن إكمال المعلومات الأساسية (عنوان، مؤلف، تاريخ).`);
         }

         if (!details.hasReferencesSection && details.totalRefs > 0) {
            notes.push('يُفضل إنشاء قسم مستقل للمراجع باسم "مراجع" أو "مصادر".');
         }

         
         if (details.recentYears === 0 && details.totalRefs > 5 && details.allYears.length > 3) {
            const articleTypes = articleModel.detectArticleType ? articleModel.detectArticleType() : [];
            const isClassicalTopic = articleTypes.includes('science') || articleTypes.includes('mathematics') || 
                                   /رياض|هندس|فلسف|تاريخ|أدب/i.test(articleModel.title || '');
            
            if (!isClassicalTopic) {
               notes.push('لا توجد مصادر حديثة (2015-2025). يُفضل تحديث المصادر إن أمكن.');
            }
         }

         return notes;
      }
   }

   window.QualityUltraMax = window.QualityUltraMax || {};
   window.QualityUltraMax.ReferenceAnalyzer = ReferenceAnalyzer;

})(window);
