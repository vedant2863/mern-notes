# File 29: Secrets Management and Encryption

**Topic:** Kubernetes Secrets, Encryption at Rest, HashiCorp Vault Integration, Sealed Secrets, SOPS, and the Secrets Store CSI Driver

**WHY THIS MATTERS:**
Kubernetes Secrets are base64-encoded, not encrypted. Anyone with access to etcd or the right RBAC permissions can read every secret in your cluster — database passwords, API keys, TLS certificates. This is not a theoretical risk: real breaches have occurred because operators assumed Secrets were secure by default. Understanding encryption at rest, external secret managers, and sealed-secrets is essential for any production cluster.

---

## Story: The Haveli with Hidden Chambers

Imagine an old haveli (mansion) in Rajasthan — a grand family home that has been storing valuables for generations.

**Base64 = Paper in a Drawer.** The family keeps important documents in a desk drawer. The drawer is not locked — anyone who walks into the room can open it and read everything. Base64 encoding is like writing a note in a slightly different script — it looks different but anyone with two minutes can decode it. Kubernetes Secrets stored as base64 in etcd are exactly this: accessible to anyone who can access etcd.

**Encryption at Rest = Padlock on the Drawer.** The family installs a padlock on the drawer. Now, even if a thief breaks into the room, they cannot read the documents without the key. Kubernetes EncryptionConfiguration encrypts Secrets before writing them to etcd. Even if someone dumps the etcd database, the Secrets are unreadable without the encryption key.

**HashiCorp Vault = Bank Locker.** For the most valuable items — gold, property deeds, ancestral jewelry — the family does not keep them at home at all. They rent a bank locker. The bank has guards, cameras, time locks, audit trails, and insurance. HashiCorp Vault is the bank locker for your secrets — a dedicated, hardened, audited system designed specifically for secret management.

**Sealed Secrets = Sealed Envelope.** When a family member in another city needs to send a valuable document to the haveli, they put it in a tamper-evident sealed envelope that can only be opened by a specific person at the haveli. Sealed Secrets work the same way: you encrypt a secret using the controller's public key, and only the controller running inside the cluster can decrypt it. The sealed envelope (SealedSecret YAML) is safe to store in Git.

**SOPS = Encrypted Filing Cabinet with Multiple Keys.** The family has a filing cabinet where each drawer can be opened by a different key — one for the eldest son, one for the daughter, one for the accountant. SOPS (Secrets Operations) encrypts only the values in a file while leaving keys readable, and supports multiple key management systems (AWS KMS, GCP KMS, Azure Key Vault, PGP).

Understanding these layers is like understanding that you do not store gold in an unlocked drawer — you use the appropriate level of security for the value of what you are protecting.

---

## Example Block 1 — Kubernetes Secrets Fundamentals

### Section 1 — Base64 Is NOT Encryption

```bash
# Create a secret the imperative way
# SYNTAX: kubectl create secret generic <name> --from-literal=<key>=<value> -n <namespace>
kubectl create secret generic db-credentials \
  --from-literal=username=admin \
  --from-literal=password=SuperSecret123 \
  -n default

# EXPECTED OUTPUT:
# secret/db-credentials created

# View the secret — notice the data is base64-encoded
kubectl get secret db-credentials -o yaml

# EXPECTED OUTPUT:
# apiVersion: v1
# kind: Secret
# metadata:
#   name: db-credentials
#   namespace: default
# type: Opaque
# data:
#   password: U3VwZXJTZWNyZXQxMjM=
#   username: YWRtaW4=

# Decode the "encrypted" password — trivial!
echo "U3VwZXJTZWNyZXQxMjM=" | base64 --decode

# EXPECTED OUTPUT:
# SuperSecret123
```

**WHY:** This is the most important security lesson in Kubernetes: base64 is an encoding, not encryption. Anyone who can `kubectl get secret` can read your passwords. This is why RBAC on secrets is critical, and why encryption at rest is necessary.

### Section 2 — Secret Types

