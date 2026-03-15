# File 11 — Docker Networking Fundamentals

**Topic:** Docker networking model, CNM (Container Network Model), bridge driver deep dive, port mapping

**WHY THIS MATTERS:**
Containers are isolated by default — they cannot talk to each other or the outside world unless you explicitly set up networking. Understanding Docker's network model is essential for multi-container apps, microservices, debugging connectivity issues, and securing your infrastructure.

**Prerequisites:** Files 01-10, basic TCP/IP knowledge

---

## Story: The Gated Colony (Residential Society)

Imagine a gated residential colony in Bangalore — like Prestige Lakeside Habitat.

**THE COLONY GATE (docker0 bridge):**
Every colony has one main gate connecting it to the city road (host network). All outgoing traffic goes through this gate. The security guard (iptables) decides who enters and who leaves.

**HOUSE NUMBERS (container IPs):**
Each house in the colony has a unique internal address (172.17.0.2, 172.17.0.3, etc.). These addresses only make sense INSIDE the colony. An auto-rickshaw driver on the main road doesn't know house numbers.

**INTERNAL ROADS (veth pairs):**
Each house has a private driveway connecting it to the colony's internal road. The internal road lets houses talk to each other without going outside the gate.

**INTERCOM / DIRECTORY (DNS resolution):**
The colony has an intercom system. You don't need to know Sharma-ji's house number — just dial "sharma-ji" on the intercom and it connects you. Docker's built-in DNS works the same way for container names.

**VISITOR ENTRY (port publish / -p flag):**
When you expect a food delivery (external traffic), you tell the guard: "If anyone asks for house 3000, send them to my house." This is port mapping — mapping the colony gate's port to a specific house (container).

- Colony gate      = docker0 bridge
- House numbers    = Container IPs (172.17.x.x)
- Private driveway = veth pair (virtual ethernet)
- Intercom         = Docker embedded DNS (127.0.0.11)
- Security guard   = iptables rules
- Visitor entry    = -p / --publish flag

---

## Section 1 — Container Network Model (CNM)

**WHY:** CNM is Docker's networking architecture. Understanding its three components (sandbox, endpoint, network) helps you reason about container connectivity.

The Container Network Model has three building blocks:

**1. SANDBOX (the house)**
- Contains a container's network config (interfaces, routes, DNS)
- Implemented using Linux network namespaces
- Isolates the container's network stack from the host

**2. ENDPOINT (the driveway / connection point)**
- Connects a sandbox to a network
- Implemented as a veth pair (virtual ethernet cable)
- One end is inside the container, the other on the bridge
- A container can have multiple endpoints (connected to multiple networks simultaneously)

