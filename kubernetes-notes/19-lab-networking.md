# File 19: Lab — Kubernetes Networking

**Topic:** Hands-on lab covering pod networking, service types, headless services, and DNS debugging

**WHY THIS MATTERS:**
Networking issues are the #1 source of confusion in Kubernetes. This lab builds your muscle memory for diagnosing connectivity problems, verifying service routing, inspecting DNS behavior, and understanding what happens at the iptables level when traffic flows through a Service.

---

## Prerequisites

| Tool | Purpose | Install Command |
|------|---------|----------------|
| kind | Local multi-node Kubernetes cluster | `brew install kind` (macOS) / `go install sigs.k8s.io/kind@latest` |
| kubectl | Kubernetes CLI | `brew install kubectl` (macOS) / `curl -LO https://dl.k8s.io/release/stable.txt && curl -LO "https://dl.k8s.io/release/$(cat stable.txt)/bin/linux/amd64/kubectl"` |
| docker | Container runtime for kind | `brew install --cask docker` (macOS) / `sudo apt-get install docker.io` |
| wireshark (optional) | Packet capture analysis | `brew install --cask wireshark` (macOS) / `sudo apt-get install wireshark` |

---

## Cluster Setup

Create a multi-node kind cluster so we can test cross-node networking.

```yaml
# Save as: kind-networking-lab.yaml
# WHY: We need multiple nodes to test cross-node pod communication
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: networking-lab
nodes:
  - role: control-plane
  - role: worker
    labels:
      zone: east
  - role: worker
    labels:
      zone: west
networking:
  podSubnet: "10.244.0.0/16"       # WHY: default pod CIDR — each node gets a /24 from this range
  serviceSubnet: "10.96.0.0/16"    # WHY: ClusterIP range
  disableDefaultCNI: false         # WHY: use kindnet (default CNI)
```

```bash
# Create the cluster
# SYNTAX: kind create cluster --config <file>
# EXPECTED OUTPUT:
# Creating cluster "networking-lab" ...
#  ✓ Ensuring node image (kindest/node:v1.31.0)
#  ✓ Preparing nodes
#  ✓ Writing configuration
#  ✓ Starting control-plane
#  ✓ Installing CNI
#  ✓ Installing StorageClass
#  ✓ Joining worker nodes
# Set kubectl context to "kind-networking-lab"

kind create cluster --config kind-networking-lab.yaml
```

```bash
# Verify nodes are ready
# EXPECTED OUTPUT:
# NAME                           STATUS   ROLES           AGE   VERSION
# networking-lab-control-plane   Ready    control-plane   60s   v1.31.0
# networking-lab-worker          Ready    <none>          45s   v1.31.0
# networking-lab-worker2         Ready    <none>          45s   v1.31.0

kubectl get nodes -o wide
```

---

## Exercise 1: Pod-to-Pod Communication Across Nodes

**Objective:** Deploy two pods on different nodes, verify they can communicate by IP, and inspect the virtual ethernet (veth) pairs that connect pod network namespaces to the node's bridge.

### Step 1 — Deploy pods on specific nodes

```yaml
# Save as: pod-east.yaml
# WHY: nodeSelector forces this pod onto the "east" worker node
apiVersion: v1
kind: Pod
metadata:
  name: pod-east
  labels:
    zone: east
spec:
  nodeSelector:
    zone: east                     # WHY: ensures placement on the east worker
  containers:
    - name: nettools
      image: nicolaka/netshoot     # WHY: has ping, curl, ip, ss, tcpdump — everything for network debugging
      command: ["sleep", "3600"]   # WHY: keep pod running for interactive testing
```

```yaml
# Save as: pod-west.yaml
apiVersion: v1
kind: Pod
metadata:
  name: pod-west
  labels:
    zone: west
spec:
  nodeSelector:
    zone: west
  containers:
    - name: nettools
      image: nicolaka/netshoot
      command: ["sleep", "3600"]
```

```bash
# Deploy both pods
kubectl apply -f pod-east.yaml -f pod-west.yaml

# Wait for pods to be ready
# EXPECTED OUTPUT:
# pod/pod-east condition met
# pod/pod-west condition met
kubectl wait --for=condition=Ready pod/pod-east pod/pod-west --timeout=120s
```

### Step 2 — Get pod IPs and verify cross-node connectivity

