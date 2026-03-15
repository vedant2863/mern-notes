# File 31: Lab — Security Hardening

**Topic:** Hands-on exercises for Encryption at Rest, Sealed Secrets, OPA Gatekeeper policy enforcement, and Kubescape security scanning

**WHY THIS MATTERS:**
Security is not theoretical — it requires hands-on practice. This lab walks you through the most critical security hardening tasks: encrypting secrets in etcd, managing secrets safely with Sealed Secrets, enforcing organizational policies with Gatekeeper, and scanning your cluster for vulnerabilities with Kubescape. These are the exact tasks you will perform when hardening a production cluster.

---

## Prerequisites

| Tool | Purpose | Install Command | Verify Command |
|------|---------|----------------|----------------|
| kind | Local Kubernetes cluster | `brew install kind` | `kind --version` |
| kubectl | Kubernetes CLI | `brew install kubectl` | `kubectl version --client` |
| docker | Container runtime for kind | `brew install --cask docker` | `docker --version` |
| helm | Kubernetes package manager | `brew install helm` | `helm version` |
| kubeseal | Sealed Secrets CLI | `brew install kubeseal` | `kubeseal --version` |
| kubescape | Kubernetes security scanner | `brew install kubescape` | `kubescape version` |

### Cluster Setup

Create a kind cluster with extra configuration for encryption at rest:

```bash
# SYNTAX: kind create cluster --name <name> --config <file>

cat <<'EOF' > /tmp/kind-security-lab.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: security-lab
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: ClusterConfiguration
    apiServer:
      extraArgs:
        authorization-mode: "Node,RBAC"
  # WHY: Mount a directory for the encryption config
  extraMounts:
  - hostPath: /tmp/encryption
    containerPath: /etc/kubernetes/encryption
    readOnly: false
EOF

# Create the directory for encryption config on the host
mkdir -p /tmp/encryption

kind create cluster --config /tmp/kind-security-lab.yaml

# EXPECTED OUTPUT:
# Creating cluster "security-lab" ...
#  ✓ Ensuring node image (kindest/node:v1.30.0) 🖼
#  ✓ Preparing nodes 📦
#  ✓ Writing configuration 📜
#  ✓ Starting control-plane 🕹️
#  ✓ Installing CNI 🔌
#  ✓ Installing StorageClass 💾
# Set kubectl context to "kind-security-lab"

# Verify the cluster is running
kubectl cluster-info --context kind-security-lab

# EXPECTED OUTPUT:
# Kubernetes control plane is running at https://127.0.0.1:XXXXX
# CoreDNS is running at https://127.0.0.1:XXXXX/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy

# Create namespaces for exercises
kubectl create namespace production
kubectl create namespace staging

# EXPECTED OUTPUT:
# namespace/production created
# namespace/staging created
```

---

## Exercise 1: Configure Encryption at Rest for Secrets

**Objective:** Configure the Kubernetes API server to encrypt secrets before storing them in etcd using AES-CBC encryption.

### Step 1 — Generate an Encryption Key

```bash
# Generate a 32-byte random key and base64-encode it
ENCRYPTION_KEY=$(head -c 32 /dev/urandom | base64)
echo "Generated encryption key: $ENCRYPTION_KEY"

# EXPECTED OUTPUT:
# Generated encryption key: aGVsbG8td29ybGQtdGhpcy1pcy1hLWtleQ==
# (Your key will be different — save it!)
```

### Step 2 — Create the EncryptionConfiguration File

```bash
# Create the encryption configuration
cat <<EOF > /tmp/encryption/encryption-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources:
  - secrets                              # WHY: Encrypt secrets resource type
  providers:
  - aescbc:                              # WHY: AES-CBC is a strong, well-tested encryption algorithm
      keys:
      - name: key1                       # WHY: Key identifier for rotation tracking
        secret: ${ENCRYPTION_KEY}        # WHY: The actual encryption key
  - identity: {}                         # WHY: Fallback for reading old unencrypted secrets
                                          #       Must be listed to read pre-existing secrets
EOF

# Verify the file was created correctly
cat /tmp/encryption/encryption-config.yaml

# EXPECTED OUTPUT:
# apiVersion: apiserver.config.k8s.io/v1
# kind: EncryptionConfiguration
# resources:
# - resources:
#   - secrets
#   providers:
#   - aescbc:
#       keys:
#       - name: key1
#         secret: <your-base64-key>
#   - identity: {}
```

### Step 3 — Configure the API Server to Use Encryption

