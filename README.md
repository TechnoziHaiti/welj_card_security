# 🛡️ Welj Card Security

> Application officielle de gestion des membres, émission de cartes avec QR Codes sécurisés et vérification d'authenticité pour **Welj Express Services**.

---

## 📌 Présentation du Projet

**Welj Card Security** est une plateforme Full-Stack d'entreprise conçue pour assurer l'émission, la gestion et le contrôle d'authenticité en temps réel des cartes de membres Welj Express Services.

### Points Clés de l'Architecture & Sécurité :
- **Attribution atomique du Code Membre :** Format `ANNÉE + SÉQUENCE` (ex : `20260001`, `202610000`, `202710001`). Le compteur global ne se réinitialise jamais lors du changement d'année et l'incrémentation est garantie concurrente et atomique directement dans PostgreSQL.
- **Sécurité Cryptographique des QR Codes (SHA-256) :** Chaque carte est associée à un token aléatoire haute entropie (32 octets). Seule l'empreinte `SHA-256` est stockée dans Supabase. Même en cas de fuite de la base de données, aucun QR Code ne peut être falsifié.
- **Validité Stricte de 1 An :** Calcul exact jusqu'à la fin de la journée anniversaire (23:59:59 UTC) avec gestion éprouvée des années bissextiles (29 février).
- **Vérificateur Public Étanche :** Fonction RPC PostgreSQL `SECURITY DEFINER` dédiée (`verify_card_by_token`). Aucune requête directe sur les tables depuis le public ; aucune donnée personnelle n'est divulguée pour un token inconnu ou invalide.
- **Minimisation des Données :** Aucune photo ni biométrie de membre n'est collectée ou stockée.
- **Audit Logs Intégraux :** Enregistrement atomique de chaque scan (date, résultat, empreinte scannée, équipement agent).

---

## 🛠️ Stack Technique

- **Framework :** Next.js 15 (App Router)
- **Langage :** TypeScript (Mode Strict)
- **UI & Design :** Tailwind CSS, Lucide Icons (Identité vert corporate Welj `#064e3b` / `#047857`)
- **Backend & Base de données :** Supabase (PostgreSQL 15+, Supabase Auth, Row Level Security)
- **Sécurité & Sessions :** `@supabase/ssr` avec cookies HTTP-only sécurisés
- **Génération QR Code :** `qrcode` (génération vectorielle SVG et PNG haute définition)
- **Scanner Mobile :** `html5-qrcode` (détection native et caméra smartphone)
- **Tests :** Node.js Test Runner natif (`npm test`)

---

## 🚀 Guide d'Installation et Configuration Pas-à-Pas

### 1. Cloner ou ouvrir le projet
```bash
cd welj_card_security
npm install
```

### 2. Création et Configuration du Projet Supabase (Étapes manuelles)

