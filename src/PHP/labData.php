<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

register_shutdown_function(function () {
    $error = error_get_last();
    if ($error !== null) {
        if (!headers_sent()) {
            http_response_code(500);
            header("Content-Type: application/json");
        }

        echo json_encode([
            'success' => false,
            'fatal' => true,
            'type' => $error['type'] ?? null,
            'message' => $error['message'] ?? '',
            'file' => $error['file'] ?? '',
            'line' => $error['line'] ?? null
        ]);
    }
});

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json");

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    echo json_encode([
        'success' => true,
        'message' => 'OPTIONS OK'
    ]);
    exit;
}

$servername = "localhost";
$db_username = "gdmt_gdmt";
$db_password = "fiksoz-xYhwej-kevna9";
$dbname = "gdmt_gdmt";

$conn = new mysqli($servername, $db_username, $db_password, $dbname);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database connection failed',
        'details' => $conn->connect_error
    ]);
    exit;
}

$conn->query("SET SESSION sql_mode = ''");

$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid JSON payload',
        'rawInput' => $input
    ]);
    exit;
}

$patientTable = !empty($data['patientDB']) && is_string($data['patientDB'])
    ? trim($data['patientDB'])
    : 'Patient';

$historyTable = !empty($data['historyDB']) && is_string($data['historyDB'])
    ? trim($data['historyDB'])
    : 'Patient_History';

/* -------------------------------------------------------
   Helpers
------------------------------------------------------- */

function normalizeHealthNumber($hcn)
{
    $digits = preg_replace('/\D+/', '', (string) $hcn);
    if (strlen($digits) >= 10) {
        $digits = substr($digits, 0, 10);
        return substr($digits, 0, 4) . ' ' . substr($digits, 4, 3) . ' ' . substr($digits, 7, 3);
    }
    return trim((string) $hcn);
}

function normalizeDateYmdValue($dateIn)
{
    $dateIn = trim((string) $dateIn);
    if ($dateIn === '') {
        return '';
    }

    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateIn)) {
        return $dateIn;
    }

    if (preg_match('/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/', $dateIn, $m)) {
        $dd = str_pad($m[1], 2, '0', STR_PAD_LEFT);
        $mm = str_pad($m[2], 2, '0', STR_PAD_LEFT);
        $yy = $m[3];
        return $yy . '-' . $mm . '-' . $dd;
    }

    $ts = strtotime($dateIn);
    if ($ts === false) {
        return '';
    }

    return date('Y-m-d', $ts);
}

function digitsOnlyValue($v)
{
    return preg_replace('/\D+/', '', (string) $v);
}

function normalizeDoseValue($dose)
{
    $dose = trim((string) $dose);
    if ($dose === '') {
        return '';
    }

    $dose = preg_replace('/\s+/', '', $dose);
    $dose = preg_replace('/ml/i', 'mL', $dose);
    $dose = preg_replace('/iu/i', 'IU', $dose);

    return $dose;
}

function extractDoseFromMedicationNameValue($name)
{
    $name = trim((string) $name);
    if ($name === '') {
        return '';
    }

    if (preg_match('/(\d+(?:\.\d+)?\s*mm\s*\/\s*\d+(?:\.\d+)?\s*g)\s*$/i', $name, $m)) {
        return normalizeDoseValue(strtoupper($m[1]));
    }

    if (preg_match('/(\d+(?:\.\d+)?\s*(?:mcg|mg|g|kg|ml|mL|l|L|%|units|iu|IU)\s*(?:\/\s*\d+(?:\.\d+)?\s*(?:mcg|mg|g|kg|ml|mL|l|L|%|units|iu|IU))+)\s*$/i', $name, $m)) {
        return normalizeDoseValue($m[1]);
    }

    if (preg_match('/(\d+(?:\.\d+)?\s*(?:mcg|mg|g|kg|ml|mL|l|L|%|units|iu|IU))\s*$/i', $name, $m)) {
        return normalizeDoseValue($m[1]);
    }

    return '';
}

