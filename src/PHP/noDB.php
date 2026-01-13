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
;




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

if ($data['script'] === 'getMeds') {
    // Adjust column names if your table uses different casing/labels.
    $sql = "
        SELECT * FROM medications ORDER BY medication ASC
    ";

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

if ($data['script'] === 'getConditionData') {
    $sql = "SELECT * FROM patient_conditions ORDER BY conditionName ASC";
    $result = $conn->query($sql);

    if ($result) {
        $conditions = [];
        while ($row = $result->fetch_assoc()) {
            $conditions[] = $row;
        }
        echo json_encode($conditions);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Query failed',
            'details' => $conn->error
        ]);
    }
}

if ($data['script'] === 'getProviderList') {
    $providers = [];

    $sql = "SELECT * FROM `gdmt_providers` ORDER BY providerName ASC";
    $result = $conn->query($sql);
    if ($result && $result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            $providers[] = $row;
        }
    }

    echo json_encode($providers, JSON_UNESCAPED_UNICODE);
    exit;
}

// === In special.php ===