```yaml
# WHY: Opaque is the default type — arbitrary key-value pairs
apiVersion: v1
kind: Secret
metadata:
  name: app-secret
type: Opaque                     # WHY: Generic secret type for application credentials
data:
  api-key: bXktYXBpLWtleS0xMjM0NTY=    # WHY: base64-encoded value of "my-api-key-123456"
stringData:                       # WHY: stringData lets you specify plain text — Kubernetes encodes it automatically
  config.yaml: |                  # WHY: Useful for config files — no manual base64 encoding needed
    database:
      host: db.example.com
      port: 5432
```

```yaml
# WHY: TLS secret type — stores certificate and private key with validated fields
apiVersion: v1
kind: Secret
metadata:
  name: tls-cert
type: kubernetes.io/tls          # WHY: Kubernetes validates that tls.crt and tls.key are present
data:
  tls.crt: LS0tLS1CRUdJTi...    # WHY: base64-encoded PEM certificate
  tls.key: LS0tLS1CRUdJTi...    # WHY: base64-encoded PEM private key
```

```yaml
# WHY: Docker registry secret — for pulling images from private registries
apiVersion: v1
kind: Secret
metadata:
  name: registry-cred
type: kubernetes.io/dockerconfigjson    # WHY: Kubernetes knows how to use this for image pulls
data:
  .dockerconfigjson: eyJhdXRo...         # WHY: base64-encoded Docker config JSON
```

### Section 3 — Mounting Secrets in Pods

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secret-consumer
spec:
  containers:
  - name: app
    image: myapp:v1.0
    env:
    - name: DB_USERNAME
      valueFrom:
        secretKeyRef:
          name: db-credentials     # WHY: Reference the secret by name
          key: username            # WHY: Specific key within the secret
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: db-credentials
          key: password
    volumeMounts:
    - name: secret-volume
      mountPath: /etc/secrets      # WHY: Mount as files — more secure than env vars
      readOnly: true               # WHY: Application should never modify secrets
  volumes:
  - name: secret-volume
    secret:
      secretName: db-credentials
      defaultMode: 0400           # WHY: Owner read-only — most restrictive file permissions
      items:
      - key: password
        path: db-password         # WHY: Custom filename instead of using the key name
```

**WHY:** Volume-mounted secrets are preferred over environment variables for two reasons: (1) env vars appear in `docker inspect`, process listings, and crash dumps; (2) volume-mounted secrets are automatically updated when the Secret changes (with a brief delay), while env vars require a pod restart.

---

## Example Block 2 — Encryption at Rest

### Section 1 — How etcd Stores Secrets

```mermaid
sequenceDiagram
    participant User as kubectl
    participant API as API Server
    participant Enc as Encryption Layer
    participant etcd as etcd Storage

    Note over User,etcd: WITHOUT Encryption at Rest
    User->>API: kubectl create secret
    API->>etcd: Store base64 data directly
    Note over etcd: Secret stored as PLAIN base64<br/>Anyone with etcd access reads it

    Note over User,etcd: WITH Encryption at Rest
    User->>API: kubectl create secret
    API->>Enc: Encrypt with configured provider
    Enc->>Enc: AES-CBC / AES-GCM / KMS encrypt
    Enc->>etcd: Store encrypted ciphertext
    Note over etcd: Secret stored as encrypted blob<br/>etcd dump reveals nothing

    Note over User,etcd: Reading a Secret
    etcd->>Enc: Return encrypted blob
    Enc->>Enc: Decrypt with key
    Enc->>API: Return decrypted secret
    API->>User: Display base64-encoded data
```

**WHY:** Without encryption at rest, anyone who can access the etcd database (backup files, etcd API, disk snapshots) can read every secret in the cluster. Encryption at rest ensures that etcd stores only encrypted ciphertext.

### Section 2 — EncryptionConfiguration

```yaml
# WHY: This file tells the API server HOW to encrypt secrets before storing in etcd
# File: /etc/kubernetes/encryption-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources:
  - secrets                       # WHY: Encrypt secrets — can also add configmaps, etc.
  providers:
  - aescbc:                       # WHY: AES-CBC encryption — strong, widely supported
      keys:
      - name: key1                # WHY: Key identifier — used during rotation
        secret: c2VjcmV0LWtleS0xMjM0NTY3ODkwYWJjZGVm   # WHY: 32-byte base64-encoded key
                                                           # Generate: head -c 32 /dev/urandom | base64
  - identity: {}                  # WHY: Fallback — allows reading old unencrypted secrets
                                   #       Order matters: first provider is used for WRITING
                                   #       All providers are tried for READING
