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

$conn->query("SET SESSION sql_mode=''");


// --- File handling section ---
$response = ['success' => 'No'];

if (isset($_FILES['pdf']) && isset($_POST['healthNumber'])) {
     $file = $_FILES['pdf'];
     $uploadedFileName = $file['name']; // This is the original name of the uploaded file
     $healthNumber = preg_replace("/[^0-9]/", "", $_POST['healthNumber']);
     $orderDate = date('Ymd', strtotime($_POST['orderDate'] ?? 'today'));
     $clientStatus = $_POST['patientStatus'] ?? '';
     $nextAppointment = $_POST['nextAppointment'] ?? null;
     $uploadDir = __DIR__ . "/uploads/";
     if (!is_dir($uploadDir)) {
          mkdir($uploadDir, 0777, true);
     }
     $randomNumber = rand(1000, 10000);
     $filename = $uploadDir . $healthNumber . '_' . $randomNumber . '_' . $orderDate. '.pdf';
     $fileNameOnly = $healthNumber . '_' . $randomNumber . '_' . $orderDate. '.pdf';
     if (move_uploaded_file($file['tmp_name'], $filename)) {
          $stmt = "INSERT INTO patientFiles (healthNumber, PDFfileName, PDFtimeStamp, labDate) VALUES ('$healthNumber', '$fileNameOnly', NOW(), '$orderDate')";
          if (!$conn->query($stmt)) {
               $response['error'] = 'Database insert failed: ' . $conn->error;
          }
          $response['success'] = 'Yes';
          $response['message'] = 'File uploaded successfully.';
     } else {
          $response['error'] = 'Failed to move uploaded file.';
     }
} else {
     $response['error'] = 'Missing file or health number.';
}

header('Content-Type: application/json');
echo json_encode($response);
?>