```bash
# Copy the encryption config into the kind node
docker cp /tmp/encryption/encryption-config.yaml security-lab-control-plane:/etc/kubernetes/encryption/encryption-config.yaml

# EXPECTED OUTPUT:
# Successfully copied 2.05kB to security-lab-control-plane:/etc/kubernetes/encryption/encryption-config.yaml

# Verify the file is inside the node
docker exec security-lab-control-plane cat /etc/kubernetes/encryption/encryption-config.yaml

# EXPECTED OUTPUT:
# (same content as above)

# Modify the API server manifest to include the encryption flag
# First, back up the original manifest
docker exec security-lab-control-plane cp /etc/kubernetes/manifests/kube-apiserver.yaml /etc/kubernetes/kube-apiserver.yaml.backup

# Add the encryption-provider-config flag to the API server
docker exec security-lab-control-plane sh -c '
  # Read the current manifest
  MANIFEST=/etc/kubernetes/manifests/kube-apiserver.yaml

  # Check if encryption flag already exists
  if grep -q "encryption-provider-config" $MANIFEST; then
    echo "Encryption flag already exists"
  else
    # Add the flag after the existing command arguments
    sed -i "/- --tls-private-key-file/a\\    - --encryption-provider-config=/etc/kubernetes/encryption/encryption-config.yaml" $MANIFEST

    # Add the volume mount
    sed -i "/name: etc-kubernetes/a\\    - name: encryption-config\\n      mountPath: /etc/kubernetes/encryption\\n      readOnly: true" $MANIFEST

    # Add the volume
    sed -i "/path: \/etc\/kubernetes$/a\\    - name: encryption-config\\n      hostPath:\\n        path: /etc/kubernetes/encryption\\n        type: DirectoryOrCreate" $MANIFEST

    echo "Encryption config added to API server manifest"
  fi
'

# EXPECTED OUTPUT:
# Encryption config added to API server manifest

# Wait for the API server to restart (it auto-restarts when the manifest changes)
echo "Waiting for API server to restart..."
sleep 30

# Verify the API server is back up
kubectl get nodes

# EXPECTED OUTPUT:
# NAME                         STATUS   ROLES           AGE   VERSION
# security-lab-control-plane   Ready    control-plane   5m    v1.30.0

# If the API server is not responding, wait a bit longer
# kubectl get nodes --request-timeout=60s
```

### Step 4 — Create a Secret and Verify It Is Encrypted

```bash
# Create a test secret
kubectl create secret generic test-encryption-secret \
  --from-literal=username=admin \
  --from-literal=password=TopSecretPassword123 \
  -n production

# EXPECTED OUTPUT:
# secret/test-encryption-secret created

# Verify the secret is readable through the API (decrypted automatically)
kubectl get secret test-encryption-secret -n production -o jsonpath='{.data.password}' | base64 --decode

# EXPECTED OUTPUT:
# TopSecretPassword123

# Now check the raw data in etcd — it should be encrypted
docker exec security-lab-control-plane sh -c '
  ETCDCTL_API=3 etcdctl \
    --endpoints=https://127.0.0.1:2379 \
    --cacert=/etc/kubernetes/pki/etcd/ca.crt \
    --cert=/etc/kubernetes/pki/etcd/server.crt \
    --key=/etc/kubernetes/pki/etcd/server.key \
    get /registry/secrets/production/test-encryption-secret | hexdump -C | head -20
'

# EXPECTED OUTPUT (encrypted):
# 00000000  2f 72 65 67 69 73 74 72  79 2f 73 65 63 72 65 74  |/registry/secret|
# 00000010  73 2f 70 72 6f 64 75 63  74 69 6f 6e 2f 74 65 73  |s/production/tes|
# 00000020  74 2d 65 6e 63 72 79 70  74 69 6f 6e 2d 73 65 63  |t-encryption-sec|
# 00000030  72 65 74 0a 6b 38 73 3a  65 6e 63 3a 61 65 73 63  |ret.k8s:enc:aesc|
# 00000040  62 63 3a 76 31 3a 6b 65  79 31 3a ...              |bc:v1:key1:.....|
# WHY: The "k8s:enc:aescbc:v1:key1:" prefix proves the data is encrypted with AES-CBC
# If it showed readable base64 or plaintext, encryption is NOT working
```

### Step 5 — Re-encrypt Existing Secrets

```bash
# Re-encrypt all existing secrets with the new encryption key
kubectl get secrets --all-namespaces -o json | kubectl replace -f -

# EXPECTED OUTPUT:
# secret/test-encryption-secret replaced
# secret/default-token-xxxxx replaced
# ... (all secrets in all namespaces)

# Note: Some system secrets may show errors — this is normal
# The important thing is that YOUR secrets are re-encrypted
```

### Verification

```bash
# Verify encryption is working by checking the etcd prefix
docker exec security-lab-control-plane sh -c '
  ETCDCTL_API=3 etcdctl \
    --endpoints=https://127.0.0.1:2379 \
    --cacert=/etc/kubernetes/pki/etcd/ca.crt \
    --cert=/etc/kubernetes/pki/etcd/server.crt \
    --key=/etc/kubernetes/pki/etcd/server.key \
    get /registry/secrets/production/test-encryption-secret --print-value-only | head -c 50
'

# EXPECTED OUTPUT:
# k8s:enc:aescbc:v1:key1:...
# WHY: The "k8s:enc:aescbc:v1:key1:" prefix confirms AES-CBC encryption is active

# Verify the secret is still readable through kubectl (proves decryption works)
kubectl get secret test-encryption-secret -n production -o jsonpath='{.data.username}' | base64 --decode
echo ""

# EXPECTED OUTPUT:
# admin
```

