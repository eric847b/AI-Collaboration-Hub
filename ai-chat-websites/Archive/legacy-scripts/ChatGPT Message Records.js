// ==UserScript==
// @name        ChatGPT: Message Records
// @namespace   UserScripts
// @match       https://chatgpt.com/*
// @match       https://chat.openai.com/*
// @grant       GM.getValue
// @grant       GM.setValue
// @grant       GM.deleteValue
// @grant       GM_addValueChangeListener
// @grant       unsafeWindow
// @version     1.1.6
// @author      CY Fung
// @license     MIT
// @description Remind you how many quota you have left and track message records
// @run-at      document-start
// @inject-into page
// ==/UserScript==

const __errorCode21167__ = (() => {
  try {
    Promise.resolve('\u{1F4D9}', ((async () => { })()).constructor);
  } catch (e) {
    console.log('%cUnsupported Browser', 'background-color: #FAD02E; color: #333; padding: 4px 8px; font-weight: bold; border-radius: 4px;');
    return 0x3041;
  }
  if (typeof GM_addValueChangeListener !== 'function' || typeof GM !== 'object' || typeof (GM || 0).setValue !== 'function') {
    console.log('%cUnsupported UserScript Manager', 'background-color: #FAD02E; color: #333; padding: 4px 8px; font-weight: bold; border-radius: 4px;');
    return 0x3042;
  }
  return 0;
})();

