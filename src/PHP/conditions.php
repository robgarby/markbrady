<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

register_shutdown_function(function () {
    $error = error_get_last();
    if ($error !== null) {
        if (!headers_sent()) {
            http_response_code(500);
            header("Content-Type: application/json; charset=UTF-8");
        }

        echo json_encode([
            "success" => false,
            "fatal" => true,
            "type" => $error["type"] ?? null,
            "message" => $error["message"] ?? "",
            "file" => $error["file"] ?? "",
            "line" => $error["line"] ?? null
        ]);
    }
});

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

$servername = "localhost";
$db_username = "gdmt_gdmt";
$db_password = "fiksoz-xYhwej-kevna9";
$dbname = "gdmt_gdmt";

$conn = new mysqli($servername, $db_username, $db_password, $dbname);
$conn->query("SET SESSION sql_mode = ''");
$conn->set_charset("utf8mb4");

if ($conn->connect_error) {
    echo json_encode([
        "success" => false,
        "message" => "Database connection failed",
        "error" => $conn->connect_error
    ]);
    exit;
}

$input = file_get_contents("php://input");
$data = json_decode($input, true);

if (!is_array($data)) {
    $data = [];
}

$script = $data["script"] ?? ($data["scriptName"] ?? "");

if ($script === "getConditionTranslation") {
    getConditionTranslation($conn, $data);
    exit;
}

if ($script === "rebuildConditionTranslation") {
    rebuildConditionTranslation($conn);
    exit;
}

if ($script === "processConditionTranslation") {
    processConditionTranslation($conn);
    exit;
}

if ($script === "saveConditionTranslation") {
    saveConditionTranslation($conn, $data);
    exit;
}

echo json_encode([
    "success" => false,
    "message" => "Invalid script",
    "scriptReceived" => $script
]);
exit;

function normalizeConditionName($value)
{
    $value = trim((string) $value);
    $value = preg_replace('/\s+/', ' ', $value);
    $value = trim($value, ",");
    return $value;
}

function parseCsvList($value)
{
    $value = trim((string) $value);
    if ($value === "") {
        return [];
    }

    $parts = explode(",", $value);
    $returnArray = [];
    $seen = [];

    foreach ($parts as $part) {
        $item = normalizeConditionName($part);

        if ($item === "" || $item === "-") {
            continue;
        }

        $key = mb_strtolower($item, "UTF-8");
        if (!isset($seen[$key])) {
            $seen[$key] = true;
            $returnArray[] = $item;
        }
    }

    return $returnArray;
}

function getConditionTranslation($conn, $data)
{
    $isLinked = trim($data["isLinked"] ?? "All");

    $sql = "SELECT ID, conditionName, conditionCode, IsLinked
            FROM conditionTranslation";

    if ($isLinked === "Yes" || $isLinked === "No") {
        $safeIsLinked = $conn->real_escape_string($isLinked);
        $sql .= " WHERE IsLinked = '{$safeIsLinked}'";
    }

    $sql .= " ORDER BY conditionName ASC";

    $result = $conn->query($sql);

    if (!$result) {
        echo json_encode([
            "success" => false,
            "message" => "Error loading conditionTranslation",
            "error" => $conn->error
        ]);
        exit;
    }

    $returnArray = [];

    while ($row = $result->fetch_assoc()) {
        $returnArray[] = [
            "ID" => $row["ID"],
            "conditionName" => $row["conditionName"],
            "conditionCode" => $row["conditionCode"],
            "IsLinked" => $row["IsLinked"]
        ];
    }

    echo json_encode([
        "success" => true,
        "data" => $returnArray,
        "count" => count($returnArray),
        "filter" => $isLinked
    ]);
    exit;
}

