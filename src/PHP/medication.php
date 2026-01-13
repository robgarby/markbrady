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


if ($data['script'] === 'getMeds2026') {
     // Adjust column names if your table uses different casing/labels.
     $sql = "
        SELECT * FROM medications_2026 ORDER BY medication ASC
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

if ($data['script'] === 'toggleMedicationUsed') {


     $medDin = $data['DIN'] ?? '';
     $medUsed = $data['nextValue'] ?? 'Yes';

     $u = "update medications_2026 SET medicationUsed = ? where DIN = ?"; 
     $stmt = $conn->prepare($u);
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
     exit;
}

if ($data['script'] === 'getMedsArray') {
     $sql = "SELECT * FROM medications ORDER BY medication ASC";
     $result = $conn->query($sql);
     if ($result) {
          $meds = [];
          while ($row = $result->fetch_assoc()) {
               $meds[] = $row;
          }
     }
     $sql2 = "SELECT * FROM medCat ORDER BY medication_cat ASC";
     $result2 = $conn->query($sql2);
     if ($result2) {
          $cats = [];
          while ($row = $result2->fetch_assoc()) {
               $cats[] = $row['medication_cat'];
          }
     }
     echo json_encode([
          'meds' => $meds ?? [],
          'cats' => $cats ?? []
     ]);

     exit;
}

if ($data['script'] === 'getCats') {
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

// --- inside medication.php (or included) ---

if (($data['script'] ?? '') === 'toggleCatUsed') {

    $ID = intval($data['ID'] ?? 0);
    $nextValue = trim((string)($data['nextValue'] ?? ''));

    // Normalize
    $nextValueLower = strtolower($nextValue);
    $nextValue = ($nextValueLower === 'yes') ? 'Yes' : 'No';

    if ($ID <= 0) {
        // send-and-forget: return minimal
        echo json_encode(['success' => false, 'error' => 'Missing/invalid ID']);
        exit;
    }

    $sql = "UPDATE medCats2026 SET catStatus = ? WHERE ID = ? LIMIT 1";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        echo json_encode(['success' => false, 'error' => 'Prepare failed']);
        exit;
    }

    $stmt->bind_param("si", $nextValue, $ID);
    $ok = $stmt->execute();
    $stmt->close();

    // If you truly don’t care, you can just echo success always,
    // but this helps debugging.
    echo json_encode(['success' => $ok ? true : false]);
    exit;
}

// --- inside medication.php (or included) ---

if (($data['script'] ?? '') === 'saveCatDisplayName') {

    $ID = intval($data['ID'] ?? 0);
    $displayName = trim((string)($data['displayName'] ?? ''));
    $catPoints = intval($data['catPoints'] ?? 0); // ✅ NEW

    if ($ID <= 0) {
        echo json_encode(['success' => false, 'error' => 'Missing/invalid ID']);
        exit;
    }

    // ✅ catName is read-only now, so we do NOT update it
    $sql = "UPDATE medCats2026 SET displayName = ?, catPoints = ? WHERE ID = ? LIMIT 1";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        echo json_encode(['success' => false, 'error' => 'Prepare failed']);
        exit;
    }

    $stmt->bind_param("sii", $displayName, $catPoints, $ID);
    $ok = $stmt->execute();
    $stmt->close();

    echo json_encode(['success' => $ok ? true : false]);
    exit;
}



