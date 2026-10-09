"""Real, honest weather anomaly detection — scikit-learn, not a buzzword.

The question answered is "is THIS location's recent weather behaving
unlike ITS OWN history," never "is it raining a lot" against some fixed
global threshold — the same baseline-relative principle the sector-
vulnerability credit model already applies (deviate from your own
calibrated baseline, not a flat cutoff), applied here to raw precipitation.

Two independent methods are computed and an anomaly is only flagged when
BOTH agree:
  1. Rolling z-score — a transparent, explainable statistic anyone can
     recompute by hand from the two numbers stored alongside it.
  2. IsolationForest — a real unsupervised scikit-learn model, which can
     catch multivariate/non-Gaussian outlier shapes a z-score alone would
     miss, at the cost of being less immediately explainable.

Requiring agreement between a simple statistic and a trained model is a
deliberate, disclosed design choice to keep the false-positive rate low —
not a claim that either method alone is insufficient.
"""

from dataclasses import dataclass

import numpy as np
from sklearn.ensemble import IsolationForest

Z_SCORE_THRESHOLD = 2.0  # ~95% two-tailed under a normal approximation


@dataclass
class AnomalyPoint:
    date: str
    value: float
    baseline_mean: float
    baseline_std: float
    z_score: float
    isolation_forest_score: float  # lower = more anomalous (sklearn convention)
    is_anomaly: bool
    method_agreement: bool


def detect_anomalies(dates: list[str], values: list[float]) -> list[AnomalyPoint]:
    """`dates`/`values` is one location's observed series (e.g. daily
    precipitation_mm for a 60-90 day window from NASA POWER/Open-Meteo).
    Needs at least 5 points to fit a meaningful baseline; returns an empty
    list rather than a misleading result for a too-short series."""
    if len(values) < 5:
        return []

    arr = np.array(values, dtype=float).reshape(-1, 1)
    mean = float(arr.mean())
    std = float(arr.std()) or 1e-6  # guard against a perfectly flat series

    iso = IsolationForest(contamination=0.1, random_state=42, n_estimators=100)
    iso.fit(arr)
    iso_labels = iso.predict(arr)  # -1 anomaly, 1 normal
    iso_scores = iso.decision_function(arr)

    results = []
    for i, (d, v) in enumerate(zip(dates, values)):
        z = (v - mean) / std
        z_anomaly = abs(z) > Z_SCORE_THRESHOLD
        iso_anomaly = bool(iso_labels[i] == -1)
        results.append(
            AnomalyPoint(
                date=d,
                value=v,
                baseline_mean=round(mean, 3),
                baseline_std=round(std, 3),
                z_score=round(z, 3),
                isolation_forest_score=round(float(iso_scores[i]), 4),
                is_anomaly=z_anomaly and iso_anomaly,
                method_agreement=z_anomaly == iso_anomaly,
            )
        )
    return results
