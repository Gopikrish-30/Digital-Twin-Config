# Digital Twin Configurator & Dashboard

A platform for building 3D digital twins of client facilities (factories, plants, warehouses) from artist-made GLB assets, arranging them into a real layout, binding live data to each asset, and sharing a read-only, real-time twin with the client under their own domain.

The system has three moving parts:

1. **Configurator** — internal authoring tool. Import GLB assets, arrange the layout, name/rename/reuse assets, define parameters, and bind live data tags.
2. **Client Dashboard** — read-only web app hosted per client. Renders the published twin with real-time data. The client can look but never edit.
3. **Edge Gateway** — small always-on service that runs at the client's site, reads their PLC/SCADA/OPC-UA data, and forwards it to our cloud.

---

## 1. Project goals

- Build once, reuse everywhere: an asset (furnace, CNC machine, conveyor) is modeled once and reused across any number of client twins.
- Non-destructive editing: all configurator changes are drafts until explicitly published, so the client's live dashboard never breaks mid-edit.
- Fully data-driven: departments, parameters, units, alarms, and hierarchy are all JSON-configurable — adding a new machine type or metric never requires a code change.
- Live, not static: the dashboard reflects real sensor/PLC data in real time, not a one-time export.
- White-labeled delivery: each client gets their own hosted link/domain, with no visible connection to our internal tooling.

---

## 2. High-level architecture

```
 3D Artists                Configurator (internal, desktop or web)
 ┌───────────┐              ┌─────────────────────────────┐
 │ GLB assets│ ───imports──▶│ Scene composer               │
 └───────────┘              │ Layout / placement            │
                             │ Parameter & alarm definitions  │
                             │ Tag-to-parameter mapping        │
                             └───────────────┬───────────────┘
                                             │ Publish
                                             ▼
                             ┌─────────────────────────────┐
                             │ Published config store        │
                             │ (versioned, per tenant)         │
                             └───────────────┬───────────────┘
                                             ▼
                             ┌─────────────────────────────┐
                             │ Client Dashboard (web, per     │
                             │ tenant domain/subdomain)        │
                             │ Read-only 3D twin + live metrics │
                             └───────────────▲───────────────┘
                                             │ live values
                             ┌───────────────┴───────────────┐
                             │ Cloud message broker (MQTT)     │
                             │ per-tenant topics                │
                             └───────────────▲───────────────┘
                                             │ outbound only
                             ┌───────────────┴───────────────┐
                             │ Edge Gateway (runs at client site)│
                             └───────────────▲───────────────┘
                                             │
                             ┌───────────────┴───────────────┐
                             │ Client PLC / SCADA / OPC-UA      │
                             └─────────────────────────────────┘
```

---

## 3. Core data model

Three entities drive everything. Keeping them separate is what makes assets reusable and clients isolated from each other.

### AssetDefinition
The reusable "catalog" item — a GLB plus its default schema. Not tied to any one client.

```json
{
  "id": "def_furnace_v1",
  "name": "Furnace Type A",
  "category": "Smelting",
  "glbUrl": "s3://assets/furnace_type_a.glb",
  "defaultParams": [
    { "key": "furnace_temp", "label": "Furnace Temp", "unit": "°C" },
    { "key": "oil_level", "label": "Oil Level", "unit": "%" }
  ]
}
```

### AssetInstance
A specific placed copy inside one client's twin. References a definition, but owns its own name, position, department, and parameter overrides.

```json
{
  "id": "inst_cnc02",
  "definitionId": "def_cnc_machine_v2",
  "tenantId": "acme_manufacturing",
  "customName": "CNC_02",
  "department": "Machining",
  "transform": { "position": [58, 0, 55], "rotation": 0, "scale": 1 },
  "paramOverrides": { "unit_label": "Machining Cell B" }
}
```

### ParameterBinding
Connects one asset instance's parameter to a live data source, plus alarm rules.

```json
{
  "instanceId": "inst_cnc02",
  "paramKey": "spindle_rpm",
  "sourceTopic": "tenant/acme_manufacturing/machining/cnc_02/spindle_rpm",
  "unit": "RPM",
  "alarmRules": { "min": 200, "max": 1500, "severity": "warning" }
}
```

