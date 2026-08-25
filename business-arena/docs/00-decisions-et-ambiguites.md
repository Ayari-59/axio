# 00 — Analyse du cahier des charges : ambiguïtés et décisions d'architecture

Ce document applique l'étape 1 de la méthode (§35) : analyser le cahier des charges,
identifier les ambiguïtés, trancher explicitement. Chaque décision est un mini-ADR
(Architecture Decision Record) : elle est **réversible tant que le code correspondant
n'existe pas**, mais elle fait foi pour les étapes 2 et suivantes tant qu'elle n'est
pas amendée.

---

## A. Ambiguïtés identifiées et décisions

### ADR-01 — Que représente un « tour » ?
**Ambiguïté** : le cahier des charges parle de tours et de 6 tours pour NOVA, sans définir la
période simulée ni le temps réel accordé.
**Décision** : un tour = **une période simulée paramétrable par scénario** (par défaut : un
trimestre). Le temps réel accordé pour décider est un paramètre de la partie (`games.round_duration`),
de « illimité » (mode apprentissage) à « 20 minutes » (concours). Le moteur économique ne connaît
que des périodes abstraites numérotées ; la sémantique calendaire (T1 2026…) est de l'habillage
défini dans le scénario.

### ADR-02 — Joueur solo ou équipe ?
**Ambiguïté** : le texte alterne « un joueur ou une équipe ».
**Décision** : l'unité qui dirige une entreprise est **toujours une équipe** (`teams`), qui peut
compter un seul membre. Une entreprise virtuelle = une équipe = une ligne de classement. Cela
unifie solo, binômes de classe et équipes de concours sans dupliquer le modèle.

### ADR-03 — Contre qui joue-t-on ?
**Ambiguïté** : la concurrence est centrale (parts de marché, événement « nouveau concurrent »)
mais rien ne dit si les concurrents sont humains ou simulés.
**Décision** : les deux, avec le **même modèle de données**. Une partie contient N entreprises ;
chacune est pilotée soit par une équipe humaine, soit par un **bot de stratégie déterministe**
(`teams.controller = 'human' | 'bot'`, avec un `bot_profile` : agressif prix, premium, suiveur…).
Le moteur de marché ne distingue pas les deux. Le mode solo est donc « 1 équipe humaine + bots ».

### ADR-04 — Tours synchrones ou asynchrones ?
**Décision** : la simulation est **au tour par tour, simultanée** : toutes les entreprises
soumettent leurs décisions, puis le moteur résout le tour d'un bloc (résolution simultanée type
Simuland, pas de temps réel). En mode apprentissage solo, le joueur déclenche lui-même la
résolution ; en partie de classe/compétition, c'est l'enseignant/organisateur ou une échéance
(cron) qui clôt le tour. Les décisions manquantes à l'échéance sont remplacées par la
**reconduction des décisions du tour précédent** (règle affichée aux joueurs).