---

## Exercise 2: Install Sealed Secrets and Create a SealedSecret

**Objective:** Install the Sealed Secrets controller, create a SealedSecret from the CLI, verify that only the controller can decrypt it, and confirm it creates a regular Kubernetes Secret.

### Step 1 — Install the Sealed Secrets Controller

```bash
# Add the Sealed Secrets Helm repository
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets
helm repo update

# EXPECTED OUTPUT:
# "sealed-secrets" has been added to your repositories
# Hang tight while we grab the latest from your chart repositories...
# ...Successfully got an update from the "sealed-secrets" chart repository
# Update Complete. ⎈Happy Helming!⎈

# Install the controller
helm install sealed-secrets sealed-secrets/sealed-secrets \
  -n kube-system \
  --set fullnameOverride=sealed-secrets-controller

# EXPECTED OUTPUT:
# NAME: sealed-secrets
# NAMESPACE: kube-system
# STATUS: deployed
# REVISION: 1

# Wait for the controller to be ready
kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=sealed-secrets -n kube-system --timeout=120s

# EXPECTED OUTPUT:
# pod/sealed-secrets-controller-xxxxx condition met

# Verify the controller is running
kubectl get pods -n kube-system -l app.kubernetes.io/name=sealed-secrets

# EXPECTED OUTPUT:
# NAME                                         READY   STATUS    RESTARTS   AGE
# sealed-secrets-controller-xxxxxxxxxx-xxxxx   1/1     Running   0          30s
```

### Step 2 — Fetch the Controller's Public Key

```bash
# Fetch the public key certificate for offline sealing
kubeseal --fetch-cert \
  --controller-name=sealed-secrets-controller \
  --controller-namespace=kube-system \
  > /tmp/sealed-secrets-cert.pem

# Verify the certificate was fetched
cat /tmp/sealed-secrets-cert.pem | head -3

# EXPECTED OUTPUT:
# -----BEGIN CERTIFICATE-----
# MIIErjCCApagAwIBAgIRAJgXXXXXXXXXXXXXXX...
# ...
```

### Step 3 — Create a Regular Secret YAML (Do NOT Apply It)

```bash
# Create a plain-text secret YAML
cat <<'EOF' > /tmp/my-app-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: my-app-credentials
  namespace: production
type: Opaque
stringData:
  database-url: "postgresql://appuser:S3cur3P@ss!@db.internal:5432/mydb"
  api-key: "sk-live-abc123def456ghi789"
  jwt-secret: "super-secret-jwt-signing-key-2024"
EOF

echo "WARNING: This file contains plain-text secrets."
echo "It should NEVER be committed to Git."
echo "We will seal it in the next step."
```

### Step 4 — Seal the Secret

```bash
# Seal the secret using the controller's public key
kubeseal --format yaml \
  --controller-name=sealed-secrets-controller \
  --controller-namespace=kube-system \
  < /tmp/my-app-secret.yaml \
  > /tmp/my-app-sealed-secret.yaml

# View the sealed secret
cat /tmp/my-app-sealed-secret.yaml

# EXPECTED OUTPUT:
# apiVersion: bitnami.com/v1alpha1
# kind: SealedSecret
# metadata:
#   name: my-app-credentials
#   namespace: production
# spec:
#   encryptedData:
#     api-key: AgBy3i4OJSWK+PiT...        (long encrypted string)
#     database-url: AgCtr8SNSaMl...         (long encrypted string)
#     jwt-secret: AgDf2kLpQrSt...           (long encrypted string)
#   template:
#     metadata:
#       name: my-app-credentials
#       namespace: production
#     type: Opaque

# IMPORTANT: Delete the plain-text secret file immediately
rm /tmp/my-app-secret.yaml
echo "Plain-text secret file deleted."

# Verify the sealed version is safe — try to find any readable secrets
grep -i "password\|secret\|key" /tmp/my-app-sealed-secret.yaml

# EXPECTED OUTPUT:
#     api-key: AgBy3i4OJSWK+PiT...
#     jwt-secret: AgDf2kLpQrSt...
# WHY: The KEY NAMES are visible but the VALUES are encrypted. This is safe for Git.
```

### Step 5 — Apply the SealedSecret