function stripDoseFromMedicationNameValue($name)
{
    $name = trim((string) $name);
    if ($name === '') {
        return '';
    }

    if (preg_match('/^([^\s]+)/', $name, $m)) {
        return $m[1];
    }

    return $name;
}

function arrToCsvValue($arr)
{
    if (!is_array($arr)) {
        return '';
    }

    $clean = [];
    foreach ($arr as $x) {
        $v = trim((string) $x);
        if ($v !== '') {
            $clean[] = $v;
        }
    }

    return implode(',', $clean);
}

function bindParamsByRef($stmt, $types, &$values)
{
    $refs = [];
    $refs[] = $types;
    foreach ($values as $k => $v) {
        $refs[] = &$values[$k];
    }
    return call_user_func_array([$stmt, 'bind_param'], $refs);
}

function insertToHistory($conn, $data, $historyTable)
{
    $patient = $data['patient'] ?? [];
    $labResults = $patient['labResults'] ?? [];

    $healthNumber = normalizeHealthNumber($patient['healthNumber'] ?? '');
    $orderDate = normalizeDateYmdValue($patient['orderDate'] ?? '');

    if ($healthNumber === '') {
        echo json_encode([
            'success' => false,
            'error' => 'Missing health number for Patient_History insert'
        ]);
        return false;
    }

    $labFields = [
        'cholesterol',
        'triglyceride',
        'hdl',
        'ldl',
        'nonHdl',
        'cholesterolHdlRatio',
        'creatineKinase',
        'alanineAminotransferase',
        'lipoproteinA',
        'apolipoproteinB',
        'natriureticPeptideB',
        'urea',
        'creatinine',
        'gfr',
        'albumin',
        'sodium',
        'potassium',
        'vitaminB12',
        'ferritin',
        'hemoglobinA1C',
        'urineAlbumin',
        'albuminCreatinineRatio'
    ];

    $columns = ['healthNumber', 'orderDate'];
    $values = [$healthNumber, ($orderDate !== '' ? $orderDate : null)];
    $types = 'ss';

    foreach ($labFields as $field) {
        $value = trim((string) ($labResults[$field] ?? ''));
        $value = ($value !== '') ? $value : null;
        $dateValue = ($value !== null && $orderDate !== '') ? $orderDate : null;

        $columns[] = $field;
        $columns[] = $field . 'Date';

        $values[] = $value;
        $values[] = $dateValue;

        $types .= 'ss';
    }

    $placeholders = implode(', ', array_fill(0, count($columns), '?'));
    $columnSql = '`' . implode('`, `', $columns) . '`';
    $sql = "INSERT INTO `$historyTable` ($columnSql) VALUES ($placeholders)";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        echo json_encode([
            'success' => false,
            'error' => 'Prepare failed for Patient_History insert',
            'details' => $conn->error,
            'sql' => $sql,
            'columnCount' => count($columns),
            'valueCount' => count($values)
        ]);
        return false;
    }

    bindParamsByRef($stmt, $types, $values);

    if ($stmt->execute()) {
        $stmt->close();
        return true;
    }

    echo json_encode([
        'success' => false,
        'error' => 'Failed to insert into Patient_History',
        'details' => $stmt->error
    ]);
    $stmt->close();
    return false;
}

