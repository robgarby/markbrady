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
function insertToHistory($conn, $data): bool
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

     $providerName = $patient['providerName'];
     $providerNumber = $patient['providerNumber'];
     $orderDate = date('Y-m-d', strtotime($patient['orderDate']));
     $labResults = $patient['labResults'];

     function getVal($arr, $key)
     {
          return isset($arr[$key]) && is_numeric($arr[$key]) ? $arr[$key] : 'NULL';
     }


     // SQL Insert
     $sql = "INSERT INTO Patient_History (
        clientName, clientStatus, healthNumber, sex, dateOfBirth,
        address, street, city, province, postalCode, fullAddress, telephone,
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
        '%s', '%s', '%s', '%s', '%s',
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



if ($data['script'] === 'newClient') {

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

     $providerName = $patient['providerName'];
     $providerNumber = $patient['providerNumber'];
     $orderDate = date('Y-m-d', strtotime($patient['orderDate']));
     $labResults = $patient['labResults'];

     function getVal($arr, $key)
     {
          return isset($arr[$key]) && is_numeric($arr[$key]) ? $arr[$key] : 'NULL';
     }


     // Create INSERT query with full field list
     $sql = "INSERT INTO Patient (
        clientName, clientStatus, healthNumber, sex, dateOfBirth,
        address, street, city, province, postalCode, fullAddress, telephone,
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
        '%s', '%s', '%s', '%s', '%s',
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


     // History logging
     $historySql = "INSERT INTO Patient_History (
        clientName, clientStatus, healthNumber, sex, dateOfBirth,
        address, street, city, province, postalCode, fullAddress, telephone,
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
        clientName, clientStatus, healthNumber, sex, dateOfBirth,
        address, street, city, province, postalCode, fullAddress, telephone,
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
    FROM Patient WHERE healthNumber = '$healthNumber'";

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

function mergeData($key, $value, $orderDate, $conn, $healthNumber)
{
     $a = "SELECT $key, {$key}Date FROM Patient WHERE healthNumber = '$healthNumber'";
     $aa = $conn->query($a);
     if ($aa && $row = $aa->fetch_assoc()) {
          $existingDate = $row["{$key}Date"];
          if ($existingDate >= $orderDate) {
               // If the existing date is more recent or the same, do not update
               return;
          } else {
               if ($value !== '' && $value !== null) {
                    $sql = "UPDATE Patient SET $key = $value, {$key}Date = '$orderDate' WHERE healthNumber = '$healthNumber'";
                    $conn->query($sql);
               }
          }
     }
}

if ($data['script'] === 'updateClient') {
     $patient = $data['patient'];
     $healthNumber = $patient['healthNumber'];
     $labResults = $patient['labResults'];
     $orderDate = date('Y-m-d', strtotime($patient['orderDate']));
     $a = "select count(*) from Patient_History where healthNumber = '$healthNumber' and orderDate = '$orderDate'";
     $result = $conn->query($a);
     $row = $result->fetch_row();
     $recordCount = $row[0]; // Count how many records match
     if ($recordCount > 0) {
          echo json_encode(['status' => 'duplicate']);
          $conn->close();
          exit;
     } else {
          $returnValue = insertToHistory($conn, $data);
          if ($returnValue) {
               foreach ($labResults as $key => $value) {
                    mergeData($key, $value, $orderDate, $conn, $healthNumber);
               }
               echo json_encode(['status' => 'inserted']);
          } else {
               echo json_encode(['success' => 'No', 'error' => 'Failed to insert into Patient_History']);
          }

     }
}

if ($data['script'] === 'getStatus') {
     $healthNumber = $data['healthNumber'];

     // Prepare and execute query to check if healthNumber exists in Patient table
     $stmt = $conn->prepare("SELECT 1 FROM Patient WHERE healthNumber = ?");
     $stmt->bind_param("s", $healthNumber);
     $stmt->execute();
     $stmt->store_result();

     if ($stmt->num_rows > 0) {
          echo json_encode(['status' => 'update']); // healthNumber exists
     } else {
          echo json_encode(['status' => 'new']); // healthNumber does not exist
     }

     $stmt->close();
     $conn->close();
}

if ($data['script'] === 'patientSearch') {
     $searchTerm = $data['searchTerm'];
     $searchTerm = '%' . $searchTerm . '%';

     // Prepare and execute query to search for healthNumber or clientName
     $stmt = $conn->prepare("SELECT * FROM Patient WHERE healthNumber LIKE ? OR clientName LIKE ?");
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
     $sql = "UPDATE Patient SET $setString WHERE healthNumber = '$healthNumberEscaped'";

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
?>