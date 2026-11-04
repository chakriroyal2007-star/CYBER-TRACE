#!/usr/bin/env python3
"""
Elliptic Bitcoin Transaction Dataset - Supervised Model Training and Evaluation.
Time-aware split:
  Train: time steps 1 to 34 (Weber et al. benchmark)
  Test:  time steps 35 to 49
Only labeled transactions (class 1: illicit, class 2: licit) are used for training/eval.
Class unknown is excluded from training to prevent target leakage.
"""

import os
import sys
import time
import json
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    precision_score, recall_score, f1_score, roc_auc_score,
    average_precision_score, confusion_matrix
)

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../data/elliptic'))
CLASSES_FILE = os.path.join(DATA_DIR, 'elliptic_txs_classes.csv')
EDGES_FILE = os.path.join(DATA_DIR, 'elliptic_txs_edgelist.csv')
FEATURES_FILE = os.path.join(DATA_DIR, 'elliptic_txs_features.csv')
EVAL_OUT_FILE = os.path.join(DATA_DIR, 'model_evaluation.json')
SCORES_OUT_FILE = os.path.join(DATA_DIR, 'model_scores.json')

def main():
    print("=== Cyber Trace: Elliptic Model Training & Evaluation ===")
    t_start = time.time()
    
    if not os.path.exists(CLASSES_FILE) or not os.path.exists(FEATURES_FILE):
        print(f"Error: dataset files missing in {DATA_DIR}", file=sys.stderr)
        sys.exit(1)

    print("1. Ingesting classes...")
    df_classes = pd.read_csv(CLASSES_FILE)
    total_nodes = len(df_classes)
    class_counts = df_classes['class'].value_counts().to_dict()
    # In CSV: '1' is illicit (4,545), '2' is licit (42,019), 'unknown' is unknown (157,205)
    illicit_count = int(class_counts.get('1', 0))
    licit_count = int(class_counts.get('2', 0))
    unknown_count = int(class_counts.get('unknown', 0))
    print(f"   Nodes: {total_nodes:,} | Illicit (1): {illicit_count:,} | Licit (2): {licit_count:,} | Unknown: {unknown_count:,}")

    classes_map = dict(zip(df_classes['txId'].astype(str), df_classes['class'].astype(str)))

    print("2. Ingesting features...")
    t_feat = time.time()
    df_feat = pd.read_csv(FEATURES_FILE, header=None)
    print(f"   Loaded {len(df_feat):,} feature rows with {df_feat.shape[1]-2} features in {time.time()-t_feat:.2f}s")

    df_feat['txId_str'] = df_feat[0].astype(str)
    df_feat['label_raw'] = df_feat['txId_str'].map(classes_map)
    df_feat['timestep'] = df_feat[1].astype(int)

    # Labeled dataset for supervised learning
    labeled_df = df_feat[df_feat['label_raw'].isin(['1', '2'])].copy()
    labeled_df['target'] = (labeled_df['label_raw'] == '1').astype(int)

    # Time-aware train/test split: train steps 1..34, test steps 35..49
    train_mask = labeled_df['timestep'] <= 34
    test_mask = labeled_df['timestep'] > 34

    feature_cols = list(range(2, 167))
    X_train = labeled_df.loc[train_mask, feature_cols].values
    y_train = labeled_df.loc[train_mask, 'target'].values

    X_test = labeled_df.loc[test_mask, feature_cols].values
    y_test = labeled_df.loc[test_mask, 'target'].values

    train_illicit = int(np.sum(y_train))
    train_licit = int(len(y_train) - train_illicit)
    test_illicit = int(np.sum(y_test))
    test_licit = int(len(y_test) - test_illicit)

    print(f"3. Time-aware split: Train steps 1-34 ({len(y_train):,} txs: {train_illicit} illicit, {train_licit} licit)")
    print(f"   Test steps 35-49 ({len(y_test):,} txs: {test_illicit} illicit, {test_licit} licit)")

    # Preprocessing: StandardScaler fitted ONLY on train split
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Train Baseline 1: Logistic Regression (Balanced)
    print("4. Training Logistic Regression baseline...")
    t_lr = time.time()
    lr = LogisticRegression(max_iter=1000, class_weight='balanced', random_state=42)
    lr.fit(X_train_scaled, y_train)
    lr_train_time = round(time.time() - t_lr, 3)

    lr_preds = lr.predict(X_test_scaled)
    lr_probs = lr.predict_proba(X_test_scaled)[:, 1]
    lr_cm = confusion_matrix(y_test, lr_preds)
    tn_lr, fp_lr, fn_lr, tp_lr = lr_cm.ravel()

    lr_results = {
        "model": "Logistic Regression (Class-Weighted)",
        "train_time_sec": lr_train_time,
        "precision": round(float(precision_score(y_test, lr_preds, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, lr_preds, zero_division=0)), 4),
        "f1": round(float(f1_score(y_test, lr_preds, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y_test, lr_probs)), 4),
        "pr_auc": round(float(average_precision_score(y_test, lr_probs)), 4),
        "fpr": round(float(fp_lr / (fp_lr + tn_lr)), 4) if (fp_lr + tn_lr) > 0 else 0.0,
        "fnr": round(float(fn_lr / (fn_lr + tp_lr)), 4) if (fn_lr + tp_lr) > 0 else 0.0,
        "confusion_matrix": {"tn": int(tn_lr), "fp": int(fp_lr), "fn": int(fn_lr), "tp": int(tp_lr)}
    }
    print(f"   LR Test F1: {lr_results['f1']:.4f} | PR-AUC: {lr_results['pr_auc']:.4f} | ROC-AUC: {lr_results['roc_auc']:.4f}")

    # Train Baseline 2: Random Forest (Balanced)
    print("5. Training Random Forest classifier...")
    t_rf = time.time()
    rf = RandomForestClassifier(n_estimators=100, max_depth=12, class_weight='balanced', random_state=42, n_jobs=-1)
    rf.fit(X_train, y_train)
    rf_train_time = round(time.time() - t_rf, 3)

    rf_preds = rf.predict(X_test)
    rf_probs = rf.predict_proba(X_test)[:, 1]
    rf_cm = confusion_matrix(y_test, rf_preds)
    tn_rf, fp_rf, fn_rf, tp_rf = rf_cm.ravel()

    rf_results = {
        "model": "Random Forest (max_depth=12, n_estimators=100, class_weight='balanced')",
        "train_time_sec": rf_train_time,
        "precision": round(float(precision_score(y_test, rf_preds, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, rf_preds, zero_division=0)), 4),
        "f1": round(float(f1_score(y_test, rf_preds, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y_test, rf_probs)), 4),
        "pr_auc": round(float(average_precision_score(y_test, rf_probs)), 4),
        "fpr": round(float(fp_rf / (fp_rf + tn_rf)), 4) if (fp_rf + tn_rf) > 0 else 0.0,
        "fnr": round(float(fn_rf / (fn_rf + tp_rf)), 4) if (fn_rf + tp_rf) > 0 else 0.0,
        "confusion_matrix": {"tn": int(tn_rf), "fp": int(fp_rf), "fn": int(fn_rf), "tp": int(tp_rf)}
    }
    print(f"   RF Test F1: {rf_results['f1']:.4f} | PR-AUC: {rf_results['pr_auc']:.4f} | ROC-AUC: {rf_results['roc_auc']:.4f}")
    print(f"   RF Precision: {rf_results['precision']:.4f} | Recall: {rf_results['recall']:.4f}")

    # Top feature importances from Random Forest
    importances = rf.feature_importances_
    top_indices = np.argsort(importances)[::-1][:15]
    top_features = []
    for rank, idx in enumerate(top_indices, 1):
        feat_name = f"feat_{idx+1}_local" if idx < 93 else f"feat_{idx+1}_agg"
        top_features.append({
            "rank": rank,
            "feature_index": int(idx),
            "feature_name": feat_name,
            "importance": round(float(importances[idx]), 5)
        })

    # Save comprehensive evaluation report
    eval_report = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "dataset_name": "Elliptic Bitcoin Transaction Dataset",
        "split_strategy": "Time-aware split (Train steps 1-34, Test steps 35-49, Weber et al. 2019)",
        "train_samples": int(len(y_train)),
        "train_illicit": train_illicit,
        "train_licit": train_licit,
        "test_samples": int(len(y_test)),
        "test_illicit": test_illicit,
        "test_licit": test_licit,
        "selected_model": "Random Forest",
        "models": {
            "random_forest": rf_results,
            "logistic_regression": lr_results
        },
        "top_features": top_features,
        "risk_thresholds": {
            "high": 70,
            "medium": 40,
            "low": 0
        },
        "disclaimer": "Model predictions represent analytical risk scores calibrated from the Elliptic Research Dataset. They do not constitute verified evidence of criminal activity."
    }

    with open(EVAL_OUT_FILE, 'w') as f:
        json.dump(eval_report, f, indent=2)
    print(f"6. Saved evaluation report to {EVAL_OUT_FILE}")

    # Generate inference probabilities and risk scores for all 203,769 transactions
    print("7. Generating model predictions for all 203,769 transactions...")
    t_pred = time.time()
    all_features = df_feat[feature_cols].values
    all_probs = rf.predict_proba(all_features)[:, 1]

    # Map probability to 0-100 risk score
    # Score = round(probability * 100)
    tx_ids = df_feat['txId_str'].values
    labels_raw = df_feat['label_raw'].values
    timesteps = df_feat['timestep'].values

    scores_dict = {}
    for i in range(len(tx_ids)):
        tid = tx_ids[i]
        prob = float(all_probs[i])
        score = int(np.clip(np.round(prob * 100), 0, 100))
        lbl = labels_raw[i] if pd.notna(labels_raw[i]) else 'unknown'
        # Label mapping: '1' -> 'illicit', '2' -> 'licit', 'unknown' -> 'unknown'
        mapped_label = 'illicit' if lbl == '1' else 'licit' if lbl == '2' else 'unknown'
        pred_label = 'illicit' if prob >= 0.5 else 'licit'
        scores_dict[tid] = [score, mapped_label, pred_label, round(prob, 4), int(timesteps[i])]

    with open(SCORES_OUT_FILE, 'w') as f:
        json.dump(scores_dict, f)
    print(f"   Saved {len(scores_dict):,} scores to {SCORES_OUT_FILE} in {time.time()-t_pred:.2f}s")
    print(f"=== Training pipeline completed successfully in {time.time()-t_start:.2f}s ===")

if __name__ == '__main__':
    main()

