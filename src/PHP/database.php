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


$patientTable =  $data['patientDB'] ?? 'Patient';
$historyTable =  $data['historyDB'] ?? 'Patient_History';

// print_r($data); // Debugging: Output the received data
// exit;

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
               echo json_encode(['success' => 'Yes']);
          } else {
               echo json_encode(['success' => 'No', 'error' => 'Failed to insert into Patient_History']);
          }
     } else {
          echo json_encode(['success' => 'No', 'error' => 'Failed to insert into Patient']);
     }
     $conn->close();
     exit;
}

// function insertNewClient($key, $value, $orderDate, $conn, $healthNumber,$patientTable,$historyTable)
// {
//      $a = "SELECT $key, {$key}Date FROM `$patientTable` WHERE healthNumber = '$healthNumber'";
//      $aa = $conn->query($a);
//      if ($aa && $row = $aa->fetch_assoc()) {
//           $existingDate = $row["{$key}Date"];
//           if ($existingDate >= $orderDate) {
//                // If the existing date is more recent or the same, do not update
//                return;
//           } else {
//                if ($value !== '' && $value !== null) {
//                     $sql = "UPDATE `$patientTable` SET $key = $value, {$key}Date = '$orderDate' WHERE healthNumber = '$healthNumber'";
//                     echo $sql;
//                     // $conn->query($sql) or die ($sql);
//                }
//           }
//      }
// }

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
     $returnValue = insertToHistory($nextAppointment, $conn, $data);

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

if ($data['script'] === 'updatePatientNote') {
    $healthNumber = $data['healthNumber'] ?? null;
    $patientNote  = $data['patientNote']  ?? null; // can be null to clear

    if (!$healthNumber) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing healthNumber']);
        exit;
    }

    $stmt = $conn->prepare("UPDATE `$patientTable` SET patientNote = ? WHERE healthNumber = ?");
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Prepare failed', 'details' => $conn->error]);
        exit;
    }

    // both are strings (patientNote may be null → use 's' and let driver send NULL)
    $stmt->bind_param('ss', $patientNote, $healthNumber);

    if ($stmt->execute()) {
        http_response_code(200);
        echo json_encode(['success' => true, 'affected_rows' => $stmt->affected_rows]);
        $stmt->close();
        $conn->close();
        exit;
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Query failed', 'details' => $stmt->error]);
        $stmt->close();
        $conn->close();
        exit;
    }
}

if ($data['script'] === 'saveAddress') {
    $patientID   = $data['patientID']    ?? null;
    $fullAddress = $data['fullAddress']  ?? null;
    $street      = $data['street']       ?? null;
    $city        = $data['city']         ?? null;
    $province    = $data['province']     ?? null;
    $postalCode  = $data['postalCode']   ?? null;
    $telephone   = $data['telephone']    ?? null;

    if (!$patientID) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing patient ID']);
        exit;
    }

    // prepared statement: update address/contact fields
    $sql = "UPDATE `$patientTable`
            SET fullAddress = ?, street = ?, city = ?, province = ?, postalCode = ?, telephone = ?
            WHERE id = ?";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Prepare failed', 'details' => $conn->error]);
        exit;
    }

    // bind: 6 strings + 1 int
    $stmt->bind_param('ssssssi', $fullAddress, $street, $city, $province, $postalCode, $telephone, $patientID);

    if ($stmt->execute()) {
        http_response_code(200);
        echo json_encode(['success' => true, 'affected_rows' => $stmt->affected_rows]);
        $stmt->close();
        $conn->close();
        exit;
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Query failed', 'details' => $stmt->error]);
        $stmt->close();
        $conn->close();
        exit;
    }
}


if ($data['script'] === 'saveTheDataButton') {
     if ($data['patientStatus'] === 'new') {
          $nextAppointment = $data['nextAppointment'] ?? '1970-01-01';
          insertNewClient($nextAppointment, $data, $conn, $patientTable, $historyTable);
     }
}

if ($data['script'] === 'updatePatient') {
     $nextAppointment = $data['nextAppointment'] ?? '1970-01-02';
     updateClient($nextAppointment, $data, $conn, $patientTable, $historyTable);
}

