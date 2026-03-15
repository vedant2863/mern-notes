# File 22: Lab — Ingress, Gateway API, and Traffic Management

**Topic:** Hands-on lab covering NGINX Ingress installation, path/host-based routing, TLS, Network Policies, and Gateway API with traffic splitting

**WHY THIS MATTERS:**
Ingress and Gateway API are how you expose HTTP services to the outside world in production. This lab walks you through the full lifecycle: installing an Ingress controller, configuring routing rules, securing traffic with TLS, restricting internal traffic with Network Policies, and using the modern Gateway API for canary deployments. Every exercise builds on real-world patterns you will use in production.

---

## Prerequisites

| Tool | Purpose | Install Command |
|------|---------|----------------|
| kind | Local Kubernetes cluster with port mappings | `brew install kind` (macOS) / `go install sigs.k8s.io/kind@latest` |
| kubectl | Kubernetes CLI | `brew install kubectl` (macOS) / `curl -LO "https://dl.k8s.io/release/$(curl -sL https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"` |
| docker | Container runtime for kind | `brew install --cask docker` (macOS) / `sudo apt-get install docker.io` |
| helm | Package manager for Kubernetes | `brew install helm` (macOS) / `curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 \| bash` |
| openssl | Generate self-signed certificates | Pre-installed on macOS and most Linux distributions |

---

## Cluster Setup

Create a kind cluster with extra port mappings so we can access the Ingress controller from the host machine.

```yaml
# Save as: kind-ingress-lab.yaml
# WHY: extraPortMappings allow host access to the Ingress controller running inside kind
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: ingress-lab
nodes:
  - role: control-plane
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-labels: "ingress-ready=true"    # WHY: NGINX Ingress targets nodes with this label
    extraPortMappings:
      - containerPort: 80        # WHY: map host port 80 to container port 80 (HTTP)
        hostPort: 80
        protocol: TCP
      - containerPort: 443       # WHY: map host port 443 to container port 443 (HTTPS)
        hostPort: 443
        protocol: TCP
  - role: worker
    labels:
      app-zone: frontend
  - role: worker
    labels:
      app-zone: backend
networking:
  podSubnet: "10.244.0.0/16"
  serviceSubnet: "10.96.0.0/16"
```

```bash
# Create the cluster
# EXPECTED OUTPUT:
# Creating cluster "ingress-lab" ...
#  ✓ Ensuring node image
#  ✓ Preparing nodes
#  ✓ Writing configuration
#  ✓ Starting control-plane
#  ✓ Installing CNI
#  ✓ Joining worker nodes

kind create cluster --config kind-ingress-lab.yaml
```

```bash
# Verify cluster is ready
# EXPECTED OUTPUT:
# NAME                        STATUS   ROLES           AGE   VERSION
# ingress-lab-control-plane   Ready    control-plane   60s   v1.31.0
# ingress-lab-worker          Ready    <none>          45s   v1.31.0
# ingress-lab-worker2         Ready    <none>          45s   v1.31.0

kubectl get nodes
```

---

## Install Instructions

### Installing NGINX Ingress Controller via Helm

```bash
# WHY: Add the official NGINX Ingress Helm repository
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
```

```bash
# WHY: Install NGINX Ingress Controller configured for kind
# The special settings ensure it binds to the control-plane node (which has port mappings)
# EXPECTED OUTPUT:
# NAME: ingress-nginx
# NAMESPACE: ingress-nginx
# STATUS: deployed

helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.hostPort.enabled=true \
  --set controller.service.type=NodePort \
  --set controller.nodeSelector."ingress-ready"=true \
  --set controller.tolerations[0].key=node-role.kubernetes.io/control-plane \
  --set controller.tolerations[0].operator=Exists \
  --set controller.tolerations[0].effect=NoSchedule
```

```bash
# WHY: Wait for the Ingress controller pod to be ready
# EXPECTED OUTPUT:
# deployment.apps/ingress-nginx-controller condition met

kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s
```

### Installing Gateway API CRDs

