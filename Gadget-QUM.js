/* ميدياويكي:Gadget-QUM.js
 * ------------------------------------------------------------
 *   أداة "تحليل الجودة العميق" — https://w.wiki/GBLx
 *   المؤلف: ماهر سامي https://w.wiki/HhJf
 * ------------------------------------------------------------
 * وصف الأداة:
 * سكربت مخصص لتحليل جودة مقالات ويكيبيديا العربية
 * من خلال تقييم عدة محاور: اللغة والبنية، المراجع،
 * الوسائط، الروابط الداخلية والخارجية، وقوالب الصيانة.
 * يوفر لوحة تقييم تساعد المساهمين على تحسين المقالات.
 *
 * الميزات:
 * - معمارية قائمة على MediaWiki Action API
 * - تحليل دقيق للمقدمة والبنية التحريرية بمستوى محرر محترف
 * - استخدام قواعد النحو المجتمعية الرسمية
 * - استقلالية عن DOM الخاص بالواجهات
 * - تحليل متقدم للصور والروابط والمراجع
 * - عرض تقرير بصري تفاعلي داخل الصفحة
 * 
 * الإصدار: 3.2 (معمارية API)
 * تاريخ آخر تعديل: 11 ديسمبر 2025
 * 
 * شكر خاص:
 * للزميل علاء على ملاحظاته حول الخوارزمية، وعلى دعمه المستمر ومتابعته وإرشاده.
 * للزميل ميشيل بكني على دعم التوثيق
 * للزميل أبو هشام على تدقيق منطق التقييم والمتابعة، ورفعِ ملاحظات الإصلاح المطلوبة.
 * https://w.wiki/HKwz
 * للزميل Mohammed Qays على تفعيل الأداة في النطاق التجريبي.
 * لمجتمع ويكيبيديا العربية على الدعم المستمر
 *
 * ملاحظات:
 * هذه نسخة قابلة للتطوير بالتعاون مع مجتمع ويكيبيديا العربية
 * يُرجى الإبلاغ عن أي مشكلة أو اقتراح للتحسين في صفحة نقاش الأداة
 * https://w.wiki/GBLz
 * ------------------------------------------------------------
 */
