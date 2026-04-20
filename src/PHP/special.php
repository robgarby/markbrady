<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

$servername = "localhost";
$db_username = "gdmt_gdmt";
$db_password = "fiksoz-xYhwej-kevna9";
$dbname = "gdmt_gdmt";

// Create connection
$conn = new mysqli($servername, $db_username, $db_password, $dbname);
$conn->query("SET SESSION sql_mode = ''");


$input = file_get_contents('php://input');

// Decode JSON
$data = json_decode($input, true);


$patientTable = $data['patientDB'] ?? 'Patient';
$historyTable = $data['historyDB'] ?? 'Patient_History';

// print_r($data);
// exit;


if (!isset($data['script'])) {
    echo json_encode(['error' => 'No script specified.']);
    exit;
}

if ($data['script'] === 'insertMedication') {
    $name = $data['name'];
    $category = $data['category'];
    $defaultDose = $data['defaultDose'];

    $stmt = $conn->prepare("INSERT INTO medications (medication, medication_cat, medication_dose) VALUES (?, ?, ?)");
    $stmt->bind_param("sss", $name, $category, $defaultDose);
    $stmt->execute();
    $stmt->close();
}

if ($data['script'] === 'insertMedicationCategory') {
    $category = $data['category'];
    $stmt = $conn->prepare("INSERT INTO medCat (medication_cat) VALUES (?)");
    $stmt->bind_param("s", $category);
    $stmt->execute();
    $stmt->close();
}

if ($data['script'] === 'updateClientMeds') {
    $patientId = $data['patientId'];
    $clientMeds = $data['clientMeds'];
    $stmt = $conn->prepare("UPDATE `$patientTable` SET medsData = ? WHERE id = ?");
    $stmt->bind_param("si", $clientMeds, $patientId);
    $stmt->execute();
    $stmt->close();
}

if ($data['script'] === 'updateRecommendations') {
    $patientId = $data['patientID'] ?? null;
    $recommendations = $data['recommendations'] ?? null; // can be null to clear

    if (!$patientId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing patient ID']);
        exit;
    }

    $stmt = $conn->prepare("UPDATE `$patientTable` SET recommendations = ? WHERE id = ?");
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Prepare failed', 'details' => $conn->error]);
        exit;
    }

    $stmt->bind_param("si", $recommendations, $patientId);

    if ($stmt->execute()) {
        http_response_code(200);
        echo json_encode(['success' => true, 'affected_rows' => $stmt->affected_rows]);
        $stmt->close();
        // $conn->close(); // close at end of script if you do that elsewhere
        exit;
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Query failed', 'details' => $stmt->error]);
        $stmt->close();
        // $conn->close();
        exit;
    }
}


