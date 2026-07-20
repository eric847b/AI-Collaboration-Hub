import { supabase } from "@/integrations/supabase/client";

export type CodeType = "component" | "hook" | "utility" | "edgeFunction";

export interface CodeGenerationRequest {
  type: CodeType;
  description: string;
  filePath: string;
  existingCode?: string;
}

export interface CodeGenerationResult {
  success: boolean;
  code?: string;
  filePath: string;
  type: string;
  timestamp: string;
  error?: string;
}

/**
 * Generate code using AI
 */
export async function generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResult> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-code', {
      body: request
    });

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Code generation error:', error);
    return {
      success: false,
      filePath: request.filePath,
      type: request.type,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Apply an improvement suggestion to code
 */
export async function applyImprovement(
  suggestion: any,
  filePath: string,
  currentCode?: string,
  autoApply: boolean = false
) {
  try {
    const { data, error } = await supabase.functions.invoke('apply-improvement', {
      body: { suggestion, filePath, currentCode, autoApply }
    });

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Apply improvement error:', error);
    throw error;
  }
}

/**
 * Validate generated code for common issues
 */
export function validateCode(code: string, type: CodeType): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Basic validation
  if (code.length < 50) {
    issues.push("Code is too short - may be incomplete");
  }

  // Type-specific validation
  switch (type) {
    case "component":
      if (!code.includes("export") && !code.includes("default")) {
        issues.push("Component should export a default or named export");
      }
      if (!code.includes("return")) {
        issues.push("React component should return JSX");
      }
      break;

    case "hook":
      if (!code.match(/^(export\s+)?function\s+use[A-Z]/m)) {
        issues.push("Custom hook name should start with 'use'");
      }
      break;

    case "utility":
      if (!code.includes("export")) {
        issues.push("Utility should export functions");
      }
      break;

    case "edgeFunction":
      if (!code.includes("serve")) {
        issues.push("Edge function should use Deno serve");
      }
      if (!code.includes("corsHeaders")) {
        issues.push("Edge function should include CORS headers");
      }
      break;
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Format code (basic formatting)
 */
export function formatCode(code: string): string {
  // Remove extra blank lines
  code = code.replace(/\n{3,}/g, '\n\n');
  
  // Ensure consistent line endings
  code = code.replace(/\r\n/g, '\n');
  
  // Trim whitespace
  code = code.trim();
  
  return code;
}

/**
 * Extract imports from code
 */
export function extractImports(code: string): string[] {
  const importRegex = /^import\s+.*from\s+['"](.+)['"];?$/gm;
  const imports: string[] = [];
  let match;
  
  while ((match = importRegex.exec(code)) !== null) {
    imports.push(match[0]);
  }
  
  return imports;
}

/**
 * Check if code already exists (to avoid duplicates)
 */
export function checkCodeDuplicates(newCode: string, existingCode: string): boolean {
  // Simple check - in production, use more sophisticated comparison
  const newCodeNormalized = newCode.replace(/\s+/g, '').toLowerCase();
  const existingCodeNormalized = existingCode.replace(/\s+/g, '').toLowerCase();
  
  return existingCodeNormalized.includes(newCodeNormalized) || 
         newCodeNormalized.includes(existingCodeNormalized);
}
