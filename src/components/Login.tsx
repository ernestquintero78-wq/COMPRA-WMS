import React, { useState } from 'react';
import { Boxes, Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, ShieldCheck, UserCheck, User } from 'lucide-react';

interface LoginProps {
  onLogin: (userData: { email: string; displayName: string; role?: string }) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const demoAccounts = [
    {
      email: 'it.escalanegocios@gmail.com',
      displayName: 'IT Escala Negocios',
      role: 'Administrador General',
      icon: ShieldCheck,
      color: 'border-blue-100 bg-blue-50/50 text-blue-700 hover:bg-blue-100/50'
    },
    {
      email: 'ernest.quintero78@gmail.com',
      displayName: 'Ernesto Quintero',
      role: 'Administrador General',
      icon: ShieldCheck,
      color: 'border-blue-100 bg-blue-50/50 text-blue-700 hover:bg-blue-100/50'
    },
    {
      email: 'supervisor@owms.com',
      displayName: 'Carlos Ortega',
      role: 'Supervisor de Turno',
      icon: UserCheck,
      color: 'border-emerald-100 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100/50'
    },
    {
      email: 'operador@owms.com',
      displayName: 'Mateo Rojas',
      role: 'Operador',
      icon: User,
      color: 'border-slate-100 bg-slate-50/50 text-slate-700 hover:bg-slate-100/50'
    }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail) {
      setErrorMsg('Por favor, ingresa tu correo electrónico.');
      return;
    }
    if (!trimmedPassword) {
      setErrorMsg('Por favor, ingresa tu contraseña de acceso.');
      return;
    }

    const isItAdmin = trimmedEmail === 'it.escalanegocios@gmail.com';
    const isErnestAdmin = trimmedEmail === 'ernest.quintero78@gmail.com' || trimmedEmail === 'ernest.quintero78@gmail.';
    const isSupervisor = trimmedEmail === 'supervisor@owms.com';
    const isOperador = trimmedEmail === 'operador@owms.com';

    if (isItAdmin) {
      if (trimmedPassword !== '0000') {
        setErrorMsg('Contraseña incorrecta para IT Escala Negocios.');
        return;
      }
    } else if (isErnestAdmin) {
      if (trimmedPassword !== 'escala78' && trimmedPassword !== '0000') {
        setErrorMsg('Contraseña incorrecta para el Administrador General.');
        return;
      }
    } else if (isSupervisor) {
      if (trimmedPassword !== 'supervisor123') {
        setErrorMsg('Contraseña incorrecta para el Supervisor de Turno.');
        return;
      }
    } else if (isOperador) {
      if (trimmedPassword !== 'operario123') {
        setErrorMsg('Contraseña incorrecta para el Operador.');
        return;
      }
    } else {
      setErrorMsg('Usuario no registrado. Por favor, contacte al Administrador General.');
      return;
    }

    // Simulate safe server-side / Supabase auth lookup with real password validation
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      let match = demoAccounts.find(acc => acc.email.toLowerCase() === trimmedEmail);
      if (!match && trimmedEmail === 'ernest.quintero78@gmail.') {
        match = demoAccounts[0]; // fallback for typo mail
      }
      const displayName = match ? match.displayName : trimmedEmail.split('@')[0];
      const role = match ? match.role : 'Operador';
      
      onLogin({
        email: trimmedEmail,
        displayName: displayName,
        role: role
      });
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans select-none">
      {/* Background radial gradient decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none"></div>
      
      <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl shadow-2xl p-8 relative z-10 transition duration-300">
        
        {/* Brand Header */}
        <div className="text-center space-y-3 mb-8">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
            <Boxes className="h-8 w-8" />
          </div>
          <div>
            <div className="flex items-center justify-center gap-1.5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">O-WMS PRO</h1>
              <span className="text-[10px] font-bold font-mono bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-md text-blue-600">
                v1.2
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Sistema de Gestión de Almacenes Optimizado
            </p>
          </div>
        </div>

        {/* Action Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-semibold leading-relaxed animate-fade-in">
              {errorMsg}
            </div>
          )}

          {/* Email input field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block pl-1">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="email"
                disabled={isLoading}
                placeholder="ejemplo@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl text-sm text-slate-800 outline-none transition placeholder-slate-400/80 font-medium"
              />
            </div>
          </div>

          {/* Password input field */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center px-1">
              <label className="text-xs font-bold text-slate-700">
                Contraseña
              </label>
              <span className="text-[10px] text-slate-400 hover:text-blue-500 transition cursor-pointer">
                ¿Olvidó la contraseña?
              </span>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                disabled={isLoading}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl text-sm text-slate-800 outline-none transition placeholder-slate-400/80 font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Remember me toggle */}
          <div className="flex items-center justify-between pl-1 pt-1">
            <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
              <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4" />
              <span>Recordar sesión</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-99 disabled:bg-blue-400 text-white font-bold text-sm py-3 px-4 rounded-xl shadow-lg shadow-blue-600/15 transition flex items-center justify-center gap-2 mt-2 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Validando credenciales...</span>
              </>
            ) : (
              <>
                <span>Iniciar Sesión</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Footnote */}
        <p className="text-[10px] text-slate-400 text-center mt-6">
          © 2026 O-WMS S.A. Todos los derechos reservados.
        </p>

      </div>
    </div>
  );
}
