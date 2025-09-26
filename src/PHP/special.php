<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

$servername = "localhost";
$username = "markbrady_markbrady";
$password = "NoahandK++";
$dbname = "markbrady_optimize";

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);
$conn->query("SET SESSION sql_mode = ''");


$input = file_get_contents('php://input');

// Decode JSON
$data = json_decode($input, true);
;

// print_r($data); // Debugging: Output the received data
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
    $stmt = $conn->prepare("UPDATE Patient SET medsData = ? WHERE id = ?");
    $stmt->bind_param("si", $clientMeds, $patientId);
    $stmt->execute();
    $stmt->close();
}

if ($data['script'] === 'updateRecommendations') {
    $patientId = $data['patientID'];
    $recommendations = $data['recommendations'];
    $stmt = $conn->prepare("UPDATE Patient SET recommendations = ? WHERE id = ?");
    $stmt->bind_param("si", $recommendations, $patientId);

    if ($stmt->execute()) {
        http_response_code(200);
        echo json_encode(['success' => true]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false]);
    }
    $stmt->close();
    exit;
}

if ($data['script'] === 'getPatientById') {
    header('Content-Type: application/json; charset=utf-8');
    $patientID = $data['patientID'] ?? null;




    // 1) Fetch patient by ID
    $stmt = $conn->prepare("SELECT * FROM Patient WHERE id = ?");
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
            FROM Patient_History
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
    $sql2 = "SELECT * FROM medCat ORDER BY medication_cat ASC";
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
        $stmt = $conn->prepare("UPDATE Patient SET medsData = ? WHERE id = ?");
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
            $stmt2 = $conn->prepare("SELECT * FROM Patient_History WHERE healthNumber = ? ORDER BY orderDate DESC limit 5");
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
                    $stmt = $conn->prepare("UPDATE Patient_History SET $field = ? WHERE ID = ?");
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
            $sql = "SELECT * FROM Patient WHERE $whereClause";
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
        $result = $conn->query("SELECT * FROM Patient");
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
        $result = $conn->query("SELECT * FROM Patient");
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
        $sql = "SELECT * FROM Patient";
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
            FROM Patient
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

// === In special.php ===



