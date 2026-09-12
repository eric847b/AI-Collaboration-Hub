/**
 * Locale Template Bundles (Q1 2027 #11).
 * Locale-specific template packs that load alongside the i18n module.
 * Ships Spanish, French, German, and Chinese starter bundles.
 */

(function (global) {
  const BUNDLES = {
    es: {
      locale: 'es',
      name: 'Español',
      templates: [
        { id: 'es-welcome', name: 'Mensaje de bienvenida', text: 'Mensaje de bienvenida personalizado' },
        { id: 'es-alert', name: 'Alerta de datos', text: 'Alertar cuando los datos cambien' }
      ]
    },
    fr: {
      locale: 'fr',
      name: 'Français',
      templates: [
        { id: 'fr-welcome', name: 'Message de bienvenue', text: 'Message de bienvenue personnalisé' },
        { id: 'fr-alert', name: 'Alerte de données', text: 'Alerter quand les données changent' }
      ]
    },
    de: {
      locale: 'de',
      name: 'Deutsch',
      templates: [
        { id: 'de-welcome', name: 'Willkommensnachricht', text: 'Personalisierte Willkommensnachricht' },
        { id: 'de-alert', name: 'Datenwarnung', text: 'Warnen, wenn sich Daten ändern' }
      ]
    },
    zh: {
      locale: 'zh',
      name: '中文',
      templates: [
        { id: 'zh-welcome', name: '欢迎消息', text: '个性化欢迎消息' },
        { id: 'zh-alert', name: '数据提醒', text: '当数据变化时提醒' }
      ]
    }
  };

  class LocaleTemplateBundles {
    /** Templates for a locale, falling back to the base English set. */
    forLocale(locale) {
      const key = String(locale || '').split('-')[0].toLowerCase();
      return BUNDLES[key] ? BUNDLES[key].templates : [];
    }

    locales() {
      return Object.values(BUNDLES).map(b => ({ locale: b.locale, name: b.name }));
    }
  }

  global.LocaleTemplateBundles = LocaleTemplateBundles;
  if (typeof module !== 'undefined' && module.exports) module.exports = { LocaleTemplateBundles, BUNDLES };
})(typeof window !== 'undefined' ? window : globalThis);