**3. NETWORK (the colony's internal road)**
- A group of endpoints that can communicate
- Implemented by a network driver (bridge, overlay, macvlan)
- Provides IP address management (IPAM) and DNS

**COMMAND — List default networks:**

```bash
docker network ls
```

**EXPECTED OUTPUT:**

```
NETWORK ID     NAME      DRIVER    SCOPE
a1b2c3d4e5f6   bridge    bridge    local
f6e5d4c3b2a1   host      host      local
1a2b3c4d5e6f   none      null      local
```

These three are created automatically:
- **bridge** — default network for containers (the colony)
- **host** — container shares the host's network stack (no gate)
- **none** — no networking at all (island house)

---

## Section 2 — The Default Bridge Network (docker0)

When Docker starts, it creates a virtual bridge called "docker0" on the host. This is the colony's internal road network.

**CHECK docker0 on host:**

```bash
ip addr show docker0
```

**EXPECTED OUTPUT:**

```
4: docker0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500
    link/ether 02:42:ac:11:00:00 brd ff:ff:ff:ff:ff:ff
    inet 172.17.0.1/16 brd 172.17.255.255 scope global docker0
```

- `172.17.0.1` = the bridge's IP (colony gate address)
- `/16` subnet = 65,534 possible container IPs

**INSPECT the default bridge:**

```bash
docker network inspect bridge
```

**EXPECTED OUTPUT (key fields):**

```json
{
  "Name": "bridge",
  "Driver": "bridge",
  "IPAM": {
    "Config": [{
      "Subnet": "172.17.0.0/16",
      "Gateway": "172.17.0.1"
    }]
  },
  "Containers": {
    "abc123...": {
      "Name": "my-container",
      "IPv4Address": "172.17.0.2/16"
    }
  }
}
```

---

## Section 3 — veth Pairs (Virtual Ethernet)

**WHY:** veth pairs are the plumbing that connects containers to the bridge. Understanding them helps debug network issues.

A veth pair is a virtual ethernet cable with two ends:
- One end (eth0) lives INSIDE the container's network namespace
- Other end (vethXXX) lives on the HOST, attached to docker0 bridge

**VISUALIZE:**

```
Container A               Host                Container B
┌──────────┐         ┌──────────┐         ┌──────────┐
│  eth0    │─vethABC─│  docker0  │─vethDEF─│  eth0    │
│ 172.17.  │         │ 172.17.  │         │ 172.17.  │
│  0.2     │         │  0.1     │         │  0.3     │
└──────────┘         └──────────┘         └──────────┘
```

Traffic from A to B: `A:eth0 -> vethABC -> docker0 bridge -> vethDEF -> B:eth0`

**SEE veth pairs on host:**

```bash
ip link show type veth
```

**EXPECTED OUTPUT:**

```
5: vethABC1234@if4: <BROADCAST,MULTICAST,UP,LOWER_UP> ...
7: vethDEF5678@if6: <BROADCAST,MULTICAST,UP,LOWER_UP> ...
```

**INSIDE the container:**

```bash
docker exec my-container ip addr show eth0
```

**EXPECTED OUTPUT:**

```
4: eth0@if5: <BROADCAST,MULTICAST,UP,LOWER_UP>
    inet 172.17.0.2/16 scope global eth0
```

The "4: eth0@if5" means interface 4 (eth0) is paired with interface 5 on the host (vethABC1234). They are two ends of the same virtual cable.

### Bridge Network Topology

```mermaid
graph TD
    subgraph Host Machine
        subgraph docker0 Bridge - 172.17.0.1/16
            BR[docker0 bridge]
        end
        IPTABLES[iptables NAT/FILTER]
        ETH0[eth0 - Host NIC<br/>192.168.1.100]
    end

    subgraph Container A - web
        A_ETH[eth0<br/>172.17.0.2]
    end

    subgraph Container B - api
        B_ETH[eth0<br/>172.17.0.3]
    end

    subgraph Container C - db
        C_ETH[eth0<br/>172.17.0.4]
    end

    A_ETH ---|vethAAA| BR
    B_ETH ---|vethBBB| BR
    C_ETH ---|vethCCC| BR
    BR --- IPTABLES
    IPTABLES --- ETH0
    ETH0 ---|physical network| INTERNET[Internet / LAN]

    style BR fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style IPTABLES fill:#FFF3E0,stroke:#E65100
    style ETH0 fill:#E8F5E9,stroke:#2E7D32
    style A_ETH fill:#FCE4EC,stroke:#C62828
    style B_ETH fill:#FCE4EC,stroke:#C62828
    style C_ETH fill:#FCE4EC,stroke:#C62828
```

**EXPLANATION:**
1. Each container gets an eth0 interface with a unique IP
2. Each eth0 is connected to docker0 via a veth pair
3. docker0 acts as a switch — containers can talk to each other
4. Outbound traffic goes through iptables NAT to the host NIC
5. Inbound traffic requires explicit port mapping (-p flag)

---

## Section 4 — Port Mapping / Publishing

**WHY:** By default, container ports are NOT accessible from outside. `-p` maps host ports to container ports, like telling the colony guard to route visitors.

```
SYNTAX: docker run -p [HOST_IP:]HOST_PORT:CONTAINER_PORT[/PROTOCOL] IMAGE
```

**EXAMPLES:**

```bash
# Map host port 8080 to container port 80
docker run -p 8080:80 nginx

# Map on localhost only (not accessible from other machines)
docker run -p 127.0.0.1:8080:80 nginx

# Map a random host port to container port 80
docker run -p 80 nginx
# Check assigned port: docker port <container>

# Map UDP port
docker run -p 5353:53/udp dns-server

# Map multiple ports
docker run -p 80:80 -p 443:443 nginx

# Map a range of ports
docker run -p 8000-8010:8000-8010 myapp
```

**CHECK PORT MAPPINGS:**

```bash
docker port <container-name>
```

**EXPECTED OUTPUT:**

```
80/tcp -> 0.0.0.0:8080
80/tcp -> [::]:8080
```

**FULL EXAMPLE:**

```bash
docker run -d --name web -p 8080:80 nginx:alpine

# Test from host:
curl http://localhost:8080
```

**EXPECTED OUTPUT:**

```html
<!DOCTYPE html>
<html>
<head><title>Welcome to nginx!</title>...
```

### Port Mapping Sequence Diagram

```mermaid
sequenceDiagram
    participant Client as External Client<br/>192.168.1.50
    participant IPT as iptables (NAT)
    participant BR as docker0 bridge
    participant CONT as Container: nginx<br/>172.17.0.2:80

    Note over Client: curl http://192.168.1.100:8080
    Client->>IPT: TCP SYN to 192.168.1.100:8080
    Note over IPT: PREROUTING chain:<br/>DNAT 192.168.1.100:8080<br/>→ 172.17.0.2:80
    IPT->>BR: Forward to 172.17.0.2:80
    BR->>CONT: Deliver via veth pair
    CONT-->>BR: HTTP 200 Response
    BR-->>IPT: Return packet
    Note over IPT: POSTROUTING chain:<br/>MASQUERADE source IP
    IPT-->>Client: HTTP 200 Response
```

**EXPLANATION:**
1. Client sends request to HOST_IP:HOST_PORT (8080)
2. iptables DNAT rule rewrites destination to CONTAINER_IP:CONTAINER_PORT (80)
3. Packet is forwarded through docker0 bridge to the container
4. Response follows the reverse path with source NAT (MASQUERADE)

This is why `-p` is called "publish" — you are publishing a container's port to the outside world through iptables rules.

---

## Section 5 — iptables Rules (Under the Hood)

When you run `docker run -p 8080:80 nginx`, Docker creates these iptables rules:

**1. NAT PREROUTING — redirect incoming traffic**

```bash
sudo iptables -t nat -L DOCKER -n -v
```

**EXPECTED OUTPUT:**

```
Chain DOCKER (2 references)
target  prot  opt  source    destination
DNAT    tcp   --   0.0.0.0/0 0.0.0.0/0   tcp dpt:8080 to:172.17.0.2:80
```

**2. FILTER FORWARD — allow traffic to container**

```bash
sudo iptables -L DOCKER -n -v
```

**EXPECTED OUTPUT:**

```
Chain DOCKER (1 references)
target  prot  opt  source    destination
ACCEPT  tcp   --   0.0.0.0/0 172.17.0.2    tcp dpt:80
```

**3. NAT POSTROUTING — masquerade outbound traffic**

```bash
sudo iptables -t nat -L POSTROUTING -n -v
```

**EXPECTED OUTPUT:**

```
Chain POSTROUTING
target      prot  opt  source        destination
MASQUERADE  all   --   172.17.0.0/16 0.0.0.0/0
```

**WHY:** Understanding iptables helps debug connectivity issues. If a container can't reach the internet, check MASQUERADE. If port mapping doesn't work, check the DOCKER chain.

> **SECURITY NOTE:** Docker modifies iptables directly, which can bypass UFW/firewalld rules. Use docker's `--iptables=false` daemon flag if you want full control, but then you must manage all rules yourself.

---

## Section 6 — Custom Bridge Networks

**WHY:** The DEFAULT bridge has limitations — no automatic DNS resolution between containers. Custom bridges solve this.

**DEFAULT BRIDGE LIMITATION:**
Containers on the default bridge can only reach each other by IP address. Container names DO NOT resolve via DNS.

```bash
docker run -d --name db postgres
docker run -d --name app myapp
# Inside "app": ping db → FAILS (name not resolved)
# Inside "app": ping 172.17.0.2 → works but fragile
```

**CUSTOM BRIDGE — full DNS support:**

```
SYNTAX: docker network create [OPTIONS] NETWORK_NAME
```

```bash
docker network create myapp-net
```

**FLAGS:**

| Flag | Description |
|------|-------------|
| `--driver bridge` | Driver (default: bridge) |
| `--subnet 10.0.1.0/24` | Custom subnet |
| `--gateway 10.0.1.1` | Custom gateway |
| `--ip-range 10.0.1.128/25` | Allocatable IP range |
| `--internal` | No outbound internet access |
| `--attachable` | Allow manual container attachment |

**ADVANCED EXAMPLE:**

```bash
docker network create \
  --driver bridge \
  --subnet 10.0.1.0/24 \
  --gateway 10.0.1.1 \
  --ip-range 10.0.1.128/25 \
  --opt com.docker.network.bridge.name=br-myapp \
  myapp-net
```

**RUN containers on the custom network:**

```bash
docker run -d --name db    --network myapp-net postgres:16
docker run -d --name cache --network myapp-net redis:7
docker run -d --name app   --network myapp-net \
  -e DB_HOST=db \
  -e REDIS_HOST=cache \
  myapp:latest
```

**NOW DNS WORKS:**

```bash
docker exec app ping db        # resolves to 10.0.1.129
docker exec app ping cache     # resolves to 10.0.1.130
```

**WHY custom bridges provide:**
1. Automatic DNS resolution (by container name)
2. Better isolation (only containers on this network can talk)
3. Custom subnets (avoid IP conflicts)
4. Scoped communication (db is not visible to other projects)

Think of it as a private colony within the city — houses have their own intercom system that outsiders can't use.

---

## Section 7 — DNS Resolution

Docker runs an embedded DNS server at 127.0.0.11 inside every container on a CUSTOM network.

**HOW IT WORKS:**
1. Container A wants to reach "db"
2. A's resolver sends DNS query to 127.0.0.11
3. Docker's DNS server looks up "db" in its registry
4. Returns the IP of the container named "db"
5. A connects to that IP

**VERIFY DNS inside a container:**

```bash
docker exec app cat /etc/resolv.conf
```

**EXPECTED OUTPUT:**

```
nameserver 127.0.0.11
options ndots:0
```

**TEST DNS resolution:**

```bash
docker exec app nslookup db
```

**EXPECTED OUTPUT:**

```
Server:    127.0.0.11
Address:   127.0.0.11#53

Name:      db
Address:   10.0.1.129
```

**NETWORK ALIASES (multiple names for one container):**

```bash
docker run -d --name postgres-primary \
  --network myapp-net \
  --network-alias db \
  --network-alias database \
  postgres:16
```

Now "db", "database", AND "postgres-primary" all resolve to the same container.

**DNS ROUND-ROBIN (basic load balancing):**

```bash
docker run -d --name api-1 --network myapp-net --network-alias api myapp
docker run -d --name api-2 --network myapp-net --network-alias api myapp
docker run -d --name api-3 --network myapp-net --network-alias api myapp
```

Querying "api" returns all three IPs in round-robin order.

```bash
docker exec app nslookup api
# Returns: 10.0.1.131, 10.0.1.132, 10.0.1.133
```

**WHY:** DNS-based service discovery means your app code uses container names (environment variables like `DB_HOST=db`) instead of hardcoded IPs. If a container restarts with a new IP, DNS updates automatically.

---

## Section 8 — Network Management Commands

```bash
# LIST networks:
docker network ls
```

**INSPECT a network:**

```
SYNTAX: docker network inspect NETWORK_NAME
```

```bash
docker network inspect myapp-net
```

**EXPECTED OUTPUT:**

```json
[{ "Name": "myapp-net",
   "Driver": "bridge",
   "IPAM": { "Config": [{ "Subnet": "10.0.1.0/24", "Gateway": "10.0.1.1" }] },
   "Containers": {
     "abc...": { "Name": "db",    "IPv4Address": "10.0.1.129/24" },
     "def...": { "Name": "cache", "IPv4Address": "10.0.1.130/24" },
     "ghi...": { "Name": "app",   "IPv4Address": "10.0.1.131/24" }
   }
}]
```

**CONNECT a running container to a network:**

```
SYNTAX: docker network connect [OPTIONS] NETWORK CONTAINER
```

```bash
docker network connect myapp-net existing-container
docker network connect --ip 10.0.1.200 myapp-net existing-container
```

A container can be connected to MULTIPLE networks. This is like a house having driveways to two different colonies — it can communicate with both.

**DISCONNECT a container from a network:**

```
SYNTAX: docker network disconnect NETWORK CONTAINER
```

```bash
docker network disconnect bridge my-container
# Removes from default bridge, keeps on custom network
```

**REMOVE a network:**

```bash
docker network rm myapp-net
# Fails if containers are still connected
```

**PRUNE unused networks:**

```bash
docker network prune
docker network prune -f  # skip confirmation
```

**EXPECTED OUTPUT:**

```
Deleted Networks:
myapp-net
old-project-net
```

---

## Section 9 — Practical Networking Scenarios

**SCENARIO 1: Web app + Database + Cache**

```bash
docker network create webapp-net

docker run -d --name postgres \
  --network webapp-net \
  -e POSTGRES_PASSWORD=secret \
  -v pgdata:/var/lib/postgresql/data \
  postgres:16

docker run -d --name redis \
  --network webapp-net \
  redis:7

docker run -d --name webapp \
  --network webapp-net \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://postgres:secret@postgres:5432/mydb \
  -e REDIS_URL=redis://redis:6379 \
  mywebapp:latest
```

**WHAT'S HAPPENING:**
- All three on "webapp-net" -> can reach each other by name
- Only "webapp" has `-p 3000:3000` -> only it is accessible externally
- postgres and redis have NO published ports -> invisible to outside
- webapp uses DNS names (postgres, redis) in connection strings

**SCENARIO 2: Debugging network issues**

```bash
# Check which networks a container is on
docker inspect webapp --format '{{json .NetworkSettings.Networks}}' | jq

# Test connectivity from inside a container
docker exec webapp ping -c 3 postgres
docker exec webapp curl -s http://api:8080/health

# Run a temporary debug container on the same network
docker run --rm -it --network webapp-net \
  nicolaka/netshoot \
  bash

# Inside netshoot:
  nslookup postgres
  dig postgres
  traceroute postgres
  tcpdump -i eth0 port 5432
  curl -v http://webapp:3000
```

---

## Section 10 — Container-to-Host Communication

**PROBLEM:** Your container needs to reach a service on the host (e.g., a database running directly on your laptop).

**SOLUTION 1: host.docker.internal (Docker Desktop)**

```bash
docker run --rm -it alpine ping host.docker.internal
# Resolves to the host machine's IP
```

In your app's config: `DB_HOST=host.docker.internal`

**SOLUTION 2: --add-host flag**

```bash
docker run --add-host=myhost:host-gateway myapp
# "host-gateway" is a special string that resolves to the host IP
```

**SOLUTION 3: Use the bridge gateway IP**

```bash
docker network inspect bridge | grep Gateway
# Usually 172.17.0.1 — this is the host from the container's
# perspective on the default bridge.
```

**SOLUTION 4: --network host (Linux only)**

```bash
docker run --network host myapp
# Container shares the host's network stack entirely.
# No port mapping needed. No isolation.
```

**WHY:** Container-to-host communication is needed during development when some services run on Docker and others run directly on your machine.

---

## Key Takeaways

1. **CNM (Container Network Model)** has three parts: Sandbox (network namespace) -> Endpoint (veth pair) -> Network (bridge)

2. **docker0** is the default bridge. Containers get IPs from 172.17.0.0/16 subnet. The bridge acts as a switch + gateway.

3. **veth pairs** are virtual ethernet cables — one end inside the container (eth0), the other on the host bridge (vethXXX).

4. **Port mapping** (`-p 8080:80`) uses iptables DNAT rules to route external traffic to container ports.

5. **Custom bridge networks** (`docker network create`) provide:
   - Automatic DNS resolution by container name
   - Better isolation between projects
   - Custom subnets and IP ranges

6. Docker's **embedded DNS** (127.0.0.11) resolves container names to IPs on custom networks. Use `--network-alias` for multiple names.

7. **Key commands:** `docker network ls / create / inspect / connect / disconnect / rm`

8. **Debug with:** nicolaka/netshoot container, docker exec, docker network inspect, iptables -L.

9. **For container-to-host:** use `host.docker.internal` (Docker Desktop) or `--add-host=myhost:host-gateway`.

**GATED COLONY RECAP:**
- Colony gate (docker0)         -> bridge connects to outside world
- House numbers (172.17.0.x)    -> container IPs
- Private driveways (veth)      -> virtual ethernet pairs
- Intercom (DNS at 127.0.0.11) -> name-based service discovery
- Security guard (iptables)     -> controls inbound/outbound traffic
- Visitor entry (-p flag)       -> port publishing for external access