```bash
# SYNTAX: kubectl get pods -o wide
# WHY: shows pod IPs and which node each pod is on
# EXPECTED OUTPUT:
# NAME       READY   STATUS    RESTARTS   AGE   IP            NODE
# pod-east   1/1     Running   0          30s   10.244.1.2    networking-lab-worker
# pod-west   1/1     Running   0          30s   10.244.2.2    networking-lab-worker2

kubectl get pods -o wide
```

```bash
# WHY: Verify pods on different nodes can ping each other directly by IP
# SYNTAX: kubectl exec <pod> -- ping -c 3 <target-ip>
# EXPECTED OUTPUT:
# PING 10.244.2.2 (10.244.2.2) 56(84) bytes of data.
# 64 bytes from 10.244.2.2: icmp_seq=1 ttl=62 time=0.234 ms
# 64 bytes from 10.244.2.2: icmp_seq=2 ttl=62 time=0.187 ms
# 64 bytes from 10.244.2.2: icmp_seq=3 ttl=62 time=0.192 ms
#
# --- 10.244.2.2 ping statistics ---
# 3 packets transmitted, 3 received, 0% packet loss

WEST_IP=$(kubectl get pod pod-west -o jsonpath='{.status.podIP}')
kubectl exec pod-east -- ping -c 3 $WEST_IP
```

### Step 3 — Inspect network interfaces and veth pairs

```bash
# WHY: See the network interfaces inside the pod
# SYNTAX: kubectl exec <pod> -- ip addr
# EXPECTED OUTPUT (key parts):
# 1: lo: <LOOPBACK,UP> ...
#     inet 127.0.0.1/8
# 2: eth0@if7: <BROADCAST,MULTICAST,UP> ...
#     inet 10.244.1.2/24
#
# Note: eth0@if7 means eth0 is paired with interface index 7 on the host

kubectl exec pod-east -- ip addr
```

```bash
# WHY: Check the routing table inside the pod
# SYNTAX: kubectl exec <pod> -- ip route
# EXPECTED OUTPUT:
# default via 10.244.1.1 dev eth0
# 10.244.1.0/24 dev eth0 proto kernel scope link src 10.244.1.2
#
# The default gateway (10.244.1.1) is the bridge on the node

kubectl exec pod-east -- ip route
```

```bash
# WHY: Inspect veth pairs from the node side
# This runs inside the kind node container (since kind nodes are Docker containers)
# SYNTAX: docker exec <node-container> ip link show
# EXPECTED OUTPUT (partial):
# 7: vethXXXXXX@if2: <BROADCAST,MULTICAST,UP> ... master kindnet
#
# Interface 7 on the host is paired with interface 2 (eth0) in the pod

docker exec networking-lab-worker ip link show type veth
```

```bash
# WHY: See the bridge and how veth pairs connect to it
# EXPECTED OUTPUT:
# bridge name    bridge id          STP enabled    interfaces
# br-xxxx        8000.xxxxxxxxxxxx  no             vethXXXXXX

docker exec networking-lab-worker brctl show 2>/dev/null || \
  docker exec networking-lab-worker ip link show type bridge
```

---

## Exercise 2: Creating All 4 Service Types and Inspecting iptables

**Objective:** Create ClusterIP, NodePort, LoadBalancer, and ExternalName services. Test connectivity through each. Inspect the iptables rules that kube-proxy creates for ClusterIP routing.

### Step 1 — Deploy a backend application

```yaml
# Save as: echo-server.yaml
# WHY: echo-server returns information about the request, useful for testing routing
apiVersion: apps/v1
kind: Deployment
metadata:
  name: echo-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: echo
  template:
    metadata:
      labels:
        app: echo
    spec:
      containers:
        - name: echo
          image: hashicorp/http-echo
          args: ["-text=hello from echo-server"]
          ports:
            - containerPort: 5678
```

```bash
kubectl apply -f echo-server.yaml
kubectl wait --for=condition=Available deployment/echo-server --timeout=120s
```

### Step 2 — Create all service types

```yaml
# Save as: services-all-types.yaml
# WHY: one file with all 4 service types for easy comparison
---
# ClusterIP — internal only
apiVersion: v1
kind: Service
metadata:
  name: echo-clusterip
spec:
  type: ClusterIP
  selector:
    app: echo
  ports:
    - port: 80
      targetPort: 5678
---
# NodePort — external via node ports
apiVersion: v1
kind: Service
metadata:
  name: echo-nodeport
spec:
  type: NodePort
  selector:
    app: echo
  ports:
    - port: 80
      targetPort: 5678
      nodePort: 30080
---
# LoadBalancer — would provision external LB in cloud (pending in kind)
apiVersion: v1
kind: Service
metadata:
  name: echo-loadbalancer
spec:
  type: LoadBalancer
  selector:
    app: echo
  ports:
    - port: 80
      targetPort: 5678
---
# ExternalName — DNS alias
apiVersion: v1
kind: Service
metadata:
  name: echo-external
spec:
  type: ExternalName
  externalName: httpbin.org
```

