<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");
header('Content-Type: text/plain'); // So you can easily see plain output during debug


if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
     echo "Invalid request method.";
     exit;
}
$servername = "localhost";
$username = "markbrady_markbrady";
$password = "NoahandK++";
$dbname = "markbrady_optimize";

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);


// --- File handling section ---
$response = ['success' => 'No'];

if (isset($_FILES['pdf']) && isset($_POST['healthNumber'])) {
     $file = $_FILES['pdf'];
     $originalFileName = $file['name'];
     $healthNumber = preg_replace("/[^0-9]/", "", $_POST['healthNumber']);
     $uploadDir = __DIR__ . "/uploads/";
     if (!is_dir($uploadDir)) {
          mkdir($uploadDir, 0777, true);
     }
     $filename = $uploadDir . $healthNumber . '_' . $originalFileName;
     if (move_uploaded_file($file['tmp_name'], $filename)) {
          // Derive values
          $fileNameOnly = basename($filename);
          $shortName = isset($originalFileName) ? $originalFileName : pathinfo($fileNameOnly, PATHINFO_FILENAME);

          // Prepare with NOW() in SQL (3 placeholders; timestamp set by SQL)
          $sql = "INSERT INTO patientPDF (healthNumber, PDFfileName, shortName, PDFtimeStamp, labDate)
            VALUES (?, ?, ?, NOW(), NOW())";
          $stmt = $conn->prepare($sql);
          if (!$stmt) {
               $response['error'] = "Prepare failed: {$conn->error}";
          } else {
               // 3 placeholders => 3 bound params
               $stmt->bind_param("sss", $healthNumber, $fileNameOnly, $shortName);
               if (!$stmt->execute()) {
                    $response['error'] = "Database insert failed: {$stmt->error}";
               }
               $stmt->close();
          }
     } else {
          $response['error'] = 'Failed to move uploaded file.';
     }

} else {
     $response['error'] = 'Missing file or health number.';
}

header('Content-Type: application/json');
echo json_encode($response);
?>