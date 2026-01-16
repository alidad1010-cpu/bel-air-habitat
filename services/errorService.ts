/**
 * Service centralisé de gestion des erreurs
 * Fournit une gestion cohérente et utilisateur-friendly des erreurs
 */
export enum ErrorType {
  NETWORK = 'NETWORK',
  AUTH = 'AUTH',
  VALIDATION = 'VALIDATION',
  FIRESTORE = 'FIRESTORE',
  STORAGE = 'STORAGE',
  API = 'API',
  UNKNOWN = 'UNKNOWN',
}

export interface AppError {
  type: ErrorType;
  message: string;
  code?: string;
  originalError?: unknown;
  timestamp: number;
  context?: string;
}

class ErrorHandler {
  /**
   * Gère une erreur et retourne un objet AppError standardisé
   */
  static handle(error: unknown, context?: string): AppError {
    const appError: AppError = {
      type: ErrorType.UNKNOWN,
      message: 'Une erreur est survenue',
      timestamp: Date.now(),
      originalError: error,
      context,
    };

    // Gestion des objets AppError ou objets avec message et type
    // Vérifier d'abord null pour éviter les problèmes avec typeof null === 'object'
    if (error && typeof error === 'object' && error !== null) {
      const errorObj = error as Record<string, unknown>;
      
      // Si c'est déjà un AppError ou un objet avec message et type
      if ('message' in errorObj && 'type' in errorObj && errorObj.message != null && errorObj.type != null) {
        const message = String(errorObj.message);
        const type = errorObj.type as ErrorType;
        
        // Valider que le type est une valeur valide de ErrorType
        const isValidType = Object.values(ErrorType).includes(type);
        
        appError.message = message || 'Une erreur est survenue';
        appError.type = isValidType ? type : ErrorType.UNKNOWN;
        
        // Conserver le code s'il existe
        if ('code' in errorObj && typeof errorObj.code === 'string') {
          appError.code = errorObj.code;
        }
        
        return appError;
      }
    }

    // Gestion spécifique selon le type d'erreur
    if (error instanceof Error) {
      appError.message = error.message;
      
      // Détecter le type d'erreur
      if (error.message.includes('network') || error.message.includes('Network')) {
        appError.type = ErrorType.NETWORK;
      } else if (error.message.includes('auth') || error.message.includes('Auth')) {
        appError.type = ErrorType.AUTH;
      } else if (error.message.includes('permission') || error.message.includes('Permission')) {
        appError.type = ErrorType.FIRESTORE;
      } else if (error.message.includes('storage') || error.message.includes('Storage')) {
        appError.type = ErrorType.STORAGE;
      }
    }

    // Gestion des erreurs Firebase
    if (error && typeof error === 'object' && 'code' in error) {
      const code = (error as { code: string }).code;
      appError.code = code;

      if (code.startsWith('auth/')) {
        appError.type = ErrorType.AUTH;
      } else if (code.startsWith('storage/')) {
        appError.type = ErrorType.STORAGE;
      } else if (code.startsWith('firestore/')) {
        appError.type = ErrorType.FIRESTORE;
      }
    }

    // Logger en développement
    if (import.meta.env.DEV) {
      console.error(`[ErrorHandler${context ? ` - ${context}` : ''}]`, appError);
      if (appError.originalError) {
        console.error('Original error:', appError.originalError);
      }
    }

    // TODO: En production, envoyer à un service de logging (Sentry, LogRocket, etc.)
    // if (import.meta.env.PROD) {
    //   this.logToService(appError);
    // }

    return appError;
  }

  /**
   * Retourne un message utilisateur-friendly basé sur le type d'erreur
   */
  static getUserMessage(error: AppError): string {
    switch (error.type) {
      case ErrorType.NETWORK:
        return 'Problème de connexion. Vérifiez votre connexion internet et réessayez.';
      
      case ErrorType.AUTH:
        if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
          return 'Identifiants incorrects. Vérifiez votre email et mot de passe.';
        }
        if (error.code === 'auth/too-many-requests') {
          return 'Trop de tentatives. Veuillez patienter quelques minutes avant de réessayer.';
        }
        return 'Erreur d\'authentification. Veuillez vous reconnecter.';
      
      case ErrorType.VALIDATION:
        return `Données invalides: ${error.message}`;
      
      case ErrorType.FIRESTORE:
        if (error.code === 'permission-denied') {
          return 'Vous n\'avez pas la permission d\'effectuer cette action.';
        }
        return 'Erreur de base de données. Veuillez réessayer.';
      
      case ErrorType.STORAGE:
        return 'Erreur lors de l\'upload du fichier. Vérifiez votre connexion et réessayez.';
      
      case ErrorType.API:
        return 'Erreur du service. Veuillez réessayer plus tard.';
      
      default:
        return 'Une erreur est survenue. Veuillez réessayer.';
    }
  }

  /**
   * Gère une erreur et affiche un message à l'utilisateur (via alert pour l'instant)
   * TODO: Remplacer par un système de notifications toast
   */
  static handleAndShow(error: unknown, context?: string): AppError {
    const appError = this.handle(error, context);
    const userMessage = this.getUserMessage(appError);
    
    // En développement, afficher aussi les détails
    if (import.meta.env.DEV && appError.originalError) {
      alert(`${userMessage}\n\n[Détails DEV]\n${JSON.stringify(appError, null, 2)}`);
    } else {
      alert(userMessage);
    }

    return appError;
  }
}

export default ErrorHandler;