```bash
kubectl apply -f services-all-types.yaml
```

```bash
# WHY: See all services with their types and IPs
# EXPECTED OUTPUT:
# NAME                 TYPE           CLUSTER-IP      EXTERNAL-IP   PORT(S)        AGE
# echo-clusterip       ClusterIP      10.96.X.X       <none>        80/TCP         5s
# echo-nodeport        NodePort       10.96.X.X       <none>        80:30080/TCP   5s
# echo-loadbalancer    LoadBalancer   10.96.X.X       <pending>     80:3XXXX/TCP   5s
# echo-external        ExternalName   <none>          httpbin.org   <none>         5s

kubectl get services
```

### Step 3 — Test each service type

```bash
# WHY: Test ClusterIP from inside the cluster
# EXPECTED OUTPUT: "hello from echo-server"

kubectl exec pod-east -- curl -s http://echo-clusterip
```

```bash
# WHY: Test NodePort from outside cluster (via Docker network)
# Get the node's container IP, then curl the NodePort
# EXPECTED OUTPUT: "hello from echo-server"

NODE_IP=$(docker inspect networking-lab-worker -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
echo "Node IP: $NODE_IP"
curl -s http://${NODE_IP}:30080
```

```bash
# WHY: Test ExternalName resolution — it should return a CNAME
# EXPECTED OUTPUT:
# echo-external.default.svc.cluster.local  canonical name = httpbin.org

kubectl exec pod-east -- nslookup echo-external.default.svc.cluster.local
```

### Step 4 — Inspect iptables rules for the ClusterIP service

```bash
# WHY: See the actual iptables rules that kube-proxy created
# This shows how ClusterIP traffic is intercepted and DNAT'd to pod IPs
# SYNTAX: iptables -t nat -L <chain> -n (run inside a kind node)

# First, find the service chain name
docker exec networking-lab-worker iptables -t nat -L KUBE-SERVICES -n 2>/dev/null | head -30
```

```bash
# WHY: Trace the full chain for our ClusterIP service
# The chain name includes a hash of the service name
# EXPECTED OUTPUT shows DNAT rules pointing to individual pod IPs

CLUSTER_IP=$(kubectl get svc echo-clusterip -o jsonpath='{.spec.clusterIP}')
echo "ClusterIP: $CLUSTER_IP"

# Show rules matching our ClusterIP
docker exec networking-lab-worker iptables -t nat -S -n 2>/dev/null | grep "$CLUSTER_IP"
```

```bash
# WHY: See the endpoint chains — each pod gets a chain with a DNAT rule
# EXPECTED OUTPUT (example):
# -A KUBE-SEP-XXXXX -p tcp -j DNAT --to-destination 10.244.1.3:5678
# -A KUBE-SEP-YYYYY -p tcp -j DNAT --to-destination 10.244.2.4:5678

docker exec networking-lab-worker iptables -t nat -S -n 2>/dev/null | grep "5678"
```

```bash
# WHY: Check the endpoints registered for the service
# EXPECTED OUTPUT:
# NAME             ENDPOINTS                                          AGE
# echo-clusterip   10.244.1.X:5678,10.244.2.X:5678,10.244.X.X:5678  2m

kubectl get endpoints echo-clusterip
```

---

## Exercise 3: Headless Service and StatefulSet DNS

**Objective:** Deploy a headless service with a StatefulSet. Verify that DNS resolves to individual pod IPs instead of a virtual ClusterIP, and that each pod gets a stable DNS name.

### Step 1 — Create the headless service and StatefulSet

```yaml
# Save as: headless-statefulset.yaml
apiVersion: v1
kind: Service
metadata:
  name: web-headless
spec:
  clusterIP: None              # WHY: makes it headless — no virtual IP
  selector:
    app: web-sts
  ports:
    - port: 80
      targetPort: 80
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: web-sts
spec:
  serviceName: web-headless    # WHY: links to headless service for DNS records
  replicas: 3
  selector:
    matchLabels:
      app: web-sts
  template:
    metadata:
      labels:
        app: web-sts
    spec:
      containers:
        - name: nginx
          image: nginx:1.25
          ports:
            - containerPort: 80
```