```bash
# WHY: Gateway API CRDs are not included in Kubernetes by default
# EXPECTED OUTPUT:
# customresourcedefinition.apiextensions.k8s.io/gatewayclasses created
# customresourcedefinition.apiextensions.k8s.io/gateways created
# customresourcedefinition.apiextensions.k8s.io/httproutes created
# etc.

kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.2.0/experimental-install.yaml
```

```bash
# WHY: Verify Gateway API CRDs are installed
# EXPECTED OUTPUT: list of gateway-related CRDs

kubectl get crd | grep gateway
```

---

## Exercise 1: NGINX Ingress with Path-Based Routing

**Objective:** Deploy two different services and configure path-based routing through the NGINX Ingress controller so `/app1` routes to one service and `/app2` routes to another.

### Step 1 — Deploy two backend services

```yaml
# Save as: two-apps.yaml
# WHY: Two distinct apps to demonstrate path-based routing
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app1
spec:
  replicas: 2
  selector:
    matchLabels:
      app: app1
  template:
    metadata:
      labels:
        app: app1
    spec:
      containers:
        - name: app1
          image: hashicorp/http-echo
          args: ["-text=Hello from App 1!"]     # WHY: returns this text — easy to verify routing
          ports:
            - containerPort: 5678
---
apiVersion: v1
kind: Service
metadata:
  name: app1-svc
spec:
  selector:
    app: app1
  ports:
    - port: 80
      targetPort: 5678
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app2
spec:
  replicas: 2
  selector:
    matchLabels:
      app: app2
  template:
    metadata:
      labels:
        app: app2
    spec:
      containers:
        - name: app2
          image: hashicorp/http-echo
          args: ["-text=Hello from App 2!"]
          ports:
            - containerPort: 5678
---
apiVersion: v1
kind: Service
metadata:
  name: app2-svc
spec:
  selector:
    app: app2
  ports:
    - port: 80
      targetPort: 5678
```

```bash
kubectl apply -f two-apps.yaml

# Wait for deployments
kubectl wait --for=condition=Available deployment/app1 deployment/app2 --timeout=120s
```

### Step 2 — Create path-based Ingress

```yaml
# Save as: path-ingress.yaml
# WHY: Route /app1 to app1-svc and /app2 to app2-svc through one entry point
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: path-based-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /    # WHY: strip /app1 or /app2 prefix before forwarding
spec:
  ingressClassName: nginx
  rules:
    - http:
        paths:
          - path: /app1
            pathType: Prefix
            backend:
              service:
                name: app1-svc
                port:
                  number: 80
          - path: /app2
            pathType: Prefix
            backend:
              service:
                name: app2-svc
                port:
                  number: 80
```

```bash
kubectl apply -f path-ingress.yaml
```

### Step 3 — Test the routing

```bash
# WHY: Verify path-based routing works
# EXPECTED OUTPUT: "Hello from App 1!"
curl http://localhost/app1

# EXPECTED OUTPUT: "Hello from App 2!"
curl http://localhost/app2

# EXPECTED OUTPUT: 404 (no rule matches /unknown)
curl -s -o /dev/null -w "%{http_code}" http://localhost/unknown
```

```bash
# WHY: Check the Ingress status
# EXPECTED OUTPUT shows rules and backends
# NAME                 CLASS   HOSTS   ADDRESS     PORTS   AGE
# path-based-ingress   nginx   *       localhost   80      1m

kubectl get ingress
kubectl describe ingress path-based-ingress
```

---

## Exercise 2: Host-Based Routing with TLS

**Objective:** Configure host-based virtual hosting with two different domains, set up TLS using a self-signed certificate, and verify HTTPS access.

### Step 1 — Update /etc/hosts for local testing

```bash
# WHY: Map custom hostnames to localhost so we can test host-based routing
# NOTE: Requires sudo/admin privileges

# On macOS/Linux:
echo "127.0.0.1 app1.local.dev app2.local.dev" | sudo tee -a /etc/hosts

# Verify
# EXPECTED OUTPUT: lines containing app1.local.dev and app2.local.dev
grep "local.dev" /etc/hosts
```

### Step 2 — Create host-based Ingress