```

**WHY:** The order of providers matters critically. The **first** provider is used for writing new secrets. All providers are tried in order for reading. This allows key rotation: add a new key as the first provider, re-encrypt all secrets, then remove the old key.

### Section 3 — Encryption Providers Compared

| Provider | Encryption | Key Storage | Strength | Use Case |
|----------|-----------|-------------|----------|----------|
| `identity` | None (plain text) | N/A | None | Default; reading unencrypted data |
| `aescbc` | AES-256 CBC | Local config file | Strong | Self-managed clusters |
| `aesgcm` | AES-256 GCM | Local config file | Strongest (authenticated) | Self-managed; must rotate keys frequently |
| `kms` v1 | Envelope encryption | External KMS | Enterprise | AWS KMS, GCP KMS, Azure Key Vault |
| `kms` v2 | Envelope encryption | External KMS | Enterprise (recommended) | Preferred KMS integration |
| `secretbox` | XSalsa20+Poly1305 | Local config file | Strong (authenticated) | Modern alternative to aescbc |

**WHY:** `aesgcm` provides authenticated encryption (verifies data integrity), but the key must be rotated every 200,000 writes to prevent nonce reuse attacks. `aescbc` does not have this limitation. For production, `kms` v2 is recommended because the encryption key itself never leaves the KMS.

### Section 4 — Configuring the API Server

```bash
# Step 1: Generate an encryption key
ENCRYPTION_KEY=$(head -c 32 /dev/urandom | base64)
echo $ENCRYPTION_KEY

# EXPECTED OUTPUT:
# aGVsbG8td29ybGQtdGhpcy1pcy1hLWtleQ==   (your key will be different)

# Step 2: Create the encryption config file on the control plane node
# (The file must be accessible by the API server process)

# Step 3: Add the flag to the API server manifest
# Edit: /etc/kubernetes/manifests/kube-apiserver.yaml
# Add under spec.containers[0].command:
#   --encryption-provider-config=/etc/kubernetes/encryption-config.yaml

# Step 4: Mount the config file into the API server pod
# Add under spec.containers[0].volumeMounts:
#   - name: encryption-config
#     mountPath: /etc/kubernetes/encryption-config.yaml
#     readOnly: true
# Add under spec.volumes:
#   - name: encryption-config
#     hostPath:
#       path: /etc/kubernetes/encryption-config.yaml
#       type: File

# Step 5: Re-encrypt all existing secrets
# SYNTAX: kubectl get secrets --all-namespaces -o json | kubectl replace -f -
kubectl get secrets --all-namespaces -o json | kubectl replace -f -

# EXPECTED OUTPUT:
# secret/db-credentials replaced
# secret/default-token-xxxxx replaced
# ... (all secrets re-encrypted)

# Step 6: Verify encryption by checking etcd directly
# (Requires etcdctl access to the etcd pod)
kubectl -n kube-system exec etcd-control-plane -- etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  get /registry/secrets/default/db-credentials | hexdump -C | head -5

# EXPECTED OUTPUT (encrypted):
# 00000000  ... k8s:enc:aescbc:v1:key1: ...
# (The data is encrypted — you see the provider prefix followed by ciphertext)
```

---

## Example Block 3 — HashiCorp Vault Integration

### Section 1 — Vault Integration Patterns

```mermaid
sequenceDiagram
    participant Pod as Application Pod
    participant Init as Init Container
    participant Sidecar as Vault Agent<br/>Sidecar
    participant Vault as HashiCorp Vault
    participant K8s as Kubernetes API

    Note over Pod,K8s: Vault Agent Sidecar Injector Pattern

    Pod->>K8s: Pod created with<br/>vault annotations
    K8s->>K8s: Mutating webhook<br/>detects annotations
    K8s->>Init: Inject init container<br/>(vault-agent-init)
    K8s->>Sidecar: Inject sidecar container<br/>(vault-agent)

    Init->>Vault: Authenticate with<br/>Kubernetes SA token
    Vault->>K8s: Verify SA token<br/>via TokenReview API
    K8s->>Vault: Token is valid,<br/>SA=app-sa, ns=production
    Vault->>Vault: Check Vault policy<br/>for this role
    Vault->>Init: Return secrets<br/>(lease + data)
    Init->>Init: Write secrets to<br/>/vault/secrets/

    Note over Pod: Pod starts with<br/>secrets available

    loop Every TTL period
        Sidecar->>Vault: Renew lease or<br/>fetch updated secrets
        Vault->>Sidecar: Return refreshed secrets
        Sidecar->>Sidecar: Update files in<br/>/vault/secrets/
    end