```bash
kubectl apply -f headless-statefulset.yaml

# WHY: StatefulSet pods are created sequentially — wait for all 3
kubectl wait --for=condition=Ready pod/web-sts-0 pod/web-sts-1 pod/web-sts-2 --timeout=120s
```

### Step 2 — Verify headless DNS resolution

```bash
# WHY: Headless service returns pod IPs, not a ClusterIP
# EXPECTED OUTPUT:
# Name:    web-headless.default.svc.cluster.local
# Address: 10.244.1.X
# Address: 10.244.2.X
# Address: 10.244.X.X
# (3 IPs — one per pod, NO single ClusterIP)

kubectl exec pod-east -- nslookup web-headless.default.svc.cluster.local
```

### Step 3 — Verify individual pod DNS names

```bash
# WHY: StatefulSet pods get predictable DNS: <pod-name>.<service-name>.<namespace>.svc.cluster.local
# EXPECTED OUTPUT for each:
# Name:    web-sts-0.web-headless.default.svc.cluster.local
# Address: 10.244.X.X

kubectl exec pod-east -- nslookup web-sts-0.web-headless.default.svc.cluster.local
kubectl exec pod-east -- nslookup web-sts-1.web-headless.default.svc.cluster.local
kubectl exec pod-east -- nslookup web-sts-2.web-headless.default.svc.cluster.local
```

### Step 4 — Compare with a regular ClusterIP service

```bash
# WHY: Create a regular (non-headless) service for comparison
kubectl expose statefulset web-sts --name=web-regular --port=80 --target-port=80

# Compare the DNS results
echo "=== Regular Service DNS ==="
kubectl exec pod-east -- nslookup web-regular.default.svc.cluster.local
# EXPECTED: returns a single ClusterIP (e.g., 10.96.X.X)

echo ""
echo "=== Headless Service DNS ==="
kubectl exec pod-east -- nslookup web-headless.default.svc.cluster.local
# EXPECTED: returns 3 individual pod IPs
```

```bash
# WHY: Verify that the regular service has a ClusterIP and headless does not
# EXPECTED OUTPUT:
# NAME           TYPE        CLUSTER-IP     ...
# web-regular    ClusterIP   10.96.X.X      ...
# web-headless   ClusterIP   None           ...

kubectl get svc web-regular web-headless
```

---

## Exercise 4: DNS Debugging — nslookup, dig, ndots, Custom CoreDNS

**Objective:** Master DNS troubleshooting in Kubernetes. Understand how ndots affects resolution, use dig for detailed queries, and add custom CoreDNS entries.

### Step 1 — Basic DNS debugging with nslookup and dig

```bash
# WHY: nslookup is simpler, dig gives more detail (record types, TTL, authority)
# EXPECTED OUTPUT for dig:
# ;; ANSWER SECTION:
# echo-clusterip.default.svc.cluster.local. 30 IN A 10.96.X.X

kubectl exec pod-east -- nslookup echo-clusterip
kubectl exec pod-east -- dig echo-clusterip.default.svc.cluster.local +short
```

```bash
# WHY: dig can show SRV records — these include port information
# SRV records are created for named ports in services
# EXPECTED OUTPUT:
# ;; ANSWER SECTION:
# _http._tcp.echo-clusterip.default.svc.cluster.local. 30 IN SRV 0 100 80 echo-clusterip.default.svc.cluster.local.

kubectl exec pod-east -- dig SRV echo-clusterip.default.svc.cluster.local
```

### Step 2 — Observe the ndots problem

```bash
# WHY: With default ndots:5, looking up "api.example.com" (2 dots < 5) triggers
# search domain appending FIRST, causing 4 extra DNS queries before the real one

# EXPECTED OUTPUT: Multiple queries before the final answer
# api.example.com.default.svc.cluster.local  -> NXDOMAIN
# api.example.com.svc.cluster.local          -> NXDOMAIN
# api.example.com.cluster.local              -> NXDOMAIN
# api.example.com                            -> actual result

kubectl exec pod-east -- dig api.example.com +search +showsearch 2>&1 | head -40
```

```bash
# WHY: Using a trailing dot (.) makes it a FQDN — skips search domains entirely
# EXPECTED OUTPUT: only ONE query, direct resolution

kubectl exec pod-east -- dig api.example.com. +short
```