if ($data['script'] === 'patientNoteSearch') {

     $noteTerm = $data['noteTerm'] ?? '';
     $noteTerm = '%' . $noteTerm . '%';

     // Prepare and execute query to search for patient notes containing the noteTerm
     $stmt = $conn->prepare("SELECT * FROM `$patientTable` WHERE patientNote LIKE ?");
     $stmt->bind_param("s", $noteTerm);
     $stmt->execute();
     $result = $stmt->get_result();

     $notes = [];
     while ($row = $result->fetch_assoc()) {
          $notes[] = $row;
     }

     echo json_encode($notes);

     $stmt->close();
     $conn->close();
     exit;
}

if ($data['script'] === 'getStatus') {
     $healthNumber = $data['healthNumber'];

     // Prepare and execute query to check if healthNumber exists in Patient table
     $stmt = $conn->prepare("SELECT 1 FROM `$patientTable` WHERE healthNumber = ?");
     $stmt->bind_param("s", $healthNumber);
     $stmt->execute();
     $stmt->store_result();

     if ($stmt->num_rows > 0) {
          $labDate = isset($data['labdate']) ? $data['labdate'] : null;
          if ($labDate) {
               $healthNumberNoSpaces = str_replace(' ', '', $healthNumber);
               $stmt2 = $conn->prepare("SELECT 1 FROM `patientFiles` WHERE healthNumber = ? AND labDate = ?");
               $stmt2->bind_param("ss", $healthNumberNoSpaces, $labDate);
               $stmt2->execute();
               $stmt2->store_result();
               if ($stmt2->num_rows > 0) {
                    echo json_encode(['status' => 'update', 'lab' => 'Exists']);
                    $stmt2->close();
                    $conn->close();
                    exit;
               }
               $stmt2->close();
          }
          echo json_encode(['status' => 'update']);

     } else {
          echo json_encode(['status' => 'new', 'lab' => 'None']); // healthNumber does not exist
     }

     $stmt->close();
     $conn->close();
}

if ($data['script'] === 'patientSearch') {
     $searchTerm = $data['searchTerm'];
     $searchTerm = '%' . $searchTerm . '%';

     // Prepare and execute query to search for healthNumber or clientName
     $stmt = $conn->prepare("SELECT * FROM `$patientTable` WHERE healthNumber LIKE ? OR clientName LIKE ?");
     $stmt->bind_param("ss", $searchTerm, $searchTerm);
     $stmt->execute();
     $result = $stmt->get_result();

     // Fetch all results
     $patients = [];
     while ($row = $result->fetch_assoc()) {
          $patients[] = $row;
     }

     echo json_encode($patients);

     $stmt->close();
     $conn->close();
     exit;
}

if ($data['script'] === 'updateLabs') {
     $healthNumber = $data['hcn'] ?? null;
     $labData = $data['labs'] ?? null;

     if (!$healthNumber || !is_array($labData)) {
          http_response_code(400);
          echo json_encode(['error' => 'Missing or invalid data']);
          exit;
     }

     $setClauses = [];
     foreach ($labData as $key => $value) {
          $safeKey = mysqli_real_escape_string($conn, $key);
          $safeValue = mysqli_real_escape_string($conn, $value);
          $setClauses[] = "`$safeKey` = '$safeValue'";
     }

     $setString = implode(", ", $setClauses);
     $healthNumberEscaped = mysqli_real_escape_string($conn, $healthNumber);
     $sql = "UPDATE `$patientTable` SET $setString WHERE healthNumber = '$healthNumberEscaped'";

     if (mysqli_query($conn, $sql)) {
          echo json_encode(['success' => true]);
     } else {
          http_response_code(500);
          echo json_encode(['error' => 'Update failed', 'details' => mysqli_error($conn)]);
     }

     mysqli_close($conn);

}