```

**WHY:** The sidecar pattern is Vault's recommended approach for Kubernetes. The application never talks to Vault directly — the sidecar handles authentication, secret retrieval, lease renewal, and file updates. The application simply reads files from a shared volume.

### Section 2 — Vault Configuration for Kubernetes Auth

```bash
# Step 1: Enable Kubernetes auth method in Vault
vault auth enable kubernetes

# Step 2: Configure Vault to talk to the Kubernetes API
vault write auth/kubernetes/config \
  kubernetes_host="https://kubernetes.default.svc:443"

# Step 3: Create a Vault policy
vault policy write app-policy - <<'EOF'
# WHY: Grant read access to specific secret paths only
path "secret/data/production/db-credentials" {
  capabilities = ["read"]
}
path "secret/data/production/api-keys" {
  capabilities = ["read"]
}
# WHY: Deny access to everything else — least privilege
path "secret/*" {
  capabilities = ["deny"]
}
EOF

# Step 4: Create a Vault role tied to a Kubernetes ServiceAccount
vault write auth/kubernetes/role/app-role \
  bound_service_account_names=app-sa \
  bound_service_account_namespaces=production \
  policies=app-policy \
  ttl=1h

# EXPECTED OUTPUT:
# Success! Data written to: auth/kubernetes/role/app-role
```

### Section 3 — Pod with Vault Annotations

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: vault-app
  namespace: production
  annotations:
    vault.hashicorp.com/agent-inject: "true"              # WHY: Triggers the mutating webhook to inject Vault agent
    vault.hashicorp.com/role: "app-role"                  # WHY: Vault role to authenticate as
    vault.hashicorp.com/agent-inject-secret-db: "secret/data/production/db-credentials"
    # WHY: ^^ Tells Vault agent to fetch this secret and write it to /vault/secrets/db
    vault.hashicorp.com/agent-inject-template-db: |       # WHY: Custom template for the secret file format
      {{- with secret "secret/data/production/db-credentials" -}}
      export DB_HOST={{ .Data.data.host }}
      export DB_USER={{ .Data.data.username }}
      export DB_PASS={{ .Data.data.password }}
      {{- end }}
spec:
  serviceAccountName: app-sa                               # WHY: SA must match Vault role binding
  containers:
  - name: app
    image: myapp:v1.0
    command: ["sh", "-c", "source /vault/secrets/db && exec myapp"]
    # WHY: Source the secret file to set env vars, then run the app
```

**WHY:** Vault annotations make integration declarative. Developers do not need to know Vault APIs — they just add annotations to their pod specs. The Vault Agent Injector webhook handles everything.

---

## Example Block 4 — Sealed Secrets and SOPS

### Section 1 — Sealed Secrets Architecture

```mermaid
flowchart LR
    subgraph "Developer Workstation"
        A["Create Secret YAML<br/>(plain text)"] --> B["kubeseal CLI<br/>encrypts with<br/>controller public key"]
        B --> C["SealedSecret YAML<br/>(encrypted, safe for Git)"]
    end

    subgraph "Git Repository"
        C --> D["Stored in version control<br/>Anyone can read the YAML<br/>But values are encrypted"]
    end

    subgraph "Kubernetes Cluster"
        D --> E["SealedSecret Controller<br/>watches for SealedSecret CRDs"]
        E --> F["Decrypts using<br/>private key<br/>(stored in cluster only)"]
        F --> G["Creates regular<br/>Kubernetes Secret"]
        G --> H["Pod consumes Secret<br/>normally"]
    end

    style A fill:#e74c3c,color:#fff
    style C fill:#27ae60,color:#fff
    style D fill:#27ae60,color:#fff
    style F fill:#3498db,color:#fff
    style G fill:#f39c12,color:#fff
```

