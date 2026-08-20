# 11 — Architecture IA

## 1. Principe non négociable

```
DONNÉES → CALCULS DÉTERMINISTES → KPI → ANALYSE → IA
```

L'IA **n'invente aucun chiffre**. Tout nombre affiché provient du moteur. Le modèle de langage,
quand il est activé, ne reçoit que des **résultats déjà calculés** et ne produit que du texte.

Trois couches, dont deux fonctionnent **sans aucune clé d'API** :

| Couche | Nature | Dépend d'un LLM ? |
|---|---|---|
| L1 — Détection | statistique et règles | non |
| L2 — Explication | attribution d'écarts, décomposition | non |
| L3 — Formulation | narration, dialogue | optionnel (`AI_PROVIDER=anthropic`) |

`AI_PROVIDER=local` (défaut) : L3 utilise des gabarits de phrases déterministes. L'application est
complète, hors ligne, reproductible. `AI_PROVIDER=anthropic` : L3 délègue la rédaction au modèle,
avec les mêmes chiffres en entrée.

## 2. L1 — Détection

| Détecteur | Méthode | Sortie |
|---|---|---|
| Valeur aberrante | z-score robuste (MAD) sur l'historique de la mesure, seuil 3 | anomalie ponctuelle |
| Rupture de tendance | comparaison de pentes sur 2 fenêtres (CUSUM simplifié) | changement de régime |
| Dépassement budgétaire | règles `ALERT-BUDGET-*` | alerte |
| Dérive de marge | delta de taux en points sur 1, 3 et 12 mois | alerte |
| Dérive de coûts | croissance des coûts > croissance du CA, 2 périodes consécutives | alerte |
| Dérive de projet | `EAC > budget` ou consommation > avancement + 15 pts | alerte |
| Saisonnalité trompeuse | comparaison à la même période N-1 avant alerte | inhibition d'alerte |

Les détecteurs sont des fonctions pures testées sur des séries de référence. Chaque détection
porte un `evidence` : la série, la fenêtre, le seuil, la valeur — affichés à l'utilisateur.

## 3. L2 — Explication

Deux mécanismes déjà décrits ailleurs, réutilisés :

1. **Décomposition** (doc 08 §4) : prix / volume / mix, budget / activité / rendement.
2. **Attribution** (doc 08 §5) : classement des contributeurs, cumul jusqu'à 80 %.

Sortie normalisée :

```ts
Explanation {
  question: string
  headline: { measure, value, delta, deltaPct, period }
  decomposition: { component, value, share }[]
  contributors: { dimension, member, value, share, cumulative }[]
  drilldown: { path, filter }[]
  confidence: "high" | "medium" | "low"   // dépend de la qualité des données
  dataQualityCaveats: string[]
}
```

`confidence` est calculé, pas déclaré : il dépend du score de qualité des données du périmètre
concerné, du nombre de périodes disponibles et de la part de coûts non affectés.

## 4. L3 — Formulation

### Mode local (défaut)

Gabarits paramétrés, en français, produisant par exemple :

> « La marge opérationnelle diminue de 2,4 points sur mars 2026, principalement sous l'effet de la
> hausse des coûts de sous-traitance (+18 %). Deux chantiers représentent 61 % de cette dérive. »

Les gabarits couvrent : synthèse mensuelle, explication d'écart, commentaire de KPI, résumé
d'alerte, conclusion de scénario.

### Mode LLM

Le modèle reçoit un **contexte strictement borné** : les objets `Explanation`, `KpiValue`,
`Variance` sérialisés, plus une consigne stricte :

```
- Tu commentes des chiffres déjà calculés. Tu n'en produis, n'en corriges et n'en extrapoles aucun.
- Tout nombre de ta réponse doit apparaître dans le contexte fourni.
- Si l'information n'est pas dans le contexte, dis-le explicitement.
- Style : contrôleur de gestion, 4 phrases maximum par point, aucune formule creuse.
```

Un **contrôle post-génération** extrait tous les nombres de la réponse et vérifie qu'ils
appartiennent au contexte (tolérance d'arrondi). En cas d'écart, la réponse est rejetée et le
gabarit local est servi à la place. Ce garde-fou est testé.

## 5. Copilote conversationnel

Architecture outillée (`tool use`), y compris en mode local :

```
Question utilisateur
      ▼
[ Détection d'intention ]  ← patrons français + normalisation (accents, synonymes)
      ▼
[ Sélection d'outils ]     ← catalogue d'outils de lecture, tous déterministes
      ▼
[ Exécution serveur ]      ← moteurs de calcul, filtrés par le périmètre de l'utilisateur
      ▼
[ Formulation L3 ]         ← gabarit local ou LLM
      ▼
Réponse : phrase + tableau + graphique + liens de drill-down + « comment c'est calculé »
```

### Catalogue d'outils

| Outil | Signature | Exemple de question |
|---|---|---|
| `getMeasure` | mesure, période, filtre | « Quelle est ma marge ce mois-ci ? » |
| `explainVariance` | mesure, période, référence | « Pourquoi ma marge baisse ? » |
| `rankObjects` | dimension, mesure, ordre, n | « Mes 5 clients les moins rentables ? » |
| `checkBudget` | dimension, période | « Quel département dépasse son budget ? » |
| `listRisks` | période | « Quel chantier présente le plus grand risque ? » |
| `simulate` | leviers | « Que se passe-t-il si j'embauche 2 personnes ? » |
| `buildReport` | type, période | « Prépare l'analyse mensuelle. » |
| `explainKpi` | code | « Comment calcules-tu le taux d'occupation ? » |

Toute réponse chiffrée affiche un lien **« Voir le calcul »** ouvrant la trace (règles appliquées,
écritures sources). Le copilote refuse explicitement de répondre lorsque la mesure n'est pas
disponible, plutôt que d'approximer.

## 6. Recommandations

Les recommandations sont produites par le même moteur de règles (scope `recommendation`), à partir
du diagnostic. Exemple :

```
SI marge d'un objet < 0 sur 3 périodes ET part du CA > 5 %
ALORS recommander : "renégocier ou arrêter", impact estimé = marge contributive perdue/évitée
```

Chaque recommandation porte : le constat, la règle, l'impact estimé chiffré par le moteur
what-if, et le niveau de confiance. Aucune recommandation n'est produite par un LLM.

## 7. Limites assumées et affichées

- Pas de causalité : le moteur décrit des contributions comptables, pas des causes réelles.
- Pas de prévision au-delà de l'horizon de fiabilité mesuré (MAPE de backtest affiché).
- Confiance dégradée sous 6 périodes d'historique ou sous 70 % de qualité de données.
- Le mode LLM peut être coupé sans perte de fonctionnalité chiffrée.