```bash
# Apply the sealed secret — the controller will decrypt and create a regular Secret
kubectl apply -f /tmp/my-app-sealed-secret.yaml

# EXPECTED OUTPUT:
# sealedsecret.bitnami.com/my-app-credentials created

# Wait for the controller to process it
sleep 5

# Verify the controller created a regular Kubernetes Secret
kubectl get secret my-app-credentials -n production

# EXPECTED OUTPUT:
# NAME                  TYPE     DATA   AGE
# my-app-credentials    Opaque   3      10s

# Verify the secret contains the correct data
kubectl get secret my-app-credentials -n production -o jsonpath='{.data.api-key}' | base64 --decode

# EXPECTED OUTPUT:
# sk-live-abc123def456ghi789

kubectl get secret my-app-credentials -n production -o jsonpath='{.data.database-url}' | base64 --decode

# EXPECTED OUTPUT:
# postgresql://appuser:S3cur3P@ss!@db.internal:5432/mydb
```

### Step 6 — Verify Only the Controller Can Decrypt

```bash
# Try to "unseal" the secret without the controller — this should fail
# The sealed secret YAML is safe because it can only be decrypted by the controller's private key

# Check the SealedSecret custom resource
kubectl get sealedsecret my-app-credentials -n production -o yaml | head -20

# EXPECTED OUTPUT:
# apiVersion: bitnami.com/v1alpha1
# kind: SealedSecret
# metadata:
#   name: my-app-credentials
#   namespace: production
# spec:
#   encryptedData:
#     api-key: AgBy3i4OJSWK+PiT...
#     database-url: AgCtr8SNSaMl...
#     jwt-secret: AgDf2kLpQrSt...

# The private key is stored as a Secret in the controller's namespace
kubectl get secret -n kube-system -l sealedsecrets.bitnami.com/sealed-secrets-key

# EXPECTED OUTPUT:
# NAME                      TYPE                DATA   AGE
# sealed-secrets-keyxxxxx   kubernetes.io/tls   2      5m
# WHY: The private key is a TLS secret in kube-system — protect this namespace's RBAC carefully!
```

### Verification

```bash
# Complete verification flow
echo "=== Sealed Secret Verification ==="
echo ""

echo "1. SealedSecret exists:"
kubectl get sealedsecret my-app-credentials -n production -o name
# EXPECTED: sealedsecret.bitnami.com/my-app-credentials

echo ""
echo "2. Regular Secret was created by controller:"
kubectl get secret my-app-credentials -n production -o name
# EXPECTED: secret/my-app-credentials

echo ""
echo "3. Secret has correct number of keys:"
kubectl get secret my-app-credentials -n production -o json | jq '.data | keys'
# EXPECTED: ["api-key", "database-url", "jwt-secret"]

echo ""
echo "4. Sealed file is safe for Git (no plain-text values):"
grep -c "AgB\|AgC\|AgD" /tmp/my-app-sealed-secret.yaml
# EXPECTED: 3 (three encrypted values)
```

---

## Exercise 3: Install Gatekeeper and Create a Policy Requiring Resource Limits

**Objective:** Install OPA Gatekeeper, create a ConstraintTemplate and Constraint that require resource limits on all pods, and test enforcement.

### Step 1 — Install OPA Gatekeeper

```bash
# Install Gatekeeper using the official manifests
kubectl apply -f https://raw.githubusercontent.com/open-policy-agent/gatekeeper/v3.16.0/deploy/gatekeeper.yaml

# EXPECTED OUTPUT:
# namespace/gatekeeper-system created
# ...
# deployment.apps/gatekeeper-audit created
# deployment.apps/gatekeeper-controller-manager created

# Wait for Gatekeeper to be ready
kubectl wait --for=condition=Ready pod -l control-plane=controller-manager -n gatekeeper-system --timeout=120s

# EXPECTED OUTPUT:
# pod/gatekeeper-controller-manager-xxxxx condition met

# Verify all Gatekeeper pods are running
kubectl get pods -n gatekeeper-system

# EXPECTED OUTPUT:
# NAME                                             READY   STATUS    RESTARTS   AGE
# gatekeeper-audit-xxxxxxxxxx-xxxxx                1/1     Running   0          30s
# gatekeeper-controller-manager-xxxxxxxxxx-xxxxx   1/1     Running   0          30s
# gatekeeper-controller-manager-xxxxxxxxxx-yyyyy   1/1     Running   0          30s
# gatekeeper-controller-manager-xxxxxxxxxx-zzzzz   1/1     Running   0          30s
```

### Step 2 — Create the ConstraintTemplate

