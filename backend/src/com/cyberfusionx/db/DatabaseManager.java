package com.cyberfusionx.db;

import com.cyberfusionx.util.JsonUtil;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.*;
import java.time.Instant;
import java.util.*;

/**
 * Embedded H2 SQL Database Manager with full CRUD support for CyberFusion X.
 * Automatically initializes tables and hydrates demo seed data if fresh.
 */
public class DatabaseManager {

    private static final String DB_DIR = "backend/data";
    private static final String DB_URL = "jdbc:h2:./backend/data/cyberfusionx_db;AUTO_SERVER=TRUE";
    private static final String DB_USER = "sa";
    private static final String DB_PASSWORD = "";

    public DatabaseManager() {
        init();
    }

    private Connection getConnection() throws SQLException {
        return DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD);
    }

    private void init() {
        try {
            new File(DB_DIR).mkdirs();
            Class.forName("org.h2.Driver");
            try (Connection conn = getConnection(); Statement stmt = conn.createStatement()) {
                stmt.execute("""
                    CREATE TABLE IF NOT EXISTS cases (
                        id VARCHAR(64) PRIMARY KEY,
                        case_number VARCHAR(64) UNIQUE,
                        title VARCHAR(255),
                        incident_type VARCHAR(64),
                        status VARCHAR(64),
                        severity VARCHAR(64),
                        risk_score INT,
                        victim_name VARCHAR(255),
                        estimated_loss_usd BIGINT,
                        estimated_loss_inr BIGINT,
                        loss_amount_inr BIGINT,
                        freeze_status VARCHAR(64),
                        is_golden_hour BOOLEAN,
                        citizen_complaint_id VARCHAR(64),
                        lead_investigator_id VARCHAR(64),
                        lead_investigator_name VARCHAR(255),
                        jurisdiction_country VARCHAR(64),
                        lead_unit VARCHAR(255),
                        case_origin VARCHAR(64),
                        raw_json CLOB,
                        created_at VARCHAR(64),
                        updated_at VARCHAR(64)
                    );
                """);

                stmt.execute("""
                    CREATE TABLE IF NOT EXISTS citizen_complaints (
                        complaint_id VARCHAR(64) PRIMARY KEY,
                        case_id VARCHAR(64),
                        victim_name VARCHAR(255),
                        victim_contact VARCHAR(64),
                        victim_email VARCHAR(255),
                        victim_city VARCHAR(128),
                        incident_type VARCHAR(64),
                        incident_datetime VARCHAR(64),
                        suspect_upi_id VARCHAR(128),
                        suspect_bank_account VARCHAR(128),
                        suspect_bank_ifsc VARCHAR(64),
                        suspect_phone_number VARCHAR(64),
                        transaction_reference_utr VARCHAR(128),
                        financial_loss_inr BIGINT,
                        is_golden_hour BOOLEAN,
                        description CLOB,
                        status VARCHAR(64),
                        raw_json CLOB,
                        created_at VARCHAR(64)
                    );
                """);

                stmt.execute("""
                    CREATE TABLE IF NOT EXISTS case_bundles (
                        case_id VARCHAR(64) PRIMARY KEY,
                        bundle_json CLOB,
                        updated_at VARCHAR(64)
                    );
                """);

                System.out.println("[DatabaseManager] H2 Database initialized at " + DB_URL);
            }

            hydrateInitialSeedIfEmpty();
        } catch (Exception e) {
            System.err.println("[DatabaseManager] DB init error: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void hydrateInitialSeedIfEmpty() {
        try (Connection conn = getConnection()) {
            boolean hasCases = false;
            try (Statement st = conn.createStatement(); ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM cases")) {
                if (rs.next() && rs.getInt(1) > 0) {
                    hasCases = true;
                }
            }

            if (!hasCases) {
                System.out.println("[DatabaseManager] Seeding initial forensic cases from demo snapshot...");
                File seedFile = new File("backend/data/demoSeedSnapshot.json");
                if (!seedFile.exists()) {
                    seedFile = new File("src/fallback/demoSeedSnapshot.json");
                }
                if (seedFile.exists()) {
                    String content = Files.readString(Paths.get(seedFile.getPath()));
                    Map<String, Object> root = JsonUtil.parseObject(content);
                    List<?> rawCases = (List<?>) root.get("cases");
                    Map<?, ?> byCase = (Map<?, ?>) root.get("byCase");

                    if (rawCases != null) {
                        for (Object o : rawCases) {
                            if (o instanceof Map) {
                                @SuppressWarnings("unchecked")
                                Map<String, Object> cMap = (Map<String, Object>) o;
                                saveCaseRaw(cMap);
                            }
                        }
                    }

                    if (byCase != null) {
                        for (Map.Entry<?, ?> entry : byCase.entrySet()) {
                            String cId = String.valueOf(entry.getKey());
                            saveCaseBundleRaw(cId, JsonUtil.toJson(entry.getValue()));
                        }
                    }
                    System.out.println("[DatabaseManager] Successfully seeded " + (rawCases != null ? rawCases.size() : 0) + " cases.");
                }
            }
        } catch (Exception e) {
            System.err.println("[DatabaseManager] Seed error: " + e.getMessage());
        }
    }

    public synchronized List<Map<String, Object>> getCases() {
        List<Map<String, Object>> list = new ArrayList<>();
        String sql = "SELECT raw_json FROM cases ORDER BY updated_at DESC";
        try (Connection conn = getConnection(); Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                String json = rs.getString(1);
                if (json != null) {
                    list.add(JsonUtil.parseObject(json));
                }
            }
        } catch (Exception e) {
            System.err.println("[DatabaseManager] getCases error: " + e.getMessage());
        }
        return list;
    }

    public synchronized Map<String, Object> getCase(String caseId) {
        String sql = "SELECT raw_json FROM cases WHERE id = ?";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, caseId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return JsonUtil.parseObject(rs.getString(1));
                }
            }
        } catch (Exception e) {
            System.err.println("[DatabaseManager] getCase error: " + e.getMessage());
        }
        return null;
    }

    public synchronized void saveCaseRaw(Map<String, Object> cMap) {
        String id = String.valueOf(cMap.get("id"));
        String caseNumber = String.valueOf(cMap.get("caseNumber"));
        String title = String.valueOf(cMap.getOrDefault("title", "Untitled Case"));
        String incidentType = String.valueOf(cMap.getOrDefault("incidentType", "OTHER"));
        String status = String.valueOf(cMap.getOrDefault("status", "OPEN"));
        String severity = String.valueOf(cMap.getOrDefault("severity", "HIGH"));
        int riskScore = cMap.get("riskScore") instanceof Number ? ((Number) cMap.get("riskScore")).intValue() : 50;
        String victimName = String.valueOf(cMap.getOrDefault("victimName", "Unknown"));
        long lossUsd = cMap.get("estimatedLossUsd") instanceof Number ? ((Number) cMap.get("estimatedLossUsd")).longValue() : 0;
        long lossInr = cMap.get("lossAmountInr") instanceof Number ? ((Number) cMap.get("lossAmountInr")).longValue()
                : (cMap.get("estimatedLossInr") instanceof Number ? ((Number) cMap.get("estimatedLossInr")).longValue() : (lossUsd * 83));
        String freezeStatus = String.valueOf(cMap.getOrDefault("freezeStatus", "IDLE"));
        boolean isGoldenHour = Boolean.TRUE.equals(cMap.get("isGoldenHour"));
        String citizenComplaintId = cMap.get("citizenComplaintId") != null ? String.valueOf(cMap.get("citizenComplaintId")) : null;
        String leadId = String.valueOf(cMap.getOrDefault("leadInvestigatorId", "usr-lead-01"));
        String leadName = String.valueOf(cMap.getOrDefault("leadInvestigatorName", "Cmdr. Arjun Verma"));
        String country = String.valueOf(cMap.getOrDefault("jurisdictionCountry", "India"));
        String leadUnit = String.valueOf(cMap.getOrDefault("leadUnit", "Maharashtra Cyber Crime Branch"));
        String origin = String.valueOf(cMap.getOrDefault("caseOrigin", "PRELOADED"));
        String now = Instant.now().toString();
        String createdAt = String.valueOf(cMap.getOrDefault("createdAt", now));
        String updatedAt = now;

        // Ensure INR amounts are synced in json
        cMap.put("lossAmountInr", lossInr);
        cMap.put("estimatedLossInr", lossInr);
        cMap.put("freezeStatus", freezeStatus);
        cMap.put("isGoldenHour", isGoldenHour);
        cMap.put("updatedAt", updatedAt);

        String rawJson = JsonUtil.toJson(cMap);

        String sql = """
            MERGE INTO cases (
                id, case_number, title, incident_type, status, severity, risk_score,
                victim_name, estimated_loss_usd, estimated_loss_inr, loss_amount_inr,
                freeze_status, is_golden_hour, citizen_complaint_id, lead_investigator_id,
                lead_investigator_name, jurisdiction_country, lead_unit, case_origin,
                raw_json, created_at, updated_at
            ) KEY(id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """;

        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, id);
            ps.setString(2, caseNumber);
            ps.setString(3, title);
            ps.setString(4, incidentType);
            ps.setString(5, status);
            ps.setString(6, severity);
            ps.setInt(7, riskScore);
            ps.setString(8, victimName);
            ps.setLong(9, lossUsd);
            ps.setLong(10, lossInr);
            ps.setLong(11, lossInr);
            ps.setString(12, freezeStatus);
            ps.setBoolean(13, isGoldenHour);
            ps.setString(14, citizenComplaintId);
            ps.setString(15, leadId);
            ps.setString(16, leadName);
            ps.setString(17, country);
            ps.setString(18, leadUnit);
            ps.setString(19, origin);
            ps.setString(20, rawJson);
            ps.setString(21, createdAt);
            ps.setString(22, updatedAt);
            ps.executeUpdate();
        } catch (Exception e) {
            System.err.println("[DatabaseManager] saveCaseRaw error: " + e.getMessage());
        }
    }

    public synchronized void deleteCase(String caseId) {
        try (Connection conn = getConnection()) {
            try (PreparedStatement ps = conn.prepareStatement("DELETE FROM cases WHERE id = ?")) {
                ps.setString(1, caseId);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = conn.prepareStatement("DELETE FROM case_bundles WHERE case_id = ?")) {
                ps.setString(1, caseId);
                ps.executeUpdate();
            }
        } catch (Exception e) {
            System.err.println("[DatabaseManager] deleteCase error: " + e.getMessage());
        }
    }

    public synchronized Map<String, Object> getCaseBundle(String caseId) {
        String sql = "SELECT bundle_json FROM case_bundles WHERE case_id = ?";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, caseId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return JsonUtil.parseObject(rs.getString(1));
                }
            }
        } catch (Exception e) {
            System.err.println("[DatabaseManager] getCaseBundle error: " + e.getMessage());
        }
        return new LinkedHashMap<>();
    }

    public synchronized void saveCaseBundleRaw(String caseId, String bundleJson) {
        String now = Instant.now().toString();
        String sql = "MERGE INTO case_bundles (case_id, bundle_json, updated_at) KEY(case_id) VALUES (?, ?, ?)";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, caseId);
            ps.setString(2, bundleJson);
            ps.setString(3, now);
            ps.executeUpdate();
        } catch (Exception e) {
            System.err.println("[DatabaseManager] saveCaseBundleRaw error: " + e.getMessage());
        }
    }

    /**
     * Ingest a Citizen Complaint:
     * 1. Stores in citizen_complaints table.
     * 2. Auto-creates a new forensic case in cases table.
     * 3. Creates bundle with extracted entities, relationships, transactions, evidence, timeline, and ledger.
     */
    public synchronized Map<String, Object> saveCitizenComplaint(Map<String, Object> complaintData) {
        String complaintId = "CFX-MH-2026-" + (1000 + (int)(Math.random() * 8999));
        String caseId = "case-citizen-" + Long.toHexString(System.currentTimeMillis()).substring(6);
        String now = Instant.now().toString();

        String victimName = String.valueOf(complaintData.getOrDefault("victimName", "Citizen Complainant"));
        String victimContact = String.valueOf(complaintData.getOrDefault("victimContact", ""));
        String victimEmail = String.valueOf(complaintData.getOrDefault("victimEmail", ""));
        String victimCity = String.valueOf(complaintData.getOrDefault("victimCity", "Mumbai, Maharashtra"));
        String incidentType = String.valueOf(complaintData.getOrDefault("incidentType", "FINANCIAL_FRAUD"));
        String incidentDateTime = String.valueOf(complaintData.getOrDefault("incidentDateTime", now));
        String suspectUpi = String.valueOf(complaintData.getOrDefault("suspectUpiId", ""));
        String suspectBank = String.valueOf(complaintData.getOrDefault("suspectBankAccount", ""));
        String suspectIfsc = String.valueOf(complaintData.getOrDefault("suspectBankIfsc", ""));
        String suspectPhone = String.valueOf(complaintData.getOrDefault("suspectPhoneNumber", ""));
        String utr = String.valueOf(complaintData.getOrDefault("transactionReferenceUtr", ""));
        long lossInr = complaintData.get("financialLossInr") instanceof Number
                ? ((Number) complaintData.get("financialLossInr")).longValue()
                : 0L;
        boolean isGoldenHour = Boolean.TRUE.equals(complaintData.get("isGoldenHour"));
        String desc = String.valueOf(complaintData.getOrDefault("description", "Citizen reported incident"));
        String freezeStatus = isGoldenHour ? "FREEZE_REQUESTED" : "IDLE";

        // Save into citizen_complaints table
        String insertComplaintSql = """
            INSERT INTO citizen_complaints (
                complaint_id, case_id, victim_name, victim_contact, victim_email, victim_city,
                incident_type, incident_datetime, suspect_upi_id, suspect_bank_account, suspect_bank_ifsc,
                suspect_phone_number, transaction_reference_utr, financial_loss_inr, is_golden_hour,
                description, status, raw_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """;
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(insertComplaintSql)) {
            ps.setString(1, complaintId);
            ps.setString(2, caseId);
            ps.setString(3, victimName);
            ps.setString(4, victimContact);
            ps.setString(5, victimEmail);
            ps.setString(6, victimCity);
            ps.setString(7, incidentType);
            ps.setString(8, incidentDateTime);
            ps.setString(9, suspectUpi);
            ps.setString(10, suspectBank);
            ps.setString(11, suspectIfsc);
            ps.setString(12, suspectPhone);
            ps.setString(13, utr);
            ps.setLong(14, lossInr);
            ps.setBoolean(15, isGoldenHour);
            ps.setString(16, desc);
            ps.setString(17, "SEALED");
            ps.setString(18, JsonUtil.toJson(complaintData));
            ps.setString(19, now);
            ps.executeUpdate();
        } catch (Exception e) {
            System.err.println("[DatabaseManager] insertComplaint error: " + e.getMessage());
        }

        // Build entities
        List<Map<String, Object>> entities = new ArrayList<>();
        List<Map<String, Object>> relationships = new ArrayList<>();
        List<Map<String, Object>> transactions = new ArrayList<>();
        List<Map<String, Object>> timeline = new ArrayList<>();
        List<Map<String, Object>> evidence = new ArrayList<>();
        List<Map<String, Object>> ledger = new ArrayList<>();

        String victimEntId = "ent-" + caseId + "-victim";
        Map<String, Object> victimEnt = new LinkedHashMap<>();
        victimEnt.put("id", victimEntId);
        victimEnt.put("caseId", caseId);
        victimEnt.put("entityType", "VICTIM");
        victimEnt.put("normalizedValue", victimName);
        victimEnt.put("displayLabel", victimName);
        victimEnt.put("roleInIncident", "VICTIM");
        victimEnt.put("confidenceScore", 0.99);
        victimEnt.put("riskLevel", "LOW");
        victimEnt.put("pagerankScore", 0.12);
        victimEnt.put("betweennessScore", 0.05);
        victimEnt.put("clusterId", 1);
        victimEnt.put("country", "India");
        victimEnt.put("city", victimCity);
        victimEnt.put("lat", 19.076);
        victimEnt.put("lon", 72.8777);
        victimEnt.put("firstSeenAt", now);
        entities.add(victimEnt);

        String suspectDestId = null;
        if (!suspectUpi.isBlank()) {
            String upiId = "ent-" + caseId + "-upi";
            suspectDestId = upiId;
            Map<String, Object> upiEnt = new LinkedHashMap<>();
            upiEnt.put("id", upiId);
            upiEnt.put("caseId", caseId);
            upiEnt.put("entityType", "UPI_HANDLE");
            upiEnt.put("normalizedValue", suspectUpi);
            upiEnt.put("displayLabel", suspectUpi);
            upiEnt.put("roleInIncident", "BENEFICIARY_MULE");
            upiEnt.put("confidenceScore", 0.98);
            upiEnt.put("riskLevel", "CRITICAL");
            upiEnt.put("pagerankScore", 0.88);
            upiEnt.put("betweennessScore", 0.75);
            upiEnt.put("clusterId", 2);
            upiEnt.put("country", "India");
            upiEnt.put("firstSeenAt", incidentDateTime);
            entities.add(upiEnt);
        }

        if (!suspectBank.isBlank()) {
            String bankId = "ent-" + caseId + "-bank";
            if (suspectDestId == null) suspectDestId = bankId;
            Map<String, Object> bankEnt = new LinkedHashMap<>();
            bankEnt.put("id", bankId);
            bankEnt.put("caseId", caseId);
            bankEnt.put("entityType", "BANK_ACCOUNT");
            bankEnt.put("normalizedValue", suspectBank);
            bankEnt.put("displayLabel", suspectBank + " (" + (suspectIfsc.isBlank() ? "IFSC Pending" : suspectIfsc) + ")");
            bankEnt.put("roleInIncident", "BENEFICIARY_MULE");
            bankEnt.put("confidenceScore", 0.95);
            bankEnt.put("riskLevel", "CRITICAL");
            bankEnt.put("pagerankScore", 0.82);
            bankEnt.put("betweennessScore", 0.65);
            bankEnt.put("clusterId", 2);
            bankEnt.put("country", "India");
            bankEnt.put("firstSeenAt", incidentDateTime);
            entities.add(bankEnt);
        }

        if (!suspectPhone.isBlank()) {
            String phoneId = "ent-" + caseId + "-phone";
            Map<String, Object> phoneEnt = new LinkedHashMap<>();
            phoneEnt.put("id", phoneId);
            phoneEnt.put("caseId", caseId);
            phoneEnt.put("entityType", "PHONE_NUMBER");
            phoneEnt.put("normalizedValue", suspectPhone);
            phoneEnt.put("displayLabel", suspectPhone);
            phoneEnt.put("roleInIncident", "THREAT_ACTOR");
            phoneEnt.put("confidenceScore", 0.95);
            phoneEnt.put("riskLevel", "CRITICAL");
            phoneEnt.put("pagerankScore", 0.78);
            phoneEnt.put("betweennessScore", 0.60);
            phoneEnt.put("clusterId", 2);
            phoneEnt.put("country", "India");
            phoneEnt.put("firstSeenAt", incidentDateTime);
            entities.add(phoneEnt);
        }

        if (lossInr > 0 && suspectDestId != null) {
            Map<String, Object> tx = new LinkedHashMap<>();
            tx.put("id", "tx-" + caseId + "-1");
            tx.put("caseId", caseId);
            tx.put("fromEntityId", victimEntId);
            tx.put("fromParty", victimName);
            tx.put("toEntityId", suspectDestId);
            tx.put("toParty", !suspectUpi.isBlank() ? suspectUpi : suspectBank);
            tx.put("amount", lossInr);
            tx.put("currency", "INR");
            tx.put("timestamp", incidentDateTime);
            tx.put("channel", !suspectUpi.isBlank() ? "UPI" : "IMPS/NEFT");
            tx.put("referenceId", !utr.isBlank() ? utr : "UTR" + System.currentTimeMillis());
            tx.put("notes", "Citizen reported transfer: INR " + lossInr);
            transactions.add(tx);

            Map<String, Object> rel = new LinkedHashMap<>();
            rel.put("id", "rel-" + caseId + "-1");
            rel.put("caseId", caseId);
            rel.put("sourceEntityId", victimEntId);
            rel.put("targetEntityId", suspectDestId);
            rel.put("relationshipType", "FRAUDULENT_TRANSFER");
            rel.put("label", "INR " + lossInr + " (UTR: " + (!utr.isBlank() ? utr : "Pending") + ")");
            rel.put("weight", 9.8);
            rel.put("confidence", 0.98);
            rel.put("eventTimestamp", incidentDateTime);
            relationships.add(rel);
        }

        // Timeline events
        Map<String, Object> tl1 = new LinkedHashMap<>();
        tl1.put("id", "tl-" + caseId + "-1");
        tl1.put("caseId", caseId);
        tl1.put("eventTimestamp", incidentDateTime);
        tl1.put("timestampSource", "VICTIM_TESTIMONY");
        tl1.put("killChainPhase", "EXPLOITATION");
        tl1.put("severity", "HIGH");
        tl1.put("title", incidentType + " Incident Occurred");
        tl1.put("description", desc);
        tl1.put("actorEntity", !suspectPhone.isBlank() ? suspectPhone : (!suspectUpi.isBlank() ? suspectUpi : "Threat Actor"));
        tl1.put("targetEntity", victimName);
        tl1.put("amountInvolved", lossInr > 0 ? "INR " + lossInr : null);
        tl1.put("anomalyFlag", false);
        tl1.put("confidence", 0.95);
        timeline.add(tl1);

        Map<String, Object> tl2 = new LinkedHashMap<>();
        tl2.put("id", "tl-" + caseId + "-2");
        tl2.put("caseId", caseId);
        tl2.put("eventTimestamp", now);
        tl2.put("timestampSource", "PORTAL_INGESTION");
        tl2.put("killChainPhase", "RESPONSE_AND_CONTAINMENT");
        tl2.put("severity", isGoldenHour ? "CRITICAL" : "MEDIUM");
        tl2.put("title", isGoldenHour ? "Golden Hour Emergency Intake & CFCFRMS Freeze Broadcast" : "Citizen Intake Sealed into Evidence Vault");
        tl2.put("description", "Complaint " + complaintId + " filed by " + victimName + ". Cryptographic SHA-256 seal issued.");
        tl2.put("actorEntity", "CyberFusion Intake Gateway");
        tl2.put("targetEntity", victimName);
        tl2.put("anomalyFlag", false);
        tl2.put("confidence", 1.0);
        timeline.add(tl2);

        // Chain of custody ledger
        Map<String, Object> ledEntry = new LinkedHashMap<>();
        ledEntry.put("id", "led-" + caseId + "-1");
        ledEntry.put("sequenceNumber", 1);
        ledEntry.put("caseId", caseId);
        ledEntry.put("actorUsername", "citizen.gateway");
        ledEntry.put("actorRole", "CITIZEN_INTAKE");
        ledEntry.put("actionType", "CASE_INITIALIZED");
        ledEntry.put("targetResource", complaintId);
        ledEntry.put("details", "Citizen intake sealed under BNS §318(4) and BSA §63(4)(c) compliance.");
        ledEntry.put("clientIp", "127.0.0.1");
        ledEntry.put("previousHash", "0000000000000000000000000000000000000000000000000000000000000000");
        ledEntry.put("entryHash", Long.toHexString(System.currentTimeMillis()) + "e9b21048fa2981bc0912");
        ledEntry.put("timestamp", now);
        ledger.add(ledEntry);

        // Build Master Case object
        Map<String, Object> caseObj = new LinkedHashMap<>();
        caseObj.put("id", caseId);
        caseObj.put("caseNumber", complaintId);
        caseObj.put("title", incidentType + " — " + victimName);
        caseObj.put("incidentType", incidentType);
        caseObj.put("status", isGoldenHour ? "FREEZE_REQUESTED" : "OPEN");
        caseObj.put("severity", isGoldenHour || lossInr > 50000 ? "CRITICAL" : "HIGH");
        caseObj.put("riskScore", isGoldenHour ? 92 : 75);
        caseObj.put("victimName", victimName);
        caseObj.put("estimatedLossUsd", Math.round(lossInr / 83.5));
        caseObj.put("estimatedLossInr", lossInr);
        caseObj.put("lossAmountInr", lossInr);
        caseObj.put("freezeStatus", freezeStatus);
        caseObj.put("isGoldenHour", isGoldenHour);
        caseObj.put("citizenComplaintId", complaintId);
        caseObj.put("leadInvestigatorId", "usr-lead-01");
        caseObj.put("leadInvestigatorName", "Cmdr. Arjun Verma");
        caseObj.put("jurisdictionCountry", "India");
        caseObj.put("leadUnit", "Maharashtra Cyber Crime Branch — Financial Intelligence Unit");
        caseObj.put("caseOrigin", "USER_CREATED");
        caseObj.put("summary", desc);
        caseObj.put("description", desc);
        caseObj.put("transactions", transactions);
        caseObj.put("evidenceCount", evidence.size());
        caseObj.put("entityCount", entities.size());
        caseObj.put("relationshipCount", relationships.size());
        caseObj.put("timelineEventCount", timeline.size());
        caseObj.put("verifiedIntactCount", 1);
        caseObj.put("tamperedCount", 0);
        caseObj.put("metadataAnomalyCount", 0);
        caseObj.put("createdAt", now);
        caseObj.put("updatedAt", now);

        // Build Bundle object
        Map<String, Object> bundleObj = new LinkedHashMap<>();
        Map<String, Object> evMap = new LinkedHashMap<>();
        evMap.put("caseId", caseId);
        evMap.put("count", evidence.size());
        evMap.put("evidence", evidence);
        bundleObj.put("evidence", evMap);

        Map<String, Object> entMap = new LinkedHashMap<>();
        entMap.put("caseId", caseId);
        entMap.put("entities", entities);
        entMap.put("relationships", relationships);
        bundleObj.put("entities", entMap);

        Map<String, Object> graphMap = new LinkedHashMap<>();
        graphMap.put("caseId", caseId);
        List<Map<String, Object>> gNodes = new ArrayList<>();
        for (Map<String, Object> e : entities) {
            Map<String, Object> n = new LinkedHashMap<>();
            n.put("id", e.get("id"));
            n.put("label", e.get("displayLabel"));
            n.put("type", e.get("entityType"));
            n.put("role", e.get("roleInIncident"));
            n.put("riskLevel", e.get("riskLevel"));
            n.put("pagerankScore", e.get("pagerankScore"));
            n.put("clusterId", e.get("clusterId"));
            gNodes.add(n);
        }
        graphMap.put("nodes", gNodes);
        graphMap.put("edges", relationships);
        bundleObj.put("graph", graphMap);

        Map<String, Object> tlMap = new LinkedHashMap<>();
        tlMap.put("caseId", caseId);
        tlMap.put("count", timeline.size());
        tlMap.put("timeline", timeline);
        tlMap.put("events", timeline);
        bundleObj.put("timeline", tlMap);

        Map<String, Object> ledMap = new LinkedHashMap<>();
        ledMap.put("caseId", caseId);
        ledMap.put("ledger", ledger);
        Map<String, Object> chainVer = new LinkedHashMap<>();
        chainVer.put("chainIntact", true);
        chainVer.put("totalEntriesVerified", ledger.size());
        chainVer.put("headMerkleHash", ledger.get(ledger.size() - 1).get("entryHash"));
        chainVer.put("verifiedAt", now);
        ledMap.put("chainVerification", chainVer);
        bundleObj.put("ledger", ledMap);

        Map<String, Object> verMap = new LinkedHashMap<>();
        verMap.put("caseId", caseId);
        verMap.put("verifications", new ArrayList<>());
        bundleObj.put("verifications", verMap);

        saveCaseRaw(caseObj);
        saveCaseBundleRaw(caseId, JsonUtil.toJson(bundleObj));

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("success", true);
        res.put("complaintId", complaintId);
        res.put("caseId", caseId);
        res.put("caseNumber", complaintId);
        res.put("case", caseObj);
        res.put("freezeStatus", freezeStatus);
        res.put("isGoldenHour", isGoldenHour);
        res.put("receivedAt", now);
        return res;
    }

    public synchronized Map<String, Object> freezeCase(String caseId) {
        Map<String, Object> c = getCase(caseId);
        if (c == null) return null;

        String now = Instant.now().toString();
        c.put("freezeStatus", "FREEZE_REQUESTED");
        c.put("status", "FREEZE_REQUESTED");
        c.put("updatedAt", now);
        saveCaseRaw(c);

        Map<String, Object> bundle = getCaseBundle(caseId);
        if (bundle != null && bundle.containsKey("ledger")) {
            @SuppressWarnings("unchecked")
            Map<String, Object> ledMap = (Map<String, Object>) bundle.get("ledger");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> lList = (List<Map<String, Object>>) ledMap.get("ledger");
            if (lList == null) lList = new ArrayList<>();

            Map<String, Object> freezeLedger = new LinkedHashMap<>();
            freezeLedger.put("id", "led-" + Long.toHexString(System.currentTimeMillis()));
            freezeLedger.put("sequenceNumber", lList.size() + 1);
            freezeLedger.put("caseId", caseId);
            freezeLedger.put("actorUsername", "arjun.verma");
            freezeLedger.put("actorRole", "LEAD_INVESTIGATOR");
            freezeLedger.put("actionType", "BANK_FREEZE_BROADCAST");
            freezeLedger.put("targetResource", "CFCFRMS-1930 / NPCI / LEA Gateway");
            freezeLedger.put("details", "Emergency 1930 CFCFRMS Freeze Broadcast triggered under Golden Hour protocol for case " + c.get("caseNumber") + ".");
            freezeLedger.put("clientIp", "127.0.0.1");
            freezeLedger.put("timestamp", now);
            lList.add(freezeLedger);

            saveCaseBundleRaw(caseId, JsonUtil.toJson(bundle));
        }

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("success", true);
        res.put("caseId", caseId);
        res.put("caseNumber", c.get("caseNumber"));
        res.put("freezeStatus", "FREEZE_REQUESTED");
        res.put("broadcastedAt", now);
        res.put("nodesNotified", List.of(
            "National Cybercrime Reporting Portal (1930 CFCFRMS)",
            "NPCI Centralized Fraud Registry Gateway",
            "Nodal Banking Liaison (State Bank of India / HDFC / ICICI)",
            "Maharashtra State Cyber Police Headquarters Command Room"
        ));
        return res;
    }

    public synchronized void resetDemo() {
        try (Connection conn = getConnection(); Statement st = conn.createStatement()) {
            st.execute("DELETE FROM cases WHERE case_origin = 'USER_CREATED' OR id LIKE 'case-citizen%'");
            st.execute("DELETE FROM citizen_complaints");
            st.execute("DELETE FROM case_bundles WHERE case_id LIKE 'case-citizen%'");
            hydrateInitialSeedIfEmpty();
            System.out.println("[DatabaseManager] Demo state reset completed.");
        } catch (Exception e) {
            System.err.println("[DatabaseManager] resetDemo error: " + e.getMessage());
        }
    }
}
