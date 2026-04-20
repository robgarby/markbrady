<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

$servername = "localhost";
$db_username = "gdmt_gdmt";
$db_password = "fiksoz-xYhwej-kevna9";
$dbname = "gdmt_gdmt";

$conn = new mysqli($servername, $db_username, $db_password, $dbname);
$conn->query("SET SESSION sql_mode = ''");

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => "Database connection failed",
        "details" => $conn->connect_error
    ]);
    exit;
}

$input = file_get_contents("php://input");
$data = json_decode($input, true);

if (!is_array($data)) {
    $data = [];
}

$patientTable = $data['patientDB'] ?? 'Patient';
$historyTable = $data['historyDB'] ?? 'Patient_History';


if (($data['script'] ?? '') === 'rebuildPatientMedicationPoints') {
    $patientTable = !empty($data['patientDB']) && is_string($data['patientDB'])
        ? trim($data['patientDB'])
        : 'Patient';

    $allowedPatientTables = ['Patient', 'Patient_2026'];
    if (!in_array($patientTable, $allowedPatientTables, true)) {
        echo json_encode([
            'success' => false,
            'error' => 'Invalid patient table'
        ]);
        exit;
    }

    // category IDs that should trigger TYPE in conditionData
    // you can also pass them in request as bsCats: [1,2,3]
    $bsCats = [74, 103, 211]; // example category IDs for blood sugar meds

    if (!is_array($bsCats)) {
        $bsCats = [];
    }

    $bsCats = array_values(array_unique(array_filter(array_map(function ($v) {
        return (string) (int) $v;
    }, $bsCats), function ($v) {
        return $v !== '0' && $v !== '';
    })));

    $selectPatientsSql = "SELECT id, healthNumber, medsData, medCatSearch, conditionData FROM `$patientTable`";
    $resultPatients = $conn->query($selectPatientsSql);

    if (!$resultPatients) {
        echo json_encode([
            'success' => false,
            'error' => 'Failed to load patients',
            'details' => $conn->error
        ]);
        exit;
    }

    $stmtDin = $conn->prepare("
        SELECT COALESCE(c.catPoints, m.medPoints, 0) AS pts
        FROM medications_2026 m
        LEFT JOIN medCats2026 c
            ON c.ID = CAST(m.catID AS UNSIGNED)
        WHERE m.DIN = ?
        LIMIT 1
    ");

    if (!$stmtDin) {
        echo json_encode([
            'success' => false,
            'error' => 'Prepare failed for DIN lookup',
            'details' => $conn->error
        ]);
        exit;
    }

    $stmtUpdate = $conn->prepare("
        UPDATE `$patientTable`
        SET totalPoints = ?, conditionData = ?
        WHERE id = ?
    ");

    if (!$stmtUpdate) {
        $stmtDin->close();
        echo json_encode([
            'success' => false,
            'error' => 'Prepare failed for patient update',
            'details' => $conn->error
        ]);
        exit;
    }

    $updated = 0;
    $skipped = 0;
    $errors = [];
    $details = [];

    while ($patient = $resultPatients->fetch_assoc()) {
        $patientId = (int) ($patient['id'] ?? 0);
        $healthNumber = trim((string) ($patient['healthNumber'] ?? ''));
        $medsData = trim((string) ($patient['medsData'] ?? ''));
        $medCatSearch = trim((string) ($patient['medCatSearch'] ?? ''));
        $conditionData = trim((string) ($patient['conditionData'] ?? ''));

        if ($patientId <= 0) {
            $skipped++;
            continue;
        }

        // ---------------------------
        // Calculate total points
        // ---------------------------
        $totalPoints = 0;
        $dinArray = [];

        if ($medsData !== '') {
            $dinArrayRaw = explode(',', $medsData);

            foreach ($dinArrayRaw as $din) {
                $cleanDin = preg_replace('/\D+/', '', (string) $din);
                if ($cleanDin !== '') {
                    $dinArray[] = $cleanDin;
                }
            }

            $dinArray = array_values(array_unique($dinArray));

            foreach ($dinArray as $din) {
                $stmtDin->bind_param("s", $din);

                if (!$stmtDin->execute()) {
                    $errors[] = "DIN lookup failed for patient ID {$patientId}, DIN {$din}: " . $stmtDin->error;
                    continue;
                }

                $resDin = $stmtDin->get_result();
                if ($resDin && ($rowDin = $resDin->fetch_assoc())) {
                    $totalPoints += (int) ($rowDin['pts'] ?? 0);
                }

                if ($resDin) {
                    $resDin->free();
                }
            }
        }

        // ---------------------------
        // conditionData update logic
        // ---------------------------
        $conditionArray = [];
        if ($conditionData !== '') {
            $conditionArray = array_map('trim', explode(',', $conditionData));
            $conditionArray = array_values(array_filter($conditionArray, function ($v) {
                return $v !== '';
            }));
        }

        $medCatArray = [];
        if ($medCatSearch !== '') {
            $medCatArray = array_map('trim', explode(',', $medCatSearch));
            $medCatArray = array_values(array_unique(array_filter($medCatArray, function ($v) {
                return $v !== '';
            })));
        }

        $hasBsMatch = false;
        if (!empty($bsCats) && !empty($medCatArray)) {
            foreach ($medCatArray as $catId) {
                if (in_array((string) $catId, $bsCats, true)) {
                    $hasBsMatch = true;
                    break;
                }
            }
        }

        $hasTypeAlready = false;
        foreach ($conditionArray as $cond) {
            if (strcasecmp($cond, 'TYPE') === 0) {
                $hasTypeAlready = true;
                break;
            }
        }

        if ($hasBsMatch && !$hasTypeAlready) {
            $conditionArray[] = 'TYPE';
        }

        $conditionArray = array_values(array_unique(array_map('trim', $conditionArray)));
        $newConditionData = implode(',', array_filter($conditionArray, function ($v) {
            return $v !== '';
        }));

        $stmtUpdate->bind_param("isi", $totalPoints, $newConditionData, $patientId);
        if (!$stmtUpdate->execute()) {
            $errors[] = "Failed to update patient ID {$patientId}: " . $stmtUpdate->error;
            continue;
        }

        $updated++;
        $details[] = [
            'id' => $patientId,
            'healthNumber' => $healthNumber,
            'totalPoints' => $totalPoints,
            'dinCount' => count($dinArray),
            'medCatSearch' => $medCatSearch,
            'conditionData' => $newConditionData,
            'typeAdded' => ($hasBsMatch && !$hasTypeAlready) ? 'Yes' : 'No'
        ];
    }

    $resultPatients->free();
    $stmtDin->close();
    $stmtUpdate->close();

    echo json_encode([
        'success' => true,
        'updated' => $updated,
        'skipped' => $skipped,
        'bsCats' => $bsCats,
        'errors' => $errors,
        'details' => $details
    ]);
    exit;
}

if (($data['script'] ?? '') === 'getMeds2026') {
    $sql = "SELECT * FROM medications_2026 ORDER BY medication ASC";
    $result = $conn->query($sql);

    if ($result) {
        $meds = [];
        while ($row = $result->fetch_assoc()) {
            $meds[] = $row;
        }

        echo json_encode([
            'success' => true,
            'meds' => $meds
        ], JSON_UNESCAPED_UNICODE);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Query failed',
            'details' => $conn->error
        ]);
    }
    exit;
}

