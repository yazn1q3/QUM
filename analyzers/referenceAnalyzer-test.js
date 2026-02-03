/**
 * referenceAnalyzer.js
 * محلل المراجع
 */

(function(window) {
  'use strict';

  class ReferenceAnalyzer {
    constructor() {
      this.maxScore = 25;
      this.newsDomains = [
          'aljazeera', 'bbc', 'cnn', 'nytimes', 'washingtonpost', 'reuters', 'apnews',
          'arabnews', 'rt.com', 'dw.com', 'lemonde.fr', 'theguardian',
          'alarabiya.net', 'aawsat.com', 'youm7.com', 'alhayat.com', 'elwatannews.com',
          'skynewsarabia.com', 'sabq.org', 'akhbaar24.com', 'al-akhbar.com', 'annahar.com',
          'masrawy.com', 'news.yahoo.com', 'bloomberg.com', 'ft.com'
      ];

        this.journalSignalsDomains = [
          'nature.com', 'sciencedirect.com', 'jstor.org', 'springer.com', 'tandfonline.com',
          'wiley.com', 'cambridge.org', 'oup.com', 'pnas.org', 'acs.org', 'cell.com',
          'arxiv.org'
        ];

        this.publisherArabicWords = [/دار\s+\S+/i, /المكتبة/i, /المطبعة/i, /دار\s+الكتب/i, /دار\s+العلم/i];
        this.journalArabicWords = [/مجلة/, /دورية/, /وقائع/, /حوليات/];
    }

    analyze(articleModel) {
      const results = { score: 0, details: {}, notes: [] };

      const $content = articleModel.$parsedContent && articleModel.$parsedContent.length
        ? articleModel.$parsedContent
        : (articleModel.$articleBody && articleModel.$articleBody.length ? articleModel.$articleBody : null);

      if (!$content) {
        results.details = {
          referenceCount: 0,
          uniqueReferencesCount: 0,
          duplicateUsesCount: 0,
          bareLinksCount: 0,
          recentYearsCount: 0,
          referenceCountCategory: 'under10',
          referenceTypes: { book: 0, journal: 0, news: 0, web: 0, archive: 0, wikidata: 0 },
          referenceLanguages: { ar: 0, en: 0, other: 0 },
          wikidataCitationsCount: 0,
          incompleteReferencesCount: 0
        };
        return results;
      }

      const $refLists = $content.find('ol.references');
      const supCitations = $content.find('sup.reference');
      const self = this;

      let uniqueRefs = 0;
      let duplicateUses = 0;
      let bareLinks = 0;
      let recentYears = 0;
      let types = { book: 0, journal: 0, news: 0, web: 0, archive: 0, wikidata: 0 };
      let langs = { ar: 0, en: 0, other: 0 };
      let wikidataCount = 0;
      let incompleteCount = 0;

      const hasArabic = (t) => /[\u0600-\u06FF]/.test(t || '');
      const hasEnglish = (t) => /[A-Za-z]/.test(t || '');

      const isNewsDomain = (href) => {
        try {
          const u = new URL(href);
          const host = u.hostname.toLowerCase();
          return this.newsDomains.some(d => host.includes(d));
        } catch (_) {
          return false;
        }
      };

      const hasISBN = (textHtml) => /ISBN\s*\d/i.test(textHtml) || /\b\d{9}[\dXx]\b/.test(textHtml);
      const hasISSN = (textHtml) => /ISSN\s*\d/i.test(textHtml);
      const hasDOI = (textHtml) => /doi\.org\//i.test(textHtml) || /\b10\.[0-9]{4,}\/[^\s]+/i.test(textHtml);
      const hasArchive = (html) => /web\.archive\.org|archive\.org/i.test(html);
      const hasWikidata = (html) => /wikidata\.org/i.test(html) || /\bQ\d{3,}\b/.test(html);
      const hasJournalDomain = (html) => self.journalSignalsDomains && self.journalSignalsDomains.some(d => new RegExp(d.replace(/\./g,'\\.'),'i').test(html));

      $refLists.each(function() {
        $(this).children('li').each(function() {
          uniqueRefs += 1;
          const $li = $(this);
          const text = $li.text() || '';
          const html = $li.html() || '';

          // Languages
          if (hasArabic(text)) langs.ar += 1;
          else if (hasEnglish(text)) langs.en += 1;
          else langs.other += 1;

          // Duplicate uses (extra backlinks beyond first)
          const backlinks = $li.find('.mw-cite-backlink a').length;
          if (backlinks > 1) duplicateUses += (backlinks - 1);

          // Bare link: external anchor where anchor text equals href (no title)
          const $ext = $li.find('a.external');
          let liHasBare = false;
          $ext.each(function() {
            const href = $(this).attr('href') || '';
            const label = $(this).text() || '';
            if (href && label && label.trim() === href.trim()) {
              liHasBare = true;
            }
          });
          if (liHasBare) bareLinks += 1;

          // Recent years (>= 2020)
          const yearMatches = text.match(/\b(20\d{2})\b/g) || [];
          if (yearMatches.some(y => parseInt(y, 10) >= 2020)) recentYears += 1;

          // Types
            const hasExt = $ext.length > 0;
            // Book signals: ISBN OR (volume AND page) OR (publisher + volume/page)
            const hasVol = /(ج\.)\s*\d{1,3}/.test(text);
            const hasPage = /(ص\.)\s*\d{1,4}/.test(text);
            const hasPublisher = /دار\s+\S+|المكتبة|المطبعة/i.test(text);
            const hasBookSignals = hasISBN(text) || (hasVol && hasPage) || (hasPublisher && (hasVol || hasPage));
            // Journal signals: DOI/ISSN or Arabic "مجلة" أو كلمة Journal
            const hasJournalSignals = hasDOI(html) || hasISSN(text) || /\bJournal\b/i.test(text) || /\bمجلة\b/.test(text);
          const hasWebSignals = hasExt;
          const hasNewsSignals = hasExt && $ext.toArray().some(a => isNewsDomain($(a).attr('href')));
          const hasArchiveSignals = hasArchive(html);
          const hasWikidataSignals = hasWikidata(html);

          // Journal signals also by domain and Arabic words
          const hasJournalWordAr = self.journalArabicWords && self.journalArabicWords.some(rx => rx.test(text));
          const hasPublisherAr = self.publisherArabicWords && self.publisherArabicWords.some(rx => rx.test(text));

          if (hasBookSignals || (hasPublisherAr && (/(ج\.)\s*\d{1,3}/.test(text) || /(ص\.)\s*\d{1,4}/.test(text)))) types.book += 1;
          if (hasJournalSignals || hasJournalDomain(html) || hasJournalWordAr) types.journal += 1;
          if (hasNewsSignals) types.news += 1;
          else if (hasWebSignals) types.web += 1;
          if (hasArchiveSignals) types.archive += 1;
          if (hasWikidataSignals) { types.wikidata += 1; wikidataCount += 1; }

          // Incomplete: very short text and no external/internal title links
          const hasAnyLink = $li.find('a').length > 0;
          if (!hasAnyLink && (text.trim().length < 15)) incompleteCount += 1;
        });
      });

      const referenceCount = supCitations.length; // citation uses
      const uniqueReferencesCount = uniqueRefs;   // list items

      // Reference count category based on citation uses (to align with user metric)
      let referenceCountCategory = 'under10';
      if (referenceCount > 50) referenceCountCategory = 'above50';
      else if (referenceCount > 20) referenceCountCategory = 'between20and50';
      else if (referenceCount >= 10) referenceCountCategory = 'between10and20';

      results.details = {
        referenceCount,
        uniqueReferencesCount,
        duplicateUsesCount: duplicateUses,
        bareLinksCount: bareLinks,
        recentYearsCount: recentYears,
        referenceCountCategory,
        referenceTypes: types,
        referenceLanguages: langs,
        wikidataCitationsCount: wikidataCount,
        incompleteReferencesCount: incompleteCount
      };

      // Prefer wikitext-derived types/languages if available
      let wikitextToUse = (articleModel.wikitext && typeof articleModel.wikitext === 'string') ? articleModel.wikitext : '';
      if (!wikitextToUse && articleModel.rawData && typeof articleModel.rawData.rawWikitext === 'string') {
        wikitextToUse = articleModel.rawData.rawWikitext;
      }
      if (!wikitextToUse && typeof articleModel.rawWikitext === 'string') {
        wikitextToUse = articleModel.rawWikitext;
      }

      if (wikitextToUse && wikitextToUse.length > 0) {
        const wt = this._parseWikitextReferences(wikitextToUse);
        if (wt) {
          // Merge, prefer wikitext counts when non-zero
          results.details.referenceTypes = wt.referenceTypes || results.details.referenceTypes;
          results.details.referenceLanguages = wt.referenceLanguages || results.details.referenceLanguages;
          if (typeof wt.wikidataCitationsCount === 'number') {
            results.details.wikidataCitationsCount = wt.wikidataCitationsCount;
            results.details.referenceTypes.wikidata = wt.wikidataCitationsCount;
          }
          // If we computed unique/duplicate/bare/recent from wikitext, merge when they are non-zero
          if (wt.uniqueReferencesCount) results.details.uniqueReferencesCount = wt.uniqueReferencesCount;
          if (wt.duplicateUsesCount) results.details.duplicateUsesCount = wt.duplicateUsesCount;
          if (wt.bareLinksCount) results.details.bareLinksCount = wt.bareLinksCount;
          if (wt.recentYearsCount) results.details.recentYearsCount = wt.recentYearsCount;
        }
      }

      results.score = this._calculateScore(results.details);
      results.notes = this._generateNotes(results.details);
      return results;
    }

    _calculateScore(details) {
      let score = 12; // base
      if (details.referenceCountCategory === 'above50') score += 3;
      if (details.referenceTypes.book > 0) score += Math.min(2, details.referenceTypes.book * 0.5);
      if (details.referenceTypes.journal > 0) score += Math.min(2, details.referenceTypes.journal * 0.5);
      if (details.incompleteReferencesCount > 0) score -= Math.min(3, details.incompleteReferencesCount * 0.2);
      if (details.bareLinksCount > 0) score -= Math.min(2, details.bareLinksCount * 0.2);
      return Math.max(0, Math.min(this.maxScore, score));
    }

    _generateNotes(details) {
      const notes = [];
      if (details.bareLinksCount > 0) notes.push(`${details.bareLinksCount} روابط عارية ضمن المراجع؛ يُفضل استخدام قوالب الاستشهاد.`);
      if (details.incompleteReferencesCount > 0) notes.push(`${details.incompleteReferencesCount} مراجع ناقصة (بدون عنوان/وصلة واضحة).`);
      if (details.referenceTypes.wikidata > 0) notes.push(`استشهادات ويكي بيانات: ${details.referenceTypes.wikidata}.`);
      return notes;
    }

    // --- Wikitext parsing for high precision ---
    _parseWikitextReferences(wikitext) {
      const result = {
        referenceTypes: { book: 0, journal: 0, news: 0, web: 0, archive: 0, wikidata: 0 },
        referenceLanguages: { ar: 0, en: 0, other: 0 },
        wikidataCitationsCount: 0,
        uniqueReferencesCount: 0,
        duplicateUsesCount: 0,
        bareLinksCount: 0,
        recentYearsCount: 0
      };

      // Track named references and their uses
      const nameDefined = new Map(); // name -> content
      const nameUses = new Map();    // name -> count of uses (including definition)

      // Capture named refs with content
      const namedRefPattern = /<ref\b[^>]*?name\s*=\s*["']?([^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/ref>/gi;
      let nr;
      while ((nr = namedRefPattern.exec(wikitext)) !== null) {
        const nm = nr[1];
        const bodyHtml = nr[2] || '';
        nameDefined.set(nm, bodyHtml);
        nameUses.set(nm, (nameUses.get(nm) || 0) + 1);
      }

      // Capture self-closing named ref uses
      const selfClosingPattern = /<ref\b[^>]*?name\s*=\s*["']?([^"'\s>]+)["']?[^\/]*\/>/gi;
      let sc;
      while ((sc = selfClosingPattern.exec(wikitext)) !== null) {
        const nm = sc[1];
        nameUses.set(nm, (nameUses.get(nm) || 0) + 1);
      }

      // Capture unnamed refs
      const unnamedPattern = /<ref\b(?![^>]*name=)[^>]*>([\s\S]*?)<\/ref>/gi;
      let ur;
      let unnamedCount = 0;
      const unnamedBodies = [];
      while ((ur = unnamedPattern.exec(wikitext)) !== null) {
        unnamedCount += 1;
        unnamedBodies.push(ur[1] || '');
      }

      const tplPattern = /\{\{\s*(مرجع\s*كتاب|Cite\s*book|مرجع\s*مجلة|Cite\s*journal|مرجع\s*ويب|Cite\s*web|Cite\s*news|Cite\s*press|Cite\s*Q)\s*\|([\s\S]*?)\}\}/gi;
      let m;
      while ((m = tplPattern.exec(wikitext)) !== null) {
        const tpl = m[1].toLowerCase();
        const body = m[2];
        const params = body.split('|').map(s => s.trim());
        const kv = {};
        params.forEach(p => {
          const idx = p.indexOf('=');
          if (idx > -1) {
            const k = p.slice(0, idx).trim().toLowerCase();
            const v = p.slice(idx + 1).trim();
            kv[k] = v;
          }
        });

        // Type
        if (tpl.includes('book') || tpl.includes('مرجع كتاب')) result.referenceTypes.book++;
        else if (tpl.includes('journal') || tpl.includes('مرجع مجلة')) result.referenceTypes.journal++;
        else if (tpl.includes('web') || tpl.includes('مرجع ويب')) result.referenceTypes.web++;
        else if (tpl.includes('news') || tpl.includes('press')) result.referenceTypes.news++;
        else if (tpl.includes('cite q')) { result.referenceTypes.wikidata++; result.wikidataCitationsCount++; }

        // Archive
        const url = kv.url || kv['مسار'] || '';
        const archiveurl = kv.archiveurl || kv['وصلة أرشيف'] || '';
        if (/web\.archive\.org|archive\.org/i.test(url) || /web\.archive\.org|archive\.org/i.test(archiveurl)) {
          result.referenceTypes.archive++;
          result.bareLinksCount += 0; // archive links are not bare by themselves
        }

        // Language
        const lang = (kv.language || kv['لغة'] || '').toLowerCase();
        if (lang) {
          if (lang.startsWith('ar') || /عرب/.test(lang)) result.referenceLanguages.ar++;
          else if (lang.startsWith('en')) result.referenceLanguages.en++;
          else result.referenceLanguages.other++;
        } else {
          // Heuristic: infer language from title
          const title = kv.title || kv['عنوان'] || '';
          if (/[\u0600-\u06FF]/.test(title)) result.referenceLanguages.ar++;
          else if (/[A-Za-z]/.test(title)) result.referenceLanguages.en++;
          else result.referenceLanguages.other++;
        }

        // Bare link heuristic in template: if title missing and only url present
        const titleMissing = !(kv.title || kv['عنوان']);
        if (titleMissing && url) {
          result.bareLinksCount += 1;
        }

        // Recent years
        const yearField = kv.year || kv['سنة'] || '';
        const yearsInText = (body.match(/\b(20\d{2})\b/g) || []);
        if ((yearField && /20\d{2}/.test(yearField) && parseInt(yearField,10) >= 2020) || yearsInText.some(y => parseInt(y,10) >= 2020)) {
          result.recentYearsCount += 1;
        }
      }

      // Compute unique and duplicate counts from named/unnamed refs
      const uniqueFromNamed = nameDefined.size;
      const duplicateFromNamed = Array.from(nameUses.values()).reduce((acc, uses) => acc + Math.max(0, uses - 1), 0);
      result.uniqueReferencesCount = uniqueFromNamed + unnamedCount;
      result.duplicateUsesCount = duplicateFromNamed;

      return result;
    }
  }

  window.QualityUltraMax = window.QualityUltraMax || {};
  window.QualityUltraMax.ReferenceAnalyzer = ReferenceAnalyzer;

})(window);