function refreshPatientLabCount($conn, $patientTable, $historyTable, $healthNumber)
{
    $stmtCount = $conn->prepare("
        SELECT COUNT(*) AS totalLabs
        FROM `$historyTable`
        WHERE healthNumber = ?
    ");

    if (!$stmtCount) {
        return [
            'success' => false,
            'error' => 'Prepare failed (count history labs)',
            'details' => $conn->error
        ];
    }

    $stmtCount->bind_param("s", $healthNumber);

    if (!$stmtCount->execute()) {
        $err = [
            'success' => false,
            'error' => 'Execute failed (count history labs)',
            'details' => $stmtCount->error
        ];
        $stmtCount->close();
        return $err;
    }

    $res = $stmtCount->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $labCount = (int) ($row['totalLabs'] ?? 0);
    $stmtCount->close();

    $stmtUpdate = $conn->prepare("
        UPDATE `$patientTable`
        SET labCount = ?
        WHERE healthNumber = ?
    ");

    if (!$stmtUpdate) {
        return [
            'success' => false,
            'error' => 'Prepare failed (update labCount)',
            'details' => $conn->error
        ];
    }

    $stmtUpdate->bind_param("is", $labCount, $healthNumber);

    if (!$stmtUpdate->execute()) {
        $err = [
            'success' => false,
            'error' => 'Execute failed (update labCount)',
            'details' => $stmtUpdate->error
        ];
        $stmtUpdate->close();
        return $err;
    }

    $stmtUpdate->close();

    return [
        'success' => true,
        'labCount' => $labCount
    ];
}

function updateClient($nextAppointment, $data, $conn, $patientTable, $historyTable)
{
    $patient = $data['patient'] ?? [];
    $healthNumber = normalizeHealthNumber($patient['healthNumber'] ?? '');
    $labResults = $patient['labResults'] ?? [];
    $orderDate = normalizeDateYmdValue($patient['orderDate'] ?? '');

    if ($healthNumber === '') {
        echo json_encode([
            'success' => false,
            'error' => 'Missing health number'
        ]);
        exit;
    }

    $historyOk = insertToHistory($conn, $data, $historyTable);
    if (!$historyOk) {
        exit;
    }

    $labCountResult = refreshPatientLabCount($conn, $patientTable, $historyTable, $healthNumber);
    if (!$labCountResult['success']) {
        echo json_encode($labCountResult);
        exit;
    }

    $safeHealthNumber = $conn->real_escape_string($healthNumber);
    $cc = $conn->query("SELECT * FROM `$patientTable` WHERE healthNumber = '$safeHealthNumber' LIMIT 1");
    $client = $cc ? $cc->fetch_assoc() : null;

    $sets = [];
    foreach ($labResults as $key => $value) {
        if ($value === '' || $value === null) {
            continue;
        }

        if (!preg_match('/^[A-Za-z0-9_]+$/', $key)) {
            continue;
        }

        $safeValue = $conn->real_escape_string((string) $value);
        $existingDate = $client["{$key}Date"] ?? null;

        if ($existingDate && $orderDate && $existingDate >= $orderDate) {
            continue;
        }

        $sets[] = "`$key` = '$safeValue'";
        if ($orderDate) {
            $sets[] = "`{$key}Date` = '" . $conn->real_escape_string($orderDate) . "'";
        }
    }

    $safeNextAppointment = $conn->real_escape_string((string) $nextAppointment);

    if (!empty($sets)) {
        $sql = "UPDATE `$patientTable`
                SET " . implode(', ', $sets) . ", nextAppointment = '$safeNextAppointment'
                WHERE healthNumber = '$safeHealthNumber'";

        if ($conn->query($sql)) {
            echo json_encode([
                'success' => true,
                'status' => 'updated',
                'labCount' => $labCountResult['labCount']
            ]);
            exit;
        }
    }

    $sql = "UPDATE `$patientTable`
            SET nextAppointment = '$safeNextAppointment'
            WHERE healthNumber = '$safeHealthNumber'";

    if ($conn->query($sql)) {
        echo json_encode([
            'success' => true,
            'status' => 'updated',
            'labCount' => $labCountResult['labCount']
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'error' => 'Update failed',
            'details' => $conn->error
        ]);
    }
    exit;
}

/* -------------------------------------------------------
   Dynacare / Lab routes
------------------------------------------------------- */

if (($data['scriptName'] ?? '') === 'validateLabByHCN') {
    $healthNumber = normalizeHealthNumber($data['healthNumber'] ?? '');
    $orderDate = normalizeDateYmdValue($data['orderDate'] ?? '');

    if ($healthNumber === '') {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Missing health number'
        ]);
        exit;
    }

    $response = [
        'success' => true,
        'patientExists' => 0,
        'historyExists' => 0,
        'healthNumber' => $healthNumber,
        'orderDate' => $orderDate
    ];

    $stmt = $conn->prepare("SELECT COUNT(*) AS cnt FROM `$patientTable` WHERE TRIM(healthNumber) = ?");
    if (!$stmt) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Prepare failed (patient lookup)',
            'details' => $conn->error
        ]);
        exit;
    }

    $stmt->bind_param("s", $healthNumber);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : ['cnt' => 0];
    $response['patientExists'] = (int) ($row['cnt'] ?? 0);
    $stmt->close();

    if ($orderDate !== '') {
        $stmtH = $conn->prepare("SELECT COUNT(*) AS cnt FROM `$historyTable` WHERE TRIM(healthNumber) = ? AND orderDate = ?");
        if (!$stmtH) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error' => 'Prepare failed (history lookup)',
                'details' => $conn->error
            ]);
            exit;
        }

        $stmtH->bind_param("ss", $healthNumber, $orderDate);
        $stmtH->execute();
        $resH = $stmtH->get_result();
        $rowH = $resH ? $resH->fetch_assoc() : ['cnt' => 0];
        $response['historyExists'] = (int) ($rowH['cnt'] ?? 0);
        $stmtH->close();
    }

    echo json_encode($response);
    $conn->close();
    exit;
}