if (($data['script'] ?? '') === 'toggleMedicationUsed') {
    $medDin = trim((string) ($data['DIN'] ?? ''));
    $medUsed = trim((string) ($data['nextValue'] ?? 'Yes'));
    $medUsed = strtolower($medUsed) === 'no' ? 'No' : 'Yes';

    $u = "UPDATE medications_2026 SET medicationUsed = ? WHERE DIN = ?";
    $stmt = $conn->prepare($u);

    if (!$stmt) {
        echo json_encode([
            'success' => false,
            'error' => 'Prepare failed',
            'details' => $conn->error
        ]);
        exit;
    }

    $stmt->bind_param("ss", $medUsed, $medDin);

    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Medication usage status updated successfully.'
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Update failed',
            'details' => $stmt->error
        ]);
    }

    $stmt->close();
    exit;
}

if (($data['script'] ?? '') === 'getMedsArray') {
    $sql = "SELECT * FROM medications ORDER BY medication ASC";
    $result = $conn->query($sql);

    $meds = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $meds[] = $row;
        }
    }

    $sql2 = "SELECT * FROM medCat ORDER BY medication_cat ASC";
    $result2 = $conn->query($sql2);

    $cats = [];
    if ($result2) {
        while ($row = $result2->fetch_assoc()) {
            $cats[] = $row['medication_cat'];
        }
    }

    echo json_encode([
        'success' => true,
        'meds' => $meds,
        'cats' => $cats
    ]);
    exit;
}

if (($data['script'] ?? '') === 'getCats') {
    $sql = "SELECT * FROM medCats2026 ORDER BY catName ASC";
    $result = $conn->query($sql);

    if ($result) {
        $cats = [];
        while ($row = $result->fetch_assoc()) {
            $cats[] = $row;
        }

        echo json_encode([
            'success' => true,
            'cats' => $cats
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Query failed',
            'details' => $conn->error
        ]);
    }
    exit;
}