if ($data['script'] === 'getLabData') {
     $healthNumber = $data['healthNumber'] ?? null;

     if (!$healthNumber) {
          http_response_code(400);
          echo json_encode(['success' => false, 'error' => 'Missing health number']);
          exit;
     }

     $healthNumberEscaped = str_replace(' ', '', $healthNumber);
     $healthNumberEscaped = mysqli_real_escape_string($conn, $healthNumberEscaped);
     $sql = "SELECT * FROM patientFiles WHERE healthNumber = '$healthNumberEscaped' order by labDate DESC";
     $result = mysqli_query($conn, $sql);

     if ($result) {
          $patientData = [];
          while ($row = mysqli_fetch_assoc($result)) {
               $patientData[] = $row;
          }
          echo json_encode([
               'success' => true,
               'labReports' => $patientData
          ]);
          mysqli_free_result($result);
     } else {
          http_response_code(500);
          echo json_encode([
               'success' => false,
               'error' => 'Query failed',
               'details' => mysqli_error($conn)
          ]);
     }
}

if ($data['script'] === 'getPatientUploads') {
     $healthNumber = $data['healthNumber'] ?? null;

     if (!$healthNumber) {
          http_response_code(400);
          echo json_encode(['success' => false, 'error' => 'Missing health number']);
          exit;
     }

     $healthNumberEscaped = str_replace(' ', '', $healthNumber);
     $healthNumberEscaped = mysqli_real_escape_string($conn, $healthNumberEscaped);
     $sql = "SELECT * FROM patientPDF WHERE healthNumber = '$healthNumberEscaped' order by labDate DESC";
     $result = mysqli_query($conn, $sql);

     if ($result) {
          $patientData = [];
          while ($row = mysqli_fetch_assoc($result)) {
               $patientData[] = $row;
          }
          echo json_encode([
               'success' => true,
               'patientUploads' => $patientData
          ]);
          mysqli_free_result($result);
     } else {
          http_response_code(500);
          echo json_encode([
               'success' => false,
               'error' => 'Query failed',
               'details' => mysqli_error($conn)
          ]);
     }
}

if ($data['script'] === 'providerSearch') {

     $providerTerm = isset($data['providerTerm']) ? trim($data['providerTerm']) : '';
     $appointmentDate = isset($data['appointmentDate']) ? trim($data['appointmentDate']) : '';

     // require at least one filter
     if ($providerTerm === '' && $appointmentDate === '') {
          http_response_code(400);
          echo json_encode(['error' => 'Missing provider or appointment date']);
          exit;
     }

     // normalize/validate date if provided
     if ($appointmentDate !== '') {
          $ts = strtotime($appointmentDate);
          if ($ts === false) {
               http_response_code(400);
               echo json_encode(['error' => 'Invalid appointmentDate (use YYYY-MM-DD)']);
               exit;
          }
          $appointmentDate = date('Y-m-d', $ts);
     }

     $dateCol = 'nextAppointment'; // or 'nextAppointment' if that's your column

     $sql = "SELECT * FROM `$patientTable` WHERE 1=1";
     $params = [];
     $types = "";

     // provider filter
     if ($providerTerm !== '') {
          $sql .= " AND providerName LIKE ?";
          $params[] = "%{$providerTerm}%";
          $types .= "s";
     }

     // date filter
     if ($appointmentDate !== '') {
          $sql .= " AND {$dateCol} = ?";
          $params[] = $appointmentDate;
          $types .= "s";
     }

     $stmt = $conn->prepare($sql);
     if (!$stmt) {
          http_response_code(500);
          echo json_encode(['error' => 'Prepare failed', 'details' => $conn->error]);
          exit;
     }

     if (!empty($params)) {
          $stmt->bind_param($types, ...$params);
     }

     if (!$stmt->execute()) {
          http_response_code(500);
          echo json_encode(['error' => 'Execute failed', 'details' => $stmt->error]);
          $stmt->close();
          exit;
     }

     $res = $stmt->get_result();
     $patients = $res ? $res->fetch_all(MYSQLI_ASSOC) : [];
     echo json_encode($patients);
     $stmt->close();

}

