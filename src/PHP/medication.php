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
