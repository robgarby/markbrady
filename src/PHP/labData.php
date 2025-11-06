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


// --- File handling section ---
$response = ['success' => 'No'];


// get inputs
if ($data['scriptName'] === 'validateLab') {

    $healthNumber = trim($data['healthNumber'] ?? '');
    $orderDate = trim($data['orderDate'] ?? '');
    $patientExists = 0;

    $sql = "SELECT COUNT(*) AS cnt FROM `$patientTable` WHERE TRIM(healthNumber) = '$healthNumber'";
    $result = $conn->query($sql); 
    $row = $result->fetch_assoc();
    $patientExists = (int)$row['cnt'];
    $response['success'] = 'Yes';
    $response['patientExists'] = $patientExists;

    // now we are checking History

    $sqlH = "SELECT COUNT(*) AS cnt FROM `$historyTable` WHERE TRIM(healthNumber) = '$healthNumber' and orderDate = '$orderDate'";
    $resultH = $conn->query($sqlH);
    $rowH = $resultH->fetch_assoc();
    $response['HistoryExists'] = (int)$rowH['cnt'];
    header('Content-Type: application/json');
    echo json_encode($response);
    exit;
}

if ($data['scriptName'] === 'newClientLab') {
    print_r($data);
    
}




?>