__errorCode21167__ || (() => {
  const uWin = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const Promise = ((async () => { })()).constructor;
  let __recordId_new = 1;
  let abortCounter = 0;
  let userOpenAction = null;

  const kPattern = (num) => {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const k = num % 9;
    const j = Math.floor(num / 9);
    const letter = letters[j];
    return `${letter}${k + 1}`;
  }

  const kHash = (n) => {
    if (n < 0 || n > 54755) {
      throw new Error('Number out of range');
    }
    const nValue = 9 * 26;
    let hashBase = (n * 9173) % 54756;
    let hash = '';
    for (let i = 0; i < 2; i++) {
      const t = hashBase % nValue;
      hash = kPattern(t) + hash;
      hashBase = Math.floor(hashBase / nValue);
    }
    return hash;
  }

  const cleanContext = async (win, gmWindow) => {
    const sanitize = (fc) => {
      const { setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame, cancelAnimationFrame } = fc;
      const res = { setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame, cancelAnimationFrame };
      for (let k in res) res[k] = res[k].bind(win);
      return res;
    }

    if (gmWindow && typeof gmWindow === 'object' && gmWindow.GM_info && gmWindow.GM) {
      let isIsolatedContext = (
        (gmWindow.requestAnimationFrame !== win.requestAnimationFrame) &&
        (gmWindow.cancelAnimationFrame !== win.cancelAnimationFrame) &&
        (gmWindow.setTimeout !== win.setTimeout) &&
        (gmWindow.setInterval !== win.setInterval) &&
        (gmWindow.clearTimeout !== win.clearTimeout) &&
        (gmWindow.clearInterval !== win.clearInterval)
      );
      if (isIsolatedContext) {
        return sanitize(gmWindow);
      }
    }

    const waitFn = requestAnimationFrame;
    try {
      let mx = 16;
      const frameId = 'vanillajs-iframe-v1'
      let frame = document.getElementById(frameId);
      let removeIframeFn = null;
      if (!frame) {
        frame = document.createElement('iframe');
        frame.id = frameId;
        const blobURL = typeof webkitCancelAnimationFrame === 'function' ? (frame.src = URL.createObjectURL(new Blob([], { type: 'text/html' }))) : null;
        frame.sandbox = 'allow-same-origin';
        let n = document.createElement('noscript');
        n.appendChild(frame);
        while (!document.documentElement && mx-- > 0) await new Promise(waitFn);
        const root = document.documentElement;
        root.appendChild(n);
        if (blobURL) Promise.resolve().then(() => URL.revokeObjectURL(blobURL));
        removeIframeFn = (setTimeout) => {
          const removeIframeOnDocumentReady = (e) => {
            e && win.removeEventListener("DOMContentLoaded", removeIframeOnDocumentReady, false);
            e = n;
            n = win = removeIframeFn = 0;
            setTimeout ? setTimeout(() => e.remove(), 200) : e.remove();
          }
          if (!setTimeout || document.readyState !== 'loading') {
            removeIframeOnDocumentReady();
          } else {
            win.addEventListener("DOMContentLoaded", removeIframeOnDocumentReady, false);
          }
        }
      }
      while (!frame.contentWindow && mx-- > 0) await new Promise(waitFn);
      const fc = frame.contentWindow;
      if (!fc) throw "window is not found.";
      try {
        const res = sanitize(fc);
        if (removeIframeFn) Promise.resolve(res.setTimeout).then(removeIframeFn);
        return res;
      } catch (e) {
        if (removeIframeFn) removeIframeFn();
        return null;
      }
    } catch (e) {
      console.warn(e);
      return null;
    }
  };

  cleanContext(uWin, window).then((__CONTEXT__) => {
    const { setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame, cancelAnimationFrame } = __CONTEXT__;
    const console = Object.assign({}, window.console);
    const jParse = window.JSON.parse.bind(window.JSON);
    const jParseCatched = (val) => {
      let res = null;
      try {
        res = jParse(val);
      } catch (e) { }
      return res;
    }
    const jStringify = window.JSON.stringify.bind(window.JSON);
    const GM_RECORD_KEY = 'TOTAL_MESSAGE_RECORDS';
    let __foregroundActivityMeasure = 0;
    let __totalActivityMeasure = 0;
    const foregroundActivityMeasureInterval = 500;
    const amiUL = foregroundActivityMeasureInterval * 1.1;
    const amiLL = foregroundActivityMeasureInterval * 0.9;
    const activityMeasure = {
      get foreground() {
        return __foregroundActivityMeasure;
      },
      get background() {
        return activityMeasure.total - activityMeasure.foreground;
      },
      get total() {
        return Math.round(__totalActivityMeasure)
      }
    }
    let __uid = 0;
    let message_cap = null;
    let message_cap_window = null;
    let categories = null;
    let models = null;
    let currentAccount = null;
    let currentUser = null;
    const getUserId = () => currentAccount && currentUser ? `${currentAccount}.${currentUser}` : '';
    const dummyObject = {};
    for (const [key, value] of Object.entries(console)) {
      if (typeof value === 'function' && typeof dummyObject[key] !== 'function') {
        console[key] = value.bind(window.console);
      }
    }
    const messageRecords = [];
    let messageRecordsOnCurrentAccount = null;
    const findRecordIndexByRId = (rid) => {
      if (!rid) return null;
      for (let i = 0; i < messageRecords.length; i++) {
        const record = messageRecords[i];
        if (record.$recordId && rid === record.$recordId) {
          return i;
        }
      }
      return -1;
    }
    const cssStyleText = () => `
          :root {
              --mr-background-color: #2a5c47;
              --mr-font-stack: "Ubuntu-Italic", "Lucida Sans", helvetica, sans;
              --mr-target-width: 30px;
              --mr-target-height: 30px;
              --mr-target-bottom: 90px;
              --mr-target-right: 50px;
              --mr-tb-radius: calc(2.42 * var(--mr-border-width));
              --mr-message-bubble-width: 200px;
              --mr-message-bubble-margin: 0;
              --mr-border-width: 2px;
              --mr-triangle-border-width: var(--mr-tb-radius);
              --mr-message-bubble-opacity: 0;
              --mr-message-bubble-scale: 0.5;
              --mr-message-bubble-transform-origin: bottom right;
              --mr-message-bubble-transition: opacity 0.3s, transform 0.3s, visibility 0s 0.3s;
              --mr-border-color: #666;
              --mr-tb-btm: calc(var(--mr-tb-radius) * 1.72);
            }
            html {
                --mr-message-bubble-bg-color: #ecf3e7;
                --mr-message-bubble-text-color: #414351;
                --progress-color: #807e1e;
            }
            html.dark{
                --mr-message-bubble-bg-color: #40414f;
                --mr-message-bubble-text-color: #ececf1;
            }
            html[mr-request-model="gpt-4"]{
                --progress-color: #ac68ff;
            }
            html[mr-request-model="gpt-3"] {
            --progress-color: #19c37d;
            }
            html[mr-request-state="request"] {
              --progress-percent: 25%;
              --progress-rr: 9px;
            }
            html[mr-request-state="response"] {
              --progress-percent: 75%;
              --progress-rr: 9px;
            }
            html[mr-request-state=""] {
              --progress-percent: 100%;
              --progress-rr: 20px;
            }
    html[mr-request-state=""] .mr-progress-bar::before {
    --mr-animate-background-image: none;
    }
            .mr-progress-bar.mr-progress-bar-show {
              visibility:visible;
            }
             .mr-progress-bar {
     display: inline-block;
     width: 200px;
     --progress-height: 16px;
     --progress-padding: 4px;
     --progress-stripe-color: rgba(255, 255, 255, 0.2);
     --progress-shadow1: rgba(255, 255, 255, 0.3);
     --progress-shadow2: rgba(0, 0, 0, 0.4);
     --progress-rl: 20px;
     width: 100%;
     visibility: collapse;
   }
   @keyframes mr-progress-bar-move {
     0% {
       background-position: 0 0;
     }
     100% {
       background-position: 50px 50px;
     }
   }
   .mr-progress-bar {
     box-sizing: border-box;
     height: var(--progress-height);
     position: relative;
     background: #555;
     border-radius: 25px;
     box-shadow: inset 0 -1px 1px var(--progress-shadow1);
     display: inline-block;
   }
   .mr-progress-bar::before {
     box-sizing: border-box;
     content: "";
     display: block;
     margin: var(--progress-padding);
     border-top-right-radius: var(--progress-rr);
     border-bottom-right-radius: var(--progress-rr);
     border-top-left-radius: var(--progress-rl);
     border-bottom-left-radius: var(--progress-rl);
     background-color: var(--progress-color);
     box-shadow: inset 0 2px 9px var(--progress-shadow1), inset 0 -2px 6px var(--progress-shadow2);
     position: absolute;
     top: 0;
     left: 0;
     right: calc(100% - var(--progress-percent));
     transition: right 300ms, background-color 300ms;
     bottom: 0;
     --mr-animate-background-image: linear-gradient(-45deg, var(--progress-stripe-color) 25%, transparent 25%, transparent 50%, var(--progress-stripe-color) 50%, var(--progress-stripe-color) 75%, transparent 75%, transparent);
    background-image: var(--mr-animate-background-image);
     background-size: 50px 50px;
     animation: mr-progress-bar-move 2s linear infinite;
   }
   .mr-nostripes::before {
   --mr-animate-background-image: none;
   }
   #mr-msg-l {
      text-align: center;
      font-size: .875rem;
      color: var(--tw-prose-code);
      font-size: .875em;
      font-weight: 600;
   }
   #mr-msg-p {
      text-align: center;
      font-size: 1rem;
   }
   #mr-msg-p1{
      display: block;
   }
   #mr-msg-p2{
      display: block;
      font-size: .75rem;
   }
            body {
              background-color: var(--mr-background-color);
              font-family: var(--mr-font-stack);
              position: relative;
              height: 100vh;
              margin: 0;
              padding: 0;
              overflow: hidden;
            }
            .mr-message-bubble {
              margin: 0;
              display: inline-block;
              position: absolute;
              width: var(--mr-message-bubble-width);
              height: auto;
              background-color: var(--mr-message-bubble-bg-color);
              opacity: var(--mr-message-bubble-opacity);
              transform: scale(var(--mr-message-bubble-scale));
              transform-origin: var(--mr-message-bubble-transform-origin);
              transition: var(--mr-message-bubble-transition);
              visibility: hidden;
              margin-bottom: var(--mr-tb-btm);
              bottom:0;
              right:0;
              color: var(--mr-message-bubble-text-color);
              --mr-user-select: auto-user-select;
            }
            .mr-border {
              border: var(--mr-border-width) solid var(--mr-border-color);
            }
            .mr-round {
              border-radius: var(--mr-tb-radius);
            }
            .mr-tri-right.mr-border.mr-btm-right:before {
              content: ' ';
              position: absolute;
              width