```yaml
# Save as: host-ingress.yaml
# WHY: Different hostnames route to different services
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: host-based-ingress
spec:
  ingressClassName: nginx
  rules:
    - host: app1.local.dev          # WHY: requests with Host: app1.local.dev
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: app1-svc
                port:
                  number: 80
    - host: app2.local.dev          # WHY: requests with Host: app2.local.dev
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: app2-svc
                port:
                  number: 80
```

```bash
kubectl apply -f host-ingress.yaml
```

```bash
# WHY: Verify host-based routing
# EXPECTED OUTPUT: "Hello from App 1!"
curl http://app1.local.dev/

# EXPECTED OUTPUT: "Hello from App 2!"
curl http://app2.local.dev/
```

### Step 3 — Generate self-signed TLS certificate

```bash
# WHY: Create a self-signed cert for testing TLS termination
# This cert covers both *.local.dev domains

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout tls-local.key \
  -out tls-local.crt \
  -subj "/CN=*.local.dev" \
  -addext "subjectAltName=DNS:app1.local.dev,DNS:app2.local.dev"

# EXPECTED OUTPUT:
# Generating a 2048 bit RSA private key
# writing new private key to 'tls-local.key'
```

```bash
# WHY: Create a Kubernetes TLS secret from the cert and key
# EXPECTED OUTPUT: secret/local-dev-tls created

kubectl create secret tls local-dev-tls \
  --cert=tls-local.crt \
  --key=tls-local.key
```

### Step 4 — Create TLS-enabled Ingress

```yaml
# Save as: tls-ingress.yaml
# WHY: Enable HTTPS with TLS termination
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tls-host-ingress
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"  # WHY: redirect HTTP to HTTPS
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - app1.local.dev
        - app2.local.dev
      secretName: local-dev-tls      # WHY: reference the TLS secret we created
  rules:
    - host: app1.local.dev
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: app1-svc
                port:
                  number: 80
    - host: app2.local.dev
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: app2-svc
                port:
                  number: 80
```

```bash
kubectl apply -f tls-ingress.yaml
```

```bash
# WHY: Test HTTPS access (-k skips cert verification since it's self-signed)
# EXPECTED OUTPUT: "Hello from App 1!"
curl -k https://app1.local.dev/

# EXPECTED OUTPUT: "Hello from App 2!"
curl -k https://app2.local.dev/

# WHY: Verify the certificate details
# EXPECTED OUTPUT: shows subject=CN=*.local.dev, issuer, dates
curl -kv https://app1.local.dev/ 2>&1 | grep -E "subject:|issuer:|expire"
```

```bash
# WHY: Verify HTTP redirects to HTTPS
# EXPECTED OUTPUT: HTTP/1.1 308 Permanent Redirect, Location: https://app1.local.dev/
curl -I http://app1.local.dev/
```

---

## Exercise 3: Network Policies — Default Deny and Selective Allow

**Objective:** Apply a default-deny Network Policy to block all pod-to-pod traffic, then selectively allow specific communication paths. Debug connectivity with curl.

### Step 1 — Create a test namespace with labeled pods

```yaml
# Save as: netpol-setup.yaml
# WHY: Set up a namespace with client and server pods for Network Policy testing
apiVersion: v1
kind: Namespace
metadata:
  name: netpol-lab
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-server
  namespace: netpol-lab
spec:
  replicas: 1
  selector:
    matchLabels:
      app: web
      role: server
  template:
    metadata:
      labels:
        app: web
        role: server
    spec:
      containers:
        - name: nginx
          image: nginx:1.25
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: web-svc
  namespace: netpol-lab
spec:
  selector:
    app: web
    role: server
  ports:
    - port: 80
      targetPort: 80
---
apiVersion: v1
kind: Pod
metadata:
  name: allowed-client
  namespace: netpol-lab
  labels:
    app: client
    role: frontend
spec:
  containers:
    - name: curl
      image: curlimages/curl
      command: ["sleep", "3600"]
---
apiVersion: v1
kind: Pod
metadata:
  name: blocked-client
  namespace: netpol-lab
  labels:
    app: client
    role: attacker
spec:
  containers:
    - name: curl
      image: curlimages/curl
      command: ["sleep", "3600"]
```