if ($data['script'] === 'privateNoteSearch') {
     // 1) Read inputs
     $raw = isset($data['privateNote']) ? trim((string) $data['privateNote']) : '';
     $mode = isset($data['mode']) ? strtolower(trim((string) $data['mode'])) : 'all'; // 'all' | 'any'
     $limit = isset($data['limit']) ? (int) $data['limit'] : 100;
     $offset = isset($data['offset']) ? (int) $data['offset'] : 0;

     // Basic validation
     if ($raw === '') {
          http_response_code(400);
          echo json_encode(['error' => 'Missing private note']);
          exit;
     }

     // 2) Tokenize: supports quoted phrases like: foo "chest pain" bar
     //    Result: ['foo', 'chest pain', 'bar']
     $tokens = [];
     if (preg_match_all('/"([^"]+)"|(\S+)/', $raw, $m)) {
          foreach ($m[1] as $i => $phrase) {
               if ($phrase !== '') {
                    $tokens[] = $phrase;
               } else {
                    $word = $m[2][$i];
                    if ($word !== '')
                         $tokens[] = $word;
               }
          }
     }

     // Safety: dedupe & cap token count
     $tokens = array_values(array_unique($tokens));
     if (empty($tokens)) {
          http_response_code(400);
          echo json_encode(['error' => 'No usable terms']);
          exit;
     }

     // 3) Build SQL
     //    Default = "all" → AND all tokens; "any" → OR tokens
     $glue = ($mode === 'any') ? ' OR ' : ' AND ';

     $sql = "SELECT * FROM `$patientTable` WHERE ";
     $whereParts = [];
     $params = [];
     $types = '';

     foreach ($tokens as $t) {
          $whereParts[] = "privateNote LIKE ?";
          $params[] = '%' . $t . '%';
          $types .= 's';
     }

     $sql .= '(' . implode($glue, $whereParts) . ')';

     // Pagination (defensive bounds)
     if ($limit <= 0)
          $limit = 100;
     if ($offset < 0)
          $offset = 0;
     $sql .= " ORDER BY id DESC LIMIT ? OFFSET ?";  // adjust ORDER BY as you like
     $types .= 'ii';
     $params[] = $limit;
     $params[] = $offset;

     // 4) Prepare
     $stmt = $conn->prepare($sql);
     if (!$stmt) {
          http_response_code(500);
          echo json_encode(['error' => 'Prepare failed', 'details' => $conn->error]);
          exit;
     }

     // 5) Bind & Execute
     // bind_param requires references; in modern PHP using spread on vars works fine
     $stmt->bind_param($types, ...$params);

     if (!$stmt->execute()) {
          http_response_code(500);
          echo json_encode(['error' => 'Execute failed', 'details' => $stmt->error]);
          $stmt->close();
          exit;
     }

     // 6) Return rows
     $res = $stmt->get_result();
     $patients = $res ? $res->fetch_all(MYSQLI_ASSOC) : [];
     echo json_encode($patients);
     $stmt->close();
     exit;
}

if ($data['script'] === 'updateAppointment') {
     $patientID = $data['patientID'] ?? null;
     $appointmentDate = $data['appointmentDate'] ?? null; // can be null to clear

     if (!$patientID) {
          http_response_code(400);
          echo json_encode(['success' => false, 'error' => 'Missing patient ID']);
          exit;
     }

     // normalize/validate date if provided
     if ($appointmentDate !== null && $appointmentDate !== '') {
          $ts = strtotime($appointmentDate);
          if ($ts === false) {
               http_response_code(400);
               echo json_encode(['success' => false, 'error' => 'Invalid date (use YYYY-MM-DD)']);
               exit;
          }
          $appointmentDate = date('Y-m-d', $ts);
     } else {
          $appointmentDate = null; // clear
     }

     // prepared statement
     $stmt = $conn->prepare("UPDATE `$patientTable` SET nextAppointment = ? WHERE id = ?");
     if (!$stmt) {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Prepare failed', 'details' => $conn->error]);
          exit;
     }
     // 's' for DATE string or null, 'i' for id
     $stmt->bind_param('si', $appointmentDate, $patientID);

     if ($stmt->execute()) {
          http_response_code(204); // no content
          exit;
     } else {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Query failed', 'details' => $stmt->error]);
          exit;
     }
}