if (($data['scriptName'] ?? '') === 'updateExistingLabByHCN') {
    $nextAppointment = $data['nextAppointment'] ?? '1970-01-01';
    updateClient($nextAppointment, $data, $conn, $patientTable, $historyTable);
}

if (($data['scriptName'] ?? '') === 'getPatientByHealthNumber') {
    $healthNumber = normalizeHealthNumber($data['healthNumber'] ?? '');
    if ($healthNumber === '') {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Missing health number'
        ]);
        exit;
    }

    $stmt = $conn->prepare("SELECT * FROM `$patientTable` WHERE healthNumber = ?");
    if (!$stmt) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Prepare failed',
            'details' => $conn->error
        ]);
        exit;
    }

    $stmt->bind_param('s', $healthNumber);

    if ($stmt->execute()) {
        $result = $stmt->get_result();
        $patient = $result->fetch_assoc();
        echo json_encode([
            'success' => true,
            'patient' => $patient
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Query failed',
            'details' => $stmt->error
        ]);
    }

    $stmt->close();
    $conn->close();
    exit;
}

/* -------------------------------------------------------
   Pharmacy routes
------------------------------------------------------- */

if (($data['scriptName'] ?? '') === 'getProvider') {
    $providerTable = 'pharmacyIDTable';
    $providerTableData = [];

    $sql = "SELECT * FROM `$providerTable`";
    $res = $conn->query($sql);
    if ($res && $res->num_rows > 0) {
        while ($row = $res->fetch_assoc()) {
            $providerTableData[] = $row;
        }
    }

    echo json_encode([
        'success' => true,
        'provider' => $providerTableData
    ]);
    exit;
}