**Rule of thumb:** geometry/placement lives on the instance, live-data wiring lives on the binding, and reusable defaults live on the definition. Cloning an instance for a new client never touches the definition.

---

## 4. Repository structure (proposed)

```
digital-twin-platform/
├── apps/
│   ├── configurator/        # Internal authoring tool (desktop, Tauri/Electron)
│   ├── dashboard/            # Client-facing read-only web app
│   └── edge-gateway/         # Runs on client site, forwards PLC/SCADA data
├── packages/
│   ├── viewer-core/          # Shared react-three-fiber scene renderer
│   │                         # (used by both configurator and dashboard)
│   ├── schema/                # Shared TypeScript types for
│   │                         # AssetDefinition / AssetInstance / ParameterBinding
│   └── ui/                    # Shared design system components
├── services/
│   ├── api/                   # Backend REST/WS API, auth, tenant resolution
│   ├── ingest/                 # MQTT subscriber, writes to time-series DB
│   └── publish/                 # Draft → published config versioning
├── infra/
│   └── ...                      # IaC, DNS/wildcard domain routing, CI/CD
└── docs/
    └── ...
```

`viewer-core` is the key reuse point: the configurator renders it with editing gizmos and write access; the dashboard renders the same package in read-only mode with a live data subscription instead.

---

## 5. Configurator (internal tool)

**Purpose:** import assets, build the layout, define parameters/departments, bind live tags, manage drafts, publish.

**Recommended stack:**
- React + react-three-fiber + drei (transform gizmos, GLB loader)
- **Tauri v2**, packaging the same `viewer-core` — confirmed decision (2026-07-06)
- Local state synced to backend drafts via REST/WS

**Tauri vs. Electron — the one caveat to know:** Tauri wraps the OS's native WebView (WebView2 on Windows, WebKit on macOS, WebKitGTK on Linux) instead of bundling Chromium, which is why it wins on install size (~10-15 MB vs. 100 MB+) and idle RAM (~30-40 MB vs. 200-300 MB). The tradeoff is exactly the one that matters here: WebGL/WebGPU rendering consistency depends on whatever WebView each OS ships — it's the reason Figma's own desktop app uses Electron rather than Tauri, since Figma needs pixel-identical GPU rendering across every machine it ships to. We're fine defaulting to Tauri anyway because, unlike Figma, **this app only ever runs on our own team's machines** — a controlled, small set of hardware/OS combos we can standardize (e.g. stick to Windows/WebView2 across the team, or verify WebKitGTK's WebGL2 support explicitly if any team member is on Linux) rather than the "must look identical on any random user's machine" problem Electron solves for. If the team is or becomes OS-mixed and a rendering inconsistency actually surfaces, that's the point to revisit Electron — not before.

