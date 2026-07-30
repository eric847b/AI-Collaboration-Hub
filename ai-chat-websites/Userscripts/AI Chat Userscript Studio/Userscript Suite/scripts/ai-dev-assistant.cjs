#!/usr/bin/env node

/**
 * AI-Assisted Development Script
 * Provides intelligent code suggestions, auto-fixes, and development insights
 * Usage: node scripts/ai-dev-assistant.cjs
 */

const fs = require('fs');
const path = require('path');
const utils = require('./bundler-utils.cjs');

const MODULES_DIR = path.join(__dirname, '../Modules');
const DEFAULT_MAX_DISPLAY_ISSUES = 12;
const DEFAULT_MAX_DISPLAY_SUGGESTIONS = 8;
const MAX_HEALTH_PENALTY_PER_FILE = 24;
const ISSUE_WEIGHTS = Object.freeze({
  security: 10,
  performance: 8,
  'error-handling': 7,
  logging: 4,
  i18n: 3
});
const SUGGESTION_WEIGHTS = Object.freeze({
  optimization: 2
});
const FEATURE_SUGGESTIONS = Object.freeze([
  'Add a dark mode toggle to the UI module',
  'Implement offline caching for better performance',
  'Add keyboard shortcuts for common actions',
  'Create a module for exporting chat conversations',
  'Add voice input support for accessibility',
  'Implement real-time collaboration features',
  'Add AI-powered code completion suggestions',
  'Create a dashboard for monitoring module performance'
]);

function countMatches(content, pattern) {
  const matches = content.match(pattern);
  return matches ? matches.length : 0;
}

function toSortedCounts(items, weightMap = {}) {
  const counts = new Map();

  items.forEach(item => {
    counts.set(item.type, (counts.get(item.type) || 0) + 1);
  });

  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      const rightWeight = weightMap[right.type] || 0;
      const leftWeight = weightMap[left.type] || 0;
      if (rightWeight !== leftWeight) {
        return rightWeight - leftWeight;
      }

      return left.type.localeCompare(right.type);
    });
}

