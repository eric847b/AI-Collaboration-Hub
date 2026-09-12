/**
 * Community Translation Framework (Q1 2027 #11).
 * Lets contributors add language packs via a stable JSON schema and merges
 * community packs with the built-in dictionary (i18n.js compatible output).
 */

(function (global) {
  const BUILTIN = {
    en: { generate: 'Generate', save: 'Save', settings: 'Settings', history: 'History' }
  };
  const KEY = 'unifiedsuite_community_packs';

  class TranslationFramework {
    constructor(options) {
      this.packs = Object.assign({}, BUILTIN, (options && options.packs) || {});
      this._loadCommunity();
    }

    _loadCommunity() {
      try {
        const stored = JSON.parse(global.localStorage.getItem(KEY) || '{}');
        Object.assign(this.packs, stored);
      } catch {}
    }

    /** Accept a community pack object { locale, strings }. */
    submitPack(pack) {
      if (!pack || !pack.locale || typeof pack.strings !== 'object') {
        throw new Error('pack must have locale + strings');
      }
      const merged = Object.assign({}, this.packs[pack.locale] || {}, pack.strings);
      this.packs[pack.locale] = merged;
      try {
        const stored = JSON.parse(global.localStorage.getItem(KEY) || '{}');
        stored[pack.locale] = merged;
        global.localStorage.setItem(KEY, JSON.stringify(stored));
      } catch {}
      return this.packs[pack.locale];
    }

    /** Validate a pack before accepting. */
    validatePack(pack) {
      const errors = [];
      if (!pack) errors.push('pack is required');
      if (pack && !/^[a-z]{2}(-[A-Z]{2})?$/.test(pack.locale || '')) errors.push('invalid locale code');
      if (pack && (typeof pack.strings !== 'object' || Array.isArray(pack.strings))) errors.push('strings must be an object');
      return { ok: errors.length === 0, errors };
    }

    translate(locale, key) {
      const pack = this.packs[locale];
      return (pack && pack[key]) || this.packs.en[key] || key;
    }

    /** Export all merged packs for backup/transfer. */
    exportPacks() {
      return JSON.stringify(this.packs, null, 2);
    }
  }

  global.TranslationFramework = TranslationFramework;
  if (typeof module !== 'undefined' && module.exports) module.exports = { TranslationFramework };
})(typeof window !== 'undefined' ? window : globalThis);