**Key screens:**
- Asset library (browse/import AssetDefinitions)
- Scene/layout editor (drag-place instances, snap-to-grid, rename, assign department)
- Parameter panel (per-instance schema editor — name, unit, dept, hierarchy)
- Tag mapping screen (browse live incoming tags from a tenant's edge gateway, bind to parameters, set alarm thresholds)
- Publish panel (diff draft vs. last published, publish new version, rollback)

**Why desktop is fine here:** the configurator is used by our own team only, so distribution is controlled. Desktop gives better GPU performance for detailed scenes, native file access for asset management, and can talk directly to a client's local OPC-UA/Modbus server during on-site setup without needing the edge gateway running yet.

---

## 6. Client Dashboard (web app)

**Purpose:** read-only, real-time view of the published twin, hosted under the client's name.

**Recommended stack:**
- Same `viewer-core` package as the configurator, rendered with `isEditMode = false`
- Subscribes to the backend over WebSocket for live parameter updates
- Reads `published_config`, never the draft

**Hosting model:**
- Subdomain on our platform: `acme.ourplatform.com` (simplest — wildcard DNS + tenant resolved from subdomain)
- Or client's own domain via CNAME: `twin.acmefactory.com` (tenant resolved from `Host` header)
- Access via a scoped, view-only link or lightweight auth — no admin capability ever shipped to this app

**Explicitly out of scope for this app:** placement editing, renaming, parameter editing, asset import — all editing capability lives only in the configurator.

**"Sending" the dashboard to a client, concretely — nothing is shipped as a file; see §15 for the full onboarding workflow (subdomain vs. white-label custom domain, the actual CNAME + TLS automation, and the access-link mechanism).**

---

## 7. Edge Gateway

**Purpose:** always-on bridge between a client's factory floor and our cloud. Runs at the client's site (small VM, industrial PC, or Docker container on their network).

**Responsibilities:**
- Connects to the client's OPC-UA server / Modbus device / existing MQTT broker as a client (read-only)
- Normalizes tag values into a consistent shape
- Publishes outbound to our cloud MQTT broker under `tenant/{tenantId}/...` topics — outbound-only, so no inbound firewall changes needed on the client's network
- Sends a periodic heartbeat so we can detect if a client's connection drops

**Suggested tooling:** Node-RED (fastest to stand up, has mature OPC-UA/Modbus nodes) or a small custom Node.js service using `node-opcua`, deployed via Docker.

---

## 8. Data flow, end to end

1. Client's PLC/SCADA exposes tags over OPC-UA or Modbus.
2. Edge Gateway reads those tags and publishes them to the cloud MQTT broker on a per-tenant topic.
3. Backend `ingest` service subscribes, writes latest value + history to a time-series database (InfluxDB/TimescaleDB), and evaluates alarm rules.
4. Latest values are pushed over WebSocket to any connected dashboard viewing that tenant.
5. In the configurator, the tag-mapping screen lets us bind a specific incoming topic to a specific `ParameterBinding` — no code change needed to add a new machine.

---

## 9. Publish & versioning

- The configurator only ever edits a **draft** config.
- Hitting **Publish** copies the draft into a new versioned row in the published config store.
- The dashboard always reads the latest published version — never the draft.
- Rollback = pointing the tenant back at a previous published version.

---

## 10. Multi-tenancy & security

- Every table (`AssetInstance`, `ParameterBinding`, published configs) carries a `tenantId`.
- MQTT topics are namespaced per tenant (`tenant/{tenantId}/...`) with broker-level ACLs so one client's data is never visible to another.
- The dashboard's auth is scoped and read-only; it can never call any write/publish endpoint, enforced at the API layer, not just hidden in the UI.
- Edge Gateway connections are outbound-only from the client's network — we never require an inbound port opened at the client site.

---

## 11. Suggested roadmap

- [ ] `viewer-core` package: GLB loading, isometric camera, hotspot markers, edit/view mode toggle
- [ ] Schema package: shared types for AssetDefinition / AssetInstance / ParameterBinding
- [ ] Configurator: asset library + drag-place layout editor
- [ ] Configurator: parameter/department panel
- [ ] Backend: draft/publish versioning API
- [ ] Edge Gateway: OPC-UA → MQTT bridge (Node-RED prototype)
- [ ] Backend: ingest service + time-series storage + alarm evaluation
- [ ] Dashboard: read-only web app, subdomain routing
- [ ] Configurator: tag-mapping UI binding live tags to parameters
- [ ] Multi-tenant hosting: wildcard subdomains + custom domain (CNAME) support
- [ ] Desktop packaging of configurator (Tauri)

---

## 12. Open-source building blocks we can reuse (research findings)

No single open-source project is "a digital twin configurator" in the exact shape we need (GLB layout placement + live IoT data + white-label multi-tenant hosting). That combination is a niche of one. The right move is to **compose from parts that each solve one slice well**, not to search for a monolith to fork. Verified candidates:

| Slice | Candidate | License | Why / caveat |
|---|---|---|---|
| Scene editor UX patterns (hierarchy panel, transform gizmos, GLTF import, JSON scene graph) | [three.js editor](https://threejs.org/editor/) (`/editor` in the three.js repo) | MIT | Not React — it's vanilla JS/DOM. Don't run it as-is; **mine it for UX/data-model patterns** (its scene JSON schema, outliner, gizmo interaction) and reimplement in React Three Fiber, since `viewer-core` is already planned as R3F. |
| Alternative renderer w/ digital-twin pedigree | [Babylon.js](https://www.babylonjs.com/digitalTwinIot/) | Apache-2.0 | Actively used for real IoT/digital-twin apps (Microsoft's own Azure Digital Twins 3D Scenes Studio is built on Babylon.js; there's a live train-station digital twin built on it). Worth a bake-off against R3F/three.js before committing — Babylon has more built-in editor/inspector tooling out of the box, R3F has better React ergonomics and a bigger component ecosystem (`drei`, `gltfjsx`). Recommendation: stick with R3F given the rest of the stack is React, but note this as a deliberate choice, not a default. |
| Ingestion, rule engine, multi-tenancy, time-series storage, alarms | [ThingsBoard CE](https://thingsboard.io/) | Apache-2.0 | Multi-tenancy, MQTT/HTTP/CoAP ingestion, rule engine, and dashboards ship in the **free Community Edition**. White-labeling/RBAC/SSO are Professional Edition (paid) — but we sidestep that entirely by **never exposing ThingsBoard's own UI to the client**. Use it purely as the backend (ingest + rule engine + time-series store + REST/WS API) behind our own bespoke 3D dashboard. This could replace our planned custom `ingest`/`publish` services rather than us building an MQTT subscriber + TSDB writer from scratch. Worth a spike before committing to a fully custom backend. |
| MQTT broker | [EMQX](https://www.emqx.com/) (Apache-2.0 core) or [Mosquitto](https://mosquitto.org/) (EPL/EDL) | OSS | Both support MQTT-over-WebSocket and per-topic ACLs, which is exactly what per-tenant isolation needs. EMQX is easier to run at scale/clustered; Mosquitto is the simplest single-node option for early pilots. If tenant isolation ever needs to be *stronger* than topic ACLs (i.e., broker-level hard multi-tenancy), Apache BifroMQ is the open-source broker built specifically for that. |
| Standardized asset/parameter schema | [Eclipse BaSyx](https://eclipse.dev/basyx/) (Asset Administration Shell / Industry 4.0 reference impl.) | EPL-2.0 | Not something to run, but worth reading: AAS is the actual industry standard for "one shell per physical asset holding submodels of properties/parameters/hierarchy" — very close to what we're calling `AssetDefinition`/`AssetInstance`. Aligning our JSON schema loosely with AAS submodel conventions costs little now and pays off if we ever need to interoperate with a client's existing Industry 4.0 tooling. Not a v1 blocker. |
| Edge gateway prototyping | Node-RED (already noted in §7) | Apache-2.0 | Confirmed still the fastest path to an OPC-UA/Modbus → MQTT bridge for a first pilot; graduate to a custom `node-opcua` service once tag volume or reliability needs outgrow it. |

**Bottom line:** build `viewer-core` + configurator ourselves (nothing off-the-shelf fits the "arrange GLBs like a base-building game" requirement), but do **not** default to hand-rolling the ingestion/rule-engine/multi-tenant backend — spike ThingsBoard CE against our own `services/ingest` + `services/publish` plan first, since it may cut months off the backend.

---

## 13. Real-time delivery to (multiple) clients — resolving the MQTT/HTTP question directly

**Short answer: MQTT alone won't reach the browser, and plain HTTP GET/POST alone can't be "real-time" — you need a specific combination, not either/or.**

**Why raw MQTT doesn't reach the dashboard directly:** browsers cannot open a raw TCP socket, and MQTT's native transport is TCP. There are two ways around that, and they are not equally good for this product:

1. **MQTT-over-WebSocket straight to the browser** (`mqtt.js` connecting to the broker's WS listener, e.g. EMQX/Mosquitto on port 8083/8084). Works, and is the simplest possible wiring. **We should not use this for the client dashboard**, because it means shipping broker credentials/ACL tokens into a browser tab we don't fully control, it bypasses any place to centrally evaluate alarms or write history, and fan-out to N simultaneous viewers of the same tenant is left entirely to the broker's own scaling rather than something we control.
2. **Backend relay (recommended — and what §2/§8 of this doc already describes):** Edge Gateway → cloud MQTT broker → our own backend service subscribes *server-side* (never the browser) → writes latest value + history to the time-series DB and evaluates alarm rules → pushes to connected dashboards over **WebSocket** (or SSE, since dashboard updates are one-directional server→client). This keeps broker credentials server-side only, centralizes alarm/history logic in one place, and lets us fan out cleanly.

**Where plain HTTP GET/POST *does* fit — and where it doesn't:**
- **Does fit:** initial page load (fetch current parameter snapshot + published config over a normal `GET`), configurator CRUD (create/edit/publish/rollback are naturally `POST`/`PUT`), edge gateway heartbeat/health checks, auth/link redemption.
- **Doesn't fit alone:** continuous live updates. You *could* poll `GET /latest` every second per parameter, but with dozens–hundreds of live parameters per twin and multiple simultaneous viewers, that's needless request overhead and adds up to noticeably worse latency than a push channel. Use WebSocket/SSE for the live stream; keep REST for everything request/response-shaped.

**Handling *multiple* clients (both meanings):**
- *Multiple simultaneous viewers of one tenant's dashboard* (e.g. 5 people at Acme Corp with the link open) — solved by a **pub/sub fan-out** behind the WebSocket layer: the ingest service publishes each new value to a channel keyed by `tenantId` (Redis Pub/Sub or NATS both work fine at this scale), and the WS gateway subscribes each connected socket to its tenant's channel ("room"). One MQTT message in → broadcast to all sockets in that room, regardless of how many are open.
- *Multiple different tenants/companies* — already covered by this doc's per-tenant MQTT topic namespace + broker ACLs (§10); the pub/sub layer just needs to key on the same `tenantId` so tenants never share a channel.
- *Scaling past one backend process* — this is exactly why the relay goes through Redis/NATS rather than an in-process event emitter: any backend instance handling a given WebSocket connection can receive the update regardless of which instance's MQTT subscriber originally received it.

**Concrete v1 stack recommendation:** Mosquitto or EMQX (broker, WS listener enabled for internal use only, not exposed to browsers) → Node.js `ingest` service (`mqtt.js` as a server-side subscriber) → Redis Pub/Sub → Node.js WS gateway (`socket.io`, one "room" per `tenantId`) → browser (`socket.io-client` inside `viewer-core`). REST API (Fastify/Express) alongside for everything CRUD/auth-shaped. This scales to dozens of tenants on a single small deployment; revisit (e.g. NATS, or ThingsBoard's built-in WS API if §12's spike pans out) only once tenant count or per-tenant tag volume actually demands it.

---

## 14. Other constraints worth deciding early

- **Update rate discipline:** don't push every raw tag change to the browser. Deadband (only emit when a value changes by more than a threshold) and/or cap at ~1–2 Hz per parameter before it hits the WS layer — a 3D scene with hundreds of live-bound parameters will visibly stutter and waste bandwidth otherwise.
- **GLB performance at factory scale:** use Draco or meshopt geometry compression and KTX2 texture compression on every artist-delivered asset; use `InstancedMesh` for repeated identical machines (ten identical CNC units should be one draw call family, not ten separate meshes) — this matters more than any framework choice once a layout has 100+ placed instances.
- **Dashboard auth (resolves the open question below with a concrete recommendation):** a scoped, signed, expiring token embedded in the dashboard link (JWT with `tenantId` + read-only claim, short-lived, silently refreshed by the backend while the tab stays open) rather than a full account/login system for v1. Add an optional per-link password if a client asks for an extra layer. Enforce "read-only" at the API/WS layer itself (reject any write/publish call from a token lacking the claim) — never rely on the dashboard UI simply not showing edit controls.
- **Custom domain delivery:** wildcard subdomain (`*.ourplatform.com`) via wildcard DNS + a wildcard TLS cert (Let's Encrypt DNS-01) covers the default case; a client's own domain via CNAME needs per-domain certificate automation (Caddy's on-demand TLS, or an ACM/Let's Encrypt automation loop keyed off verified CNAMEs) — budget real setup time for this, it's not a checkbox.
- **Edge gateway resilience:** MQTT QoS 1 + persistent sessions plus a local disk buffer at the gateway so a client-side network blip doesn't silently drop data — replay on reconnect rather than losing the gap.
- **Time-series retention/cost:** decide a downsampling/retention policy (e.g. raw for 30 days, 1-minute rollups after) before onboarding tenant #2, or storage cost scales linearly with every tenant's full tag history forever.
- **Licensing sanity check for anything adopted from §12:** three.js/R3F/drei (MIT), Babylon.js (Apache-2.0), ThingsBoard CE (Apache-2.0, but PE features like white-labeling/SSO are paid — irrelevant to us since we don't expose its UI), EMQX core (Apache-2.0), Mosquitto (EPL/EDL), Eclipse BaSyx (EPL-2.0). All safe for commercial use as of this research; re-verify before shipping if any get vendored rather than just referenced.

---

## 15. Delivering the dashboard to a client, concretely

The dashboard is never "sent" as an artifact — it's continuously served from our infrastructure, which is *why* configurator edits show up live once published. What the client actually receives is **a URL plus an access mechanism**. Two delivery modes, both hitting the same backend/tenant:

**Mode A — our subdomain (default, zero setup on the client's side):**
1. Provision a `tenantId` in the backend and publish the first config version from the configurator.
2. The app is immediately reachable at `acme.ourplatform.com` — tenant resolved from the subdomain, wildcard DNS + one wildcard TLS cert covers every client, no per-client cert work.
3. Generate a scoped, signed, expiring link (JWT with `tenantId` + read-only claim, per §14) and hand that URL to the client — email it, or drop it as a button in whatever portal they already use. No client action required.

**Mode B — white-labeled on the client's own domain (`twin.acmefactory.com`), when a client wants their brand on it:**
1. Client's IT points a CNAME for `twin.acmefactory.com` at a hostname we give them.
2. We register that hostname as a **Cloudflare for SaaS custom hostname** (a real product built exactly for this: multi-tenant SaaS apps that need to serve customer-owned vanity domains). Cloudflare auto-issues and renews the TLS cert for the client's domain once the CNAME is verified — we never touch ACME/Let's Encrypt automation ourselves. Cost is $0.10/hostname/month past the first 100, so it's a non-issue at our likely client count.
3. Our backend resolves tenant from the `Host` header exactly as §6 already specifies — Mode A and Mode B hit identical backend logic, only the domain differs.
4. Same scoped signed link as Mode A for access control.

**Practical rollout:** default every client to Mode A at pilot/handoff time — it requires zero setup and proves the product works; upgrade specific clients to Mode B only when they actually ask for their own domain, since it's the one step in the whole pipeline that depends on someone else's DNS (client IT can be slow, and CNAME propagation isn't in our control).

**On bandwidth/perf for the client:** the heavy part (GLB assets) downloads once and is cached by the browser; every subsequent moment is just small WebSocket deltas per §13. A client on an ordinary office connection sees no difference between viewing a twin with 10 assets or 200.

**Access without a full account system:** the signed link *is* the auth for v1 (§14) — no client login/password flow to build, no user-management screen, and it's trivially revocable (rotate the signing key or flip the token's tenant flag) if a client relationship ends.

---

## 16. Open questions to resolve before build

- Which time-series database (InfluxDB vs. TimescaleDB) fits our team's existing stack best? — *or does the §12 ThingsBoard spike make this moot by providing one built-in?*
- Do we need historical trend charts on the dashboard from day one, or is live-value-only acceptable for v1?
- Auth model for client dashboard access — §14 recommends a scoped signed link over full account login; confirm this is acceptable for the first client(s).
- Standard protocol assumption for new clients — do we mandate OPC-UA support, or build Modbus/legacy support in from the start?
- Do we spike ThingsBoard CE as the ingest/rule-engine/backend (§12) before writing a custom `services/ingest` + `services/publish`, or is a fully custom backend preferred for control/simplicity?
