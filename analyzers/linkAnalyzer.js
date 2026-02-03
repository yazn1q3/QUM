/**
 * linkAnalyzer.js
 * محلل الروابط الداخلية والخارجية
 * يقيم جودة وكثافة الربط في المقالة
 */
(function (window) {
  'use strict';

  class LinkAnalyzer {
    constructor() {
      this.maxScore = 15;
    }

    analyze(articleModel) {
      const results = {
        score: 0,
        details: {},
        notes: []
      };

      const internalLinks = articleModel.getInternalLinks() || [];
      const redLinks = articleModel.getRedLinks() || [];
      const externalLinks =
        articleModel.$articleBody && articleModel.$articleBody.length
          ? articleModel.$articleBody.find('a.external').length
          : 0;

      const wordCount = articleModel.getWordCount();
      const linkDensity =
        wordCount > 0 ? (internalLinks.length / wordCount * 100).toFixed(2) : 0;

      results.details.internalLinks = internalLinks.length;
      results.details.redLinks = redLinks.length;
      results.details.externalLinks = externalLinks;
      results.details.linkDensity = parseFloat(linkDensity);
      results.details.wordCount = wordCount;

      const dup = this._detectDuplicateLinks(articleModel);

      results.details.duplicateLinksInSections = dup.count;
      results.details.duplicateLinksExamples = dup.examples;

      results.details.yearLinksInTables = dup.yearLinksInTables;
      results.details.yearLinksInTablesExamples = dup.yearLinksInTablesExamples;

      let score = 0;

      if (internalLinks.length >= 30) score += 10;
      else if (internalLinks.length >= 20) score += 8;
      else if (internalLinks.length >= 10) score += 6;
      else if (internalLinks.length >= 5) score += 4;
      else if (internalLinks.length >= 2) score += 2;

      if (externalLinks >= 1) score += 2;

      if (linkDensity >= 1.5 && linkDensity <= 5) score += 3;
      else if (linkDensity >= 0.5 && linkDensity < 1.5) score += 2;
      else if (linkDensity >= 0.2) score += 1;

      const totalLinks = internalLinks.length + redLinks.length;
      if (totalLinks > 0) {
        const redRatio = redLinks.length / totalLinks;
        if (redRatio > 0.4) score -= 4;
        else if (redRatio > 0.2) score -= 2;
      }

      results.score = Math.max(0, Math.min(this.maxScore, score));

      if (internalLinks.length < 5) {
        results.notes.push('🔗 عدد الروابط الداخلية قليل جدًا. يُستحسن ربط المصطلحات المهمة.');
      } else if (internalLinks.length < 10 && (articleModel.articleLength || 0) >= 2000) {
        results.notes.push('عدد الروابط الداخلية أقل من المتوقع لحجم المقالة.');
      }

      if (totalLinks > 0 && redLinks.length / totalLinks > 0.3) {
        results.notes.push(
          `⚠️ نسبة الروابط الحمراء مرتفعة (${((redLinks.length / totalLinks) * 100).toFixed(0)}%). يُفضل إنشاء هذه الصفحات أو إزالة الروابط.`
        );
      }

      if (linkDensity < 0.5) {
        results.notes.push('كثافة الروابط منخفضة. يُفضل إضافة المزيد من الروابط الداخلية.');
      } else if (linkDensity > 7) {
        results.notes.push('كثافة الروابط مرتفعة جدًا. قد يكون هناك إفراط في الربط.');
      }

      if (dup.count > 0) {
        results.notes.push(`🔄 وصلات مكررة داخل نفس الفقرة/عنصر القائمة: ${dup.count} تكرار زائد.`);
      }

      if (dup.yearLinksInTables > 0) {
        results.notes.push(`📊 وصلات سنوات مكررة داخل الجداول: ${dup.yearLinksInTables} تكرار زائد.`);
      }

      if (dup.count > 0 || dup.yearLinksInTables > 0) {
        results.notes.push(`✅ ملاحظة: التكرارات تُحسب كالتالي: (1) الفقرات والقوائم: تكرار داخل نفس العنصر فقط، (2) الجداول: السنوات تُعد عبر الجدول بأكمله، الروابط العادية تُعد داخل الخلية فقط.`);
      }

      return results;
    }

    _detectDuplicateLinks(articleModel) {
      const textExamples = [];
      const yearExamples = [];

      let textDuplicateHits = 0;
      let yearLinksInTables = 0;

      if (!articleModel.$parsedContent || !articleModel.$parsedContent.length) {
        return {
          count: 0,
          examples: [],
          yearLinksInTables: 0,
          yearLinksInTablesExamples: []
        };
      }

      const $content = articleModel.$parsedContent.clone();

      $content.find('.infobox, .navbox, .sidebar, .reflist, .references, .mbox').remove();

      $content.find('p').each(function () {
        const $p = $(this);
        const map = new Map();

        $p.find('a').each(function () {
          const $a = $(this);
          const href = $a.attr('href') || '';
          if (!isValidArticleLink(href)) return;

          const key = normalizeHref(href);
          const title = $a.attr('title') || $a.text().trim();

          if (!map.has(key)) map.set(key, { count: 0, title });
          map.get(key).count++;
        });

        map.forEach((data) => {
          if (data.count > 1) {
            textDuplicateHits += (data.count - 1);
            if (textExamples.length < 5) {
              textExamples.push({
                section: findSectionTitle($p) || '#',
                link: (data.title || '').length > 50 ? data.title.slice(0, 50) + '...' : data.title,
                count: data.count
              });
            }
          }
        });
      });

      $content.find('li').each(function () {
        const $li = $(this);
        if ($li.closest('.reflist, .references').length > 0) return;

        const map = new Map();

        $li.find('a').each(function () {
          const $a = $(this);
          const href = $a.attr('href') || '';
          if (!isValidArticleLink(href)) return;

          const key = normalizeHref(href);
          const title = $a.attr('title') || $a.text().trim();

          if (!map.has(key)) map.set(key, { count: 0, title });
          map.get(key).count++;
        });

        map.forEach((data) => {
          if (data.count > 1) {
            textDuplicateHits += (data.count - 1);
            if (textExamples.length < 5) {
              textExamples.push({
                section: findSectionTitle($li) || '#',
                link: (data.title || '').length > 50 ? data.title.slice(0, 50) + '...' : data.title,
                count: data.count
              });
            }
          }
        });
      });

      $content.find('table.wikitable').each(function () {
        const $table = $(this);
        const sectionTitle = findSectionTitle($table, true) || '#';
        const tableYearMap = new Map();

        $table.find('td, th').each(function () {
          const $cell = $(this);
          const cellMap = new Map();

          $cell.find('a').each(function () {
            const $a = $(this);
            const href = $a.attr('href') || '';
            if (!isValidArticleLink(href)) return;

            const title = ($a.attr('title') || $a.text().trim() || '').trim();
            const key = normalizeHref(href);
            const isYear = isYearLink(title);

            if (isYear) {
              if (!tableYearMap.has(key)) tableYearMap.set(key, { count: 0, title });
              tableYearMap.get(key).count++;
            } else {
              if (!cellMap.has(key)) cellMap.set(key, { count: 0, title });
              cellMap.get(key).count++;
            }
          });

          cellMap.forEach((data) => {
            if (data.count > 1) {
              textDuplicateHits += (data.count - 1);
              if (textExamples.length < 5) {
                textExamples.push({
                  section: sectionTitle,
                  link: data.title.length > 50 ? data.title.slice(0, 50) + '...' : data.title,
                  count: data.count,
                  context: 'خلية جدول'
                });
              }
            }
          });
        });

        tableYearMap.forEach((data) => {
          if (data.count > 1) {
            yearLinksInTables += (data.count - 1);
            if (yearExamples.length < 5) {
              yearExamples.push({
                section: sectionTitle,
                link: data.title,
                count: data.count,
                context: 'جدول'
              });
            }
          }
        });
      });

      return {
        count: textDuplicateHits,
        examples: textExamples,
        yearLinksInTables,
        yearLinksInTablesExamples: yearExamples
      };
    }
  }

  function isValidArticleLink(href) {
    if (!href || !href.startsWith('/wiki/')) return false;

    const clean = href.split('?')[0].split('#')[0];
    const rawTitle = clean.slice('/wiki/'.length);
    if (!rawTitle) return false;

    let title;
    try {
      title = decodeURIComponent(rawTitle);
    } catch (e) {
      title = rawTitle;
    }

    if (title.includes(':')) return false;

    return true;
  }

  function normalizeHref(href) {
    return (href || '').split('?')[0].split('#')[0];
  }

  function isYearLink(title) {
    return /^\d{3,4}$/.test((title || '').trim());
  }

  function findSectionTitle($element, searchParents) {
    let $h = $element.prevAll('h2, h3, h4, h5, h6').first();
    
    if (!$h.length && searchParents) {
      const $parent = $element.parent().closest('div, section, td, th');
      if ($parent.length) {
        $h = $parent.prevAll('h2, h3, h4, h5, h6').first();
      }
      
      if (!$h.length) {
        $h = $element.parents().prevAll('h2, h3, h4, h5, h6').first();
      }
    }
    
    if (!$h.length) return null;

    return $h
      .text()
      .replace(/\[عدل\]/g, '')
      .replace(/\[edit\]/gi, '')
      .trim();
  }

  window.QualityUltraMax = window.QualityUltraMax || {};
  window.QualityUltraMax.LinkAnalyzer = LinkAnalyzer;
})(window);