```bash
# Create the ConstraintTemplate that defines the "require resource limits" policy
cat <<'EOF' > /tmp/ct-required-limits.yaml
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8srequiredresourcelimits
  annotations:
    description: "Requires all containers to specify CPU and memory resource limits"
spec:
  crd:
    spec:
      names:
        kind: K8sRequiredResourceLimits
      validation:
        openAPIV3Schema:
          type: object
          properties:
            message:
              type: string
              description: "Custom violation message"
  targets:
  - target: admission.k8s.gatekeeper.sh
    rego: |
      package k8srequiredresourcelimits

      # WHY: Check each container for CPU limits
      violation[{"msg": msg}] {
        container := input.review.object.spec.containers[_]
        not container.resources.limits.cpu
        msg := sprintf("Container '%v' in pod '%v' must have a CPU limit defined",
          [container.name, input.review.object.metadata.name])
      }

      # WHY: Check each container for memory limits
      violation[{"msg": msg}] {
        container := input.review.object.spec.containers[_]
        not container.resources.limits.memory
        msg := sprintf("Container '%v' in pod '%v' must have a memory limit defined",
          [container.name, input.review.object.metadata.name])
      }

      # WHY: Check each container for CPU requests
      violation[{"msg": msg}] {
        container := input.review.object.spec.containers[_]
        not container.resources.requests.cpu
        msg := sprintf("Container '%v' in pod '%v' must have a CPU request defined",
          [container.name, input.review.object.metadata.name])
      }

      # WHY: Check each container for memory requests
      violation[{"msg": msg}] {
        container := input.review.object.spec.containers[_]
        not container.resources.requests.memory
        msg := sprintf("Container '%v' in pod '%v' must have a memory request defined",
          [container.name, input.review.object.metadata.name])
      }
EOF

kubectl apply -f /tmp/ct-required-limits.yaml

# EXPECTED OUTPUT:
# constrainttemplate.templates.gatekeeper.sh/k8srequiredresourcelimits created

# Wait for the CRD to be created
sleep 10
kubectl get crd | grep k8srequiredresourcelimits

# EXPECTED OUTPUT:
# k8srequiredresourcelimits.constraints.gatekeeper.sh   <date>   <date>
```

### Step 3 — Create the Constraint

```bash
# Create the Constraint that applies the template to production and staging
cat <<'EOF' > /tmp/constraint-required-limits.yaml
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredResourceLimits
metadata:
  name: pods-must-have-resource-limits
spec:
  enforcementAction: deny                   # WHY: Reject non-compliant pods
  match:
    kinds:
    - apiGroups: [""]
      kinds: ["Pod"]
    namespaces:
    - production                            # WHY: Enforce only in production and staging
    - staging
    excludedNamespaces:
    - kube-system                           # WHY: Never block system components
    - gatekeeper-system                     # WHY: Never block the policy engine itself
    - kube-public
EOF

kubectl apply -f /tmp/constraint-required-limits.yaml

# EXPECTED OUTPUT:
# k8srequiredresourcelimits.constraints.gatekeeper.sh/pods-must-have-resource-limits created

# Verify the constraint
kubectl get k8srequiredresourcelimits

# EXPECTED OUTPUT:
# NAME                             ENFORCEMENT-ACTION   TOTAL-VIOLATIONS
# pods-must-have-resource-limits   deny                 0
```

### Step 4 — Test Enforcement (Non-Compliant Pod)

```bash
# Try to create a pod WITHOUT resource limits in production
cat <<'EOF' > /tmp/no-limits-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: no-limits-pod
  namespace: production
spec:
  containers:
  - name: nginx
    image: nginx:1.25
    ports:
    - containerPort: 80
    # WHY: No resources block — this should be REJECTED
EOF

kubectl apply -f /tmp/no-limits-pod.yaml

# EXPECTED OUTPUT:
# Error from server (Forbidden): error when creating "/tmp/no-limits-pod.yaml":
# admission webhook "validation.gatekeeper.sh" denied the request:
# [pods-must-have-resource-limits] Container 'nginx' in pod 'no-limits-pod' must have a CPU limit defined
# [pods-must-have-resource-limits] Container 'nginx' in pod 'no-limits-pod' must have a memory limit defined
# [pods-must-have-resource-limits] Container 'nginx' in pod 'no-limits-pod' must have a CPU request defined
# [pods-must-have-resource-limits] Container 'nginx' in pod 'no-limits-pod' must have a memory request defined

# Verify the pod was NOT created
kubectl get pod no-limits-pod -n production 2>&1

# EXPECTED OUTPUT:
# Error from server (NotFound): pods "no-limits-pod" not found
```

### Step 5 — Test Enforcement (Compliant Pod)

```bash
# Create a pod WITH resource limits
cat <<'EOF' > /tmp/with-limits-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: compliant-pod
  namespace: production
spec:
  containers:
  - name: nginx
    image: nginx:1.25
    ports:
    - containerPort: 80
    resources:                           # WHY: Resource limits are now defined
      requests:
        cpu: 100m                        # WHY: Request 100 millicores of CPU
        memory: 128Mi                    # WHY: Request 128 MiB of memory
      limits:
        cpu: 500m                        # WHY: Limit to 500 millicores
        memory: 256Mi                    # WHY: Limit to 256 MiB
EOF

kubectl apply -f /tmp/with-limits-pod.yaml

# EXPECTED OUTPUT:
# pod/compliant-pod created

# Verify the pod is running
kubectl wait --for=condition=Ready pod/compliant-pod -n production --timeout=60s

# EXPECTED OUTPUT:
# pod/compliant-pod condition met

kubectl get pod compliant-pod -n production

# EXPECTED OUTPUT:
# NAME            READY   STATUS    RESTARTS   AGE
# compliant-pod   1/1     Running   0          10s
```

