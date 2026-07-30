// ==UserScript==
// @name         ChatGPT - Prompt Splitter Module - AI RMD
// @namespace    http://tampermonkey.net/
// @version      10-15-2024
// @description  Automatically splits and sends large prompts in smaller parts.
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://cdn.jsdelivr.net/npm/@kudoai/chatgpt.js@3.3.5/dist/chatgpt.min.js
// ==/UserScript==

(async () => {
  const SEQUENCE_LABEL_LENGTH = 15;
  const DEFAULT_CHARACTER_LIMIT = 6000;
  const config = {
    characterLimit: DEFAULT_CHARACTER_LIMIT,
    batchSending: false,
  };

  const Logger = {
    info: (msg) => console.info(`[INFO] ${msg}`),
    warn: (msg) => console.warn(`[WARN] ${msg}`),
    error: (msg) => console.error(`[ERROR] ${msg}`),
  };

  // Split prompt into smaller chunks, ensuring each part respects the character limit
  function splitPrompt(prompt, maxLength) {
    const words = prompt.split(/(\s+)/); // Split by words, keeping spaces
    const parts = [];
    let currentPart = "";

    for (const chunk of words) {
      if ((currentPart + chunk).length <= maxLength) {
        currentPart += chunk;
      } else {
        if (currentPart.trim()) parts.push(currentPart.trim());
        currentPart = chunk;
      }
    }

    if (currentPart.trim()) parts.push(currentPart.trim());
    return parts;
  }

  // Function to send each command part and log success/failure
  async function sendCommand(command, partNumber, totalParts) {
    try {
      Logger.info(`Sending command (${partNumber} of ${totalParts}): ${command}`);
      const response = await chatgpt.send(command);
      if (response.error) {
        throw new Error(response.error);
      }
      Logger.info(`Command part ${partNumber} sent successfully.`);
      return response;
    } catch (error) {
      Logger.error(`Failed to send command part ${partNumber}: ${error.message}`);
      throw error;
    }
  }

  // Send each part of the prompt, optionally batching with delay
  async function sendPromptParts(prompt) {
    const maxLength = config.characterLimit - SEQUENCE_LABEL_LENGTH;
    const parts = splitPrompt(prompt, maxLength);

    for (let i = 0; i < parts.length; i++) {
      const labeledPart = `(${i + 1} of ${parts.length}) ${parts[i]}`;
      await sendCommand(labeledPart, i + 1, parts.length);

      if (config.batchSending && i < parts.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay between parts
      }
    }
  }

  // Read file content and process it
  function readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  }

  async function processFile(file) {
    try {
      const fileContent = await readFileContent(file);
      await sendPromptParts(fileContent);
      Logger.info("File processing completed successfully.");
    } catch (error) {
      Logger.error(`Error processing file: ${error.message}`);
    }
  }

  // Create hidden file input for uploading .txt files
  function createFileInput() {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".txt";
    fileInput.style.display = "none";
    fileInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (file) {
        processFile(file);
      }
    });
    document.body.appendChild(fileInput);
    return fileInput;
  }

  // Create and attach an "Upload File" button to trigger file input
  function createUploadButton(fileInput) {
    const uploadButton = document.createElement("button");
    uploadButton.textContent = "Upload and Process File";
    uploadButton.style.position = "fixed";
    uploadButton.style.bottom = "20px";
    uploadButton.style.right = "20px";
    uploadButton.style.zIndex = "9999";
    uploadButton.addEventListener("click", () => fileInput.click());
    document.body.appendChild(uploadButton);
  }

  // Configuration UI to adjust character limit and batch sending option
  function createConfigButton() {
    const configButton = document.createElement("button");
    configButton.textContent = "Configure";
    configButton.style.position = "fixed";
    configButton.style.bottom = "60px";
    configButton.style.right = "20px";
    configButton.style.zIndex = "9999";

    configButton.addEventListener("click", () => {
      const characterLimit = prompt("Enter character limit:", config.characterLimit);
      if (characterLimit)
        config.characterLimit = parseInt(characterLimit, 10) || DEFAULT_CHARACTER_LIMIT;

      const batchSending = confirm("Enable batch sending with 1-second delay between parts?");
      config.batchSending = batchSending;

      Logger.info(`Configuration updated: ${JSON.stringify(config)}`);
    });

    document.body.appendChild(configButton);
  }

  const fileInput = createFileInput();
  createUploadButton(fileInput);
  createConfigButton();
})();
