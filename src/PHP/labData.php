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

if (($data['scriptName'] ?? '') === 'processPharmacyMeds') {

    $medications = $data['medications'] ?? [];
    if (!is_array($medications))
        $medications = [];

    function dinDigits(string $din): string
    {
        return preg_replace('/\D+/', '', $din);
    }

    function normalizeDose(string $dose): string
    {
        $dose = trim($dose);
        if ($dose === '')
            return '';

        $dose = preg_replace('/\s+/', '', $dose);
        $dose = preg_replace('/ml/i', 'mL', $dose);
        $dose = preg_replace('/iu/i', 'IU', $dose);

        return $dose;
    }

    function extractDoseFromMedicationName(string $name): string
    {
        $name = trim($name);
        if ($name === '')
            return '';

        if (preg_match('/(\d+(?:\.\d+)?\s*mm\s*\/\s*\d+(?:\.\d+)?\s*g)\s*$/i', $name, $m)) {
            return normalizeDose(strtoupper($m[1]));
        }

        if (preg_match('/(\d+(?:\.\d+)?\s*(?:mcg|mg|g|kg|ml|mL|l|L|%|units|iu|IU)\s*(?:\/\s*\d+(?:\.\d+)?\s*(?:mcg|mg|g|kg|ml|mL|l|L|%|units|iu|IU))+)\s*$/i', $name, $m)) {
            return normalizeDose($m[1]);
        }

        if (preg_match('/(\d+(?:\.\d+)?\s*(?:mcg|mg|g|kg|ml|mL|l|L|%|units|iu|IU))\s*$/i', $name, $m)) {
            return normalizeDose($m[1]);
        }

        return '';
    }

    // base name = medication name without trailing dose (for meds2026 LIKE search)
    function stripDoseFromMedicationName(string $name): string
    {
        $name = trim($name);
        if ($name === '')
            return '';

        // First token until whitespace
        if (preg_match('/^([^\s]+)/', $name, $m)) {
            return $m[1];
        }
        return $name;
    }



    // 1) check DIN exists
    $sqlCheckDin = "SELECT 1 FROM medications_2026 WHERE DIN = ? LIMIT 1";
    $stmtCheckDin = $conn->prepare($sqlCheckDin);
    if (!$stmtCheckDin) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Prepare failed (check DIN)', 'details' => $conn->error]);
        exit;
    }

    // 2) search meds2026 by base name (LIKE) to get drugCat/drugBrand
    $sqlSearchMeds = "SELECT drugCat, drugBrand FROM meds2026 WHERE drugName LIKE ? LIMIT 1";
    $stmtSearchMeds = $conn->prepare($sqlSearchMeds);
    if (!$stmtSearchMeds) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Prepare failed (search meds2026)', 'details' => $conn->error]);
        exit;
    }

    // 3) insert (must include drugCat/drugBrand + dose)
    $sqlInsert = "INSERT INTO medications_2026 (medication, medication_dose, DIN, medication_cat, medication_brand) VALUES (?, ?, ?, ?, ?)";
    $stmtInsert = $conn->prepare($sqlInsert);
    if (!$stmtInsert) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Prepare failed (insert)', 'details' => $conn->error]);
        exit;
    }

    $inserted = 0;
    $skippedExistingDin = 0;
    $errors = [];
    $dinString = '';

    foreach ($medications as $m) {
        if (!is_array($m))
            continue;

        $medName = trim((string) ($m['medication'] ?? '')); // includes dose
        $din = dinDigits((string) ($m['din'] ?? ''));
        $dinString .= $din . ',';

        if ($medName === '' || $din === '')
            continue;

        // STEP 1: if DIN exists -> go next (NO UPDATES)
        $stmtCheckDin->bind_param("s", $din);
        if (!$stmtCheckDin->execute()) {
            $errors[] = "Check DIN failed for din={$din} ({$stmtCheckDin->error})";
            continue;
        }
        $res = $stmtCheckDin->get_result();
        if ($res && $res->num_rows > 0) {
            $skippedExistingDin++;
            continue;
        }

        // dose (payload OR extracted)
        $doseIn = trim((string) ($m['medication_dose'] ?? ''));
        $dose = $doseIn !== '' ? normalizeDose($doseIn) : extractDoseFromMedicationName($medName);

        // STEP 2: default unknown, then LIKE search meds2026 using base name
        $drugCat = 'unknown';
        $drugBrand = 'unknown';

        $baseName = stripDoseFromMedicationName($medName); // "Metformin"


        if ($baseName !== '') {
            $like = $baseName . "%"; // better than "%Metformin%" to reduce false matches
            $stmtSearchMeds->bind_param("s", $like);

            if ($stmtSearchMeds->execute()) {
                $r2 = $stmtSearchMeds->get_result();
                if ($r2 && $r2->num_rows > 0) {
                    $row = $r2->fetch_assoc();
                    if (!empty($row['drugCat']))
                        $drugCat = $row['drugCat'];
                    if (!empty($row['drugBrand']))
                        $drugBrand = $row['drugBrand'];
                }
            } else {
                $errors[] = "Search meds2026 failed for like={$like} ({$stmtSearchMeds->error})";
            }
        }

        // STEP 3: insert
        $stmtInsert->bind_param("sssss", $medName, $dose, $din, $drugCat, $drugBrand);
        if (!$stmtInsert->execute()) {
            $errors[] = "Insert failed for din={$din} med={$medName} ({$stmtInsert->error})";
            continue;
        }

        $inserted++;
    }

    // Update Patient table with DIN string
    if (!empty($dinString)) {
        $dinString = rtrim($dinString, ','); // Remove trailing comma
        $healthNumber = $data['healthNumber'] ?? '';

        if (!empty($healthNumber)) {
            $sqlUpdate = "UPDATE `$patientTable` SET medsData = ? WHERE healthNumber = ?";
            $stmtUpdate = $conn->prepare($sqlUpdate);

            if ($stmtUpdate) {
                $stmtUpdate->bind_param("ss", $dinString, $healthNumber);
                if (!$stmtUpdate->execute()) {
                    $errors[] = "Failed to update medsArray for healthNumber={$healthNumber} ({$stmtUpdate->error})";
                }
                $stmtUpdate->close();
            } else {
                $errors[] = "Prepare failed for medsArray update ({$conn->error})";
            }
        }
    }

    $stmtCheckDin->close();
    $stmtSearchMeds->close();
    $stmtInsert->close();

    echo json_encode([
        'success' => true,
        'inserted' => $inserted,
        'skippedExistingDin' => $skippedExistingDin,
        'errors' => $errors
    ]);
    exit;
}