### ADR-05 — Déterminisme vs événements probabilistes
**Ambiguïté** : le moteur doit être « déterministe » (§8) mais les événements ont une
« probabilité » (§19).
**Décision** : déterminisme **à graine fixée**. Chaque partie possède une graine (`games.seed`) ;
tous les tirages (événements, bruit de prévision) passent par un PRNG seedé
(implémentation maison type mulberry32, documentée). Même scénario + même graine + mêmes
décisions ⇒ mêmes résultats, au bit près. C'est aussi la base de l'anti-triche et du rejeu
(replay d'une partie à partir des décisions archivées).

### ADR-06 — Où s'exécute le moteur ?
**Décision** : le moteur est un **package TypeScript pur, isomorphe** (aucune dépendance Next,
React, Drizzle, Node-API). En production il tourne **côté serveur uniquement** (route handlers /
server actions), seule source de vérité. Son isomorphisme est conservé pour les tests, les
outils de calibrage de scénarios en CLI, et un éventuel mode « bac à sable » client plus tard.

### ADR-07 — Monnaie, langue, localisation
**Décision** : MVP en **français, euros, conventions comptables françaises** (FRNG/BFR sont des
notions du PCG). Mais aucune chaîne française codée en dur dans le moteur : tous les libellés
transitent par des clés (concepts, indices, événements sont des données en base). L'i18n est
une évolution (doc 10), pas un refactoring.

### ADR-08 — Authentification et rôles
**Ambiguïté** : rien n'est dit sur l'auth.
**Décision** : Auth.js (NextAuth v5) avec credentials + magic link e-mail au MVP ; sessions JWT.
Rôles portés par l'appartenance à une organisation : `student`, `teacher`, `org_admin`,
`platform_admin`. Un élève peut rejoindre une classe par **code d'invitation** sans e-mail
académique (contrainte terrain BTS). SSO (Google Workspace, EduConnect/GAR) = évolution.

### ADR-09 — Multi-tenant
**Décision** : multi-tenant logique par `organization_id` (établissement, école, entreprise de
formation) sur les entités de gestion (classes, parties). Pas de schéma-par-tenant : Neon +
filtrage applicatif systématique dans la couche services (jamais dans les composants). Les
joueurs grand public (hors établissement) appartiennent à une organisation « public ».

### ADR-10 — Versionnage du moteur et des scénarios
**Décision** : le moteur porte un **numéro de version sémantique** (`ENGINE_VERSION`), figé dans
chaque partie à sa création (`games.engine_version`) avec un **instantané JSONB de la
configuration du scénario** (`games.scenario_snapshot`). Une partie en cours n'est jamais
affectée par une mise à jour de scénario ou de moteur ; un classement compare toujours des
parties jouées à version identique.

### ADR-11 — Prisma (repo hôte) vs Drizzle (stack imposée)
**Décision** : BUSINESS ARENA est un produit indépendant → **Drizzle ORM**, comme imposé.
Aucun partage de code avec Axio.

### ADR-12 — Périmètre exact du MVP
**Décision** : le MVP couvre les étapes 2 → 11 du plan (§35) : données, moteur économique,
NOVA, 6 tours, interface joueur, interface enseignant, moteur pédagogique, indices, scoring,
profil joueur. **Hors MVP** : IA/LLM (étape 12, mais l'architecture la prévoit — doc 01 §7),
mode concours complet (étape 13, mais le schéma de données l'anticipe — doc 04),
RH avancée, multi-produits par entreprise (le schéma le permet, NOVA n'en active qu'un).

### ADR-13 — « Anti-triche » (§25)
**Décision MVP** : verrouillage des décisions après validation, horodatage serveur,
journal immuable des décisions (`decisions` en append-only logique), résolution 100 % serveur,
graine secrète pendant la partie, indices tracés. Détection comportementale avancée
(multi-comptes, collusion) = évolution.

### ADR-14 — Le « choix du modèle » est une décision de premier ordre
**Ambiguïté** : le §7 exige d'évaluer le modèle choisi et sa justification, sans dire comment
le joueur l'exprime.
**Décision** : certains tours comportent une **phase de diagnostic structurée** (entité
`situations`) : le joueur (1) qualifie le problème, (2) choisit un ou plusieurs modèles
d'analyse dans une liste ouverte, (3) rédige une justification courte, (4) prend ensuite ses
décisions chiffrées. La pertinence modèle/situation est évaluée par une matrice de données
(`situation_models.relevance`), pas par un LLM — l'IA ne fera qu'analyser la justification
libre, en complément, à l'étape 12.

### ADR-15 — Progressivité de l'information (§22)
**Décision** : chaque indicateur du tableau de bord porte un **niveau de déblocage** défini par
le profil de difficulté (ex. niveau 1 : CA, résultat, trésorerie, stock ; niveau 3 : FRNG, BFR,
ratios). Le moteur calcule toujours tout ; c'est la **couche de présentation pédagogique** qui
filtre. Aucune logique de calcul dans l'UI.

---

## B. Risques identifiés

| Risque | Impact | Parade architecturale |
|---|---|---|
| Moteur économique « qui triche » (valeurs magiques non documentées, §9) | Perte de crédibilité pédagogique | Tout paramètre vient du scénario ; chaque formule documentée dans doc 02 ; tests dorés |
| Équilibrage des scénarios (partie ingagnable ou triviale) | Abandon des joueurs | CLI de calibrage : rejouer un scénario avec des stratégies-bots et vérifier des invariants (doc 09 §5) |
| Couplage moteur ↔ UI qui s'installe insidieusement | Dette irrécupérable | Règle de dépendance vérifiée par test d'architecture (imports interdits, doc 09 §6) |
| Scope creep du MVP (concours, IA, RH…) | Rien de livré | ADR-12 + backlog par étapes |
| Vercel timeout sur la résolution d'un tour | Tours bloqués | Résolution O(entreprises × segments), pas de boucle de convergence ; budget < 1 s par tour mesuré en test de perf |

---

## C. Vocabulaire normalisé (ubiquitous language)

| Terme | Définition unique dans tout le code et la base |
|---|---|
| **Scénario** | Configuration complète et versionnée d'un univers de jeu (marché, coûts, événements, pédagogie) |
| **Partie** (`game`) | Instance jouée d'un scénario par N entreprises |
| **Entreprise** (`company`) | L'état économique piloté par une équipe (humaine ou bot) dans une partie |
| **Tour** (`round`) | Une période simulée : décisions → résolution → résultats |
| **Situation** | Mise en scène pédagogique d'un problème dans un tour donné |
| **Concept** | Notion de gestion du référentiel (ex. BFR) |
| **Modèle de décision** | Outil d'analyse outillé du référentiel (ex. analyse FRNG/BFR) |
| **Indice** | Aide graduée (5 niveaux) attachée à une situation |
| **BPI** | Business Performance Index, le score composite (doc 08) |
