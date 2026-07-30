// ==UserScript==
// @name          ChatGPT - Automatic JavaScript Executor Module - AI RMD (chatgpt.js version 3.3.5)
// @description   Automatically execute JavaScript that ChatGPT generates using eval() and feed results back to ChatGPT using chatgpt.js
// @version       10-15-2024
// @license       MIT
// @grant         GM_getValue
// @grant         GM_setValue
// ==/UserScript==

(async () => {
  const config = { prefix: "chatgptScript" };
  const pastResponses = new Set();
  const codeHistory = [];

  // Use chatgpt.js functionality for streamlined control
  if (!chatgpt.isInstalled()) {
    console.error(
      "chatgpt.js version 3.3.5 is not available. Please ensure it is loaded correctly."
    );
    return;
  }

  // Function to prompt user confirmation for code execution
  function confirmExecution(scriptCode) {
    return new Promise((resolve) => {
      const userResponse = confirm(`Do you want to execute the following code?\n\n${scriptCode}`);
      resolve(userResponse);
    });
  }

  // Function to send a reply back to ChatGPT
  async function sendReply(reply) {
    await chatgpt.send(reply);
  }

  // Process ChatGPT's last response using chatgpt.js
  async function processLastResponse() {
    const response = chatgpt.getLastResponse(); // Get the last response via chatgpt.js
    if (response && !pastResponses.has(response)) {
      console.log("---RESPONSE---", response);
      pastResponses.add(response);

      if (response.startsWith("EXECUTE")) {
        const scriptCode = chatgpt.code.extract(response); // Extract the code block
        let nextPrompt = "";

        // Confirm execution with the user
        const userConfirmed = await confirmExecution(scriptCode);
        if (userConfirmed) {
          try {
            let code_output;
            eval(scriptCode); // Execute the provided code
            codeHistory.push(scriptCode); // Store executed code in history
            nextPrompt = `RESULT ${typeof code_output !== "undefined" ? code_output : "Executed successfully"}`;
          } catch (error) {
            nextPrompt = `ERROR ${error.stack}`;
          }
        } else {
          nextPrompt = "Execution canceled by user.";
        }

        await sendReply(nextPrompt); // Send the result or error back to ChatGPT
      }
    }
  }

  // Listen for new responses using chatgpt.js event hooks
  chatgpt.on("response", async (response) => {
    await processLastResponse(); // Automatically process new responses
  });

  // Initialize chatgpt.js when it's ready
  chatgpt.isLoaded().then(() => {
    console.log("ChatGPT is ready, using chatgpt.js version 3.3.5.");
  });
})();