function rebuildConditionTranslation($conn)
{
    $sqlPatient = "SELECT conditionsFull FROM Patient WHERE conditionsFull IS NOT NULL AND TRIM(conditionsFull) <> ''";
    $resultPatient = $conn->query($sqlPatient);

    if (!$resultPatient) {
        echo json_encode([
            "success" => false,
            "message" => "Error reading Patient.conditionsFull",
            "error" => $conn->error
        ]);
        exit;
    }

    $uniqueConditions = [];

    while ($row = $resultPatient->fetch_assoc()) {
        $conditionsFull = (string) ($row["conditionsFull"] ?? "");
        if ($conditionsFull === "") {
            continue;
        }

        $parts = explode(",", $conditionsFull);

        foreach ($parts as $part) {
            $conditionName = normalizeConditionName($part);

            if ($conditionName === "" || $conditionName === "-") {
                continue;
            }

            $key = mb_strtolower($conditionName, "UTF-8");
            $uniqueConditions[$key] = $conditionName;
        }
    }

    $checked = 0;
    $inserted = 0;
    $alreadyExists = 0;

    $checkStmt = $conn->prepare("
        SELECT ID
        FROM conditionTranslation
        WHERE LOWER(TRIM(conditionName)) = LOWER(TRIM(?))
        LIMIT 1
    ");

    if (!$checkStmt) {
        echo json_encode([
            "success" => false,
            "message" => "Prepare failed for condition check",
            "error" => $conn->error
        ]);
        exit;
    }

    $insertStmt = $conn->prepare("
        INSERT INTO conditionTranslation (conditionName, conditionCode, IsLinked)
        VALUES (?, '-', 'No')
    ");

    if (!$insertStmt) {
        $checkStmt->close();
        echo json_encode([
            "success" => false,
            "message" => "Prepare failed for condition insert",
            "error" => $conn->error
        ]);
        exit;
    }

    foreach ($uniqueConditions as $conditionName) {
        $checked++;

        $checkStmt->bind_param("s", $conditionName);

        if (!$checkStmt->execute()) {
            $checkStmt->close();
            $insertStmt->close();

            echo json_encode([
                "success" => false,
                "message" => "Execute failed while checking conditionTranslation",
                "error" => $checkStmt->error,
                "conditionName" => $conditionName
            ]);
            exit;
        }

        $checkResult = $checkStmt->get_result();

        if ($checkResult && $checkResult->num_rows > 0) {
            $alreadyExists++;
            continue;
        }

        $insertStmt->bind_param("s", $conditionName);

        if (!$insertStmt->execute()) {
            $checkStmt->close();
            $insertStmt->close();

            echo json_encode([
                "success" => false,
                "message" => "Execute failed while inserting conditionTranslation",
                "error" => $insertStmt->error,
                "conditionName" => $conditionName
            ]);
            exit;
        }

        $inserted++;
    }

    $checkStmt->close();
    $insertStmt->close();

    $sqlReturn = "
        SELECT ID, conditionName, conditionCode, IsLinked
        FROM conditionTranslation
        WHERE IsLinked = 'No'
        ORDER BY conditionName ASC
    ";

    $resultReturn = $conn->query($sqlReturn);

    if (!$resultReturn) {
        echo json_encode([
            "success" => false,
            "message" => "Rebuild completed, but failed to return unlinked conditions",
            "error" => $conn->error
        ]);
        exit;
    }

    $returnArray = [];

    while ($row = $resultReturn->fetch_assoc()) {
        $returnArray[] = [
            "ID" => $row["ID"],
            "conditionName" => $row["conditionName"],
            "conditionCode" => $row["conditionCode"],
            "IsLinked" => $row["IsLinked"]
        ];
    }

    echo json_encode([
        "success" => true,
        "message" => "Condition translation rebuild complete",
        "checked" => $checked,
        "inserted" => $inserted,
        "alreadyExists" => $alreadyExists,
        "data" => $returnArray,
        "count" => count($returnArray)
    ]);
    exit;
}

function processConditionTranslation($conn)
{
    // ───────────────────────── CONDITIONS LOOKUP ─────────────────────────
    $translationSql = "
        SELECT conditionName, conditionCode, IsLinked
        FROM conditionTranslation
        WHERE conditionCode IS NOT NULL
          AND TRIM(conditionCode) <> ''
    ";

    $translationResult = $conn->query($translationSql);

    if (!$translationResult) {
        echo json_encode([
            "success" => false,
            "message" => "Error loading conditionTranslation.",
            "error" => $conn->error
        ]);
        exit;
    }

    $translationMap = [];

    while ($row = $translationResult->fetch_assoc()) {
        $conditionName = normalizeConditionName($row["conditionName"] ?? "");
        $conditionCode = trim((string) ($row["conditionCode"] ?? ""));
        $isLinked = trim((string) ($row["IsLinked"] ?? ""));

        if ($conditionName === "" || $conditionCode === "") {
            continue;
        }

        if (strcasecmp($isLinked, "Yes") !== 0) {
            continue;
        }

        if (strcasecmp($conditionCode, "IGNORE") === 0) {
            continue;
        }

        $key = mb_strtolower($conditionName, "UTF-8");
        $translationMap[$key] = $conditionCode;
    }

    // ───────────────────────── MEDICATION LOOKUP ─────────────────────────
    $medSql = "
        SELECT DIN, catID
        FROM medications_2026
        WHERE DIN IS NOT NULL
          AND TRIM(DIN) <> ''
          AND catID IS NOT NULL
          AND TRIM(catID) <> ''
    ";

    $medResult = $conn->query($medSql);

    if (!$medResult) {
        echo json_encode([
            "success" => false,
            "message" => "Error loading medications_2026.",
            "error" => $conn->error
        ]);
        exit;
    }

    $dinToCatMap = [];

    while ($row = $medResult->fetch_assoc()) {
        $din = trim((string) ($row["DIN"] ?? ""));
        $catID = trim((string) ($row["catID"] ?? ""));

        if ($din === "" || $catID === "") {
            continue;
        }

        // normalize DIN so 12345-678 or spaced values still match
        $dinKey = preg_replace('/\D+/', '', $din);
        if ($dinKey === "") {
            continue;
        }

        if (!isset($dinToCatMap[$dinKey])) {
            $dinToCatMap[$dinKey] = [];
        }

        $catKey = mb_strtolower($catID, "UTF-8");
        $alreadyExists = false;

        foreach ($dinToCatMap[$dinKey] as $existingCat) {
            if (mb_strtolower($existingCat, "UTF-8") === $catKey) {
                $alreadyExists = true;
                break;
            }
        }

        if (!$alreadyExists) {
            $dinToCatMap[$dinKey][] = $catID;
        }
    }

    // ───────────────────────── LOAD PATIENTS ─────────────────────────
    $patientSql = "
        SELECT id, healthNumber, conditionsFull, conditionData, medsData, medCatSearch
        FROM Patient
        WHERE (
            conditionsFull IS NOT NULL
            AND TRIM(conditionsFull) <> ''
        )
        OR (
            medsData IS NOT NULL
            AND TRIM(medsData) <> ''
        )
    ";

    $patientResult = $conn->query($patientSql);

    if (!$patientResult) {
        echo json_encode([
            "success" => false,
            "message" => "Error loading Patient rows.",
            "error" => $conn->error
        ]);
        exit;
    }

    $updateStmt = $conn->prepare("
        UPDATE Patient
        SET conditionData = ?, medCatSearch = ?
        WHERE id = ?
        LIMIT 1
    ");

    if (!$updateStmt) {
        echo json_encode([
            "success" => false,
            "message" => "Prepare failed while updating Patient.conditionData / medCatSearch.",
            "error" => $conn->error
        ]);
        exit;
    }

    $patientsChecked = 0;
    $patientsUpdated = 0;
    $patientsUnchanged = 0;

    $conditionMatchesFound = 0;
    $conditionCodesAdded = 0;

    $medDinsMatched = 0;
    $medCatCodesAdded = 0;

    $updatedPatients = [];

    while ($patient = $patientResult->fetch_assoc()) {
        $patientsChecked++;

        $patientId = intval($patient["id"] ?? 0);
        $healthNumber = (string) ($patient["healthNumber"] ?? "");
        $conditionsFull = (string) ($patient["conditionsFull"] ?? "");
        $existingConditionData = (string) ($patient["conditionData"] ?? "");
        $medsData = (string) ($patient["medsData"] ?? "");
        $existingMedCatSearch = (string) ($patient["medCatSearch"] ?? "");

        if ($patientId <= 0) {
            continue;
        }

        // ───────── CONDITIONS PROCESSING ─────────
        $conditionNames = parseCsvList($conditionsFull);
        $existingCodes = parseCsvList($existingConditionData);

        $mergedCodes = $existingCodes;
        $existingConditionLookup = [];

        foreach ($mergedCodes as $code) {
            $existingConditionLookup[mb_strtolower(trim($code), "UTF-8")] = true;
        }

        $matchedNamesThisPatient = 0;
        $addedConditionCodesThisPatient = 0;

        foreach ($conditionNames as $conditionName) {
            $normalizedName = normalizeConditionName($conditionName);
            $lookupKey = mb_strtolower($normalizedName, "UTF-8");

            if (!isset($translationMap[$lookupKey])) {
                continue;
            }

            $matchedNamesThisPatient++;

            $translatedCode = trim((string) $translationMap[$lookupKey]);
            $translatedKey = mb_strtolower($translatedCode, "UTF-8");

            if ($translatedCode === "") {
                continue;
            }

            if (!isset($existingConditionLookup[$translatedKey])) {
                $existingConditionLookup[$translatedKey] = true;
                $mergedCodes[] = $translatedCode;
                $addedConditionCodesThisPatient++;
            }
        }

        $conditionMatchesFound += $matchedNamesThisPatient;
        $conditionCodesAdded += $addedConditionCodesThisPatient;

        // ───────── MEDICATION PROCESSING ─────────
        $dinList = parseCsvList($medsData);
        $existingMedCats = parseCsvList($existingMedCatSearch);

        $mergedMedCats = $existingMedCats;
        $existingMedLookup = [];

        foreach ($mergedMedCats as $cat) {
            $existingMedLookup[mb_strtolower(trim($cat), "UTF-8")] = true;
        }

        $matchedDinsThisPatient = 0;
        $addedMedCatsThisPatient = 0;

        foreach ($dinList as $din) {
            $dinKey = preg_replace('/\D+/', '', (string) $din);

            if ($dinKey === "" || !isset($dinToCatMap[$dinKey])) {
                continue;
            }

            $matchedDinsThisPatient++;

            foreach ($dinToCatMap[$dinKey] as $catID) {
                $catID = trim((string) $catID);
                if ($catID === "") {
                    continue;
                }

                $catKey = mb_strtolower($catID, "UTF-8");

                if (!isset($existingMedLookup[$catKey])) {
                    $existingMedLookup[$catKey] = true;
                    $mergedMedCats[] = $catID;
                    $addedMedCatsThisPatient++;
                }
            }
        }

        $medDinsMatched += $matchedDinsThisPatient;
        $medCatCodesAdded += $addedMedCatsThisPatient;

        $newConditionData = implode(",", $mergedCodes);
        $oldConditionData = implode(",", $existingCodes);

        $newMedCatSearch = implode(",", $mergedMedCats);
        $oldMedCatSearch = implode(",", $existingMedCats);

        if ($newConditionData !== $oldConditionData || $newMedCatSearch !== $oldMedCatSearch) {
            $updateStmt->bind_param("ssi", $newConditionData, $newMedCatSearch, $patientId);

            if (!$updateStmt->execute()) {
                $stmtError = $updateStmt->error;
                $updateStmt->close();

                echo json_encode([
                    "success" => false,
                    "message" => "Execute failed while updating Patient.",
                    "error" => $stmtError,
                    "patientID" => $patientId,
                    "healthNumber" => $healthNumber
                ]);
                exit;
            }

            $patientsUpdated++;
            $updatedPatients[] = [
                "id" => $patientId,
                "healthNumber" => $healthNumber,
                "conditionData" => $newConditionData,
                "medCatSearch" => $newMedCatSearch,
                "conditionCodesAdded" => $addedConditionCodesThisPatient,
                "medCatsAdded" => $addedMedCatsThisPatient
            ];
        } else {
            $patientsUnchanged++;
        }
    }

    $updateStmt->close();

    echo json_encode([
        "success" => true,
        "message" => "Condition translation and medication category processing complete.",
        "patientsChecked" => $patientsChecked,
        "patientsUpdated" => $patientsUpdated,
        "patientsUnchanged" => $patientsUnchanged,
        "conditionMatchesFound" => $conditionMatchesFound,
        "conditionCodesAdded" => $conditionCodesAdded,
        "medDinsMatched" => $medDinsMatched,
        "medCatCodesAdded" => $medCatCodesAdded,
        "updatedPatients" => $updatedPatients
    ]);
    exit;
}


function saveConditionTranslation($conn, $data)
{
    $translationID = intval($data["translationID"] ?? 0);
    $conditionCode = trim($data["conditionCode"] ?? "");
    $isLinked = trim($data["IsLinked"] ?? "Yes");

    if ($translationID <= 0) {
        echo json_encode([
            "success" => false,
            "message" => "Invalid conditionTranslation ID.",
            "receivedTranslationID" => $data["translationID"] ?? null
        ]);
        exit;
    }

    if ($conditionCode === "") {
        echo json_encode([
            "success" => false,
            "message" => "Missing conditionCode."
        ]);
        exit;
    }

    $checkStmt = $conn->prepare("
        SELECT ID, conditionName
        FROM conditionTranslation
        WHERE ID = ?
        LIMIT 1
    ");

    if (!$checkStmt) {
        echo json_encode([
            "success" => false,
            "message" => "Prepare failed while checking conditionTranslation row.",
            "error" => $conn->error
        ]);
        exit;
    }

    $checkStmt->bind_param("i", $translationID);

    if (!$checkStmt->execute()) {
        echo json_encode([
            "success" => false,
            "message" => "Execute failed while checking conditionTranslation row.",
            "error" => $checkStmt->error
        ]);
        $checkStmt->close();
        exit;
    }

    $checkResult = $checkStmt->get_result();
    $existingRow = $checkResult ? $checkResult->fetch_assoc() : null;
    $checkStmt->close();

    if (!$existingRow) {
        echo json_encode([
            "success" => false,
            "message" => "conditionTranslation row not found.",
            "receivedTranslationID" => $translationID
        ]);
        exit;
    }

    $stmt = $conn->prepare("
        UPDATE conditionTranslation
        SET conditionCode = ?, IsLinked = ?
        WHERE ID = ?
        LIMIT 1
    ");

    if (!$stmt) {
        echo json_encode([
            "success" => false,
            "message" => "Prepare failed while saving conditionTranslation.",
            "error" => $conn->error
        ]);
        exit;
    }

    $stmt->bind_param("ssi", $conditionCode, $isLinked, $translationID);

    if (!$stmt->execute()) {
        echo json_encode([
            "success" => false,
            "message" => "Save failed.",
            "error" => $stmt->error
        ]);
        $stmt->close();
        exit;
    }

    $stmt->close();

    echo json_encode([
        "success" => true,
        "message" => "Condition translation saved.",
        "translationID" => $translationID,
        "conditionCode" => $conditionCode,
        "IsLinked" => $isLinked
    ]);
    exit;
}
?>