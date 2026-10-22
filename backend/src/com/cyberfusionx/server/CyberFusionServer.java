package com.cyberfusionx.server;

import com.cyberfusionx.db.DatabaseManager;
import com.cyberfusionx.util.JsonUtil;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.Executors;

/**
 * CyberFusion X Java 21 Backend Server.
 * Uses JDK 21 Built-in HttpServer with Virtual Threads (Project Loom).
 */
public class CyberFusionServer {

    private static final int PORT = 8080;
    private final DatabaseManager db;
    private HttpServer server;

    public CyberFusionServer() {
        this.db = new DatabaseManager();
    }

    public static void main(String[] args) throws IOException {
        CyberFusionServer app = new CyberFusionServer();
        app.start();
    }

    public void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("0.0.0.0", PORT), 0);
        server.setExecutor(Executors.newVirtualThreadPerTaskExecutor());

        server.createContext("/api/v1/", new ApiRouter(db));

        System.out.println("==================================================================");
        System.out.println("  CYBERFUSION X // JAVA 21 VIRTUAL-THREAD FORENSIC SERVER");
        System.out.println("  Listening on: http://localhost:" + PORT);
        System.out.println("  Database: Embedded H2 SQL Engine (Auto-Initialized & Seeded)");
        System.out.println("  Concurrency: Virtual Threads Enabled (Project Loom)");
        System.out.println("==================================================================");

        server.start();
    }

    private static class ApiRouter implements HttpHandler {
        private final DatabaseManager db;

        ApiRouter(DatabaseManager db) {
            this.db = db;
        }

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            try {
                handleInternal(exchange);
            } catch (Exception e) {
                System.err.println("[Server Error] " + e.getMessage());
                e.printStackTrace();
                sendJson(exchange, 500, Map.of("error", "Internal server error: " + e.getMessage()));
            }
        }

        private void handleInternal(HttpExchange exchange) throws IOException {
            String method = exchange.getRequestMethod().toUpperCase();
            URI uri = exchange.getRequestURI();
            String path = uri.getPath();

            // Set CORS headers
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
            exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

            if ("OPTIONS".equals(method)) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }

            Map<String, String> queryParams = parseQueryParams(uri.getQuery());

            // 1. Server-Sent Events (SSE) Stream
            if (path.startsWith("/api/v1/stream/cases")) {
                handleSseStream(exchange);
                return;
            }

            String body = readBody(exchange);
            Map<String, Object> bodyJson = !body.isBlank() ? JsonUtil.parseObject(body) : new HashMap<>();

            // 2. Auth Endpoints
            if (path.equals("/api/v1/auth/demo-users") || path.equals("/api/v1/auth/users")) {
                List<Map<String, Object>> users = List.of(
                    Map.of(
                        "id", "usr-lead-01",
                        "username", "arjun.verma",
                        "fullName", "Cmdr. Arjun Verma",
                        "email", "arjun.verma@cyberfusion.mh.gov.in",
                        "role", "LEAD_INVESTIGATOR",
                        "department", "Maharashtra Cyber Crime Headquarters — BKC",
                        "clearanceBadge", "CFX-MH-COMMANDER-01"
                    ),
                    Map.of(
                        "id", "usr-an-01",
                        "username", "priya.nair",
                        "fullName", "Dr. Priya Nair",
                        "email", "priya.nair@cyberfusion.mh.gov.in",
                        "role", "FORENSIC_ANALYST",
                        "department", "Digital Forensics & Malware Analysis Lab",
                        "clearanceBadge", "CFX-MH-ANALYST-07"
                    ),
                    Map.of(
                        "id", "usr-aud-01",
                        "username", "rajesh.patil",
                        "fullName", "Rajesh Patil",
                        "email", "rajesh.patil@cyberfusion.mh.gov.in",
                        "role", "AUDITOR",
                        "department", "Compliance, BSA Section 63 & Chain-of-Custody Cell",
                        "clearanceBadge", "CFX-MH-AUDITOR-03"
                    )
                );
                sendJson(exchange, 200, Map.of("users", users));
                return;
            }

            if (path.equals("/api/v1/auth/login") && "POST".equals(method)) {
                String uname = String.valueOf(bodyJson.getOrDefault("username", "")).trim();
                Map<String, Object> user = Map.of(
                    "id", "usr-lead-01",
                    "username", !uname.isBlank() ? uname : "arjun.verma",
                    "fullName", "Cmdr. Arjun Verma",
                    "role", "LEAD_INVESTIGATOR",
                    "department", "Maharashtra Cyber Crime Headquarters"
                );
                sendJson(exchange, 200, Map.of(
                    "authenticated", true,
                    "token", "cfx-java21-jwt-" + System.currentTimeMillis(),
                    "user", user
                ));
                return;
            }

            if (path.equals("/api/v1/auth/switch-role") && "POST".equals(method)) {
                String role = String.valueOf(bodyJson.getOrDefault("role", "LEAD_INVESTIGATOR"));
                String uname = String.valueOf(bodyJson.getOrDefault("username", "arjun.verma"));
                Map<String, Object> user = Map.of(
                    "id", "usr-lead-01",
                    "username", uname,
                    "fullName", "Cmdr. Arjun Verma",
                    "role", role,
                    "department", "Maharashtra Cyber Crime Headquarters"
                );
                sendJson(exchange, 200, Map.of(
                    "authenticated", true,
                    "token", "cfx-java21-jwt-" + System.currentTimeMillis(),
                    "user", user
                ));
                return;
            }

            // 3. Citizen Complaints (POST intake & GET complaints)
            if (path.equals("/api/v1/citizen/complaints") && "POST".equals(method)) {
                Map<String, Object> result = db.saveCitizenComplaint(bodyJson);
                sendJson(exchange, 201, result);
                return;
            }

            if (path.startsWith("/api/v1/citizen/complaints") && "GET".equals(method)) {
                List<Map<String, Object>> allCases = db.getCases();
                List<Map<String, Object>> citizenCases = new ArrayList<>();
                for (Map<String, Object> c : allCases) {
                    if (c.containsKey("citizenComplaintId") && c.get("citizenComplaintId") != null) {
                        citizenCases.add(c);
                    }
                }
                sendJson(exchange, 200, Map.of("complaints", citizenCases));
                return;
            }

            // 4. Case Bank Freeze Broadcast (POST /api/v1/cases/{id}/freeze)
            if (path.matches("/api/v1/cases/[^/]+/freeze") && "POST".equals(method)) {
                String parts[] = path.split("/");
                String caseId = parts[4];
                Map<String, Object> freezeRes = db.freezeCase(caseId);
                if (freezeRes != null) {
                    sendJson(exchange, 200, freezeRes);
                } else {
                    sendJson(exchange, 404, Map.of("error", "Case not found: " + caseId));
                }
                return;
            }

            if (path.equals("/api/v1/cases/reset-demo") && "POST".equals(method)) {
                db.resetDemo();
                sendJson(exchange, 200, Map.of("status", "RESET_COMPLETE", "cases", db.getCases()));
                return;
            }

            if (path.endsWith("/reanalyze") && "POST".equals(method)) {
                sendJson(exchange, 200, Map.of("status", "REANALYZED", "cases", db.getCases()));
                return;
            }

            // 5. Case CRUD
            if (path.equals("/api/v1/cases") && "GET".equals(method)) {
                List<Map<String, Object>> cases = db.getCases();
                sendJson(exchange, 200, Map.of("cases", cases));
                return;
            }

            if (path.equals("/api/v1/cases") && "POST".equals(method)) {
                String newId = bodyJson.containsKey("id") ? String.valueOf(bodyJson.get("id"))
                        : "case-custom-" + Long.toHexString(System.currentTimeMillis()).substring(6);
                bodyJson.put("id", newId);
                if (!bodyJson.containsKey("caseNumber")) {
                    bodyJson.put("caseNumber", "CFX-2026-" + (1000 + (int)(Math.random() * 8999)));
                }
                db.saveCaseRaw(bodyJson);
                sendJson(exchange, 201, Map.of("case", bodyJson, "success", true));
                return;
            }

            if (path.startsWith("/api/v1/cases/") && ("PUT".equals(method) || "PATCH".equals(method))) {
                String caseId = path.substring("/api/v1/cases/".length()).split("/")[0];
                Map<String, Object> existing = db.getCase(caseId);
                if (existing != null) {
                    existing.putAll(bodyJson);
                    db.saveCaseRaw(existing);
                    sendJson(exchange, 200, Map.of("case", existing, "success", true));
                } else {
                    sendJson(exchange, 404, Map.of("error", "Case not found"));
                }
                return;
            }

            if (path.startsWith("/api/v1/cases/") && "DELETE".equals(method)) {
                String caseId = path.substring("/api/v1/cases/".length()).split("/")[0];
                db.deleteCase(caseId);
                sendJson(exchange, 200, Map.of("status", "DELETED", "deletedCaseId", caseId, "cases", db.getCases()));
                return;
            }

            // 6. Case Bundle Child Entities: Evidence, Entities, Graph, Timeline, Ledger, Verifications
            String targetCaseId = queryParams.getOrDefault("caseId",
                    bodyJson.containsKey("caseId") ? String.valueOf(bodyJson.get("caseId")) : "case-phantom-upi-01");
            Map<String, Object> bundle = db.getCaseBundle(targetCaseId);

            if (path.equals("/api/v1/evidence") && "GET".equals(method)) {
                Object ev = bundle.getOrDefault("evidence", Map.of("caseId", targetCaseId, "evidence", List.of()));
                sendJson(exchange, 200, ev);
                return;
            }

            if ((path.equals("/api/v1/evidence/upload") || path.equals("/api/v1/evidence")) && "POST".equals(method)) {
                String evId = "evd-" + Long.toHexString(System.currentTimeMillis());
                Map<String, Object> newEv = new LinkedHashMap<>(bodyJson);
                newEv.put("id", evId);
                newEv.put("caseId", targetCaseId);
                newEv.put("evidenceCode", "EVD-" + (100 + (int)(Math.random() * 899)));
                newEv.put("integrityStatus", "VERIFIED_INTACT");
                newEv.put("sha256Hash", "3b8a1c9e4f2081d567890123456789abcdef0123456789abcdef0123456789ab");
                newEv.put("uploadedAt", Instant.now().toString());

                @SuppressWarnings("unchecked")
                Map<String, Object> evBundle = (Map<String, Object>) bundle.get("evidence");
                if (evBundle != null) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> evList = (List<Map<String, Object>>) evBundle.get("evidence");
                    if (evList != null) evList.add(newEv);
                    db.saveCaseBundleRaw(targetCaseId, JsonUtil.toJson(bundle));
                }
                sendJson(exchange, 201, Map.of("evidence", newEv, "success", true));
                return;
            }

            if (path.equals("/api/v1/entities") && "GET".equals(method)) {
                Object ent = bundle.getOrDefault("entities", Map.of("caseId", targetCaseId, "entities", List.of(), "relationships", List.of()));
                sendJson(exchange, 200, ent);
                return;
            }

            if (path.equals("/api/v1/entities/relationship") && "POST".equals(method)) {
                String relId = "rel-" + Long.toHexString(System.currentTimeMillis());
                Map<String, Object> newRel = new LinkedHashMap<>(bodyJson);
                newRel.put("id", relId);
                newRel.put("caseId", targetCaseId);

                @SuppressWarnings("unchecked")
                Map<String, Object> entBundle = (Map<String, Object>) bundle.get("entities");
                if (entBundle != null) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> relList = (List<Map<String, Object>>) entBundle.get("relationships");
                    if (relList != null) relList.add(newRel);
                    db.saveCaseBundleRaw(targetCaseId, JsonUtil.toJson(bundle));
                }
                sendJson(exchange, 201, Map.of("relationship", newRel, "success", true));
                return;
            }

            if (path.equals("/api/v1/graph") && "GET".equals(method)) {
                Object gr = bundle.getOrDefault("graph", Map.of("caseId", targetCaseId, "nodes", List.of(), "edges", List.of()));
                sendJson(exchange, 200, gr);
                return;
            }

            if (path.equals("/api/v1/timeline") && "GET".equals(method)) {
                Object tl = bundle.getOrDefault("timeline", Map.of("caseId", targetCaseId, "timeline", List.of()));
                sendJson(exchange, 200, tl);
                return;
            }

            if (path.equals("/api/v1/timeline") && "POST".equals(method)) {
                String tlId = "evt-" + Long.toHexString(System.currentTimeMillis());
                Map<String, Object> newTl = new LinkedHashMap<>(bodyJson);
                newTl.put("id", tlId);
                newTl.put("caseId", targetCaseId);
                newTl.put("eventTimestamp", newTl.getOrDefault("eventTimestamp", Instant.now().toString()));

                @SuppressWarnings("unchecked")
                Map<String, Object> tlBundle = (Map<String, Object>) bundle.get("timeline");
                if (tlBundle != null) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> tlList = (List<Map<String, Object>>) tlBundle.get("timeline");
                    if (tlList != null) tlList.add(newTl);
                    db.saveCaseBundleRaw(targetCaseId, JsonUtil.toJson(bundle));
                }
                sendJson(exchange, 201, Map.of("event", newTl, "success", true));
                return;
            }

            if (path.equals("/api/v1/integrity/verifications") && "GET".equals(method)) {
                Object ver = bundle.getOrDefault("verifications", Map.of("caseId", targetCaseId, "verifications", List.of()));
                sendJson(exchange, 200, ver);
                return;
            }

            if (path.equals("/api/v1/integrity/ledger") && "GET".equals(method)) {
                Object led = bundle.getOrDefault("ledger", Map.of("caseId", targetCaseId, "ledger", List.of()));
                sendJson(exchange, 200, led);
                return;
            }

            if (path.equals("/api/v1/integrity/verify") && "POST".equals(method)) {
                sendJson(exchange, 200, Map.of(
                    "verification", Map.of(
                        "evidenceId", bodyJson.getOrDefault("evidenceId", "ev-01"),
                        "status", "VERIFIED_INTACT",
                        "intact", true
                    )
                ));
                return;
            }

            if (path.equals("/api/v1/integrity/simulate-tamper") && "POST".equals(method)) {
                boolean tamper = Boolean.TRUE.equals(bodyJson.get("tamper")) || "true".equals(String.valueOf(bodyJson.get("tamper")));
                sendJson(exchange, 200, Map.of(
                    "verification", Map.of(
                        "evidenceId", bodyJson.getOrDefault("evidenceId", "ev-01"),
                        "status", tamper ? "TAMPER_DETECTED" : "VERIFIED_INTACT",
                        "intact", !tamper
                    )
                ));
                return;
            }

            if (path.equals("/api/v1/integrity/verify-case") && "POST".equals(method)) {
                sendJson(exchange, 200, Map.of("status", "CASE_VERIFIED"));
                return;
            }

            if (path.equals("/api/v1/reports") && "GET".equals(method)) {
                Map<String, Object> c = db.getCase(targetCaseId);
                sendJson(exchange, 200, Map.of(
                    "status", "GENERATED",
                    "caseId", targetCaseId,
                    "caseNumber", c != null ? c.get("caseNumber") : targetCaseId,
                    "generatedAt", Instant.now().toString(),
                    "bundle", bundle
                ));
                return;
            }

            if (path.equals("/api/v1/search") && "GET".equals(method)) {
                String q = queryParams.getOrDefault("q", "").toLowerCase();
                List<Map<String, Object>> matchedCases = new ArrayList<>();
                for (Map<String, Object> c : db.getCases()) {
                    String title = String.valueOf(c.getOrDefault("title", "")).toLowerCase();
                    String victim = String.valueOf(c.getOrDefault("victimName", "")).toLowerCase();
                    String num = String.valueOf(c.getOrDefault("caseNumber", "")).toLowerCase();
                    if (title.contains(q) || victim.contains(q) || num.contains(q)) {
                        matchedCases.add(c);
                    }
                }
                sendJson(exchange, 200, Map.of("query", q, "cases", matchedCases, "entities", List.of(), "evidence", List.of()));
                return;
            }

            // Default fallback
            sendJson(exchange, 200, Map.of("status", "OK", "timestamp", Instant.now().toString()));
        }

        private void handleSseStream(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().set("Content-Type", "text/event-stream");
            exchange.getResponseHeaders().set("Cache-Control", "no-cache");
            exchange.getResponseHeaders().set("Connection", "keep-alive");
            exchange.sendResponseHeaders(200, 0);

            OutputStream os = exchange.getResponseBody();
            String initialMessage = "event: progress\ndata: {\"stage\":\"READY\",\"message\":\"Java 21 Virtual Threads & H2 DB Active\",\"percent\":100}\n\n";
            os.write(initialMessage.getBytes(StandardCharsets.UTF_8));
            os.flush();

            // Virtual thread heartbeats every 15 seconds
            try {
                for (int i = 0; i < 100; i++) {
                    Thread.sleep(15000);
                    String heartbeat = ": heartbeat " + System.currentTimeMillis() + "\n\n";
                    os.write(heartbeat.getBytes(StandardCharsets.UTF_8));
                    os.flush();
                }
            } catch (Exception ignored) {
            } finally {
                exchange.close();
            }
        }

        private String readBody(HttpExchange exchange) throws IOException {
            InputStream is = exchange.getRequestBody();
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        }

        private void sendJson(HttpExchange exchange, int status, Object data) throws IOException {
            byte[] bytes = JsonUtil.toJson(data).getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            exchange.sendResponseHeaders(status, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        }

        private Map<String, String> parseQueryParams(String query) {
            Map<String, String> map = new HashMap<>();
            if (query == null || query.isBlank()) return map;
            for (String pair : query.split("&")) {
                int eq = pair.indexOf('=');
                if (eq > 0) {
                    String k = URLDecoder.decode(pair.substring(0, eq), StandardCharsets.UTF_8);
                    String v = URLDecoder.decode(pair.substring(eq + 1), StandardCharsets.UTF_8);
                    map.put(k, v);
                }
            }
            return map;
        }
    }
}
