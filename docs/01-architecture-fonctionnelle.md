# 01 — Architecture fonctionnelle

## 1. Chaîne de valeur

```
       SOURCES                    SOCLE                        PILOTAGE
 ┌──────────────────┐    ┌─────────────────────────┐   ┌────────────────────────┐
 │ Compta / ERP     │    │ 1. DATA MODEL           │   │ 8. DASHBOARD dynamique │
 │ Excel / CSV      │───▶│    (étoile générique)   │──▶│ 9. ALERTES             │
 │ Banque / CRM     │    │ 2. BUSINESS MODEL       │   │ 10. RAPPORTS           │
 │ Paie / Temps     │    │    PROFILE              │   │ 11. COPILOTE           │
 └──────────────────┘    │ 3. CONFIGURATION ENGINE │   └────────────────────────┘
                         │    (moteur de règles)   │                ▲
                         │ 4. CALCULATION ENGINE   │                │
                         │    (coûts, marges)      │                │
                         │ 5. BUDGET ENGINE        │────────────────┘
                         │    (écarts)             │
                         │ 6. KPI ENGINE           │
                         │ 7. ANALYTICS            │
                         │    (forecast, what-if)  │
                         └─────────────────────────┘
```

Règle d'or : **toutes** les fonctionnalités consomment le même modèle de données et le même moteur
de calcul. Une marge affichée dans le cockpit, dans un rapport, dans une réponse du copilote et
dans un scénario what-if provient d'un **unique** appel `computeMargins()`.

## 2. Domaines fonctionnels

### D1 — Tenancy et sécurité
Organisation, entreprises, utilisateurs, rôles, périmètres (restriction par membre de dimension),
audit trail, historisation des configurations.

### D2 — Profil et configuration
Assistant d'onboarding (5 étapes), `BusinessModelProfile`, exécution du moteur de règles,
capacités activées, dimensions créées, méthodes de coûts retenues, KPI proposés, cockpit généré.
Rejouable : réexécuter la configuration après un changement de profil produit un **diff** proposé
à l'utilisateur, jamais appliqué en silence.

### D3 — Données
Import CSV/Excel, profilage, mapping assisté, contrôle qualité, référentiels (plan de comptes,
natures, dimensions et membres), périodes, données statistiques (inducteurs).

### D4 — Coûts
Classement (direct/indirect, fixe/variable/semi-variable), centres d'analyse, affectation
multi-étages, clés de répartition, ABC, coûts standards et préétablis, coûts par objet.

### D5 — Marges et rentabilité
Compte de résultat par objet de coût, cascade CA → marge sur coûts variables → marge contributive
→ marge opérationnelle, hiérarchie de drill-down configurable, contribution et concentration.

### D6 — Budget et écarts
Budgets multi-versions et multi-scénarios, budget flexible, rolling forecast,
comparaison Réel / Budget / Forecast / N-1, décomposition des écarts (prix, volume, mix,
budget, activité, rendement), attribution des contributeurs.

### D7 — Prévision et simulation
Forecast (6 méthodes + sélection automatique par backtest), what-if multi-leviers,
seuil de rentabilité et levier opérationnel, projection de trésorerie simplifiée.

### D8 — Indicateurs
Catalogue de KPI défini en données, sélection automatique selon profil et disponibilité des
données, cibles et seuils, calcul par période et par dimension, historisation.