if (($data['scriptName'] ?? '') === 'findPoints') {
    $medications = $data['medications'] ?? [];
    if (!is_array($medications)) {
        $medications = [];
    }

    $categoryTable = "medCats2026";
    $categoryNameCol = "catName";
    $categoryPointsCol = "catPoints";
    $categoryStatusCol = "catStatus";
    $categoryIdCol = "ID";
    $medsLookupTable = "meds2026";

    $stmtCheckDin = $conn->prepare("SELECT 1 FROM medications_2026 WHERE DIN = ? LIMIT 1");
    if (!$stmtCheckDin) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Prepare failed (check DIN)', 'details' => $conn->error]);
        exit;
    }

    $stmtExistingPts = $conn->prepare("
        SELECT COALESCE(c.`$categoryPointsCol`, m.medPoints, 0) AS pts
        FROM medications_2026 m
        LEFT JOIN `$categoryTable` c ON c.`$categoryIdCol` = CAST(m.catID AS UNSIGNED)
        WHERE m.DIN = ?
        LIMIT 1
    ");
    if (!$stmtExistingPts) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Prepare failed (existing points)', 'details' => $conn->error]);
        exit;
    }

    $stmtSearchMeds = $conn->prepare("
        SELECT drugCat, drugBrand, pointValue
        FROM `$medsLookupTable`
        WHERE drugName LIKE ?
        LIMIT 1
    ");
    if (!$stmtSearchMeds) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Prepare failed (search meds2026)', 'details' => $conn->error]);
        exit;
    }

    $stmtCatLookup = $conn->prepare("
        SELECT `$categoryIdCol` AS catID, `$categoryPointsCol` AS catPoints, `$categoryStatusCol` AS catStatus
        FROM `$categoryTable`
        WHERE `$categoryNameCol` = ?
        LIMIT 1
    ");
    if (!$stmtCatLookup) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Prepare failed (category lookup)', 'details' => $conn->error]);
        exit;
    }

    $stmtInsert = $conn->prepare("
        INSERT INTO medications_2026
          (medication, medication_dose, DIN, medication_cat, medication_brand, catID, medPoints, medicationUsed)
        VALUES
          (?, ?, ?, ?, ?, NULLIF(?, ''), ?, ?)
    ");
    if (!$stmtInsert) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Prepare failed (insert)', 'details' => $conn->error]);
        exit;
    }

    $inserted = 0;
    $skippedExistingDin = 0;
    $unknownCats = 0;
    $errors = [];
    $dinString = "";
    $totalPoints = 0;
    $dinPoints = [];
    $dinPointsString = "";
    $dinTotalCheck = 0;

    foreach ($medications as $m) {
        $medName = trim((string) ($m['medication'] ?? $m['Medication'] ?? $m['drugName'] ?? ''));
        $dinRaw = (string) ($m['din'] ?? $m['DIN'] ?? $m['Din'] ?? '');
        $din = digitsOnlyValue($dinRaw);

        if ($medName === '' || $din === '') {
            continue;
        }

        $dinString .= $din . ",";

        $stmtCheckDin->bind_param("s", $din);
        if (!$stmtCheckDin->execute()) {
            $errors[] = "Check DIN failed for din={$din} ({$stmtCheckDin->error})";
            continue;
        }

        $res = $stmtCheckDin->get_result();
        if ($res && $res->num_rows > 0) {
            $skippedExistingDin++;

            $pts = 0;
            $src = "existing_catPoints_or_medPoints";

            $stmtExistingPts->bind_param("s", $din);
            if ($stmtExistingPts->execute()) {
                $rPts = $stmtExistingPts->get_result();
                if ($rPts && $rPts->num_rows > 0) {
                    $rowPts = $rPts->fetch_assoc();
                    $pts = (int) ($rowPts['pts'] ?? 0);
                }
            }

            $totalPoints += $pts;
            $dinPoints[] = [
                "din" => $din,
                "pointsUsed" => $pts,
                "source" => $src,
                "status" => "existing"
            ];
            $dinPointsString .= $din . ":" . $pts . "|";
            $dinTotalCheck += $pts;
            continue;
        }

        $doseIn = trim((string) ($m['medication_dose'] ?? $m['dose'] ?? ''));
        $dose = $doseIn !== '' ? normalizeDoseValue($doseIn) : extractDoseFromMedicationNameValue($medName);

        $drugCat = 'unknown';
        $drugBrand = 'unknown';
        $pointValue = 0;

        $baseName = stripDoseFromMedicationNameValue($medName);
        if ($baseName !== '') {
            $like = $baseName . "%";
            $stmtSearchMeds->bind_param("s", $like);

            if ($stmtSearchMeds->execute()) {
                $r2 = $stmtSearchMeds->get_result();
                if ($r2 && $r2->num_rows > 0) {
                    $row = $r2->fetch_assoc();
                    if (!empty($row['drugCat'])) {
                        $drugCat = (string) $row['drugCat'];
                    }
                    if (!empty($row['drugBrand'])) {
                        $drugBrand = (string) $row['drugBrand'];
                    }
                    if ($row['pointValue'] !== null && $row['pointValue'] !== '') {
                        $pointValue = (int) $row['pointValue'];
                    }
                }
            } else {
                $errors[] = "Search meds2026 failed for like={$like} ({$stmtSearchMeds->error})";
            }
        }

        $catIDToInsert = '';
        $medPointsToInsert = (int) $pointValue;
        $medicationUsed = 'No';
        $foundCategory = false;

        if ($drugCat !== 'unknown' && trim($drugCat) !== '') {
            $catName = trim($drugCat);

            $stmtCatLookup->bind_param("s", $catName);
            if ($stmtCatLookup->execute()) {
                $rCat = $stmtCatLookup->get_result();
                if ($rCat && $rCat->num_rows > 0) {
                    $catRow = $rCat->fetch_assoc();

                    $foundCatID = (string) ($catRow['catID'] ?? '');
                    $foundPoints = (int) ($catRow['catPoints'] ?? 0);
                    $foundStatus = (string) ($catRow['catStatus'] ?? 'No');

                    if ($foundCatID !== '') {
                        $catIDToInsert = $foundCatID;
                        $medPointsToInsert = $foundPoints;
                        $medicationUsed = $foundStatus;
                        $foundCategory = true;
                    }
                }
            } else {
                $errors[] = "Category lookup failed for cat={$catName} ({$stmtCatLookup->error})";
            }
        }

        if (!$foundCategory) {
            $unknownCats++;
        }

        $pts = (int) $medPointsToInsert;
        $src = $foundCategory ? "catPoints" : "pointValue_fallback";

        $totalPoints += $pts;
        $dinPoints[] = [
            "din" => $din,
            "pointsUsed" => $pts,
            "source" => $src,
            "status" => "inserted",
            "category" => $drugCat,
            "catID" => $catIDToInsert
        ];
        $dinPointsString .= $din . ":" . $pts . "|";
        $dinTotalCheck += $pts;

        $stmtInsert->bind_param(
            "ssssssis",
            $medName,
            $dose,
            $din,
            $drugCat,
            $drugBrand,
            $catIDToInsert,
            $medPointsToInsert,
            $medicationUsed
        );

        if (!$stmtInsert->execute()) {
            $errors[] = "Insert failed for din={$din} med={$medName} ({$stmtInsert->error})";
            continue;
        }

        $inserted++;
    }

    $dinString = rtrim($dinString, ',');
    $dinPointsString = rtrim($dinPointsString, '|');

    $healthNumber = normalizeHealthNumber($data['healthNumber'] ?? '');
    if ($dinString !== '' && $healthNumber !== '') {
        $stmtUpdate = $conn->prepare("UPDATE `$patientTable` SET medsData = ? WHERE healthNumber = ?");
        if ($stmtUpdate) {
            $stmtUpdate->bind_param("ss", $dinString, $healthNumber);
            if (!$stmtUpdate->execute()) {
                $errors[] = "Failed to update Patient.medsData for healthNumber={$healthNumber} ({$stmtUpdate->error})";
            }
            $stmtUpdate->close();
        } else {
            $errors[] = "Prepare failed for Patient.medsData update ({$conn->error})";
        }
    }

    $stmtCheckDin->close();
    $stmtExistingPts->close();
    $stmtSearchMeds->close();
    $stmtCatLookup->close();
    $stmtInsert->close();

    echo json_encode([
        'success' => true,
        'inserted' => $inserted,
        'skippedExistingDin' => $skippedExistingDin,
        'totalPoints' => $totalPoints,
        'unknownCats' => $unknownCats,
        'dinString' => $dinString,
        'dinPointsString' => $dinPointsString,
        'dinTotalCheck' => $dinTotalCheck,
        'dinPoints' => $dinPoints,
        'errors' => $errors
    ]);
    exit;
}

