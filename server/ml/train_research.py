#!/usr/bin/env python3
"""Reproducible Elliptic graph baseline. Never interprets research IDs as live hashes.
Optional full features: train_model.py provides the original time-split experiment.
This baseline uses only topology because the full feature file is not distributed here.
"""
import argparse
import gzip
import hashlib
import json
import platform
import time
from pathlib import Path
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import average_precision_score, roc_auc_score, precision_score, recall_score, f1_score, confusion_matrix
import joblib

ROOT = Path(__file__).resolve().parents[2]

def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data-dir', type=Path, default=ROOT / 'data/elliptic')
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'data/ml')
    args = parser.parse_args()
    started = time.perf_counter()
    classes_path = args.data_dir / 'elliptic_txs_classes.csv'
    edges_path = args.data_dir / 'elliptic_txs_edgelist.csv'
    classes = pd.read_csv(classes_path, dtype=str).set_index('txId')
    if not set(classes['class']).issubset({'1', '2', 'unknown'}) or not classes.index.is_unique:
        raise ValueError('Unexpected classes or duplicate transaction IDs')
    edges = pd.read_csv(edges_path, dtype=str)
    source, target = edges.iloc[:, 0], edges.iloc[:, 1]
    if not set(source).union(target).issubset(set(classes.index)):
        raise ValueError('Edges contain unknown transaction IDs')
    indegree = target.value_counts().reindex(classes.index, fill_value=0).to_numpy(dtype=float)
    outdegree = source.value_counts().reindex(classes.index, fill_value=0).to_numpy(dtype=float)
    feature_names = ['in_degree', 'out_degree', 'total_degree', 'out_in_ratio', 'is_origin', 'is_sink']
    X = np.column_stack([indegree, outdegree, indegree + outdegree, outdegree / (indegree + 1), indegree == 0, outdegree == 0])
    labeled = np.flatnonzero(classes['class'].isin(['1', '2']).to_numpy())
    y = (classes['class'] == '1').to_numpy(dtype=int)
    train, test = train_test_split(labeled, test_size=.25, random_state=42, stratify=y[labeled])
    models = {
        'random_forest': RandomForestClassifier(n_estimators=100, max_depth=10, class_weight='balanced', random_state=42, n_jobs=1),
        'logistic_regression': make_pipeline(StandardScaler(), LogisticRegression(class_weight='balanced', random_state=42, max_iter=2000)),
        'isolation_forest': IsolationForest(n_estimators=100, random_state=42, n_jobs=1, contamination='auto'),
    }
    report = {'dataset': 'Elliptic Bitcoin Transaction Dataset', 'source': 'https://www.kaggle.com/datasets/ellipticco/elliptic-data-set',
              'input_sha256': {p.name: sha(p) for p in [classes_path, edges_path]},
              'seed': 42, 'split': 'Stratified random 75/25 of labeled nodes; topology of full graph is visible (transductive). NOT a temporal/generalization benchmark.',
              'train_samples': len(train), 'test_samples': len(test), 'unknown_excluded_from_supervised': int((classes['class'] == 'unknown').sum()),
              'features': feature_names, 'models': {}, 'python': platform.python_version(), 'sklearn': sklearn.__version__,
              'limitations': ['Topology-only baseline; no raw amount or wall-clock transaction timestamps in supplied edge/class files.',
                              'No fabricated temporal or transaction features. Supply full Elliptic feature CSV to reproduce the separate time-aware pipeline.',
                              'No validated UPI, account takeover, live wallet, or incident fraud classifier.',
                              'Random Forest and Logistic Regression probabilities are uncalibrated; Isolation Forest scores are anomaly scores, not fraud probabilities.',
                              'Connected train/test nodes may inflate evaluation; not a component-disjoint or time-disjoint validation.']}
    probabilities = {}
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for name, model in models.items():
        t = time.perf_counter()
        if name == 'isolation_forest':
            model.fit(X[train])
            score = -model.decision_function(X[test])
            pred = (model.predict(X[test]) == -1).astype(int)
            probabilities[name] = -model.decision_function(X)
        else:
            model.fit(X[train], y[train])
            score = model.predict_proba(X[test])[:, 1]
            pred = model.predict(X[test])
            probabilities[name] = model.predict_proba(X)[:, 1]
        report['models'][name] = {'precision': float(precision_score(y[test], pred, zero_division=0)), 'recall': float(recall_score(y[test], pred)),
                                'f1': float(f1_score(y[test], pred)), 'roc_auc': float(roc_auc_score(y[test], score)),
                                'pr_auc': float(average_precision_score(y[test], score)), 'confusion_matrix': confusion_matrix(y[test], pred).tolist(),
                                'execution_seconds': time.perf_counter() - t}
        joblib.dump(model, args.output_dir / (name + '.joblib'))
    report['top_features']=[{'feature_name':name,'importance':float(value)} for name,value in zip(feature_names,models['random_forest'].feature_importances_)]
    report['execution_seconds'] = time.perf_counter() - started
    report['run_id'] = hashlib.sha256(json.dumps({'inputs':report['input_sha256'], 'seed':42, 'features':feature_names, 'sklearn':sklearn.__version__}, sort_keys=True).encode()).hexdigest()
    def tree_data(estimator):
        tree=estimator.tree_
        return {'left':tree.children_left.tolist(),'right':tree.children_right.tolist(),'feature':tree.feature.tolist(),'threshold':tree.threshold.tolist(),'samples':tree.n_node_samples.tolist(),'values':tree.value[:,0,:].tolist()}
    scaler, logistic = models['logistic_regression'].steps[0][1], models['logistic_regression'].steps[1][1]
    isolation=models['isolation_forest']
    portable={'runId':report['run_id'],'features':feature_names,
              'randomForest':[tree_data(t) for t in models['random_forest'].estimators_],
              'logisticRegression':{'mean':scaler.mean_.tolist(),'scale':scaler.scale_.tolist(),'coef':logistic.coef_[0].tolist(),'intercept':float(logistic.intercept_[0])},
              'isolationForest':{'trees':[tree_data(t) for t in isolation.estimators_],'features':[f.tolist() for f in isolation.estimators_features_],'maxSamples':int(isolation.max_samples_),'offset':float(isolation.offset_)}}
    with gzip.GzipFile(filename=str(args.output_dir / 'portable_models.json.gz'),mode='wb',mtime=0) as stream:
        stream.write(json.dumps(portable,separators=(',',':')).encode())
    pd.DataFrame({'txId':classes.index[train]}).to_csv(args.output_dir / 'train_ids.csv', index=False)
    pd.DataFrame({'txId':classes.index[test]}).to_csv(args.output_dir / 'test_ids.csv', index=False)
    test_set = set(test)
    predictions = {str(tx): {'probability':float(probabilities['random_forest'][i]), 'logisticRegressionProbability':float(probabilities['logistic_regression'][i]),
                            'isolationForestAnomalyScore':float(probabilities['isolation_forest'][i]), 'partition':'test' if i in test_set else 'train' if y[i] or classes.iloc[i,0] == '2' else 'unlabeled'}
                   for i, tx in enumerate(classes.index)}
    (args.output_dir / 'evaluation.json').write_text(json.dumps(report, indent=2))
    with gzip.GzipFile(filename=str(args.output_dir / 'research_predictions.json.gz'), mode='wb', mtime=0) as stream:
        stream.write(json.dumps({'runId':report['run_id'], 'predictions':predictions}, separators=(',', ':')).encode())
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