### D9 — Intelligence
Détection (anomalies, ruptures, dérives), explication (attribution d'écart), recommandation
(règles et heuristiques), copilote conversationnel outillé, génération de commentaires de gestion.

### D10 — Restitution
Cockpit dynamique, explorateur multidimensionnel, alertes, rapports périodiques,
mode pédagogique (définition / formule / données / interprétation / limites).

## 3. Matrice domaines × capacités

Les **capacités** (`capability`) sont les commutateurs que le moteur de règles active. L'interface
masque toute fonction dont la capacité n'est pas active.

| Capacité | Activée quand | Débloque |
|---|---|---|
| `project_costing` | modèle de revenu projet ou avancement | Objets projet, budget par projet, reste à faire |
| `progress_tracking` | secteur BTP ou facturation à l'avancement | Avancement, reste à engager, coût à terminaison |
| `subcontractor_tracking` | part de sous-traitance déclarée > 10 % | Suivi ST, marge nette de ST |
| `timesheets` | services facturés au temps | Taux d'occupation, TJM, coût horaire |
| `utilization_rate` | `timesheets` | KPI d'occupation, marge par consultant |
| `inventory` | achat-revente ou production stockée | Stock, rotation, marge sur coût d'achat |
| `production_costing` | secteur industriel | Coût unitaire, rebut, écarts sur charges indirectes |
| `abc_costing` | maturité avancée ou indirects > 30 % | Activités, inducteurs, ABC |
| `store_network` | au moins 3 points de vente | Comparaison inter-magasins, ratio au m² |
| `contract_recurring` | abonnement ou commission | MRR, churn, marge récurrente |
| `cash_forecast` | données bancaires ou encaissements importés | Projection de trésorerie |
| `standard_costing` | coûts standards saisis | Écarts sur charges directes et indirectes (3 écarts) |

## 4. Rôles et droits

| Fonction | Admin | Dirigeant | Contrôleur | DAF | Resp. opé. | Manager | Lecteur |
|---|---|---|---|---|---|---|---|
| Gérer l'organisation, les utilisateurs | oui | – | – | – | – | – | – |
| Modifier le profil et la configuration | oui | oui | oui | oui | – | – | – |
| Importer des données | oui | – | oui | oui | – | – | – |
| Définir règles d'affectation, KPI | oui | – | oui | oui | – | – | – |
| Créer et arbitrer un budget | oui | oui | oui | oui | – | – | – |
| Saisir le budget de son périmètre | oui | – | oui | oui | oui | oui | – |
| Voir tous les objets | oui | oui | oui | oui | – | – | – |
| Voir son périmètre uniquement | – | – | – | – | oui | oui | oui |
| Lancer un what-if | oui | oui | oui | oui | oui | – | – |
| Exporter un rapport | oui | oui | oui | oui | oui | – | – |

Le périmètre (`scope`) d'un utilisateur est un filtre dimensionnel
(`{ dimension: "CENTER", members: ["PROD", "LOG"] }`) appliqué **côté serveur** à toute requête.

## 5. Flux fonctionnels clés

### F1 — Configuration initiale

```
Profil saisi → RuleEngine.evaluate(facts) → ConfigurationPlan
  ├── capabilities[]            (ce qui s'active)
  ├── dimensions[] + members[]  (les axes)
  ├── costMethods[]             (complet, variable, ABC)
  ├── allocationRules[]         (proposées, éditables)
  ├── kpis[]                    (sélectionnés + cibles par défaut)
  └── dashboard{sections[]}     (le cockpit)
→ Prévisualisation → Application transactionnelle → ConfigurationVersion(n+1)
```

### F2 — Cycle de données

```
Fichier → Parse → Profilage → Mapping (auto + validation) → Contrôle qualité à blanc
→ Import transactionnel → Recalcul (coûts → marges → KPI → alertes)
```

### F3 — Cycle mensuel de gestion

```
Clôture période → Recalcul → Écarts vs budget / forecast / N-1 → Attribution des causes
→ Alertes → Commentaire généré → Rapport → Décisions
```

## 6. Découpage en modules logiciels

| Contexte | Paquet | Dépend de |
|---|---|---|
| Modèle du domaine | `core/model` | — |
| Règles | `core/rules` | model |
| Coûts | `core/costing` | model |
| Budget et écarts | `core/budget` | model |
| KPI | `core/kpi` | model |
| Analytique | `core/analytics` (forecast, whatif, breakeven, attribution, anomaly) | model |
| Qualité | `core/quality` | model |
| Templates sectoriels | `core/templates` | rules, model |
| Copilote | `core/copilot` | tous les moteurs, en lecture seule |
| Persistance | `lib/db`, `lib/repositories` | model |
| Application | `app/**` | services |

`core/**` est **pur** : aucune dépendance à Prisma, à Next, au réseau ou à l'horloge système
(les dates sont injectées). C'est ce qui rend le moteur testable, réutilisable côté navigateur
(prévisualisation what-if instantanée) et portable.