**WHY:** The key insight is that the private key never leaves the cluster. Even if your Git repository is compromised, the attacker cannot decrypt the secrets. The SealedSecret YAML is safe to commit, review, and share.

### Section 2 — Using Sealed Secrets

```bash
# Step 1: Install the sealed-secrets controller
# SYNTAX: helm install <release> <chart> -n <namespace>
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets
helm install sealed-secrets sealed-secrets/sealed-secrets \
  -n kube-system \
  --set fullnameOverride=sealed-secrets-controller

# EXPECTED OUTPUT:
# NAME: sealed-secrets
# NAMESPACE: kube-system
# STATUS: deployed

# Step 2: Fetch the controller's public key (for offline sealing)
kubeseal --fetch-cert \
  --controller-name=sealed-secrets-controller \
  --controller-namespace=kube-system \
  > /tmp/sealed-secrets-pub.pem

# Step 3: Create a regular secret YAML (do NOT apply it!)
cat <<'EOF' > /tmp/my-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: my-app-secret
  namespace: production
type: Opaque
stringData:
  database-url: "postgresql://admin:SuperSecret@db.example.com:5432/myapp"
  api-key: "sk-live-abcdef123456"
EOF

# Step 4: Seal the secret
# SYNTAX: kubeseal --format yaml < <input-secret> > <output-sealed-secret>
kubeseal --format yaml \
  --controller-name=sealed-secrets-controller \
  --controller-namespace=kube-system \
  < /tmp/my-secret.yaml \
  > /tmp/my-sealed-secret.yaml

# Step 5: View the sealed secret — values are encrypted
cat /tmp/my-sealed-secret.yaml

# EXPECTED OUTPUT:
# apiVersion: bitnami.com/v1alpha1
# kind: SealedSecret
# metadata:
#   name: my-app-secret
#   namespace: production
# spec:
#   encryptedData:
#     database-url: AgBy3i4OJSWK+PiTySYZZA9rO...  (long encrypted string)
#     api-key: AgCtr8SNSaMl2J7PJFR0vK...           (long encrypted string)
#   template:
#     metadata:
#       name: my-app-secret
#       namespace: production
#     type: Opaque

# Step 6: Apply the sealed secret — safe to commit to Git
kubectl apply -f /tmp/my-sealed-secret.yaml

# EXPECTED OUTPUT:
# sealedsecret.bitnami.com/my-app-secret created

# Step 7: Verify the controller created the regular Secret
kubectl get secret my-app-secret -n production

# EXPECTED OUTPUT:
# NAME            TYPE     DATA   AGE
# my-app-secret   Opaque   2      10s

# DELETE the plain-text secret file — it should never be committed
rm /tmp/my-secret.yaml
```

### Section 3 — SOPS (Secrets Operations)

```bash
# SOPS encrypts VALUES in a file while leaving KEYS readable
# This makes it easy to review diffs in Git — you see WHAT changed, just not the value

# Step 1: Install SOPS
# brew install sops

# Step 2: Configure SOPS to use a KMS key
cat <<'EOF' > .sops.yaml
creation_rules:
- path_regex: .*secrets.*\.yaml$
  encrypted_regex: ^(data|stringData)$     # WHY: Only encrypt the data/stringData fields
  age: age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p
  # WHY: age key — simpler than PGP for local development
  # For production, use: kms: arn:aws:kms:us-east-1:123456789:key/abc-def
EOF

# Step 3: Encrypt a secrets file
sops --encrypt secrets.yaml > secrets.enc.yaml

# Step 4: View the encrypted file — keys are readable, values are not
cat secrets.enc.yaml

# EXPECTED OUTPUT:
# apiVersion: v1
# kind: Secret
# metadata:
#   name: app-secret
# type: Opaque
# stringData:
#   database-url: ENC[AES256_GCM,data:abc123...,iv:...,tag:...]
#   api-key: ENC[AES256_GCM,data:def456...,iv:...,tag:...]
# sops:
#   kms: []
#   age:
#   - recipient: age1ql3z7...
#     enc: |
#       -----BEGIN AGE ENCRYPTED FILE-----
#       ...

# Step 5: Decrypt and apply
sops --decrypt secrets.enc.yaml | kubectl apply -f -

# EXPECTED OUTPUT:
# secret/app-secret created
```

