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

function insertNewClient($nextAppointment, $data, $conn, $patientTable, $historyTable)
{
    $patient = $data['patient'];
    // Extract patient fields
    $name = $conn->real_escape_string($patient['name']);
    $healthNumber = $patient['healthNumber'];
    $sex = $patient['sex'];
    $dateOfBirth = date('Y-m-d', strtotime($patient['dateOfBirth']));
    $address = $conn->real_escape_string($patient['address']);
    $street = $conn->real_escape_string($patient['street']);
    $city = $conn->real_escape_string($patient['city']);
    $province = $conn->real_escape_string($patient['province']);
    $postalCode = $patient['postalCode'];
    $telephone = $patient['telephone'];
    $fullAddress = $conn->real_escape_string($patient['fullAddress']);
    $clientName = $conn->real_escape_string($name);
    $clientStatus = 'new';
    $providerName = $conn->real_escape_string($patient['providerName']);
    $providerNumber = $patient['providerNumber'];
    $orderDate = date('Y-m-d', strtotime($patient['orderDate']));
    $labResults = $patient['labResults'];
    $privateNote = isset($patient['privateNote']) ? $conn->real_escape_string($patient['privateNote']) : '';

    // Helper function
    $getVal = function ($arr, $key) {
        return isset($arr[$key]) && is_numeric($arr[$key]) ? $arr[$key] : 'NULL';
    };

    // Create INSERT query with full field list
    $sql = "INSERT INTO `$patientTable` (
          clientName, clientStatus, healthNumber, sex, dateOfBirth, nextAppointment,privateNote,
          `address`, `street`, `city`, `province`, `postalCode`, `fullAddress`, `telephone`,
          `providerName`, `providerNumber`, `orderDate`,
          `cholesterol`, `cholesterolDate`,
          `triglyceride`, `triglycerideDate`,
          `hdl`, `hdlDate`,
          `ldl`, `ldlDate`,
          nonHdl, nonHdlDate,
          cholesterolHdlRatio, cholesterolHdlRatioDate,
          creatineKinase, creatineKinaseDate,
          alanineAminotransferase, alanineAminotransferaseDate,
          lipoproteinA, lipoproteinADate,
          apolipoproteinB, apolipoproteinBDate,
          natriureticPeptideB, natriureticPeptideBDate,
          urea, ureaDate,
          creatinine, creatinineDate,
          gfr, gfrDate,
          albumin, albuminDate,
          sodium, sodiumDate,
          potassium, potassiumDate,
          vitaminB12, vitaminB12Date,
          ferritin, ferritinDate,
          hemoglobinA1C, hemoglobinA1CDate,
          urineAlbumin,urineAlbuminDate,
          albuminCreatinineRatio,albuminCreatinineRatioDate
     ) VALUES (
          '%s', '%s', '%s', '%s', '%s', '%s','%s',
          '%s', '%s', '%s', '%s', '%s', '%s', '%s',
          '%s', '%s', '%s',
          %s, '%s',
          %s, '%s',
          %s, '%s',
          %s, '%s',
          %s, '%s',
          %s, '%s',
          %s, '%s',
          %s, '%s',
          %s, '%s',
          %s, '%s',
          %s, '%s',
          %s, '%s',
          %s, '%s',
          %s, '%s',
          %s, '%s',
          %s, '%s',
          %s, '%s',
          %s, '%s',
          %s, '%s',
          %s, '%s',
          %s, '%s',
          %s, '%s'
     )";

    $testSql = sprintf(
        $sql,
        $clientName,
        $clientStatus,
        $healthNumber,
        $sex,
        $dateOfBirth,
        $nextAppointment,
        $privateNote,
        $address,
        $street,
        $city,
        $province,
        $postalCode,
        $fullAddress,
        $telephone,
        $providerName,
        $providerNumber,
        $orderDate,

        $getVal($labResults, 'cholesterol'),
        $orderDate,
        $getVal($labResults, 'triglyceride'),
        $orderDate,
        $getVal($labResults, 'hdl'),
        $orderDate,
        $getVal($labResults, 'ldl'),
        $orderDate,
        $getVal($labResults, 'nonHdl'),
        $orderDate,
        $getVal($labResults, 'cholesterolHdlRatio'),
        $orderDate,
        $getVal($labResults, 'creatineKinase'),
        $orderDate,
        $getVal($labResults, 'alanineAminotransferase'),
        $orderDate,
        $getVal($labResults, 'lipoproteinA'),
        $orderDate,
        $getVal($labResults, 'apolipoproteinB'),
        $orderDate,
        $getVal($labResults, 'natriureticPeptideB'),
        $orderDate,
        $getVal($labResults, 'urea'),
        $orderDate,
        $getVal($labResults, 'creatinine'),
        $orderDate,
        $getVal($labResults, 'gfr'),
        $orderDate,
        $getVal($labResults, 'albumin'),
        $orderDate,
        $getVal($labResults, 'sodium'),
        $orderDate,
        $getVal($labResults, 'potassium'),
        $orderDate,
        $getVal($labResults, 'vitaminB12'),
        $orderDate,
        $getVal($labResults, 'ferritin'),
        $orderDate,
        $getVal($labResults, 'hemoglobinA1C'),
        $orderDate,
        $getVal($labResults, 'urineAlbumin'),
        $orderDate,
        $getVal($labResults, 'albuminCreatinineRatio'),
        $orderDate
    );
    // Run insert
    $insert = $conn->query($testSql);

    // History logging
    $historySql = "INSERT INTO `$historyTable` (
          clientName, clientStatus, healthNumber, sex, dateOfBirth, nextAppointment,
          `address`, `street`, `city`, `province`, `postalCode`, `fullAddress`, `telephone`,
          providerName, providerNumber, orderDate,
          cholesterol, cholesterolDate,
          triglyceride, triglycerideDate,
          hdl, hdlDate,
          ldl, ldlDate,
          nonHdl, nonHdlDate,
          cholesterolHdlRatio, cholesterolHdlRatioDate,
          creatineKinase, creatineKinaseDate,
          alanineAminotransferase, alanineAminotransferaseDate,
          lipoproteinA, lipoproteinADate,
          apolipoproteinB, apolipoproteinBDate,
          natriureticPeptideB, natriureticPeptideBDate,
          urea, ureaDate,
          creatinine, creatinineDate,
          gfr, gfrDate,
          albumin, albuminDate,
          sodium, sodiumDate,
          potassium, potassiumDate,
          vitaminB12, vitaminB12Date,
          ferritin, ferritinDate,
          hemoglobinA1C, hemoglobinA1CDate,
          urineAlbumin,urineAlbuminDate,
          albuminCreatinineRatio,albuminCreatinineRatioDate
     )
     SELECT 
          clientName, clientStatus, healthNumber, sex, dateOfBirth, nextAppointment,
          `address`, `street`, `city`, `province`, `postalCode`, `fullAddress`, `telephone`,
          providerName, providerNumber, orderDate,
          cholesterol, cholesterolDate,
          triglyceride, triglycerideDate,
          hdl, hdlDate,
          ldl, ldlDate,
          nonHdl, nonHdlDate,
          cholesterolHdlRatio, cholesterolHdlRatioDate,
          creatineKinase, creatineKinaseDate,
          alanineAminotransferase, alanineAminotransferaseDate,
          lipoproteinA, lipoproteinADate,
          apolipoproteinB, apolipoproteinBDate,
          natriureticPeptideB, natriureticPeptideBDate,
          urea, ureaDate,  
          creatinine, creatinineDate,
          gfr, gfrDate,
          albumin, albuminDate,
          sodium, sodiumDate,
          potassium, potassiumDate,
          vitaminB12, vitaminB12Date,
          ferritin, ferritinDate,
          hemoglobinA1C, hemoglobinA1CDate,
          urineAlbumin,urineAlbuminDate,
          albuminCreatinineRatio,albuminCreatinineRatioDate
     FROM `$patientTable` WHERE healthNumber = '$healthNumber'";

    if ($insert) {
        $historyInsert = $conn->query($historySql);

        if ($historyInsert) {
            echo json_encode(['success' => 'Yes', 'patientID' => $healthNumber]);
        } else {
            echo json_encode(['success' => 'No', 'error' => 'Failed to insert into Patient_History']);
        }
    } else {
        echo json_encode(['success' => 'No', 'error' => 'Failed to insert into Patient']);
    }
    $conn->close();
    exit;
}