if (($data['scriptName'] ?? '') === 'getHealthCardNumber') {

    header('Content-Type: application/json');

    $meta = $data['patientData'] ?? [];
    if (!is_array($meta))
        $meta = [];

    // 1) Get HCN + strip spaces first
    $hcnIn = (string) ($meta['healthNumber'] ?? '');
    $hcnNoSpaces = preg_replace('/\s+/', '', trim($hcnIn));
    $hcnDigits = preg_replace('/\D+/', '', $hcnNoSpaces);
    $hasAlpha = preg_match('/[a-zA-Z]/', $hcnNoSpaces) ? true : false;

    $real = 'Yes';

    // 2) Decide whether we generate a new one
    if ($hasAlpha || strlen($hcnDigits) > 10) {
        $randomDigits = str_pad((string) rand(0, 9999999), 7, '0', STR_PAD_LEFT);
        $healthNumberRaw = '100' . $randomDigits;
        $real = 'No';
    } else {
        $healthNumberRaw = $hcnDigits;
        $real = 'Yes';
    }

    // Format #### ### ###
    $healthNumberFormatted = $healthNumberRaw;
    if (strlen($healthNumberRaw) >= 10) {
        $healthNumberFormatted =
            substr($healthNumberRaw, 0, 4) . ' ' .
            substr($healthNumberRaw, 4, 3) . ' ' .
            substr($healthNumberRaw, 7, 3);
    }

    // 3) Exists check
    $stmt = $conn->prepare("SELECT COUNT(*) as cnt FROM `$patientTable` WHERE healthNumber = ?");
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Prepare failed (exists check)', 'details' => $conn->error]);
        exit;
    }

    $stmt->bind_param("s", $healthNumberFormatted);
    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Execute failed (exists check)', 'details' => $stmt->error]);
        $stmt->close();
        exit;
    }

    $result = $stmt->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    $exists = $row ? ((int) $row['cnt'] > 0) : false;
    $stmt->close();

    // ============================================================
    // Helpers
    // ============================================================
    $csvToArr = function ($csv) {
        $csv = trim((string) $csv);
        if ($csv === '')
            return [];
        $parts = preg_split('/\s*,\s*/', $csv);
        $out = [];
        foreach ($parts as $p) {
            $p = trim($p);
            if ($p === '')
                continue;
            $out[] = $p;
        }
        return $out;
    };

    $mergeCsv = function (array $existing, array $incoming) {
        // keep existing first, then add new uniques
        $seen = [];
        $out = [];
        foreach (array_merge($existing, $incoming) as $v) {
            $v = trim((string) $v);
            if ($v === '')
                continue;
            if (isset($seen[$v]))
                continue;
            $seen[$v] = true;
            $out[] = $v;
        }
        return implode(',', $out);
    };

    $dinDigits = function ($din) {
        return preg_replace('/\D+/', '', (string) $din);
    };

    // ============================================================
    // ALWAYS build allergies CSV (IDs)
    // ============================================================
    $allergiesArr = $meta['allergies'] ?? [];
    if (!is_array($allergiesArr))
        $allergiesArr = [];

    $allergyFound = [];

    foreach ($allergiesArr as $allergyName) {
        $allergyName = trim((string) $allergyName);
        if ($allergyName === '')
            continue;

        $stmtCheckAllergy = $conn->prepare("SELECT ID FROM allergies_2026 WHERE allergyFound = ? LIMIT 1");
        if (!$stmtCheckAllergy)
            continue;

        $stmtCheckAllergy->bind_param("s", $allergyName);
        $stmtCheckAllergy->execute();
        $resultAllergy = $stmtCheckAllergy->get_result();

        if ($resultAllergy && $resultAllergy->num_rows > 0) {
            $rowAllergy = $resultAllergy->fetch_assoc();
            $allergyId = $rowAllergy['ID'];
        } else {
            $stmtInsertAllergy = $conn->prepare("INSERT INTO allergies_2026 (allergyFound, allergyDisplay, isUsed) VALUES (?, ?, 'Yes')");
            if ($stmtInsertAllergy) {
                $stmtInsertAllergy->bind_param("ss", $allergyName, $allergyName);
                $allergyId = $stmtInsertAllergy->execute() ? $conn->insert_id : null;
                $stmtInsertAllergy->close();
            } else {
                $allergyId = null;
            }
        }

        $stmtCheckAllergy->close();

        if ($allergyId) {
            $allergyFound[] = (string) $allergyId;
        }
    }

    // incoming (new) allergies IDs
    $allergyFoundCsv = implode(',', array_values(array_unique($allergyFound)));

    // ============================================================
    // ALWAYS build conditions CSV (IDs) + upsert into condition_2026
    //    - If found, DO NOT update the condition row
    //    - Store IDs in Patient.conditionsFull
    // ============================================================
    $conditionsArr = $meta['conditions'] ?? [];
    if (!is_array($conditionsArr))
        $conditionsArr = [];

    $conditionIds = [];
    $seenCon = [];

    foreach ($conditionsArr as $condItem) {

        $condName = '';
        $condDisp = '';

        // Accept either string or object/array
        if (is_array($condItem)) {
            $condName = trim((string) ($condItem['conditionName'] ?? $condItem['conditionDisplay'] ?? ''));
            $condDisp = trim((string) ($condItem['conditionDisplay'] ?? $condName));
        } else {
            $condName = trim((string) $condItem);
            $condDisp = $condName;
        }

        if ($condName === '')
            continue;
        if ($condDisp === '')
            $condDisp = $condName;

        $stmtCheckCon = $conn->prepare("SELECT ID FROM condition_2026 WHERE conditionName = ? LIMIT 1");
        if (!$stmtCheckCon)
            continue;

        $stmtCheckCon->bind_param("s", $condName);
        $stmtCheckCon->execute();
        $resCon = $stmtCheckCon->get_result();

        if ($resCon && $resCon->num_rows > 0) {
            $rowCon = $resCon->fetch_assoc();
            $condId = $rowCon['ID'];
        } else {
            $stmtInsCon = $conn->prepare("INSERT INTO condition_2026 (conditionName, conditionDisplay, isUsed) VALUES (?, ?, 'Yes')");
            if ($stmtInsCon) {
                $stmtInsCon->bind_param("ss", $condName, $condDisp);
                $condId = $stmtInsCon->execute() ? $conn->insert_id : null;
                $stmtInsCon->close();
            } else {
                $condId = null;
            }
        }

        $stmtCheckCon->close();

        if ($condId) {
            $condId = (string) $condId;
            if (!isset($seenCon[$condId])) {
                $seenCon[$condId] = true;
                $conditionIds[] = $condId;
            }
        }
    }

    // incoming (new) condition IDs
    $conditionIdsCsv = implode(',', $conditionIds);

    // ============================================================
    // Medications overwrite (NOT a merge)
    // - If medsData is provided, use it
    // - Else if medications array is provided, build DIN csv
    // - If neither provided, we will NOT touch medsData
    // ============================================================
    $hasMedsInput = array_key_exists('medsData', $meta) || array_key_exists('medications', $meta);
    $medsOverwriteCsv = null;

    if (array_key_exists('medsData', $meta)) {
        // accept incoming CSV string (any formatting)
        $medsOverwriteCsv = trim((string) $meta['medsData']);
    } elseif (array_key_exists('medications', $meta) && is_array($meta['medications'])) {
        // build from [{din:...}, ...] or strings
        $dins = [];
        $seenDin = [];
        foreach ($meta['medications'] as $m) {
            $din = '';
            if (is_array($m)) {
                $din = $dinDigits($m['din'] ?? $m['DIN'] ?? '');
            } else {
                $din = $dinDigits($m);
            }
            if ($din === '')
                continue;
            if (isset($seenDin[$din]))
                continue;
            $seenDin[$din] = true;
            $dins[] = $din;
        }
        $medsOverwriteCsv = implode(',', $dins);
    }

    // 4) If !exists -> insert patient (same as before)
    if (!$exists) {
        $name = trim((string) ($meta['name'] ?? ''));
        $street = trim((string) ($meta['street'] ?? ''));
        $city = trim((string) ($meta['city'] ?? ''));
        $province = trim((string) ($meta['province'] ?? ''));
        $postalCode = trim((string) ($meta['postalCode'] ?? ''));

        // DOB normalize
        $dobIn = trim((string) ($meta['dateOfBirth'] ?? ''));
        $dobOut = null;
        if ($dobIn !== '') {
            if (preg_match('/^\d{2}-\d{2}-\d{4}$/', $dobIn)) {
                $dt = DateTime::createFromFormat('d-m-Y', $dobIn);
                if ($dt)
                    $dobOut = $dt->format('Y-m-d');
            } elseif (preg_match('/^\d{4}-\d{2}-\d{2}$/', $dobIn)) {
                $dobOut = $dobIn;
            }
        }

        $sql = "INSERT INTO Patient
                (clientName, patientSource, healthNumber, realHCN, HCNRaw, dateOfBirth, street, city, province, postalCode, allergies, conditionsFull)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        $stmtIns = $conn->prepare($sql);
        if (!$stmtIns) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Prepare failed (insert)', 'details' => $conn->error]);
            exit;
        }

        $patientSource = 'pharmacy';

        $stmtIns->bind_param(
            "ssssssssssss",
            $name,
            $patientSource,
            $healthNumberFormatted,
            $real,
            $healthNumberRaw,
            $dobOut,
            $street,
            $city,
            $province,
            $postalCode,
            $allergyFoundCsv,   // allergy IDs
            $conditionIdsCsv    // condition IDs
        );

        if (!$stmtIns->execute()) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Insert failed', 'details' => $stmtIns->error]);
            $stmtIns->close();
            exit;
        }

        $stmtIns->close();
        $exists = false;

    } else {

        // ============================================================
        // ✅ Exists -> READ current row and MERGE allergies/conditions
        //    - allergies: merge existing IDs + new IDs
        //    - conditionsFull: merge existing IDs + new IDs
        //    - medsData: overwrite (NOT merge) if provided in payload
        // ============================================================
        $stmtRead = $conn->prepare("SELECT allergies, conditionsFull, medsData FROM `$patientTable` WHERE healthNumber = ? LIMIT 1");
        if (!$stmtRead) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Prepare failed (read existing)', 'details' => $conn->error]);
            exit;
        }

        $stmtRead->bind_param("s", $healthNumberFormatted);
        if (!$stmtRead->execute()) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Execute failed (read existing)', 'details' => $stmtRead->error]);
            $stmtRead->close();
            exit;
        }

        $resRead = $stmtRead->get_result();
        $cur = ($resRead && $resRead->num_rows > 0) ? $resRead->fetch_assoc() : [];
        $stmtRead->close();

        $existingAllergiesArr = $csvToArr($cur['allergies'] ?? '');
        $existingConditionsArr = $csvToArr($cur['conditionsFull'] ?? '');

        $incomingAllergiesArr = $csvToArr($allergyFoundCsv);
        $incomingConditionsArr = $csvToArr($conditionIdsCsv);

        $mergedAllergiesCsv = $mergeCsv($existingAllergiesArr, $incomingAllergiesArr);
        $mergedConditionsCsv = $mergeCsv($existingConditionsArr, $incomingConditionsArr);

        if ($hasMedsInput) {
            // overwrite medsData
            $stmtUp = $conn->prepare("UPDATE `$patientTable` SET allergies = ?, conditionsFull = ?, medsData = ? WHERE healthNumber = ? LIMIT 1");
            if (!$stmtUp) {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Prepare failed (update merge + meds)', 'details' => $conn->error]);
                exit;
            }

            $stmtUp->bind_param("ssss", $mergedAllergiesCsv, $mergedConditionsCsv, $medsOverwriteCsv, $healthNumberFormatted);

        } else {
            // merge allergies/conditions only; keep current medsData
            $stmtUp = $conn->prepare("UPDATE `$patientTable` SET allergies = ?, conditionsFull = ? WHERE healthNumber = ? LIMIT 1");
            if (!$stmtUp) {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Prepare failed (update merge)', 'details' => $conn->error]);
                exit;
            }

            $stmtUp->bind_param("sss", $mergedAllergiesCsv, $mergedConditionsCsv, $healthNumberFormatted);
        }

        if (!$stmtUp->execute()) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Update failed (merge)', 'details' => $stmtUp->error]);
            $stmtUp->close();
            exit;
        }

        $stmtUp->close();
        $exists = true;
    }

    echo json_encode([
        'success' => true,
        'healthNumber' => $healthNumberRaw,
        'healthNumberFormatted' => $healthNumberFormatted,
        'realHCN' => $real,
        'exists' => $exists
    ]);
    exit;
}