(function () {
  'use strict';

  if (typeof mw === 'undefined' || !mw.loader || !mw.util) return;

  if (window.QUM_LOADING || window.QUM_LOADED) {
    console.warn('[QUM] Already loaded/loading.');
    return;
  }
  window.QUM_LOADING = true;

  const VERSION = '3.2';
  const ROOT = 'ميدياويكي:QUM/';
  const OLDID = '';

  const TIMEOUT_MS = 15000;
  const CRIT_RETRIES = 2;
  const RETRY_BASE_DELAY = 500;
  const TOTAL_TIMEOUT_MS = 90000;

  if (TIMEOUT_MS <= 0 || TOTAL_TIMEOUT_MS <= 0 || TOTAL_TIMEOUT_MS < TIMEOUT_MS) {
    console.error('[QUM] Invalid timeout configuration');
    window.QUM_LOADING = false;
    return;
  }

  const DEBUG = !!mw.config.get('debug');
  function log() { if (DEBUG) console.log.apply(console, arguments); }
  function warn() { if (DEBUG) console.warn.apply(console, arguments); }

  let aborted = false;

  function rawUrl(title) {
    const params = { action: 'raw', ctype: 'text/javascript' };
    if (OLDID) params.oldid = OLDID;
    return mw.util.getUrl(title, params);
  }

  function fileName(path) {
    if (!path) return 'unknown';
    const parts = String(path).split('/').filter(Boolean);
    return parts.pop() || 'unknown';
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function assertSafePath(path) {
    const p = String(path || '');
    if (!p || p.indexOf('..') !== -1 || p.indexOf(':') !== -1 || p[0] === '/' || p[0] === '\\' || p.indexOf('\\') !== -1) {
      throw new Error('Unsafe path: ' + p);
    }
  }

  const report = {
    core: [],
    ui: [],
    optional: [],
    optionalFailed: []
  };

  function withTimeout(promise, ms, label) {
    let t;
    const timeout = new Promise(function (_, reject) {
      t = setTimeout(function () {
        reject(new Error('Timeout: ' + (label || 'request')));
      }, ms);
    });
    return Promise.race([promise, timeout]).finally(function () {
      clearTimeout(t);
    });
  }

  async function getScriptWithRetry(url, retries, label) {
    for (let attempt = 1; attempt <= 1 + retries; attempt++) {
      if (aborted) throw new Error('Aborted (total timeout)');
      try {
        await withTimeout(mw.loader.getScript(url), TIMEOUT_MS, label);
        return;
      } catch (err) {
        if (attempt >= 1 + retries) throw err;
        const delay = RETRY_BASE_DELAY * attempt;
        warn(`[QUM] Retry ${label} (${attempt + 1}/${1 + retries}) after ${delay}ms`, err);
        await sleep(delay);
      }
    }
  }

  function loadCritical(path, bucket) {
    assertSafePath(path);
    const title = ROOT + path;
    const name = fileName(path);
    const url = rawUrl(title);

    log(`[QUM] Loading critical: ${name}`);
    return getScriptWithRetry(url, CRIT_RETRIES, name).then(function () {
      if (aborted) return;
      report[bucket].push(name);
      log(`[QUM] Loaded critical: ${name}`);
    });
  }

  function loadOptional(path) {
    assertSafePath(path);
    const title = ROOT + path;
    const name = fileName(path);
    const url = rawUrl(title);

    log(`[QUM] Loading optional: ${name}`);
    return withTimeout(mw.loader.getScript(url), TIMEOUT_MS, name).then(function () {
      if (aborted) return;
      report.optional.push(name);
      log(`[QUM] Loaded optional: ${name}`);
    }).catch(function (err) {
      if (aborted) return;
      report.optionalFailed.push(name);
      warn(`[QUM] Optional failed (skipped): ${name}`, err);
    });
  }

  function loadSequential(list, fn) {
    return list.reduce(function (p, item) {
      return p.then(function () { return fn(item); });
    }, Promise.resolve());
  }

  const CORE = [
    'core/dataFetcher.js',
    'core/articleModel.js',
    'core/scoringEngine.js'
  ];

  const ANALYZERS = [
    'analyzers/mediaAnalyzer.js',
    'analyzers/referenceAnalyzer.js',
    'analyzers/linkAnalyzer.js',
    'analyzers/structureAnalyzer.js',
    'analyzers/languageAnalyzer.js',
    'analyzers/grammarAnalyzer.js',
    'analyzers/revisionAnalyzer.js',
    'analyzers/maintenanceAnalyzer.js',
    'analyzers/wikidataIntegrationAnalyzer.js'
  ];

  const UI_MAIN = [
    'ui/panelRenderer.js',
    'install.js',
    'main.js'
  ];

  let totalTimeoutId = null;

  function totalTimeoutPromise() {
    return new Promise(function (_, reject) {
      totalTimeoutId = setTimeout(function () {
        aborted = true;
        reject(new Error('Total timeout exceeded'));
      }, TOTAL_TIMEOUT_MS);
    });
  }

  function clearTotalTimeout() {
    if (totalTimeoutId) {
      clearTimeout(totalTimeoutId);
      totalTimeoutId = null;
    }
  }

  mw.loader.using(['mediawiki.util', 'mediawiki.api', 'mediawiki.storage']).then(function () {
    log(`[QUM v${VERSION}] Starting gadget loader…`);

    const chain =
      loadSequential(CORE, function (p) { return loadCritical(p, 'core'); })
        .then(function () { return Promise.all(ANALYZERS.map(loadOptional)); })
        .then(function () { return loadSequential(UI_MAIN, function (p) { return loadCritical(p, 'ui'); }); })
        .then(function () {
          if (aborted) throw new Error('Aborted (total timeout)');
          clearTotalTimeout();

          window.QUM_LOADED = true;

          if (DEBUG) {
            console.log(`[QUM v${VERSION}] Done ✓`);
            console.log('[QUM] Loaded core:', report.core);
            console.log('[QUM] Loaded UI/Main:', report.ui);
            console.log('[QUM] Loaded analyzers:', report.optional);
            if (report.optionalFailed.length) console.log('[QUM] Failed analyzers:', report.optionalFailed);
            console.log('[QUM] Available modules:', Object.keys(window.QualityUltraMax || {}));
          }

          try {
            mw.hook('QUM.ready').fire({
              version: VERSION,
              report: report,
              api: window.QualityUltraMax || null
            });
          } catch (e) {
            // تجاهل: hook ليس “حرجًا”
          }
        });

    return Promise.race([chain, totalTimeoutPromise()]);
  }).catch(function (err) {
    clearTotalTimeout();

    console.error('[QUM] Loader failed:', err);
    if (DEBUG) console.log('[QUM] Partial report:', report);

    try {
      mw.notify('تعذر تشغيل أداة QUM.', { type: 'error' });
    } catch (e) {
		// تجاهل فشل الإشعار
    }

    try {
      mw.hook('QUM.failed').fire({ error: err, report: report, version: VERSION });
    } catch (e2) {
		// تجاهل: hook ليس “حرجًا”
    }
  }).finally(function () {
    clearTotalTimeout();
    window.QUM_LOADING = false;
  });

})();
