/**
 * RBAC Module (Q2 2027 #16 — role-based access control for shared instances).
 * Role -> permission matrix with subject/action/resource checks and an
 * audit hook into AuditLog.
 */

(function (global) {
  const ROLES = ['owner', 'admin', 'editor', 'viewer'];
  const ROLE_RANK = { owner: 4, admin: 3, editor: 2, viewer: 1 };
  const DEFAULT_GRANTS = {
    owner: ['*:*'],
    admin: ['config:read', 'config:write', 'session:create', 'session:join', 'member:manage', 'audit:read'],
    editor: ['config:read', 'session:create', 'session:join', 'template:write', 'generation:run'],
    viewer: ['config:read', 'session:join', 'template:read', 'generation:read']
  };

  class RBAC {
    constructor(options) {
      this.members = {}; // id -> role
      this.grants = Object.assign({}, DEFAULT_GRANTS, (options && options.grants) || {});
      this.audit = (options && options.audit) || null; // optional AuditLog instance
    }

    addMember(id, role) {
      if (!ROLES.includes(role)) throw new Error('Unknown role: ' + role);
      this.members[id] = role;
      if (this.audit) this.audit.record('member', 'assign', { id, role }, 'system');
      return this;
    }

    roleOf(id) {
      return this.members[id] || null;
    }

    /** Grant strings are "action:resource"; "*:*" is full access. */
    can(id, action, resource) {
      const role = this.members[id];
      if (!role) return false;
      const grants = this.grants[role] || [];
      const target = action + ':' + resource;
      return grants.includes('*:*') || grants.includes(target) || grants.includes(action + ':*');
    }

    require(id, action, resource) {
      const allowed = this.can(id, action, resource);
      if (!allowed && this.audit) this.audit.record('access', 'denied', { id, action, resource }, 'system');
      return allowed;
    }

    /** Demote/promote a member; record to audit. */
    setRole(id, role, by) {
      if (!ROLES.includes(role)) throw new Error('Unknown role: ' + role);
      this.members[id] = role;
      if (this.audit) this.audit.record('member', 'role', { id, role }, by || 'system');
      return this;
    }

    listMembers() {
      return Object.entries(this.members).map(([id, role]) => ({ id, role, rank: ROLE_RANK[role] }));
    }
  }

  global.RBAC = RBAC;
  if (typeof module !== 'undefined' && module.exports) module.exports = { RBAC };
})(typeof window !== 'undefined' ? window : globalThis);