import React, { useState } from 'react';
import { Eye, EyeOff, Lock, User as UserIcon, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { signIn } from '../services/firebaseService';

interface LoginPageProps {
  onLogin: (u: string, p: string) => boolean;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const cleanUsername = username.trim();
      const cleanPassword = password.trim();
      const emailToUse = cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@belairhabitat.com`;
      await signIn(emailToUse, cleanPassword);

      // FIX: Notify parent immediately to trigger optimistic UI update
      // This prevents the "nothing happens" glitch
      onLogin(emailToUse, password);
      // App.tsx will detect auth change and unmount this component.
      // Keeping isLoading=true prevents the form from jittering before redirect.
    } catch (firebaseError: any) {
      console.warn("Firebase Auth Failed", firebaseError);
      let msg = "Identifiants incorrects ou compte inconnu.";
      if (typeof firebaseError === 'object' && firebaseError !== null) {
        const code = firebaseError.code;
        const message = firebaseError.message || '';

        if (code === 'auth/network-request-failed') {
          msg = "Erreur de connexion internet.";
        } else if (code === 'auth/too-many-requests') {
          msg = "Trop de tentatives. Veuillez patienter.";
        }
      } else if (typeof firebaseError === 'string' && firebaseError === "Auth not initialized") {
        // This should not happen now with fallback, but safe to handle
        msg = "Erreur de configuration (Auth not initialized).";
      }
      setError(msg);
      setIsLoading(false); // Only stop loading on error
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-slate-900">
      {/* Background with Overlay */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: 'url("https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"></div>
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md p-6 mx-4">
        <div className="glass-card-dark rounded-3xl overflow-hidden">

          {/* Header */}
          <div className="p-8 pb-0 text-center">
            <div className="inline-flex p-4 rounded-full bg-white dark:bg-slate-900/5 mb-6 shadow-inner ring-1 ring-white/10">
              <img
                src="https://cdn.prod.website-files.com/6279383071a695621116a3bb/66aa3dc06cc8b3e76941f8a3_Final-logo.png"
                alt="Bel Air Habitat"
                className="h-12 w-auto object-contain"
              />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Espace Pro</h1>
            <p className="text-slate-300 text-sm">Bienvenue sur votre portail sécurisé</p>
          </div>

          {/* Form */}
          <div className="p-8 pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl text-sm flex items-start animate-in fade-in slide-in-from-top-2">
                  <AlertCircle size={18} className="mr-2 flex-shrink-0 mt-0.5 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider ml-1">Identifiant</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <UserIcon className="h-5 w-5 text-slate-400 group-focus-within:text-emerald-400 transition-colors" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all text-base"
                    placeholder="votre@email.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider ml-1">Mot de passe</label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-medium"
                  >
                    Oublié ?
                  </button>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-emerald-400 transition-colors" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-11 pr-12 py-3.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all text-base"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                ) : (
                  <>
                    Se connecter
                    <ArrowRight className="ml-2 h-5 w-5 opacity-70" />
                  </>
                )}
              </button>

              <div className="text-center mt-6">
                <p className="text-xs text-slate-700 dark:text-slate-200 dark:text-white">
                  Accès réservé aux administrateurs et employés.
                </p>
              </div>
            </form>
          </div>

        </div>
      </div>

      {/* Footer - Outside Card */}
      <div className="mt-8 text-center space-y-2 relative z-10">
        <p className="text-xs text-slate-400 font-medium">
          © 2025 Bel Air Habitat. Tous droits réservés.
        </p>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-gray-400 uppercase tracking-widest">
          930 674 932 R.C.S. Pontoise • v1.2.0 (High Contrast)
        </p>
      </div>

      {/* Forgot Password Modal */}
      {
        showForgotPassword && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl transform transition-all scale-100">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white dark:text-white mb-2">Réinitialisation</h3>
              <p className="text-slate-700 dark:text-slate-200 dark:text-white text-sm mb-6 leading-relaxed">
                Pour des raisons de sécurité, veuillez contacter l'administrateur pour réinitialiser votre accès :
              </p>
              <a
                href="mailto:contact@belairhabitat.com"
                className="flex items-center justify-center w-full p-3 mb-4 bg-slate-700 hover:bg-slate-600 text-emerald-400 rounded-xl font-medium transition-colors border border-slate-600"
              >
                contact@belairhabitat.com
              </a>
              <button
                onClick={() => setShowForgotPassword(false)}
                className="w-full py-3 text-sm font-bold text-slate-300 hover:text-slate-900 dark:text-white dark:text-white transition-colors"
              >
                Retour à la connexion
              </button>
            </div>
          </div>
        )
      }
    </div>
  );
};

export default LoginPage;