```bash
kubectl apply -f netpol-setup.yaml

kubectl wait --namespace netpol-lab \
  --for=condition=Ready pod/allowed-client pod/blocked-client \
  --timeout=120s

kubectl wait --namespace netpol-lab \
  --for=condition=Available deployment/web-server \
  --timeout=120s
```

### Step 2 — Verify connectivity before Network Policy

```bash
# WHY: Both clients should be able to reach the web server initially
# EXPECTED OUTPUT: HTML from nginx (both succeed)

echo "=== allowed-client ==="
kubectl exec -n netpol-lab allowed-client -- curl -s --max-time 5 http://web-svc

echo ""
echo "=== blocked-client ==="
kubectl exec -n netpol-lab blocked-client -- curl -s --max-time 5 http://web-svc
```

### Step 3 — Apply default-deny Network Policy

```yaml
# Save as: default-deny.yaml
# WHY: Block ALL ingress traffic to pods in the netpol-lab namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: netpol-lab
spec:
  podSelector: {}               # WHY: empty selector = applies to ALL pods in the namespace
  policyTypes:
    - Ingress                    # WHY: block all incoming traffic (egress still allowed)
  # No ingress rules = deny all ingress
```

```bash
kubectl apply -f default-deny.yaml
```

```bash
# WHY: Now BOTH clients should be blocked
# EXPECTED OUTPUT: both should timeout or fail

echo "=== allowed-client (should FAIL) ==="
kubectl exec -n netpol-lab allowed-client -- curl -s --max-time 5 http://web-svc || echo "BLOCKED as expected"

echo ""
echo "=== blocked-client (should FAIL) ==="
kubectl exec -n netpol-lab blocked-client -- curl -s --max-time 5 http://web-svc || echo "BLOCKED as expected"
```

### Step 4 — Allow specific traffic

```yaml
# Save as: allow-frontend.yaml
# WHY: Allow ONLY pods with role=frontend to access the web server on port 80
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-web
  namespace: netpol-lab
spec:
  podSelector:
    matchLabels:
      app: web
      role: server               # WHY: this policy applies to the web server pods
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              role: frontend     # WHY: only pods with role=frontend can access
      ports:
        - protocol: TCP
          port: 80               # WHY: only allow HTTP traffic
```

```bash
kubectl apply -f allow-frontend.yaml
```

```bash
# WHY: allowed-client (role=frontend) should now succeed, blocked-client should still fail

echo "=== allowed-client (should SUCCEED) ==="
kubectl exec -n netpol-lab allowed-client -- curl -s --max-time 5 http://web-svc

echo ""
echo "=== blocked-client (should still FAIL) ==="
kubectl exec -n netpol-lab blocked-client -- curl -s --max-time 5 http://web-svc || echo "STILL BLOCKED"
```

```bash
# WHY: List all Network Policies to see the full picture
# EXPECTED OUTPUT:
# NAME                      POD-SELECTOR          AGE
# default-deny-ingress      <none>                2m
# allow-frontend-to-web     app=web,role=server   30s

kubectl get networkpolicies -n netpol-lab
kubectl describe networkpolicy allow-frontend-to-web -n netpol-lab
```

---

## Exercise 4: Gateway API with HTTPRoute Traffic Splitting

**Objective:** Install a Gateway API-compatible controller, create a Gateway, and set up an HTTPRoute with 90/10 traffic splitting for a canary deployment.

### Step 1 — Install NGINX Gateway Fabric (Gateway API controller)

```bash
# WHY: NGINX Gateway Fabric implements the Gateway API
# Install using kubectl (alternative to Helm)

kubectl apply -f https://github.com/nginxinc/nginx-gateway-fabric/releases/download/v1.4.0/crds.yaml
kubectl apply -f https://github.com/nginxinc/nginx-gateway-fabric/releases/download/v1.4.0/nginx-gateway.yaml
```