if ($data['script'] === 'updatePrivateNote') {


     $patientID = $data['patientID'] ?? null;
     $privateNote = $data['privateNote'] ?? null; // can be null to clear

     if (!$patientID) {
          http_response_code(400);
          echo json_encode(['success' => false, 'error' => 'Missing patient ID']);
          exit;
     }


     // prepared statement
     $stmt = $conn->prepare("UPDATE `$patientTable` SET privateNote = ? WHERE id = ?");
     if (!$stmt) {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Prepare failed', 'details' => $conn->error]);
          exit;
     }
     // 's' for string (or null), 'i' for id
     $stmt->bind_param('si', $privateNote, $patientID);

     if ($stmt->execute()) {
          // Return a JSON response so caller receives confirmation (instead of 204 no-content)
          http_response_code(200);
          echo json_encode(['success' => true, 'affected_rows' => $stmt->affected_rows]);
          $stmt->close();
          $conn->close();
          exit;
     } else {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Query failed', 'details' => $stmt->error]);
          $stmt->close();
          $conn->close();
          exit;
     }
}

if ($data['script'] === 'labRangeSearch') {
     $filters = isset($data['filters']) && is_array($data['filters']) ? $data['filters'] : $data;
     unset($filters['script'], $filters['limit'], $filters['offset'], $filters['orderBy'], $filters['orderDir']);
     $ALLOWED = [
          "cholesterol",
          "triglyceride",
          "hdl",
          "ldl",
          "nonHdl",
          "cholesterolHdlRatio",
          "creatineKinase",
          "alanineAminotransferase",
          "lipoproteinA",
          "apolipoproteinB",
          "natriureticPeptideB",
          "urea",
          "creatinine",
          "gfr",
          "albumin",
          "sodium",
          "potassium",
          "vitaminB12",
          "ferritin",
          "hemoglobinA1C",
          "urineAlbumin",
          "albuminCreatinineRatio",
     ];

     // Build WHERE from filters
     $where = " WHERE 1=1";
     $types = "";
     $params = [];

     // If you expect these fields might be stored as VARCHAR and want numeric compare,
// you can switch "$col" to "CAST($col AS DECIMAL(12,4))" below.
     foreach ($filters as $col => $range) {
          if (!in_array($col, $ALLOWED, true)) {
               // ignore unknown keys
               continue;
          }
          if (!is_array($range))
               continue;

          // accept 0 and numeric strings
          $hasGt = array_key_exists('gt', $range) && $range['gt'] !== '' && $range['gt'] !== null;
          $hasLt = array_key_exists('lt', $range) && $range['lt'] !== '' && $range['lt'] !== null;

          if (!$hasGt && !$hasLt)
               continue;

          // Inclusive bounds (>= for gt, <= for lt). Change to > / < if you need strict.
          if ($hasGt) {
               $where .= " AND `$col` >= ?";
               $types .= "d"; // double
               $params[] = (float) $range['gt'];
          }
          if ($hasLt) {
               $where .= " AND `$col` <= ?";
               $types .= "d";
               $params[] = (float) $range['lt'];
          }
     }

     // Nothing to filter? you can either return all or 400. Here we 400.
     if ($where === " WHERE 1=1") {
          http_response_code(400);
          echo json_encode(['error' => 'No valid filters provided']);
          exit;
     }

     // Pagination
     $limit = isset($data['limit']) ? (int) $data['limit'] : 200;
     $offset = isset($data['offset']) ? (int) $data['offset'] : 0;
     if ($limit <= 0)
          $limit = 200;
     if ($limit > 1000)
          $limit = 1000;
     if ($offset < 0)
          $offset = 0;

     // Optional ordering — adjust to match your schema. If you have an auto id, use it.
// Fallback to clientName if that’s your primary display name.
     $orderBy = "id";       // change if your PK/ordering column is different
     $orderDir = "DESC";

     $sql = "SELECT * FROM `$patientTable`" . $where . " ORDER BY `$orderBy` $orderDir LIMIT ? OFFSET ?";

     // Prepare
     $stmt = $conn->prepare($sql);
     if (!$stmt) {
          http_response_code(500);
          echo json_encode(['error' => 'Prepare failed', 'details' => $conn->error, 'sql' => $sql]);
          exit;
     }

     // Bind params (including limit/offset)
     $types .= "ii";
     $params[] = $limit;
     $params[] = $offset;

     $stmt->bind_param($types, ...$params);

     // Execute
     if (!$stmt->execute()) {
          http_response_code(500);
          echo json_encode(['error' => 'Execute failed', 'details' => $stmt->error]);
          $stmt->close();
          exit;
     }

     // Fetch
     $res = $stmt->get_result();
     $rows = $res ? $res->fetch_all(MYSQLI_ASSOC) : [];
     $stmt->close();

     // Return JSON
     echo json_encode($rows);

}