function insertToHistory($nextAppointment, $conn, $data, $patientTable, $historyTable): bool
{
    $patient = $data['patient'];

    // Extract patient fields
    $name = $patient['name'];
    $healthNumber = $patient['healthNumber'];
    $sex = $patient['sex'];
    $dateOfBirth = date('Y-m-d', strtotime($patient['dateOfBirth']));
    $address = $patient['address'];
    $street = $patient['street'];
    $city = $patient['city'];
    $province = $patient['province'];
    $postalCode = $patient['postalCode'];
    $telephone = $patient['telephone'];
    $fullAddress = $patient['fullAddress'];
    $clientStatus = $patient['clientStatus'];
    $clientName = $name;
    $privateNote = $patient['privateNote'] ?? '';

    $providerName = $patient['providerName'];
    $providerNumber = $patient['providerNumber'];
    $orderDate = date('Y-m-d', strtotime($patient['orderDate']));
    $labResults = $patient['labResults'];

    function getVal($arr, $key)
    {
        return isset($arr[$key]) && is_numeric($arr[$key]) ? $arr[$key] : 'NULL';
    }


    // SQL Insert
    $sql = "INSERT INTO `$historyTable` (
        clientName, clientStatus, healthNumber, sex, dateOfBirth, nextAppointment,privateNote,
        `address`, `street`, `city`, `province`, `postalCode`, `fullAddress`, `telephone`,
        providerName, providerNumber, orderDate,
        cholesterol, cholesterolDate,
        triglyceride, triglycerideDate,
        hdl, hdlDate,
        ldl, ldlDate,
        nonHdl, nonHdlDate,
        cholesterolHdlRatio, cholesterolHdlRatioDate,
        creatineKinase, creatineKinaseDate,
        alanineAminotransferase, alanineAminotransferaseDate,
        lipoproteinA, lipoproteinADate,
        apolipoproteinB, apolipoproteinBDate,
        natriureticPeptideB, natriureticPeptideBDate,
        urea, ureaDate,
        creatinine, creatinineDate,
        gfr, gfrDate,
        albumin, albuminDate,
        sodium, sodiumDate,
        potassium, potassiumDate,
        vitaminB12, vitaminB12Date,
        ferritin, ferritinDate,
        hemoglobinA1C, hemoglobinA1CDate,
        urineAlbumin,urineAlbuminDate,
        albuminCreatinineRatio,albuminCreatinineRatioDate
    ) VALUES (
        '%s', '%s', '%s', '%s', '%s','%s','%s',
        '%s', '%s', '%s', '%s', '%s', '%s', '%s',
        '%s', '%s', '%s',
        %s, '%s',
        %s, '%s',
        %s, '%s',
        %s, '%s',
        %s, '%s',
        %s, '%s',
        %s, '%s',
        %s, '%s',
        %s, '%s',
        %s, '%s',
        %s, '%s',
        %s, '%s',
        %s, '%s',
        %s, '%s',
        %s, '%s',
        %s, '%s',
        %s, '%s',
        %s, '%s',
        %s, '%s',
        %s, '%s',
        %s, '%s',
        %s, '%s'
    )";

    $testSql = sprintf(
        $sql,
        $clientName,
        $clientStatus,
        $healthNumber,
        $sex,
        $dateOfBirth,
        $nextAppointment,
        $privateNote,
        $address,
        $street,
        $city,
        $province,
        $postalCode,
        $fullAddress,
        $telephone,
        $providerName,
        $providerNumber,
        $orderDate,

        getVal($labResults, 'cholesterol'),
        $orderDate,
        getVal($labResults, 'triglyceride'),
        $orderDate,
        getVal($labResults, 'hdl'),
        $orderDate,
        getVal($labResults, 'ldl'),
        $orderDate,
        getVal($labResults, 'nonHdl'),
        $orderDate,
        getVal($labResults, 'cholesterolHdlRatio'),
        $orderDate,
        getVal($labResults, 'creatineKinase'),
        $orderDate,
        getVal($labResults, 'alanineAminotransferase'),
        $orderDate,
        getVal($labResults, 'lipoproteinA'),
        $orderDate,
        getVal($labResults, 'apolipoproteinB'),
        $orderDate,
        getVal($labResults, 'natriureticPeptideB'),
        $orderDate,
        getVal($labResults, 'urea'),
        $orderDate,
        getVal($labResults, 'creatinine'),
        $orderDate,
        getVal($labResults, 'gfr'),
        $orderDate,
        getVal($labResults, 'albumin'),
        $orderDate,
        getVal($labResults, 'sodium'),
        $orderDate,
        getVal($labResults, 'potassium'),
        $orderDate,
        getVal($labResults, 'vitaminB12'),
        $orderDate,
        getVal($labResults, 'ferritin'),
        $orderDate,
        getVal($labResults, 'hemoglobinA1C'),
        $orderDate,
        getVal($labResults, 'urineAlbumin'),
        $orderDate,
        getVal($labResults, 'albuminCreatinineRatio'),
        $orderDate
    );
    // Run insert
    $insert = $conn->query($testSql) or die($testSql);


    if ($insert) {
        return true;
    } else {
        echo json_encode(['success' => 'No', 'error' => 'Failed to insert into Patient_History']);
        return false;
    }
}

