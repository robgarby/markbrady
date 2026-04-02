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

$historyTable = 'Patient_History';
$patientTable = 'Patient';

if ($_REQUEST['script'] === 'countOnly') {
    $historyCounts = [];
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
}

if ($_REQUEST['script'] === 'catMatch') {
    $uniqueConditions = [];

    $sqlPatients = "
        SELECT id, conditionsFull
        FROM `$patientTable`
        WHERE conditionsFull IS NOT NULL
          AND TRIM(conditionsFull) <> ''
    ";

    $resPatients = $conn->query($sqlPatients);
    if (!$resPatients) {
        echo json_encode([
            'success' => false,
            'error' => 'Failed to read Patient table',
            'details' => $conn->error
        ]);
        exit;
    }

    while ($row = $resPatients->fetch_assoc()) {
        $conditionsFull = trim((string)($row['conditionsFull'] ?? ''));
        if ($conditionsFull === '') {
            continue;
        }

        $parts = explode(',', $conditionsFull);

        foreach ($parts as $part) {
            $value = trim((string)$part);
            if ($value !== '') {
                $uniqueConditions[strtoupper($value)] = $value;
            }
        }
    }

    $outputArray = array_values($uniqueConditions);
    natcasesort($outputArray);

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="unique_conditions.csv"');

    $output = fopen('php://output', 'w');

    // header row
    fputcsv($output, ['condition']);

    foreach ($outputArray as $condition) {
        fputcsv($output, [$condition]);
    }

    fclose($output);
    exit;
}

