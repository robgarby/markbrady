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
