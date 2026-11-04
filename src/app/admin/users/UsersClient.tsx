'use client';

import React, { useState } from 'react';
import {
  UserCheck,
  UserPlus,
  Mail,
  Lock,
  Shield,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Search,
  KeyRound,
  Calendar,
} from 'lucide-react';
import { formatDateFr } from '@/lib/dates';

interface UserData {
  id: string;
  email?: string;
  full_name: string;
  role: 'admin' | 'agent';
  created_at: string;
  last_sign_in_at?: string | null;
}

interface Props {
  initialUsers: UserData[];
  currentUserId: string;
}

export function UsersClient({ initialUsers, currentUserId }: Props) {
  const [users, setUsers] = useState<UserData[]>(initialUsers);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal création
  const [showModal, setShowModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'agent'>('agent');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Suppression
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          email,
          password,
          role,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la création de l\'utilisateur.');
      }

      setUsers([data.user, ...users]);
      setSuccessMsg(`L'accès pour ${data.user.email} (${data.user.role}) a été créé avec succès.`);
      setShowModal(false);
      setFullName('');
      setEmail('');
      setPassword('');
      setRole('agent');
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userToDelete: UserData) => {
    if (userToDelete.id === currentUserId) {
      alert('Vous ne pouvez pas supprimer votre propre compte administrateur.');
      return;
    }

    if (!confirm(`Confirmer la révocation définitive de l'accès pour ${userToDelete.email} ?`)) {
      return;
    }

    setDeletingId(userToDelete.id);
    setError(null);

    try {
      const res = await fetch(`/api/admin/users?id=${userToDelete.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la suppression.');
      }

      setUsers(users.filter((u) => u.id !== userToDelete.id));
      setSuccessMsg(`Accès pour ${userToDelete.email} révoqué.`);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression.');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <KeyRound size={24} className="text-emerald-700" />
            Gestion des Accès &amp; Utilisateurs
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Donnez accès à d&apos;autres membres du personnel en configurant leur email, mot de passe et rôle.
          </p>
        </div>

        <button
          onClick={() => {
            setError(null);
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition-colors shadow-sm self-start sm:self-auto cursor-pointer"
        >
          <UserPlus size={16} />
          <span>Donner un nouvel accès</span>
        </button>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
            <X size={15} />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-700 hover:text-rose-900">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Recherche */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un utilisateur par nom, email ou rôle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none"
          />
        </div>
      </div>

      {/* Tableau des Utilisateurs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <UserCheck size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="font-semibold text-slate-600">Aucun utilisateur trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Utilisateur</th>
                  <th className="py-3.5 px-4">Email</th>
                  <th className="py-3.5 px-4">Niveau d&apos;Accès</th>
                  <th className="py-3.5 px-4">Date de Création</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredUsers.map((user) => {
                  const isCurrent = user.id === currentUserId;

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-emerald-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {user.full_name[0]?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight">
                              {user.full_name}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] text-emerald-700 font-semibold">
                                (Votre compte actuel)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-800">
                        {user.email || '-'}
                      </td>
                      <td className="py-3 px-4">
                        {user.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20">
                            <Shield size={12} className="text-emerald-600" />
                            Administrateur
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 ring-1 ring-blue-600/20">
                            Agent de Contrôle
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {formatDateFr(user.created_at)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!isCurrent ? (
                          <button
                            onClick={() => handleDeleteUser(user)}
                            disabled={deletingId === user.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                            title="Révoquer cet accès"
                          >
                            {deletingId === user.id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Trash2 size={13} />
                            )}
                            <span>Révoquer</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Protégé</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Création Nouvel Accès */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100">
            {/* Modal Header */}
            <div className="bg-emerald-800 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-700/80 rounded-lg">
                  <UserPlus size={20} className="text-emerald-200" />
                </div>
                <div>
                  <h3 className="text-base font-bold leading-tight">Donner un Nouvel Accès</h3>
                  <p className="text-xs text-emerald-200">Création de compte administrateur ou agent</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-700/60 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Nom et Prénom *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Jean Dupont"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Adresse Email *
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="agent@welj-express.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Mot de Passe Initial *
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Minimum 6 caractères"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Rôle Attribué
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'admin' | 'agent')}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none bg-white"
                >
                  <option value="agent">Agent de Contrôle (Accès vérification & lecture)</option>
                  <option value="admin">Administrateur (Gestion totale, cartes et membres)</option>
                </select>
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-md disabled:opacity-60 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Création de l&apos;accès...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={15} />
                      <span>Confirmer l&apos;accès</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
