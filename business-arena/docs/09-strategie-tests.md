# 09 — Stratégie de tests

Couvre le point 15 de la mission n°37 (§32). Règle absolue : **aucune modification du
moteur économique n'est acceptée sans tests** — appliquée par la CI (couverture minimale
sur `src/engine` + revue des snapshots dorés).

Outillage : **Vitest** (unitaire, intégration), **fast-check** (tests par propriétés),
Playwright (E2E, à partir de l'étape 6), GitHub Actions (doc 01 §5).

---

## 1. Tests unitaires du moteur (`tests/unit/engine`)

Miroir strict des modules, chaque fonction pure testée sur des cas chiffrés **calculables à
la main** (documentés dans le test) — la liste imposée §32 est couverte ainsi :

| Module | Cas exigés (extraits) |
|---|---|
| `market/demand` | demande de base, croissance, saisonnalité (Σ normalisée) ; **élasticité** : variation de prix de ±10 % sur segment −2,2 vs −0,7 ; bornes min/max ; **prix psychologique** : 19,90 vs 20,10 ; plancher d'acceptabilité |
| `market/allocation` | parts logit : symétrie (offres identiques ⇒ parts égales), monotonie (meilleure attraction ⇒ part ≥), γ extrême, concurrent extérieur |
| `market/sales` | contrainte de stock, ruptures, report backlog, **CA** = Σ prix × volumes |
| `production` | min(plan, machine, MOD, matières) ; sous-traitance plafonnée ; taux d'utilisation ; dégradation qualité en surchauffe |
| `inventory` | CUMP sur 2 entrées à coûts différents ; stock final ; valorisation |
| `costs` | fixes vs variables par inducteur ; coût complet vs partiel ; **marges** (MCV, taux de marge/marque) ; coûts pertinents d'une commande exceptionnelle (le cas §7 : contributive malgré un coût complet supérieur au prix) |
| `costs/breakeven` | **seuil de rentabilité** en volume et en valeur, point mort, marge et indice de sécurité |
| `finance/statements` | compte de résultat complet ; bilan **équilibré au centime** |
| `finance/functional` | **FRNG, BFR, trésorerie** : invariant TN = FRNG − BFR = dispo − concours ; créances/dettes selon délais ; scénario « rentable mais illiquide » reproduit sur un cas minimal |
| `finance/ratios` | **rentabilité** économique/financière, effet de levier (Rf − Re = (Re−i)·D/CP vérifié) |
| `investment` | **VAN** (flux de référence, taux 0 ⇒ Σ flux), **TRI** (VAN(TRI) ≈ 0, cas sans TRI réel), délai de récupération |
| `events` | conditions, tirage seedé, application des modifiers, durée, cumul |
| `random` | reproductibilité du PRNG, distribution grossière |
| `scoring` | normalisation bornée/monotone, pondérations Σ=1, agrégation, tie-breakers |
| `pedagogy/hints` | **indices** : séquentialité stricte, coûts cumulés, plafond par difficulté, plafonnement du score modèle si niveau 4 utilisé |
| `pedagogy/models` | matrice de pertinence, `ModelEvaluation.finalScore` |
| `pedagogy/progress` | mise à jour de maîtrise, agrégation par axe |

## 2. Tests par propriétés (fast-check)

- La demande allouée totale n'excède jamais la demande potentielle ; parts ∈ [0,1], Σ ≤ 1.
- Production ≤ min des capacités quel que soit le plan demandé (jamais d'usine infinie, §13).
- Bilan équilibré et TN = FRNG − BFR pour des séquences de décisions aléatoires seedées.
- Trésorerie de clôture = trésorerie d'ouverture + Σ flux (pont de trésorerie exact).
- Monotonies économiques : toutes choses égales par ailleurs, prix ↑ ⇒ demande segment ≤ ;
  coûts fixes ↑ ⇒ seuil de rentabilité ↑.

## 3. Tests dorés (`tests/golden`)

Simulation complète de NOVA (6 tours, stratégies scriptées, graine fixe) → snapshot JSON
des résultats. Tout écart = revue obligatoire : soit un bug, soit un changement
d'équilibrage **assumé et documenté** (mise à jour du snapshot dans le même commit que la
justification). C'est le filet anti-régression de l'équilibrage.

## 4. Tests d'intégration (`tests/integration`)

Sur une **branche Neon éphémère** créée par la CI (doc 01 §5) :

- Cycle complet : créer partie → 2 équipes + bots → soumettre décisions → clore →
  `resolveRound` → vérifier round_results/kpis/scores persistés et cohérents avec un appel
  direct du moteur (mêmes chiffres).
- Idempotence : double appel de `resolveRound` et du cron ⇒ un seul effet.
- Verrouillage : décision modifiée après `locked` ⇒ rejet ; échéance ⇒ `carried_over`.
- Indices : déblocage hors séquence ⇒ rejet ; trace en base.
- **Rejeu** : `scripts/replay.ts` sur la partie créée reproduit exactement les résultats
  (déterminisme de bout en bout, socle anti-triche).
- Autorisations : un joueur ne lit ni les décisions adverses, ni les paramètres cachés
  (test d'API négatif).

## 5. Tests de calibration des scénarios

Les invariants de conception de NOVA (doc 07 §4) tournent en CI via `scripts/calibrate.ts`.
Tout nouveau scénario publié doit fournir ses invariants.

## 6. Tests d'architecture (`tests/architecture`)

Analyse statique des imports (dependency-cruiser ou script maison) :

- `engine/`, `pedagogy/`, `scoring/`, `competition/` n'importent ni `react`, ni `next`,
  ni `drizzle`, ni `src/db`, ni `src/services` ;
- `src/app` n'importe jamais `src/db` directement (passage obligé par `services`) ;
- interdiction de `Math.random` et `Date.now` dans `src/engine` (grep AST).

## 7. E2E (étape 6+) et performance

- Playwright : parcours joueur (rejoindre par code, décider, valider, lire le débrief) et
  enseignant (créer partie, clore un tour) sur build de preview.
- Performance : benchmark de `simulateRound` (8 entreprises, 4 segments) — budget < 1 s
  (doc 00 §B) ; test en CI avec seuil d'alerte.