```bash
# WHY: Compare DNS query counts
# Using tcpdump to see actual queries sent

# Start tcpdump in background
kubectl exec pod-east -- sh -c "timeout 5 tcpdump -i eth0 port 53 -nn 2>/dev/null &"

# Trigger a lookup for an external domain
kubectl exec pod-east -- curl -s --connect-timeout 2 http://api.example.com/ 2>/dev/null || true
```

### Step 3 — Test with modified ndots

```yaml
# Save as: pod-ndots2.yaml
# WHY: Pod with ndots:2 to reduce unnecessary DNS queries
apiVersion: v1
kind: Pod
metadata:
  name: pod-ndots2
spec:
  dnsPolicy: ClusterFirst
  dnsConfig:
    options:
      - name: ndots
        value: "2"
  containers:
    - name: nettools
      image: nicolaka/netshoot
      command: ["sleep", "3600"]
```

```bash
kubectl apply -f pod-ndots2.yaml
kubectl wait --for=condition=Ready pod/pod-ndots2 --timeout=60s

# WHY: Compare resolv.conf between pods
echo "=== Default ndots ==="
kubectl exec pod-east -- cat /etc/resolv.conf
echo ""
echo "=== Custom ndots:2 ==="
kubectl exec pod-ndots2 -- cat /etc/resolv.conf
```

```bash
# WHY: With ndots:2, "api.example.com" (2 dots >= 2) is tried as absolute FIRST
# This is more efficient for external domain lookups

kubectl exec pod-ndots2 -- dig api.example.com +search +showsearch 2>&1 | head -20
```

### Step 4 — Add custom CoreDNS entries

```bash
# WHY: Sometimes you need to add custom DNS records (e.g., for testing, internal services)
# CoreDNS is configured via a ConfigMap in kube-system namespace

# First, see the current CoreDNS config
# EXPECTED OUTPUT: the Corefile with the kubernetes plugin
kubectl get configmap coredns -n kube-system -o yaml
```

```bash
# WHY: Add a custom hosts entry to CoreDNS
# This patches the Corefile to add a hosts block

kubectl get configmap coredns -n kube-system -o yaml > coredns-backup.yaml

cat <<'PATCH' > coredns-patch.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: coredns
  namespace: kube-system
data:
  Corefile: |
    .:53 {
        errors
        health {
           lameduck 5s
        }
        ready
        kubernetes cluster.local in-addr.arpa ip6.arpa {
           pods insecure
           fallthrough in-addr.arpa ip6.arpa
           ttl 30
        }
        hosts {
           192.168.1.100 myapp.internal.company.com
           192.168.1.200 mydb.internal.company.com
           fallthrough
        }
        prometheus :9153
        forward . /etc/resolv.conf {
           max_concurrent 1000
        }
        cache 30
        loop
        reload
        loadbalance
    }
PATCH

kubectl apply -f coredns-patch.yaml
```

```bash
# WHY: Restart CoreDNS to pick up the new config
kubectl rollout restart deployment coredns -n kube-system
kubectl rollout status deployment coredns -n kube-system --timeout=60s
```

```bash
# WHY: Verify custom DNS entry works
# EXPECTED OUTPUT:
# Name:   myapp.internal.company.com
# Address: 192.168.1.100

kubectl exec pod-east -- nslookup myapp.internal.company.com
kubectl exec pod-east -- nslookup mydb.internal.company.com
```

```bash
# WHY: Restore original CoreDNS config
kubectl apply -f coredns-backup.yaml
kubectl rollout restart deployment coredns -n kube-system
```

---

## Cleanup

```bash
# WHY: Remove all lab resources to free up system resources

# Delete all pods and workloads
kubectl delete pod pod-east pod-west pod-ndots2 --ignore-not-found
kubectl delete deployment echo-server --ignore-not-found
kubectl delete statefulset web-sts --ignore-not-found

# Delete all services
kubectl delete service echo-clusterip echo-nodeport echo-loadbalancer echo-external \
  web-headless web-regular --ignore-not-found

# Delete the kind cluster entirely
kind delete cluster --name networking-lab

# Clean up YAML files
rm -f kind-networking-lab.yaml pod-east.yaml pod-west.yaml echo-server.yaml \
  services-all-types.yaml headless-statefulset.yaml pod-ndots2.yaml \
  coredns-patch.yaml coredns-backup.yaml

echo "Cleanup complete. All resources and the kind cluster have been removed."
```

```bash
# WHY: Verify the cluster is gone
# EXPECTED OUTPUT: no clusters listed, or networking-lab not in list
kind get clusters
```