```bash
# WHY: Wait for the Gateway Fabric controller to be ready
kubectl wait --namespace nginx-gateway \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/name=nginx-gateway-fabric \
  --timeout=120s

# WHY: Verify the GatewayClass was created
# EXPECTED OUTPUT:
# NAME    CONTROLLER                          ACCEPTED   AGE
# nginx   gateway.nginx.org/nginx-gateway-controller   True       30s

kubectl get gatewayclass
```

### Step 2 — Deploy canary application versions

```yaml
# Save as: canary-apps.yaml
# WHY: Two versions of the same app for canary testing
apiVersion: v1
kind: Namespace
metadata:
  name: canary-lab
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-v1
  namespace: canary-lab
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
      version: v1
  template:
    metadata:
      labels:
        app: myapp
        version: v1
    spec:
      containers:
        - name: app
          image: hashicorp/http-echo
          args: ["-text=v1 - Stable Version"]    # WHY: clearly identifies which version responded
          ports:
            - containerPort: 5678
---
apiVersion: v1
kind: Service
metadata:
  name: app-v1-svc
  namespace: canary-lab
spec:
  selector:
    app: myapp
    version: v1
  ports:
    - port: 80
      targetPort: 5678
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-v2
  namespace: canary-lab
spec:
  replicas: 1                                    # WHY: canary gets fewer replicas
  selector:
    matchLabels:
      app: myapp
      version: v2
  template:
    metadata:
      labels:
        app: myapp
        version: v2
    spec:
      containers:
        - name: app
          image: hashicorp/http-echo
          args: ["-text=v2 - Canary Version"]
          ports:
            - containerPort: 5678
---
apiVersion: v1
kind: Service
metadata:
  name: app-v2-svc
  namespace: canary-lab
spec:
  selector:
    app: myapp
    version: v2
  ports:
    - port: 80
      targetPort: 5678
```

```bash
kubectl apply -f canary-apps.yaml

kubectl wait --namespace canary-lab \
  --for=condition=Available deployment/app-v1 deployment/app-v2 \
  --timeout=120s
```

### Step 3 — Create Gateway and HTTPRoute with traffic splitting

```yaml
# Save as: canary-gateway.yaml
# WHY: Gateway defines the entry point; HTTPRoute splits traffic 90/10
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: canary-gateway
  namespace: canary-lab
spec:
  gatewayClassName: nginx            # WHY: references the NGINX Gateway Fabric GatewayClass
  listeners:
    - name: http
      protocol: HTTP
      port: 8080                     # WHY: using 8080 to avoid conflict with the Ingress controller on 80
      allowedRoutes:
        namespaces:
          from: Same
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: canary-route
  namespace: canary-lab
spec:
  parentRefs:
    - name: canary-gateway
      namespace: canary-lab
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: app-v1-svc           # WHY: stable version gets 90% of traffic
          port: 80
          weight: 90
        - name: app-v2-svc           # WHY: canary version gets 10% of traffic
          port: 80
          weight: 10
```

```bash
kubectl apply -f canary-gateway.yaml
```

```bash
# WHY: Verify Gateway is programmed
# EXPECTED OUTPUT:
# NAME             CLASS   ADDRESS   PROGRAMMED   AGE
# canary-gateway   nginx   ...       True         30s

kubectl get gateway -n canary-lab
kubectl describe gateway canary-gateway -n canary-lab
```

```bash
# WHY: Verify HTTPRoute is attached
# EXPECTED OUTPUT shows the route with backend weights

kubectl get httproute -n canary-lab
kubectl describe httproute canary-route -n canary-lab
```

### Step 4 — Test the traffic split

```bash
# WHY: Send 20 requests and count how many go to v1 vs v2
# EXPECTED OUTPUT: approximately 18 v1 responses and 2 v2 responses (90/10 split)

# Get the Gateway's service port
GW_PORT=$(kubectl get svc -n canary-lab -l app.kubernetes.io/name=nginx-gateway-fabric -o jsonpath='{.items[0].spec.ports[0].nodePort}' 2>/dev/null || echo "8080")

# If running in kind, port-forward the gateway
kubectl port-forward -n canary-lab svc/canary-gateway-nginx-gateway-fabric 9090:8080 &
PF_PID=$!
sleep 2

echo "Sending 20 requests..."
for i in $(seq 1 20); do
  curl -s http://localhost:9090/ 2>/dev/null
done | sort | uniq -c | sort -rn

# Expected approximate output:
# 18 v1 - Stable Version
#  2 v2 - Canary Version

# Stop port-forward
kill $PF_PID 2>/dev/null
```

