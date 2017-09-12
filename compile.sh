docker build -t wildapps/fulfilment:0.0.1 . &&
kubectl scale --replicas=0 deployment deployment --namespace=fulfilment &&
kubectl scale --replicas=2 deployment deployment --namespace=fulfilment