if ($data['script'] === 'updatePatientConditions') {
     $patientID = $data['patientID'] ?? null;
     $conditionCodes = $data['conditionCodes'] ?? null;
     if (!$patientID || $conditionCodes === null) {
          http_response_code(400);
          echo json_encode(['success' => false, 'error' => 'Missing patientID or conditionCodes']);
          exit;
     }

     $stmt = "UPDATE `$patientTable` SET conditionData = '{$conditionCodes}' WHERE id = '{$patientID}'";
     $go = $conn->query($stmt) or die($stmt);
}

if ($data['script'] === 'updatePatientSuspected') {
     $patientID = $data['patientID'] ?? null;
     $conditionCodes = $data['conditionCodes'] ?? null;


     if (!$patientID || $conditionCodes === null) {
          http_response_code(400);
          echo json_encode(['success' => false, 'error' => 'Missing patientID or conditionCodes']);
          exit;
     }

     $stmt = "UPDATE `$patientTable` SET suspectedCon = '{$conditionCodes}' WHERE id = '{$patientID}'";
     $go = $conn->query($stmt) or die($stmt);
}

if ($data['script'] === 'getPatientById') {
     $patientID = $data['patientID'] ?? null;

     if (!$patientID) {
          http_response_code(400);
          echo json_encode(['success' => false, 'error' => 'Missing patient ID']);
          exit;
     }
  
     $stmt = $conn->prepare("SELECT * FROM `$patientTable` WHERE id = ?");
     if (!$stmt) {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Prepare failed', 'details' => $conn->error]);
          exit;
     }
     $stmt->bind_param('i', $patientID);

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

if ($data['script'] === 'conditionSearch') {
     $conditionCodes = $data['codes'] ?? [];
     
     $patients = [];
     if (!empty($conditionCodes) && is_array($conditionCodes)) {
          $seen = [];
          foreach ($conditionCodes as $code) {
               $code = trim($code);
               if ($code === '') continue;
               // Use FIND_IN_SET for comma-separated values, or LIKE if needed
               $stmt = $conn->prepare("SELECT * FROM `$patientTable` WHERE FIND_IN_SET(?, conditionData)");
               $stmt->bind_param('s', $code);
               $stmt->execute();
               $result = $stmt->get_result();
               while ($row = $result->fetch_assoc()) {
                    $id = $row['id'];
                    if (!isset($seen[$id])) {
                         $patients[] = $row;
                         $seen[$id] = true;
                    }
               }
               $stmt->close();
          }
     }
     echo json_encode($patients);
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

if ($data['script'] === 'updatePaymentMethod') {
     $patientID = $data['patientID'] ?? null;
     $paymentMethod = $data['paymentMethod'] ?? null;

     if (!$patientID) {
          http_response_code(400);
          echo json_encode(['success' => false, 'error' => 'Missing patient ID']);
          exit;
     }

     $stmt = $conn->prepare("UPDATE `$patientTable` SET paymentMethod = ? WHERE id = ?");
     if (!$stmt) {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Prepare failed', 'details' => $conn->error]);
          exit;
     }
     $stmt->bind_param('si', $paymentMethod, $patientID);

     if ($stmt->execute()) {
          http_response_code(204); // no content
          exit;
     } else {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Query failed', 'details' => $stmt->error]);
          exit;
     }
}

if ($data['script'] === 'getMarkBrady') {
     $patientID = 2;

     if (!$patientID) {
          http_response_code(400);
          echo json_encode(['success' => false, 'error' => 'Missing patient ID']);
          exit;
     }
  
     $stmt = $conn->prepare("SELECT * FROM `$patientTable` WHERE id = ?");
     if (!$stmt) {
          http_response_code(500);
          echo json_encode(['success' => false, 'error' => 'Prepare failed', 'details' => $conn->error]);
          exit;
     }
     $stmt->bind_param('i', $patientID);

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