1. Rendez-vous sur [Supabase.com](https://supabase.com) et créez un nouveau projet (ex: `welj-card-security`).
2. Allez dans **SQL Editor** dans la barre latérale de Supabase.
3. Copiez l'intégralité du script SQL de migration situé dans :
   👉 `supabase/migrations/20261104000001_initial_schema.sql`
4. Collez-le dans l'éditeur SQL et cliquez sur **Run**.
   *Ce script crée les tables, les index, les contraintes, la séquence atomique, la fonction RPC `verify_card_by_token`, la fonction `create_member_atomic` et active le Row Level Security (RLS).*
5. *(Optionnel pour tester immédiatement)* : Exécutez le script de données de démonstration clairement identifiées :
   👉 `supabase/seed_demo.sql`
6. Créez votre premier compte administrateur :
   - Allez dans **Authentication** > **Users** > **Add user** > **Create user**.
   - Entrez votre email (ex : `admin@welj-express.com`) et un mot de passe sécurisé.
   - Dans le SQL Editor, assignez-lui le rôle admin :
     ```sql
     UPDATE public.profiles SET role = 'admin', full_name = 'Directeur Sécurité Welj' WHERE id = 'ID_DE_L_UTILISATEUR_AUTH';
     ```

### 3. Configuration des Variables d'Environnement

Dans le dossier du projet, créez un fichier `.env.local` (en vous basant sur `.env.example`) :

```env
# Récupérez ces clés dans Supabase : Project Settings > API
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-cle-anon-publique
SUPABASE_SERVICE_ROLE_KEY=votre-cle-service-role-secrete

# URL de votre application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> ⚠️ **Sécurité :** La clé `SUPABASE_SERVICE_ROLE_KEY` est strictement réservée au serveur. Elle n'est jamais exposée dans le frontend.

---

## 💻 Lancer l'Application

### En Développement
```bash
npm run dev
```
Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur.

### En Production (Build & Start)
```bash
npm run build
npm run start
```

### Lancer la suite de tests unitaires
```bash
npm test
```
*Vérifie la génération aléatoire, le hachage SHA-256, le calcul des années bissextiles à 23:59:59 et le formatage des codes membres.*

---

## 📱 Navigation & Fonctionnalités

| URL | Accès | Description |
| :--- | :--- | :--- |
| `/` | Public | Portail d'accueil officiel Welj Express Services. |
| `/verify` | Public (Mobile-first) | Scanner caméra QR Code et champ de saisie manuelle pour les agents de terrain. |
| `/verify/[token]` | Public | Page de résultat certifiée (Carte Authentique, Expirée, Révoquée ou Non reconnue). |
| `/login` | Public | Connexion sécurisée des administrateurs et agents habilités. |
| `/admin/dashboard` | Protégé (Auth) | Tableau de bord : métriques clés (cartes actives, expirées, révoquées, expirant sous 30j), raccourcis et journal en direct. |
| `/admin/members` | Protégé (Auth) | Liste complète des membres, recherche plein texte, filtres par statut et type de compte. |
| `/admin/members/new` | Protégé (Auth) | Création atomique de membre avec option d'émission immédiate de la carte et du QR Code. |
| `/admin/members/[id]` | Protégé (Auth) | Fiche membre, modification des données, bascule du statut, émission, renouvellement et révocation de carte. |
| `/admin/cards` | Protégé (Auth) | Registre central des cartes, téléchargement des QR Codes (PNG HD / SVG), renouvellement et révocation. |
| `/admin/history` | Protégé (Auth) | Journal d'audit complet de toutes les tentatives de vérification avec filtrage. |

---

## 🧪 Scénarios de Test et Données de Démonstration

Si vous avez exécuté `supabase/seed_demo.sql`, vous pouvez immédiatement tester ces 4 scénarios dans le vérificateur public :

1. **Carte Authentique & Active :**
   - URL : `/verify/7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a`
   - Résultat attendu : Badge vert, « Carte Authentique », statut « Active », affiche Alice N'Diaye, Code Membre `20260001`, dates de création et d'expiration.
2. **Carte Expirée :**
   - URL : `/verify/1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff`
   - Résultat attendu : Badge orange, « Carte Expirée », affiche Mamadou Diallo et la date d'expiration échue.
3. **Carte Révoquée :**
   - URL : `/verify/9999888877776666555544443333222211110000ffffeeeeddddccccbbbbaaaa`
   - Résultat attendu : Badge rouge, « Carte Révoquée », « Cette carte n'est plus autorisée ».
4. **Token Inconnu / QR Contrefait :**
   - URL : `/verify/token-arbitraire-inexistant-123456`
   - Résultat attendu : Alerte rouge, « Carte Non Reconnue », aucune donnée personnelle divulguée.

---

## 🚢 Déploiement sur Vercel

1. Poussez le projet sur GitHub ou GitLab.
2. Importez le dépôt dans votre tableau de bord [Vercel](https://vercel.com).
3. Dans la section **Environment Variables**, ajoutez :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` (ex: `https://votre-app.vercel.app`)
4. Cliquez sur **Deploy**. Le build se déroule automatiquement avec Next.js 15.
