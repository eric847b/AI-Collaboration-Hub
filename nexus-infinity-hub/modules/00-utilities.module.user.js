// 00-utilities.module.user.js - Core utilities for Nexus Infinity Hub
console.log("🔧 [NEXUS] Utilities Module Loaded");
export function timestampLog(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }
export function chainModules(...modules) { modules.forEach(m => { if (typeof m === 'function') m(); }); }