if (($data['scriptName'] ?? '') === 'processMonthlyPtMedHistoryText') {

    header('Content-Type: application/json');

    $textIn = (string) ($data['reportText'] ?? '');
    if (trim($textIn) === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing reportText']);
        exit;
    }

    // --- helpers -------------------------------------------------

    $normNewlines = function (string $s): string {
        $s = str_replace(["\r\n", "\r"], "\n", $s);
        // collapse huge whitespace
        $s = preg_replace("/[ \t]+/", " ", $s);
        return $s;
    };

    $splitPatientBlocks = function (string $txt): array {
        // Split at the start of a new patient header.
        // This matches the repeated header style in your PDF: Report Parameters -> Fill Date -> Name -> Billing Info.
        $pattern = '/(?=Report Parameters\s*\nHome\/Ward[^\n]*\nExclude[^\n]*\nFill Date[^\n]*\n[^\n]+,\s*[^\n]+\n[^\n]*Billing Info)/';
        $parts = preg_split($pattern, $txt);
        $blocks = [];
        foreach ($parts as $p) {
            $p = trim($p);
            if ($p === '')
                continue;
            // Only keep blocks that have DOB (strong signal it's a true patient header)
            if (stripos($p, 'Date of Birth -') === false)
                continue;
            $blocks[] = $p;
        }
        return $blocks;
    };

    $parseCsvList = function ($s) {
        $s = trim((string) $s);
        if ($s === '')
            return [];

        $parts = preg_split('/\s*,\s*/', $s);
        $seen = [];
        $out = [];

        foreach ($parts as $p) {
            $p = trim((string) $p);
            if ($p === '')
                continue;
            if (isset($seen[$p]))
                continue;
            $seen[$p] = true;
            $out[] = $p;
        }
        return $out;
    };

    $mergeCsvIds = function ($oldCsv, $newCsv) use ($parseCsvList) {
        $oldArr = $parseCsvList($oldCsv);
        $newArr = $parseCsvList($newCsv);

        $seen = [];
        $out = [];

        foreach (array_merge($oldArr, $newArr) as $v) {
            $v = trim((string) $v);
            if ($v === '')
                continue;
            if (isset($seen[$v]))
                continue;
            $seen[$v] = true;
            $out[] = $v;
        }

        return implode(',', $out);
    };


    $extractFirst10DigitsFromBilling = function (string $block): string {
        // Prefer a real 10-digit number inside Billing Info lines
        if (preg_match_all('/Billing Info\s+([^\n]+)\s+Rel:/i', $block, $m)) {
            foreach ($m[1] as $raw) {
                $digits = preg_replace('/\D+/', '', $raw);
                if (strlen($digits) >= 10) {
                    // take first 10 digits (your format expects 10)
                    return substr($digits, 0, 10);
                }
            }
        }
        // fallback: any 10+ digits anywhere
        if (preg_match('/\b(\d{10,})\b/', $block, $m2)) {
            return substr($m2[1], 0, 10);
        }
        return '';
    };

    $formatHcn = function (string $hcn10): string {
        $hcn10 = preg_replace('/\D+/', '', $hcn10);
        if (strlen($hcn10) < 10)
            return $hcn10;
        return substr($hcn10, 0, 4) . ' ' . substr($hcn10, 4, 3) . ' ' . substr($hcn10, 7, 3);
    };

    $parsePatientFromBlock = function (string $block) use ($extractFirst10DigitsFromBilling): array {

        $name = '';
        if (preg_match('/\n([^\n]+,\s*[^\n]+)\n/', "\n" . $block . "\n", $m)) {
            $name = trim($m[1]);
        }

        $dob = '';
        if (preg_match('/Date of Birth\s*-\s*(\d{2}-\d{2}-\d{4})/i', $block, $m)) {
            $dob = trim($m[1]); // dd-mm-yyyy
        }

        $allergies = [];
        if (preg_match('/Allergies\s*-\s*(.+)/i', $block, $m)) {
            $a = trim($m[1]);
            if ($a !== '' && stripos($a, 'No Known') === false) {
                // split on ; or ,
                $allergies = preg_split('/[;,]/', $a);
                $allergies = array_values(array_filter(array_map('trim', $allergies)));
            }
        }

        $conditions = [];
        if (preg_match('/Conditions\s*-\s*(.+)/i', $block, $m)) {
            $c = trim($m[1]);
            if ($c !== '') {
                $conditions = preg_split('/[;,\|]/', $c);
                $conditions = array_values(array_filter(array_map('trim', $conditions)));
            }
        }

        // DINs are 8 digits in your report rows (DIN column) :contentReference[oaicite:2]{index=2}
        $dins = [];
        if (preg_match_all('/\b(\d{8})\b/', $block, $m)) {
            $dins = array_values(array_unique($m[1]));
        }

        $billing10 = $extractFirst10DigitsFromBilling($block);

        return [
            'name' => $name,
            'dateOfBirth' => $dob,
            'healthNumberRaw' => $billing10, // 10 digits if found
            'allergies' => $allergies,
            'conditions' => $conditions,
            'dins' => $dins,
        ];
    };

    $upsertAllergiesReturnIdCsv = function (mysqli $conn, array $allergyNames): string {
        $ids = [];

        $stmtCheck = $conn->prepare("SELECT ID FROM allergies_2026 WHERE allergyFound = ? LIMIT 1");
        $stmtIns = $conn->prepare("INSERT INTO allergies_2026 (allergyFound, allergyDisplay, isUsed) VALUES (?, ?, 'Yes')");

        foreach ($allergyNames as $nm) {
            $nm = trim((string) $nm);
            if ($nm === '')
                continue;

            $id = null;

            if ($stmtCheck) {
                $stmtCheck->bind_param("s", $nm);
                if ($stmtCheck->execute()) {
                    $r = $stmtCheck->get_result();
                    if ($r && $r->num_rows > 0) {
                        $row = $r->fetch_assoc();
                        $id = $row['ID'];
                    }
                }
            }

            if (!$id && $stmtIns) {
                $stmtIns->bind_param("ss", $nm, $nm);
                if ($stmtIns->execute()) {
                    $id = $conn->insert_id;
                }
            }

            if ($id)
                $ids[] = (string) $id;
        }

        if ($stmtCheck)
            $stmtCheck->close();
        if ($stmtIns)
            $stmtIns->close();

        $ids = array_values(array_unique($ids));
        return implode(',', $ids);
    };

    $upsertConditionsReturnIdCsv = function (mysqli $conn, array $conditionNames): string {
        // IMPORTANT: if found, DO NOT update anything (same behavior as allergies)
        $ids = [];

        $stmtCheck = $conn->prepare("SELECT ID FROM condition_2026 WHERE conditionName = ? LIMIT 1");
        $stmtIns = $conn->prepare("INSERT INTO condition_2026 (conditionName, conditionDisplay, isUsed) VALUES (?, ?, 'Yes')");

        foreach ($conditionNames as $nm) {
            $nm = trim((string) $nm);
            if ($nm === '')
                continue;

            $id = null;

            if ($stmtCheck) {
                $stmtCheck->bind_param("s", $nm);
                if ($stmtCheck->execute()) {
                    $r = $stmtCheck->get_result();
                    if ($r && $r->num_rows > 0) {
                        $row = $r->fetch_assoc();
                        $id = $row['ID'];
                    }
                }
            }

            if (!$id && $stmtIns) {
                // store display same as name for now
                $disp = $nm;
                $stmtIns->bind_param("ss", $nm, $disp);
                if ($stmtIns->execute()) {
                    $id = $conn->insert_id;
                }
            }

            if ($id)
                $ids[] = (string) $id;
        }

        if ($stmtCheck)
            $stmtCheck->close();
        if ($stmtIns)
            $stmtIns->close();

        $ids = array_values(array_unique($ids));
        return implode(',', $ids);
    };

    // --- normalize + split ---------------------------------------

    $text = $normNewlines($textIn);
    $blocks = $splitPatientBlocks($text);

    $processed = 0;
    $created = 0;
    $updated = 0;
    $skipped = 0;
    $errors = [];

    foreach ($blocks as $idx => $block) {

        $p = $parsePatientFromBlock($block);

        // If we can't find any HCN digits, skip (you can decide otherwise)
        if (trim($p['healthNumberRaw']) === '') {
            $skipped++;
            continue;
        }

        // Use your existing HCN rules:
        // - if invalid => generate "100xxxxxxx"
        // - else use provided
        $hcnDigits = preg_replace('/\D+/', '', $p['healthNumberRaw']);
        $real = 'Yes';

        // If we did NOT get 10 digits, generate
        if (strlen($hcnDigits) !== 10) {
            $randomDigits = str_pad((string) rand(0, 9999999), 7, '0', STR_PAD_LEFT);
            $hcnDigits = '100' . $randomDigits;
            $real = 'No';
        }

        $healthNumberFormatted = $formatHcn($hcnDigits);

        // Build incoming allergy/condition ID CSV
        $incomingAllergyCsv = $upsertAllergiesReturnIdCsv($conn, $p['allergies']);
        $incomingConditionCsv = $upsertConditionsReturnIdCsv($conn, $p['conditions']); // IDs CSV, stored in conditionsFull

        // Meds overwrite string
        $dinCsv = implode(',', array_values(array_unique($p['dins'])));

        // Check existing patient row + load current allergy/condition csv for merge
        $stmtGet = $conn->prepare("SELECT allergies, conditionsFull FROM `$patientTable` WHERE healthNumber = ? LIMIT 1");
        if (!$stmtGet) {
            $errors[] = "Prepare failed (select patient) at block {$idx}: " . $conn->error;
            continue;
        }

        $stmtGet->bind_param("s", $healthNumberFormatted);
        if (!$stmtGet->execute()) {
            $errors[] = "Execute failed (select patient) at block {$idx}: " . $stmtGet->error;
            $stmtGet->close();
            continue;
        }

        $res = $stmtGet->get_result();
        $row = ($res && $res->num_rows > 0) ? $res->fetch_assoc() : null;
        $stmtGet->close();

        if (!$row) {
            // INSERT new
            $name = trim((string) ($p['name'] ?? ''));
            $street = '';
            $city = '';
            $province = '';
            $postalCode = '';

            // DOB normalize dd-mm-yyyy -> yyyy-mm-dd
            $dobOut = null;
            $dobIn = trim((string) $p['dateOfBirth']);
            if ($dobIn !== '' && preg_match('/^\d{2}-\d{2}-\d{4}$/', $dobIn)) {
                $dt = DateTime::createFromFormat('d-m-Y', $dobIn);
                if ($dt)
                    $dobOut = $dt->format('Y-m-d');
            }

            $patientSource = 'pharmacy';

            $stmtIns = $conn->prepare("
                INSERT INTO `$patientTable`
                (clientName, patientSource, healthNumber, realHCN, HCNRaw, dateOfBirth, street, city, province, postalCode, allergies, conditionsFull, medsData)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            if (!$stmtIns) {
                $errors[] = "Prepare failed (insert patient) at block {$idx}: " . $conn->error;
                continue;
            }

            $stmtIns->bind_param(
                "sssssssssssss",
                $name,
                $patientSource,
                $healthNumberFormatted,
                $real,
                $hcnDigits,
                $dobOut,
                $street,
                $city,
                $province,
                $postalCode,
                $incomingAllergyCsv,      // IDs CSV
                $incomingConditionCsv,    // IDs CSV
                $dinCsv                   // overwrite
            );

            if (!$stmtIns->execute()) {
                $errors[] = "Insert failed at block {$idx}: " . $stmtIns->error;
                $stmtIns->close();
                continue;
            }

            $stmtIns->close();
            $created++;
            $processed++;
            continue;
        }

        // UPDATE existing: MERGE allergies + conditions, OVERWRITE medsData
        $mergedAllergies = $mergeCsvIds((string) ($row['allergies'] ?? ''), $incomingAllergyCsv);
        $mergedConditions = $mergeCsvIds((string) ($row['conditionsFull'] ?? ''), $incomingConditionCsv);

        $stmtUp = $conn->prepare("
            UPDATE `$patientTable`
            SET allergies = ?, conditionsFull = ?, medsData = ?
            WHERE healthNumber = ?
            LIMIT 1
        ");

        if (!$stmtUp) {
            $errors[] = "Prepare failed (update patient) at block {$idx}: " . $conn->error;
            continue;
        }

        $stmtUp->bind_param("ssss", $mergedAllergies, $mergedConditions, $dinCsv, $healthNumberFormatted);

        if (!$stmtUp->execute()) {
            $errors[] = "Update failed at block {$idx}: " . $stmtUp->error;
            $stmtUp->close();
            continue;
        }

        $stmtUp->close();
        $updated++;
        $processed++;
    }

    echo json_encode([
        'success' => true,
        'patientsFoundInPdf' => count($blocks),
        'processed' => $processed,
        'created' => $created,
        'updated' => $updated,
        'skipped' => $skipped,
        'errors' => $errors
    ]);
    exit;
}

if (($data['scriptName'] ?? '') === 'getProvider') {
    $providerTable = 'pharmacyIDTable';
    $providerTableData = [];
    $sql = "SELECT * FROM `$providerTable`";
    $res = $conn->query($sql);
    if ($res && $res->num_rows > 0) {   
        while ($row = $res->fetch_assoc()) {
            $providerTableData[] = $row;
        }
    }   
    echo json_encode([
        'success' => true,
        'provider' => $providerTableData
    ]);
    exit;
}


if (($data['scriptName'] ?? '') === 'getLoadData') {
    $loadingTable = 'loadingCodes';
    $today = date('Y-m-d');
    
    // Check if today's date exists
    $stmt = $conn->prepare("SELECT * FROM `$loadingTable` WHERE theDate = ?");
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Prepare failed', 'details' => $conn->error]);
        exit;
    }
    
    $stmt->bind_param('s', $today);
    $stmt->execute();
    $result = $stmt->get_result();
    
    // If today's date doesn't exist, generate and insert new code
    if ($result->num_rows === 0) {
        // Generate 6-letter code (uppercase)
        $code = '';
        for ($i = 0; $i < 6; $i++) {
            $code .= chr(rand(65, 90)); // A-Z
        }
        
        $stmtInsert = $conn->prepare("INSERT INTO `$loadingTable` (theDate, theCode) VALUES (?, ?)");
        if ($stmtInsert) {
            $stmtInsert->bind_param('ss', $today, $code);
            $stmtInsert->execute();
            $stmtInsert->close();
        }
    }
    $stmt->close();
    
    // Get all codes ordered by date desc
    $sqlAll = "SELECT * FROM `$loadingTable` ORDER BY TheDate DESC";
    $resAll = $conn->query($sqlAll);
    
    $codes = [];
    if ($resAll && $resAll->num_rows > 0) {
        while ($row = $resAll->fetch_assoc()) {
            $codes[] = $row;
        }
    }
    
    echo json_encode([
        'success' => true,
        'codes' => $codes
    ]);
    exit;
}

// ------------------------------------------------------------
// scriptName: findPoints
// - Reads $data['medications']
// - Normalizes DIN to digits only
// - If DIN exists in medications_2026: adds points to total (prefers category catPoints, fallback medPoints)
// - If DIN does NOT exist: looks up drugCat/drugBrand/pointValue from meds2026, then catID/catPoints/catStatus from medCats2026
//   inserts into medications_2026 with catID + medPoints + medicationUsed
// - Updates Patient.medsData with CSV DIN list (if healthNumber provided)
// - Returns dinString + a per-DIN points breakdown so you can see how totalPoints adds up
// ------------------------------------------------------------
if (($data['scriptName'] ?? '') === 'findPoints') {

    $medications = $data['medications'] ?? [];
    if (!is_array($medications)) $medications = [];

    // ---------- CONFIG ----------
    $categoryTable     = "medCats2026";
    $categoryNameCol   = "catName";
    $categoryPointsCol = "catPoints";
    $categoryStatusCol = "catStatus";
    $categoryIdCol     = "ID";

    $medsLookupTable   = "meds2026";     // lookup drugCat/drugBrand/pointValue by drugName LIKE
    // Patient table variable may already exist in your file; fallback to "Patient" if not.
    $patientTable      = $patientTable ?? "Patient";
    // ---------------------------

    // ---------- helpers ----------
    function dinDigits(string $din): string {
        return preg_replace('/\D+/', '', $din);
    }

    function normalizeDose(string $dose): string {
        $dose = trim($dose);
        if ($dose === '') return '';
        $dose = preg_replace('/\s+/', '', $dose);
        $dose = preg_replace('/ml/i', 'mL', $dose);
        $dose = preg_replace('/iu/i', 'IU', $dose);
        return $dose;
    }

    function extractDoseFromMedicationName(string $name): string {
        $name = trim($name);
        if ($name === '') return '';

        if (preg_match('/(\d+(?:\.\d+)?\s*mm\s*\/\s*\d+(?:\.\d+)?\s*g)\s*$/i', $name, $m)) {
            return normalizeDose(strtoupper($m[1]));
        }
        if (preg_match('/(\d+(?:\.\d+)?\s*(?:mcg|mg|g|kg|ml|mL|l|L|%|units|iu|IU)\s*(?:\/\s*\d+(?:\.\d+)?\s*(?:mcg|mg|g|kg|ml|mL|l|L|%|units|iu|IU))+)\s*$/i', $name, $m)) {
            return normalizeDose($m[1]);
        }
        if (preg_match('/(\d+(?:\.\d+)?\s*(?:mcg|mg|g|kg|ml|mL|l|L|%|units|iu|IU))\s*$/i', $name, $m)) {
            return normalizeDose($m[1]);
        }
        return '';
    }

    function stripDoseFromMedicationName(string $name): string {
        $name = trim($name);
        if ($name === '') return '';
        if (preg_match('/^([^\s]+)/', $name, $m)) return $m[1];
        return $name;
    }

    // ---------- prepared statements ----------
    // 1) Check DIN exists in medications_2026
    $stmtCheckDin = $conn->prepare("SELECT 1 FROM medications_2026 WHERE DIN = ? LIMIT 1");
    if (!$stmtCheckDin) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Prepare failed (check DIN)', 'details' => $conn->error]);
        exit;
    }

    // 1b) Existing DIN points: prefer category catPoints, fallback to stored medPoints
    $stmtExistingPts = $conn->prepare("
        SELECT COALESCE(c.`$categoryPointsCol`, m.medPoints, 0) AS pts
        FROM medications_2026 m
        LEFT JOIN `$categoryTable` c ON c.`$categoryIdCol` = CAST(m.catID AS UNSIGNED)
        WHERE m.DIN = ?
        LIMIT 1
    ");
    if (!$stmtExistingPts) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Prepare failed (existing points)', 'details' => $conn->error]);
        exit;
    }

    // 2) Lookup drugCat/drugBrand/pointValue from meds2026 by base name LIKE
    $stmtSearchMeds = $conn->prepare("
        SELECT drugCat, drugBrand, pointValue
        FROM `$medsLookupTable`
        WHERE drugName LIKE ?
        LIMIT 1
    ");
    if (!$stmtSearchMeds) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Prepare failed (search meds2026)', 'details' => $conn->error]);
        exit;
    }

    // 3) Lookup category row by exact catName (drugCat)
    $stmtCatLookup = $conn->prepare("
        SELECT `$categoryIdCol` AS catID, `$categoryPointsCol` AS catPoints, `$categoryStatusCol` AS catStatus
        FROM `$categoryTable`
        WHERE `$categoryNameCol` = ?
        LIMIT 1
    ");
    if (!$stmtCatLookup) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Prepare failed (category lookup)', 'details' => $conn->error]);
        exit;
    }

    // 4) Insert into medications_2026 (NOTE: medicationUsed column)
    $stmtInsert = $conn->prepare("
        INSERT INTO medications_2026
          (medication, medication_dose, DIN, medication_cat, medication_brand, catID, medPoints, medicationUsed)
        VALUES
          (?, ?, ?, ?, ?, NULLIF(?, ''), ?, ?)
    ");
    if (!$stmtInsert) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Prepare failed (insert)', 'details' => $conn->error]);
        exit;
    }

    // ---------- counters + outputs ----------
    $inserted = 0;
    $skippedExistingDin = 0;
    $unknownCats = 0;
    $errors = [];

    $dinString = "";
    $totalPoints = 0;

    // ✅ New: per-DIN points breakdown
    $dinPoints = [];        // array breakdown
    $dinPointsString = "";  // "DIN:PTS|DIN:PTS|..."
    $dinTotalCheck = 0;     // sum of breakdown (should match totalPoints)

    foreach ($medications as $m) {
        // ✅ accept multiple key shapes from frontend
        $medName = trim((string)($m['medication'] ?? $m['Medication'] ?? $m['drugName'] ?? ''));
        $dinRaw  = (string)($m['din'] ?? $m['DIN'] ?? $m['Din'] ?? '');
        $din     = dinDigits($dinRaw);

        if ($medName === '' || $din === '') continue;

        $dinString .= $din . ",";

        // STEP 1: if DIN exists -> add existing points and continue
        $stmtCheckDin->bind_param("s", $din);
        if (!$stmtCheckDin->execute()) {
            $errors[] = "Check DIN failed for din={$din} ({$stmtCheckDin->error})";
            continue;
        }

        $res = $stmtCheckDin->get_result();
        if ($res && $res->num_rows > 0) {
            $skippedExistingDin++;

            $pts = 0;
            $src = "existing_catPoints_or_medPoints";

            $stmtExistingPts->bind_param("s", $din);
            if ($stmtExistingPts->execute()) {
                $rPts = $stmtExistingPts->get_result();
                if ($rPts && $rPts->num_rows > 0) {
                    $rowPts = $rPts->fetch_assoc();
                    $pts = (int)($rowPts['pts'] ?? 0);
                }
            }

            $totalPoints += $pts;

            // ✅ breakdown
            $dinPoints[] = [
                "din" => $din,
                "pointsUsed" => $pts,
                "source" => $src,
                "status" => "existing"
            ];
            $dinPointsString .= $din . ":" . $pts . "|";
            $dinTotalCheck += $pts;

            continue;
        }

        // dose
        $doseIn = trim((string)($m['medication_dose'] ?? $m['dose'] ?? ''));
        $dose   = $doseIn !== '' ? normalizeDose($doseIn) : extractDoseFromMedicationName($medName);

        // STEP 2: lookup drugCat/drugBrand/pointValue from meds2026
        $drugCat    = 'unknown';
        $drugBrand  = 'unknown';
        $pointValue = 0;

        $baseName = stripDoseFromMedicationName($medName);
        if ($baseName !== '') {
            $like = $baseName . "%";
            $stmtSearchMeds->bind_param("s", $like);

            if ($stmtSearchMeds->execute()) {
                $r2 = $stmtSearchMeds->get_result();
                if ($r2 && $r2->num_rows > 0) {
                    $row = $r2->fetch_assoc();
                    if (!empty($row['drugCat']))   $drugCat   = (string)$row['drugCat'];
                    if (!empty($row['drugBrand'])) $drugBrand = (string)$row['drugBrand'];
                    if ($row['pointValue'] !== null && $row['pointValue'] !== '') {
                        $pointValue = (int)$row['pointValue'];
                    }
                }
            } else {
                $errors[] = "Search meds2026 failed for like={$like} ({$stmtSearchMeds->error})";
            }
        }

        // STEP 3: category lookup => catID + catPoints + catStatus
        $catIDToInsert      = '';               // '' => NULL by NULLIF
        $medPointsToInsert  = (int)$pointValue; // fallback when category not found
        $medicationUsed     = 'No';             // fallback
        $foundCategory      = false;

        if ($drugCat !== 'unknown' && trim($drugCat) !== '') {
            $catName = trim($drugCat);

            $stmtCatLookup->bind_param("s", $catName);
            if ($stmtCatLookup->execute()) {
                $rCat = $stmtCatLookup->get_result();
                if ($rCat && $rCat->num_rows > 0) {
                    $catRow = $rCat->fetch_assoc();

                    $foundCatID  = (string)($catRow['catID'] ?? '');
                    $foundPoints = (int)($catRow['catPoints'] ?? 0);
                    $foundStatus = (string)($catRow['catStatus'] ?? 'No');

                    if ($foundCatID !== '') {
                        $catIDToInsert = $foundCatID;
                        $medPointsToInsert = $foundPoints; // ✅ medPoints from catPoints
                        $medicationUsed = $foundStatus;    // ✅ medicationUsed from catStatus
                        $foundCategory = true;
                    }
                }
            } else {
                $errors[] = "Category lookup failed for cat={$catName} ({$stmtCatLookup->error})";
            }
        }

        if (!$foundCategory) {
            $unknownCats++;
        }

        // ✅ always add the points we’re assigning for this DIN
        $pts = (int)$medPointsToInsert;
        $src = $foundCategory ? "catPoints" : "pointValue_fallback";

        $totalPoints += $pts;

        // ✅ breakdown (NEW INSERT PATH)
        $dinPoints[] = [
            "din" => $din,
            "pointsUsed" => $pts,
            "source" => $src,
            "status" => "inserted",
            "category" => $drugCat,
            "catID" => $catIDToInsert
        ];
        $dinPointsString .= $din . ":" . $pts . "|";
        $dinTotalCheck += $pts;

        // STEP 4: insert new medication
        // types: medication(s), dose(s), din(s), drugCat(s), drugBrand(s), catID(s), medPoints(i), medicationUsed(s)
        $stmtInsert->bind_param(
            "ssssssis",
            $medName,
            $dose,
            $din,
            $drugCat,
            $drugBrand,
            $catIDToInsert,
            $medPointsToInsert,
            $medicationUsed
        );

        if (!$stmtInsert->execute()) {
            $errors[] = "Insert failed for din={$din} med={$medName} ({$stmtInsert->error})";
            continue;
        }

        $inserted++;
    }

    // STEP 5: Update Patient.medsData with DIN CSV (if you sent healthNumber)
    $dinString = rtrim($dinString, ',');
    $dinPointsString = rtrim($dinPointsString, '|');

    $healthNumber = (string)($data['healthNumber'] ?? '');
    if ($dinString !== '' && $healthNumber !== '') {
        $stmtUpdate = $conn->prepare("UPDATE `$patientTable` SET medsData = ? WHERE healthNumber = ?");
        if ($stmtUpdate) {
            $stmtUpdate->bind_param("ss", $dinString, $healthNumber);
            if (!$stmtUpdate->execute()) {
                $errors[] = "Failed to update Patient.medsData for healthNumber={$healthNumber} ({$stmtUpdate->error})";
            }
            $stmtUpdate->close();
        } else {
            $errors[] = "Prepare failed for Patient.medsData update ({$conn->error})";
        }
    }

    // cleanup
    $stmtCheckDin->close();
    $stmtExistingPts->close();
    $stmtSearchMeds->close();
    $stmtCatLookup->close();
    $stmtInsert->close();

    echo json_encode([
        'success' => true,
        'inserted' => $inserted,
        'skippedExistingDin' => $skippedExistingDin,
        'totalPoints' => $totalPoints,
        'unknownCats' => $unknownCats,

        // ✅ NEW: show how the total adds up
        'dinString' => $dinString,                 // "DIN,DIN,DIN"
        'dinPointsString' => $dinPointsString,     // "DIN:PTS|DIN:PTS|..."
        'dinTotalCheck' => $dinTotalCheck,         // sum of breakdown
        'dinPoints' => $dinPoints,                 // array breakdown

        'errors' => $errors
    ]);
    exit;
}
// -----------------------------------------------------------------------------
// savePatientInfo
// Stores patient medication history into Patient_2026
// - medications: JSON array of { din, lastFill }
// - medsData: CSV string of DINs
// - totalPoints stored (no medCount / unknownCats)
// - dataPoint stored as the date the record was saved/updated
// -----------------------------------------------------------------------------
if (($data['scriptName'] ?? '') === 'savePatientInfo') {

    header('Content-Type: application/json');


    $table = 'Patient_2026';

    print_r($data);
    return;

    // -------- helpers --------
    $digitsOnly = function ($v) {
        return preg_replace('/\D+/', '', (string) $v);
    };

    $formatHcn = function ($raw) use ($digitsOnly) {
        $d = $digitsOnly($raw);
        if (strlen($d) !== 10) {
            return trim((string) $raw);
        }
        return substr($d, 0, 4) . ' ' . substr($d, 4, 3) . ' ' . substr($d, 7, 3);
    };

    $normalizeDateYmd = function ($in) {
        $s = trim((string) $in);
        if ($s === '') return null;

        // already YYYY-MM-DD
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $s)) return $s;

        // DD-MM-YYYY or DD/MM/YYYY
        if (preg_match('/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/', $s, $m)) {
            $dd = str_pad($m[1], 2, '0', STR_PAD_LEFT);
            $mm = str_pad($m[2], 2, '0', STR_PAD_LEFT);
            $yy = $m[3];
            return $yy . '-' . $mm . '-' . $dd;
        }

        // fallback: strtotime
        $ts = strtotime($s);
        if ($ts === false) return null;
        return date('Y-m-d', $ts);
    };

    $arrToCsv = function ($arr) {
        if (!is_array($arr)) return '';
        $clean = [];
        foreach ($arr as $x) {
            $v = trim((string) $x);
            if ($v !== '') $clean[] = $v;
        }
        return implode(',', $clean);
    };

    // -------- inputs --------
    $patientData = $data['patientData'] ?? [];
    if (!is_array($patientData)) $patientData = [];
    $allData = JSON_ENCODE($data);


    $healthNumberIn = (string) ($data['healthNumber'] ?? ($patientData['healthNumber'] ?? ''));
    $healthNumber = $formatHcn($healthNumberIn);
    $healthNumberDigits = $digitsOnly($healthNumberIn);

    if ($healthNumber === '' || strlen($healthNumberDigits) < 8) {
        echo json_encode(['success' => false, 'error' => 'Missing or invalid healthNumber']);
        exit;
    }

    $dataPoint = (string) ($data['dataPoint'] ?? date('Y-m-d'));
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dataPoint)) {
        $dataPoint = date('Y-m-d');
    }

    $pharmacyID = trim((string) ($data['pharmacyID'] ?? ''));
    $totalPoints = (int) ($data['totalPoints'] ?? 0);

    $name = trim((string) ($patientData['name'] ?? $patientData['clientName'] ?? ''));
    $dob = $normalizeDateYmd($patientData['dateOfBirth'] ?? '');
    $street = trim((string) ($patientData['street'] ?? ''));
    $city = trim((string) ($patientData['city'] ?? ''));
    $province = trim((string) ($patientData['province'] ?? ''));
    $postalCode = trim((string) ($patientData['postalCode'] ?? ''));

    $allergiesCsv = $arrToCsv($patientData['allergies'] ?? []);
    $conditionsCsv = $arrToCsv($patientData['conditions'] ?? []);

    // medsData (CSV DIN)
    $medsData = trim((string) ($data['medsData'] ?? ''));

    // medications JSON (array of {din,lastFill})
    $medicationsIn = $data['medications'] ?? [];
    if (!is_array($medicationsIn)) $medicationsIn = [];

    $medSlim = [];
    foreach ($medicationsIn as $m) {
        if (!is_array($m)) continue;
        $din = substr($digitsOnly($m['din'] ?? ''), 0, 8);
        if (strlen($din) !== 8) continue;
        $lastFill = trim((string) ($m['lastFill'] ?? ''));
        $medSlim[] = ['din' => $din, 'lastFill' => $lastFill];
    }

    $medJson = json_encode($medSlim, JSON_UNESCAPED_UNICODE);
    if ($medJson === false) $medJson = '[]';

    $realHCN = (strlen($healthNumberDigits) === 10) ? 'Yes' : 'No';

    // -------- upsert (by unique healthNumber) --------
    $sqlExists = "SELECT id FROM `$table` WHERE healthNumber = ? LIMIT 1";
    $stmtExists = $conn->prepare($sqlExists);
    if (!$stmtExists) {
        echo json_encode(['success' => false, 'error' => 'Prepare failed (exists)', 'details' => $conn->error]);
        exit;
    }

    $stmtExists->bind_param('s', $healthNumber);
    if (!$stmtExists->execute()) {
        echo json_encode(['success' => false, 'error' => 'Execute failed (exists)', 'details' => $stmtExists->error]);
        $stmtExists->close();
        exit;
    }

    $res = $stmtExists->get_result();
    $exists = ($res && $res->num_rows > 0);
    $stmtExists->close();

    if ($exists) {
        $sqlUp = "UPDATE `$table`
                  SET patientSource = 'pharmacy',
                      allDataSave = ?,
                      dataPoint = ?,
                      pharmacyID = ?,
                      clientName = ?,
                      dateOfBirth = ?,
                      street = ?,
                      city = ?,
                      province = ?,
                      postalCode = ?,
                      allergies = ?,
                      conditionsFull = ?,
                      medsData = ?,
                      medications = ?,
                      totalPoints = ?,
                      realHCN = ?
                  WHERE healthNumber = ?";

        $stmtUp = $conn->prepare($sqlUp);
        if (!$stmtUp) {
            echo json_encode(['success' => false, 'error' => 'Prepare failed (update)', 'details' => $conn->error]);
            exit;
        }

        $stmtUp->bind_param(
            'ssssssssssssisss',
            $allData,
            $dataPoint,
            $pharmacyID,
            $name,
            $dob,
            $street,
            $city,
            $province,
            $postalCode,
            $allergiesCsv,
            $conditionsCsv,
            $medsData,
            $medJson,
            $totalPoints,
            $realHCN,
            $healthNumber
        );

        if (!$stmtUp->execute()) {
            echo json_encode(['success' => false, 'error' => 'Update failed', 'details' => $stmtUp->error]);
            $stmtUp->close();
            exit;
        }

        $stmtUp->close();

        echo json_encode([
            'success' => true,
            'action' => 'updated',
            'dataPoint' => $dataPoint,
        ]);
        exit;
    }

    // INSERT
    // NOTE: medCatSearch + patientNote are NOT NULL in your table, so we provide empty strings.
    $medCatSearch = '';
    $patientNote = '';

    $sqlIn = "INSERT INTO `$table` (
                patientSource, healthNumber, dataPoint, pharmacyID,
                clientName, dateOfBirth, street, city, province, postalCode,
                allergies, conditionsFull,
                medsData, medications, totalPoints,
                realHCN, medCatSearch, patientNote,allDataSave
            ) VALUES (
                'pharmacy', ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?,
                ?, ?, ?,
                ?, ?, ?,?
            )";

    $stmtIn = $conn->prepare($sqlIn);
    if (!$stmtIn) {
        echo json_encode(['success' => false, 'error' => 'Prepare failed (insert)', 'details' => $conn->error]);
        exit;
    }

    $stmtIn->bind_param(
        'sssssssssssssissss',
        $healthNumber,
        $dataPoint,
        $pharmacyID,
        $name,
        $dob,
        $street,
        $city,
        $province,
        $postalCode,
        $allergiesCsv,
        $conditionsCsv,
        $medsData,
        $medJson,
        $totalPoints,
        $realHCN,
        $medCatSearch,
        $patientNote,
        $allData
    );

    if (!$stmtIn->execute()) {
        echo json_encode(['success' => false, 'error' => 'Insert failed', 'details' => $stmtIn->error]);
        $stmtIn->close();
        exit;
    }

    $stmtIn->close();

    echo json_encode([
        'success' => true,
        'action' => 'inserted',
        'dataPoint' => $dataPoint,
    ]);
    exit;
}