**WHY:** SOPS is ideal for teams that want to store encrypted secrets in Git alongside their manifests. Unlike Sealed Secrets, SOPS is not Kubernetes-specific — it works with any YAML/JSON file and supports multiple KMS providers.

---

## Example Block 5 — Secrets Store CSI Driver

### Section 1 — How CSI Driver Works

The Secrets Store CSI Driver mounts secrets from external stores (Vault, AWS Secrets Manager, Azure Key Vault, GCP Secret Manager) directly as volumes in pods.

```yaml
# WHY: SecretProviderClass defines WHERE to get secrets and HOW to map them
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: vault-db-secrets
  namespace: production
spec:
  provider: vault                          # WHY: Using HashiCorp Vault as the backend
  parameters:
    roleName: app-role                     # WHY: Vault Kubernetes auth role
    vaultAddress: "https://vault.example.com:8200"
    objects: |
      - objectName: "db-username"          # WHY: Name of the mounted file
        secretPath: "secret/data/production/db"
        secretKey: "username"              # WHY: Specific key from the Vault secret
      - objectName: "db-password"
        secretPath: "secret/data/production/db"
        secretKey: "password"
  secretObjects:                           # WHY: Optional — also create a Kubernetes Secret from the data
  - secretName: synced-db-secret           # WHY: Name of the K8s Secret to create
    type: Opaque
    data:
    - objectName: db-username              # WHY: Maps from the CSI volume to the K8s Secret
      key: username
    - objectName: db-password
      key: password
```

```yaml
# WHY: Pod that uses the CSI driver to mount secrets
apiVersion: v1
kind: Pod
metadata:
  name: csi-app
  namespace: production
spec:
  serviceAccountName: app-sa
  containers:
  - name: app
    image: myapp:v1.0
    volumeMounts:
    - name: secrets-store
      mountPath: /mnt/secrets              # WHY: Secrets appear as files in this directory
      readOnly: true
    env:
    - name: DB_USERNAME
      valueFrom:
        secretKeyRef:
          name: synced-db-secret           # WHY: Can also use the synced K8s Secret as env var
          key: username
  volumes:
  - name: secrets-store
    csi:
      driver: secrets-store.csi.k8s.io    # WHY: The CSI driver handles the volume mount
      readOnly: true
      volumeAttributes:
        secretProviderClass: vault-db-secrets   # WHY: Reference the SecretProviderClass
```

### Section 2 — Comparing Secrets Approaches

```mermaid
flowchart TB
    subgraph "Approach Comparison"
        direction TB
        A["Native K8s Secrets<br/>━━━━━━━━━━━━━━━━<br/>Pros: Simple, built-in<br/>Cons: Base64 only,<br/>no rotation, no audit<br/>Best for: Dev/test"]

        B["Encryption at Rest<br/>━━━━━━━━━━━━━━━━<br/>Pros: Protects etcd,<br/>transparent to apps<br/>Cons: Key management,<br/>does not protect API access<br/>Best for: All clusters"]

        C["Sealed Secrets<br/>━━━━━━━━━━━━━━━━<br/>Pros: GitOps-friendly,<br/>safe in VCS<br/>Cons: Controller is SPOF,<br/>no dynamic secrets<br/>Best for: GitOps workflows"]

        D["SOPS<br/>━━━━━━━━━━━━━━━━<br/>Pros: Multi-provider,<br/>readable diffs<br/>Cons: Requires KMS access,<br/>manual workflow<br/>Best for: Multi-cloud"]

        E["Vault + Sidecar<br/>━━━━━━━━━━━━━━━━<br/>Pros: Dynamic secrets,<br/>rotation, audit, lease<br/>Cons: Complexity, Vault ops<br/>Best for: Production"]

        F["CSI Driver<br/>━━━━━━━━━━━━━━━━<br/>Pros: Native volume mount,<br/>multi-provider, sync to K8s<br/>Cons: Driver per provider<br/>Best for: Cloud-native"]
    end

    style A fill:#e74c3c,color:#fff
    style B fill:#f39c12,color:#fff
    style C fill:#27ae60,color:#fff
    style D fill:#3498db,color:#fff
    style E fill:#8e44ad,color:#fff
    style F fill:#1abc9c,color:#fff
```

