'use client';

import React, { useState, useEffect } from 'react';
import {
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
  ShieldAlert,
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

  // Suppression et modification de rôle
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  // Fermer le tiroir avec Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowModal(false);
    };
    if (showModal) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [showModal]);

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
      setSuccessMsg(`L'accès pour ${data.user.email} (${data.user.role === 'admin' ? 'Administrateur' : 'Agent de Contrôle'}) a été configuré avec succès.`);
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

  const handleRoleChange = async (targetUser: UserData, newRole: 'admin' | 'agent') => {
    if (targetUser.id === currentUserId) return;
    setUpdatingRoleId(targetUser.id);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: targetUser.id, role: newRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la modification du rôle.');
      }

      setUsers(users.map((u) => (u.id === targetUser.id ? { ...u, role: newRole } : u)));
      setSuccessMsg(`Rôle mis à jour pour ${targetUser.email} : ${newRole === 'admin' ? 'Administrateur' : 'Agent de Contrôle (Lecture)'}.`);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du changement de rôle.');
    } finally {
      setUpdatingRoleId(null);
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
            <KeyRound size={24} className="text-emerald-600" />
            Gestion des Accès &amp; Utilisateurs
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Contrôle strict des rôles : Administrateur (pleins pouvoirs) ou Agent de Contrôle (vérification et lecture seule).
          </p>
        </div>

        <button
          onClick={() => {
            setError(null);
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#16a34a] hover:bg-[#15803d] text-white font-semibold text-xs transition-colors shadow-sm self-start sm:self-auto cursor-pointer"
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
          <button onClick={() => setSuccessMsg(null)} className="text-slate-400 hover:text-slate-700">
            <X size={14} />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-transparent border border-rose-400 text-rose-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-slate-400 hover:text-slate-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Barre de recherche */}
      <div className="bg-white p-4 rounded-2xl border border-stone-300/80 shadow-sm">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-3 text-stone-400" />
          <input
            type="text"
            placeholder="Filtrer par nom, adresse email ou rôle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl text-slate-900 placeholder:text-stone-400 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
          />
        </div>
      </div>

      {/* Tableau des utilisateurs */}
      <div className="bg-white rounded-2xl border border-stone-300/80 shadow-sm overflow-hidden">
        {filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            Aucun compte trouvé correspondant aux critères.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100 text-stone-600 uppercase text-[10px] tracking-wider border-b border-stone-200 font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Utilisateur</th>
                  <th className="py-3.5 px-4">Email</th>
                  <th className="py-3.5 px-4">Niveau d&apos;Accès &amp; Droits</th>
                  <th className="py-3.5 px-4">Date de Création</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 text-slate-800">
                {filteredUsers.map((user) => {
                  const isCurrent = user.id === currentUserId;

                  return (
                    <tr key={user.id} className="hover:bg-stone-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                            user.role === 'admin' ? 'bg-[#16a34a] text-white' : 'bg-stone-200 text-slate-800 border border-stone-300'
                          }`}>
                            {user.full_name[0]?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight">
                              {user.full_name}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] text-emerald-600 font-semibold">
                                (Votre compte actuel)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {user.email || '-'}
                      </td>
                      <td className="py-3 px-4">
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                            <Shield size={13} className="text-emerald-600" />
                            Administrateur (Vous)
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <select
                              value={user.role}
                              disabled={updatingRoleId === user.id}
                              onChange={(e) => handleRoleChange(user, e.target.value as 'admin' | 'agent')}
                              className={`px-2.5 py-1 text-xs rounded-lg border bg-white font-medium focus:ring-2 focus:ring-emerald-500 outline-none transition-colors cursor-pointer ${
                                user.role === 'admin'
                                  ? 'border-emerald-500 text-emerald-700 font-bold bg-emerald-50/40'
                                  : 'border-stone-300 text-slate-700'
                              }`}
                            >
                              <option value="agent">Agent de Contrôle (Lecture)</option>
                              <option value="admin">Administrateur (Tous droits)</option>
                            </select>
                            {updatingRoleId === user.id && (
                              <Loader2 size={13} className="animate-spin text-emerald-600" />
                            )}
                          </div>
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
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border border-red-600 text-[11px] font-bold shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-stone-300 text-slate-900">
            {/* Modal Header */}
            <div className="bg-stone-50 text-slate-900 p-5 flex items-center justify-between border-b border-stone-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                  <UserPlus size={20} className="text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold leading-tight">Donner un Nouvel Accès</h3>
                  <p className="text-xs text-slate-500">Création d&apos;un compte d&apos;accès</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-stone-100 transition-colors"
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
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-stone-50 border border-stone-300 rounded-xl text-slate-900 placeholder:text-stone-400 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Adresse Email *
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-3 text-stone-400" />
                  <input
                    type="email"
                    required
                    placeholder="agent@welj-express.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm bg-stone-50 border border-stone-300 rounded-xl text-slate-900 placeholder:text-stone-400 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Mot de Passe Initial *
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-3 text-stone-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Minimum 6 caractères"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm bg-stone-50 border border-stone-300 rounded-xl text-slate-900 placeholder:text-stone-400 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 text-slate-700 text-xs font-semibold hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold transition-all shadow-sm disabled:opacity-60 cursor-pointer"
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