```bash
# WHY: Shift traffic to 50/50 and test again
kubectl patch httproute canary-route -n canary-lab --type=json \
  -p='[
    {"op":"replace","path":"/spec/rules/0/backendRefs/0/weight","value":50},
    {"op":"replace","path":"/spec/rules/0/backendRefs/1/weight","value":50}
  ]'

echo "Updated to 50/50. Sending 20 requests..."

kubectl port-forward -n canary-lab svc/canary-gateway-nginx-gateway-fabric 9090:8080 &
PF_PID=$!
sleep 2

for i in $(seq 1 20); do
  curl -s http://localhost:9090/ 2>/dev/null
done | sort | uniq -c | sort -rn

# Expected approximate output:
# 10 v1 - Stable Version
# 10 v2 - Canary Version

kill $PF_PID 2>/dev/null
```

```bash
# WHY: Complete rollout — 100% to v2
kubectl patch httproute canary-route -n canary-lab --type=json \
  -p='[
    {"op":"replace","path":"/spec/rules/0/backendRefs/0/weight","value":0},
    {"op":"replace","path":"/spec/rules/0/backendRefs/1/weight","value":100}
  ]'

echo "Updated to 0/100. Verifying all traffic goes to v2..."

kubectl port-forward -n canary-lab svc/canary-gateway-nginx-gateway-fabric 9090:8080 &
PF_PID=$!
sleep 2

for i in $(seq 1 5); do
  curl -s http://localhost:9090/ 2>/dev/null
done

# Expected output: all 5 responses show "v2 - Canary Version"

kill $PF_PID 2>/dev/null
```

---

## Cleanup

```bash
# WHY: Remove all lab resources in order

# Delete namespaces (deletes all resources within them)
kubectl delete namespace netpol-lab canary-lab --ignore-not-found

# Delete Ingress resources
kubectl delete ingress path-based-ingress host-based-ingress tls-host-ingress --ignore-not-found

# Delete apps and services
kubectl delete deployment app1 app2 --ignore-not-found
kubectl delete service app1-svc app2-svc --ignore-not-found

# Delete TLS secret
kubectl delete secret local-dev-tls --ignore-not-found

# Uninstall NGINX Ingress Controller
helm uninstall ingress-nginx -n ingress-nginx
kubectl delete namespace ingress-nginx --ignore-not-found

# Uninstall NGINX Gateway Fabric
kubectl delete -f https://github.com/nginxinc/nginx-gateway-fabric/releases/download/v1.4.0/nginx-gateway.yaml 2>/dev/null || true
kubectl delete -f https://github.com/nginxinc/nginx-gateway-fabric/releases/download/v1.4.0/crds.yaml 2>/dev/null || true

# Delete Gateway API CRDs
kubectl delete -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.2.0/experimental-install.yaml 2>/dev/null || true

# Clean up /etc/hosts entries
sudo sed -i.bak '/local.dev/d' /etc/hosts

# Delete the kind cluster
kind delete cluster --name ingress-lab

# Clean up local files
rm -f kind-ingress-lab.yaml two-apps.yaml path-ingress.yaml host-ingress.yaml \
  tls-ingress.yaml tls-local.crt tls-local.key netpol-setup.yaml \
  default-deny.yaml allow-frontend.yaml canary-apps.yaml canary-gateway.yaml

echo "Cleanup complete. All resources, Helm releases, and the kind cluster have been removed."
```

```bash
# WHY: Verify cleanup
# EXPECTED OUTPUT: "ingress-lab" should NOT appear
kind get clusters

# EXPECTED OUTPUT: no "local.dev" entries
grep "local.dev" /etc/hosts || echo "hosts file is clean"
```