function updateClient($nextAppointment, $data, $conn, $patientTable, $historyTable)
{
    $patient = $data['patient'];
    $healthNumber = $patient['healthNumber'];
    $labResults = $patient['labResults'] ?? [];
    $orderDate = !empty($patient['orderDate']) ? date('Y-m-d', strtotime($patient['orderDate'])) : null;

    // Insert history first
    $returnValue = insertToHistory($nextAppointment, $conn, $data, $patientTable, $historyTable);

    // Load current patient row (may be null if not created yet)
    $cc = $conn->query("SELECT * FROM `$patientTable` WHERE healthNumber = '" . $conn->real_escape_string($healthNumber) . "'");
    $client = $cc ? $cc->fetch_assoc() : null;

    // Build SET clause safely
    $sets = [];
    $params = [];
    $types = '';

    foreach ($labResults as $key => $value) {
        if ($value === '' || $value === null)
            continue;

        // only allow simple column names (avoid SQL injection on dynamic identifiers)
        if (!preg_match('/^[A-Za-z0-9_]+$/', $key))
            continue;

        // skip if existing date is newer or same
        $existingDate = $client["{$key}Date"] ?? null;
        if ($existingDate && $orderDate && $existingDate >= $orderDate)
            continue;

        // value column
        $sets[] = "`$key` = '$value'";
        // matching Date column
        if ($orderDate) {
            $sets[] = "`{$key}Date` = '$orderDate'";
        }
    }

    if (!empty($sets)) {
        $sql = "UPDATE `$patientTable` SET " . implode(', ', $sets) . ", nextAppointment = '$nextAppointment' WHERE healthNumber = '$healthNumber'";
        $stmt = $conn->query($sql);
        if ($conn->query($sql)) {
            echo json_encode(['status' => 'updated']);
        } else {
            $sql = "UPDATE `$patientTable` SET nextAppointment = '$nextAppointment' WHERE healthNumber = '$healthNumber'";
            $stmt = $conn->query($sql);
            echo json_encode(['status' => 'updated']);
        }
    } else {
        echo json_encode(['status' => 'updated']);
    }


}


