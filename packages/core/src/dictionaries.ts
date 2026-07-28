// SPDX-License-Identifier: MIT
import type { Dictionary } from "./types";

/**
 * English reference dictionary shipped with libreconsent.
 */
export const en: Readonly<Dictionary> = Object.freeze({
  "category.necessary.label": "Necessary",
  "category.necessary.description":
    "Required for the website to function and cannot be disabled.",
  "ui.acceptAll": "Accept all",
  "ui.rejectAll": "Reject all",
  "ui.customize": "Customize",
  "ui.save": "Save choices",
  "blocked.notice": "This content is blocked until you give consent.",
  "blocked.accept": "Accept and load",
});

/**
 * French reference dictionary shipped with libreconsent.
 */
export const fr: Readonly<Dictionary> = Object.freeze({
  "category.necessary.label": "Nécessaires",
  "category.necessary.description":
    "Requis pour le fonctionnement du site et ne peuvent pas être désactivés.",
  "ui.acceptAll": "Tout accepter",
  "ui.rejectAll": "Tout refuser",
  "ui.customize": "Personnaliser",
  "ui.save": "Enregistrer les choix",
  "blocked.notice":
    "Ce contenu est bloqué tant que vous n'avez pas donné votre consentement.",
  "blocked.accept": "Accepter et charger",
});