if (($data['scriptName'] ?? '') === 'savePatientInfo') {
    $table = !empty($data['patientDB']) && is_string($data['patientDB'])
        ? trim($data['patientDB'])
        : 'Patient';

    $historyTable = !empty($data['historyDB']) && is_string($data['historyDB'])
        ? trim($data['historyDB'])
        : 'Patient_History';

    $healthNumberIn = (string) ($data['healthNumber'] ?? ($data['patientData']['healthNumber'] ?? ''));
    $healthNumber = normalizeHealthNumber($healthNumberIn);
    $healthNumberDigits = digitsOnlyValue($healthNumberIn);

    if ($healthNumber === '' || strlen($healthNumberDigits) < 8) {
        echo json_encode([
            'success' => false,
            'error' => 'Missing or invalid healthNumber'
        ]);
        exit;
    }

    $patientData = $data['patientData'] ?? [];
    if (!is_array($patientData)) {
        $patientData = [];
    }

    $allData = json_encode($data, JSON_UNESCAPED_UNICODE);
    if ($allData === false) {
        $allData = '{}';
    }

    $dataPoint = (string) ($data['dataPoint'] ?? date('Y-m-d'));
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dataPoint)) {
        $dataPoint = date('Y-m-d');
    }

    $pharmacyID = trim((string) ($data['pharmacyID'] ?? ''));
    $totalPoints = (int) ($data['totalPoints'] ?? 0);

    $name = trim((string) ($patientData['name'] ?? $patientData['clientName'] ?? ''));
    $dob = normalizeDateYmdValue($patientData['dateOfBirth'] ?? '');

    $street = trim((string) ($patientData['street'] ?? ($patientData['addressData']['street'] ?? '')));
    $city = trim((string) ($patientData['city'] ?? ($patientData['addressData']['city'] ?? '')));
    $province = trim((string) ($patientData['province'] ?? ($patientData['addressData']['province'] ?? '')));
    $postalCode = trim((string) ($patientData['postalCode'] ?? ($patientData['addressData']['postalCode'] ?? '')));
    $fullAddress = trim((string) ($patientData['fullAddress'] ?? ($patientData['addressData']['fullAddress'] ?? '')));
    $addressBillingChunk = trim((string) ($patientData['addressBillingChunk'] ?? ($patientData['billingData']['addressBillingChunk'] ?? '')));

    $allergiesCsv = arrToCsvValue($patientData['allergies'] ?? []);
    $conditionsCsv = arrToCsvValue($patientData['conditions'] ?? []);
    $privateNote = trim((string) ($patientData['privateNote'] ?? ''));

    $medsData = trim((string) ($data['medsData'] ?? ''));

    $medicationsIn = $data['medications'] ?? [];
    if (!is_array($medicationsIn)) {
        $medicationsIn = [];
    }

    $medSlim = [];
    foreach ($medicationsIn as $m) {
        if (!is_array($m)) {
            continue;
        }

        $din = substr(digitsOnlyValue($m['din'] ?? ''), 0, 8);
        if (strlen($din) !== 8) {
            continue;
        }

        $lastFill = trim((string) ($m['lastFill'] ?? ''));
        $medSlim[] = [
            'din' => $din,
            'lastFill' => $lastFill
        ];
    }

    $medJson = json_encode($medSlim, JSON_UNESCAPED_UNICODE);
    if ($medJson === false) {
        $medJson = '[]';
    }

    $realHCN = (strlen($healthNumberDigits) === 10) ? 'Yes' : 'No';

    $sqlExists = "SELECT id FROM `$table` WHERE healthNumber = ? LIMIT 1";
    $stmtExists = $conn->prepare($sqlExists);
    if (!$stmtExists) {
        echo json_encode([
            'success' => false,
            'error' => 'Prepare failed (exists)',
            'details' => $conn->error
        ]);
        exit;
    }

    $stmtExists->bind_param('s', $healthNumber);
    if (!$stmtExists->execute()) {
        echo json_encode([
            'success' => false,
            'error' => 'Execute failed (exists)',
            'details' => $stmtExists->error
        ]);
        $stmtExists->close();
        exit;
    }

    $res = $stmtExists->get_result();
    $exists = ($res && $res->num_rows > 0);
    $stmtExists->close();

    if ($exists) {
        $sqlUp = "UPDATE `$table`
                  SET patientSource = 'pharmacy',
                      allDataSave = ?,
                      dataPoint = ?,
                      pharmacyID = ?,
                      clientName = ?,
                      dateOfBirth = ?,
                      street = ?,
                      city = ?,
                      province = ?,
                      postalCode = ?,
                      fullAddress = ?,
                      addressBillingChunk = ?,
                      allergies = ?,
                      conditionsFull = ?,
                      medsData = ?,
                      medications = ?,
                      totalPoints = ?,
                      realHCN = ?,
                      privateNote = ?
                  WHERE healthNumber = ?";

        $stmtUp = $conn->prepare($sqlUp);
        if (!$stmtUp) {
            echo json_encode([
                'success' => false,
                'error' => 'Prepare failed (update)',
                'details' => $conn->error
            ]);
            exit;
        }

        $stmtUp->bind_param(
            'sssssssssssssssisss',
            $allData,
            $dataPoint,
            $pharmacyID,
            $name,
            $dob,
            $street,
            $city,
            $province,
            $postalCode,
            $fullAddress,
            $addressBillingChunk,
            $allergiesCsv,
            $conditionsCsv,
            $medsData,
            $medJson,
            $totalPoints,
            $realHCN,
            $privateNote,
            $healthNumber
        );

        if (!$stmtUp->execute()) {
            echo json_encode([
                'success' => false,
                'error' => 'Update failed',
                'details' => $stmtUp->error
            ]);
            $stmtUp->close();
            exit;
        }

        $stmtUp->close();

        $labCountResult = refreshPatientLabCount($conn, $table, $historyTable, $healthNumber);
        if (!$labCountResult['success']) {
            echo json_encode($labCountResult);
            exit;
        }

        echo json_encode([
            'success' => true,
            'action' => 'updated',
            'dataPoint' => $dataPoint,
            'labCount' => $labCountResult['labCount']
        ]);
        exit;
    }

    $medCatSearch = '';
    $patientNote = '';

    $sqlIn = "INSERT INTO `$table` (
                patientSource, healthNumber, dataPoint, pharmacyID,
                clientName, dateOfBirth, street, city, province, postalCode, fullAddress,
                addressBillingChunk,
                allergies, conditionsFull,
                medsData, medications, totalPoints,
                realHCN, medCatSearch, patientNote, privateNote, allDataSave
            ) VALUES (
                'pharmacy', ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?,
                ?,
                ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?, ?
            )";

    $stmtIn = $conn->prepare($sqlIn);
    if (!$stmtIn) {
        echo json_encode([
            'success' => false,
            'error' => 'Prepare failed (insert)',
            'details' => $conn->error
        ]);
        exit;
    }

    $stmtIn->bind_param(
        'sssssssssssssssisssss',
        $healthNumber,
        $dataPoint,
        $pharmacyID,
        $name,
        $dob,
        $street,
        $city,
        $province,
        $postalCode,
        $fullAddress,
        $addressBillingChunk,
        $allergiesCsv,
        $conditionsCsv,
        $medsData,
        $medJson,
        $totalPoints,
        $realHCN,
        $medCatSearch,
        $patientNote,
        $privateNote,
        $allData
    );

    if (!$stmtIn->execute()) {
        echo json_encode([
            'success' => false,
            'error' => 'Insert failed',
            'details' => $stmtIn->error
        ]);
        $stmtIn->close();
        exit;
    }

    $stmtIn->close();

    $labCountResult = refreshPatientLabCount($conn, $table, $historyTable, $healthNumber);
    if (!$labCountResult['success']) {
        echo json_encode($labCountResult);
        exit;
    }

    echo json_encode([
        'success' => true,
        'action' => 'inserted',
        'dataPoint' => $dataPoint,
        'labCount' => $labCountResult['labCount']
    ]);
    exit;
}


echo json_encode([
    'success' => false,
    'error' => 'Invalid scriptName',
    'receivedScriptName' => $data['scriptName'] ?? null
]);
exit;