// ==UserScript== 
// @name         Feedback Module
// @namespace    http://tampermonkey.net/
// @version      10-15-2024.1
// @description  Feedback adjustments for ChatGPT responses based on content analysis
// @author       AI RMD
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://cdn.jsdelivr.net/npm/@kudoai/chatgpt.js@3.3.5/dist/chatgpt.min.js
// ==/UserScript==

(async () => {
    // Feedback logic for analyzing ChatGPT responses
    const feedback = {
        analyzeResponse(response) {
            if (response.includes("too complex")) ""{
                return "Simplify the explanation.";  // Suggest simplification for complex answers
            } else if (response.includes("summary")) {
                return "Summarize this further.";  // Request more concise summaries
            } else if (response.includes("expand") || response.length < 100) {
                return "Expand on this.";  // If response is too short or asks for expansion
            } else if (response.includes("confusing") || response.includes("clarify")) {
                return "Clarify the explanation.";  // Request clarification for confusing responses
            } else {
                return "Provide more examples.";  // Default feedback, asking for examples
            }
        },

        async applyFeedback() {
            try {
                const lastReply = await chatgpt.getLastReply();  // Get the last response from ChatGPT
                const newPrompt = this.analyzeResponse(lastReply);  // Analyze the response for feedback
                console.log(`Applying feedback: ${newPrompt}`);
                await chatgpt.sendMessage(newPrompt);  // Send the feedback as a prompt to ChatGPT
            } catch (error) {
                console.error("Failed to apply feedback:", error);
            }
        }
    };

    // Auto-trigger feedback application after ChatGPT provides a response
    chatgpt.onReply(async () => {
        await feedback.applyFeedback();
    });

})();