### Step 6 — Verify Non-Enforcement in Non-Targeted Namespaces

```bash
# Create a pod WITHOUT limits in the default namespace (not in the constraint's match)
kubectl run test-default --image=nginx:1.25 -n default

# EXPECTED OUTPUT:
# pod/test-default created
# WHY: The default namespace is not in the constraint's namespaces list,
#       so pods without limits are allowed there

# Clean up
kubectl delete pod test-default -n default

# EXPECTED OUTPUT:
# pod "test-default" deleted
```

### Verification

```bash
# Check constraint status — should show 0 violations (we only created compliant resources)
kubectl get k8srequiredresourcelimits pods-must-have-resource-limits -o yaml | grep -A 5 "status:"

# EXPECTED OUTPUT:
# status:
#   auditTimestamp: "2024-..."
#   totalViolations: 0
#   violations: []

# Test one more non-compliant pod to double-check enforcement
kubectl run fail-test --image=busybox --command -- sleep 3600 -n staging

# EXPECTED OUTPUT:
# Error from server (Forbidden): admission webhook "validation.gatekeeper.sh" denied the request:
# [pods-must-have-resource-limits] Container 'fail-test' in pod 'fail-test' must have a CPU limit defined
# ...
```

---

## Exercise 4: Run Kubescape Scan and Fix Findings

**Objective:** Run a comprehensive security scan with Kubescape, identify the top 5 findings, fix them, and rescan to verify improvements.

### Step 1 — Run Initial Kubescape Scan

```bash
# SYNTAX: kubescape scan --verbose
# Run a comprehensive scan against the NSA/CISA framework

kubescape scan framework nsa --verbose

# EXPECTED OUTPUT (abbreviated):
# ✅ Initialized scanner
# ✅ Loaded policies
# ✅ Loaded exceptions
# ✅ Loaded account configurations
#
# ================================
# Framework: NSA
# ================================
#
# ┌──────────┬──────────────────────────────────────────────┬────────────┬───────────┐
# │ SEVERITY │ CONTROL NAME                                 │ FAILED     │ ALL       │
# ├──────────┼──────────────────────────────────────────────┼────────────┼───────────┤
# │ Critical │ Disable anonymous access to Kubelet          │ 0          │ 1         │
# │ High     │ Resource limits                              │ 5          │ 15        │
# │ High     │ Non-root containers                          │ 8          │ 15        │
# │ High     │ Immutable container filesystem               │ 10         │ 15        │
# │ High     │ Configured liveness probe                    │ 7          │ 15        │
# │ Medium   │ Ingress and Egress blocked                   │ 3          │ 5         │
# │ Medium   │ Automatic mapping of SA                      │ 12         │ 15        │
# │ Medium   │ Linux hardening                              │ 9          │ 15        │
# │ Low      │ Label usage for resources                    │ 4          │ 15        │
# └──────────┴──────────────────────────────────────────────┴────────────┴───────────┘
#
# Overall compliance score: 42%

# Save detailed results to a file
kubescape scan framework nsa --format json --output /tmp/kubescape-initial-scan.json

# EXPECTED OUTPUT:
# Results saved to /tmp/kubescape-initial-scan.json
```

### Step 2 — Identify Top 5 Findings

```bash
# Run a focused scan to get the most critical issues
kubescape scan framework nsa --severity-threshold high

# The top 5 findings to fix are typically:
# 1. Resource limits not set
# 2. Containers running as root
# 3. Mutable container filesystems
# 4. Automatic ServiceAccount token mounting
# 5. Missing seccomp profile

# Get details on a specific control
kubescape scan control "C-0009" --verbose

# EXPECTED OUTPUT:
# Control: C-0009 - Resource limits
# Description: CPU and memory limits should be set on every container
# Severity: High
# Failed resources:
# - Namespace: production, Kind: Pod, Name: compliant-pod  (may pass if limits set)
# - Namespace: kube-system, Kind: Pod, Name: coredns-xxx
# ...
```

### Step 3 — Fix the Findings

