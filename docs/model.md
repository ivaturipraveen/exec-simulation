# Simulation model — methodology note (MOD-001, STR-003)

*Facilitator appendix (OD-05). Teams see result drivers in plain language, never these formulas.*
Implements **Content Pack v0.1 §5** (Oct 8, 2026). Code: `backend/sim/engine/`. Parameters: `content/game.yaml`. Card rules: `content/investments.yaml`.

## 1. State (per team)

| Variable | Meaning |
|---|---|
| Initiative | card, round, start quarter, scope (I1 full or scoped), named owner, status (active, paused, cancelled), progress 0–1, go-live quarter, capital committed / spent / recovered / written off, variable-mode draw |
| Quarter snapshot | full-effect improvement per measure, measure run-rate, 14 leading KPIs, per-card realization and contributions, capacity demand / supply / utilization / multiplier, adoption, run cost, savings, capital spent, dual-eligible ratio |
| Other | drift accrued per measure, incidents (side effects), op-model human-review flag (E7), pitch unsupported-figure flag (E6) |

## 2. Quarterly transition

1. **Capacity.**
   - Demand is the sum of capacity points (× scope factor) of cards building this quarter: active, started, progress < 1.
   - Multiplier = min(1, supply ÷ demand). If demand exceeds 150% of supply, the multiplier is capped at 0.5 (half speed).
2. **Delivery.**
   - Progress += multiplier ÷ duration.
   - One-time cards spend capital in proportion to progress; per-year cards (I14, I15) spend a quarter of their annual cost each quarter.
   - Progress 1 means go-live in this quarter.
3. **Conditions** see what was live *before* this quarter and last quarter's KPIs. This avoids circularity and gives "KPIs respond the quarter after go-live".
4. **KPIs.** Each live card moves its KPIs by `delta × r`, `pct × r` or `toward set_to × r`, where r = payer fit × adoption × owner × scope × decay. Rule multipliers are not applied to KPIs.
5. **Measure effects.** For each live card and each measure it targets:

   ```
   effect = base × payer_fit × Π(rule multipliers whose conditions hold) × adoption × owner
            × capacity_multiplier × decay × draw
   ```

   - payer_fit: High 1.0 · Medium 0.6 · Low 0.3.
   - adoption applies to copilots and agents only (I4, I6, I8): baseline 0.15–0.30, 0.60 with I11, 0.85 with I11 + I15, +0.10 with I18.
   - owner: a card that needs a named owner and has none realizes `owner_missing_multiplier` (I10: 0, "ceremonial"; I1: 0.5).
   - decay: 1 − rate × years since go-live, unless the named control is live.
   - draw: 1 in deterministic mode; 1 ± 20% in variable mode.
6. **Diminishing returns.** Per measure, positive effects are sorted largest first and realize 100%, 60% and 30% (the third and later all 30%). The total is capped at the payer's two-year headroom.
7. **Side effects** (e.g. I7 on identity under 90% raises complaints +0.15; I7/I8 at CommunityCare without I16 lowers M9 by 2.5 and raises complaints) are added after the cap and logged once as member-harm incidents.
8. **Drift.** Payer baseline movement accrues each quarter in which its "unless" condition does not hold:
   - Heritage: M11 +0.125/yr and M10 −0.75/yr unless I17 or I4 is live.
   - Horizon: M11 +0.05/yr unless I17 or I4 is live.
9. **Economics.** Run cost accrues from go-live (25% while paused). Savings = card savings × min(1, r).

## 3. Dependency multipliers (pack §5, encoded as card rules)

| Rule | Encoded on |
|---|---|
| I1 live: ×1.4 on I3, I7, I8 and removes the identity penalty (×0.6 when match is under 95%) | I3, I7, I8 |
| I2 live: ×1.3 on I5, I6, I8 | I5, I6, I8 |
| I14 live: ×2.0 on I3; with neither I14 nor I8, I3 gives +0.5 only (×0.2) | I3 |
| I17 live: ×2.0 on I4 | I4 |
| I15 live (or value-based contracts at Heritage): unlocks I5 (×0.2 without) | I5 |
| I8 without I1 and I10 live: ×0.4 and the E1 trigger | I8 |
| I7 without owned I10 (message review): ×0.5; identity under 90%: ×0.5 + complaints | I7 |
| I9 without I12: ×0.5 | I9 |

## 4. Measures, lag and Stars

