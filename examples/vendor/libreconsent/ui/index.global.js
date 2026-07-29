/*! libreconsent v1.1.1 | MIT License | SPDX-License-Identifier: MIT */
"use strict";var LibreConsentUi=(()=>{var z=Object.defineProperty;var te=Object.getOwnPropertyDescriptor;var oe=Object.getOwnPropertyNames;var ne=Object.prototype.hasOwnProperty;var ie=(e,t)=>{for(var o in t)z(e,o,{get:t[o],enumerable:!0})},re=(e,t,o,i)=>{if(t&&typeof t=="object"||typeof t=="function")for(let r of oe(t))!ne.call(e,r)&&r!==o&&z(e,r,{get:()=>t[r],enumerable:!(i=te(t,r))||i.enumerable});return e};var se=e=>re(z({},"__esModule",{value:!0}),e);var he={};ie(he,{mount:()=>me,uiEn:()=>y,uiFr:()=>L});function n(e,t,o){let i=document.createElement(e);for(let[r,s]of Object.entries(t??{}))s===void 0||s===!1||i.setAttribute(r,s===!0?"":s);for(let r of o??[])i.append(typeof r=="string"?document.createTextNode(r):r);return i}function I(e){if(document.body)return e(),()=>{};let t=()=>{document.removeEventListener("DOMContentLoaded",t),e()};return document.addEventListener("DOMContentLoaded",t),()=>document.removeEventListener("DOMContentLoaded",t)}function F(e,t){let o=e.id("banner-title"),i=e.id("banner-text"),r=e.layout==="modal",s=n("button",{type:"button",class:"lc-btn lc-btn--primary","data-lc-action":"accept"},[e.t("ui.acceptAll")]),l=n("button",{type:"button",class:"lc-btn lc-btn--primary","data-lc-action":"reject"},[e.t("ui.rejectAll")]),d=n("button",{type:"button",class:"lc-btn lc-btn--ghost","data-lc-action":"customize"},[e.t("ui.customize")]);s.addEventListener("click",t.accept),l.addEventListener("click",t.reject),d.addEventListener("click",t.customize);let f=n("div",{class:"lc-banner lc-surface","data-layout":e.layout,"data-lc-banner":"",role:"dialog","aria-modal":r?"true":"false","aria-labelledby":o,"aria-describedby":i,tabindex:"-1"},[n("div",{class:"lc-inner"},[n("div",{class:"lc-copy"},[n("h2",{class:"lc-title",id:o},[e.t("ui.title")]),n("p",{class:"lc-text",id:i},[e.t("ui.description")])]),n("div",{class:"lc-actions"},[s,l,d])])]);return r?{root:n("div",{class:"lc-overlay","data-lc-overlay":""},[f]),dialog:f}:{root:f,dialog:f}}var ae=["a[href]","button:not([disabled])","input:not([disabled])","select:not([disabled])","textarea:not([disabled])",'[tabindex]:not([tabindex="-1"])'].join(",");function k(){let e=document.activeElement;for(;e?.shadowRoot?.activeElement;)e=e.shadowRoot.activeElement;return e}function U(e){return Array.from(e.querySelectorAll(ae)).filter(t=>t.closest("[hidden]")===null)}function w(e,t,o){let i=r=>{if(r.key==="Escape"){r.preventDefault(),t();return}if(r.key!=="Tab")return;let s=U(e),l=s[0],d=s[s.length-1];if(!l||!d){r.preventDefault();return}let f=k();r.shiftKey&&f===l?(r.preventDefault(),d.focus()):!r.shiftKey&&f===d&&(r.preventDefault(),l.focus())};return e.addEventListener("keydown",i),()=>{e.removeEventListener("keydown",i),o instanceof HTMLElement&&o.isConnected&&o.focus()}}function E(e){(U(e)[0]??e).focus()}var y=Object.freeze({"ui.title":"We value your privacy","ui.description":"We use cookies and similar technologies. Necessary ones keep the site working; the rest run only if you agree.","ui.preferences.title":"Privacy preferences","ui.preferences.description":"Choose which categories and services may run. You can change this at any time.","ui.close":"Close","ui.settings":"Cookie settings","ui.settings.extended":"Optional cookies allowed","ui.settings.essential":"Necessary cookies only","ui.alwaysOn":"Always on","ui.optOut.title":"Do Not Sell or Share My Personal Information","ui.optOut.description":"You can direct us not to sell or share your personal information with advertising partners. Necessary site functions and measurement are unaffected.","ui.optOut.confirm":"Opt out","ui.optOut.done":"You have opted out of the sale or sharing of your personal information on this site.","ui.cookies.show":"Show cookies","ui.cookies.hide":"Hide cookies","ui.cookies.name":"Name","ui.cookies.purpose":"Purpose","ui.cookies.provider":"Provider","ui.cookies.duration":"Duration","ui.cookies.type":"Type"}),L=Object.freeze({"ui.title":"Votre vie priv\xE9e nous importe","ui.description":"Nous utilisons des cookies et technologies similaires. Les cookies n\xE9cessaires font fonctionner le site ; les autres ne s'activent qu'avec votre accord.","ui.preferences.title":"Pr\xE9f\xE9rences de confidentialit\xE9","ui.preferences.description":"Choisissez les cat\xE9gories et services autoris\xE9s. Vous pouvez modifier ce choix \xE0 tout moment.","ui.close":"Fermer","ui.settings":"R\xE9glages cookies","ui.settings.extended":"Cookies optionnels autoris\xE9s","ui.settings.essential":"Cookies n\xE9cessaires uniquement","ui.alwaysOn":"Toujours actif","ui.optOut.title":"Ne pas vendre ni partager mes informations personnelles","ui.optOut.description":"Vous pouvez nous demander de ne pas vendre ni partager vos informations personnelles avec des partenaires publicitaires. Les fonctions n\xE9cessaires du site et la mesure d'audience ne sont pas concern\xE9es.","ui.optOut.confirm":"Refuser la vente ou le partage","ui.optOut.done":"Vous avez refus\xE9 la vente ou le partage de vos informations personnelles sur ce site.","ui.cookies.show":"Afficher les cookies","ui.cookies.hide":"Masquer les cookies","ui.cookies.name":"Nom","ui.cookies.purpose":"Finalit\xE9","ui.cookies.provider":"Fournisseur","ui.cookies.duration":"Dur\xE9e","ui.cookies.type":"Type"}),T=Object.freeze({en:y,fr:L});function ce(e){return Object.keys(e.i18n.translations)}function S(e){return(e.split("-")[0]??e).toLowerCase()}function $(e,t){let o=t.toLowerCase(),i=e.find(s=>s.toLowerCase()===o);if(i!==void 0)return i;let r=S(t);return e.find(s=>S(s)===r)??null}function K(e,t){let o=ce(e);if(t!==null){let i=$(o,t);if(i===null)throw new Error(`options.locale: "${t}" is not a configured locale`);return i}if(e.i18n.autoDetect){let i=typeof navigator>"u"?[]:navigator.languages??[];for(let r of i){let s=$(o,r);if(s!==null)return s}}return e.i18n.default}function _(e,t){let o=T[t]??T[S(t)]??y;return{...y,...o,...e.i18n.translations[t]}}function q(e,t){return e[t]??t}function x(e,t){return e.services.filter(o=>o.onlyRegions.length===0||t!==null&&o.onlyRegions.includes(t))}var le=["provider","duration","type"];function de(e,t){return e.readonly||e.services.length===0||x(e,t).length>0}function ue(e,t){let o=le.filter(s=>t.some(l=>l[s]!==void 0)),i=n("tr",{},[n("th",{scope:"col"},[e.t("ui.cookies.name")]),n("th",{scope:"col"},[e.t("ui.cookies.purpose")]),...o.map(s=>n("th",{scope:"col"},[e.t(`ui.cookies.${s}`)]))]),r=t.map(s=>n("tr",{},[n("td",{},[s.name]),n("td",{},[e.t(s.purpose)]),...o.map(l=>{let d=s[l];return n("td",{},[d===void 0?"\u2014":e.t(d)])})]));return n("table",{class:"lc-table"},[n("thead",{},[i]),n("tbody",{},r)])}function pe(e,t){if(t.cookies.length===0)return[];let o=e.id(`cookies-${t.id}`),i=n("div",{class:"lc-cookies",id:o,hidden:!0},[ue(e,t.cookies)]),r=n("button",{type:"button",class:"lc-disclose","aria-expanded":"false","aria-controls":o},[e.t("ui.cookies.show")]);return r.addEventListener("click",()=>{let s=r.getAttribute("aria-expanded")==="true";r.setAttribute("aria-expanded",s?"false":"true"),i.hidden=s,r.textContent=e.t(s?"ui.cookies.show":"ui.cookies.hide")}),[r,i]}function Y(e){let t=document.createElement("input");return t.type="checkbox",t.className="lc-check",t.setAttribute("aria-labelledby",e),t}function V(e,t,o,i){let r=e.id("prefs-title"),s=e.id("prefs-description"),l=new Map,d=new Map,f=[],a=t.categories.filter(c=>de(c,o)).map(c=>{let u=e.id(`cat-${c.id}`),p=x(c,o),b=[];if(c.readonly)b.push(n("span",{class:"lc-badge"},[e.t("ui.alwaysOn")]));else{let v=Y(u);l.set(c.id,v),p.length===0&&f.push(c.id),b.push(v)}let m=p.map(v=>{let j=e.id(`svc-${v.id}`),D=[n("span",{id:j},[e.t(v.label)])];if(!c.readonly){let O=Y(j);d.set(v.id,O),O.addEventListener("change",()=>{g(c)}),D.push(O)}return n("li",{class:"lc-service"},[n("div",{class:"lc-service-head"},D),...pe(e,v)])});return n("section",{class:"lc-group","data-lc-category":c.id},[n("div",{class:"lc-group-head"},[n("h3",{class:"lc-group-title",id:u},[e.t(c.label)]),...b]),n("p",{class:"lc-group-desc"},[e.t(c.description)]),...m.length>0?[n("ul",{class:"lc-services"},m)]:[]])});function g(c){let u=l.get(c.id),p=x(c,o);if(!u||p.length===0)return;let b=p.filter(m=>d.get(m.id)?.checked===!0).length;u.checked=b>0,u.indeterminate=b>0&&b<p.length}for(let c of t.categories){let u=l.get(c.id),p=x(c,o);!u||p.length===0||u.addEventListener("change",()=>{for(let b of p){let m=d.get(b.id);m&&(m.checked=u.checked)}u.indeterminate=!1})}let P=n("button",{type:"button",class:"lc-btn lc-btn--primary","data-lc-action":"save"},[e.t("ui.save")]),M=n("button",{type:"button",class:"lc-btn lc-btn--ghost","data-lc-action":"accept"},[e.t("ui.acceptAll")]),R=n("button",{type:"button",class:"lc-btn lc-btn--ghost","data-lc-action":"reject"},[e.t("ui.rejectAll")]),A=n("button",{type:"button",class:"lc-close","data-lc-action":"close","aria-label":e.t("ui.close")},["\xD7"]);P.addEventListener("click",()=>{let c={};for(let p of f)c[p]=l.get(p)?.checked===!0;let u={};for(let[p,b]of d)u[p]=b.checked;i.save({categories:c,services:u})}),M.addEventListener("click",i.accept),R.addEventListener("click",i.reject),A.addEventListener("click",i.close);let H=n("div",{class:"lc-modal lc-surface","data-lc-preferences":"",role:"dialog","aria-modal":"true","aria-labelledby":r,"aria-describedby":s,tabindex:"-1"},[n("div",{class:"lc-modal-head"},[n("h2",{class:"lc-title",id:r},[e.t("ui.preferences.title")]),A]),n("div",{class:"lc-modal-body"},[n("p",{class:"lc-text",id:s},[e.t("ui.preferences.description")]),...a]),n("div",{class:"lc-modal-foot"},[n("div",{class:"lc-actions"},[P,M,R])])]);return{root:n("div",{class:"lc-overlay","data-lc-overlay":""},[H]),dialog:H,sync(c){for(let[u,p]of d)p.checked=c.services[u]===!0;for(let[u,p]of l){let b=t.categories.find(m=>m.id===u);b&&(x(b,o).length===0?(p.checked=c.categories[u]===!0,p.indeterminate=!1):g(b))}}}}function W(e,t,o){let i=e.id("optout-title"),r=e.id("optout-description"),s=n("button",{type:"button",class:"lc-close","data-lc-action":"close","aria-label":e.t("ui.close")},["\xD7"]);s.addEventListener("click",o.close);let l=n("button",{type:"button",class:t?"lc-btn lc-btn--ghost":"lc-btn lc-btn--link","data-lc-action":"dismiss"},[e.t("ui.close")]);l.addEventListener("click",o.close);let d=[];if(t)d.push(l);else{let a=n("button",{type:"button",class:"lc-btn lc-btn--primary","data-lc-action":"opt-out"},[e.t("ui.optOut.confirm")]);a.addEventListener("click",o.confirm),d.push(a,l)}let f=n("div",{class:"lc-modal lc-modal--narrow lc-surface","data-lc-optout":"",role:"dialog","aria-modal":"true","aria-labelledby":i,"aria-describedby":r,tabindex:"-1"},[n("div",{class:"lc-modal-head"},[n("h2",{class:"lc-title",id:i},[e.t("ui.optOut.title")]),s]),n("div",{class:"lc-modal-body"},[n("p",{class:"lc-text",id:r},[e.t(t?"ui.optOut.done":"ui.optOut.description")])]),n("div",{class:"lc-modal-foot"},[n("div",{class:"lc-actions"},d)])]);return{root:n("div",{class:"lc-overlay","data-lc-overlay":""},[f]),dialog:f}}var B=`
.lc-root {
  --lc-bg: var(--libreconsent-bg, #ffffff);
  --lc-fg: var(--libreconsent-fg, #16181d);
  --lc-muted: var(--libreconsent-muted, #565b66);
  --lc-surface: var(--libreconsent-surface, #f5f6f8);
  --lc-border: var(--libreconsent-border, #d5d8de);
  --lc-accent: var(--libreconsent-accent, #1b57d6);
  --lc-accent-fg: var(--libreconsent-accent-fg, #ffffff);
  --lc-overlay: var(--libreconsent-overlay, rgba(16, 18, 23, 0.55));
  --lc-focus: var(--libreconsent-focus, #1b57d6);
  --lc-radius: var(--libreconsent-radius, 8px);
  --lc-space: var(--libreconsent-space, 1rem);
  --lc-z: var(--libreconsent-z-index, 2147483000);
  --lc-font: var(--libreconsent-font-family, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  --lc-max: var(--libreconsent-max-width, 64rem);
  --lc-fab-inset: var(--libreconsent-fab-inset, var(--lc-space));
}
@media (prefers-color-scheme: dark) {
  .lc-root {
    --lc-bg: var(--libreconsent-bg, #16181d);
    --lc-fg: var(--libreconsent-fg, #f2f3f5);
    --lc-muted: var(--libreconsent-muted, #a8adb8);
    --lc-surface: var(--libreconsent-surface, #1e2128);
    --lc-border: var(--libreconsent-border, #343841);
    --lc-accent: var(--libreconsent-accent, #6f9bff);
    --lc-accent-fg: var(--libreconsent-accent-fg, #10131a);
    --lc-overlay: var(--libreconsent-overlay, rgba(0, 0, 0, 0.65));
    --lc-focus: var(--libreconsent-focus, #8fb2ff);
  }
}
.lc-root[data-lc-theme="light"] {
  --lc-bg: var(--libreconsent-bg, #ffffff);
  --lc-fg: var(--libreconsent-fg, #16181d);
  --lc-muted: var(--libreconsent-muted, #565b66);
  --lc-surface: var(--libreconsent-surface, #f5f6f8);
  --lc-border: var(--libreconsent-border, #d5d8de);
  --lc-accent: var(--libreconsent-accent, #1b57d6);
  --lc-accent-fg: var(--libreconsent-accent-fg, #ffffff);
  --lc-overlay: var(--libreconsent-overlay, rgba(16, 18, 23, 0.55));
  --lc-focus: var(--libreconsent-focus, #1b57d6);
}
.lc-root[data-lc-theme="dark"] {
  --lc-bg: var(--libreconsent-bg, #16181d);
  --lc-fg: var(--libreconsent-fg, #f2f3f5);
  --lc-muted: var(--libreconsent-muted, #a8adb8);
  --lc-surface: var(--libreconsent-surface, #1e2128);
  --lc-border: var(--libreconsent-border, #343841);
  --lc-accent: var(--libreconsent-accent, #6f9bff);
  --lc-accent-fg: var(--libreconsent-accent-fg, #10131a);
  --lc-overlay: var(--libreconsent-overlay, rgba(0, 0, 0, 0.65));
  --lc-focus: var(--libreconsent-focus, #8fb2ff);
}
.lc-root, .lc-root *, .lc-root *::before, .lc-root *::after { box-sizing: border-box; }
/* Zero-specificity reset: :where() keeps every component rule below able to win
   regardless of source order, which is what protects equal prominence. */
:where(.lc-root) :where(h2, h3, p, ul, li, table, button, th, td) {
  margin: 0; padding: 0; border: 0; font: inherit; color: inherit;
  text-align: start; background: none; list-style: none;
}
.lc-root {
  font-family: var(--lc-font);
  font-size: var(--libreconsent-font-size, 0.9375rem);
  line-height: 1.5;
  color: var(--lc-fg);
}
.lc-root :focus-visible { outline: 2px solid var(--lc-focus); outline-offset: 2px; }
.lc-surface {
  background: var(--lc-bg);
  color: var(--lc-fg);
  border: 1px solid var(--lc-border);
  box-shadow: var(--libreconsent-shadow, 0 6px 28px rgba(0, 0, 0, 0.18));
}
.lc-banner {
  position: fixed;
  z-index: var(--lc-z);
  padding: var(--lc-space);
  display: flex;
}
.lc-banner[data-layout="bar-bottom"] {
  inset-inline: 0;
  inset-block-end: 0;
  border-inline-width: 0;
  border-block-end-width: 0;
}
.lc-banner[data-layout="box"] {
  inset-block-end: var(--lc-space);
  inset-inline-start: var(--lc-space);
  max-inline-size: 26rem;
  border-radius: var(--lc-radius);
}
.lc-banner[data-layout="modal"] {
  position: static;
  max-inline-size: 32rem;
  inline-size: 100%;
  border-radius: var(--lc-radius);
}
.lc-copy { flex: 1 1 20rem; min-inline-size: 0; }
.lc-inner {
  display: flex;
  flex-wrap: wrap;
  gap: var(--lc-space);
  align-items: center;
  justify-content: space-between;
  inline-size: 100%;
}
.lc-banner[data-layout="bar-bottom"] .lc-inner {
  max-inline-size: var(--lc-max);
  margin-inline: auto;
}
.lc-banner[data-layout="box"] .lc-inner,
.lc-banner[data-layout="modal"] .lc-inner {
  flex-direction: column;
  align-items: stretch;
}
.lc-title { font-size: 1.0625rem; font-weight: 600; }
.lc-text { color: var(--lc-muted); margin-block-start: 0.25rem; }
.lc-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.lc-btn {
  cursor: pointer;
  border-radius: var(--lc-radius);
  padding: 0.625rem 1.125rem;
  font-size: 0.9375rem;
  font-weight: 600;
  border: 1px solid transparent;
  min-inline-size: 8.5rem;
  text-align: center;
  justify-content: center;
}
.lc-btn--primary { background: var(--lc-accent); color: var(--lc-accent-fg); }
.lc-btn--ghost {
  background: transparent;
  color: var(--lc-fg);
  border-color: var(--lc-border);
}
.lc-btn--link {
  background: transparent;
  color: var(--lc-fg);
  border-color: transparent;
  text-decoration: underline;
  min-inline-size: auto;
}
.lc-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--lc-z);
  background: var(--lc-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--lc-space);
  overflow: auto;
}
.lc-modal {
  inline-size: 100%;
  max-inline-size: 40rem;
  max-block-size: 100%;
  border-radius: var(--lc-radius);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.lc-modal--narrow { max-inline-size: 28rem; }
.lc-modal-head {
  display: flex;
  gap: var(--lc-space);
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--lc-space);
  border-block-end: 1px solid var(--lc-border);
}
.lc-modal-body { padding: var(--lc-space); overflow: auto; display: grid; gap: var(--lc-space); }
.lc-modal-foot {
  padding: var(--lc-space);
  border-block-start: 1px solid var(--lc-border);
  background: var(--lc-surface);
}
.lc-close {
  cursor: pointer;
  border-radius: var(--lc-radius);
  padding: 0.25rem 0.5rem;
  font-size: 1.25rem;
  line-height: 1;
  color: var(--lc-muted);
  flex: none;
}
.lc-group { border: 1px solid var(--lc-border); border-radius: var(--lc-radius); padding: 0.875rem; }
.lc-group-head { display: flex; gap: 0.75rem; align-items: center; justify-content: space-between; }
.lc-group-title { font-size: 1rem; font-weight: 600; }
.lc-group-desc { color: var(--lc-muted); font-size: 0.875rem; margin-block-start: 0.25rem; }
.lc-badge {
  color: var(--lc-muted);
  font-size: 0.8125rem;
  background: var(--lc-surface);
  border: 1px solid var(--lc-border);
  border-radius: 999px;
  padding: 0.125rem 0.625rem;
  flex: none;
}
.lc-toggle { display: flex; gap: 0.5rem; align-items: center; flex: none; cursor: pointer; }
.lc-check {
  inline-size: 1.15rem;
  block-size: 1.15rem;
  accent-color: var(--lc-accent);
  flex: none;
  cursor: pointer;
  margin: 0;
}
.lc-services { margin-block-start: 0.75rem; display: grid; gap: 0.5rem; }
.lc-service { border-block-start: 1px solid var(--lc-border); padding-block-start: 0.5rem; }
.lc-service-head { display: flex; gap: 0.75rem; align-items: center; justify-content: space-between; }
.lc-disclose {
  cursor: pointer;
  color: var(--lc-fg);
  font-size: 0.8125rem;
  text-decoration: underline;
  padding: 0.25rem 0;
}
.lc-cookies { margin-block-start: 0.5rem; overflow-x: auto; }
.lc-table { inline-size: 100%; border-collapse: collapse; font-size: 0.8125rem; }
.lc-table th, .lc-table td {
  border: 1px solid var(--lc-border);
  padding: 0.375rem 0.5rem;
  vertical-align: top;
}
.lc-table th { background: var(--lc-surface); font-weight: 600; }
.lc-fab {
  position: fixed;
  z-index: var(--lc-z);
  /* Declared twice on purpose: an engine without env() drops the whole max()
     declaration, and inset-block-end would fall back to auto \u2014 which un-pins
     a fixed element and would cost the zero-CLS guarantee (NFR-2). */
  inset-block-end: var(--lc-fab-inset);
  inset-block-end: max(var(--lc-fab-inset), env(safe-area-inset-bottom, 0px));
  inset-inline-start: var(--lc-fab-inset);
  display: grid;
  place-items: center;
  inline-size: 2.5rem;
  block-size: 2.5rem;
  cursor: pointer;
  border-radius: 999px;
  font-size: 0.8125rem;
  font-weight: 600;
  opacity: 0.72;
  background: var(--lc-bg);
  color: var(--lc-fg);
  border: 1px solid var(--lc-border);
  box-shadow: var(--libreconsent-shadow, 0 6px 28px rgba(0, 0, 0, 0.18));
}
.lc-fab[data-lc-position="bottom-end"] {
  inset-inline-start: auto;
  inset-inline-end: var(--lc-fab-inset);
}
/* Out of flow, and never a pointer target: revealing the label cannot resize
   the disc, so nothing moves however the button is anchored or the document is
   directed (NFR-2), and the disc's own :hover cannot flicker as the pointer
   crosses the label. */
.lc-fab-label {
  position: absolute;
  inset-block: 0;
  inset-inline-start: calc(100% + 0.375rem);
  display: grid;
  align-items: center;
  padding-inline: 0.875rem;
  white-space: nowrap;
  border-radius: 999px;
  background: var(--lc-bg);
  border: 1px solid var(--lc-border);
  box-shadow: var(--libreconsent-shadow, 0 6px 28px rgba(0, 0, 0, 0.18));
  opacity: 0;
  pointer-events: none;
}
.lc-fab[data-lc-position="bottom-end"] .lc-fab-label {
  inset-inline-start: auto;
  inset-inline-end: calc(100% + 0.375rem);
}
.lc-fab-icon {
  position: relative;
  inline-size: 1.125rem;
  block-size: 1.125rem;
  border: 1.5px solid currentColor;
  border-radius: 50%;
}
.lc-fab-icon::before, .lc-fab-icon::after { content: ""; position: absolute; border-radius: 50%; }
.lc-fab-icon::before {
  inset-block-start: 0.1875rem;
  inset-inline-start: 0.1875rem;
  inline-size: 0.1875rem;
  block-size: 0.1875rem;
  background: currentColor;
  box-shadow: 0.4375rem 0.125rem 0 currentColor, 0.0625rem 0.4375rem 0 currentColor;
}
/* Neither state may read as good or bad, so what separates them is a shape \u2014
   filled disc against hollow ring \u2014 and neither colour is green or red (UI-7). */
.lc-fab-icon::after {
  inset-block-end: -0.25rem;
  inset-inline-end: -0.3125rem;
  inline-size: 0.5rem;
  block-size: 0.5rem;
  border: 1.5px solid var(--lc-muted);
  background: var(--lc-bg);
}
.lc-fab[data-lc-consent="extended"] .lc-fab-icon::after {
  border-color: var(--lc-accent);
  background: var(--lc-accent);
}
/* Forced colours override author background and border alike, which collapses
   both states into the same disc and leaves the indicator meaningless to the
   high contrast users most likely to rely on it. System colours are honoured
   rather than overridden, so filled against hollow survives. */
@media (forced-colors: active) {
  .lc-fab-icon::after {
    background: Canvas;
    border-color: CanvasText;
  }
  .lc-fab[data-lc-consent="extended"] .lc-fab-icon::after {
    background: CanvasText;
    border-color: CanvasText;
  }
}
.lc-fab:hover, .lc-fab:focus-visible { opacity: 1; }
.lc-fab:focus-visible .lc-fab-label { opacity: 1; }
/* Only :hover is gated, so a coarse-pointer device with a keyboard attached
   still reveals the label on focus. */
@media (hover: hover) {
  .lc-fab:hover .lc-fab-label { opacity: 1; }
}
[hidden] { display: none !important; }
@media (prefers-reduced-motion: no-preference) {
  .lc-btn, .lc-close, .lc-disclose { transition: opacity 120ms ease, background-color 120ms ease; }
  .lc-fab, .lc-fab-label { transition: opacity 120ms ease; }
}
@media (max-width: 30rem) {
  .lc-btn { flex: 1 1 100%; }
  .lc-actions { inline-size: 100%; }
}
`;var Z=0,fe={categories:{},services:{}};function be(e,t){try{return e.closest(t)!==null}catch{return!1}}function G(e){try{let t=new CSSStyleSheet;return t.replaceSync(B),e.adoptedStyleSheets=[...e.adoptedStyleSheets,t],()=>{e.adoptedStyleSheets=e.adoptedStyleSheets.filter(o=>o!==t)}}catch{let t=n("style",{},[B]);return(e instanceof Document?e.head:e).append(t),()=>t.remove()}}var C=class{constructor(t,o){this.api=t;this.options=o;this.teardown=[];this.region=null;this.prefill=null;this.decided=!1;this.banner=null;this.preferences=null;this.optOut=null;this.bannerTrap=null;this.preferencesTrap=null;this.optOutTrap=null;this.fab=null;this.disposed=!1;this.config=t.getConfig();let i=K(this.config,o.locale),r=_(this.config,i);Z+=1;let s=`lc${Z}`;if(this.context={t:a=>q(r,a),id:a=>`${s}-${a.replace(/\s+/g,"_")}`,layout:o.layout},this.host=n("div",{"data-libreconsent-ui":"",lang:i}),this.root=n("div",{class:"lc-root",...o.theme==="auto"?{}:{"data-lc-theme":o.theme}}),o.shadow){let a=this.host.attachShadow({mode:"open"});this.teardown.push(G(a)),a.append(this.root),this.surface=a}else this.teardown.push(G(document)),this.host.append(this.root),this.surface=this.root;this.teardown.push(I(()=>{this.disposed||(this.options.container??document.body).append(this.host)})),this.teardown.push(this.api.on("ready",a=>{this.region=a.region,this.prefill=a.prefill??null,this.decided=a.consent!==null,a.consent?this.renderFab(a.consent):this.openBanner()}));let l=a=>{this.region=a.region??this.region,this.decided=!0,this.closeBanner(),this.closePreferences(!1),this.closeOptOut(!1),this.renderFab(a)};this.teardown.push(this.api.on("consent",l)),this.teardown.push(this.api.on("change",l)),this.teardown.push(this.api.registerRenderer(this));let d=this.config.usPrivacy.enabled?this.config.usPrivacy.doNotSellSelector:void 0,f=a=>{let g=a.target;if(g instanceof Element){if(g.closest("[data-cmp-open]")){a.preventDefault(),this.showPreferences();return}d!==void 0&&be(g,d)&&(a.preventDefault(),this.showOptOut())}};document.addEventListener("click",f),this.teardown.push(()=>document.removeEventListener("click",f))}showPreferences(){if(this.disposed||this.preferences)return;let t=k(),o=V(this.context,this.config,this.region,{save:i=>this.api.setConsent(i),accept:()=>this.api.acceptAll(),reject:()=>this.api.rejectAll(),close:()=>this.closePreferences(!0)});o.sync(this.currentChoices()),this.preferences=o,this.setBannerHidden(!0),this.root.append(o.root),this.preferencesTrap=w(o.dialog,()=>this.closePreferences(!0),t),E(o.dialog)}showOptOut(){if(this.disposed||this.optOut||!this.config.usPrivacy.enabled)return;let t=k(),o=W(this.context,this.optedOut(),{confirm:()=>this.api.setConsent({categories:this.deniedAds()}),close:()=>this.closeOptOut(!0)});this.optOut=o,this.setBannerHidden(!0),this.root.append(o.root),this.optOutTrap=w(o.dialog,()=>this.closeOptOut(!0),t),E(o.dialog)}hide(){this.closeOptOut(!1),this.closePreferences(!1),this.closeBanner()}dispose(){if(!this.disposed){this.disposed=!0,this.optOutTrap?.(),this.optOutTrap=null,this.preferencesTrap?.(),this.preferencesTrap=null,this.bannerTrap?.(),this.bannerTrap=null;for(let t of this.teardown.splice(0))t();this.host.remove()}}currentChoices(){let t=this.api.getConsent();return t?{categories:t.categories,services:t.services}:this.prefill??fe}adCategoryIds(){let{mapping:t}=this.config.consentMode,o=new Set([t.ad_storage,t.ad_user_data,t.ad_personalization].flatMap(i=>typeof i=="string"?[i]:[]));return this.config.categories.filter(i=>o.has(i.id)&&!i.readonly).map(i=>i.id)}deniedAds(){return Object.fromEntries(this.adCategoryIds().map(t=>[t,!1]))}optedOut(){let t=this.api.getConsent();return t!==null&&this.adCategoryIds().every(o=>t.categories[o]!==!0)}openBanner(){if(this.disposed||this.banner)return;let t=F(this.context,{accept:()=>this.api.acceptAll(),reject:()=>this.api.rejectAll(),customize:()=>this.showPreferences()});this.banner=t,this.root.append(t.root),this.context.layout==="modal"&&(this.bannerTrap=w(t.dialog,()=>{},null)),t.dialog.focus({preventScroll:!0})}setBannerHidden(t){this.banner&&(this.banner.root.hidden=t)}closeBanner(){this.banner&&(this.bannerTrap?.(),this.bannerTrap=null,this.banner.root.remove(),this.banner=null)}closePreferences(t){this.preferences&&(this.preferences.root.remove(),this.preferences=null,t&&!this.decided&&!this.optOut&&(this.banner?this.setBannerHidden(!1):this.openBanner()),this.preferencesTrap?.(),this.preferencesTrap=null)}closeOptOut(t){this.optOut&&(this.optOut.root.remove(),this.optOut=null,t&&!this.decided&&!this.preferences&&(this.banner?this.setBannerHidden(!1):this.openBanner()),this.optOutTrap?.(),this.optOutTrap=null)}consentLevel(t){return this.config.categories.some(o=>!o.readonly&&(t.categories[o.id]===!0||o.services.some(i=>t.services[i.id]===!0)))?"extended":"essential"}renderFab(t){if(this.disposed||!this.options.floatingButton)return;let o=this.consentLevel(t),i=this.context.t("ui.settings"),r=this.fab??n("button",{type:"button",class:"lc-fab","data-lc-action":"settings","data-lc-position":this.options.floatingButtonPosition},[n("span",{class:"lc-fab-icon"}),n("span",{class:"lc-fab-label"},[i])]);r.setAttribute("data-lc-consent",o),r.setAttribute("aria-label",`${i}. ${this.context.t(`ui.settings.${o}`)}`),!this.fab&&(r.addEventListener("click",()=>this.showPreferences()),this.fab=r,this.root.append(r))}get container(){return this.surface}};var J=["bar-bottom","box","modal"],Q=["auto","light","dark"],X=["bottom-start","bottom-end"];function h(e,t){throw new Error(`${e}: ${t}`)}function ee(e={}){(e===null||typeof e!="object")&&h("options","must be an object");let{layout:t="bar-bottom",theme:o="auto",floatingButtonPosition:i="bottom-start"}=e;return J.includes(t)||h("options.layout",`must be one of ${J.join(", ")}`),Q.includes(o)||h("options.theme",`must be one of ${Q.join(", ")}`),X.includes(i)||h("options.floatingButtonPosition",`must be one of ${X.join(", ")}`),e.shadow!==void 0&&typeof e.shadow!="boolean"&&h("options.shadow","must be a boolean"),e.floatingButton!==void 0&&typeof e.floatingButton!="boolean"&&h("options.floatingButton","must be a boolean"),e.container!==void 0&&!(e.container instanceof Element)&&h("options.container","must be an Element"),e.locale!==void 0&&typeof e.locale!="string"&&h("options.locale","must be a string"),{layout:t,theme:o,shadow:e.shadow??!0,container:e.container??null,floatingButton:e.floatingButton??!0,floatingButtonPosition:i,locale:e.locale??null}}var N=new WeakSet;function me(e,t){if(N.has(e))throw new Error("mount: this consent API already has a mounted UI");let o=new C(e,ee(t));return N.add(e),{showPreferences:()=>o.showPreferences(),showOptOut:()=>o.showOptOut(),hide:()=>o.hide(),unmount:()=>{N.delete(e),o.dispose()}}}return se(he);})();
//# sourceMappingURL=index.global.js.map