**WHY:** There is no single "best" approach — each has trade-offs. Most production clusters use a combination: encryption at rest as a baseline, plus Vault or CSI driver for sensitive workloads, plus Sealed Secrets or SOPS for GitOps.

---

## Example Block 6 — Secret Rotation and Best Practices

### Section 1 — Encryption Key Rotation

```bash
# Step 1: Generate a new encryption key
NEW_KEY=$(head -c 32 /dev/urandom | base64)

# Step 2: Update the EncryptionConfiguration — new key FIRST
cat <<EOF > /etc/kubernetes/encryption-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources:
  - secrets
  providers:
  - aescbc:
      keys:
      - name: key2              # WHY: New key — listed FIRST so it is used for writing
        secret: $NEW_KEY
      - name: key1              # WHY: Old key — still listed for reading old secrets
        secret: $OLD_KEY
  - identity: {}
EOF

# Step 3: Restart the API server to pick up the new config
# (In kubeadm clusters, the static pod restarts automatically)

# Step 4: Re-encrypt ALL secrets with the new key
kubectl get secrets --all-namespaces -o json | kubectl replace -f -

# EXPECTED OUTPUT:
# secret/db-credentials replaced
# ... (all secrets re-encrypted with key2)

# Step 5: Remove the old key from the config (after verifying all secrets are re-encrypted)
# Only remove key1 AFTER confirming all secrets are re-encrypted
```

**WHY:** Key rotation is a four-step process: (1) add new key first, (2) restart API server, (3) re-encrypt all secrets, (4) remove old key. Skipping step 3 means old secrets are still encrypted with the old key and would become unreadable after step 4.

### Section 2 — Security Best Practices Summary

```yaml
# WHY: A hardened Secret with all best practices
apiVersion: v1
kind: Secret
metadata:
  name: production-db-creds
  namespace: production
  labels:
    app: myapp
    managed-by: sealed-secrets           # WHY: Track how the secret is managed
  annotations:
    secret.reloader.stakater.com/reload: "myapp"  # WHY: Auto-restart pods when secret changes
type: Opaque
# WHY: Use stringData for readability during creation — Kubernetes converts to base64 automatically
stringData:
  username: "app_readonly"               # WHY: Use a read-only database user, not admin
  password: "generated-random-password"  # WHY: Use a password manager or Vault to generate this
  connection-string: "postgresql://app_readonly:generated-random-password@db.internal:5432/appdb?sslmode=require"
  # WHY: Require SSL for database connections
```

---

## Key Takeaways

1. **Base64 is NOT encryption**: Anyone who can `kubectl get secret` can decode your passwords instantly. Never treat base64 as a security measure.

2. **Enable encryption at rest on every cluster**: EncryptionConfiguration with aescbc or kms protects secrets in etcd. This is a non-negotiable baseline for any cluster storing sensitive data.

3. **Restrict RBAC on secrets**: Use `resourceNames` in Roles to limit which specific secrets a ServiceAccount can read. Never grant `list` on secrets unless absolutely necessary.

4. **Prefer volume mounts over environment variables**: Env vars appear in process listings, crash dumps, and `docker inspect`. Volume-mounted secrets are more secure and auto-update.

5. **Sealed Secrets make GitOps safe**: The SealedSecret YAML can be committed to Git. Only the in-cluster controller can decrypt it. The private key never leaves the cluster.

6. **SOPS encrypts values, not keys**: This makes Git diffs readable — you can see which field changed without seeing the actual secret value. Supports multiple KMS backends.

7. **Vault provides dynamic secrets**: Unlike static Kubernetes Secrets, Vault can generate database credentials on demand with automatic expiration. This is the gold standard for production.

8. **CSI driver is the cloud-native approach**: It mounts secrets from external stores directly as volumes, optionally syncing them to Kubernetes Secrets for env var consumption.

9. **Rotate encryption keys regularly**: Add the new key first, re-encrypt all secrets, then remove the old key. Never remove the old key before re-encrypting.

10. **Layer your defenses**: Use encryption at rest as a baseline, RBAC for access control, Sealed Secrets or SOPS for GitOps, and Vault or CSI driver for dynamic secrets. No single solution covers all angles.