if ($data['scriptName'] === 'getPatientByHealthNumber') {  
     
     $healthNumber = $data['healthNumber'] ?? null;
     if (!$healthNumber) {
          http_response_code(400);
          echo json_encode(['success' => false, 'error' => 'Missing patient ID']);
          exit;
     }
  
     $stmt = $conn->prepare("SELECT * FROM `$patientTable` WHERE healthNumber = ?");
     if (!$stmt) {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Prepare failed', 'details' => $conn->error]);
          exit;
     }
     $stmt->bind_param('s', $healthNumber);

     if ($stmt->execute()) {
          $result = $stmt->get_result();
          $patient = $result->fetch_assoc();
          echo json_encode(['success' => true, 'patient' => $patient]);
     } else {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Query failed', 'details' => $stmt->error]);
     }
     $stmt->close();
     $conn->close();
     exit;
}

// get inputs
if ($data['scriptName'] === 'validateLab') {

    $healthNumber = trim($data['healthNumber'] ?? '');
    $orderDate = trim($data['orderDate'] ?? '');
    $patientExists = 0;

    $sql = "SELECT COUNT(*) AS cnt FROM `$patientTable` WHERE TRIM(healthNumber) = '$healthNumber'";
    $result = $conn->query($sql);
    $row = $result->fetch_assoc();
    $patientExists = (int) $row['cnt'];
    $response['success'] = 'Yes';
    $response['patientExists'] = $patientExists;

    // now we are checking History

    $sqlH = "SELECT COUNT(*) AS cnt FROM `$historyTable` WHERE TRIM(healthNumber) = '$healthNumber' and orderDate = '$orderDate'";
    $resultH = $conn->query($sqlH);
    $rowH = $resultH->fetch_assoc();
    $response['HistoryExists'] = (int) $rowH['cnt'];
    header('Content-Type: application/json');
    echo json_encode($response);
    exit;
}

if ($data['scriptName'] === 'newClientLab') {
    $nextAppointment = $data['nextAppointment'] ?? '1970-01-01';
    insertNewClient($nextAppointment, $data, $conn, $patientTable, $historyTable);
}

if ($data['scriptName'] === 'updateExistingLab') {

    $nextAppointment = $data['nextAppointment'] ?? '1970-01-01';
    updateClient($nextAppointment, $data, $conn, $patientTable, $historyTable);
}




?>