function toTopFiles(items) {
  const counts = new Map();

  items.forEach(item => {
    counts.set(item.file, (counts.get(item.file) || 0) + 1);
  });

  return [...counts.entries()]
    .map(([file, count]) => ({ file, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.file.localeCompare(right.file);
    });
}

function formatTypeSummary(entries) {
  return entries.map(entry => `${entry.type}: ${entry.count}`).join(', ');
}

function formatFileSummary(entries) {
  return entries.map(entry => `${entry.file} (${entry.count})`).join(', ');
}

function sortFindings(items, weightMap = {}) {
  return [...items].sort((left, right) => {
    const rightWeight = weightMap[right.type] || 0;
    const leftWeight = weightMap[left.type] || 0;
    if (rightWeight !== leftWeight) {
      return rightWeight - leftWeight;
    }

    const fileCompare = left.file.localeCompare(right.file);
    if (fileCompare !== 0) {
      return fileCompare;
    }

    return left.message.localeCompare(right.message);
  });
}

function parsePositiveInteger(value, flagName) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flagName} must be a positive integer.`);
  }

  return parsed;
}

function parseCliArgs(argv = process.argv.slice(2)) {
  const options = {
    maxDisplayIssues: DEFAULT_MAX_DISPLAY_ISSUES,
    maxDisplaySuggestions: DEFAULT_MAX_DISPLAY_SUGGESTIONS
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--all') {
      options.maxDisplayIssues = Number.POSITIVE_INFINITY;
      options.maxDisplaySuggestions = Number.POSITIVE_INFINITY;
      continue;
    }

    if (argument === '--issues') {
      options.maxDisplayIssues = parsePositiveInteger(argv[index + 1], '--issues');
      index += 1;
      continue;
    }

    if (argument.startsWith('--issues=')) {
      options.maxDisplayIssues = parsePositiveInteger(argument.split('=')[1], '--issues');
      continue;
    }

    if (argument === '--suggestions') {
      options.maxDisplaySuggestions = parsePositiveInteger(argv[index + 1], '--suggestions');
      index += 1;
      continue;
    }

    if (argument.startsWith('--suggestions=')) {
      options.maxDisplaySuggestions = parsePositiveInteger(argument.split('=')[1], '--suggestions');
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

class AIDevAssistant {
  constructor(dependencies = {}) {
    this.fs = dependencies.fs || fs;
    this.path = dependencies.path || path;
    this.utils = dependencies.utils || utils;
    this.logger = dependencies.logger || console;
    this.modulesDir = dependencies.modulesDir || MODULES_DIR;
    this.maxDisplayIssues = dependencies.maxDisplayIssues || DEFAULT_MAX_DISPLAY_ISSUES;
    this.maxDisplaySuggestions =
      dependencies.maxDisplaySuggestions || DEFAULT_MAX_DISPLAY_SUGGESTIONS;
    this.featureSuggestions = dependencies.featureSuggestions || FEATURE_SUGGESTIONS;
    this.suggestions = [];
    this.issues = [];
    this.analyzedFiles = [];
  }

  analyzeModules() {
    this.suggestions = [];
    this.issues = [];
    const moduleFiles = this.utils.getModuleFiles(this.modulesDir);
    this.analyzedFiles = moduleFiles.map(filePath => this.path.basename(filePath));

    moduleFiles.forEach(filePath => {
      const fileName = this.path.basename(filePath);
      const content = this.fs.readFileSync(filePath, 'utf-8');

      this.analyzeFile(fileName, content);
    });

    return this.generateReport();
  }

  analyzeFile(fileName, content) {
    // Check for common issues and suggest improvements

    // 1. Check for console.log statements (should use proper logging)
    if (/\bconsole\.log\s*\(/.test(content)) {
      this.issues.push({
        file: fileName,
        type: 'logging',
        message: 'Consider using a proper logging module instead of console.log',
        suggestion: 'Replace console.log with a logging utility for better control'
      });
    }

    // 2. Check for hardcoded strings
    const hardcodedStrings = content.match(/'[^']{20,}'|"[^"]{20,}"/g);
    if (hardcodedStrings && hardcodedStrings.length > 3) {
      this.issues.push({
        file: fileName,
        type: 'i18n',
        message: 'Multiple long hardcoded strings detected',
        suggestion: 'Consider extracting strings to a constants file or i18n system'
      });
    }

    // 3. Check for missing error handling
    const tryCount = countMatches(content, /\btry\b/g);
    const catchCount = countMatches(content, /\bcatch\b/g);
    if (tryCount > catchCount) {
      this.issues.push({
        file: fileName,
        type: 'error-handling',
        message: 'Try block without catch detected',
        suggestion: 'Add proper catch blocks for error handling'
      });
    }

    // 4. Check for performance issues
    const setIntervalCount = countMatches(content, /\bsetInterval\s*\(/g);
    const clearIntervalCount = countMatches(content, /\bclearInterval\s*\(/g);
    if (setIntervalCount > clearIntervalCount) {
      this.issues.push({
        file: fileName,
        type: 'performance',
        message: 'setInterval without clearInterval',
        suggestion: 'Store interval IDs and clear them when appropriate'
      });
    }

    // 5. Suggest optimizations
    if (content.includes('document.querySelectorAll') && content.includes('.forEach')) {
      this.suggestions.push({
        file: fileName,
        type: 'optimization',
        message: 'Consider using more efficient DOM traversal methods',
        suggestion: 'Use getElementsByClassName or getElementsByTagName for better performance'
      });
    }

    // 6. Check for security issues
    if (/\.\s*innerHTML\s*=/.test(content) && !content.includes('DOMPurify')) {
      this.issues.push({
        file: fileName,
        type: 'security',
        message: 'innerHTML usage without sanitization',
        suggestion: 'Use textContent or sanitize HTML with DOMPurify'
      });
    }
  }

  calculateHealthScore() {
    const analyzedFileCount =
      this.analyzedFiles.length ||
      new Set([...this.issues.map(issue => issue.file), ...this.suggestions.map(item => item.file)])
        .size ||
      1;
    const penaltiesByFile = new Map();

    this.issues.forEach(issue => {
      const currentPenalty = penaltiesByFile.get(issue.file) || 0;
      penaltiesByFile.set(issue.file, currentPenalty + (ISSUE_WEIGHTS[issue.type] || 1));
    });

    this.suggestions.forEach(suggestion => {
      const currentPenalty = penaltiesByFile.get(suggestion.file) || 0;
      penaltiesByFile.set(
        suggestion.file,
        currentPenalty + (SUGGESTION_WEIGHTS[suggestion.type] || 1)
      );
    });

    const cappedPenalty = [...penaltiesByFile.values()].reduce((total, penalty) => {
      return total + Math.min(penalty, MAX_HEALTH_PENALTY_PER_FILE);
    }, 0);

    const maxPenalty = analyzedFileCount * MAX_HEALTH_PENALTY_PER_FILE;
    const healthScore = 100 - Math.round((cappedPenalty / maxPenalty) * 100);
    return Math.max(0, Math.min(100, healthScore));
  }

  logFindings(sectionLabel, items, maxItems, weightMap) {
    const orderedItems = sortFindings(items, weightMap);
    const visibleItems = orderedItems.slice(0, maxItems);

    this.logger.info(`\n[${sectionLabel}] Found ${items.length}:`);
    visibleItems.forEach((item, index) => {
      this.logger.info(`${index + 1}. ${item.file}: ${item.message}`);
      this.logger.info(`   Suggestion: ${item.suggestion}`);
      this.logger.info('');
    });

    if (items.length > visibleItems.length) {
      this.logger.info(
        `[${sectionLabel}] ${items.length - visibleItems.length} additional finding(s) omitted for readability.`
      );
    }
  }

  generateReport() {
    this.logger.info('='.repeat(60));
    this.logger.info('[AI] Development Assistant Report');
    this.logger.info('='.repeat(60));
    this.logger.info(`\n[Summary] Files analyzed: ${this.analyzedFiles.length}`);

    if (this.issues.length > 0) {
      const issueTypes = toSortedCounts(this.issues, ISSUE_WEIGHTS);
      const topIssueFiles = toTopFiles(this.issues).slice(0, 5);
      this.logger.info(`[Summary] Issue types: ${formatTypeSummary(issueTypes)}`);
      this.logger.info(`[Summary] Most affected files: ${formatFileSummary(topIssueFiles)}`);
      this.logFindings('Issues', this.issues, this.maxDisplayIssues, ISSUE_WEIGHTS);
    } else {
      this.logger.info('\n[OK] No major issues detected.');
    }

    if (this.suggestions.length > 0) {
      const suggestionTypes = toSortedCounts(this.suggestions, SUGGESTION_WEIGHTS);
      this.logger.info(`[Summary] Suggestion types: ${formatTypeSummary(suggestionTypes)}`);
      this.logFindings(
        'Suggestions',
        this.suggestions,
        this.maxDisplaySuggestions,
        SUGGESTION_WEIGHTS
      );
    }

    const healthScore = this.calculateHealthScore();
    this.logger.info(`[Health] Code score: ${healthScore}/100`);

    if (healthScore > 80) {
      this.logger.info('Excellent. Your code is in great shape.');
    } else if (healthScore > 60) {
      this.logger.info('Good job. Minor improvements suggested.');
    } else {
      this.logger.info('Consider addressing the issues for better code quality.');
    }

    this.logger.info('='.repeat(60));

    return {
      analyzedFileCount: this.analyzedFiles.length,
      healthScore,
      issueCount: this.issues.length,
      issueTypes: toSortedCounts(this.issues, ISSUE_WEIGHTS),
      suggestionCount: this.suggestions.length,
      suggestionTypes: toSortedCounts(this.suggestions, SUGGESTION_WEIGHTS),
      topIssueFiles: toTopFiles(this.issues).slice(0, 5)
    };
  }

  suggestNewFeatures() {
    this.logger.info('\n[Features] Suggestions:');
    this.featureSuggestions.forEach((suggestion, index) => {
      this.logger.info(`${index + 1}. ${suggestion}`);
    });

    return this.featureSuggestions;
  }

  run() {
    this.logger.info('Starting AI Development Assistant...');
    const report = this.analyzeModules();
    const features = this.suggestNewFeatures();

    return {
      features,
      report
    };
  }
}

module.exports = {
  AIDevAssistant,
  parseCliArgs
};

if (require.main === module) {
  try {
    const options = parseCliArgs();
    const assistant = new AIDevAssistant({
      maxDisplayIssues: options.maxDisplayIssues,
      maxDisplaySuggestions: options.maxDisplaySuggestions
    });
    assistant.run();
  } catch (error) {
    console.error(`[AI] ${error.message}`);
    process.exit(1);
  }
}