if (($data['script'] ?? '') === 'toggleCatUsed') {
    $ID = intval($data['ID'] ?? 0);
    $nextValue = trim((string) ($data['nextValue'] ?? ''));
    $nextValue = strtolower($nextValue) === 'yes' ? 'Yes' : 'No';

    if ($ID <= 0) {
        echo json_encode([
            'success' => false,
            'error' => 'Missing/invalid ID'
        ]);
        exit;
    }

    $sql = "UPDATE medCats2026 SET catStatus = ? WHERE ID = ? LIMIT 1";
    $stmt = $conn->prepare($sql);

    if (!$stmt) {
        echo json_encode([
            'success' => false,
            'error' => 'Prepare failed',
            'details' => $conn->error
        ]);
        exit;
    }

    $stmt->bind_param("si", $nextValue, $ID);
    $ok = $stmt->execute();
    $stmt->close();

    echo json_encode([
        'success' => $ok ? true : false
    ]);
    exit;
}

/*
 * POINTS-ONLY SAVE
 */
if (($data['script'] ?? '') === 'saveCatPoints') {
    $ID = intval($data['ID'] ?? 0);
    $catPoints = intval($data['catPoints'] ?? 0);

    if ($ID <= 0) {
        echo json_encode([
            'success' => false,
            'error' => 'Missing/invalid ID'
        ]);
        exit;
    }

    $sql = "UPDATE medCats2026 SET catPoints = ? WHERE ID = ? LIMIT 1";
    $stmt = $conn->prepare($sql);

    if (!$stmt) {
        echo json_encode([
            'success' => false,
            'error' => 'Prepare failed',
            'details' => $conn->error
        ]);
        exit;
    }

    $stmt->bind_param("ii", $catPoints, $ID);
    $ok = $stmt->execute();
    $stmt->close();

    echo json_encode([
        'success' => $ok ? true : false
    ]);
    exit;
}

/*
 * KEEP OLD SCRIPT NAME FOR BACKWARD COMPATIBILITY
 * but now only update points if old frontend still calls it
 */
if (($data['script'] ?? '') === 'saveCatDisplayName') {
    $ID = intval($data['ID'] ?? 0);
    $catPoints = intval($data['catPoints'] ?? 0);

    if ($ID <= 0) {
        echo json_encode([
            'success' => false,
            'error' => 'Missing/invalid ID'
        ]);
        exit;
    }

    $sql = "UPDATE medCats2026 SET catPoints = ? WHERE ID = ? LIMIT 1";
    $stmt = $conn->prepare($sql);

    if (!$stmt) {
        echo json_encode([
            'success' => false,
            'error' => 'Prepare failed',
            'details' => $conn->error
        ]);
        exit;
    }

    $stmt->bind_param("ii", $catPoints, $ID);
    $ok = $stmt->execute();
    $stmt->close();

    echo json_encode([
        'success' => $ok ? true : false
    ]);
    exit;
}

/*
 * ADD NEW CATEGORY
 */
if (($data['script'] ?? '') === 'addCategory') {
    $catName = trim((string) ($data['catName'] ?? ''));
    $displayName = trim((string) ($data['displayName'] ?? ''));
    $catStatus = trim((string) ($data['catStatus'] ?? 'Yes'));
    $catPoints = intval($data['catPoints'] ?? 0);

    $catStatus = strtolower($catStatus) === 'no' ? 'No' : 'Yes';

    if ($catName === '') {
        echo json_encode([
            'success' => false,
            'error' => 'Category Name is required.'
        ]);
        exit;
    }

    $checkSql = "SELECT ID FROM medCats2026 WHERE LOWER(catName) = LOWER(?) LIMIT 1";
    $checkStmt = $conn->prepare($checkSql);

    if (!$checkStmt) {
        echo json_encode([
            'success' => false,
            'error' => 'Prepare failed',
            'details' => $conn->error
        ]);
        exit;
    }

    $checkStmt->bind_param("s", $catName);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();

    if ($checkResult && $checkResult->num_rows > 0) {
        $checkStmt->close();
        echo json_encode([
            'success' => false,
            'error' => 'That category already exists.'
        ]);
        exit;
    }
    $checkStmt->close();

    $insertSql = "INSERT INTO medCats2026 (catName, displayName, catStatus, catPoints) VALUES (?, ?, ?, ?)";
    $insertStmt = $conn->prepare($insertSql);

    if (!$insertStmt) {
        echo json_encode([
            'success' => false,
            'error' => 'Prepare failed',
            'details' => $conn->error
        ]);
        exit;
    }

    $insertStmt->bind_param("sssi", $catName, $displayName, $catStatus, $catPoints);
    $ok = $insertStmt->execute();

    if (!$ok) {
        echo json_encode([
            'success' => false,
            'error' => 'Insert failed',
            'details' => $insertStmt->error
        ]);
        $insertStmt->close();
        exit;
    }

    $newID = $insertStmt->insert_id;
    $insertStmt->close();

    echo json_encode([
        'success' => true,
        'insertID' => $newID,
        'category' => [
            'ID' => $newID,
            'catName' => $catName,
            'displayName' => $displayName,
            'catStatus' => $catStatus,
            'catPoints' => $catPoints
        ]
    ]);
    exit;
}

echo json_encode([
    'success' => false,
    'error' => 'Invalid script'
]);
exit;