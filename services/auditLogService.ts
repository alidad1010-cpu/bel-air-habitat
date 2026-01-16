/**
 * AuditLogService - Journal d'Activité
 * Enregistre toutes les actions importantes pour traçabilité et sécurité
 */
import { saveDocument } from './firebaseService';
import type { User } from '../types';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  VIEW = 'VIEW',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  EXPORT = 'EXPORT',
  IMPORT = 'IMPORT',
}

export enum AuditResource {
  PROJECT = 'PROJECT',
  CLIENT = 'CLIENT',
  EMPLOYEE = 'EMPLOYEE',
  EXPENSE = 'EXPENSE',
  USER = 'USER',
  SETTINGS = 'SETTINGS',
  DOCUMENT = 'DOCUMENT',
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId: string;
  resourceName?: string;
  changes?: {
    before?: any;
    after?: any;
    fields?: string[]; // Liste des champs modifiés
  };
  timestamp: number;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

class AuditLogService {
  private enabled = true;

  /**
   * Active ou désactive l'audit log
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  /**
   * Enregistre une action dans le journal d'audit
   */
  async log(
    user: User | null,
    action: AuditAction,
    resource: AuditResource,
    resourceId: string,
    options?: {
      resourceName?: string;
      changes?: { before?: any; after?: any; fields?: string[] };
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    if (!this.enabled || !user) return;

    try {
      const auditLog: AuditLog = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: user.id,
        userName: user.fullName || user.username,
        userEmail: user.email,
        action,
        resource,
        resourceId,
        resourceName: options?.resourceName,
        changes: options?.changes,
        timestamp: Date.now(),
        ipAddress: await this.getClientIP(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        metadata: options?.metadata,
      };

      // Sauvegarder dans Firestore
      await saveDocument('auditLogs', auditLog.id, auditLog);
    } catch (error) {
      // Ne pas bloquer l'application si l'audit log échoue
      console.warn('Failed to save audit log:', error);
    }
  }

  /**
   * Récupère l'IP du client (via service externe ou fallback)
   */
  private async getClientIP(): Promise<string | undefined> {
    try {
      // Essayer de récupérer l'IP via un service externe
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      // Fallback: ne pas bloquer si le service est indisponible
      return undefined;
    }
  }

  /**
   * Log de création
   */
  async logCreate(
    user: User | null,
    resource: AuditResource,
    resourceId: string,
    resourceName?: string,
    data?: any
  ) {
    return this.log(user, AuditAction.CREATE, resource, resourceId, {
      resourceName,
      changes: { after: data },
    });
  }

  /**
   * Log de mise à jour
   */
  async logUpdate(
    user: User | null,
    resource: AuditResource,
    resourceId: string,
    resourceName?: string,
    before?: any,
    after?: any,
    fields?: string[]
  ) {
    return this.log(user, AuditAction.UPDATE, resource, resourceId, {
      resourceName,
      changes: { before, after, fields },
    });
  }

  /**
   * Log de suppression
   */
  async logDelete(
    user: User | null,
    resource: AuditResource,
    resourceId: string,
    resourceName?: string,
    data?: any
  ) {
    return this.log(user, AuditAction.DELETE, resource, resourceId, {
      resourceName,
      changes: { before: data },
    });
  }

  /**
   * Log de connexion
   */
  async logLogin(user: User | null) {
    return this.log(user || ({} as User), AuditAction.LOGIN, AuditResource.USER, user?.id || 'unknown', {
      resourceName: user?.email || 'Unknown user',
    });
  }

  /**
   * Log de déconnexion
   */
  async logLogout(user: User | null) {
    return this.log(user || ({} as User), AuditAction.LOGOUT, AuditResource.USER, user?.id || 'unknown', {
      resourceName: user?.email || 'Unknown user',
    });
  }
}

// Instance singleton
export const auditLogService = new AuditLogService();
