<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json");

$servername = "localhost";
$db_username = "gdmt_gdmt";
$db_password = "fiksoz-xYhwej-kevna9";
$dbname = "gdmt_gdmt";

// Create connection
$conn = new mysqli($servername, $db_username, $db_password, $dbname);
$conn->query("SET SESSION sql_mode = ''");

$historyCounts = [];
$historyTable = 'Patient_History';
$patientTable = 'Patient';

$sql = "
        SELECT healthNumber, COUNT(*) AS totalLabs
        FROM `$historyTable`
        WHERE healthNumber IS NOT NULL
          AND TRIM(healthNumber) <> ''
        GROUP BY healthNumber
    ";

$res = $conn->query($sql);
if (!$res) {
    echo json_encode([
        'success' => false,
        'error' => 'Failed to read Patient_History counts',
        'details' => $conn->error
    ]);
    exit;
}

while ($row = $res->fetch_assoc()) {
    $healthNumber = trim((string) ($row['healthNumber'] ?? ''));
    $totalLabs = (int) ($row['totalLabs'] ?? 0);

    if ($healthNumber !== '') {
        $historyCounts[$healthNumber] = $totalLabs;
    }
}

$updated = 0;
$errors = [];

$stmtUpdate = $conn->prepare("
        UPDATE `$patientTable`
        SET labCount = ?
        WHERE healthNumber = ?
    ");

if (!$stmtUpdate) {
    echo json_encode([
        'success' => false,
        'error' => 'Prepare failed for Patient update',
        'details' => $conn->error
    ]);
    exit;
}

foreach ($historyCounts as $healthNumber => $totalLabs) {
    $stmtUpdate->bind_param("is", $totalLabs, $healthNumber);

    if ($stmtUpdate->execute()) {
        $updated += $stmtUpdate->affected_rows >= 0 ? 1 : 0;
    } else {
        $errors[] = [
            'healthNumber' => $healthNumber,
            'details' => $stmtUpdate->error
        ];
    }
}

$stmtUpdate->close();

echo json_encode([
    'success' => true,
    'scriptName' => 'repairLabs',
    'historyRowsFound' => count($historyCounts),
    'updatedPatients' => $updated,
    'errors' => $errors
]);
exit;