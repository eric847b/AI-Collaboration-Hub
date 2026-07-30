// ==UserScript==
// @name                ChatGPT - Prompt Splitter Module - AI RMD
// @version             2024.10.16
// @grant               GM_setValue
// @grant               GM_getValue
// @grant               GM_registerMenuCommand
// @require             https://cdn.jsdelivr.net/npm/@kudoai/chatgpt.js@latest/dist/chatgpt.min.js
// ==/UserScript==

(async () => {
  const e = 6e3;
  async function o(e, o, n) {
    try {
      console.log(`Sending part ${o} of ${n}: ${e}`);
      const t = await chatgpt.sendMessage(e);
      if (t.error) throw new Error(t.error);
      console.log("Command sent successfully:", t);
    } catch (e) {
      console.error("Error sending command:", e);
    }
  }
  async function n(n) {
    try {
      const t = await (async function (e) {
        return new Promise((o, n) => {
          const t = new FileReader();
          ((t.onload = (e) => o(e.target.result)), (t.onerror = (e) => n(e)), t.readAsText(e));
        });
      })(n);
      (console.log("File content read successfully, starting to send parts..."),
        await (async function (n) {
          let t = (function (e, o) {
            const n = e.split(/(\s+)/),
              t = [];
            let r = "";
            return (
              n.forEach((e) => {
                (r + e).length <= o ? (r += e) : (t.push(r.trim()), (r = e.trim()));
              }),
              r && t.push(r.trim()),
              t
            );
          })(n, e - 15);
          console.log(`Split into ${t.length} parts:`);
          for (const [e, n] of t.entries()) {
            const r = `(${e + 1} of ${t.length}) ${n}`;
            await o(r, e + 1, t.length);
          }
        })(t));
    } catch (e) {
      console.error("Error processing file:", e);
    }
  }
  const t = document.createElement("input");
  ((t.type = "file"),
    (t.accept = ".txt"),
    (t.style.display = "none"),
    (t.onchange = (e) => {
      const o = e.target.files[0];
      o ? (console.log("File selected:", o.name), n(o)) : console.warn("No file selected");
    }),
    document.body.appendChild(t));
  (({
    triggerFileUpload: () => {
      (console.log("Triggering file upload..."), t.click());
    },
    registerMenuCommands() {
      GM_registerMenuCommand("Upload and Split File", () => {
        (console.log("File upload and split initiated."), this.triggerFileUpload());
      });
    },
  }).registerMenuCommands(),
    console.log("ChatGPT Prompt Splitter Module is ready."));
})();