- **Rating-year value (year Y)** = start + lag share × mean full effect in Y + (1 − lag share) × mean full effect in Y−1. Lag shares: M1/M2/M7/M9 0.5, M3/M4/M10 0.6, M5/M12 0.7, M11 0.9.
- **Projected path** = start + full effect at the end of the year. The ±20% band applies to the effect.
- **Measure Stars:** higher-is-better counts rate ≥ threshold; lower-is-better counts rate < threshold (pack wording). A 1-Star floor is added (B-01).
- **Summary** = weighted mean of measure Stars (weights 3/2/1) + the payer's rating adjustment (Heritage +0.20, B-02), rounded to the nearest half.
- **Lakeshore sub-rating** uses Lakeshore's M1/M2 values, with effects scaled by the headroom ratio (5.0/2.0 and 4.5/1.5).

## 5. Crisis selection (pack §7)

- For each event that applies to the payer, the first severity rule whose condition holds sets the severity.
- Probability: high 0.9, medium 0.6, low 0.3.
- If the event's rules don't already reference I10 and the team **owns** I10, probability halves and severity drops one level.
- I12 funded halves E4's probability. E4 can be assigned to one team per session; E6 is facilitator-only (pitch figure check).
- Ranking: probability, then severity, then payer-specific events first.
- The facilitator confirms or overrides (event and severity) with an audit note.
- Effects apply to the final scorecard:
  - measure deltas;
  - capacity;
  - write-off;
  - dimension adjustments;
  - equity override;
  - adoption override.

## 6. Rubrics

| Rubric | Rows (0–3 each) | Use |
|---|---|---|
| Crisis | stop/continue, owner, investigation, communication, protection, corrective | 50% of Risk; under 6/18 costs −10 on the total; concealment sets every row to 0; I18 adds one point to stop/continue |
| Board pitch | evidence, causal, decision, risk, clarity | Earned capital: 13–15 +$4M, 10–12 +$2M, 7–9 +$1M, ≤6 $0, on the $8M base |
| Operating model | value, control adequacy, adoption feasibility, recoverability | 40% of AI maturity |

The engine (and, for the pitch, Claude) suggests a score; the facilitator decides (OD-08).

Operating-model heuristics:
- Value = mean `value_by_mode`.
- Control = required controls present per mode, risk, member-facing and sensitive step; autonomous on a sensitive step ×0.3; agent steps scaled by the decision dimensions answered.
- Adoption = owners named × support from I11, I18 and I15 vs the share of roles changed.
- Recoverability = kill switch, exception handling and audit log on agent steps.

## 7. Scorecard (pack §10.1)

| Dimension | Formula |
|---|---|
| Stars 30% | 100 × (0.6 × weighted lift share + 0.4 × path to 4.0). Lift share = Σ weight × clamp(lift ÷ headroom) on projected values; path = (projected score − start) ÷ (4.0 − start), or hold-4.0 for payers starting at 4 |
| Member 20% | 100 × weighted lift share over M3, M4, M7, M9, M10, M11 + 10 × equity modifier − 5 × member-harm incidents. Equity = clamp((dual ratio − 1) × 2.5, −1, 1), E4 forces −1 |
| Financial 20% | 100 × (0.5 × bonus progress + 0.2 × min(1, run-rate savings ÷ 2% of bonus value) + 0.3 × discipline). Discipline = 0.5 × spent ÷ committed + 0.5 × (1 − 3 × write-offs ÷ granted) |
| Maturity 15% | 60% × (0.4 foundations live, weighted by payer fit + 0.4 adoption + 0.2 decision rights) + 40% × op-model rubric; capped at 50 if any quarter is over 150% |
| Risk 15% | 50% × controls (0.35 owned I10 + 0.25 I12 + 0.2 subgroup monitoring in the op model + 0.2 no privacy event − 8 per harm) + 50% × crisis rubric; capped at 20 if harm occurred and the corrective row is 0 |

## 8. Expected directional behaviour (regression suite)

Tested in `backend/tests/sim/test_balance.py`; full matrix via `make sim-compare`; comparison with the pack in `docs/calibration.md`:
- Every payer's two viable strategies beat its failure modes and do-nothing. No single card beats the viable strategies.
- Horizon foundation-light and provider-first project 3.0 → 3.5. Heritage sequenced and operational hold 3.5 (Lakeshore 3.0 → 3.5); Heritage do-nothing slips to 3.0. CommunityCare capacity-first projects 4.0; outreach-heavy drops to 3.0.
- Crises: E1 low / medium / high for foundation-light / provider-first / failure; E2 low (sequenced, I10 owned) and high (failure); E3 high (insight-heavy); none for the clean operational and capacity-first portfolios.
- Capacity overruns: Horizon failure 130%; Heritage failure 162%.

## 9. Simplification register

See `content/reference.yaml` (shown in the primer, the Edition tab and the facilitator pack). The facilitator says each "disclosure" line during the debrief.