```bash
# Fix 1: Create a hardened deployment in production that passes all checks
cat <<'EOF' > /tmp/hardened-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hardened-web
  namespace: production
  labels:
    app: hardened-web                      # WHY: Fix - Label usage (finding 5)
    team: platform
    environment: production
spec:
  replicas: 2
  selector:
    matchLabels:
      app: hardened-web
  template:
    metadata:
      labels:
        app: hardened-web
        team: platform
    spec:
      automountServiceAccountToken: false  # WHY: Fix - Automatic SA mapping (finding 4)
      securityContext:
        runAsNonRoot: true                 # WHY: Fix - Non-root containers (finding 2)
        runAsUser: 65534
        seccompProfile:
          type: RuntimeDefault            # WHY: Fix - Linux hardening / seccomp (finding 5)
      containers:
      - name: web
        image: nginx:1.25-alpine
        ports:
        - containerPort: 8080
        securityContext:
          allowPrivilegeEscalation: false  # WHY: Fix - Privilege escalation
          readOnlyRootFilesystem: true     # WHY: Fix - Immutable filesystem (finding 3)
          capabilities:
            drop:
            - ALL                          # WHY: Fix - Linux hardening
        resources:
          requests:
            cpu: 100m                      # WHY: Fix - Resource limits (finding 1)
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 256Mi
        livenessProbe:                     # WHY: Fix - Configured liveness probe
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 15
        readinessProbe:                    # WHY: Best practice - readiness probe
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
        volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: cache
          mountPath: /var/cache/nginx
        - name: run
          mountPath: /var/run
      volumes:
      - name: tmp
        emptyDir: {}
      - name: cache
        emptyDir: {}
      - name: run
        emptyDir: {}
EOF

kubectl apply -f /tmp/hardened-deployment.yaml

# EXPECTED OUTPUT:
# deployment.apps/hardened-web created

# Wait for deployment to be ready
kubectl wait --for=condition=Available deployment/hardened-web -n production --timeout=120s

# EXPECTED OUTPUT:
# deployment.apps/hardened-web condition met

# Fix 2: Add a default-deny NetworkPolicy
cat <<'EOF' > /tmp/deny-all-networkpolicy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: production
spec:
  podSelector: {}                          # WHY: Apply to all pods in the namespace
  policyTypes:
  - Ingress                                # WHY: Fix - Block all incoming traffic by default
  - Egress                                 # WHY: Fix - Block all outgoing traffic by default
EOF

kubectl apply -f /tmp/deny-all-networkpolicy.yaml

# EXPECTED OUTPUT:
# networkpolicy.networking.k8s.io/default-deny-all created

# Fix 3: Add a NetworkPolicy that allows necessary traffic
cat <<'EOF' > /tmp/allow-web-networkpolicy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-web-traffic
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: hardened-web
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from: []                               # WHY: Allow ingress from anywhere (it is a web server)
    ports:
    - port: 8080
      protocol: TCP
  egress:
  - to: []                                 # WHY: Allow DNS resolution
    ports:
    - port: 53
      protocol: UDP
    - port: 53
      protocol: TCP
EOF

kubectl apply -f /tmp/allow-web-networkpolicy.yaml

# EXPECTED OUTPUT:
# networkpolicy.networking.k8s.io/allow-web-traffic created

# Fix 4: Disable automount on the default ServiceAccount
kubectl patch serviceaccount default -n production -p '{"automountServiceAccountToken": false}'

# EXPECTED OUTPUT:
# serviceaccount/default patched
```

### Step 4 — Rescan and Verify Improvements

```bash
# Run the scan again focusing on the production namespace
kubescape scan framework nsa --include-namespaces production --verbose

# EXPECTED OUTPUT (improved):
# ================================
# Framework: NSA
# ================================
#
# ┌──────────┬──────────────────────────────────────────────┬────────────┬───────────┐
# │ SEVERITY │ CONTROL NAME                                 │ FAILED     │ ALL       │
# ├──────────┼──────────────────────────────────────────────┼────────────┼───────────┤
# │ High     │ Resource limits                              │ 0          │ 3         │
# │ High     │ Non-root containers                          │ 0          │ 3         │
# │ High     │ Immutable container filesystem               │ 0          │ 3         │
# │ High     │ Configured liveness probe                    │ 0          │ 3         │
# │ Medium   │ Ingress and Egress blocked                   │ 0          │ 3         │
# │ Medium   │ Automatic mapping of SA                      │ 0          │ 3         │
# │ Medium   │ Linux hardening                              │ 0          │ 3         │
# └──────────┴──────────────────────────────────────────────┴────────────┴───────────┘
#
# Overall compliance score: 95%+

# Compare with initial scan
echo "Initial scan: saved to /tmp/kubescape-initial-scan.json"
echo "The hardened deployment addresses all top 5 findings:"
echo "  1. Resource limits       - CPU/memory requests and limits set"
echo "  2. Non-root containers   - runAsNonRoot: true, runAsUser: 65534"
echo "  3. Immutable filesystem  - readOnlyRootFilesystem: true"
echo "  4. SA token mounting     - automountServiceAccountToken: false"
echo "  5. Linux hardening       - seccomp RuntimeDefault, capabilities dropped"
```

