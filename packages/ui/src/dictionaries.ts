import type { Dictionary } from "@libreconsent/core";

/**
 * English reference strings for the banner and preferences layers.
 *
 * The core ships the shared decision labels (`ui.acceptAll`, `ui.rejectAll`,
 * `ui.customize`, `ui.save`); these are the renderer-only additions. Host
 * dictionaries passed through `i18n.translations` override both.
 */
export const uiEn: Readonly<Dictionary> = Object.freeze({
  "ui.title": "We value your privacy",
  "ui.description":
    "We use cookies and similar technologies. Necessary ones keep the site working; the rest run only if you agree.",
  "ui.preferences.title": "Privacy preferences",
  "ui.preferences.description":
    "Choose which categories and services may run. You can change this at any time.",
  "ui.close": "Close",
  "ui.settings": "Cookie settings",
  "ui.alwaysOn": "Always on",
  "ui.cookies.show": "Show cookies",
  "ui.cookies.hide": "Hide cookies",
  "ui.cookies.name": "Name",
  "ui.cookies.purpose": "Purpose",
  "ui.cookies.provider": "Provider",
  "ui.cookies.duration": "Duration",
  "ui.cookies.type": "Type",
});

/**
 * French reference strings for the banner and preferences layers.
 */
export const uiFr: Readonly<Dictionary> = Object.freeze({
  "ui.title": "Votre vie privée nous importe",
  "ui.description":
    "Nous utilisons des cookies et technologies similaires. Les cookies nécessaires font fonctionner le site ; les autres ne s'activent qu'avec votre accord.",
  "ui.preferences.title": "Préférences de confidentialité",
  "ui.preferences.description":
    "Choisissez les catégories et services autorisés. Vous pouvez modifier ce choix à tout moment.",
  "ui.close": "Fermer",
  "ui.settings": "Réglages cookies",
  "ui.alwaysOn": "Toujours actif",
  "ui.cookies.show": "Afficher les cookies",
  "ui.cookies.hide": "Masquer les cookies",
  "ui.cookies.name": "Nom",
  "ui.cookies.purpose": "Finalité",
  "ui.cookies.provider": "Fournisseur",
  "ui.cookies.duration": "Durée",
  "ui.cookies.type": "Type",
});

/**
 * Renderer reference dictionaries keyed by locale.
 */
export const uiDictionaries: Readonly<Record<string, Readonly<Dictionary>>> =
  Object.freeze({ en: uiEn, fr: uiFr });