if ($data['script'] === 'getPatientById') {
    // header('Content-Type: application/json; charset=utf-8');
    $patientID = $data['patientID'] ?? null;

    // 1) Fetch patient by ID

    $stmt = $conn->prepare("SELECT * FROM `$patientTable` WHERE id = ?");
    $stmt->bind_param("i", $patientID);
    $stmt->execute();
    $result = $stmt->get_result();
    $patient = $result->fetch_assoc();

    // 2) Determine health number to search history with
    //    Prefer explicit healthNumber from request; else use from patient record.
    $reqHealthNumber = $data['healthNumber'] ?? null;
    $healthNumber = $reqHealthNumber;

    // 3) Fetch last 3 history rows (newest first) if we have a health number
    $history = [];
    if (!empty($healthNumber)) {
        $stmt2 = $conn->prepare("
            SELECT *
            FROM `$historyTable`
            WHERE healthNumber = ?
            ORDER BY orderDate DESC
            LIMIT 3
        ");
        if ($stmt2) {
            $stmt2->bind_param('s', $healthNumber);
            if ($stmt2->execute()) {
                $res2 = $stmt2->get_result();
                while ($row = $res2->fetch_assoc()) {
                    $history[] = $row;
                }
            }
            $stmt2->close();
        }
    }
    echo json_encode([
        'success' => true,
        'patient' => $patient,  // includes healthNumber if present on the row
        'history' => $history,  // 0..3 rows, newest first
    ]);

    exit;
}

if ($data['script'] === 'loadConditionData') {
    $sql = "SELECT * FROM patient_conditions ORDER BY conditionName ASC";
    $result = $conn->query($sql);

    if ($result) {
        $conditions = [];
        while ($row = $result->fetch_assoc()) {
            $conditions[] = $row;
        }
        echo json_encode([
            'success' => true,
            'conditions' => $conditions
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


// 1) Create a new master medication
if (($data['script'] ?? '') === 'CreateMedication') {
    $name = trim($data['medication_name'] ?? '');
    $cat = trim($data['medication_cat'] ?? '');
    $dose = trim($data['medication_dose'] ?? '');

    if ($name === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing medication_name']);
        exit;
    }

    $sql = "INSERT INTO `Meds` (`medication_name`, `medication_cat`, `medication_dose`)
            VALUES (?, ?, ?)";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Prepare failed', 'details' => $conn->error]);
        exit;
    }
    $stmt->bind_param('sss', $name, $cat, $dose);

    if ($stmt->execute()) {
        $newId = $conn->insert_id;
        // Return the newly created row shape your UI expects
        $med = [
            'ID' => (string) $newId,
            'medication_name' => $name,
            'medication_cat' => $cat,
            'medication_dose' => $dose,
        ];
        echo json_encode(['success' => true, 'med' => $med, 'affected_rows' => $stmt->affected_rows]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Insert failed', 'details' => $stmt->error]);
    }
    $stmt->close();
    exit;
}

// 2) Save patient medication linkages (CSV of IDs)
if (($data['script'] ?? '') === 'SaveMedication') {
    header('Content-Type: application/json');

    $patientId = (int) ($data['patientId'] ?? 0);
    $patientDB = 'Patient'; // keep as you had it

    // CSV you may send as authoritative (DIN CSV)
    $medIdsCSV_in = (string) ($data['medIdsCSV'] ?? '');

    // single DIN to remove (optional)
    $medIdRaw = $data['medId'] ?? null;
    $medId = ($medIdRaw !== null) ? preg_replace('/\D+/', '', (string) $medIdRaw) : '';
    $medId = substr($medId, 0, 8);

    if ($patientId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing patientId']);
        exit;
    }

    // 1) Read old medsData + medications
    $stmtSel = $conn->prepare("SELECT medsData, medications FROM `$patientDB` WHERE id = ? LIMIT 1");
    if (!$stmtSel) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Prepare failed (select)', 'details' => $conn->error]);
        exit;
    }

    $stmtSel->bind_param("i", $patientId);
    if (!$stmtSel->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Execute failed (select)', 'details' => $stmtSel->error]);
        $stmtSel->close();
        exit;
    }

    $res = $stmtSel->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmtSel->close();

    if (!$row) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Patient not found']);
        exit;
    }

    $old_medsData = (string) ($row['medsData'] ?? '');
    $old_medications = (string) ($row['medications'] ?? '[]');

    // helper: parse CSV -> array (digits-only)
    $parseCsv = function ($csv) {
        $arr = array_filter(array_map('trim', explode(',', (string) $csv)), function ($v) {
            return $v !== '';
        });
        $out = [];
        foreach ($arr as $v) {
            $d = preg_replace('/\D+/', '', (string) $v);
            $d = substr($d, 0, 8);
            if ($d !== '')
                $out[] = $d;
        }
        return array_values(array_unique($out));
    };

    // 2) Determine new meds array:
    // If medIdsCSV is provided, treat it as authoritative.
    // Else start from old medsData and remove medId (if provided).
    $medsArray = $medIdsCSV_in !== '' ? $parseCsv($medIdsCSV_in) : $parseCsv($old_medsData);

    if ($medId !== '') {
        $medsArray = array_values(array_filter($medsArray, function ($d) use ($medId) {
            return $d !== $medId;
        }));
    }

    $new_medsData = implode(',', $medsArray);

    // 3) Update medications JSON list:
    // If you pass medIdsCSV (authoritative), we rebuild medications by filtering old list
    // down to those DINS. If you pass medId, we remove it.
    $medList = json_decode($old_medications, true);
    if (!is_array($medList))
        $medList = [];

    $medSet = array_flip($medsArray); // for quick keep-check

    $newMedList = [];
    foreach ($medList as $m) {
        if (!is_array($m))
            continue;

        $din = preg_replace('/\D+/', '', (string) ($m['din'] ?? ''));
        $din = substr($din, 0, 8);
        if ($din === '')
            continue;

        // keep only meds that still exist in medsData CSV
        if (!isset($medSet[$din]))
            continue;

        $newMedList[] = [
            'din' => $din,
            'lastFill' => (string) ($m['lastFill'] ?? ''),
        ];
    }

    $new_medications = json_encode($newMedList, JSON_UNESCAPED_UNICODE);
    if ($new_medications === false)
        $new_medications = '[]';

    // 4) Write back to DB
    $stmtUp = $conn->prepare("UPDATE `$patientDB` SET medsData = ?, medications = ? WHERE id = ? LIMIT 1");
    if (!$stmtUp) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Prepare failed (update)', 'details' => $conn->error]);
        exit;
    }

    $stmtUp->bind_param("ssi", $new_medsData, $new_medications, $patientId);

    if (!$stmtUp->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Update failed', 'details' => $stmtUp->error]);
        $stmtUp->close();
        exit;
    }

    $stmtUp->close();

    echo json_encode([
        'success' => true
    ]);
    exit;
}


if ($data['script'] === 'saveLabs') {
    $patientId = $data['patientID'] ?? null;
    $patientTbl = $data['patientDB'] ?? $patientTable;   // fallback to default table

    if (!$patientId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing patient ID']);
        exit;
    }

    // Gather all fields (nullable strings are fine for decimals/dates)
    $cholesterol = $data['cholesterol'] ?? null;
    $cholesterolDate = $data['cholesterolDate'] ?? null;
    $triglyceride = $data['triglyceride'] ?? null;
    $triglycerideDate = $data['triglycerideDate'] ?? null;
    $hdl = $data['hdl'] ?? null;
    $hdlDate = $data['hdlDate'] ?? null;
    $ldl = $data['ldl'] ?? null;
    $ldlDate = $data['ldlDate'] ?? null;
    $nonHdl = $data['nonHdl'] ?? null;
    $nonHdlDate = $data['nonHdlDate'] ?? null;
    $cholesterolHdlRatio = $data['cholesterolHdlRatio'] ?? null;
    $cholesterolHdlRatioDate = $data['cholesterolHdlRatioDate'] ?? null;
    $creatineKinase = $data['creatineKinase'] ?? null;
    $creatineKinaseDate = $data['creatineKinaseDate'] ?? null; // ← fixed
    $alanineAminotransferase = $data['alanineAminotransferase'] ?? null;
    $alanineAminotransferaseDate = $data['alanineAminotransferaseDate'] ?? null;
    $lipoproteinA = $data['lipoproteinA'] ?? null;
    $lipoproteinADate = $data['lipoproteinADate'] ?? null;
    $apolipoproteinB = $data['apolipoproteinB'] ?? null;
    $apolipoproteinBDate = $data['apolipoproteinBDate'] ?? null;
    $natriureticPeptideB = $data['natriureticPeptideB'] ?? null;
    $natriureticPeptideBDate = $data['natriureticPeptideBDate'] ?? null;
    $urea = $data['urea'] ?? null;
    $ureaDate = $data['ureaDate'] ?? null;
    $creatinine = $data['creatinine'] ?? null;
    $creatinineDate = $data['creatinineDate'] ?? null;
    $gfr = $data['gfr'] ?? null;
    $gfrDate = $data['gfrDate'] ?? null;
    $albumin = $data['albumin'] ?? null;
    $albuminDate = $data['albuminDate'] ?? null;
    $sodium = $data['sodium'] ?? null;
    $sodiumDate = $data['sodiumDate'] ?? null;
    $potassium = $data['potassium'] ?? null;
    $potassiumDate = $data['potassiumDate'] ?? null;
    $vitaminB12 = $data['vitaminB12'] ?? null;
    $vitaminB12Date = $data['vitaminB12Date'] ?? null;
    $ferritin = $data['ferritin'] ?? null;
    $ferritinDate = $data['ferritinDate'] ?? null;
    $hemoglobinA1C = $data['hemoglobinA1C'] ?? null;
    $hemoglobinA1CDate = $data['hemoglobinA1CDate'] ?? null;
    $urineAlbumin = $data['urineAlbumin'] ?? null;
    $urineAlbuminDate = $data['urineAlbuminDate'] ?? null;
    $albuminCreatinineRatio = $data['albuminCreatinineRatio'] ?? null;
    $albuminCreatinineRatioDate = $data['albuminCreatinineRatioDate'] ?? null;

    $sql = "UPDATE `$patientTbl` SET
        cholesterol = ?, cholesterolDate = ?,
        triglyceride = ?, triglycerideDate = ?,
        hdl = ?, hdlDate = ?,
        ldl = ?, ldlDate = ?,
        nonHdl = ?, nonHdlDate = ?,
        cholesterolHdlRatio = ?, cholesterolHdlRatioDate = ?,
        creatineKinase = ?, creatineKinaseDate = ?,       -- ← fixed column
        alanineAminotransferase = ?, alanineAminotransferaseDate = ?,
        lipoproteinA = ?, lipoproteinADate = ?,
        apolipoproteinB = ?, apolipoproteinBDate = ?,
        natriureticPeptideB = ?, natriureticPeptideBDate = ?,
        urea = ?, ureaDate = ?,
        creatinine = ?, creatinineDate = ?,
        gfr = ?, gfrDate = ?,
        albumin = ?, albuminDate = ?,
        sodium = ?, sodiumDate = ?,
        potassium = ?, potassiumDate = ?,
        vitaminB12 = ?, vitaminB12Date = ?,
        ferritin = ?, ferritinDate = ?,
        hemoglobinA1C = ?, hemoglobinA1CDate = ?,
        urineAlbumin = ?, urineAlbuminDate = ?,
        albuminCreatinineRatio = ?, albuminCreatinineRatioDate = ?
        WHERE id = ?";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Prepare failed', 'details' => $conn->error]);
        exit;
    }

    // 44 strings + 1 int id
    $stmt->bind_param(
        str_repeat('s', 44) . 'i',
        $cholesterol,
        $cholesterolDate,
        $triglyceride,
        $triglycerideDate,
        $hdl,
        $hdlDate,
        $ldl,
        $ldlDate,
        $nonHdl,
        $nonHdlDate,
        $cholesterolHdlRatio,
        $cholesterolHdlRatioDate,
        $creatineKinase,
        $creatineKinaseDate,   // ← fixed variable
        $alanineAminotransferase,
        $alanineAminotransferaseDate,
        $lipoproteinA,
        $lipoproteinADate,
        $apolipoproteinB,
        $apolipoproteinBDate,
        $natriureticPeptideB,
        $natriureticPeptideBDate,
        $urea,
        $ureaDate,
        $creatinine,
        $creatinineDate,
        $gfr,
        $gfrDate,
        $albumin,
        $albuminDate,
        $sodium,
        $sodiumDate,
        $potassium,
        $potassiumDate,
        $vitaminB12,
        $vitaminB12Date,
        $ferritin,
        $ferritinDate,
        $hemoglobinA1C,
        $hemoglobinA1CDate,
        $urineAlbumin,
        $urineAlbuminDate,
        $albuminCreatinineRatio,
        $albuminCreatinineRatioDate,
        $patientId
    );

    if ($stmt->execute()) {
        http_response_code(200);
        echo json_encode(['success' => true, 'affected_rows' => $stmt->affected_rows]);
        $stmt->close();
        exit;
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Query failed', 'details' => $stmt->error]);
        $stmt->close();
        exit;
    }
}


if ($data['script'] === 'saveConditionData') {
    $conditions = $data['conditions'];
    $conditionName = $conditions['conditionName'] ?? '';
    $conditionCode = $conditions['code'] ?? '';
    $conditionCategory = 'General';
    $stmt = "INSERT INTO patient_conditions (conditionName, conditionCatagory, conditionCode) VALUES ('$conditionName', '$conditionCategory', '$conditionCode')";
    $insert = $conn->query($stmt);

    // New Record has been set - so now get all the conditions and return them
    $sql = "SELECT * FROM patient_conditions ORDER BY conditionName ASC";
    $result = $conn->query($sql);

    if ($result) {
        $conditions = [];
        while ($row = $result->fetch_assoc()) {
            $conditions[] = $row;
        }
        echo json_encode([
            'success' => true,
            'conditions' => $conditions
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

if ($data['script'] === 'removeConditionByID') {
    $conditionID = $data['ID'] ?? null;
    if ($conditionID) {
        $stmt = $conn->prepare("DELETE FROM patient_conditions WHERE ID = ?");
        $stmt->bind_param("i", $conditionID);
        $stmt->execute();
        $stmt->close();
    }
    exit;
}

if ($data['script'] === 'updateConditionName') {
    $id = $data['ID'] ?? null;
    $conditionName = $data['conditionName'] ?? null;
    if ($id && $conditionName) {
        $stmt = $conn->prepare("UPDATE patient_conditions SET conditionName = ? WHERE ID = ?");
        $stmt->bind_param("si", $conditionName, $id);
        $stmt->execute();
        $stmt->close();
    }
    exit;
}

if ($data['script'] === 'getMedsCategory') {
    $sql2 = "SELECT * FROM medCats2026 where catStatus = 'Yes'  ORDER BY catName ASC";
    $result2 = $conn->query($sql2);
    if ($result2) {
        $cats = [];
        while ($row = $result2->fetch_assoc()) {
            $cats[] = $row;
        }
    }
    echo json_encode($cats);

    exit;
}

if ($data['script'] === 'addMedication') {
    $medication = $data['medication'] ?? '';
    $medication_cat = $data['medication_cat'] ?? '';
    $medication_dose = $data['medication_dose'] ?? '';

    $stmt = $conn->prepare("INSERT INTO medications (medication, medication_cat, medication_dose) VALUES (?, ?, ?)");
    $stmt->bind_param("ssi", $medication, $medication_cat, $medication_dose);
    $stmt->execute();
    $stmt->close();

    $sql = "SELECT * FROM medications ORDER BY medication DESC";
    $result = $conn->query($sql);
    $medications = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $medications[] = $row;
        }
    }
    echo json_encode($medications);
    exit;
}

if ($data['script'] === 'updateMedication') {
    $id = $data['ID'] ?? null;
    $medication = $data['medication'] ?? '';
    $medication_cat = $data['medication_cat'] ?? '';
    $medication_dose = $data['medication_dose'] ?? '';
    $medication_brand = $data['medication_brand'] ?? '';
    if ($id) {
        $stmt = $conn->prepare("UPDATE medications SET medication = ?, medication_cat = ?, medication_dose = ?, medication_brand = ? WHERE ID = ?");
        $stmt->bind_param("ssssi", $medication, $medication_cat, $medication_dose, $medication_brand, $id);
        $stmt->execute();
        $stmt->close();
    }
    exit;
}

if ($data['script'] === 'addMedsCategory') {
    $medication_cat = $data['medication_cat'] ?? '';
    if ($medication_cat !== '') {
        $stmt = $conn->prepare("INSERT INTO medCat (medication_cat) VALUES (?)");
        $stmt->bind_param("s", $medication_cat);
        $stmt->execute();
        $stmt->close();
    }

    $sql = "SELECT * FROM medCat ORDER BY medication_cat ASC";
    $result = $conn->query($sql);
    $cats = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $cats[] = $row;
        }
    }
    echo json_encode($cats);
    exit;
}

if ($data['script'] === 'updateMedsCategory') {
    $id = $data['ID'] ?? null;
    $medication_cat = $data['newCategory'] ?? '';
    if ($id && $medication_cat !== '') {
        $stmt = $conn->prepare("UPDATE medCat SET medication_cat = ? WHERE ID = ?");
        $stmt->bind_param("si", $medication_cat, $id);
        $stmt->execute();
        $stmt->close();
    }
    exit;
}

if ($data['script'] === 'updateClientMedIds') {
    $patientId = $data['patientId'] ?? null;
    $medIds = $data['medIds'] ?? null;
    if ($patientId !== null && $medIds !== null) {
        $stmt = $conn->prepare("UPDATE `$patientTable` SET medsData = ? WHERE id = ?");
        $stmt->bind_param("si", $medIds, $patientId);
        $stmt->execute();
        $stmt->close();
    }
    // Fire and forget: no output, no exit
}


if ($data['script'] === 'getHistory') {
    $healthNumber = $data['hcn'] ?? null;
    $patientID = $data['patientID'] ?? null;
    $history = [];

    if ($patientID !== null) {
        if ($healthNumber) {
            $stmt2 = $conn->prepare("SELECT * FROM `$historyTable` WHERE healthNumber = ? ORDER BY orderDate DESC limit 5");
            $stmt2->bind_param("s", $healthNumber);
            $stmt2->execute();
            $res2 = $stmt2->get_result();
            while ($row2 = $res2->fetch_assoc()) {
                $history[] = $row2;
            }
            $stmt2->close();
        }
    }

    echo json_encode($history);
    exit;
}

if ($data['script'] === 'saveHistoryValues') {
    $payload = $data['payload'] ?? null;
    if (is_array($payload)) {
        foreach ($payload as $item) {
            $historyId = $item['historyId'] ?? null;
            $field = $item['field'] ?? null;
            $newValue = $item['newValue'] ?? null;

            // Only update if all required values are present and field is valid
            if ($historyId && $field && $newValue !== null) {
                // Whitelist allowed fields to prevent SQL injection
                $allowedFields = [
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
                if (in_array($field, $allowedFields)) {
                    $stmt = $conn->prepare("UPDATE `$historyTable` SET $field = ? WHERE ID = ?");
                    $stmt->bind_param("di", $newValue, $historyId);
                    $stmt->execute();
                    $stmt->close();
                }
            }
        }
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Invalid payload']);
    }
    exit;
}

if ($data['script'] === 'medicationSearchByIds') {
    $ids = $data['ids'] ?? [];
    $categories = [];

    if (is_array($ids) && count($ids) > 0) {
        // Prepare placeholders for IN clause
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $types = str_repeat('i', count($ids));

        $stmt = $conn->prepare("SELECT ID, medication_cat FROM medCat WHERE ID IN ($placeholders)");
        $stmt->bind_param($types, ...$ids);
        $stmt->execute();
        $result = $stmt->get_result();

        while ($row = $result->fetch_assoc()) {
            $categories[] = $row;
        }
        $stmt->close();

        // Search medications for each category and collect their IDs
        $searchIDS = [];
        foreach ($categories as $cat) {
            $medCat = $cat['medication_cat'];
            $stmtMed = $conn->prepare("SELECT ID FROM medications WHERE medication_cat = ?");
            $stmtMed->bind_param("s", $medCat);
            $stmtMed->execute();
            $resultMed = $stmtMed->get_result();
            while ($rowMed = $resultMed->fetch_assoc()) {
                $searchIDS[] = $rowMed['ID'];
            }
            $stmtMed->close();
        }
        // For each medication ID in searchIDS, find patients whose medsData contains that ID
        $patientsWithMedIds = [];
        if (!empty($searchIDS)) {
            // Build a WHERE clause to match any of the IDs in the comma-separated medsData
            $conditions = [];
            foreach ($searchIDS as $medId) {
                // Use FIND_IN_SET for safe matching in comma-separated string
                $conditions[] = "FIND_IN_SET($medId, medsData)";
            }
            $whereClause = implode(' OR ', $conditions);
            $sql = "SELECT * FROM `$patientTable` WHERE $whereClause";
            $result = $conn->query($sql);
            if ($result) {
                while ($row = $result->fetch_assoc()) {
                    $patientsWithMedIds[] = $row;
                }
            }
            echo json_encode($patientsWithMedIds);// Debugging: Output the matching patients
        }


        exit;
    }
}

if ($data['script'] === 'notOnMedicationByCategoryIds') {
    header('Content-Type: application/json; charset=utf-8');

    $ids = $data['ids'] ?? [];
    if (!is_array($ids) || count($ids) === 0) {
        // No categories provided — nothing to exclude; return all patients
        $result = $conn->query("SELECT * FROM `$patientTable`");
        $rows = [];
        if ($result) {
            while ($r = $result->fetch_assoc())
                $rows[] = $r;
        }
        echo json_encode($rows, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    // Normalize IDs to integers to be safe
    $catIds = array_values(array_filter(array_map('intval', $ids), fn($v) => $v > 0));
    if (count($catIds) === 0) {
        $result = $conn->query("SELECT * FROM `$patientTable`");
        $rows = [];
        if ($result) {
            while ($r = $result->fetch_assoc())
                $rows[] = $r;
        }
        echo json_encode($rows, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    // 1) Get the medication_cat names for the given category IDs
    $placeholders = implode(',', array_fill(0, count($catIds), '?'));
    $types = str_repeat('i', count($catIds));

    $categories = [];
    $stmt = $conn->prepare("SELECT ID, medication_cat FROM medCat WHERE ID IN ($placeholders)");
    $stmt->bind_param($types, ...$catIds);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) {
        $categories[] = $row;
    }
    $stmt->close();

    // 2) For each category, collect med IDs in medications.medication_cat = ?
    $searchIDS = [];
    if (!empty($categories)) {
        $stmtMed = $conn->prepare("SELECT ID FROM medications WHERE medication_cat = ?");
        foreach ($categories as $cat) {
            $medCat = $cat['medication_cat'];
            $stmtMed->bind_param("s", $medCat);
            $stmtMed->execute();
            $resMed = $stmtMed->get_result();
            while ($rowMed = $resMed->fetch_assoc()) {
                $searchIDS[] = (int) $rowMed['ID'];
            }
        }
        $stmtMed->close();
    }

    // De‑dupe med IDs
    $searchIDS = array_values(array_unique(array_filter($searchIDS, fn($v) => $v > 0)));

    // 3) Build final patient query:
    //    Include anyone with NULL/empty medsData, OR those who do NOT match any of the med IDs.
    if (empty($searchIDS)) {
        // No meds found for the chosen categories => nothing to exclude -> everyone qualifies
        $sql = "SELECT * FROM `$patientTable`";
    } else {
        // Build OR of FIND_IN_SET over a NULL-safe medsData
        // COALESCE(medsData,'') ensures NULL behaves like empty (no matches)
        $conditions = [];
        foreach ($searchIDS as $mid) {
            // $mid is int from DB; safe to inline
            $conditions[] = "FIND_IN_SET($mid, COALESCE(medsData,''))";
        }
        $whereOR = implode(' OR ', $conditions);

        // Anyone with medsData NULL/'' OR NOT (any match) is considered NOT on those medications
        $sql = "
            SELECT *
            FROM `$patientTable`
            WHERE (medsData IS NULL OR medsData = '')
               OR NOT ($whereOR)
        ";
    }

    $out = [];
    $result = $conn->query($sql);
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $out[] = $row;
        }
    }

    echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($data['script'] === 'getStatus') {
    $healthNumber = $data['healthNumber'] ?? null;
    $exists = false;

    if ($healthNumber) {
        $stmt = $conn->prepare("SELECT COUNT(*) as cnt FROM `$patientTable` WHERE healthNumber = ?");
        $stmt->bind_param("s", $healthNumber);
        $stmt->execute();
        $stmt->bind_result($count);
        $stmt->fetch();
        $exists = ($count > 0);
        $stmt->close();
    }

    echo json_encode(['exists' => $exists]);
    exit;
}

if ($data['script'] === 'postMeds') {
    $healthNumber = $data['healthNumber'] ?? null;
    $conditionCodes = $data['conditionCodes'] ?? null;
    $medicationIDs = $data['medicationIDs'] ?? null;


    if ($healthNumber !== null) {
        // Fetch current conditionData for this patient
        $stmt = $conn->prepare("SELECT conditionData,medsData FROM `$patientTable` WHERE healthNumber = ?");
        $stmt->bind_param("s", $healthNumber);
        $stmt->execute();
        $stmt->bind_result($existingConditionData, $existingMedData);
        $stmt->fetch();
        $stmt->close();

        // Convert both existing and incoming codes to arrays
        $existingCodes = array_filter(array_map('trim', explode(',', $existingConditionData ?? '')));
        $incomingCodes = array_filter(array_map('trim', explode(',', $conditionCodes ?? '')));
        $existingMedCodes = array_filter(array_map('trim', explode(',', $existingMedData ?? '')));
        $incomingMedCodes = array_filter(array_map('trim', explode(',', $medicationIDs ?? '')));



        // Merge and deduplicate
        $finalCodes = array_unique(array_merge($existingCodes, $incomingCodes));
        $finalMedCodes = array_unique(array_merge($existingMedCodes, $incomingMedCodes));

        // Rebuild as comma-separated string
        $conditionCodes = implode(',', $finalCodes);
        $medicationIDs = implode(',', $finalMedCodes);
    }

    if ($healthNumber !== null) {
        $stmt = $conn->prepare("UPDATE `$patientTable` SET conditionData = ?, medsData = ? WHERE healthNumber = ?");
        $stmt->bind_param("sss", $conditionCodes, $medicationIDs, $healthNumber);
        $success = $stmt->execute();
        $stmt->close();

        echo json_encode(['success' => $success]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Missing healthNumber']);
    }
    exit;
}

if ($data['script'] === 'updatePatientRecommendations') {
    $patientId = $data['patientID'] ?? null;
    $recommendations = $data['recommendations'] ?? null;
    if ($patientId !== null && $recommendations !== null) {
        $stmt = $conn->prepare("UPDATE `$patientTable` SET recommendations = ? WHERE id = ?");
        $stmt->bind_param("si", $recommendations, $patientId);
        $success = $stmt->execute();
        $stmt->close();
        echo json_encode(['success' => $success]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Missing patientID or recommendations']);
    }
    exit;
}

if (($data['script'] ?? '') === 'saveLocation') {

    $id = isset($data['id']) && $data['id'] !== '' ? intval($data['id']) : null;
    $name = $data['name'] ?? '';
    $theType = $data['theType'] ?? 'update'; // 'create' or 'update'

    if (trim($name) === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing name']);
        exit;
    }

    // Use table `locations` with columns: id, providerName, prividerPhone
    if ($theType === 'update' && $id !== null) {
        $stmt = $conn->prepare("UPDATE `gdmt_providers` SET providerName = ? WHERE id = ?");
        if (!$stmt) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Prepare failed', 'details' => $conn->error]);
            exit;
        }
        $stmt->bind_param('si', $name, $id);
        $ok = $stmt->execute();
        $stmt->close();
    } else {
        $stmt = $conn->prepare("INSERT INTO `gdmt_providers` (providerName) VALUES (?)");
        if (!$stmt) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Prepare failed', 'details' => $conn->error]);
            exit;
        }
        $stmt->bind_param('s', $name);
        $ok = $stmt->execute();
        $stmt->close();
    }

    if (!$ok) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Save failed']);
        exit;
    }

    echo json_encode(['success' => true]);
    exit;
}

if (($data['script'] ?? '') === 'getUserData') {
    $stmt = $conn->prepare("SELECT * FROM `LOGIN` order by id desc");
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Prepare failed', 'details' => $conn->error]);
        exit;
    }

    // No parameters to bind for this query
    $users = [];
    if ($stmt->execute()) {
        $result = $stmt->get_result();
        while ($row = $result->fetch_assoc()) {
            $users[] = $row;
        }
        echo json_encode(['success' => true, 'users' => $users]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Query failed', 'details' => $stmt->error]);
    }

    $stmt->close();
    exit;
}

if (($data['script'] ?? '') === 'saveUser') {
    $theType = $data['theType'] ?? 'update';
    $id = isset($data['id']) ? intval($data['id']) : null;
    $userName = $data['userName'] ?? '';
    $password = $data['password'] ?? '';

    if ($theType === 'update') {
        if ($id === null || trim($userName) === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Missing id or userName']);
            exit;
        }

        if ($password !== '') {
            $stmt = $conn->prepare("UPDATE `LOGIN` SET userName = ?, password = ? WHERE id = ?");
            if (!$stmt) {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Prepare failed', 'details' => $conn->error]);
                exit;
            }
            $stmt->bind_param('ssi', $userName, $password, $id);
        }
        $ok = $stmt->execute();
        if ($ok) {
            echo json_encode(['success' => true, 'affected_rows' => $stmt->affected_rows]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Update failed', 'details' => $stmt->error]);
        }
        $stmt->close();
        exit;
    }
    if ($theType === 'create') {
        $timesOn = 0;
        $dayOfWeek = 20;
        $patientTable = 'Patient_DEMO';
        $historyTable = 'Patient_History_DEMO';

        if (trim($userName) !== '' && trim($password) !== '') {
            $stmt = $conn->prepare("INSERT INTO `LOGIN` (userName, password,dayOfWeek,timesOn,patientTable,historyTable) VALUES (?, ?, ?, ?, ?, ?)");
            if (!$stmt) {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Prepare failed', 'details' => $conn->error]);
                exit;
            }
            $stmt->bind_param('ssiiss', $userName, $password, $dayOfWeek, $timesOn, $patientTable, $historyTable);
        }
        $ok = $stmt->execute();
        if ($ok) {
            echo json_encode(['success' => true, 'affected_rows' => $stmt->affected_rows]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Update failed', 'details' => $stmt->error]);
        }
        $stmt->close();
        exit;
    }

    // Unsupported theType
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Unsupported theType']);
    exit;
}

if (($data['script'] ?? '') === 'recalculateSinglePatientPoints') {
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

    $patientId = intval($data['patientId'] ?? 0);
    if ($patientId <= 0) {
        echo json_encode([
            'success' => false,
            'error' => 'Invalid patient ID'
        ]);
        exit;
    }

    $stmtPatient = $conn->prepare("SELECT id, healthNumber, medsData FROM `$patientTable` WHERE id = ? LIMIT 1");
    if (!$stmtPatient) {
        echo json_encode([
            'success' => false,
            'error' => 'Prepare failed for patient lookup',
            'details' => $conn->error
        ]);
        exit;
    }

    $stmtPatient->bind_param("i", $patientId);
    $stmtPatient->execute();
    $resPatient = $stmtPatient->get_result();
    $patient = $resPatient ? $resPatient->fetch_assoc() : null;
    $stmtPatient->close();

    if (!$patient) {
        echo json_encode([
            'success' => false,
            'error' => 'Patient not found'
        ]);
        exit;
    }

    $medsData = trim((string) ($patient['medsData'] ?? ''));
    $healthNumber = trim((string) ($patient['healthNumber'] ?? ''));

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

    $stmtDin->close();

    $stmtUpdate = $conn->prepare("UPDATE `$patientTable` SET totalPoints = ? WHERE id = ?");
    if (!$stmtUpdate) {
        echo json_encode([
            'success' => false,
            'error' => 'Prepare failed for patient update',
            'details' => $conn->error
        ]);
        exit;
    }

    $stmtUpdate->bind_param("ii", $totalPoints, $patientId);

    if (!$stmtUpdate->execute()) {
        echo json_encode([
            'success' => false,
            'error' => 'Failed to update patient points',
            'details' => $stmtUpdate->error
        ]);
        $stmtUpdate->close();
        exit;
    }

    $stmtUpdate->close();

    echo json_encode([
        'success' => true,
        'patientId' => $patientId,
        'healthNumber' => $healthNumber,
        'dinCount' => count($dinArray),
        'totalPoints' => $totalPoints
    ]);
    exit;
}

if (($data['script'] ?? '') === 'updatePatientConditionsFromHospital') {
    header('Content-Type: application/json; charset=utf-8');

    $patientId = intval($data['patientId'] ?? 0);
    $patientTbl = $data['patientDB'] ?? $patientTable;
    $resolvedConditions = $data['resolvedConditions'] ?? [];

    if ($patientId <= 0) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Missing or invalid patientId'
        ]);
        exit;
    }

    if (!is_array($resolvedConditions)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'resolvedConditions must be an array'
        ]);
        exit;
    }

    // 1) Load existing conditionData
    $stmtSel = $conn->prepare("SELECT id, clientName, conditionData FROM `$patientTbl` WHERE id = ? LIMIT 1");
    if (!$stmtSel) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Prepare failed (select)',
            'details' => $conn->error
        ]);
        exit;
    }

    $stmtSel->bind_param("i", $patientId);

    if (!$stmtSel->execute()) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Execute failed (select)',
            'details' => $stmtSel->error
        ]);
        $stmtSel->close();
        exit;
    }

    $resSel = $stmtSel->get_result();
    $patientRow = $resSel ? $resSel->fetch_assoc() : null;
    $stmtSel->close();

    if (!$patientRow) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error' => 'Patient not found'
        ]);
        exit;
    }

    $existingCsv = (string) ($patientRow['conditionData'] ?? '');

    // helper: parse CSV safely
    $parseCsv = function ($csv) {
        $parts = array_map('trim', explode(',', (string) $csv));
        $parts = array_filter($parts, function ($v) {
            return $v !== '' && $v !== '-';
        });
        return array_values(array_unique($parts));
    };

    // 2) Existing condition codes
    $existingCodes = $parseCsv($existingCsv);

    // 3) New condition codes from resolvedConditions
    $incomingCodes = [];
    foreach ($resolvedConditions as $row) {
        if (!is_array($row))
            continue;

        $code = trim((string) ($row['conditionCode'] ?? ''));
        if ($code === '' || $code === '-')
            continue;

        $incomingCodes[] = $code;
    }

    $incomingCodes = array_values(array_unique($incomingCodes));

    // 4) Merge only by adding, never subtracting
    $mergedCodes = array_values(array_unique(array_merge($existingCodes, $incomingCodes)));
    $newCsv = implode(',', $mergedCodes);

    // 5) Update patient row
    $stmtUp = $conn->prepare("
        UPDATE `$patientTbl`
        SET
            conditionData = ?,
            HospitalLoaded = 'Yes',
            lastHospitalUpload = CURDATE()
        WHERE id = ?
        LIMIT 1
    ");
    if (!$stmtUp) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Prepare failed (update)',
            'details' => $conn->error
        ]);
        exit;
    }

    $stmtUp->bind_param("si", $newCsv, $patientId);

    if (!$stmtUp->execute()) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Update failed',
            'details' => $stmtUp->error
        ]);
        $stmtUp->close();
        exit;
    }

    $affected = $stmtUp->affected_rows;
    $stmtUp->close();

    echo json_encode([
        'success' => true,
        'patientId' => $patientId,
        'patientName' => $patientRow['clientName'] ?? '',
        'existingCodes' => $existingCodes,
        'incomingCodes' => $incomingCodes,
        'mergedCodes' => $mergedCodes,
        'conditionData' => $newCsv,
        'affected_rows' => $affected
    ]);
    exit;
}



// === In special.php ===