### Step 5 — Generate a Compliance Report

```bash
# Generate a detailed HTML report (optional)
kubescape scan framework nsa --include-namespaces production --format pretty-printer

# Generate a SARIF report for CI/CD integration
kubescape scan framework nsa --include-namespaces production --format sarif --output /tmp/kubescape-report.sarif

# EXPECTED OUTPUT:
# Results saved to /tmp/kubescape-report.sarif

# Summary of what we fixed:
echo ""
echo "=== Security Hardening Summary ==="
echo ""
echo "Finding 1 - Resource Limits:           FIXED (requests + limits on all containers)"
echo "Finding 2 - Non-root Containers:       FIXED (runAsNonRoot + runAsUser)"
echo "Finding 3 - Immutable Filesystem:      FIXED (readOnlyRootFilesystem)"
echo "Finding 4 - SA Token Auto-mount:       FIXED (automountServiceAccountToken: false)"
echo "Finding 5 - Network Policies:          FIXED (default-deny + allow-web)"
echo "Bonus     - Seccomp Profile:           FIXED (RuntimeDefault)"
echo "Bonus     - Capabilities:              FIXED (drop ALL)"
echo "Bonus     - Liveness/Readiness Probes: FIXED (HTTP probes configured)"
```

### Verification

```bash
# Final verification — confirm all hardening is in place
echo "=== Final Verification ==="
echo ""

echo "1. Deployment is running:"
kubectl get deployment hardened-web -n production
# EXPECTED: 2/2 READY

echo ""
echo "2. Pods are running as non-root:"
kubectl get pods -n production -l app=hardened-web -o jsonpath='{range .items[*]}{.metadata.name}: runAsNonRoot={.spec.securityContext.runAsNonRoot}{"\n"}{end}'
# EXPECTED: hardened-web-xxx: runAsNonRoot=true

echo ""
echo "3. Network policies are in place:"
kubectl get networkpolicy -n production
# EXPECTED: default-deny-all and allow-web-traffic

echo ""
echo "4. SA automount is disabled:"
kubectl get sa default -n production -o jsonpath='{.automountServiceAccountToken}'
echo ""
# EXPECTED: false

echo ""
echo "5. Resource limits are set:"
kubectl get pods -n production -l app=hardened-web -o jsonpath='{range .items[*].spec.containers[*]}Container: {.name}, CPU limit: {.resources.limits.cpu}, Memory limit: {.resources.limits.memory}{"\n"}{end}'
# EXPECTED: Container: web, CPU limit: 500m, Memory limit: 256Mi
```

---

## Cleanup

```bash
# Delete all resources created in this lab

# Delete namespaces (also deletes all resources within them)
kubectl delete namespace production
kubectl delete namespace staging

# EXPECTED OUTPUT:
# namespace "production" deleted
# namespace "staging" deleted

# Remove Gatekeeper
kubectl delete -f https://raw.githubusercontent.com/open-policy-agent/gatekeeper/v3.16.0/deploy/gatekeeper.yaml

# EXPECTED OUTPUT:
# namespace "gatekeeper-system" deleted
# ...
# deployment.apps "gatekeeper-controller-manager" deleted

# Remove Sealed Secrets
helm uninstall sealed-secrets -n kube-system

# EXPECTED OUTPUT:
# release "sealed-secrets" uninstalled

# Remove Gatekeeper constraint and template
kubectl delete k8srequiredresourcelimits pods-must-have-resource-limits 2>/dev/null
kubectl delete constrainttemplate k8srequiredresourcelimits 2>/dev/null

# Delete the kind cluster
kind delete cluster --name security-lab

# EXPECTED OUTPUT:
# Deleting cluster "security-lab" ...
# Deleted nodes: ["security-lab-control-plane"]

# Clean up temp files
rm -f /tmp/kind-security-lab.yaml
rm -f /tmp/encryption/encryption-config.yaml
rm -rf /tmp/encryption
rm -f /tmp/my-app-sealed-secret.yaml
rm -f /tmp/sealed-secrets-cert.pem
rm -f /tmp/ct-required-limits.yaml
rm -f /tmp/constraint-required-limits.yaml
rm -f /tmp/no-limits-pod.yaml
rm -f /tmp/with-limits-pod.yaml
rm -f /tmp/hardened-deployment.yaml
rm -f /tmp/deny-all-networkpolicy.yaml
rm -f /tmp/allow-web-networkpolicy.yaml
rm -f /tmp/kubescape-initial-scan.json
rm -f /tmp/kubescape-report.sarif
```

**Cleanup Verification:**

```bash
# Confirm the cluster is deleted
kind get clusters

# EXPECTED OUTPUT:
# (no output — or list without "security-lab")

# Confirm temp files are cleaned
ls /tmp/encryption 2>&1

# EXPECTED OUTPUT:
# ls: /tmp/encryption: No such file or directory
```
